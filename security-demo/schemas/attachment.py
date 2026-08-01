from datetime import datetime

from pydantic import BaseModel


class AttachmentRead(BaseModel):    #Attachment read schema.
    id: int
    task_id: int
    uploaded_by: int
    file_name: str
    content_type: str
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class AttachmentDownloadResponse(BaseModel):#Attachment download response schema.
    download_url: str
    expires_in: int
