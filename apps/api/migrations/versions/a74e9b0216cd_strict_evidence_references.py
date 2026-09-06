"""Keep SQL evidence validation aligned with the typed API boundary.

Revision ID: a74e9b0216cd
Revises: f61c2d0387ab
"""

from alembic import op

revision = "a74e9b0216cd"
down_revision = "f61c2d0387ab"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(r"""CREATE OR REPLACE FUNCTION nuzenio_summary_valid(sid uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE AS $$
    DECLARE s record; parts text[]; entry jsonb; ref text; idx int := 0;
    BEGIN
      SELECT * INTO s FROM summary_versions WHERE id=sid;
      IF NOT FOUND OR btrim(s.summary_text)=''
        OR jsonb_typeof(s.evidence_map) IS DISTINCT FROM 'object'
        OR NOT (s.evidence_map ? 'sentences')
        OR jsonb_typeof(s.evidence_map->'sentences') IS DISTINCT FROM 'array'
        OR (SELECT count(*) FROM jsonb_object_keys(s.evidence_map))<>1 THEN RETURN false; END IF;
      parts := regexp_split_to_array(btrim(s.summary_text), '(?<=[.!?।])\s+');
      IF jsonb_array_length(s.evidence_map->'sentences')<>array_length(parts,1)
        THEN RETURN false; END IF;
      FOR entry IN SELECT value FROM jsonb_array_elements(s.evidence_map->'sentences') LOOP
        idx := idx+1;
        IF jsonb_typeof(entry) IS DISTINCT FROM 'object'
          OR (SELECT count(*) FROM jsonb_object_keys(entry))<>2
          OR jsonb_typeof(entry->'text') IS DISTINCT FROM 'string'
          OR entry->>'text' IS DISTINCT FROM parts[idx]
          OR jsonb_typeof(entry->'evidence_ids') IS DISTINCT FROM 'array'
          OR jsonb_array_length(entry->'evidence_ids')=0 THEN RETURN false; END IF;
        FOR ref IN SELECT value FROM jsonb_array_elements_text(entry->'evidence_ids') LOOP
          IF NOT EXISTS(SELECT 1 FROM claim_evidence e JOIN claims c ON c.id=e.claim_id
            WHERE e.id=ref::uuid AND c.cluster_id=s.cluster_id
              AND (e.article_id IS NOT NULL OR e.primary_document_id IS NOT NULL)
              AND (e.article_id IS NULL OR EXISTS(SELECT 1 FROM cluster_articles a
                WHERE a.cluster_id=s.cluster_id AND a.article_id=e.article_id))
              AND (e.primary_document_id IS NULL OR EXISTS(SELECT 1 FROM primary_documents d
                WHERE d.cluster_id=s.cluster_id AND d.id=e.primary_document_id))
            ) THEN RETURN false; END IF;
        END LOOP;
      END LOOP;
      RETURN true;
    EXCEPTION WHEN OTHERS THEN RETURN false;
    END $$""")
    op.execute("""UPDATE summary_versions SET decision='PENDING', row_version=row_version+1,
      rejection_reason='Evidence references require editorial reassessment'
      WHERE decision='APPROVED' AND NOT nuzenio_summary_valid(id)""")


def downgrade():
    raise RuntimeError("Safety migrations are forward-only; restore a tested backup.")
