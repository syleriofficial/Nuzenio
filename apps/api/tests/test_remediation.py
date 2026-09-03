import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from nuzenio_api.admin_schemas import PrimaryDocumentCreate
from nuzenio_api.audit import append_audit
from nuzenio_api.db import SessionLocal
from nuzenio_api.models import ContentStatus, EventCluster, SourceFeed
from nuzenio_api.seed import seed_database


def test_f03_audit_boundary_encodes_nested_values():
    with SessionLocal.begin() as session:
        record = append_audit(
            session,
            actor=None,
            action="ENCODING_REGRESSION",
            entity_type="Fixture",
            entity_id=None,
            request_id="encoding-test",
            after={"at": datetime.now(UTC), "nested": [uuid.uuid4(), ContentStatus.HELD]},
        )
        session.flush()
        json.dumps(record.after_summary)


def test_f01_seed_preserves_existing_editorial_state():
    with SessionLocal.begin() as session:
        cluster = session.scalar(
            select(EventCluster).where(EventCluster.slug == "delhi-air-quality-response")
        )
        cluster.status = ContentStatus.HELD
        cluster.neutral_headline = "Editorial wording must survive seed"
        feed = session.scalar(select(SourceFeed).limit(1))
        old_kill_switch = feed.kill_switch
        feed.kill_switch = True
        cluster_id, feed_id = cluster.id, feed.id
    seed_database(SessionLocal)
    with SessionLocal() as session:
        cluster = session.get(EventCluster, cluster_id)
        assert cluster.status == ContentStatus.HELD
        assert cluster.neutral_headline == "Editorial wording must survive seed"
        assert session.get(SourceFeed, feed_id).kill_switch
    with SessionLocal.begin() as session:
        session.get(SourceFeed, feed_id).kill_switch = old_kill_switch


def test_f01_runtime_image_does_not_seed_or_migrate():
    command = (Path(__file__).parents[1] / "Dockerfile").read_text().split("CMD ")[-1]
    assert "seed" not in command
    assert "alembic" not in command


@pytest.mark.parametrize(
    "url",
    [
        "http://example.test/doc",
        "https://user:secret@example.test/doc",
        "https://example.test\\@evil.test/doc",
        "javascript:alert(1)",
    ],
)
def test_f13_rejects_unsafe_editorial_links(url):
    with pytest.raises(ValidationError):
        PrimaryDocumentCreate(expected_version=1, title="Fixture document", issuer="Desk", url=url)


def test_f01_production_seed_refused(monkeypatch):
    from nuzenio_api.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    with pytest.raises(RuntimeError, match="Fixture seeding"):
        seed_database(SessionLocal)


def test_f01_high_risk_flags_without_current_review_are_never_public():
    from fastapi.testclient import TestClient

    from nuzenio_api.main import app
    from nuzenio_api.models import ReviewState, RiskLevel

    with SessionLocal.begin() as session:
        cluster = session.scalar(
            select(EventCluster).where(EventCluster.slug == "delhi-air-quality-response")
        )
        cluster.status = ContentStatus.PUBLISHED
        cluster.review_state = ReviewState.APPROVED
        cluster.risk_level = RiskLevel.HIGH
    client = TestClient(app)
    assert client.get("/v1/clusters/delhi-air-quality-response").status_code == 404
    for path in [
        "/v1/feed/top",
        "/v1/feed/local",
        "/v1/search?q=Delhi",
        "/v1/briefs/morning",
        "/v1/briefs/evening",
    ]:
        result = client.get(path)
        assert result.status_code == 200, result.text
        assert "delhi-air-quality-response" not in [item["slug"] for item in result.json()["items"]]


def test_f03_summary_and_suppression_real_requests():
    from nuzenio_api.models import RiskLevel, StaffRole, SummaryVersion
    from test_auth_editorial import login, make_staff

    user = make_staff(StaffRole.EDITOR)
    client, csrf = login(user)
    headers = {"X-CSRF-Token": csrf}
    with SessionLocal() as session:
        cluster = session.scalar(
            select(EventCluster).where(EventCluster.risk_level == RiskLevel.STANDARD)
        )
        cid, version = cluster.id, cluster.version
        summary = session.scalar(select(SummaryVersion).where(SummaryVersion.cluster_id == cid))
        sid, sv = summary.id, summary.row_version
    for suppressed in [True, False]:
        result = client.patch(
            f"/v1/admin/clusters/{cid}/suppression",
            headers=headers,
            json={"expectedVersion": version, "paused": suppressed, "reason": "Regression fixture"},
        )
        assert result.status_code == 200, result.text
        version += 1
    for decision in ["REJECTED", "APPROVED"]:
        result = client.post(
            f"/v1/admin/summaries/{sid}/decision",
            headers=headers,
            json={"expectedVersion": sv, "decision": decision, "notes": "Regression fixture"},
        )
        assert result.status_code == 200, result.text
        sv += 1


def test_f06_sentence_coverage_and_relational_evidence():
    from nuzenio_api.evidence import fixture_evidence, valid_evidence
    from nuzenio_api.models import Claim, ClaimEvidence, SummaryVersion

    with SessionLocal() as session:
        summary = session.scalar(select(SummaryVersion))
        ids = list(
            session.scalars(
                select(ClaimEvidence.id).join(Claim).where(Claim.cluster_id == summary.cluster_id)
            )
        )
        foreign = session.scalar(
            select(ClaimEvidence.id).join(Claim).where(Claim.cluster_id != summary.cluster_id)
        )
        summary.summary_text = "First sentence. Second sentence."
        for invalid in [
            {},
            {"sentences": []},
            fixture_evidence(summary.summary_text, [uuid.uuid4()]),
            fixture_evidence(summary.summary_text, [foreign]),
            fixture_evidence("First sentence.", ids),
        ]:
            summary.evidence_map = invalid
            assert not valid_evidence(session, summary)
        summary.evidence_map = fixture_evidence(summary.summary_text, ids)
        assert valid_evidence(session, summary)


def test_f06_sql_validator_rejects_null_sentence_and_foreign_document_evidence():
    from nuzenio_api.evidence import fixture_evidence, valid_evidence
    from nuzenio_api.models import Claim, ClaimEvidence, PrimaryDocument, SummaryVersion

    with SessionLocal() as session:
        summary = session.scalar(select(SummaryVersion))
        evidence = session.scalar(
            select(ClaimEvidence).join(Claim).where(Claim.cluster_id == summary.cluster_id)
        )
        summary.summary_text = "Fictional sentence."
        summary.evidence_map = {"sentences": [{"text": None, "evidence_ids": [str(evidence.id)]}]}
        session.flush()
        assert not session.scalar(select(func.nuzenio_summary_valid(summary.id)))
        summary.evidence_map = fixture_evidence(summary.summary_text, [evidence.id])
        other = session.scalar(
            select(PrimaryDocument).where(PrimaryDocument.cluster_id != summary.cluster_id)
        )
        evidence.primary_document_id = other.id
        evidence.article_id = None
        session.flush()
        assert not valid_evidence(session, summary)
        assert not session.scalar(select(func.nuzenio_summary_valid(summary.id)))


def test_f02_stale_repeated_and_concurrent_approval():
    from concurrent.futures import ThreadPoolExecutor

    from nuzenio_api.editorial import _queue_high_risk_review
    from nuzenio_api.models import EditorialReview, ReviewState, RiskLevel, StaffRole
    from test_auth_editorial import login, make_staff

    drafter = make_staff(StaffRole.ADMINISTRATOR)
    reviewer = make_staff(StaffRole.ADMINISTRATOR)
    third = make_staff(StaffRole.ADMINISTRATOR)
    with SessionLocal.begin() as session:
        cluster = EventCluster(
            slug=f"review-fence-{uuid.uuid4()}",
            neutral_headline="Review fixture",
            neutral_headline_hi="समीक्षा उदाहरण",
            category="Public safety",
            risk_level=RiskLevel.HIGH,
            status=ContentStatus.HELD,
            review_state=ReviewState.PENDING,
        )
        session.add(cluster)
        session.flush()
        review = _queue_high_risk_review(session, cluster, drafter.id, reason="Fixture draft")
        session.flush()
        cid, rid = cluster.id, review.id
    drafter_client, dc = login(drafter)
    body = {"expectedVersion": 1, "decision": "APPROVED", "notes": "Independent evidence review"}
    assert (
        drafter_client.post(
            f"/v1/admin/reviews/{rid}/decision", headers={"X-CSRF-Token": dc}, json=body
        ).status_code
        == 409
    )
    clients = [login(reviewer) for _ in range(2)]

    def approve(index):
        client, csrf = clients[index]
        return client.post(
            f"/v1/admin/reviews/{rid}/decision", headers={"X-CSRF-Token": csrf}, json=body
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(approve, range(2))) == [200, 409]
    with SessionLocal.begin() as session:
        cluster = session.get(EventCluster, cid)
        _queue_high_risk_review(session, cluster, drafter.id, reason="New material revision")
    client, csrf = login(reviewer)
    with SessionLocal() as session:
        version = session.get(EditorialReview, rid).version
    body["expectedVersion"] = version
    assert (
        client.post(
            f"/v1/admin/reviews/{rid}/decision", headers={"X-CSRF-Token": csrf}, json=body
        ).status_code
        == 409
    )
    client, csrf = login(third)
    assert (
        client.post(
            f"/v1/admin/reviews/{rid}/push-approval",
            headers={"X-CSRF-Token": csrf},
            json={"expectedVersion": version},
        ).status_code
        == 409
    )
