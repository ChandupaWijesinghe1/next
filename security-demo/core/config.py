from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings): #this is a class that indicate the  form of the settings
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    redis_url: str = "redis://localhost:6379/0"
    arq_queue_name: str = "security-demo"
    arq_max_jobs: int = 5
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://127.0.0.1:8000/auth/oauth/github/callback"
    app_env: str = "development"
    cors_origins: str = "http://127.0.0.1:8000,http://localhost:8000"
    reports_dir: str = "reports"
    database_url: str = "sqlite:///./app.db"
    s3_bucket_name: str = "security-demo-attachments"
    s3_region: str = "us-east-1"
    s3_endpoint_url: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    stripe_secret_key: str = ""
    stripe_success_url: str = "http://127.0.0.1:8000/billing/success"
    stripe_cancel_url: str = "http://127.0.0.1:8000/billing/cancel"
    stripe_webhook_secret: str = ""
    github_webhook_secret: str = ""
    notifications_url: str = "http://localhost:8001"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def model_post_init(self, __context) -> None:
        url = self.notifications_url.strip().rstrip("/")
        if url and not url.startswith(("http://", "https://")):
            url = f"https://{url}"
        object.__setattr__(self, "notifications_url", url)


settings = Settings() #this is a singleton instance of the Settings class. 
