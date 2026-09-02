from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from nuzenio_api.config import get_settings
from nuzenio_api.demo_data import DEMO_CLUSTERS
from nuzenio_api.pipeline.demo import (
    DeterministicCanonicalizer,
    DeterministicClassifier,
    DeterministicDuplicateDetector,
    DeterministicEventClusterer,
    duplicate_groups,
)
from nuzenio_api.pipeline.interfaces import PipelineArticle
from nuzenio_api.schemas import (
    AdminActionResponse,
    ClusterMergeRequest,
    ClusterSplitRequest,
    ClusterSummary,
    HealthResponse,
    PipelinePreviewRequest,
    PipelinePreviewResponse,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Database and Redis clients will be initialised here when persistence is enabled.
    yield


app = FastAPI(
    title="Nuzenio Content API",
    version="0.1.0",
    description=(
        "Approved-feed ingestion, evidence mapping and story-cluster APIs. "
        "The default provider is deterministic and uses demonstration data."
    ),
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="nuzenio-api", demo_mode=settings.demo_mode)


@app.get("/v1/demo/clusters", response_model=list[ClusterSummary], tags=["demo"])
def list_demo_clusters() -> list[ClusterSummary]:
    return DEMO_CLUSTERS


@app.get("/v1/demo/clusters/{slug}", response_model=ClusterSummary, tags=["demo"])
def get_demo_cluster(slug: str) -> ClusterSummary:
    cluster = next((item for item in DEMO_CLUSTERS if item.slug == slug), None)
    if not cluster:
        raise HTTPException(status_code=404, detail="cluster not found")
    return cluster


@app.post("/v1/pipeline/preview", response_model=PipelinePreviewResponse, tags=["pipeline"])
def preview_pipeline(payload: PipelinePreviewRequest) -> PipelinePreviewResponse:
    canonicalizer = DeterministicCanonicalizer()
    detector = DeterministicDuplicateDetector()
    clusterer = DeterministicEventClusterer()
    classifier = DeterministicClassifier()
    articles = [
        PipelineArticle(
            article_id=item.article_id,
            publisher_organization_id=item.publisher_organization_id,
            url=str(item.url),
            title=item.title,
            excerpt=item.excerpt,
            language=item.language,
            approved_feed=item.approved_feed,
        )
        for item in payload.articles
    ]
    approved = [article for article in articles if article.approved_feed]
    suppressed = [article.article_id for article in articles if not article.approved_feed]
    duplicates = duplicate_groups(approved, detector)
    duplicate_ids = {article_id for group in duplicates for article_id in group[1:]}
    unique_articles = [article for article in approved if article.article_id not in duplicate_ids]
    syndicated_pairs = [
        (left.article_id, right.article_id)
        for index, left in enumerate(unique_articles)
        for right in unique_articles[index + 1 :]
        if detector.is_syndicated_copy(left, right)
    ]
    proposed_clusters = [
        [article.article_id for article in group] for group in clusterer.cluster(unique_articles)
    ]
    classification = classifier.classify(unique_articles)
    return PipelinePreviewResponse(
        canonical_urls={
            article.article_id: canonicalizer.canonicalize(article.url) for article in approved
        },
        exact_duplicate_groups=duplicates,
        syndicated_copy_pairs=syndicated_pairs,
        proposed_clusters=proposed_clusters,
        review_required=classification.editorial_review_required,
        suppressed_article_ids=suppressed,
    )


@app.post("/v1/admin/clusters/merge-preview", response_model=AdminActionResponse, tags=["admin"])
def merge_preview(payload: ClusterMergeRequest) -> AdminActionResponse:
    return AdminActionResponse(
        action="MERGE_PREVIEW",
        cluster_ids=[*payload.cluster_ids, payload.target_slug],
        article_groups=[],
    )


@app.post("/v1/admin/clusters/split-preview", response_model=AdminActionResponse, tags=["admin"])
def split_preview(payload: ClusterSplitRequest) -> AdminActionResponse:
    return AdminActionResponse(
        action="SPLIT_PREVIEW",
        cluster_ids=[payload.cluster_id],
        article_groups=payload.groups,
    )
