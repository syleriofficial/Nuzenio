# Database migrations

Alembic is the only owner of the PostgreSQL schema. Application startup and the
seed command never call `create_all`. Review every generated revision before it
is committed, keep applied revisions immutable, and run upgrades before seeding.
