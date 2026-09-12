"""Offline, fixture-only article -> private draft workflow. Never fetches or publishes."""

from __future__ import annotations

import hashlib
import json
import math
import uuid
from typing import Annotated, Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Query
from pydantic import ConfigDict, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from nuzenio_api.audit import append_audit
from nuzenio_api.auth import AuthenticatedStaff, require_permission
from nuzenio_api.config import get_settings
from nuzenio_api.db import get_db
from nuzenio_api.editorial import _queue_high_risk_review
from nuzenio_api.environment import Environment
from nuzenio_api.feed_locks import locked_feed
from nuzenio_api.feed_operations import rights_issues
from nuzenio_api.links import validate_external_link
from nuzenio_api.models import (
    Article,
    ArticleDraftAssignment,
    Claim,
    ClusterArticle,
    ContentStatus,
    Correction,
    DraftWorkspace,
    EditorialReview,
    EventCluster,
    FeedControl,
    PrimaryDocument,
    PublisherDomain,
    ReviewState,
    RiskLevel,
    SourceFeed,
    SummaryVersion,
)
from nuzenio_api.permissions import Permission
from nuzenio_api.provenance import register_contributors
from nuzenio_api.schemas import APIModel, Pagination
from nuzenio_api.services import ApplicationError

router = APIRouter(prefix="/v1/admin", tags=["fixture draft inbox"])
SessionDep = Annotated[Session, Depends(get_db)]


def fail(code: str, message: str, status: int = 409):
    raise ApplicationError(code=code, message=message, status=status)


def require_fixture_mode() -> None:
    settings = get_settings()
    if not (
        settings.draft_inbox_enabled
        and settings.environment in {Environment.DEVELOPMENT, Environment.TEST}
        and settings.demo_mode
        and settings.feed_kill_switch
    ):
        fail(
            "draft_inbox_disabled",
            "Enable the offline fixture inbox explicitly; live ingestion stays disabled.",
            403,
        )


def fixture_host(url: str) -> str | None:
    try:
        validate_external_link(url)
        parsed = urlsplit(url)
        host = parsed.hostname or ""
        if host.endswith(".example") and parsed.port in {None, 443}:
            return host
    except (ValueError, TypeError):
        pass
    return None


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def approval_snapshot(session: Session, feed: SourceFeed) -> dict:
    domain = session.get(PublisherDomain, feed.domain_id) if feed.domain_id else None
    control = session.get(FeedControl, 1)
    rights = feed.rights_policy
    return {
        "feed": [
            str(feed.id),
            feed.version,
            feed.approved,
            feed.onboarding_state,
            feed.kill_switch,
            digest(feed.url),
        ],
        "publisher": [
            str(feed.organization_id),
            feed.organization.version,
            feed.organization.active,
            feed.organization.onboarding_state,
        ],
        "domain": [
            str(domain.id),
            domain.domain,
            domain.version,
            domain.verified,
            domain.onboarding_state,
        ]
        if domain
        else None,
        "rights": [
            str(rights.id),
            rights.version,
            rights.onboarding_state,
            rights.effective_at,
            rights.expires_at,
            rights.revoked_at,
            rights.may_use_headline,
            rights.may_store_excerpt,
            rights.may_summarize,
            rights.may_display_full_text,
        ],
        "control": [control.version, control.paused] if control else None,
    }


def blocked_reasons(session: Session, article: Article, feed: SourceFeed) -> list[str]:
    # Only the global NETWORK switch is exempt for already-stored offline fixtures.
    # Persistent/editorial pause, per-feed pause, rights and all approvals still apply.
    reasons = [item for item in rights_issues(session, feed) if item != "global_feed_kill_switch"]
    domain = session.get(PublisherDomain, feed.domain_id) if feed.domain_id else None
    article_host = fixture_host(article.canonical_url)
    if (
        not article_host
        or fixture_host(feed.url) != article_host
        or not domain
        or article_host != domain.domain
    ):
        reasons.append("reserved_fixture_domain_required")
    if article.publisher_organization_id != feed.organization_id:
        reasons.append("article_organization_mismatch")
    if article.status != ContentStatus.INGESTED:
        reasons.append("article_not_ingested")
    if article.language not in {"en", "hi"} or not article.title.strip():
        reasons.append("unsupported_source_text")
    if session.scalar(select(Correction.id).where(Correction.article_id == article.id).limit(1)):
        reasons.append("corrected_article_requires_editorial_workflow")
    return reasons


def target_blockers(
    session: Session, cluster: EventCluster, workspace: DraftWorkspace | None
) -> list[str]:
    if (
        workspace is None
        or cluster.status != ContentStatus.HELD
        or cluster.review_state != ReviewState.PENDING
        or cluster.risk_level != RiskLevel.HIGH
        or cluster.suppressed_at
        or cluster.push_ready
        or not cluster.provenance_complete
        or workspace.assignment_revision != cluster.material_revision
    ):
        return ["target_requires_editorial_workflow"]
    for model in (Claim, SummaryVersion, PrimaryDocument, Correction):
        if session.scalar(select(model.id).where(model.cluster_id == cluster.id).limit(1)):
            return ["target_has_editorial_material"]
    if session.scalar(
        select(EditorialReview.id)
        .where(
            EditorialReview.cluster_id == cluster.id,
            EditorialReview.state != ReviewState.PENDING,
        )
        .limit(1)
    ):
        return ["target_has_review_decision"]
    return []


class AssignmentRequest(APIModel):
    model_config = ConfigDict(extra="forbid")
    operation_id: uuid.UUID
    expected_article_version: int = Field(strict=True, ge=1)
    approval_token: str = Field(strict=True, pattern=r"^[a-f0-9]{64}$")
    target_cluster_id: uuid.UUID | None = None
    expected_cluster_version: int | None = Field(default=None, strict=True, ge=1)

    @model_validator(mode="after")
    def paired_target(self):
        if (self.target_cluster_id is None) != (self.expected_cluster_version is None):
            raise ValueError("Target ID and expected version must be supplied together")
        return self


class AssignmentRead(APIModel):
    operation_id: uuid.UUID
    article_id: uuid.UUID
    cluster_id: uuid.UUID
    cluster_version: int
    article_version: int
    replayed: bool


class IncomingRead(APIModel):
    id: uuid.UUID
    title: str | None
    excerpt: str | None
    original_url: str | None
    language: str
    publisher: str
    version: int
    state: Literal["UNASSIGNED", "ASSIGNED"]
    cluster_id: uuid.UUID | None
    blocked_reasons: list[str]
    approval_token: str | None


class InboxPage(APIModel):
    items: list[IncomingRead]
    pagination: Pagination


class DraftRead(APIModel):
    id: uuid.UUID
    title: str
    version: int
    blocked_reasons: list[str]


class DraftPage(APIModel):
    items: list[DraftRead]
    pagination: Pagination


ReadStaff = Annotated[AuthenticatedStaff, Depends(require_permission(Permission.ARTICLE_READ))]
WriteStaff = Annotated[
    AuthenticatedStaff, Depends(require_permission(Permission.ARTICLE_ASSIGN, csrf=True))
]


@router.get("/incoming-articles", response_model=InboxPage)
def incoming_articles(
    session: SessionDep,
    context: ReadStaff,
    state: Literal["UNASSIGNED", "ASSIGNED", "ALL"] = "UNASSIGNED",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> InboxPage:
    require_fixture_mode()
    assigned = (
        select(ArticleDraftAssignment.id)
        .where(ArticleDraftAssignment.article_id == Article.id)
        .exists()
    )
    query = select(Article).where(Article.status == ContentStatus.INGESTED)
    if state != "ALL":
        query = query.where(assigned if state == "ASSIGNED" else ~assigned)
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    articles = session.scalars(
        query.options(
            joinedload(Article.feed).joinedload(SourceFeed.organization),
            joinedload(Article.feed).joinedload(SourceFeed.rights_policy),
        )
        .order_by(Article.created_at.desc(), Article.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    for article in articles:
        receipt = session.scalar(
            select(ArticleDraftAssignment).where(ArticleDraftAssignment.article_id == article.id)
        )
        reasons = blocked_reasons(session, article, article.feed)
        if not receipt and session.scalar(
            select(ClusterArticle.id).where(ClusterArticle.article_id == article.id).limit(1)
        ):
            reasons.append("article_already_clustered")
        items.append(
            IncomingRead(
                id=article.id,
                title=article.title if not reasons else None,
                excerpt=(article.excerpt or "")[:2000] if not reasons else None,
                original_url=article.canonical_url if not reasons else None,
                publisher=article.feed.organization.name,
                language=article.language,
                version=article.version,
                state="ASSIGNED" if receipt else "UNASSIGNED",
                cluster_id=receipt.cluster_id if receipt else None,
                blocked_reasons=reasons,
                approval_token=digest(approval_snapshot(session, article.feed))
                if not reasons
                else None,
            )
        )
    return InboxPage(
        items=items,
        pagination=Pagination(
            page=page, page_size=page_size, total=total, total_pages=math.ceil(total / page_size)
        ),
    )


@router.get("/draft-workspaces", response_model=DraftPage)
def draft_workspaces(
    session: SessionDep,
    context: ReadStaff,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> DraftPage:
    require_fixture_mode()
    total = session.scalar(select(func.count()).select_from(DraftWorkspace)) or 0
    rows = session.execute(
        select(EventCluster, DraftWorkspace)
        .join(DraftWorkspace, DraftWorkspace.cluster_id == EventCluster.id)
        .order_by(DraftWorkspace.created_at.desc(), DraftWorkspace.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return DraftPage(
        items=[
            DraftRead(
                id=cluster.id,
                title=cluster.neutral_headline,
                version=cluster.version,
                blocked_reasons=target_blockers(session, cluster, workspace),
            )
            for cluster, workspace in rows
        ],
        pagination=Pagination(
            page=page, page_size=page_size, total=total, total_pages=math.ceil(total / page_size)
        ),
    )


@router.post("/incoming-articles/{article_id}/assign", response_model=AssignmentRead)
def assign_article(
    article_id: uuid.UUID, payload: AssignmentRequest, session: SessionDep, context: WriteStaff
) -> AssignmentRead:
    require_fixture_mode()
    feed_id = session.scalar(select(Article.feed_id).where(Article.id == article_id))
    if feed_id is None:
        fail("article_not_found", "Incoming article not found.", 404)
    feed = locked_feed(session, feed_id)
    # All inbox assignments share the existing short control lock. Target before
    # article matches editorial correction locking; no network or worker wait here.
    cluster = None
    workspace = None
    if payload.target_cluster_id:
        cluster = session.scalar(
            select(EventCluster)
            .where(EventCluster.id == payload.target_cluster_id)
            .with_for_update()
        )
        workspace = session.scalar(
            select(DraftWorkspace).where(DraftWorkspace.cluster_id == payload.target_cluster_id)
        )
    article = session.scalar(select(Article).where(Article.id == article_id).with_for_update())
    if not feed or article is None or article.feed_id != feed.id:
        fail("source_changed", "Source changed. Refresh before retrying.")
    reasons = blocked_reasons(session, article, feed)
    if reasons:
        fail("article_blocked", "Assignment blocked: " + ", ".join(reasons))
    fingerprint = digest({"article": str(article_id), "payload": payload.model_dump(mode="json")})
    previous = session.get(ArticleDraftAssignment, payload.operation_id)
    if previous:
        if previous.payload_hash != fingerprint or previous.actor_id != context.user.id:
            fail(
                "operation_conflict",
                "This operation ID was already used for a different assignment.",
            )
        if not session.scalar(
            select(ClusterArticle.id).where(
                ClusterArticle.article_id == article_id,
                ClusterArticle.cluster_id == previous.cluster_id,
            )
        ):
            fail(
                "assignment_changed",
                "Editorial membership has changed. Review the cluster workspace.",
            )
        return AssignmentRead(
            operation_id=previous.id,
            article_id=article_id,
            cluster_id=previous.cluster_id,
            article_version=previous.article_version,
            cluster_version=previous.cluster_version,
            replayed=True,
        )
    if article.version != payload.expected_article_version:
        fail("article_stale", "Article changed. Refresh before retrying.")
    snapshot = approval_snapshot(session, feed)
    if digest(snapshot) != payload.approval_token:
        fail("approval_stale", "Source approvals changed. Refresh before retrying.")
    if session.scalar(
        select(ArticleDraftAssignment.id).where(ArticleDraftAssignment.article_id == article_id)
    ) or session.scalar(
        select(ClusterArticle.id).where(ClusterArticle.article_id == article_id).limit(1)
    ):
        fail("article_assigned", "Article already assigned. Refresh the inbox.")
    if payload.target_cluster_id:
        if not cluster or cluster.version != payload.expected_cluster_version:
            fail("draft_stale", "Target draft changed or disappeared. Refresh before retrying.")
        if target_blockers(session, cluster, workspace):
            fail(
                "draft_locked",
                "Use the editorial workspace for already-authored or reviewed material.",
            )
        _queue_high_risk_review(
            session,
            cluster,
            context.user.id,
            reason="Offline fixture article attached; factual review required.",
        )
        cluster.version += 1
        workspace.assignment_revision = cluster.material_revision
    else:
        key = uuid.uuid4()
        cluster = EventCluster(
            id=key,
            slug=f"draft-{key}",
            neutral_headline=article.title,
            neutral_headline_hi=article.title if article.language == "hi" else "",
            category="Unclassified",
            status=ContentStatus.HELD,
            risk_level=RiskLevel.HIGH,
            review_state=ReviewState.PENDING,
            provenance_complete=True,
            material_revision=1,
            version=1,
            push_ready=False,
        )
        session.add(cluster)
        session.flush()
        session.add(
            DraftWorkspace(
                cluster_id=cluster.id, created_by_id=context.user.id, assignment_revision=1
            )
        )
        register_contributors(session, cluster, {context.user.id})
        session.add(
            EditorialReview(
                cluster_id=cluster.id,
                risk_level=RiskLevel.HIGH,
                risk_category="Unclassified",
                reason=(
                    "Unverified offline fixture draft. "
                    "Source headline is not a verified neutral assertion."
                ),
                state=ReviewState.PENDING,
                drafted_by_id=context.user.id,
                material_revision=1,
            )
        )
    session.add(
        ClusterArticle(
            cluster_id=cluster.id,
            article_id=article.id,
            is_primary=not bool(payload.target_cluster_id),
        )
    )
    article.version += 1
    # Expiration may occur while waiting for locks; check again immediately before persistence.
    if blocked_reasons(session, article, feed):
        fail("article_blocked", "Source no longer eligible. Nothing assigned.")
    receipt = ArticleDraftAssignment(
        id=payload.operation_id,
        article_id=article.id,
        cluster_id=cluster.id,
        actor_id=context.user.id,
        payload_hash=fingerprint,
        rights_snapshot=json.loads(json.dumps(snapshot, default=str)),
        article_version=article.version,
        cluster_version=cluster.version,
    )
    session.add(receipt)
    append_audit(
        session,
        actor=context.user,
        action="FIXTURE_ARTICLE_ASSIGNED",
        entity_type="article",
        entity_id=article.id,
        request_id=context.request_id,
        after={
            "cluster_id": str(cluster.id),
            "article_version": article.version,
            "cluster_version": cluster.version,
        },
        details={
            "operation_id": str(receipt.id),
            "source_approval_digest": digest(snapshot),
            "offline_fixture": True,
        },
    )
    session.commit()
    return AssignmentRead(
        operation_id=receipt.id,
        article_id=article.id,
        cluster_id=cluster.id,
        article_version=receipt.article_version,
        cluster_version=receipt.cluster_version,
        replayed=False,
    )
