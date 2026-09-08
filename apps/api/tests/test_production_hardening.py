from __future__ import annotations

import io
import json
import logging
import os
import secrets
import subprocess
import sys
import threading
import time
import traceback
import urllib.error
import urllib.request
import uuid
from contextlib import redirect_stderr, redirect_stdout
from urllib.parse import quote

import pytest
import redis
from fastapi import FastAPI
from fastapi.testclient import TestClient
from psycopg import sql
from pydantic import SecretStr, ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import sessionmaker

from nuzenio_api.config import Settings, get_settings
from nuzenio_api.database_security import DetachedDatabaseError, engine_logging_options
from nuzenio_api.db import engine
from nuzenio_api.db_roles import (
    _ensure_login_role,
    assert_audit_reader_identity,
    provision_audit_reader,
)
from nuzenio_api.environment import Environment, environment_from_os, is_production
from nuzenio_api.errors import register_error_handlers
from nuzenio_api.main import app
from nuzenio_api.observability import JsonLogFormatter, configure_logging, sanitize_log_message
from nuzenio_api.worker_health import WorkerRunOutcome, WorkerStatus, start_worker_health_server


def production_settings(**overrides) -> Settings:
    values = {
        "environment": "production",
        "demo_mode": False,
        "cookie_secure": True,
        "session_hash_pepper": "a-unique-production-pepper-over-32-characters",
        "cors_origins": ["https://news.example"],
        "allowed_hosts": ["news.example"],
        "feed_https_required": True,
        "feed_kill_switch": True,
        "metrics_token": "a-unique-metrics-token-over-32-characters",
        "database_url": (
            "postgresql+psycopg://nuzenio_runtime:a-long-runtime-password@postgres.example/nuzenio"
        ),
        "redis_url": "rediss://:a-long-redis-password@redis.example/0",
        "_env_file": None,
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.parametrize(
    "override",
    [
        {"feed_kill_switch": False},
        {"metrics_token": "short"},
        {"allowed_hosts": ["*"]},
        {"allowed_hosts": ["localhost"]},
        {"cors_origins": ["https://news.example/path"]},
        {"cors_origins": ["https://*.example"]},
        {"trusted_proxy_cidrs": ["0.0.0.0/0"]},
        {"database_url": "postgresql+psycopg://owner:long-password-value@db/nuzenio"},
        {"redis_url": "redis://:a-long-redis-password@redis.example/0"},
    ],
)
def test_production_configuration_rejects_unsafe_boundaries(override) -> None:
    with pytest.raises(ValidationError):
        production_settings(**override)


@pytest.mark.parametrize("value", [True, "true", "TRUE", "1", "yes", "on"])
def test_production_configuration_rejects_every_truthy_sql_echo_variant(value) -> None:
    with pytest.raises(ValidationError, match="NUZENIO_SQL_ECHO"):
        production_settings(sql_echo=value)


@pytest.mark.parametrize("value", [False, "false", "FALSE", "0", "no", "off"])
def test_production_configuration_accepts_every_false_sql_echo_variant(value) -> None:
    assert production_settings(sql_echo=value).sql_echo is False


def test_production_engine_never_logs_bound_parameters() -> None:
    from nuzenio_api import db

    select_canary = "private-select-canary-c83ad5"
    insert_canary = "private-insert-canary-f92e17"
    update_canary = "private-update-canary-a319df"
    failure_canary = "private-failure-canary-b673e4"
    # model_copy deliberately bypasses Pydantic validation to prove that engine
    # construction independently enforces the production invariant.
    settings = production_settings().model_copy(update={"sql_echo": True, "log_level": "DEBUG"})

    stdout = io.StringIO()
    stderr = io.StringIO()
    external_sqlalchemy = io.StringIO()
    stale_echo_output = io.StringIO()
    unrelated_root_output = io.StringIO()
    root = logging.getLogger()
    sqlalchemy_logger = logging.getLogger("sqlalchemy.engine")
    sqlalchemy_engine_logger = logging.getLogger("sqlalchemy.engine.Engine")
    previous_root_handlers = root.handlers[:]
    previous_root_level = root.level
    previous_handlers = sqlalchemy_logger.handlers[:]
    previous_level = sqlalchemy_logger.level
    previous_propagate = sqlalchemy_logger.propagate
    previous_engine_handlers = sqlalchemy_engine_logger.handlers[:]
    previous_engine_level = sqlalchemy_engine_logger.level
    previous_engine_propagate = sqlalchemy_engine_logger.propagate
    secured_engine = None
    unrelated_preserved = False
    try:
        unrelated_handler = logging.StreamHandler(unrelated_root_output)
        root.addHandler(unrelated_handler)
        sqlalchemy_engine_logger.addHandler(logging.StreamHandler(stale_echo_output))
        with redirect_stdout(stdout), redirect_stderr(stderr):
            configure_logging("sql-logging-regression", settings)
            configure_logging("sql-logging-regression", settings)
            unrelated_preserved = unrelated_handler in root.handlers
            assert sqlalchemy_engine_logger.handlers == []
            external_handler = logging.StreamHandler(external_sqlalchemy)
            external_handler.setFormatter(logging.Formatter("%(name)s %(levelname)s %(message)s"))
            sqlalchemy_logger.addHandler(external_handler)
            sqlalchemy_logger.setLevel(logging.DEBUG)
            sqlalchemy_logger.propagate = True

            secured_engine = db.build_engine(os.environ["NUZENIO_DATABASE_URL"], settings=settings)
            # Even post-construction logger changes cannot route DEBUG result rows.
            sqlalchemy_engine_logger.setLevel(logging.DEBUG)
            sqlalchemy_engine_logger.addHandler(external_handler)
            assert secured_engine.echo is False
            assert secured_engine.hide_parameters is True
            assert secured_engine.pool._echo is False
            with secured_engine.begin() as connection:
                connection.execute(
                    text(
                        "CREATE TEMPORARY TABLE nuzenio_sql_logging_probe "
                        "(value text) ON COMMIT DROP"
                    )
                )
                connection.execute(
                    text("INSERT INTO nuzenio_sql_logging_probe (value) VALUES (:value)"),
                    {"value": insert_canary},
                )
                connection.execute(
                    text("UPDATE nuzenio_sql_logging_probe SET value=:value"),
                    {"value": update_canary},
                )
                assert (
                    connection.scalar(text("SELECT :value"), {"value": select_canary})
                    == select_canary
                )
                connection.execute(text("CREATE UNIQUE INDEX ON nuzenio_sql_logging_probe(value)"))
                connection.execute(
                    text("INSERT INTO nuzenio_sql_logging_probe (value) VALUES (:value)"),
                    {"value": failure_canary},
                )
                with pytest.raises(DetachedDatabaseError) as caught:
                    connection.execute(
                        text("INSERT INTO nuzenio_sql_logging_probe (value) VALUES (:value)"),
                        {"value": failure_canary},
                    )
                assert failure_canary not in str(caught.value)
                assert failure_canary not in "".join(traceback.format_exception(caught.value))
    finally:
        if secured_engine is not None:
            secured_engine.dispose()
        root.handlers = previous_root_handlers
        root.setLevel(previous_root_level)
        sqlalchemy_logger.handlers = previous_handlers
        sqlalchemy_logger.setLevel(previous_level)
        sqlalchemy_logger.propagate = previous_propagate
        sqlalchemy_engine_logger.handlers = previous_engine_handlers
        sqlalchemy_engine_logger.setLevel(previous_engine_level)
        sqlalchemy_engine_logger.propagate = previous_engine_propagate

    complete_output = (
        stdout.getvalue()
        + stderr.getvalue()
        + external_sqlalchemy.getvalue()
        + unrelated_root_output.getvalue()
    )
    assert stale_echo_output.getvalue() == ""
    assert select_canary not in complete_output
    assert insert_canary not in complete_output
    assert update_canary not in complete_output
    assert failure_canary not in complete_output
    assert "SELECT" in complete_output
    assert "INSERT" in complete_output
    assert "SQL parameters hidden due to hide_parameters=True" in complete_output
    json_lines = [line for line in stdout.getvalue().splitlines() if line]
    assert json_lines
    assert all(json.loads(line)["service"] == "sql-logging-regression" for line in json_lines)
    assert unrelated_preserved


def _render_reachable_exception_graph(error: BaseException) -> str:
    """Render every outward diagnostic edge without traversing traceback frame locals."""

    pending: list[object] = [error]
    seen: set[int] = set()
    rendered = ["".join(traceback.format_exception(error))]
    while pending:
        current = pending.pop()
        if id(current) in seen:
            continue
        seen.add(id(current))
        for renderer in (str, repr):
            try:
                rendered.append(renderer(current))
            except Exception as rendering_error:  # pragma: no cover - adversarial helper
                rendered.append(type(rendering_error).__name__)
        if isinstance(current, dict):
            pending.extend(current.keys())
            pending.extend(current.values())
            continue
        if isinstance(current, (list, tuple, set, frozenset)):
            pending.extend(current)
            continue
        for attribute in (
            "__cause__",
            "__context__",
            "orig",
            "diag",
            "args",
            "statement",
            "params",
            "exceptions",
        ):
            try:
                value = getattr(current, attribute, None)
            except Exception as diagnostic_error:  # pragma: no cover - defensive helper
                rendered.append(type(diagnostic_error).__name__)
                continue
            if value is not None:
                pending.append(value)
        if type(current).__name__.endswith("Diagnostic") or current is getattr(error, "diag", None):
            for attribute in dir(current):
                if attribute.startswith("_"):
                    continue
                try:
                    value = getattr(current, attribute)
                except Exception:
                    continue
                if not callable(value) and value is not None:
                    pending.append(value)
    return "\n".join(rendered)


def test_production_database_errors_are_detached_after_rollback() -> None:
    from nuzenio_api import db

    settings = production_settings().model_copy(update={"log_level": "DEBUG"})
    secured_engine = db.build_engine(os.environ["NUZENIO_DATABASE_URL"], settings=settings)
    table_suffix = secrets.token_hex(5)
    parent_table = f"detached_parent_{table_suffix}"
    child_table = f"detached_child_{table_suffix}"
    canaries = {
        "integer": f"invalid-integer-{secrets.token_hex(6)}",
        "date": f"invalid-date-{secrets.token_hex(6)}",
        "uuid": f"invalid-uuid-{secrets.token_hex(6)}",
        "unique": f"unique-नाम-{secrets.token_hex(6)}",
        "foreign_key": f"foreign-key-{secrets.token_hex(6)}",
        "check": f"check-value-that-is-too-long-{secrets.token_hex(6)}",
        "update": f"update-value-that-is-too-long-{secrets.token_hex(6)}",
    }
    try:
        with secured_engine.begin() as connection:
            connection.exec_driver_sql(f"CREATE TABLE {parent_table} (id text PRIMARY KEY)")
            connection.exec_driver_sql(
                f"CREATE TABLE {child_table} ("
                "id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, "
                "unique_value text UNIQUE NOT NULL, "
                f"parent_id text REFERENCES {parent_table}(id), "
                "checked_value text CHECK (length(checked_value) < 10))"
            )
            connection.execute(
                text(
                    f"INSERT INTO {child_table} "
                    "(unique_value, checked_value) VALUES (:unique_value, 'safe')"
                ),
                {"unique_value": canaries["unique"]},
            )

        failures = [
            ("SELECT CAST(:value AS integer)", canaries["integer"], "22P02"),
            ("SELECT CAST(:value AS date)", canaries["date"], "22007"),
            ("SELECT CAST(:value AS uuid)", canaries["uuid"], "22P02"),
            (
                f"INSERT INTO {child_table} (unique_value, checked_value) VALUES (:value, 'safe')",
                canaries["unique"],
                "23505",
            ),
            (
                f"INSERT INTO {child_table} (unique_value, parent_id, checked_value) "
                "VALUES ('fresh-foreign-key', :value, 'safe')",
                canaries["foreign_key"],
                "23503",
            ),
            (
                f"INSERT INTO {child_table} (unique_value, checked_value) "
                "VALUES ('fresh-check', :value)",
                canaries["check"],
                "23514",
            ),
            (
                f"UPDATE {child_table} SET checked_value=:value WHERE unique_value=:unique_value",
                canaries["update"],
                "23514",
            ),
        ]
        for statement, canary, expected_sqlstate in failures:
            parameters = {"value": canary, "unique_value": canaries["unique"]}
            with (
                pytest.raises(DetachedDatabaseError) as caught,
                secured_engine.begin() as connection,
            ):
                connection.execute(text(statement), parameters)
            outward = caught.value
            assert outward.__cause__ is None
            assert outward.__context__ is None
            assert not hasattr(outward, "orig")
            assert not hasattr(outward, "diag")
            assert not hasattr(outward, "statement")
            assert not hasattr(outward, "params")
            assert outward.sqlstate == expected_sqlstate
            assert canary not in _render_reachable_exception_graph(outward)
            with secured_engine.connect() as recovered:
                assert recovered.scalar(text("SELECT 1")) == 1

        session_factory = sessionmaker(bind=secured_engine)
        with session_factory() as session:
            with pytest.raises(DetachedDatabaseError) as caught:
                session.execute(
                    text("SELECT CAST(:value AS integer)"), {"value": canaries["integer"]}
                )
            session.rollback()
            assert session.scalar(text("SELECT 1")) == 1
            assert canaries["integer"] not in _render_reachable_exception_graph(caught.value)
    finally:
        with secured_engine.begin() as connection:
            connection.exec_driver_sql(f"DROP TABLE IF EXISTS {child_table}")
            connection.exec_driver_sql(f"DROP TABLE IF EXISTS {parent_table}")
        secured_engine.dispose()


def test_production_connection_failure_does_not_retain_url_password() -> None:
    from nuzenio_api import db

    credential_canary = f"connection-password-{secrets.token_hex(8)}"
    invalid_url = make_url(os.environ["NUZENIO_DATABASE_URL"]).set(password=credential_canary)
    secured_engine = db.build_engine(
        invalid_url.render_as_string(hide_password=False),
        settings=production_settings(),
    )
    try:
        with pytest.raises(DetachedDatabaseError) as caught, secured_engine.connect():
            pass
        outward = caught.value
        assert outward.__cause__ is None
        assert outward.__context__ is None
        assert credential_canary not in _render_reachable_exception_graph(outward)
        assert credential_canary not in repr(secured_engine)
    finally:
        secured_engine.dispose()


def test_detached_database_error_preserves_generic_http_contract() -> None:
    test_app = FastAPI()
    register_error_handlers(test_app)

    @test_app.get("/database-failure")
    def database_failure() -> None:
        raise DetachedDatabaseError(
            category="IntegrityError",
            sqlstate="23505",
            connection_invalidated=False,
        )

    response = TestClient(test_app, raise_server_exceptions=False).get("/database-failure")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "database_unavailable"
    assert "IntegrityError" not in response.text
    assert "23505" not in response.text
    assert response.headers["Cache-Control"] == "private, no-store"


def test_engine_logging_policy_reparses_environment_at_its_boundary() -> None:
    assert engine_logging_options("production", sql_echo=True) == {
        "echo": False,
        "echo_pool": False,
        "hide_parameters": True,
    }
    for malformed in (None, "", "Production", "PRODUCTION", " production", "production "):
        with pytest.raises(ValueError):
            engine_logging_options(malformed, sql_echo=True)  # type: ignore[arg-type]


def test_role_password_ddl_bypasses_sqlalchemy_logging() -> None:
    from nuzenio_api import db

    role = f"logging_probe_{secrets.token_hex(5)}"
    password_canary = f"role-password-canary-नाम-'\\-{secrets.token_hex(6)}"
    failed_password_canary = f"failed-role-canary-{secrets.token_hex(6)}"
    settings = production_settings().model_copy(update={"log_level": "DEBUG"})
    stdout = io.StringIO()
    stderr = io.StringIO()
    external_output = io.StringIO()
    root = logging.getLogger()
    sqlalchemy_loggers = [
        logging.getLogger(name)
        for name in (
            "sqlalchemy",
            "sqlalchemy.engine",
            "sqlalchemy.engine.Engine",
            "sqlalchemy.pool",
        )
    ]
    previous_root_handlers = root.handlers[:]
    previous_root_level = root.level
    previous_state = [
        (logger, logger.handlers[:], logger.level, logger.propagate)
        for logger in sqlalchemy_loggers
    ]
    secured_engine = None
    credential_engine = None
    credential_engine_repr = ""
    try:
        with redirect_stdout(stdout), redirect_stderr(stderr):
            configure_logging("role-password-regression", settings)
            for logger in sqlalchemy_loggers:
                logger.setLevel(logging.DEBUG)
                logger.addHandler(logging.StreamHandler(external_output))
            secured_engine = db.build_engine(os.environ["NUZENIO_DATABASE_URL"], settings=settings)
            for logger in sqlalchemy_loggers:
                logger.setLevel(logging.DEBUG)
                logger.addHandler(logging.StreamHandler(external_output))
            with secured_engine.begin() as connection:
                _ensure_login_role(connection, role, password_canary)
            role_url = make_url(os.environ["NUZENIO_DATABASE_URL"]).set(
                username=role,
                password=password_canary,
            )
            credential_engine = db.build_engine(
                role_url.render_as_string(hide_password=False),
                settings=settings,
            )
            credential_engine_repr = repr(credential_engine)
            with credential_engine.connect() as connection:
                assert connection.scalar(text("SELECT :value"), {"value": "safe"}) == "safe"
            with pytest.raises(RuntimeError) as caught, secured_engine.begin() as connection:
                _ensure_login_role(connection, f"failed_{role}", failed_password_canary + "\0")
            assert caught.value.__cause__ is None
            assert caught.value.__context__ is None
            assert failed_password_canary not in _render_reachable_exception_graph(caught.value)
            with secured_engine.connect() as connection:
                assert connection.scalar(text("SELECT 1")) == 1
                assert (
                    connection.scalar(
                        text("SELECT count(*) FROM pg_roles WHERE rolname=:role"),
                        {"role": f"failed_{role}"},
                    )
                    == 0
                )
    finally:
        if credential_engine is not None:
            credential_engine.dispose()
        if secured_engine is not None:
            try:
                with (
                    secured_engine.begin() as connection,
                    connection.connection.driver_connection.cursor() as cursor,
                ):
                    cursor.execute(sql.SQL("DROP ROLE IF EXISTS {}").format(sql.Identifier(role)))
            finally:
                secured_engine.dispose()
        root.handlers = previous_root_handlers
        root.setLevel(previous_root_level)
        for logger, handlers, level, propagate in previous_state:
            logger.handlers = handlers
            logger.setLevel(level)
            logger.propagate = propagate

    complete_output = stdout.getvalue() + stderr.getvalue() + external_output.getvalue()
    assert password_canary not in complete_output
    assert password_canary not in credential_engine_repr
    assert failed_password_canary not in complete_output
    assert "CREATE ROLE" not in complete_output


def test_development_sql_echo_remains_explicitly_configurable() -> None:
    from nuzenio_api import db

    settings = Settings(environment="development", sql_echo=True, _env_file=None)
    output = io.StringIO()
    with redirect_stdout(output):
        development_engine = db.build_engine("sqlite+pysqlite:///:memory:", settings=settings)
        with development_engine.connect() as connection:
            assert connection.scalar(text("SELECT 1")) == 1
    try:
        assert development_engine.echo is True
        assert development_engine.hide_parameters is False
        assert development_engine.pool._echo is False
        assert "SELECT 1" in output.getvalue()
    finally:
        development_engine.dispose()


@pytest.mark.parametrize(
    "value",
    ["Production", "PRODUCTION", " production", "production ", "", "staging-typo"],
)
def test_environment_classifier_rejects_every_noncanonical_value(value) -> None:
    with pytest.raises(ValidationError):
        Settings(environment=value, _env_file=None)


def test_canonical_production_environment_uses_shared_predicate() -> None:
    settings = production_settings()
    assert settings.environment is Environment.PRODUCTION
    assert is_production(settings.environment)
    assert settings.allowed_hosts == ["news.example"]


@pytest.mark.parametrize("value", ["Production", " production", "production ", "staging-typo"])
def test_malformed_environment_cannot_enable_development_protections(value) -> None:
    with pytest.raises(ValidationError):
        production_settings(
            environment=value,
            demo_mode=True,
            cookie_secure=False,
            session_hash_pepper="development-only-change-me",
            cors_origins=["http://localhost:3000"],
            allowed_hosts=["localhost"],
            feed_kill_switch=False,
            database_url="sqlite:///demo.db",
            redis_url="redis://localhost:6379/0",
        )


@pytest.mark.parametrize(
    "host",
    [
        "*",
        "*.example.com",
        ".example.com",
        "LOCALHOST",
        "localhost.",
        "[::1]",
        "::1",
        "127.0.0.1",
        "127.1",
        "0.0.0.0",
        "10.0.0.1",
        "169.254.169.254",
        "news.example:443",
        "https://news.example",
        "user@news.example",
        "news.example/path",
        " news.example",
        "news.example ",
        "news。example",
        "xn--a.example",
        "xn--.example",
        "api.localhost",
        "api.local",
        "router.home.arpa",
    ],
)
def test_production_allowed_hosts_are_canonical_explicit_dns_names(host) -> None:
    with pytest.raises(ValidationError):
        production_settings(allowed_hosts=[host])


def test_environment_from_os_uses_the_same_strict_parser(monkeypatch) -> None:
    monkeypatch.setenv("NUZENIO_ENVIRONMENT", "test")
    assert environment_from_os() is Environment.TEST
    monkeypatch.setenv("NUZENIO_ENVIRONMENT", "Production")
    with pytest.raises(ValueError):
        environment_from_os()


def test_settings_requires_an_explicit_environment(monkeypatch) -> None:
    monkeypatch.delenv("NUZENIO_ENVIRONMENT", raising=False)
    with pytest.raises(ValidationError, match="environment"):
        Settings(_env_file=None)


@pytest.mark.parametrize(
    "command",
    [
        [sys.executable, "-c", "import nuzenio_api.main"],
        [sys.executable, "-m", "nuzenio_api.feed_operations"],
        [sys.executable, "-m", "nuzenio_api.seed", "--dry-run"],
        [
            sys.executable,
            "-m",
            "nuzenio_api.staff",
            "create",
            "--username",
            "fixture",
            "--display-name",
            "Fixture",
            "--role",
            "EDITOR",
        ],
        [sys.executable, "-m", "nuzenio_api.db_roles"],
        [sys.executable, "-m", "nuzenio_api.e2e_setup"],
    ],
)
def test_every_environment_gated_entry_point_rejects_malformed_production(command) -> None:
    environment = {**os.environ, "NUZENIO_ENVIRONMENT": "Production"}
    result = subprocess.run(command, env=environment, capture_output=True, text=True, timeout=5)
    assert result.returncode != 0
    assert "Environment must be one of" in result.stderr


@pytest.mark.parametrize(
    "command",
    [
        [sys.executable, "-c", "import nuzenio_api.main"],
        [sys.executable, "-m", "nuzenio_api.feed_operations"],
        [sys.executable, "-m", "nuzenio_api.seed", "--dry-run"],
        [
            sys.executable,
            "-m",
            "nuzenio_api.staff",
            "create",
            "--username",
            "fixture",
            "--display-name",
            "Fixture",
            "--role",
            "EDITOR",
        ],
        [sys.executable, "-m", "nuzenio_api.db_roles"],
        [sys.executable, "-m", "nuzenio_api.e2e_setup"],
    ],
)
def test_every_environment_gated_entry_point_rejects_missing_environment(command, tmp_path) -> None:
    environment = {key: value for key, value in os.environ.items() if key != "NUZENIO_ENVIRONMENT"}
    result = subprocess.run(
        command,
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        timeout=5,
    )
    assert result.returncode != 0
    assert "environment" in result.stderr.casefold()


def test_json_logs_include_correlation_fields_and_redact_secrets() -> None:
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonLogFormatter("test-service"))
    logger = logging.getLogger("nuzenio-test-json")
    logger.handlers = [handler]
    logger.propagate = False
    logger.setLevel(logging.INFO)

    logger.info(
        "request_complete",
        extra={
            "event": "request_complete",
            "correlation_id": "request-123",
            "fields": {"route": "/health", "session_token": "must-not-appear"},
        },
    )

    payload = json.loads(stream.getvalue())
    assert payload["event"] == "request_complete"
    assert payload["correlation_id"] == "request-123"
    assert payload["route"] == "/health"
    assert payload["session_token"] == "[REDACTED]"
    assert "must-not-appear" not in stream.getvalue()


@pytest.mark.parametrize(
    "message",
    [
        "postgresql://operator:unique-marker@database.example/nuzenio",
        "redis://:unique-marker@redis.example/0",
        "Authorization: Bearer unique-marker",
        "bearer%20unique-marker",
        "Cookie: session=unique-marker; theme=dark",
        "Set-Cookie=csrf=unique-marker",
        "PASSWORD=unique-marker",
        "ToKeN: unique-marker",
        "csrf%3Dunique-marker",
        "POSTGRESQL%3A%2F%2Foperator%3Aunique-marker%40database.example%2Fnuzenio",
        "redis%3a%2f%2f%3aunique-marker%40redis.example%2f0",
        "postgresql://operator%3Aunique-marker%40database.example/nuzenio",
        "postgresql%3A//operator:unique-marker@database.example/nuzenio",
        "postgresql://operator:unique-marker\n@database.example/nuzenio",
        "Authorization%3A%20Bearer%20unique-marker",
        "Authorization%3A%09Bearer%09unique-marker",
        "postgresql://operator:unique-marker%2Fpart%40database.example/nuzenio",
        "postgresql%253A%252F%252Foperator%253Aunique-marker%2540database.example%252Fnuzenio",
        "ReDiS%253a%252f%252f%253aunique-marker%2540redis.example%252f0",
        "Authorization%253A%2520Bearer%2520unique-marker",
        "Cookie%253A%2520session%253Dunique-marker%253B%2520theme%253Ddark",
        "PASSWORD%253Dunique-marker",
        "csrf%253dunique-marker",
        "diagnostic%253Dfailed%250APaSsWoRd%253Dunique-marker",
    ],
)
def test_free_form_and_nested_log_values_redact_common_secret_forms(message) -> None:
    formatter = JsonLogFormatter("test-service")
    record = logging.LogRecord("third-party", logging.ERROR, __file__, 1, message, (), None)
    record.fields = {
        "diagnostic": {"nested": [message]},
        "exception": RuntimeError(message),
    }
    output = formatter.format(record)
    assert "unique-marker" not in output


@pytest.mark.parametrize(
    "key",
    [
        "db_password",
        "database.password",
        "database-password",
        "api_token",
        "api.token",
        "api-token",
        "client_secret",
        "client.secret",
        "client-secret",
        "session_hash_pepper",
        "NUZENIO_SESSION_HASH_PEPPER",
        "session.hash.pepper",
        "session-hash-pepper",
        "csrf_token",
        "csrf.token",
        "csrf-token",
        "access_token",
        "access.token",
        "access-token",
        "refresh_token",
        "refresh.token",
        "refresh-token",
        "api_key",
        "api.key",
        "api-key",
        "signing_secret",
        "signing.secret",
        "signing-secret",
    ],
)
def test_qualified_sensitive_assignments_are_redacted_from_complete_json(key) -> None:
    canary = "qualified-canary-8c92e1"
    raw_messages = [
        f"{key}={canary}",
        f"{key.swapcase()}: {canary}",
        f'{key}="{canary}"',
        f"{key}='{canary}'",
        f'"{key}":"{canary}"',
        f"'{key}': '{canary}'",
        f"diagnostic failed\n{key}={canary}\nretrying",
        f'{key}={canary}\n{{"event":"forged"}}',
        f"{'x' * 8_039} {key}={canary}{'v' * 9_000}",
    ]
    messages = [
        message
        for raw in raw_messages
        for message in (raw, quote(raw, safe=""), quote(quote(raw, safe=""), safe=""))
    ]
    formatter = JsonLogFormatter("qualified-assignment-regression")
    for message in messages:
        record = logging.LogRecord("third-party", logging.ERROR, __file__, 1, message, (), None)
        record.fields = {"nested": {"diagnostic": [message]}}
        output = formatter.format(record)
        assert canary not in output
        assert len(json.loads(output)["event"]) <= 8_192

    oversized = f"{key}={canary}{'v' * 1_000_000}"
    output = formatter.format(
        logging.LogRecord("third-party", logging.ERROR, __file__, 1, oversized, (), None)
    )
    assert canary not in output
    assert len(json.loads(output)["event"]) <= 8_192

    structured_record = logging.LogRecord(
        "third-party", logging.ERROR, __file__, 1, "structured diagnostic", (), None
    )
    structured_record.fields = {key: canary}
    structured_output = formatter.format(structured_record)
    assert canary not in structured_output
    assert json.loads(structured_output)[key] == "[REDACTED]"


@pytest.mark.parametrize(
    "message",
    [
        r"{\"db_password\":\"escaped-canary-27e91a\"}",
        r"{\"api.token\": \"escaped-canary-27e91a\"}",
        r"{\"client-secret\":\"escaped-canary-27e91a\"}",
        r"{\"session_hash_pepper\":\"escaped-canary-27e91a\"}",
        "db_password: |\n  escaped-canary-27e91a\n  continuation",
        "API.Token: >\n  escaped-canary-27e91a\n  continuation",
        "client-secret: |2-\n    escaped-canary-27e91a",
        f"{'x' * 8_050} db_password: |\n  escaped-canary-27e91a",
    ],
)
def test_escaped_and_block_style_sensitive_assignments_are_redacted(message) -> None:
    formatter = JsonLogFormatter("escaped-assignment-regression")
    variants = [message, quote(message, safe=""), quote(quote(message, safe=""), safe="")]
    for variant in variants:
        record = logging.LogRecord("third-party", logging.ERROR, __file__, 1, variant, (), None)
        record.fields = {"nested": [variant, RuntimeError(variant)]}
        output = formatter.format(record)
        assert "escaped-canary-27e91a" not in output
        assert len(json.loads(output)["event"]) <= 8_192


def test_sensitive_assignment_scanner_has_bounded_near_linear_scaling() -> None:
    measurements: list[tuple[int, float]] = []
    for size in (1, 2, 4, 8, 12, 16):
        target = size * 1_024
        payload = ("scope." * (target // len("scope."))) + "passwordless=safe"
        samples: list[float] = []
        for _ in range(3):
            started = time.perf_counter()
            assert sanitize_log_message(payload).endswith("...[TRUNCATED]") or size < 8
            samples.append(time.perf_counter() - started)
        measurements.append((size, min(samples)))

    smallest = measurements[0][1]
    largest = measurements[-1][1]
    # The previous backtracking expression took multiple seconds for 16 KiB.
    # This generous ceiling tolerates shared CI hosts while detecting that class
    # of regression, and the ratio bound checks that doubling input is not quadratic.
    assert largest < 0.75
    assert largest <= max(smallest * 30, 0.25)


@pytest.mark.parametrize(
    "message",
    [
        "The secretary prepared the briefing",
        "tokenizer=sentencepiece",
        "passwordless:true",
        "The passwordless tokenizer assisted the secretary",
    ],
)
def test_log_sanitizer_preserves_non_sensitive_fragment_words(message) -> None:
    assert sanitize_log_message(message) == message

    record = logging.LogRecord("fixture", logging.INFO, __file__, 1, "safe fields", (), None)
    record.fields = {message: "safe-value"}
    payload = json.loads(JsonLogFormatter("test-service").format(record))
    assert payload[message] == "safe-value"


def test_logging_initialization_is_owned_idempotent_and_preserves_root_telemetry() -> None:
    settings = production_settings(log_level="DEBUG")
    root = logging.getLogger()
    sqlalchemy_loggers = [
        logging.getLogger(name)
        for name in (
            "sqlalchemy",
            "sqlalchemy.engine",
            "sqlalchemy.engine.Engine",
            "sqlalchemy.pool",
        )
    ]
    previous_root_handlers = root.handlers[:]
    previous_root_level = root.level
    previous_state = [
        (logger, logger.handlers[:], logger.filters[:], logger.level, logger.propagate)
        for logger in sqlalchemy_loggers
    ]
    telemetry_output = io.StringIO()
    telemetry_handler = logging.StreamHandler(telemetry_output)
    unsafe_output = io.StringIO()
    unsafe_handler = logging.StreamHandler(unsafe_output)
    json_output = io.StringIO()
    try:
        root.addHandler(telemetry_handler)
        for logger in sqlalchemy_loggers:
            logger.addHandler(unsafe_handler)
            logger.setLevel(logging.DEBUG)
        with redirect_stdout(json_output):
            configure_logging("ownership-regression", settings)
            configure_logging("ownership-regression", settings)
            logging.getLogger("nuzenio.ownership").info("safe ownership diagnostic")

        assert telemetry_handler in root.handlers
        assert (
            sum(getattr(handler, "_nuzenio_owned_handler", False) for handler in root.handlers) == 1
        )
        assert all(unsafe_handler not in logger.handlers for logger in sqlalchemy_loggers)
        assert unsafe_output.getvalue() == ""
        structured = [
            json.loads(line)
            for line in json_output.getvalue().splitlines()
            if "safe ownership diagnostic" in line
        ]
        assert len(structured) == 1
        assert telemetry_output.getvalue().count("safe ownership diagnostic") == 1
    finally:
        root.handlers = previous_root_handlers
        root.setLevel(previous_root_level)
        for logger, handlers, filters, level, propagate in previous_state:
            logger.handlers = handlers
            logger.filters = filters
            logger.setLevel(level)
            logger.propagate = propagate


def test_production_sanitizes_detached_records_before_every_configured_sink() -> None:
    class Diagnostic:
        def __init__(self, marker: str) -> None:
            self.message_primary = f"database.password={marker}"
            self.message_detail = f"api_token={marker}"

    class DriverFailure(Exception):
        def __init__(self, marker: str) -> None:
            self.diag = Diagnostic(marker)
            self.sqlstate = "23505"
            # Psycopg server messages can repeat an arbitrary bound value with
            # no key label for the free-form sanitizer to recognize.
            super().__init__(f'invalid input syntax for integer: "{marker}"')

    class InspectingFilter(logging.Filter):
        def __init__(self) -> None:
            self.messages: list[str] = []

        def filter(self, record: logging.LogRecord) -> bool:
            self.messages.append(record.getMessage())
            return True

    class TelemetryHandler(logging.Handler):
        def __init__(self) -> None:
            super().__init__(logging.DEBUG)
            self.records: list[dict[str, object]] = []

        def emit(self, record: logging.LogRecord) -> None:
            extras = {
                key: value
                for key, value in record.__dict__.items()
                if key
                not in {
                    "name",
                    "msg",
                    "args",
                    "levelname",
                    "levelno",
                    "pathname",
                    "filename",
                    "module",
                    "exc_info",
                    "exc_text",
                    "stack_info",
                    "lineno",
                    "funcName",
                    "created",
                    "msecs",
                    "relativeCreated",
                    "thread",
                    "threadName",
                    "processName",
                    "process",
                    "taskName",
                }
            }
            self.records.append(
                {
                    "message": record.getMessage(),
                    "msg": record.msg,
                    "args": record.args,
                    "extras": extras,
                    "exception": (
                        _render_reachable_exception_graph(record.exc_info[1])
                        if record.exc_info
                        else None
                    ),
                    "stack_info": record.stack_info,
                }
            )

    settings = production_settings(log_level="DEBUG")
    canary = f"external-handler-canary-{secrets.token_hex(7)}"
    raw_error = DriverFailure(canary)
    nested_original = {"database": {"password": canary}, "api_token": canary}
    encoded = quote(quote(f"client_secret={canary}", safe=""), safe="")
    boundary = f"{'x' * 8_050} session_hash_pepper={canary}{'y' * 9_000}"
    safe_value = "cluster-safe-42"

    root = logging.getLogger()
    descendant = logging.getLogger("nuzenio.external-sink-regression")
    previous_root_handlers = root.handlers[:]
    previous_root_level = root.level
    previous_descendant_handlers = descendant.handlers[:]
    previous_descendant_level = descendant.level
    previous_descendant_propagate = descendant.propagate
    plain_output = io.StringIO()
    plain_handler = logging.StreamHandler(plain_output)
    plain_handler.setLevel(logging.DEBUG)
    plain_handler.setFormatter(logging.Formatter("plain %(levelname)s %(message)s %(diagnostic)s"))
    inspecting_filter = InspectingFilter()
    plain_handler.addFilter(inspecting_filter)
    telemetry_handler = TelemetryHandler()
    descendant_handler = TelemetryHandler()
    json_output = io.StringIO()
    event_count = 8
    try:
        root.handlers = [plain_handler, telemetry_handler]
        root.setLevel(logging.DEBUG)
        descendant.handlers = [descendant_handler]
        descendant.setLevel(logging.DEBUG)
        descendant.propagate = True
        with redirect_stdout(json_output):
            configure_logging("external-sink-regression", settings)
            configure_logging("external-sink-regression", settings)
            descendant.error(
                "db_password=%s",
                canary,
                extra={"diagnostic": "positional assignment"},
            )
            descendant.error(
                "api_token=%(credential)s",
                {"credential": canary},
                extra={"diagnostic": "mapping assignment"},
            )
            descendant.error(
                "structured diagnostic",
                extra={"diagnostic": nested_original},
            )
            descendant.error(encoded, extra={"diagnostic": encoded})
            descendant.error(boundary, extra={"diagnostic": boundary})
            descendant.error(
                "database operation failed",
                exc_info=(DriverFailure, raw_error, None),
                stack_info=True,
                extra={"diagnostic": {"exception": raw_error}},
            )
            root.error(
                "client_secret=%s",
                canary,
                extra={"diagnostic": "direct root record"},
            )
            descendant.info(
                "safe telemetry %s",
                safe_value,
                extra={"diagnostic": {"queue_depth": 3}},
            )

        assert len(telemetry_handler.records) == event_count
        assert len(descendant_handler.records) == event_count - 1
        assert len(inspecting_filter.messages) == event_count
        assert len(json_output.getvalue().splitlines()) == event_count
        complete_output = "\n".join(
            [
                plain_output.getvalue(),
                json_output.getvalue(),
                repr(telemetry_handler.records),
                repr(descendant_handler.records),
                repr(inspecting_filter.messages),
            ]
        )
        assert canary not in complete_output
        assert "DriverFailure (SQLSTATE 23505)" in complete_output
        assert complete_output.count(safe_value) >= 4
        assert telemetry_handler.records[-1]["args"] == (safe_value,)
        assert descendant_handler.records[-1]["extras"] == {"diagnostic": {"queue_depth": 3}}
        assert nested_original["database"]["password"] == canary
        assert raw_error.diag.message_primary.endswith(canary)
        for handler in (plain_handler, telemetry_handler, descendant_handler):
            assert (
                sum(
                    getattr(filter_, "_nuzenio_sanitizing_filter", False)
                    for filter_ in handler.filters
                )
                == 1
            )
    finally:
        root.handlers = previous_root_handlers
        root.setLevel(previous_root_level)
        descendant.handlers = previous_descendant_handlers
        descendant.setLevel(previous_descendant_level)
        descendant.propagate = previous_descendant_propagate


def test_log_sanitizer_is_bounded_and_handles_malformed_percent_input() -> None:
    malformed_safe_message = "Fixture progress is 100%2 and literal %zz remains readable"
    assert sanitize_log_message(malformed_safe_message) == malformed_safe_message

    oversized = "x" * 20_000 + " PASSWORD=unique-marker"
    sanitized = sanitize_log_message(oversized)
    assert len(sanitized) <= 8_192
    assert "unique-marker" not in sanitized


def test_log_sanitizer_redacts_credentials_crossing_the_truncation_boundary() -> None:
    canary = "boundary-canary-7q9x"
    raw_uri = f"postgresql://operator:{canary}{'p' * 9_000}@database.example/nuzenio"
    messages = [
        raw_uri,
        f"redis://:{canary}{'r' * 9_000}@redis.example/0",
        f"{'x' * 8_060} postgresql://operator:{canary}{'p' * 500}@database.example/db",
        f"postgresql://{'u' * 8_000}:{canary}{'p' * 500}@database.example/db",
        f"postgresql://operator:{canary}@{'h' * 9_000}.example/db",
        f"Authorization: Bearer {canary}{'b' * 9_000}",
        f"Cookie: session={canary}{'c' * 9_000}",
        f"PASSWORD={canary}{'p' * 9_000}",
        f"token={canary}{'t' * 9_000}",
        quote(raw_uri, safe=""),
        quote(quote(raw_uri, safe=""), safe=""),
        f"{'x' * 8_300}{canary}",
    ]
    formatter = JsonLogFormatter("test-service")
    for message in messages:
        record = logging.LogRecord("third-party", logging.ERROR, __file__, 1, message, (), None)
        record.fields = {
            f"diagnostic-{message}": {"nested": [message]},
            "exception": RuntimeError(message),
        }
        output = formatter.format(record)
        assert canary not in output
        assert len(json.loads(output)["event"]) <= 8_192


def test_log_sanitizer_is_bounded_before_decoding_and_truncates_safe_text_predictably(
    monkeypatch,
) -> None:
    from nuzenio_api import observability

    calls: list[int] = []
    original_unquote = observability.unquote

    def bounded_unquote(value, *args, **kwargs):
        calls.append(len(value))
        return original_unquote(value, *args, **kwargs)

    monkeypatch.setattr(observability, "unquote", bounded_unquote)
    safe = "s" * 1_000_000
    sanitized = observability.sanitize_log_message(safe)
    assert sanitized == "s" * (8_192 - len("...[TRUNCATED]")) + "...[TRUNCATED]"
    assert len(calls) <= 2
    assert all(length <= 16_384 for length in calls)

    malformed = "%zz%" * 500_000
    assert len(observability.sanitize_log_message(malformed)) <= 8_192


def test_json_log_output_cannot_be_split_by_message_injection() -> None:
    message = 'safe fixture\n{"level":"critical","event":"forged"}'
    record = logging.LogRecord("fixture", logging.INFO, __file__, 1, message, (), None)
    output = JsonLogFormatter("test-service").format(record)
    assert len(output.splitlines()) == 1
    assert json.loads(output)["event"] == message


def test_log_sanitizer_does_not_corrupt_safe_messages() -> None:
    message = "Feed run 42 completed for https://fixture.example/feed.xml"
    record = logging.LogRecord("fixture", logging.INFO, __file__, 1, message, (), None)
    assert json.loads(JsonLogFormatter("test-service").format(record))["event"] == message

    connection_message = (
        "Database postgresql://database.example:5432/nuzenio; contact ops@example.com"
    )
    record = logging.LogRecord("fixture", logging.INFO, __file__, 1, connection_message, (), None)
    assert (
        json.loads(JsonLogFormatter("test-service").format(record))["event"] == connection_message
    )


def test_api_liveness_readiness_metrics_and_request_id(monkeypatch) -> None:
    client = TestClient(app)
    live = client.get("/health/live", headers={"X-Request-ID": "acceptance-123"})
    assert live.status_code == 200
    assert live.headers["X-Request-ID"] == "acceptance-123"
    assert live.headers["Cache-Control"] == "no-store"

    ready = client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json()["cache"] == "redis-ready"

    monkeypatch.setattr(
        get_settings(), "metrics_token", SecretStr("a-local-metrics-token-over-32-characters")
    )
    denied = client.get("/metrics")
    assert denied.status_code == 401
    metrics = client.get(
        "/metrics",
        headers={"Authorization": "Bearer a-local-metrics-token-over-32-characters"},
    )
    assert metrics.status_code == 200
    assert metrics.headers["Cache-Control"] == "no-store"
    assert "nuzenio_queue_depth" in metrics.text
    assert "nuzenio_editorial_reviews" in metrics.text
    assert "nuzenio_worker_abandoned_runs" in metrics.text


def test_readiness_fails_closed_when_redis_is_unavailable(monkeypatch) -> None:
    class UnavailableRedis:
        def ping(self):
            raise redis.ConnectionError("fixture outage")

    monkeypatch.setattr("nuzenio_api.main._redis_client", lambda: UnavailableRedis())
    response = TestClient(app).get("/health/ready")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "cache_unavailable"


def test_worker_health_lifecycle_and_metrics() -> None:
    status = WorkerStatus(stale_after_seconds=30)
    server, thread = start_worker_health_server(
        status,
        Settings(worker_health_host="127.0.0.1", _env_file=None),
        port=0,
    )
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        with pytest.raises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(f"{base}/health/ready", timeout=2)
        assert error.value.code == 503

        status.iteration(dependencies_ready=True, recovered=2, scheduled=3)
        status.started_run(str(uuid.uuid4()))
        response = urllib.request.urlopen(f"{base}/health/ready", timeout=2)
        assert response.status == 200
        assert response.headers["Cache-Control"] == "no-store"
        assert json.load(response)["ready"] is True

        metrics = urllib.request.urlopen(f"{base}/metrics", timeout=2).read().decode()
        assert "nuzenio_worker_ready 1" in metrics
        assert "nuzenio_worker_recovered_runs_total 2" in metrics
        assert "nuzenio_worker_scheduled_runs_total 3" in metrics

        status.finished_run(WorkerRunOutcome.LOST_LEASE)
        snapshot = status.snapshot()
        assert snapshot.lost_lease_total == 1
        assert snapshot.completed_runs_total == 0
        status.stopping()
        with pytest.raises(urllib.error.HTTPError) as stopped:
            urllib.request.urlopen(f"{base}/health/ready", timeout=2)
        assert stopped.value.code == 503
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_worker_graceful_shutdown_finishes_iteration(monkeypatch) -> None:
    from nuzenio_api import db, feed_operations

    stop = threading.Event()
    observed: dict[str, object] = {}

    class FakeClient:
        def ping(self):
            return True

    class FakeQueue:
        client = FakeClient()

        def release_due(self):
            return 1

        def dequeue(self, timeout):
            observed["timeout"] = timeout
            stop.set()
            return None

    class FakeSession:
        def __enter__(self):
            return object()

        def __exit__(self, *_args):
            return False

    class FakeServer:
        def shutdown(self):
            observed["shutdown"] = True

        def server_close(self):
            observed["closed"] = True

    class FakeThread:
        def join(self, timeout):
            observed["joined"] = timeout

    def fake_health(status, _settings):
        observed["status"] = status
        return FakeServer(), FakeThread()

    monkeypatch.setattr(feed_operations, "RedisFeedQueue", FakeQueue)
    monkeypatch.setattr(feed_operations, "start_worker_health_server", fake_health)
    monkeypatch.setattr(feed_operations, "recover_queued_runs", lambda *_args: 2)
    monkeypatch.setattr(feed_operations, "schedule_due_feeds", lambda *_args: 3)
    monkeypatch.setattr(db, "SessionLocal", FakeSession)

    feed_operations.worker_main(stop)

    status = observed["status"]
    assert isinstance(status, WorkerStatus)
    snapshot = status.snapshot()
    assert snapshot.lifecycle == "stopping"
    assert snapshot.recovered_runs_total == 2
    assert snapshot.scheduled_runs_total == 3
    assert observed == {
        "timeout": get_settings().worker_poll_seconds,
        "shutdown": True,
        "closed": True,
        "joined": 2,
        "status": status,
    }


def test_separate_audit_reader_role_is_read_only() -> None:
    role = "nuzenio_test_audit_" + uuid.uuid4().hex
    password = secrets.token_urlsafe(32)
    provision_audit_reader(engine, role, password)
    audit_engine = create_engine(
        engine.url.set(username=role, password=password), hide_parameters=True
    )
    try:
        with audit_engine.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM audit_logs")) is not None
            assert connection.scalar(text("SELECT count(*) FROM authentication_events")) is not None
        with audit_engine.begin() as connection, pytest.raises(DBAPIError):
            connection.execute(text("DELETE FROM audit_logs"))
        with audit_engine.begin() as connection, pytest.raises(DBAPIError):
            connection.execute(text("UPDATE authentication_events SET reason='forbidden'"))
        with audit_engine.begin() as connection, pytest.raises(DBAPIError):
            connection.execute(text("SELECT count(*) FROM staff_users"))
        assert_audit_reader_identity(audit_engine)
    finally:
        audit_engine.dispose()
        with engine.begin() as connection:
            connection.execute(text(f'DROP OWNED BY "{role}"'))
            connection.execute(text(f'DROP ROLE "{role}"'))
