from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from nuzenio_api.admin_schemas import (
    DomainCreate,
    FeedCreate,
    PublisherCreate,
    RightsCreate,
    StateTransition,
)
from nuzenio_api.audit import append_audit
from nuzenio_api.auth import AuthenticatedStaff
from nuzenio_api.config import get_settings
from nuzenio_api.feed_locks import serialized_controls
from nuzenio_api.feed_operations import enforce_expired_rights, rights_issues
from nuzenio_api.feed_security import FeedSecurityError, validate_feed_url
from nuzenio_api.models import (
    FeedType,
    OnboardingState,
    PublisherDomain,
    PublisherOrganization,
    RightsPolicy,
    SourceFeed,
)
from nuzenio_api.serialization import json_safe
from nuzenio_api.services import ApplicationError

TRANSITIONS: dict[OnboardingState, set[OnboardingState]] = {
    OnboardingState.DRAFT: {OnboardingState.SUBMITTED},
    OnboardingState.SUBMITTED: {OnboardingState.UNDER_REVIEW, OnboardingState.DRAFT},
    OnboardingState.UNDER_REVIEW: {OnboardingState.APPROVED, OnboardingState.REJECTED},
    OnboardingState.APPROVED: {OnboardingState.PAUSED, OnboardingState.BLOCKED},
    OnboardingState.PAUSED: {OnboardingState.APPROVED, OnboardingState.BLOCKED},
    OnboardingState.BLOCKED: {OnboardingState.UNDER_REVIEW},
    OnboardingState.REJECTED: {OnboardingState.DRAFT},
}


def approval_snapshot(record):
    common = {
        "id": str(record.id),
        "version": record.version,
        "state": record.onboarding_state.value,
        "reviewedById": record.reviewed_by_id,
        "reviewedAt": record.reviewed_at,
    }
    if isinstance(record, PublisherDomain):
        common.update(domain=record.domain, ownershipEvidence=record.ownership_evidence)
    else:
        common.update(
            evidenceUrl=record.evidence_url,
            policyName=record.policy_name,
            effectiveAt=record.effective_at,
            expiresAt=record.expires_at,
            revokedAt=record.revoked_at,
            permissions={
                "headline": record.may_use_headline,
                "snippet": record.may_store_excerpt,
                "thumbnail": record.may_use_thumbnail,
                "generatedSummary": record.may_summarize,
                "translation": record.may_translate,
                "audio": record.may_generate_audio,
                "fullTextStorage": record.may_store_full_text,
                "fullTextDisplay": record.may_display_full_text,
            },
        )
    snapshot = json_safe(common)
    snapshot["snapshotHash"] = hashlib.sha256(
        json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return snapshot


def require_snapshot(record, payload):
    snapshot = approval_snapshot(record)
    if payload.expected_snapshot_hash != snapshot["snapshotHash"]:
        raise ApplicationError(
            code="approval_snapshot_conflict",
            message="Reload and review the complete current evidence snapshot before approval.",
            status=409,
        )
    return snapshot


def _metadata(context: AuthenticatedStaff) -> dict[str, Any]:
    return {
        "request_id": context.request_id,
        "ip_address": context.ip_address,
        "user_agent": context.user_agent,
    }


def _conflict(expected: int, actual: int) -> None:
    if expected != actual:
        raise ApplicationError(
            code="version_conflict",
            message=(
                f"This record changed since it was loaded (expected {expected}, current {actual})."
            ),
            status=409,
        )


def _transition(current: OnboardingState, requested: OnboardingState) -> None:
    if requested not in TRANSITIONS[current]:
        raise ApplicationError(
            code="invalid_state_transition",
            message=f"Cannot move directly from {current.value} to {requested.value}.",
            status=409,
        )


@serialized_controls
def create_publisher(
    session: Session, payload: PublisherCreate, context: AuthenticatedStaff
) -> PublisherOrganization:
    if session.scalar(
        select(PublisherOrganization.id).where(PublisherOrganization.slug == payload.slug)
    ):
        raise ApplicationError(
            code="publisher_exists", message="Publisher slug already exists.", status=409
        )
    item = PublisherOrganization(
        name=payload.name,
        slug=payload.slug,
        ownership=payload.ownership,
        contact_name=payload.contact_name,
        contact_email=payload.contact_email,
        correction_route=str(payload.correction_route),
        correction_policy="",
        description="",
        active=False,
        onboarding_state=OnboardingState.DRAFT,
    )
    session.add(item)
    session.flush()
    append_audit(
        session,
        actor=context.user,
        action="PUBLISHER_CREATED",
        entity_type="PublisherOrganization",
        entity_id=item.id,
        after={"name": item.name, "slug": item.slug, "state": item.onboarding_state.value},
        **_metadata(context),
    )
    session.commit()
    session.refresh(item)
    return item


@serialized_controls
def transition_publisher(
    session: Session,
    *,
    publisher_id: uuid.UUID,
    payload: StateTransition,
    context: AuthenticatedStaff,
) -> PublisherOrganization:
    item = session.scalar(
        select(PublisherOrganization)
        .where(PublisherOrganization.id == publisher_id)
        .with_for_update()
    )
    if not item:
        raise ApplicationError(
            code="publisher_not_found", message="Publisher not found.", status=404
        )
    _conflict(payload.expected_version, item.version)
    requested = OnboardingState(payload.state)
    _transition(item.onboarding_state, requested)
    before = {"state": item.onboarding_state.value, "version": item.version}
    if requested == OnboardingState.APPROVED:
        if not item.contact_email or not item.correction_route or not item.ownership:
            raise ApplicationError(
                code="publisher_incomplete",
                message="Ownership, contact, and correction route are required before approval.",
                status=409,
            )
        item.active = True
        item.reviewed_by_id = context.user.id
        item.reviewed_at = datetime.now(UTC)
    elif requested in {OnboardingState.PAUSED, OnboardingState.BLOCKED, OnboardingState.REJECTED}:
        item.active = False
        for feed in item.feeds:
            feed.approved = False
            feed.onboarding_state = OnboardingState.PAUSED
            feed.paused_reason = f"Publisher moved to {requested.value}: {payload.notes}"
            feed.version += 1
    item.onboarding_state = requested
    item.version += 1
    append_audit(
        session,
        actor=context.user,
        action="PUBLISHER_STATE_CHANGED",
        entity_type="PublisherOrganization",
        entity_id=item.id,
        before=before,
        after={"state": item.onboarding_state.value, "version": item.version},
        outcome="REJECTION" if requested == OnboardingState.REJECTED else "SUCCESS",
        reason=payload.notes or None,
        **_metadata(context),
    )
    session.commit()
    session.refresh(item)
    return item


@serialized_controls
def add_domain(
    session: Session,
    *,
    publisher_id: uuid.UUID,
    payload: DomainCreate,
    context: AuthenticatedStaff,
) -> PublisherDomain:
    publisher = session.scalar(
        select(PublisherOrganization)
        .where(PublisherOrganization.id == publisher_id)
        .with_for_update()
    )
    if not publisher:
        raise ApplicationError(
            code="publisher_not_found", message="Publisher not found.", status=404
        )
    _conflict(payload.expected_version, publisher.version)
    domain_name = payload.domain.rstrip(".").casefold()
    if session.scalar(select(PublisherDomain.id).where(PublisherDomain.domain == domain_name)):
        raise ApplicationError(
            code="domain_exists", message="Domain is already registered.", status=409
        )
    domain = PublisherDomain(
        organization_id=publisher.id,
        domain=domain_name,
        verified=False,
        ownership_evidence=payload.ownership_evidence,
        onboarding_state=OnboardingState.DRAFT,
    )
    publisher.version += 1
    session.add(domain)
    session.flush()
    append_audit(
        session,
        actor=context.user,
        action="PUBLISHER_DOMAIN_ADDED",
        entity_type="PublisherDomain",
        entity_id=domain.id,
        after={"publisher_id": str(publisher.id), "domain": domain.domain},
        **_metadata(context),
    )
    session.commit()
    session.refresh(domain)
    return domain


@serialized_controls
def transition_domain(
    session: Session,
    *,
    domain_id: uuid.UUID,
    payload: StateTransition,
    context: AuthenticatedStaff,
) -> PublisherDomain:
    domain = session.scalar(
        select(PublisherDomain).where(PublisherDomain.id == domain_id).with_for_update()
    )
    if not domain:
        raise ApplicationError(code="domain_not_found", message="Domain not found.", status=404)
    _conflict(payload.expected_version, domain.version)
    requested = OnboardingState(payload.state)
    _transition(domain.onboarding_state, requested)
    if requested == OnboardingState.APPROVED and not domain.ownership_evidence:
        raise ApplicationError(
            code="domain_evidence_required",
            message="Ownership evidence is required before domain approval.",
            status=409,
        )
    reviewed_snapshot = (
        require_snapshot(domain, payload) if requested == OnboardingState.APPROVED else None
    )
    before = {"state": domain.onboarding_state.value, "verified": domain.verified}
    domain.onboarding_state = requested
    domain.verified = requested == OnboardingState.APPROVED
    domain.reviewed_by_id = (
        context.user.id if requested == OnboardingState.APPROVED else domain.reviewed_by_id
    )
    domain.reviewed_at = (
        datetime.now(UTC) if requested == OnboardingState.APPROVED else domain.reviewed_at
    )
    domain.version += 1
    append_audit(
        session,
        actor=context.user,
        action="DOMAIN_STATE_CHANGED",
        details={"reviewed_snapshot": reviewed_snapshot},
        entity_type="PublisherDomain",
        entity_id=domain.id,
        before=before,
        after={"state": domain.onboarding_state.value, "verified": domain.verified},
        outcome="REJECTION" if requested == OnboardingState.REJECTED else "SUCCESS",
        reason=payload.notes or None,
        **_metadata(context),
    )
    session.commit()
    session.refresh(domain)
    return domain


@serialized_controls
def add_rights(
    session: Session,
    *,
    publisher_id: uuid.UUID,
    payload: RightsCreate,
    context: AuthenticatedStaff,
) -> RightsPolicy:
    publisher = session.scalar(
        select(PublisherOrganization)
        .where(PublisherOrganization.id == publisher_id)
        .with_for_update()
    )
    if not publisher:
        raise ApplicationError(
            code="publisher_not_found", message="Publisher not found.", status=404
        )
    _conflict(payload.expected_version, publisher.version)
    if payload.full_text_display:
        raise ApplicationError(
            code="full_text_display_disabled",
            message="Full-text display is disabled for this milestone.",
            status=409,
        )
    if payload.expires_at and payload.expires_at <= payload.effective_at:
        raise ApplicationError(
            code="invalid_rights_dates",
            message="Rights expiry must follow its effective date.",
            status=422,
        )
    rights = RightsPolicy(
        organization_id=publisher.id,
        policy_name=payload.policy_name,
        evidence_url=str(payload.evidence_url),
        effective_at=payload.effective_at,
        expires_at=payload.expires_at,
        may_use_headline=payload.headline,
        may_store_excerpt=payload.snippet,
        may_use_thumbnail=payload.thumbnail,
        may_summarize=payload.generated_summary,
        may_translate=payload.translation,
        may_generate_audio=payload.audio,
        may_store_full_text=payload.full_text_storage,
        may_display_full_text=False,
        attribution_required=True,
        onboarding_state=OnboardingState.DRAFT,
        metadata_json={},
    )
    publisher.version += 1
    session.add(rights)
    session.flush()
    append_audit(
        session,
        actor=context.user,
        action="RIGHTS_POLICY_ADDED",
        entity_type="RightsPolicy",
        entity_id=rights.id,
        after={"publisher_id": str(publisher.id), "policy_name": rights.policy_name},
        **_metadata(context),
    )
    session.commit()
    session.refresh(rights)
    return rights


@serialized_controls
def transition_rights(
    session: Session,
    *,
    rights_id: uuid.UUID,
    payload: StateTransition,
    context: AuthenticatedStaff,
) -> RightsPolicy:
    rights = session.scalar(
        select(RightsPolicy).where(RightsPolicy.id == rights_id).with_for_update()
    )
    if not rights:
        raise ApplicationError(
            code="rights_not_found", message="Rights policy not found.", status=404
        )
    _conflict(payload.expected_version, rights.version)
    requested = OnboardingState(payload.state)
    _transition(rights.onboarding_state, requested)
    if requested == OnboardingState.APPROVED:
        reviewed_snapshot = require_snapshot(rights, payload)
        missing = []
        if not rights.evidence_url:
            missing.append("rights_evidence")
        if not rights.may_use_headline:
            missing.append("headline")
        if not rights.may_store_excerpt:
            missing.append("snippet")
        if not rights.may_summarize:
            missing.append("generated_summary")
        if rights.may_display_full_text:
            missing.append("full_text_display_disabled")
        if missing:
            raise ApplicationError(
                code="rights_incomplete",
                message="Required rights are missing: " + ", ".join(missing),
                status=409,
            )
        rights.reviewed_by_id = context.user.id
        rights.reviewed_at = datetime.now(UTC)
        rights.metadata_json = {**rights.metadata_json, "approved_snapshot": reviewed_snapshot}
    if requested in {OnboardingState.PAUSED, OnboardingState.BLOCKED, OnboardingState.REJECTED}:
        if requested == OnboardingState.BLOCKED:
            rights.revoked_at = datetime.now(UTC)
        feeds = list(
            session.scalars(select(SourceFeed).where(SourceFeed.rights_policy_id == rights.id))
        )
        for feed in feeds:
            feed.approved = False
            feed.onboarding_state = OnboardingState.PAUSED
            feed.paused_reason = f"Rights moved to {requested.value}: {payload.notes}"
            feed.version += 1
    before = {"state": rights.onboarding_state.value, "version": rights.version}
    rights.onboarding_state = requested
    rights.version += 1
    append_audit(
        session,
        actor=context.user,
        action="RIGHTS_STATE_CHANGED",
        details={"reviewed_snapshot": rights.metadata_json.get("approved_snapshot")},
        entity_type="RightsPolicy",
        entity_id=rights.id,
        before=before,
        after={"state": rights.onboarding_state.value, "version": rights.version},
        outcome="REJECTION" if requested == OnboardingState.REJECTED else "SUCCESS",
        reason=payload.notes or None,
        **_metadata(context),
    )
    session.commit()
    session.refresh(rights)
    return rights


@serialized_controls
def add_feed(
    session: Session,
    *,
    publisher_id: uuid.UUID,
    payload: FeedCreate,
    context: AuthenticatedStaff,
) -> SourceFeed:
    publisher = session.scalar(
        select(PublisherOrganization)
        .where(PublisherOrganization.id == publisher_id)
        .with_for_update()
    )
    if not publisher:
        raise ApplicationError(
            code="publisher_not_found", message="Publisher not found.", status=404
        )
    _conflict(payload.expected_version, publisher.version)
    domain = session.get(PublisherDomain, payload.domain_id)
    rights = session.get(RightsPolicy, payload.rights_policy_id)
    if not domain or domain.organization_id != publisher.id:
        raise ApplicationError(
            code="domain_not_found", message="Publisher domain not found.", status=404
        )
    if not rights or rights.organization_id != publisher.id:
        raise ApplicationError(
            code="rights_not_found", message="Publisher rights not found.", status=404
        )
    if urlsplit(str(payload.url)).hostname != domain.domain:
        raise ApplicationError(
            code="feed_domain_mismatch",
            message="Feed URL must use the verified publisher domain.",
            status=422,
        )
    if session.scalar(select(SourceFeed.id).where(SourceFeed.url == str(payload.url))):
        raise ApplicationError(
            code="feed_exists", message="Feed URL is already registered.", status=409
        )
    feed = SourceFeed(
        organization_id=publisher.id,
        domain_id=domain.id,
        rights_policy_id=rights.id,
        name=payload.name,
        feed_type=FeedType.RSS,
        url=str(payload.url),
        language=payload.language,
        approved=False,
        onboarding_state=OnboardingState.DRAFT,
        poll_interval_seconds=payload.poll_interval_seconds,
        rate_limit_per_minute=payload.rate_limit_per_minute,
        health_status="NOT_RUN",
    )
    publisher.version += 1
    session.add(feed)
    session.flush()
    append_audit(
        session,
        actor=context.user,
        action="SOURCE_FEED_ADDED",
        entity_type="SourceFeed",
        entity_id=feed.id,
        after={"publisher_id": str(publisher.id), "url": feed.url},
        **_metadata(context),
    )
    session.commit()
    session.refresh(feed)
    return feed


@serialized_controls
def transition_feed(
    session: Session,
    *,
    feed_id: uuid.UUID,
    payload: StateTransition,
    context: AuthenticatedStaff,
) -> SourceFeed:
    feed = session.scalar(
        select(SourceFeed)
        .where(SourceFeed.id == feed_id)
        .with_for_update()
        .options(selectinload(SourceFeed.organization), selectinload(SourceFeed.rights_policy))
    )
    if not feed:
        raise ApplicationError(code="feed_not_found", message="Feed not found.", status=404)
    _conflict(payload.expected_version, feed.version)
    requested = OnboardingState(payload.state)
    _transition(feed.onboarding_state, requested)
    before = {
        "state": feed.onboarding_state.value,
        "approved": feed.approved,
        "version": feed.version,
    }
    feed.onboarding_state = requested
    feed.approved = requested == OnboardingState.APPROVED
    feed.paused_reason = (
        payload.notes
        if requested in {OnboardingState.PAUSED, OnboardingState.BLOCKED, OnboardingState.REJECTED}
        else None
    )
    if requested == OnboardingState.APPROVED:
        issues = rights_issues(session, feed)
        if issues:
            raise ApplicationError(
                code="feed_approval_failed",
                message="Feed cannot be approved: " + ", ".join(issues),
                status=409,
            )
    feed.version += 1
    append_audit(
        session,
        actor=context.user,
        action="FEED_STATE_CHANGED",
        entity_type="SourceFeed",
        entity_id=feed.id,
        before=before,
        after={
            "state": feed.onboarding_state.value,
            "approved": feed.approved,
            "version": feed.version,
        },
        outcome="REJECTION" if requested == OnboardingState.REJECTED else "SUCCESS",
        reason=payload.notes or None,
        **_metadata(context),
    )
    session.commit()
    session.refresh(feed)
    return feed


def feed_dry_run(session: Session, feed_id: uuid.UUID) -> dict[str, Any]:
    feed = session.scalar(
        select(SourceFeed)
        .where(SourceFeed.id == feed_id)
        .options(selectinload(SourceFeed.organization), selectinload(SourceFeed.rights_policy))
    )
    if not feed:
        raise ApplicationError(code="feed_not_found", message="Feed not found.", status=404)
    issues = [item for item in rights_issues(session, feed) if item not in {"feed_not_approved"}]
    try:
        hostname = urlsplit(feed.url).hostname or ""
        resolver = (
            (lambda _host, _port: {"93.184.216.34"})
            if get_settings().demo_mode and hostname.endswith(".example")
            else None
        )
        target = (
            validate_feed_url(feed.url, resolver=resolver)
            if resolver
            else validate_feed_url(feed.url)
        )
        normalized = target.url
    except FeedSecurityError as error:
        issues.append(error.code)
        normalized = feed.url
    return {
        "valid": not issues,
        "issues": sorted(set(issues)),
        "normalized_url": normalized,
        "will_fetch": False,
    }


def publisher_page(
    session: Session, *, page: int, page_size: int, state: str | None = None
) -> tuple[list[dict[str, Any]], int]:
    enforce_expired_rights(session)
    session.commit()
    statement = select(PublisherOrganization).options(
        selectinload(PublisherOrganization.domains),
        selectinload(PublisherOrganization.rights_policies),
        selectinload(PublisherOrganization.feeds),
    )
    if state:
        statement = statement.where(
            PublisherOrganization.onboarding_state == OnboardingState(state)
        )
    total = int(session.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    organizations = list(
        session.scalars(
            statement.order_by(PublisherOrganization.name)
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).unique()
    )
    return [
        {
            "id": str(item.id),
            "name": item.name,
            "slug": item.slug,
            "ownership": item.ownership,
            "contactEmail": item.contact_email,
            "correctionRoute": item.correction_route,
            "state": item.onboarding_state.value,
            "version": item.version,
            "domains": [
                {
                    "id": str(domain.id),
                    "domain": domain.domain,
                    "verified": domain.verified,
                    "state": domain.onboarding_state.value,
                    "version": domain.version,
                    **approval_snapshot(domain),
                }
                for domain in item.domains
            ],
            "rights": [
                {
                    "id": str(rights.id),
                    "name": rights.policy_name,
                    "state": rights.onboarding_state.value,
                    "expiresAt": rights.expires_at.isoformat() if rights.expires_at else None,
                    "fullTextDisplay": rights.may_display_full_text,
                    "version": rights.version,
                    **approval_snapshot(rights),
                    "approvalHistory": rights.metadata_json.get("approved_snapshot"),
                }
                for rights in item.rights_policies
            ],
            "feeds": [
                {
                    "id": str(feed.id),
                    "name": feed.name,
                    "url": feed.url,
                    "state": feed.onboarding_state.value,
                    "health": feed.health_status,
                    "lastSuccessAt": (
                        feed.last_success_at.isoformat() if feed.last_success_at else None
                    ),
                    "nextPollAt": feed.next_poll_at.isoformat() if feed.next_poll_at else None,
                    "version": feed.version,
                }
                for feed in item.feeds
            ],
        }
        for item in organizations
    ], total
