from sqlalchemy.orm import Session

from core.security import hash_password
from models.user import User
from schemas.user import UserCreate
from core.exceptions import EmailAlreadyRegisteredError

def create_user(db: Session, user_in: UserCreate) -> User:
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise EmailAlreadyRegisteredError()

    hashed = hash_password(user_in.password)

    db_user = User(
        email=user_in.email,
        password_hash=hashed,
        username=user_in.username,
        full_name=user_in.full_name,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def list_users(db: Session) -> list[User]:
    return db.query(User).order_by(User.id).all()
