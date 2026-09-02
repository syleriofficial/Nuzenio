import math
from datetime import datetime
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from nuzenio_api.models import (
    Article,
    Claim,
    EventCluster,
    ReviewState,
    SummaryVersion,
)
from nuzenio_api.repositories import ReaderRepository, claim_status, independent_organization_ids
from nuzenio_api.schemas import (
    BriefRead,
    ClaimRead,
    ClusterCard,
    ClusterDetail,
    ClusterPage,
    CorrectionRead,
    EvidenceRead,
    Pagination,
    PrimaryDocumentRead,
    SourceArticle,
    SourceProfileRead,
    TimelineEntryRead,
)


class ResourceNotFoundError(Exception):
    def __init__(self, *, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _summary(cluster: EventCluster, language: str) -> tuple[SummaryVersion, bool]:
    candidates = sorted(
        (item for item in cluster.summaries if item.summary_text.strip() and item.evidence_map),
        key=lambda item: item.version,
        reverse=True,
    )
    selected = next((item for item in candidates if item.language == language), None)
    machine_translated = language == "hi"
    if selected is None:
        selected = next((item for item in candidates if item.language == "en"), None)
        machine_translated = False
    if selected is None:
        raise ResourceNotFoundError(
            code="summary_unavailable",
            message="No evidence-backed summary is available for this cluster.",
        )
    return selected, machine_translated


def _source(article: Article, *, language: str, syndicated_copy: bool) -> SourceArticle:
    organization = article.publisher_organization
    requested_hindi = language == "hi"
    translated_title = requested_hindi and bool(article.title_hi)
    headline = article.title_hi if translated_title else article.title
    domain = urlparse(article.canonical_url).hostname or ""
    short = str(article.source_metadata.get("short") or organization.name[:2]).upper()
    return SourceArticle(
        name=organization.name,
        slug=organization.slug,
        short=short,
        organization=organization.ownership,
        organization_id=organization.id,
        domain=domain,
        language="hi" if article.language.startswith("hi") else "en",
        headline=headline,
        url=article.canonical_url,
        published_at=article.published_at,
        syndicated_copy=syndicated_copy,
        machine_translated=translated_title and not article.language.startswith("hi"),
    )


def _claim(claim: Claim, *, language: str) -> ClaimRead | None:
    if not claim.evidence:
        return None
    evidence = []
    for item in claim.evidence:
        evidence.append(
            EvidenceRead(
                id=item.id,
                locator=item.locator,
                support_score=item.support_score,
                source_name=(
                    item.article.publisher_organization.name if item.article is not None else None
                ),
                source_url=(item.article.canonical_url if item.article is not None else None),
                primary_document_title=(
                    item.primary_document.title if item.primary_document is not None else None
                ),
                primary_document_url=(
                    item.primary_document.url if item.primary_document is not None else None
                ),
            )
        )
    return ClaimRead(
        id=claim.id,
        state=claim.state.value,
        text=claim.text_hi if language == "hi" else claim.text,
        evidence=evidence,
    )


def cluster_card(cluster: EventCluster, *, language: str) -> ClusterCard:
    summary, machine_translated = _summary(cluster, language)
    claims = [item for claim in cluster.claims if (item := _claim(claim, language=language))]
    sources = [
        _source(
            membership.article,
            language=language,
            syndicated_copy=membership.is_syndicated_copy,
        )
        for membership in sorted(
            cluster.articles,
            key=lambda item: (not item.is_primary, item.article.published_at),
        )
    ]
    return ClusterCard(
        slug=cluster.slug,
        category=cluster.category,
        location=cluster.location,
        headline=(cluster.neutral_headline_hi if language == "hi" else cluster.neutral_headline),
        brief=summary.summary_text,
        status=claim_status(cluster),
        updated_at=cluster.updated_at,
        independent_source_count=len(independent_organization_ids(cluster)),
        risk_level=cluster.risk_level.value,
        review_state=(
            "EDITOR_REVIEWED" if cluster.review_state == ReviewState.APPROVED else "PUBLISHED"
        ),
        sources=sources,
        claims=claims,
        why_shown=(cluster.why_shown_hi if language == "hi" else cluster.why_shown),
        language=language,
        machine_translated=machine_translated,
    )


def cluster_detail(cluster: EventCluster, *, language: str) -> ClusterDetail:
    card = cluster_card(cluster, language=language)
    timeline = [
        TimelineEntryRead(
            at=str(item["at"]),
            title=str(item["titleHi"] if language == "hi" else item["title"]),
            detail=str(item["detailHi"] if language == "hi" else item["detail"]),
        )
        for item in cluster.timeline_json
    ]
    documents = [
        PrimaryDocumentRead(
            id=document.id,
            title=(document.title_hi if language == "hi" and document.title_hi else document.title),
            issuer=document.issuer,
            url=document.url,
            published_at=document.published_at,
        )
        for document in sorted(
            cluster.primary_documents,
            key=lambda item: (
                item.published_at or datetime.min.replace(tzinfo=cluster.updated_at.tzinfo)
            ),
            reverse=True,
        )
    ]
    corrections = [
        CorrectionRead(
            id=correction.id,
            description=(
                correction.description_hi
                if language == "hi" and correction.description_hi
                else correction.description
            ),
            status=correction.status,
            published_at=correction.published_at,
        )
        for correction in sorted(
            cluster.corrections,
            key=lambda item: (
                item.published_at or datetime.min.replace(tzinfo=cluster.updated_at.tzinfo)
            ),
            reverse=True,
        )
    ]
    return ClusterDetail(
        **card.model_dump(),
        timeline=timeline,
        primary_documents=documents,
        corrections=corrections,
    )


class ReaderService:
    def __init__(self, session: Session):
        self.session = session
        self.repository = ReaderRepository(session)

    def feed(
        self,
        *,
        language: str,
        page: int,
        page_size: int,
        category: str | None = None,
        status: str | None = None,
        location: str | None = None,
        query: str | None = None,
    ) -> ClusterPage:
        with self.session.begin():
            result = self.repository.list_clusters(
                page=page,
                page_size=page_size,
                category=category,
                story_status=status,
                location=location,
                query=query,
            )
            items = [cluster_card(item, language=language) for item in result.items]
        return ClusterPage(
            items=items,
            pagination=Pagination(
                page=page,
                page_size=page_size,
                total=result.total,
                total_pages=math.ceil(result.total / page_size) if result.total else 0,
            ),
        )

    def cluster(self, *, slug: str, language: str) -> ClusterDetail:
        with self.session.begin():
            item = self.repository.get_cluster(slug)
            if item is None:
                raise ResourceNotFoundError(
                    code="cluster_not_found",
                    message=f"Story cluster '{slug}' was not found.",
                )
            return cluster_detail(item, language=language)

    def source(self, *, slug: str, language: str) -> SourceProfileRead:
        with self.session.begin():
            organization = self.repository.get_source(slug)
            if organization is None:
                raise ResourceNotFoundError(
                    code="source_not_found",
                    message=f"Source '{slug}' was not found.",
                )
            recent = self.repository.recent_clusters_for_source(organization_id=organization.id)
            rights = (
                organization.rights_policies[0].policy_name if organization.rights_policies else ""
            )
            feed_health = ", ".join(
                sorted({feed.health_status.title() for feed in organization.feeds})
            )
            languages = sorted(
                {"hi" if feed.language.startswith("hi") else "en" for feed in organization.feeds}
            )
            return SourceProfileRead(
                slug=organization.slug,
                name=organization.name,
                organization=organization.ownership,
                description=organization.description,
                languages=languages,
                domains=sorted(domain.domain for domain in organization.domains),
                ownership=organization.ownership,
                rights=rights,
                feed_health=feed_health,
                correction_policy=organization.correction_policy,
                recent_clusters=[cluster_card(item, language=language) for item in recent],
                language=language,
            )

    def brief(self, *, period: str, language: str, edition: str = "india") -> BriefRead:
        with self.session.begin():
            brief = self.repository.get_brief(
                period=period,
                language=language,
                edition=edition,
            )
            if brief is None:
                raise ResourceNotFoundError(
                    code="brief_not_found",
                    message=f"The {period} brief is not available for this edition.",
                )
            clusters = self.repository.clusters_by_slugs(brief.cluster_ids)
            if brief.published_at is None:
                raise ResourceNotFoundError(
                    code="brief_not_published",
                    message=f"The {period} brief has not been published.",
                )
            return BriefRead(
                edition=brief.edition,
                period=period,
                language=language,
                title=brief.title,
                published_at=brief.published_at,
                items=[cluster_card(item, language=language) for item in clusters],
            )
