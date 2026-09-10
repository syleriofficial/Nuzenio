# Authentication and authorization

## Remediation changes

Admission is atomic across global, IP and normalized-account Redis buckets before Argon2. Rotating
IPs does not reset the account bucket. Fixed windows have bounded cooldowns and denied attempts
do not renew them. Password work runs in a supervised, killable subprocess holding an inherited
POSIX file lock; capacity has no TTL. Redis failure denies login before hashing and detected failure
during verification terminates/reaps the child before capacity is released. The database still records successful and failed attempts.
There is no production in-memory fallback. Reverse proxy headers are ignored unless the socket
peer is in an explicit trusted CIDR. Roles and the permission matrix below are unchanged.

Database authorization is separate: owner credentials are restricted to migrations/provisioning.
API and worker identities cannot own tables, create schema objects, truncate audit logs or disable
triggers. Production startup verifies the identity. Database owners/superusers remain trusted
operators outside this guarantee; external immutable audit replication is still recommended.

## Authentication model

Nuzenio has staff accounts only. There is no public registration route, default account or seeded production password. An operator with database access runs `python -m nuzenio_api.staff create`; production additionally checks an interactively entered bootstrap token against the secret-managed `NUZENIO_BOOTSTRAP_TOKEN`.

Passwords are hashed with Argon2id using a 64 MiB memory cost, three iterations, parallelism two, a random 16-byte salt and a 32-byte output. Plaintext passwords are never logged or stored. Login performs a dummy Argon2 verification for unknown usernames so the normal failure path does not disclose account existence.

Successful login creates independent random session and CSRF tokens. Only keyed SHA-256 hashes are stored in PostgreSQL. Both cookies are `HttpOnly`, `SameSite=Strict`, scoped to `/`, time-limited and `Secure` in production. The UI keeps the CSRF value returned by the session response in memory; the API compares its `X-CSRF-Token` header with the companion cookie and server-side hash for every state-changing browser request. Tokens are never stored in `localStorage`. Authentication events accept runtime INSERTs but reject UPDATE, DELETE and TRUNCATE through grants plus row/statement triggers; migration owners remain the explicitly privileged boundary.

Sessions have an absolute expiry, can be revoked individually through logout or collectively by an administrator, and become invalid when the staff account is disabled. Authentication successes, failures and logout events are stored separately from the append-only audit trail. Redis admission uses separate global, secret-derived IP and account buckets with fixed 60-second windows. Login responses remain generic for known and unknown accounts.

Production configuration refuses to start with the development session pepper, insecure cookies, demo mode, non-HTTPS CORS origins or HTTP feed policy.

## Permission matrix

API permissions are authoritative. The web workspace only uses the same permission list to avoid presenting unusable controls.

| Permission | Administrator | Editor | Reviewer | Publisher Manager | Analyst |
| --- | :---: | :---: | :---: | :---: | :---: |
| Manage staff and roles | ✓ | — | — | — | — |
| Read editorial review queues | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit, merge, split, suppress or restore clusters | ✓ | ✓ | — | — | — |
| Edit evidence-backed claims | ✓ | ✓ | ✓ | — | — |
| Approve or reject summaries | ✓ | ✓ | ✓ | — | — |
| Final high-risk approval / alert readiness | ✓ | — | ✓ | — | — |
| Open and publish corrections | ✓ | ✓ | ✓ | — | — |
| Create and manage publishers, domains, rights drafts and feeds | ✓ | — | — | ✓ | — |
| Review domains, rights and feed onboarding transitions | ✓ | — | — | ✓ | — |
| Dry-run, run, pause and retry feeds | ✓ | — | — | ✓ | — |
| Pause or restore an edition | ✓ | — | — | — | — |
| Search the audit trail | ✓ | — | — | — | ✓ |
| Export the audit trail | ✓ | — | — | — | ✓ |

## Enforcement notes

- Every mutation resolves the current server-side session and permission before reading or changing the target.
- Mutations require CSRF validation in addition to authorization.
- Version checks occur while the row is locked. A stale request returns `409 version_conflict`.
- No material contributor may perform high-risk final approval, including administrators. An identical or NFC/whitespace-equivalent edit cannot change authorship or revision. Contributors survive secondary edits, merge and split. The final reviewer and all contributors are excluded from alert readiness; that requires another authorized person. Legacy unknown provenance remains held.
- Role changes and account disabling revoke affected sessions. A user cannot disable their own current account.
- Permission failures use a consistent `403 permission_denied` envelope and are not bypassed by calling the API directly.

## Operational recommendations

Use TLS at the reverse proxy, a unique high-entropy session pepper from a secret manager, short staff-account review cycles, and separate named accounts. Do not share administrator credentials. Terminate all active sessions after suspected compromise, rotate the pepper only with a deliberate all-session invalidation plan, and retain authentication/audit events according to the organization’s legal policy.

## Password-work ownership (R5)

The strict concurrency guarantee is **per shared local-filesystem lock directory**, container-local
by default; it is host-wide only when every API process/container on that host uses the same local
directory and capacity. It is not a strict distributed/fleet-wide work cap. Redis provides atomic
fleet rate counters, not ownership. Partitions fail closed when detected; an unreachable/suspended
host cannot safely participate in a reclaimable distributed lease. Do not deploy this as a fleet
work-cap guarantee. Set independent host/container CPU/memory/PID limits and edge rate controls.

`NUZENIO_LOGIN_CONCURRENCY` (1–16, default 4) is fixed for a lock domain. A conflicting capacity
configuration fails closed. Directory/file modes are 0700/0600, current-user owned, with symlink
rejection. Use a private **local POSIX filesystem**, never NFS or a periodically purged shared temp
directory. For a persistent host install configure an operator-managed directory explicitly.
Do not unlink/rotate lock files or change capacity while any supervisor or descendant can resume;
stop and confirm termination of all processes before changing the configuration/domain.

The child inherits the open-file-description lock. Closing a supervisor's descriptor, cancellation
of a request awaiter, Redis loss or supervisor death cannot release a live child's ownership. There
is no explicit `LOCK_UN`. Both child and parent enforce wall deadlines (default 3 seconds, configurable
0.1–10); the parent kills then waits/reaps. A stopped child continues owning its slot until actual
exit. If a process cannot be killed/reaped, capacity remains occupied: fail closed, not oversubscribe.
Compose enables an init process to reap orphaned children.

The child has a 2-second soft/3-second hard CPU limit and no core dumps. Linux address space is
capped at 384 MiB per child; macOS development lacks this RLIMIT_AS cap but Argon2 parameter bounds
still apply. Accepted hashes are Argon2id with at most 64 MiB, 3 iterations and parallelism 2.
Passwords/hashes travel over stdin, never argv or logs; the child does not receive application
database/session-secret environment variables. Failed supervision returns generic 503, not a
successful login. A failed Redis health check kills active work; OS ownership is independent of Redis.

References: [flock open-file-description semantics](https://man7.org/linux/man-pages/man2/flock.2.html),
[subprocess timeout and kill/wait behavior](https://docs.python.org/3/library/subprocess.html),
[resource limits](https://docs.python.org/3/library/resource.html).

## Browser private state (R6)

All admin API responses use `Cache-Control: private, no-store`. The service worker intercepts only
explicit public static assets, fetched without credentials; API/admin/RSC requests are network-only.
Logout/login, cross-tab session changes and restored BFCache pages clear in-memory staff data and
abort/invalidate in-flight requests. No private state is persisted to web storage. Logout failure
clears local data but reports that server-side revocation could not be confirmed.
