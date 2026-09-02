import pytest
from sqlalchemy import delete, inspect, select

from nuzenio_api.db import SessionLocal, engine
from nuzenio_api.models import (
    Article,
    Brief,
    Claim,
    ContentStatus,
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
        "briefs",
    }
    assert expected_tables.issubset(set(inspect(engine).get_table_names()))

    with engine.connect() as connection:
        revision = connection.exec_driver_sql(
            "SELECT version_num FROM alembic_version"
        ).scalar_one()
    assert revision == "8ca634735948"


def test_seed_is_idempotent() -> None:
    first = seed_database(SessionLocal)
    second = seed_database(SessionLocal)
    assert first == second == expected_counts()

    with SessionLocal.begin() as session:
        counts = {
            "publishers": len(session.scalars(select(PublisherOrganization)).all()),
            "clusters": len(session.scalars(select(EventCluster)).all()),
            "articles": len(session.scalars(select(Article)).all()),
            "claims": len(session.scalars(select(Claim)).all()),
            "briefs": len(session.scalars(select(Brief)).all()),
        }
    assert counts == {
        key: value for key, value in expected_counts().items() if key != "demonstration_data"
    }


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
