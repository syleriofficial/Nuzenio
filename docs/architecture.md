# Nuzenio architecture

## Milestone 2A topology

```text
Next.js PWA (server-rendered reader routes)
                  |
          typed HTTP contracts
                  v
FastAPI routes -> transactional services -> repositories
                  |                         |
                  |                         v
                  |                PostgreSQL + pgvector
                  v
       deterministic pipeline interfaces     Redis-ready jobs/cache
```

The checked-in fictional fixture is no longer the normal reader data source. Alembic creates the schema, the idempotent seed persists the fixture, and all requested public reader routes query FastAPI. The fixture can be used directly by the web client only in non-production development when `NUZENIO_ENABLE_DEMO_FALLBACK=true` is explicitly set.

## Request flow

1. A dynamic Next.js route reads `lang` and route/search parameters.
2. `lib/api-client.ts` calls the configured FastAPI base URL with `cache: no-store`, a timeout and the public camelCase contract.
3. FastAPI validates pagination, filters and language, then creates a request-scoped SQLAlchemy session.
4. `ReaderService` opens a transaction and invokes `ReaderRepository`.
5. The repository filters publishable/review-approved clusters and eagerly loads source, claim, evidence, summary, document and correction relationships.
6. The service enforces evidence and source-diversity invariants and maps the ORM graph to Pydantic response schemas.
7. The web mapper adapts the API contract to the preserved Milestone 1 presentation model.

Database and validation failures use one JSON shape:

```json
{
  "error": {
    "code": "cluster_not_found",
    "message": "Story cluster 'missing' was not found.",
    "status": 404
  }
}
```

## Monorepo boundaries

- `apps/web`: Next.js App Router PWA, preserved bilingual reader UI, typed API client, route states and web contract tests.
- `apps/api`: FastAPI application, Pydantic contracts, SQLAlchemy entities, repository/service layers, Alembic migrations, seed and deterministic content-pipeline providers.
- `infra/postgres/init`: optional local PostgreSQL extension bootstrap. The migration also owns `CREATE EXTENSION IF NOT EXISTS vector`, so a clean pgvector-capable database can migrate without Compose initialization.
- `docs`: API, environment, architecture and product decisions.

## Persistence and transactions

PostgreSQL is the system of record. Alembic revision `8ca634735948` creates the complete 20-table domain schema and the `vector` extension. `EventCluster.event_embedding` is `vector(768)` for future similarity work; Milestone 2A does not calculate embeddings.

Reader services use a transaction per operation. Repositories own query construction, pagination and eager loading. Services own language selection, evidence suppression, independent-source counting and response mapping. Sessions roll back on unhandled failures and are closed by the dependency boundary.

The seed uses stable natural keys and upserts related records in a single transaction. Running it repeatedly converges on the same 14 publishers, seven clusters, 23 articles, 21 claims and four language-specific briefs.

Redis is configured and health-checked in Compose but intentionally not read by reader endpoints yet. It is reserved for ingestion queues, retry schedules and hot-reader caching.

## Domain invariants

1. Only `PUBLISHED` clusters with `NOT_REQUIRED` or `APPROVED` review state are public.
2. High-risk seeded stories are public only after editorial approval.
3. `PublisherOrganization` owns one or more domains. Independent diversity counts organization IDs, not domains or URLs.
4. A syndicated `ClusterArticle` remains visible for attribution but contributes no independent source.
5. A claim without `ClaimEvidence` is omitted from public responses.
6. A summary without a non-empty evidence map is unavailable and is not returned as factual copy.
7. Hindi requests select Hindi summary/headline/claim records; individual translated source headlines carry a machine-translation flag.
8. Summary versions, corrections and event timelines are immutable-history-ready, though mutation workflows remain out of scope.

## Pipeline adapters

`nuzenio_api.pipeline.interfaces` retains protocols for approved feed ingestion, canonical URL normalization, exact duplication, syndicated-copy detection, event clustering, classification, evidence mapping, summary generation, translation, material-update detection and search.

`nuzenio_api.pipeline.demo` provides deterministic credential-free implementations and an in-memory search adapter for isolated pipeline tests. Real ingestion, paid models and OpenSearch are not activated.

## Operational model

- Local dependency mode: Compose runs PostgreSQL/pgvector and Redis; Alembic, seed, Uvicorn and Next.js run on the host.
- All-in-one API mode: the `api` Compose service waits for healthy dependencies, migrates, idempotently seeds and starts Uvicorn.
- CI mode: PostgreSQL/pgvector and Redis service containers back an explicit migration/seed smoke test and a disposable migrated integration-test database.

## Security and rights posture

- No credentials, tokens or publisher content are committed.
- CORS is an environment allow-list; credentials are disabled.
- Full-text storage remains false by default in `RightsPolicy`.
- All outbound seeded URLs use reserved demonstration domains.
- Production API errors do not trigger hidden local-fixture substitution.
- Admin surfaces remain non-persistent previews pending authentication, authorization and audit-controlled writes.
