from sqlalchemy.orm import Session

from core.exceptions import NotFoundError
from models.comment import Comment
from models.user import User
from schemas.comment import CommentCreate
from services.task_service import get_task


def create_comment(
    db: Session,
    team_id: int,
    project_id: int,
    task_id: int,
    author: User,
    comment_in: CommentCreate,
) -> Comment:
    get_task(db, team_id, project_id, task_id, author.id)
    comment = Comment(
        task_id=task_id,
        created_by=author.id,
        body=comment_in.body,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def list_comments(
    db: Session,
    team_id: int,
    project_id: int,
    task_id: int,
    user_id: int,
) -> list[Comment]:
    get_task(db, team_id, project_id, task_id, user_id)
    return db.query(Comment).filter(Comment.task_id == task_id).order_by(Comment.id).all()


def get_comment(
    db: Session,
    team_id: int,
    project_id: int,
    task_id: int,
    comment_id: int,
    user_id: int,
) -> Comment:
    get_task(db, team_id, project_id, task_id, user_id)
    comment = (
        db.query(Comment)
        .filter(Comment.id == comment_id, Comment.task_id == task_id)
        .first()
    )
    if comment is None:
        raise NotFoundError("Comment not found")
    return comment


def delete_comment(
    db: Session,
    team_id: int,
    project_id: int,
    task_id: int,
    comment_id: int,
    user_id: int,
) -> None:
    comment = get_comment(db, team_id, project_id, task_id, comment_id, user_id)
    db.delete(comment)
    db.commit()
