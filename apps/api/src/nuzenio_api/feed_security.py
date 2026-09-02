from __future__ import annotations

import html
import ipaddress
import re
import socket
from collections.abc import Callable
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

import httpx
from defusedxml import ElementTree

from nuzenio_api.config import Settings, get_settings

ALLOWED_CONTENT_TYPES = {
    "application/atom+xml",
    "application/rss+xml",
    "application/xml",
    "text/xml",
}


class FeedSecurityError(Exception):
    def __init__(self, code: str, public_message: str, internal_message: str | None = None):
        super().__init__(internal_message or public_message)
        self.code = code
        self.public_message = public_message
        self.internal_message = internal_message or public_message


Resolver = Callable[[str, int], set[str]]


def system_resolver(hostname: str, port: int) -> set[str]:
    try:
        return {item[4][0] for item in socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)}
    except socket.gaierror as error:
        raise FeedSecurityError(
            "dns_resolution_failed",
            "The feed host could not be resolved.",
            f"DNS resolution failed for {hostname}: {error}",
        ) from error


def _is_public_ip(value: str) -> bool:
    address = ipaddress.ip_address(value)
    return bool(address.is_global and not address.is_multicast and not address.is_unspecified)


@dataclass(frozen=True)
class ValidatedTarget:
    url: str
    hostname: str
    port: int
    addresses: frozenset[str]


def validate_feed_url(
    url: str,
    *,
    resolver: Resolver = system_resolver,
    https_required: bool | None = None,
) -> ValidatedTarget:
    settings = get_settings()
    require_https = settings.feed_https_required if https_required is None else https_required
    parsed = urlsplit(url)
    if parsed.scheme not in ({"https"} if require_https else {"http", "https"}):
        raise FeedSecurityError("feed_scheme_denied", "Feed URLs must use HTTPS.")
    if not parsed.hostname or parsed.username or parsed.password:
        raise FeedSecurityError(
            "feed_url_invalid", "Feed URLs must have a host and cannot contain credentials."
        )
    hostname = parsed.hostname.rstrip(".").casefold()
    if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith(".localhost"):
        raise FeedSecurityError("feed_host_denied", "The feed host is not permitted.")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        literal = ipaddress.ip_address(hostname.strip("[]"))
        addresses = {str(literal)}
    except ValueError:
        addresses = resolver(hostname, port)
    if not addresses or any(not _is_public_ip(address) for address in addresses):
        raise FeedSecurityError(
            "feed_address_denied",
            "The feed host resolves to a network address that is not permitted.",
            f"Rejected addresses for {hostname}: {sorted(addresses)}",
        )
    return ValidatedTarget(url=url, hostname=hostname, port=port, addresses=frozenset(addresses))


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def sanitize_imported_text(value: str | None, *, maximum: int = 5000) -> str:
    parser = _TextExtractor()
    parser.feed(value or "")
    text = html.unescape(" ".join(parser.parts))
    return re.sub(r"\s+", " ", text).strip()[:maximum]


@dataclass(frozen=True)
class ParsedFeedItem:
    external_id: str
    title: str
    link: str
    summary: str
    published: str | None


def parse_feed_xml(payload: bytes, *, max_bytes: int | None = None) -> list[ParsedFeedItem]:
    limit = max_bytes or get_settings().feed_max_bytes
    if len(payload) > limit:
        raise FeedSecurityError("feed_too_large", "The feed response exceeds the size limit.")
    lowered = payload[:4096].lower()
    if b"<!doctype" in lowered or b"<!entity" in lowered:
        raise FeedSecurityError("unsafe_xml", "The feed XML contains a prohibited declaration.")
    try:
        root = ElementTree.fromstring(payload)
    except ElementTree.ParseError as error:
        raise FeedSecurityError("invalid_xml", "The feed response is not valid XML.") from error
    local_root = root.tag.rsplit("}", 1)[-1].lower()
    if local_root not in {"rss", "feed", "rdf"}:
        raise FeedSecurityError("unsupported_feed", "The XML is not an RSS or Atom feed.")

    def text_of(element: object, *names: str) -> str | None:
        for child in list(element):
            if child.tag.rsplit("}", 1)[-1].lower() in names and child.text:
                return child.text
        return None

    entries = [
        element
        for element in root.iter()
        if element.tag.rsplit("}", 1)[-1].lower() in {"item", "entry"}
    ]
    parsed: list[ParsedFeedItem] = []
    for entry in entries[:500]:
        link = text_of(entry, "link") or ""
        if not link:
            link_element = next(
                (child for child in list(entry) if child.tag.rsplit("}", 1)[-1].lower() == "link"),
                None,
            )
            if link_element is not None:
                link = link_element.attrib.get("href", "")
        title = sanitize_imported_text(text_of(entry, "title"), maximum=600)
        external_id = sanitize_imported_text(text_of(entry, "guid", "id"), maximum=1000)
        if not external_id:
            external_id = link
        if not title or not link or not external_id:
            continue
        parsed.append(
            ParsedFeedItem(
                external_id=external_id,
                title=title,
                link=link,
                summary=sanitize_imported_text(
                    text_of(entry, "description", "summary", "content"), maximum=5000
                ),
                published=text_of(entry, "pubdate", "published", "updated"),
            )
        )
    return parsed


@dataclass(frozen=True)
class FetchResult:
    status_code: int
    content: bytes
    content_type: str
    etag: str | None
    last_modified: str | None
    final_url: str


class SafeFeedFetcher:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        resolver: Resolver = system_resolver,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.resolver = resolver
        self.transport = transport

    def fetch(
        self, url: str, *, etag: str | None = None, last_modified: str | None = None
    ) -> FetchResult:
        headers = {
            "Accept": ", ".join(sorted(ALLOWED_CONTENT_TYPES)),
            "User-Agent": self.settings.feed_user_agent,
        }
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified
        current = url
        with httpx.Client(
            follow_redirects=False,
            timeout=self.settings.feed_timeout_seconds,
            transport=self.transport,
            headers=headers,
        ) as client:
            for redirect_count in range(self.settings.feed_redirect_limit + 1):
                target = validate_feed_url(
                    current,
                    resolver=self.resolver,
                    https_required=self.settings.feed_https_required,
                )
                # Connect to an address that was already classified as public.
                # Preserve the publisher hostname for HTTP routing and TLS
                # certificate verification so DNS cannot change the socket target.
                pinned_address = sorted(target.addresses)[0]
                connect_url = httpx.URL(current).copy_with(host=pinned_address)
                parsed_current = urlsplit(current)
                default_port = 443 if parsed_current.scheme == "https" else 80
                host_header = target.hostname
                if parsed_current.port and parsed_current.port != default_port:
                    host_header = f"{host_header}:{parsed_current.port}"
                try:
                    with client.stream(
                        "GET",
                        connect_url,
                        headers={"Host": host_header},
                        extensions={"sni_hostname": target.hostname},
                    ) as response:
                        if response.status_code in {301, 302, 303, 307, 308}:
                            location = response.headers.get("location")
                            if not location or redirect_count >= self.settings.feed_redirect_limit:
                                raise FeedSecurityError(
                                    "redirect_denied", "The feed exceeded the redirect limit."
                                )
                            current = urljoin(current, location)
                            continue
                        if response.status_code == 304:
                            return FetchResult(304, b"", "", etag, last_modified, current)
                        response.raise_for_status()
                        content_type = (
                            response.headers.get("content-type", "").split(";", 1)[0].lower()
                        )
                        if content_type not in ALLOWED_CONTENT_TYPES:
                            raise FeedSecurityError(
                                "content_type_denied",
                                "The feed response did not use an approved XML content type.",
                            )
                        chunks: list[bytes] = []
                        size = 0
                        for chunk in response.iter_bytes():
                            size += len(chunk)
                            if size > self.settings.feed_max_bytes:
                                raise FeedSecurityError(
                                    "feed_too_large", "The feed response exceeds the size limit."
                                )
                            chunks.append(chunk)
                        rebound_addresses = self.resolver(target.hostname, target.port)
                        if frozenset(rebound_addresses) != target.addresses:
                            raise FeedSecurityError(
                                "dns_rebinding_detected",
                                "The feed host address changed during the request.",
                            )
                        return FetchResult(
                            response.status_code,
                            b"".join(chunks),
                            content_type,
                            response.headers.get("etag"),
                            response.headers.get("last-modified"),
                            current,
                        )
                except httpx.HTTPError as error:
                    raise FeedSecurityError(
                        "feed_fetch_failed",
                        "The feed could not be fetched safely.",
                        str(error),
                    ) from error
        raise FeedSecurityError("redirect_denied", "The feed exceeded the redirect limit.")
