import boto3
from botocore.client import Config
from fastapi import UploadFile

from core.config import settings


def _get_s3_client():
    client_kwargs = {
        "service_name": "s3",
        "region_name": settings.s3_region,
        "aws_access_key_id": settings.aws_access_key_id,
        "aws_secret_access_key": settings.aws_secret_access_key,
        "config": Config(signature_version="s3v4"),
    }
    if settings.s3_endpoint_url:
        client_kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client(**client_kwargs)


def upload_file(file: UploadFile, key: str) -> str:
    client = _get_s3_client()
    file.file.seek(0)
    client.upload_fileobj(
        file.file,
        settings.s3_bucket_name,
        key,
        ExtraArgs={"ContentType": file.content_type or "application/octet-stream"},
    )
    return key


def generate_presigned_url(key: str, expires_in: int) -> str:
    client = _get_s3_client()
    return client.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key},
        ExpiresIn=expires_in,
    )


def delete_file(key: str) -> None:
    client = _get_s3_client()
    client.delete_object(Bucket=settings.s3_bucket_name, Key=key)
