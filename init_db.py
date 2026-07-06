import sqlite3
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def init_db():
    db_url = os.environ.get('DATABASE_URL')
    is_postgres = False
    
    if db_url:
        import psycopg2
        print("Connecting to PostgreSQL database for initialization...")
        conn = psycopg2.connect(db_url)
        is_postgres = True
    else:
        db_path = 'database.sqlite'
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
                print("Removed old database.sqlite to perform clean schema rebuild.")
            except Exception as e:
                print(f"Notice: Could not remove old database file (might be locked): {e}")
        conn = sqlite3.connect(db_path)
        is_postgres = False

    cursor = conn.cursor()

    if not is_postgres:
        cursor.execute("PRAGMA foreign_keys = ON;")

    def execute_ddl(sql):
        if is_postgres:
            # Convert SQLite AUTOINCREMENT to Postgres SERIAL
            sql = sql.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')
        cursor.execute(sql)

    # Users table
    execute_ddl('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL UNIQUE,
        name TEXT,
        vehicle_no TEXT,
        role TEXT DEFAULT 'driver',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # OTP Sessions table
    execute_ddl('''
    CREATE TABLE IF NOT EXISTS otp_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        otp TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Bookings table
    execute_ddl('''
    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id TEXT NOT NULL UNIQUE,
        user_phone TEXT NOT NULL,
        lot_id INTEGER NOT NULL,
        lot_name TEXT NOT NULL,
        lot_area TEXT NOT NULL,
        spot_code TEXT NOT NULL,
        vehicle TEXT NOT NULL,
        duration_hrs INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        total_paid REAL NOT NULL,
        status TEXT DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Payments table
    execute_ddl('''
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id TEXT NOT NULL,
        razorpay_order_id TEXT NOT NULL,
        razorpay_payment_id TEXT,
        razorpay_signature TEXT,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Host listings table
    execute_ddl('''
    CREATE TABLE IF NOT EXISTS host_listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_phone TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        spots INTEGER NOT NULL,
        rate REAL NOT NULL,
        address TEXT,
        lat REAL,
        lng REAL,
        availability_hrs TEXT DEFAULT '24/7',
        description TEXT,
        status TEXT DEFAULT 'active',
        bookings INTEGER DEFAULT 0,
        earned REAL DEFAULT 0,
        views INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Reviews table
    execute_ddl('''
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lot_id INTEGER NOT NULL,
        user_phone TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # IoT sensor readings table
    execute_ddl('''
    CREATE TABLE IF NOT EXISTS sensor_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        lot_id INTEGER NOT NULL,
        slot_id TEXT NOT NULL,
        occupied BOOLEAN NOT NULL,
        distance_cm REAL,
        rssi_dbm INTEGER,
        temp_c REAL,
        reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    conn.commit()
    conn.close()
    print("Database initialized successfully with production schema.")

if __name__ == '__main__':
    init_db()
