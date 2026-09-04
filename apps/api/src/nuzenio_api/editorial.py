from __future__ import annotations

import unicodedata
import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy import update as sql_update
from sqlalchemy.orm import Session, selectinload

from nuzenio_api.admin_schemas import (
    ClaimUpdate,
    ClusterHeadlineUpdate,
    ClusterMergeApply,
    ClusterSplitApply,
    CorrectionApply,
    CorrectionCreate,
    CorrectionDraftUpdate,
    PrimaryDocumentCreate,
    ReviewDecision,
    SummaryDecision,
    SummaryRevisionCreate,
)
from nuzenio_api.audit import append_audit
from nuzenio_api.auth import AuthenticatedStaff
from nuzenio_api.evidence import EvidenceMap, valid_evidence
from nuzenio_api.models import (
    Article,
    Brief,
    Claim,
    ClaimState,
    ClusterArticle,
    ContentRevision,
    ContentStatus,
    Correction,
    CorrectionImpact,
    DecisionState,
    EditorialReview,
    EventCluster,
    PrimaryDocument,
    ReviewState,
    RiskLevel,
    SavedCluster,
    SummaryVersion,
)
from nuzenio_api.provenance import (
    contributor_ids,
    inherit_published_corrections,
    register_contributors,
)
from nuzenio_api.serialization import json_safe
from nuzenio_api.services import ApplicationError

HIGH_RISK_CATEGORIES = {
    "elections",
    "communal violence",
    "war",
    "terrorism",
    "health emergencies",
    "public safety",
    "market-moving",
}


def _now() -> datetime:
    return datetime.now(UTC)


def _conflict(expected: int, actual: int) -> None:
    if expected != actual:
        raise ApplicationError(
            code="version_conflict",
            message=(
                f"This record changed since it was loaded (expected {expected}, current {actual})."
            ),
            status=409,
        )


def _request_fields(context: AuthenticatedStaff) -> dict[str, Any]:
    return {
        "request_id": context.request_id,
        "ip_address": context.ip_address,
        "user_agent": context.user_agent,
    }


def _snapshot(entity: object, names: tuple[str, ...]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for name in names:
        value = getattr(entity, name)
        if hasattr(value, "value"):
            value = value.value
        result[name] = str(value) if isinstance(value, uuid.UUID) else value
    return result


def _revision(
    session: Session,
    *,
    entity: object,
    entity_type: str,
    version: int,
    snapshot: dict[str, Any],
    actor_id: uuid.UUID,
    correction_id: uuid.UUID | None = None,
) -> None:
    exists = session.scalar(
        select(ContentRevision.id).where(
            ContentRevision.entity_type == entity_type,
            ContentRevision.entity_id == entity.id,
            ContentRevision.entity_version == version,
        )
    )
    if not exists:
        session.add(
            ContentRevision(
                entity_type=entity_type,
                entity_id=entity.id,
                entity_version=version,
                snapshot=json_safe(snapshot),
                correction_id=correction_id,
                actor_id=actor_id,
            )
        )


def _normalized(value: str | None) -> str:
    return " ".join(unicodedata.normalize("NFC", value or "").split())


def _mapping(value):
    try:
        return EvidenceMap.model_validate(value)
    except (ValidationError, TypeError):
        return None


def _contributors(session: Session, cluster_id: uuid.UUID) -> set[uuid.UUID]:
    cluster = session.get(EventCluster, cluster_id)
    return contributor_ids(session, cluster) if cluster else set()


def _record_contributors(session, cluster, actor_ids):
    register_contributors(session, cluster, actor_ids)


def _queue_high_risk_review(
    session: Session,
    cluster: EventCluster,
    actor_id: uuid.UUID,
    *,
    reason: str,
    material_contribution: bool = True,
) -> EditorialReview | None:
    cluster.material_revision += 1
    if material_contribution:
        _record_contributors(session, cluster, {actor_id})
    inherit_published_corrections(session, cluster)
    if not cluster.provenance_complete:
        cluster.status = ContentStatus.HELD
        cluster.push_ready = False
    session.execute(
        sql_update(EditorialReview)
        .where(EditorialReview.cluster_id == cluster.id, EditorialReview.superseded_at.is_(None))
        .values(superseded_at=_now(), version=EditorialReview.version + 1)
    )
    if (
        cluster.risk_level != RiskLevel.HIGH
        and cluster.category.casefold() not in HIGH_RISK_CATEGORIES
    ):
        return None
    cluster.risk_level = RiskLevel.HIGH
    cluster.review_state = ReviewState.PENDING
    cluster.status = ContentStatus.HELD
    cluster.push_ready = False
    review = EditorialReview(
        cluster_id=cluster.id,
        risk_level=RiskLevel.HIGH,
        risk_category=cluster.category,
        reason=reason,
        state=ReviewState.PENDING,
        decision=DecisionState.PENDING,
        drafted_by_id=actor_id,
        material_revision=cluster.material_revision,
    )
    session.add(review)
    return review


def edit_headline(
    session: Session,
    *,
    cluster_id: uuid.UUID,
    payload: ClusterHeadlineUpdate,
    context: AuthenticatedStaff,
) -> EventCluster:
    cluster = session.scalar(
        select(EventCluster).where(EventCluster.id == cluster_id).with_for_update()
    )
    if not cluster:
        raise ApplicationError(code="cluster_not_found", message="Cluster not found.", status=404)
    _conflict(payload.expected_version, cluster.version)
    if (_normalized(cluster.neutral_headline), _normalized(cluster.neutral_headline_hi)) == (
        _normalized(payload.headline),
        _normalized(payload.headline_hi),
    ):
        return cluster
    before = _snapshot(cluster, ("neutral_headline", "neutral_headline_hi", "status", "version"))
    _revision(
        session,
        entity=cluster,
        entity_type="EventCluster",
        version=cluster.version,
        snapshot=before,
        actor_id=context.user.id,
    )
    cluster.neutral_headline = payload.headline
    cluster.neutral_headline_hi = payload.headline_hi
    cluster.version += 1
    review = _queue_high_risk_review(
        session, cluster, context.user.id, reason="Material headline edit"
    )
    after = _snapshot(cluster, ("neutral_headline", "neutral_headline_hi", "status", "version"))
    append_audit(
        session,
        actor=context.user,
        action="CLUSTER_HEADLINE_EDITED",
        entity_type="EventCluster",
        entity_id=cluster.id,
        before=before,
        after=after,
        details={"review_id": str(review.id) if review and review.id else None},
        **_request_fields(context),
    )
    session.commit()
    session.refresh(cluster)
    return cluster


def set_suppression(
    session: Session,
    *,
    cluster_id: uuid.UUID,
    expected_version: int,
    suppressed: bool,
    reason: str,
    context: AuthenticatedStaff,
) -> EventCluster:
    cluster = session.scalar(
        select(EventCluster).where(EventCluster.id == cluster_id).with_for_update()
    )
    if not cluster:
        raise ApplicationError(code="cluster_not_found", message="Cluster not found.", status=404)
    _conflict(expected_version, cluster.version)
    before = _snapshot(cluster, ("status", "suppressed_at", "suppression_reason", "version"))
    _revision(
        session,
        entity=cluster,
        entity_type="EventCluster",
        version=cluster.version,
        snapshot=before,
        actor_id=context.user.id,
    )
    if suppressed:
        cluster.status = ContentStatus.HELD
        cluster.suppressed_at = _now()
        cluster.suppression_reason = reason
    else:
        if not session.scalar(select(func.nuzenio_correction_lineage_complete(cluster.id))):
            raise ApplicationError(
                code="provenance_required",
                message="Correction provenance is incomplete.",
                status=409,
            )
        if not session.scalar(
            select(SummaryVersion.id)
            .where(
                SummaryVersion.cluster_id == cluster.id,
                SummaryVersion.decision == DecisionState.APPROVED,
                SummaryVersion.invalidated_at.is_(None),
                func.nuzenio_summary_valid(SummaryVersion.id),
            )
            .limit(1)
        ):
            raise ApplicationError(
                code="summary_review_required",
                message="A valid approved summary is required before restoration.",
                status=409,
            )
        if cluster.risk_level == RiskLevel.HIGH and not session.scalar(
            select(func.nuzenio_current_review(cluster.id))
        ):
            raise ApplicationError(
                code="high_risk_review_required",
                message="High-risk content cannot be restored before independent approval.",
                status=409,
            )
        cluster.status = ContentStatus.PUBLISHED
        cluster.suppressed_at = None
        cluster.suppression_reason = None
    cluster.version += 1
    append_audit(
        session,
        actor=context.user,
        action="CLUSTER_SUPPRESSED" if suppressed else "CLUSTER_RESTORED",
        entity_type="EventCluster",
        entity_id=cluster.id,
        before=before,
        after=_snapshot(cluster, ("status", "suppressed_at", "suppression_reason", "version")),
        reason=reason,
        **_request_fields(context),
    )
    session.commit()
    session.refresh(cluster)
    return cluster


def _invalidate_summaries(session, cluster, context, *, reason, evidence_ids=None, language=None):
    """Irrevocably retire derived versions; preserve text/maps and audit snapshots.

    None means the whole cluster dependency (allocation/headline/correction).
    A set means summaries mapped to changed claims/articles/evidence, in any language.
    """
    cluster.push_ready = False
    for summary in session.scalars(
        select(SummaryVersion).where(SummaryVersion.cluster_id == cluster.id)
    ):
        if language is not None and summary.language != language:
            continue
        mapping = _mapping(summary.evidence_map)
        refs = (
            {ref for entry in mapping.sentences for ref in entry.evidence_ids} if mapping else None
        )
        if evidence_ids is not None and refs is not None and not refs.intersection(evidence_ids):
            continue
        if summary.invalidated_at is not None:
            continue
        _revision(
            session,
            entity=summary,
            entity_type="SummaryVersion",
            version=summary.row_version,
            snapshot=_snapshot(
                summary, ("summary_text", "evidence_map", "decision", "published_at")
            ),
            actor_id=context.user.id,
        )
        summary.decision = DecisionState.PENDING
        summary.invalidated_at = _now()
        summary.invalidation_reason = reason
        summary.row_version += 1
        summary.rejection_reason = reason
    # Saved server snapshots must not retain withdrawn text. An already-offline
    # device cannot receive this invalidation until its next network synchronization.
    for saved in session.scalars(select(SavedCluster).where(SavedCluster.cluster_id == cluster.id)):
        saved.offline_snapshot = {"invalidated": True, "reason": reason}
        saved.snapshot_version += 1


def _hold_derived(session, cluster, context):
    cluster.status = ContentStatus.HELD
    _invalidate_summaries(
        session, cluster, context, reason="Material content changed; create a new reviewed summary."
    )


def _replace_brief_ids(session, replacements, context):
    for brief in session.scalars(select(Brief).order_by(Brief.id).with_for_update()):
        if not set(brief.cluster_ids).intersection(replacements):
            continue
        _revision(
            session,
            entity=brief,
            entity_type="Brief",
            version=brief.version,
            snapshot={"cluster_ids": brief.cluster_ids},
            actor_id=context.user.id,
        )
        brief.cluster_ids = list(
            dict.fromkeys(
                new_id
                for old_id in brief.cluster_ids
                for new_id in replacements.get(old_id, [old_id])
            )
        )
        brief.version += 1


def merge_clusters(
    session: Session, payload: ClusterMergeApply, context: AuthenticatedStaff
) -> EventCluster:
    source_ids = sorted(set(payload.source_ids))
    if len(source_ids) != len(payload.source_ids) or payload.target_id in source_ids:
        raise ApplicationError(
            code="invalid_merge", message="Merge cluster IDs must be unique.", status=422
        )
    ids = sorted([payload.target_id, *source_ids])
    clusters = list(
        session.scalars(
            select(EventCluster)
            .where(EventCluster.id.in_(ids))
            .order_by(EventCluster.id)
            .with_for_update()
            .options(selectinload(EventCluster.articles))
        )
    )
    by_id = {cluster.id: cluster for cluster in clusters}
    if set(by_id) != set(ids):
        raise ApplicationError(
            code="cluster_not_found", message="One or more clusters were not found.", status=404
        )
    for cluster_id in ids:
        _conflict(payload.versions.get(str(cluster_id), -1), by_id[cluster_id].version)
    target = by_id[payload.target_id]
    target.provenance_complete = all(cluster.provenance_complete for cluster in clusters)
    _record_contributors(
        session, target, set().union(*(_contributors(session, c.id) for c in clusters))
    )
    existing_article_ids = {membership.article_id for membership in target.articles}
    for cluster in clusters:
        _revision(
            session,
            entity=cluster,
            entity_type="EventCluster",
            version=cluster.version,
            snapshot=_snapshot(cluster, ("slug", "status", "version")),
            actor_id=context.user.id,
        )
    for source_id in source_ids:
        source = by_id[source_id]
        for membership in list(source.articles):
            if membership.article_id in existing_article_ids:
                session.delete(membership)
            else:
                membership.cluster_id = target.id
                existing_article_ids.add(membership.article_id)
        for claim in list(session.scalars(select(Claim).where(Claim.cluster_id == source.id))):
            claim.cluster_id = target.id
            claim.version += 1
        for model in (PrimaryDocument, Correction):
            for record in session.scalars(select(model).where(model.cluster_id == source.id)):
                _revision(
                    session,
                    entity=record,
                    entity_type=model.__name__,
                    version=record.version,
                    snapshot={"cluster_id": str(source.id)},
                    actor_id=context.user.id,
                )
                record.cluster_id = target.id
                record.version += 1
        target.timeline_json = list(target.timeline_json) + list(source.timeline_json)
        _hold_derived(session, source, context)
        source.status = ContentStatus.REMOVED
        source.suppressed_at = _now()
        source.suppression_reason = f"Merged into {target.slug}"
        source.version += 1
    if any(cluster.risk_level == RiskLevel.HIGH for cluster in clusters):
        target.risk_level = RiskLevel.HIGH
    target.version += 1
    _replace_brief_ids(
        session, {str(item): [str(target.id)] for item in payload.source_ids}, context
    )
    _hold_derived(session, target, context)
    _queue_high_risk_review(session, target, context.user.id, reason="Cluster merge")
    append_audit(
        session,
        actor=context.user,
        action="CLUSTERS_MERGED",
        entity_type="EventCluster",
        entity_id=target.id,
        before={"cluster_ids": [str(item) for item in ids]},
        after={"target_id": str(target.id), "version": target.version},
        **_request_fields(context),
    )
    session.commit()
    session.refresh(target)
    return target


def split_cluster(
    session: Session,
    *,
    cluster_id: uuid.UUID,
    payload: ClusterSplitApply,
    context: AuthenticatedStaff,
) -> list[EventCluster]:
    cluster = session.scalar(
        select(EventCluster)
        .where(EventCluster.id == cluster_id)
        .with_for_update()
        .options(selectinload(EventCluster.articles))
    )
    if not cluster:
        raise ApplicationError(code="cluster_not_found", message="Cluster not found.", status=404)
    _conflict(payload.expected_version, cluster.version)
    original_ids = {membership.article_id for membership in cluster.articles}
    supplied = [article_id for group in payload.groups for article_id in group.article_ids]
    if len(supplied) != len(set(supplied)) or set(supplied) != original_ids:
        raise ApplicationError(
            code="invalid_split",
            message="Split groups must contain every cluster article exactly once.",
            status=422,
        )
    if len({group.slug for group in payload.groups}) != len(payload.groups):
        raise ApplicationError(
            code="invalid_split", message="Split slugs must be unique.", status=422
        )
    _revision(
        session,
        entity=cluster,
        entity_type="EventCluster",
        version=cluster.version,
        snapshot=_snapshot(cluster, ("slug", "neutral_headline", "status", "version")),
        actor_id=context.user.id,
    )
    membership_by_article = {item.article_id: item for item in cluster.articles}
    inherited_contributors = _contributors(session, cluster.id)
    created: list[EventCluster] = []
    for index, group in enumerate(payload.groups):
        if index == 0:
            destination = cluster
            destination.slug = group.slug
            destination.neutral_headline = group.headline
            destination.neutral_headline_hi = group.headline_hi
            destination.version += 1
        else:
            destination = EventCluster(
                slug=group.slug,
                neutral_headline=group.headline,
                neutral_headline_hi=group.headline_hi,
                category=cluster.category,
                location=cluster.location,
                status=ContentStatus.HELD,
                risk_level=cluster.risk_level,
                provenance_complete=cluster.provenance_complete,
                review_state=(
                    ReviewState.PENDING
                    if cluster.risk_level == RiskLevel.HIGH
                    else ReviewState.NOT_REQUIRED
                ),
                timeline_json=[],
                why_shown=cluster.why_shown,
                why_shown_hi=cluster.why_shown_hi,
            )
            session.add(destination)
            session.flush()
        created.append(destination)
        _record_contributors(session, destination, inherited_contributors)
        for article_id in group.article_ids:
            membership_by_article[article_id].cluster_id = destination.id
        _queue_high_risk_review(session, destination, context.user.id, reason="Cluster split")
        _hold_derived(session, destination, context)
    # Documents and the original event timeline remain on the first result. Claims
    # follow their evidence: clone wording when evidence spans groups, partition
    # evidence rows exactly once. Every result is HELD pending human reassessment.
    article_destination = {
        article_id: dest
        for group, dest in zip(payload.groups, created, strict=True)
        for article_id in group.article_ids
    }
    claims = list(
        session.scalars(
            select(Claim)
            .where(Claim.cluster_id == cluster.id)
            .options(selectinload(Claim.evidence))
        )
    )
    for claim in claims:
        _revision(
            session,
            entity=claim,
            entity_type="Claim",
            version=claim.version,
            snapshot={
                **_snapshot(claim, ("text", "text_hi", "state", "cluster_id")),
                "evidence_ids": [str(item.id) for item in claim.evidence],
            },
            actor_id=context.user.id,
        )
        for destination in created[1:]:
            evidence = [
                item
                for item in claim.evidence
                if item.article_id and article_destination[item.article_id].id == destination.id
            ]
            if not evidence:
                continue
            clone = Claim(
                cluster_id=destination.id,
                text=claim.text,
                text_hi=claim.text_hi,
                state=claim.state,
                materiality=claim.materiality,
            )
            session.add(clone)
            session.flush()
            for item in evidence:
                item.claim_id = clone.id
        claim.version += 1
    corrections = list(
        session.scalars(select(Correction).where(Correction.cluster_id == cluster.id))
    )
    languages = set(
        session.scalars(
            select(SummaryVersion.language).where(SummaryVersion.cluster_id == cluster.id)
        )
    ) or {"en", "hi"}
    for destination in created[1:]:
        # Empty, unapprovable draft slots support the revision API without copying
        # a summary whose evidence belongs to a different allocation.
        for language in languages:
            session.add(
                SummaryVersion(
                    cluster_id=destination.id,
                    language=language,
                    version=1,
                    summary_text="",
                    evidence_map={"sentences": []},
                    generator_name="split-awaiting-editorial",
                    decision=DecisionState.PENDING,
                )
            )
        for correction in corrections:
            copied = Correction(
                cluster_id=destination.id,
                description=correction.description,
                description_hi=correction.description_hi,
                source_url=correction.source_url,
                evidence=correction.evidence,
                status=correction.status,
                published_at=correction.published_at,
                resolution=correction.resolution,
                raised_at=correction.raised_at,
                resolved_at=correction.resolved_at,
                created_by_id=correction.created_by_id,
                resolved_by_id=correction.resolved_by_id,
                provenance_complete=correction.provenance_complete,
                version=correction.version,
            )
            session.add(copied)
            session.flush()
            register_contributors(session, copied, contributor_ids(session, correction))
    _replace_brief_ids(session, {str(cluster.id): [str(item.id) for item in created]}, context)
    append_audit(
        session,
        actor=context.user,
        action="CLUSTER_SPLIT",
        entity_type="EventCluster",
        entity_id=cluster.id,
        before={"cluster_id": str(cluster.id), "article_ids": [str(item) for item in original_ids]},
        after={"cluster_ids": [str(item.id) for item in created]},
        **_request_fields(context),
    )
    session.commit()
    for item in created:
        session.refresh(item)
    return created


def update_claim(
    session: Session, *, claim_id: uuid.UUID, payload: ClaimUpdate, context: AuthenticatedStaff
) -> Claim:
    # Shared cluster-first order prevents claim edits racing review/correction/merge.
    cluster_id = session.scalar(select(Claim.cluster_id).where(Claim.id == claim_id))
    cluster = session.scalar(
        select(EventCluster).where(EventCluster.id == cluster_id).with_for_update()
    )
    claim = session.scalar(
        select(Claim)
        .where(Claim.id == claim_id)
        .with_for_update()
        .options(selectinload(Claim.evidence))
    )
    if not claim:
        raise ApplicationError(code="claim_not_found", message="Claim not found.", status=404)
    _conflict(payload.expected_version, claim.version)
    if not cluster:
        raise ApplicationError(code="cluster_not_found", message="Cluster not found.", status=404)
    existing = {item.id for item in claim.evidence}
    if not set(payload.evidence_ids).issubset(existing):
        raise ApplicationError(
            code="invalid_evidence",
            message="Evidence must already belong to this claim.",
            status=422,
        )
    if claim.cluster_id != cluster.id:
        raise ApplicationError(
            code="version_conflict", message="Claim allocation changed; reload.", status=409
        )
    if (_normalized(claim.text), _normalized(claim.text_hi), claim.state.value, existing) == (
        _normalized(payload.text),
        _normalized(payload.text_hi),
        payload.state,
        set(payload.evidence_ids),
    ):
        return claim
    _invalidate_summaries(
        session, cluster, context, reason="Claim or its evidence changed.", evidence_ids=existing
    )
    before = _snapshot(claim, ("text", "text_hi", "state", "version"))
    _revision(
        session,
        entity=claim,
        entity_type="Claim",
        version=claim.version,
        snapshot=before,
        actor_id=context.user.id,
    )
    for evidence in list(claim.evidence):
        if evidence.id not in payload.evidence_ids:
            session.delete(evidence)
    claim.text = payload.text
    claim.text_hi = payload.text_hi
    claim.state = ClaimState(payload.state)
    claim.version += 1
    cluster.version += 1
    review = _queue_high_risk_review(
        session,
        cluster,
        context.user.id,
        reason="Material claim edit",
    )
    append_audit(
        session,
        actor=context.user,
        action="CLAIM_EDITED",
        entity_type="Claim",
        entity_id=claim.id,
        before=before,
        after=_snapshot(claim, ("text", "text_hi", "state", "version")),
        details={"review_id": str(review.id) if review and review.id else None},
        **_request_fields(context),
    )
    session.commit()
    session.refresh(claim)
    return claim


def draft_summary_revision(session, summary_id, payload: SummaryRevisionCreate, context):
    cid = session.scalar(select(SummaryVersion.cluster_id).where(SummaryVersion.id == summary_id))
    cluster = session.scalar(select(EventCluster).where(EventCluster.id == cid).with_for_update())
    old = session.get(SummaryVersion, summary_id)
    if not old:
        raise ApplicationError(code="summary_not_found", message="Summary not found.", status=404)
    _conflict(payload.expected_version, old.row_version)
    mapping = payload.evidence_map.model_dump(mode="json")

    def normalized_map(value):
        typed = _mapping(value)
        return (
            [(_normalized(entry.text), sorted(entry.evidence_ids)) for entry in typed.sentences]
            if typed
            else None
        )

    if (
        old.invalidated_at is None
        and _normalized(old.summary_text) == _normalized(payload.summary_text)
        and normalized_map(old.evidence_map) == normalized_map(mapping)
    ):
        return old
    latest = session.scalar(
        select(func.max(SummaryVersion.version)).where(
            SummaryVersion.cluster_id == cid, SummaryVersion.language == old.language
        )
    )
    new = SummaryVersion(
        cluster_id=cid,
        language=old.language,
        version=latest + 1,
        summary_text=payload.summary_text,
        evidence_map=mapping,
        generator_name="staff-evidence-mapped",
        decision=DecisionState.PENDING,
    )
    if not valid_evidence(session, new):
        raise ApplicationError(
            code="evidence_required",
            message="Every sentence needs valid same-cluster evidence.",
            status=409,
        )
    cluster.status = ContentStatus.HELD
    _invalidate_summaries(
        session,
        cluster,
        context,
        language=old.language,
        reason="Summary superseded; a new mapped version requires review.",
    )
    session.add(new)
    cluster.version += 1
    _queue_high_risk_review(session, cluster, context.user.id, reason="Summary revision drafted")
    session.flush()
    append_audit(
        session,
        actor=context.user,
        action="SUMMARY_REVISION_DRAFTED",
        entity_type="SummaryVersion",
        entity_id=new.id,
        after={"previous_id": str(old.id), "version": new.version},
        **_request_fields(context),
    )
    session.commit()
    return new


def decide_summary(
    session: Session,
    *,
    summary_id: uuid.UUID,
    payload: SummaryDecision,
    context: AuthenticatedStaff,
) -> SummaryVersion:
    cluster_id = session.scalar(
        select(SummaryVersion.cluster_id).where(SummaryVersion.id == summary_id)
    )
    cluster = session.scalar(
        select(EventCluster).where(EventCluster.id == cluster_id).with_for_update()
    )
    summary = session.scalar(
        select(SummaryVersion).where(SummaryVersion.id == summary_id).with_for_update()
    )
    if not summary:
        raise ApplicationError(code="summary_not_found", message="Summary not found.", status=404)
    _conflict(payload.expected_version, summary.row_version)
    if payload.decision == "APPROVED" and (
        summary.invalidated_at is not None or not valid_evidence(session, summary)
    ):
        raise ApplicationError(
            code="evidence_required",
            message="Invalidated or evidence-free summaries require a new mapped revision.",
            status=409,
        )
    before = _snapshot(summary, ("decision", "row_version", "published_at"))
    summary.decision = DecisionState(payload.decision)
    summary.reviewed_by_id = context.user.id
    summary.reviewed_at = _now()
    summary.rejection_reason = payload.notes if payload.decision == "REJECTED" else None
    summary.published_at = _now() if payload.decision == "APPROVED" else None
    summary.row_version += 1
    if cluster:
        # A review decision does not make its reviewer the author of the text.
        # Preserve the current draft's identity so its actual drafter cannot
        # regain final-approval eligibility by asking someone else to review a summary.
        draft_author = session.scalar(
            select(EditorialReview.drafted_by_id)
            .where(
                EditorialReview.cluster_id == cluster.id,
                EditorialReview.material_revision == cluster.material_revision,
                EditorialReview.superseded_at.is_(None),
            )
            .order_by(EditorialReview.created_at.desc(), EditorialReview.id)
            .limit(1)
        )
        cluster.version += 1
        _queue_high_risk_review(
            session,
            cluster,
            draft_author or context.user.id,
            reason="Summary decision",
            material_contribution=False,
        )
    append_audit(
        session,
        actor=context.user,
        action=f"SUMMARY_{payload.decision}",
        entity_type="SummaryVersion",
        entity_id=summary.id,
        before=before,
        after=_snapshot(summary, ("decision", "row_version", "published_at")),
        outcome="REJECTION" if payload.decision == "REJECTED" else "SUCCESS",
        reason=payload.notes or None,
        **_request_fields(context),
    )
    session.commit()
    session.refresh(summary)
    return summary


def decide_high_risk_review(
    session: Session,
    *,
    review_id: uuid.UUID,
    payload: ReviewDecision,
    context: AuthenticatedStaff,
) -> EditorialReview:
    cluster_id = session.scalar(
        select(EditorialReview.cluster_id).where(EditorialReview.id == review_id)
    )
    cluster = session.scalar(
        select(EventCluster).where(EventCluster.id == cluster_id).with_for_update()
    )
    review = session.scalar(
        select(EditorialReview).where(EditorialReview.id == review_id).with_for_update()
    )
    if not review:
        raise ApplicationError(code="review_not_found", message="Review not found.", status=404)
    _conflict(payload.expected_version, review.version)
    if (
        not cluster
        or review.superseded_at is not None
        or review.material_revision != cluster.material_revision
        or review.decision != DecisionState.PENDING
        or review.state != ReviewState.PENDING
        or review.drafted_by_id is None
    ):
        raise ApplicationError(
            code="stale_review",
            message="Only the current pending material revision can be reviewed.",
            status=409,
        )
    if (
        not cluster.provenance_complete
        or not _contributors(session, cluster.id)
        or not session.scalar(select(func.nuzenio_correction_lineage_complete(cluster.id)))
    ):
        raise ApplicationError(
            code="provenance_required",
            message="Legacy material authorship must be established before approval.",
            status=409,
        )
    if review.drafted_by_id == context.user.id or context.user.id in _contributors(
        session, cluster.id
    ):
        raise ApplicationError(
            code="dual_control_required",
            message="High-risk final approval must be performed by a different staff user.",
            status=409,
        )
    cluster = session.scalar(
        select(EventCluster).where(EventCluster.id == review.cluster_id).with_for_update()
    )
    if not cluster:
        raise ApplicationError(code="cluster_not_found", message="Cluster not found.", status=404)
    review.decision = DecisionState(payload.decision)
    review.state = ReviewState(payload.decision)
    review.reviewer_id = context.user.id
    review.notes = payload.notes
    review.completed_at = _now()
    review.version += 1
    cluster.review_state = ReviewState(payload.decision)
    cluster.status = (
        ContentStatus.PUBLISHED if payload.decision == "APPROVED" else ContentStatus.HELD
    )
    cluster.push_ready = False
    cluster.version += 1
    append_audit(
        session,
        actor=context.user,
        action=f"HIGH_RISK_{payload.decision}",
        entity_type="EditorialReview",
        entity_id=review.id,
        after={"cluster_id": str(cluster.id), "decision": payload.decision, "notes": payload.notes},
        approval_of_id=review.id,
        outcome="REJECTION" if payload.decision == "REJECTED" else "SUCCESS",
        reason=payload.notes,
        **_request_fields(context),
    )
    session.commit()
    session.refresh(review)
    return review


def approve_push(
    session: Session,
    *,
    review_id: uuid.UUID,
    expected_version: int,
    context: AuthenticatedStaff,
) -> EditorialReview:
    cluster_id = session.scalar(
        select(EditorialReview.cluster_id).where(EditorialReview.id == review_id)
    )
    cluster = session.scalar(
        select(EventCluster).where(EventCluster.id == cluster_id).with_for_update()
    )
    review = session.scalar(
        select(EditorialReview).where(EditorialReview.id == review_id).with_for_update()
    )
    if not review:
        raise ApplicationError(code="review_not_found", message="Review not found.", status=404)
    _conflict(expected_version, review.version)
    if (
        not cluster
        or review.superseded_at is not None
        or review.material_revision != cluster.material_revision
        or cluster.status != ContentStatus.PUBLISHED
        or cluster.review_state != ReviewState.APPROVED
        or review.push_approved_at is not None
        or not session.scalar(select(func.nuzenio_current_review(cluster.id)))
    ):
        raise ApplicationError(
            code="stale_review",
            message="Alert approval requires the current published reviewed revision.",
            status=409,
        )
    if review.decision != DecisionState.APPROVED:
        raise ApplicationError(
            code="review_not_approved",
            message="Final editorial approval is required first.",
            status=409,
        )
    if context.user.id in _contributors(session, cluster.id) | {
        review.drafted_by_id,
        review.reviewer_id,
    }:
        raise ApplicationError(
            code="dual_control_required",
            message="Alert readiness requires an additional independent approver.",
            status=409,
        )
    review.push_approved_by_id = context.user.id
    review.push_approved_at = _now()
    review.version += 1
    if cluster:
        cluster.push_ready = True
        cluster.version += 1
    append_audit(
        session,
        actor=context.user,
        action="HIGH_RISK_PUSH_READY_APPROVED",
        entity_type="EditorialReview",
        entity_id=review.id,
        approval_of_id=review.id,
        **_request_fields(context),
    )
    session.commit()
    session.refresh(review)
    return review


def attach_document(
    session: Session,
    *,
    cluster_id: uuid.UUID,
    payload: PrimaryDocumentCreate,
    context: AuthenticatedStaff,
) -> PrimaryDocument:
    cluster = session.scalar(
        select(EventCluster).where(EventCluster.id == cluster_id).with_for_update()
    )
    if not cluster:
        raise ApplicationError(code="cluster_not_found", message="Cluster not found.", status=404)
    _conflict(payload.expected_version, cluster.version)
    document = PrimaryDocument(
        cluster_id=cluster.id,
        title=payload.title,
        title_hi=payload.title_hi,
        issuer=payload.issuer,
        url=str(payload.url),
        published_at=payload.published_at,
    )
    session.add(document)
    cluster.version += 1
    _queue_high_risk_review(session, cluster, context.user.id, reason="Primary document attached")
    session.flush()
    append_audit(
        session,
        actor=context.user,
        action="PRIMARY_DOCUMENT_ATTACHED",
        entity_type="PrimaryDocument",
        entity_id=document.id,
        after={"cluster_id": str(cluster.id), "title": document.title, "url": document.url},
        **_request_fields(context),
    )
    session.commit()
    session.refresh(document)
    return document


def create_correction(
    session: Session, payload: CorrectionCreate, context: AuthenticatedStaff
) -> Correction:
    if payload.cluster_id and not session.get(EventCluster, payload.cluster_id):
        raise ApplicationError(code="cluster_not_found", message="Cluster not found.", status=404)
    if payload.article_id and not session.get(Article, payload.article_id):
        raise ApplicationError(code="article_not_found", message="Article not found.", status=404)
    correction = Correction(
        cluster_id=payload.cluster_id,
        article_id=payload.article_id,
        description=payload.description,
        description_hi=payload.description_hi,
        source_url=str(payload.source_url),
        evidence=payload.evidence,
        created_by_id=context.user.id,
        provenance_complete=True,
        version=1,
        status="OPEN",
    )
    session.add(correction)
    session.flush()
    register_contributors(session, correction, {context.user.id})
    append_audit(
        session,
        actor=context.user,
        action="CORRECTION_OPENED",
        entity_type="Correction",
        entity_id=correction.id,
        after={
            "cluster_id": str(correction.cluster_id) if correction.cluster_id else None,
            "status": correction.status,
        },
        **_request_fields(context),
    )
    session.commit()
    session.refresh(correction)
    return correction


def edit_correction_draft(session, *, correction_id, payload: CorrectionDraftUpdate, context):
    # Draft edits never lock clusters: no draft text is public. Application holds
    # all affected clusters first, then this row, and reloads it before publishing.
    correction = session.scalar(
        select(Correction).where(Correction.id == correction_id).with_for_update()
    )
    if not correction:
        raise ApplicationError(
            code="correction_not_found", message="Correction not found.", status=404
        )
    _conflict(payload.expected_version, correction.version)
    if correction.status != "OPEN":
        raise ApplicationError(
            code="correction_closed",
            message="Published corrections are immutable; open a new correction.",
            status=409,
        )
    fields = ("description", "description_hi", "source_url", "evidence")
    values = {field: getattr(payload, field) for field in fields}
    values["source_url"] = str(payload.source_url)
    if all(
        _normalized(getattr(correction, key)) == _normalized(value) for key, value in values.items()
    ):
        return correction
    before = _snapshot(correction, (*fields, "version"))
    _revision(
        session,
        entity=correction,
        entity_type="Correction",
        version=correction.version,
        snapshot=before,
        actor_id=context.user.id,
    )
    for key, value in values.items():
        setattr(correction, key, value)
    correction.version += 1
    register_contributors(session, correction, {context.user.id})
    append_audit(
        session,
        actor=context.user,
        action="CORRECTION_DRAFT_EDITED",
        entity_type="Correction",
        entity_id=correction.id,
        before=before,
        after=_snapshot(correction, (*fields, "version")),
        **_request_fields(context),
    )
    session.commit()
    session.refresh(correction)
    return correction


def apply_correction(
    session: Session,
    *,
    correction_id: uuid.UUID,
    payload: CorrectionApply,
    context: AuthenticatedStaff,
) -> Correction:
    correction = session.get(Correction, correction_id)
    if not correction:
        raise ApplicationError(
            code="correction_not_found", message="Correction not found.", status=404
        )
    original_targets = (correction.cluster_id, correction.article_id)
    affected_ids = (
        set(
            session.scalars(
                select(ClusterArticle.cluster_id).where(
                    ClusterArticle.article_id == correction.article_id
                )
            )
        )
        if correction.article_id
        else set()
    )
    if correction.cluster_id:
        affected_ids.add(correction.cluster_id)
    # Same ordered cluster-first locks as merge/split/claim/summary mutations.
    affected_clusters = list(
        session.scalars(
            select(EventCluster)
            .where(EventCluster.id.in_(affected_ids))
            .order_by(EventCluster.id)
            .with_for_update()
        )
    )
    correction = session.scalar(
        select(Correction)
        .where(Correction.id == correction_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    current_ids = (
        set(
            session.scalars(
                select(ClusterArticle.cluster_id).where(
                    ClusterArticle.article_id == correction.article_id
                )
            )
        )
        if correction.article_id
        else set()
    )
    if correction.cluster_id:
        current_ids.add(correction.cluster_id)
    if (
        original_targets != (correction.cluster_id, correction.article_id)
        or current_ids != affected_ids
    ):
        raise ApplicationError(
            code="version_conflict", message="Correction allocation changed; reload.", status=409
        )
    _conflict(payload.expected_version, correction.version)
    if correction.status == "PUBLISHED":
        raise ApplicationError(
            code="correction_closed", message="Correction is already published.", status=409
        )
    cluster = (
        session.scalar(
            select(EventCluster).where(EventCluster.id == correction.cluster_id).with_for_update()
        )
        if correction.cluster_id
        else None
    )
    article = (
        session.scalar(select(Article).where(Article.id == correction.article_id).with_for_update())
        if correction.article_id
        else None
    )
    if cluster:
        if payload.cluster_expected_version is None:
            raise ApplicationError(
                code="version_required",
                message="clusterExpectedVersion is required for a cluster correction.",
                status=422,
            )
        _conflict(payload.cluster_expected_version, cluster.version)
    if article and payload.article_title:
        _conflict(payload.article_expected_version or -1, article.version)
    if not cluster and (
        payload.headline
        or payload.headline_hi
        or payload.summary_en
        or payload.summary_hi
        or payload.claim_updates
    ):
        raise ApplicationError(
            code="cluster_target_required",
            message="Headline, claim, and summary changes require a cluster correction.",
            status=422,
        )
    # A published correction changes the cluster's factual context even without
    # replacement text. Invalidate before adding replacement draft versions.
    for affected in affected_clusters:
        _invalidate_summaries(
            session,
            affected,
            context,
            reason="Published correction requires a regenerated summary.",
        )
    version_bumped: set[uuid.UUID] = set()
    if cluster and (payload.headline or payload.headline_hi):
        _revision(
            session,
            entity=cluster,
            entity_type="EventCluster",
            version=cluster.version,
            snapshot=_snapshot(
                cluster, ("neutral_headline", "neutral_headline_hi", "status", "version")
            ),
            actor_id=context.user.id,
            correction_id=correction.id,
        )
        if payload.headline:
            cluster.neutral_headline = payload.headline
        if payload.headline_hi:
            cluster.neutral_headline_hi = payload.headline_hi
        cluster.version += 1
        version_bumped.add(cluster.id)
        session.add(
            CorrectionImpact(
                correction_id=correction.id,
                entity_type="EventCluster",
                entity_id=cluster.id,
                action="HEADLINE_UPDATED",
                completed_at=_now(),
            )
        )
    if article and payload.article_title:
        _revision(
            session,
            entity=article,
            entity_type="Article",
            version=article.version,
            snapshot=_snapshot(article, ("title", "canonical_url", "status")),
            actor_id=context.user.id,
            correction_id=correction.id,
        )
        article.title = payload.article_title
        article.title_hi = None  # Do not retain a stale machine-translated title.
        article.version += 1
        session.add(
            CorrectionImpact(
                correction_id=correction.id,
                entity_type="Article",
                entity_id=article.id,
                action="METADATA_UPDATED",
                completed_at=_now(),
            )
        )
    for update in payload.claim_updates:
        claim = session.get(Claim, update.claim_id)
        if not claim or (cluster and claim.cluster_id != cluster.id):
            raise ApplicationError(
                code="claim_not_found", message="Affected claim not found.", status=404
            )
        _conflict(update.expected_version, claim.version)
        _revision(
            session,
            entity=claim,
            entity_type="Claim",
            version=claim.version,
            snapshot=_snapshot(claim, ("text", "text_hi", "state", "version")),
            actor_id=context.user.id,
            correction_id=correction.id,
        )
        claim.text, claim.text_hi, claim.state = (
            update.text,
            update.text_hi,
            ClaimState(update.state),
        )
        claim.version += 1
        session.add(
            CorrectionImpact(
                correction_id=correction.id,
                entity_type="Claim",
                entity_id=claim.id,
                action="CLAIM_UPDATED",
                completed_at=_now(),
            )
        )
    if cluster and (payload.summary_en or payload.summary_hi):
        for language, text_value in (("en", payload.summary_en), ("hi", payload.summary_hi)):
            if not text_value:
                continue
            latest = session.scalar(
                select(SummaryVersion)
                .where(SummaryVersion.cluster_id == cluster.id, SummaryVersion.language == language)
                .order_by(SummaryVersion.version.desc())
                .limit(1)
            )
            evidence_map = latest.evidence_map if latest else {}
            new_summary = SummaryVersion(
                cluster_id=cluster.id,
                version=(latest.version + 1 if latest else 1),
                language=language,
                summary_text=text_value,
                evidence_map=evidence_map,
                generator_name="editorial-correction",
                decision=DecisionState.PENDING,
            )
            session.add(new_summary)
            session.flush()
            session.add(
                CorrectionImpact(
                    correction_id=correction.id,
                    entity_type="SummaryVersion",
                    entity_id=new_summary.id,
                    action="VERSION_CREATED",
                )
            )
        cluster.status = ContentStatus.HELD
        cluster.review_state = (
            ReviewState.PENDING if cluster.risk_level == RiskLevel.HIGH else cluster.review_state
        )
        cluster.version += 1
        version_bumped.add(cluster.id)
    if payload.remove_from_briefs:
        for affected_cluster in affected_clusters:
            briefs = list(
                session.scalars(
                    select(Brief)
                    .where(Brief.cluster_ids.contains([str(affected_cluster.id)]))
                    .with_for_update()
                )
            )
            for brief in briefs:
                _revision(
                    session,
                    entity=brief,
                    entity_type="Brief",
                    version=brief.version,
                    snapshot={"cluster_ids": brief.cluster_ids, "version": brief.version},
                    actor_id=context.user.id,
                    correction_id=correction.id,
                )
                brief.cluster_ids = [
                    key for key in brief.cluster_ids if key != str(affected_cluster.id)
                ]
                brief.version += 1
                brief.corrected_at = _now()
                session.add(
                    CorrectionImpact(
                        correction_id=correction.id,
                        entity_type="Brief",
                        entity_id=brief.id,
                        action="MEMBERSHIP_REMOVED",
                        completed_at=_now(),
                    )
                )
    # Make the retained correction internally complete inside this transaction
    # before the shared material boundary gathers ALL authors for every cluster.
    # Reader visibility remains gated until the resulting review is approved.
    now = _now()
    correction.resolution = payload.resolution
    correction.status = "PUBLISHED"
    correction.resolved_by_id = context.user.id
    correction.resolved_at = now
    correction.published_at = now
    correction.version += 1
    register_contributors(session, correction, {context.user.id})
    session.flush()
    for affected_cluster in affected_clusters:
        affected_cluster.corrected_at = _now()
        if affected_cluster.id not in version_bumped:
            affected_cluster.version += 1
            version_bumped.add(affected_cluster.id)
        _queue_high_risk_review(
            session,
            affected_cluster,
            context.user.id,
            reason="Published correction requires independent review",
        )
        session.add(
            CorrectionImpact(
                correction_id=correction.id,
                entity_type="EventCluster",
                entity_id=affected_cluster.id,
                action="CORRECTION_PROPAGATED",
                completed_at=_now(),
            )
        )
        for saved in session.scalars(
            select(SavedCluster).where(SavedCluster.cluster_id == affected_cluster.id)
        ):
            saved.offline_snapshot = {
                **saved.offline_snapshot,
                "corrected": True,
                "correctionId": str(correction.id),
            }
            saved.snapshot_version += 1
            session.add(
                CorrectionImpact(
                    correction_id=correction.id,
                    entity_type="SavedCluster",
                    entity_id=saved.id,
                    action="OFFLINE_MARKED_CORRECTED",
                    completed_at=_now(),
                )
            )
    append_audit(
        session,
        actor=context.user,
        action="CORRECTION_PUBLISHED",
        entity_type="Correction",
        entity_id=correction.id,
        after={"status": correction.status, "resolution": correction.resolution},
        **_request_fields(context),
    )
    session.commit()
    session.refresh(correction)
    return correction


def review_queue(
    session: Session, *, page: int, page_size: int, viewer_id: uuid.UUID | None = None
) -> tuple[list[dict[str, Any]], int]:
    statement = (
        select(EditorialReview)
        .where(
            EditorialReview.decision.in_([DecisionState.PENDING, DecisionState.APPROVED]),
            EditorialReview.superseded_at.is_(None),
            EditorialReview.push_approved_at.is_(None),
        )
        .order_by(EditorialReview.created_at)
    )
    total = int(session.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    reviews = list(session.scalars(statement.offset((page - 1) * page_size).limit(page_size)))
    clusters = {
        item.id: item
        for item in session.scalars(
            select(EventCluster).where(
                EventCluster.id.in_([review.cluster_id for review in reviews])
            )
        )
    }
    return [
        {
            "id": str(review.id),
            "clusterId": str(review.cluster_id),
            "headline": clusters[review.cluster_id].neutral_headline,
            "riskCategory": review.risk_category,
            "reason": review.reason,
            "draftedById": str(review.drafted_by_id) if review.drafted_by_id else None,
            "contributorIds": [
                str(value) for value in sorted(_contributors(session, review.cluster_id))
            ],
            "provenanceComplete": clusters[review.cluster_id].provenance_complete,
            "approvalEligible": bool(
                viewer_id
                and clusters[review.cluster_id].provenance_complete
                and _contributors(session, review.cluster_id)
                and viewer_id
                not in _contributors(session, review.cluster_id) | {review.drafted_by_id}
            ),
            "pushEligible": bool(
                viewer_id
                and clusters[review.cluster_id].provenance_complete
                and _contributors(session, review.cluster_id)
                and viewer_id
                not in _contributors(session, review.cluster_id)
                | {review.drafted_by_id, review.reviewer_id}
            ),
            "reviewerId": str(review.reviewer_id) if review.reviewer_id else None,
            "decision": review.decision.value,
            "version": review.version,
            "createdAt": review.created_at.isoformat(),
        }
        for review in reviews
    ], total
