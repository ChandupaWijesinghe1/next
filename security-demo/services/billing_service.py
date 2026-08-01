from datetime import datetime, timezone

import stripe
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import ForbiddenError, NotFoundError
from models.stripe_checkout import CheckoutSessionStatus, StripeCheckoutSession
from models.team import TeamRole
from models.user import User
from services.team_service import ensure_team_membership, get_team

TEAM_PRO_PLAN_NAME = "Team Pro Plan"
TEAM_PRO_PLAN_DESCRIPTION = "Team Pro Plan -- $29/month"
TEAM_PRO_PLAN_AMOUNT_CENTS = 2900


def _configure_stripe() -> None:
    if not settings.stripe_secret_key:
        raise ValueError("STRIPE_SECRET_KEY is not configured")
    stripe.api_key = settings.stripe_secret_key


def create_team_checkout_session(
    db: Session,
    team_id: int,
    user: User,
) -> tuple[StripeCheckoutSession, str]:
    membership = ensure_team_membership(db, team_id, user.id)
    if membership.role != TeamRole.ADMIN.value:
        raise ForbiddenError("Admin role required to start team billing")
    get_team(db, team_id)

    _configure_stripe()

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": TEAM_PRO_PLAN_NAME,
                        "description": TEAM_PRO_PLAN_DESCRIPTION,
                    },
                    "unit_amount": TEAM_PRO_PLAN_AMOUNT_CENTS,
                    "recurring": {"interval": "month"},
                },
                "quantity": 1,
            }
        ],
        success_url=(
            f"{settings.stripe_success_url}?session_id={{CHECKOUT_SESSION_ID}}"
        ),
        cancel_url=(
            f"{settings.stripe_cancel_url}?session_id={{CHECKOUT_SESSION_ID}}"
        ),
        metadata={
            "team_id": str(team_id),
            "user_id": str(user.id),
        },
    )

    checkout_record = StripeCheckoutSession(
        team_id=team_id,
        initiated_by=user.id,
        stripe_session_id=session.id,
        status=session.status or CheckoutSessionStatus.OPEN,
    )
    db.add(checkout_record)
    db.commit()
    db.refresh(checkout_record)
    return checkout_record, session.url


def sync_checkout_session_status(
    db: Session,
    stripe_session_id: str,
) -> StripeCheckoutSession:
    record = (
        db.query(StripeCheckoutSession)
        .filter(StripeCheckoutSession.stripe_session_id == stripe_session_id)
        .first()
    )
    if record is None:
        raise NotFoundError("Checkout session not found")

    _configure_stripe()
    session = stripe.checkout.Session.retrieve(stripe_session_id)
    record.status = session.status or record.status
    record.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return record


def mark_checkout_canceled(db: Session, stripe_session_id: str) -> StripeCheckoutSession:
    record = (
        db.query(StripeCheckoutSession)
        .filter(StripeCheckoutSession.stripe_session_id == stripe_session_id)
        .first()
    )
    if record is None:
        raise NotFoundError("Checkout session not found")

    record.status = CheckoutSessionStatus.CANCELED
    record.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return record


def handle_checkout_session_completed(db: Session, payload: dict) -> None:
    session_object = payload.get("data", {}).get("object", {})
    stripe_session_id = session_object.get("id")
    if not stripe_session_id:
        return

    checkout_record = (
        db.query(StripeCheckoutSession)
        .filter(StripeCheckoutSession.stripe_session_id == stripe_session_id)
        .first()
    )
    if checkout_record is None:
        return

    from models.team import SubscriptionStatus, Team

    team = db.query(Team).filter(Team.id == checkout_record.team_id).first()
    if team is None:
        return

    checkout_record.status = CheckoutSessionStatus.COMPLETE
    checkout_record.updated_at = datetime.now(timezone.utc)
    team.subscription_status = SubscriptionStatus.PRO.value

    subscription_id = session_object.get("subscription")
    if subscription_id:
        team.stripe_subscription_id = subscription_id

    db.commit()
