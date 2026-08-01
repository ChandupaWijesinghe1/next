from urllib.parse import urlparse

from arq.connections import RedisSettings

from core.config import settings


def get_arq_redis_settings() -> RedisSettings:#Gets the Redis settings for the ARQ queue.
    parsed = urlparse(settings.redis_url)   
    database = 0
    if parsed.path and parsed.path != "/":
        database = int(parsed.path.lstrip("/"))
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=database,
    )
