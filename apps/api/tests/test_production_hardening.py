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
from nuzenio_api.observability import JsonLogFormatter
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
    ],
)
def test_free_form_and_nested_log_values_redact_common_secret_forms(message) -> None:
    formatter = JsonLogFormatter("test-service")
    record = logging.LogRecord("third-party", logging.ERROR, __file__, 1, message, (), None)
    record.fields = {"diagnostic": message}
    output = formatter.format(record)
    assert "unique-marker" not in output


def test_log_sanitizer_does_not_corrupt_safe_messages() -> None:
    message = "Feed run 42 completed for https://fixture.example/feed.xml"
    record = logging.LogRecord("fixture", logging.INFO, __file__, 1, message, (), None)
    assert json.loads(JsonLogFormatter("test-service").format(record))["event"] == message


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
