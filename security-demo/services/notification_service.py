import logging

import httpx
from sqlalchemy.orm import Session

from core.config import settings
from models.task import Task
from models.user import User
from services.background_job_service import create_background_job
from services.job_service import enqueue_send_notification_email

logger = logging.getLogger(__name__)


async def create_in_app_notification(
    *,
    user_id: int,
    title: str,
    message: str,
) -> dict | None:
    """POST a notification to the standalone notifications service."""
    url = f"{settings.notifications_url.rstrip('/')}/notifications"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                url,
                json={"user_id": user_id, "title": title, "message": message},
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as exc:
        logger.warning("Failed to create in-app notification: %s", exc)
        return None


async def enqueue_task_assignment_notification(
    db: Session,
    task: Task,
    assignee: User,
) -> str | None:
    subject = f"Task assigned: {task.title}"
    body = (
        f"Hi {assignee.full_name}, you have been assigned the task "
        f"'{task.title}'."
    )
    if task.description:
        body = f"{body} Description: {task.description}"

    await create_in_app_notification(
        user_id=assignee.id,
        title=subject,
        message=body,
    )

    job_id = await enqueue_send_notification_email(
        user_email=assignee.email,
        subject=subject,
        body=body,
    )
    if job_id is None:
        return None

    create_background_job(db, job_id=job_id, task_name="send_notification_email")
    return job_id
