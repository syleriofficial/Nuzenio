"""Private fixture article assignment; existing content is untouched."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a81c3d7e520b"
down_revision = "76d934bfa102"
branch_labels = None
depends_on = None


def timestamps():
    return (
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def upgrade() -> None:
    op.create_table(
        "draft_workspaces",
        *timestamps(),
        sa.Column(
            "cluster_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("event_clusters.id"),
            unique=True,
            nullable=False,
        ),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("staff_users.id"),
            nullable=False,
        ),
        sa.Column("assignment_revision", sa.Integer(), nullable=False),
        sa.CheckConstraint("assignment_revision >= 1", name="ck_draft_revision"),
    )
    op.create_table(
        "article_draft_assignments",
        *timestamps(),
        sa.Column(
            "article_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("articles.id"),
            unique=True,
            nullable=False,
        ),
        sa.Column(
            "cluster_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("event_clusters.id"),
            nullable=False,
        ),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("staff_users.id"),
            nullable=False,
        ),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("rights_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("article_version", sa.Integer(), nullable=False),
        sa.Column("cluster_version", sa.Integer(), nullable=False),
    )
    op.create_index(
        "ix_article_draft_assignments_cluster_id", "article_draft_assignments", ["cluster_id"]
    )


def downgrade() -> None:
    raise RuntimeError("Draft assignments are durable; use a reviewed forward migration.")
