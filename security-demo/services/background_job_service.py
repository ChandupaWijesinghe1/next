from datetime import datetime, timezone

from sqlalchemy.orm import Session

from core.exceptions import NotFoundError
from models.background_job import BackgroundJob, JobStatus


def create_background_job(db: Session, job_id: str, task_name: str) -> BackgroundJob:
    job = BackgroundJob(
        id=job_id,
        task_name=task_name,
        status=JobStatus.PENDING,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_background_job(db: Session, job_id: str) -> BackgroundJob:
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
    if job is None:
        raise NotFoundError("Job not found")
    return job


def mark_job_running(db: Session, job_id: str) -> None:
    job = get_background_job(db, job_id)
    job.status = JobStatus.RUNNING
    db.commit()


def mark_job_completed(db: Session, job_id: str, result: str) -> None:
    job = get_background_job(db, job_id)
    job.status = JobStatus.COMPLETED
    job.result = result
    job.completed_at = datetime.now(timezone.utc)
    db.commit()


def mark_job_failed(db: Session, job_id: str, result: str) -> None:
    job = get_background_job(db, job_id)
    job.status = JobStatus.FAILED
    job.result = result
    job.completed_at = datetime.now(timezone.utc)
    db.commit()
