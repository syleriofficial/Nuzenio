import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
from alembic import command
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, func, select, text

from nuzenio_api import draft_inbox
from nuzenio_api.config import Settings, get_settings
from nuzenio_api.db import SessionLocal, engine
from nuzenio_api.main import app
from nuzenio_api.models import (
    Article,
    ArticleDraftAssignment,
    AuditLog,
    ClusterArticle,
    ContentStatus,
    DraftWorkspace,
    EditorialReview,
    EventCluster,
    FeedType,
    MaterialContributor,
    OnboardingState,
    PublisherDomain,
    PublisherOrganization,
    RightsPolicy,
    SourceFeed,
    StaffRole,
    SummaryVersion,
)
from test_auth_editorial import login, make_staff
from test_database_remediation import migration_config


@pytest.fixture(scope="module", autouse=True)
def separate_inbox_database(migrated_database):
    """New source/rights mutations must not change other suites' seeded feeds."""
    from nuzenio_api.seed import seed_database

    name = "nuzenio_draft_test_" + uuid.uuid4().hex
    target_url = engine.url.set(database=name)
    admin = create_engine(engine.url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    target = create_engine(target_url)
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    old_url = get_settings().database_url
    try:
        get_settings().database_url = target_url.render_as_string(hide_password=False)
        command.upgrade(migration_config(), "head")
        SessionLocal.configure(bind=target)
        seed_database(SessionLocal)
        yield
    finally:
        SessionLocal.configure(bind=engine)
        get_settings().database_url = old_url
        target.dispose()
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


@pytest.fixture
def inbox(monkeypatch):
    monkeypatch.setattr(get_settings(), "draft_inbox_enabled", True)
    monkeypatch.setattr(get_settings(), "feed_kill_switch", True)
    monkeypatch.setattr(get_settings(), "demo_mode", True)
    user = make_staff(StaffRole.EDITOR)
    client, csrf = login(user)
    return client, {"X-CSRF-Token": csrf}, user


def source_articles(language="en", count=2):
    key = uuid.uuid4().hex
    with SessionLocal.begin() as db:
        org = PublisherOrganization(
            slug=key,
            name="Private fixture " + key,
            active=True,
            onboarding_state=OnboardingState.APPROVED,
        )
        db.add(org)
        db.flush()
        domain = PublisherDomain(
            organization_id=org.id,
            domain=key + ".example",
            verified=True,
            onboarding_state=OnboardingState.APPROVED,
        )
        rights = RightsPolicy(
            organization_id=org.id,
            policy_name="Fictional only",
            onboarding_state=OnboardingState.APPROVED,
            metadata_json={"demonstration_data": True},
        )
        db.add_all([domain, rights])
        db.flush()
        feed = SourceFeed(
            organization_id=org.id,
            domain_id=domain.id,
            rights_policy_id=rights.id,
            name="Fixture feed",
            url=f"https://{key}.example/feed.xml",
            feed_type=FeedType.RSS,
            approved=True,
            onboarding_state=OnboardingState.APPROVED,
            language=language,
        )
        db.add(feed)
        db.flush()
        ids = []
        for i in range(count):
            article = Article(
                feed_id=feed.id,
                publisher_organization_id=org.id,
                canonical_url=f"https://{key}.example/item/{i}",
                title=("काल्पनिक बस योजना " if language == "hi" else "Fictional bus proposal ")
                + key
                + str(i),
                excerpt="Unverified fictional excerpt; not actual news.",
                language=language,
                published_at=datetime.now(UTC),
                status=ContentStatus.INGESTED,
            )
            db.add(article)
            db.flush()
            ids.append(article.id)
    return ids


def request_for(article_id, **changes):
    with SessionLocal() as db:
        article = db.get(Article, article_id)
        data = {
            "operationId": str(uuid.uuid4()),
            "expectedArticleVersion": article.version,
            "approvalToken": draft_inbox.digest(draft_inbox.approval_snapshot(db, article.feed)),
        }
    return data | changes


def assign(inbox, article_id, payload=None):
    client, headers, _ = inbox
    return client.post(
        f"/v1/admin/incoming-articles/{article_id}/assign",
        headers=headers,
        json=payload or request_for(article_id),
    )


@pytest.mark.parametrize("language", ["en", "hi"])
def test_assignment_private_provenance_bilingual_and_exact_retry(inbox, language):
    article_id = source_articles(language)[0]
    data = request_for(article_id)
    first = assign(inbox, article_id, data)
    assert first.status_code == 200, first.text
    cluster_id = uuid.UUID(first.json()["clusterId"])
    assert first.json()["replayed"] is False
    second = assign(inbox, article_id, data)
    assert second.status_code == 200 and second.json()["replayed"] is True
    with SessionLocal() as db:
        article = db.get(Article, article_id)
        cluster = db.get(EventCluster, cluster_id)
        assert cluster.status == "HELD" and cluster.review_state == "PENDING"
        assert cluster.risk_level == "HIGH" and not cluster.push_ready
        assert cluster.neutral_headline == article.title
        assert cluster.neutral_headline_hi == (article.title if language == "hi" else "")
        assert article.version == 2 and cluster.version == 1
        assert list(
            db.scalars(
                select(MaterialContributor.staff_user_id).where(
                    MaterialContributor.cluster_id == cluster_id
                )
            )
        ) == [inbox[2].id]
        assert (
            db.scalar(
                select(func.count())
                .select_from(SummaryVersion)
                .where(SummaryVersion.cluster_id == cluster_id)
            )
            == 0
        )
        assert (
            db.scalar(
                select(func.count())
                .select_from(AuditLog)
                .where(
                    AuditLog.entity_id == article_id, AuditLog.action == "FIXTURE_ARTICLE_ASSIGNED"
                )
            )
            == 1
        )
        slug = cluster.slug
        title = article.title
        source_slug = article.publisher_organization.slug
    public = TestClient(app)
    assert public.get(f"/v1/clusters/{slug}").status_code == 404
    assert slug not in public.get("/v1/search", params={"q": slug}).text
    for language_code in ("en", "hi"):
        for path in (
            "/v1/feed/top",
            "/v1/feed/local",
            "/v1/briefs/morning",
            "/v1/briefs/evening",
            f"/v1/sources/{source_slug}",
        ):
            response = public.get(path, params={"language": language_code})
            assert response.status_code == 200, response.text
            assert title not in response.text and slug not in response.text
    assert assign(inbox, article_id).status_code == 409


def test_attach_invalidates_pending_review_and_retains_all_contributors(inbox):
    ids = source_articles()
    first = assign(inbox, ids[0]).json()
    actor = make_staff(StaffRole.EDITOR)
    client, csrf = login(actor)
    second = assign(
        (client, {"X-CSRF-Token": csrf}, actor),
        ids[1],
        request_for(ids[1], targetClusterId=first["clusterId"], expectedClusterVersion=1),
    )
    assert second.status_code == 200, second.text
    with SessionLocal() as db:
        key = uuid.UUID(first["clusterId"])
        cluster = db.get(EventCluster, key)
        assert (cluster.version, cluster.material_revision) == (2, 2)
        assert (
            db.scalar(
                select(func.count())
                .select_from(ClusterArticle)
                .where(ClusterArticle.cluster_id == key)
            )
            == 2
        )
        assert set(
            db.scalars(
                select(MaterialContributor.staff_user_id).where(
                    MaterialContributor.cluster_id == key
                )
            )
        ) == {inbox[2].id, actor.id}
        reviews = list(db.scalars(select(EditorialReview).where(EditorialReview.cluster_id == key)))
        assert len(reviews) == 2 and sum(r.superseded_at is None for r in reviews) == 1


@pytest.mark.parametrize(
    "field", ["rights", "publisher", "feed", "domain", "expiry", "real_domain", "organization"]
)
def test_live_revalidation_and_read_withholding(inbox, field):
    key = source_articles()[0]
    payload = request_for(key)
    with SessionLocal.begin() as db:
        a = db.get(Article, key)
        if field == "rights":
            a.feed.rights_policy.revoked_at = datetime.now(UTC)
        elif field == "publisher":
            a.feed.organization.active = False
        elif field == "feed":
            a.feed.kill_switch = True
        elif field == "domain":
            db.get(PublisherDomain, a.feed.domain_id).verified = False
        elif field == "expiry":
            a.feed.rights_policy.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        elif field == "real_domain":
            a.canonical_url = "https://news.invalid/item"
        else:
            a.publisher_organization_id = db.scalar(
                select(PublisherOrganization.id)
                .where(PublisherOrganization.id != a.publisher_organization_id)
                .limit(1)
            )
    assert assign(inbox, key, payload).status_code == 409
    response = inbox[0].get("/v1/admin/incoming-articles?page_size=50")
    assert response.status_code == 200, response.text
    row = next(a for a in response.json()["items"] if a["id"] == str(key))
    assert row["title"] is row["excerpt"] is row["originalUrl"] is row["approvalToken"] is None
    assert row["blockedReasons"]
    with SessionLocal() as db:
        assert not db.scalar(
            select(ArticleDraftAssignment.id).where(ArticleDraftAssignment.article_id == key)
        )


def test_stale_versions_approval_snapshot_operation_conflicts_and_target_gate(inbox):
    a, b = source_articles()
    payload = request_for(a)
    with SessionLocal.begin() as db:
        db.get(Article, a).feed.rights_policy.version += 1
    assert assign(inbox, a, payload).json()["error"]["code"] == "approval_stale"
    assert assign(inbox, a, request_for(a, expectedArticleVersion=99)).status_code == 409
    fresh = request_for(a)
    created = assign(inbox, a, fresh).json()
    assert assign(inbox, b, request_for(b, operationId=fresh["operationId"])).status_code == 409
    target = {"targetClusterId": created["clusterId"], "expectedClusterVersion": 99}
    assert assign(inbox, b, request_for(b, **target)).status_code == 409
    with SessionLocal.begin() as db:
        cluster = db.get(EventCluster, uuid.UUID(created["clusterId"]))
        cluster.material_revision += 1  # represents an intervening editorial mutation
        cluster.version += 1
    target["expectedClusterVersion"] = 2
    assert assign(inbox, b, request_for(b, **target)).json()["error"]["code"] == "draft_locked"


@pytest.mark.parametrize("same_operation", [True, False])
def test_concurrent_assignments_are_transactional(inbox, same_operation):
    article = source_articles()[0]
    payloads = [request_for(article), request_for(article)]
    if same_operation:
        payloads[1] = payloads[0]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda p: assign(inbox, article, p), payloads))
    assert sorted(r.status_code for r in results) == ([200, 200] if same_operation else [200, 409])
    with SessionLocal() as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(ClusterArticle)
                .where(ClusterArticle.article_id == article)
            )
            == 1
        )
        assert db.get(Article, article).version == 2


def test_audit_failure_rolls_back_entire_graph(inbox, monkeypatch):
    key = source_articles()[0]

    def broken(*args, **kwargs):
        raise RuntimeError("test audit failure")

    monkeypatch.setattr(draft_inbox, "append_audit", broken)
    with pytest.raises(RuntimeError, match="test audit failure"):
        assign(inbox, key)
    with SessionLocal() as db:
        assert db.get(Article, key).version == 1
        assert not db.scalar(select(ClusterArticle.id).where(ClusterArticle.article_id == key))
        assert not db.scalar(
            select(ArticleDraftAssignment.id).where(ArticleDraftAssignment.article_id == key)
        )


@pytest.mark.parametrize(
    "role,read,write",
    [
        (StaffRole.REVIEWER, 200, 403),
        (StaffRole.ANALYST, 403, 403),
        (StaffRole.PUBLISHER_MANAGER, 403, 403),
        (StaffRole.ADMINISTRATOR, 200, 200),
    ],
)
def test_rbac_csrf_and_no_store(inbox, role, read, write):
    key = source_articles()[0]
    user = make_staff(role)
    client, csrf = login(user)
    response = client.get("/v1/admin/incoming-articles")
    assert response.status_code == read
    assert "no-store" in response.headers["cache-control"]
    assert (
        client.post(f"/v1/admin/incoming-articles/{key}/assign", json=request_for(key)).status_code
        == 403
    )
    assert assign((client, {"X-CSRF-Token": csrf}, user), key).status_code == write
    assert TestClient(app).get("/v1/admin/incoming-articles").status_code == 401


@pytest.mark.parametrize(
    "changes", [{"draft_inbox_enabled": False}, {"feed_kill_switch": False}, {"demo_mode": False}]
)
def test_runtime_gate_fail_closed(inbox, monkeypatch, changes):
    for key, value in changes.items():
        monkeypatch.setattr(get_settings(), key, value)
    assert inbox[0].get("/v1/admin/incoming-articles").status_code == 403


@pytest.mark.parametrize(
    "changes", [{"environment": "production"}, {"demo_mode": False}, {"feed_kill_switch": False}]
)
def test_configuration_gate(changes):
    values = {
        "environment": "test",
        "draft_inbox_enabled": True,
        "demo_mode": True,
        "feed_kill_switch": True,
    }
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **(values | changes))


def test_strict_assignment_schema(inbox):
    key = source_articles()[0]
    for change in (
        {"expectedArticleVersion": True},
        {"targetClusterId": str(uuid.uuid4())},
        {"publish": True},
        {"expectedClusterVersion": 1},
    ):
        assert assign(inbox, key, request_for(key, **change)).status_code == 422


def test_pagination_and_draft_workspace(inbox):
    key = source_articles()[0]
    created = assign(inbox, key).json()
    page = inbox[0].get("/v1/admin/incoming-articles?state=ASSIGNED&page_size=1").json()
    assert len(page["items"]) == 1 and page["pagination"]["total"] >= 1
    assert page["items"][0]["state"] == "ASSIGNED"
    drafts = inbox[0].get("/v1/admin/draft-workspaces?page_size=50").json()
    row = next(x for x in drafts["items"] if x["id"] == created["clusterId"])
    assert row["version"] == 1 and row["blockedReasons"] == []
    with SessionLocal() as db:
        assert db.scalar(
            select(DraftWorkspace.id).where(
                DraftWorkspace.cluster_id == uuid.UUID(created["clusterId"])
            )
        )


def test_offline_import_is_explicit_idempotent_and_never_fetches(inbox, monkeypatch):
    from nuzenio_api.draft_fixtures import import_fixtures
    from nuzenio_api.feed_security import SafeFeedFetcher

    def forbidden(*args, **kwargs):
        pytest.fail("Offline import must not invoke a fetcher")

    monkeypatch.setattr(SafeFeedFetcher, "fetch", forbidden)
    with SessionLocal.begin() as db:
        before = db.scalar(select(func.count()).select_from(EventCluster))
        assert import_fixtures(db) == 8
    with SessionLocal.begin() as db:
        assert import_fixtures(db) == 0
        assert db.scalar(select(func.count()).select_from(EventCluster)) == before
        articles = list(
            db.scalars(
                select(Article).where(
                    Article.source_metadata["offline_fixture_pack"].astext == "draft-inbox-v1"
                )
            )
        )
        assert len(articles) == 8
        assert {a.language for a in articles} == {"en", "hi"}
        assert all(a.status == "INGESTED" and not a.cluster_memberships for a in articles)
    monkeypatch.setattr(get_settings(), "draft_inbox_enabled", False)
    with SessionLocal.begin() as db, pytest.raises(Exception, match="offline fixture"):
        import_fixtures(db)


def test_admin_contributor_cannot_self_approve(inbox):
    admin = make_staff(StaffRole.ADMINISTRATOR)
    client, csrf = login(admin)
    key = source_articles()[0]
    cluster = assign((client, {"X-CSRF-Token": csrf}, admin), key).json()["clusterId"]
    with SessionLocal() as db:
        review = db.scalar(
            select(EditorialReview).where(EditorialReview.cluster_id == uuid.UUID(cluster))
        )
        review_id, version = review.id, review.version
    result = client.post(
        f"/v1/admin/reviews/{review_id}/decision",
        headers={"X-CSRF-Token": csrf},
        json={
            "expectedVersion": version,
            "decision": "APPROVED",
            "notes": "Cannot review my own fixture draft.",
        },
    )
    assert result.status_code == 409, result.text
    assert (
        client.post(
            f"/v1/admin/reviews/{review_id}/push-approval",
            headers={"X-CSRF-Token": csrf},
            json={"expectedVersion": version},
        ).status_code
        == 409
    )


def test_existing_public_cluster_is_not_an_inbox_target(inbox):
    key = source_articles()[0]
    with SessionLocal() as db:
        cluster = db.scalar(
            select(EventCluster).where(EventCluster.status == ContentStatus.PUBLISHED).limit(1)
        )
        target = {"targetClusterId": str(cluster.id), "expectedClusterVersion": cluster.version}
        before = list(
            db.scalars(
                select(ClusterArticle.article_id).where(ClusterArticle.cluster_id == cluster.id)
            )
        )
    result = assign(inbox, key, request_for(key, **target))
    assert result.status_code == 409
    with SessionLocal() as db:
        assert (
            list(
                db.scalars(
                    select(ClusterArticle.article_id).where(ClusterArticle.cluster_id == cluster.id)
                )
            )
            == before
        )


def test_runtime_role_can_assign_but_audit_reader_cannot_read_inbox(inbox):
    import secrets

    from sqlalchemy.exc import DBAPIError

    from nuzenio_api.db_roles import provision_audit_reader, provision_runtime

    owner = SessionLocal.kw["bind"]
    for kind, provision in (("runtime", provision_runtime), ("audit", provision_audit_reader)):
        name = "draft_test_" + uuid.uuid4().hex
        password = secrets.token_urlsafe(32)
        provision(owner, name, password)
        restricted = create_engine(owner.url.set(username=name, password=password))
        try:
            if kind == "runtime":
                key = source_articles()[0]
                payload = request_for(key)
                SessionLocal.configure(bind=restricted)
                assert assign(inbox, key, payload).status_code == 200
            else:
                with restricted.begin() as db, pytest.raises(DBAPIError):
                    db.execute(text("SELECT * FROM article_draft_assignments"))
        finally:
            SessionLocal.configure(bind=owner)
            restricted.dispose()
            with owner.begin() as db:
                db.execute(text(f'DROP OWNED BY "{name}"'))
                db.execute(text(f'DROP ROLE "{name}"'))


def test_upgrade_from_reader_reports_preserves_rows(monkeypatch):
    from sqlalchemy import inspect
    from sqlalchemy.orm import sessionmaker

    from nuzenio_api.seed import seed_database

    name = "nuzenio_draft_upgrade_test_" + uuid.uuid4().hex
    url = engine.url.set(database=name)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    target = create_engine(url)
    with admin.connect() as db:
        db.execute(text(f'CREATE DATABASE "{name}"'))
    monkeypatch.setattr(get_settings(), "database_url", url.render_as_string(hide_password=False))
    try:
        config = migration_config()
        command.upgrade(config, "76d934bfa102")
        seed_database(sessionmaker(target, expire_on_commit=False))
        tables = [
            table for table in inspect(target).get_table_names() if table != "alembic_version"
        ]

        def snapshot():
            with target.connect() as db:
                return {
                    table: db.scalar(
                        text(
                            "SELECT md5(string_agg(to_jsonb(t)::text, '' "
                            "ORDER BY to_jsonb(t)::text)) " + f'FROM "{table}" t'
                        )
                    )
                    for table in tables
                }

        before = snapshot()
        command.upgrade(config, "head")
        command.check(config)
        assert snapshot() == before
        with target.connect() as db:
            assert db.scalar(text("SELECT count(*) FROM draft_workspaces")) == 0
            assert db.scalar(text("SELECT count(*) FROM article_draft_assignments")) == 0
    finally:
        target.dispose()
        with admin.connect() as db:
            db.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()
