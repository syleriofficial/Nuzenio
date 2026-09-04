# Backup and recovery considerations

## Remediation migration/recovery procedure

R1–R6 adds forward revision `b85f0e1162da` after `a74e9b0216cd`. It creates append-only material
contributor records, retires legacy potentially stale summaries and holds high-risk content with
unknown provenance. It never infers contributors from the last-editor column or fabricates an
approval. There is intentionally no public/API switch to assert unknown provenance is complete:
legacy high-risk content needs an evidence-backed, independently reviewed reconstruction/forward
repair or a newly reconstructed cluster with recorded authors. A new edit alone cannot release it.
Contributor history is conservatively retained even if a later rewrite removes an author's text.
Re-run runtime-role provisioning after migration so the new table receives SELECT/INSERT only.
Runtime UPDATE/DELETE/TRUNCATE/trigger alteration are denied, just as for audit history.

Forward chain: `8ca634735948 -> b31f72a9c4de -> d4f8c2a71e90 -> e52ba4d9013c -> f61c2d0387ab -> a74e9b0216cd`.
Do not edit the applied 2A/2B migrations. Back up and stop runtime writers/workers before upgrading.
The new revisions hold legacy high-risk content, mark unmapped summaries pending, fence legacy runs,
convert/retain legacy brief slugs, remove redundant uniqueness constraints and block audit TRUNCATE.
No historical reviewer identity or evidence is fabricated. Expect affected stories to leave public feeds
until re-reviewed. Large tables require a maintenance window: data repair/index work acquires locks.

Run migrations with owner credentials, then `python -m nuzenio_api.db_roles` with a separately supplied
runtime password, then `alembic check` and smoke tests. Restart API/worker with runtime credentials.
Runtime code cannot upgrade schema. Recovery after Redis loss re-dispatches durable queued/due-retry
rows and reclaims expired leases; a prior lease token can never commit after replacement.

These safety migrations deliberately refuse downgrade. Prefer a forward repair; emergency rollback
requires restoring a tested pre-upgrade database backup and matching code while writers are stopped.
Owners/superusers can still change triggers/grants: protect and audit their credentials separately.
Never delete application volumes as a migration or test shortcut.

This repository contains local foundations, not a production deployment or automated backup service. The following is the required production design baseline.

## PostgreSQL

PostgreSQL is authoritative for staff accounts, hashed sessions, publisher rights, editorial versions, audit history, feed-run state and reader content. Use encrypted continuous WAL archiving plus scheduled full backups, with separate credentials and immutable retention for audit-bearing backups. Protect encryption keys outside the database environment.

Set recovery objectives before launch. A reasonable starting proposal is an RPO under 15 minutes and RTO under 2 hours, subject to legal/editorial review. Run restore drills into an isolated environment at least quarterly. A restore is complete only after:

1. the expected Alembic revision is present;
2. row counts and foreign-key checks pass;
3. the append-only audit trigger exists and rejects update/delete;
4. rights dates and paused states are reevaluated;
5. all pre-incident staff sessions are revoked;
6. a reader/API smoke test passes before traffic resumes.

Do not restore by running the demonstration seed over production.

## Redis

Redis carries queue availability, not authoritative editorial state. AOF is enabled in local Compose. Production may restore Redis when operationally useful, but queued `FeedRun` rows in PostgreSQL are recoverable by the worker and delayed retries can be recreated. Never restore Redis in a way that bypasses current rights or kill switches.

## Secrets and staff access

Database credentials, session pepper and bootstrap token require a versioned secret-manager recovery procedure. Treat restoration after compromise as a rotation event: revoke sessions, rotate credentials, verify named staff roles and preserve incident audit evidence. Password hashes are sensitive even though they are not plaintext.

## Audit retention

Application users cannot alter audit rows. Database administrators technically can, so production access, backup deletion and retention jobs require separate controls and logs. Legal policy must define IP/user-agent retention and export handling. Test restoration must use sanitized data rather than a production snapshot on developer machines.
