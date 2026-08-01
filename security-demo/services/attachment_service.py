import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from core.attachment_validation import validate_attachment_file
from core.exceptions import ForbiddenError, NotFoundError
from core.storage import delete_file, generate_presigned_url, upload_file
from models.attachment import Attachment
from models.project import Project
from models.task import Task
from models.team import TeamMember, TeamRole
from services.team_service import ensure_team_membership

DEFAULT_DOWNLOAD_EXPIRES_IN = 3600


def _build_s3_key(task_id: int, filename: str) -> str:#Builds an S3 key for an attachment.
    safe_name = Path(filename or "upload").name.replace(" ", "_")
    return f"attachments/task_{task_id}/{uuid.uuid4()}_{safe_name}"


def get_task_for_member(db: Session, task_id: int, user_id: int) -> Task: #Gets a task for a member.
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None:
        raise NotFoundError("Task not found")

    project = db.query(Project).filter(Project.id == task.project_id).first()
    if project is None:
        raise NotFoundError("Project not found")

    ensure_team_membership(db, project.team_id, user_id)
    return task


def get_attachment(db: Session, attachment_id: int, user_id: int) -> Attachment:#Gets an attachment.
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if attachment is None:
        raise NotFoundError("Attachment not found")

    get_task_for_member(db, attachment.task_id, user_id)
    return attachment


def create_attachment( #Creates an attachment.
    db: Session,
    task_id: int,
    user_id: int,
    file: UploadFile,
) -> Attachment:
    task = get_task_for_member(db, task_id, user_id)
    size_bytes = validate_attachment_file(file)
    s3_key = _build_s3_key(task.id, file.filename or "upload")
    upload_file(file, s3_key)

    attachment = Attachment(
        task_id=task.id,
        uploaded_by=user_id,
        file_name=Path(file.filename or "upload").name,
        s3_key=s3_key,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def list_attachments(db: Session, task_id: int, user_id: int) -> list[Attachment]: #Lists attachments.
    get_task_for_member(db, task_id, user_id)
    return (
        db.query(Attachment)
        .filter(Attachment.task_id == task_id)
        .order_by(Attachment.created_at.desc())
        .all()
    )


def get_attachment_download_url( #Gets an attachment download URL.
    db: Session,
    attachment_id: int,
    user_id: int,
    expires_in: int = DEFAULT_DOWNLOAD_EXPIRES_IN,
) -> str:
    attachment = get_attachment(db, attachment_id, user_id)
    return generate_presigned_url(attachment.s3_key, expires_in)


def delete_attachment(db: Session, attachment_id: int, user_id: int) -> None: #Deletes an attachment.
    attachment = get_attachment(db, attachment_id, user_id)
    task = db.query(Task).filter(Task.id == attachment.task_id).first()
    if task is None:
        raise NotFoundError("Task not found")

    project = db.query(Project).filter(Project.id == task.project_id).first()
    if project is None:
        raise NotFoundError("Project not found")

    membership = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == project.team_id,
            TeamMember.user_id == user_id,
        )
        .first()
    )
    if membership is None:
        raise ForbiddenError("Not a member of this team")

    is_admin = membership.role == TeamRole.ADMIN.value
    is_uploader = attachment.uploaded_by == user_id
    if not is_admin and not is_uploader:
        raise ForbiddenError("Only the uploader or a team admin can delete this attachment")

    delete_file(attachment.s3_key)
    db.delete(attachment)
    db.commit()
