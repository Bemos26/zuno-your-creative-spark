"""
Global error handlers
======================
Centralising error handling means:
1. No stack traces or internal details ever leak to the client (a common
   way attackers fingerprint your stack and find vulnerabilities).
2. Every error, expected or not, comes back in the same JSON envelope.
3. Every unexpected error is still logged server-side for debugging.
"""

import logging
from werkzeug.exceptions import HTTPException
from app.utils.responses import error_response

logger = logging.getLogger(__name__)


def register_error_handlers(app):

    @app.errorhandler(400)
    def bad_request(e):
        return error_response("Bad request.", 400, error_code="BAD_REQUEST")

    @app.errorhandler(404)
    def not_found(e):
        return error_response("Resource not found.", 404, error_code="NOT_FOUND")

    @app.errorhandler(405)
    def method_not_allowed(e):
        return error_response("Method not allowed on this endpoint.", 405, error_code="METHOD_NOT_ALLOWED")

    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        return error_response(
            "Too many requests. Please slow down and try again shortly.",
            429,
            error_code="RATE_LIMIT_EXCEEDED",
        )

    @app.errorhandler(500)
    def internal_server_error(e):
        logger.exception("Internal server error")
        return error_response(
            "Something went wrong on our end. Please try again later.",
            500,
            error_code="INTERNAL_SERVER_ERROR",
        )

    @app.errorhandler(Exception)
    def handle_unexpected_error(e):
        # Known HTTP exceptions (raised deliberately, e.g. abort(403))
        # keep their real status code and description.
        if isinstance(e, HTTPException):
            return error_response(e.description, e.code, error_code=e.name.upper().replace(" ", "_"))

        # Anything else is an unhandled bug — log full details server-side,
        # but never expose them to the client.
        logger.exception("Unhandled exception")
        return error_response(
            "An unexpected error occurred. Please try again later.",
            500,
            error_code="UNEXPECTED_ERROR",
        )
