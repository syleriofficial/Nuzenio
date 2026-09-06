from __future__ import annotations

import csv
import io
import math
import secrets
import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from nuzenio_api.admin_schemas import (
    AdminEntityRead,
    AdminPage,
    AuditPage,
    AuditRead,
    ClaimUpdate,
    ClusterHeadlineUpdate,
    ClusterMergeApply,
    ClusterSplitApply,
    CorrectionApply,
    CorrectionCreate,
    CorrectionDraftUpdate,
    DomainCreate,
    DryRunResult,
    EditionPause,
    FeedCreate,
    FeedPause,
    LoginRequest,
    PrimaryDocumentCreate,
    PublisherCreate,
    ReviewDecision,
    RightsCreate,
    StaffSessionRead,
    StaffUserRead,
    StaffUserUpdate,
    StateTransition,
    SummaryDecision,
    SummaryRevisionCreate,
    VersionedMutation,
)
from nuzenio_api.audit import append_audit, redact_sensitive
from nuzenio_api.auth import (
    AuthenticatedStaff,
    AuthService,
    current_staff,
    hash_csrf_token,
    request_metadata,
    require_permission,
)
from nuzenio_api.config import get_settings
from nuzenio_api.csv_export import spreadsheet_cell
from nuzenio_api.db import get_db
from nuzenio_api.editorial import (
    apply_correction,
    approve_push,
    attach_document,
    create_correction,
    decide_high_risk_review,
    decide_summary,
    draft_summary_revision,
    edit_correction_draft,
    edit_headline,
    merge_clusters,
    review_queue,
    set_suppression,
    split_cluster,
    update_claim,
)
from nuzenio_api.feed_locks import control_lock
from nuzenio_api.feed_operations import RedisFeedQueue, create_feed_run, dispatch
from nuzenio_api.models import (
    AuditLog,
    Claim,
    Correction,
    DeadLetterJob,
    EditionControl,
    EventCluster,
    FeedControl,
    FeedRun,
    FeedRunState,
    PublisherDomain,
    RightsPolicy,
    SourceFeed,
    StaffRole,
    StaffUser,
)
from nuzenio_api.onboarding import (
    add_domain,
    add_feed,
    add_rights,
    approval_history,
    approval_snapshot,
    create_publisher,
    feed_dry_run,
    publisher_page,
    transition_domain,
    transition_feed,
    transition_publisher,
    transition_rights,
)
from nuzenio_api.permissions import Permission, permissions_for
from nuzenio_api.schemas import Pagination
from nuzenio_api.services import ApplicationError

router = APIRouter(prefix="/v1/admin", tags=["admin"])
SessionDep = Annotated[Session, Depends(get_db)]


def allowed(permission: Permission, *, csrf: bool = False):
    return Depends(require_permission(permission, csrf=csrf))


def _page(items: list[dict], total: int, page: int, page_size: int) -> AdminPage:
    return AdminPage(
        items=items,
        pagination=Pagination(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=math.ceil(total / page_size) if total else 0,
        ),
    )


def _entity(entity_type: str, item: object, data: dict, version: int) -> AdminEntityRead:
    return AdminEntityRead(id=item.id, entity_type=entity_type, version=version, data=data)


@router.post("/auth/login", response_model=StaffSessionRead)
def login(
    payload: LoginRequest, request: Request, response: Response, session: SessionDep
) -> StaffSessionRead:
    request_id, ip_address, user_agent = request_metadata(request)
    result = AuthService(session).login(
        username=payload.username,
        password=payload.password,
        request_id=request_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    settings = get_settings()
    cookie_options = {
        "secure": settings.cookie_secure,
        "samesite": "strict",
        "path": "/",
        "max_age": settings.session_ttl_minutes * 60,
    }
    response.set_cookie(
        settings.session_cookie_name,
        result.session_token,
        httponly=True,
        **cookie_options,
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        result.csrf_token,
        httponly=True,
        **cookie_options,
    )
    return StaffSessionRead(
        id=result.session.id,
        username=result.user.username,
        display_name=result.user.display_name,
        role=result.user.role.value,
        permissions=permissions_for(result.user.role),
        expires_at=result.session.expires_at,
        csrf_token=result.csrf_token,
    )


@router.get("/auth/session", response_model=StaffSessionRead)
def session_info(
    response: Response,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, Depends(current_staff)],
) -> StaffSessionRead:
    settings = get_settings()
    csrf_token = secrets.token_urlsafe(32)
    context.session.csrf_hash = hash_csrf_token(csrf_token)
    context.session.last_seen_at = datetime.now(UTC)
    session.commit()
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/",
        max_age=settings.session_ttl_minutes * 60,
    )
    return StaffSessionRead(
        id=context.session.id,
        username=context.user.username,
        display_name=context.user.display_name,
        role=context.user.role.value,
        permissions=context.permissions,
        expires_at=context.session.expires_at,
        csrf_token=csrf_token,
    )


@router.post("/auth/logout", status_code=204)
def logout(
    response: Response,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.REVIEW_READ, csrf=True)],
) -> None:
    AuthService(session).logout(context)
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")


@router.get("/staff", response_model=AdminPage)
def list_staff(
    session: SessionDep,
    _: Annotated[AuthenticatedStaff, allowed(Permission.STAFF_MANAGE)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    role: StaffRole | None = None,
    active: bool | None = None,
    q: Annotated[str | None, Query(min_length=1, max_length=120)] = None,
) -> AdminPage:
    statement = select(StaffUser)
    if role:
        statement = statement.where(StaffUser.role == role)
    if active is not None:
        statement = statement.where(StaffUser.active.is_(active))
    if q:
        pattern = f"%{q}%"
        statement = statement.where(
            or_(StaffUser.username.ilike(pattern), StaffUser.display_name.ilike(pattern))
        )
    total = int(session.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    users = list(
        session.scalars(
            statement.order_by(StaffUser.username).offset((page - 1) * page_size).limit(page_size)
        )
    )
    return _page(
        [
            StaffUserRead(
                id=user.id,
                username=user.username,
                display_name=user.display_name,
                role=user.role.value,
                active=user.active,
                version=user.version,
                last_login_at=user.last_login_at,
            ).model_dump(mode="json", by_alias=True)
            for user in users
        ],
        total,
        page,
        page_size,
    )


@router.patch("/staff/{user_id}", response_model=StaffUserRead)
def update_staff_user(
    user_id: uuid.UUID,
    payload: StaffUserUpdate,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.STAFF_MANAGE, csrf=True)],
) -> StaffUserRead:
    user = session.scalar(select(StaffUser).where(StaffUser.id == user_id).with_for_update())
    if not user:
        raise ApplicationError(code="staff_not_found", message="Staff user not found.", status=404)
    if user.version != payload.expected_version:
        raise ApplicationError(
            code="version_conflict", message="Staff user changed since it was loaded.", status=409
        )
    if user.id == context.user.id and payload.active is False:
        raise ApplicationError(
            code="cannot_disable_self", message="You cannot disable your own account.", status=409
        )
    before = {"role": user.role.value, "active": user.active, "version": user.version}
    if payload.role:
        user.role = StaffRole(payload.role)
    if payload.active is not None:
        user.active = payload.active
    user.version += 1
    revoked = 0
    if payload.active is False or payload.role:
        revoked = AuthService(session).revoke_user_sessions(
            user.id, except_session_id=context.session.id if user.id == context.user.id else None
        )
    append_audit(
        session,
        actor=context.user,
        action="STAFF_USER_UPDATED",
        entity_type="StaffUser",
        entity_id=user.id,
        before=before,
        after={"role": user.role.value, "active": user.active, "version": user.version},
        details={"revoked_sessions": revoked},
        request_id=context.request_id,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )
    session.commit()
    session.refresh(user)
    return StaffUserRead(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role.value,
        active=user.active,
        version=user.version,
        last_login_at=user.last_login_at,
    )


@router.post("/staff/{user_id}/revoke-sessions", response_model=dict)
def revoke_sessions(
    user_id: uuid.UUID,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.STAFF_MANAGE, csrf=True)],
) -> dict:
    if not session.get(StaffUser, user_id):
        raise ApplicationError(code="staff_not_found", message="Staff user not found.", status=404)
    count = AuthService(session).revoke_user_sessions(user_id)
    append_audit(
        session,
        actor=context.user,
        action="STAFF_SESSIONS_REVOKED",
        entity_type="StaffUser",
        entity_id=user_id,
        details={"count": count},
        request_id=context.request_id,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )
    session.commit()
    return {"revoked": count}


@router.get("/review-queue", response_model=AdminPage)
def get_review_queue(
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.REVIEW_READ)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminPage:
    items, total = review_queue(session, page=page, page_size=page_size, viewer_id=context.user.id)
    return _page(items, total, page, page_size)


@router.get("/clusters", response_model=AdminPage)
def list_clusters(
    session: SessionDep,
    _: Annotated[AuthenticatedStaff, allowed(Permission.REVIEW_READ)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status: str | None = None,
    risk_level: str | None = None,
    review_state: str | None = None,
    q: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
) -> AdminPage:
    statement = select(EventCluster).options(
        selectinload(EventCluster.articles),
        selectinload(EventCluster.claims).selectinload(Claim.evidence),
        selectinload(EventCluster.summaries),
        selectinload(EventCluster.primary_documents),
    )
    if status:
        statement = statement.where(EventCluster.status == status.upper())
    if risk_level:
        statement = statement.where(EventCluster.risk_level == risk_level.upper())
    if review_state:
        statement = statement.where(EventCluster.review_state == review_state.upper())
    if q:
        pattern = f"%{q}%"
        statement = statement.where(
            or_(
                EventCluster.neutral_headline.ilike(pattern),
                EventCluster.neutral_headline_hi.ilike(pattern),
                EventCluster.slug.ilike(pattern),
            )
        )
    total = int(session.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    statement = statement.order_by(EventCluster.updated_at.desc())
    rows = list(session.scalars(statement.offset((page - 1) * page_size).limit(page_size)))
    return _page(
        [
            {
                "id": str(item.id),
                "slug": item.slug,
                "headline": item.neutral_headline,
                "headlineHi": item.neutral_headline_hi,
                "status": item.status.value,
                "riskLevel": item.risk_level.value,
                "reviewState": item.review_state.value,
                "version": item.version,
                "articleIds": [str(membership.article_id) for membership in item.articles],
                "claims": [
                    {
                        "id": str(claim.id),
                        "text": claim.text,
                        "textHi": claim.text_hi,
                        "state": claim.state.value,
                        "version": claim.version,
                        "evidenceIds": [str(evidence.id) for evidence in claim.evidence],
                    }
                    for claim in item.claims
                ],
                "summaries": [
                    {
                        "id": str(summary.id),
                        "language": summary.language,
                        "text": summary.summary_text,
                        "decision": summary.decision.value,
                        "invalidatedAt": summary.invalidated_at,
                        "invalidationReason": summary.invalidation_reason,
                        "version": summary.row_version,
                        "evidenceCount": len(summary.evidence_map.get("sentences", [])),
                    }
                    for summary in item.summaries
                ],
                "primaryDocuments": [
                    {"id": str(document.id), "title": document.title}
                    for document in item.primary_documents
                ],
            }
            for item in rows
        ],
        total,
        page,
        page_size,
    )


@router.patch("/clusters/{cluster_id}/headline", response_model=AdminEntityRead)
def headline(
    cluster_id: uuid.UUID,
    payload: ClusterHeadlineUpdate,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.CLUSTER_EDIT, csrf=True)],
) -> AdminEntityRead:
    item = edit_headline(session, cluster_id=cluster_id, payload=payload, context=context)
    return _entity(
        "EventCluster",
        item,
        {
            "headline": item.neutral_headline,
            "headlineHi": item.neutral_headline_hi,
            "status": item.status.value,
        },
        item.version,
    )


@router.patch("/clusters/{cluster_id}/suppression", response_model=AdminEntityRead)
def suppression(
    cluster_id: uuid.UUID,
    payload: FeedPause,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.CLUSTER_EDIT, csrf=True)],
) -> AdminEntityRead:
    item = set_suppression(
        session,
        cluster_id=cluster_id,
        expected_version=payload.expected_version,
        suppressed=payload.paused,
        reason=payload.reason,
        context=context,
    )
    return _entity(
        "EventCluster",
        item,
        {"status": item.status.value, "suppressionReason": item.suppression_reason},
        item.version,
    )


@router.post("/clusters/merge", response_model=AdminEntityRead)
def merge(
    payload: ClusterMergeApply,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.CLUSTER_EDIT, csrf=True)],
) -> AdminEntityRead:
    item = merge_clusters(session, payload, context)
    return _entity(
        "EventCluster", item, {"slug": item.slug, "status": item.status.value}, item.version
    )


@router.post("/clusters/{cluster_id}/split", response_model=list[AdminEntityRead])
def split(
    cluster_id: uuid.UUID,
    payload: ClusterSplitApply,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.CLUSTER_EDIT, csrf=True)],
) -> list[AdminEntityRead]:
    return [
        _entity(
            "EventCluster", item, {"slug": item.slug, "status": item.status.value}, item.version
        )
        for item in split_cluster(session, cluster_id=cluster_id, payload=payload, context=context)
    ]


@router.patch("/claims/{claim_id}", response_model=AdminEntityRead)
def claim_edit(
    claim_id: uuid.UUID,
    payload: ClaimUpdate,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.CLAIM_EDIT, csrf=True)],
) -> AdminEntityRead:
    item = update_claim(session, claim_id=claim_id, payload=payload, context=context)
    return _entity(
        "Claim",
        item,
        {"text": item.text, "textHi": item.text_hi, "state": item.state.value},
        item.version,
    )


@router.post("/summaries/{summary_id}/decision", response_model=AdminEntityRead)
def summary_decision(
    summary_id: uuid.UUID,
    payload: SummaryDecision,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.SUMMARY_REVIEW, csrf=True)],
) -> AdminEntityRead:
    item = decide_summary(session, summary_id=summary_id, payload=payload, context=context)
    return _entity(
        "SummaryVersion",
        item,
        {"decision": item.decision.value, "reviewedAt": item.reviewed_at},
        item.row_version,
    )


@router.post("/reviews/{review_id}/decision", response_model=AdminEntityRead)
def review_decision(
    review_id: uuid.UUID,
    payload: ReviewDecision,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.HIGH_RISK_APPROVE, csrf=True)],
) -> AdminEntityRead:
    item = decide_high_risk_review(session, review_id=review_id, payload=payload, context=context)
    return _entity(
        "EditorialReview",
        item,
        {"decision": item.decision.value, "notes": item.notes},
        item.version,
    )


@router.post("/reviews/{review_id}/push-approval", response_model=AdminEntityRead)
def review_push_approval(
    review_id: uuid.UUID,
    payload: VersionedMutation,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.HIGH_RISK_APPROVE, csrf=True)],
) -> AdminEntityRead:
    item = approve_push(
        session,
        review_id=review_id,
        expected_version=payload.expected_version,
        context=context,
    )
    return _entity("EditorialReview", item, {"pushApprovedAt": item.push_approved_at}, item.version)


@router.post("/clusters/{cluster_id}/primary-documents", response_model=AdminEntityRead)
def primary_document(
    cluster_id: uuid.UUID,
    payload: PrimaryDocumentCreate,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.CLUSTER_EDIT, csrf=True)],
) -> AdminEntityRead:
    item = attach_document(session, cluster_id=cluster_id, payload=payload, context=context)
    return _entity("PrimaryDocument", item, {"title": item.title, "url": item.url}, item.version)


@router.get("/corrections", response_model=AdminPage)
def corrections(
    session: SessionDep,
    _: Annotated[AuthenticatedStaff, allowed(Permission.CORRECTION_MANAGE)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status: str | None = None,
) -> AdminPage:
    statement = select(Correction).order_by(Correction.raised_at.desc())
    if status:
        statement = statement.where(Correction.status == status.upper())
    total = int(session.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    rows = list(session.scalars(statement.offset((page - 1) * page_size).limit(page_size)))
    return _page(
        [
            {
                "id": str(item.id),
                "description": item.description,
                "status": item.status,
                "clusterId": str(item.cluster_id) if item.cluster_id else None,
                "version": item.version,
                "raisedAt": item.raised_at.isoformat(),
            }
            for item in rows
        ],
        total,
        page,
        page_size,
    )


@router.post("/corrections", response_model=AdminEntityRead)
def correction_open(
    payload: CorrectionCreate,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.CORRECTION_MANAGE, csrf=True)],
) -> AdminEntityRead:
    item = create_correction(session, payload, context)
    return _entity(
        "Correction", item, {"description": item.description, "status": item.status}, item.version
    )


@router.post("/corrections/{correction_id}/apply", response_model=AdminEntityRead)
def correction_apply(
    correction_id: uuid.UUID,
    payload: CorrectionApply,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.CORRECTION_MANAGE, csrf=True)],
) -> AdminEntityRead:
    item = apply_correction(session, correction_id=correction_id, payload=payload, context=context)
    turnaround = (item.resolved_at - item.raised_at).total_seconds() if item.resolved_at else None
    return _entity(
        "Correction",
        item,
        {"status": item.status, "resolution": item.resolution, "turnaroundSeconds": turnaround},
        item.version,
    )


@router.patch("/corrections/{correction_id}", response_model=AdminEntityRead)
def correction_draft_edit(
    correction_id: uuid.UUID,
    payload: CorrectionDraftUpdate,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.CORRECTION_MANAGE, csrf=True)],
) -> AdminEntityRead:
    item = edit_correction_draft(
        session, correction_id=correction_id, payload=payload, context=context
    )
    return _entity(
        "Correction", item, {"description": item.description, "status": item.status}, item.version
    )


@router.get("/publishers", response_model=AdminPage)
def publishers(
    session: SessionDep,
    _: Annotated[AuthenticatedStaff, allowed(Permission.PUBLISHER_MANAGE)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    state: str | None = None,
) -> AdminPage:
    items, total = publisher_page(session, page=page, page_size=page_size, state=state)
    return _page(items, total, page, page_size)


@router.post("/publishers", response_model=AdminEntityRead)
def publisher_create(
    payload: PublisherCreate,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.PUBLISHER_MANAGE, csrf=True)],
) -> AdminEntityRead:
    item = create_publisher(session, payload, context)
    return _entity(
        "PublisherOrganization",
        item,
        {"name": item.name, "state": item.onboarding_state.value},
        item.version,
    )


@router.post("/publishers/{publisher_id}/transition", response_model=AdminEntityRead)
def publisher_transition(
    publisher_id: uuid.UUID,
    payload: StateTransition,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.PUBLISHER_MANAGE, csrf=True)],
) -> AdminEntityRead:
    item = transition_publisher(
        session, publisher_id=publisher_id, payload=payload, context=context
    )
    return _entity(
        "PublisherOrganization", item, {"state": item.onboarding_state.value}, item.version
    )


@router.post("/publishers/{publisher_id}/domains", response_model=AdminEntityRead)
def domain_create(
    publisher_id: uuid.UUID,
    payload: DomainCreate,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.PUBLISHER_MANAGE, csrf=True)],
) -> AdminEntityRead:
    item = add_domain(session, publisher_id=publisher_id, payload=payload, context=context)
    return _entity(
        "PublisherDomain",
        item,
        {"domain": item.domain, "state": item.onboarding_state.value},
        item.version,
    )


@router.post("/domains/{domain_id}/transition", response_model=AdminEntityRead)
def domain_transition(
    domain_id: uuid.UUID,
    payload: StateTransition,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.RIGHTS_REVIEW, csrf=True)],
) -> AdminEntityRead:
    item = transition_domain(session, domain_id=domain_id, payload=payload, context=context)
    return _entity(
        "PublisherDomain",
        item,
        {"domain": item.domain, "state": item.onboarding_state.value, "verified": item.verified},
        item.version,
    )


@router.post("/publishers/{publisher_id}/rights", response_model=AdminEntityRead)
def rights_create(
    publisher_id: uuid.UUID,
    payload: RightsCreate,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.PUBLISHER_MANAGE, csrf=True)],
) -> AdminEntityRead:
    item = add_rights(session, publisher_id=publisher_id, payload=payload, context=context)
    return _entity(
        "RightsPolicy",
        item,
        {
            "name": item.policy_name,
            "state": item.onboarding_state.value,
            "fullTextDisplay": item.may_display_full_text,
        },
        item.version,
    )


@router.post("/rights/{rights_id}/transition", response_model=AdminEntityRead)
def rights_transition(
    rights_id: uuid.UUID,
    payload: StateTransition,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.RIGHTS_REVIEW, csrf=True)],
) -> AdminEntityRead:
    item = transition_rights(session, rights_id=rights_id, payload=payload, context=context)
    return _entity("RightsPolicy", item, {"state": item.onboarding_state.value}, item.version)


@router.post("/publishers/{publisher_id}/feeds", response_model=AdminEntityRead)
def feed_create(
    publisher_id: uuid.UUID,
    payload: FeedCreate,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.PUBLISHER_MANAGE, csrf=True)],
) -> AdminEntityRead:
    item = add_feed(session, publisher_id=publisher_id, payload=payload, context=context)
    return _entity(
        "SourceFeed",
        item,
        {"name": item.name, "url": item.url, "state": item.onboarding_state.value},
        item.version,
    )


@router.post("/feeds/{feed_id}/transition", response_model=AdminEntityRead)
def feed_transition(
    feed_id: uuid.UUID,
    payload: StateTransition,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.RIGHTS_REVIEW, csrf=True)],
) -> AdminEntityRead:
    item = transition_feed(session, feed_id=feed_id, payload=payload, context=context)
    return _entity(
        "SourceFeed",
        item,
        {"state": item.onboarding_state.value, "approved": item.approved},
        item.version,
    )


@router.post("/feeds/{feed_id}/dry-run", response_model=DryRunResult)
def dry_run(
    feed_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[AuthenticatedStaff, allowed(Permission.FEED_OPERATE, csrf=True)],
) -> DryRunResult:
    return DryRunResult(**feed_dry_run(session, feed_id))


@router.post("/feeds/{feed_id}/run", response_model=AdminEntityRead)
def run_feed(
    feed_id: uuid.UUID,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.FEED_OPERATE, csrf=True)],
) -> AdminEntityRead:
    feed = session.get(SourceFeed, feed_id)
    if not feed:
        raise ApplicationError(code="feed_not_found", message="Feed not found.", status=404)
    run = create_feed_run(
        session, feed=feed, request_id=context.request_id, manual_actor_id=context.user.id
    )
    append_audit(
        session,
        actor=context.user,
        action="FEED_RUN_QUEUED",
        entity_type="FeedRun",
        entity_id=run.id,
        request_id=context.request_id,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )
    session.commit()
    dispatch(RedisFeedQueue(), run)
    return _entity(
        "FeedRun", run, {"feedId": str(run.feed_id), "state": run.state.value}, run.attempt
    )


@router.patch("/feeds/{feed_id}/pause", response_model=AdminEntityRead)
def pause_feed(
    feed_id: uuid.UUID,
    payload: FeedPause,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.FEED_OPERATE, csrf=True)],
) -> AdminEntityRead:
    feed = session.get(SourceFeed, feed_id)
    if not feed:
        raise ApplicationError(code="feed_not_found", message="Feed not found.", status=404)
    desired = "PAUSED" if payload.paused else "APPROVED"
    item = transition_feed(
        session,
        feed_id=feed_id,
        payload=StateTransition(
            expected_version=payload.expected_version, state=desired, notes=payload.reason
        ),
        context=context,
    )
    return _entity(
        "SourceFeed",
        item,
        {"state": item.onboarding_state.value, "pausedReason": item.paused_reason},
        item.version,
    )


@router.post("/feed-runs/{run_id}/retry", response_model=AdminEntityRead)
def retry_feed_run(
    run_id: uuid.UUID,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.FEED_OPERATE, csrf=True)],
) -> AdminEntityRead:
    control_lock(session)
    session.expire_all()
    old = session.scalar(select(FeedRun).where(FeedRun.id == run_id).with_for_update())
    if not old:
        raise ApplicationError(code="feed_run_not_found", message="Feed run not found.", status=404)
    feed = session.get(SourceFeed, old.feed_id)
    if not feed:
        raise ApplicationError(code="feed_not_found", message="Feed not found.", status=404)
    dead_letter = session.scalar(
        select(DeadLetterJob).where(DeadLetterJob.feed_run_id == old.id).with_for_update()
    )
    if old.state != FeedRunState.DEAD_LETTERED or not dead_letter or dead_letter.retried_at:
        raise ApplicationError(
            code="retry_conflict",
            message="Only an unreplayed dead-letter run can be retried.",
            status=409,
        )
    run = create_feed_run(
        session, feed=feed, request_id=context.request_id, manual_actor_id=context.user.id
    )
    dead_letter.retried_at = datetime.now(UTC)
    append_audit(
        session,
        actor=context.user,
        action="FEED_RUN_RETRIED",
        entity_type="FeedRun",
        entity_id=run.id,
        approval_of_id=old.id,
        request_id=context.request_id,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )
    session.commit()
    dispatch(RedisFeedQueue(), run)
    return _entity(
        "FeedRun", run, {"feedId": str(run.feed_id), "state": run.state.value}, run.attempt
    )


@router.get("/feed-runs", response_model=AdminPage)
def feed_runs(
    session: SessionDep,
    _: Annotated[AuthenticatedStaff, allowed(Permission.FEED_OPERATE)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    state: str | None = None,
    feed_id: uuid.UUID | None = None,
) -> AdminPage:
    statement = select(FeedRun)
    if state:
        statement = statement.where(FeedRun.state == state.upper())
    if feed_id:
        statement = statement.where(FeedRun.feed_id == feed_id)
    total = int(session.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    rows = list(
        session.scalars(
            statement.order_by(FeedRun.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return _page(
        [
            {
                "id": str(item.id),
                "feedId": str(item.feed_id),
                "state": item.state.value,
                "attempt": item.attempt,
                "httpStatus": item.http_status,
                "fetchedBytes": item.fetched_bytes,
                "parsedItems": item.parsed_items,
                "newArticles": item.new_articles,
                "durationMs": item.duration_ms,
                "errorCode": item.error_code,
                "createdAt": item.created_at.isoformat(),
            }
            for item in rows
        ],
        total,
        page,
        page_size,
    )


@router.get("/editions/{edition}", response_model=AdminEntityRead)
def edition_status(
    edition: str,
    session: SessionDep,
    _: Annotated[AuthenticatedStaff, allowed(Permission.EDITION_PAUSE)],
) -> AdminEntityRead:
    control = session.scalar(select(EditionControl).where(EditionControl.edition == edition))
    if not control:
        raise ApplicationError(
            code="edition_not_found", message="Edition control not found.", status=404
        )
    return _entity(
        "EditionControl",
        control,
        {"edition": control.edition, "paused": control.paused, "reason": control.reason},
        control.version,
    )


@router.patch("/editions/{edition}", response_model=AdminEntityRead)
def edition_pause(
    edition: str,
    payload: EditionPause,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.EDITION_PAUSE, csrf=True)],
) -> AdminEntityRead:
    control = session.scalar(
        select(EditionControl).where(EditionControl.edition == edition).with_for_update()
    )
    if control is None:
        if payload.expected_version != 1:
            raise ApplicationError(
                code="version_conflict", message="Edition state changed.", status=409
            )
        control = EditionControl(edition=edition, version=1)
        session.add(control)
        session.flush()
    elif control.version != payload.expected_version:
        raise ApplicationError(
            code="version_conflict", message="Edition state changed.", status=409
        )
    before = {"paused": control.paused, "version": control.version}
    control.paused = payload.paused
    control.reason = payload.reason
    control.version += 1
    append_audit(
        session,
        actor=context.user,
        action="EDITION_PAUSED" if payload.paused else "EDITION_RESTORED",
        entity_type="EditionControl",
        entity_id=control.id,
        before=before,
        after={"paused": control.paused, "version": control.version},
        reason=payload.reason,
        request_id=context.request_id,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )
    session.commit()
    session.refresh(control)
    return _entity(
        "EditionControl",
        control,
        {"edition": control.edition, "paused": control.paused, "reason": control.reason},
        control.version,
    )


def _audit_query(
    *,
    action: str | None,
    entity_type: str | None,
    actor_id: uuid.UUID | None,
    request_id: str | None,
    outcome: str | None,
):
    statement = select(AuditLog)
    if action:
        statement = statement.where(AuditLog.action == action)
    if entity_type:
        statement = statement.where(AuditLog.entity_type == entity_type)
    if actor_id:
        statement = statement.where(AuditLog.actor_id == actor_id)
    if request_id:
        statement = statement.where(AuditLog.request_id == request_id)
    if outcome:
        statement = statement.where(AuditLog.outcome == outcome)
    return statement


def _audit_read(item: AuditLog) -> AuditRead:
    return AuditRead(
        id=item.id,
        actor_id=item.actor_id,
        actor_role=item.actor_role,
        action=item.action,
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        before_summary=redact_sensitive(item.before_summary),
        after_summary=redact_sensitive(item.after_summary),
        details=redact_sensitive(item.details),
        request_id=item.request_id,
        ip_address=item.ip_address,
        user_agent=item.user_agent,
        approval_of_id=item.approval_of_id,
        outcome=item.outcome,
        reason=item.reason,
        created_at=item.created_at,
    )


@router.get("/audit", response_model=AuditPage)
def audit_search(
    session: SessionDep,
    _: Annotated[AuthenticatedStaff, allowed(Permission.AUDIT_READ)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    action: str | None = None,
    entity_type: str | None = None,
    actor_id: uuid.UUID | None = None,
    request_id: str | None = None,
    outcome: str | None = None,
) -> AuditPage:
    statement = _audit_query(
        action=action,
        entity_type=entity_type,
        actor_id=actor_id,
        request_id=request_id,
        outcome=outcome,
    )
    total = int(session.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    rows = list(
        session.scalars(
            statement.order_by(AuditLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return AuditPage(
        items=[_audit_read(item) for item in rows],
        pagination=Pagination(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=math.ceil(total / page_size) if total else 0,
        ),
    )


@router.get("/audit/export")
def audit_export(
    session: SessionDep,
    _: Annotated[AuthenticatedStaff, allowed(Permission.AUDIT_EXPORT)],
    format: Literal["csv", "json"] = "csv",
    action: str | None = None,
    entity_type: str | None = None,
    actor_id: uuid.UUID | None = None,
    request_id: str | None = None,
    outcome: str | None = None,
) -> Response:
    rows = list(
        session.scalars(
            _audit_query(
                action=action,
                entity_type=entity_type,
                actor_id=actor_id,
                request_id=request_id,
                outcome=outcome,
            )
            .order_by(AuditLog.created_at.desc())
            .limit(10000)
        )
    )
    values = [_audit_read(item).model_dump(mode="json", by_alias=True) for item in rows]
    headers = {"Content-Disposition": f'attachment; filename="nuzenio-audit.{format}"'}
    if format == "json":
        return JSONResponse(values, headers=headers)
    output = io.StringIO()
    fieldnames = [
        "id",
        "createdAt",
        "actorId",
        "actorRole",
        "action",
        "entityType",
        "entityId",
        "requestId",
        "ipAddress",
        "userAgent",
        "outcome",
        "reason",
        "approvalOfId",
        "details",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for value in values:
        value["details"] = str(value.get("details", {}))
        writer.writerow({key: spreadsheet_cell(item) for key, item in value.items()})
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)


@router.post("/summaries/{summary_id}/revisions", response_model=AdminEntityRead)
def create_summary_revision(
    summary_id: uuid.UUID,
    payload: SummaryRevisionCreate,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.SUMMARY_REVIEW, csrf=True)],
):
    item = draft_summary_revision(session, summary_id, payload, context)
    return _entity("SummaryVersion", item, {"decision": item.decision.value}, item.row_version)


@router.get("/rights/{record_id}/snapshot")
def rights_snapshot(
    record_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[AuthenticatedStaff, allowed(Permission.RIGHTS_REVIEW)],
):
    record = session.get(RightsPolicy, record_id)
    if not record:
        raise ApplicationError(code="rights_not_found", message="Rights not found.", status=404)
    return {**approval_snapshot(record), "reviewHistory": approval_history(session, record)}


@router.get("/domains/{record_id}/snapshot")
def domain_snapshot(
    record_id: uuid.UUID,
    session: SessionDep,
    _: Annotated[AuthenticatedStaff, allowed(Permission.RIGHTS_REVIEW)],
):
    record = session.get(PublisherDomain, record_id)
    if not record:
        raise ApplicationError(code="domain_not_found", message="Domain not found.", status=404)
    return {**approval_snapshot(record), "reviewHistory": approval_history(session, record)}


@router.get("/feed-control")
def read_feed_control(
    session: SessionDep, _: Annotated[AuthenticatedStaff, allowed(Permission.FEED_OPERATE)]
):
    item = session.get(FeedControl, 1)
    return {"paused": item.paused, "version": item.version}


@router.patch("/feed-control")
def change_feed_control(
    payload: EditionPause,
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, allowed(Permission.EDITION_PAUSE, csrf=True)],
):
    control_lock(session)
    item = session.scalar(select(FeedControl).where(FeedControl.id == 1).with_for_update())
    if payload.expected_version != item.version:
        raise ApplicationError(
            code="version_conflict", message="Reload the feed control.", status=409
        )
    before = {"paused": item.paused, "version": item.version}
    item.paused = payload.paused
    item.version += 1
    append_audit(
        session,
        actor=context.user,
        action="GLOBAL_FEED_CONTROL",
        entity_type="FeedControl",
        entity_id=None,
        request_id=context.request_id,
        before=before,
        after={"paused": item.paused, "version": item.version},
        reason=payload.reason,
    )
    session.commit()
    return {"paused": item.paused, "version": item.version}
