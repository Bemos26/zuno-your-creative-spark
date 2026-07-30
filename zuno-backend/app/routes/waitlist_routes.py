"""
Waitlist routes
================
Endpoints:
    POST /api/v1/waitlist/join    -> submit the waitlist form
    GET  /api/v1/waitlist/count   -> public signup counter (social proof)
    GET  /api/v1/waitlist/health  -> uptime check for monitoring

Notice what did NOT change from the SQLAlchemy version: validation,
error handling, and response shapes are identical. Only how we talk to
the database (the `waitlist_model.*` calls) is different. That's the
whole point of keeping database code in its own file — swapping it out
barely touches anything else.
"""

import secrets
import logging
import traceback
from urllib.parse import urlencode

from flask import Blueprint, request, current_app, redirect
from marshmallow import ValidationError
from pymysql.err import IntegrityError

from app.extensions import limiter
from app.models import waitlist as waitlist_model
from app.schemas.waitlist_schema import WaitlistJoinSchema
from app.utils.responses import success_response, error_response
from app.utils.email import send_verification_email

logger = logging.getLogger(__name__)

waitlist_bp = Blueprint("waitlist", __name__, url_prefix="/api/v1/waitlist")

join_schema = WaitlistJoinSchema()

# How many points a referrer earns each time someone they invited verifies.
POINTS_PER_REFERRAL = 10


def _confirm_redirect(**params) -> str:
    """
    Builds the redirect target on the frontend after someone clicks the
    verification link in their email. The frontend's /waitlist/confirm
    route (see src/routes/waitlist.confirm.tsx in zuno-website) reads
    these query params to render success/failure states.
    """
    frontend_url = current_app.config["FRONTEND_URL"].rstrip("/")
    query = urlencode(params)
    return f"{frontend_url}/waitlist/confirm?{query}"


def _get_client_ip() -> str:
    """
    Read the real client IP, respecting a reverse proxy (Nginx, Render,
    Railway, Cloudflare) that sets X-Forwarded-For. Falls back to the
    direct connection address in local dev.
    """
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


@waitlist_bp.route("/join", methods=["POST"])
@limiter.limit("5 per minute")  # blocks bots hammering the signup form
def join_waitlist():
    # 1. Must be valid JSON at all.
    json_data = request.get_json(silent=True)
    if not json_data:
        return error_response(
            "Request body must be valid JSON with 'full_name' and 'email'.",
            400,
            error_code="INVALID_JSON",
        )

    # 2. Schema validation (types, lengths, format, disposable-email check).
    try:
        data = join_schema.load(json_data)
    except ValidationError as err:
        return error_response(
            "Please check your details and try again.",
            422,
            errors=err.messages,
            error_code="VALIDATION_ERROR",
        )

    email = data["email"].strip().lower()
    full_name = " ".join(data["full_name"].strip().split())  # collapse extra spaces

    # If a referral code was submitted, confirm it actually belongs to
    # someone before trusting it. An unknown/mistyped code is ignored
    # quietly rather than blocking the signup — a typo shouldn't stop
    # someone from joining the waitlist.
    referred_by_code = None
    submitted_code = data.get("referral_code")
    if submitted_code:
        submitted_code = submitted_code.strip().upper()
        referrer = waitlist_model.find_by_referral_code(submitted_code)
        if referrer:
            referred_by_code = submitted_code
        else:
            logger.info(f"Unknown referral code submitted: {submitted_code}")

    # 3. Explicit duplicate check for a friendly error message.
    #    (The DB-level UNIQUE constraint on `email`, in schema.sql, is the
    #    real safety net — this check just avoids a raw error in the
    #    common case and lets us return a clean 409 instead.)
    if waitlist_model.find_by_email(email):
        return error_response(
            "This email is already on the waitlist.",
            409,
            error_code="EMAIL_ALREADY_EXISTS",
        )

    try:
        row = waitlist_model.create_waitlist_entry(
            full_name=full_name,
            email=email,
            referral_source=data.get("referral_source"),
            ip_address=_get_client_ip(),
            user_agent=(request.headers.get("User-Agent", "") or "")[:255],
            verification_token=secrets.token_urlsafe(32),
            referred_by_code=referred_by_code,
        )
    except IntegrityError:
        # Handles the race condition where two identical requests land
        # at the exact same moment — the UNIQUE constraint on `email`
        # in MySQL is what actually catches this.
        return error_response(
            "This email is already on the waitlist.",
            409,
            error_code="EMAIL_ALREADY_EXISTS",
        )
    except Exception as e:
        logger.exception("Failed to create waitlist entry")
        return error_response(f"An unexpected error occurred: {str(e)}\n{traceback.format_exc()}", 500, error_code="UNEXPECTED_ERROR")

    # Send the verification email. If this fails (e.g. email provider
    # hiccup), we don't fail the whole signup — the person is already
    # safely saved. We just log it so it can be investigated/resent later.
    email_sent = send_verification_email(
        to_email=row["email"],
        full_name=row["full_name"],
        token=row["verification_token"],
    )
    if not email_sent:
        logger.warning(f"Verification email did not send for {row['email']}")

    return success_response(
        "You've successfully joined the Zuno waitlist!",
        data=waitlist_model.serialize_entry(row),
        status_code=201,
    )


@waitlist_bp.route("/verify/<token>", methods=["GET"])
def verify_email(token):
    row = waitlist_model.verify_by_token(token)
    if not row:
        # verified=0 with no code tells the frontend the link was invalid/expired.
        return redirect(_confirm_redirect(verified="0"))

    # This is the moment we actually trust the referral: only a
    # verified signup earns their referrer points.
    if row.get("referred_by_code"):
        waitlist_model.award_referral_points(row["referred_by_code"], POINTS_PER_REFERRAL)

    return redirect(
        _confirm_redirect(
            verified="1",
            code=row["referral_code"],
            name=row["full_name"],
        )
    )


@waitlist_bp.route("/referral/<code>/stats", methods=["GET"])
@limiter.limit("30 per minute")
def referral_stats(code):
    """Lets someone check their own referral code's points and referral count."""
    code = code.strip().upper()
    entry = waitlist_model.find_by_referral_code(code)
    if not entry:
        return error_response(
            "Referral code not found.", 404, error_code="REFERRAL_CODE_NOT_FOUND"
        )
    total_referrals = waitlist_model.count_referrals_by_code(code)
    return success_response(
        "Referral stats retrieved.",
        data={
            "referral_code": code,
            "points": entry["points"],
            "total_referrals": total_referrals,
        },
    )


@waitlist_bp.route("/count", methods=["GET"])
@limiter.limit("30 per minute")
def get_waitlist_count():
    """Public counter for 'Join 1,204 others' style social proof on the landing page."""
    count = waitlist_model.count_active_entries()
    return success_response(
        "Waitlist count retrieved.",
        data={"total_signups": count},
    )


@waitlist_bp.route("/health", methods=["GET"])
def health_check():
    return success_response("Zuno waitlist API is running.", data={"status": "healthy", "host": current_app.config.get("DB_HOST"), "user": current_app.config.get("DB_USER"), "port": current_app.config.get("DB_PORT")})
