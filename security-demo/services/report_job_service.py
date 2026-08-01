from sqlalchemy.orm import Session

from services.background_job_service import create_background_job
from services.job_service import enqueue_generate_project_report


async def enqueue_project_report_job(db: Session, project_id: int) -> str | None:
    job_id = await enqueue_generate_project_report(project_id)
    if job_id is None:
        return None

    create_background_job(db, job_id=job_id, task_name="generate_project_report")
    return job_id
