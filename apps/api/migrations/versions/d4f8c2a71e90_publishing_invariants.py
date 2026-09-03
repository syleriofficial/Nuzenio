"""Fail closed for legacy approvals and structurally invalid evidence.

Revision ID: d4f8c2a71e90
Revises: b31f72a9c4de
No historical approvals or evidence are fabricated. Previous data is retained.
"""

import sqlalchemy as sa
from alembic import op

revision = "d4f8c2a71e90"
down_revision = "b31f72a9c4de"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "event_clusters",
        sa.Column("material_revision", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "editorial_reviews",
        sa.Column("material_revision", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("editorial_reviews", sa.Column("superseded_at", sa.DateTime(timezone=True)))
    op.execute("UPDATE editorial_reviews SET superseded_at = now(), version = version + 1")
    op.execute("""UPDATE event_clusters SET status='HELD', review_state='PENDING',
        push_ready=false, version=version+1 WHERE risk_level='HIGH'
        OR lower(category) IN ('elections','communal violence','war','terrorism',
        'health emergencies','public safety','market-moving')""")
    op.execute("""CREATE FUNCTION nuzenio_current_review(cid uuid) RETURNS boolean
    LANGUAGE sql STABLE AS $$
        SELECT EXISTS(SELECT 1 FROM editorial_reviews r JOIN event_clusters c ON c.id=r.cluster_id
          WHERE c.id=cid AND r.material_revision=c.material_revision AND r.superseded_at IS NULL
          AND r.decision='APPROVED' AND r.state='APPROVED' AND r.completed_at IS NOT NULL
          AND r.drafted_by_id IS NOT NULL AND r.reviewer_id IS NOT NULL
          AND r.drafted_by_id<>r.reviewer_id)
    $$""")
    op.execute(r"""CREATE FUNCTION nuzenio_summary_valid(sid uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE AS $$
    DECLARE s record; parts text[]; entry jsonb; ref text; idx int := 0;
    BEGIN
      SELECT * INTO s FROM summary_versions WHERE id=sid;
      IF NOT FOUND OR btrim(s.summary_text)='' OR jsonb_typeof(s.evidence_map)<>'object'
        OR NOT (s.evidence_map ? 'sentences') OR jsonb_typeof(s.evidence_map->'sentences')<>'array'
        OR (SELECT count(*) FROM jsonb_object_keys(s.evidence_map))<>1 THEN RETURN false; END IF;
      parts := regexp_split_to_array(btrim(s.summary_text), '(?<=[.!?।])\s+');
      IF jsonb_array_length(s.evidence_map->'sentences')<>array_length(parts,1)
        THEN RETURN false; END IF;
      FOR entry IN SELECT value FROM jsonb_array_elements(s.evidence_map->'sentences') LOOP
        idx := idx+1;
        IF jsonb_typeof(entry)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(entry))<>2
          OR NOT (entry ? 'text' AND entry ? 'evidence_ids') OR entry->>'text'<>parts[idx]
          OR jsonb_typeof(entry->'evidence_ids')<>'array'
          OR jsonb_array_length(entry->'evidence_ids')=0 THEN RETURN false; END IF;
        FOR ref IN SELECT value FROM jsonb_array_elements_text(entry->'evidence_ids') LOOP
          IF NOT EXISTS(SELECT 1 FROM claim_evidence e JOIN claims c ON c.id=e.claim_id
            WHERE e.id=ref::uuid AND c.cluster_id=s.cluster_id AND (
              EXISTS(SELECT 1 FROM cluster_articles a
                WHERE a.cluster_id=s.cluster_id AND a.article_id=e.article_id)
              OR EXISTS(SELECT 1 FROM primary_documents d
                WHERE d.cluster_id=s.cluster_id AND d.id=e.primary_document_id)
            )) THEN RETURN false; END IF;
        END LOOP;
      END LOOP;
      RETURN true;
    EXCEPTION WHEN OTHERS THEN RETURN false;
    END $$""")
    op.execute("""UPDATE summary_versions SET decision='PENDING', row_version=row_version+1,
        rejection_reason='Legacy evidence requires sentence-level editorial mapping'
        WHERE NOT nuzenio_summary_valid(id)""")
    op.alter_column("summary_versions", "decision", server_default="PENDING")


def downgrade():
    raise RuntimeError(
        "Publishing safety migration is forward-only; restore a tested backup to roll back."
    )
