from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from nuzenio_api.auth import create_staff_user
from nuzenio_api.db import SessionLocal
from nuzenio_api.main import app
from nuzenio_api.models import (
    Article,
    ClusterArticle,
    EventCluster,
    OnboardingState,
    RightsPolicy,
    SourceFeed,
    StaffRole,
)

PASSWORD = "Valid-Staff-Password-42!"


def authorized(role: StaffRole) -> tuple[TestClient, str]:
    username = f"workflow-{role.value.lower()}-{uuid.uuid4()}"
    with SessionLocal.begin() as session:
        create_staff_user(
            session,
            username=username,
            display_name="Workflow fixture",
            password=PASSWORD,
            role=role,
        )
    client = TestClient(app)
    response = client.post(
        "/v1/admin/auth/login", json={"username": username, "password": PASSWORD}
    )
    assert response.status_code == 200
    return client, response.json()["csrfToken"]


def transition(
    client: TestClient,
    csrf: str,
    path: str,
    version: int,
    state: str,
) -> dict:
    snapshot_hash = None
    if state == "APPROVED" and ("/rights/" in path or "/domains/" in path):
        snapshot_hash = client.get(path.replace("/transition", "/snapshot")).json()["snapshotHash"]
    response = client.post(
        path,
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": version,
            "state": state,
            "notes": "Fixture review",
            "expectedSnapshotHash": snapshot_hash,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_rights_aware_publisher_and_feed_approval_workflow() -> None:
    client, csrf = authorized(StaffRole.PUBLISHER_MANAGER)
    slug = f"fixture-publisher-{uuid.uuid4()}"
    created = client.post(
        "/v1/admin/publishers",
        headers={"X-CSRF-Token": csrf},
        json={
            "name": "Fictional Fixture Publisher",
            "slug": slug,
            "ownership": "Fixture Cooperative",
            "contactName": "Corrections Desk",
            "contactEmail": "corrections@fixturepublisher.example",
            "correctionRoute": "https://fixturepublisher.example/corrections",
        },
    )
    assert created.status_code == 200, created.text
    publisher_id = created.json()["id"]
    version = created.json()["version"]
    for state in ("SUBMITTED", "UNDER_REVIEW", "APPROVED"):
        result = transition(
            client,
            csrf,
            f"/v1/admin/publishers/{publisher_id}/transition",
            version,
            state,
        )
        version = result["version"]

    domain_response = client.post(
        f"/v1/admin/publishers/{publisher_id}/domains",
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": version,
            "domain": "fixturepublisher.example",
            "ownershipEvidence": "Fictional DNS and contract evidence.",
        },
    )
    assert domain_response.status_code == 200, domain_response.text
    domain_id = domain_response.json()["id"]
    domain_version = domain_response.json()["version"]
    version += 1
    for state in ("SUBMITTED", "UNDER_REVIEW", "APPROVED"):
        result = transition(
            client,
            csrf,
            f"/v1/admin/domains/{domain_id}/transition",
            domain_version,
            state,
        )
        domain_version = result["version"]

    rights_response = client.post(
        f"/v1/admin/publishers/{publisher_id}/rights",
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": version,
            "policyName": "Fictional fixture permission",
            "evidenceUrl": "https://fixturepublisher.example/rights-evidence",
            "effectiveAt": datetime.now(UTC).isoformat(),
            "headline": True,
            "snippet": True,
            "generatedSummary": True,
            "translation": True,
            "fullTextStorage": False,
            "fullTextDisplay": False,
        },
    )
    assert rights_response.status_code == 200, rights_response.text
    rights_id = rights_response.json()["id"]
    rights_version = rights_response.json()["version"]
    version += 1
    for state in ("SUBMITTED", "UNDER_REVIEW", "APPROVED"):
        result = transition(
            client,
            csrf,
            f"/v1/admin/rights/{rights_id}/transition",
            rights_version,
            state,
        )
        rights_version = result["version"]

    feed_response = client.post(
        f"/v1/admin/publishers/{publisher_id}/feeds",
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": version,
            "domainId": domain_id,
            "rightsPolicyId": rights_id,
            "name": "Fixture RSS",
            "url": "https://fixturepublisher.example/feed.xml",
            "language": "en",
        },
    )
    assert feed_response.status_code == 200, feed_response.text
    feed_id = feed_response.json()["id"]
    feed_version = feed_response.json()["version"]
    dry_run = client.post(f"/v1/admin/feeds/{feed_id}/dry-run", headers={"X-CSRF-Token": csrf})
    assert dry_run.status_code == 200, dry_run.text
    assert dry_run.json() == {
        "valid": True,
        "issues": [],
        "normalizedUrl": "https://fixturepublisher.example/feed.xml",
        "willFetch": False,
    }
    for state in ("SUBMITTED", "UNDER_REVIEW", "APPROVED"):
        result = transition(
            client,
            csrf,
            f"/v1/admin/feeds/{feed_id}/transition",
            feed_version,
            state,
        )
        feed_version = result["version"]
    with SessionLocal() as session:
        feed = session.get(SourceFeed, uuid.UUID(feed_id))
        assert feed.approved is True
        assert feed.onboarding_state == OnboardingState.APPROVED
        assert feed.rights_policy.may_display_full_text is False


def test_expired_rights_automatically_pause_processing() -> None:
    with SessionLocal.begin() as session:
        feed = session.scalar(select(SourceFeed).where(SourceFeed.approved.is_(True)).limit(1))
        rights = session.get(RightsPolicy, feed.rights_policy_id)
        previous = [
            (item.id, item.approved, item.onboarding_state, item.paused_reason)
            for item in session.scalars(
                select(SourceFeed).where(SourceFeed.rights_policy_id == rights.id)
            )
        ]
        rights.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        feed_id = feed.id
        rights_id = rights.id
    client, _ = authorized(StaffRole.PUBLISHER_MANAGER)
    response = client.get("/v1/admin/publishers")
    assert response.status_code == 200
    with SessionLocal() as session:
        feed = session.get(SourceFeed, feed_id)
        assert feed.approved is False
        assert feed.onboarding_state == OnboardingState.PAUSED
        assert "Rights expired" in feed.paused_reason
    with SessionLocal.begin() as session:
        rights = session.get(RightsPolicy, rights_id)
        rights.expires_at = None
        for key, approved, state, reason in previous:
            feed = session.get(SourceFeed, key)
            feed.approved, feed.onboarding_state, feed.paused_reason = approved, state, reason


def test_correction_preserves_history_and_marks_reader_cluster() -> None:
    client, csrf = authorized(StaffRole.EDITOR)
    with SessionLocal() as session:
        cluster = session.scalar(
            select(EventCluster).where(EventCluster.slug == "open-language-model-india-labs")
        )
        cluster_id, cluster_version = cluster.id, cluster.version
    opened = client.post(
        "/v1/admin/corrections",
        headers={"X-CSRF-Token": csrf},
        json={
            "clusterId": str(cluster_id),
            "description": "Fixture correction to neutral headline wording.",
            "descriptionHi": "निष्पक्ष शीर्षक शब्दावली में परीक्षण सुधार।",
            "sourceUrl": "https://official.example/correction-note",
            "evidence": "Fictional signed correction note reference.",
        },
    )
    assert opened.status_code == 200, opened.text
    correction_id = opened.json()["id"]
    applied = client.post(
        f"/v1/admin/corrections/{correction_id}/apply",
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": 1,
            "clusterExpectedVersion": cluster_version,
            "resolution": "Updated the neutral headline while preserving the previous version.",
            "headline": "Connectivity trial schedule clarified in fictional official note",
            "headlineHi": "काल्पनिक आधिकारिक नोट में कनेक्टिविटी परीक्षण समय-सारणी स्पष्ट",
        },
    )
    assert applied.status_code == 200, applied.text
    assert applied.json()["data"]["turnaroundSeconds"] >= 0
    reader = client.get("/v1/clusters/open-language-model-india-labs")
    assert reader.status_code == 200
    assert reader.json()["headline"].startswith("Connectivity trial schedule clarified")
    assert any(item["id"] == correction_id for item in reader.json()["corrections"])


def test_article_correction_is_versioned_and_propagates_to_reader_history() -> None:
    client, csrf = authorized(StaffRole.EDITOR)
    slug = "open-language-model-india-labs"
    with SessionLocal() as session:
        article = session.scalar(
            select(Article)
            .join(ClusterArticle, ClusterArticle.article_id == Article.id)
            .join(EventCluster, EventCluster.id == ClusterArticle.cluster_id)
            .where(EventCluster.slug == slug)
            .order_by(Article.id)
            .limit(1)
        )
        article_id, article_version = article.id, article.version
    opened = client.post(
        "/v1/admin/corrections",
        headers={"X-CSRF-Token": csrf},
        json={
            "articleId": str(article_id),
            "description": "Fixture correction to an aggregated source headline.",
            "sourceUrl": "https://official.example/article-correction-note",
            "evidence": "Fictional publisher correction note reference.",
        },
    )
    assert opened.status_code == 200, opened.text
    correction_id = opened.json()["id"]
    unpublished = client.get(f"/v1/clusters/{slug}")
    assert correction_id not in {item["id"] for item in unpublished.json()["corrections"]}

    stale = client.post(
        f"/v1/admin/corrections/{correction_id}/apply",
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": opened.json()["version"],
            "articleExpectedVersion": article_version + 1,
            "resolution": "Corrected the source headline after reviewing fixture evidence.",
            "articleTitle": "Corrected fictional source headline",
        },
    )
    assert stale.status_code == 409
    applied = client.post(
        f"/v1/admin/corrections/{correction_id}/apply",
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": opened.json()["version"],
            "articleExpectedVersion": article_version,
            "resolution": "Corrected the source headline after reviewing fixture evidence.",
            "articleTitle": "Corrected fictional source headline",
        },
    )
    assert applied.status_code == 200, applied.text
    reader = client.get(f"/v1/clusters/{slug}")
    assert reader.status_code == 200
    assert any(
        item["headline"] == "Corrected fictional source headline"
        for item in reader.json()["sources"]
    )
    assert correction_id in {item["id"] for item in reader.json()["corrections"]}


def test_audit_search_and_csv_json_exports_are_authorized() -> None:
    client, _ = authorized(StaffRole.ANALYST)
    page = client.get("/v1/admin/audit", params={"page_size": 5})
    assert page.status_code == 200
    assert page.json()["items"]
    csv_response = client.get("/v1/admin/audit/export", params={"format": "csv"})
    assert csv_response.status_code == 200
    assert "text/csv" in csv_response.headers["content-type"]
    assert "requestId" in csv_response.text.splitlines()[0]
    json_response = client.get("/v1/admin/audit/export", params={"format": "json"})
    assert json_response.status_code == 200
    assert isinstance(json_response.json(), list)
