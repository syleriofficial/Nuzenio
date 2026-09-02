from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    demo_mode: bool


class SourceSummary(BaseModel):
    name: str
    organization_id: str
    domain: str
    headline: str
    url: HttpUrl
    language: str = "en"
    syndicated_copy: bool = False


class ClaimSummary(BaseModel):
    state: Literal["CONFIRMED", "DEVELOPING", "DISPUTED"]
    text: str
    evidence_ids: list[str] = Field(min_length=1)


class ClusterSummary(BaseModel):
    slug: str
    headline: str
    brief: str | None
    category: str
    location: str | None = None
    status: Literal["VERIFIED", "DEVELOPING", "DISPUTED"]
    independent_source_count: int = Field(ge=1)
    risk_level: Literal["STANDARD", "HIGH"]
    review_state: Literal["PUBLISHED", "EDITOR_REVIEWED"]
    sources: list[SourceSummary]
    claims: list[ClaimSummary]
    updated_at: datetime
    demonstration_data: bool = True


class IngestArticleRequest(BaseModel):
    article_id: str
    publisher_organization_id: str
    url: HttpUrl
    title: str = Field(min_length=5, max_length=600)
    excerpt: str = Field(min_length=10, max_length=5000)
    language: str = "en"
    approved_feed: bool = True


class PipelinePreviewRequest(BaseModel):
    articles: list[IngestArticleRequest] = Field(min_length=1, max_length=50)


class PipelinePreviewResponse(BaseModel):
    canonical_urls: dict[str, str]
    exact_duplicate_groups: list[list[str]]
    syndicated_copy_pairs: list[tuple[str, str]]
    proposed_clusters: list[list[str]]
    review_required: bool
    suppressed_article_ids: list[str]


class ClusterMergeRequest(BaseModel):
    cluster_ids: list[str] = Field(min_length=2, max_length=20)
    target_slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class ClusterSplitRequest(BaseModel):
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


class AdminActionResponse(BaseModel):
    action: Literal["MERGE_PREVIEW", "SPLIT_PREVIEW"]
    cluster_ids: list[str]
    article_groups: list[list[str]]
    audit_required: bool = True


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
