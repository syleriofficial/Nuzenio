"""editorial operations and staff security

Revision ID: b31f72a9c4de
Revises: 8ca634735948
Create Date: 2026-09-02 22:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b31f72a9c4de"
down_revision: str | Sequence[str] | None = "8ca634735948"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> list[sa.Column]:
    return [
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
    ]


def upgrade() -> None:
    op.create_table(
        "staff_users",
        sa.Column("username", sa.String(120), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("password_hash", sa.String(500), nullable=False),
        sa.Column("role", sa.String(40), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "password_changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_staff_users_username", "staff_users", ["username"], unique=True)
    op.create_index("ix_staff_users_role", "staff_users", ["role"], unique=False)

    op.create_table(
        "staff_sessions",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("csrf_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("ip_address", sa.String(80), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["staff_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_staff_sessions_user_id", "staff_sessions", ["user_id"])
    op.create_index("ix_staff_sessions_token_hash", "staff_sessions", ["token_hash"], unique=True)
    op.create_index("ix_staff_sessions_expires_at", "staff_sessions", ["expires_at"])

    op.create_table(
        "login_throttles",
        sa.Column("subject_hash", sa.String(64), nullable=False),
        sa.Column("failed_attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "window_started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("subject_hash"),
    )
    op.create_index(
        "ix_login_throttles_subject_hash", "login_throttles", ["subject_hash"], unique=True
    )
    op.create_index("ix_login_throttles_locked_until", "login_throttles", ["locked_until"])

    op.create_table(
        "authentication_events",
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("username_hash", sa.String(64), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("successful", sa.Boolean(), nullable=False),
        sa.Column("reason", sa.String(160), nullable=True),
        sa.Column("request_id", sa.String(80), nullable=False),
        sa.Column("ip_address", sa.String(80), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["staff_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("user_id", "username_hash", "action", "successful", "request_id"):
        op.create_index(f"ix_authentication_events_{column}", "authentication_events", [column])

    op.create_table(
        "edition_controls",
        sa.Column("edition", sa.String(80), nullable=False),
        sa.Column("paused", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("edition"),
    )
    op.create_index("ix_edition_controls_edition", "edition_controls", ["edition"], unique=True)

    # Every mutable editorial/onboarding row carries a compare-and-swap version.
    additions: dict[str, list[sa.Column]] = {
        "publisher_organizations": [
            sa.Column("onboarding_state", sa.String(32), server_default="DRAFT", nullable=False),
            sa.Column("contact_name", sa.String(200), server_default="", nullable=False),
            sa.Column("contact_email", sa.String(320), server_default="", nullable=False),
            sa.Column("correction_route", sa.String(1000), server_default="", nullable=False),
            sa.Column("reviewed_by_id", sa.UUID(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        ],
        "publisher_domains": [
            sa.Column("onboarding_state", sa.String(32), server_default="DRAFT", nullable=False),
            sa.Column("ownership_evidence", sa.Text(), server_default="", nullable=False),
            sa.Column("reviewed_by_id", sa.UUID(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        ],
        "rights_policies": [
            sa.Column("may_use_headline", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("may_use_thumbnail", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("may_translate", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column(
                "may_generate_audio", sa.Boolean(), server_default=sa.false(), nullable=False
            ),
            sa.Column(
                "may_display_full_text", sa.Boolean(), server_default=sa.false(), nullable=False
            ),
            sa.Column("onboarding_state", sa.String(32), server_default="DRAFT", nullable=False),
            sa.Column("evidence_url", sa.String(1000), nullable=True),
            sa.Column("reviewed_by_id", sa.UUID(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("effective_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        ],
        "source_feeds": [
            sa.Column("domain_id", sa.UUID(), nullable=True),
            sa.Column("onboarding_state", sa.String(32), server_default="DRAFT", nullable=False),
            sa.Column("paused_reason", sa.Text(), nullable=True),
            sa.Column("kill_switch", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("poll_interval_seconds", sa.Integer(), server_default="900", nullable=False),
            sa.Column("rate_limit_per_minute", sa.Integer(), server_default="6", nullable=False),
            sa.Column("etag", sa.String(500), nullable=True),
            sa.Column("last_modified", sa.String(500), nullable=True),
            sa.Column("next_poll_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        ],
        "articles": [sa.Column("version", sa.Integer(), server_default="1", nullable=False)],
        "event_clusters": [
            sa.Column("suppressed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("suppression_reason", sa.Text(), nullable=True),
            sa.Column("corrected_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("push_ready", sa.Boolean(), server_default=sa.false(), nullable=False),
        ],
        "claims": [sa.Column("version", sa.Integer(), server_default="1", nullable=False)],
        "primary_documents": [
            sa.Column("version", sa.Integer(), server_default="1", nullable=False)
        ],
        "summary_versions": [
            sa.Column("decision", sa.String(32), server_default="APPROVED", nullable=False),
            sa.Column("reviewed_by_id", sa.UUID(), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("rejection_reason", sa.Text(), nullable=True),
            sa.Column("row_version", sa.Integer(), server_default="1", nullable=False),
        ],
        "corrections": [
            sa.Column("source_url", sa.String(1400), server_default="", nullable=False),
            sa.Column("evidence", sa.Text(), server_default="", nullable=False),
            sa.Column("resolution", sa.Text(), nullable=True),
            sa.Column(
                "raised_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by_id", sa.UUID(), nullable=True),
            sa.Column("resolved_by_id", sa.UUID(), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        ],
        "saved_clusters": [
            sa.Column("offline_snapshot", postgresql.JSONB(), server_default="{}", nullable=False),
            sa.Column("snapshot_version", sa.Integer(), server_default="1", nullable=False),
        ],
        "briefs": [
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("corrected_at", sa.DateTime(timezone=True), nullable=True),
        ],
        "editorial_reviews": [
            sa.Column("risk_category", sa.String(80), server_default="", nullable=False),
            sa.Column("drafted_by_id", sa.UUID(), nullable=True),
            sa.Column("decision", sa.String(32), server_default="PENDING", nullable=False),
            sa.Column("notes", sa.Text(), server_default="", nullable=False),
            sa.Column("push_approved_by_id", sa.UUID(), nullable=True),
            sa.Column("push_approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        ],
        "audit_logs": [
            sa.Column("actor_role", sa.String(40), nullable=True),
            sa.Column("before_summary", postgresql.JSONB(), nullable=True),
            sa.Column("after_summary", postgresql.JSONB(), nullable=True),
            sa.Column("request_id", sa.String(80), server_default="migration", nullable=False),
            sa.Column("ip_address", sa.String(80), nullable=True),
            sa.Column("user_agent", sa.String(500), nullable=True),
            sa.Column("approval_of_id", sa.UUID(), nullable=True),
            sa.Column("outcome", sa.String(32), server_default="SUCCESS", nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
        ],
    }
    for table, columns in additions.items():
        for column in columns:
            op.add_column(table, column)

    foreign_keys = [
        ("fk_org_reviewer", "publisher_organizations", "reviewed_by_id", "staff_users"),
        ("fk_domain_reviewer", "publisher_domains", "reviewed_by_id", "staff_users"),
        ("fk_rights_reviewer", "rights_policies", "reviewed_by_id", "staff_users"),
        ("fk_feed_domain", "source_feeds", "domain_id", "publisher_domains"),
        ("fk_summary_reviewer", "summary_versions", "reviewed_by_id", "staff_users"),
        ("fk_correction_creator", "corrections", "created_by_id", "staff_users"),
        ("fk_correction_resolver", "corrections", "resolved_by_id", "staff_users"),
        ("fk_review_drafter", "editorial_reviews", "drafted_by_id", "staff_users"),
        ("fk_review_push_approver", "editorial_reviews", "push_approved_by_id", "staff_users"),
    ]
    for name, table, local, remote in foreign_keys:
        op.create_foreign_key(name, table, remote, [local], ["id"])
    for table, column in [
        ("rights_policies", "expires_at"),
        ("source_feeds", "next_poll_at"),
        ("audit_logs", "actor_role"),
        ("audit_logs", "request_id"),
        ("audit_logs", "approval_of_id"),
        ("audit_logs", "outcome"),
    ]:
        op.create_index(f"ix_{table}_{column}", table, [column])

    op.create_table(
        "feed_runs",
        sa.Column("feed_id", sa.UUID(), nullable=False),
        sa.Column("state", sa.String(32), nullable=False),
        sa.Column("attempt", sa.Integer(), server_default="1", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("fetched_bytes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("parsed_items", sa.Integer(), server_default="0", nullable=False),
        sa.Column("new_articles", sa.Integer(), server_default="0", nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.String(100), nullable=True),
        sa.Column("internal_error", sa.Text(), nullable=True),
        sa.Column("request_id", sa.String(80), nullable=False),
        sa.Column("manual_actor_id", sa.UUID(), nullable=True),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["feed_id"], ["source_feeds.id"]),
        sa.ForeignKeyConstraint(["manual_actor_id"], ["staff_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("feed_id", "state", "request_id", "next_retry_at"):
        op.create_index(f"ix_feed_runs_{column}", "feed_runs", [column])

    op.create_table(
        "dead_letter_jobs",
        sa.Column("feed_run_id", sa.UUID(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("retried_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["feed_run_id"], ["feed_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("feed_run_id"),
    )
    op.create_table(
        "content_revisions",
        sa.Column("entity_type", sa.String(80), nullable=False),
        sa.Column("entity_id", sa.UUID(), nullable=False),
        sa.Column("entity_version", sa.Integer(), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("correction_id", sa.UUID(), nullable=True),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["correction_id"], ["corrections.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["staff_users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "entity_type", "entity_id", "entity_version", name="uq_content_revision"
        ),
    )
    op.create_index("ix_content_revisions_entity_type", "content_revisions", ["entity_type"])
    op.create_index("ix_content_revisions_entity_id", "content_revisions", ["entity_id"])
    op.create_table(
        "correction_impacts",
        sa.Column("correction_id", sa.UUID(), nullable=False),
        sa.Column("entity_type", sa.String(80), nullable=False),
        sa.Column("entity_id", sa.UUID(), nullable=False),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["correction_id"], ["corrections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_correction_impacts_correction_id", "correction_impacts", ["correction_id"])
    op.create_index("ix_correction_impacts_entity_type", "correction_impacts", ["entity_type"])
    op.create_index("ix_correction_impacts_entity_id", "correction_impacts", ["entity_id"])

    # Database enforcement is deliberate: even accidental ORM updates/deletes are rejected.
    op.execute(
        """
        CREATE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'audit_logs is append-only';
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER audit_logs_append_only
          BEFORE UPDATE OR DELETE ON audit_logs
          FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_log_mutation")
    for table in ("correction_impacts", "content_revisions", "dead_letter_jobs", "feed_runs"):
        op.drop_table(table)
    for name, table in [
        ("fk_review_push_approver", "editorial_reviews"),
        ("fk_review_drafter", "editorial_reviews"),
        ("fk_correction_resolver", "corrections"),
        ("fk_correction_creator", "corrections"),
        ("fk_summary_reviewer", "summary_versions"),
        ("fk_feed_domain", "source_feeds"),
        ("fk_rights_reviewer", "rights_policies"),
        ("fk_domain_reviewer", "publisher_domains"),
        ("fk_org_reviewer", "publisher_organizations"),
    ]:
        op.drop_constraint(name, table, type_="foreignkey")
    removals = {
        "audit_logs": [
            "actor_role",
            "before_summary",
            "after_summary",
            "request_id",
            "ip_address",
            "user_agent",
            "approval_of_id",
            "outcome",
            "reason",
        ],
        "editorial_reviews": [
            "risk_category",
            "drafted_by_id",
            "decision",
            "notes",
            "push_approved_by_id",
            "push_approved_at",
            "version",
        ],
        "briefs": ["version", "corrected_at"],
        "saved_clusters": ["offline_snapshot", "snapshot_version"],
        "corrections": [
            "source_url",
            "evidence",
            "resolution",
            "raised_at",
            "resolved_at",
            "created_by_id",
            "resolved_by_id",
            "version",
        ],
        "summary_versions": [
            "decision",
            "reviewed_by_id",
            "reviewed_at",
            "rejection_reason",
            "row_version",
        ],
        "primary_documents": ["version"],
        "claims": ["version"],
        "event_clusters": ["suppressed_at", "suppression_reason", "corrected_at", "push_ready"],
        "source_feeds": [
            "domain_id",
            "onboarding_state",
            "paused_reason",
            "kill_switch",
            "poll_interval_seconds",
            "rate_limit_per_minute",
            "etag",
            "last_modified",
            "next_poll_at",
            "version",
        ],
        "articles": ["version"],
        "rights_policies": [
            "may_use_headline",
            "may_use_thumbnail",
            "may_translate",
            "may_generate_audio",
            "may_display_full_text",
            "onboarding_state",
            "evidence_url",
            "reviewed_by_id",
            "reviewed_at",
            "effective_at",
            "expires_at",
            "revoked_at",
            "version",
        ],
        "publisher_domains": [
            "onboarding_state",
            "ownership_evidence",
            "reviewed_by_id",
            "reviewed_at",
            "version",
        ],
        "publisher_organizations": [
            "onboarding_state",
            "contact_name",
            "contact_email",
            "correction_route",
            "reviewed_by_id",
            "reviewed_at",
            "version",
        ],
    }
    for table, columns in removals.items():
        for column in columns:
            op.drop_column(table, column)
    for table in (
        "edition_controls",
        "authentication_events",
        "login_throttles",
        "staff_sessions",
        "staff_users",
    ):
        op.drop_table(table)
