import hmac
import logging
import uuid
from contextlib import asynccontextmanager
from time import monotonic
from typing import Annotated, Literal

import redis
from fastapi import Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.trustedhost import TrustedHostMiddleware

from nuzenio_api.admin_routes import router as admin_router
from nuzenio_api.auth import AuthenticatedStaff, require_permission
from nuzenio_api.config import get_settings
from nuzenio_api.db import get_db
from nuzenio_api.environment import is_production
from nuzenio_api.errors import register_error_handlers
from nuzenio_api.observability import (
    configure_logging,
    correlation_id_context,
    log_event,
    observe_request,
    render_metrics,
)
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
from nuzenio_api.services import ApplicationError, ReaderService

settings = get_settings()
logger = logging.getLogger(__name__)
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


@asynccontextmanager
async def lifespan(app):
    configure_logging("nuzenio-api", settings)
    if is_production(settings.environment):
        from nuzenio_api.db import engine
        from nuzenio_api.db_roles import assert_runtime_identity

        assert_runtime_identity(engine)
    log_event(logger, logging.INFO, "api_started", environment=settings.environment)
    yield
    log_event(logger, logging.INFO, "api_stopped")


app = FastAPI(
    lifespan=lifespan,
    title="Nuzenio Reader API",
    version="0.4.0",
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
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
register_error_handlers(app)
app.include_router(admin_router)


@app.middleware("http")
async def correlation_id(request: Request, call_next):
    started = monotonic()
    candidate = request.headers.get("x-request-id", "")
    request.state.request_id = (
        candidate[:80]
        if candidate and all(character.isalnum() or character in "-_." for character in candidate)
        else str(uuid.uuid4())
    )
    context_token = correlation_id_context.set(request.state.request_id)
    try:
        response = await call_next(request)
        route_object = request.scope.get("route")
        route = getattr(route_object, "path", "unmatched")
        observe_request(request.method, route, response.status_code, started)
        log_fields = {
            "method": request.method,
            "route": route,
            "status": response.status_code,
            "duration_ms": round((monotonic() - started) * 1000, 2),
        }
        if settings.log_client_ip:
            log_fields["client_ip"] = request.client.host if request.client else None
        log_event(logger, logging.INFO, "http_request_completed", **log_fields)
        response.headers["X-Request-ID"] = request.state.request_id
        if request.url.path.startswith(("/v1/", "/health", "/metrics")):
            # Reader content is live/revocable; authenticated responses are private
            # even on errors and must never be stored by browser/proxy caches.
            response.headers["Cache-Control"] = (
                "private, no-store" if request.url.path.startswith("/v1/admin") else "no-store"
            )
            response.headers["Pragma"] = "no-cache"
        return response
    except Exception:
        route_object = request.scope.get("route")
        route = getattr(route_object, "path", "unmatched")
        observe_request(request.method, route, 500, started)
        log_event(
            logger,
            logging.ERROR,
            "http_request_failed",
            method=request.method,
            route=route,
            duration_ms=round((monotonic() - started) * 1000, 2),
        )
        raise
    finally:
        correlation_id_context.reset(context_token)


def _redis_client() -> redis.Redis:
    return redis.Redis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_connect_timeout=settings.readiness_timeout_seconds,
        socket_timeout=settings.readiness_timeout_seconds,
    )


def _readiness(session: Session) -> HealthResponse:
    session.execute(text("SELECT 1"))
    try:
        if not _redis_client().ping():
            raise redis.RedisError("Redis ping returned a false value")
    except redis.RedisError as error:
        raise ApplicationError(
            code="cache_unavailable",
            message="The cache and job service is temporarily unavailable.",
            status=503,
        ) from error
    return HealthResponse(
        status="ok",
        service="nuzenio-api",
        version=app.version,
        persistence="postgresql",
        cache="redis-ready",
    )


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health(session: SessionDep) -> HealthResponse:
    return _readiness(session)


@app.get("/health/live", tags=["system"])
def liveness() -> dict[str, str]:
    return {"status": "ok", "service": "nuzenio-api", "version": app.version}


@app.get("/health/ready", response_model=HealthResponse, tags=["system"])
def readiness(session: SessionDep) -> HealthResponse:
    return _readiness(session)


@app.get("/metrics", include_in_schema=False)
def metrics(request: Request, session: SessionDep) -> Response:
    expected = settings.metrics_token.get_secret_value() if settings.metrics_token else ""
    if expected:
        scheme, _, presented = request.headers.get("authorization", "").partition(" ")
        if scheme.casefold() != "bearer" or not hmac.compare_digest(presented, expected):
            raise ApplicationError(
                code="metrics_authentication_required",
                message="Metrics authentication is required.",
                status=401,
            )
    return Response(
        render_metrics(session, _redis_client()),
        media_type="text/plain; version=0.0.4; charset=utf-8",
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
