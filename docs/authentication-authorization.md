# Authentication and authorization

## Remediation changes

Admission is atomic across global, IP and normalized-account Redis buckets before Argon2. Rotating
IPs does not reset the account bucket. Fixed windows have bounded cooldowns and denied attempts
do not renew them. A Redis-backed verifier lease caps concurrent work across API processes; Redis
failure denies login before hashing. The database still records successful and failed attempts.
There is no production in-memory fallback. Reverse proxy headers are ignored unless the socket
peer is in an explicit trusted CIDR. Roles and the permission matrix below are unchanged.

Database authorization is separate: owner credentials are restricted to migrations/provisioning.
API and worker identities cannot own tables, create schema objects, truncate audit logs or disable
triggers. Production startup verifies the identity. Database owners/superusers remain trusted
operators outside this guarantee; external immutable audit replication is still recommended.

## Authentication model

Nuzenio has staff accounts only. There is no public registration route, default account or seeded production password. An operator with database access runs `python -m nuzenio_api.staff create`; production additionally checks an interactively entered bootstrap token against the secret-managed `NUZENIO_BOOTSTRAP_TOKEN`.

Passwords are hashed with Argon2id using a 64 MiB memory cost, three iterations, parallelism two, a random 16-byte salt and a 32-byte output. Plaintext passwords are never logged or stored. Login performs a dummy Argon2 verification for unknown usernames so the normal failure path does not disclose account existence.

Successful login creates independent random session and CSRF tokens. Only keyed SHA-256 hashes are stored in PostgreSQL. Both cookies are `HttpOnly`, `SameSite=Strict`, scoped to `/`, time-limited and `Secure` in production. The UI keeps the CSRF value returned by the session response in memory; the API compares its `X-CSRF-Token` header with the companion cookie and server-side hash for every state-changing browser request. Tokens are never stored in `localStorage`.

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
- A high-risk drafter cannot perform final approval. The final reviewer cannot approve alert readiness; that requires another authorized person.
- Role changes and account disabling revoke affected sessions. A user cannot disable their own current account.
- Permission failures use a consistent `403 permission_denied` envelope and are not bypassed by calling the API directly.

## Operational recommendations

Use TLS at the reverse proxy, a unique high-entropy session pepper from a secret manager, short staff-account review cycles, and separate named accounts. Do not share administrator credentials. Terminate all active sessions after suspected compromise, rotate the pepper only with a deliberate all-session invalidation plan, and retain authentication/audit events according to the organization’s legal policy.
