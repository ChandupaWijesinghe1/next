from fastapi import UploadFile

from core.exceptions import AttachmentValidationError

MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

ALLOWED_CONTENT_TYPES = {#Allowed content types for attachments.
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def validate_attachment_file(file: UploadFile) -> int: #Validates the attachment file.      
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise AttachmentValidationError(        #Raises an attachment validation error if the content type is not allowed.
            f"Content type '{content_type}' is not allowed. "
            f"Allowed types: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}"
        )

    file.file.seek(0, 2)
    size_bytes = file.file.tell()
    file.file.seek(0)

    if size_bytes == 0:
        raise AttachmentValidationError("File is empty")        #Raises an attachment validation error if the file is empty.

    if size_bytes > MAX_ATTACHMENT_SIZE_BYTES:
        raise AttachmentValidationError(        #Raises an attachment validation error if the file exceeds the maximum size.
            f"File exceeds maximum size of {MAX_ATTACHMENT_SIZE_BYTES // (1024 * 1024)}MB"
        )

    return size_bytes
