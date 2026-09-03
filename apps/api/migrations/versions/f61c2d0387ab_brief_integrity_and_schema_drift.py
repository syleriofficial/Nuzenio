"""Stable brief references, metadata alignment, audit TRUNCATE protection.

Revision ID: f61c2d0387ab
Revises: e52ba4d9013c
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "f61c2d0387ab"
down_revision = "e52ba4d9013c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("briefs", sa.Column("legacy_cluster_slugs", JSONB()))
    op.execute("UPDATE briefs SET legacy_cluster_slugs=cluster_ids")
    op.execute("""UPDATE briefs b SET cluster_ids=COALESCE((
      SELECT jsonb_agg(c.id::text ORDER BY s.n)
      FROM jsonb_array_elements_text(b.legacy_cluster_slugs) WITH ORDINALITY s(slug,n)
      JOIN event_clusters c ON c.slug=s.slug), '[]'::jsonb), version=version+1""")
    op.execute("""UPDATE briefs SET published_at=NULL WHERE
      jsonb_array_length(cluster_ids)<>jsonb_array_length(legacy_cluster_slugs)""")
    for table, column in [
        ("staff_users", "username"),
        ("staff_sessions", "token_hash"),
        ("login_throttles", "subject_hash"),
        ("edition_controls", "edition"),
    ]:
        op.drop_constraint(f"{table}_{column}_key", table, type_="unique")
    op.execute("""CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
      FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_mutation()""")


def downgrade():
    raise RuntimeError("Safety migrations are forward-only; restore a tested backup.")
