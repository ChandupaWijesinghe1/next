from core.cache import (
    CACHE_TTL_SECONDS,
    cache_delete,
    cache_delete_pattern,
    cache_get,
    cache_set,
    project_cache_key,
    task_list_cache_key,
    task_list_cache_pattern,
)
from schemas.project import ProjectRead
from schemas.task import TaskListResponse

async def get_cached_project(team_id: int, project_id: int) -> ProjectRead | None:#Gets a cached project.
    cached = await cache_get(project_cache_key(team_id, project_id))
    if cached is None:
        return None
    return ProjectRead.model_validate_json(cached)


async def set_cached_project(team_id: int, project_id: int, project: ProjectRead) -> None: #Sets a cached project.
    await cache_set(
        project_cache_key(team_id, project_id),
        project.model_dump_json(),
        expire_seconds=CACHE_TTL_SECONDS,
    )


async def invalidate_project_cache(team_id: int, project_id: int) -> None: #Invalidates a cached project.
    await cache_delete(project_cache_key(team_id, project_id))


async def invalidate_task_list_cache(team_id: int, project_id: int) -> None: #Invalidates a cached task list.
    await cache_delete_pattern(task_list_cache_pattern(team_id, project_id))


async def get_cached_task_list(
    team_id: int,
    project_id: int,
    *,
    limit: int,
    offset: int,
) -> TaskListResponse | None:
    cached = await cache_get(
        task_list_cache_key(team_id, project_id, limit=limit, offset=offset)
    )
    if cached is None:
        return None
    return TaskListResponse.model_validate_json(cached)


async def set_cached_task_list(
    team_id: int,
    project_id: int,
    *,
    limit: int,
    offset: int,
    payload: TaskListResponse,
) -> None:
    await cache_set(
        task_list_cache_key(team_id, project_id, limit=limit, offset=offset),
        payload.model_dump_json(),
        expire_seconds=CACHE_TTL_SECONDS,
    )
