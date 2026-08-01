from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notification
from app.schemas import ClearNotificationsResponse, NotificationCreate, NotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post(
    "",
    response_model=NotificationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
) -> Notification:
    notification = Notification(
        user_id=payload.user_id,
        title=payload.title,
        message=payload.message,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


@router.get("/{user_id}", response_model=list[NotificationRead])
def list_notifications(
    user_id: int,
    unread_only: bool = Query(True),
    db: Session = Depends(get_db),
) -> list[Notification]:
    statement = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        statement = statement.where(Notification.is_read.is_(False))
    statement = statement.order_by(Notification.created_at.desc())
    return list(db.scalars(statement).all())


@router.patch("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
) -> Notification:
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.delete("/{user_id}", response_model=ClearNotificationsResponse)
def clear_notifications(
    user_id: int,
    db: Session = Depends(get_db),
) -> ClearNotificationsResponse:
    result = db.execute(delete(Notification).where(Notification.user_id == user_id))
    db.commit()
    return ClearNotificationsResponse(user_id=user_id, deleted=result.rowcount or 0)
