from pydantic import BaseModel, Field


class CheckoutRequest(BaseModel):
    team_id: int = Field(gt=0)


class CheckoutResponse(BaseModel):
    checkout_session_id: str
    checkout_url: str
    status: str


class BillingStatusResponse(BaseModel):
    message: str
    checkout_session_id: str | None = None
    status: str | None = None


#This billing schema is used for Stripe payment processing in a SaaS application. Here's the purpose of each model: