from fastapi import Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from core.exceptions import ForbiddenError, NotFoundError
from models.team import Team, TeamMember, TeamRole
from models.user import User


def require_team_member( #Ensures the current user is a member of the specified team.
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),#depend use to inject a function.
) -> TeamMember:
    team = db.query(Team).filter(Team.id == team_id).first()
    if team is None:
        raise NotFoundError("Team not found")

    membership = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == current_user.id,
        )
        .first()
    )
    if membership is None:
        raise ForbiddenError("Not a member of this team")
    return membership


def require_team_admin( #Ensures the current user is an admin of the specified team.
    membership: TeamMember = Depends(require_team_member),
) -> TeamMember:
    if membership.role != TeamRole.ADMIN.value:
        raise ForbiddenError("Admin role required")
    return membership


def require_task_creator_or_admin( #Ensures the current user is the creator of the specified task or an admin of the specified team.
    task_created_by: int,
    membership: TeamMember,
    current_user: User,
) -> None:
    if membership.role == TeamRole.ADMIN.value:
        return
    if task_created_by != current_user.id:
        raise ForbiddenError(
            "Only the task creator or a team admin can perform this action"
        )


def require_comment_author(comment_created_by: int, current_user: User) -> None:
    if comment_created_by != current_user.id:
        raise ForbiddenError("Only the comment author can delete this comment")
