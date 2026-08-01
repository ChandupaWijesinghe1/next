from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.job import BackgroundJobRead
from services.background_job_service import get_background_job

jobs_router = APIRouter(prefix="/jobs", tags=["jobs"])


@jobs_router.get("/{job_id}", response_model=BackgroundJobRead)
def get_job_route(
    job_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return get_background_job(db, job_id)
