"""
Email sending
=============
One job: send the verification email. Kept in its own file, separate
from routes, so that HOW we send email (Resend API) can change without 
touching any route code.
"""

import logging
import resend
from flask import current_app

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, full_name: str, token: str) -> bool:
    """
    Builds and sends the verification email using Resend API.

    Returns True/False instead of raising an error, on purpose: if the
    email provider has a hiccup, we don't want that to break the
    person's signup — they're already safely saved in the database
    either way. We just log it so it can be noticed and investigated.
    """
    verify_link = f"{current_app.config['API_BASE_URL']}/api/v1/waitlist/verify/{token}"

    resend.api_key = current_app.config.get("RESEND_API_KEY")
    sender = current_app.config.get("MAIL_DEFAULT_SENDER", "Zuno Waitlist <onboarding@resend.dev>")
    
    if not resend.api_key:
        logger.error("RESEND_API_KEY is not set. Cannot send verification email.")
        return False

    html_content = (
        f"<p>Hi {full_name},</p>"
        f"<p>Thanks for joining the <strong>Zuno</strong> waitlist! "
        f"Please confirm your email by clicking the button below:</p>"
        f"<p><a href='{verify_link}' "
        f"style='background:#f5b93d;color:#000;padding:10px 20px;"
        f"text-decoration:none;border-radius:6px;display:inline-block;'>"
        f"Confirm my email</a></p>"
        f"<p>If you didn't sign up for this, you can safely ignore this email.</p>"
        f"<p>— The Zuno Team</p>"
    )

    try:
        resend.Emails.send({
            "from": sender,
            "to": [to_email],
            "subject": "Confirm your spot on the Zuno waitlist",
            "html": html_content
        })
        return True
    except Exception as e:
        logger.exception(f"Failed to send verification email to {to_email}: {e}")
        return False