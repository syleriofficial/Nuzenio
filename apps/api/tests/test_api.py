from fastapi.testclient import TestClient
from pydantic import ValidationError

from nuzenio_api.main import app
from nuzenio_api.schemas import (
    BriefRead,
    ClaimSummary,
    ClusterDetail,
    ClusterPage,
    ErrorResponse,
    HealthResponse,
    SourceProfileRead,
)

client = TestClient(app)


def test_health_contract() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    health = HealthResponse.model_validate(response.json())
    assert health.status == "ok"
    assert health.persistence == "postgresql"


def test_openapi_contract_uses_frontend_camel_case_fields() -> None:
    schema = client.get("/openapi.json").json()
    cluster_properties = schema["components"]["schemas"]["ClusterCard"]["properties"]
    pagination_properties = schema["components"]["schemas"]["Pagination"]["properties"]
    assert {
        "updatedAt",
        "independentSourceCount",
        "riskLevel",
        "reviewState",
        "whyShown",
        "machineTranslated",
    }.issubset(cluster_properties)
    assert {"pageSize", "totalPages"}.issubset(pagination_properties)


def test_top_feed_matches_schema_and_paginates() -> None:
    response = client.get("/v1/feed/top", params={"page": 2, "page_size": 3})
    assert response.status_code == 200
    page = ClusterPage.model_validate(response.json())
    assert len(page.items) == 3
    assert page.pagination.page == 2
    assert page.pagination.page_size == 3
    assert page.pagination.total == 7
    assert page.pagination.total_pages == 3


def test_feed_filters_by_category_and_derived_status() -> None:
    response = client.get(
        "/v1/feed/top",
        params={"category": "Business", "status": "DISPUTED"},
    )
    page = ClusterPage.model_validate(response.json())
    assert [item.slug for item in page.items] == ["solar-manufacturing-credit"]


def test_local_feed_is_scoped_to_delhi_ncr() -> None:
    response = client.get("/v1/feed/local", params={"area": "Delhi NCR"})
    page = ClusterPage.model_validate(response.json())
    assert page.pagination.total == 2
    assert {item.slug for item in page.items} == {
        "delhi-air-quality-response",
        "gurugram-bus-lanes-pilot",
    }


def test_hindi_and_english_content_selection() -> None:
    slug = "national-clean-mobility-framework"
    english = ClusterDetail.model_validate(client.get(f"/v1/clusters/{slug}").json())
    hindi = ClusterDetail.model_validate(
        client.get(f"/v1/clusters/{slug}", params={"language": "hi"}).json()
    )
    assert english.language == "en"
    assert hindi.language == "hi"
    assert english.headline != hindi.headline
    assert english.brief != hindi.brief
    assert hindi.machine_translated is True


def test_organization_level_source_count_excludes_duplicates_and_syndication() -> None:
    duplicate_domains = ClusterDetail.model_validate(
        client.get("/v1/clusters/solar-manufacturing-credit").json()
    )
    syndicated = ClusterDetail.model_validate(
        client.get("/v1/clusters/national-clean-mobility-framework").json()
    )
    assert len(duplicate_domains.sources) == 4
    assert duplicate_domains.independent_source_count == 3
    assert len({source.organization_id for source in duplicate_domains.sources}) == 3
    assert len(syndicated.sources) == 5
    assert syndicated.independent_source_count == 4
    assert any(source.syndicated_copy for source in syndicated.sources)


def test_claims_have_evidence_relationships() -> None:
    response = client.get("/v1/clusters/national-clean-mobility-framework")
    cluster = ClusterDetail.model_validate(response.json())
    assert cluster.claims
    assert all(claim.evidence for claim in cluster.claims)
    assert any(
        evidence.primary_document_url for claim in cluster.claims for evidence in claim.evidence
    )


def test_search_matches_headlines_summaries_and_sources() -> None:
    headline = ClusterPage.model_validate(client.get("/v1/search", params={"q": "solar"}).json())
    source = ClusterPage.model_validate(client.get("/v1/search", params={"q": "Janadesh"}).json())
    assert [item.slug for item in headline.items] == ["solar-manufacturing-credit"]
    assert source.pagination.total >= 1
    assert any(item.slug == "national-clean-mobility-framework" for item in source.items)


def test_source_profile_matches_contract() -> None:
    response = client.get("/v1/sources/janadesh", params={"language": "hi"})
    assert response.status_code == 200
    source = SourceProfileRead.model_validate(response.json())
    assert source.slug == "janadesh"
    assert source.language == "hi"
    assert source.domains == ["janadesh.example", "janadeshbusiness.example"]
    assert source.recent_clusters


def test_morning_and_evening_briefs_match_contract() -> None:
    morning = BriefRead.model_validate(client.get("/v1/briefs/morning").json())
    evening = BriefRead.model_validate(
        client.get("/v1/briefs/evening", params={"language": "hi"}).json()
    )
    assert morning.period == "morning"
    assert morning.items
    assert evening.period == "evening"
    assert evening.language == "hi"
    assert evening.items


def test_missing_cluster_and_source_use_consistent_error_contract() -> None:
    cluster_response = client.get("/v1/clusters/not-a-cluster")
    source_response = client.get("/v1/sources/not-a-source")
    assert cluster_response.status_code == source_response.status_code == 404
    cluster_error = ErrorResponse.model_validate(cluster_response.json())
    source_error = ErrorResponse.model_validate(source_response.json())
    assert cluster_error.error.code == "cluster_not_found"
    assert source_error.error.code == "source_not_found"


def test_invalid_pagination_uses_consistent_error_contract() -> None:
    response = client.get("/v1/feed/top", params={"page": 0})
    assert response.status_code == 422
    error = ErrorResponse.model_validate(response.json())
    assert error.error.code == "validation_error"
    assert error.error.details


def test_unknown_route_uses_consistent_error_contract() -> None:
    response = client.get("/v1/not-a-route")
    assert response.status_code == 404
    error = ErrorResponse.model_validate(response.json())
    assert error.error.code == "http_error"


def test_claim_schema_rejects_evidence_free_factual_claim() -> None:
    try:
        ClaimSummary(state="CONFIRMED", text="Unsupported statement", evidence_ids=[])
    except ValidationError as exc:
        assert "evidence_ids" in str(exc)
    else:
        raise AssertionError("evidence-free claim was accepted")


def test_pipeline_suppresses_unapproved_feed_and_collapses_duplicates() -> None:
    payload = {
        "articles": [
            {
                "articleId": "a1",
                "publisherOrganizationId": "org-a",
                "url": "https://news.example/story?utm_source=test",
                "title": "Cabinet approves clean mobility framework",
                "excerpt": (
                    "The cabinet approved a clean mobility framework for intercity corridors."
                ),
            },
            {
                "articleId": "a2",
                "publisherOrganizationId": "org-a",
                "url": "https://news.example/story-copy",
                "title": "Cabinet approves clean mobility framework",
                "excerpt": (
                    "The cabinet approved a clean mobility framework for intercity corridors."
                ),
            },
            {
                "articleId": "blocked",
                "publisherOrganizationId": "unknown",
                "url": "https://unknown.example/story",
                "title": "Unapproved article must not enter the pipeline",
                "excerpt": "This item is present only to verify approved-feed enforcement.",
                "approvedFeed": False,
            },
        ]
    }
    response = client.post("/v1/pipeline/preview", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["exactDuplicateGroups"] == [["a1", "a2"]]
    assert body["suppressedArticleIds"] == ["blocked"]
    assert body["canonicalUrls"]["a1"] == "https://news.example/story"


def test_split_schema_rejects_article_in_multiple_groups() -> None:
    response = client.post(
        "/v1/admin/clusters/split-preview",
        json={"clusterId": "cluster-a", "groups": [["a1"], ["a1", "a2"]]},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_required"
