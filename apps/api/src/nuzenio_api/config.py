from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Nuzenio API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://nuzenio:nuzenio@localhost:5432/nuzenio"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:3000"]
    demo_mode: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_prefix="NUZENIO_", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
