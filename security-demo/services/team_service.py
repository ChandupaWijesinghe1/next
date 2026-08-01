from sqlalchemy.orm import Session

from core.exceptions import ForbiddenError, NotFoundError
from models.team import Team, TeamMember, TeamRole
from models.user import User
from schemas.team import TeamCreate, TeamMemberCreate, TeamMemberUpdate, TeamUpdate


def create_team(db: Session, user: User, team_in: TeamCreate) -> Team:
    team = Team(
        name=team_in.name,
        description=team_in.description,
        created_by=user.id,
    )
    db.add(team)
    db.flush()

    membership = TeamMember(
        team_id=team.id,
        user_id=user.id,
        role=TeamRole.ADMIN.value,
    )
    db.add(membership)
    db.commit()
    db.refresh(team)
    return team


def get_team(db: Session, team_id: int) -> Team:
    team = db.query(Team).filter(Team.id == team_id).first()
    if team is None:
        raise NotFoundError("Team not found")
    return team


def ensure_team_membership(db: Session, team_id: int, user_id: int) -> TeamMember:
    get_team(db, team_id)
    membership = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
        .first()
    )
    if membership is None:
        raise ForbiddenError("Not a member of this team")
    return membership


def list_teams_for_user(db: Session, user: User) -> list[Team]:
    return (
        db.query(Team)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .filter(TeamMember.user_id == user.id)
        .order_by(Team.id)
        .all()
    )


def update_team(db: Session, team_id: int, team_in: TeamUpdate) -> Team:
    team = get_team(db, team_id)
    if team_in.name is not None:
        team.name = team_in.name
    if team_in.description is not None:
        team.description = team_in.description
    db.commit()
    db.refresh(team)
    return team


def delete_team(db: Session, team_id: int) -> None:
    team = get_team(db, team_id)
    db.delete(team)
    db.commit()


def list_team_members(db: Session, team_id: int) -> list[TeamMember]:
    get_team(db, team_id)
    return db.query(TeamMember).filter(TeamMember.team_id == team_id).all()


def add_team_member(db: Session, team_id: int, member_in: TeamMemberCreate) -> TeamMember:
    get_team(db, team_id)
    user = db.query(User).filter(User.id == member_in.user_id).first()
    if user is None:
        raise NotFoundError("User not found")

    if member_in.role not in {TeamRole.ADMIN.value, TeamRole.MEMBER.value}:
        raise ForbiddenError("Invalid role")

    existing = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == member_in.user_id,
        )
        .first()
    )
    if existing:
        raise ForbiddenError("User is already a team member")

    membership = TeamMember(
        team_id=team_id,
        user_id=member_in.user_id,
        role=member_in.role,
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return membership


def update_team_member_role(
    db: Session,
    team_id: int,
    user_id: int,
    member_in: TeamMemberUpdate,
) -> TeamMember:
    if member_in.role not in {TeamRole.ADMIN.value, TeamRole.MEMBER.value}:
        raise ForbiddenError("Invalid role")

    membership = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
        .first()
    )
    if membership is None:
        raise NotFoundError("Team member not found")

    membership.role = member_in.role
    db.commit()
    db.refresh(membership)
    return membership


def remove_team_member(db: Session, team_id: int, user_id: int) -> None:
    membership = (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
        .first()
    )
    if membership is None:
        raise NotFoundError("Team member not found")

    if membership.role == TeamRole.ADMIN.value:
        admin_count = (
            db.query(TeamMember)
            .filter(
                TeamMember.team_id == team_id,
                TeamMember.role == TeamRole.ADMIN.value,
            )
            .count()
        )
        if admin_count <= 1:
            raise ForbiddenError("Cannot remove the last admin")

    db.delete(membership)
    db.commit()
