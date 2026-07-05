from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import sqlite3
import os
import random
import uuid
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

DB_FILE = 'database.sqlite'

# Session store: token -> user_phone
ACTIVE_SESSIONS = {}

# Try to import razorpay, fallback to simulated payment if missing or credentials not set
try:
    import razorpay
    RAZORPAY_AVAILABLE = True
except ImportError:
    RAZORPAY_AVAILABLE = False

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# Helper to check authentication
def get_user_from_request():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    return ACTIVE_SESSIONS.get(token)

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

# ==========================================
# 🔐 AUTHENTICATION ENDPOINTS
# ==========================================

@app.route('/api/auth/send-otp', methods=['POST'])
def send_otp():
    data = request.json
    if not data or 'phone' not in data:
        return jsonify({'error': 'Phone number is required'}), 400
    
    phone = data['phone'].strip()
    if not phone:
        return jsonify({'error': 'Invalid phone number'}), 400

    otp = str(random.randint(100000, 999999))
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO otp_sessions (phone, otp) VALUES (?, ?)', (phone, otp))
    conn.commit()
    conn.close()

    print(f"\n--- [OTP DEBUG] OTP for {phone} is: {otp} ---\n")
    
    # Return success, in dev mode we also return the OTP so the frontend can auto-verify or show it
    return jsonify({
        'success': True,
        'message': 'OTP sent successfully (Simulated)',
        'debug_otp': otp  # Expose in dev mode for seamless testing
    })

@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json
    if not data or 'phone' not in data or 'otp' not in data:
        return jsonify({'error': 'Phone and OTP are required'}), 400
    
    phone = data['phone'].strip()
    otp = data['otp'].strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT * FROM otp_sessions WHERE phone = ? AND otp = ? ORDER BY created_at DESC LIMIT 1',
        (phone, otp)
    )
    session = cursor.fetchone()

    if not session:
        conn.close()
        return jsonify({'error': 'Invalid or expired OTP'}), 400

    # OTP is valid, clear sessions for this phone
    cursor.execute('DELETE FROM otp_sessions WHERE phone = ?', (phone,))
    
    # Check if user exists
    cursor.execute('SELECT * FROM users WHERE phone = ?', (phone,))
    user = cursor.fetchone()
    
    if not user:
        # Create a blank user profile to be filled
        cursor.execute('INSERT INTO users (phone, name, vehicle_no) VALUES (?, ?, ?)', (phone, '', ''))
        conn.commit()
        cursor.execute('SELECT * FROM users WHERE phone = ?', (phone,))
        user = cursor.fetchone()
        is_new_user = True
    else:
        is_new_user = not user['name']

    conn.commit()
    user_dict = dict(user)
    conn.close()

    # Generate a login session token
    token = str(uuid.uuid4())
    ACTIVE_SESSIONS[token] = phone

    return jsonify({
        'success': True,
        'token': token,
        'user': user_dict,
        'is_new_user': is_new_user
    })

@app.route('/api/auth/update-profile', methods=['POST'])
def update_profile():
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    if not data:
        return jsonify({'error': 'Invalid body'}), 400
    
    name = data.get('name', '').strip()
    vehicle_no = data.get('vehicle_no', '').strip()

    if not name:
        return jsonify({'error': 'Name is required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET name = ?, vehicle_no = ? WHERE phone = ?', (name, vehicle_no, phone))
    conn.commit()
    
    cursor.execute('SELECT * FROM users WHERE phone = ?', (phone,))
    user = dict(cursor.fetchone())
    conn.close()

    return jsonify({'success': True, 'user': user})

@app.route('/api/auth/me', methods=['GET'])
def get_me():
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE phone = ?', (phone,)).fetchone()
    conn.close()

    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    return jsonify(dict(user))

# ==========================================
# 📅 TIME-SLOT BOOKING AND CO-COLLISION CHECK
# ==========================================

def has_booking_conflict(lot_id, spot_code, start_iso, end_iso, exclude_booking_id=None):
    conn = get_db_connection()
    query = '''
        SELECT * FROM bookings 
        WHERE lot_id = ? AND spot_code = ? AND status = 'confirmed'
    '''
    params = [lot_id, spot_code]
    if exclude_booking_id:
        query += " AND booking_id != ?"
        params.append(exclude_booking_id)
        
    bookings = conn.execute(query, params).fetchall()
    conn.close()

    s1 = datetime.fromisoformat(start_iso)
    e1 = datetime.fromisoformat(end_iso)

    for b in bookings:
        s2 = datetime.fromisoformat(b['start_time'])
        e2 = datetime.fromisoformat(b['end_time'])
        
        # Check overlap: max(s1, s2) < min(e1, e2)
        if max(s1, s2) < min(e1, e2):
            return True
            
    return False

@app.route('/api/slots/check', methods=['POST'])
def check_slot():
    data = request.json
    if not data or not all(k in data for k in ['lot_id', 'spot_code', 'start_time', 'end_time']):
        return jsonify({'error': 'Missing check slot parameters'}), 400
        
    conflict = has_booking_conflict(
        data['lot_id'], data['spot_code'], data['start_time'], data['end_time']
    )
    return jsonify({'available': not conflict})

# ==========================================
# 💳 PAYMENT ENDPOINTS
# ==========================================

@app.route('/api/payments/create-order', methods=['POST'])
def create_payment_order():
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    if not data or 'amount' not in data or 'booking_id' not in data:
        return jsonify({'error': 'Amount and booking_id are required'}), 400

    amount = float(data['amount'])
    booking_id = data['booking_id']

    # Read Razorpay Keys from environment if configured
    rz_key = os.environ.get('RAZORPAY_KEY_ID')
    rz_secret = os.environ.get('RAZORPAY_KEY_SECRET')

    if RAZORPAY_AVAILABLE and rz_key and rz_secret:
        try:
            client = razorpay.Client(auth=(rz_key, rz_secret))
            # amount in paise (1 INR = 100 paise)
            order_data = {
                'amount': int(amount * 100),
                'currency': 'INR',
                'receipt': booking_id,
                'payment_capture': 1
            }
            order = client.order.create(data=order_data)
            order_id = order['id']
            is_dummy = False
        except Exception as e:
            print(f"Razorpay order creation failed: {e}. Falling back to simulation.")
            order_id = f"order_sim_{uuid.uuid4().hex[:12]}"
            is_dummy = True
    else:
        order_id = f"order_sim_{uuid.uuid4().hex[:12]}"
        is_dummy = True

    conn = get_db_connection()
    conn.execute('''
        INSERT INTO payments (booking_id, razorpay_order_id, amount, status)
        VALUES (?, ?, ?, 'pending')
    ''', (booking_id, order_id, amount))
    conn.commit()
    conn.close()

    return jsonify({
        'order_id': order_id,
        'key': rz_key or 'rzp_test_dummykey123',
        'is_dummy': is_dummy
    })

@app.route('/api/payments/verify', methods=['POST'])
def verify_payment():
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    if not data or not all(k in data for k in ['booking_id', 'razorpay_order_id']):
        return jsonify({'error': 'Missing parameters'}), 400

    booking_id = data['booking_id']
    order_id = data['razorpay_order_id']
    payment_id = data.get('razorpay_payment_id', f"pay_sim_{uuid.uuid4().hex[:12]}")
    signature = data.get('razorpay_signature', 'simulated_sig')

    # Razorpay verification if enabled
    rz_secret = os.environ.get('RAZORPAY_KEY_SECRET')
    verified = True

    if RAZORPAY_AVAILABLE and rz_secret and not order_id.startswith('order_sim_'):
        try:
            client = razorpay.Client(auth=(os.environ.get('RAZORPAY_KEY_ID'), rz_secret))
            params_dict = {
                'razorpay_order_id': order_id,
                'razorpay_payment_id': payment_id,
                'razorpay_signature': signature
            }
            client.utility.verify_payment_signature(params_dict)
        except Exception as e:
            print(f"Signature verification failed: {e}")
            verified = False

    conn = get_db_connection()
    if verified:
        conn.execute('''
            UPDATE payments 
            SET status = 'success', razorpay_payment_id = ?, razorpay_signature = ? 
            WHERE booking_id = ? AND razorpay_order_id = ?
        ''', (payment_id, signature, booking_id, order_id))
        
        # Confirm the booking in DB
        conn.execute("UPDATE bookings SET status = 'confirmed' WHERE booking_id = ?", (booking_id,))
        
        # Increment bookings & earnings count for the lot
        booking = conn.execute('SELECT lot_id, total_paid FROM bookings WHERE booking_id = ?', (booking_id,)).fetchone()
        if booking:
            conn.execute('''
                UPDATE host_listings 
                SET bookings = bookings + 1, earned = earned + ? 
                WHERE id = ?
            ''', (booking['total_paid'], booking['lot_id']))
            
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Payment verified successfully'})
    else:
        conn.execute('''
            UPDATE payments SET status = 'failed' 
            WHERE booking_id = ? AND razorpay_order_id = ?
        ''', (booking_id, order_id))
        conn.commit()
        conn.close()
        return jsonify({'error': 'Payment verification failed'}), 400

# ==========================================
# 🎫 BOOKINGS ENDPOINTS
# ==========================================

@app.route('/api/bookings', methods=['POST'])
def create_booking():
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400
        
    required_fields = ['booking_id', 'lot_id', 'lot_name', 'lot_area', 'spot_code', 'vehicle', 'duration_hrs', 'total_paid', 'start_time', 'end_time']
    for field in required_fields:
        if field not in data or data[field] is None:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Check slots conflict before booking
    if has_booking_conflict(data['lot_id'], data['spot_code'], data['start_time'], data['end_time']):
        return jsonify({'error': 'This parking slot has already been booked for the selected hours'}), 409

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO bookings 
        (booking_id, user_phone, lot_id, lot_name, lot_area, spot_code, vehicle, duration_hrs, start_time, end_time, total_paid, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')
    ''', (
        data.get('booking_id'), phone, data.get('lot_id'), data.get('lot_name'), 
        data.get('lot_area'), data.get('spot_code'), data.get('vehicle'), 
        data.get('duration_hrs'), data.get('start_time'), data.get('end_time'), 
        data.get('total_paid')
    ))
    conn.commit()
    
    cursor.execute('SELECT * FROM bookings WHERE booking_id = ?', (data.get('booking_id'),))
    new_booking = dict(cursor.fetchone())
    conn.close()
    
    # Broadcast to all connected clients
    socketio.emit('new_booking', new_booking)
    
    return jsonify([new_booking]), 201

@app.route('/api/bookings', methods=['GET'])
def list_bookings():
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401
        
    limit = request.args.get('limit', 50, type=int)
    conn = get_db_connection()
    bookings = conn.execute(
        'SELECT * FROM bookings WHERE user_phone = ? ORDER BY created_at DESC LIMIT ?', 
        (phone, limit)
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in bookings])

@app.route('/api/bookings/<string:booking_id>/cancel', methods=['POST'])
def cancel_booking(booking_id):
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db_connection()
    booking = conn.execute('SELECT * FROM bookings WHERE booking_id = ? AND user_phone = ?', (booking_id, phone)).fetchone()
    if not booking:
        conn.close()
        return jsonify({'error': 'Booking not found'}), 404

    # Cancellation business rules: e.g., can cancel only up to 30 mins before start
    start_dt = datetime.fromisoformat(booking['start_time'])
    if datetime.now() > (start_dt - timedelta(minutes=30)):
        conn.close()
        return jsonify({'error': 'Cancellations allowed only up to 30 minutes before booking start time.'}), 400

    # Cancel payment refund simulation
    conn.execute("UPDATE bookings SET status = 'cancelled' WHERE booking_id = ?", (booking_id,))
    conn.execute("UPDATE payments SET status = 'refunded' WHERE booking_id = ?", (booking_id,))
    
    # Decrement host lot earnings & booking counts
    conn.execute('''
        UPDATE host_listings 
        SET bookings = MAX(0, bookings - 1), earned = MAX(0.0, earned - ?) 
        WHERE id = ?
    ''', (booking['total_paid'], booking['lot_id']))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Booking cancelled and refund initiated'})

@app.route('/api/bookings/<string:booking_id>/extend', methods=['PUT'])
def extend_booking(booking_id):
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    if not data or 'duration_hrs' not in data or 'total_paid' not in data:
        return jsonify({'error': 'Missing extend params'}), 400

    conn = get_db_connection()
    booking = conn.execute('SELECT * FROM bookings WHERE booking_id = ? AND user_phone = ?', (booking_id, phone)).fetchone()
    if not booking:
        conn.close()
        return jsonify({'error': 'Booking not found'}), 404

    # Calculate new end time
    new_end_dt = datetime.fromisoformat(booking['end_time']) + timedelta(hours=int(data['duration_hrs']))
    new_end_iso = new_end_dt.isoformat()

    # Check conflict with extended hours
    if has_booking_conflict(booking['lot_id'], booking['spot_code'], booking['end_time'], new_end_iso, exclude_booking_id=booking_id):
        conn.close()
        return jsonify({'error': 'Cannot extend. The slot is booked by someone else after your slot.'}), 409

    new_duration = booking['duration_hrs'] + int(data['duration_hrs'])
    new_total = booking['total_paid'] + float(data['total_paid'])

    conn.execute(
        'UPDATE bookings SET duration_hrs=?, end_time=?, total_paid=? WHERE booking_id=?',
        (new_duration, new_end_iso, new_total, booking_id)
    )
    # Increment host earnings
    conn.execute('UPDATE host_listings SET earned = earned + ? WHERE id = ?', (float(data['total_paid']), booking['lot_id']))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==========================================
# 🏠 HOST PORTAL ENDPOINTS
# ==========================================

@app.route('/api/listings', methods=['POST'])
def create_listing():
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400
        
    required_fields = ['name', 'type', 'spots', 'rate', 'address', 'lat', 'lng']
    for field in required_fields:
        if field not in data or data[field] is None:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    try:
        spots = int(data['spots'])
        rate = float(data['rate'])
        lat = float(data['lat'])
        lng = float(data['lng'])
    except ValueError:
        return jsonify({'error': 'Invalid format'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO host_listings (user_phone, name, type, spots, rate, address, lat, lng, availability_hrs, description, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending') -- Pending admin approval for trust and safety
    ''', (
        phone, data['name'], data['type'], spots, rate,
        data['address'], lat, lng, data.get('availability_hrs', '24/7'),
        data.get('description', ''), 'pending'
    ))
    conn.commit()
    listing_id = cursor.lastrowid
    
    cursor.execute('SELECT * FROM host_listings WHERE id = ?', (listing_id,))
    new_listing = dict(cursor.fetchone())
    conn.close()
    
    return jsonify([new_listing]), 201

@app.route('/api/listings', methods=['GET'])
def list_listings():
    conn = get_db_connection()
    listings = conn.execute(
        "SELECT * FROM host_listings WHERE status = 'active' ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in listings])

@app.route('/api/host/listings', methods=['GET'])
def list_host_listings():
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db_connection()
    listings = conn.execute(
        'SELECT * FROM host_listings WHERE user_phone = ? ORDER BY created_at DESC', (phone,)
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in listings])

@app.route('/api/listings/<int:listing_id>/status', methods=['PUT'])
def update_listing_status(listing_id):
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    status = data.get('status')
    if not status:
        return jsonify({'error': 'Status is required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'UPDATE host_listings SET status = ? WHERE id = ? AND user_phone = ?',
        (status, listing_id, phone)
    )
    conn.commit()
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Listing not found or unauthorized'}), 404
        
    conn.close()
    return jsonify({'success': True})

@app.route('/api/listings/<int:listing_id>/details', methods=['PUT'])
def update_listing_details(listing_id):
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400
    name  = data.get('name')
    type_ = data.get('type')
    spots = data.get('spots')
    rate  = data.get('rate')
    
    if not all([name, type_, spots, rate]):
        return jsonify({'error': 'Missing fields'}), 400
    try:
        spots = int(spots)
        rate  = float(rate)
    except ValueError:
        return jsonify({'error': 'Invalid types'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'UPDATE host_listings SET name=?, type=?, spots=?, rate=? WHERE id=? AND user_phone=?',
        (name, type_, spots, rate, listing_id, phone)
    )
    conn.commit()
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Listing not found or unauthorized'}), 404
    conn.close()
    return jsonify({'success': True})

# ==========================================
# ⭐ REVIEWS AND RATINGS ENDPOINTS
# ==========================================

@app.route('/api/reviews', methods=['POST'])
def create_review():
    phone = get_user_from_request()
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    if not data or not all(k in data for k in ['lot_id', 'rating']):
        return jsonify({'error': 'lot_id and rating required'}), 400

    rating = int(data['rating'])
    if rating < 1 or rating > 5:
        return jsonify({'error': 'Rating must be between 1 and 5'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO reviews (lot_id, user_phone, rating, comment)
        VALUES (?, ?, ?, ?)
    ''', (data['lot_id'], phone, rating, data.get('comment', '')))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Review added successfully'})

@app.route('/api/lots/<int:lot_id>/reviews', methods=['GET'])
def get_lot_reviews(lot_id):
    conn = get_db_connection()
    reviews = conn.execute(
        'SELECT r.*, u.name as user_name FROM reviews r JOIN users u ON r.user_phone = u.phone WHERE r.lot_id = ? ORDER BY r.created_at DESC',
        (lot_id,)
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in reviews])

# ==========================================
# 📡 IOT SENSOR NETWORK ENDPOINTS
# ==========================================

@app.route('/api/sensors', methods=['POST'])
def create_sensor_reading():
    data = request.json
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400
        
    required_fields = ['node_id', 'lot_id', 'slot_id', 'occupied']
    for field in required_fields:
        if field not in data or data[field] is None:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO sensor_readings (node_id, lot_id, slot_id, occupied, distance_cm, rssi_dbm, temp_c)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get('node_id'), data.get('lot_id'), data.get('slot_id'), 
        data.get('occupied'), data.get('distance_cm'), data.get('rssi_dbm'), 
        data.get('temp_c')
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True}), 201

if __name__ == '__main__':
    print("Starting PARK AI backend on http://localhost:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=False, allow_unsafe_werkzeug=True)
