from __future__ import annotations

import hashlib
import secrets
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
import redis
from alembic import command
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session, sessionmaker

from nuzenio_api import reader_reports
from nuzenio_api.config import get_settings
from nuzenio_api.db import SessionLocal, engine
from nuzenio_api.db_roles import provision_audit_reader, provision_runtime
from nuzenio_api.main import app
from nuzenio_api.models import AuditLog, EventCluster, ReaderReport, StaffRole
from test_auth_editorial import login, make_staff
from test_database_remediation import migration_config


@pytest.fixture(autouse=True)
def report_limits(monkeypatch):
    monkeypatch.setattr(get_settings(), "report_key_prefix", f"nuzenio:test:reports:{uuid.uuid4()}")


def payload(**overrides):
    return {
        "submissionId": str(uuid.uuid4()),
        "storySlug": "open-language-model-india-labs",
        "language": "en",
        "category": "INACCURATE",
        "details": f"Private reader report canary {uuid.uuid4()}",
        **overrides,
    }


def stored(data):
    key = hashlib.sha256(data["submissionId"].encode()).hexdigest()
    with SessionLocal() as db:
        return db.scalar(select(ReaderReport).where(ReaderReport.submission_hash == key))


def test_private_durable_submission_and_exact_retry():
    data = payload()
    client = TestClient(app)
    with SessionLocal() as db:
        before = db.scalar(select(func.count()).select_from(ReaderReport))
        cluster = db.scalar(select(EventCluster).where(EventCluster.slug == data["storySlug"]))
        version = cluster.version
    for _ in range(2):
        result = client.post("/v1/reader-reports", json=data)
        assert result.status_code == 202, result.text
        assert result.json() == {"accepted": True}
        assert "no-store" in result.headers["cache-control"]
    report = stored(data)
    assert report.details == data["details"] and report.status == "NEW"
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(ReaderReport)) == before + 1
        assert db.get(EventCluster, cluster.id).version == version
        audits = db.scalars(select(AuditLog).where(AuditLog.entity_id == report.id)).all()
        assert len(audits) == 1 and audits[0].actor_id is None
        assert data["details"] not in str(audits[0].after_summary)
    assert client.get("/v1/reader-reports").status_code == 405
    assert client.get(f"/v1/reader-reports/{report.id}").status_code == 404
    assert client.get("/v1/admin/reader-reports").status_code == 401
    assert data["details"] not in client.get(f"/v1/clusters/{data['storySlug']}").text


def test_conflicting_and_concurrent_retries_are_atomic():
    data = payload()

    def send(_):
        return TestClient(app).post("/v1/reader-reports", json=data).status_code

    with ThreadPoolExecutor(max_workers=4) as pool:
        assert list(pool.map(send, range(4))) == [202] * 4
    report = stored(data)
    assert (
        TestClient(app)
        .post("/v1/reader-reports", json={**data, "details": "Changed report text"})
        .status_code
        == 409
    )
    with SessionLocal() as db:
        assert (
            db.scalar(
                select(func.count()).select_from(AuditLog).where(AuditLog.entity_id == report.id)
            )
            == 1
        )


@pytest.mark.parametrize(
    "override",
    [
        {"details": "short"},
        {"details": " " * 15},
        {"details": "x" * 2001},
        {"details": "control\x00canary"},
        {"details": ["unexpected"]},
        {"language": "fr"},
        {"category": "APPROVED"},
        {"storySlug": "../admin"},
        {"submissionId": "bad"},
        {"status": "RESOLVED"},
    ],
)
def test_invalid_submission_does_not_persist_or_reflect_input(override):
    data = payload(**override)
    response = TestClient(app).post("/v1/reader-reports", json=data)
    assert response.status_code == 422
    assert "canary" not in response.text
    if data["submissionId"] != "bad":
        assert stored(data) is None


def test_unknown_held_and_unreviewed_story_are_not_reportable():
    client = TestClient(app)
    with SessionLocal() as db:
        slug = db.scalar(select(EventCluster.slug).where(EventCluster.review_state == "PENDING"))
    for candidate in ["missing-reader-story", slug]:
        if candidate:
            data = payload(storySlug=candidate)
            assert client.post("/v1/reader-reports", json=data).status_code == 404
            assert stored(data) is None


def test_hindi_plain_text_and_script_are_data_not_markup():
    data = payload(language="hi", details='गलत विवरण जांचें। <script>alert("canary")</script>')
    assert TestClient(app).post("/v1/reader-reports", json=data).status_code == 202
    assert stored(data).details == data["details"]


def test_body_limits_origin_and_encoding():
    client = TestClient(app)
    assert (
        client.post(
            "/v1/reader-reports", json=payload(), headers={"Origin": "https://hostile.example"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/v1/reader-reports", content="{}", headers={"Content-Type": "text/plain"}
        ).status_code
        == 415
    )
    assert (
        client.post(
            "/v1/reader-reports",
            content="{}",
            headers={"Content-Type": "application/json", "Content-Encoding": "gzip"},
        ).status_code
        == 415
    )
    assert (
        client.post(
            "/v1/reader-reports", content=b"x" * 16385, headers={"Content-Type": "application/json"}
        ).status_code
        == 413
    )
    assert (
        client.post(
            "/v1/reader-reports", content="{", headers={"Content-Type": "application/json"}
        ).status_code
        == 422
    )


def test_atomic_peer_global_limits_and_expiring_hashed_keys(monkeypatch):
    config = get_settings()
    monkeypatch.setattr(config, "report_peer_limit", 2)
    monkeypatch.setattr(config, "report_global_limit", 3)
    reader_reports.admit("192.0.2.1")
    reader_reports.admit("192.0.2.1")
    with pytest.raises(Exception) as caught:
        reader_reports.admit("192.0.2.1")
    assert caught.value.status == 429
    reader_reports.admit("192.0.2.2")
    with pytest.raises(Exception) as caught:
        reader_reports.admit("192.0.2.3")
    assert caught.value.status == 429
    with redis.Redis.from_url(config.redis_url, decode_responses=True) as cache:
        keys = list(cache.scan_iter(f"{config.report_key_prefix}:*"))
        assert keys and all("192.0.2" not in key and 0 < cache.ttl(key) <= 120 for key in keys)


def test_redis_failure_fails_closed_before_database(monkeypatch):
    monkeypatch.setattr(
        redis.Redis, "eval", lambda *args, **kwargs: (_ for _ in ()).throw(redis.ConnectionError())
    )
    data = payload()
    assert TestClient(app).post("/v1/reader-reports", json=data).status_code == 503
    assert stored(data) is None


@pytest.mark.parametrize("role", list(StaffRole))
def test_staff_permissions_csrf_and_triage_are_independent_of_publishing(role):
    data = payload()
    assert TestClient(app).post("/v1/reader-reports", json=data).status_code == 202
    report = stored(data)
    client, csrf = login(make_staff(role))
    can_read = role in {StaffRole.ADMINISTRATOR, StaffRole.EDITOR, StaffRole.REVIEWER}
    response = client.get("/v1/admin/reader-reports?page_size=1&status=NEW")
    assert response.status_code == (200 if can_read else 403)
    body = {"expectedVersion": 1, "status": "REVIEWING", "note": "Reviewing the reader concern"}
    target = f"/v1/admin/reader-reports/{report.id}"
    assert client.patch(target, json=body).status_code == 403
    response = client.patch(target, json=body, headers={"X-CSRF-Token": csrf})
    assert response.status_code == (200 if can_read else 403)
    if not can_read:
        return
    assert response.json()["version"] == 2
    assert "submissionHash" not in response.text and "payloadHash" not in response.text
    assert client.patch(target, json=body, headers={"X-CSRF-Token": csrf}).status_code == 409
    resolved = {
        **body,
        "expectedVersion": 2,
        "status": "RESOLVED",
        "note": "Reviewed; no automatic story change",
    }
    assert client.patch(target, json=resolved, headers={"X-CSRF-Token": csrf}).status_code == 200
    assert (
        client.patch(
            target, json={**body, "expectedVersion": 3}, headers={"X-CSRF-Token": csrf}
        ).status_code
        == 409
    )
    with SessionLocal() as db:
        assert db.get(ReaderReport, report.id).status == "RESOLVED"
        events = db.scalars(
            select(AuditLog).where(AuditLog.entity_id == report.id).order_by(AuditLog.created_at)
        ).all()
        assert len(events) == 3
        assert events[-1].after_summary == {"status": "RESOLVED", "version": 3}
        assert data["details"] not in str([event.after_summary for event in events])


def test_audit_failure_rolls_back_submission_and_triage(monkeypatch):
    original = reader_reports.append_audit

    def broken(*args, **kwargs):
        raise RuntimeError("injected audit failure")

    monkeypatch.setattr(reader_reports, "append_audit", broken)
    data = payload()
    client = TestClient(app, raise_server_exceptions=False)
    assert client.post("/v1/reader-reports", json=data).status_code == 500
    assert stored(data) is None
    monkeypatch.setattr(reader_reports, "append_audit", original)
    assert client.post("/v1/reader-reports", json=data).status_code == 202
    report = stored(data)
    staff, csrf = login(make_staff(StaffRole.EDITOR))
    monkeypatch.setattr(reader_reports, "append_audit", broken)
    with pytest.raises(RuntimeError):
        staff.patch(
            f"/v1/admin/reader-reports/{report.id}",
            headers={"X-CSRF-Token": csrf},
            json={
                "expectedVersion": 1,
                "status": "REVIEWING",
                "note": "A private test triage note",
            },
        )
    assert stored(data).status == "NEW" and stored(data).version == 1


def test_competing_triage_updates_have_one_winner_and_one_audit():
    data = payload()
    assert TestClient(app).post("/v1/reader-reports", json=data).status_code == 202
    report = stored(data)
    clients = [login(make_staff(StaffRole.EDITOR)), login(make_staff(StaffRole.REVIEWER))]

    def update(auth):
        client, csrf = auth
        return client.patch(
            f"/v1/admin/reader-reports/{report.id}",
            headers={"X-CSRF-Token": csrf},
            json={"expectedVersion": 1, "status": "REVIEWING", "note": "Concurrent reviewer note"},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(update, clients)) == [200, 409]
    with SessionLocal() as db:
        assert db.get(ReaderReport, report.id).version == 2
        assert (
            db.scalar(
                select(func.count()).select_from(AuditLog).where(AuditLog.entity_id == report.id)
            )
            == 2
        )


def test_runtime_can_persist_reports_but_audit_identity_cannot_read_private_text():
    roles = [("runtime", provision_runtime), ("audit", provision_audit_reader)]
    for kind, provision in roles:
        role = "report_test_" + uuid.uuid4().hex
        password = secrets.token_urlsafe(32)
        provision(engine, role, password)
        restricted = create_engine(
            engine.url.set(username=role, password=password), hide_parameters=True
        )
        try:
            if kind == "runtime":
                data = payload()
                with Session(restricted) as db:
                    assert reader_reports.persist(
                        reader_reports.Submission.model_validate(data), db, "runtime-report-test"
                    ) == {"accepted": True}
                assert stored(data).details == data["details"]
            else:
                with restricted.begin() as db, pytest.raises(DBAPIError):
                    db.execute(text("SELECT details FROM reader_reports"))
        finally:
            restricted.dispose()
            with engine.begin() as db:
                db.execute(text(f'DROP OWNED BY "{role}"'))
                db.execute(text(f'DROP ROLE "{role}"'))


def test_migration_and_database_constraints():
    with SessionLocal() as db:
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == "76d934bfa102"
        assert (
            db.scalar(
                text("SELECT count(*) FROM pg_constraint WHERE conrelid='reader_reports'::regclass")
            )
            >= 7
        )


def test_upgrade_from_3a_preserves_existing_rows_and_starts_with_empty_inbox(monkeypatch):
    from nuzenio_api.seed import seed_database

    name = "nuzenio_report_upgrade_test_" + uuid.uuid4().hex
    url = engine.url.set(database=name)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as db:
        db.execute(text(f'CREATE DATABASE "{name}"'))
    target = create_engine(url)
    monkeypatch.setattr(get_settings(), "database_url", url.render_as_string(hide_password=False))
    try:
        config = migration_config()
        command.upgrade(config, "6d0a4f2b8c91")
        seed_database(sessionmaker(target, expire_on_commit=False))
        tables = [name for name in inspect(target).get_table_names() if name != "alembic_version"]

        def snapshot():
            with target.connect() as db:
                return {
                    table: db.scalar(
                        text(
                            "SELECT md5(string_agg(to_jsonb(t)::text, '' "
                            f'ORDER BY to_jsonb(t)::text)) FROM "{table}" t'
                        )
                    )
                    for table in tables
                }

        before = snapshot()
        command.upgrade(config, "head")
        command.check(config)
        assert snapshot() == before
        with target.connect() as db:
            assert db.scalar(text("SELECT count(*) FROM reader_reports")) == 0
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == "76d934bfa102"
    finally:
        target.dispose()
        with admin.connect() as db:
            db.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()
