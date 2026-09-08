from __future__ import annotations

import contextvars
import json
import logging
import re
import string
import sys
import threading
from collections import Counter
from datetime import UTC, datetime
from time import monotonic
from typing import Any
from urllib.parse import unquote

import redis
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nuzenio_api.config import Settings, get_settings
from nuzenio_api.database_security import configure_sqlalchemy_logging
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
_MAX_LOG_MESSAGE_LENGTH = 8_192
_MAX_LOG_SCAN_LENGTH = 16_384
_MAX_PERCENT_DECODE_PASSES = 2
_TRUNCATED_SUFFIX = "...[TRUNCATED]"
_ENCODED_SECRET_REDACTION = "[REDACTED ENCODED SENSITIVE LOG MESSAGE]"
_CREDENTIAL_URI_PREFIX = re.compile(
    r"(?i)(?:postgres(?:ql)?(?:\+[a-z0-9_-]+)?|rediss?)"
    r"(?::|%3a)(?://|%2f%2f)"
)
_AUTHORITY_CREDENTIAL_SEPARATOR = re.compile(r"(?i):|%3a")
_BEARER = re.compile(r"(?i)(?<![a-z])(bearer)(?:\s+|%(?:09|0a|0d|20))+[a-z0-9._~+/=%:-]+")
_COOKIE_HEADER = re.compile(r"(?i)\b((?:set-)?cookie\s*[:=]\s*)[^\r\n]+")
_KEY_CHARS = frozenset(string.ascii_letters + string.digits + "_.-")
_KEY_SEPARATORS = frozenset("_.-")
_SENSITIVE_KEY_PARTS = frozenset(
    {"password", "passwd", "pwd", "token", "secret", "session", "csrf", "authorization"}
)
_SENSITIVE_KEY_SUFFIXES = frozenset({("session", "hash", "pepper"), ("api", "key")})
_OWNED_HANDLER_ATTRIBUTE = "_nuzenio_owned_handler"


def _split_identifier(value: str) -> tuple[str, ...] | None:
    """Split the bounded identifier in one pass, rejecting empty/unsafe parts."""

    if not value or len(value) > _MAX_LOG_SCAN_LENGTH:
        return None
    parts: list[str] = []
    start = 0
    for index, character in enumerate(value):
        if character in _KEY_SEPARATORS:
            if index == start:
                return None
            parts.append(value[start:index].lower())
            start = index + 1
        elif character not in _KEY_CHARS:
            return None
    if start == len(value):
        return None
    parts.append(value[start:].lower())
    return tuple(parts)


def _is_sensitive_key(value: str, *, include_cookie: bool = False) -> bool:
    parts = _split_identifier(value)
    if not parts:
        return False
    if parts[-1] in _SENSITIVE_KEY_PARTS:
        return True
    if include_cookie and parts[-1] == "cookie":
        return True
    return any(
        len(parts) >= len(suffix) and parts[-len(suffix) :] == suffix
        for suffix in _SENSITIVE_KEY_SUFFIXES
    )


def _quote_at(value: str, index: int) -> str | None:
    if value.startswith('\\"', index):
        return '\\"'
    if value.startswith("\\'", index):
        return "\\'"
    if index < len(value) and value[index] in {'"', "'"}:
        return value[index]
    return None


def _parse_assignment_key(value: str, index: int) -> tuple[str, int, int] | None:
    quote = _quote_at(value, index)
    key_start = index + len(quote) if quote else index
    if key_start >= len(value) or value[key_start] not in _KEY_CHARS:
        return None
    if not quote and index > 0 and value[index - 1] in _KEY_CHARS:
        return None
    cursor = key_start
    while cursor < len(value) and value[cursor] in _KEY_CHARS:
        cursor += 1
    key = value[key_start:cursor]
    if quote:
        if not value.startswith(quote, cursor):
            return None
        cursor += len(quote)
    if cursor < len(value) and value[cursor] in _KEY_CHARS:
        return None
    return key, cursor, max(cursor, index + 1)


def _assignment_value_end(value: str, start: int, separator: str) -> int:
    if start >= len(value):
        return start
    quote = _quote_at(value, start)
    if quote:
        cursor = start + len(quote)
        while cursor < len(value):
            if value.startswith(quote, cursor):
                return cursor + len(quote)
            cursor += 1
        return len(value)
    if separator == ":" and value[start] in "|>":
        # Common YAML diagnostic blocks are conservatively removed through the
        # bounded scan tail; guessing indentation could expose a continuation.
        return len(value)
    cursor = start
    while cursor < len(value) and value[cursor] not in "\r\n\t ,;}])":
        cursor += 1
    return cursor


def _redact_sensitive_assignments(value: str) -> str:
    """Redact assignment values with a bounded, single-pass scanner."""

    output: list[str] = []
    emitted = 0
    index = 0
    length = len(value)
    while index < length:
        parsed = _parse_assignment_key(value, index)
        if parsed is None:
            index += 1
            continue
        key, cursor, advance = parsed
        whitespace = cursor
        while whitespace < length and value[whitespace].isspace():
            whitespace += 1
        if whitespace >= length or value[whitespace] not in ":=":
            index = advance
            continue
        separator = value[whitespace]
        value_start = whitespace + 1
        while value_start < length and value[value_start].isspace():
            value_start += 1
        if not _is_sensitive_key(key):
            index = max(value_start, advance)
            continue
        value_end = _assignment_value_end(value, value_start, separator)
        output.append(value[emitted:value_start])
        output.append("[REDACTED]")
        emitted = value_end
        index = max(value_end, value_start + 1)
    if not output:
        return value
    output.append(value[emitted:])
    return "".join(output)


def _redact_credential_uris(value: str) -> str:
    """Redact complete and scan-window-truncated PostgreSQL/Redis userinfo."""

    parts: list[str] = []
    cursor = 0
    while prefix := _CREDENTIAL_URI_PREFIX.search(value, cursor):
        parts.append(value[cursor : prefix.end()])
        authority_start = prefix.end()
        boundary = len(value)
        terminator_start: int | None = None
        terminator_end: int | None = None
        scan_cursor = authority_start
        while scan_cursor < len(value):
            if value[scan_cursor] in "/?#":
                boundary = scan_cursor
                break
            if value[scan_cursor] == "@":
                terminator_start = scan_cursor
                terminator_end = scan_cursor + 1
                break
            if value[scan_cursor : scan_cursor + 3].lower() == "%40":
                terminator_start = scan_cursor
                terminator_end = scan_cursor + 3
                break
            scan_cursor += 1

        if terminator_start is not None and terminator_end is not None:
            credentials = value[authority_start:terminator_start]
            if _AUTHORITY_CREDENTIAL_SEPARATOR.search(credentials):
                parts.extend(("[REDACTED]", value[terminator_start:terminator_end]))
                cursor = terminator_end
                continue
        elif boundary == len(value):
            # The bounded scan may end in the middle of a username/password and
            # before the @host delimiter. Conservatively redact the unfinished
            # authority rather than emitting a credential prefix.
            parts.append("[REDACTED]")
            cursor = len(value)
            break

        cursor = prefix.end()

    parts.append(value[cursor:])
    return "".join(parts)


def _sanitize_visible_log_message(value: str) -> str:
    result = _redact_credential_uris(value)
    result = _BEARER.sub(r"\1 [REDACTED]", result)
    result = _COOKIE_HEADER.sub(r"\1[REDACTED]", result)
    return _redact_sensitive_assignments(result)


def sanitize_log_message(value: str) -> str:
    """Bounded defense for free-form and third-party log strings.

    Percent-decoded values are used only as a detection shadow. They are never
    returned, because logging a newly decoded representation can itself reveal
    material that the caller did not submit in clear text.
    """

    truncated = len(value) > _MAX_LOG_MESSAGE_LENGTH
    visible_limit = (
        _MAX_LOG_MESSAGE_LENGTH - len(_TRUNCATED_SUFFIX) if truncated else _MAX_LOG_MESSAGE_LENGTH
    )
    scan = value[:_MAX_LOG_SCAN_LENGTH]
    sanitized_scan = _sanitize_visible_log_message(scan)

    shadow = scan
    for _ in range(_MAX_PERCENT_DECODE_PASSES):
        try:
            decoded = unquote(shadow, errors="replace")[:_MAX_LOG_SCAN_LENGTH]
        except (UnicodeError, ValueError):
            break
        if decoded == shadow:
            break
        if _sanitize_visible_log_message(decoded) != decoded:
            return _ENCODED_SECRET_REDACTION
        shadow = decoded

    suffix = _TRUNCATED_SUFFIX if truncated else ""
    return (sanitized_scan[:visible_limit] + suffix)[:_MAX_LOG_MESSAGE_LENGTH]


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            sanitize_log_message(str(key)): (
                "[REDACTED]" if _is_sensitive_key(str(key), include_cookie=True) else _redact(item)
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


class _NuzenioStreamHandler(logging.StreamHandler):
    """Marker class allowing idempotent replacement without touching telemetry handlers."""

    _nuzenio_owned_handler = True


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
    handler = _NuzenioStreamHandler(sys.stdout)
    if configured.log_json:
        handler.setFormatter(JsonLogFormatter(service))
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    for existing_handler in root.handlers[:]:
        if getattr(existing_handler, _OWNED_HANDLER_ATTRIBUTE, False):
            root.removeHandler(existing_handler)
            existing_handler.close()
    root.addHandler(handler)
    root.setLevel(configured.log_level)
    configure_sqlalchemy_logging(configured.environment)
    logger_names = {
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
    }
    logger_names.update(
        name for name in logging.root.manager.loggerDict if name.startswith(("uvicorn.",))
    )
    for logger_name in logger_names:
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
