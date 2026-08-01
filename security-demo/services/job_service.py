from arq import create_pool
from arq.connections import ArqRedis

from core.arq import get_arq_redis_settings
from core.config import settings

_pool: ArqRedis | None = None


async def get_job_pool() -> ArqRedis:#Gets the job pool.
    global _pool
    if _pool is None:
        _pool = await create_pool(
            get_arq_redis_settings(),
            default_queue_name=settings.arq_queue_name,
        )
    return _pool


async def close_job_pool() -> None: #Closes the job pool.
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def enqueue_ping_task(message: str) -> str | None: #Enqueues a ping task.
    pool = await get_job_pool()
    job = await pool.enqueue_job("ping_task", message=message)
    return job.job_id if job else None


async def enqueue_send_notification_email( #Enqueues a send notification email task.
    user_email: str,
    subject: str,
    body: str,
) -> str | None:
    pool = await get_job_pool()
    job = await pool.enqueue_job(
        "send_notification_email",
        user_email=user_email,
        subject=subject,
        body=body,
    )
    return job.job_id if job else None


async def enqueue_generate_project_report(project_id: int) -> str | None: #Enqueues a generate project report task.
    pool = await get_job_pool()
    job = await pool.enqueue_job("generate_project_report", project_id=project_id)
    return job.job_id if job else None
