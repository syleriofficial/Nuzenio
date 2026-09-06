import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from nuzenio_api.config import get_settings
from nuzenio_api.db import SessionLocal
from nuzenio_api.evidence import fixture_evidence
from nuzenio_api.main import app
from nuzenio_api.models import (
    Claim,
    ClaimEvidence,
    ClusterArticle,
    EditorialReview,
    EventCluster,
    RiskLevel,
    StaffRole,
    SummaryVersion,
)
from test_auth_editorial import login, make_staff
from test_operations_remediation import fixture_cluster


@pytest.fixture(autouse=True)
def separate_limits(monkeypatch):
    monkeypatch.setattr(get_settings(), "login_key_prefix", "review:" + uuid.uuid4().hex)


def cluster_info(cid):
    with SessionLocal() as s:
        c = s.get(EventCluster, cid)
        return c.slug, c.version, c.material_revision, c.status


def test_noop_edit_must_not_allow_original_author_final_approval():
    a, b = make_staff(StaffRole.ADMINISTRATOR), make_staff(StaffRole.ADMINISTRATOR)
    ca, ta = login(a)
    cb, tb = login(b)
    with SessionLocal.begin() as s:
        cid, _ = fixture_cluster(s)
        s.get(EventCluster, cid).risk_level = RiskLevel.HIGH
    wording = {
        "headline": "Original author A public safety assertion",
        "headlineHi": "मूल लेखक का सुरक्षा दावा",
    }
    r = ca.patch(
        f"/v1/admin/clusters/{cid}/headline",
        headers={"X-CSRF-Token": ta},
        json={"expectedVersion": 1, **wording},
    )
    assert r.status_code == 200, r.text
    with SessionLocal() as s:
        review = s.scalar(
            select(EditorialReview).where(
                EditorialReview.cluster_id == cid, EditorialReview.superseded_at.is_(None)
            )
        )
        rid, rv = review.id, review.version
    body = {
        "expectedVersion": rv,
        "decision": "APPROVED",
        "notes": "Original author attempts approval",
    }
    denied = ca.post(f"/v1/admin/reviews/{rid}/decision", headers={"X-CSRF-Token": ta}, json=body)
    assert denied.status_code == 409
    r = cb.patch(
        f"/v1/admin/clusters/{cid}/headline",
        headers={"X-CSRF-Token": tb},
        json={"expectedVersion": 2, **wording},
    )
    assert r.status_code == 200, r.text
    with SessionLocal() as s:
        review = s.scalar(
            select(EditorialReview).where(
                EditorialReview.cluster_id == cid, EditorialReview.superseded_at.is_(None)
            )
        )
        rid, rv, author = review.id, review.version, review.drafted_by_id
    body["expectedVersion"] = rv
    approved = ca.post(f"/v1/admin/reviews/{rid}/decision", headers={"X-CSRF-Token": ta}, json=body)
    public = TestClient(app).get("/v1/clusters/" + cluster_info(cid)[0])
    print(
        "AUTHORS",
        a.id,
        b.id,
        "RECORDED",
        author,
        "APPROVAL",
        approved.status_code,
        "PUBLIC",
        public.status_code,
    )
    assert approved.status_code == 409, (
        "Original author published their unchanged draft after another user submitted a no-op edit"
    )


def test_search_must_not_match_unapproved_summary():
    client, csrf = login(make_staff(StaffRole.EDITOR))
    headers = {"X-CSRF-Token": csrf}
    with SessionLocal.begin() as s:
        cid, _ = fixture_cluster(s)
        s.flush()
        summary = s.scalar(select(SummaryVersion).where(SummaryVersion.cluster_id == cid))
        sid = summary.id
        ids = list(s.scalars(select(ClaimEvidence.id).join(Claim).where(Claim.cluster_id == cid)))
    secret = "Unpublishedcanary" + uuid.uuid4().hex
    text = secret + " is an unapproved allegation."
    r = client.post(
        f"/v1/admin/summaries/{sid}/revisions",
        headers=headers,
        json={
            "expectedVersion": 1,
            "summaryText": text,
            "evidenceMap": fixture_evidence(text, ids),
        },
    )
    assert r.status_code == 200, r.text
    with SessionLocal() as s:
        sv = s.get(SummaryVersion, sid).row_version
    r = client.post(
        f"/v1/admin/summaries/{sid}/decision",
        headers=headers,
        json={
            "expectedVersion": sv,
            "decision": "APPROVED",
            "notes": "Keep the old public summary",
        },
    )
    # R3 now permanently retires the superseded summary: even this attempted
    # restoration is rejected. A separate test exercises search on public
    # clusters with pending/rejected/superseded canaries still present.
    assert r.status_code == 409, r.text
    slug, version, _, _ = cluster_info(cid)
    r = client.patch(
        f"/v1/admin/clusters/{cid}/suppression",
        headers=headers,
        json={
            "expectedVersion": version,
            "paused": False,
            "reason": "Restore the approved old summary",
        },
    )
    assert r.status_code == 409, r.text
    public = TestClient(app)
    assert secret not in public.get("/v1/clusters/" + slug).text
    result = public.get("/v1/search", params={"q": secret})
    print(
        "DRAFT SEARCH",
        result.status_code,
        result.json()["pagination"],
        [i["slug"] for i in result.json()["items"]],
    )
    assert result.json()["pagination"]["total"] == 0, (
        "Anonymous search matched an unapproved hidden allegation"
    )


def test_claim_correction_must_invalidate_derived_summary():
    client, csrf = login(make_staff(StaffRole.EDITOR))
    headers = {"X-CSRF-Token": csrf}
    with SessionLocal.begin() as s:
        cid, _ = fixture_cluster(s)
        s.flush()
        claim = s.scalar(select(Claim).where(Claim.cluster_id == cid))
        claim.text = "The fictional train service is running."
        summary = s.scalar(select(SummaryVersion).where(SummaryVersion.cluster_id == cid))
        summary.summary_text = claim.text
        ids = list(s.scalars(select(ClaimEvidence.id).where(ClaimEvidence.claim_id == claim.id)))
        summary.evidence_map = fixture_evidence(summary.summary_text, ids)
        claim_id, claim_version = claim.id, claim.version
    slug, version, _, _ = cluster_info(cid)
    original = TestClient(app).get("/v1/clusters/" + slug).json()["brief"]
    r = client.post(
        "/v1/admin/corrections",
        headers=headers,
        json={
            "clusterId": str(cid),
            "description": "Original claim was withdrawn",
            "sourceUrl": "https://fixture.example/correction",
            "evidence": "Fictional source retraction",
        },
    )
    assert r.status_code == 200, r.text
    correction_id = r.json()["id"]
    r = client.post(
        f"/v1/admin/corrections/{correction_id}/apply",
        headers=headers,
        json={
            "expectedVersion": 1,
            "clusterExpectedVersion": version,
            "resolution": "Retract the original source claim",
            "claimUpdates": [
                {
                    "claimId": str(claim_id),
                    "expectedVersion": claim_version,
                    "text": "The original claim is retracted.",
                    "textHi": "मूल दावा वापस लिया गया है।",
                    "state": "DISPUTED",
                }
            ],
        },
    )
    assert r.status_code == 200, r.text
    result = TestClient(app).get("/v1/clusters/" + slug)
    with SessionLocal() as s:
        summaries = [
            (x.decision.value, x.summary_text)
            for x in s.scalars(select(SummaryVersion).where(SummaryVersion.cluster_id == cid))
        ]
    print("CORRECTION", r.status_code, "READER", result.status_code, "SUMMARY", summaries)
    assert result.status_code == 404 or result.json()["brief"] != original, (
        "Corrected claim left its old derived summary approved and public"
    )


def test_merge_must_reject_repeated_source_ids_without_losing_memberships():
    client, csrf = login(make_staff(StaffRole.EDITOR))
    with SessionLocal.begin() as s:
        target, first = fixture_cluster(s)
        source, second = fixture_cluster(s)
    r = client.post(
        "/v1/admin/clusters/merge",
        headers={"X-CSRF-Token": csrf},
        json={
            "targetId": str(target),
            "sourceIds": [str(source), str(source)],
            "versions": {str(target): 1, str(source): 1},
        },
    )
    with SessionLocal() as s:
        target_ids = list(
            s.scalars(select(ClusterArticle.article_id).where(ClusterArticle.cluster_id == target))
        )
        source_ids = list(
            s.scalars(select(ClusterArticle.article_id).where(ClusterArticle.cluster_id == source))
        )
    print(
        "DUPLICATE MERGE",
        r.status_code,
        "target memberships",
        len(target_ids),
        "source memberships",
        len(source_ids),
        "initial",
        len(first) + len(second),
    )
    assert r.status_code in [409, 422] or set(target_ids) == set(first + second), (
        "Repeated source ID silently removed article memberships"
    )
