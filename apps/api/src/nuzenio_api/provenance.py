"""Shared append-only material-provenance boundary.

Callers hold the affected cluster locks (sorted UUID order) or an unpublished
correction's lock. Actor IDs come only from authentication or persisted lineage.
No commit here: lineage, mutation, review and audit share the caller's transaction.
"""

import uuid
from collections.abc import Iterable

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from nuzenio_api.models import (
    ClusterArticle,
    Correction,
    CorrectionContributor,
    EventCluster,
    MaterialContributor,
)

type ProvenanceTarget = EventCluster | Correction


def _mapping(record: ProvenanceTarget):
    if isinstance(record, EventCluster):
        return (
            MaterialContributor,
            "cluster_id",
            "first_material_revision",
            record.material_revision,
        )
    if isinstance(record, Correction):
        return CorrectionContributor, "correction_id", "first_version", record.version
    raise TypeError("Unsupported material provenance target")


def contributor_ids(session: Session, record: ProvenanceTarget) -> set[uuid.UUID]:
    model, field, _, _ = _mapping(record)
    return set(
        session.scalars(select(model.staff_user_id).where(getattr(model, field) == record.id))
    )


def register_contributors(
    session: Session, record: ProvenanceTarget, actor_ids: Iterable[uuid.UUID]
) -> None:
    model, field, revision_field, revision = _mapping(record)
    for actor_id in sorted(set(actor_ids)):
        if actor_id is None:
            raise ValueError("Unknown contributors cannot be fabricated")
        session.execute(
            insert(model)
            .values(
                **{
                    field: record.id,
                    "staff_user_id": actor_id,
                    revision_field: revision,
                }
            )
            .on_conflict_do_nothing(index_elements=[field, "staff_user_id"])
        )


def inherit_published_corrections(session: Session, cluster: EventCluster) -> None:
    """Every material mutation accounts for all currently retained corrections."""
    corrections = session.scalars(
        select(Correction).where(
            Correction.status == "PUBLISHED",
            or_(
                Correction.cluster_id == cluster.id,
                Correction.article_id.in_(
                    select(ClusterArticle.article_id).where(ClusterArticle.cluster_id == cluster.id)
                ),
            ),
        )
    )
    for correction in corrections:
        authors = contributor_ids(session, correction)
        required = {correction.created_by_id, correction.resolved_by_id} - {None}
        if not correction.provenance_complete or not required.issubset(authors):
            cluster.provenance_complete = False
        register_contributors(session, cluster, authors)
