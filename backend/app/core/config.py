"""Application settings, loaded from environment variables / .env.

Simplified relative to the reference project: no multi-provider OIDC config,
no AI-agent key settings. Just what GoalNexa's auth + tenancy flows need.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: str = "dev"

    DATABASE_URL: str = "postgresql+asyncpg://goalnexa:goalnexa@localhost:5432/goalnexa"

    JWT_SECRET: str = "change-me-in-production"
    JWT_ACCESS_TTL_MINUTES: float = 15
    JWT_REFRESH_TTL_DAYS: int = 30

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    APP_BASE_URL: str = "http://localhost:8000"


settings = Settings()
