"""Closure-review correction author reproduction and invariant regressions."""

import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from nuzenio_api.db import SessionLocal
from nuzenio_api.evidence import fixture_evidence
from nuzenio_api.main import app
from nuzenio_api.models import (
    Article,
    Claim,
    ClaimEvidence,
    ClusterArticle,
    ContentStatus,
    Correction,
    CorrectionContributor,
    EditorialReview,
    EventCluster,
    MaterialContributor,
    RiskLevel,
    StaffRole,
    SummaryVersion,
)
from test_auth_editorial import login, make_staff
from test_operations_remediation import fixture_cluster


def actor():
    user = make_staff(StaffRole.ADMINISTRATOR)
    client, csrf = login(user)
    return user, client, {"X-CSRF-Token": csrf}


def pending(cid):
    with SessionLocal() as session:
        review = session.scalar(
            select(EditorialReview).where(
                EditorialReview.cluster_id == cid, EditorialReview.superseded_at.is_(None)
            )
        )
        return review.id, review.version


def version(cid):
    with SessionLocal() as session:
        return session.get(EventCluster, cid).version


def decide(who, cid):
    rid, rv = pending(cid)
    return who[1].post(
        f"/v1/admin/reviews/{rid}/decision",
        headers=who[2],
        json={"expectedVersion": rv, "decision": "APPROVED", "notes": "Independent fixture review"},
    )


def high_cluster(original, reviewer):
    with SessionLocal.begin() as session:
        cid, articles = fixture_cluster(session)
        cluster = session.get(EventCluster, cid)
        cluster.risk_level = RiskLevel.HIGH
        cluster.location = "Delhi NCR"
        slug = cluster.slug
    response = original[1].patch(
        f"/v1/admin/clusters/{cid}/headline",
        headers=original[2],
        json={
            "expectedVersion": 1,
            "headline": "Original fictional safety statement",
            "headlineHi": "काल्पनिक सुरक्षा खबर",
        },
    )
    assert response.status_code == 200, response.text
    assert decide(reviewer, cid).status_code == 200
    return cid, articles, slug


def open_correction(who, **target):
    text = "Correctionauthor" + uuid.uuid4().hex + " says the fictional notice was withdrawn."
    response = who[1].post(
        "/v1/admin/corrections",
        headers=who[2],
        json={
            **target,
            "description": text,
            "sourceUrl": "https://fixture.example/correction",
            "evidence": "Fictional evidence submitted by correction author",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["id"], text


def regenerate(who, cid):
    with SessionLocal() as session:
        summary = session.scalar(select(SummaryVersion).where(SummaryVersion.cluster_id == cid))
        sid, rv = summary.id, summary.row_version
        evidence = list(
            session.scalars(select(ClaimEvidence.id).join(Claim).where(Claim.cluster_id == cid))
        )
    text = "The fictional safety statement has been corrected."
    response = who[1].post(
        f"/v1/admin/summaries/{sid}/revisions",
        headers=who[2],
        json={
            "expectedVersion": rv,
            "summaryText": text,
            "evidenceMap": fixture_evidence(text, evidence),
        },
    )
    assert response.status_code == 200, response.text
    new_id = response.json()["id"]
    new_version = response.json()["version"]
    response = who[1].post(
        f"/v1/admin/summaries/{new_id}/decision",
        headers=who[2],
        json={
            "expectedVersion": new_version,
            "decision": "APPROVED",
            "notes": "Reviewed replacement fixture summary",
        },
    )
    assert response.status_code == 200, response.text


def apply(who, correction_id, **changes):
    response = who[1].post(
        f"/v1/admin/corrections/{correction_id}/apply",
        headers=who[2],
        json={
            "expectedVersion": changes.pop("expectedVersion", 1),
            "resolution": "Apply the persisted fictional correction",
            **changes,
        },
    )
    return response


def assert_contributors(cid, *people):
    with SessionLocal() as session:
        actual = set(
            session.scalars(
                select(MaterialContributor.staff_user_id).where(
                    MaterialContributor.cluster_id == cid
                )
            )
        )
    assert {person[0].id for person in people}.issubset(actual)


@pytest.mark.parametrize("approval", ["final", "alert"])
def test_correction_author_cannot_approve_own_public_assertion(approval):
    original, author, resolver, independent, alert_reviewer = [actor() for _ in range(5)]
    cid, _, slug = high_cluster(original, independent)
    correction, assertion = open_correction(author, clusterId=str(cid))
    response = resolver[1].post(
        f"/v1/admin/corrections/{correction}/apply",
        headers=resolver[2],
        json={
            "expectedVersion": 1,
            "clusterExpectedVersion": version(cid),
            "resolution": "Apply the original author's correction unchanged",
        },
    )
    assert response.status_code == 200, response.text
    regenerate(resolver, cid)
    assert decide(resolver, cid).status_code == 409
    reader = TestClient(app)
    assert reader.get("/v1/clusters/" + slug).status_code == 404
    if approval == "final":
        response = decide(author, cid)
        public = reader.get("/v1/clusters/" + slug)
        assert response.status_code == 409, (
            f"Creator approved: {response.status_code}; public={public.status_code}; "
            f"own assertion public={assertion in public.text}"
        )
    assert decide(independent, cid).status_code == 200
    rid, rv = pending(cid)
    response = author[1].post(
        f"/v1/admin/reviews/{rid}/push-approval", headers=author[2], json={"expectedVersion": rv}
    )
    assert response.status_code == 409, response.text
    assert (
        alert_reviewer[1]
        .post(
            f"/v1/admin/reviews/{rid}/push-approval",
            headers=alert_reviewer[2],
            json={"expectedVersion": rv},
        )
        .status_code
        == 200
    )
    assert assertion in reader.get("/v1/clusters/" + slug).text


def test_draft_noops_do_not_transfer_lineage_but_later_editor_is_retained():
    original, creator, later_editor, resolver, reviewer, alert_reviewer = [
        actor() for _ in range(6)
    ]
    cid, _, _ = high_cluster(original, reviewer)
    correction_id, description = open_correction(creator, clusterId=str(cid))
    base = {
        "expectedVersion": 1,
        "description": description,
        "sourceUrl": "https://fixture.example/correction",
        "evidence": "Fictional evidence submitted by correction author",
    }
    path = f"/v1/admin/corrections/{correction_id}"
    exact = later_editor[1].patch(path, headers=later_editor[2], json=base)
    assert exact.status_code == 200 and exact.json()["version"] == 1
    normalized = later_editor[1].patch(
        path,
        headers=later_editor[2],
        json={**base, "description": "  " + description.replace(" ", "   ") + "  "},
    )
    assert normalized.status_code == 200 and normalized.json()["version"] == 1
    with SessionLocal() as session:
        assert (
            session.scalar(
                select(func.count(CorrectionContributor.id)).where(
                    CorrectionContributor.correction_id == correction_id
                )
            )
            == 1
        )
    changed = later_editor[1].patch(
        path,
        headers=later_editor[2],
        json={**base, "evidence": "Later editor added material fictional evidence."},
    )
    assert changed.status_code == 200 and changed.json()["version"] == 2
    result = apply(
        resolver,
        correction_id,
        expectedVersion=2,
        clusterExpectedVersion=version(cid),
    )
    assert result.status_code == 200, result.text
    regenerate(resolver, cid)
    assert_contributors(cid, creator, later_editor, resolver)
    for contributor in (creator, later_editor, resolver):
        assert decide(contributor, cid).status_code == 409
    assert decide(reviewer, cid).status_code == 200
    rid, rv = pending(cid)
    for contributor in (creator, later_editor, resolver):
        denied = contributor[1].post(
            f"/v1/admin/reviews/{rid}/push-approval",
            headers=contributor[2],
            json={"expectedVersion": rv},
        )
        assert denied.status_code == 409
    assert (
        alert_reviewer[1]
        .post(
            f"/v1/admin/reviews/{rid}/push-approval",
            headers=alert_reviewer[2],
            json={"expectedVersion": rv},
        )
        .status_code
        == 200
    )


def test_claim_targeted_correction_preserves_creator_and_resolver_lineage():
    original, creator, resolver, reviewer = [actor() for _ in range(4)]
    cid, _, slug = high_cluster(original, reviewer)
    with SessionLocal() as session:
        claim = session.scalar(select(Claim).where(Claim.cluster_id == cid))
        claim_id, claim_version = claim.id, claim.version
    correction_id, assertion = open_correction(creator, clusterId=str(cid))
    result = apply(
        resolver,
        correction_id,
        clusterExpectedVersion=version(cid),
        claimUpdates=[
            {
                "claimId": str(claim_id),
                "expectedVersion": claim_version,
                "text": assertion,
                "textHi": "काल्पनिक सुधार लेखक का दावा।",
                "state": "DISPUTED",
            }
        ],
    )
    assert result.status_code == 200, result.text
    regenerate(resolver, cid)
    assert_contributors(cid, creator, resolver)
    assert decide(creator, cid).status_code == 409
    assert decide(resolver, cid).status_code == 409
    assert TestClient(app).get(f"/v1/clusters/{slug}").status_code == 404
    assert decide(reviewer, cid).status_code == 200
    assert assertion in TestClient(app).get(f"/v1/clusters/{slug}").text


def test_article_correction_propagates_lineage_to_every_affected_cluster():
    original, creator, resolver, reviewer = [actor() for _ in range(4)]
    first_id, articles, first_slug = high_cluster(original, reviewer)
    second_id, _, second_slug = high_cluster(original, reviewer)
    with SessionLocal.begin() as session:
        session.add(ClusterArticle(cluster_id=second_id, article_id=articles[0]))
        article_version = session.get(Article, articles[0]).version
    correction_id, _ = open_correction(creator, articleId=str(articles[0]))
    result = apply(
        resolver,
        correction_id,
        articleExpectedVersion=article_version,
        articleTitle="Correction author's fictional source assertion",
    )
    assert result.status_code == 200, result.text
    reader = TestClient(app)
    for cid, slug in ((first_id, first_slug), (second_id, second_slug)):
        regenerate(resolver, cid)
        assert_contributors(cid, creator, resolver)
        assert decide(creator, cid).status_code == 409
        assert decide(resolver, cid).status_code == 409
        assert reader.get(f"/v1/clusters/{slug}").status_code == 404
        assert decide(reviewer, cid).status_code == 200
        assert reader.get(f"/v1/clusters/{slug}").status_code == 200


def test_correction_apply_and_review_are_serialized_without_partial_publication():
    original, creator, resolver, old_reviewer, final_reviewer = [actor() for _ in range(5)]
    cid, _, slug = high_cluster(original, old_reviewer)
    # Establish a pending pre-correction revision whose approval races publication.
    changed = original[1].patch(
        f"/v1/admin/clusters/{cid}/headline",
        headers=original[2],
        json={
            "expectedVersion": version(cid),
            "headline": "Pending fictional statement before correction",
            "headlineHi": "सुधार से पहले लंबित काल्पनिक कथन",
        },
    )
    assert changed.status_code == 200
    old_review_id, old_review_version = pending(cid)
    correction_id, _ = open_correction(creator, clusterId=str(cid))
    gate = Barrier(2)

    def publish():
        gate.wait()
        return apply(
            resolver,
            correction_id,
            clusterExpectedVersion=version(cid),
        )

    def approve_old():
        gate.wait()
        return old_reviewer[1].post(
            f"/v1/admin/reviews/{old_review_id}/decision",
            headers=old_reviewer[2],
            json={
                "expectedVersion": old_review_version,
                "decision": "APPROVED",
                "notes": "Concurrent old revision review",
            },
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        publish_future = pool.submit(publish)
        review_future = pool.submit(approve_old)
        publish_result = publish_future.result()
        review_result = review_future.result()
    # Depending on lock acquisition order, either the stale apply or stale review
    # loses; retry only the still-open correction against the current version.
    if publish_result.status_code == 409:
        publish_result = apply(
            resolver,
            correction_id,
            clusterExpectedVersion=version(cid),
        )
    assert publish_result.status_code == 200, publish_result.text
    assert review_result.status_code in {200, 409}
    with SessionLocal() as session:
        cluster = session.get(EventCluster, cid)
        correction = session.get(Correction, correction_id)
        assert cluster.status == ContentStatus.HELD
        assert correction.status == "PUBLISHED"
    assert_contributors(cid, creator, resolver)
    assert TestClient(app).get(f"/v1/clusters/{slug}").status_code == 404
    regenerate(resolver, cid)
    assert decide(final_reviewer, cid).status_code == 200


def test_correction_apply_audit_failure_rolls_back_publication_and_lineage(monkeypatch):
    from nuzenio_api import editorial

    original, creator, resolver, reviewer = [actor() for _ in range(4)]
    cid, _, slug = high_cluster(original, reviewer)
    correction_id, assertion = open_correction(creator, clusterId=str(cid))
    before_version = version(cid)

    def fail_audit(*args, **kwargs):
        raise TypeError("correction audit failure fixture")

    monkeypatch.setattr(editorial, "append_audit", fail_audit)
    with pytest.raises(TypeError, match="correction audit failure"):
        apply(
            resolver,
            correction_id,
            clusterExpectedVersion=before_version,
        )
    with SessionLocal() as session:
        correction = session.get(Correction, correction_id)
        cluster = session.get(EventCluster, cid)
        correction_people = set(
            session.scalars(
                select(CorrectionContributor.staff_user_id).where(
                    CorrectionContributor.correction_id == correction_id
                )
            )
        )
        assert correction.status == "OPEN" and correction.version == 1
        assert correction.resolved_by_id is None
        assert cluster.version == before_version and cluster.status == ContentStatus.PUBLISHED
        assert correction_people == {creator[0].id}
    public = TestClient(app).get(f"/v1/clusters/{slug}")
    assert public.status_code == 200 and assertion not in public.text
