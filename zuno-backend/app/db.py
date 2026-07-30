"""
Database connection helper
============================
This is the ONLY file in the whole project that knows how to open a
connection to MySQL. Every other file (models) asks this function for
a connection instead of configuring PyMySQL itself. If you ever need to
change how connections are made (e.g. add connection pooling later),
this is the one place you'd touch.

How it works, step by step:
1. Flask stores your config (DB_HOST, DB_USER, etc.) on `current_app`.
2. `get_db_connection()` reads those values and opens a fresh connection
   to MySQL using PyMySQL (the library that speaks MySQL's protocol).
3. Whoever calls this function is responsible for closing the connection
   when they're done (you'll see `finally: conn.close()` in models/waitlist.py).
"""

import sqlite3
from flask import current_app
import os

def get_db_connection():
    """
    Opens a new connection to the zuno_waitlist SQLite database.
    """
    db_path = os.path.join(current_app.root_path, '..', 'waitlist.db')
    conn = sqlite3.connect(
        db_path,
        detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES
    )
    conn.row_factory = sqlite3.Row
    return conn
