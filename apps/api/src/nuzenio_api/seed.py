import argparse
import hashlib
import json
from collections.abc import Callable
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from nuzenio_api.config import get_settings
from nuzenio_api.db import SessionLocal
from nuzenio_api.demo_data import BRIEFS, CLUSTERS, PUBLISHERS
from nuzenio_api.evidence import fixture_evidence
from nuzenio_api.models import (
    Article,
    ArticleFingerprint,
    Brief,
    Claim,
    ClaimEvidence,
    ClaimState,
    ClusterArticle,
    ContentStatus,
    Correction,
    DecisionState,
    EditionControl,
    EventCluster,
    FeedType,
    OnboardingState,
    PrimaryDocument,
    PublisherDomain,
    PublisherOrganization,
    ReviewState,
    RightsPolicy,
    RiskLevel,
    SourceFeed,
    SummaryVersion,
)

SessionFactory = Callable[[], Session]


def _timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _publisher_records(session: Session) -> dict[str, PublisherOrganization]:
    organizations: dict[str, PublisherOrganization] = {}
    for item in PUBLISHERS:
        organization = session.scalar(
            select(PublisherOrganization).where(PublisherOrganization.slug == item["slug"])
        )
        if organization is not None:
            organizations[item["slug"]] = organization
            continue
        if organization is None:
            organization = PublisherOrganization(slug=item["slug"], name=item["name"])
            session.add(organization)
            session.flush()
        organization.name = item["name"]
        organization.description = item["description"]
        organization.ownership = item["ownership"]
        organization.correction_policy = item["correction_policy"]
        organization.active = True
        organization.onboarding_state = OnboardingState.APPROVED
        organization.contact_name = "Demonstration publisher desk"
        organization.contact_email = f"corrections@{item['domains'][0]}"
        organization.correction_route = f"https://{item['domains'][0]}/demo-corrections"
        for domain_name in item["domains"]:
            domain = session.scalar(
                select(PublisherDomain).where(PublisherDomain.domain == domain_name)
            )
            if domain is None:
                domain = PublisherDomain(
                    organization_id=organization.id,
                    domain=domain_name,
                    verified=True,
                )
                session.add(domain)
            domain.verified = True
            domain.onboarding_state = OnboardingState.APPROVED
            domain.ownership_evidence = "Fictional fixture ownership record; not a real publisher."
        rights = session.scalar(
            select(RightsPolicy).where(RightsPolicy.organization_id == organization.id)
        )
        if rights is None:
            rights = RightsPolicy(
                organization_id=organization.id,
                policy_name=item["rights"],
            )
            session.add(rights)
            session.flush()
        rights.policy_name = item["rights"]
        rights.may_store_full_text = False
        rights.may_store_excerpt = True
        rights.may_summarize = True
        rights.attribution_required = True
        rights.may_use_headline = True
        rights.may_use_thumbnail = False
        rights.may_translate = True
        rights.may_generate_audio = False
        rights.may_display_full_text = False
        rights.onboarding_state = OnboardingState.APPROVED
        rights.evidence_url = f"https://{item['domains'][0]}/demo-rights"
        rights.metadata_json = {"demonstration_data": True}
        primary_domain = session.scalar(
            select(PublisherDomain).where(PublisherDomain.domain == item["domains"][0])
        )
        for language in item["languages"]:
            feed_url = f"https://{item['domains'][0]}/demo-feed-{language}.xml"
            feed = session.scalar(select(SourceFeed).where(SourceFeed.url == feed_url))
            if feed is None:
                feed = SourceFeed(
                    organization_id=organization.id,
                    rights_policy_id=rights.id,
                    name=f"{item['name']} {language.upper()} demonstration feed",
                    feed_type=FeedType(item["feed_type"]),
                    url=feed_url,
                    language=language,
                )
                session.add(feed)
            feed.approved = True
            feed.onboarding_state = OnboardingState.APPROVED
            feed.domain_id = primary_domain.id if primary_domain else None
            feed.kill_switch = False
            feed.health_status = item["health"]
            feed.last_success_at = _timestamp("2026-09-02T12:00:00+05:30")
        organizations[item["slug"]] = organization
    session.flush()
    return organizations


def _feed_for(session: Session, organization_id: object, language: str) -> SourceFeed:
    feed = session.scalar(
        select(SourceFeed).where(
            SourceFeed.organization_id == organization_id,
            SourceFeed.language == language,
        )
    )
    if feed is None:
        feed = session.scalar(
            select(SourceFeed).where(SourceFeed.organization_id == organization_id).limit(1)
        )
    if feed is None:
        raise RuntimeError("demonstration publisher is missing its approved feed")
    return feed


def _upsert_article(
    session: Session,
    *,
    source: list[object],
    organization: PublisherOrganization,
    excerpt: str,
    published_at: datetime,
) -> Article:
    publisher_slug, url, title, title_hi, language, _ = source
    if publisher_slug != organization.slug:
        raise RuntimeError("article publisher does not match the selected organization")
    article = session.scalar(select(Article).where(Article.canonical_url == url))
    if article is not None:
        return article
    if article is None:
        article = Article(
            feed_id=_feed_for(session, organization.id, str(language)).id,
            publisher_organization_id=organization.id,
            canonical_url=str(url),
            title=str(title),
            title_hi=str(title_hi),
            excerpt=excerpt,
            language=str(language),
            published_at=published_at,
            status=ContentStatus.PUBLISHED,
            source_metadata={},
        )
        session.add(article)
        session.flush()
    article.feed_id = _feed_for(session, organization.id, str(language)).id
    article.publisher_organization_id = organization.id
    article.title = str(title)
    article.title_hi = str(title_hi)
    article.excerpt = excerpt
    article.language = str(language)
    article.published_at = published_at
    article.status = ContentStatus.PUBLISHED
    publisher = next(item for item in PUBLISHERS if item["slug"] == publisher_slug)
    article.source_metadata = {"demonstration_data": True, "short": publisher["short"]}
    fingerprint = session.scalar(
        select(ArticleFingerprint).where(ArticleFingerprint.article_id == article.id)
    )
    exact_hash = hashlib.sha256(f"{title} {excerpt}".lower().encode()).hexdigest()
    if fingerprint is None:
        fingerprint = ArticleFingerprint(
            article_id=article.id,
            exact_hash=exact_hash,
            normalized_url_hash=hashlib.sha256(str(url).encode()).hexdigest(),
        )
        session.add(fingerprint)
    fingerprint.exact_hash = exact_hash
    fingerprint.normalized_url_hash = hashlib.sha256(str(url).encode()).hexdigest()
    return article


def _seed_cluster(
    session: Session,
    *,
    item: dict[str, object],
    display_order: int,
    organizations: dict[str, PublisherOrganization],
) -> None:
    cluster = session.scalar(select(EventCluster).where(EventCluster.slug == item["slug"]))
    if cluster is not None:
        return
    if cluster is None:
        cluster = EventCluster(
            slug=str(item["slug"]),
            neutral_headline=str(item["headline"]),
            neutral_headline_hi=str(item["headline_hi"]),
            category=str(item["category"]),
        )
        session.add(cluster)
        session.flush()
    updated_at = _timestamp(str(item["updated_at"]))
    cluster.neutral_headline = str(item["headline"])
    cluster.neutral_headline_hi = str(item["headline_hi"])
    cluster.category = str(item["category"])
    cluster.location = str(item["location"]) if item["location"] else None
    cluster.status = ContentStatus.PUBLISHED
    cluster.risk_level = RiskLevel(str(item["risk"]))
    cluster.review_state = ReviewState(str(item["review"]))
    if cluster.risk_level == RiskLevel.HIGH:
        cluster.status = ContentStatus.HELD
        cluster.review_state = ReviewState.PENDING
    cluster.display_order = display_order
    cluster.updated_at = updated_at
    cluster.timeline_json = [
        {
            "at": timeline[0],
            "title": timeline[1],
            "detail": timeline[2],
            "titleHi": timeline[3],
            "detailHi": timeline[4],
        }
        for timeline in item["timeline"]
    ]
    cluster.why_shown = str(item["why"])
    cluster.why_shown_hi = str(item["why_hi"])

    documents: list[PrimaryDocument] = []
    for document_data in item["documents"]:
        document = session.scalar(
            select(PrimaryDocument).where(PrimaryDocument.url == document_data[3])
        )
        if document is None:
            document = PrimaryDocument(
                cluster_id=cluster.id,
                title=document_data[0],
                title_hi=document_data[1],
                issuer=document_data[2],
                url=document_data[3],
            )
            session.add(document)
            session.flush()
        document.cluster_id = cluster.id
        document.title = document_data[0]
        document.title_hi = document_data[1]
        document.issuer = document_data[2]
        document.published_at = _timestamp(document_data[4])
        document.document_hash = hashlib.sha256(document.url.encode()).hexdigest()
        documents.append(document)

    articles: list[Article] = []
    for index, source in enumerate(item["sources"]):
        organization = organizations[str(source[0])]
        article = _upsert_article(
            session,
            source=source,
            organization=organization,
            excerpt=str(item["summary"]),
            published_at=updated_at,
        )
        membership = session.scalar(
            select(ClusterArticle).where(
                ClusterArticle.cluster_id == cluster.id,
                ClusterArticle.article_id == article.id,
            )
        )
        if membership is None:
            membership = ClusterArticle(cluster_id=cluster.id, article_id=article.id)
            session.add(membership)
        membership.relevance_score = 1.0
        membership.is_primary = index == 0
        membership.is_syndicated_copy = bool(source[5])
        articles.append(article)
    session.flush()

    for claim_data in item["claims"]:
        claim = session.scalar(
            select(Claim).where(
                Claim.cluster_id == cluster.id,
                Claim.text == claim_data[1],
            )
        )
        if claim is None:
            claim = Claim(
                cluster_id=cluster.id,
                text=claim_data[1],
                text_hi=claim_data[2],
                state=ClaimState(claim_data[0]),
            )
            session.add(claim)
            session.flush()
        claim.text_hi = claim_data[2]
        claim.state = ClaimState(claim_data[0])
        session.execute(delete(ClaimEvidence).where(ClaimEvidence.claim_id == claim.id))
        for article_index in claim_data[3]:
            session.add(
                ClaimEvidence(
                    claim_id=claim.id,
                    article_id=articles[article_index].id,
                    locator="Fictional publisher excerpt in the approved demonstration feed",
                    support_score=1.0,
                )
            )
        if claim_data[4] is not None:
            session.add(
                ClaimEvidence(
                    claim_id=claim.id,
                    primary_document_id=documents[claim_data[4]].id,
                    locator="Fictional primary document section",
                    support_score=1.0,
                )
            )

    session.flush()
    evidence_ids = list(
        session.scalars(select(ClaimEvidence.id).join(Claim).where(Claim.cluster_id == cluster.id))
    )
    for language, text in (("en", item["summary"]), ("hi", item["summary_hi"])):
        summary = session.scalar(
            select(SummaryVersion).where(
                SummaryVersion.cluster_id == cluster.id,
                SummaryVersion.version == 1,
                SummaryVersion.language == language,
            )
        )
        if summary is None:
            summary = SummaryVersion(
                cluster_id=cluster.id,
                version=1,
                language=language,
                summary_text=str(text),
                evidence_map={},
                generator_name="deterministic-evidence-first-v1",
            )
            session.add(summary)
        summary.summary_text = str(text)
        summary.evidence_map = fixture_evidence(str(text), evidence_ids)
        summary.generator_name = (
            "deterministic-machine-translation-v1"
            if language == "hi"
            else "deterministic-evidence-first-v1"
        )
        summary.published_at = updated_at
        summary.decision = DecisionState.APPROVED

    for correction_data in item["corrections"]:
        correction = session.scalar(
            select(Correction).where(
                Correction.cluster_id == cluster.id,
                Correction.description == correction_data[0],
            )
        )
        if correction is None:
            correction = Correction(
                cluster_id=cluster.id,
                description=correction_data[0],
                description_hi=correction_data[1],
            )
            session.add(correction)
        correction.description_hi = correction_data[1]
        correction.status = "PUBLISHED"
        correction.published_at = _timestamp(correction_data[2])
        correction.source_url = "https://example.com/official-mobility-clarification"
        correction.evidence = "Fictional official clarification reference."
        correction.resolution = correction_data[0]
        correction.raised_at = _timestamp(correction_data[2])
        correction.resolved_at = _timestamp(correction_data[2])


def seed_database(session_factory: SessionFactory = SessionLocal) -> dict[str, int | bool]:
    settings = get_settings()
    if settings.environment not in {"development", "test"} or not settings.demo_mode:
        raise RuntimeError("Fixture seeding is allowed only in explicit development/test demo mode")
    with session_factory.begin() as session:
        organizations = _publisher_records(session)
        for display_order, item in enumerate(CLUSTERS, start=1):
            _seed_cluster(
                session,
                item=item,
                display_order=display_order,
                organizations=organizations,
            )
        for period, brief_data in BRIEFS.items():
            for language in ("en", "hi"):
                brief = session.scalar(
                    select(Brief).where(
                        Brief.edition == "india",
                        Brief.period == period,
                        Brief.language == language,
                    )
                )
                if brief is not None:
                    continue
                if brief is None:
                    brief = Brief(
                        edition="india",
                        period=period,
                        language=language,
                        title=brief_data[language],
                    )
                    session.add(brief)
                brief.title = brief_data[language]
                brief.cluster_ids = brief_data["clusters"]
                brief.published_at = _timestamp("2026-09-02T18:30:00+05:30")
        edition = session.scalar(select(EditionControl).where(EditionControl.edition == "india"))
        if edition is None:
            session.add(EditionControl(edition="india", paused=False, version=1))
        session.flush()
        return {
            "demonstration_data": True,
            "publishers": int(session.scalar(select(func.count(PublisherOrganization.id))) or 0),
            "clusters": int(session.scalar(select(func.count(EventCluster.id))) or 0),
            "articles": int(session.scalar(select(func.count(Article.id))) or 0),
            "claims": int(session.scalar(select(func.count(Claim.id))) or 0),
            "briefs": int(session.scalar(select(func.count(Brief.id))) or 0),
        }


def expected_counts() -> dict[str, int | bool]:
    return {
        "demonstration_data": True,
        "publishers": len(PUBLISHERS),
        "clusters": len(CLUSTERS),
        "articles": sum(len(item["sources"]) for item in CLUSTERS),
        "claims": sum(len(item["claims"]) for item in CLUSTERS),
        "briefs": len(BRIEFS) * 2,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Nuzenio fictional reader data")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print fixture totals without connecting to PostgreSQL",
    )
    args = parser.parse_args()
    result = expected_counts() if args.dry_run else seed_database()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
