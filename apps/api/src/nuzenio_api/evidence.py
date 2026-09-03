"""Structural provenance validation, NOT verification of truth or entailment."""

import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from nuzenio_api.models import Claim, ClaimEvidence, ClusterArticle, PrimaryDocument, SummaryVersion


class SentenceEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1)
    evidence_ids: list[UUID] = Field(min_length=1)


class EvidenceMap(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sentences: list[SentenceEvidence] = Field(min_length=1)


def sentences(text: str) -> list[str]:
    return re.split(r"(?<=[.!?।])\s+", text.strip()) if text.strip() else []


def fixture_evidence(text: str, evidence_ids: list[UUID]) -> dict:
    # Only fictional fixtures use this deterministic mapping; no claim of entailment.
    return EvidenceMap(
        sentences=[
            SentenceEvidence(text=part, evidence_ids=evidence_ids) for part in sentences(text)
        ]
    ).model_dump(mode="json")


def valid_evidence(session: Session, summary: SummaryVersion) -> bool:
    try:
        mapping = EvidenceMap.model_validate(summary.evidence_map)
    except (ValidationError, TypeError):
        return False
    if [item.text for item in mapping.sentences] != sentences(summary.summary_text):
        return False
    ids = {item for sentence in mapping.sentences for item in sentence.evidence_ids}
    valid = set(
        session.scalars(
            select(ClaimEvidence.id)
            .join(Claim)
            .where(
                Claim.cluster_id == summary.cluster_id,
                ClaimEvidence.id.in_(ids),
                (
                    ClaimEvidence.article_id.in_(
                        select(ClusterArticle.article_id).where(
                            ClusterArticle.cluster_id == summary.cluster_id
                        )
                    )
                )
                | (
                    ClaimEvidence.primary_document_id.in_(
                        select(PrimaryDocument.id).where(
                            PrimaryDocument.cluster_id == summary.cluster_id
                        )
                    )
                ),
            )
        )
    )
    return ids == valid
