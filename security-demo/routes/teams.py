from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from core.authorization import (
    require_comment_author,
    require_team_admin,
    require_team_member,
    require_task_creator_or_admin,
)
from core.database import get_db
from core.dependencies import get_current_user
from models.team import TeamMember
from models.user import User
from schemas.comment import CommentCreate, CommentRead
from schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from schemas.report import ReportJobResponse
from schemas.task import TaskCreate, TaskRead, TaskUpdate
from schemas.team import (
    TeamCreate,
    TeamMemberCreate,
    TeamMemberRead,
    TeamMemberUpdate,
    TeamRead,
    TeamUpdate,
)
from services.cache_services import (
    get_cached_project,
    get_cached_task_list,
    invalidate_project_cache,
    invalidate_task_list_cache,
    set_cached_project,
    set_cached_task_list,
)
from services.notification_service import enqueue_task_assignment_notification
from services.project_service import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)
from services.report_job_service import enqueue_project_report_job
from services.task_service import create_task, delete_task, get_task, list_tasks, update_task
from services.comment_service import create_comment, delete_comment, get_comment, list_comments
from services.team_service import (
    add_team_member,
    create_team,
    delete_team,
    get_team,
    list_team_members,
    list_teams_for_user,
    remove_team_member,
    update_team,
    update_team_member_role,
)

teams_router = APIRouter(prefix="/teams", tags=["teams"])


@teams_router.post("", response_model=TeamRead, status_code=status.HTTP_201_CREATED)
def create_team_route(
    team_in: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_team(db, current_user, team_in)


@teams_router.get("", response_model=list[TeamRead])
def list_teams_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_teams_for_user(db, current_user)


@teams_router.get("/{team_id}", response_model=TeamRead)
def get_team_route(
    team_id: int,
    db: Session = Depends(get_db),
    _: TeamMember = Depends(require_team_member),
):
    return get_team(db, team_id)


@teams_router.patch("/{team_id}", response_model=TeamRead)
def update_team_route(
    team_id: int,
    team_in: TeamUpdate,
    db: Session = Depends(get_db),
    _: TeamMember = Depends(require_team_admin),
):
    return update_team(db, team_id, team_in)


@teams_router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team_route(
    team_id: int,
    db: Session = Depends(get_db),
    _: TeamMember = Depends(require_team_admin),
):
    delete_team(db, team_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@teams_router.get("/{team_id}/members", response_model=list[TeamMemberRead])
def list_members_route(
    team_id: int,
    db: Session = Depends(get_db),
    _: TeamMember = Depends(require_team_member),
):
    return list_team_members(db, team_id)


@teams_router.post(
    "/{team_id}/members",
    response_model=TeamMemberRead,
    status_code=status.HTTP_201_CREATED,
)
def add_member_route(
    team_id: int,
    member_in: TeamMemberCreate,
    db: Session = Depends(get_db),
    _: TeamMember = Depends(require_team_admin),
):
    return add_team_member(db, team_id, member_in)


@teams_router.patch("/{team_id}/members/{user_id}", response_model=TeamMemberRead)
def update_member_route(
    team_id: int,
    user_id: int,
    member_in: TeamMemberUpdate,
    db: Session = Depends(get_db),
    _: TeamMember = Depends(require_team_admin),
):
    return update_team_member_role(db, team_id, user_id, member_in)


@teams_router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member_route(
    team_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    _: TeamMember = Depends(require_team_admin),
):
    remove_team_member(db, team_id, user_id)


@teams_router.post(
    "/{team_id}/projects",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_route(
    team_id: int,
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_member),
):
    return create_project(db, team_id, current_user.id, project_in)


@teams_router.get("/{team_id}/projects", response_model=list[ProjectRead])
def list_projects_route(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_member),
):
    return list_projects(db, team_id, current_user.id)


@teams_router.get("/{team_id}/projects/{project_id}", response_model=ProjectRead)
async def get_project_route(
    team_id: int,
    project_id: int,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_member),
):
    cached = await get_cached_project(team_id, project_id)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        return cached

    project = get_project(db, team_id, project_id, current_user.id)
    project_read = ProjectRead.model_validate(project)
    await set_cached_project(team_id, project_id, project_read)
    response.headers["X-Cache"] = "MISS"
    return project_read


@teams_router.patch("/{team_id}/projects/{project_id}", response_model=ProjectRead)
async def update_project_route(
    team_id: int,
    project_id: int,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_admin),
):
    project = update_project(db, team_id, project_id, current_user.id, project_in)
    await invalidate_project_cache(team_id, project_id)
    return project


@teams_router.delete("/{team_id}/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_route(
    team_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_admin),
):
    delete_project(db, team_id, project_id, current_user.id)
    await invalidate_project_cache(team_id, project_id)


@teams_router.post(
    "/{team_id}/projects/{project_id}/report",
    response_model=ReportJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_project_report_route(
    team_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_member),
):
    get_project(db, team_id, project_id, current_user.id)
    job_id = await enqueue_project_report_job(db, project_id)
    if job_id is None:
        return ReportJobResponse(job_id="", message="Failed to queue report generation")
    return ReportJobResponse(job_id=job_id)


@teams_router.post(
    "/{team_id}/projects/{project_id}/tasks",
    response_model=TaskRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_route(
    team_id: int,
    project_id: int,
    task_in: TaskCreate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_member),
):
    task, assignee = create_task(db, team_id, project_id, current_user, task_in)
    await invalidate_task_list_cache(team_id, project_id)
    if assignee is not None:
        job_id = await enqueue_task_assignment_notification(db, task, assignee)
        if job_id:
            response.headers["X-Notification-Job-Id"] = job_id
    return task


@teams_router.get("/{team_id}/projects/{project_id}/tasks", response_model=list[TaskRead])
async def list_tasks_route(
    team_id: int,
    project_id: int,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_member),
):
    cached = await get_cached_task_list(team_id, project_id)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        return cached

    tasks = list_tasks(db, team_id, project_id, current_user.id)
    task_reads = [TaskRead.model_validate(task) for task in tasks]
    await set_cached_task_list(team_id, project_id, task_reads)
    response.headers["X-Cache"] = "MISS"
    return task_reads


@teams_router.get("/{team_id}/projects/{project_id}/tasks/{task_id}", response_model=TaskRead)
def get_task_route(
    team_id: int,
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_member),
):
    return get_task(db, team_id, project_id, task_id, current_user.id)


@teams_router.patch("/{team_id}/projects/{project_id}/tasks/{task_id}", response_model=TaskRead)
async def update_task_route(
    team_id: int,
    project_id: int,
    task_id: int,
    task_in: TaskUpdate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership: TeamMember = Depends(require_team_member),
):
    task = get_task(db, team_id, project_id, task_id, current_user.id)
    require_task_creator_or_admin(task.created_by, membership, current_user)
    updated_task, assignee = update_task(
        db, team_id, project_id, task_id, current_user.id, task_in
    )
    await invalidate_task_list_cache(team_id, project_id)
    if assignee is not None:
        job_id = await enqueue_task_assignment_notification(db, updated_task, assignee)
        if job_id:
            response.headers["X-Notification-Job-Id"] = job_id
    return updated_task


@teams_router.delete(
    "/{team_id}/projects/{project_id}/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_task_route(
    team_id: int,
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    membership: TeamMember = Depends(require_team_member),
):
    task = get_task(db, team_id, project_id, task_id, current_user.id)
    require_task_creator_or_admin(task.created_by, membership, current_user)
    delete_task(db, team_id, project_id, task_id, current_user.id)
    await invalidate_task_list_cache(team_id, project_id)


@teams_router.post(
    "/{team_id}/projects/{project_id}/tasks/{task_id}/comments",
    response_model=CommentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_comment_route(
    team_id: int,
    project_id: int,
    task_id: int,
    comment_in: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_member),
):
    return create_comment(db, team_id, project_id, task_id, current_user, comment_in)


@teams_router.get(
    "/{team_id}/projects/{project_id}/tasks/{task_id}/comments",
    response_model=list[CommentRead],
)
def list_comments_route(
    team_id: int,
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_member),
):
    return list_comments(db, team_id, project_id, task_id, current_user.id)


@teams_router.delete(
    "/{team_id}/projects/{project_id}/tasks/{task_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_comment_route(
    team_id: int,
    project_id: int,
    task_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: TeamMember = Depends(require_team_member),
):
    comment = get_comment(db, team_id, project_id, task_id, comment_id, current_user.id)
    require_comment_author(comment.created_by, current_user)
    delete_comment(db, team_id, project_id, task_id, comment_id, current_user.id)
