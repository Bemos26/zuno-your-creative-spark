import os
import pymysql
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

def init_db():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set.")
        return

    url = urllib.parse.urlparse(database_url)
    print(f"Connecting to {url.hostname}...")
    
    conn = pymysql.connect(
        host=url.hostname,
        user=url.username,
        password=url.password,
        port=url.port or 3306,
        database=url.path.lstrip('/'),
        ssl={'ca': None}  # Required for Aiven
    )

    with open('schema.sql', 'r') as f:
        sql_script = f.read()

    try:
        with conn.cursor() as cursor:
            for statement in sql_script.split(';'):
                statement = statement.strip()
                if statement:
                    print(f"Executing: {statement[:50]}...")
                    cursor.execute(statement)
        conn.commit()
    finally:
        conn.close()
    print("Database initialized successfully!")

if __name__ == "__main__":
    init_db()
