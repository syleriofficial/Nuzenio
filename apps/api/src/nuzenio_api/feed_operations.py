from __future__ import annotations

import hashlib
import time
import uuid
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Protocol
from urllib.parse import urlsplit

import redis
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from nuzenio_api.config import get_settings
from nuzenio_api.feed_security import FeedSecurityError, SafeFeedFetcher, parse_feed_xml
from nuzenio_api.models import (
    Article,
    ArticleFingerprint,
    ContentStatus,
    DeadLetterJob,
    FeedRun,
    FeedRunState,
    OnboardingState,
    PublisherDomain,
    RightsPolicy,
    SourceFeed,
)
from nuzenio_api.pipeline.demo import DeterministicCanonicalizer
from nuzenio_api.services import ApplicationError

QUEUE_KEY = "nuzenio:feed-runs:ready"
SCHEDULED_KEY = "nuzenio:feed-runs:scheduled"
ENQUEUED_KEY = "nuzenio:feed-runs:enqueued"
MAX_ATTEMPTS = 4


class Queue(Protocol):
    def enqueue(self, run_id: str) -> None: ...

    def schedule(self, run_id: str, at: datetime) -> None: ...


class RedisFeedQueue:
    def __init__(self, client: redis.Redis | None = None) -> None:
        self.client = client or redis.Redis.from_url(
            get_settings().redis_url, decode_responses=True
        )

    def enqueue(self, run_id: str) -> None:
        if self.client.sadd(ENQUEUED_KEY, run_id):
            self.client.lpush(QUEUE_KEY, run_id)

    def schedule(self, run_id: str, at: datetime) -> None:
        self.client.zadd(SCHEDULED_KEY, {run_id: at.timestamp()})

    def release_due(self, now: datetime | None = None) -> int:
        timestamp = (now or datetime.now(UTC)).timestamp()
        due = self.client.zrangebyscore(SCHEDULED_KEY, 0, timestamp)
        if not due:
            return 0
        for run_id in due:
            self.enqueue(run_id)
            self.client.zrem(SCHEDULED_KEY, run_id)
        return len(due)

    def dequeue(self, timeout: int = 5) -> str | None:
        item = self.client.brpop(QUEUE_KEY, timeout=timeout)
        if not item:
            return None
        run_id = str(item[1])
        self.client.srem(ENQUEUED_KEY, run_id)
        return run_id


def bounded_backoff(attempt: int) -> int:
    return min(900, 5 * (2 ** max(0, attempt - 1)))


def rights_issues(session: Session, feed: SourceFeed, *, now: datetime | None = None) -> list[str]:
    current = now or datetime.now(UTC)
    organization = feed.organization
    rights = feed.rights_policy
    domain = session.get(PublisherDomain, feed.domain_id) if feed.domain_id else None
    issues: list[str] = []
    if organization.onboarding_state != OnboardingState.APPROVED or not organization.active:
        issues.append("publisher_not_approved")
    if not domain or not domain.verified or domain.onboarding_state != OnboardingState.APPROVED:
        issues.append("domain_not_approved")
    if rights.onboarding_state != OnboardingState.APPROVED:
        issues.append("rights_not_approved")
    if rights.revoked_at is not None:
        issues.append("rights_revoked")
    if rights.effective_at and rights.effective_at > current:
        issues.append("rights_not_effective")
    if rights.expires_at and rights.expires_at <= current:
        issues.append("rights_expired")
    if not rights.may_use_headline:
        issues.append("headline_right_missing")
    if not rights.may_store_excerpt:
        issues.append("snippet_right_missing")
    if not rights.may_summarize:
        issues.append("summary_right_missing")
    if rights.may_display_full_text:
        issues.append("full_text_display_must_remain_disabled")
    if feed.onboarding_state != OnboardingState.APPROVED or not feed.approved:
        issues.append("feed_not_approved")
    if feed.kill_switch:
        issues.append("feed_kill_switch")
    if get_settings().feed_kill_switch:
        issues.append("global_feed_kill_switch")
    return issues


def enforce_expired_rights(session: Session) -> int:
    now = datetime.now(UTC)
    feeds = list(
        session.scalars(
            select(SourceFeed)
            .join(RightsPolicy, SourceFeed.rights_policy_id == RightsPolicy.id)
            .where(
                SourceFeed.onboarding_state == OnboardingState.APPROVED,
                SourceFeed.approved.is_(True),
                (
                    (RightsPolicy.expires_at.is_not(None) & (RightsPolicy.expires_at <= now))
                    | RightsPolicy.revoked_at.is_not(None)
                ),
            )
        )
    )
    for feed in feeds:
        feed.approved = False
        feed.onboarding_state = OnboardingState.PAUSED
        feed.paused_reason = "Rights expired or were revoked."
        feed.version += 1
    return len(feeds)


def create_feed_run(
    session: Session,
    *,
    feed: SourceFeed,
    request_id: str,
    manual_actor_id: uuid.UUID | None = None,
) -> FeedRun:
    issues = rights_issues(session, feed)
    if issues:
        raise ApplicationError(
            code="feed_not_runnable",
            message="The feed is not approved to run: " + ", ".join(issues),
            status=409,
        )
    recent_cutoff = datetime.now(UTC) - timedelta(seconds=60)
    recent_count = int(
        session.scalar(
            select(func.count(FeedRun.id)).where(
                FeedRun.feed_id == feed.id,
                FeedRun.created_at >= recent_cutoff,
            )
        )
        or 0
    )
    if recent_count >= feed.rate_limit_per_minute:
        raise ApplicationError(
            code="feed_rate_limited",
            message="This source has reached its per-minute feed-run limit.",
            status=429,
        )
    run = FeedRun(
        feed_id=feed.id,
        state=FeedRunState.QUEUED,
        request_id=request_id,
        manual_actor_id=manual_actor_id,
    )
    session.add(run)
    session.flush()
    return run


def schedule_due_feeds(
    session: Session,
    queue: Queue,
    *,
    now: datetime | None = None,
) -> int:
    """Persist and enqueue one run for each due approved feed.

    The database remains the scheduling source of truth. An existing queued,
    running, or retrying run prevents duplicate scheduling for the same feed.
    """
    current = now or datetime.now(UTC)
    enforce_expired_rights(session)
    feeds = list(
        session.scalars(
            select(SourceFeed)
            .where(
                SourceFeed.approved.is_(True),
                SourceFeed.onboarding_state == OnboardingState.APPROVED,
                or_(SourceFeed.next_poll_at.is_(None), SourceFeed.next_poll_at <= current),
            )
            .order_by(SourceFeed.id)
        )
    )
    created: list[FeedRun] = []
    active_states = [
        FeedRunState.QUEUED,
        FeedRunState.RUNNING,
        FeedRunState.RETRYING,
    ]
    for feed in feeds:
        if rights_issues(session, feed):
            continue
        outstanding = session.scalar(
            select(FeedRun.id).where(
                FeedRun.feed_id == feed.id,
                FeedRun.state.in_(active_states),
            )
        )
        if outstanding:
            continue
        run = create_feed_run(
            session,
            feed=feed,
            request_id=f"scheduled-{uuid.uuid4()}",
        )
        feed.next_poll_at = current + timedelta(seconds=feed.poll_interval_seconds)
        created.append(run)

    session.commit()
    for run in created:
        queue.enqueue(str(run.id))
    return len(created)


def recover_queued_runs(session: Session, queue: Queue, *, limit: int = 100) -> int:
    """Requeue durable database work after Redis or worker interruption."""
    run_ids = list(
        session.scalars(
            select(FeedRun.id)
            .where(FeedRun.state == FeedRunState.QUEUED)
            .order_by(FeedRun.created_at)
            .limit(limit)
        )
    )
    for run_id in run_ids:
        queue.enqueue(str(run_id))
    return len(run_ids)


def _published(value: str | None) -> datetime:
    if not value:
        return datetime.now(UTC)
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return datetime.now(UTC)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


class FeedRunExecutor:
    def __init__(self, *, fetcher: SafeFeedFetcher | None = None, queue: Queue | None = None):
        self.fetcher = fetcher or SafeFeedFetcher()
        self.queue = queue or RedisFeedQueue()
        self.canonicalizer = DeterministicCanonicalizer()

    def execute(self, session: Session, run_id: uuid.UUID) -> FeedRun:
        run = session.get(FeedRun, run_id)
        if run is None:
            raise ApplicationError(
                code="feed_run_not_found", message="Feed run not found.", status=404
            )
        if run.state in {
            FeedRunState.SUCCEEDED,
            FeedRunState.SKIPPED,
            FeedRunState.DEAD_LETTERED,
        }:
            return run
        feed = session.get(SourceFeed, run.feed_id)
        if feed is None:
            raise ApplicationError(code="feed_not_found", message="Feed not found.", status=404)
        issues = rights_issues(session, feed)
        if issues:
            run.state = FeedRunState.SKIPPED
            run.error_code = "feed_not_runnable"
            run.internal_error = ",".join(issues)
            run.completed_at = datetime.now(UTC)
            session.commit()
            return run
        started = time.monotonic()
        run.state = FeedRunState.RUNNING
        run.started_at = datetime.now(UTC)
        session.commit()
        try:
            result = self.fetcher.fetch(feed.url, etag=feed.etag, last_modified=feed.last_modified)
            items = [] if result.status_code == 304 else parse_feed_xml(result.content)
            allowed_domains = {
                domain.domain.casefold()
                for domain in session.scalars(
                    select(PublisherDomain).where(
                        PublisherDomain.organization_id == feed.organization_id,
                        PublisherDomain.verified.is_(True),
                        PublisherDomain.onboarding_state == OnboardingState.APPROVED,
                    )
                )
            }
            new_articles = 0
            for item in items:
                parsed_link = urlsplit(item.link)
                if (
                    parsed_link.scheme != "https"
                    or parsed_link.username
                    or parsed_link.password
                    or (parsed_link.hostname or "").casefold() not in allowed_domains
                ):
                    continue
                canonical_url = self.canonicalizer.canonicalize(item.link)
                article = session.scalar(
                    select(Article).where(Article.canonical_url == canonical_url)
                )
                if article is not None:
                    continue
                article = Article(
                    feed_id=feed.id,
                    publisher_organization_id=feed.organization_id,
                    canonical_url=canonical_url,
                    title=item.title,
                    excerpt=item.summary or None,
                    language=feed.language,
                    published_at=_published(item.published),
                    status=ContentStatus.INGESTED,
                    source_metadata={"feed_external_id": item.external_id},
                )
                session.add(article)
                session.flush()
                normalized = f"{item.title.casefold()}\n{item.summary.casefold()}"
                session.add(
                    ArticleFingerprint(
                        article_id=article.id,
                        exact_hash=hashlib.sha256(normalized.encode()).hexdigest(),
                        normalized_url_hash=hashlib.sha256(canonical_url.encode()).hexdigest(),
                    )
                )
                new_articles += 1
            feed.etag = result.etag
            feed.last_modified = result.last_modified
            feed.last_success_at = datetime.now(UTC)
            feed.health_status = "HEALTHY"
            feed.next_poll_at = datetime.now(UTC) + timedelta(seconds=feed.poll_interval_seconds)
            run.state = FeedRunState.SUCCEEDED
            run.http_status = result.status_code
            run.fetched_bytes = len(result.content)
            run.parsed_items = len(items)
            run.new_articles = new_articles
            run.completed_at = datetime.now(UTC)
            run.duration_ms = int((time.monotonic() - started) * 1000)
            session.commit()
            return run
        except Exception as error:
            session.rollback()
            run = session.get(FeedRun, run_id)
            if run is None:
                raise
            run.attempt += 1
            run.completed_at = datetime.now(UTC)
            run.error_code = (
                error.code if isinstance(error, FeedSecurityError) else "feed_processing_failed"
            )
            run.internal_error = str(error)[:4000]
            if run.attempt <= MAX_ATTEMPTS:
                delay = bounded_backoff(run.attempt)
                run.state = FeedRunState.RETRYING
                run.next_retry_at = datetime.now(UTC) + timedelta(seconds=delay)
                self.queue.schedule(str(run.id), run.next_retry_at)
            else:
                run.state = FeedRunState.DEAD_LETTERED
                session.add(
                    DeadLetterJob(
                        feed_run_id=run.id,
                        payload={"feed_id": str(run.feed_id), "attempt": run.attempt},
                        reason=run.internal_error or run.error_code,
                    )
                )
            session.commit()
            return run


def worker_main() -> None:
    from nuzenio_api.db import SessionLocal

    queue = RedisFeedQueue()
    executor = FeedRunExecutor(queue=queue)
    while True:
        queue.release_due()
        with SessionLocal() as session:
            recover_queued_runs(session, queue)
            schedule_due_feeds(session, queue)
        run_id = queue.dequeue()
        if not run_id:
            continue
        with SessionLocal() as session:
            executor.execute(session, uuid.UUID(run_id))


if __name__ == "__main__":
    worker_main()
