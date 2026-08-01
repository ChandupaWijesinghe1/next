from sqlalchemy.orm import Session

from core.exceptions import NotFoundError
from models.project import Project
from schemas.project import ProjectCreate, ProjectUpdate
from services.team_service import ensure_team_membership


def create_project(
    db: Session,
    team_id: int,
    user_id: int,
    project_in: ProjectCreate,
) -> Project:
    ensure_team_membership(db, team_id, user_id)
    project = Project(
        team_id=team_id,
        name=project_in.name,
        description=project_in.description,
        created_by=user_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def list_projects(db: Session, team_id: int, user_id: int) -> list[Project]:
    ensure_team_membership(db, team_id, user_id)
    return db.query(Project).filter(Project.team_id == team_id).all()


def get_project(db: Session, team_id: int, project_id: int, user_id: int) -> Project:
    ensure_team_membership(db, team_id, user_id)
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.team_id == team_id)
        .first()
    )
    if project is None:
        raise NotFoundError("Project not found")
    return project


def update_project(
    db: Session,
    team_id: int,
    project_id: int,
    user_id: int,
    project_in: ProjectUpdate,
) -> Project:
    project = get_project(db, team_id, project_id, user_id)
    if project_in.name is not None:
        project.name = project_in.name
    if project_in.description is not None:
        project.description = project_in.description
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, team_id: int, project_id: int, user_id: int) -> None:
    project = get_project(db, team_id, project_id, user_id)
    db.delete(project)
    db.commit()
