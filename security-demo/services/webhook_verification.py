import hashlib
import hmac
import json

import stripe

from core.config import settings
from core.exceptions import WebhookSignatureError

SUPPORTED_PROVIDERS = {"stripe", "github"}


def verify_stripe_webhook(payload: bytes, signature_header: str | None) -> dict:
    if not signature_header:
        raise WebhookSignatureError("Missing Stripe-Signature header")
    if not settings.stripe_webhook_secret:
        raise WebhookSignatureError("Stripe webhook secret is not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            signature_header,
            settings.stripe_webhook_secret,
        )
    except stripe.error.SignatureVerificationError as exc:
        raise WebhookSignatureError("Invalid Stripe webhook signature") from exc
    except ValueError as exc:
        raise WebhookSignatureError("Invalid Stripe webhook payload") from exc

    return {
        "idempotency_key": event["id"],
        "event_type": event["type"],
        "payload": json.loads(payload.decode("utf-8")),
    }


def verify_github_webhook(
    payload: bytes,
    signature_header: str | None,
    event_type_header: str | None,
    delivery_id_header: str | None,
) -> dict:
    if not signature_header:
        raise WebhookSignatureError("Missing X-Hub-Signature-256 header")
    if not settings.github_webhook_secret:
        raise WebhookSignatureError("GitHub webhook secret is not configured")
    if not delivery_id_header:
        raise WebhookSignatureError("Missing X-GitHub-Delivery header")
    if not event_type_header:
        raise WebhookSignatureError("Missing X-GitHub-Event header")

    expected_signature = (
        "sha256="
        + hmac.new(
            settings.github_webhook_secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
    )
    if not hmac.compare_digest(expected_signature, signature_header):
        raise WebhookSignatureError("Invalid GitHub webhook signature")

    try:
        payload_data = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise WebhookSignatureError("Invalid GitHub webhook payload") from exc

    return {
        "idempotency_key": delivery_id_header,
        "event_type": event_type_header,
        "payload": payload_data,
    }


def verify_webhook(
    provider: str,
    payload: bytes,
    headers: dict[str, str],
) -> dict:
    provider_name = provider.lower()
    if provider_name not in SUPPORTED_PROVIDERS:
        raise WebhookSignatureError(f"Unsupported webhook provider: {provider}")

    if provider_name == "stripe":
        return verify_stripe_webhook(payload, headers.get("stripe-signature"))

    return verify_github_webhook(
        payload,
        headers.get("x-hub-signature-256"),
        headers.get("x-github-event"),
        headers.get("x-github-delivery"),
    )
