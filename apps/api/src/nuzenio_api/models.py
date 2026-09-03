from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UUIDTimestampMixin:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FeedType(StrEnum):
    RSS = "RSS"
    API = "API"
    LICENSED = "LICENSED"
    OFFICIAL = "OFFICIAL"


class ContentStatus(StrEnum):
    INGESTED = "INGESTED"
    PUBLISHED = "PUBLISHED"
    HELD = "HELD"
    REMOVED = "REMOVED"


class ClaimState(StrEnum):
    CONFIRMED = "CONFIRMED"
    DEVELOPING = "DEVELOPING"
    DISPUTED = "DISPUTED"


class RiskLevel(StrEnum):
    STANDARD = "STANDARD"
    HIGH = "HIGH"


class ReviewState(StrEnum):
    NOT_REQUIRED = "NOT_REQUIRED"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class StaffRole(StrEnum):
    ADMINISTRATOR = "ADMINISTRATOR"
    EDITOR = "EDITOR"
    REVIEWER = "REVIEWER"
    PUBLISHER_MANAGER = "PUBLISHER_MANAGER"
    ANALYST = "ANALYST"


class OnboardingState(StrEnum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    PAUSED = "PAUSED"
    BLOCKED = "BLOCKED"
    REJECTED = "REJECTED"


class DecisionState(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class FeedRunState(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    RETRYING = "RETRYING"
    DEAD_LETTERED = "DEAD_LETTERED"
    SKIPPED = "SKIPPED"


class PublisherOrganization(UUIDTimestampMixin, Base):
    __tablename__ = "publisher_organizations"
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    ownership: Mapped[str] = mapped_column(String(300), default="")
    correction_policy: Mapped[str] = mapped_column(Text, default="")
    country_code: Mapped[str] = mapped_column(String(2), default="IN")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    onboarding_state: Mapped[OnboardingState] = mapped_column(
        Enum(OnboardingState, native_enum=False, length=32), default=OnboardingState.DRAFT
    )
    contact_name: Mapped[str] = mapped_column(String(200), default="")
    contact_email: Mapped[str] = mapped_column(String(320), default="")
    correction_route: Mapped[str] = mapped_column(String(1000), default="")
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("staff_users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)
    domains: Mapped[list[PublisherDomain]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    rights_policies: Mapped[list[RightsPolicy]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    feeds: Mapped[list[SourceFeed]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    articles: Mapped[list[Article]] = relationship(back_populates="publisher_organization")


class PublisherDomain(UUIDTimestampMixin, Base):
    __tablename__ = "publisher_domains"
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("publisher_organizations.id", ondelete="CASCADE"), index=True
    )
    domain: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    onboarding_state: Mapped[OnboardingState] = mapped_column(
        Enum(OnboardingState, native_enum=False, length=32), default=OnboardingState.DRAFT
    )
    ownership_evidence: Mapped[str] = mapped_column(Text, default="")
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("staff_users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)
    organization: Mapped[PublisherOrganization] = relationship(back_populates="domains")


class RightsPolicy(UUIDTimestampMixin, Base):
    __tablename__ = "rights_policies"
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("publisher_organizations.id", ondelete="CASCADE"), index=True
    )
    policy_name: Mapped[str] = mapped_column(String(160))
    may_store_full_text: Mapped[bool] = mapped_column(Boolean, default=False)
    may_store_excerpt: Mapped[bool] = mapped_column(Boolean, default=True)
    may_summarize: Mapped[bool] = mapped_column(Boolean, default=True)
    may_use_headline: Mapped[bool] = mapped_column(Boolean, default=True)
    may_use_thumbnail: Mapped[bool] = mapped_column(Boolean, default=False)
    may_translate: Mapped[bool] = mapped_column(Boolean, default=False)
    may_generate_audio: Mapped[bool] = mapped_column(Boolean, default=False)
    may_display_full_text: Mapped[bool] = mapped_column(Boolean, default=False)
    attribution_required: Mapped[bool] = mapped_column(Boolean, default=True)
    terms_url: Mapped[str | None] = mapped_column(String(1000))
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    onboarding_state: Mapped[OnboardingState] = mapped_column(
        Enum(OnboardingState, native_enum=False, length=32), default=OnboardingState.DRAFT
    )
    evidence_url: Mapped[str | None] = mapped_column(String(1000))
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("staff_users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    effective_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)
    organization: Mapped[PublisherOrganization] = relationship(back_populates="rights_policies")
    feeds: Mapped[list[SourceFeed]] = relationship(back_populates="rights_policy")


class SourceFeed(UUIDTimestampMixin, Base):
    __tablename__ = "source_feeds"
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("publisher_organizations.id", ondelete="CASCADE"), index=True
    )
    rights_policy_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rights_policies.id"))
    domain_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("publisher_domains.id"))
    name: Mapped[str] = mapped_column(String(200))
    feed_type: Mapped[FeedType] = mapped_column(Enum(FeedType))
    url: Mapped[str] = mapped_column(String(1000), unique=True)
    language: Mapped[str] = mapped_column(String(12), default="en")
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    onboarding_state: Mapped[OnboardingState] = mapped_column(
        Enum(OnboardingState, native_enum=False, length=32), default=OnboardingState.DRAFT
    )
    paused_reason: Mapped[str | None] = mapped_column(Text)
    kill_switch: Mapped[bool] = mapped_column(Boolean, default=False)
    poll_interval_seconds: Mapped[int] = mapped_column(Integer, default=900)
    rate_limit_per_minute: Mapped[int] = mapped_column(Integer, default=6)
    etag: Mapped[str | None] = mapped_column(String(500))
    last_modified: Mapped[str | None] = mapped_column(String(500))
    next_poll_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    health_status: Mapped[str] = mapped_column(String(32), default="UNKNOWN")
    organization: Mapped[PublisherOrganization] = relationship(back_populates="feeds")
    rights_policy: Mapped[RightsPolicy] = relationship(back_populates="feeds")
    articles: Mapped[list[Article]] = relationship(back_populates="feed")


class Article(UUIDTimestampMixin, Base):
    __tablename__ = "articles"
    feed_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("source_feeds.id"), index=True)
    publisher_organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("publisher_organizations.id"), index=True
    )
    canonical_url: Mapped[str] = mapped_column(String(1400), unique=True)
    title: Mapped[str] = mapped_column(String(600))
    title_hi: Mapped[str | None] = mapped_column(String(600))
    excerpt: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(12))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[ContentStatus] = mapped_column(
        Enum(ContentStatus), default=ContentStatus.INGESTED
    )
    source_metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)
    feed: Mapped[SourceFeed] = relationship(back_populates="articles")
    publisher_organization: Mapped[PublisherOrganization] = relationship(back_populates="articles")
    fingerprint: Mapped[ArticleFingerprint | None] = relationship(
        back_populates="article", cascade="all, delete-orphan", uselist=False
    )
    cluster_memberships: Mapped[list[ClusterArticle]] = relationship(back_populates="article")
    evidence: Mapped[list[ClaimEvidence]] = relationship(back_populates="article")
    corrections: Mapped[list[Correction]] = relationship(back_populates="article")


class ArticleFingerprint(UUIDTimestampMixin, Base):
    __tablename__ = "article_fingerprints"
    article_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), unique=True
    )
    exact_hash: Mapped[str] = mapped_column(String(64), index=True)
    normalized_url_hash: Mapped[str] = mapped_column(String(64), index=True)
    simhash: Mapped[str | None] = mapped_column(String(32), index=True)
    syndication_group: Mapped[str | None] = mapped_column(String(64), index=True)
    article: Mapped[Article] = relationship(back_populates="fingerprint")


class EventCluster(UUIDTimestampMixin, Base):
    __tablename__ = "event_clusters"
    slug: Mapped[str] = mapped_column(String(300), unique=True, index=True)
    neutral_headline: Mapped[str] = mapped_column(String(600))
    neutral_headline_hi: Mapped[str] = mapped_column(String(600))
    category: Mapped[str] = mapped_column(String(80), index=True)
    location: Mapped[str | None] = mapped_column(String(160), index=True)
    status: Mapped[ContentStatus] = mapped_column(Enum(ContentStatus), default=ContentStatus.HELD)
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), default=RiskLevel.STANDARD)
    review_state: Mapped[ReviewState] = mapped_column(
        Enum(ReviewState), default=ReviewState.NOT_REQUIRED
    )
    event_embedding: Mapped[list[float] | None] = mapped_column(Vector(768))
    version: Mapped[int] = mapped_column(Integer, default=1)
    material_revision: Mapped[int] = mapped_column(Integer, default=1)
    suppressed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suppression_reason: Mapped[str | None] = mapped_column(Text)
    corrected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    push_ready: Mapped[bool] = mapped_column(Boolean, default=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, index=True)
    timeline_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    why_shown: Mapped[str] = mapped_column(Text, default="")
    why_shown_hi: Mapped[str] = mapped_column(Text, default="")
    articles: Mapped[list[ClusterArticle]] = relationship(
        back_populates="cluster", cascade="all, delete-orphan"
    )
    claims: Mapped[list[Claim]] = relationship(
        back_populates="cluster", cascade="all, delete-orphan"
    )
    summaries: Mapped[list[SummaryVersion]] = relationship(
        back_populates="cluster", cascade="all, delete-orphan"
    )
    primary_documents: Mapped[list[PrimaryDocument]] = relationship(
        back_populates="cluster", cascade="all, delete-orphan"
    )
    corrections: Mapped[list[Correction]] = relationship(back_populates="cluster")
    __table_args__ = (Index("ix_event_cluster_category_location", "category", "location"),)


class ClusterArticle(UUIDTimestampMixin, Base):
    __tablename__ = "cluster_articles"
    cluster_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_clusters.id", ondelete="CASCADE"), index=True
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), index=True
    )
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_syndicated_copy: Mapped[bool] = mapped_column(Boolean, default=False)
    cluster: Mapped[EventCluster] = relationship(back_populates="articles")
    article: Mapped[Article] = relationship(back_populates="cluster_memberships")
    __table_args__ = (UniqueConstraint("cluster_id", "article_id", name="uq_cluster_article"),)


class Claim(UUIDTimestampMixin, Base):
    __tablename__ = "claims"
    cluster_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_clusters.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(Text)
    text_hi: Mapped[str] = mapped_column(Text)
    state: Mapped[ClaimState] = mapped_column(Enum(ClaimState), index=True)
    materiality: Mapped[int] = mapped_column(Integer, default=1)
    version: Mapped[int] = mapped_column(Integer, default=1)
    cluster: Mapped[EventCluster] = relationship(back_populates="claims")
    evidence: Mapped[list[ClaimEvidence]] = relationship(
        back_populates="claim", cascade="all, delete-orphan"
    )


class PrimaryDocument(UUIDTimestampMixin, Base):
    __tablename__ = "primary_documents"
    cluster_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_clusters.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(600))
    title_hi: Mapped[str | None] = mapped_column(String(600))
    issuer: Mapped[str] = mapped_column(String(300))
    url: Mapped[str] = mapped_column(String(1400), unique=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    document_hash: Mapped[str | None] = mapped_column(String(64))
    version: Mapped[int] = mapped_column(Integer, default=1)
    cluster: Mapped[EventCluster] = relationship(back_populates="primary_documents")
    evidence: Mapped[list[ClaimEvidence]] = relationship(back_populates="primary_document")


class ClaimEvidence(UUIDTimestampMixin, Base):
    __tablename__ = "claim_evidence"
    claim_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("claims.id", ondelete="CASCADE"), index=True
    )
    article_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), index=True
    )
    primary_document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("primary_documents.id", ondelete="CASCADE"), index=True
    )
    locator: Mapped[str] = mapped_column(String(500))
    support_score: Mapped[float] = mapped_column(Float, default=1.0)
    claim: Mapped[Claim] = relationship(back_populates="evidence")
    article: Mapped[Article | None] = relationship(back_populates="evidence")
    primary_document: Mapped[PrimaryDocument | None] = relationship(back_populates="evidence")
    __table_args__ = (
        CheckConstraint(
            "num_nonnulls(article_id, primary_document_id) = 1",
            name="ck_claim_evidence_one_source",
        ),
        CheckConstraint(
            "support_score >= 0 AND support_score <= 1",
            name="ck_claim_evidence_support_score",
        ),
    )


class SummaryVersion(UUIDTimestampMixin, Base):
    __tablename__ = "summary_versions"
    cluster_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_clusters.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer)
    language: Mapped[str] = mapped_column(String(12))
    summary_text: Mapped[str] = mapped_column(Text)
    evidence_map: Mapped[dict[str, Any]] = mapped_column(JSONB)
    generator_name: Mapped[str] = mapped_column(String(100))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision: Mapped[DecisionState] = mapped_column(
        Enum(DecisionState, native_enum=False, length=32), default=DecisionState.PENDING
    )
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("staff_users.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    row_version: Mapped[int] = mapped_column(Integer, default=1)
    cluster: Mapped[EventCluster] = relationship(back_populates="summaries")
    __table_args__ = (
        UniqueConstraint("cluster_id", "version", "language", name="uq_summary_version_language"),
    )


class Correction(UUIDTimestampMixin, Base):
    __tablename__ = "corrections"
    cluster_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("event_clusters.id"), index=True
    )
    article_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("articles.id"), index=True)
    description: Mapped[str] = mapped_column(Text)
    description_hi: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="OPEN")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_url: Mapped[str] = mapped_column(String(1400), default="")
    evidence: Mapped[str] = mapped_column(Text, default="")
    resolution: Mapped[str | None] = mapped_column(Text)
    raised_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id"))
    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    cluster: Mapped[EventCluster | None] = relationship(back_populates="corrections")
    article: Mapped[Article | None] = relationship(back_populates="corrections")


class UserPreference(UUIDTimestampMixin, Base):
    __tablename__ = "user_preferences"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, index=True)
    language: Mapped[str] = mapped_column(String(12), default="en")
    edition: Mapped[str] = mapped_column(String(80), default="india")
    local_area: Mapped[str | None] = mapped_column(String(160))
    theme: Mapped[str] = mapped_column(String(20), default="system")
    personalization_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    hidden_organization_ids: Mapped[list[str]] = mapped_column(JSONB, default=list)


class Follow(UUIDTimestampMixin, Base):
    __tablename__ = "follows"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    value: Mapped[str] = mapped_column(String(300))
    __table_args__ = (UniqueConstraint("user_id", "kind", "value", name="uq_follow"),)


class SavedCluster(UUIDTimestampMixin, Base):
    __tablename__ = "saved_clusters"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    cluster_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_clusters.id", ondelete="CASCADE"), index=True
    )
    offline_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    snapshot_version: Mapped[int] = mapped_column(Integer, default=1)
    __table_args__ = (UniqueConstraint("user_id", "cluster_id", name="uq_saved_cluster"),)


class Brief(UUIDTimestampMixin, Base):
    __tablename__ = "briefs"
    edition: Mapped[str] = mapped_column(String(80), index=True)
    period: Mapped[str] = mapped_column(String(20))
    language: Mapped[str] = mapped_column(String(12))
    title: Mapped[str] = mapped_column(String(400))
    cluster_ids: Mapped[list[str]] = mapped_column(JSONB, default=list)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)
    corrected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        UniqueConstraint("edition", "period", "language", name="uq_brief_edition_period_language"),
    )


class Notification(UUIDTimestampMixin, Base):
    __tablename__ = "notifications"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    cluster_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("event_clusters.id"), index=True
    )
    kind: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(400))
    body: Mapped[str] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class EditorialReview(UUIDTimestampMixin, Base):
    __tablename__ = "editorial_reviews"
    cluster_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_clusters.id", ondelete="CASCADE"), index=True
    )
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel))
    reason: Mapped[str] = mapped_column(Text)
    state: Mapped[ReviewState] = mapped_column(Enum(ReviewState), default=ReviewState.PENDING)
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    risk_category: Mapped[str] = mapped_column(String(80), default="")
    drafted_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id"))
    decision: Mapped[DecisionState] = mapped_column(
        Enum(DecisionState, native_enum=False, length=32), default=DecisionState.PENDING
    )
    notes: Mapped[str] = mapped_column(Text, default="")
    push_approved_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id"))
    push_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)
    material_revision: Mapped[int] = mapped_column(Integer, default=1)
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditLog(UUIDTimestampMixin, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(100), index=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    actor_role: Mapped[str | None] = mapped_column(String(40), index=True)
    before_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    after_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    request_id: Mapped[str] = mapped_column(String(80), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    approval_of_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    outcome: Mapped[str] = mapped_column(String(32), default="SUCCESS", index=True)
    reason: Mapped[str | None] = mapped_column(Text)


class StaffUser(UUIDTimestampMixin, Base):
    __tablename__ = "staff_users"
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(500))
    role: Mapped[StaffRole] = mapped_column(
        Enum(StaffRole, native_enum=False, length=40), index=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    password_changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)


class StaffSession(UUIDTimestampMixin, Base):
    __tablename__ = "staff_sessions"
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("staff_users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    ip_address: Mapped[str | None] = mapped_column(String(80))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    user: Mapped[StaffUser] = relationship()


class LoginThrottle(UUIDTimestampMixin, Base):
    __tablename__ = "login_throttles"
    subject_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    window_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class AuthenticationEvent(UUIDTimestampMixin, Base):
    __tablename__ = "authentication_events"
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id"), index=True)
    username_hash: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(40), index=True)
    successful: Mapped[bool] = mapped_column(Boolean, index=True)
    reason: Mapped[str | None] = mapped_column(String(160))
    request_id: Mapped[str] = mapped_column(String(80), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    user_agent: Mapped[str | None] = mapped_column(String(500))


class EditionControl(UUIDTimestampMixin, Base):
    __tablename__ = "edition_controls"
    edition: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    paused: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)


class FeedRun(UUIDTimestampMixin, Base):
    __tablename__ = "feed_runs"
    feed_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("source_feeds.id"), index=True)
    state: Mapped[FeedRunState] = mapped_column(
        Enum(FeedRunState, native_enum=False, length=32), index=True
    )
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    http_status: Mapped[int | None] = mapped_column(Integer)
    fetched_bytes: Mapped[int] = mapped_column(Integer, default=0)
    parsed_items: Mapped[int] = mapped_column(Integer, default=0)
    new_articles: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    error_code: Mapped[str | None] = mapped_column(String(100))
    internal_error: Mapped[str | None] = mapped_column(Text)
    request_id: Mapped[str] = mapped_column(String(80), index=True)
    manual_actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id"))
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    lease_token: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        Index(
            "uq_feed_run_active",
            "feed_id",
            unique=True,
            postgresql_where=text("state IN ('QUEUED','RUNNING','RETRYING')"),
        ),
    )


class FeedControl(Base):
    __tablename__ = "feed_controls"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    paused: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    __table_args__ = (CheckConstraint("id = 1", name="ck_feed_control_singleton"),)


class DeadLetterJob(UUIDTimestampMixin, Base):
    __tablename__ = "dead_letter_jobs"
    feed_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("feed_runs.id"), unique=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    reason: Mapped[str] = mapped_column(Text)
    retried_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ContentRevision(UUIDTimestampMixin, Base):
    __tablename__ = "content_revisions"
    entity_type: Mapped[str] = mapped_column(String(80), index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    entity_version: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)
    correction_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("corrections.id"))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("staff_users.id"))
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "entity_version", name="uq_content_revision"),
    )


class CorrectionImpact(UUIDTimestampMixin, Base):
    __tablename__ = "correction_impacts"
    correction_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("corrections.id", ondelete="CASCADE"), index=True
    )
    entity_type: Mapped[str] = mapped_column(String(80), index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    action: Mapped[str] = mapped_column(String(80))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
