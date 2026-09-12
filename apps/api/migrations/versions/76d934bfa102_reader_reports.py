"""Private reader submissions; no content/editorial mutation.

Revision ID: 76d934bfa102
Revises: 6d0a4f2b8c91
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "76d934bfa102"
down_revision = "6d0a4f2b8c91"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reader_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "cluster_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("event_clusters.id", ondelete="SET NULL"),
        ),
        sa.Column("story_slug", sa.String(300), nullable=False),
        sa.Column("language", sa.String(2), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("details", sa.String(2000), nullable=False),
        sa.Column("submission_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), server_default="NEW", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("resolution_note", sa.String(1000), server_default="", nullable=False),
        sa.Column("handled_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("staff_users.id")),
        sa.CheckConstraint(
            "status IN ('NEW','REVIEWING','RESOLVED','DISMISSED')", name="ck_report_status"
        ),
        sa.CheckConstraint("language IN ('en','hi')", name="ck_report_language"),
        sa.CheckConstraint(
            "category IN ('INACCURATE','OUTDATED','UNCLEAR','OTHER')", name="ck_report_category"
        ),
        sa.CheckConstraint("version >= 1", name="ck_report_version"),
    )
    op.create_index("ix_reader_reports_queue", "reader_reports", ["status", "created_at", "id"])
    # Explicit role provisioning must be rerun after migration (as in Compose).


def downgrade() -> None:
    raise RuntimeError("Reader reports are durable; use a reviewed forward migration.")
