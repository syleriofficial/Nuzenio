"""Durable worker leases, active-run exclusion, persistent kill switch.

Revision ID: e52ba4d9013c
Revises: d4f8c2a71e90
"""

import sqlalchemy as sa
from alembic import op

revision = "e52ba4d9013c"
down_revision = "d4f8c2a71e90"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "feed_controls",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("paused", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("id = 1", name="ck_feed_control_singleton"),
    )
    op.execute("INSERT INTO feed_controls(id) VALUES (1)")
    op.add_column("feed_runs", sa.Column("lease_token", sa.UUID()))
    op.add_column("feed_runs", sa.Column("lease_expires_at", sa.DateTime(timezone=True)))
    op.add_column("feed_runs", sa.Column("heartbeat_at", sa.DateTime(timezone=True)))
    op.create_index("ix_feed_runs_lease_expires_at", "feed_runs", ["lease_expires_at"])
    op.execute("""UPDATE feed_runs SET state='SKIPPED', error_code='legacy_duplicate_run',
        completed_at=now() WHERE id IN (SELECT id FROM (SELECT id,
        row_number() OVER (PARTITION BY feed_id ORDER BY created_at,id) AS rn
        FROM feed_runs WHERE state IN ('QUEUED','RUNNING','RETRYING')) r WHERE rn>1)""")
    op.execute("UPDATE feed_runs SET state='QUEUED' WHERE state='RUNNING'")
    op.create_index(
        "uq_feed_run_active",
        "feed_runs",
        ["feed_id"],
        unique=True,
        postgresql_where=sa.text("state IN ('QUEUED','RUNNING','RETRYING')"),
    )


def downgrade():
    raise RuntimeError("Worker safety migration is forward-only; restore a tested backup.")
