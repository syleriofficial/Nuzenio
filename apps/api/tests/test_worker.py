from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
from sqlalchemy import select

from nuzenio_api.db import SessionLocal
from nuzenio_api.feed_operations import (
    FeedRunExecutor,
    bounded_backoff,
    create_feed_run,
    schedule_due_feeds,
)
from nuzenio_api.feed_security import SafeFeedFetcher
from nuzenio_api.models import Article, DeadLetterJob, FeedRun, FeedRunState, SourceFeed

FIXTURE = Path(__file__).parent / "fixtures" / "sample-rss.xml"


class FakeQueue:
    def __init__(self) -> None:
        self.enqueued: list[str] = []
        self.scheduled: list[tuple[str, object]] = []

    def enqueue(self, run_id: str) -> None:
        self.enqueued.append(run_id)

    def schedule(self, run_id: str, at: object) -> None:
        self.scheduled.append((run_id, at))


def _fetcher() -> SafeFeedFetcher:
    return SafeFeedFetcher(
        resolver=lambda _host, _port: {"93.184.216.34"},
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                headers={
                    "content-type": "application/rss+xml; charset=utf-8",
                    "etag": '"fixture-v1"',
                    "last-modified": "Wed, 02 Sep 2026 10:00:00 GMT",
                },
                content=FIXTURE.read_bytes(),
                request=request,
            )
        ),
    )


def _failing_fetcher() -> SafeFeedFetcher:
    return SafeFeedFetcher(
        resolver=lambda _host, _port: {"93.184.216.34"},
        transport=httpx.MockTransport(lambda request: httpx.Response(503, request=request)),
    )


def test_backoff_is_bounded() -> None:
    assert [bounded_backoff(item) for item in (1, 2, 3)] == [5, 10, 20]
    assert bounded_backoff(20) == 900


def test_scheduler_enqueues_each_due_feed_once() -> None:
    queue = FakeQueue()
    current = datetime.now(UTC)
    with SessionLocal.begin() as session:
        feeds = list(session.scalars(select(SourceFeed)))
        for feed in feeds:
            feed.next_poll_at = current + timedelta(hours=1)
        target = feeds[0]
        target.next_poll_at = current - timedelta(seconds=1)
        target_id = target.id

    with SessionLocal() as session:
        assert schedule_due_feeds(session, queue, now=current) == 1
        assert schedule_due_feeds(session, queue, now=current) == 0
        run = session.scalar(
            select(FeedRun).where(
                FeedRun.feed_id == target_id,
                FeedRun.state == FeedRunState.QUEUED,
            )
        )
        assert run is not None
        assert run.state == FeedRunState.QUEUED
        assert queue.enqueued == [str(run.id)]
        # The deliberately unexecuted scheduler fixture must not leave an active
        # run on an arbitrary seeded feed used by a later worker test.
        run.state = FeedRunState.SKIPPED
        session.commit()


def test_worker_ingestion_is_idempotent_and_records_metrics() -> None:
    with SessionLocal.begin() as session:
        feed = session.scalar(
            select(SourceFeed).where(SourceFeed.url == "https://janadesh.example/demo-feed-en.xml")
        )
        first = create_feed_run(session, feed=feed, request_id="worker-test-1")
        first_id = first.id
    executor = FeedRunExecutor(fetcher=_fetcher(), queue=FakeQueue())
    with SessionLocal() as session:
        completed = executor.execute(session, first_id)
        assert completed.state == FeedRunState.SUCCEEDED
        assert completed.run.parsed_items == 1
        assert completed.run.new_articles == 1

    with SessionLocal.begin() as session:
        feed = session.get(SourceFeed, feed.id)
        second = create_feed_run(session, feed=feed, request_id="worker-test-2")
        second_id = second.id
    with SessionLocal() as session:
        completed = executor.execute(session, second_id)
        assert completed.state == FeedRunState.SUCCEEDED
        assert completed.run.new_articles == 0
        assert session.scalar(
            select(Article).where(Article.canonical_url.endswith("/fixture-worker-item"))
        )


def test_failed_feed_run_uses_bounded_retries_then_dead_letters() -> None:
    queue = FakeQueue()
    with SessionLocal.begin() as session:
        feed = session.scalar(
            select(SourceFeed).where(SourceFeed.url.like("https://bytereview.example/%"))
        )
        run = create_feed_run(session, feed=feed, request_id="worker-dead-letter-test")
        run_id = run.id
    executor = FeedRunExecutor(fetcher=_failing_fetcher(), queue=queue)
    for _ in range(4):
        with SessionLocal.begin() as session:
            session.get(FeedRun, run_id).next_retry_at = datetime.now(UTC) - timedelta(seconds=1)
        with SessionLocal() as session:
            result = executor.execute(session, run_id)
    assert result.state == FeedRunState.DEAD_LETTERED
    assert len(queue.scheduled) == 3
    with SessionLocal() as session:
        dead_letter = session.scalar(
            select(DeadLetterJob).where(DeadLetterJob.feed_run_id == run_id)
        )
        assert dead_letter is not None
        assert dead_letter.retried_at is None
