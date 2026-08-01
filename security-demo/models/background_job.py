from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String

from models.user import Base


class JobStatus:
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class BackgroundJob(Base):
    __tablename__ = "background_jobs"

    id = Column(String, primary_key=True, index=True)
    task_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default=JobStatus.PENDING)
    result = Column(String, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at = Column(DateTime, nullable=True)
