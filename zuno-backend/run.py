"""
Local development entrypoint.

Run with:  python run.py
Production should instead use gunicorn (see README), never this file.
"""

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
