from __future__ import annotations

import contextvars
import json
import logging
import re
import sys
import threading
from collections import Counter
from datetime import UTC, datetime
from time import monotonic
from typing import Any

import redis
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nuzenio_api.config import Settings, get_settings
from nuzenio_api.models import DeadLetterJob, EditorialReview, FeedRun, FeedRunState, ReviewState
from nuzenio_api.serialization import json_safe

correlation_id_context: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "nuzenio_correlation_id", default=None
)
_request_lock = threading.Lock()
_request_counts: Counter[tuple[str, str, int]] = Counter()
_request_duration_seconds: Counter[tuple[str, str]] = Counter()

_STANDARD_RECORD_FIELDS = frozenset(
    {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "module",
        "msecs",
        "message",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "thread",
        "threadName",
    }
)
_SENSITIVE_FRAGMENTS = ("password", "token", "secret", "cookie", "authorization", "csrf")
_CREDENTIAL_URI = re.compile(
    r"(?is)((?:postgres(?:ql)?(?:\+[a-z0-9_-]+)?|rediss?)(?::|%3a)(?://|%2f%2f))"
    r"[a-z0-9_.+%-]{0,128}(?::|%3a)(?:(?!@|%40|/).){1,512}?(@|%40)"
)
_BEARER = re.compile(r"(?i)(?<![a-z])(bearer)(?:\s+|%(?:09|0a|0d|20))+[a-z0-9._~+/=%:-]+")
_COOKIE_HEADER = re.compile(r"(?i)\b((?:set-)?cookie\s*[:=]\s*)[^\r\n]+")
_ASSIGNMENT = re.compile(
    r"(?i)\b(password|passwd|pwd|token|secret|session|csrf|authorization)"
    r"(\s*[:=]\s*)(?:\"[^\"]*\"|'[^']*'|[^\s,;]+)"
)
_ENCODED_ASSIGNMENT = re.compile(
    r"(?i)\b(password|passwd|pwd|token|secret|session|csrf|authorization)"
    r"%3d(?:%22[^%]*(?:%22|$)|%27[^%]*(?:%27|$)|[^%\s,;]+)"
)


def sanitize_log_message(value: str) -> str:
    """Best-effort defense for free-form and third-party log strings."""

    result = _CREDENTIAL_URI.sub(r"\1[REDACTED]\2", value)
    result = _BEARER.sub(r"\1 [REDACTED]", result)
    result = _COOKIE_HEADER.sub(r"\1[REDACTED]", result)
    result = _ASSIGNMENT.sub(r"\1\2[REDACTED]", result)
    return _ENCODED_ASSIGNMENT.sub(r"\1%3D[REDACTED]", result)


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): (
                "[REDACTED]"
                if any(fragment in str(key).casefold() for fragment in _SENSITIVE_FRAGMENTS)
                else _redact(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_redact(item) for item in value]
    if isinstance(value, str):
        return sanitize_log_message(value)
    try:
        return json_safe(value)
    except TypeError:
        return f"<{type(value).__name__}>"


class JsonLogFormatter(logging.Formatter):
    def __init__(self, service: str) -> None:
        super().__init__()
        self.service = service

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "service": self.service,
            "logger": record.name,
            "event": sanitize_log_message(str(getattr(record, "event", record.getMessage()))),
        }
        correlation_id = getattr(record, "correlation_id", None) or correlation_id_context.get()
        if correlation_id:
            payload["correlation_id"] = correlation_id
        fields = getattr(record, "fields", None)
        if isinstance(fields, dict):
            payload.update(_redact(fields))
        extras = {
            key: value
            for key, value in record.__dict__.items()
            if key not in _STANDARD_RECORD_FIELDS
            and key not in {"event", "fields", "correlation_id"}
            and not key.startswith("_")
        }
        if extras:
            payload["context"] = _redact(extras)
        if record.exc_info:
            payload["exception_type"] = record.exc_info[0].__name__
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)


def configure_logging(service: str, settings: Settings | None = None) -> None:
    configured = settings or get_settings()
    handler = logging.StreamHandler(sys.stdout)
    if configured.log_json:
        handler.setFormatter(JsonLogFormatter(service))
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(configured.log_level)
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        logger.propagate = True
        # The middleware emits bounded route-template events; Uvicorn access logs
        # can include raw paths and query strings.
        logger.disabled = logger_name == "uvicorn.access"


def log_event(
    logger: logging.Logger,
    level: int,
    event: str,
    **fields: Any,
) -> None:
    logger.log(level, event, extra={"event": event, "fields": fields})


def observe_request(method: str, route: str, status: int, started: float) -> None:
    elapsed = max(0.0, monotonic() - started)
    with _request_lock:
        _request_counts[(method, route, status)] += 1
        _request_duration_seconds[(method, route)] += elapsed


def request_metrics() -> list[str]:
    with _request_lock:
        counts = sorted(_request_counts.items())
        durations = sorted(_request_duration_seconds.items())
    lines = [
        "# HELP nuzenio_http_requests_total HTTP requests handled by route and status.",
        "# TYPE nuzenio_http_requests_total counter",
    ]
    for (method, route, status), value in counts:
        lines.append(
            "nuzenio_http_requests_total"
            f'{{method="{method}",route="{route}",status="{status}"}} {value}'
        )
    lines.extend(
        [
            "# HELP nuzenio_http_request_duration_seconds_total "
            "Cumulative request duration by route.",
            "# TYPE nuzenio_http_request_duration_seconds_total counter",
        ]
    )
    for (method, route), value in durations:
        lines.append(
            "nuzenio_http_request_duration_seconds_total"
            f'{{method="{method}",route="{route}"}} {value:.6f}'
        )
    return lines


def operational_metrics(session: Session, redis_client: redis.Redis) -> list[str]:
    lines = [
        "# HELP nuzenio_feed_runs Feed runs by current durable state.",
        "# TYPE nuzenio_feed_runs gauge",
    ]
    for state in FeedRunState:
        count = int(
            session.scalar(select(func.count()).select_from(FeedRun).where(FeedRun.state == state))
            or 0
        )
        lines.append(f'nuzenio_feed_runs{{state="{state.value}"}} {count}')

    now = datetime.now(UTC)
    active_leases = int(
        session.scalar(
            select(func.count())
            .select_from(FeedRun)
            .where(
                FeedRun.state == FeedRunState.RUNNING,
                FeedRun.lease_expires_at > now,
            )
        )
        or 0
    )
    abandoned = int(
        session.scalar(
            select(func.count())
            .select_from(FeedRun)
            .where(
                FeedRun.state == FeedRunState.RUNNING,
                (FeedRun.lease_expires_at.is_(None)) | (FeedRun.lease_expires_at <= now),
            )
        )
        or 0
    )
    retries = int(
        session.scalar(select(func.count()).select_from(FeedRun).where(FeedRun.attempt > 1)) or 0
    )
    dead_letters = int(
        session.scalar(
            select(func.count())
            .select_from(DeadLetterJob)
            .where(DeadLetterJob.retried_at.is_(None))
        )
        or 0
    )
    lines.extend(
        [
            "# HELP nuzenio_worker_active_leases Active, unexpired feed-run leases.",
            "# TYPE nuzenio_worker_active_leases gauge",
            f"nuzenio_worker_active_leases {active_leases}",
            "# HELP nuzenio_worker_abandoned_runs RUNNING rows whose lease is absent or expired.",
            "# TYPE nuzenio_worker_abandoned_runs gauge",
            f"nuzenio_worker_abandoned_runs {abandoned}",
            "# HELP nuzenio_feed_retry_runs Feed runs that have required more than one attempt.",
            "# TYPE nuzenio_feed_retry_runs gauge",
            f"nuzenio_feed_retry_runs {retries}",
            "# HELP nuzenio_dead_letters_unreplayed Dead letters awaiting an explicit replay.",
            "# TYPE nuzenio_dead_letters_unreplayed gauge",
            f"nuzenio_dead_letters_unreplayed {dead_letters}",
        ]
    )

    lines.extend(
        [
            "# HELP nuzenio_editorial_reviews Editorial reviews by state.",
            "# TYPE nuzenio_editorial_reviews gauge",
        ]
    )
    for state in ReviewState:
        count = int(
            session.scalar(
                select(func.count())
                .select_from(EditorialReview)
                .where(EditorialReview.state == state)
            )
            or 0
        )
        lines.append(f'nuzenio_editorial_reviews{{state="{state.value}"}} {count}')

    try:
        ready_depth = int(redis_client.llen("nuzenio:feed-runs:ready"))
        scheduled_depth = int(redis_client.zcard("nuzenio:feed-runs:scheduled"))
        redis_up = 1
    except redis.RedisError:
        ready_depth = 0
        scheduled_depth = 0
        redis_up = 0
    lines.extend(
        [
            "# HELP nuzenio_queue_depth Feed jobs waiting for immediate or scheduled dispatch.",
            "# TYPE nuzenio_queue_depth gauge",
            f'nuzenio_queue_depth{{queue="ready"}} {ready_depth}',
            f'nuzenio_queue_depth{{queue="scheduled"}} {scheduled_depth}',
            "# HELP nuzenio_redis_up Whether the API metrics collector can reach Redis.",
            "# TYPE nuzenio_redis_up gauge",
            f"nuzenio_redis_up {redis_up}",
        ]
    )
    return lines


def render_metrics(session: Session, redis_client: redis.Redis) -> str:
    return "\n".join([*request_metrics(), *operational_metrics(session, redis_client), ""])
