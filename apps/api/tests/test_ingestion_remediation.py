import gzip
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import httpx
import pytest
import redis
from fastapi.testclient import TestClient
from sqlalchemy import select
from starlette.requests import Request

from nuzenio_api import auth
from nuzenio_api.config import Settings, get_settings
from nuzenio_api.db import SessionLocal
from nuzenio_api.feed_operations import (
    FeedRunExecutor,
    create_feed_run,
    heartbeat,
    recover_queued_runs,
    schedule_due_feeds,
)
from nuzenio_api.feed_security import FeedSecurityError, FetchResult, SafeFeedFetcher
from nuzenio_api.main import app
from nuzenio_api.models import Article, FeedControl, FeedRun, FeedRunState, SourceFeed
from test_worker import FakeQueue


def new_run():
    with SessionLocal.begin() as session:
        source = session.scalar(
            select(SourceFeed).where(SourceFeed.url.like("https://janadesh.example/%"))
        )
        feed = SourceFeed(
            organization_id=source.organization_id,
            rights_policy_id=source.rights_policy_id,
            domain_id=source.domain_id,
            name="Isolated fixture",
            feed_type=source.feed_type,
            url=f"https://janadesh.example/{uuid.uuid4()}.xml",
            language="en",
            approved=True,
            onboarding_state=source.onboarding_state,
        )
        session.add(feed)
        session.flush()
        run = create_feed_run(session, feed=feed, request_id="remediation-worker")
        return feed.id, run.id


def fixture_result(slug):
    return FetchResult(
        200,
        (
            "<rss><channel><item><title>Fixture item</title>"
            f"<link>https://janadesh.example/{slug}</link>"
            "<description>Fixture only.</description></item></channel></rss>"
        ).encode(),
        "application/rss+xml",
        None,
        None,
        "https://janadesh.example/feed",
    )


@pytest.mark.parametrize(
    "change", ["pause", "expiry", "revocation", "global", "environment", "version"]
)
def test_f05_fetch_outside_transaction_and_final_rights_fence(change, monkeypatch):
    feed_id, run_id = new_run()
    slug = str(uuid.uuid4())
    old = {}
    with SessionLocal() as session:

        def fetch(*args, **kwargs):
            assert not session.in_transaction()
            with SessionLocal.begin() as other:
                feed = other.get(SourceFeed, feed_id)
                if change == "pause":
                    feed.approved = False
                    feed.version += 1
                elif change == "expiry":
                    old["expires_at"] = feed.rights_policy.expires_at
                    feed.rights_policy.expires_at = datetime.now(UTC) - timedelta(seconds=1)
                elif change == "revocation":
                    old["revoked_at"] = feed.rights_policy.revoked_at
                    feed.rights_policy.revoked_at = datetime.now(UTC)
                elif change == "global":
                    other.get(FeedControl, 1).paused = True
                elif change == "version":
                    feed.rights_policy.version += 1
                else:
                    monkeypatch.setattr(get_settings(), "feed_kill_switch", True)
            return fixture_result(slug)

        result = FeedRunExecutor(fetcher=SimpleNamespace(fetch=fetch), queue=FakeQueue()).execute(
            session, run_id
        )
        assert result.state == FeedRunState.SKIPPED
        assert not session.scalar(select(Article).where(Article.canonical_url.endswith(slug)))
    with SessionLocal.begin() as session:
        policy = session.get(SourceFeed, feed_id).rights_policy
        for key, value in old.items():
            setattr(policy, key, value)
        session.get(FeedControl, 1).paused = False


def test_f08_stale_worker_cannot_commit_after_takeover():
    _, run_id = new_run()
    started, release = threading.Event(), threading.Event()
    old_slug, new_slug = str(uuid.uuid4()), str(uuid.uuid4())

    def old_fetch(*args, **kwargs):
        started.set()
        assert release.wait(5)
        return fixture_result(old_slug)

    def execute(fetcher):
        with SessionLocal() as session:
            return (
                FeedRunExecutor(fetcher=fetcher, queue=FakeQueue()).execute(session, run_id).state
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        old = pool.submit(execute, SimpleNamespace(fetch=old_fetch))
        assert started.wait(3)
        with SessionLocal.begin() as session:
            run = session.get(FeedRun, run_id)
            token = run.lease_token
            run.lease_expires_at = datetime.now(UTC) - timedelta(seconds=1)
        assert not heartbeat(SessionLocal, run_id, token)
        with SessionLocal() as session:
            recover_queued_runs(session, FakeQueue())
        assert (
            execute(SimpleNamespace(fetch=lambda *a, **k: fixture_result(new_slug)))
            == FeedRunState.SUCCEEDED
        )
        release.set()
        old.result(timeout=3)
    with SessionLocal() as session:
        assert not session.scalar(select(Article).where(Article.canonical_url.endswith(old_slug)))
        assert session.scalar(select(Article).where(Article.canonical_url.endswith(new_slug)))


def test_f08_duplicate_delivery_and_redis_outage():
    _, run_id = new_run()
    calls = []

    def fetch(*args, **kwargs):
        calls.append(1)
        time.sleep(0.1)
        return fixture_result(str(run_id))

    def execute(_):
        with SessionLocal() as session:
            FeedRunExecutor(fetcher=SimpleNamespace(fetch=fetch), queue=FakeQueue()).execute(
                session, run_id
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(execute, range(2)))
    assert len(calls) == 1
    _, failed_id = new_run()

    def fail(*a, **k):
        raise FeedSecurityError("fixture_failure", "Fixture unavailable")

    def redis_down(*a, **k):
        raise redis.ConnectionError("Fixture Redis unavailable")

    with SessionLocal() as session:
        result = FeedRunExecutor(
            fetcher=SimpleNamespace(fetch=fail), queue=SimpleNamespace(schedule=redis_down)
        ).execute(session, failed_id)
        assert result.state == FeedRunState.RETRYING
        assert result.lease_token is None


def test_f04_limits_before_hash_and_ip_rotation(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "login_attempt_limit", 2)
    calls = []
    monkeypatch.setattr(
        auth, "PASSWORD_HASHER", SimpleNamespace(verify=lambda *a: calls.append(1) or False)
    )
    for ip in ["203.0.113.1", "203.0.113.2", "203.0.113.3"]:
        client = TestClient(app, client=(ip, 12345))
        client.post(
            "/v1/admin/auth/login", json={"username": "rotation-fixture", "password": "wrong"}
        )
    assert len(calls) == 2
    monkeypatch.setattr(settings, "login_key_prefix", f"nuzenio:test:auth:{uuid.uuid4()}")
    monkeypatch.setattr(settings, "login_ip_limit", 2)
    calls.clear()
    for index in range(4):
        TestClient(app).post(
            "/v1/admin/auth/login", json={"username": f"random-{index}", "password": "wrong"}
        )
    assert len(calls) == 2


def test_f04_global_limit_and_denied_requests_do_not_extend_cooldown(monkeypatch):
    from nuzenio_api.login_admission import AdmissionDenied, password_admission

    settings = get_settings()
    monkeypatch.setattr(settings, "login_global_limit", 2)
    for index in range(2):
        with password_admission(f"account-{index}", f"ip-{index}"):
            pass
    client = redis.Redis.from_url(settings.redis_url)
    key = settings.login_key_prefix + ":global"
    before = client.pttl(key)
    time.sleep(0.02)
    for index in range(4):
        with (
            pytest.raises(AdmissionDenied),
            password_admission(f"random-{index}", f"rotated-{index}"),
        ):
            pytest.fail("Throttled work must not enter verification")
    assert 0 < client.pttl(key) < before


def test_f04_concurrency_and_redis_failure(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "login_concurrency", 2)
    active, maximum = 0, 0
    lock = threading.Lock()

    def verify(*args):
        nonlocal active, maximum
        with lock:
            active += 1
            maximum = max(maximum, active)
        time.sleep(0.1)
        with lock:
            active -= 1
        return False

    monkeypatch.setattr(auth, "PASSWORD_HASHER", SimpleNamespace(verify=verify))

    def attempt(index):
        return (
            TestClient(app)
            .post(
                "/v1/admin/auth/login", json={"username": f"parallel-{index}", "password": "wrong"}
            )
            .status_code
        )

    with ThreadPoolExecutor(max_workers=8) as pool:
        statuses = list(pool.map(attempt, range(8)))
    assert maximum <= 2
    assert 429 in statuses

    def down(*a, **k):
        raise redis.ConnectionError("unavailable")

    monkeypatch.setattr(redis.Redis, "eval", down)
    assert attempt(99) == 503


def test_f04_forwarded_headers_require_trusted_proxy(monkeypatch):
    request = Request(
        {
            "type": "http",
            "client": ("203.0.113.4", 1234),
            "headers": [(b"x-forwarded-for", b"1.1.1.1")],
            "state": {},
        }
    )
    assert auth.request_metadata(request)[1] == "203.0.113.4"
    monkeypatch.setattr(get_settings(), "trusted_proxy_cidrs", ["203.0.113.4/32"])
    assert auth.request_metadata(request)[1] == "1.1.1.1"


def test_f11_compressed_bomb_rejected_without_reading():
    read = []

    class Bomb(httpx.SyncByteStream):
        def __iter__(self):
            read.append(True)
            yield gzip.compress(b"x" * 2_000_001)

    fetcher = SafeFeedFetcher(
        resolver=lambda *_: {"93.184.216.34"},
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                headers={"content-type": "application/rss+xml", "content-encoding": "gzip"},
                stream=Bomb(),
            )
        ),
    )
    with pytest.raises(FeedSecurityError, match="Compressed"):
        fetcher.fetch("https://fixture.example/rss")
    assert not read


def test_f11_total_budget_catches_slow_drip():
    class Drip(httpx.SyncByteStream):
        def __iter__(self):
            for _ in range(20):
                time.sleep(0.02)
                yield b"x"

    fetcher = SafeFeedFetcher(
        settings=Settings(feed_timeout_seconds=0.05),
        resolver=lambda *_: {"93.184.216.34"},
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200, headers={"content-type": "application/rss+xml"}, stream=Drip()
            )
        ),
    )
    start = time.monotonic()
    with pytest.raises(FeedSecurityError, match="time budget"):
        fetcher.fetch("https://fixture.example/rss")
    assert time.monotonic() - start < 0.2


def _blocked_child(*args):
    time.sleep(60)


def test_f11_production_boundary_kills_stalled_transport(monkeypatch):
    from nuzenio_api import feed_security

    monkeypatch.setattr(feed_security, "_fetch_child", _blocked_child)
    start = time.monotonic()
    with pytest.raises(FeedSecurityError, match="total time budget"):
        SafeFeedFetcher(settings=Settings(feed_timeout_seconds=0.2)).fetch(
            "https://fixture.example/rss"
        )
    assert time.monotonic() - start < 2.5


def test_f08_competing_schedulers_create_one_active_run_per_feed():
    feed_id, run_id = new_run()
    now = datetime.now(UTC)
    with SessionLocal.begin() as session:
        session.get(FeedRun, run_id).state = FeedRunState.SUCCEEDED
        session.get(SourceFeed, feed_id).next_poll_at = now - timedelta(seconds=1)

    def schedule(_):
        with SessionLocal() as session:
            schedule_due_feeds(session, FakeQueue(), now=now)

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(schedule, range(3)))
    with SessionLocal() as session:
        active = list(
            session.scalars(
                select(FeedRun).where(
                    FeedRun.feed_id == feed_id,
                    FeedRun.state == FeedRunState.QUEUED,
                )
            )
        )
        assert len(active) == 1
    # Do not leave other fixture feeds' scheduling state changed for later tests.
    with SessionLocal.begin() as session:
        for run in session.scalars(select(FeedRun).where(FeedRun.state == FeedRunState.QUEUED)):
            run.state = FeedRunState.SKIPPED
