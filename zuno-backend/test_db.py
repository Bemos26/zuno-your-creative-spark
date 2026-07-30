import pymysql

try:
    conn = pymysql.connect(host='localhost', user='root', password='')
    print("SUCCESS: Connected to MySQL as root with no password!")
    
    # Try to create database if not exists
    with conn.cursor() as cursor:
        cursor.execute("CREATE DATABASE IF NOT EXISTS zuno_waitlist")
        print("SUCCESS: Database 'zuno_waitlist' is ready.")
except Exception as e:
    print(f"FAILED: {e}")
