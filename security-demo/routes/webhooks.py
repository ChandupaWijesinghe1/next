from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.exceptions import NotFoundError
from schemas.webhook import WebhookReceivedResponse
from services.webhook_service import (
    create_webhook_event,
    get_existing_webhook_event,
    process_provider_event,
)
from services.webhook_verification import SUPPORTED_PROVIDERS, verify_webhook

webhooks_router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _webhook_response(event, provider: str, duplicate: bool) -> WebhookReceivedResponse:
    return WebhookReceivedResponse(
        received=True,
        provider=provider,
        event_type=event.event_type,
        idempotency_key=event.idempotency_key,
        duplicate=duplicate,
        processed=not duplicate,
    )


@webhooks_router.post(
    "/{provider}",
    response_model=WebhookReceivedResponse,
    status_code=status.HTTP_200_OK,
)
async def receive_webhook_route(
    provider: str,
    request: Request,
    db: Session = Depends(get_db),
):
    provider_name = provider.lower()
    if provider_name not in SUPPORTED_PROVIDERS:
        raise NotFoundError(f"Unsupported webhook provider: {provider}")

    payload = await request.body()
    headers = {key.lower(): value for key, value in request.headers.items()}
    verified = verify_webhook(provider_name, payload, headers)

    existing = get_existing_webhook_event(
        db,
        provider_name,
        verified["idempotency_key"],
    )
    if existing is not None:
        return _webhook_response(existing, provider_name, duplicate=True)

    event, created = create_webhook_event(
        db,
        provider=provider_name,
        event_type=verified["event_type"],
        idempotency_key=verified["idempotency_key"],
        payload=verified["payload"],
    )

    if created:
        process_provider_event(
            db,
            provider_name,
            verified["event_type"],
            verified["payload"],
        )
        return _webhook_response(event, provider_name, duplicate=False)

    return _webhook_response(event, provider_name, duplicate=True)
