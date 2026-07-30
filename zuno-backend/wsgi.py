"""
WSGI entry point
================
Used by production servers to find and run the app.

Since this app is hosted at a sub-path (e.g. https://.../waitlist)
rather than its own dedicated domain, we need a small piece of
middleware that strips that prefix off incoming requests before
Flask tries to match a route. Without this, Flask sees
"/waitlist/api/v1/waitlist/health" instead of "/api/v1/waitlist/health"
and can't find a match.

Controlled by the URL_PREFIX environment variable — leave it unset
for local development, since locally there's no path prefix at all.
"""

import os
from app import create_app


class PrefixMiddleware:
    """Strips a known URL prefix off each request before Flask sees it."""

    def __init__(self, wsgi_app, prefix=""):
        self.wsgi_app = wsgi_app
        self.prefix = prefix

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        if self.prefix and path.startswith(self.prefix):
            environ["PATH_INFO"] = path[len(self.prefix):] or "/"
            environ["SCRIPT_NAME"] = self.prefix
        return self.wsgi_app(environ, start_response)


application = create_app("production")

# If URL_PREFIX is set (e.g. "/waitlist"), wrap the app so that prefix
# gets silently removed from every incoming request path.
url_prefix = os.environ.get("URL_PREFIX", "")
if url_prefix:
    application.wsgi_app = PrefixMiddleware(application.wsgi_app, prefix=url_prefix)