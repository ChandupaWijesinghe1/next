from pydantic import BaseModel


class WebhookReceivedResponse(BaseModel):
    received: bool
    provider: str
    event_type: str
    idempotency_key: str
    duplicate: bool
    processed: bool
