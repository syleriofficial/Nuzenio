from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class PipelineArticle:
    article_id: str
    publisher_organization_id: str
    url: str
    title: str
    excerpt: str
    language: str = "en"
    published_at: datetime | None = None
    approved_feed: bool = True
    is_syndicated_copy: bool = False
    syndication_origin_organization_id: str | None = None


@dataclass(frozen=True)
class Classification:
    category: str
    location: str | None
    risk_labels: tuple[str, ...] = ()
    editorial_review_required: bool = False


@dataclass(frozen=True)
class EvidenceMappedSentence:
    text: str
    evidence_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class GeneratedSummary:
    text: str
    evidence_map: dict[int, tuple[str, ...]]
    provider: str


@dataclass
class MutableCluster:
    cluster_id: str
    article_ids: list[str] = field(default_factory=list)


class FeedIngestor(Protocol):
    def ingest(self, feed_url: str) -> list[PipelineArticle]: ...


class URLCanonicalizer(Protocol):
    def canonicalize(self, url: str) -> str: ...


class DuplicateDetector(Protocol):
    def exact_fingerprint(self, article: PipelineArticle) -> str: ...

    def is_syndicated_copy(self, left: PipelineArticle, right: PipelineArticle) -> bool: ...


class EventClusterer(Protocol):
    def cluster(self, articles: list[PipelineArticle]) -> list[list[PipelineArticle]]: ...


class ContentClassifier(Protocol):
    def classify(self, articles: list[PipelineArticle]) -> Classification: ...


class EvidenceMapper(Protocol):
    def map_sentence(self, sentence: str, articles: list[PipelineArticle]) -> tuple[str, ...]: ...


class SummaryGenerator(Protocol):
    def generate(self, sentences: list[EvidenceMappedSentence]) -> GeneratedSummary | None: ...


class Translator(Protocol):
    def translate(self, text: str, source_language: str, target_language: str) -> str: ...


class MaterialUpdateDetector(Protocol):
    def is_material_update(self, previous_claims: set[str], current_claims: set[str]) -> bool: ...


class SearchAdapter(Protocol):
    def index_cluster(self, cluster_id: str, document: dict[str, object]) -> None: ...

    def search(self, query: str, limit: int = 20) -> list[dict[str, object]]: ...
