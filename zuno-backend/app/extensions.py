"""
Extensions
==========
Extension objects are created here, unbound to any app, and initialised
later with `init_app()` inside the application factory.
"""

from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail

cors = CORS()

# Rate limiter keyed by client IP. Protects /join from being spammed by
# bots or scripts (a common attack on public waitlist forms).
limiter = Limiter(key_func=get_remote_address)

# Handles sending the verification email.
mail = Mail()
