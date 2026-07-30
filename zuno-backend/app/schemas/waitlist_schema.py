"""
Request validation schemas
===========================
We use marshmallow to validate and clean every incoming request BEFORE
it touches the database or business logic. This is a critical security
boundary: never trust client input, ever — not even from your own
frontend, since anyone can hit your API directly with curl/Postman.
"""

import re
from marshmallow import Schema, fields, validate, validates, ValidationError

# Letters (incl. accented), spaces, hyphens, apostrophes only.
# Blocks digits, HTML tags, script injection attempts, emojis, etc.
NAME_REGEX = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'\-\s]{1,99}$")
REFERRAL_CODE_REGEX = re.compile(r"^[A-Z0-9]{8}$")

# A conservative disposable-email blocklist. Extend this over time.
DISPOSABLE_EMAIL_DOMAINS = {
    "mailinator.com", "10minutemail.com", "guerrillamail.com",
    "tempmail.com", "yopmail.com", "trashmail.com",
}


class WaitlistJoinSchema(Schema):
    full_name = fields.String(
        required=True,
        validate=validate.Length(min=2, max=100, error="Full name must be between 2 and 100 characters."),
    )
    email = fields.Email(
        required=True,
        validate=validate.Length(max=120, error="Email must not exceed 120 characters."),
    )
    # Optional — lets the frontend tag where the signup came from.
    referral_source = fields.String(
        required=False,
        load_default=None,
        validate=validate.Length(max=50),
    )
    # Optional — the referral code of whoever invited this person.
    referral_code = fields.String(
        required=False,
        load_default=None,
        validate=validate.Length(max=8),
    )

    @validates("full_name")
    def validate_full_name(self, value, **kwargs):
        cleaned = value.strip()
        if not NAME_REGEX.match(cleaned):
            raise ValidationError(
                "Full name may only contain letters, spaces, hyphens, and apostrophes."
            )

    @validates("email")
    def validate_email_not_disposable(self, value, **kwargs):
        domain = value.strip().lower().split("@")[-1]
        if domain in DISPOSABLE_EMAIL_DOMAINS:
            raise ValidationError("Please use a permanent email address.")
        
    @validates("referral_code")
    def validate_referral_code_format(self, value, **kwargs):
        if value is None:
            return
        if not REFERRAL_CODE_REGEX.match(value.strip().upper()):
            raise ValidationError("Referral code format is invalid.")
