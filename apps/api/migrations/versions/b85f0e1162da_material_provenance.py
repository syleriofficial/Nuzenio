"""Material contributor lineage and irrevocable derived-summary invalidation.

Revision ID: b85f0e1162da
Revises: a74e9b0216cd
Legacy authorship cannot be reconstructed from the previous last-editor field.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b85f0e1162da"
down_revision = "a74e9b0216cd"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "event_clusters",
        sa.Column("provenance_complete", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_table(
        "material_contributors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "cluster_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("event_clusters.id"),
            nullable=False,
        ),
        sa.Column(
            "staff_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("staff_users.id"),
            nullable=False,
        ),
        sa.Column("first_material_revision", sa.Integer(), nullable=False),
        sa.UniqueConstraint("cluster_id", "staff_user_id", name="uq_material_contributor"),
    )
    for field in ("cluster_id", "staff_user_id"):
        op.create_index(f"ix_material_contributors_{field}", "material_contributors", [field])
    op.execute("""CREATE FUNCTION prevent_material_contributor_mutation() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'Material contributor history is append-only';
      END $$""")
    op.execute("""CREATE TRIGGER material_contributors_append_only
      BEFORE UPDATE OR DELETE ON material_contributors FOR EACH ROW
      EXECUTE FUNCTION prevent_material_contributor_mutation()""")
    op.execute("""CREATE TRIGGER material_contributors_no_truncate
      BEFORE TRUNCATE ON material_contributors FOR EACH STATEMENT
      EXECUTE FUNCTION prevent_material_contributor_mutation()""")
    op.add_column("summary_versions", sa.Column("invalidated_at", sa.DateTime(timezone=True)))
    op.add_column("summary_versions", sa.Column("invalidation_reason", sa.Text()))
    op.execute("""UPDATE event_clusters SET status='HELD', review_state='PENDING',
      push_ready=false, version=version+1 WHERE risk_level='HIGH' OR lower(category) IN
      ('elections','communal violence','war','terrorism',
       'health emergencies','public safety','market-moving')""")
    op.execute("""UPDATE editorial_reviews SET superseded_at=now(), version=version+1
      WHERE superseded_at IS NULL""")
    op.execute("""CREATE OR REPLACE FUNCTION nuzenio_current_review(cid uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$
      SELECT EXISTS(SELECT 1 FROM editorial_reviews r JOIN event_clusters c ON c.id=r.cluster_id
        WHERE c.id=cid AND c.provenance_complete AND r.material_revision=c.material_revision
        AND r.superseded_at IS NULL AND r.decision='APPROVED' AND r.state='APPROVED'
        AND r.completed_at IS NOT NULL AND r.drafted_by_id IS NOT NULL
        AND r.reviewer_id IS NOT NULL AND r.drafted_by_id<>r.reviewer_id
        AND EXISTS(SELECT 1 FROM material_contributors m WHERE m.cluster_id=c.id)
        AND NOT EXISTS(SELECT 1 FROM material_contributors m
          WHERE m.cluster_id=c.id AND m.staff_user_id=r.reviewer_id))
      $$""")
    # Previously corrected/edited summaries may still be structurally valid while
    # asserting withdrawn facts. Preserve text but require new mapped versions.
    op.execute("""UPDATE summary_versions s SET invalidated_at=now(),
      invalidation_reason='Legacy material changes require regeneration',
      decision='PENDING', row_version=row_version+1
      WHERE EXISTS(SELECT 1 FROM event_clusters c WHERE c.id=s.cluster_id
        AND (c.material_revision>1 OR c.corrected_at IS NOT NULL))""")
    op.execute("""CREATE FUNCTION nuzenio_public_summary(cid uuid, lang text) RETURNS uuid
      LANGUAGE sql STABLE AS $$
      SELECT s.id FROM summary_versions s WHERE s.cluster_id=cid AND s.language IN (lang,'en')
        AND s.decision='APPROVED' AND s.invalidated_at IS NULL AND nuzenio_summary_valid(s.id)
      ORDER BY (s.language=lang) DESC, s.version DESC, s.id LIMIT 1
      $$""")


def downgrade():
    raise RuntimeError("Safety migrations are forward-only; restore a tested backup.")
