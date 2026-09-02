from fastapi.testclient import TestClient
from pydantic import ValidationError

from nuzenio_api.main import app
from nuzenio_api.schemas import ClaimSummary, ClusterSummary

client = TestClient(app)


def test_health_contract() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "nuzenio-api",
        "demo_mode": True,
    }


def test_demo_clusters_match_response_schema() -> None:
    response = client.get("/v1/demo/clusters")
    assert response.status_code == 200
    clusters = [ClusterSummary.model_validate(item) for item in response.json()]
    assert clusters
    assert all(cluster.demonstration_data for cluster in clusters)
    assert all(cluster.independent_source_count >= 1 for cluster in clusters)


def test_unknown_cluster_returns_404() -> None:
    response = client.get("/v1/demo/clusters/not-a-cluster")
    assert response.status_code == 404


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
                "article_id": "a1",
                "publisher_organization_id": "org-a",
                "url": "https://news.example/story?utm_source=test",
                "title": "Cabinet approves clean mobility framework",
                "excerpt": (
                    "The cabinet approved a clean mobility framework for intercity corridors."
                ),
            },
            {
                "article_id": "a2",
                "publisher_organization_id": "org-a",
                "url": "https://news.example/story-copy",
                "title": "Cabinet approves clean mobility framework",
                "excerpt": (
                    "The cabinet approved a clean mobility framework for intercity corridors."
                ),
            },
            {
                "article_id": "blocked",
                "publisher_organization_id": "unknown",
                "url": "https://unknown.example/story",
                "title": "Unapproved article must not enter the pipeline",
                "excerpt": "This item is present only to verify approved-feed enforcement.",
                "approved_feed": False,
            },
        ]
    }
    response = client.post("/v1/pipeline/preview", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["exact_duplicate_groups"] == [["a1", "a2"]]
    assert body["suppressed_article_ids"] == ["blocked"]
    assert body["canonical_urls"]["a1"] == "https://news.example/story"


def test_split_schema_rejects_article_in_multiple_groups() -> None:
    response = client.post(
        "/v1/admin/clusters/split-preview",
        json={"cluster_id": "cluster-a", "groups": [["a1"], ["a1", "a2"]]},
    )
    assert response.status_code == 422
