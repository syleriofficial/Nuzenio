from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from nuzenio_api.pipeline.interfaces import (
    Classification,
    EvidenceMappedSentence,
    GeneratedSummary,
    MutableCluster,
    PipelineArticle,
)

TRACKING_QUERY_KEYS = {"fbclid", "gclid", "mc_cid", "mc_eid", "ref", "source"}
HIGH_RISK_TERMS = {
    "election",
    "communal",
    "riot",
    "war",
    "evacuation",
    "public safety",
    "outbreak",
    "epidemic",
    "market crash",
    "air quality",
}
STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "for",
    "in",
    "is",
    "of",
    "on",
    "the",
    "to",
    "with",
}


def _tokens(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9₹]+", text.lower()) if token not in STOP_WORDS}


class DeterministicCanonicalizer:
    def canonicalize(self, url: str) -> str:
        parts = urlsplit(url.strip())
        host = (parts.hostname or "").lower()
        if parts.port and parts.port not in {80, 443}:
            host = f"{host}:{parts.port}"
        scheme = "https" if parts.scheme in {"http", "https"} else parts.scheme.lower()
        path = re.sub(r"/{2,}", "/", parts.path or "/")
        if path != "/":
            path = path.rstrip("/")
        query = [
            (key, value)
            for key, value in parse_qsl(parts.query, keep_blank_values=True)
            if not key.lower().startswith("utm_") and key.lower() not in TRACKING_QUERY_KEYS
        ]
        return urlunsplit((scheme, host, path, urlencode(sorted(query)), ""))


class DeterministicDuplicateDetector:
    def exact_fingerprint(self, article: PipelineArticle) -> str:
        normalized = " ".join(f"{article.title} {article.excerpt}".lower().split())
        return hashlib.sha256(normalized.encode()).hexdigest()

    def is_syndicated_copy(self, left: PipelineArticle, right: PipelineArticle) -> bool:
        left_tokens = _tokens(f"{left.title} {left.excerpt}")
        right_tokens = _tokens(f"{right.title} {right.excerpt}")
        if not left_tokens or not right_tokens:
            return False
        similarity = len(left_tokens & right_tokens) / len(left_tokens | right_tokens)
        return (
            similarity >= 0.72 and left.publisher_organization_id != right.publisher_organization_id
        )


class DeterministicEventClusterer:
    threshold = 0.30

    def cluster(self, articles: list[PipelineArticle]) -> list[list[PipelineArticle]]:
        groups: list[list[PipelineArticle]] = []
        for article in articles:
            article_tokens = _tokens(f"{article.title} {article.excerpt}")
            for group in groups:
                representative = group[0]
                representative_tokens = _tokens(f"{representative.title} {representative.excerpt}")
                similarity = len(article_tokens & representative_tokens) / max(
                    1, len(article_tokens | representative_tokens)
                )
                if similarity >= self.threshold:
                    group.append(article)
                    break
            else:
                groups.append([article])
        return groups


class DeterministicClassifier:
    def classify(self, articles: list[PipelineArticle]) -> Classification:
        text = " ".join(f"{article.title} {article.excerpt}" for article in articles).lower()
        category = (
            "Technology"
            if any(term in text for term in ("software", "model", "technology", "ai"))
            else "Business"
            if any(term in text for term in ("bank", "market", "payment", "₹"))
            else "Sports"
            if any(term in text for term in ("match", "cricket", "tournament"))
            else "National"
        )
        location = (
            "Delhi NCR" if any(term in text for term in ("delhi", "gurugram", "noida")) else None
        )
        risks = tuple(sorted(term for term in HIGH_RISK_TERMS if term in text))
        return Classification(
            category=category,
            location=location,
            risk_labels=risks,
            editorial_review_required=bool(risks),
        )


class DeterministicEvidenceMapper:
    def map_sentence(self, sentence: str, articles: list[PipelineArticle]) -> tuple[str, ...]:
        sentence_tokens = _tokens(sentence)
        evidence = []
        for article in articles:
            article_tokens = _tokens(f"{article.title} {article.excerpt}")
            coverage = len(sentence_tokens & article_tokens) / max(1, len(sentence_tokens))
            if coverage >= 0.55:
                evidence.append(article.article_id)
        return tuple(evidence)


class EvidenceFirstSummaryGenerator:
    provider_name = "deterministic-evidence-first-v1"

    def generate(self, sentences: list[EvidenceMappedSentence]) -> GeneratedSummary | None:
        supported = [sentence for sentence in sentences if sentence.evidence_ids]
        if not supported:
            return None
        return GeneratedSummary(
            text=" ".join(sentence.text.strip() for sentence in supported),
            evidence_map={index: sentence.evidence_ids for index, sentence in enumerate(supported)},
            provider=self.provider_name,
        )


class LabelledDemoTranslator:
    def translate(self, text: str, source_language: str, target_language: str) -> str:
        if source_language == target_language:
            return text
        return f"[Machine translation · {source_language}→{target_language}] {text}"


class DeterministicMaterialUpdateDetector:
    def is_material_update(self, previous_claims: set[str], current_claims: set[str]) -> bool:
        added = current_claims - previous_claims
        removed = previous_claims - current_claims
        return bool(added or removed)


class InMemorySearchAdapter:
    def __init__(self) -> None:
        self.documents: dict[str, dict[str, object]] = {}

    def index_cluster(self, cluster_id: str, document: dict[str, object]) -> None:
        self.documents[cluster_id] = document

    def search(self, query: str, limit: int = 20) -> list[dict[str, object]]:
        needle = query.lower()
        return [
            document for document in self.documents.values() if needle in str(document).lower()
        ][:limit]


def independent_source_count(articles: list[PipelineArticle]) -> int:
    organizations: set[str] = set()
    for article in articles:
        if article.is_syndicated_copy:
            if article.syndication_origin_organization_id:
                organizations.add(article.syndication_origin_organization_id)
            continue
        organizations.add(article.publisher_organization_id)
    return len(organizations)


def merge_clusters(clusters: list[MutableCluster], target_id: str) -> MutableCluster:
    if len(clusters) < 2:
        raise ValueError("at least two clusters are required")
    article_ids = list(
        dict.fromkeys(article_id for cluster in clusters for article_id in cluster.article_ids)
    )
    return MutableCluster(cluster_id=target_id, article_ids=article_ids)


def split_cluster(
    cluster: MutableCluster, groups: list[list[str]], target_ids: list[str]
) -> list[MutableCluster]:
    if len(groups) < 2 or len(groups) != len(target_ids):
        raise ValueError("split requires at least two groups and one target id per group")
    flattened = [article_id for group in groups for article_id in group]
    if len(flattened) != len(set(flattened)):
        raise ValueError("article ids cannot appear in multiple groups")
    if set(flattened) != set(cluster.article_ids):
        raise ValueError("split groups must contain every cluster article exactly once")
    return [
        MutableCluster(cluster_id=target_id, article_ids=list(group))
        for target_id, group in zip(target_ids, groups, strict=True)
    ]


def duplicate_groups(
    articles: list[PipelineArticle], detector: DeterministicDuplicateDetector
) -> list[list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for article in articles:
        grouped[detector.exact_fingerprint(article)].append(article.article_id)
    return [ids for ids in grouped.values() if len(ids) > 1]
