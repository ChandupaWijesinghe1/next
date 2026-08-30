import os
import time

from fastapi import APIRouter, Depends, FastAPI, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db, init_db
from core.security_headers import SecurityHeadersMiddleware
from core.dependencies import (
    get_access_token,
    get_current_user,
    rate_limit_login,
    rate_limit_oauth,
    rate_limit_refresh,
    rate_limit_register,
)
from core.exceptions import (
    EmailAlreadyRegisteredError,
    ForbiddenError,
    InvalidCredentialsError,
    InvalidTokenError,
    NotFoundError,
    OAuthError,
    RateLimitExceededError,
    AttachmentValidationError,
    WebhookSignatureError,
)
from models.user import User
from schemas.auth import (
    LoginRequest,
    LogoutResponse,
    OAuthAuthorizationResponse,
    RefreshRequest,
    TokenResponse,
)
from services.github_oauth_service import build_github_authorization_url, handle_github_callback
from schemas.user import UserCreate, UserRead
from services.auth_service import (
    authenticate_user,
    establish_user_session,
    logout_access_token,
    refresh_user_tokens,
)
from services.user_service import create_user
from routes.teams import teams_router
from routes.jobs import jobs_router
from routes.projects import projects_router
from routes.attachments import attachments_router, tasks_router
from routes.billing import billing_router
from routes.webhooks import webhooks_router
from routes.users import users_router

init_db() # this is the function that initializes the database

app = FastAPI( # this is the FastAPI app
    title="Security Demo API",
    docs_url=None if settings.is_production else "/docs", # this is the documentation url
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json", # this is the openapi url
) #Show docs in dev, hide them in production.

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
router = APIRouter(prefix="/auth", tags=["auth"])


@app.exception_handler(EmailAlreadyRegisteredError)
async def email_already_registered_handler(request, exc: EmailAlreadyRegisteredError):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"message": exc.message},
    )


@app.exception_handler(InvalidCredentialsError)
async def invalid_credentials_handler(request, exc: InvalidCredentialsError):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"message": exc.message},
    )


@app.exception_handler(InvalidTokenError)
async def invalid_token_handler(request, exc: InvalidTokenError):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"message": exc.message},
    )


@app.exception_handler(RateLimitExceededError)
async def rate_limit_handler(request, exc: RateLimitExceededError):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"message": exc.message},
        headers={"Retry-After": str(exc.retry_after)},
    )


@app.exception_handler(ForbiddenError)
async def forbidden_handler(request, exc: ForbiddenError):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"message": exc.message},
    )


@app.exception_handler(NotFoundError)
async def not_found_handler(request, exc: NotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"message": exc.message},
    )


@app.exception_handler(OAuthError)
async def oauth_error_handler(request, exc: OAuthError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"message": exc.message},
    )


@app.exception_handler(AttachmentValidationError)
async def attachment_validation_handler(request, exc: AttachmentValidationError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"message": exc.message},
    )


@app.exception_handler(WebhookSignatureError)
async def webhook_signature_handler(request, exc: WebhookSignatureError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"message": exc.message},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    if not settings.is_production:
        raise exc
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "Internal server error"},
    )


@router.get(
    "/me",
    response_model=UserRead,
    responses={
        401: {
            "description": "Invalid or expired token",
            "content": {
                "application/json": {
                    "example": {"message": "Invalid or expired token"},
                }
            },
        }
    },
)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.post(
    "/logout",
    response_model=LogoutResponse,
    responses={
        401: {
            "description": "Invalid or expired token",
            "content": {
                "application/json": {
                    "example": {"message": "Invalid or expired token"},
                }
            },
        }
    },
)
def logout(
    current_user: User = Depends(get_current_user),
    token: str = Depends(get_access_token),
):
    logout_access_token(token)
    return LogoutResponse()


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {
            "description": "Email already registered",
            "content": {
                "application/json": {
                    "example": {"message": "Email already registered"},
                }
            },
        },
        429: {
            "description": "Too many requests",
            "headers": {
                "Retry-After": {
                    "description": "Seconds to wait before retrying",
                    "schema": {"type": "integer"},
                }
            },
            "content": {
                "application/json": {
                    "example": {"message": "Too many requests. Please try again later."},
                }
            },
        },
    },
)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit_register),
):
    return create_user(db, user_in)


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        401: {
            "description": "Invalid credentials",
            "content": {
                "application/json": {
                    "example": {"message": "Invalid credentials"},
                }
            },
        },
        429: {
            "description": "Too many requests",
            "headers": {
                "Retry-After": {
                    "description": "Seconds to wait before retrying",
                    "schema": {"type": "integer"},
                }
            },
            "content": {
                "application/json": {
                    "example": {"message": "Too many requests. Please try again later."},
                }
            },
        },
    },
)
def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db),
    _: None = Depends(rate_limit_login),
):
    user = authenticate_user(db, credentials.email, credentials.password)
    return establish_user_session(str(user.id))


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={
        401: {
            "description": "Invalid or expired token",
            "content": {
                "application/json": {
                    "example": {"message": "Invalid or expired token"},
                }
            },
        }
    },
)
def refresh(
    body: RefreshRequest,
    _: None = Depends(rate_limit_refresh),
):
    return refresh_user_tokens(body.refresh_token)


@router.get("/oauth/github", response_model=OAuthAuthorizationResponse)
def github_oauth_start(_: None = Depends(rate_limit_oauth)):
    return build_github_authorization_url()


@router.get("/oauth/github/callback", response_model=TokenResponse)
def github_oauth_callback(
    db: Session = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    _: None = Depends(rate_limit_oauth),
):
    github_error = error
    if github_error and error_description:
        github_error = f"{error}: {error_description}"
    return handle_github_callback(db, code, state, github_error)


app.include_router(router)
app.include_router(users_router)
app.include_router(teams_router)
app.include_router(jobs_router)
app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(attachments_router)
app.include_router(billing_router)
app.include_router(webhooks_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _load_test_enabled() -> bool:
    return os.getenv("ENABLE_LOAD_TEST", "").lower() in ("1", "true", "yes")


if _load_test_enabled():

    @app.get("/load-test")
    def load_test(duration: int = Query(default=30, ge=1, le=120)) -> dict[str, int | str]:
        """CPU burn endpoint for ECS autoscaling demos (disabled unless ENABLE_LOAD_TEST=true)."""
        end = time.time() + duration
        checksum = 0
        while time.time() < end:
            checksum += sum(i * i for i in range(10_000))
        return {"status": "done", "duration": duration, "checksum": checksum}
