from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):#Login request schema.
    email: EmailStr
    password: str


class TokenResponse(BaseModel):#Token response schema.
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):#Refresh request schema.
    refresh_token: str


class LogoutResponse(BaseModel):#Logout response schema.
    message: str = "Logged out successfully"


class OAuthAuthorizationResponse(BaseModel):#OAuth authorization response schema.
    authorization_url: str
    state: str
