from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select, update
from sqlalchemy.exc import DBAPIError

from nuzenio_api.audit import append_audit, redact_sensitive
from nuzenio_api.auth import create_staff_user
from nuzenio_api.db import SessionLocal
from nuzenio_api.main import app
from nuzenio_api.models import (
    AuditLog,
    AuthenticationEvent,
    ContentStatus,
    EditorialReview,
    EventCluster,
    MaterialContributor,
    ReviewState,
    RiskLevel,
    StaffRole,
    StaffUser,
)

PASSWORD = "Valid-Staff-Password-42!"


def make_staff(role: StaffRole) -> StaffUser:
    with SessionLocal.begin() as session:
        user = create_staff_user(
            session,
            username=f"{role.value.lower()}-{uuid.uuid4()}",
            display_name=f"Fixture {role.value.title()}",
            password=PASSWORD,
            role=role,
        )
        user_id = user.id
    with SessionLocal() as session:
        return session.get(StaffUser, user_id)


def login(user: StaffUser) -> tuple[TestClient, str]:
    client = TestClient(app)
    response = client.post(
        "/v1/admin/auth/login", json={"username": user.username, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return client, response.json()["csrfToken"]


def test_argon2id_login_cookie_logout_and_auth_events() -> None:
    user = make_staff(StaffRole.EDITOR)
    assert user.password_hash.startswith("$argon2id$")
    assert PASSWORD not in user.password_hash
    client, csrf = login(user)
    login_response = client.post(
        "/v1/admin/auth/login", json={"username": user.username, "password": PASSWORD}
    )
    csrf = login_response.json()["csrfToken"]
    set_cookie = login_response.headers.get("set-cookie", "")
    assert set_cookie.count("HttpOnly") == 2
    assert set_cookie.count("SameSite=strict") == 2
    session_response = client.get("/v1/admin/auth/session")
    assert session_response.status_code == 200
    assert session_response.json()["role"] == "EDITOR"
    csrf = session_response.json()["csrfToken"]
    response = client.post("/v1/admin/auth/logout", headers={"X-CSRF-Token": csrf})
    assert response.status_code == 204
    assert client.get("/v1/admin/auth/session").status_code == 401
    with SessionLocal() as session:
        events = list(
            session.scalars(
                select(AuthenticationEvent).where(AuthenticationEvent.user_id == user.id)
            )
        )
        assert any(item.action == "LOGIN" and item.successful for item in events)
        assert any(item.action == "LOGOUT" and item.successful for item in events)


def test_login_errors_are_generic_for_known_and_unknown_accounts() -> None:
    user = make_staff(StaffRole.ANALYST)
    client = TestClient(app)
    known = client.post(
        "/v1/admin/auth/login", json={"username": user.username, "password": "wrong"}
    )
    unknown = client.post(
        "/v1/admin/auth/login",
        json={"username": f"missing-{uuid.uuid4()}", "password": "wrong"},
    )
    assert known.status_code == unknown.status_code == 401
    assert known.json()["error"]["message"] == unknown.json()["error"]["message"]


def test_login_rate_limit_temporarily_locks_the_subject() -> None:
    user = make_staff(StaffRole.ANALYST)
    client = TestClient(app)
    responses = [
        client.post(
            "/v1/admin/auth/login",
            json={"username": user.username, "password": "wrong"},
        )
        for _ in range(5)
    ]
    assert [response.status_code for response in responses] == [401, 401, 401, 401, 429]
    locked = client.post(
        "/v1/admin/auth/login",
        json={"username": user.username, "password": PASSWORD},
    )
    assert locked.status_code == 429
    assert locked.json()["error"]["code"] == "login_failed"


def test_administrator_can_revoke_another_users_sessions() -> None:
    administrator = make_staff(StaffRole.ADMINISTRATOR)
    target = make_staff(StaffRole.EDITOR)
    admin_client, admin_csrf = login(administrator)
    target_client, _ = login(target)
    response = admin_client.post(
        f"/v1/admin/staff/{target.id}/revoke-sessions",
        headers={"X-CSRF-Token": admin_csrf},
    )
    assert response.status_code == 200
    assert response.json()["revoked"] == 1
    assert target_client.get("/v1/admin/auth/session").status_code == 401


def test_staff_list_is_paginated_and_filterable() -> None:
    administrator = make_staff(StaffRole.ADMINISTRATOR)
    make_staff(StaffRole.EDITOR)
    client, _ = login(administrator)
    response = client.get(
        "/v1/admin/staff",
        params={"role": "EDITOR", "active": "true", "page_size": 1},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["pagination"]["pageSize"] == 1
    assert body["pagination"]["total"] >= 1
    assert all(item["role"] == "EDITOR" and item["active"] for item in body["items"])


def test_sensitive_audit_fields_are_recursively_redacted() -> None:
    assert redact_sensitive(
        {
            "password": "never-visible",
            "nested": {"csrfToken": "never-visible", "safe": "visible"},
            "items": [{"authorizationHeader": "never-visible"}],
        }
    ) == {
        "password": "[REDACTED]",
        "nested": {"csrfToken": "[REDACTED]", "safe": "visible"},
        "items": [{"authorizationHeader": "[REDACTED]"}],
    }


def test_admin_requires_auth_csrf_and_role_permission() -> None:
    assert TestClient(app).get("/v1/admin/publishers").status_code == 401
    analyst = make_staff(StaffRole.ANALYST)
    analyst_client, analyst_csrf = login(analyst)
    denied = analyst_client.post(
        "/v1/admin/publishers",
        headers={"X-CSRF-Token": analyst_csrf},
        json={
            "name": "Denied publisher",
            "slug": f"denied-{uuid.uuid4()}",
            "ownership": "Fixture",
            "contactName": "Desk",
            "contactEmail": "desk@example.test",
            "correctionRoute": "https://example.test/corrections",
        },
    )
    assert denied.status_code == 403
    editor = make_staff(StaffRole.EDITOR)
    editor_client, _ = login(editor)
    with SessionLocal() as session:
        cluster = session.scalar(select(EventCluster).limit(1))
    missing_csrf = editor_client.patch(
        f"/v1/admin/clusters/{cluster.id}/headline",
        json={
            "expectedVersion": cluster.version,
            "headline": "A valid neutral fixture headline",
            "headlineHi": "एक वैध निष्पक्ष परीक्षण शीर्षक",
        },
    )
    assert missing_csrf.status_code == 403
    assert missing_csrf.json()["error"]["code"] == "csrf_failed"


def test_optimistic_concurrency_conflict_is_clear() -> None:
    editor = make_staff(StaffRole.EDITOR)
    client, csrf = login(editor)
    with SessionLocal() as session:
        cluster = session.scalar(
            select(EventCluster).where(EventCluster.risk_level == RiskLevel.STANDARD)
        )
        cluster_id, version = cluster.id, cluster.version
    first = client.patch(
        f"/v1/admin/clusters/{cluster_id}/headline",
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": version,
            "headline": "Fixture headline changed by the first editor",
            "headlineHi": "पहले संपादक द्वारा बदला गया परीक्षण शीर्षक",
        },
    )
    assert first.status_code == 200, first.text
    conflict = client.patch(
        f"/v1/admin/clusters/{cluster_id}/headline",
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": version,
            "headline": "A stale competing headline change",
            "headlineHi": "एक पुराना प्रतिस्पर्धी शीर्षक परिवर्तन",
        },
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "version_conflict"


def test_high_risk_requires_independent_final_approval() -> None:
    drafter = make_staff(StaffRole.REVIEWER)
    approver = make_staff(StaffRole.REVIEWER)
    with SessionLocal.begin() as session:
        cluster = EventCluster(
            slug=f"high-risk-{uuid.uuid4()}",
            neutral_headline="Fictional high-risk review fixture",
            neutral_headline_hi="काल्पनिक उच्च जोखिम समीक्षा उदाहरण",
            category="Public safety",
            status=ContentStatus.HELD,
            risk_level=RiskLevel.HIGH,
            review_state=ReviewState.PENDING,
        )
        session.add(cluster)
        session.flush()
        review = EditorialReview(
            cluster_id=cluster.id,
            risk_level=RiskLevel.HIGH,
            risk_category="Public safety",
            reason="Fixture dual-control test",
            drafted_by_id=drafter.id,
            state=ReviewState.PENDING,
        )
        session.add(review)
        session.add(
            MaterialContributor(
                cluster_id=cluster.id,
                staff_user_id=drafter.id,
                first_material_revision=cluster.material_revision,
            )
        )
        session.flush()
        review_id = review.id
    drafter_client, drafter_csrf = login(drafter)
    denied = drafter_client.post(
        f"/v1/admin/reviews/{review_id}/decision",
        headers={"X-CSRF-Token": drafter_csrf},
        json={"expectedVersion": 1, "decision": "APPROVED", "notes": "I drafted it."},
    )
    assert denied.status_code == 409
    assert denied.json()["error"]["code"] == "dual_control_required"
    approver_client, approver_csrf = login(approver)
    approved = approver_client.post(
        f"/v1/admin/reviews/{review_id}/decision",
        headers={"X-CSRF-Token": approver_csrf},
        json={
            "expectedVersion": 1,
            "decision": "APPROVED",
            "notes": "Evidence and wording independently reviewed.",
        },
    )
    assert approved.status_code == 200, approved.text
    with SessionLocal() as session:
        cluster = session.scalar(
            select(EventCluster)
            .join(EditorialReview, EditorialReview.cluster_id == EventCluster.id)
            .where(EditorialReview.id == review_id)
        )
        assert cluster.status == ContentStatus.PUBLISHED
        assert cluster.review_state == ReviewState.APPROVED
        assert cluster.push_ready is False


def test_database_prevents_audit_update_and_delete() -> None:
    with SessionLocal.begin() as session:
        append_audit(
            session,
            actor=None,
            action="APPEND_ONLY_TEST",
            entity_type="Fixture",
            entity_id=None,
            request_id="audit-test",
        )
    with SessionLocal() as session, pytest.raises(DBAPIError):
        session.execute(
            update(AuditLog).where(AuditLog.action == "APPEND_ONLY_TEST").values(action="MUTATED")
        )
        session.commit()
    with SessionLocal() as session, pytest.raises(DBAPIError):
        session.execute(delete(AuditLog).where(AuditLog.action == "APPEND_ONLY_TEST"))
        session.commit()
