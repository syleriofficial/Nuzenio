# Milestone 3C1: offline fixture draft inbox

This closes the **persisted article → private draft → existing editorial workspace** gap.
It does not implement live ingestion, fact checking, AI summaries, translation or automatic publishing.
All source assertions remain unverified. A source headline is copied verbatim, not represented as a
verified neutral headline. Hindi source text remains Hindi; English drafts have no invented Hindi text.

## Activation and fixture import

Off by default. The API must explicitly have all of:

```dotenv
NUZENIO_ENVIRONMENT=development
NUZENIO_DEMO_MODE=true
NUZENIO_FEED_KILL_SWITCH=true
NUZENIO_DRAFT_INBOX_ENABLED=true
```

`test` is also supported. Production, missing/malformed environments, demo-off and network-kill-off
configurations cannot enable the inbox. Endpoints repeat the gate, independently of startup validation.
Use a **new isolated Compose project with unused ports** or a dedicated local database, not an existing
preview/database. The checked-in Compose API accepts `NUZENIO_DRAFT_INBOX_ENABLED`; it defaults false.
Existing network/persistent/per-feed kill-switch behavior is not changed.

After applying migrations and provisioning runtime/audit roles, explicitly seed fictional sources
using the existing documented seed workflow. Then, in the API environment:

```sh
python -m nuzenio_api.draft_fixtures
```

This imports eight embedded RSS items (four English, four Hindi) for the existing fictional Janadesh
feeds, using the safe XML/text parser. It does not perform DNS, HTTP or feed polling, create sources,
change approvals, create staff, create clusters, or publish. A second import creates zero articles and
does not overwrite earlier work. Paused or ineligible sources are not repaired by the importer.
The same-domain HTTPS `.example` requirement is rechecked during assignment.

Bootstrap staff only through the existing password-prompting CLI. Sign in at `/admin` and select
**Incoming articles**. No credentials, inbox text or assignment requests are stored in localStorage.

## Staff workflow

1. Inspect the paginated Unassigned/Assigned/All queue. Source language, version and eligibility are
   explicit. Blocked items withhold headline, excerpt and original URL in this inbox.
2. Create a private draft, or select an eligible inbox-created draft and attach the article.
3. The result is always **HIGH risk, HELD, PENDING**, with push readiness false. No claims, summaries,
   evidence assertions, translation, briefs or notifications are generated.
4. Open the existing editorial workspace. Factual writing, evidence, language work, corrections and
   independent final/alert review continue under its existing controls.

Administrators/editors can read and assign (`article:read`, `article:assign`). Reviewers can only read.
Publisher managers and analysts cannot use these new endpoints. Existing `review:read` access to the
broader editorial workspace is unchanged; these permissions are not a new confidentiality partition
between staff already permitted to inspect clusters.

## API and transaction contract

- `GET /v1/admin/incoming-articles?state=UNASSIGNED&page=1&page_size=20`
- `GET /v1/admin/draft-workspaces?page=1&page_size=20`
- `POST /v1/admin/incoming-articles/{articleId}/assign`

All routes require staff authentication; assignment also requires CSRF and assignment permission.
Private responses use the existing no-store middleware/service-worker exclusions.
Page size is 1–50, with SQL-side counts and deterministic order.

```json
{
  "operationId": "c0b516f9-35ee-4d77-b612-2b939f1a8257",
  "expectedArticleVersion": 1,
  "approvalToken": "<64-hex approval snapshot returned by the inbox>",
  "targetClusterId": null,
  "expectedClusterVersion": null
}
```

Target ID/version must both be null for creation or both supplied for attachment. Unknown fields,
invalid identifiers and non-integer versions are rejected. The approval digest is a comparison token,
not an authorization credential; current rights/lifecycle checks remain authoritative.

The existing control lock serializes source/rights changes with assignment; locks are held only over
database work. A target cluster is locked before the article. The transaction checks source/domain
affiliation, rights/expiry, source pauses, article and target versions, existing memberships and
corrections. It atomically stores membership, article version, contributor lineage, pending review,
assignment receipt and a metadata-only audit record. Audit failure rolls everything back.

Only the global **network-fetch** switch is excluded from the reused rights-error list, because this
operation handles already-persisted offline fixtures and explicitly requires that switch to be ON.
Persistent control pause and per-feed pause still block it. This is not a fetch bypass or permission
to ingest real sources.

An exact operation/actor/payload retry returns the original receipt without a second membership,
review, version increment or audit event. Conflicting operation IDs and competing assignments return
409. Rights are rechecked even on retries; if later editorial merge/split changed the original
membership, retry returns 409 rather than reconstructing it. The browser retains uncertain operations
only in the mounted staff-session component; refresh/version/target changes use a new operation.

Attachments are limited to inbox-created drafts still at their recorded assignment revision with
no claims, summaries, primary documents, corrections or prior review decisions. Existing published,
suppressed, edited or otherwise authored clusters require the editorial workflow. Attaching an article
increments the material revision, supersedes the prior pending review and retains all contributors.
Administrators are not exempt from the no-self-approval rule.

## Migration and durability

Forward migration: `76d934bfa102 → a81c3d7e520b`.
Adds `draft_workspaces` and `article_draft_assignments`; no existing content/backfill is changed.
Reprovision the restricted runtime/audit roles after upgrade, as Compose already does. Runtime gets
ordinary application table privileges; the audit reader does not gain inbox access. Receipts are
durable application records, **not an additional database-immutable ledger**. The existing audit and
contributor tables retain their append-only protections. Destructive downgrade is intentionally refused.

## Validation

API regressions cover creation/attachment, bilingual source preservation, private reader surfaces,
RBAC/CSRF/no-store, exact/competing retries, stale approvals and versions, source/rights changes,
transaction rollback, provenance/self-approval, real runtime/audit roles, import idempotency and
forward migration/row preservation. Inbox tests use their own disposable database so their source
fixtures do not affect unrelated worker/source suites.

Web tests cover retry-operation binding and eligibility. The additional production Playwright gate
uses a **separate fixture database** and requires zero retries on desktop and mobile:

```sh
NUZENIO_ENVIRONMENT=test NUZENIO_DRAFT_INBOX_ENABLED=true NUZENIO_FEED_KILL_SWITCH=true \
  NUZENIO_E2E_DATABASE_URL=postgresql+psycopg://nuzenio:nuzenio@localhost:5432/nuzenio_draft_e2e \
  apps/api/.venv/bin/python -m nuzenio_api.e2e_setup
NUZENIO_E2E_DATABASE_URL=postgresql+psycopg://nuzenio:nuzenio@localhost:5432/nuzenio_draft_e2e \
  npm --workspace apps/web run test:e2e:drafts
```

E2E setup **drops/recreates only its explicitly named disposable `e2e` database**. Never point it at
founder/production data. The existing production browser gate is retained unchanged and runs separately.
The new CI steps do not enable the inbox for the ordinary reader/editorial E2E or Compose jobs.

## Deliberate limits / next approval

This is not the evaluated production clustering/syndication/summary pipeline. There is no claim that
two manually grouped articles are independent sources or that their assertions agree. There is no
publisher license, live feed pilot, paid model integration, worker fleet rollout, reader account,
push notification, deployment or production-release approval in this milestone. Independent review
of the exact implementation and matching CI is required before merge.
