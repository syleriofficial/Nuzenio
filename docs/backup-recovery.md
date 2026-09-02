# Backup and recovery considerations

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
