"""
Admin routes
============
Endpoints:
    GET   /api/v1/admin/waitlist              -> list all entries (+ search)
    GET   /api/v1/admin/waitlist/<public_id>   -> one entry, with who they referred
    PATCH /api/v1/admin/waitlist/<public_id>/points    -> set points to an exact value
    PATCH /api/v1/admin/waitlist/<public_id>/verified  -> mark verified/unverified
    PATCH /api/v1/admin/waitlist/<public_id>/flag      -> flag/unflag for review

Auth: every route below requires a header `X-Admin-Key: <ADMIN_API_KEY>`.
This is intentionally simple (see comment on ADMIN_API_KEY in config.py) —
it's not real user auth, just a gate so the admin API isn't wide open.
Swap for proper authenticated admin login before this goes anywhere near
production data.

Mirrors the shape src/routes/admin.waitlist.tsx already expects — once
this is deployed, the frontend swaps MOCK_ENTRIES for real fetch calls
against these endpoints. The UI, columns, and tier logic don't change.
"""

import logging
from functools import wraps

from flask import Blueprint, request, current_app

from app.models import waitlist as waitlist_model
from app.utils.responses import success_response, error_response

logger = logging.getLogger(__name__)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/v1/admin")


def require_admin_key(view):
    """Rejects any request that doesn't send the correct X-Admin-Key header."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        expected = current_app.config.get("ADMIN_API_KEY")
        provided = request.headers.get("X-Admin-Key")
        if not expected:
            # Misconfiguration — fail closed rather than silently letting
            # everyone in because the .env var was never set.
            logger.error("ADMIN_API_KEY is not configured on the server")
            return error_response(
                "Admin API is not configured.", 500, error_code="ADMIN_NOT_CONFIGURED"
            )
        if not provided or provided != expected:
            return error_response(
                "Invalid or missing admin key.", 401, error_code="UNAUTHORIZED"
            )
        return view(*args, **kwargs)

    return wrapped


@admin_bp.route("/waitlist", methods=["GET"])
@require_admin_key
def list_waitlist():
    """Full waitlist with referral counts. Supports ?search=name/email/code."""
    search = request.args.get("search", "").strip() or None
    rows = waitlist_model.list_all_entries(search=search)
    return success_response(
        "Waitlist entries retrieved.",
        data=[waitlist_model.serialize_admin_entry(row) for row in rows],
    )


@admin_bp.route("/waitlist/<public_id>", methods=["GET"])
@require_admin_key
def get_waitlist_entry(public_id):
    """One entry, plus the list of people who used its referral_code."""
    entry = waitlist_model.find_by_public_id(public_id)
    if not entry:
        return error_response("Entry not found.", 404, error_code="NOT_FOUND")

    referred = [
        waitlist_model.serialize_entry(row)
        for row in waitlist_model.list_all_entries()
        if row["referred_by_code"] == entry["referral_code"]
    ]

    data = waitlist_model.serialize_admin_entry(
        {**entry, "referral_count": len(referred)}
    )
    data["referred_entries"] = referred
    return success_response("Entry retrieved.", data=data)


@admin_bp.route("/waitlist/<public_id>/points", methods=["PATCH"])
@require_admin_key
def update_points(public_id):
    json_data = request.get_json(silent=True) or {}
    points = json_data.get("points")

    if not isinstance(points, int) or isinstance(points, bool) or points < 0:
        return error_response(
            "'points' must be a non-negative integer.",
            422,
            error_code="VALIDATION_ERROR",
        )

    entry = waitlist_model.find_by_public_id(public_id)
    if not entry:
        return error_response("Entry not found.", 404, error_code="NOT_FOUND")

    updated = waitlist_model.set_points(public_id, points)
    logger.info(f"Admin set points for {public_id} to {points}")
    return success_response(
        "Points updated.", data=waitlist_model.serialize_admin_entry(updated)
    )


@admin_bp.route("/waitlist/<public_id>/verified", methods=["PATCH"])
@require_admin_key
def update_verified(public_id):
    json_data = request.get_json(silent=True) or {}
    is_verified = json_data.get("is_verified")

    if not isinstance(is_verified, bool):
        return error_response(
            "'is_verified' must be a boolean.", 422, error_code="VALIDATION_ERROR"
        )

    entry = waitlist_model.find_by_public_id(public_id)
    if not entry:
        return error_response("Entry not found.", 404, error_code="NOT_FOUND")

    updated = waitlist_model.set_verified(public_id, is_verified)
    logger.info(f"Admin set verified={is_verified} for {public_id}")
    return success_response(
        "Verification status updated.",
        data=waitlist_model.serialize_admin_entry(updated),
    )


@admin_bp.route("/waitlist/<public_id>/flag", methods=["PATCH"])
@require_admin_key
def update_flagged(public_id):
    json_data = request.get_json(silent=True) or {}
    flagged = json_data.get("flagged")

    if not isinstance(flagged, bool):
        return error_response(
            "'flagged' must be a boolean.", 422, error_code="VALIDATION_ERROR"
        )

    entry = waitlist_model.find_by_public_id(public_id)
    if not entry:
        return error_response("Entry not found.", 404, error_code="NOT_FOUND")

    updated = waitlist_model.set_flagged(public_id, flagged)
    logger.info(f"Admin set flagged={flagged} for {public_id}")
    return success_response(
        "Flag status updated.", data=waitlist_model.serialize_admin_entry(updated)
    )
