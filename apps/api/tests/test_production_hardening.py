from __future__ import annotations

import io
import json
import logging
import os
import secrets
import subprocess
import sys
import threading
import urllib.error
import urllib.request
import uuid
from urllib.parse import quote

import pytest
import redis
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError

from nuzenio_api.config import Settings, get_settings
from nuzenio_api.db import engine
from nuzenio_api.db_roles import assert_audit_reader_identity, provision_audit_reader
from nuzenio_api.environment import Environment, environment_from_os, is_production
from nuzenio_api.main import app
from nuzenio_api.observability import JsonLogFormatter, sanitize_log_message
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
