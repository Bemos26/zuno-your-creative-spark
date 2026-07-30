"""
Standardized API responses
============================
Every response from this API — success or failure — follows the same
envelope shape. A predictable shape means your frontend can write one
generic response handler instead of guessing the structure per endpoint.

Success:
{
  "success": true,
  "message": "...",
  "data": { ... } | [ ... ] | null
}

Error:
{
  "success": false,
  "message": "...",
  "error_code": "VALIDATION_ERROR",
  "errors": { "email": ["Not a valid email address."] }   // optional
}
"""

from flask import jsonify


def success_response(message: str, data=None, status_code: int = 200):
    return jsonify({
        "success": True,
        "message": message,
        "data": data,
    }), status_code


def error_response(message: str, status_code: int = 400, errors=None, error_code: str = None):
    payload = {
        "success": False,
        "message": message,
    }
    if error_code:
        payload["error_code"] = error_code
    if errors:
        payload["errors"] = errors
    return jsonify(payload), status_code
