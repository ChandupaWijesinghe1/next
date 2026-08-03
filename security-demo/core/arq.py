from urllib.parse import urlparse

from arq.connections import RedisSettings

from core.config import settings


def get_arq_redis_settings() -> RedisSettings:#Gets the Redis settings for the ARQ queue.
    parsed = urlparse(settings.redis_url)
    database = 0
    if parsed.path and parsed.path != "/":
        db_path = parsed.path.lstrip("/").split("?")[0]
        if db_path:
            database = int(db_path)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=database,
        username=parsed.username,
        password=parsed.password,
        ssl=parsed.scheme == "rediss",
    )
