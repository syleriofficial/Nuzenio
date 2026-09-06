# Database migrations

Alembic is the only owner of the PostgreSQL schema. Application startup and the
seed command never call `create_all`. Review every generated revision before it
is committed, keep applied revisions immutable, and run upgrades before seeding.
Current head `6d0a4f2b8c91` adds append-only database protection for preserved
authentication-event history. Re-provision and assert restricted runtime/audit
identities after every upgrade.
