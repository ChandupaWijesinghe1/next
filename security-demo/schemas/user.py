import re
from pydantic import BaseModel, EmailStr, field_validator

from schemas.validators import sanitize_optional_text


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: str

    @field_validator("username", "full_name", mode="before")
    @classmethod
    def sanitize_text_fields(cls, value: str | None) -> str | None:
        return sanitize_optional_text(value)

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", value):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", value):
            raise ValueError("Password must contain at least one digit")
        return value

class UserRead(BaseModel):
    id: int
    email: EmailStr
    username: str
    full_name: str

    model_config = {"from_attributes": True}