from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.user import UserRead
from services.user_service import list_users

users_router = APIRouter(prefix="/users", tags=["users"])


@users_router.get("", response_model=list[UserRead])
def list_users_route(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List all registered users. Available to any authenticated member."""
    return list_users(db)
