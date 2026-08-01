from pydantic import BaseModel, Field, field_validator

from schemas.validators import sanitize_optional_text


class TaskCreate(BaseModel):#Task create schema.
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    assigned_to: int | None = None

    @field_validator("title", "description", mode="before")
    @classmethod
    def sanitize_text_fields(cls, value: str | None) -> str | None:
        return sanitize_optional_text(value)


class TaskUpdate(BaseModel):#Task update schema.
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: str | None = None
    assigned_to: int | None = None

    @field_validator("title", "description", "status", mode="before")
    @classmethod
    def sanitize_text_fields(cls, value: str | None) -> str | None:
        return sanitize_optional_text(value)


class TaskRead(BaseModel):#Task read schema.
    id: int
    project_id: int
    created_by: int
    assigned_to: int | None
    title: str
    description: str | None
    status: str

    model_config = {"from_attributes": True}
