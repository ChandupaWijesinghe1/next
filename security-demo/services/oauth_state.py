from core.redis import redis_client

OAUTH_STATE_PREFIX = "oauth:state:"
OAUTH_STATE_TTL_SECONDS = 600


def _state_key(state: str) -> str:
    return f"{OAUTH_STATE_PREFIX}{state}"


def store_oauth_state(state: str) -> None:
    redis_client.set(_state_key(state), "1", ex=OAUTH_STATE_TTL_SECONDS)


def consume_oauth_state(state: str) -> bool:
    key = _state_key(state)
    if redis_client.exists(key) != 1:
        return False
    redis_client.delete(key)
    return True
