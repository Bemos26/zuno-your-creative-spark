import os
import secrets
import pymysql

backend_dir = r"c:\My-projects\Zuno\zuno-backend"
env_path = os.path.join(backend_dir, ".env")
schema_path = os.path.join(backend_dir, "schema.sql")

# 1. Create .env
if not os.path.exists(env_path):
    secret_key = secrets.token_hex(32)
    env_content = f"""FLASK_ENV=development
SECRET_KEY={secret_key}
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=zuno_waitlist
RATELIMIT_STORAGE_URI=memory://
"""
    with open(env_path, "w") as f:
        f.write(env_content)
    print("SUCCESS: Created .env file")
else:
    print("INFO: .env file already exists")

# 2. Initialize SQLite Database
import sqlite3
try:
    conn = sqlite3.connect(os.path.join(backend_dir, '..', 'waitlist.db'))
    print("SUCCESS: Connected to SQLite")
    
    with open(schema_path, "r") as f:
        schema_sql = f.read()
    
    # Run the schema creation
    conn.executescript(schema_sql)
    conn.commit()
    print("SUCCESS: Tables initialized from schema.sql in waitlist.db")
    
except Exception as e:
    print(f"FAILED to initialize database: {e}")
finally:
    if 'conn' in locals():
        conn.close()
