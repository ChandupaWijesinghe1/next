from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from core.exceptions import NotFoundError
from models.project import Project
from models.user import User
from schemas.report import ReportJobResponse
from services.report_job_service import enqueue_project_report_job
from services.team_service import ensure_team_membership

projects_router = APIRouter(prefix="/projects", tags=["projects"])


@projects_router.post(
    "/{project_id}/report",
    response_model=ReportJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_project_report_route(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise NotFoundError("Project not found")

    ensure_team_membership(db, project.team_id, current_user.id)
    job_id = await enqueue_project_report_job(db, project_id)
    if job_id is None:
        return ReportJobResponse(job_id="", message="Failed to queue report generation")
    return ReportJobResponse(job_id=job_id)
