import secrets
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import OAuthError
from models.user import User
from schemas.auth import OAuthAuthorizationResponse, TokenResponse
from services.auth_service import establish_user_session
from services.oauth_state import consume_oauth_state, store_oauth_state

GITHUB_PROVIDER = "github"
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"
GITHUB_SCOPES = "read:user user:email"


def build_github_authorization_url() -> OAuthAuthorizationResponse:
    if not settings.github_client_id:
        raise OAuthError("GitHub OAuth is not configured")

    state = secrets.token_urlsafe(32)
    store_oauth_state(state)

    params = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.github_redirect_uri,
            "scope": GITHUB_SCOPES,
            "state": state,
        }
    )
    return OAuthAuthorizationResponse(
        authorization_url=f"{GITHUB_AUTHORIZE_URL}?{params}",
        state=state,
    )


def _exchange_code_for_token(code: str) -> str:
    try:
        response = httpx.post(
            GITHUB_TOKEN_URL,
            headers={"Accept": "application/json"},
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
            timeout=10.0,
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        raise OAuthError("Failed to exchange authorization code with GitHub") from exc

    if payload.get("error"):
        description = payload.get("error_description") or payload["error"]
        raise OAuthError(description)

    access_token = payload.get("access_token")
    if not access_token:
        raise OAuthError("GitHub did not return an access token")
    return access_token


def _fetch_github_profile(access_token: str) -> dict:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }
    try:
        user_response = httpx.get(GITHUB_USER_URL, headers=headers, timeout=10.0)
        user_response.raise_for_status()
        profile = user_response.json()

        emails_response = httpx.get(GITHUB_EMAILS_URL, headers=headers, timeout=10.0)
        emails_response.raise_for_status()
        emails = emails_response.json()
    except httpx.HTTPError as exc:
        raise OAuthError("Failed to fetch GitHub profile") from exc

    email = _select_primary_email(emails)
    if not email:
        raise OAuthError("GitHub account has no verified public email")

    return {
        "oauth_id": str(profile["id"]),
        "email": email,
        "full_name": profile.get("name") or profile.get("login") or email.split("@")[0],
        "username": profile.get("login") or email.split("@")[0],
        "avatar_url": profile.get("avatar_url"),
    }


def _select_primary_email(emails: list[dict]) -> str | None:
    verified = [item for item in emails if item.get("verified")]
    for item in verified:
        if item.get("primary"):
            return item["email"]
    if verified:
        return verified[0]["email"]
    return None


def _unique_username(db: Session, base_username: str) -> str:
    candidate = base_username
    suffix = 1
    while db.query(User).filter(User.username == candidate).first():
        candidate = f"{base_username}{suffix}"
        suffix += 1
    return candidate


def get_or_link_github_user(db: Session, profile: dict) -> User:
    oauth_id = profile["oauth_id"]
    email = profile["email"]

    by_oauth = (
        db.query(User)
        .filter(User.oauth_provider == GITHUB_PROVIDER, User.oauth_id == oauth_id)
        .first()
    )
    if by_oauth:
        if profile.get("avatar_url"):
            by_oauth.avatar_url = profile["avatar_url"]
            db.commit()
            db.refresh(by_oauth)
        return by_oauth

    by_email = db.query(User).filter(User.email == email).first()
    if by_email:
        if (
            by_email.oauth_provider
            and by_email.oauth_id
            and (
                by_email.oauth_provider != GITHUB_PROVIDER
                or by_email.oauth_id != oauth_id
            )
        ):
            raise OAuthError("Email already linked to a different OAuth account")

        by_email.oauth_provider = GITHUB_PROVIDER
        by_email.oauth_id = oauth_id
        if profile.get("avatar_url"):
            by_email.avatar_url = profile["avatar_url"]
        if not by_email.full_name and profile.get("full_name"):
            by_email.full_name = profile["full_name"]
        db.commit()
        db.refresh(by_email)
        return by_email

    username = _unique_username(db, profile["username"])
    user = User(
        email=email,
        username=username,
        full_name=profile["full_name"],
        password_hash=None,
        avatar_url=profile.get("avatar_url"),
        oauth_provider=GITHUB_PROVIDER,
        oauth_id=oauth_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def handle_github_callback(db: Session, code: str | None, state: str | None, error: str | None) -> TokenResponse:
    if error:
        raise OAuthError(f"GitHub authorization failed: {error}")

    if not code or not state:
        raise OAuthError("Missing authorization code or state")

    if not consume_oauth_state(state):
        raise OAuthError("Invalid or expired OAuth state")

    github_access_token = _exchange_code_for_token(code)
    profile = _fetch_github_profile(github_access_token)
    user = get_or_link_github_user(db, profile)
    return establish_user_session(str(user.id))
