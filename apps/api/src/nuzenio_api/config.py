import os
import tempfile
from functools import lru_cache
from ipaddress import ip_network
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    app_name: str = "Nuzenio API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://nuzenio:nuzenio@localhost:5432/nuzenio"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:3000"]
    allowed_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]
    demo_mode: bool = True
    max_page_size: int = 50
    sql_echo: bool = False
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_json: bool = True
    log_client_ip: bool = False
    metrics_token: SecretStr | None = None
    readiness_timeout_seconds: float = Field(default=2.0, ge=0.1, le=10)
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
    login_concurrency: int = Field(default=4, ge=1, le=16)
    login_verifier_timeout_seconds: float = Field(default=3, ge=0.1, le=10)
    login_lock_directory: str = f"{tempfile.gettempdir()}/nuzenio-password-{os.getuid()}"
    login_key_prefix: str = "nuzenio:auth:v2"
    trusted_proxy_cidrs: list[str] = []
    feed_user_agent: str = "NuzenioFeedFetcher/0.4 (+https://nuzenio.example/feeds)"
    feed_timeout_seconds: float = 10.0
    feed_max_bytes: int = 2_000_000
    feed_redirect_limit: int = 3
    feed_https_required: bool = True
    feed_kill_switch: bool = False
    runtime_database_role: str = "nuzenio_runtime"
    worker_health_host: str = "0.0.0.0"
    worker_health_port: int = Field(default=8001, ge=1024, le=65535)
    worker_poll_seconds: int = Field(default=2, ge=1, le=30)
    worker_stale_after_seconds: int = Field(default=30, ge=10, le=300)

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
        if not self.log_json:
            raise ValueError("NUZENIO_LOG_JSON must be true in production")
        metrics_token = self.metrics_token.get_secret_value() if self.metrics_token else ""
        if len(metrics_token) < 32:
            raise ValueError("NUZENIO_METRICS_TOKEN must be a unique 32+ character secret")
        if not self.feed_https_required:
            raise ValueError("NUZENIO_FEED_HTTPS_REQUIRED must be true in production")
        if not self.feed_kill_switch:
            raise ValueError(
                "NUZENIO_FEED_KILL_SWITCH must remain true until live publisher feeds are approved"
            )
        if not self.cors_origins:
            raise ValueError("NUZENIO_CORS_ORIGINS must contain at least one exact HTTPS origin")
        for origin in self.cors_origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.path not in {"", "/"}
                or parsed.query
                or parsed.fragment
                or "*" in origin
            ):
                raise ValueError("Every production CORS origin must be an exact HTTPS origin")
        if not self.allowed_hosts or any(
            host == "*" or host.startswith(".") or "/" in host for host in self.allowed_hosts
        ):
            raise ValueError("NUZENIO_ALLOWED_HOSTS must contain explicit hostnames")
        if any(host in {"localhost", "127.0.0.1", "testserver"} for host in self.allowed_hosts):
            raise ValueError("Production allowed hosts must not contain local development hosts")
        for cidr in self.trusted_proxy_cidrs:
            try:
                network = ip_network(cidr, strict=False)
            except ValueError as error:
                raise ValueError("NUZENIO_TRUSTED_PROXY_CIDRS contains an invalid CIDR") from error
            if network.prefixlen == 0:
                raise ValueError("Production must not trust every proxy address")
        try:
            database = make_url(self.database_url)
        except Exception as error:
            raise ValueError("NUZENIO_DATABASE_URL must be a valid SQLAlchemy URL") from error
        if (
            database.drivername.split("+")[0] != "postgresql"
            or database.username != self.runtime_database_role
            or not database.password
            or len(database.password) < 16
        ):
            raise ValueError(
                "Production database URL must use the dedicated runtime role "
                "and a 16+ character password"
            )
        redis_url = urlsplit(self.redis_url)
        if redis_url.scheme != "rediss" or not redis_url.password or len(redis_url.password) < 16:
            raise ValueError("Production Redis must use TLS and a 16+ character password")
        return self

    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_prefix="NUZENIO_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
