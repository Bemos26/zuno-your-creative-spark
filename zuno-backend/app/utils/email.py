"""
Email sending
=============
One job: send the verification email. Kept in its own file, separate
from routes, so that HOW we send email (Gmail SMTP today, maybe a
dedicated email service later) can change without touching any route
code — routes just call `send_verification_email(...)` and don't care
about the details underneath.
"""

import logging
from flask import current_app
from flask_mail import Message
from app.extensions import mail

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, full_name: str, token: str) -> bool:
    """
    Builds and sends the verification email.

    Returns True/False instead of raising an error, on purpose: if the
    email provider has a hiccup, we don't want that to break the
    person's signup — they're already safely saved in the database
    either way. We just log it so it can be noticed and investigated.
    """
    verify_link = f"{current_app.config['API_BASE_URL']}/api/v1/waitlist/verify/{token}"

    message = Message(
        subject="Confirm your spot on the Zuno waitlist",
        recipients=[to_email],
        body=(
            f"Hi {full_name},\n\n"
            f"Thanks for joining the Zuno waitlist! Please confirm your "
            f"email by clicking the link below:\n\n{verify_link}\n\n"
            f"If you didn't sign up for this, you can safely ignore this email.\n\n"
            f"— The Zuno Team"
        ),
        html=(
            f"<p>Hi {full_name},</p>"
            f"<p>Thanks for joining the <strong>Zuno</strong> waitlist! "
            f"Please confirm your email by clicking the button below:</p>"
            f"<p><a href='{verify_link}' "
            f"style='background:#f5b93d;color:#000;padding:10px 20px;"
            f"text-decoration:none;border-radius:6px;display:inline-block;'>"
            f"Confirm my email</a></p>"
            f"<p>If you didn't sign up for this, you can safely ignore this email.</p>"
            f"<p>— The Zuno Team</p>"
        ),
    )

    try:
        mail.send(message)
        return True
    except Exception:
        logger.exception(f"Failed to send verification email to {to_email}")
        return False