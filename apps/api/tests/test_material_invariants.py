import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from nuzenio_api.db import SessionLocal
from nuzenio_api.evidence import fixture_evidence
from nuzenio_api.main import app
from nuzenio_api.models import (
    Article,
    Brief,
    Claim,
    ClaimEvidence,
    ClusterArticle,
    DecisionState,
    EditorialReview,
    EventCluster,
    MaterialContributor,
    RiskLevel,
    SavedCluster,
    StaffRole,
    SummaryVersion,
)
from test_auth_editorial import login, make_staff
from test_operations_remediation import fixture_cluster


def pending(cid):
    with SessionLocal() as session:
        review = session.scalar(
            select(EditorialReview).where(
                EditorialReview.cluster_id == cid, EditorialReview.superseded_at.is_(None)
            )
        )
        return review.id, review.version


@pytest.mark.parametrize("change", ["identical", "whitespace", "secondary"])
def test_all_material_contributors_remain_ineligible(change):
    a, b, independent = [login(make_staff(StaffRole.ADMINISTRATOR)) for _ in range(3)]
    with SessionLocal.begin() as session:
        cid, _ = fixture_cluster(session)
        session.get(EventCluster, cid).risk_level = RiskLevel.HIGH
    wording = {"headline": "Fictional material assertion A", "headlineHi": "काल्पनिक महत्वपूर्ण दावा"}

    def edit(actor, version, text):
        client, csrf = actor
        return client.patch(
            f"/v1/admin/clusters/{cid}/headline",
            headers={"X-CSRF-Token": csrf},
            json={"expectedVersion": version, **text},
        )

    assert edit(a, 1, wording).status_code == 200
    before = pending(cid)
    second = dict(wording)
    if change == "whitespace":
        second = {k: "  " + v.replace(" ", "  ") + "  " for k, v in second.items()}
    if change == "secondary":
        second["headline"] += " with secondary context B"
    assert edit(b, 2, second).status_code == 200
    if change != "secondary":
        assert pending(cid) == before, "No-op edits must not supersede review or change authorship"
        with SessionLocal() as session:
            assert session.get(EventCluster, cid).version == 2

    def decide(actor):
        rid, version = pending(cid)
        client, csrf = actor
        return client.post(
            f"/v1/admin/reviews/{rid}/decision",
            headers={"X-CSRF-Token": csrf},
            json={
                "expectedVersion": version,
                "decision": "APPROVED",
                "notes": "Independent review fixture",
            },
        )

    assert decide(a).status_code == 409
    if change == "secondary":
        assert decide(b).status_code == 409
    assert decide(independent).status_code == 200


@pytest.mark.parametrize("decision", ["PENDING", "REJECTED", "APPROVED", "WITHDRAWN", "STALE"])
def test_search_matches_only_selected_public_summary(decision):
    secret = "Privatedraft" + uuid.uuid4().hex
    public_text = "Publicfixture" + uuid.uuid4().hex
    with SessionLocal.begin() as session:
        cid, _ = fixture_cluster(session)
        session.flush()
        old = session.scalar(select(SummaryVersion).where(SummaryVersion.cluster_id == cid))
        ids = list(
            session.scalars(select(ClaimEvidence.id).join(Claim).where(Claim.cluster_id == cid))
        )
        old.summary_text = secret + "."
        old.evidence_map = fixture_evidence(old.summary_text, ids)
        old.decision = (
            DecisionState.APPROVED
            if decision in {"WITHDRAWN", "STALE"}
            else DecisionState(decision)
        )
        if decision in {"WITHDRAWN", "STALE"}:
            from datetime import UTC, datetime

            old.invalidated_at = datetime.now(UTC)
            old.invalidation_reason = decision
        if decision != "APPROVED":
            old.version = 3
        session.add(
            SummaryVersion(
                cluster_id=cid,
                language="en",
                version=2,
                summary_text=public_text + ".",
                evidence_map=fixture_evidence(public_text + ".", ids),
                generator_name="fixture",
                decision=DecisionState.APPROVED,
            )
        )
    reader = TestClient(app)
    for page in [1, 2]:
        result = reader.get("/v1/search", params={"q": secret, "page": page, "page_size": 1}).json()
        assert result["pagination"]["total"] == 0
        assert result["items"] == []
    assert reader.get("/v1/search", params={"q": public_text}).json()["pagination"]["total"] == 1


@pytest.mark.parametrize("kind", ["claim", "evidence", "summary"])
def test_secondary_material_paths_preserve_contributors(kind):
    a, b, c = [make_staff(StaffRole.ADMINISTRATOR) for _ in range(3)]
    ca, ta = login(a)
    cb, tb = login(b)
    cc, tc = login(c)
    with SessionLocal.begin() as session:
        cid, _ = fixture_cluster(session)
        session.get(EventCluster, cid).risk_level = RiskLevel.HIGH
    assert (
        ca.patch(
            f"/v1/admin/clusters/{cid}/headline",
            headers={"X-CSRF-Token": ta},
            json={
                "expectedVersion": 1,
                "headline": "Material author A",
                "headlineHi": "मूल लेखक का दावा",
            },
        ).status_code
        == 200
    )
    with SessionLocal() as session:
        claim = session.scalar(select(Claim).where(Claim.cluster_id == cid))
        ids = [str(item.id) for item in claim.evidence]
        body = {
            "expectedVersion": claim.version,
            "text": claim.text,
            "textHi": claim.text_hi,
            "state": claim.state.value,
            "evidenceIds": ids,
        }
        sid = session.scalar(select(SummaryVersion.id).where(SummaryVersion.cluster_id == cid))
        path = f"/v1/admin/claims/{claim.id}"
    if kind == "summary":
        text = "Summary assertion authored by B."
        result = cb.post(
            f"/v1/admin/summaries/{sid}/revisions",
            headers={"X-CSRF-Token": tb},
            json={
                "expectedVersion": 1,
                "summaryText": text,
                "evidenceMap": fixture_evidence(text, ids),
            },
        )
    else:
        if kind == "claim":
            body["text"] += " Additional factual statement B."
        else:
            body["evidenceIds"] = ids[:1]
        result = cb.patch(path, headers={"X-CSRF-Token": tb}, json=body)
    assert result.status_code == 200, result.text
    with SessionLocal() as session:
        assert set(
            session.scalars(
                select(MaterialContributor.staff_user_id).where(
                    MaterialContributor.cluster_id == cid
                )
            )
        ) == {a.id, b.id}
    for client, csrf, expected in [(ca, ta, 409), (cb, tb, 409), (cc, tc, 200)]:
        rid, version = pending(cid)
        response = client.post(
            f"/v1/admin/reviews/{rid}/decision",
            headers={"X-CSRF-Token": csrf},
            json={
                "expectedVersion": version,
                "decision": "APPROVED",
                "notes": "Fixture independent decision",
            },
        )
        assert response.status_code == expected, response.text


@pytest.mark.parametrize("kind", ["claim", "article"])
def test_correction_invalidates_both_languages_and_every_reader_surface(kind):
    from datetime import UTC, datetime

    from nuzenio_api.models import EditionControl

    actor, csrf = login(make_staff(StaffRole.EDITOR))
    headers = {"X-CSRF-Token": csrf}
    secret = "Withdrawnassertion" + uuid.uuid4().hex
    with SessionLocal.begin() as session:
        # Existing tests may pause the edition; scope this fixture explicitly.
        control = session.scalar(select(EditionControl).where(EditionControl.edition == "india"))
        if control:
            control.paused = False
        cid, articles = fixture_cluster(session)
        other, _ = fixture_cluster(session)
        cluster = session.get(EventCluster, cid)
        cluster.location = "Delhi NCR"
        slug = cluster.slug
        other_slug = session.get(EventCluster, other).slug
        session.flush()
        claim = session.scalar(select(Claim).where(Claim.cluster_id == cid))
        claim_id = claim.id
        ids = [item.id for item in claim.evidence]
        summary = session.scalar(select(SummaryVersion).where(SummaryVersion.cluster_id == cid))
        summary.summary_text = secret + "."
        summary.evidence_map = fixture_evidence(summary.summary_text, ids)
        session.add(
            SummaryVersion(
                cluster_id=cid,
                language="hi",
                version=1,
                summary_text=secret + "।",
                evidence_map=fixture_evidence(secret + "।", ids),
                generator_name="fixture",
                decision=DecisionState.APPROVED,
            )
        )
        saved = SavedCluster(
            user_id=uuid.uuid4(), cluster_id=cid, offline_snapshot={"brief": secret}
        )
        session.add(saved)
        for lang in ["en", "hi"]:
            brief = session.scalar(
                select(Brief).where(
                    Brief.edition == "india", Brief.period == "morning", Brief.language == lang
                )
            )
            brief.cluster_ids = [str(cid), str(other)]
            brief.published_at = datetime.now(UTC)
    reader = TestClient(app)
    assert secret in reader.get("/v1/clusters/" + slug).text
    create = actor.post(
        "/v1/admin/corrections",
        headers=headers,
        json={
            "clusterId": str(cid) if kind == "claim" else None,
            "articleId": str(articles[0]) if kind == "article" else None,
            "description": "Withdraw a fictional assertion",
            "evidence": "Fixture retraction",
            "sourceUrl": "https://fixture.example/retraction",
        },
    )
    assert create.status_code == 200, create.text
    body = {"expectedVersion": 1, "resolution": "Fictional correction recorded"}
    if kind == "claim":
        body.update(
            clusterExpectedVersion=1,
            claimUpdates=[
                {
                    "claimId": str(claim_id),
                    "expectedVersion": 1,
                    "text": "The original assertion is retracted.",
                    "textHi": "मूल दावा वापस लिया गया है।",
                    "state": "DISPUTED",
                }
            ],
        )
    else:
        body.update(articleExpectedVersion=1, articleTitle="Corrected fictional factual title")
    result = actor.post(
        f"/v1/admin/corrections/{create.json()['id']}/apply", headers=headers, json=body
    )
    assert result.status_code == 200, result.text
    for lang in ["en", "hi"]:
        for path in [
            "/v1/feed/top",
            "/v1/feed/local",
            "/v1/search?q=" + secret,
            "/v1/briefs/morning",
            "/v1/clusters/" + slug,
        ]:
            result = reader.get(path, params={"language": lang})
            assert secret not in result.text, (path, result.text)
        assert (
            reader.get("/v1/search", params={"q": secret, "language": lang}).json()["pagination"][
                "total"
            ]
            == 0
        )
    assert reader.get("/v1/clusters/" + other_slug).status_code == 200
    assert reader.get("/v1/admin/clusters").status_code == 401
    assert secret in actor.get("/v1/admin/clusters", params={"page_size": 100}).text
    with SessionLocal() as session:
        versions = list(
            session.scalars(select(SummaryVersion).where(SummaryVersion.cluster_id == cid))
        )
        assert len(versions) == 2 and all(s.invalidated_at for s in versions)
        assert all(secret in s.summary_text for s in versions)
        snapshot = session.scalar(select(SavedCluster).where(SavedCluster.cluster_id == cid))
        assert secret not in str(snapshot.offline_snapshot)
        for summary in versions:
            response = actor.post(
                f"/v1/admin/summaries/{summary.id}/decision",
                headers=headers,
                json={
                    "expectedVersion": summary.row_version,
                    "decision": "APPROVED",
                    "notes": "Attempt stale approval",
                },
            )
            assert response.status_code == 409


@pytest.mark.parametrize("duplicate", ["same", "canonical", "target"])
def test_invalid_merge_leaves_entire_graph_unchanged(duplicate):
    client, csrf = login(make_staff(StaffRole.EDITOR))
    with SessionLocal.begin() as session:
        target, _ = fixture_cluster(session)
        source, _ = fixture_cluster(session)

    def snapshot():
        with SessionLocal() as session:
            return {
                model.__tablename__: sorted(
                    str(dict(row)) for row in session.execute(select(model.__table__)).mappings()
                )
                for model in (
                    Article,
                    EventCluster,
                    ClusterArticle,
                    Claim,
                    ClaimEvidence,
                    SummaryVersion,
                    Brief,
                )
            }

    before = snapshot()
    ids = [str(source), str(source).upper() if duplicate == "canonical" else str(source)]
    if duplicate == "target":
        ids = [str(target)]
    result = client.post(
        "/v1/admin/clusters/merge",
        headers={"X-CSRF-Token": csrf},
        json={
            "targetId": str(target),
            "sourceIds": ids,
            "versions": {str(target): 1, str(source): 1},
        },
    )
    assert result.status_code == 422
    assert snapshot() == before


def test_competing_merge_requests_have_only_one_winner():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    accounts = [login(make_staff(StaffRole.EDITOR)) for _ in range(2)]
    with SessionLocal.begin() as session:
        target, ta = fixture_cluster(session)
        source, sa = fixture_cluster(session)
    gate = Barrier(2)

    def merge(actor):
        client, csrf = actor
        gate.wait(timeout=5)
        return client.post(
            "/v1/admin/clusters/merge",
            headers={"X-CSRF-Token": csrf},
            json={
                "targetId": str(target),
                "sourceIds": [str(source)],
                "versions": {str(target): 1, str(source): 1},
            },
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(merge, accounts)) == [200, 409]
    with SessionLocal() as session:
        assert set(
            session.scalars(
                select(ClusterArticle.article_id).where(ClusterArticle.cluster_id == target)
            )
        ) == set(ta + sa)


def test_concurrent_material_edit_and_approval_cannot_publish_unreviewed_revision():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from nuzenio_api.models import ContentStatus

    author, editor, reviewer = [login(make_staff(StaffRole.ADMINISTRATOR)) for _ in range(3)]
    with SessionLocal.begin() as session:
        cid, _ = fixture_cluster(session)
        session.get(EventCluster, cid).risk_level = RiskLevel.HIGH
    client, csrf = author
    original = {"headline": "Fictional assertion A", "headlineHi": "काल्पनिक दावा"}
    assert (
        client.patch(
            f"/v1/admin/clusters/{cid}/headline",
            headers={"X-CSRF-Token": csrf},
            json={"expectedVersion": 1, **original},
        ).status_code
        == 200
    )
    rid, rv = pending(cid)
    gate = Barrier(2)

    def edit():
        client, csrf = editor
        gate.wait(timeout=5)
        return client.patch(
            f"/v1/admin/clusters/{cid}/headline",
            headers={"X-CSRF-Token": csrf},
            json={
                "expectedVersion": 2,
                **original,
                "headline": original["headline"] + " with B context",
            },
        ).status_code

    def approve():
        client, csrf = reviewer
        gate.wait(timeout=5)
        return client.post(
            f"/v1/admin/reviews/{rid}/decision",
            headers={"X-CSRF-Token": csrf},
            json={
                "expectedVersion": rv,
                "decision": "APPROVED",
                "notes": "Review original revision only",
            },
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        edit_future, review_future = pool.submit(edit), pool.submit(approve)
        edited, reviewed = edit_future.result(), review_future.result()
        assert sorted([edited, reviewed]) == [200, 409]
    with SessionLocal() as session:
        cluster = session.get(EventCluster, cid)
        if reviewed == 200:
            assert cluster.status == ContentStatus.PUBLISHED
            assert cluster.neutral_headline == original["headline"]
        else:
            assert cluster.status == ContentStatus.HELD


def test_missing_legacy_provenance_is_not_repaired_by_new_edits():
    a, b = [login(make_staff(StaffRole.ADMINISTRATOR)) for _ in range(2)]
    with SessionLocal.begin() as session:
        cid, _ = fixture_cluster(session)
        cluster = session.get(EventCluster, cid)
        cluster.provenance_complete = False
        cluster.risk_level = RiskLevel.HIGH
    client, csrf = a
    assert (
        client.patch(
            f"/v1/admin/clusters/{cid}/headline",
            headers={"X-CSRF-Token": csrf},
            json={
                "expectedVersion": 1,
                "headline": "A new edit does not establish old authors",
                "headlineHi": "पुराने लेखकों की जानकारी उपलब्ध नहीं",
            },
        ).status_code
        == 200
    )
    rid, rv = pending(cid)
    client, csrf = b
    result = client.post(
        f"/v1/admin/reviews/{rid}/decision",
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": rv,
            "decision": "APPROVED",
            "notes": "Attempt unknown legacy approval",
        },
    )
    assert result.status_code == 409
    assert result.json()["error"]["code"] == "provenance_required"
