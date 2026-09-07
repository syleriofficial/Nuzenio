# Backup and recovery considerations

## Remediation migration/recovery procedure

R1–R6 adds forward revision `b85f0e1162da` after `a74e9b0216cd`; the correction-authorship closure
adds `c96a1d2273eb`; production hardening adds `6d0a4f2b8c91`. Together they create append-only cluster,
correction-contributor and authentication-event records,
retire legacy potentially stale summaries, and hold corrected/high-risk content with unknown
provenance. The correction migration recovers only persisted creator and applying-editor identities
at their verifiable workflow versions; it does not infer intermediate editors or fabricate an
approval. There is intentionally no public/API switch to assert unknown provenance is complete:
legacy high-risk content needs an evidence-backed, independently reviewed reconstruction/forward
repair or a newly reconstructed cluster with recorded authors. A new edit alone cannot release it.
Contributor history is conservatively retained even if a later rewrite removes an author's text.
Re-run runtime-role provisioning after migration so the new table receives SELECT/INSERT only.
Runtime UPDATE/DELETE/TRUNCATE/trigger alteration are denied, just as for audit history.

Forward chain: `8ca634735948 -> b31f72a9c4de -> d4f8c2a71e90 -> e52ba4d9013c -> f61c2d0387ab -> a74e9b0216cd -> b85f0e1162da -> c96a1d2273eb -> 6d0a4f2b8c91`.
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

This repository contains local foundations, not a production deployment or automated backup service.
The following is the required production design baseline.

## Guarded backup and restore commands

`scripts/backup-postgres.sh` creates a new custom-format `pg_dump` with owner/ACL metadata removed.
It uses an exclusively created random mode-0600 partial in the destination directory, then publishes
with a same-filesystem hard link that cannot overwrite a destination created concurrently. Existing
files, destination symlinks and symlinks anywhere in the existing output-directory chain are refused.
Supply the connection URI
through the environment; restore verification validates both source and target before its first
database command, and each operation writes the password only to a temporary mode-0600
`PGPASSFILE`, removes the original variable from child environments and gives PostgreSQL tools only a
passwordless explicit `--dbname=...` argument:

```bash
NUZENIO_BACKUP_DATABASE_URL="$DATABASE_URL_FROM_SECRET_MANAGER" \
NUZENIO_BACKUP_OUTPUT=/secure/new/nuzenio-2026-09-07.dump \
scripts/backup-postgres.sh
```

`scripts/restore-postgres.sh` accepts only a readable custom backup, an exact confirmation matching
the connected database, a target name containing `restore` or `recovery`, and a database with zero
user tables. It never uses `--clean`, never drops a database and restores in one transaction:

```bash
NUZENIO_RESTORE_DATABASE_URL="$ISOLATED_EMPTY_RESTORE_URL" \
NUZENIO_RESTORE_CONFIRM_DATABASE=nuzenio_restore_drill \
NUZENIO_RESTORE_INPUT=/secure/nuzenio-2026-09-07.dump \
scripts/restore-postgres.sh
```

`scripts/verify-postgres-restore.sh` runs both and compares the Alembic head plus cluster/audit row
counts. The CI Compose job executes it against a second tmpfs PostgreSQL instance, never a developer
volume. A production drill must additionally perform foreign-key, trigger/role, rights/expiry,
session-revocation and reader acceptance checks listed below. Encrypt and checksum backup artifacts
with infrastructure controls outside this repository.

Only canonical `postgres://` or `postgresql://` URIs with a user, host and database are accepted;
option-shaped inputs, control characters, malformed authorities, unsafe components and unapproved
connection parameters fail before any PostgreSQL command runs. Query percent escapes must be
syntactically valid before parsing and after each bounded decode stage. Every allowed query key and
value is also checked for raw, percent-encoded and double-percent-encoded ASCII or Unicode controls,
so malformed escapes and controls cannot reach `psql`, `pg_dump` or `pg_restore`. Repeated
allowlisted parameters remain supported. These scripts require Python 3 and PostgreSQL client tools.
The CI `postgres-ops-test` runs real dump/restore tooling and exercises URI injection,
argv/environment credential absence, symlinks, races, concurrent writers and interruption.

## PostgreSQL

PostgreSQL is authoritative for staff accounts, hashed sessions, publisher rights, editorial versions, audit history, feed-run state and reader content. Use encrypted continuous WAL archiving plus scheduled full backups, with separate credentials and immutable retention for audit-bearing backups. Protect encryption keys outside the database environment.

Provisional launch assumptions are an RPO of 15 minutes and RTO of 2 hours. They require continuous
encrypted WAL archival, at least daily encrypted full backups, an independent retention location and
measured quarterly restore drills; without those deployed controls the targets are not met. Legal,
editorial and infrastructure owners must approve the final objectives. A restore is complete only
after:

1. the expected Alembic revision is present;
2. row counts and foreign-key checks pass;
3. the append-only audit trigger exists and rejects update/delete;
4. rights dates and paused states are reevaluated;
5. all pre-incident staff sessions are revoked;
6. a reader/API smoke test passes before traffic resumes.

Do not restore by running the demonstration seed over production.

Record backup start/end, encrypted object identifier, checksum, PostgreSQL/Alembic version, operator
and retention class without recording connection URLs. Alert on a missed daily backup, WAL archival
lag beyond 10 minutes, verification failure or a quarterly drill exceeding the RTO.

## Redis

Redis carries queue availability, not authoritative editorial state. AOF is enabled in local Compose. Production may restore Redis when operationally useful, but queued `FeedRun` rows in PostgreSQL are recoverable by the worker and delayed retries can be recreated. Never restore Redis in a way that bypasses current rights or kill switches.

## Secrets and staff access

Database credentials, session pepper and bootstrap token require a versioned secret-manager recovery procedure. Treat restoration after compromise as a rotation event: revoke sessions, rotate credentials, verify named staff roles and preserve incident audit evidence. Password hashes are sensitive even though they are not plaintext.

## Audit retention

Application users cannot alter audit rows. Database administrators technically can, so production access, backup deletion and retention jobs require separate controls and logs. Legal policy must define IP/user-agent retention and export handling. Test restoration must use sanitized data rather than a production snapshot on developer machines.
