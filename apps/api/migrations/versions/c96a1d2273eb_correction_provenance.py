"""Persist correction authors and hold unsafe legacy corrected content.

Revision ID: c96a1d2273eb
Revises: b85f0e1162da
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c96a1d2273eb"
down_revision = "b85f0e1162da"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "corrections",
        sa.Column("provenance_complete", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_table(
        "correction_contributors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "correction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("corrections.id"),
            nullable=False,
        ),
        sa.Column(
            "staff_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("staff_users.id"),
            nullable=False,
        ),
        sa.Column("first_version", sa.Integer(), nullable=False),
        sa.UniqueConstraint("correction_id", "staff_user_id", name="uq_correction_contributor"),
    )
    for field in ("correction_id", "staff_user_id"):
        op.create_index(f"ix_correction_contributors_{field}", "correction_contributors", [field])
    # These identities and contribution points are verifiable old fields and
    # workflow transitions, not inferred authors. Insert creators first so a
    # same-person resolver retains their earliest known version.
    op.execute("""INSERT INTO correction_contributors(
        id,correction_id,staff_user_id,first_version)
      SELECT gen_random_uuid(),c.id,c.created_by_id,1 FROM corrections c
      WHERE c.created_by_id IS NOT NULL""")
    op.execute("""INSERT INTO correction_contributors(
        id,correction_id,staff_user_id,first_version)
      SELECT gen_random_uuid(),c.id,c.resolved_by_id,c.version FROM corrections c
      WHERE c.resolved_by_id IS NOT NULL
      ON CONFLICT (correction_id,staff_user_id) DO NOTHING""")
    # Old code had create/apply but no draft-edit endpoint. Any unexpected
    # version/status combination remains incomplete and is held below.
    op.execute("""UPDATE corrections SET provenance_complete=true
      WHERE created_by_id IS NOT NULL AND (
        (status='OPEN' AND version=1 AND resolved_by_id IS NULL) OR
        (status='PUBLISHED' AND version=2 AND resolved_by_id IS NOT NULL
          AND resolved_at IS NOT NULL AND published_at IS NOT NULL))""")
    op.execute("""CREATE TRIGGER correction_contributors_append_only
      BEFORE UPDATE OR DELETE ON correction_contributors FOR EACH ROW
      EXECUTE FUNCTION prevent_material_contributor_mutation()""")
    op.execute("""CREATE TRIGGER correction_contributors_no_truncate
      BEFORE TRUNCATE ON correction_contributors FOR EACH STATEMENT
      EXECUTE FUNCTION prevent_material_contributor_mutation()""")
    op.execute("""CREATE TEMP TABLE affected_correction_clusters ON COMMIT DROP AS
      SELECT c.id AS correction_id,c.cluster_id FROM corrections c
        WHERE c.status='PUBLISHED' AND c.cluster_id IS NOT NULL
      UNION SELECT c.id,ca.cluster_id FROM corrections c JOIN cluster_articles ca
        ON ca.article_id=c.article_id WHERE c.status='PUBLISHED'""")
    op.execute("""INSERT INTO material_contributors(
        id,cluster_id,staff_user_id,first_material_revision)
      SELECT gen_random_uuid(),a.cluster_id,cc.staff_user_id,c.material_revision
      FROM affected_correction_clusters a
      JOIN correction_contributors cc ON cc.correction_id=a.correction_id
      JOIN event_clusters c ON c.id=a.cluster_id
      ON CONFLICT (cluster_id,staff_user_id) DO NOTHING""")
    # Re-review every previously published correction after contributor recovery.
    # Unknown lineage sets the existing cluster completeness flag false.
    op.execute("""UPDATE event_clusters c SET status='HELD',push_ready=false,
      review_state=CASE WHEN c.risk_level='HIGH' THEN 'PENDING' ELSE c.review_state END,
      material_revision=c.material_revision+1,version=c.version+1,
      provenance_complete=c.provenance_complete AND NOT EXISTS(
        SELECT 1 FROM affected_correction_clusters a JOIN corrections x ON x.id=a.correction_id
        WHERE a.cluster_id=c.id AND NOT x.provenance_complete)
      WHERE c.id IN (SELECT cluster_id FROM affected_correction_clusters)""")
    op.execute("""UPDATE editorial_reviews SET superseded_at=now(),version=version+1
      WHERE superseded_at IS NULL AND cluster_id IN (
        SELECT cluster_id FROM affected_correction_clusters)""")
    op.execute("""CREATE FUNCTION nuzenio_correction_lineage_complete(cid uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$
      SELECT NOT EXISTS(SELECT 1 FROM corrections x WHERE x.status='PUBLISHED'
        AND (x.cluster_id=cid OR EXISTS(SELECT 1 FROM cluster_articles ca
          WHERE ca.cluster_id=cid AND ca.article_id=x.article_id)) AND (
          NOT x.provenance_complete
          OR (x.created_by_id IS NOT NULL AND NOT EXISTS(
            SELECT 1 FROM correction_contributors cc
            WHERE cc.correction_id=x.id AND cc.staff_user_id=x.created_by_id))
          OR (x.resolved_by_id IS NOT NULL AND NOT EXISTS(
            SELECT 1 FROM correction_contributors cc
            WHERE cc.correction_id=x.id AND cc.staff_user_id=x.resolved_by_id))
          OR EXISTS(SELECT 1 FROM correction_contributors cc WHERE cc.correction_id=x.id
            AND NOT EXISTS(SELECT 1 FROM material_contributors mc
              WHERE mc.cluster_id=cid AND mc.staff_user_id=cc.staff_user_id))))
      $$""")
    op.execute("""CREATE OR REPLACE FUNCTION nuzenio_current_review(cid uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$
      SELECT nuzenio_correction_lineage_complete(cid) AND EXISTS(
        SELECT 1 FROM editorial_reviews r JOIN event_clusters c ON c.id=r.cluster_id
        WHERE c.id=cid AND c.provenance_complete AND r.material_revision=c.material_revision
        AND r.superseded_at IS NULL AND r.decision='APPROVED' AND r.state='APPROVED'
        AND r.completed_at IS NOT NULL AND r.drafted_by_id IS NOT NULL
        AND r.reviewer_id IS NOT NULL AND r.drafted_by_id<>r.reviewer_id
        AND EXISTS(SELECT 1 FROM material_contributors m WHERE m.cluster_id=c.id)
        AND NOT EXISTS(SELECT 1 FROM material_contributors m
          WHERE m.cluster_id=c.id AND m.staff_user_id=r.reviewer_id))
      $$""")


def downgrade():
    raise RuntimeError("Safety migrations are forward-only; restore a tested backup.")
