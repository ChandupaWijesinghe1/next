import logging

from arq.worker import Retry

from services.background_job_service import mark_job_failed

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 4
RETRY_BACKOFF_SECONDS = [5, 25, 125]


def handle_job_retry(ctx: dict, db, job_id: str, task_name: str, error: Exception) -> None:
    job_try = ctx["job_try"]

    if job_try < MAX_ATTEMPTS:
        delay = RETRY_BACKOFF_SECONDS[job_try - 1]
        logger.warning(
            "Job %s (%s) failed on attempt %d: %s",
            job_id,
            task_name,
            job_try,
            error,
        )
        logger.info(
            "Scheduling retry for job %s | retry_attempt=%d delay=%ss error=%s",
            job_id,
            job_try,
            delay,
            error,
        )
        raise Retry(defer=delay)

    logger.error(
        "Job %s (%s) failed on final attempt %d: %s",
        job_id,
        task_name,
        job_try,
        error,
    )
    mark_job_failed(db, job_id, result=str(error))
    raise
