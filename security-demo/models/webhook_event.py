from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, Integer, String, UniqueConstraint

from models.user import Base


class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    __table_args__ = (
        UniqueConstraint("provider", "idempotency_key", name="uq_webhook_idempotency"),
    )

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    idempotency_key = Column(String, nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
