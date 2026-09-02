from __future__ import annotations

import os
import re
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url

DEFAULT_E2E_DATABASE_URL = "postgresql+psycopg://nuzenio:nuzenio@localhost:5432/nuzenio_e2e"
E2E_PASSWORD = "Local-E2E-Staff-Password-42!"


def main() -> None:
    if os.environ.get("NUZENIO_ENVIRONMENT") != "test":
        raise SystemExit("Refusing to create E2E fixtures unless NUZENIO_ENVIRONMENT=test.")
    database_url = os.environ.get("NUZENIO_DATABASE_URL", DEFAULT_E2E_DATABASE_URL)
    target = make_url(database_url)
    database_name = target.database or ""
    if not re.fullmatch(r"[A-Za-z0-9_]+", database_name) or "e2e" not in database_name:
        raise SystemExit("E2E database name must be simple and contain 'e2e'.")
    admin_engine = create_engine(
        target.set(database="postgres").render_as_string(hide_password=False),
        isolation_level="AUTOCOMMIT",
    )
    with admin_engine.connect() as connection:
        connection.execute(text(f'DROP DATABASE IF EXISTS "{database_name}" WITH (FORCE)'))
        connection.execute(text(f'CREATE DATABASE "{database_name}"'))
    admin_engine.dispose()

    api_root = Path(__file__).resolve().parents[2]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "migrations"))
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")

    # Import only after the test database URL is established.
    from nuzenio_api.auth import create_staff_user
    from nuzenio_api.db import SessionLocal
    from nuzenio_api.models import StaffRole, StaffUser
    from nuzenio_api.seed import seed_database

    seed_database(SessionLocal)
    accounts = {
        "e2e-admin": StaffRole.ADMINISTRATOR,
        "e2e-editor": StaffRole.EDITOR,
        "e2e-reviewer": StaffRole.REVIEWER,
        "e2e-reviewer-two": StaffRole.REVIEWER,
        "e2e-publisher-manager": StaffRole.PUBLISHER_MANAGER,
        "e2e-analyst": StaffRole.ANALYST,
    }
    with SessionLocal.begin() as session:
        for username, role in accounts.items():
            if session.scalar(select(StaffUser.id).where(StaffUser.username == username)):
                continue
            create_staff_user(
                session,
                username=username,
                display_name=username.replace("e2e-", "").replace("-", " ").title(),
                password=E2E_PASSWORD,
                role=role,
            )
    print(f"Prepared disposable E2E database {database_name} with test-only staff fixtures.")


if __name__ == "__main__":
    main()
