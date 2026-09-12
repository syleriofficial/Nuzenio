"""Explicit offline RSS import for the fixture inbox. No URLs are fetched."""

import uuid
from datetime import UTC, datetime
from xml.sax.saxutils import escape

from sqlalchemy import select

from nuzenio_api.db import SessionLocal
from nuzenio_api.draft_inbox import blocked_reasons, fixture_host, require_fixture_mode
from nuzenio_api.feed_locks import locked_feed
from nuzenio_api.feed_security import parse_feed_xml
from nuzenio_api.models import Article, ContentStatus, SourceFeed


def import_fixtures(session) -> int:
    require_fixture_mode()
    created = 0
    for language in ("en", "hi"):
        feed_id = session.scalar(
            select(SourceFeed.id).where(
                SourceFeed.url == f"https://janadesh.example/demo-feed-{language}.xml"
            )
        )
        feed = locked_feed(session, feed_id) if feed_id else None
        if (
            not feed
            or not fixture_host(feed.url)
            or feed.rights_policy.metadata_json.get("demonstration_data") is not True
        ):
            raise RuntimeError(
                "Seed approved fictional sources first; no source approvals were changed."
            )
        host = fixture_host(feed.url)
        title = "Fictional incoming bus proposal" if language == "en" else "काल्पनिक नई बस योजना"
        excerpt = (
            "Offline fixture, not news. Source assertions require human review."
            if language == "en"
            else "यह काल्पनिक उदाहरण है, समाचार नहीं। स्रोत के दावों की समीक्षा जरूरी है।"
        )
        xml = (
            '<rss version="2.0"><channel>'
            + "".join(
                f"<item><title>{escape(title)} {index}</title>"
                f"<link>https://{host}/nuzenio-inbox-fixture-v1/{language}/{index}</link>"
                f"<description>{escape(excerpt)}</description></item>"
                for index in range(1, 5)
            )
            + "</channel></rss>"
        )
        for item in parse_feed_xml(xml.encode()):
            if session.scalar(select(Article.id).where(Article.canonical_url == item.link)):
                continue
            article = Article(
                id=uuid.uuid4(),
                feed_id=feed.id,
                publisher_organization_id=feed.organization_id,
                canonical_url=item.link,
                title=item.title,
                excerpt=item.summary,
                language=language,
                published_at=datetime(2026, 9, 12, tzinfo=UTC),
                status=ContentStatus.INGESTED,
                source_metadata={"offline_fixture_pack": "draft-inbox-v1"},
            )
            if blocked_reasons(session, article, feed):
                raise RuntimeError(
                    "Fixture source is paused or rights are not eligible; nothing imported."
                )
            session.add(article)
            created += 1
        session.flush()
    return created


def main() -> None:
    require_fixture_mode()
    with SessionLocal.begin() as session:
        count = import_fixtures(session)
    print(
        f"Imported {count} offline fictional articles. "
        "No fetch, draft creation or publishing occurred."
    )


if __name__ == "__main__":
    main()
