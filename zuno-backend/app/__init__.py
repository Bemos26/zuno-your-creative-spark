"""
Zuno Waitlist API
==================
Application factory. This is the single place where the Flask app is
constructed and all extensions (database, migrations, CORS, rate limiter)
are wired together. Using the factory pattern (instead of a global `app`
object) makes the codebase testable and lets us spin up different
configurations (development / testing / production) from the same code.
"""

import os
import logging

from flask import Flask

from app.config import config_by_name
from app.extensions import cors, limiter
from app.utils.error_handlers import register_error_handlers
from app.routes.waitlist_routes import waitlist_bp
from app.routes.admin_routes import admin_bp


def create_app(config_name: str | None = None) -> Flask:
    """
    Application factory.

    Args:
        config_name: 'development' | 'production'.
                     Falls back to the FLASK_ENV environment variable,
                     and finally to 'development'.
    """
    config_name = config_name or os.environ.get("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    _configure_logging(app)

    # --- Extensions -------------------------------------------------
    # No database extension to initialize here — app/db.py opens plain
    # MySQL connections on demand using this app's config.

    # CORS: only the origins listed in CORS_ORIGINS (.env) may call the API.
    # This stops random websites from submitting to your waitlist endpoint
    # from a visitor's browser.
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
        methods=["GET", "POST", "OPTIONS"],
    )

    limiter.init_app(app)

    # --- Error handling ----------------------------------------------
    register_error_handlers(app)

    # --- Blueprints (routes) ------------------------------------------
    app.register_blueprint(waitlist_bp)
    app.register_blueprint(admin_bp)

    return app


def _configure_logging(app: Flask) -> None:
    """Basic structured logging so errors are traceable in production."""
    level = logging.DEBUG if app.debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
