# Reader and editorial API

## Remediation contract additions

- Review queue entries now include `contributorIds`, `provenanceComplete`, `approvalEligible` and
  `pushEligible`. Eligibility is computed for the authenticated viewer; mutation checks remain
  authoritative. Unknown provenance returns `409 provenance_required`; contributor approval is
  `409 dual_control_required`. No-op material writes return the unchanged record/version.
- Merge inputs reject duplicate UUIDs after canonical parsing and reject target-in-sources with
  `422 validation_error` before mutation. Service code also validates and locks unique sorted IDs.
- Admin summary entries include `invalidatedAt` and `invalidationReason`. Invalidated versions
  cannot be approved; submit a new mapped revision. Corrections without replacement text still
  retire affected versions. Only the selected eligible summary participates in public search.
- Private API responses (including errors) are `private, no-store`; public API responses are
  `no-store`. API requests are network-only in the service worker, with no app-shell fallback.
- `GET /v1/admin/rights/{id}/snapshot` and `/domains/{id}/snapshot`: authenticated complete evidence,
  permissions, effective/expiry/revocation dates, reviewer and SHA-256 snapshot hash.
- Domain/rights `APPROVED` transitions require both `expectedVersion` and `expectedSnapshotHash`
  from the displayed snapshot. Missing/stale hashes return `409 approval_snapshot_conflict`.
- `POST /v1/admin/summaries/{id}/revisions`: `summary:review` + CSRF; body has `expectedVersion`,
  `summaryText`, and `evidenceMap: {"sentences":[{"text":"Exact sentence.","evidence_ids":["uuid"]}]}`.
  Creates a pending version, preserves history and holds the cluster. Evidence IDs identify
  `ClaimEvidence` rows in that cluster; sentence boundaries are punctuation `. ! ? ।` + whitespace.
- `GET /v1/admin/feed-control`: feed operators inspect the persistent global kill switch.
- `PATCH /v1/admin/feed-control`: administrator-only `edition:pause` + CSRF; body
  `{expectedVersion, paused, reason}`. Environment kill switch is an additional fail-closed gate.
- Superseded/repeated review decisions and stale push approvals return `409 stale_review` or
  `409 version_conflict`; administrators do not bypass separation.
- Login Redis outage returns a generic `503 login_failed` without password verification. Fixed-window
  limits return generic `429 login_failed`; denied attempts do not extend the window.
- CSV cells are spreadsheet-neutralized on export only. JSON and canonical audit data are unchanged.

Local base URL: `http://localhost:8000`. OpenAPI is available at `/docs` and `/openapi.json`. JSON fields are camelCase; dates are ISO 8601. Errors use one envelope:

```json
{
  "error": {
    "code": "version_conflict",
    "message": "This record changed since it was loaded.",
    "status": 409,
    "details": null
  }
}
```

Each response includes `X-Request-ID`. A safe caller-supplied `X-Request-ID` is preserved; otherwise
the API generates one. Request/health/metrics responses are non-cacheable.

## Operations endpoints

| Method and path | Access | Result |
| --- | --- | --- |
| `GET /health/live` | network policy | Process liveness only; no dependency claim |
| `GET /health/ready` | network policy | Bounded PostgreSQL query and Redis ping |
| `GET /health` | network policy | Compatibility alias for readiness |
| `GET /metrics` | bearer token when configured; mandatory in production | OpenMetrics requests, feed states, retries, leases, queue depths, dead letters and reviews |

Worker port `8001` is internal-only and serves `/health/live`, `/health/ready` and `/metrics` for
lifecycle/loop/recovery diagnostics. Do not route it through the public web/API ingress. See
[production observability](observability.md) for thresholds and data-minimization boundaries.

## Public reader endpoints

| Method and path | Parameters | Result |
| --- | --- | --- |
| `GET /health` | — | PostgreSQL/Redis-backed service readiness |
| `GET /v1/feed/top` | `language`, `page`, `page_size`, `category`, `status` | Cluster page |
| `GET /v1/feed/local` | above plus `area` | Delhi NCR/local cluster page |
| `GET /v1/clusters/{slug}` | `language` | Cluster claims, evidence, sources, timeline, documents, corrections |
| `GET /v1/sources/{slug}` | `language` | Organization profile and recent clusters |
| `GET /v1/search` | `q`, language/paging/category/status | PostgreSQL search results |
| `GET /v1/briefs/morning` | `language` | Published India morning brief |
| `GET /v1/briefs/evening` | `language` | Published India evening brief |

Reader page size is capped by `NUZENIO_MAX_PAGE_SIZE`. Public status is `VERIFIED`, `DEVELOPING` or `DISPUTED`. Missing resources return a 404 envelope; an editorial edition pause returns `503 edition_paused`.

## Staff session endpoints

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `POST /v1/admin/auth/login` | public, rate limited | Create secure staff session and CSRF cookie |
| `GET /v1/admin/auth/session` | authenticated | Refresh session metadata/CSRF token |
| `POST /v1/admin/auth/logout` | authenticated + CSRF | Revoke current session and clear cookies |
| `GET /v1/admin/staff` | `staff:manage` | Paginated/filterable staff list |
| `PATCH /v1/admin/staff/{id}` | `staff:manage` + CSRF | Versioned role/active update |
| `POST /v1/admin/staff/{id}/revoke-sessions` | same | Revoke a user’s sessions |

Staff filters include `role`, `active` and `q`. Authentication uses cookies; state-changing calls also send the current `X-CSRF-Token`. Cross-origin credential use is restricted to configured CORS origins.

## Editorial endpoints

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET /v1/admin/review-queue` | `review:read` | Pending high-risk reviews |
| `GET /v1/admin/clusters` | `review:read` | Page/filter clusters by status/risk/review/query |
| `PATCH /v1/admin/clusters/{id}/headline` | `cluster:edit` | Edit neutral bilingual headline |
| `PATCH /v1/admin/clusters/{id}/suppression` | `cluster:edit` | Suppress or restore |
| `POST /v1/admin/clusters/merge` | `cluster:edit` | Merge source clusters into target |
| `POST /v1/admin/clusters/{id}/split` | `cluster:edit` | Split complete article membership |
| `PATCH /v1/admin/claims/{id}` | `claim:edit` | Edit bilingual claim/state/evidence |
| `POST /v1/admin/summaries/{id}/decision` | `summary:review` | Approve/reject evidence-backed summary |
| `POST /v1/admin/reviews/{id}/decision` | `high-risk:approve` | Independent final decision |
| `POST /v1/admin/reviews/{id}/push-approval` | same | Separate alert-readiness approval |
| `POST /v1/admin/clusters/{id}/primary-documents` | `cluster:edit` | Attach official document |
| `GET/POST /v1/admin/corrections` | `correction:manage` | Filter/list or open correction |
| `PATCH /v1/admin/corrections/{id}` | same | Versioned edit of an open correction; material editors remain contributors |
| `POST /v1/admin/corrections/{id}/apply` | same | Versioned propagation and publication |

Correction draft edits and application require `expectedVersion`. Cluster-targeted corrections also
require `clusterExpectedVersion`; article metadata changes require `articleExpectedVersion`. Article
corrections are propagated to each containing cluster, its public correction history and any
saved/offline snapshot markers. Creator/editor identities come from the authenticated session, never
from request bodies. Exact and NFC/whitespace-equivalent draft edits are no-ops.
| `PATCH /v1/admin/editions/{edition}` | `edition:pause` | Pause/restore reader edition |

All mutation bodies carry `expectedVersion`, or a version map for multi-record merge/split. `409 version_conflict` is recoverable by reloading and reconciling.

## Publisher, rights and feed endpoints

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET/POST /v1/admin/publishers` | `publisher:manage` | Filter/list or create draft |
| `POST /v1/admin/publishers/{id}/transition` | same | Versioned lifecycle transition |
| `POST /v1/admin/publishers/{id}/domains` | same | Add ownership-evidenced domain |
| `POST /v1/admin/domains/{id}/transition` | `rights:review` | Review/verify domain |
| `POST /v1/admin/publishers/{id}/rights` | `publisher:manage` | Add granular rights draft |
| `POST /v1/admin/rights/{id}/transition` | `rights:review` | Review rights/effective dates |
| `POST /v1/admin/publishers/{id}/feeds` | `publisher:manage` | Add controlled feed draft |
| `POST /v1/admin/feeds/{id}/transition` | `rights:review` | Review feed state |
| `POST /v1/admin/feeds/{id}/dry-run` | `feed:operate` | Validate without fetching |
| `POST /v1/admin/feeds/{id}/run` | `feed:operate` | Queue an approved feed |
| `PATCH /v1/admin/feeds/{id}/pause` | `feed:operate` | Pause/restore feed |
| `POST /v1/admin/feed-runs/{id}/retry` | `feed:operate` | Create linked retry run |
| `GET /v1/admin/feed-runs` | `feed:operate` | Page/filter history by state/feed |

## Audit endpoints

`GET /v1/admin/audit` supports pagination and exact filters for action, entity type, actor ID, request ID and outcome. `GET /v1/admin/audit/export?format=csv|json` applies the same filters, redacts sensitive fields and caps export at 10,000 newest rows. Permissions are `audit:read` and `audit:export` respectively.

No update or delete audit endpoint exists. Direct application-database update/delete attempts are rejected by a PostgreSQL trigger.

## Legacy deterministic preview

`POST /v1/pipeline/preview` remains an unauthenticated, non-persistent deterministic pipeline demonstration. The merge/split preview routes under `/v1/admin` now require staff authorization and CSRF even though they do not persist changes.
