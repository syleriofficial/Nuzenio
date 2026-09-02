# Nuzenio architecture

## Milestone 1 topology

```text
Approved RSS / API / licensed / official feeds
                         |
                         v
  canonicalise -> exact dedupe -> syndication detection
                         |
                         v
  event cluster -> category / location / risk classification
                         |
                         v
 evidence mapping -> evidence-first brief -> labelled translation
                         |
                         v
       PostgreSQL + pgvector       Redis-ready jobs/cache
                         |
                         v
       FastAPI contracts -> web/PWA story-cluster experience
```

The web application currently uses a deterministic in-repository demonstration fixture so the vertical slice runs without PostgreSQL, Redis, a publisher connection or paid AI credentials. The FastAPI contracts and seed path use the same product invariants and are ready to become the live data source.

## Monorepo boundaries

- `apps/web`: mobile-first App Router UI, PWA assets, bilingual demonstration content and web unit tests.
- `apps/api`: FastAPI service, SQLAlchemy entities, deterministic pipeline providers, OpenSearch-compatible interface and API/domain tests.
- `infra/postgres/init`: PostgreSQL extension bootstrapping; the `vector` extension is enabled at database creation.
- `docs`: product, architecture and operational decisions.

## Domain invariants

1. Every item entering the pipeline must identify an approved feed. Unapproved items are suppressed before canonicalisation, clustering and summarisation.
2. `PublisherOrganization` owns one or more `PublisherDomain` records. Source diversity counts unique publisher organisations, never URLs or domains.
3. Exact copies collapse by stable content fingerprint. Probable syndicated copies retain provenance but do not increase independent-source diversity.
4. An `EventCluster` is the public unit. `ClusterArticle` keeps article membership and syndication state.
5. Each `Claim` must have one or more `ClaimEvidence` records before it can appear in a factual summary.
6. The deterministic summary provider omits unsupported sentences and suppresses the entire summary if no sentence has evidence.
7. High-risk classifiers require an `EditorialReview` approval state before publication.
8. `SummaryVersion`, `Correction` and `AuditLog` make material content and operational changes traceable.

## Pipeline adapters

All content-processing capabilities are protocols in `nuzenio_api.pipeline.interfaces`:

- approved feed ingestion;
- URL canonicalisation;
- exact and syndicated-copy detection;
- event clustering;
- category, location and risk classification;
- evidence mapping;
- summary generation;
- Hindi/English translation;
- material-update detection;
- search indexing and querying.

`nuzenio_api.pipeline.demo` provides deterministic, credential-free implementations. The in-memory search adapter implements the same contract intended for a future OpenSearch adapter.

## Data storage

PostgreSQL is the system of record. `EventCluster.event_embedding` uses `vector(768)` and the Compose image includes pgvector. Redis is reserved for ingestion queues, retry schedules and hot cluster caches. Neither is required to browse the demonstration PWA.

## Security and rights posture

- No publisher credentials or content are committed.
- `RightsPolicy` records storage, excerpt and summarisation permissions per organisation.
- Full-text storage defaults to false.
- Publisher links open the fictional demonstration URL in a new tab; production connectors must preserve canonical attribution.
- CORS is allow-listed through environment configuration.
- Admin mutations shown in Milestone 1 are preview interactions. Persisted mutations must append an `AuditLog` entry.
