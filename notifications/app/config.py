from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_database_url(url: str) -> str:
    # Render/Heroku often provide postgres://; SQLAlchemy + psycopg need postgresql+psycopg://
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


class Settings(BaseSettings):
    database_url: str = (
        "postgresql+psycopg://notifications:notifications@localhost:5432/notifications"
    )
    app_env: str = "development"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    def model_post_init(self, __context) -> None:
        object.__setattr__(self, "database_url", _normalize_database_url(self.database_url))


settings = Settings()
