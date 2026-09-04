# Environment variables

## Remediation settings

`NUZENIO_DATABASE_URL` is now the unprivileged runtime identity. Migrations receive an owner URL
only in the separate migration process/service. `NUZENIO_RUNTIME_PASSWORD` provisions the runtime
role; its checked-in default is explicitly local-only and rejected by production provisioning.
Production secrets must be injected, never committed or passed as CLI password arguments.

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

Production code disables reader fixture fallback regardless of its configured value. Admin operations never have a fixture fallback.

## Core API

| Variable | Local default | Purpose |
| --- | --- | --- |
| `NUZENIO_ENVIRONMENT` | `development` | Use `production` to enable fail-closed checks. |
| `NUZENIO_DATABASE_URL` | local `nuzenio` PostgreSQL | SQLAlchemy/psycopg URL. |
| `NUZENIO_TEST_DATABASE_URL` | local `nuzenio_test` | Disposable API-test database; name must contain `test`. |
| `NUZENIO_REDIS_URL` | `redis://localhost:6379/0` | Ready/delayed feed queue. |
| `NUZENIO_CORS_ORIGINS` | `["http://localhost:3000"]` | Exact JSON origin allow-list; production entries must be HTTPS. |
| `NUZENIO_MAX_PAGE_SIZE` | `50` | Maximum public reader page size. |
| `NUZENIO_SQL_ECHO` | `false` | Local SQL diagnostics. |
| `NUZENIO_DEMO_MODE` | `true` | Enables explicitly fictional `.example` dry-run handling. Must be false in production. |

## Staff security

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
| `NUZENIO_FEED_USER_AGENT` | `NuzenioFeedFetcher/0.3 ...` | Controlled outbound identity. |
| `NUZENIO_FEED_TIMEOUT_SECONDS` | `10` | Absolute complete-fetch deadline, including DNS and redirects. |
| `NUZENIO_FEED_MAX_BYTES` | `2000000` | Maximum streamed response size. |
| `NUZENIO_FEED_REDIRECT_LIMIT` | `3` | Maximum revalidated redirects. |
| `NUZENIO_FEED_HTTPS_REQUIRED` | `true` | Production must remain true. |
| `NUZENIO_FEED_KILL_SWITCH` | `false` | Globally prevents scheduling/execution when true. Compose overrides it to true for fictional seed feeds. |

Per-feed polling interval, rate limit and kill switch are persisted and versioned rather than environment variables.

## Compose-only PostgreSQL

`POSTGRES_DB`, `POSTGRES_USER` and `POSTGRES_PASSWORD` default to `nuzenio` for isolated local Compose use. They are not production credentials. Use secret injection and a managed backup policy for any approved deployment.

## Production validation

When `NUZENIO_ENVIRONMENT=production`, settings construction fails if the session pepper is the placeholder/too short, secure cookies are off, demo mode is on, feed HTTPS is off, or any CORS origin is not HTTPS. This is configuration validation, not a deployment manifest.
