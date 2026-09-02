import uuid
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from nuzenio_api.admin_routes import router as admin_router
from nuzenio_api.auth import AuthenticatedStaff, require_permission
from nuzenio_api.config import get_settings
from nuzenio_api.db import get_db
from nuzenio_api.errors import register_error_handlers
from nuzenio_api.permissions import Permission
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
    BriefRead,
    ClusterDetail,
    ClusterMergeRequest,
    ClusterPage,
    ClusterSplitRequest,
    ErrorResponse,
    HealthResponse,
    PipelinePreviewRequest,
    PipelinePreviewResponse,
    SourceProfileRead,
)
from nuzenio_api.services import ReaderService

settings = get_settings()
LanguageParam = Annotated[Literal["en", "hi"], Query(description="Response language")]
PageParam = Annotated[int, Query(ge=1, description="One-based result page")]
PageSizeParam = Annotated[
    int,
    Query(ge=1, le=settings.max_page_size, description="Results per page"),
]
StoryStatusParam = Annotated[
    Literal["VERIFIED", "DEVELOPING", "DISPUTED"] | None,
    Query(description="Filter by derived cluster state"),
]
SessionDep = Annotated[Session, Depends(get_db)]
ERROR_RESPONSES = {
    404: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
}

app = FastAPI(
    title="Nuzenio Reader API",
    version="0.3.0",
    description=(
        "Persistent reader contracts for approved-feed, evidence-backed fictional "
        "story clusters. Nuzenio does not publish original news."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "X-CSRF-Token", "X-Request-ID"],
)
register_error_handlers(app)
app.include_router(admin_router)


@app.middleware("http")
async def correlation_id(request: Request, call_next):
    candidate = request.headers.get("x-request-id", "")
    request.state.request_id = (
        candidate[:80]
        if candidate and all(character.isalnum() or character in "-_." for character in candidate)
        else str(uuid.uuid4())
    )
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health(session: SessionDep) -> HealthResponse:
    session.execute(text("SELECT 1"))
    return HealthResponse(
        status="ok",
        service="nuzenio-api",
        version=app.version,
        persistence="postgresql",
        cache="redis-ready",
    )


@app.get(
    "/v1/feed/top",
    response_model=ClusterPage,
    responses=ERROR_RESPONSES,
    tags=["reader"],
)
def top_feed(
    session: SessionDep,
    language: LanguageParam = "en",
    page: PageParam = 1,
    page_size: PageSizeParam = 10,
    category: Annotated[str | None, Query(max_length=80)] = None,
    status: StoryStatusParam = None,
) -> ClusterPage:
    return ReaderService(session).feed(
        language=language,
        page=page,
        page_size=page_size,
        category=category,
        status=status,
    )


@app.get(
    "/v1/feed/local",
    response_model=ClusterPage,
    responses=ERROR_RESPONSES,
    tags=["reader"],
)
def local_feed(
    session: SessionDep,
    language: LanguageParam = "en",
    page: PageParam = 1,
    page_size: PageSizeParam = 10,
    area: Annotated[str, Query(min_length=2, max_length=160)] = "Delhi NCR",
    status: StoryStatusParam = None,
) -> ClusterPage:
    return ReaderService(session).feed(
        language=language,
        page=page,
        page_size=page_size,
        location=area,
        status=status,
    )


@app.get(
    "/v1/clusters/{slug}",
    response_model=ClusterDetail,
    responses=ERROR_RESPONSES,
    tags=["reader"],
)
def cluster_detail(
    slug: str,
    session: SessionDep,
    language: LanguageParam = "en",
) -> ClusterDetail:
    return ReaderService(session).cluster(slug=slug, language=language)


@app.get(
    "/v1/sources/{slug}",
    response_model=SourceProfileRead,
    responses=ERROR_RESPONSES,
    tags=["reader"],
)
def source_profile(
    slug: str,
    session: SessionDep,
    language: LanguageParam = "en",
) -> SourceProfileRead:
    return ReaderService(session).source(slug=slug, language=language)


@app.get(
    "/v1/search",
    response_model=ClusterPage,
    responses=ERROR_RESPONSES,
    tags=["reader"],
)
def search(
    q: Annotated[str, Query(min_length=1, max_length=200)],
    session: SessionDep,
    language: LanguageParam = "en",
    page: PageParam = 1,
    page_size: PageSizeParam = 10,
    category: Annotated[str | None, Query(max_length=80)] = None,
    status: StoryStatusParam = None,
) -> ClusterPage:
    return ReaderService(session).feed(
        language=language,
        page=page,
        page_size=page_size,
        category=category,
        status=status,
        query=q,
    )


def _brief(period: Literal["morning", "evening"], language: str, session: Session) -> BriefRead:
    return ReaderService(session).brief(period=period, language=language)


@app.get(
    "/v1/briefs/morning",
    response_model=BriefRead,
    responses=ERROR_RESPONSES,
    tags=["reader"],
)
def morning_brief(session: SessionDep, language: LanguageParam = "en") -> BriefRead:
    return _brief("morning", language, session)


@app.get(
    "/v1/briefs/evening",
    response_model=BriefRead,
    responses=ERROR_RESPONSES,
    tags=["reader"],
)
def evening_brief(session: SessionDep, language: LanguageParam = "en") -> BriefRead:
    return _brief("evening", language, session)


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
def merge_preview(
    payload: ClusterMergeRequest,
    _: Annotated[
        AuthenticatedStaff,
        Depends(require_permission(Permission.CLUSTER_EDIT, csrf=True)),
    ],
) -> AdminActionResponse:
    return AdminActionResponse(
        action="MERGE_PREVIEW",
        cluster_ids=[*payload.cluster_ids, payload.target_slug],
        article_groups=[],
    )


@app.post("/v1/admin/clusters/split-preview", response_model=AdminActionResponse, tags=["admin"])
def split_preview(
    payload: ClusterSplitRequest,
    _: Annotated[
        AuthenticatedStaff,
        Depends(require_permission(Permission.CLUSTER_EDIT, csrf=True)),
    ],
) -> AdminActionResponse:
    return AdminActionResponse(
        action="SPLIT_PREVIEW",
        cluster_ids=[payload.cluster_id],
        article_groups=payload.groups,
    )
