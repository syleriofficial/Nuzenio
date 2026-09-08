from __future__ import annotations

import copy
import io
import json
import logging
import secrets
import threading
from contextlib import redirect_stdout
from time import monotonic
from urllib.parse import quote

import pytest

from nuzenio_api.config import Settings
from nuzenio_api.observability import _sanitized_log_record, configure_logging


class _RawSink(logging.Handler):
    def __init__(self) -> None:
        super().__init__(logging.INFO)
        self.records: list[dict] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record.__dict__.copy())


class _ExistingFilter(logging.Filter):
    def __init__(self) -> None:
        super().__init__()
        self.records: list[dict] = []

    def filter(self, record: logging.LogRecord) -> bool:
        self.records.append(record.__dict__.copy())
        return True


@pytest.fixture
def production_sinks():
    root = logging.getLogger()
    logger = logging.getLogger("nuzenio.composition-regression")
    prior_root = (root.handlers[:], root.level)
    prior_logger = (logger.handlers[:], logger.level, logger.propagate)
    plain_output, json_output = io.StringIO(), io.StringIO()
    plain = logging.StreamHandler(plain_output)
    plain.setLevel(logging.WARNING)
    plain.setFormatter(logging.Formatter("existing %(levelname)s: %(message)s"))
    filter_ = _ExistingFilter()
    plain.addFilter(filter_)
    root_sink, descendant_sink = _RawSink(), _RawSink()
    settings = Settings(
        environment="production",
        demo_mode=False,
        cookie_secure=True,
        session_hash_pepper="regression-only-valid-pepper-with-more-than-32-characters",
        cors_origins=["https://news.example"],
        allowed_hosts=["news.example"],
        feed_https_required=True,
        feed_kill_switch=True,
        metrics_token="regression-only-valid-metrics-token-over-32-characters",
        database_url="postgresql+psycopg://nuzenio_runtime:regression-password@db.example/nuzenio",
        redis_url="rediss://:regression-password@redis.example/0",
        log_level="INFO",
        _env_file=None,
    )
    try:
        root.handlers = [plain, root_sink]
        logger.handlers = [descendant_sink]
        logger.setLevel(logging.INFO)
        logger.propagate = True
        with redirect_stdout(json_output):
            for _ in range(4):
                configure_logging("composition-regression", settings)
            yield logger, plain_output, json_output, root_sink, descendant_sink, filter_
    finally:
        root.handlers, root.level = prior_root
        logger.handlers, logger.level, logger.propagate = prior_logger


@pytest.mark.parametrize("case", ["positional-key", "whole-key", "mapping-key"])
@pytest.mark.parametrize("origin", ["root", "descendant"])
def test_composed_assignment_is_safe_before_every_existing_sink(production_sinks, case, origin):
    logger, plain, structured, root_sink, descendant_sink, filter_ = production_sinks
    canary = f"composed-{secrets.token_hex(12)}"
    diagnostic = {"safe": [42], "password": canary}
    arguments = {
        "positional-key": ("db_%s=%s", ("password", canary)),
        "whole-key": ("%s=%s", ("api_token", canary)),
        "mapping-key": (
            "%(field_name)s=%(field_value)s",
            ({"field_name": "api_token", "field_value": canary},),
        ),
    }
    template, args = arguments[case]
    original_arguments = copy.deepcopy(args)
    emitter = logging.getLogger() if origin == "root" else logger
    emitter.error(template, *args, extra={"diagnostic": diagnostic})
    all_output = repr(
        [
            plain.getvalue(),
            structured.getvalue(),
            root_sink.records,
            descendant_sink.records,
            filter_.records,
        ]
    )
    assert canary not in all_output
    assert len(root_sink.records) == len(filter_.records) == 1
    assert len(descendant_sink.records) == (1 if origin == "descendant" else 0)
    assert len(structured.getvalue().splitlines()) == 1
    for sink in (root_sink, descendant_sink, filter_):
        for record in sink.records:
            assert record["args"] == ()
            assert "[REDACTED]" in record["msg"]
    assert diagnostic == {"safe": [42], "password": canary}
    assert args == original_arguments


@pytest.mark.parametrize("encoding_passes", [0, 1, 2])
def test_composition_sanitizes_encoded_nested_and_boundary_material(
    production_sinks, encoding_passes
):
    logger, plain, structured, root_sink, descendant_sink, filter_ = production_sinks
    canary = f"boundary-{secrets.token_hex(10)}"
    value = f"api_token={canary}"
    for _ in range(encoding_passes):
        value = quote(value, safe="")
    original = {"details": [value], "safe": {"count": 2}}
    logger.error("%s%s", "safe-prefix " * 650, value + "x" * 20_000, extra={"diagnostic": original})
    output = repr(
        [
            plain.getvalue(),
            structured.getvalue(),
            root_sink.records,
            descendant_sink.records,
            filter_.records,
        ]
    )
    assert canary not in output
    assert original["details"] == [value]
    assert original["safe"] == {"count": 2}
    assert len(root_sink.records[0]["msg"]) <= 8192
    assert root_sink.records[0]["args"] == ()


@pytest.mark.parametrize("separator", [" ", "\n", ",", ";", "\t"])
def test_sensitive_interpolation_is_one_value_even_with_delimiters(production_sinks, separator):
    logger, plain, structured, root_sink, descendant_sink, filter_ = production_sinks
    canary = f"whole-argument-{secrets.token_hex(12)}"
    logger.error("db_%s=%s", "password", f"prefix{separator}{canary}")
    logger.error("%s=%s%s; safe=%d", "api_token", f"prefix{separator}", canary, 42)
    logger.error("%s", f"client_secret=prefix{separator}{canary}")
    output = repr(
        [
            plain.getvalue(),
            structured.getvalue(),
            root_sink.records,
            descendant_sink.records,
            filter_.records,
        ]
    )
    assert canary not in output
    assert root_sink.records[1]["msg"].endswith("; safe=42")
    assert all(record["args"] == () for record in root_sink.records)


@pytest.mark.parametrize(
    ("template", "arguments", "expected"),
    [
        ("safe %s", ("queue",), "safe queue"),
        ("queue %d / %.2f", (3, 1.25), "queue 3 / 1.25"),
        ("%(name)s: %(count)04d", {"name": "queue", "count": 3}, "queue: 0003"),
        ("[%*.*s]", (7, 3, "fixture"), "[    fix]"),
        ("[%*s]", (-7, "safe"), "[safe   ]"),
        ("%#x %% %c", (16, 65), "0x10 % A"),
        ("%r %a", ("हिंदी", "हिंदी"), "'हिंदी' '\\u0939\\u093f\\u0902\\u0926\\u0940'"),
    ],
)
def test_safe_positional_and_mapping_formatting_preserves_output(template, arguments, expected):
    record = logging.LogRecord("fixture", logging.INFO, __file__, 1, template, (), None)
    record.args = arguments
    replacement = _sanitized_log_record(record)
    assert replacement.getMessage() == expected
    assert replacement.args == ()
    assert record.msg == template
    assert record.args is arguments


@pytest.mark.parametrize("template", ["Bearer %s", "%s", "Cookie: %s"])
def test_token_and_header_arguments_cannot_leak_delimited_tails(production_sinks, template):
    logger, plain, structured, root_sink, descendant_sink, filter_ = production_sinks
    canary = f"header-tail-{secrets.token_hex(10)}"
    value = f"prefix\n{canary}"
    if template == "%s":
        value = f"Authorization: Bearer {value}"
    logger.error(template, value)
    output = repr(
        [
            plain.getvalue(),
            structured.getvalue(),
            root_sink.records,
            descendant_sink.records,
            filter_.records,
        ]
    )
    assert canary not in output
    assert root_sink.records[0]["args"] == ()


@pytest.mark.parametrize(
    ("template", "arguments"),
    [
        ("api_token=%1000000000s", ("canary",)),
        ("api_token=%.1000000000s", ("canary",)),
        ("api_token=%*s", (10**9, "canary")),
        ("api_token=%.*s", (10**9, "canary")),
        ("api_token=%(missing)s", {"value": "canary"}),
        ("api_token=%q", ("canary",)),
        ("api_token=%", ("canary",)),
        ("api_token=%d", ("canary",)),
        ("api_token=%s %s", ("canary",)),
        ("api_token=%s", ("canary", "extra")),
        ("api_token=%999999999999999999999999999999999999999s", ("canary",)),
        ("api_token=%d", (1 << 100_000,)),
        ("api_token=%(value)s", {"value": "canary", "other": "unused"}),
    ],
)
def test_hostile_formatting_is_bounded_and_never_retains_arguments(template, arguments):
    record = logging.LogRecord("fixture", logging.ERROR, __file__, 1, template, (), None)
    record.args = arguments
    start = monotonic()
    replacement = _sanitized_log_record(record)
    assert monotonic() - start < 0.5
    assert len(replacement.getMessage()) <= 8192
    assert "canary" not in repr(replacement.__dict__)
    assert replacement.args == ()
    assert record.args is arguments


def test_untrusted_argument_renderers_are_not_executed():
    class Hostile:
        def __str__(self):
            raise AssertionError("application renderer must not execute")

        __repr__ = __str__

    arguments = (Hostile(),)
    record = logging.LogRecord("fixture", logging.ERROR, __file__, 1, "%s", arguments, None)
    replacement = _sanitized_log_record(record)
    assert replacement.args == ()
    assert len(replacement.getMessage()) <= 8192
    assert record.args is arguments


def test_mapping_key_comparison_hooks_are_not_executed():
    class HostileKey:
        def __hash__(self):
            return hash("safe")

        def __eq__(self, other):
            raise AssertionError("custom mapping comparison must not execute")

    arguments = {HostileKey(): "canary"}
    record = logging.LogRecord("fixture", logging.ERROR, __file__, 1, "%(safe)s", (), None)
    record.args = arguments
    replacement = _sanitized_log_record(record)
    assert replacement.args == ()
    assert "canary" not in repr(replacement.__dict__)
    assert record.args is arguments


def test_oversized_arguments_templates_and_many_conversions_are_bounded():
    cases = [
        ("%s", ("safe " * 1_000_000,)),
        ("safe " * 1_000_000 + "%s", ("canary",)),
        ("%.0s" * 1_000, ("x" * 20_000,) * 1_000),
        ("%(safe)s", {str(index): "canary" for index in range(10_000)}),
    ]
    start = monotonic()
    for template, arguments in cases:
        record = logging.LogRecord("fixture", logging.ERROR, __file__, 1, template, (), None)
        record.args = arguments
        replacement = _sanitized_log_record(record)
        assert len(replacement.getMessage()) <= 8192
        assert "canary" not in repr(replacement.__dict__)
        assert replacement.args == ()
    assert monotonic() - start < 0.5


def test_repeated_initialization_and_concurrent_logging_keep_sink_behavior(production_sinks):
    logger, plain, structured, root_sink, descendant_sink, filter_ = production_sinks

    def emit(worker):
        for sequence in range(25):
            logger.warning("safe worker=%d sequence=%d", worker, sequence)

    threads = [threading.Thread(target=emit, args=(worker,)) for worker in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=10)
        assert not thread.is_alive()
    logger.info("safe info count=%d", 200)
    assert len(root_sink.records) == len(descendant_sink.records) == 201
    assert len(filter_.records) == len(plain.getvalue().splitlines()) == 200
    assert len(structured.getvalue().splitlines()) == 201
    messages = [record["msg"] for record in root_sink.records]
    assert len(set(messages)) == 201
    assert all(record["args"] == () for record in root_sink.records)
    assert all(
        json.loads(line)["service"] == "composition-regression"
        for line in structured.getvalue().splitlines()
    )
