import unittest
import os
import json
import sqlite3
import app

TEST_DB = 'test_database.sqlite'

class ParkAITestCase(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Override the database file in the app module to use a test file
        app.DB_FILE = TEST_DB

    def setUp(self):
        # Ensure a clean database for each test
        if os.path.exists(TEST_DB):
            os.remove(TEST_DB)
            
        self.init_test_db()
        self.app = app.app.test_client()
        self.app.testing = True

    def tearDown(self):
        # Clean up database file after test
        if os.path.exists(TEST_DB):
            try:
                os.remove(TEST_DB)
            except PermissionError:
                pass # ignore if file is temporarily locked

    def init_test_db(self):
        # Recreate schema for tests
        conn = sqlite3.connect(TEST_DB)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE NOT NULL,
                name TEXT DEFAULT "",
                vehicle_no TEXT DEFAULT "",
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS otp_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT NOT NULL,
                otp TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS host_listings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_phone TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                spots INTEGER NOT NULL,
                rate REAL NOT NULL,
                address TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                availability_hrs TEXT DEFAULT "24/7",
                description TEXT DEFAULT "",
                status TEXT DEFAULT "Active",
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id TEXT UNIQUE NOT NULL,
                user_phone TEXT NOT NULL,
                lot_id INTEGER NOT NULL,
                lot_name TEXT NOT NULL,
                lot_area TEXT NOT NULL,
                spot_code TEXT NOT NULL,
                vehicle TEXT NOT NULL,
                duration_hrs REAL NOT NULL,
                total_paid REAL NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                status TEXT DEFAULT "pending_payment",
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Insert a dummy listing for testing
        cursor.execute('''
            INSERT INTO host_listings (owner_phone, name, type, spots, rate, address, lat, lng, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', ('9999999999', 'Test Hub', 'Covered', 5, 40.0, 'Adyar, Chennai', 13.0063, 80.2574, 'active'))
        
        conn.commit()
        conn.close()

    def test_send_and_verify_otp(self):
        # 1. Send OTP
        response = self.app.post('/api/auth/send-otp', json={'phone': '9876543210'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('debug_otp', data)
        otp = data['debug_otp']

        # 2. Verify OTP
        response_verify = self.app.post('/api/auth/verify-otp', json={
            'phone': '9876543210',
            'otp': otp
        })
        self.assertEqual(response_verify.status_code, 200)
        verify_data = json.loads(response_verify.data)
        self.assertIn('token', verify_data)
        self.assertIn('user', verify_data)
        self.assertEqual(verify_data['user']['phone'], '9876543210')

    def test_verify_otp_invalid(self):
        # Verify with incorrect OTP
        response = self.app.post('/api/auth/verify-otp', json={
            'phone': '9876543210',
            'otp': '000000'
        })
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('error', data)

    def test_get_listings(self):
        # Verify public listing fetch works
        response = self.app.get('/api/listings')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['name'], 'Test Hub')

    def test_unauthorized_endpoints(self):
        # Accessing private endpoint without headers should be 401
        response = self.app.get('/api/bookings')
        self.assertEqual(response.status_code, 401)

    def test_booking_creation_and_retrieval(self):
        # 1. Login user to get token
        response = self.app.post('/api/auth/send-otp', json={'phone': '9876543210'})
        otp = json.loads(response.data)['debug_otp']
        
        response_verify = self.app.post('/api/auth/verify-otp', json={
            'phone': '9876543210',
            'otp': otp
        })
        token = json.loads(response_verify.data)['token']

        # 2. Create a booking
        booking_payload = {
            'booking_id': 'BK-TEST-123',
            'lot_id': 1,
            'lot_name': 'Test Hub',
            'lot_area': 'Adyar',
            'spot_code': 'A-01',
            'vehicle': 'TN 07 AB 1234',
            'duration_hrs': 2,
            'total_paid': 80.0,
            'start_time': '2026-07-05T18:00:00Z',
            'end_time': '2026-07-05T20:00:00Z'
        }
        
        response_booking = self.app.post('/api/bookings', 
            json=booking_payload,
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(response_booking.status_code, 201)
        booking_res = json.loads(response_booking.data)[0]
        self.assertEqual(booking_res['booking_id'], 'BK-TEST-123')
        self.assertEqual(booking_res['status'], 'pending_payment')

        # 3. Retrieve user bookings
        response_get = self.app.get('/api/bookings', 
            headers={'Authorization': f'Bearer {token}'}
        )
        self.assertEqual(response_get.status_code, 200)
        bookings = json.loads(response_get.data)
        self.assertEqual(len(bookings), 1)
        self.assertEqual(bookings[0]['booking_id'], 'BK-TEST-123')

if __name__ == '__main__':
    unittest.main()
