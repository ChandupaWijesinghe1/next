from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.webhook_event import WebhookEvent
from services.billing_service import handle_checkout_session_completed


def get_existing_webhook_event(
    db: Session,
    provider: str,
    idempotency_key: str,
) -> WebhookEvent | None:
    return (
        db.query(WebhookEvent)
        .filter(
            WebhookEvent.provider == provider,
            WebhookEvent.idempotency_key == idempotency_key,
        )
        .first()
    )


def create_webhook_event(
    db: Session,
    provider: str,
    event_type: str,
    idempotency_key: str,
    payload: dict,
) -> tuple[WebhookEvent, bool]:
    event = WebhookEvent(
        provider=provider,
        event_type=event_type,
        idempotency_key=idempotency_key,
        payload=payload,
    )
    db.add(event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = get_existing_webhook_event(db, provider, idempotency_key)
        if existing is None:
            raise
        return existing, False
    db.refresh(event)
    return event, True


def process_provider_event(db: Session, provider: str, event_type: str, payload: dict) -> None:
    if provider != "stripe":
        return

    if event_type == "checkout.session.completed":
        handle_checkout_session_completed(db, payload)
        return

    if event_type == "checkout.session.expired":
        from datetime import datetime, timezone

        from models.stripe_checkout import CheckoutSessionStatus, StripeCheckoutSession

        session_id = payload.get("data", {}).get("object", {}).get("id")
        if not session_id:
            return
        record = (
            db.query(StripeCheckoutSession)
            .filter(StripeCheckoutSession.stripe_session_id == session_id)
            .first()
        )
        if record is None:
            return
        record.status = CheckoutSessionStatus.EXPIRED
        record.updated_at = datetime.now(timezone.utc)
        db.commit()
