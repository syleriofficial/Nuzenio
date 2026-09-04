# Nuzenio architecture

## PR #1 remediation invariants

Runtime containers do not migrate or seed. A one-shot owner-credential migration/provisioning
step is separate from an unprivileged API/worker identity. Production startup rejects schema
owners, superusers, role memberships, DDL grants and audit mutation privileges.

High-risk publication requires a non-superseded approval matching `material_revision`, two
distinct staff identities and a completion timestamp. Append-only material contributor lineage
excludes every contributor, not just the last editor, from final/alert approval. Normalized no-op
edits leave revision/authorship unchanged. Every real material edit supersedes old reviews.
Reader SQL applies the same invariant to all feeds, detail, search, sources and briefs.

Summary evidence is a strict sentence/text/evidence-ID structure. PostgreSQL selection and Python
approval validate complete sentence coverage and same-cluster evidence relationships. This is
structural provenance, not truth/entailment verification. Existing unmapped summaries become pending.

Claim/evidence changes and corrections retire affected summary versions in both languages without
overwriting historical text. `nuzenio_public_summary(cluster_id, language)` selects exactly the
currently eligible approved, non-invalidated, structurally valid version (English fallback when
needed). Reader rendering, search matching, counts and pagination use this same SQL predicate.
Historical pending/rejected/invalidated/superseded text cannot become a public search oracle.

Password checks use supervised subprocesses and inherited OS capacity locks, not expiring leases;
see the authentication document for local-domain scope and partition limitations. The PWA caches
only credential-free static assets. Private/API/RSC responses and live reader content are not stored
offline; an explicit bilingual static offline page remains available for public navigation.

Feed claims and final persistence use a short shared advisory control lock, followed by control,
organization, domain, rights, feed and run locks. Network fetches happen outside transactions.
PostgreSQL run rows are the durable dispatch outbox; Redis is a replaceable delivery hint. UUID
lease tokens fence late workers, with 60-second leases and 10-second heartbeats. Competing active
runs per feed are excluded by a partial unique index.

Brief JSON membership now contains immutable cluster UUIDs (not slugs), preserving display order.
The original slugs are archived by the forward migration; unresolved memberships hold the brief.
Merge/split atomically rewrites memberships and holds all results pending derived-content review.

## Milestone 2B topology

```text
Next.js PWA
  ├─ server-rendered reader routes ───────┐
  └─ credentialed editorial workspace ───┤
                                          v
FastAPI reader/admin API → services → SQLAlchemy → PostgreSQL + pgvector
            │                  │                ├─ editorial state/history
            │                  │                └─ durable feed-run records
            │                  └─ append-only audit writer
            v
     Redis ready/delayed queues ← scheduler/worker → guarded feed fetcher
```

PostgreSQL is authoritative. Redis provides delivery and retry timing, but a worker restart recovers queued database runs. The web client never stores staff tokens; it uses credentialed cookies and an in-memory CSRF value returned by the session API.

## Application boundaries

- `apps/web` owns the mobile-first PWA, server-friendly reader fetching, credentialed admin client, UI permission affordances, Playwright journeys and axe scans.
- `apps/api` owns authentication, authorization, public/admin contracts, transactions, persistence, editorial policy, audit events, source rights and guarded ingestion.
- `nuzenio_api.editorial` performs version-checked trust operations and preserves revisions.
- `nuzenio_api.onboarding` owns publisher/domain/rights/feed states and approval gates.
- `nuzenio_api.feed_security` is the outbound-network and XML trust boundary.
- `nuzenio_api.feed_operations` owns Redis delivery, due scheduling, retries, dead letters, run metrics and idempotent article creation.
- deterministic pipeline adapters remain credential-free. OpenSearch and paid providers are not active.

## Transactions and concurrency

Request-scoped SQLAlchemy sessions close or roll back at the dependency boundary. Mutations select their target with `FOR UPDATE`, compare the submitted version, write domain changes plus a redacted audit row, and commit once. A stale version produces a stable 409 response. Merge locks all participating clusters in deterministic ID order; split validates complete, non-overlapping article membership before writing.

The seed uses stable natural keys and one transaction. It remains idempotent and creates no staff accounts. Alembic—not runtime metadata—is the schema authority.

## Migrations

Revision `8ca634735948` creates the Milestone 2A reader schema and pgvector extension.

Revision `b31f72a9c4de` adds:

- staff users, hashed sessions, login throttles and authentication events;
- edition controls, feed runs and dead letters;
- content revisions and correction impacts;
- onboarding, rights, reviewer, expiry, version, suppression, correction and alert-readiness fields;
- audit actor/role, before/after, correlation, approval, outcome and failure fields;
- an `audit_logs` trigger that rejects every update or delete.

The migration is additive and supplies server defaults for existing Milestone 2A rows. Foreign keys connect reviewer/actor identities after the staff table exists. Its downgrade removes the trigger before dependent columns/tables.

## Public-read invariants

1. Only published, unsuppressed clusters with allowed review state are returned.
2. High-risk content requires approved review state; unreviewed material stays held.
3. Only approved summary versions with non-empty evidence maps are selected.
4. Claims without persisted evidence are omitted.
5. Independent-source counts deduplicate by publisher organization and exclude syndicated copies.
6. Edition pause returns a recoverable 503 rather than stale or fallback production data.
7. Corrections remain attached to the public cluster and previous content is retained in revision records.

## Feed execution

The scheduler selects due approved feeds under the shared control lock, persists a `QUEUED` run and advances the next poll. A partial unique index excludes concurrent active runs. After commit, Redis receives an expiring delivery hint. Duplicate delivery is harmless because database claims and lease tokens fence execution; lost Redis state is recovered from queued/due-retry/expired-lease rows. Delayed retries use bounded exponential backoff; four execution attempts end in a dead letter. ETag and Last-Modified values are persisted and sent conditionally. Run history stores HTTP status, bytes, parse/new-item counts, duration and internal failure code.

Before every run, the worker reevaluates publisher, verified-domain, rights dates/flags, feed state, per-source limit and global/source kill switches. Article canonical URLs are unique and fingerprints are persisted, making repeated fixture delivery idempotent.

## Security boundaries

- Production settings fail closed for cookie, pepper, demo, CORS and HTTPS misconfiguration.
- Session and CSRF tokens exist in plaintext only in the browser cookie/session response and are stored as keyed hashes.
- API permissions and CSRF checks precede every mutation; UI hiding is convenience only.
- Feed requests connect to a validated public IP while retaining the original hostname for Host routing and TLS SNI, then recheck DNS before accepting the response.
- Detailed worker failures remain staff-only. Public errors use stable envelopes and audit payloads redact sensitive field names.
- No application route can edit or delete audit history; PostgreSQL independently enforces append-only behavior.

See the focused [authentication](authentication-authorization.md), [feed threat model](feed-security-threat-model.md), [rights workflow](publisher-rights-workflow.md) and [recovery](backup-recovery.md) documents.
