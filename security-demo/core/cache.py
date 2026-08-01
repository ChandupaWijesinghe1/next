from redis.asyncio import Redis  #Async Redis client (works with await)
from redis.asyncio.connection import ConnectionPool

from core.config import settings

pool = ConnectionPool.from_url(settings.redis_url, decode_responses=True)
redis_client = Redis(connection_pool=pool) #this is a singleton instance of the Redis class.

CACHE_TTL_SECONDS = 300


def project_cache_key(team_id: int, project_id: int) -> str:
    return f"project:{team_id}:{project_id}"  

def task_list_cache_key(team_id: int, project_id: int, suffix: str = "list") -> str:
    return f"tasks:{team_id}:{project_id}:{suffix}"#Builds a Redis key for a list of tasks, using team_id and project_id.


def task_list_cache_pattern(team_id: int, project_id: int) -> str:
    return f"tasks:{team_id}:{project_id}:*"#Builds a Redis pattern for a list of tasks, using team_id and project_id.


async def cache_get(key: str) -> str | None:
    return await redis_client.get(key)#Gets a value from Redis.


async def cache_set(
    key: str,
    value: str,
    expire_seconds: int | None = None,
) -> None:
    await redis_client.set(key, value, ex=expire_seconds)#Sets a value in Redis.


async def cache_delete(key: str) -> None:
    await redis_client.delete(key)#Deletes a value from Redis.


async def cache_delete_pattern(pattern: str) -> None:
    async for key in redis_client.scan_iter(match=pattern):#Deletes a pattern from Redis.
        await redis_client.delete(key)