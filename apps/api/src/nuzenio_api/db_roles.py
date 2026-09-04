"""Privileged, explicit provisioning step. Never imported by runtime startup."""

import os
import re

from psycopg import sql
from sqlalchemy import create_engine, text

from nuzenio_api.config import get_settings


def provision_runtime(engine, role: str, password: str):
    if not re.fullmatch(r"[a-z][a-z0-9_]{2,62}", role) or len(password) < 16:
        raise ValueError("Use a dedicated role and a 16+ character runtime password")
    with engine.begin() as connection:
        owner = connection.scalar(text("SELECT current_user"))
        if owner == role:
            raise ValueError("Migration owner and runtime role must be different")
        exists = connection.scalar(
            text("SELECT 1 FROM pg_roles WHERE rolname=:role"), {"role": role}
        )
        command = sql.SQL(
            "{} ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD {}"
        ).format(
            sql.SQL("ALTER" if exists else "CREATE"), sql.Identifier(role), sql.Literal(password)
        )
        connection.exec_driver_sql(command.as_string(connection.connection.driver_connection))
        quoted = '"' + role + '"'
        connection.exec_driver_sql("REVOKE CREATE ON SCHEMA public FROM PUBLIC")
        connection.exec_driver_sql(f"REVOKE ALL ON SCHEMA public FROM {quoted}")
        connection.exec_driver_sql(f"GRANT USAGE ON SCHEMA public TO {quoted}")
        connection.exec_driver_sql(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {quoted}")
        connection.exec_driver_sql(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {quoted}"
        )
        connection.exec_driver_sql(f"REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM {quoted}")
        connection.exec_driver_sql(
            f"REVOKE UPDATE, DELETE, TRUNCATE ON material_contributors FROM {quoted}"
        )
        connection.exec_driver_sql(f"REVOKE ALL ON alembic_version FROM {quoted}")
        connection.exec_driver_sql(
            f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {quoted}"
        )
        # No ownership, DDL, role membership, or TRUNCATE grants. Provision again after migrations.
        owned = connection.scalar(
            text(
                "SELECT count(*) FROM pg_class WHERE relowner="
                "(SELECT oid FROM pg_roles WHERE rolname=:role)"
            ),
            {"role": role},
        )
        if owned:
            raise ValueError(
                "Runtime role owns objects; transfer ownership through a reviewed migration"
            )


def assert_runtime_identity(engine):
    with engine.connect() as connection:
        unsafe = connection.scalar(
            text("""SELECT rolsuper OR rolcreatedb OR rolcreaterole
          OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace
            AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
          OR has_schema_privilege(current_user,'public','CREATE')
          OR has_table_privilege(current_user,'audit_logs','UPDATE,DELETE,TRUNCATE')
          OR EXISTS(SELECT 1 FROM pg_auth_members
            WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user))
          FROM pg_roles WHERE rolname=current_user""")
        )
        if unsafe:
            raise RuntimeError("Runtime identity must not own objects or hold elevated privileges")


def main():
    settings = get_settings()
    password = os.environ.get("NUZENIO_RUNTIME_PASSWORD", "")
    if settings.environment == "production" and password == "local-runtime-only-password":
        raise SystemExit("A unique production runtime password is required")
    try:
        provision_runtime(
            create_engine(settings.database_url, echo=False),
            os.environ.get("NUZENIO_RUNTIME_ROLE", "nuzenio_runtime"),
            password,
        )
    except Exception:
        # Do not render SQL or exception parameters: role DDL contains a credential.
        raise SystemExit(
            "Runtime-role provisioning failed; check privileged configuration."
        ) from None
    print("Dedicated runtime role provisioned; audit mutation and DDL are denied.")


if __name__ == "__main__":
    main()
