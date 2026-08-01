from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from models.user import Base


class CheckoutSessionStatus:
    OPEN = "open"
    COMPLETE = "complete"
    EXPIRED = "expired"
    UNPAID = "unpaid"
    CANCELED = "canceled"


class StripeCheckoutSession(Base):
    __tablename__ = "stripe_checkout_sessions"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    initiated_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stripe_session_id = Column(String, unique=True, nullable=False, index=True)
    status = Column(String, nullable=False, default=CheckoutSessionStatus.OPEN)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    team = relationship("Team", foreign_keys=[team_id])
    initiator = relationship("User", foreign_keys=[initiated_by])
