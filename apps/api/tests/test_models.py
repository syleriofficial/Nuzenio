import pytest
from pydantic import ValidationError

from nuzenio_api.config import Settings
from nuzenio_api.models import Base


def test_required_entity_tables_are_registered() -> None:
    expected = {
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
        "user_preferences",
        "follows",
        "saved_clusters",
        "briefs",
        "notifications",
        "editorial_reviews",
        "audit_logs",
    }
    assert expected.issubset(set(Base.metadata.tables))
    assert {
        "staff_users",
        "staff_sessions",
        "login_throttles",
        "authentication_events",
        "edition_controls",
        "feed_runs",
        "dead_letter_jobs",
        "content_revisions",
        "correction_impacts",
        "material_contributors",
    }.issubset(set(Base.metadata.tables))


def test_event_cluster_has_vector_ready_embedding_column() -> None:
    column = Base.metadata.tables["event_clusters"].c.event_embedding
    assert "VECTOR(768)" in str(column.type).upper()


def test_production_settings_fail_closed() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="production", _env_file=None)
    settings = Settings(
        environment="production",
        demo_mode=False,
        cookie_secure=True,
        session_hash_pepper="a-unique-production-pepper-over-32-characters",
        cors_origins=["https://news.example"],
        allowed_hosts=["news.example"],
        feed_https_required=True,
        feed_kill_switch=True,
        metrics_token="a-unique-metrics-token-over-32-characters",
        database_url=(
            "postgresql+psycopg://nuzenio_runtime:a-long-runtime-password@postgres.example/nuzenio"
        ),
        redis_url="rediss://:a-long-redis-password@redis.example/0",
        _env_file=None,
    )
    assert settings.environment == "production"
