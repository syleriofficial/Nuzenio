# Nuzenio

> One story. Multiple sources. Clear in 60 seconds.

Nuzenio is an India-first news aggregation, clustering, comparison and briefing platform. It does not publish original news. Milestone 2A connects the existing bilingual PWA to a persistent FastAPI reader service backed by PostgreSQL, while preserving device-local reader preferences.

Every seeded story, publisher, document and outbound URL is fictional demonstration data on reserved `.example` domains. No paid AI key, publisher credential, scraping, paywalled content or complete publisher article is used.

## Milestone 2A

### Reader experience

- Preserves all Milestone 1 routes, mobile/desktop behavior, accessibility, English/Hindi switching, themes and PWA assets.
- Loads Top, Local, story detail, source profile, search, morning brief and evening brief from FastAPI.
- Keeps For You, follows, saves, hidden sources, theme and language preferences device-local.
- Includes route loading, empty, not-found and recoverable error states.
- Uses a typed server-friendly API client with runtime contract guards.
- Never silently substitutes fixtures after an API failure. Optional fixture fallback requires `NUZENIO_ENABLE_DEMO_FALLBACK=true` and is disabled in production regardless of configuration.

### Persistent API

- Alembic-owned PostgreSQL schema for publisher, rights, feed, article, fingerprint, cluster, evidence, summary, document, correction and brief records.
- Transactional repository/service boundary with eager relationship loading.
- Pagination, category/status/local filters, bilingual selection and consistent error envelopes.
- Organization-level independent-source counting; multiple domains count once and syndicated copies do not inflate diversity.
- Evidence-free claims are suppressed, and an evidence-free summary is unavailable rather than published.
- Idempotent seven-cluster seed with English/Hindi summaries, claims/evidence, Delhi NCR stories, developing/disputed examples, primary documents, corrections and morning/evening briefs.
- pgvector-ready `vector(768)` cluster embeddings and Redis-ready configuration. OpenSearch is intentionally still an interface only.

Detailed references: [architecture](docs/architecture.md), [API](docs/api.md), [environment](docs/environment.md), and [product decisions](docs/product-decisions.md).

## Repository structure

```text
Nuzenio/
├── .github/workflows/ci.yml
├── apps/
│   ├── api/
│   │   ├── migrations/             # Alembic environment and reviewed revisions
│   │   ├── src/nuzenio_api/
│   │   │   ├── pipeline/           # deterministic provider interfaces/implementations
│   │   │   ├── demo_data.py        # fictional canonical seed fixture
│   │   │   ├── models.py           # SQLAlchemy domain model
│   │   │   ├── repositories.py     # persistence queries
│   │   │   ├── services.py         # transactional reader mapping/invariants
│   │   │   ├── schemas.py          # public API contracts
│   │   │   ├── main.py             # FastAPI routes
│   │   │   └── seed.py             # idempotent database seed
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   └── web/
│       ├── app/                     # Next.js App Router routes and route states
│       ├── components/              # preserved Milestone 1 UI
│       ├── lib/                     # typed API client, contracts, preferences
│       ├── public/                  # PWA manifest, icons, service worker
│       └── tests/
├── docs/
├── infra/postgres/init/
├── .env.example
├── compose.yaml
└── package.json
```

## Prerequisites

- Node.js 22.13 or newer
- Python 3.12 or newer
- Docker Desktop or Docker Engine with Compose

## Local setup

From the repository root:

```bash
cp .env.example .env
npm install
python3 -m venv apps/api/.venv
apps/api/.venv/bin/pip install -e 'apps/api[dev]'
docker compose up -d postgres redis
cd apps/api
.venv/bin/alembic -c alembic.ini upgrade head
.venv/bin/python -m nuzenio_api.seed
cd ../..
```

Start the API and web app in separate terminals:

```bash
apps/api/.venv/bin/uvicorn nuzenio_api.main:app --app-dir apps/api/src --reload --port 8000
npm run dev:web
```

Open `http://localhost:3000`; API documentation is at `http://localhost:8000/docs`.

Alternatively, start the migration-seeded API plus its dependencies with Compose:

```bash
docker compose up --build api
```

The Compose API command applies pending migrations and runs the idempotent fictional seed before starting Uvicorn.

## Database operations

```bash
cd apps/api
.venv/bin/alembic -c alembic.ini current
.venv/bin/alembic -c alembic.ini upgrade head
.venv/bin/python -m nuzenio_api.seed
.venv/bin/python -m nuzenio_api.seed --dry-run
```

Do not call `Base.metadata.create_all()` for managed environments; Alembic is the schema authority.

## Quality commands

With PostgreSQL and Redis running:

```bash
npm run format:web
npm run lint:web
npm run test:web
npm run build:web
apps/api/.venv/bin/ruff format --check apps/api
apps/api/.venv/bin/ruff check apps/api
apps/api/.venv/bin/pytest apps/api/tests
docker compose config --quiet
```

API tests create, migrate, seed and remove a disposable `nuzenio_test` database. Override it with `NUZENIO_TEST_DATABASE_URL` when necessary. CI runs the same gates with PostgreSQL/pgvector and Redis service containers.

## Reader routes

| Route | Data source |
| --- | --- |
| `/` | `GET /v1/feed/top` |
| `/for-you` | API feed plus device-local preferences/explanations |
| `/local` | `GET /v1/feed/local` for Delhi NCR |
| `/briefs` | Morning and evening brief endpoints |
| `/following` | API feed plus device-local follows |
| `/story/[slug]` | `GET /v1/clusters/{slug}` |
| `/source/[slug]` | `GET /v1/sources/{slug}` |
| `/search` | `GET /v1/search` |
| `/settings` | Device-local settings |
| `/admin` | Milestone 1 interaction previews; no persistent admin writes yet |

## Milestone boundary

Not included: authentication, real publisher ingestion or polling, paid AI providers, OpenSearch deployment, browser push, Android packaging, production admin mutations, or deployment. See the recommended next scope in [product decisions](docs/product-decisions.md).

## Licence

No licence has been selected. All rights are reserved until the repository owner adds one.
