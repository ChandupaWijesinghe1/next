import uuid
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext   #this is a library for hashing and verifying passwords.

from core.config import settings
from core.exceptions import InvalidTokenError

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise InvalidTokenError() from exc # exc mean raise the orginal error too.


def decode_refresh_token(token: str) -> dict:
    payload = decode_token(token)  #decode return a payload object.
    if payload.get("type") != "refresh": #get is a function that return the value of the key.
        raise InvalidTokenError() #if the type is not refresh, raise an error.
    if not payload.get("sub") or not payload.get("jti"): #if the sub or jti is not in the payload, raise an error.
        raise InvalidTokenError()
    return payload #return the payload.


def decode_access_token(token: str) -> dict:
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise InvalidTokenError()
    if not payload.get("sub") or not payload.get("jti") or payload.get("iat") is None:
        raise InvalidTokenError()
    return payload


def create_access_token(user_id: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "exp": now + expires_delta,
        "iat": now,
        "jti": str(uuid.uuid4()),
        "type": "access",
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "exp": now + expires_delta,
        "iat": now,
        "jti": str(uuid.uuid4()),
        "type": "refresh",
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
