from pydantic import BaseModel, Field, field_validator

from schemas.validators import sanitize_optional_text


class TeamCreate(BaseModel):#Team create schema.
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def sanitize_text_fields(cls, value: str | None) -> str | None:
        return sanitize_optional_text(value)


class TeamUpdate(BaseModel):#Team update schema.
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def sanitize_text_fields(cls, value: str | None) -> str | None:
        return sanitize_optional_text(value)


class TeamRead(BaseModel):#Team read schema.
    id: int
    name: str
    description: str | None
    created_by: int
    subscription_status: str
    stripe_subscription_id: str | None = None

    model_config = {"from_attributes": True}


class TeamMemberCreate(BaseModel):#Team member create schema.
    user_id: int
    role: str = "member"

    @field_validator("role", mode="before")
    @classmethod
    def sanitize_role(cls, value: str | None) -> str | None:
        return sanitize_optional_text(value)


class TeamMemberUpdate(BaseModel):#Team member update schema.
    role: str

    @field_validator("role", mode="before")
    @classmethod
    def sanitize_role(cls, value: str | None) -> str | None:
        return sanitize_optional_text(value)


class TeamMemberRead(BaseModel):#Team member read schema.
    id: int
    team_id: int
    user_id: int
    role: str

    model_config = {"from_attributes": True}
