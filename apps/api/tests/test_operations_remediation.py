import csv
import io
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from nuzenio_api.audit import append_audit
from nuzenio_api.csv_export import spreadsheet_cell
from nuzenio_api.db import SessionLocal
from nuzenio_api.evidence import fixture_evidence
from nuzenio_api.models import (
    Article,
    Brief,
    Claim,
    ClaimEvidence,
    ClaimState,
    ClusterArticle,
    ContentStatus,
    DeadLetterJob,
    DecisionState,
    EventCluster,
    FeedRun,
    FeedRunState,
    OnboardingState,
    RightsPolicy,
    SourceFeed,
    StaffRole,
    SummaryVersion,
)
from test_auth_editorial import login, make_staff


@pytest.mark.parametrize("value", ["=1+1", " +cmd", "\t@SUM(A1)", "\r-1", "\x00=1", "\u200b=1"])
def test_f09_formula_prefixes(value):
    assert spreadsheet_cell(value).startswith("'")


def test_f09_csv_neutralizes_all_strings_but_json_preserves_canonical_values():
    user = make_staff(StaffRole.ANALYST)
    client, _ = login(user)
    request_id = "=request-fixture"
    with SessionLocal.begin() as session:
        append_audit(
            session,
            actor=None,
            action="=action-fixture",
            entity_type="@entity",
            entity_id=None,
            request_id=request_id,
            user_agent='\t=HYPERLINK("https://evil.invalid")',
            reason=" +formula",
            details={"input": "=formula"},
        )
    raw = client.get(
        "/v1/admin/audit/export", params={"format": "json", "request_id": request_id}
    ).json()[0]
    result = client.get(
        "/v1/admin/audit/export", params={"format": "csv", "request_id": request_id}
    )
    row = next(csv.DictReader(io.StringIO(result.text)))
    for name in ["action", "entityType", "requestId", "userAgent", "reason"]:
        assert row[name] == "'" + raw[name]
    assert raw["details"] == {"input": "=formula"}


def test_f10_snapshot_exposes_all_rights_and_binds_approval():
    manager = make_staff(StaffRole.PUBLISHER_MANAGER)
    client, csrf = login(manager)
    with SessionLocal.begin() as session:
        source = session.scalar(select(SourceFeed))
        rights = RightsPolicy(
            organization_id=source.organization_id,
            policy_name="Snapshot fixture",
            evidence_url="https://fixture.example/contract",
            effective_at=datetime.now(UTC),
            may_use_headline=True,
            may_store_excerpt=True,
            may_summarize=True,
            may_display_full_text=False,
            onboarding_state=OnboardingState.UNDER_REVIEW,
            metadata_json={},
        )
        session.add(rights)
        session.flush()
        rid = rights.id
    snapshot = client.get(f"/v1/admin/rights/{rid}/snapshot").json()
    assert len(snapshot["permissions"]) == 8
    assert snapshot["evidenceUrl"] == "https://fixture.example/contract"
    assert snapshot["effectiveAt"]
    assert snapshot["publisher"]["ownership"]
    body = {"expectedVersion": 1, "state": "APPROVED", "notes": "Reviewed fixture"}
    path = f"/v1/admin/rights/{rid}/transition"
    assert client.post(path, headers={"X-CSRF-Token": csrf}, json=body).status_code == 409
    body["expectedSnapshotHash"] = "0" * 64
    assert client.post(path, headers={"X-CSRF-Token": csrf}, json=body).status_code == 409
    body["expectedSnapshotHash"] = snapshot["snapshotHash"]
    assert client.post(path, headers={"X-CSRF-Token": csrf}, json=body).status_code == 200
    history = client.get(f"/v1/admin/rights/{rid}/snapshot").json()["reviewHistory"]
    assert history[0]["reviewedSnapshot"]["snapshotHash"] == snapshot["snapshotHash"]
    assert client.post(path, headers={"X-CSRF-Token": csrf}, json=body).status_code == 409


def fixture_cluster(session):
    feed = session.scalar(select(SourceFeed).where(SourceFeed.approved.is_(True)))
    cluster = EventCluster(
        slug=f"allocation-{uuid.uuid4()}",
        neutral_headline="Fictional allocation story",
        neutral_headline_hi="काल्पनिक खबर",
        category="Technology",
        status=ContentStatus.PUBLISHED,
    )
    session.add(cluster)
    session.flush()
    claim = Claim(
        cluster_id=cluster.id,
        text="Fictional claim.",
        text_hi="काल्पनिक दावा।",
        state=ClaimState.CONFIRMED,
    )
    session.add(claim)
    session.flush()
    evidence_ids = []
    article_ids = []
    for _ in range(2):
        article = Article(
            feed_id=feed.id,
            publisher_organization_id=feed.organization_id,
            canonical_url=f"https://fixture.example/{uuid.uuid4()}",
            title="Fictional title",
            language="en",
            published_at=datetime.now(UTC),
            source_metadata={},
        )
        session.add(article)
        session.flush()
        article_ids.append(article.id)
        session.add(ClusterArticle(cluster_id=cluster.id, article_id=article.id))
        evidence = ClaimEvidence(claim_id=claim.id, article_id=article.id, locator="Fixture only")
        session.add(evidence)
        session.flush()
        evidence_ids.append(evidence.id)
    session.add(
        SummaryVersion(
            cluster_id=cluster.id,
            version=1,
            language="en",
            summary_text="Fictional sentence.",
            evidence_map=fixture_evidence("Fictional sentence.", evidence_ids),
            generator_name="fixture",
            decision=DecisionState.APPROVED,
        )
    )
    return cluster.id, article_ids


def test_f03_audit_failure_rolls_back_domain_mutation(monkeypatch):
    from nuzenio_api import editorial

    client, csrf = login(make_staff(StaffRole.EDITOR))
    with SessionLocal.begin() as session:
        cid, _ = fixture_cluster(session)

    def fail(*args, **kwargs):
        raise TypeError("Fixture audit encoder failure")

    monkeypatch.setattr(editorial, "append_audit", fail)
    with pytest.raises(TypeError, match="audit encoder"):
        client.patch(
            f"/v1/admin/clusters/{cid}/suppression",
            headers={"X-CSRF-Token": csrf},
            json={"expectedVersion": 1, "paused": True, "reason": "Atomicity fixture"},
        )
    with SessionLocal() as session:
        cluster = session.get(EventCluster, cid)
        assert cluster.status == ContentStatus.PUBLISHED
        assert cluster.version == 1


def test_f07_merge_split_hold_derived_content_and_preserve_stable_brief_ids():
    editor = make_staff(StaffRole.EDITOR)
    client, csrf = login(editor)
    headers = {"X-CSRF-Token": csrf}
    with SessionLocal.begin() as session:
        target_id, articles_a = fixture_cluster(session)
        source_id, articles_b = fixture_cluster(session)
        brief = Brief(
            edition=str(uuid.uuid4()),
            period="morning",
            language="en",
            title="Fixture brief",
            cluster_ids=[str(target_id), str(source_id)],
            published_at=datetime.now(UTC),
        )
        session.add(brief)
        session.flush()
        bid = brief.id
    result = client.post(
        "/v1/admin/clusters/merge",
        headers=headers,
        json={
            "targetId": str(target_id),
            "sourceIds": [str(source_id)],
            "versions": {str(target_id): 1, str(source_id): 1},
        },
    )
    assert result.status_code == 200, result.text
    with SessionLocal() as session:
        assert session.get(Brief, bid).cluster_ids == [str(target_id)]
        target = session.get(EventCluster, target_id)
        assert target.status == ContentStatus.HELD
        assert all(item.decision == DecisionState.PENDING for item in target.summaries)
        version = target.version
    groups = [
        {
            "slug": f"split-{uuid.uuid4()}",
            "headline": "Fictional split headline",
            "headlineHi": "काल्पनिक विभाजित खबर",
            "articleIds": [str(item) for item in ids],
        }
        for ids in [articles_a, articles_b]
    ]
    result = client.post(
        f"/v1/admin/clusters/{target_id}/split",
        headers=headers,
        json={"expectedVersion": version, "groups": groups},
    )
    assert result.status_code == 200, result.text
    with SessionLocal() as session:
        ids = session.get(Brief, bid).cluster_ids
        assert len(ids) == 2
        for key in ids:
            cluster = session.get(EventCluster, uuid.UUID(key))
            assert cluster.status == ContentStatus.HELD
            assert cluster.summaries, "Split results need an unpublished draft slot for remapping"
            members = {row.article_id for row in cluster.articles}
            for claim in cluster.claims:
                assert all(e.article_id in members for e in claim.evidence if e.article_id)
            assert client.get(f"/v1/clusters/{cluster.slug}").status_code == 404


def test_f08_dead_letter_replay_is_single_use(monkeypatch):
    from nuzenio_api import admin_routes
    from test_ingestion_remediation import new_run

    monkeypatch.setattr(admin_routes, "dispatch", lambda *args: None)
    _, run_id = new_run()
    with SessionLocal.begin() as session:
        session.get(FeedRun, run_id).state = FeedRunState.DEAD_LETTERED
        session.add(DeadLetterJob(feed_run_id=run_id, reason="Fixture exhausted", payload={}))
    client, csrf = login(make_staff(StaffRole.PUBLISHER_MANAGER))
    path = f"/v1/admin/feed-runs/{run_id}/retry"
    first = client.post(path, headers={"X-CSRF-Token": csrf})
    assert first.status_code == 200, first.text
    with SessionLocal.begin() as session:
        session.get(FeedRun, uuid.UUID(first.json()["id"])).state = FeedRunState.SUCCEEDED
    assert client.post(path, headers={"X-CSRF-Token": csrf}).status_code == 409


def test_f06_summary_revision_requires_complete_local_evidence_and_preserves_prior_text():
    client, csrf = login(make_staff(StaffRole.EDITOR))
    with SessionLocal.begin() as session:
        cid, _ = fixture_cluster(session)
    with SessionLocal() as session:
        old = session.scalar(select(SummaryVersion).where(SummaryVersion.cluster_id == cid))
        old_id, previous_text = old.id, old.summary_text
        evidence_id = session.scalar(
            select(ClaimEvidence.id).join(Claim).where(Claim.cluster_id == cid)
        )
    text = "New fictional sentence."
    body = {
        "expectedVersion": 1,
        "summaryText": text,
        "evidenceMap": fixture_evidence(text, [uuid.uuid4()]),
    }
    headers = {"X-CSRF-Token": csrf}
    path = f"/v1/admin/summaries/{old_id}/revisions"
    assert client.post(path, headers=headers, json=body).status_code == 409
    body["evidenceMap"] = fixture_evidence(text, [evidence_id])
    result = client.post(path, headers=headers, json=body)
    assert result.status_code == 200, result.text
    new_id = result.json()["id"]
    assert (
        client.post(
            f"/v1/admin/summaries/{new_id}/decision",
            headers=headers,
            json={"expectedVersion": 1, "decision": "APPROVED", "notes": "Checked fixture"},
        ).status_code
        == 200
    )
    with SessionLocal() as session:
        assert session.get(SummaryVersion, old_id).summary_text == previous_text
        assert session.get(SummaryVersion, old_id).decision == DecisionState.PENDING


def test_f07_split_partial_failure_rolls_back():
    editor = make_staff(StaffRole.EDITOR)
    client, csrf = login(editor)
    with SessionLocal.begin() as session:
        cid, articles = fixture_cluster(session)
        duplicate_id, _ = fixture_cluster(session)
        duplicate_slug = session.get(EventCluster, duplicate_id).slug
        original_slug = session.get(EventCluster, cid).slug
    response = client.post(
        f"/v1/admin/clusters/{cid}/split",
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": 1,
            "groups": [
                {
                    "slug": "rollback-first-group",
                    "headline": "Rollback fixture one",
                    "headlineHi": "काल्पनिक खबर",
                    "articleIds": [str(articles[0])],
                },
                {
                    "slug": duplicate_slug,
                    "headline": "Rollback fixture two",
                    "headlineHi": "काल्पनिक खबर",
                    "articleIds": [str(articles[1])],
                },
            ],
        },
    )
    assert response.status_code >= 400
    with SessionLocal() as session:
        cluster = session.get(EventCluster, cid)
        assert cluster.slug == original_slug
        assert cluster.version == 1
        assert len(cluster.articles) == 2
