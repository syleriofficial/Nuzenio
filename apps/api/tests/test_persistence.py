import pytest
from sqlalchemy import delete, func, inspect, select

from nuzenio_api.db import SessionLocal, engine
from nuzenio_api.models import (
    Article,
    Brief,
    Claim,
    ContentStatus,
    DecisionState,
    EventCluster,
    PublisherOrganization,
    ReviewState,
    RiskLevel,
    SummaryVersion,
)
from nuzenio_api.repositories import ReaderRepository
from nuzenio_api.seed import expected_counts, seed_database
from nuzenio_api.services import ReaderService, ResourceNotFoundError


def test_alembic_migrates_a_clean_database() -> None:
    expected_tables = {
        "alembic_version",
        "publisher_organizations",
        "publisher_domains",
        "source_feeds",
        "rights_policies",
        "articles",
        "article_fingerprints",
        "event_clusters",
        "cluster_articles",
        "claims",
        "claim_evidence",
        "summary_versions",
        "primary_documents",
        "corrections",
        "correction_contributors",
        "briefs",
    }
    assert expected_tables.issubset(set(inspect(engine).get_table_names()))

    with engine.connect() as connection:
        revision = connection.exec_driver_sql(
            "SELECT version_num FROM alembic_version"
        ).scalar_one()
        assert revision == "a81c3d7e520b"


def test_seed_is_idempotent() -> None:
    first = seed_database(SessionLocal)
    second = seed_database(SessionLocal)
    assert first == second
    for key, expected in expected_counts().items():
        if isinstance(expected, int):
            assert first[key] >= expected
        else:
            assert first[key] == expected

    with SessionLocal.begin() as session:
        counts = {
            "publishers": len(session.scalars(select(PublisherOrganization)).all()),
            "clusters": len(session.scalars(select(EventCluster)).all()),
            "articles": len(session.scalars(select(Article)).all()),
            "claims": len(session.scalars(select(Claim)).all()),
            "briefs": len(session.scalars(select(Brief)).all()),
        }
    expected = {
        key: value for key, value in expected_counts().items() if key != "demonstration_data"
    }
    assert all(counts[key] >= value for key, value in expected.items())


def test_high_risk_cluster_requires_approved_review_to_be_publishable() -> None:
    slug = "unreviewed-high-risk-fixture"
    with SessionLocal.begin() as session:
        session.add(
            EventCluster(
                slug=slug,
                neutral_headline="Unreviewed high-risk fixture",
                neutral_headline_hi="समीक्षा न किया गया उच्च जोखिम उदाहरण",
                category="Public safety",
                status=ContentStatus.PUBLISHED,
                risk_level=RiskLevel.HIGH,
                review_state=ReviewState.NOT_REQUIRED,
            )
        )
    try:
        with SessionLocal.begin() as session:
            page = ReaderRepository(session).list_clusters(page=1, page_size=50)
            assert slug not in {cluster.slug for cluster in page.items}
    finally:
        with SessionLocal.begin() as session:
            session.execute(delete(EventCluster).where(EventCluster.slug == slug))


def test_persisted_evidence_free_summary_is_suppressed() -> None:
    slug = "evidence-free-summary-fixture"
    with SessionLocal.begin() as session:
        cluster = EventCluster(
            slug=slug,
            neutral_headline="Evidence-free summary fixture",
            neutral_headline_hi="साक्ष्य रहित सारांश उदाहरण",
            category="National",
            status=ContentStatus.PUBLISHED,
            risk_level=RiskLevel.STANDARD,
            review_state=ReviewState.NOT_REQUIRED,
        )
        session.add(cluster)
        session.flush()
        session.add(
            SummaryVersion(
                cluster_id=cluster.id,
                version=1,
                language="en",
                summary_text="This sentence deliberately has no evidence map.",
                evidence_map={},
                generator_name="test",
            )
        )
    try:
        with SessionLocal.begin() as session:
            page = ReaderRepository(session).list_clusters(page=1, page_size=50)
            assert slug not in {cluster.slug for cluster in page.items}
        with (
            SessionLocal() as session,
            pytest.raises(
                ResourceNotFoundError,
                match="No evidence-backed summary",
            ),
        ):
            ReaderService(session).cluster(slug=slug, language="en")
    finally:
        with SessionLocal.begin() as session:
            session.execute(delete(EventCluster).where(EventCluster.slug == slug))


def test_pending_summary_never_overrides_published_reader_copy() -> None:
    slug = "open-language-model-india-labs"
    pending_text = "Pending editorial copy must never reach the reader response."
    with SessionLocal.begin() as session:
        cluster = session.scalar(select(EventCluster).where(EventCluster.slug == slug))
        next_version = (
            session.scalar(
                select(func.max(SummaryVersion.version)).where(
                    SummaryVersion.cluster_id == cluster.id,
                    SummaryVersion.language == "en",
                )
            )
            or 0
        ) + 1
        pending = SummaryVersion(
            cluster_id=cluster.id,
            version=next_version,
            language="en",
            summary_text=pending_text,
            evidence_map={"sentences": [{"evidenceIds": ["fixture"]}]},
            generator_name="test",
            decision=DecisionState.PENDING,
        )
        session.add(pending)
        session.flush()
        pending_id = pending.id
    try:
        with SessionLocal() as session:
            result = ReaderService(session).cluster(slug=slug, language="en")
            assert result.brief != pending_text
    finally:
        with SessionLocal.begin() as session:
            session.execute(delete(SummaryVersion).where(SummaryVersion.id == pending_id))
