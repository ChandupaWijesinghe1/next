from datetime import datetime

from pydantic import BaseModel


class BackgroundJobRead(BaseModel):
    id: str
    task_name: str
    status: str
    result: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}
