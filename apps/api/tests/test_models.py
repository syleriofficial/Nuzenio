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
        "user_preferences",
        "follows",
        "saved_clusters",
        "briefs",
        "notifications",
        "editorial_reviews",
        "audit_logs",
    }
    assert expected == set(Base.metadata.tables)


def test_event_cluster_has_vector_ready_embedding_column() -> None:
    column = Base.metadata.tables["event_clusters"].c.event_embedding
    assert "VECTOR(768)" in str(column.type).upper()
