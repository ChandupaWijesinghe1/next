import time
from datetime import timedelta

from sqlalchemy.orm import Session

from core.exceptions import InvalidCredentialsError, InvalidTokenError
from core.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    verify_password,
)
from models.user import User
from schemas.auth import TokenResponse
from services.token_store import (
    blacklist_access_jti,
    clear_user_token_invalidation,
    get_user_tokens_invalidated_after,
    invalidate_all_user_tokens,
    is_refresh_jti_used,
    mark_refresh_jti_used,
)


def authenticate_user(db: Session, email: str, password: str) -> User: #Authenticates a user.
    user = db.query(User).filter(User.email == email).first()
    if user is None or user.password_hash is None or not verify_password(password, user.password_hash):
        raise InvalidCredentialsError()
    return user


def refresh_user_tokens(refresh_token: str) -> TokenResponse:
    payload = decode_refresh_token(refresh_token)
    user_id = payload["sub"]
    jti = payload["jti"]
    exp = payload["exp"]
    iat = payload["iat"]

    invalidated_after = get_user_tokens_invalidated_after(user_id)
    if invalidated_after is not None and iat <= invalidated_after:
        raise InvalidTokenError()

    if is_refresh_jti_used(jti):
        invalidate_all_user_tokens(user_id)
        raise InvalidTokenError()

    ttl_seconds = max(0, int(exp - time.time()))#Calculates the time to live for the refresh token.
    mark_refresh_jti_used(jti, ttl_seconds)

    access_token = create_access_token(
        user_id,
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    new_refresh_token = create_refresh_token(user_id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


def establish_user_session(user_id: str) -> TokenResponse: #Establishes a user session.
    clear_user_token_invalidation(user_id)
    access_token = create_access_token(
        user_id,
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(user_id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


def logout_access_token(token: str) -> None:
    payload = decode_access_token(token)
    jti = payload["jti"]
    exp = payload["exp"]
    ttl_seconds = max(0, int(exp - time.time()))
    blacklist_access_jti(jti, ttl_seconds)
