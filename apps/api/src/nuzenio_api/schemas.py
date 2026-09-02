from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class APIModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        from_attributes=True,
        populate_by_name=True,
    )


Language = Literal["en", "hi"]
StoryStatus = Literal["VERIFIED", "DEVELOPING", "DISPUTED"]


class HealthResponse(APIModel):
    status: Literal["ok"]
    service: str
    version: str
    persistence: Literal["postgresql"]
    cache: Literal["redis-ready"]


class Pagination(APIModel):
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)


class SourceArticle(APIModel):
    name: str
    slug: str
    short: str
    organization: str
    organization_id: UUID
    domain: str
    language: Language
    headline: str
    url: HttpUrl
    published_at: datetime
    syndicated_copy: bool = False
    machine_translated: bool = False


class EvidenceRead(APIModel):
    id: UUID
    locator: str
    support_score: float = Field(ge=0, le=1)
    source_name: str | None = None
    source_url: HttpUrl | None = None
    primary_document_title: str | None = None
    primary_document_url: HttpUrl | None = None


class ClaimRead(APIModel):
    id: UUID
    state: Literal["CONFIRMED", "DEVELOPING", "DISPUTED"]
    text: str
    evidence: list[EvidenceRead] = Field(min_length=1)


class TimelineEntryRead(APIModel):
    at: str
    title: str
    detail: str


class PrimaryDocumentRead(APIModel):
    id: UUID
    title: str
    issuer: str
    url: HttpUrl
    published_at: datetime | None = None


class CorrectionRead(APIModel):
    id: UUID
    description: str
    status: str
    published_at: datetime | None = None
    resolution: str | None = None
    source_url: str | None = None
    evidence: str | None = None
    turnaround_seconds: float | None = None


class ClusterCard(APIModel):
    slug: str
    category: str
    location: str | None = None
    headline: str
    brief: str
    status: StoryStatus
    updated_at: datetime
    independent_source_count: int = Field(ge=1)
    risk_level: Literal["STANDARD", "HIGH"]
    review_state: Literal["PUBLISHED", "EDITOR_REVIEWED"]
    sources: list[SourceArticle]
    claims: list[ClaimRead]
    why_shown: str
    language: Language
    machine_translated: bool = False
    demonstration_data: bool = True


class ClusterDetail(ClusterCard):
    timeline: list[TimelineEntryRead]
    primary_documents: list[PrimaryDocumentRead]
    corrections: list[CorrectionRead]


class ClusterPage(APIModel):
    items: list[ClusterCard]
    pagination: Pagination


class SourceProfileRead(APIModel):
    slug: str
    name: str
    organization: str
    description: str
    languages: list[Language]
    domains: list[str]
    ownership: str
    rights: str
    feed_health: str
    correction_policy: str
    recent_clusters: list[ClusterCard]
    language: Language
    demonstration_data: bool = True


class BriefRead(APIModel):
    edition: str
    period: Literal["morning", "evening"]
    language: Language
    title: str
    published_at: datetime
    items: list[ClusterCard]
    demonstration_data: bool = True


class ErrorDetail(APIModel):
    code: str
    message: str
    status: int
    details: list[dict[str, object]] | None = None


class ErrorResponse(APIModel):
    error: ErrorDetail


class IngestArticleRequest(APIModel):
    article_id: str
    publisher_organization_id: str
    url: HttpUrl
    title: str = Field(min_length=5, max_length=600)
    excerpt: str = Field(min_length=10, max_length=5000)
    language: str = "en"
    approved_feed: bool = True


class PipelinePreviewRequest(APIModel):
    articles: list[IngestArticleRequest] = Field(min_length=1, max_length=50)


class PipelinePreviewResponse(APIModel):
    canonical_urls: dict[str, str]
    exact_duplicate_groups: list[list[str]]
    syndicated_copy_pairs: list[tuple[str, str]]
    proposed_clusters: list[list[str]]
    review_required: bool
    suppressed_article_ids: list[str]


class ClusterMergeRequest(APIModel):
    cluster_ids: list[str] = Field(min_length=2, max_length=20)
    target_slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class ClusterSplitRequest(APIModel):
    cluster_id: str
    groups: list[list[str]] = Field(min_length=2)

    @model_validator(mode="after")
    def groups_are_non_empty_and_unique(self) -> "ClusterSplitRequest":
        if any(not group for group in self.groups):
            raise ValueError("split groups cannot be empty")
        flattened = [article_id for group in self.groups for article_id in group]
        if len(flattened) != len(set(flattened)):
            raise ValueError("an article cannot appear in more than one split group")
        return self


class AdminActionResponse(APIModel):
    action: Literal["MERGE_PREVIEW", "SPLIT_PREVIEW"]
    cluster_ids: list[str]
    article_groups: list[list[str]]
    audit_required: bool = True


class ClaimSummary(APIModel):
    state: Literal["CONFIRMED", "DEVELOPING", "DISPUTED"]
    text: str
    evidence_ids: list[str] = Field(min_length=1)
