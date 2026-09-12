# Environment variables

## Remediation settings

`NUZENIO_DATABASE_URL` is the unprivileged runtime identity. Migrations receive
`NUZENIO_MIGRATION_DATABASE_URL` only in the separate migration process/service.
`NUZENIO_RUNTIME_PASSWORD` and `NUZENIO_AUDIT_PASSWORD` provision distinct runtime and restricted
audit-reader roles; checked-in defaults are explicitly local-only and rejected by production
provisioning. Production secrets must be injected, never committed or passed as CLI arguments.

Login defaults: `NUZENIO_LOGIN_GLOBAL_LIMIT=120`, `NUZENIO_LOGIN_IP_LIMIT=30`,
`NUZENIO_LOGIN_ATTEMPT_LIMIT=5`, `NUZENIO_LOGIN_WINDOW_SECONDS=60`,
`NUZENIO_LOGIN_CONCURRENCY=4`, `NUZENIO_LOGIN_KEY_PREFIX=nuzenio:auth:v2`.
The former `NUZENIO_LOGIN_LOCKOUT_MINUTES` is deprecated and unused. Counters use fixed Redis TTLs;
blocked requests never extend cooldowns. Redis unavailability fails closed before Argon2.

`NUZENIO_LOGIN_VERIFIER_TIMEOUT_SECONDS=3` (0.1–10) is the supervised password subprocess deadline.
`NUZENIO_LOGIN_LOCK_DIRECTORY` defaults to the OS temp directory plus `nuzenio-password-<uid>`.
Configure a private, operator-managed LOCAL filesystem directory in production, shared by all API
processes intended to share capacity. Do not remove/replace its files while work may still run or
resume. `NUZENIO_LOGIN_CONCURRENCY` now caps that local lock domain, not a Redis lease or fleet.
See [ownership/recovery and resource limits](authentication-authorization.md#password-work-ownership-r5).

`NUZENIO_TRUSTED_PROXY_CIDRS=[]` trusts no forwarding headers. Uvicorn is started with
`--no-proxy-headers`; explicitly configured proxy CIDRs are processed by the application right-to-left.
Do not use broad trusted ranges or expose an origin that assumes all clients are trusted proxies.
`NUZENIO_ALLOWED_HOSTS` independently constrains HTTP Host values. Production rejects wildcards,
suffix wildcards and local development hosts. Empty trusted-proxy CIDRs are safe for a direct origin;
configured CIDRs must be explicit and can never be a `/0` network.

Production requires structured JSON logs and a unique 32+ character `NUZENIO_METRICS_TOKEN`.
The metrics bearer value is never accepted through a query parameter. Client IP logging remains off
unless `NUZENIO_LOG_CLIENT_IP=true` is deliberately enabled with a retention/legal basis.

`NUZENIO_FEED_TIMEOUT_SECONDS` is the complete DNS/TLS/redirect/body deadline, not just idle time.
Production network work is in a killable subprocess. Compressed content is rejected and
`Accept-Encoding: identity` sent. `NUZENIO_FEED_MAX_BYTES` caps encoded and decoded bytes equally.
`NUZENIO_FEED_KILL_SWITCH=true` is recommended for all fixture environments, in addition to the
persistent `/v1/admin/feed-control` switch.

Alternate isolated Compose ports: `POSTGRES_PORT`, `REDIS_PORT`, `API_PORT`.
E2E overrides: `NUZENIO_E2E_DATABASE_URL` (must contain `e2e`) and `NUZENIO_E2E_REDIS_URL`.
Playwright uses a unique limiter namespace and higher test-only counters for fixture logins;
the dedicated auth regression suite tests the production limits and failures.

Copy `.env.example` to `.env` only for local development. Never commit a populated `.env`, tokens, database volumes or generated credentials.

## Web

| Variable | Local example | Purpose |
| --- | --- | --- |
| `NUZENIO_API_BASE_URL` | `http://localhost:8000` | Server-only reader API URL; preferred during server rendering. |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Browser-compatible reader API URL; must contain no credential. |
| `NEXT_PUBLIC_ADMIN_API_BASE_URL` | `http://localhost:8000` | Credentialed admin API origin. CORS must explicitly allow the web origin. |
| `NUZENIO_ENABLE_DEMO_FALLBACK` | `false` | Explicit fixture fallback for non-production reader connectivity/5xx failures only. |
| `NUZENIO_REPORT_WEB_ORIGIN` | `http://localhost:3000` | Required canonical browser origin for report POSTs. No trailing slash; exact match, no Host/forwarded-header inference. Export into the web process or set apps/web/.env.local. Missing/malformed value returns 503; mismatched Origin returns 403. |

Production code disables reader fixture fallback regardless of its configured value. Admin operations never have a fixture fallback.

## Core API

| Variable | Local default | Purpose |
| --- | --- | --- |
| `NUZENIO_ENVIRONMENT` | Required | Exact enum: `development`, `test`, or `production`; casing, whitespace, empty, unset and unknown values are rejected. Local Compose declares `development` explicitly. |
| `NUZENIO_DATABASE_URL` | local `nuzenio` PostgreSQL | SQLAlchemy/psycopg URL. |
| `NUZENIO_TEST_DATABASE_URL` | local `nuzenio_test` | Disposable API-test database; name must contain `test`. |
| `NUZENIO_REDIS_URL` | `redis://localhost:6379/0` | Ready/delayed feed queue. |
| `NUZENIO_CORS_ORIGINS` | `["http://localhost:3000"]` | Exact JSON origin allow-list; production entries must be HTTPS. |
| `NUZENIO_ALLOWED_HOSTS` | local/test hosts | Host-header allow-list. Production requires explicit non-local names. |
| `NUZENIO_MAX_PAGE_SIZE` | `50` | Maximum public reader page size. |
| `NUZENIO_SQL_ECHO` | `false` | Explicit development/test SQL diagnostics only. Every truthy value is rejected in production. |
| `NUZENIO_DEMO_MODE` | `true` | Enables explicitly fictional `.example` dry-run handling. Must be false in production. |
| `NUZENIO_LOG_LEVEL` | `INFO` | Minimum structured application log severity. |
| `NUZENIO_LOG_JSON` | `true` | JSON stdout logs; required in production. |
| `NUZENIO_LOG_CLIENT_IP` | `false` | Opt-in request IP field; avoid unless retention is approved. |
| `NUZENIO_METRICS_TOKEN` | empty | Bearer token for `/metrics`; unique 32+ characters and required in production. |
| `NUZENIO_READINESS_TIMEOUT_SECONDS` | `2` | Bounded Redis connection/read timeout for readiness. |

## Staff security

Reader reports have independent Redis admission: `NUZENIO_REPORT_GLOBAL_LIMIT=120`,
`NUZENIO_REPORT_PEER_LIMIT=30`, `NUZENIO_REPORT_WINDOW_SECONDS=60` and
`NUZENIO_REPORT_KEY_PREFIX=nuzenio:reports:v1`. These are fixed-window attempt caps,
not quotas per reader. The same-origin web proxy intentionally does not forward
client IP headers, so its visitors share a peer bucket. See [reporting limits](reader-reports.md).

| Variable | Local default | Purpose |
| --- | --- | --- |
| `NUZENIO_SESSION_COOKIE_NAME` | `nuzenio_staff_session` | HttpOnly session cookie name. |
| `NUZENIO_CSRF_COOKIE_NAME` | `nuzenio_staff_csrf` | SameSite double-submit CSRF cookie name. |
| `NUZENIO_SESSION_TTL_MINUTES` | `480` | Absolute session lifetime. |
| `NUZENIO_COOKIE_SECURE` | `false` | Must be true in production so cookies require HTTPS. |
| `NUZENIO_SESSION_HASH_PEPPER` | development placeholder | HMAC key for session/CSRF/login-subject hashes. Use a unique 32+ character secret in production. |
| `NUZENIO_BOOTSTRAP_TOKEN` | empty | Secret expected by the interactive staff CLI in production. |
| `NUZENIO_LOGIN_ATTEMPT_LIMIT` | `5` | Account admissions per fixed window. |
| `NUZENIO_LOGIN_LOCKOUT_MINUTES` | `15` | Deprecated; unused. |

Changing the session pepper invalidates every existing cookie. Plan that rotation as a global logout. Neither the bootstrap token nor staff password is accepted as a CLI argument.

## Feed worker and fetcher

| Variable | Default | Purpose |
| --- | --- | --- |
| `NUZENIO_FEED_USER_AGENT` | `NuzenioFeedFetcher/0.4 ...` | Controlled outbound identity. |
| `NUZENIO_FEED_TIMEOUT_SECONDS` | `10` | Absolute complete-fetch deadline, including DNS and redirects. |
| `NUZENIO_FEED_MAX_BYTES` | `2000000` | Maximum streamed response size. |
| `NUZENIO_FEED_REDIRECT_LIMIT` | `3` | Maximum revalidated redirects. |
| `NUZENIO_FEED_HTTPS_REQUIRED` | `true` | Production must remain true. |
| `NUZENIO_FEED_KILL_SWITCH` | `false` | Globally prevents scheduling/execution when true. Compose overrides it to true for fictional seed feeds. |
| `NUZENIO_WORKER_HEALTH_HOST` | `0.0.0.0` | Internal worker health listener; do not publish externally. |
| `NUZENIO_WORKER_HEALTH_PORT` | `8001` | Worker liveness/readiness/metrics port inside its service network. |
| `NUZENIO_WORKER_POLL_SECONDS` | `2` | Maximum blocking queue poll before shutdown is observed. |
| `NUZENIO_WORKER_STALE_AFTER_SECONDS` | `30` | Maximum age of a successful loop for readiness. |

Per-feed polling interval, rate limit and kill switch are persisted and versioned rather than environment variables.

## Compose-only PostgreSQL

`POSTGRES_DB`, `POSTGRES_USER` and `POSTGRES_PASSWORD` default to `nuzenio` for isolated local Compose
use. `NUZENIO_RUNTIME_ROLE`, `NUZENIO_RUNTIME_PASSWORD`, `NUZENIO_AUDIT_ROLE`,
`NUZENIO_AUDIT_PASSWORD` and `NUZENIO_MIGRATION_DATABASE_URL` belong only to the separate role-
provisioning step. Local placeholder values are not production credentials. Use secret injection and
a managed backup policy for any approved deployment.

## Production validation

When `NUZENIO_ENVIRONMENT=production`, settings construction fails for SQL echo, an unsafe session pepper,
metrics token, runtime database identity/password, Redis TLS/password, cookie mode, CORS origin,
Host allow-list, proxy CIDR, log format, demo mode or feed transport/kill-switch state. The global feed
kill switch is deliberately required while the publisher pilot remains unapproved. These checks are
a startup boundary, not a deployment manifest. See [observability](observability.md) and
[secret rotation](secret-rotation.md).

Production allowed hosts are round-trip canonical lowercase ASCII/IDNA DNS names only. Wildcards,
trailing dots, malformed A-labels, schemes, ports, paths, userinfo, whitespace, IP literals, legacy
numeric IPv4 forms, localhost/`.local`/`home.arpa` equivalents and single-label names are rejected
before `TrustedHostMiddleware` is built.

Every application-owned production SQLAlchemy engine—including API/worker runtime, Alembic online
migrations and database-role provisioning—forces statement and pool echo off and enables
`hide_parameters`. The engine policy reparses the exact canonical environment at its own boundary,
suppresses SQLAlchemy DEBUG result-row logging, normalizes direct SQLAlchemy namespace handlers and
sanitizes driver exception details. Role passwords execute through a quoted raw-driver transaction
boundary rather than SQLAlchemy statement logging. This remains true if a caller bypasses settings-
model validation. Application SQL must use bound parameters; values intentionally embedded as SQL
literals are outside this protection
and are prohibited for private data.
Every executable entry point uses the same environment enum and predicate; missing or malformed
configuration cannot fall through to development behavior. API and worker images deliberately do
not carry an environment default. Local Compose and test commands declare their non-production
environment explicitly.
