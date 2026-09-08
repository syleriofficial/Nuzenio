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
from nuzenio_api.environment import is_production
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
_SANITIZING_FILTER_ATTRIBUTE = "_nuzenio_sanitizing_filter"
_MAX_LOG_CONTAINER_DEPTH = 8
_MAX_LOG_CONTAINER_ITEMS = 128
_MAX_LOG_FORMAT_CONVERSIONS = 128
_OMITTED_LOG_COMPOSITION = "[OMITTED UNSAFE OR OVERSIZED LOG COMPOSITION]"
_EXPLICIT_LOG_FIELD = re.compile(r"^[ \t]+[A-Za-z][A-Za-z0-9_.-]*[ \t]*[:=]")


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


def _redact_sensitive_assignments(
    value: str, *, argument_spans: list[tuple[int, int]] | None = None
) -> str:
    """Redact assignment values with a bounded, single-pass scanner."""

    output: list[str] = []
    emitted = 0
    index = 0
    span_index = 0
    spans = argument_spans or []
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
        # The whole interpolation is one untrusted value. A password containing
        # spaces/newlines/delimiters must not leak its tail simply because the
        # free-form scanner would treat that delimiter as the assignment's end.
        # Sorted disjoint spans are traversed once; no prefix rescanning occurs.
        while span_index < len(spans) and spans[span_index][1] <= value_start:
            span_index += 1
        while span_index < len(spans) and spans[span_index][0] <= value_end:
            value_end = max(value_end, spans[span_index][1])
            span_index += 1
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


class _SanitizedLogException(Exception):
    """Non-secret exception value supplied to production logging handlers."""


def _safe_exception_summary(error: BaseException) -> str:
    category = sanitize_log_message(type(error).__name__)
    try:
        sqlstate = getattr(error, "sqlstate", None)
    except Exception:
        sqlstate = None
    suffix = (
        f" (SQLSTATE {sqlstate})"
        if isinstance(sqlstate, str) and re.fullmatch(r"[A-Z0-9]{5}", sqlstate)
        else ""
    )
    # Arbitrary exception text is not data-classified. Database diagnostics in
    # particular may repeat a bound value without a password/token label, so a
    # production sink receives only type/category plus a validated SQLSTATE.
    return f"{category}{suffix}"


def _redact(
    value: Any,
    *,
    _seen: set[int] | None = None,
    _depth: int = 0,
) -> Any:
    if _depth >= _MAX_LOG_CONTAINER_DEPTH:
        return "<maximum log depth>"
    seen = _seen if _seen is not None else set()
    if isinstance(value, BaseException):
        return _safe_exception_summary(value)
    if isinstance(value, dict):
        identity = id(value)
        if identity in seen:
            return "<recursive mapping>"
        seen.add(identity)
        try:
            result = {}
            for index, (key, item) in enumerate(value.items()):
                if index >= _MAX_LOG_CONTAINER_ITEMS:
                    result["<truncated>"] = "<maximum log items>"
                    break
                safe_key = sanitize_log_message(str(key))
                result[safe_key] = (
                    "[REDACTED]"
                    if _is_sensitive_key(str(key), include_cookie=True)
                    else _redact(item, _seen=seen, _depth=_depth + 1)
                )
            return result
        finally:
            seen.remove(identity)
    if isinstance(value, (list, tuple, set, frozenset)):
        identity = id(value)
        if identity in seen:
            return "<recursive sequence>"
        seen.add(identity)
        try:
            items = list(value)
            result = [
                _redact(item, _seen=seen, _depth=_depth + 1)
                for item in items[:_MAX_LOG_CONTAINER_ITEMS]
            ]
            if len(items) > _MAX_LOG_CONTAINER_ITEMS:
                result.append("<maximum log items>")
            return result
        finally:
            seen.remove(identity)
    if isinstance(value, str):
        return sanitize_log_message(value)
    try:
        return json_safe(value)
    except TypeError:
        return f"<{type(value).__name__}>"


def _bounded_format_argument(value: Any) -> str | int | float | bool | None:
    """Never call application-defined renderers from the logging boundary."""

    if type(value) is str:
        return value[:_MAX_LOG_SCAN_LENGTH]
    if type(value) is int:
        if value.bit_length() > 4_096:
            raise ValueError("oversized log integer")
        return value
    if type(value) in {float, bool, type(None)}:
        return value
    raise ValueError("unsupported log argument renderer")


def _sensitive_match_splits_argument(value: str, spans: list[tuple[int, int]]) -> bool:
    """Fail closed when a header/token delimiter splits its actual argument."""

    for pattern in (_BEARER, _COOKIE_HEADER):
        span_index = 0
        for match in pattern.finditer(value):
            while span_index < len(spans) and spans[span_index][1] <= match.start():
                span_index += 1
            while span_index < len(spans) and spans[span_index][0] <= match.end():
                if spans[span_index][1] > match.end():
                    return True
                span_index += 1
    return False


def _compose_log_message(template: Any, arguments: Any) -> str:
    """Compose before redaction without unrestricted percent interpolation.

    Parse a bounded template once, render at most 128 conversions, and bound
    each primitive, field width, precision and the aggregate scan buffer before
    rendering. No caller-defined __str__, __repr__ or mapping hooks execute.
    Invalid/oversized layouts yield only a constant; never their raw arguments
    or a formatting exception. A valid mapping may contain unused values, but
    none are retained on the replacement record.
    """

    if type(template) is not str or type(arguments) not in {tuple, dict}:
        return _OMITTED_LOG_COMPOSITION
    if not arguments:
        return sanitize_log_message(template)
    if len(template) > _MAX_LOG_SCAN_LENGTH:
        return _OMITTED_LOG_COMPOSITION
    # Exact builtin string keys prevent a colliding custom key's __eq__
    # from running during lookup. Bound validation of unused mapping fields
    # too, rather than copying or walking arbitrarily large mappings.
    if type(arguments) is dict and (
        len(arguments) > _MAX_LOG_CONTAINER_ITEMS
        or any(type(key) is not str or len(key) > _MAX_LOG_SCAN_LENGTH for key in arguments)
    ):
        return _OMITTED_LOG_COMPOSITION

    index = 0
    argument_index = 0
    conversions = 0
    remaining = _MAX_LOG_SCAN_LENGTH
    output: list[str] = []
    argument_spans: list[tuple[int, int]] = []
    erased_prefix_pending = False
    last_literal = ""

    def append(value: str, *, interpolated: bool = False) -> None:
        nonlocal remaining, erased_prefix_pending, last_literal
        bounded = value[:remaining]
        # Only a literal field boundary establishes that the next value is
        # independent of a hidden prefix (which could have been a key/header).
        if not interpolated and erased_prefix_pending:
            if bounded.lstrip(" \t").startswith((";", "\r", "\n")) or _EXPLICIT_LOG_FIELD.match(
                bounded
            ):
                erased_prefix_pending = False
            elif any(character not in " \t=:_./\\'\"%-," for character in bounded):
                # A later boundary cannot retroactively make an earlier literal
                # suffix safe after erasing its possible credential label.
                raise ValueError("ambiguous literal after redacted mapping prefix")
        last_literal = "" if interpolated else bounded
        if interpolated and bounded:
            start = _MAX_LOG_SCAN_LENGTH - remaining
            argument_spans.append((start, start + len(bounded)))
        output.append(bounded)
        remaining -= len(bounded)

    def next_argument() -> Any:
        nonlocal argument_index
        if type(arguments) is not tuple or argument_index >= len(arguments):
            raise ValueError("missing positional log argument")
        value = arguments[argument_index]
        argument_index += 1
        return value

    def field_size() -> tuple[str, list[int]]:
        nonlocal index
        if index < len(template) and template[index] == "*":
            index += 1
            size = next_argument()
            if type(size) is not int or abs(size) > _MAX_LOG_SCAN_LENGTH:
                raise ValueError("oversized log field")
            return "*", [size]
        start = index
        while index < len(template) and template[index] in string.digits:
            index += 1
        digits = template[start:index]
        if len(digits) > 5 or (digits and int(digits) > _MAX_LOG_SCAN_LENGTH):
            raise ValueError("oversized log field")
        return digits, []

    try:
        while index < len(template) and remaining:
            if template[index] != "%":
                start = index
                while index < len(template) and template[index] != "%":
                    index += 1
                append(template[start:index])
                continue
            index += 1
            if index < len(template) and template[index] == "%":
                append("%")
                index += 1
                continue
            conversions += 1
            if conversions > _MAX_LOG_FORMAT_CONVERSIONS:
                raise ValueError("too many log conversions")

            key: str | None = None
            if index < len(template) and template[index] == "(":
                index += 1
                start = index
                depth = 1
                while index < len(template) and depth:
                    if template[index] == "(":
                        depth += 1
                    elif template[index] == ")":
                        depth -= 1
                    index += 1
                if depth or type(arguments) is not dict:
                    raise ValueError("invalid log mapping")
                key = template[start : index - 1]

            flags_start = index
            while index < len(template) and template[index] in "#0- +":
                index += 1
            flags = template[flags_start:index]
            if len(flags) > 8:
                raise ValueError("oversized log flags")
            width, render_arguments = field_size()
            precision = ""
            if index < len(template) and template[index] == ".":
                index += 1
                digits, precision_arguments = field_size()
                precision = "." + digits
                render_arguments.extend(precision_arguments)
            modifier = ""
            if index < len(template) and template[index] in "hlL":
                modifier = template[index]
                index += 1
            if index >= len(template) or template[index] not in "diouxXeEfFgGcrsa":
                raise ValueError("invalid log conversion")
            conversion = template[index]
            index += 1
            if key is not None and key not in arguments:
                raise KeyError(key)
            if key is not None and _is_sensitive_key(key, include_cookie=True):
                # Preserve mapping metadata even when the visible message omits
                # the sensitive identifier. Never render/read its original value;
                # flags and precision cannot truncate or transform this marker.
                # A statically labelled value (credential=%(password)s) cannot
                # itself be the missing label. Preserve its safe literal suffix.
                literal = last_literal.rstrip(" \t")
                field = literal[:-1].rstrip(" \t").rsplit(None, 1)
                labelled_value = (
                    literal.endswith(("=", ":"))
                    and bool(field)
                    and _split_identifier(field[-1]) is not None
                )
                append("[REDACTED]", interpolated=True)
                erased_prefix_pending = not labelled_value
                continue
            if erased_prefix_pending:
                # The erased value may have supplied an assignment/header name.
                # Do not expose following unclassified data after losing that
                # syntax. No original value is rendered for this determination.
                return "[REDACTED]"
            argument = arguments[key] if key is not None else next_argument()
            render_arguments.append(_bounded_format_argument(argument))
            token = "%" + flags + width + precision + modifier + conversion
            # This token and every input it can expand have already been bounded.
            append(token % tuple(render_arguments), interpolated=True)
        if remaining and type(arguments) is tuple and argument_index != len(arguments):
            raise ValueError("unused positional log arguments")
    except (KeyError, TypeError, ValueError, OverflowError):
        return _OMITTED_LOG_COMPOSITION
    composed = "".join(output)
    if _sensitive_match_splits_argument(composed, argument_spans):
        return "[REDACTED]"
    composed = _redact_sensitive_assignments(composed, argument_spans=argument_spans)
    return sanitize_log_message(composed)


def _safe_exception_info(exc_info: Any) -> Any:
    if not isinstance(exc_info, tuple) or len(exc_info) != 3:
        return None
    error = exc_info[1]
    if not isinstance(error, BaseException):
        return None
    sanitized = _SanitizedLogException(_safe_exception_summary(error))
    return (_SanitizedLogException, sanitized, None)


def _sanitized_log_record(record: logging.LogRecord) -> logging.LogRecord:
    """Return a detached record containing no original mutable or exception objects."""

    attributes = record.__dict__.copy()
    # Sensitive identifiers can be assembled by positional/mapping interpolation.
    # Compose and sanitize before existing filters, not just the JSON formatter.
    # Clearing args also removes unclassified raw material from telemetry sinks.
    attributes["msg"] = _compose_log_message(record.msg, record.args)
    attributes["args"] = ()
    attributes.pop("message", None)
    attributes["exc_info"] = _safe_exception_info(record.exc_info)
    # Pre-rendered exception text cannot be proven to exclude unlabeled bound
    # values. A safe replacement will be rendered from `exc_info` when present.
    attributes["exc_text"] = "[REDACTED EXCEPTION TEXT]" if record.exc_text else None
    attributes["stack_info"] = (
        sanitize_log_message(record.stack_info) if isinstance(record.stack_info, str) else None
    )
    for key, item in tuple(attributes.items()):
        if key in _STANDARD_RECORD_FIELDS:
            continue
        if _is_sensitive_key(str(key), include_cookie=True):
            attributes[key] = "[REDACTED]"
        else:
            attributes[key] = _redact(item)
    return logging.makeLogRecord(attributes)


class _ProductionSanitizingFilter(logging.Filter):
    """Give each configured production sink its own sanitized record clone."""

    _nuzenio_sanitizing_filter = True

    def filter(self, record: logging.LogRecord) -> logging.LogRecord:
        return _sanitized_log_record(record)


def _secure_existing_logging_handlers() -> None:
    loggers = [logging.getLogger()]
    loggers.extend(
        logger
        for logger in logging.root.manager.loggerDict.values()
        if isinstance(logger, logging.Logger)
    )
    handlers: dict[int, logging.Handler] = {}
    for logger in loggers:
        handlers.update((id(handler), handler) for handler in logger.handlers)
    for handler in handlers.values():
        if any(
            getattr(existing_filter, _SANITIZING_FILTER_ATTRIBUTE, False)
            for existing_filter in handler.filters
        ):
            continue
        # Run before pre-existing handler filters so none can observe the original.
        handler.filters.insert(0, _ProductionSanitizingFilter())


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
    if is_production(configured.environment):
        _secure_existing_logging_handlers()


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
