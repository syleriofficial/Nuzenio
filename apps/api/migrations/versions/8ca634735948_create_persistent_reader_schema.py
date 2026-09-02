"""create persistent reader schema

Revision ID: 8ca634735948
Revises:
Create Date: 2026-09-02 19:22:38.406117
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "8ca634735948"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The extension is migration-owned so a clean PostgreSQL database is sufficient.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "audit_logs",
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.UUID(), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_actor_id"), "audit_logs", ["actor_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"], unique=False)
    op.create_table(
        "briefs",
        sa.Column("edition", sa.String(length=80), nullable=False),
        sa.Column("period", sa.String(length=20), nullable=False),
        sa.Column("language", sa.String(length=12), nullable=False),
        sa.Column("title", sa.String(length=400), nullable=False),
        sa.Column("cluster_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "edition", "period", "language", name="uq_brief_edition_period_language"
        ),
    )
    op.create_index(op.f("ix_briefs_edition"), "briefs", ["edition"], unique=False)
    op.create_table(
        "event_clusters",
        sa.Column("slug", sa.String(length=300), nullable=False),
        sa.Column("neutral_headline", sa.String(length=600), nullable=False),
        sa.Column("neutral_headline_hi", sa.String(length=600), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("location", sa.String(length=160), nullable=True),
        sa.Column(
            "status",
            sa.Enum("INGESTED", "PUBLISHED", "HELD", "REMOVED", name="contentstatus"),
            nullable=False,
        ),
        sa.Column("risk_level", sa.Enum("STANDARD", "HIGH", name="risklevel"), nullable=False),
        sa.Column(
            "review_state",
            sa.Enum("NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED", name="reviewstate"),
            nullable=False,
        ),
        sa.Column("event_embedding", Vector(768), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("timeline_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("why_shown", sa.Text(), nullable=False),
        sa.Column("why_shown_hi", sa.Text(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_event_cluster_category_location",
        "event_clusters",
        ["category", "location"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_clusters_category"), "event_clusters", ["category"], unique=False
    )
    op.create_index(
        op.f("ix_event_clusters_display_order"), "event_clusters", ["display_order"], unique=False
    )
    op.create_index(
        op.f("ix_event_clusters_location"), "event_clusters", ["location"], unique=False
    )
    op.create_index(op.f("ix_event_clusters_slug"), "event_clusters", ["slug"], unique=True)
    op.create_table(
        "follows",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("value", sa.String(length=300), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "kind", "value", name="uq_follow"),
    )
    op.create_index(op.f("ix_follows_user_id"), "follows", ["user_id"], unique=False)
    op.create_table(
        "publisher_organizations",
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("ownership", sa.String(length=300), nullable=False),
        sa.Column("correction_policy", sa.Text(), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_publisher_organizations_slug"), "publisher_organizations", ["slug"], unique=True
    )
    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("language", sa.String(length=12), nullable=False),
        sa.Column("edition", sa.String(length=80), nullable=False),
        sa.Column("local_area", sa.String(length=160), nullable=True),
        sa.Column("theme", sa.String(length=20), nullable=False),
        sa.Column("personalization_enabled", sa.Boolean(), nullable=False),
        sa.Column(
            "hidden_organization_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_user_preferences_user_id"), "user_preferences", ["user_id"], unique=True
    )
    op.create_table(
        "claims",
        sa.Column("cluster_id", sa.UUID(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("text_hi", sa.Text(), nullable=False),
        sa.Column(
            "state",
            sa.Enum("CONFIRMED", "DEVELOPING", "DISPUTED", name="claimstate"),
            nullable=False,
        ),
        sa.Column("materiality", sa.Integer(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["cluster_id"], ["event_clusters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_claims_cluster_id"), "claims", ["cluster_id"], unique=False)
    op.create_index(op.f("ix_claims_state"), "claims", ["state"], unique=False)
    op.create_table(
        "editorial_reviews",
        sa.Column("cluster_id", sa.UUID(), nullable=False),
        sa.Column("risk_level", sa.Enum("STANDARD", "HIGH", name="risklevel"), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "state",
            sa.Enum("NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED", name="reviewstate"),
            nullable=False,
        ),
        sa.Column("reviewer_id", sa.UUID(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["cluster_id"], ["event_clusters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_editorial_reviews_cluster_id"), "editorial_reviews", ["cluster_id"], unique=False
    )
    op.create_table(
        "notifications",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("cluster_id", sa.UUID(), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=400), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["cluster_id"],
            ["event_clusters.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_notifications_cluster_id"), "notifications", ["cluster_id"], unique=False
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
    op.create_table(
        "primary_documents",
        sa.Column("cluster_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=600), nullable=False),
        sa.Column("title_hi", sa.String(length=600), nullable=True),
        sa.Column("issuer", sa.String(length=300), nullable=False),
        sa.Column("url", sa.String(length=1400), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("document_hash", sa.String(length=64), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["cluster_id"], ["event_clusters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("url"),
    )
    op.create_index(
        op.f("ix_primary_documents_cluster_id"), "primary_documents", ["cluster_id"], unique=False
    )
    op.create_table(
        "publisher_domains",
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["publisher_organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("domain"),
    )
    op.create_index(
        op.f("ix_publisher_domains_organization_id"),
        "publisher_domains",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "rights_policies",
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("policy_name", sa.String(length=160), nullable=False),
        sa.Column("may_store_full_text", sa.Boolean(), nullable=False),
        sa.Column("may_store_excerpt", sa.Boolean(), nullable=False),
        sa.Column("may_summarize", sa.Boolean(), nullable=False),
        sa.Column("attribution_required", sa.Boolean(), nullable=False),
        sa.Column("terms_url", sa.String(length=1000), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["publisher_organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_rights_policies_organization_id"),
        "rights_policies",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "saved_clusters",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("cluster_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["cluster_id"], ["event_clusters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "cluster_id", name="uq_saved_cluster"),
    )
    op.create_index(
        op.f("ix_saved_clusters_cluster_id"), "saved_clusters", ["cluster_id"], unique=False
    )
    op.create_index(op.f("ix_saved_clusters_user_id"), "saved_clusters", ["user_id"], unique=False)
    op.create_table(
        "summary_versions",
        sa.Column("cluster_id", sa.UUID(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(length=12), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("evidence_map", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("generator_name", sa.String(length=100), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["cluster_id"], ["event_clusters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "cluster_id", "version", "language", name="uq_summary_version_language"
        ),
    )
    op.create_index(
        op.f("ix_summary_versions_cluster_id"), "summary_versions", ["cluster_id"], unique=False
    )
    op.create_table(
        "source_feeds",
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("rights_policy_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "feed_type",
            sa.Enum("RSS", "API", "LICENSED", "OFFICIAL", name="feedtype"),
            nullable=False,
        ),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("language", sa.String(length=12), nullable=False),
        sa.Column("approved", sa.Boolean(), nullable=False),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("health_status", sa.String(length=32), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["publisher_organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["rights_policy_id"],
            ["rights_policies.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("url"),
    )
    op.create_index(
        op.f("ix_source_feeds_organization_id"), "source_feeds", ["organization_id"], unique=False
    )
    op.create_table(
        "articles",
        sa.Column("feed_id", sa.UUID(), nullable=False),
        sa.Column("publisher_organization_id", sa.UUID(), nullable=False),
        sa.Column("canonical_url", sa.String(length=1400), nullable=False),
        sa.Column("title", sa.String(length=600), nullable=False),
        sa.Column("title_hi", sa.String(length=600), nullable=True),
        sa.Column("excerpt", sa.Text(), nullable=True),
        sa.Column("language", sa.String(length=12), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum("INGESTED", "PUBLISHED", "HELD", "REMOVED", name="contentstatus"),
            nullable=False,
        ),
        sa.Column("source_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["feed_id"],
            ["source_feeds.id"],
        ),
        sa.ForeignKeyConstraint(
            ["publisher_organization_id"],
            ["publisher_organizations.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("canonical_url"),
    )
    op.create_index(op.f("ix_articles_feed_id"), "articles", ["feed_id"], unique=False)
    op.create_index(op.f("ix_articles_published_at"), "articles", ["published_at"], unique=False)
    op.create_index(
        op.f("ix_articles_publisher_organization_id"),
        "articles",
        ["publisher_organization_id"],
        unique=False,
    )
    op.create_table(
        "article_fingerprints",
        sa.Column("article_id", sa.UUID(), nullable=False),
        sa.Column("exact_hash", sa.String(length=64), nullable=False),
        sa.Column("normalized_url_hash", sa.String(length=64), nullable=False),
        sa.Column("simhash", sa.String(length=32), nullable=True),
        sa.Column("syndication_group", sa.String(length=64), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("article_id"),
    )
    op.create_index(
        op.f("ix_article_fingerprints_exact_hash"),
        "article_fingerprints",
        ["exact_hash"],
        unique=False,
    )
    op.create_index(
        op.f("ix_article_fingerprints_normalized_url_hash"),
        "article_fingerprints",
        ["normalized_url_hash"],
        unique=False,
    )
    op.create_index(
        op.f("ix_article_fingerprints_simhash"), "article_fingerprints", ["simhash"], unique=False
    )
    op.create_index(
        op.f("ix_article_fingerprints_syndication_group"),
        "article_fingerprints",
        ["syndication_group"],
        unique=False,
    )
    op.create_table(
        "claim_evidence",
        sa.Column("claim_id", sa.UUID(), nullable=False),
        sa.Column("article_id", sa.UUID(), nullable=True),
        sa.Column("primary_document_id", sa.UUID(), nullable=True),
        sa.Column("locator", sa.String(length=500), nullable=False),
        sa.Column("support_score", sa.Float(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["claim_id"], ["claims.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["primary_document_id"], ["primary_documents.id"], ondelete="CASCADE"
        ),
        sa.CheckConstraint(
            "num_nonnulls(article_id, primary_document_id) = 1",
            name="ck_claim_evidence_one_source",
        ),
        sa.CheckConstraint(
            "support_score >= 0 AND support_score <= 1",
            name="ck_claim_evidence_support_score",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_claim_evidence_article_id"), "claim_evidence", ["article_id"], unique=False
    )
    op.create_index(
        op.f("ix_claim_evidence_claim_id"), "claim_evidence", ["claim_id"], unique=False
    )
    op.create_index(
        op.f("ix_claim_evidence_primary_document_id"),
        "claim_evidence",
        ["primary_document_id"],
        unique=False,
    )
    op.create_table(
        "cluster_articles",
        sa.Column("cluster_id", sa.UUID(), nullable=False),
        sa.Column("article_id", sa.UUID(), nullable=False),
        sa.Column("relevance_score", sa.Float(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("is_syndicated_copy", sa.Boolean(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cluster_id"], ["event_clusters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cluster_id", "article_id", name="uq_cluster_article"),
    )
    op.create_index(
        op.f("ix_cluster_articles_article_id"), "cluster_articles", ["article_id"], unique=False
    )
    op.create_index(
        op.f("ix_cluster_articles_cluster_id"), "cluster_articles", ["cluster_id"], unique=False
    )
    op.create_table(
        "corrections",
        sa.Column("cluster_id", sa.UUID(), nullable=True),
        sa.Column("article_id", sa.UUID(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("description_hi", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["article_id"],
            ["articles.id"],
        ),
        sa.ForeignKeyConstraint(
            ["cluster_id"],
            ["event_clusters.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_corrections_article_id"), "corrections", ["article_id"], unique=False)
    op.create_index(op.f("ix_corrections_cluster_id"), "corrections", ["cluster_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_corrections_cluster_id"), table_name="corrections")
    op.drop_index(op.f("ix_corrections_article_id"), table_name="corrections")
    op.drop_table("corrections")
    op.drop_index(op.f("ix_cluster_articles_cluster_id"), table_name="cluster_articles")
    op.drop_index(op.f("ix_cluster_articles_article_id"), table_name="cluster_articles")
    op.drop_table("cluster_articles")
    op.drop_index(op.f("ix_claim_evidence_primary_document_id"), table_name="claim_evidence")
    op.drop_index(op.f("ix_claim_evidence_claim_id"), table_name="claim_evidence")
    op.drop_index(op.f("ix_claim_evidence_article_id"), table_name="claim_evidence")
    op.drop_table("claim_evidence")
    op.drop_index(
        op.f("ix_article_fingerprints_syndication_group"), table_name="article_fingerprints"
    )
    op.drop_index(op.f("ix_article_fingerprints_simhash"), table_name="article_fingerprints")
    op.drop_index(
        op.f("ix_article_fingerprints_normalized_url_hash"), table_name="article_fingerprints"
    )
    op.drop_index(op.f("ix_article_fingerprints_exact_hash"), table_name="article_fingerprints")
    op.drop_table("article_fingerprints")
    op.drop_index(op.f("ix_articles_publisher_organization_id"), table_name="articles")
    op.drop_index(op.f("ix_articles_published_at"), table_name="articles")
    op.drop_index(op.f("ix_articles_feed_id"), table_name="articles")
    op.drop_table("articles")
    op.drop_index(op.f("ix_source_feeds_organization_id"), table_name="source_feeds")
    op.drop_table("source_feeds")
    op.drop_index(op.f("ix_summary_versions_cluster_id"), table_name="summary_versions")
    op.drop_table("summary_versions")
    op.drop_index(op.f("ix_saved_clusters_user_id"), table_name="saved_clusters")
    op.drop_index(op.f("ix_saved_clusters_cluster_id"), table_name="saved_clusters")
    op.drop_table("saved_clusters")
    op.drop_index(op.f("ix_rights_policies_organization_id"), table_name="rights_policies")
    op.drop_table("rights_policies")
    op.drop_index(op.f("ix_publisher_domains_organization_id"), table_name="publisher_domains")
    op.drop_table("publisher_domains")
    op.drop_index(op.f("ix_primary_documents_cluster_id"), table_name="primary_documents")
    op.drop_table("primary_documents")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_cluster_id"), table_name="notifications")
    op.drop_table("notifications")
    op.drop_index(op.f("ix_editorial_reviews_cluster_id"), table_name="editorial_reviews")
    op.drop_table("editorial_reviews")
    op.drop_index(op.f("ix_claims_state"), table_name="claims")
    op.drop_index(op.f("ix_claims_cluster_id"), table_name="claims")
    op.drop_table("claims")
    op.drop_index(op.f("ix_user_preferences_user_id"), table_name="user_preferences")
    op.drop_table("user_preferences")
    op.drop_index(op.f("ix_publisher_organizations_slug"), table_name="publisher_organizations")
    op.drop_table("publisher_organizations")
    op.drop_index(op.f("ix_follows_user_id"), table_name="follows")
    op.drop_table("follows")
    op.drop_index(op.f("ix_event_clusters_slug"), table_name="event_clusters")
    op.drop_index(op.f("ix_event_clusters_location"), table_name="event_clusters")
    op.drop_index(op.f("ix_event_clusters_display_order"), table_name="event_clusters")
    op.drop_index(op.f("ix_event_clusters_category"), table_name="event_clusters")
    op.drop_index("ix_event_cluster_category_location", table_name="event_clusters")
    op.drop_table("event_clusters")
    op.drop_index(op.f("ix_briefs_edition"), table_name="briefs")
    op.drop_table("briefs")
    op.drop_index(op.f("ix_audit_logs_entity_type"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_actor_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs")
    op.drop_table("audit_logs")
    # PostgreSQL enum types outlive their tables unless explicitly removed.
    op.execute("DROP TYPE IF EXISTS feedtype")
    op.execute("DROP TYPE IF EXISTS claimstate")
    op.execute("DROP TYPE IF EXISTS reviewstate")
    op.execute("DROP TYPE IF EXISTS risklevel")
    op.execute("DROP TYPE IF EXISTS contentstatus")
    op.execute("DROP EXTENSION IF EXISTS vector")
