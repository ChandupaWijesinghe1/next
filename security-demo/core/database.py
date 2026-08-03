from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import models  # noqa: F401 — register all models with Base.metadata
from core.config import settings
from models.user import Base

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {},
)
SessionLocal = sessionmaker(bind=engine)


def _existing_columns(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def migrate_db() -> None:#this function is used to migrate the database.sqlite ddo not migrate like others
    """Add columns introduced after the initial schema (SQLite has no auto-migrate)."""
    if not settings.database_url.startswith("sqlite"):
        return

    with engine.begin() as conn:
        team_columns = _existing_columns(conn, "teams")
        if "subscription_status" not in team_columns:
            conn.execute(
                text(
                    "ALTER TABLE teams ADD COLUMN subscription_status "
                    "VARCHAR NOT NULL DEFAULT 'free'"
                )
            )
        if "stripe_subscription_id" not in team_columns:
            conn.execute(
                text("ALTER TABLE teams ADD COLUMN stripe_subscription_id VARCHAR")
            )

        task_columns = _existing_columns(conn, "tasks")
        if "assigned_to" not in task_columns:
            conn.execute(
                text("ALTER TABLE tasks ADD COLUMN assigned_to INTEGER REFERENCES users(id)")
            )


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    migrate_db()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
