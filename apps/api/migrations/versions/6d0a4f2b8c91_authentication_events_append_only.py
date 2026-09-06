"""Protect authentication-event history from runtime mutation.

Revision ID: 6d0a4f2b8c91
Revises: c96a1d2273eb
"""

from alembic import op

revision = "6d0a4f2b8c91"
down_revision = "c96a1d2273eb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This migration adds enforcement only. Existing rows and identifiers are untouched.
    op.execute(
        """
        CREATE FUNCTION prevent_authentication_event_mutation() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'authentication_events is append-only';
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER authentication_events_append_only
          BEFORE UPDATE OR DELETE ON authentication_events
          FOR EACH ROW EXECUTE FUNCTION prevent_authentication_event_mutation();
        CREATE TRIGGER authentication_events_no_truncate
          BEFORE TRUNCATE ON authentication_events
          FOR EACH STATEMENT EXECUTE FUNCTION prevent_authentication_event_mutation();
        """
    )
    # The default role may already exist on upgraded installations. Custom runtime roles
    # receive the same grants when the explicit provisioning step is rerun after migration.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nuzenio_runtime') THEN
            REVOKE UPDATE, DELETE, TRUNCATE ON authentication_events FROM nuzenio_runtime;
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    raise RuntimeError("Safety migrations are forward-only; restore a tested backup.")
