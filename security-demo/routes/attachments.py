from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.attachment import AttachmentDownloadResponse, AttachmentRead
from services.attachment_service import (
    DEFAULT_DOWNLOAD_EXPIRES_IN,
    create_attachment,
    delete_attachment,
    get_attachment_download_url,
    list_attachments,
)

tasks_router = APIRouter(prefix="/tasks", tags=["tasks"])

attachments_router = APIRouter(prefix="/attachments", tags=["attachments"])


@tasks_router.post(
    "/{task_id}/attachments",
    response_model=AttachmentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment_route(
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_attachment(db, task_id, current_user.id, file)


@tasks_router.get(
    "/{task_id}/attachments",
    response_model=list[AttachmentRead],
)
def list_attachments_route(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_attachments(db, task_id, current_user.id)


@attachments_router.get(
    "/{attachment_id}/download",
    response_model=AttachmentDownloadResponse,
)
def download_attachment_route(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    download_url = get_attachment_download_url(
        db,
        attachment_id,
        current_user.id,
        expires_in=DEFAULT_DOWNLOAD_EXPIRES_IN,
    )
    return AttachmentDownloadResponse(
        download_url=download_url,
        expires_in=DEFAULT_DOWNLOAD_EXPIRES_IN,
    )


@attachments_router.delete(
    "/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_attachment_route(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    delete_attachment(db, attachment_id, current_user.id)
