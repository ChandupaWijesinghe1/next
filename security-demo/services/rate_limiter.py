import time
import uuid

from core.exceptions import RateLimitExceededError
from core.redis import redis_client

RATE_LIMIT_PREFIX = "ratelimit:"


def _rate_limit_key(scope: str, client_ip: str) -> str:
    return f"{RATE_LIMIT_PREFIX}{scope}:{client_ip}"


def enforce_sliding_window_rate_limit( #Enforces a sliding window rate limit on a resource.
    scope: str,
    client_ip: str,
    limit: int,
    window_seconds: int,
) -> None:
    now = time.time()
    window_start = now - window_seconds
    key = _rate_limit_key(scope, client_ip)

    pipe = redis_client.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)
    pipe.zcard(key)
    _, current_count = pipe.execute()

    if current_count >= limit:
        oldest = redis_client.zrange(key, 0, 0, withscores=True)
        if oldest:
            retry_after = max(1, int(oldest[0][1] + window_seconds - now))
        else:
            retry_after = window_seconds
        raise RateLimitExceededError(retry_after=retry_after)

    redis_client.zadd(key, {f"{now}:{uuid.uuid4()}": now})#Adds a new score to the Redis sorted set.
    redis_client.expire(key, window_seconds)#Sets the expiration time for the Redis sorted set to the window seconds    (time based sliding window).
