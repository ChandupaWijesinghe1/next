from pydantic import BaseModel, Field, field_validator

from schemas.validators import sanitize_optional_text


class CommentCreate(BaseModel):#Comment create schema.
    body: str = Field(min_length=1, max_length=2000)

    @field_validator("body", mode="before")
    @classmethod
    def sanitize_body(cls, value: str | None) -> str | None:
        return sanitize_optional_text(value)


class CommentRead(BaseModel):
    id: int
    task_id: int
    created_by: int
    body: str

    model_config = {"from_attributes": True}
