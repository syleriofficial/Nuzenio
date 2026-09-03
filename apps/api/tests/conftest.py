from __future__ import annotations

import os
import re
import uuid
from collections.abc import Generator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

API_ROOT = Path(__file__).resolve().parents[1]
TEST_DATABASE_URL = os.environ.get(
    "NUZENIO_TEST_DATABASE_URL",
    "postgresql+psycopg://nuzenio:nuzenio@localhost:5432/nuzenio_test",
)

# Application modules are imported during test collection, so select the disposable
# integration database before the global SQLAlchemy engine is constructed.
os.environ["NUZENIO_DATABASE_URL"] = TEST_DATABASE_URL


@pytest.fixture(autouse=True)
def isolated_login_buckets(monkeypatch):
    from nuzenio_api.config import get_settings

    monkeypatch.setattr(get_settings(), "login_key_prefix", f"nuzenio:test:auth:{uuid.uuid4()}")


@pytest.fixture(scope="session", autouse=True)
def migrated_database() -> Generator[None, None, None]:
    target_url = make_url(TEST_DATABASE_URL)
    database_name = target_url.database or ""
    if not re.fullmatch(r"[a-zA-Z0-9_]+", database_name) or "test" not in database_name.lower():
        raise RuntimeError(
            "NUZENIO_TEST_DATABASE_URL must use a simple database name containing 'test'"
        )

    admin_engine = create_engine(
        target_url.set(database="postgres").render_as_string(hide_password=False),
        isolation_level="AUTOCOMMIT",
    )
    with admin_engine.connect() as connection:
        connection.execute(text(f'DROP DATABASE IF EXISTS "{database_name}" WITH (FORCE)'))
        connection.execute(text(f'CREATE DATABASE "{database_name}"'))

    config = Config(str(API_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(API_ROOT / "migrations"))
    command.upgrade(config, "head")

    from nuzenio_api.db import SessionLocal
    from nuzenio_api.seed import seed_database

    seed_database(SessionLocal)
    yield

    from nuzenio_api.db import engine

    engine.dispose()
    with admin_engine.connect() as connection:
        connection.execute(text(f'DROP DATABASE IF EXISTS "{database_name}" WITH (FORCE)'))
    admin_engine.dispose()
