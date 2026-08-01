from pydantic import BaseModel


class ReportJobResponse(BaseModel):
    job_id: str
    message: str = "Report generation queued"
