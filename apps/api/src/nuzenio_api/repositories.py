from dataclasses import dataclass

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from nuzenio_api.models import (
    Article,
    Brief,
    Claim,
    ClaimEvidence,
    ClaimState,
    ClusterArticle,
    ContentStatus,
    EditionControl,
    EventCluster,
    PublisherOrganization,
    ReviewState,
    RiskLevel,
    SummaryVersion,
)


@dataclass(frozen=True)
class Page:
    items: list[EventCluster]
    total: int


def _cluster_options():
    return (
        selectinload(EventCluster.articles)
        .selectinload(ClusterArticle.article)
        .selectinload(Article.publisher_organization),
        selectinload(EventCluster.articles)
        .selectinload(ClusterArticle.article)
        .selectinload(Article.feed),
        selectinload(EventCluster.articles)
        .selectinload(ClusterArticle.article)
        .selectinload(Article.corrections),
        selectinload(EventCluster.claims).selectinload(Claim.evidence),
        selectinload(EventCluster.claims)
        .selectinload(Claim.evidence)
        .selectinload(ClaimEvidence.article)
        .selectinload(Article.publisher_organization),
        selectinload(EventCluster.claims)
        .selectinload(Claim.evidence)
        .selectinload(ClaimEvidence.primary_document),
        selectinload(EventCluster.summaries),
        selectinload(EventCluster.primary_documents),
        selectinload(EventCluster.corrections),
    )


class ReaderRepository:
    def __init__(self, session: Session):
        self.session = session

    @staticmethod
    def publishable_clusters() -> Select[tuple[EventCluster]]:
        return select(EventCluster).where(
            EventCluster.status == ContentStatus.PUBLISHED,
            func.nuzenio_correction_lineage_complete(EventCluster.id),
            EventCluster.review_state.in_([ReviewState.NOT_REQUIRED, ReviewState.APPROVED]),
            or_(
                EventCluster.risk_level != RiskLevel.HIGH,
                and_(
                    EventCluster.review_state == ReviewState.APPROVED,
                    func.nuzenio_current_review(EventCluster.id),
                ),
            ),
            or_(
                ~func.lower(EventCluster.category).in_(
                    [
                        "elections",
                        "communal violence",
                        "war",
                        "terrorism",
                        "health emergencies",
                        "public safety",
                        "market-moving",
                    ]
                ),
                func.nuzenio_current_review(EventCluster.id),
            ),
        )

    @classmethod
    def reader_ready_clusters(cls, language: str = "en") -> Select[tuple[EventCluster]]:
        return cls.publishable_clusters().where(
            func.nuzenio_public_summary(EventCluster.id, language).is_not(None)
        )

    def list_clusters(
        self,
        *,
        page: int,
        page_size: int,
        category: str | None = None,
        story_status: str | None = None,
        location: str | None = None,
        query: str | None = None,
        organization_id: object | None = None,
        language: str = "en",
    ) -> Page:
        statement = self.reader_ready_clusters(language)
        if category:
            statement = statement.where(func.lower(EventCluster.category) == category.lower())
        if location:
            location_pattern = f"%{location}%"
            statement = statement.where(
                or_(
                    EventCluster.category.ilike(location_pattern),
                    EventCluster.location.ilike(location_pattern),
                )
            )
        if story_status == "DISPUTED":
            statement = statement.where(EventCluster.claims.any(Claim.state == ClaimState.DISPUTED))
        elif story_status == "DEVELOPING":
            statement = statement.where(
                EventCluster.claims.any(Claim.state == ClaimState.DEVELOPING),
                ~EventCluster.claims.any(Claim.state == ClaimState.DISPUTED),
            )
        elif story_status == "VERIFIED":
            statement = statement.where(
                ~EventCluster.claims.any(Claim.state == ClaimState.DEVELOPING),
                ~EventCluster.claims.any(Claim.state == ClaimState.DISPUTED),
            )
        if organization_id:
            statement = statement.where(
                EventCluster.articles.any(
                    ClusterArticle.article.has(Article.publisher_organization_id == organization_id)
                )
            )
        if query:
            pattern = f"%{query.strip()}%"
            statement = statement.where(
                or_(
                    EventCluster.neutral_headline.ilike(pattern),
                    EventCluster.neutral_headline_hi.ilike(pattern),
                    EventCluster.category.ilike(pattern),
                    EventCluster.location.ilike(pattern),
                    EventCluster.summaries.any(
                        and_(
                            SummaryVersion.id
                            == func.nuzenio_public_summary(EventCluster.id, language),
                            SummaryVersion.summary_text.ilike(pattern),
                        )
                    ),
                    EventCluster.articles.any(
                        ClusterArticle.article.has(
                            or_(Article.title.ilike(pattern), Article.title_hi.ilike(pattern))
                        )
                    ),
                    EventCluster.articles.any(
                        ClusterArticle.article.has(
                            Article.publisher_organization.has(
                                PublisherOrganization.name.ilike(pattern)
                            )
                        )
                    ),
                )
            )
        count_statement = select(func.count()).select_from(statement.order_by(None).subquery())
        total = int(self.session.scalar(count_statement) or 0)
        items = list(
            self.session.scalars(
                statement.options(*_cluster_options())
                .order_by(EventCluster.display_order, EventCluster.updated_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            ).unique()
        )
        return Page(items=items, total=total)

    def get_cluster(self, slug: str) -> EventCluster | None:
        statement = (
            self.publishable_clusters()
            .where(EventCluster.slug == slug)
            .options(*_cluster_options())
        )
        return self.session.scalar(statement)

    def get_source(self, slug: str) -> PublisherOrganization | None:
        return self.session.scalar(
            select(PublisherOrganization)
            .where(PublisherOrganization.slug == slug, PublisherOrganization.active.is_(True))
            .options(
                selectinload(PublisherOrganization.domains),
                selectinload(PublisherOrganization.feeds),
                selectinload(PublisherOrganization.rights_policies),
            )
        )

    def get_brief(self, *, period: str, language: str, edition: str) -> Brief | None:
        return self.session.scalar(
            select(Brief).where(
                Brief.period == period,
                Brief.language == language,
                Brief.edition == edition,
            )
        )

    def clusters_by_ids(self, ids: list[str], language: str = "en") -> list[EventCluster]:
        if not ids:
            return []
        items = list(
            self.session.scalars(
                self.reader_ready_clusters(language)
                .where(EventCluster.id.in_(ids))
                .options(*_cluster_options())
            ).unique()
        )
        by_id = {str(cluster.id): cluster for cluster in items}
        return [by_id[key] for key in ids if key in by_id]

    def recent_clusters_for_source(
        self, *, organization_id: object, limit: int = 5, language: str = "en"
    ) -> list[EventCluster]:
        return self.list_clusters(
            page=1,
            page_size=limit,
            organization_id=organization_id,
            language=language,
        ).items

    def count_cluster_entities(self) -> dict[str, int]:
        return {
            "clusters": int(self.session.scalar(select(func.count(EventCluster.id))) or 0),
            "articles": int(self.session.scalar(select(func.count(Article.id))) or 0),
            "claims": int(self.session.scalar(select(func.count(Claim.id))) or 0),
        }

    def edition_paused(self, edition: str = "india") -> bool:
        return bool(
            self.session.scalar(
                select(EditionControl.paused).where(EditionControl.edition == edition)
            )
        )


def independent_organization_ids(cluster: EventCluster) -> set[object]:
    return {
        membership.article.publisher_organization_id
        for membership in cluster.articles
        if not membership.is_syndicated_copy
    }


def claim_status(cluster: EventCluster) -> str:
    states = {claim.state for claim in cluster.claims}
    if ClaimState.DISPUTED in states:
        return "DISPUTED"
    if ClaimState.DEVELOPING in states:
        return "DEVELOPING"
    return "VERIFIED"


def is_publishable(cluster: EventCluster) -> bool:
    return bool(
        cluster.status == ContentStatus.PUBLISHED
        and cluster.review_state in {ReviewState.NOT_REQUIRED, ReviewState.APPROVED}
        and not (
            cluster.risk_level == RiskLevel.HIGH and cluster.review_state != ReviewState.APPROVED
        )
    )
