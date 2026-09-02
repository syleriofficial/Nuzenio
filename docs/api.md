# Reader API

Local base URL: `http://localhost:8000`. Interactive OpenAPI documentation is exposed at `/docs` and the machine-readable schema at `/openapi.json`.

All response property names are camelCase. Dates use ISO 8601. Reader language is `en` or `hi` and defaults to `en`.

## Endpoints

| Method and path | Parameters | Response |
| --- | --- | --- |
| `GET /health` | none | Database health and service version |
| `GET /v1/feed/top` | `language`, `page`, `page_size`, `category`, `status` | Paginated cluster cards |
| `GET /v1/feed/local` | `language`, `page`, `page_size`, `area`, `status` | Paginated local cluster cards |
| `GET /v1/clusters/{slug}` | `language` | Full cluster with claims/evidence, timeline, documents and corrections |
| `GET /v1/sources/{slug}` | `language` | Publisher-organization profile and recent clusters |
| `GET /v1/search` | required `q`; optional `language`, `page`, `page_size`, `category`, `status` | Paginated matching clusters |
| `GET /v1/briefs/morning` | `language` | Published India morning brief |
| `GET /v1/briefs/evening` | `language` | Published India evening brief |

`status` is the derived story state: `VERIFIED`, `DEVELOPING` or `DISPUTED`. Page size must be between 1 and `NUZENIO_MAX_PAGE_SIZE` (50 by default).

Search matches English/Hindi cluster headlines, summaries, article headlines, category, location and publisher name. It is PostgreSQL-backed in this milestone; OpenSearch is deliberately not enabled.

## Paginated response

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

Cluster cards expose the neutral localized headline and brief, derived status, organization-level independent-source count, risk/review state, source headline comparison, evidence-backed claims, recommendation explanation and translation label.

## Evidence and source rules

- Claims without `ClaimEvidence` are excluded from responses.
- A `SummaryVersion` without a non-empty evidence map is unavailable and the cluster is not rendered with that summary.
- Multiple article URLs and domains owned by one `PublisherOrganization` count once.
- `ClusterArticle.is_syndicated_copy=true` entries preserve attribution but do not increase `independentSourceCount`.
- High-risk clusters are queryable only after `reviewState=APPROVED`; standard clusters may use `NOT_REQUIRED` or `APPROVED`.

## Errors

Reader errors use a consistent envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request parameters or body are invalid.",
    "status": 422,
    "details": [
      {
        "location": ["query", "page"],
        "message": "Input should be greater than or equal to 1",
        "type": "greater_than_equal"
      }
    ]
  }
}
```

Expected codes include `cluster_not_found`, `source_not_found`, `brief_not_found`, `summary_unavailable`, `validation_error`, and `database_unavailable`.

## Existing preview endpoints

Milestone 1 deterministic preview endpoints remain available at `/v1/pipeline/preview`, `/v1/admin/clusters/merge-preview`, and `/v1/admin/clusters/split-preview`. They are not persistent admin mutation endpoints and require no authentication only because they do not change state.
