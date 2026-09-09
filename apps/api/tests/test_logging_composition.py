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
from nuzenio_api.observability import (
    _OMITTED_LOG_COMPOSITION,
    _sanitized_log_record,
    configure_logging,
)


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


def _production_settings():
    return Settings(
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
    settings = _production_settings()
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


@pytest.mark.parametrize(
    "key",
    [
        "password",
        "db_password",
        "api_token",
        "session_hash_pepper",
        "authorization",
        "cookie",
        "Database.Password",
        "DATABASE-PASSWORD",
        "API.Token",
        "Api-Token",
        "CLIENT_SECRET",
        "Client.Secret",
        "client-secret",
        "NUZENIO_SESSION_HASH_PEPPER",
        "Csrf_Token",
        "access.token",
        "refresh-token",
        "api_key",
        "signing.secret",
        "Set-Cookie",
    ],
)
@pytest.mark.parametrize("origin", ["root", "descendant"])
def test_named_sensitive_mapping_omits_whole_message_before_every_sink(
    production_sinks, key, origin
):
    logger, plain, structured, root_sink, descendant_sink, filter_ = production_sinks
    # Pytest installs additional capture sinks between fixture setup and call.
    # Include those sinks in initialization too, without dropping their handlers.
    with redirect_stdout(structured):
        configure_logging("composition-regression", _production_settings())
    canary = f"named-mapping-{secrets.token_hex(12)}"
    arguments = {key: canary, "count": 7}
    diagnostic = {"safe": [42]}
    template = f"authentication rejected credential=%({key})s; count=%(count)d"
    emitter = logging.getLogger() if origin == "root" else logger
    original = emitter.makeRecord(
        emitter.name,
        logging.ERROR,
        __file__,
        1,
        template,
        (arguments,),
        None,
        extra={"diagnostic": diagnostic},
    )
    before = copy.deepcopy(original.__dict__)
    emitter.handle(original)
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
    assert len(root_sink.records) == len(filter_.records) == 1
    assert len(descendant_sink.records) == int(origin == "descendant")
    assert len(plain.getvalue().splitlines()) == len(structured.getvalue().splitlines()) == 1
    for sink in (root_sink, descendant_sink, filter_):
        for replacement in sink.records:
            assert replacement["msg"] == _OMITTED_LOG_COMPOSITION
            assert replacement["args"] == ()
            assert replacement["diagnostic"] == {"safe": [42]}
    assert original.__dict__ == before
    assert original.args is arguments
    assert original.diagnostic is diagnostic
    assert arguments == {key: canary, "count": 7}


@pytest.mark.parametrize(
    "template",
    [
        "received %(api_token)s",
        "%(authorization)s",
        "received %(cookie)r",
        "%(password)20s count=%(count)04d",
        "%(password)-20.2s safe=%(safe)s",
        "%(password).0r safe=%(safe)s",
        "%(password)08.3r safe=%(safe)s",
        "%(password)#08x safe=%(safe)s",
        "%(password)+.2f safe=%(safe)s",
        "%(password)c safe=%(safe)s",
        "credential=%(password)hds; count=%(count)d",
        "%% %(db_password)s %% safe=%(safe)s",
        "%(password)s / %(api_token)r / %(password)s; count=%(count)d",
    ],
)
def test_named_sensitive_formats_omit_whole_message(production_sinks, template):
    logger, plain, structured, root_sink, descendant_sink, filter_ = production_sinks
    with redirect_stdout(structured):
        configure_logging("composition-regression", _production_settings())
    canary = f"named-format-{secrets.token_hex(12)}"
    arguments = dict.fromkeys(
        ("password", "api_token", "authorization", "cookie", "db_password"), canary
    )
    arguments.update(safe="queue", count=7)
    before = arguments.copy()
    logger.error(template, arguments)
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
    for sink in (root_sink, descendant_sink, filter_):
        assert len(sink.records) == 1
        assert sink.records[0]["msg"] == _OMITTED_LOG_COMPOSITION
        assert sink.records[0]["args"] == ()
    assert len(plain.getvalue().splitlines()) == len(structured.getvalue().splitlines()) == 1
    assert arguments == before


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize(
    ("template", "key", "label"),
    [
        ("%(password)s=%(value)s", "password", "api_token"),
        ("db_%(password)s=%(value)s", "password", "password"),
        ("%(secret)s %(value)s", "secret", "Bearer"),
        ("%(authorization)s: %(value)s", "authorization", "Cookie"),
    ],
)
def test_erased_mapping_prefix_cannot_expose_following_interpolation(
    production_sinks, origin, template, key, label
):
    logger, plain, structured, root_sink, descendant_sink, filter_ = production_sinks
    with redirect_stdout(structured):
        configure_logging("composition-regression", _production_settings())
    canary = f"erased-label-{secrets.token_hex(12)}"
    arguments = {key: label, "value": canary}
    emitter = logging.getLogger() if origin == "root" else logger
    emitter.error(template, arguments)
    assert canary not in repr(
        [
            plain.getvalue(),
            structured.getvalue(),
            root_sink.records,
            descendant_sink.records,
            filter_.records,
        ]
    )
    for sink in (root_sink, descendant_sink, filter_):
        for record in sink.records:
            assert record["msg"] == "[OMITTED UNSAFE OR OVERSIZED LOG COMPOSITION]"
            assert record["args"] == ()
    assert len(root_sink.records) == len(filter_.records) == 1
    assert len(descendant_sink.records) == int(origin == "descendant")
    assert arguments == {key: label, "value": canary}


def test_sensitive_mapping_value_never_reaches_argument_renderer(monkeypatch):
    from nuzenio_api import observability

    value = object()
    render = observability._bounded_format_argument

    def guard(argument):
        assert argument is not value, "sensitive mapping value reached the renderer"
        return render(argument)

    monkeypatch.setattr(observability, "_bounded_format_argument", guard)
    arguments = {"password": value, "count": 7}
    original = logging.LogRecord(
        "fixture", logging.ERROR, __file__, 1, "%(password)20.2s count=%(count)d", (), None
    )
    original.args = arguments
    replacement = _sanitized_log_record(original)
    assert replacement.msg == _OMITTED_LOG_COMPOSITION
    assert replacement.args == ()
    assert original.args is arguments
    assert arguments["password"] is value


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("tail", ["", "; count=%(count)d"])
def test_erased_prefix_does_not_expose_literal_suffix_before_a_later_boundary(
    production_sinks, origin, tail
):
    logger, plain, structured, root_sink, descendant_sink, filter_ = production_sinks
    with redirect_stdout(structured):
        configure_logging("composition-regression", _production_settings())
    canary = f"literal-suffix-{secrets.token_hex(12)}"
    arguments = {"password": "api_token", "count": 7}
    emitter = logging.getLogger() if origin == "root" else logger
    emitter.error("%(password)s=" + canary + tail, arguments)
    assert canary not in repr(
        [
            plain.getvalue(),
            structured.getvalue(),
            root_sink.records,
            descendant_sink.records,
            filter_.records,
        ]
    )
    assert len(root_sink.records) == len(filter_.records) == 1
    assert len(descendant_sink.records) == int(origin == "descendant")
    for sink in (root_sink, descendant_sink, filter_):
        for record in sink.records:
            assert record["args"] == ()
    assert arguments == {"password": "api_token", "count": 7}


_HARMLESS_PREFIXES = [
    "",
    "rejected ",
    "header=",
    "context=login header=",
    '"header"="',
    "[header=",
    "context=login\nheader=",
]


def _assert_context_transformation_is_safe(
    production_sinks, origin, template, arguments, canary, *, sensitive_representations=()
):
    """Check every pre-existing sink, not merely the owned JSON formatter."""
    logger, plain, structured, root_sink, descendant_sink, filter_ = production_sinks
    with redirect_stdout(structured):
        for _ in range(3):
            configure_logging("composition-regression", _production_settings())
    emitter = logging.getLogger() if origin == "root" else logger
    diagnostic = {"event": "authentication_rejected", "safe": {"attempt": 7}}
    original = emitter.makeRecord(
        emitter.name,
        logging.ERROR,
        __file__,
        1,
        template,
        (arguments,),
        None,
        extra={"diagnostic": diagnostic},
    )
    # LogRecord leaves an empty mapping wrapped; exercise both empty argument
    # shapes explicitly as they can also be supplied on third-party records.
    if not arguments:
        original.args = arguments
    before = copy.deepcopy(original.__dict__)
    emitter.handle(original)
    snapshots = {
        "root_raw": root_sink.records,
        "descendant_raw": descendant_sink.records,
        "existing_filter": filter_.records,
        "plain": plain.getvalue(),
        "nuzenio_json": structured.getvalue(),
    }
    assert not [
        name
        for name, value in snapshots.items()
        if any(secret in repr(value) for secret in (canary, *sensitive_representations))
    ]
    assert len(root_sink.records) == len(filter_.records) == 1
    assert len(descendant_sink.records) == int(origin == "descendant")
    assert len(plain.getvalue().splitlines()) == 1
    assert len(structured.getvalue().splitlines()) == 1
    assert plain.getvalue().rstrip("\n") == "existing ERROR: " + _OMITTED_LOG_COMPOSITION
    payload = json.loads(structured.getvalue())
    assert payload["event"] == _OMITTED_LOG_COMPOSITION
    assert payload["context"]["diagnostic"] == diagnostic
    for sink in (root_sink, descendant_sink, filter_):
        for replacement in sink.records:
            assert replacement["msg"] == _OMITTED_LOG_COMPOSITION
            assert replacement["args"] == ()
            assert replacement["diagnostic"] == diagnostic
            assert replacement["diagnostic"] is not diagnostic
            assert replacement["diagnostic"]["safe"] is not diagnostic["safe"]
            assert replacement["levelno"] == logging.ERROR
            assert replacement["name"] == emitter.name
            assert len(replacement["msg"]) <= 8192
    assert original.__dict__ == before
    assert original.msg is template
    assert original.args is arguments
    assert original.diagnostic is diagnostic
    return root_sink.records[0]["msg"]


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("literal_value", [False, True])
@pytest.mark.parametrize("preceding_pair", [False, True])
@pytest.mark.parametrize(
    "cookie_name", ["sid", "id", "auth", "reader_choice", "X-Reader-Preference", "count"]
)
def test_cookie_pair_field_syntax_requires_whole_composition_omission(
    production_sinks, origin, literal_value, preceding_pair, cookie_name
):
    canary = f"cookie-pair-{secrets.token_hex(12)}"
    template = "rejected header=%(cookie)s"
    template += ("; " if preceding_pair else " ") + cookie_name + "="
    template += canary if literal_value else "%(value)s"
    arguments = {"cookie": "Cookie: locale=en" if preceding_pair else "Cookie:"}
    if not literal_value:
        arguments["value"] = canary
    message = _assert_context_transformation_is_safe(
        production_sinks, origin, template, arguments, canary
    )
    assert message == _OMITTED_LOG_COMPOSITION


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("prefix", _HARMLESS_PREFIXES)
@pytest.mark.parametrize("encoding_passes", [0, 1, 2])
@pytest.mark.parametrize("literal_values", [False, True])
def test_multiple_cookie_pairs_are_omitted_with_context_and_encoded_values(
    production_sinks, origin, prefix, encoding_passes, literal_values
):
    canaries = [f"cookie-{name}-{secrets.token_hex(12)}" for name in ("first", "second")]
    values = canaries.copy()
    representations = canaries.copy()
    header = "Cookie: locale=en"
    for _ in range(encoding_passes):
        values = ["".join(f"%{byte:02X}" for byte in value.encode()) for value in values]
        representations.extend(values)
        header = quote(header, safe="")
    assert len(set(representations)) == 2 * (encoding_passes + 1)
    template = prefix + "%(cookie)s; reader_choice="
    arguments = {"cookie": header, "count": 7}
    if literal_values:
        template += values[0].replace("%", "%%")
        template += "; X-Reader-Preference=" + values[1].replace("%", "%%")
    else:
        template += "%(first)s; X-Reader-Preference=%(second)s"
        arguments.update(first=values[0], second=values[1])
    template += "; count=%(count)d"
    _assert_context_transformation_is_safe(
        production_sinks,
        origin,
        template,
        arguments,
        canaries[0],
        sensitive_representations=representations,
    )


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("key", ["cookie", "Set-Cookie", "authorization", "API.Token"])
@pytest.mark.parametrize("position", ["before", "between", "after"])
def test_sensitive_placeholder_omits_content_on_both_sides(production_sinks, origin, key, position):
    canary = f"surrounding-content-{secrets.token_hex(12)}"
    literal_canary = f"literal-content-{secrets.token_hex(12)}"
    placeholder = f"%({key})s"
    content = "reader_choice=%(value)s; X-Reader-Preference=" + literal_canary
    template = {
        "before": placeholder + "; " + content,
        "between": "reader_choice=%(value)s; " + placeholder + "; " + literal_canary,
        "after": content + "; " + placeholder,
    }[position]
    _assert_context_transformation_is_safe(
        production_sinks,
        origin,
        template,
        {key: "Cookie:", "value": canary},
        canary,
        sensitive_representations=(literal_canary,),
    )


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("padding", [8100, 8170, 8192, 16_350, 16_384, 40_000])
@pytest.mark.parametrize("literal_padding", [False, True])
def test_trailing_sensitive_placeholder_omits_even_after_output_would_be_full(
    production_sinks, origin, padding, literal_padding
):
    canary = f"preceding-content-{secrets.token_hex(12)}"
    content = canary + "x" * padding
    arguments = {"cookie": "Cookie:"}
    if literal_padding:
        template = content + "; %(cookie)s"
    else:
        template = "%(preceding)s; %(cookie)s"
        arguments["preceding"] = content
    _assert_context_transformation_is_safe(production_sinks, origin, template, arguments, canary)


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize(
    ("template", "value"),
    [
        ("%(cookie)s; value=%(value)s", "unclassified-data"),
        ("value=%(value)s; %(cookie)s", "unclassified-data"),
        ("%(value)s%(cookie)s", "x" * 40_000),
        ("%(value)16384s%(cookie)s", "x"),
        ("%(value)016384d%(cookie)s", 7),
        ("%(value)1000000000s%(cookie)s", "x"),
        ("%% %(value)s %% %(cookie)s", "unclassified-data"),
        ("%(value)s" * 128 + "%(cookie)s", "x"),
    ],
)
def test_sensitive_template_does_not_render_any_interpolation(
    production_sinks, monkeypatch, origin, template, value
):
    from nuzenio_api import observability

    def forbid_render(argument):
        raise AssertionError("sensitive template must be classified before rendering arguments")

    monkeypatch.setattr(observability, "_bounded_format_argument", forbid_render)
    canary = f"unread-sensitive-value-{secrets.token_hex(12)}"
    _assert_context_transformation_is_safe(
        production_sinks,
        origin,
        template,
        {"cookie": canary, "value": value},
        canary,
    )


@pytest.mark.parametrize("arguments", [(), {}])
@pytest.mark.parametrize("template", ["%(cookie)s", "safe %(password)20.2s; count=7"])
def test_sensitive_placeholder_without_arguments_still_omits_whole_message(template, arguments):
    original = logging.LogRecord("fixture", logging.ERROR, __file__, 1, template, (), None)
    original.args = arguments
    before = original.__dict__.copy()
    replacement = _sanitized_log_record(original)
    assert replacement.msg == _OMITTED_LOG_COMPOSITION
    assert replacement.args == ()
    assert original.__dict__ == before
    assert original.args is arguments


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("arguments", [(), {}, {"cookie": "Cookie:"}])
@pytest.mark.parametrize("padding", [16_385, 40_000])
@pytest.mark.parametrize("trailing_sensitive", [False, True])
def test_oversized_template_is_omitted_even_with_empty_arguments(
    production_sinks, origin, arguments, padding, trailing_sensitive
):
    canary = f"oversized-literal-{secrets.token_hex(12)}"
    template = canary + "x" * padding
    if trailing_sensitive:
        # The classified reference is beyond the complete bounded scan window.
        template += " %(cookie)s"
    _assert_context_transformation_is_safe(production_sinks, origin, template, arguments, canary)


@pytest.mark.parametrize("origin", ["root", "descendant"])
def test_static_label_before_erased_bearer_prefix_cannot_authorize_following_token(
    production_sinks, origin
):
    canary = f"labelled-bearer-{secrets.token_hex(12)}"
    message = _assert_context_transformation_is_safe(
        production_sinks,
        origin,
        "rejected header=%(authorization)s %(value)s",
        {"authorization": "Bearer", "value": canary},
        canary,
    )
    assert message == "[OMITTED UNSAFE OR OVERSIZED LOG COMPOSITION]"


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("prefix", _HARMLESS_PREFIXES)
@pytest.mark.parametrize(
    ("template", "key", "label"),
    [
        ("%(password)s=%(value)s", "password", "api_token"),
        ("db_%(password)s=%(value)s", "password", "password"),
        ("%(secret)s %(value)s", "secret", "Bearer"),
        ("%(authorization)s: %(value)s", "authorization", "Cookie"),
        ("%(authorization)s %(value)s", "authorization", "Bearer"),
        ("%(cookie)s: %(value)s", "cookie", "Cookie"),
    ],
)
def test_harmless_context_preserves_erased_prefix_confidentiality(
    production_sinks, origin, prefix, template, key, label
):
    canary = f"context-prefix-{secrets.token_hex(12)}"
    _assert_context_transformation_is_safe(
        production_sinks,
        origin,
        prefix + template,
        {key: label, "value": canary},
        canary,
    )


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("prefix", _HARMLESS_PREFIXES)
@pytest.mark.parametrize("tail", ["", "; count=%(count)d"])
def test_harmless_context_preserves_literal_suffix_confidentiality(
    production_sinks, origin, prefix, tail
):
    canary = f"context-literal-{secrets.token_hex(12)}"
    _assert_context_transformation_is_safe(
        production_sinks,
        origin,
        prefix + "%(password)s=" + canary + tail,
        {"password": "api_token", "count": 7},
        canary,
    )


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("prefix", _HARMLESS_PREFIXES)
@pytest.mark.parametrize(
    ("template", "key", "label"),
    [
        ("%(authorization)s ", "authorization", "Bearer"),
        ("%(cookie)s: ", "cookie", "Cookie"),
        ("%(password)s=", "password", "api_token"),
    ],
)
def test_punctuation_only_literal_credentials_remain_ambiguous(
    production_sinks, origin, prefix, template, key, label
):
    # Punctuation is valid token/password material, not proof of safe syntax.
    canary = "_-./-_/-.__-/._--"
    message = _assert_context_transformation_is_safe(
        production_sinks, origin, prefix + template + canary, {key: label}, canary
    )
    assert message == "[OMITTED UNSAFE OR OVERSIZED LOG COMPOSITION]"


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("encoding_passes", [0, 1, 2])
@pytest.mark.parametrize("literal_suffix", [False, True])
@pytest.mark.parametrize("prefix", ["header=", 'context="login" header=', "[context]\nheader="])
def test_erased_prefix_protection_survives_encoding_and_multiple_sensitive_fields(
    production_sinks, origin, encoding_passes, literal_suffix, prefix
):
    canary = f"multiple-encoded-{secrets.token_hex(12)}"
    value = canary
    representations = [canary]
    label = "Authorization: Bearer"
    for _ in range(encoding_passes):
        # quote() deliberately preserves unreserved letters/hyphens. Encode all
        # bytes so these cases actually exercise different secret representations.
        value = "".join(f"%{byte:02X}" for byte in value.encode("utf-8"))
        representations.append(value)
        label = quote(label, safe="")
    assert len(set(representations)) == encoding_passes + 1
    template = prefix + "%(cookie)s / %(authorization)s "
    arguments = {"cookie": "Cookie", "authorization": label}
    if literal_suffix:
        # Literal percent escapes must survive ordinary logging's format parser.
        template += value.replace("%", "%%") + "; safe=%(count)d"
        arguments["count"] = 7
    else:
        template += "%(value)s"
        arguments["value"] = value
    _assert_context_transformation_is_safe(
        production_sinks,
        origin,
        template,
        arguments,
        canary,
        sensitive_representations=representations,
    )


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("padding", [8100, 8170, 8190, 16_350, 16_390, 40_000])
@pytest.mark.parametrize("literal_suffix", [False, True])
def test_erased_prefix_protection_is_safe_at_output_and_scan_boundaries(
    production_sinks, origin, padding, literal_suffix
):
    canary = f"truncation-context-{secrets.token_hex(12)}"
    template = "x" * padding + " header=%(authorization)s "
    arguments = {"authorization": "Bearer"}
    if literal_suffix:
        template += canary
    else:
        template += "%(value)s"
        arguments["value"] = canary
    _assert_context_transformation_is_safe(production_sinks, origin, template, arguments, canary)


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("template", ["header=%(authorization)s %s", "header=%s %(value)s"])
def test_ambiguous_mapping_and_positional_mix_never_exposes_erased_prefix_value(
    production_sinks, origin, template
):
    canary = f"mixed-style-{secrets.token_hex(12)}"
    _assert_context_transformation_is_safe(
        production_sinks,
        origin,
        template,
        {"authorization": "Bearer", "value": canary},
        canary,
    )


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("prefix", ["", "header=", "context=login header="])
@pytest.mark.parametrize("delimiter", [" ", "; ", "\n", "\t", ": ", " | "])
def test_punctuation_after_erased_prefix_does_not_prove_next_value_independent(
    production_sinks, origin, prefix, delimiter
):
    canary = f"ambiguous-delimiter-{secrets.token_hex(12)}"
    message = _assert_context_transformation_is_safe(
        production_sinks,
        origin,
        prefix + "%(authorization)s" + delimiter + "%(value)s",
        {"authorization": "Bearer", "value": canary},
        canary,
    )
    assert message == "[OMITTED UNSAFE OR OVERSIZED LOG COMPOSITION]"


@pytest.mark.parametrize("origin", ["root", "descendant"])
@pytest.mark.parametrize("delimiter", [" ", "; ", "\n", "\t", ";\n"])
def test_subsequent_explicit_literal_field_still_requires_whole_omission(
    production_sinks, origin, delimiter
):
    canary = f"independent-field-{secrets.token_hex(12)}"
    message = _assert_context_transformation_is_safe(
        production_sinks,
        origin,
        "header=%(authorization)s" + delimiter + "count=%(count)d",
        {"authorization": canary, "count": 7},
        canary,
    )
    assert message == _OMITTED_LOG_COMPOSITION


@pytest.mark.parametrize(
    "template",
    [
        "%(password)1000000000s",
        "%(password).1000000000s",
        "%(password)*s",
        "%(password)q",
        "%(password",
        "%(password)s %",
        "%(password)s %(missing)s",
    ],
)
def test_sensitive_mapping_does_not_bypass_format_validation(template):
    arguments = {"password": "named-malformed-canary"}
    original = logging.LogRecord("fixture", logging.ERROR, __file__, 1, template, (), None)
    original.args = arguments
    start = monotonic()
    replacement = _sanitized_log_record(original)
    assert monotonic() - start < 0.5
    assert replacement.msg == "[OMITTED UNSAFE OR OVERSIZED LOG COMPOSITION]"
    assert replacement.args == ()
    assert "named-malformed-canary" not in repr(replacement.__dict__)
    assert original.args is arguments


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
        (
            "literal=%%(cookie)s %(safe)s",
            {"safe": "queue", "cookie": "unused-sensitive-canary"},
            "literal=%(cookie)s queue",
        ),
        ("%%(cookie)s", (), "%%(cookie)s"),
        ("%%(password)s", {}, "%%(password)s"),
        ("100% complete", (), "100% complete"),
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
