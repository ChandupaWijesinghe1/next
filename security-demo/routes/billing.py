from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from core.exceptions import NotFoundError
from models.user import User
from schemas.billing import BillingStatusResponse, CheckoutRequest, CheckoutResponse
from services.billing_service import (
    create_team_checkout_session,
    mark_checkout_canceled,
    sync_checkout_session_status,
)

billing_router = APIRouter(prefix="/billing", tags=["billing"])


@billing_router.post("/checkout", response_model=CheckoutResponse)
def create_checkout_route(
    body: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record, checkout_url = create_team_checkout_session(
        db, body.team_id, current_user
    )
    return CheckoutResponse(
        checkout_session_id=record.stripe_session_id,
        checkout_url=checkout_url,
        status=record.status,
    )


@billing_router.get("/success", response_model=BillingStatusResponse)
def billing_success_route(
    session_id: str = Query(..., alias="session_id"),
    db: Session = Depends(get_db),
):
    try:
        record = sync_checkout_session_status(db, session_id)
    except NotFoundError:
        return BillingStatusResponse(
            message="Checkout session not found",
            checkout_session_id=session_id,
        )
    return BillingStatusResponse(
        message="Payment successful",
        checkout_session_id=record.stripe_session_id,
        status=record.status,
    )


@billing_router.get("/cancel", response_model=BillingStatusResponse)
def billing_cancel_route(
    session_id: str = Query(..., alias="session_id"),
    db: Session = Depends(get_db),
):
    try:
        record = mark_checkout_canceled(db, session_id)
    except NotFoundError:
        return BillingStatusResponse(
            message="Checkout session not found",
            checkout_session_id=session_id,
        )
    return BillingStatusResponse(
        message="Checkout canceled",
        checkout_session_id=record.stripe_session_id,
        status=record.status,
    )
