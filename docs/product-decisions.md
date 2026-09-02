# Product decisions and assumptions

## Product stance retained

Nuzenio is an aggregation and comparison layer, not an original newsroom. The story cluster remains the primary reader unit. All seed content and names are fictional, outbound links use reserved `.example` domains, and no full publisher article or paid provider is used.

Neutral bilingual cluster copy, evidence-backed claims, organization-level source diversity, syndicated-copy exclusion, machine-translation labels, Delhi NCR pilot scope and device-local reader preferences remain unchanged from Milestones 1 and 2A.

## Milestone 2B decisions

- **Staff authentication is isolated from reader identity.** There are no reader accounts or public staff-registration paths. Staff creation requires an interactive CLI and production bootstrap secret.
- **Opaque server sessions over browser tokens.** Random session tokens are HttpOnly cookies and stored only as keyed hashes. CSRF uses a separate double-submit token also checked against its server hash. No access token enters local storage.
- **Named roles map to narrow permissions.** FastAPI is the authorization boundary; the UI permission list is an affordance, not a security control.
- **Optimistic concurrency is explicit.** Editable entities expose monotonically increasing versions. Operators reconcile 409 conflicts rather than overwriting each other.
- **High risk is policy, not a score.** Elections, communal violence, war, terrorism, health emergencies, public safety and market-moving content are held until a different authorized person approves the drafter’s work. Alert readiness is separate and sends nothing yet.
- **Audit history is append-only twice.** The application exposes writes only through a redacting helper and PostgreSQL rejects update/delete. Audit output does not imply a trust score.
- **Rights are granular and time-bounded.** Publisher, domain, permission policy and feed state are independently reviewed. Headline/snippet/summary rights are required; translation, thumbnails, audio and full-text storage are separate. Full-text display is hard-disabled.
- **Dry run performs no network request.** It evaluates approval and target safety before a feed can be approved. Tests use injected fixture transports only.
- **PostgreSQL is durable; Redis is delivery.** Feed runs exist before queue delivery, queued rows are recoverable, retry is bounded and dead letters stop poison jobs.
- **SSRF defense includes socket pinning.** Each request and redirect validates public addresses, connects to a validated IP with original TLS/Host identity, and checks DNS again before accepting bytes.
- **Corrections create history.** Earlier snapshots and summary versions remain. Impacts cover clusters, articles, claims, briefs and offline markers; public history identifies corrected clusters.
- **Local Compose is intentionally inert toward feeds.** The global kill switch prevents reserved seed URLs from being contacted while still exercising worker health and queue integration.
- **No deployment inference.** Compose and production setting validation are local foundations, not authorization to deploy.

## Accessibility and testing

Reader and staff UI preserve native controls, keyboard/touch behavior, polite status regions, visible text labels and reduced-motion behavior. Playwright covers security/workflow journeys on desktop Chromium; axe checks Top, Story and Admin on desktop and a mobile viewport. Database, DNS and HTTP dependencies are local or mocked.

## Known limitations

- The worker is a lightweight single-process scheduler/executor, not a horizontally coordinated fleet. PostgreSQL recovery reduces lost work, but production should add leases/heartbeats and observability before scaling workers.
- Admin publisher screens expose the registry and feed controls; the complete domain/rights transition surface is API-first and intentionally utilitarian.
- Corrections do not yet notify readers or publishers, and offline propagation is a persisted marker rather than a service-worker sync channel.
- Alert readiness is persisted only; browser push and public notifications remain out of scope.
- Search remains PostgreSQL-backed without typo tolerance or OpenSearch.
- No real publisher contract, feed or document has been onboarded or fetched.

## Recommended Milestone 2C

1. Add worker leases, stale-run recovery, structured metrics/tracing and operational dashboards.
2. Build complete publisher-manager forms for domain, rights evidence and lifecycle transitions, plus expiring-rights reminders.
3. Add correction severity/SLA policy, publisher acknowledgement and reader/offline sync delivery without browser push.
4. Create fixture-based duplicate, syndication, clustering, evidence and Hindi translation evaluation datasets with release thresholds.
5. Add admin query/filter controls, saved queue views and richer reconciliation UI for concurrency conflicts.
6. Perform an external security review of authentication, egress controls, audit retention and backup restoration before any production deployment.
7. Design reader accounts and privacy model separately; do not couple them to staff identity.
