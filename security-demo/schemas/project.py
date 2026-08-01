from pydantic import BaseModel, Field, field_validator

from schemas.validators import sanitize_optional_text


class ProjectCreate(BaseModel):#Project create schema.
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def sanitize_text_fields(cls, value: str | None) -> str | None:
        return sanitize_optional_text(value)


class ProjectUpdate(BaseModel):#Project update schema.
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def sanitize_text_fields(cls, value: str | None) -> str | None:
        return sanitize_optional_text(value)


class ProjectRead(BaseModel):#Project read schema.
    id: int
    team_id: int
    name: str
    description: str | None
    created_by: int

    model_config = {"from_attributes": True}
