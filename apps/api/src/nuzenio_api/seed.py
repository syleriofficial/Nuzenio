import argparse
import hashlib
import json

from sqlalchemy import select

from nuzenio_api.db import SessionLocal, engine
from nuzenio_api.demo_data import DEMO_CLUSTERS
from nuzenio_api.models import (
    Article,
    ArticleFingerprint,
    Base,
    Brief,
    Claim,
    ClaimEvidence,
    ClaimState,
    ClusterArticle,
    ContentStatus,
    EventCluster,
    FeedType,
    PublisherDomain,
    PublisherOrganization,
    ReviewState,
    RightsPolicy,
    RiskLevel,
    SourceFeed,
    SummaryVersion,
)


def seed_database() -> dict[str, int | bool]:
    Base.metadata.create_all(bind=engine)
    counts = {"demonstration_data": True, "clusters": 0, "articles": 0, "claims": 0}
    with SessionLocal.begin() as session:
        for demo_cluster in DEMO_CLUSTERS:
            exists = session.scalar(
                select(EventCluster.id).where(EventCluster.slug == demo_cluster.slug)
            )
            if exists:
                continue
            cluster = EventCluster(
                slug=demo_cluster.slug,
                neutral_headline=demo_cluster.headline,
                category=demo_cluster.category,
                location=demo_cluster.location,
                status=ContentStatus.PUBLISHED,
                risk_level=RiskLevel(demo_cluster.risk_level),
                review_state=(
                    ReviewState.APPROVED
                    if demo_cluster.review_state == "EDITOR_REVIEWED"
                    else ReviewState.NOT_REQUIRED
                ),
            )
            session.add(cluster)
            session.flush()
            article_by_index: list[Article] = []
            for source in demo_cluster.sources:
                organization = session.scalar(
                    select(PublisherOrganization).where(
                        PublisherOrganization.slug == source.organization_id
                    )
                )
                if not organization:
                    organization = PublisherOrganization(
                        name=source.name,
                        slug=source.organization_id,
                    )
                    session.add(organization)
                    session.flush()
                    session.add(
                        PublisherDomain(
                            organization_id=organization.id,
                            domain=source.domain,
                            verified=True,
                        )
                    )
                    rights = RightsPolicy(
                        organization_id=organization.id,
                        policy_name="Demonstration excerpt policy",
                        may_store_full_text=False,
                        may_store_excerpt=True,
                        may_summarize=True,
                    )
                    session.add(rights)
                    session.flush()
                    feed = SourceFeed(
                        organization_id=organization.id,
                        rights_policy_id=rights.id,
                        name=f"{source.name} demo feed",
                        feed_type=FeedType.RSS,
                        url=f"https://{source.domain}/demo-feed.xml",
                        language=source.language,
                        approved=True,
                        health_status="HEALTHY",
                    )
                    session.add(feed)
                    session.flush()
                else:
                    feed = session.scalar(
                        select(SourceFeed).where(SourceFeed.organization_id == organization.id)
                    )
                    if feed is None:
                        raise RuntimeError("seed organization is missing its feed")
                article = Article(
                    feed_id=feed.id,
                    publisher_organization_id=organization.id,
                    canonical_url=str(source.url),
                    title=source.headline,
                    excerpt=demo_cluster.brief,
                    language=source.language,
                    published_at=demo_cluster.updated_at,
                    status=ContentStatus.PUBLISHED,
                    source_metadata={"demonstration_data": True},
                )
                session.add(article)
                session.flush()
                fingerprint = hashlib.sha256(
                    f"{article.title} {article.excerpt}".lower().encode()
                ).hexdigest()
                session.add(
                    ArticleFingerprint(
                        article_id=article.id,
                        exact_hash=fingerprint,
                        normalized_url_hash=hashlib.sha256(
                            article.canonical_url.encode()
                        ).hexdigest(),
                    )
                )
                session.add(
                    ClusterArticle(
                        cluster_id=cluster.id,
                        article_id=article.id,
                        relevance_score=1.0,
                        is_primary=not article_by_index,
                        is_syndicated_copy=source.syndicated_copy,
                    )
                )
                article_by_index.append(article)
                counts["articles"] += 1
            for demo_claim in demo_cluster.claims:
                claim = Claim(
                    cluster_id=cluster.id,
                    text=demo_claim.text,
                    state=ClaimState(demo_claim.state),
                )
                session.add(claim)
                session.flush()
                session.add(
                    ClaimEvidence(
                        claim_id=claim.id,
                        article_id=article_by_index[0].id,
                        locator="demonstration excerpt",
                        support_score=1.0,
                    )
                )
                counts["claims"] += 1
            session.add(
                SummaryVersion(
                    cluster_id=cluster.id,
                    version=1,
                    language="en",
                    summary_text=demo_cluster.brief or "",
                    evidence_map={"0": [str(article.id) for article in article_by_index]},
                    generator_name="deterministic-evidence-first-v1",
                    published_at=demo_cluster.updated_at,
                )
            )
            counts["clusters"] += 1
        if not session.scalar(select(Brief.id).limit(1)):
            session.add(
                Brief(
                    edition="india",
                    period="morning",
                    language="en",
                    title="Nuzenio demonstration morning brief",
                    cluster_ids=[cluster.slug for cluster in DEMO_CLUSTERS],
                    published_at=DEMO_CLUSTERS[0].updated_at,
                )
            )
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Nuzenio demonstration data")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print seed counts without connecting to PostgreSQL",
    )
    args = parser.parse_args()
    if args.dry_run:
        result: dict[str, int | bool] = {
            "demonstration_data": True,
            "clusters": len(DEMO_CLUSTERS),
            "articles": sum(len(cluster.sources) for cluster in DEMO_CLUSTERS),
            "claims": sum(len(cluster.claims) for cluster in DEMO_CLUSTERS),
        }
    else:
        result = seed_database()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
