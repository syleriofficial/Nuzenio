from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from nuzenio_api.config import Settings, get_settings
from nuzenio_api.database_security import engine_logging_options


def build_engine(database_url: str | None = None, *, settings: Settings | None = None) -> Engine:
    configured = settings or get_settings()
    return create_engine(
        database_url or configured.database_url,
        pool_pre_ping=True,
        **engine_logging_options(configured.environment, sql_echo=configured.sql_echo),
    )


engine = build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
