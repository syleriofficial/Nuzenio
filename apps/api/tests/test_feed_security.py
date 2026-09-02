from pathlib import Path

import httpx
import pytest

from nuzenio_api.config import Settings
from nuzenio_api.feed_security import (
    FeedSecurityError,
    SafeFeedFetcher,
    parse_feed_xml,
    sanitize_imported_text,
    validate_feed_url,
)

FIXTURES = Path(__file__).parent / "fixtures"


def public_resolver(_: str, __: int) -> set[str]:
    return {"93.184.216.34"}


@pytest.mark.parametrize(
    "url",
    [
        "https://localhost/feed.xml",
        "https://127.0.0.1/feed.xml",
        "https://169.254.169.254/latest/meta-data",
        "https://10.0.0.1/feed.xml",
        "https://user:password@example.com/feed.xml",
        "http://example.com/feed.xml",
    ],
)
def test_ssrf_sensitive_urls_are_denied(url: str) -> None:
    with pytest.raises(FeedSecurityError):
        validate_feed_url(url, resolver=public_resolver, https_required=True)


def test_dns_resolution_to_private_address_is_denied() -> None:
    with pytest.raises(FeedSecurityError) as error:
        validate_feed_url(
            "https://feeds.example.test/rss.xml",
            resolver=lambda _host, _port: {"192.168.1.8"},
        )
    assert error.value.code == "feed_address_denied"


def test_malicious_xml_external_entity_is_rejected() -> None:
    with pytest.raises(FeedSecurityError) as error:
        parse_feed_xml((FIXTURES / "malicious-xxe.xml").read_bytes())
    assert error.value.code == "unsafe_xml"


def test_fixture_feed_is_parsed_and_markup_is_sanitized() -> None:
    items = parse_feed_xml((FIXTURES / "sample-rss.xml").read_bytes())
    assert len(items) == 1
    assert items[0].external_id == "fixture-item-001"
    assert "<p>" not in items[0].summary
    assert items[0].summary == "A fictional feed item for deterministic local tests. ignored()"
    assert sanitize_imported_text("<b>Hello</b>   newsroom") == "Hello newsroom"


def test_response_limit_and_content_type_are_enforced() -> None:
    settings = Settings(feed_max_bytes=20, feed_https_required=True)
    fetcher = SafeFeedFetcher(
        settings=settings,
        resolver=public_resolver,
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                headers={"content-type": "application/rss+xml"},
                content=b"x" * 21,
                request=request,
            )
        ),
    )
    with pytest.raises(FeedSecurityError) as error:
        fetcher.fetch("https://feeds.example.test/rss.xml")
    assert error.value.code == "feed_too_large"


def test_redirect_target_is_revalidated() -> None:
    def resolver(host: str, _port: int) -> set[str]:
        return {"127.0.0.1"} if host == "private.example.test" else {"93.184.216.34"}

    fetcher = SafeFeedFetcher(
        resolver=resolver,
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                302,
                headers={"location": "https://private.example.test/feed.xml"},
                request=request,
            )
        ),
    )
    with pytest.raises(FeedSecurityError) as error:
        fetcher.fetch("https://feeds.example.test/rss.xml")
    assert error.value.code == "feed_address_denied"


def test_dns_rebinding_is_detected() -> None:
    calls = 0

    def changing_resolver(_host: str, _port: int) -> set[str]:
        nonlocal calls
        calls += 1
        return {"93.184.216.34"} if calls == 1 else {"93.184.216.35"}

    fetcher = SafeFeedFetcher(
        resolver=changing_resolver,
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                headers={"content-type": "application/rss+xml"},
                content=(FIXTURES / "sample-rss.xml").read_bytes(),
                request=request,
            )
        ),
    )
    with pytest.raises(FeedSecurityError) as error:
        fetcher.fetch("https://feeds.example.test/rss.xml")
    assert error.value.code == "dns_rebinding_detected"


def test_fetch_socket_is_pinned_to_the_validated_public_address() -> None:
    observed: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        observed["host"] = request.url.host
        observed["host_header"] = request.headers["host"]
        observed["sni"] = request.extensions["sni_hostname"]
        return httpx.Response(
            200,
            headers={"content-type": "application/rss+xml"},
            content=(FIXTURES / "sample-rss.xml").read_bytes(),
            request=request,
        )

    fetcher = SafeFeedFetcher(
        resolver=public_resolver,
        transport=httpx.MockTransport(handler),
    )
    fetcher.fetch("https://feeds.example.test/rss.xml")
    assert observed == {
        "host": "93.184.216.34",
        "host_header": "feeds.example.test",
        "sni": "feeds.example.test",
    }
