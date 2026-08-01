from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.config import settings


def _is_docs_path(path: str) -> bool:
    return path in ("/docs", "/redoc", "/openapi.json") or path.startswith("/docs/")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY" #this is a security header that prevents the page from being embedded in an iframe.
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin" #this is a security header that controls the referrer policy. brutforce attack.
        # Swagger/ReDoc load JS/CSS from cdn.jsdelivr.net; strict CSP breaks /docs.
        if not _is_docs_path(request.url.path):
            response.headers["Content-Security-Policy"] = "default-src 'self'" #this is a security header that controls the content security policy.
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response
