from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Nuzenio API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://nuzenio:nuzenio@localhost:5432/nuzenio"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:3000"]
    demo_mode: bool = True
    max_page_size: int = 50
    sql_echo: bool = False
    session_cookie_name: str = "nuzenio_staff_session"
    csrf_cookie_name: str = "nuzenio_staff_csrf"
    session_ttl_minutes: int = 480
    cookie_secure: bool = False
    session_hash_pepper: str = "development-only-change-me"
    bootstrap_token: str | None = None
    login_attempt_limit: int = 5
    login_lockout_minutes: int = 15
    login_global_limit: int = 120
    login_ip_limit: int = 30
    login_window_seconds: int = 60
    login_concurrency: int = 4
    login_key_prefix: str = "nuzenio:auth:v2"
    trusted_proxy_cidrs: list[str] = []
    feed_user_agent: str = "NuzenioFeedFetcher/0.3 (+https://nuzenio.example/feeds)"
    feed_timeout_seconds: float = 10.0
    feed_max_bytes: int = 2_000_000
    feed_redirect_limit: int = 3
    feed_https_required: bool = True
    feed_kill_switch: bool = False

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.environment != "production":
            return self
        if (
            len(self.session_hash_pepper) < 32
            or self.session_hash_pepper == "development-only-change-me"
        ):
            raise ValueError(
                "NUZENIO_SESSION_HASH_PEPPER must be a unique 32+ character secret in production"
            )
        if not self.cookie_secure:
            raise ValueError("NUZENIO_COOKIE_SECURE must be true in production")
        if self.demo_mode:
            raise ValueError("NUZENIO_DEMO_MODE must be false in production")
        if not self.feed_https_required:
            raise ValueError("NUZENIO_FEED_HTTPS_REQUIRED must be true in production")
        if any(not origin.startswith("https://") for origin in self.cors_origins):
            raise ValueError("Every production CORS origin must use HTTPS")
        return self

    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_prefix="NUZENIO_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
