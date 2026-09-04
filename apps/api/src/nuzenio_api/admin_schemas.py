from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field, HttpUrl, model_validator

from nuzenio_api.evidence import EvidenceMap
from nuzenio_api.links import ExternalURL
from nuzenio_api.schemas import APIModel, Pagination

RoleName = Literal["ADMINISTRATOR", "EDITOR", "REVIEWER", "PUBLISHER_MANAGER", "ANALYST"]
OnboardingStateName = Literal[
    "DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "PAUSED", "BLOCKED", "REJECTED"
]


class LoginRequest(APIModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=500)


class StaffSessionRead(APIModel):
    id: UUID
    username: str
    display_name: str
    role: RoleName
    permissions: list[str]
    expires_at: datetime
    csrf_token: str | None = None


class StaffUserRead(APIModel):
    id: UUID
    username: str
    display_name: str
    role: RoleName
    active: bool
    version: int
    last_login_at: datetime | None


class StaffUserUpdate(APIModel):
    expected_version: int = Field(ge=1)
    role: RoleName | None = None
    active: bool | None = None


class VersionedMutation(APIModel):
    expected_version: int = Field(ge=1)


class ClusterHeadlineUpdate(VersionedMutation):
    headline: str = Field(min_length=5, max_length=600)
    headline_hi: str = Field(min_length=5, max_length=600)


class ClusterSuppressionUpdate(VersionedMutation):
    suppressed: bool
    reason: str = Field(min_length=5, max_length=2000)


class ClusterMergeApply(APIModel):
    target_id: UUID
    source_ids: list[UUID] = Field(min_length=1, max_length=19)
    versions: dict[str, int]

    @model_validator(mode="after")
    def target_is_not_source(self) -> ClusterMergeApply:
        if len(self.source_ids) != len(set(self.source_ids)):
            raise ValueError("source cluster IDs must be unique")
        if self.target_id in self.source_ids:
            raise ValueError("target cluster cannot also be a source cluster")
        return self


class SplitGroup(APIModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    headline: str = Field(min_length=5, max_length=600)
    headline_hi: str = Field(min_length=5, max_length=600)
    article_ids: list[UUID] = Field(min_length=1)


class ClusterSplitApply(VersionedMutation):
    groups: list[SplitGroup] = Field(min_length=2)


class ClaimUpdate(VersionedMutation):
    text: str = Field(min_length=3, max_length=5000)
    text_hi: str = Field(min_length=3, max_length=5000)
    state: Literal["CONFIRMED", "DEVELOPING", "DISPUTED"]
    evidence_ids: list[UUID] = Field(min_length=1)


class SummaryDecision(VersionedMutation):
    decision: Literal["APPROVED", "REJECTED"]
    notes: str = Field(default="", max_length=2000)


class SummaryRevisionCreate(VersionedMutation):
    summary_text: str = Field(min_length=10, max_length=5000)
    evidence_map: EvidenceMap


class ReviewDecision(VersionedMutation):
    decision: Literal["APPROVED", "REJECTED"]
    notes: str = Field(min_length=3, max_length=4000)


class PrimaryDocumentCreate(VersionedMutation):
    title: str = Field(min_length=3, max_length=600)
    title_hi: str | None = Field(default=None, max_length=600)
    issuer: str = Field(min_length=2, max_length=300)
    url: ExternalURL
    published_at: datetime | None = None


class CorrectionCreate(APIModel):
    cluster_id: UUID | None = None
    article_id: UUID | None = None
    description: str = Field(min_length=5, max_length=5000)
    description_hi: str | None = Field(default=None, max_length=5000)
    source_url: ExternalURL
    evidence: str = Field(min_length=3, max_length=5000)

    @model_validator(mode="after")
    def exactly_one_target(self) -> CorrectionCreate:
        if (self.cluster_id is None) == (self.article_id is None):
            raise ValueError("provide exactly one cluster_id or article_id")
        return self


class ClaimCorrection(APIModel):
    claim_id: UUID
    expected_version: int = Field(ge=1)
    text: str = Field(min_length=3, max_length=5000)
    text_hi: str = Field(min_length=3, max_length=5000)
    state: Literal["CONFIRMED", "DEVELOPING", "DISPUTED"]


class CorrectionApply(VersionedMutation):
    resolution: str = Field(min_length=5, max_length=5000)
    cluster_expected_version: int | None = Field(default=None, ge=1)
    article_expected_version: int | None = Field(default=None, ge=1)
    headline: str | None = Field(default=None, min_length=5, max_length=600)
    headline_hi: str | None = Field(default=None, min_length=5, max_length=600)
    article_title: str | None = Field(default=None, min_length=3, max_length=600)
    summary_en: str | None = Field(default=None, min_length=10, max_length=5000)
    summary_hi: str | None = Field(default=None, min_length=10, max_length=5000)
    claim_updates: list[ClaimCorrection] = []
    remove_from_briefs: bool = False

    @model_validator(mode="after")
    def article_version_guards_article_edit(self) -> CorrectionApply:
        if self.article_title and self.article_expected_version is None:
            raise ValueError("article_expected_version is required when article_title is provided")
        return self


class PublisherCreate(APIModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    ownership: str = Field(min_length=2, max_length=300)
    contact_name: str = Field(min_length=2, max_length=200)
    contact_email: str = Field(min_length=3, max_length=320)
    correction_route: HttpUrl


class StateTransition(VersionedMutation):
    state: OnboardingStateName
    notes: str = Field(default="", max_length=2000)
    expected_snapshot_hash: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


class DomainCreate(VersionedMutation):
    domain: str = Field(min_length=3, max_length=255, pattern=r"^[A-Za-z0-9.-]+$")
    ownership_evidence: str = Field(min_length=3, max_length=5000)


class RightsCreate(VersionedMutation):
    policy_name: str = Field(min_length=3, max_length=160)
    evidence_url: HttpUrl
    effective_at: datetime
    expires_at: datetime | None = None
    headline: bool
    snippet: bool
    thumbnail: bool = False
    generated_summary: bool
    translation: bool = False
    audio: bool = False
    full_text_storage: bool = False
    full_text_display: bool = False


class FeedCreate(VersionedMutation):
    domain_id: UUID
    rights_policy_id: UUID
    name: str = Field(min_length=3, max_length=200)
    url: HttpUrl
    language: Literal["en", "hi"]
    poll_interval_seconds: int = Field(default=900, ge=60, le=86400)
    rate_limit_per_minute: int = Field(default=6, ge=1, le=60)


class FeedPause(VersionedMutation):
    paused: bool
    reason: str = Field(min_length=3, max_length=2000)


class EditionPause(VersionedMutation):
    paused: bool
    reason: str = Field(min_length=3, max_length=2000)


class AdminEntityRead(APIModel):
    id: UUID
    entity_type: str
    version: int
    data: dict[str, Any]


class AdminPage(APIModel):
    items: list[dict[str, Any]]
    pagination: Pagination


class DryRunResult(APIModel):
    valid: bool
    issues: list[str]
    normalized_url: str
    will_fetch: bool = False


class AuditRead(APIModel):
    id: UUID
    actor_id: UUID | None
    actor_role: str | None
    action: str
    entity_type: str
    entity_id: UUID | None
    before_summary: dict[str, Any] | None
    after_summary: dict[str, Any] | None
    details: dict[str, Any]
    request_id: str
    ip_address: str | None
    user_agent: str | None
    approval_of_id: UUID | None
    outcome: str
    reason: str | None
    created_at: datetime


class AuditPage(APIModel):
    items: list[AuditRead]
    pagination: Pagination
