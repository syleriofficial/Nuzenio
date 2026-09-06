from __future__ import annotations

import hashlib
import logging
import signal
import threading
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Protocol
from urllib.parse import urlsplit

import redis
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, sessionmaker

from nuzenio_api.config import get_settings
from nuzenio_api.environment import is_production
from nuzenio_api.feed_locks import approval_versions, control_lock, locked_feed
from nuzenio_api.feed_security import FeedSecurityError, SafeFeedFetcher, parse_feed_xml
from nuzenio_api.models import (
    Article,
    ArticleFingerprint,
    ContentStatus,
    DeadLetterJob,
    FeedControl,
    FeedRun,
    FeedRunState,
    OnboardingState,
    PublisherDomain,
    RightsPolicy,
    SourceFeed,
)
from nuzenio_api.observability import configure_logging, log_event
from nuzenio_api.pipeline.demo import DeterministicCanonicalizer
from nuzenio_api.services import ApplicationError
from nuzenio_api.worker_health import WorkerRunOutcome, WorkerStatus, start_worker_health_server

QUEUE_KEY = "nuzenio:feed-runs:ready"
SCHEDULED_KEY = "nuzenio:feed-runs:scheduled"
ENQUEUED_KEY = "nuzenio:feed-runs:enqueued"
MAX_ATTEMPTS = 4
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FeedExecutionOutcome:
    run: FeedRun
    kind: WorkerRunOutcome

    @property
    def state(self) -> FeedRunState:
        return self.run.state


class Queue(Protocol):
    def enqueue(self, run_id: str) -> None: ...

    def schedule(self, run_id: str, at: datetime) -> None: ...

    def release_due(self, now: datetime | None = None) -> int: ...

    def dequeue(self, timeout: int = 5) -> str | None: ...


class RedisFeedQueue:
    def __init__(self, client: redis.Redis | None = None) -> None:
        self.client = client or redis.Redis.from_url(
            get_settings().redis_url, decode_responses=True
        )

    def enqueue(self, run_id: str) -> None:
        # Atomic, expiring dispatch hint. PostgreSQL is the durable outbox.
        self.client.eval(
            """if redis.call('SET',KEYS[1],1,'NX','EX',10) then
            redis.call('LPUSH',KEYS[2],ARGV[1]); return 1 end; return 0""",
            2,
            f"{ENQUEUED_KEY}:{run_id}",
            QUEUE_KEY,
            run_id,
        )

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
        self.client.delete(f"{ENQUEUED_KEY}:{run_id}")
        return run_id


def bounded_backoff(attempt: int) -> int:
    return min(900, 5 * (2 ** max(0, attempt - 1)))


def rights_issues(session: Session, feed: SourceFeed, *, now: datetime | None = None) -> list[str]:
    current = now or datetime.now(UTC)
    organization = feed.organization
    rights = feed.rights_policy
    domain = session.get(PublisherDomain, feed.domain_id) if feed.domain_id else None
    issues: list[str] = []
    if rights.organization_id != feed.organization_id or (
        domain and domain.organization_id != feed.organization_id
    ):
        issues.append("approval_organization_mismatch")
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
    control = session.get(FeedControl, 1)
    if not control or control.paused:
        issues.append("persistent_feed_kill_switch")
    return issues


def enforce_expired_rights(session: Session) -> int:
    control_lock(session)
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
    feed = locked_feed(session, feed.id)
    if session.scalar(
        select(FeedRun.id).where(
            FeedRun.feed_id == feed.id,
            FeedRun.state.in_([FeedRunState.QUEUED, FeedRunState.RUNNING, FeedRunState.RETRYING]),
        )
    ):
        raise ApplicationError(
            code="feed_run_active", message="This feed already has active work.", status=409
        )
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
    control_lock(session)
    session.expire_all()
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
        dispatch(queue, run)
    return len(created)


def recover_queued_runs(session: Session, queue: Queue, *, limit: int = 100) -> int:
    """Requeue durable database work after Redis or worker interruption."""
    control_lock(session)
    now = datetime.now(UTC)
    session.execute(
        update(FeedRun)
        .where(
            FeedRun.state == FeedRunState.RUNNING,
            or_(FeedRun.lease_expires_at.is_(None), FeedRun.lease_expires_at <= now),
        )
        .values(state=FeedRunState.QUEUED, lease_token=None, lease_expires_at=None)
    )
    run_ids = list(
        session.scalars(
            select(FeedRun.id)
            .where(
                or_(
                    FeedRun.state == FeedRunState.QUEUED,
                    (FeedRun.state == FeedRunState.RETRYING) & (FeedRun.next_retry_at <= now),
                )
            )
            .order_by(FeedRun.created_at)
            .limit(limit)
        )
    )
    session.commit()
    for run_id in run_ids:
        try:
            queue.enqueue(str(run_id))
        except redis.RedisError:
            break  # Durable DB rows will be re-dispatched when Redis returns.
    return len(run_ids)


def dispatch(queue, run):
    try:
        if run.state == FeedRunState.RETRYING:
            queue.schedule(str(run.id), run.next_retry_at)
        else:
            queue.enqueue(str(run.id))
    except redis.RedisError:
        log_event(logger, logging.WARNING, "feed_dispatch_deferred", run_id=str(run.id))


def heartbeat(factory, run_id, token):
    with factory.begin() as session:
        now = datetime.now(UTC)
        retained = (
            session.execute(
                update(FeedRun)
                .where(
                    FeedRun.id == run_id,
                    FeedRun.lease_token == token,
                    FeedRun.state == FeedRunState.RUNNING,
                    FeedRun.lease_expires_at > now,
                )
                .values(heartbeat_at=now, lease_expires_at=now + timedelta(seconds=60))
            ).rowcount
            == 1
        )
        log_event(
            logger,
            logging.DEBUG if retained else logging.WARNING,
            "feed_lease_heartbeat",
            run_id=str(run_id),
            lease_retained=retained,
        )
        return retained


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

    def execute(self, session: Session, run_id: uuid.UUID) -> FeedExecutionOutcome:
        run = session.get(FeedRun, run_id)
        if run is None:
            raise ApplicationError(
                code="feed_run_not_found", message="Feed run not found.", status=404
            )
        feed_id = run.feed_id
        feed = locked_feed(session, feed_id)
        run = session.scalar(select(FeedRun).where(FeedRun.id == run_id).with_for_update())
        now = datetime.now(UTC)
        if run.state in {
            FeedRunState.SUCCEEDED,
            FeedRunState.SKIPPED,
            FeedRunState.DEAD_LETTERED,
        }:
            session.commit()
            return FeedExecutionOutcome(run, WorkerRunOutcome.ALREADY_TERMINAL)
        if (
            run.state == FeedRunState.RUNNING
            and run.lease_expires_at
            and run.lease_expires_at > now
        ) or (run.state == FeedRunState.RETRYING and run.next_retry_at and run.next_retry_at > now):
            session.commit()
            return FeedExecutionOutcome(run, WorkerRunOutcome.ACTIVE_ELSEWHERE)
        if feed is None:
            raise ApplicationError(code="feed_not_found", message="Feed not found.", status=404)
        issues = rights_issues(session, feed)
        if issues:
            run.state = FeedRunState.SKIPPED
            run.error_code = "feed_not_runnable"
            run.internal_error = ",".join(issues)
            run.completed_at = datetime.now(UTC)
            session.commit()
            return FeedExecutionOutcome(run, WorkerRunOutcome.SKIPPED)
        started = time.monotonic()
        versions = approval_versions(session, feed)
        fetch_arguments = (feed.url, feed.etag, feed.last_modified)
        token = uuid.uuid4()
        run.state = FeedRunState.RUNNING
        run.started_at = datetime.now(UTC)
        run.lease_token = token
        run.lease_expires_at = now + timedelta(seconds=60)
        run.heartbeat_at = now
        session.commit()
        factory = sessionmaker(bind=session.get_bind(), expire_on_commit=False)
        stop = threading.Event()

        def keep_lease():
            while not stop.wait(10):
                try:
                    if not heartbeat(factory, run_id, token):
                        return
                except Exception:
                    return  # Fail closed at final fencing check.

        lease_thread = threading.Thread(target=keep_lease, daemon=True)
        try:
            lease_thread.start()
            try:
                result = self.fetcher.fetch(
                    fetch_arguments[0], etag=fetch_arguments[1], last_modified=fetch_arguments[2]
                )
            finally:
                stop.set()
                lease_thread.join(timeout=2)
            items = [] if result.status_code == 304 else parse_feed_xml(result.content)
            feed = locked_feed(session, feed_id)
            run = session.scalar(select(FeedRun).where(FeedRun.id == run_id).with_for_update())
            if (
                run.lease_token != token
                or run.state != FeedRunState.RUNNING
                or run.lease_expires_at <= datetime.now(UTC)
            ):
                log_event(
                    logger,
                    logging.WARNING,
                    "feed_run_fenced",
                    run_id=str(run_id),
                    stage="persist",
                )
                session.rollback()
                return FeedExecutionOutcome(
                    session.get(FeedRun, run_id), WorkerRunOutcome.LOST_LEASE
                )
            issues = rights_issues(session, feed)
            if issues or versions != approval_versions(session, feed):
                run.state = FeedRunState.SKIPPED
                run.error_code = "approval_changed_during_fetch"
                run.completed_at = datetime.now(UTC)
                run.lease_token = None
                session.commit()
                return FeedExecutionOutcome(run, WorkerRunOutcome.SKIPPED)
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
            run.lease_token = None
            run.lease_expires_at = None
            run.http_status = result.status_code
            run.fetched_bytes = len(result.content)
            run.parsed_items = len(items)
            run.new_articles = new_articles
            run.completed_at = datetime.now(UTC)
            run.duration_ms = int((time.monotonic() - started) * 1000)
            session.commit()
            log_event(
                logger,
                logging.INFO,
                "feed_run_succeeded",
                run_id=str(run.id),
                feed_id=str(run.feed_id),
                fetched_bytes=run.fetched_bytes,
                parsed_items=run.parsed_items,
                new_articles=run.new_articles,
                duration_ms=run.duration_ms,
            )
            return FeedExecutionOutcome(run, WorkerRunOutcome.SUCCEEDED)
        except Exception as error:
            session.rollback()
            locked_feed(session, feed_id)
            run = session.scalar(select(FeedRun).where(FeedRun.id == run_id).with_for_update())
            if run is None:
                raise
            if (
                run.lease_token != token
                or run.state != FeedRunState.RUNNING
                or run.lease_expires_at <= datetime.now(UTC)
            ):
                session.rollback()
                return FeedExecutionOutcome(
                    session.get(FeedRun, run_id), WorkerRunOutcome.LOST_LEASE
                )
            run.lease_token = None
            run.lease_expires_at = None
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
            if run.state == FeedRunState.RETRYING:
                dispatch(self.queue, run)
            log_event(
                logger,
                logging.WARNING,
                "feed_run_failed",
                run_id=str(run.id),
                feed_id=str(run.feed_id),
                state=run.state.value,
                attempt=run.attempt,
                error_code=run.error_code,
            )
            kind = (
                WorkerRunOutcome.RETRYING
                if run.state == FeedRunState.RETRYING
                else WorkerRunOutcome.DEAD_LETTERED
            )
            return FeedExecutionOutcome(run, kind)


def worker_main(stop_event: threading.Event | None = None) -> None:
    from nuzenio_api.db import SessionLocal

    settings = get_settings()
    configure_logging("nuzenio-worker", settings)
    if is_production(settings.environment):
        from nuzenio_api.db import engine
        from nuzenio_api.db_roles import assert_runtime_identity

        assert_runtime_identity(engine)

    stop = stop_event or threading.Event()
    status = WorkerStatus(stale_after_seconds=settings.worker_stale_after_seconds)
    health_server, health_thread = start_worker_health_server(status, settings)

    def request_shutdown(signum, _frame) -> None:
        log_event(logger, logging.INFO, "worker_shutdown_requested", signal=signum)
        status.stopping()
        stop.set()

    if stop_event is None and threading.current_thread() is threading.main_thread():
        signal.signal(signal.SIGTERM, request_shutdown)
        signal.signal(signal.SIGINT, request_shutdown)

    queue = RedisFeedQueue()
    executor = FeedRunExecutor(queue=queue)
    log_event(
        logger,
        logging.INFO,
        "worker_started",
        health_port=settings.worker_health_port,
        feed_kill_switch=settings.feed_kill_switch,
    )
    try:
        while not stop.is_set():
            try:
                released = queue.release_due()
                if not queue.client.ping():
                    raise redis.RedisError("Redis ping returned a false value")
                with SessionLocal() as session:
                    recovered = recover_queued_runs(session, queue)
                    scheduled = schedule_due_feeds(session, queue)
                status.iteration(
                    dependencies_ready=True,
                    recovered=recovered,
                    scheduled=scheduled,
                )
                log_event(
                    logger,
                    logging.DEBUG,
                    "worker_iteration",
                    released=released,
                    recovered=recovered,
                    scheduled=scheduled,
                )
                run_id = queue.dequeue(timeout=settings.worker_poll_seconds)
                if run_id:
                    status.started_run(run_id)
                    try:
                        with SessionLocal() as session:
                            outcome = executor.execute(session, uuid.UUID(run_id))
                    except Exception:
                        status.finished_run(WorkerRunOutcome.FAILED)
                        raise
                    else:
                        status.finished_run(outcome.kind)
            except Exception as error:
                status.iteration_failed()
                log_event(
                    logger,
                    logging.ERROR,
                    "worker_iteration_failed",
                    error_type=type(error).__name__,
                    durable_recovery_retained=True,
                )
                stop.wait(2)
    finally:
        status.stopping()
        health_server.shutdown()
        health_server.server_close()
        health_thread.join(timeout=2)
        log_event(logger, logging.INFO, "worker_stopped")


if __name__ == "__main__":
    worker_main()
