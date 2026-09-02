# Product decisions and assumptions

## Product stance

Nuzenio is an aggregator and comparison layer, not a publisher of original news. The public experience begins with a story cluster and makes publisher reporting, conflicts, provenance and updates visible without reproducing complete articles.

## Milestone 1 decisions retained

- **Fictional demonstration edition:** all story, publisher, document and external URLs are explicitly fictional and use `example.com`. This prevents a sample build from presenting invented current events as real news.
- **Neutral cluster copy:** headlines describe the shared event. Briefs are 40–80 English words and avoid motives or outcomes not represented in the evidence fixture.
- **Source diversity:** counts use publisher organisation identity. Multiple domains from one owner count once. Syndicated copies retain a link but do not increase diversity.
- **Claim states:** Confirmed, Still developing and Disputed are separate, scannable sections. Empty disputed sections are suppressed instead of implying disagreement.
- **Evidence-first summaries:** unsupported sentences are removed; a summary with no supported sentences is not published.
- **High-risk review:** elections, communal violence, war, public safety, health emergencies and market-moving stories require editorial approval. The Delhi air-quality example demonstrates the reviewed state.
- **Translation:** English/Hindi switching covers navigation, cluster headlines, briefs and key controls. Hindi demonstration copy is labelled as machine-translated on cluster detail pages.
- **Personalisation:** For You explains each recommendation. Save, follow, source-hide, language and theme preferences use local device storage in this milestone.
- **Local pilot:** Delhi NCR includes Delhi, Gurugram, Noida, Ghaziabad and Faridabad, with a settings entry point for later geographies.
- **Briefs:** morning and evening editions link every item back to the full cluster comparison.
- **Admin:** the registry, feed health, merge/split, corrections and high-risk review surfaces are interaction prototypes. Production mutations require authentication, persistence, concurrency control and audit logs.
- **No paid AI dependency:** all pipeline implementations are deterministic. Provider protocols allow evaluated replacements without changing domain rules.
- **No deployment:** the implementation remains local, as requested.

## Milestone 2A decisions

- **API is authoritative:** public reader surfaces now use PostgreSQL-backed FastAPI endpoints. The checked-in fixture is input to the seed, not the normal UI data source.
- **Alembic owns schema state:** startup and test workflows apply reviewed migrations. Runtime code and the seed never call `create_all`.
- **Transactional reads and seeds:** reader services and the idempotent seed use explicit SQLAlchemy transactions. Repository code owns queries; service code owns product invariants and response mapping.
- **Server rendering without stale fallback:** the Next.js routes opt into dynamic rendering and request uncached data. Network and server failures reach the recoverable route boundary.
- **Development fallback is opt-in:** `NUZENIO_ENABLE_DEMO_FALLBACK=true` enables fixture fallback only outside production and only for connectivity/5xx failures. A valid empty response remains empty, and 4xx/contract errors remain visible.
- **Language is a request concern:** `language=en|hi` selects persisted summary, claim and headline content. English is the explicit fallback when a requested translation does not exist; translated source headlines retain a machine-translation flag.
- **PostgreSQL search first:** small-edition search uses indexed/filtered PostgreSQL queries. The OpenSearch adapter remains deferred until scale and result-quality evaluation justify it.
- **Reader persistence before account persistence:** For You preferences, follows, saves, hidden sources and theme/language persistence remain on-device. Authentication is not introduced indirectly.
- **Compose can own the local API lifecycle:** the API container waits for healthy PostgreSQL/Redis, migrates, runs the idempotent fictional seed and starts Uvicorn. This is a local workflow, not a deployment specification.

## Accessibility and interaction

- Controls are native buttons, links, form fields or accessible primitives.
- Touch targets are designed around at least 32–44 CSS pixels depending on density and placement.
- Sticky mobile navigation is thumb reachable; desktop navigation preserves a reading-width feed.
- Status changes announce through polite live regions.
- Colour is reinforced by labels and icons.
- Motion respects `prefers-reduced-motion`.

## Known Milestone 2A boundaries

- PWA preferences are device-local; no authentication or cross-device sync exists.
- Publisher connectors, feed polling, browser push and production admin writes are interfaces only.
- No real publisher content, licensed feed or official document is included.
- Redis is configured and health-checked but not yet used for cache/job execution.
- Search is PostgreSQL-backed and does not yet provide typo tolerance, ranking analytics or OpenSearch scaling.
- Admin screens remain Milestone 1 previews and do not mutate persisted data.

## Recommended Milestone 2B

1. Add authenticated editorial roles and append-only audit events for all admin mutations.
2. Implement transactional source onboarding and rights-policy enforcement before article storage.
3. Add approved-feed polling with Redis-backed jobs, backoff, feed health and idempotent ingestion.
4. Persist cluster merge/split, correction publication and high-risk dual-control review workflows.
5. Add optimistic concurrency for editorial updates and correction propagation.
6. Introduce end-to-end browser tests against the Compose stack and accessibility regression gates.
7. Create evaluated duplicate, syndication, clustering and Hindi-translation quality datasets before replacing deterministic providers.
