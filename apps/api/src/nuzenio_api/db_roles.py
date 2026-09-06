"""Privileged, explicit provisioning step. Never imported by runtime startup."""

import os
import re

from psycopg import sql
from sqlalchemy import create_engine, text

from nuzenio_api.environment import environment_from_os, is_production


def _validate_role(role: str, password: str) -> None:
    if not re.fullmatch(r"[a-z][a-z0-9_]{2,62}", role) or len(password) < 16:
        raise ValueError("Use a dedicated role and a 16+ character password")


def _ensure_login_role(connection, role: str, password: str) -> str:
    _validate_role(role, password)
    exists = connection.scalar(text("SELECT 1 FROM pg_roles WHERE rolname=:role"), {"role": role})
    command = sql.SQL(
        "{} ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD {}"
    ).format(sql.SQL("ALTER" if exists else "CREATE"), sql.Identifier(role), sql.Literal(password))
    connection.exec_driver_sql(command.as_string(connection.connection.driver_connection))
    return '"' + role + '"'


def provision_runtime(engine, role: str, password: str):
    _validate_role(role, password)
    with engine.begin() as connection:
        owner = connection.scalar(text("SELECT current_user"))
        if owner == role:
            raise ValueError("Migration owner and runtime role must be different")
        quoted = _ensure_login_role(connection, role, password)
        connection.exec_driver_sql("REVOKE CREATE ON SCHEMA public FROM PUBLIC")
        connection.exec_driver_sql(f"REVOKE ALL ON SCHEMA public FROM {quoted}")
        connection.exec_driver_sql(f"GRANT USAGE ON SCHEMA public TO {quoted}")
        connection.exec_driver_sql(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {quoted}")
        connection.exec_driver_sql(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {quoted}"
        )
        connection.exec_driver_sql(f"REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM {quoted}")
        connection.exec_driver_sql(
            f"REVOKE UPDATE, DELETE, TRUNCATE ON authentication_events FROM {quoted}"
        )
        connection.exec_driver_sql(
            f"REVOKE UPDATE, DELETE, TRUNCATE ON material_contributors FROM {quoted}"
        )
        connection.exec_driver_sql(
            f"REVOKE UPDATE, DELETE, TRUNCATE ON correction_contributors FROM {quoted}"
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


def provision_audit_reader(engine, role: str, password: str):
    """Provision a read-only identity for restricted audit search/export tooling."""

    _validate_role(role, password)
    with engine.begin() as connection:
        owner = connection.scalar(text("SELECT current_user"))
        if owner == role:
            raise ValueError("Migration owner and audit reader role must be different")
        quoted = _ensure_login_role(connection, role, password)
        connection.exec_driver_sql("REVOKE CREATE ON SCHEMA public FROM PUBLIC")
        connection.exec_driver_sql(f"REVOKE ALL ON SCHEMA public FROM {quoted}")
        connection.exec_driver_sql(f"GRANT USAGE ON SCHEMA public TO {quoted}")
        connection.exec_driver_sql(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {quoted}")
        connection.exec_driver_sql(f"GRANT SELECT ON audit_logs, authentication_events TO {quoted}")
        connection.exec_driver_sql(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {quoted}")
        owned = connection.scalar(
            text(
                "SELECT count(*) FROM pg_class WHERE relowner="
                "(SELECT oid FROM pg_roles WHERE rolname=:role)"
            ),
            {"role": role},
        )
        if owned:
            raise ValueError("Audit reader role must not own database objects")


def assert_runtime_identity(engine):
    with engine.connect() as connection:
        unsafe = connection.scalar(
            text("""SELECT rolsuper OR rolcreatedb OR rolcreaterole
          OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace
            AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
          OR has_schema_privilege(current_user,'public','CREATE')
          OR has_table_privilege(current_user,'audit_logs','UPDATE,DELETE,TRUNCATE')
          OR has_table_privilege(
            current_user,'authentication_events','UPDATE,DELETE,TRUNCATE')
          OR has_table_privilege(current_user,'material_contributors','UPDATE,DELETE,TRUNCATE')
          OR has_table_privilege(current_user,'correction_contributors','UPDATE,DELETE,TRUNCATE')
          OR EXISTS(SELECT 1 FROM pg_auth_members
            WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user))
          FROM pg_roles WHERE rolname=current_user""")
        )
        if unsafe:
            raise RuntimeError("Runtime identity must not own objects or hold elevated privileges")


def assert_audit_reader_identity(engine):
    with engine.connect() as connection:
        unsafe = connection.scalar(
            text("""SELECT rolsuper OR rolcreatedb OR rolcreaterole
          OR has_schema_privilege(current_user,'public','CREATE')
          OR has_table_privilege(current_user,'audit_logs','INSERT,UPDATE,DELETE,TRUNCATE')
          OR has_table_privilege(
            current_user,'authentication_events','INSERT,UPDATE,DELETE,TRUNCATE')
          OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace
            AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
          OR EXISTS(SELECT 1 FROM pg_auth_members
            WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user))
          FROM pg_roles WHERE rolname=current_user""")
        )
        can_read = connection.scalar(
            text(
                "SELECT has_table_privilege(current_user,'audit_logs','SELECT') "
                "AND has_table_privilege(current_user,'authentication_events','SELECT')"
            )
        )
        if unsafe or not can_read:
            raise RuntimeError("Audit identity must be read-only and limited to audit data")


def main():
    try:
        environment = environment_from_os()
    except ValueError as error:
        raise SystemExit(str(error)) from None
    migration_url = os.environ.get("NUZENIO_MIGRATION_DATABASE_URL")
    runtime_password = os.environ.get("NUZENIO_RUNTIME_PASSWORD", "")
    audit_password = os.environ.get("NUZENIO_AUDIT_PASSWORD", "")
    runtime_role = os.environ.get("NUZENIO_RUNTIME_ROLE", "nuzenio_runtime")
    audit_role = os.environ.get("NUZENIO_AUDIT_ROLE", "nuzenio_audit_reader")
    if runtime_role == audit_role:
        raise SystemExit("Runtime and audit-reader roles must be different")
    if is_production(environment):
        if not migration_url:
            raise SystemExit("NUZENIO_MIGRATION_DATABASE_URL is required for provisioning")
        if runtime_password == "local-runtime-only-password" or len(runtime_password) < 16:
            raise SystemExit("A unique production runtime password is required")
        if audit_password == "local-audit-only-password" or len(audit_password) < 16:
            raise SystemExit("A unique production audit-reader password is required")
    try:
        owner_url = migration_url or os.environ.get("NUZENIO_DATABASE_URL")
        if not owner_url:
            raise ValueError("A migration database URL is required")
        migration_engine = create_engine(owner_url, echo=False)
        provision_runtime(
            migration_engine,
            runtime_role,
            runtime_password,
        )
        provision_audit_reader(migration_engine, audit_role, audit_password)
    except Exception:
        # Do not render SQL or exception parameters: role DDL contains a credential.
        raise SystemExit(
            "Runtime-role provisioning failed; check privileged configuration."
        ) from None
    print("Dedicated runtime and read-only audit roles provisioned; DDL is denied.")


if __name__ == "__main__":
    main()
