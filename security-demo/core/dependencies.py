from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.database import get_db
from core.exceptions import InvalidTokenError
from core.security import decode_access_token
from models.user import User
from core.config import settings
from services.rate_limiter import enforce_sliding_window_rate_limit
from services.token_store import is_access_token_blacklisted

bearer_scheme = HTTPBearer(auto_error=False)

# Keep production strict; allow more auth traffic for local/E2E runs.
AUTH_RATE_LIMIT = 10 if settings.is_production else 100
AUTH_RATE_WINDOW_SECONDS = 60


def get_client_ip(request: Request) -> str: #Extracts the client's IP address from the request headers.
    forwarded_for = request.headers.get("X-Forwarded-For")#When a request passes through a proxy (like Nginx, Cloudflare, AWS ELB), the proxy adds this header containing the original client's IP.
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client: #Without a proxy, this header usually won't exist.
        return request.client.host
    return "unknown"


def rate_limit_login(request: Request) -> None: #Enforces a rate limit for login requests.
    enforce_sliding_window_rate_limit(
        scope="login",
        client_ip=get_client_ip(request),
        limit=AUTH_RATE_LIMIT,
        window_seconds=AUTH_RATE_WINDOW_SECONDS,
    )


def rate_limit_register(request: Request) -> None: #Enforces a rate limit for register requests.
    enforce_sliding_window_rate_limit(
        scope="register",
        client_ip=get_client_ip(request),
        limit=AUTH_RATE_LIMIT,
        window_seconds=AUTH_RATE_WINDOW_SECONDS,
    )


def rate_limit_refresh(request: Request) -> None: #Enforces a rate limit for refresh requests.
    enforce_sliding_window_rate_limit(
        scope="refresh",
        client_ip=get_client_ip(request),
        limit=AUTH_RATE_LIMIT,
        window_seconds=AUTH_RATE_WINDOW_SECONDS,
    )


def rate_limit_oauth(request: Request) -> None: #Enforces a rate limit for OAuth requests.
    enforce_sliding_window_rate_limit(
        scope="oauth",
        client_ip=get_client_ip(request),
        limit=AUTH_RATE_LIMIT,
        window_seconds=AUTH_RATE_WINDOW_SECONDS,
    )


def get_access_token( #Extracts the access token from the request headers.
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise InvalidTokenError()
    return credentials.credentials


def get_current_user( #Extracts the current user from the database.
    token: str = Depends(get_access_token),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)

    user_id = payload["sub"]
    jti = payload["jti"]
    iat = float(payload["iat"])

    if is_access_token_blacklisted(user_id, jti, iat):
        raise InvalidTokenError()

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise InvalidTokenError()

    return user
