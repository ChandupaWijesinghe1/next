import time

from core.redis import redis_client
from core.security import REFRESH_TOKEN_EXPIRE_DAYS

USED_REFRESH_JTI_PREFIX = "refresh:used:"
ACCESS_BLACKLIST_PREFIX = "access:blacklist:"
USER_TOKENS_INVALIDATED_PREFIX = "user:tokens_invalidated_after:"


def _used_jti_key(jti: str) -> str:
    return f"{USED_REFRESH_JTI_PREFIX}{jti}"


def _user_invalidated_key(user_id: str) -> str:
    return f"{USER_TOKENS_INVALIDATED_PREFIX}{user_id}"


def _access_blacklist_key(jti: str) -> str:
    return f"{ACCESS_BLACKLIST_PREFIX}{jti}"


def is_refresh_jti_used(jti: str) -> bool:
    return redis_client.exists(_used_jti_key(jti)) == 1


def mark_refresh_jti_used(jti: str, ttl_seconds: int) -> None:
    if ttl_seconds > 0:
        redis_client.set(_used_jti_key(jti), "1", ex=ttl_seconds)


def get_user_tokens_invalidated_after(user_id: str) -> float | None:
    value = redis_client.get(_user_invalidated_key(user_id))
    if value is None:
        return None
    return float(value)


def invalidate_all_user_tokens(user_id: str) -> None:
    ttl_seconds = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    redis_client.set(
        _user_invalidated_key(user_id),
        str(time.time()),
        ex=ttl_seconds,
    )


def clear_user_token_invalidation(user_id: str) -> None:
    redis_client.delete(_user_invalidated_key(user_id))


def is_access_jti_blacklisted(jti: str) -> bool:
    return redis_client.exists(_access_blacklist_key(jti)) == 1


def blacklist_access_jti(jti: str, ttl_seconds: int) -> None:
    if ttl_seconds > 0:
        redis_client.set(_access_blacklist_key(jti), "1", ex=ttl_seconds)


def is_access_token_blacklisted(user_id: str, jti: str, iat: float) -> bool:
    if is_access_jti_blacklisted(jti):
        return True
    invalidated_after = get_user_tokens_invalidated_after(user_id)
    if invalidated_after is not None and iat <= invalidated_after:
        return True
    return False
