# Nuzenio

> One story. Multiple sources. Clear in 60 seconds.

Nuzenio is an India-first news aggregation, clustering, comparison and briefing platform. It does not publish original news. It is designed to ingest only approved RSS, API, licensed and official primary-source feeds, then organise related reporting into a single evidence-aware story cluster.

Milestone 1 is a working, installable, bilingual demonstration PWA plus a production-oriented FastAPI and PostgreSQL foundation. Every story, publisher and external URL in the demo is fictional and clearly labelled in the product.

## What is implemented

### Web/PWA

- Mobile-first responsive shell with Top, For You, Local, Briefs and Following navigation.
- English/Hindi switching and persistent light/dark themes.
- Top News story-cluster feed with save, follow, share, hide-source and more/less controls.
- Full story-cluster page with neutral headline, 40–80 word brief, Confirmed/Developing/Disputed claims, organisation-level source count, headline comparison, publisher links, update timeline, primary documents, corrections and issue reporting.
- Explainable For You recommendations.
- Delhi NCR local pilot.
- Morning and evening brief editions.
- Publisher profile with ownership, verified domains, rights and correction policy.
- Search loading, empty, results and simulated error states.
- Settings for language, theme, local edition and personalisation controls.
- Admin demonstrations for source registry, feed health, cluster merge/split, corrections and high-risk review.
- Route-level loading, error and not-found states.
- Manifest, icons, service worker and standalone PWA metadata.
- Page-specific title/description/social metadata for story and source detail routes.

### API and content foundation

- FastAPI health, demo cluster, pipeline preview and admin merge/split preview contracts.
- SQLAlchemy entities for every requested domain object.
- PostgreSQL-first schema with `vector(768)` event embeddings.
- Docker Compose for pgvector/PostgreSQL and Redis.
- Protocols for all pipeline stages and future OpenSearch integration.
- Deterministic URL canonicalisation, fingerprinting, syndicated-copy detection, event clustering, classification, evidence mapping, summary generation, labelled translation and material-update detection.
- Editorial review requirement for defined high-risk topics.
- Seed command for the fictional demonstration fixture.

See [architecture](docs/architecture.md) and [product decisions](docs/product-decisions.md) for the invariants and milestone boundaries.

## Repository structure

```text
Nuzenio/
├── .github/workflows/ci.yml
├── apps/
│   ├── api/
│   │   ├── src/nuzenio_api/
│   │   │   ├── pipeline/
│   │   │   ├── main.py
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   └── seed.py
│   │   ├── tests/
│   │   └── pyproject.toml
│   └── web/
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── public/
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
- Docker with Compose, only when running PostgreSQL and Redis

No paid AI key or publisher credential is required.

## Local setup

From the repository root:

```bash
cp .env.example .env
npm install
python3 -m venv apps/api/.venv
apps/api/.venv/bin/pip install -e 'apps/api[dev]'
```

Run the demonstration web app:

```bash
npm run dev:web
```

Open `http://localhost:3000`.

Run the API without persistence:

```bash
apps/api/.venv/bin/uvicorn nuzenio_api.main:app --reload --port 8000
```

API documentation is available at `http://localhost:8000/docs`.

Run PostgreSQL, pgvector and Redis, then seed demonstration records:

```bash
docker compose up -d
apps/api/.venv/bin/python -m nuzenio_api.seed
```

Validate the seed fixture without starting Docker:

```bash
apps/api/.venv/bin/python -m nuzenio_api.seed --dry-run
```

## Quality commands

```bash
npm run format:web
npm run lint:web
npm run test:web
npm run build:web
apps/api/.venv/bin/ruff check apps/api
apps/api/.venv/bin/ruff format --check apps/api
apps/api/.venv/bin/pytest apps/api/tests
```

CI runs the same lint, test and web build gates on pull requests and `main` pushes.

## Required routes

| Route | Milestone 1 surface |
| --- | --- |
| `/` | Top News cluster feed |
| `/for-you` | Explainable personalised feed |
| `/local` | Delhi NCR local pilot |
| `/briefs` | Morning and evening briefs |
| `/following` | Topic controls and followed feed |
| `/story/[slug]` | Full story-cluster comparison |
| `/source/[slug]` | Publisher organisation profile |
| `/search` | Cluster search states |
| `/settings` | Language, theme, area and personalisation |
| `/admin` | Editorial and source operations demo |

## Content and rights safeguards

- Full publisher articles are neither scraped nor stored by the demo.
- `RightsPolicy.may_store_full_text` defaults to false.
- Pipeline previews suppress unapproved feeds.
- Sample summaries are fictional, source-attributed demonstration copy.
- Organisation ownership and syndication state control source counts.
- Unsupported factual sentences are removed; evidence-free summaries are suppressed.
- High-risk clusters require editorial approval before publication.
- Machine-translated cluster views are visibly labelled.

## Milestone 2

1. Connect the web application to authenticated FastAPI query and mutation endpoints.
2. Add Alembic-managed migrations, database-backed repositories and transactional admin writes.
3. Build publisher onboarding, feed polling, rights enforcement and per-feed rate/backoff controls.
4. Add production duplicate/syndication evaluation datasets and embedding-assisted clustering.
5. Implement editorial authentication, role-based access, dual-control high-risk publication and immutable audit exports.
6. Add correction propagation, material-update notifications and browser push opt-in.
7. Add evaluated Hindi/English translation providers, named-entity/number preservation checks and human override workflows.
8. Build OpenSearch indexing, autocomplete and result-quality evaluation.
9. Add user accounts, cross-device preferences and privacy/retention controls.
10. Add comprehensive browser accessibility, PWA install/offline and end-to-end tests against real approved test feeds.
11. Complete publisher licensing integrations and legal review before using any real content.
12. Package the later Android application only after PWA analytics and product-quality gates are met.

## Licence

No licence has been selected. All rights are reserved until the repository owner adds one.
