from sqlalchemy.orm import Session

from core.exceptions import NotFoundError
from models.task import Task
from models.user import User
from schemas.task import TaskCreate, TaskUpdate
from services.project_service import get_project
from services.team_service import ensure_team_membership


def _resolve_assignee(db: Session, team_id: int, assigned_to: int | None) -> User | None:
    if assigned_to is None:
        return None

    ensure_team_membership(db, team_id, assigned_to)
    assignee = db.query(User).filter(User.id == assigned_to).first()
    if assignee is None:
        raise NotFoundError("Assignee not found")
    return assignee


def create_task(
    db: Session,
    team_id: int,
    project_id: int,
    creator: User,
    task_in: TaskCreate,
) -> tuple[Task, User | None]:
    get_project(db, team_id, project_id, creator.id)
    assignee = _resolve_assignee(db, team_id, task_in.assigned_to)
    task = Task(
        project_id=project_id,
        created_by=creator.id,
        assigned_to=task_in.assigned_to,
        title=task_in.title,
        description=task_in.description,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task, assignee


def list_tasks(db: Session, team_id: int, project_id: int, user_id: int) -> list[Task]:
    get_project(db, team_id, project_id, user_id)
    return db.query(Task).filter(Task.project_id == project_id).all()


def get_task(db: Session, team_id: int, project_id: int, task_id: int, user_id: int) -> Task:
    get_project(db, team_id, project_id, user_id)
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.project_id == project_id)
        .first()
    )
    if task is None:
        raise NotFoundError("Task not found")
    return task


def update_task(
    db: Session,
    team_id: int,
    project_id: int,
    task_id: int,
    user_id: int,
    task_in: TaskUpdate,
) -> tuple[Task, User | None]:
    task = get_task(db, team_id, project_id, task_id, user_id)
    previous_assignee = task.assigned_to
    assignee: User | None = None

    if task_in.title is not None:
        task.title = task_in.title
    if task_in.description is not None:
        task.description = task_in.description
    if task_in.status is not None:
        task.status = task_in.status
    if task_in.assigned_to is not None:
        assignee = _resolve_assignee(db, team_id, task_in.assigned_to)
        task.assigned_to = task_in.assigned_to

    db.commit()
    db.refresh(task)

    if assignee is not None and task.assigned_to != previous_assignee:
        return task, assignee
    return task, None


def delete_task(db: Session, team_id: int, project_id: int, task_id: int, user_id: int) -> None:
    task = get_task(db, team_id, project_id, task_id, user_id)
    db.delete(task)
    db.commit()
