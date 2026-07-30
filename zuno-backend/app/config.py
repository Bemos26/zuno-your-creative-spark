"""
Configuration
=============
All configuration is read from environment variables (via python-dotenv),
never hard-coded. This is a core security practice: secrets and
credentials must never live in source control.
"""

import os
from dotenv import load_dotenv

load_dotenv()  # reads the .env file into environment variables


class Config:
    # SECRET_KEY signs anything Flask cryptographically signs.
    # Must be a long random string kept out of git.
    SECRET_KEY = os.environ.get("SECRET_KEY")

    # Allow providing a single DATABASE_URL (e.g. from Aiven)
    DATABASE_URL = os.environ.get("DATABASE_URL")
    if DATABASE_URL:
        import urllib.parse
        url = urllib.parse.urlparse(DATABASE_URL)
        DB_HOST = url.hostname
        DB_PORT = url.port or 3306
        DB_USER = url.username
        DB_PASSWORD = url.password
        DB_NAME = url.path.lstrip('/')
    else:
        # Plain MySQL connection details — used directly by app/db.py
        DB_HOST = os.environ.get("DB_HOST", "localhost")
        DB_PORT = os.environ.get("DB_PORT", "3306")
        DB_USER = os.environ.get("DB_USER", "root")
        DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
        DB_NAME = os.environ.get("DB_NAME", "zuno_waitlist")

    JSON_SORT_KEYS = False

    # Comma-separated list in .env, e.g:
    # CORS_ORIGINS=http://localhost:3000,https://zuno.co.ke
    CORS_ORIGINS = [
        origin.strip().rstrip('/')
        for origin in os.environ.get("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]

    # Rate limiter storage. In-memory is fine for a single-server MVP.
    # Swap for Redis once you run more than one server instance.
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    # --- Email (for verification links) --------------------------------
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "Zuno Waitlist <onboarding@resend.dev>")

    # Used to build the verification link inside the email, e.g.
    # http://localhost:5000/api/v1/waitlist/verify/<token>
    API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:5000")

    # Where the browser is redirected after clicking the verification link.
    # The frontend's /waitlist/confirm route reads ?verified=&code=&name=
    # from this URL (see src/routes/waitlist.confirm.tsx in zuno-website).
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    # Shared secret the admin dashboard sends as `X-Admin-Key` on every
    # request. Not a real auth system (no users, no sessions) — just
    # enough to keep the admin API from being wide open. Swap for proper
    # authenticated admin login before this ever touches production data.
    ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}

