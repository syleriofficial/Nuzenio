# Nuzenio

> One story. Multiple sources. Clear in 60 seconds.

Nuzenio is an India-first news aggregation, clustering, comparison and briefing platform. It does not write original news. Milestone 2B preserves the bilingual reader PWA and adds authenticated editorial operations, rights-aware source onboarding, controlled feed jobs, correction propagation and an append-only audit trail.

PR #1's R1–R6 security round adds contributor-bound independent approval, irreversible stale-summary
invalidation and private-safe static-only PWA caching. Apply forward migration `b85f0e1162da` and
re-provision the runtime role before starting this code. Legacy high-risk content with unknown
authorship remains held; do not infer historical authors or approvals. See the
[remediation record](docs/security-remediation.md) and [recovery procedure](docs/backup-recovery.md).
Password verification uses supervised subprocesses with a local OS-lock capacity bound; it does
not claim a partition-safe fleet-wide work limit. Independent security re-review is still required.

All checked-in stories, publishers, documents and links are fictional demonstration data on reserved `.example` domains. No real publisher is fetched, no full article is stored, and no production credential is included.

## What works

### Reader

- Top, For You, Delhi NCR Local, Briefs, Following, story, source, search and settings routes remain responsive, accessible, bilingual and installable.
- Public data comes from the PostgreSQL-backed FastAPI reader API. Demo fallback is opt-in for development and is always disabled in production.
- Public clusters show organization-level source diversity, evidence-backed claims, source comparisons, primary documents and correction history.
- Held, suppressed and unapproved high-risk clusters are excluded from public reader queries.

### Editorial operations

- Staff accounts are created only with a protected CLI. Passwords use Argon2id; session and CSRF tokens are random, stored only as keyed hashes server-side, and delivered in secure cookie flows.
- Five roles are enforced by FastAPI permissions as well as reflected in the admin UI.
- Persistent workflows cover review queues, headlines, claims, summaries, merge/split, suppression, corrections, primary documents, sources, rights, feed runs, edition pause and staff/session revocation.
- All editable records use version checks. Stale writes return `409 version_conflict`.
- High-risk drafting and final approval require different staff users. Alert readiness requires a separate explicit approval and does not send a notification.
- Audit records contain actor/role, action, before/after summaries, correlation ID, approval relationship and outcome. Database triggers reject updates and deletes.

### Feed operations

- Redis backs ready and delayed-run queues; PostgreSQL remains the durable source of run state.
- A worker schedules due approved feeds, recovers queued database work, applies bounded exponential retries and records dead letters and run metrics.
- Runtime gates require approved publisher, verified domain, current approved rights and approved feed. Expired or revoked rights pause affected feeds.
- Fetching enforces public HTTPS targets in production, DNS/IP checks, redirect revalidation, rebinding protection, response limits, content types, safe XML parsing and text sanitation.
- Tests use local RSS/XML fixtures with injected transports. Compose enables the global feed kill switch so seeded `.example` URLs are never contacted.

## Repository structure

```text
Nuzenio/
├── .github/workflows/ci.yml
├── apps/
│   ├── api/
│   │   ├── migrations/versions/   # reader and editorial/security revisions
│   │   ├── src/nuzenio_api/
│   │   │   ├── pipeline/          # deterministic provider interfaces
│   │   │   ├── admin_routes.py    # authenticated admin API
│   │   │   ├── auth.py            # Argon2id/session/CSRF controls
│   │   │   ├── editorial.py       # versioned trust workflows
│   │   │   ├── onboarding.py      # publisher/domain/rights/feed states
│   │   │   ├── feed_security.py   # SSRF/XML safety boundary
│   │   │   ├── feed_operations.py # Redis queue, scheduler and executor
│   │   │   ├── audit.py           # redacted append-only events
│   │   │   ├── models.py          # SQLAlchemy domain model
│   │   │   ├── seed.py            # idempotent fictional reader seed
│   │   │   └── staff.py           # protected account bootstrap
│   │   └── tests/                 # API, migration, worker and security tests
│   └── web/
│       ├── app/                    # Next.js routes and route states
│       ├── components/             # reader and editorial workspace
│       ├── e2e/                    # Playwright and axe coverage
│       ├── lib/                    # typed reader/admin API clients
│       └── public/                 # PWA assets
├── docs/                           # architecture and operating policies
├── infra/postgres/init/
├── .env.example
└── compose.yaml
```

## Prerequisites

- Node.js 22.13 or newer
- Python 3.12 or newer
- Docker Desktop or Docker Engine with Compose

## Local setup

```bash
cp .env.example .env
npm ci
python3 -m venv apps/api/.venv
apps/api/.venv/bin/pip install -e 'apps/api[dev]'
docker compose up -d --build api worker
# Explicit development-only fixtures; never part of runtime startup.
docker compose --profile demo run --rm seed
```

Create the first local staff account. The password is prompted and never accepted as a command-line argument:

```bash
cd apps/api
.venv/bin/python -m nuzenio_api.staff create \
  --username editor-admin \
  --display-name "Local Administrator" \
  --role ADMINISTRATOR
cd ../..
```

Production bootstrap additionally prompts for a secret matching `NUZENIO_BOOTSTRAP_TOKEN`. Inject the expected value with the eventual deployment secret mechanism; neither token nor password is accepted as a command-line argument.

The Compose setup already runs API and worker. Start the web app with `npm run dev:web`.
For host-process development instead, stop only the Compose API/worker (keep PostgreSQL/Redis),
then use the runtime URL in `.env` and start these processes in separate terminals:

```bash
apps/api/.venv/bin/uvicorn nuzenio_api.main:app --app-dir apps/api/src --reload --port 8000
```

```bash
cd apps/api && .venv/bin/python -m nuzenio_api.feed_operations
```

```bash
npm run dev:web
```

Open `http://localhost:3000`; staff sign-in is at `/admin`, and OpenAPI is at `http://localhost:8000/docs`.

For the containerized API and worker:

```bash
docker compose up --build -d api worker
docker compose ps
```

The separate `migrate` service owns schema changes and provisions the unprivileged runtime role.
Neither API nor worker migrates or seeds. `docker compose --profile demo run --rm seed` is an
explicit create-only development operation. High-risk fixtures stay held until independent review.
The Compose feed kill switch is deliberately on for fictional seed data.

## Database and staff operations

```bash
cd apps/api
.venv/bin/alembic -c alembic.ini current
.venv/bin/alembic -c alembic.ini upgrade head
.venv/bin/python -m nuzenio_api.seed
.venv/bin/python -m nuzenio_api.seed --dry-run
.venv/bin/python -m nuzenio_api.staff create --help
```

Alembic is the schema authority; application startup and seeds never call `create_all`. Tests refuse to drop any database whose name does not contain `test`.

Run migration commands with a separately injected owner database URL, never runtime credentials.
Existing installations should back up first, stop workers, run the forward migration service,
provision runtime grants, and only then restart runtime services. See
[security remediation](docs/security-remediation.md), [database recovery](docs/backup-recovery.md),
and [environment settings](docs/environment.md). Independent re-review is required before merge.

## Validation commands

With PostgreSQL and Redis running:

```bash
npm run format:web
npm run lint:web
npm run test:web
apps/api/.venv/bin/ruff format --check apps/api
apps/api/.venv/bin/ruff check apps/api
apps/api/.venv/bin/pytest apps/api/tests
npm audit --audit-level=low
apps/api/.venv/bin/python -m pip freeze --all --exclude-editable | apps/api/.venv/bin/pip-audit --strict --no-deps --disable-pip -r /dev/stdin
npm run test:e2e
npm run build:web
docker compose config --quiet
docker compose up --build -d api worker
docker compose ps
```

Playwright rebuilds a guarded `nuzenio_e2e` database and creates test-only staff fixtures. Browser tests never use internet services. API tests independently migrate, seed and remove `nuzenio_test`.

For sandboxed hosts that cannot launch Chromium, `infra/testing/Dockerfile` provides a disposable
Linux Node 22.13/Python 3.12 browser-test image. Supply isolated test database/Redis URLs using the
documented E2E overrides; never point tests at application databases. Detailed remediation,
reproductions, validation results and remaining risks are in [the F01–F15 checklist](docs/security-remediation.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Reader and admin API](docs/api.md)
- [Environment variables](docs/environment.md)
- [Authentication, authorization and permission matrix](docs/authentication-authorization.md)
- [Editorial operating procedure](docs/editorial-operating-procedure.md)
- [Feed-security threat model](docs/feed-security-threat-model.md)
- [Publisher-rights workflow](docs/publisher-rights-workflow.md)
- [Correction policy](docs/correction-policy.md)
- [Backup and recovery](docs/backup-recovery.md)
- [Product decisions](docs/product-decisions.md)

## Explicit boundary

Milestone 2B does not include real publisher connections, publisher self-service, reader accounts, OpenSearch, paid AI, browser push, Android packaging, production deployment, full-article hosting or political-bias scoring.

## Licence

No licence has been selected. All rights are reserved until the repository owner adds one.
