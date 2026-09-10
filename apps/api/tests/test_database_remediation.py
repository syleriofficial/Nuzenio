import secrets
import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from nuzenio_api.audit import append_audit
from nuzenio_api.config import get_settings
from nuzenio_api.db import engine
from nuzenio_api.db_roles import assert_runtime_identity, provision_runtime


def migration_config():
    root = Path(__file__).parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    return config


def test_f15_clean_schema_has_no_drift():
    command.check(migration_config())


@pytest.mark.parametrize("start", ["8ca634735948", "b31f72a9c4de"])
def test_forward_upgrade_holds_unproven_content_and_preserves_briefs(start, monkeypatch):
    name = "nuzenio_upgrade_test_" + uuid.uuid4().hex
    url = make_url(get_settings().database_url).set(database=name)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    target = create_engine(url)
    monkeypatch.setattr(get_settings(), "database_url", url.render_as_string(hide_password=False))
    try:
        config = migration_config()
        command.upgrade(config, start)
        cid, sid, bid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        with target.begin() as connection:
            connection.execute(
                text("""INSERT INTO event_clusters(id,slug,neutral_headline,
                neutral_headline_hi,category,status,risk_level,review_state,version,
                display_order,timeline_json,why_shown,why_shown_hi)
                VALUES (:id,'legacy-fixture','Legacy fictional story','काल्पनिक खबर',
                'Public safety','PUBLISHED','HIGH','APPROVED',1,1,'[]','','')"""),
                {"id": cid},
            )
            connection.execute(
                text("""INSERT INTO summary_versions(id,cluster_id,version,language,
                summary_text,evidence_map,generator_name,published_at)
                VALUES (:id,:cid,1,'en','Unmapped legacy sentence.','{"sentences":[]}',
                'legacy-fixture',now())"""),
                {"id": sid, "cid": cid},
            )
            connection.execute(
                text("""INSERT INTO briefs(id,edition,period,language,title,
                cluster_ids,published_at) VALUES (:id,'india','morning','en',
                'Legacy fixture brief','["legacy-fixture"]',now())"""),
                {"id": bid},
            )
        command.upgrade(config, "head")
        command.check(config)
        with target.connect() as connection:
            assert connection.execute(
                text("SELECT status,review_state FROM event_clusters WHERE id=:id"), {"id": cid}
            ).one() == ("HELD", "PENDING")
            assert (
                connection.scalar(text("SELECT nuzenio_current_review(:id)"), {"id": cid}) is False
            )
            assert (
                connection.scalar(
                    text("SELECT decision FROM summary_versions WHERE id=:id"), {"id": sid}
                )
                == "PENDING"
            )
            row = connection.execute(
                text("SELECT cluster_ids,legacy_cluster_slugs FROM briefs WHERE id=:id"),
                {"id": bid},
            ).one()
            assert row[0] == [str(cid)]
            assert row[1] == ["legacy-fixture"]
    finally:
        target.dispose()
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


def test_f12_actual_runtime_login_cannot_mutate_audit_or_ddl():
    role = "nuzenio_test_runtime_" + uuid.uuid4().hex
    password = secrets.token_urlsafe(32)
    provision_runtime(engine, role, password)
    runtime = create_engine(engine.url.set(username=role, password=password), hide_parameters=True)
    try:
        with runtime.connect() as connection:
            assert connection.scalar(text("SELECT current_user")) == role
        authentication_event_id = uuid.uuid4()
        with runtime.begin() as connection:
            connection.execute(
                text(
                    """INSERT INTO authentication_events(
                    id,username_hash,action,successful,reason,request_id)
                    VALUES (:id,:username_hash,'LOGIN_FAILED',false,
                    'fixture','runtime-auth-test')"""
                ),
                {"id": authentication_event_id, "username_hash": "a" * 64},
            )
        with Session(runtime) as session:
            append_audit(
                session,
                actor=None,
                action="RUNTIME_APPEND_TEST",
                entity_type="Fixture",
                entity_id=None,
                request_id="runtime-privileges",
            )
            session.commit()
        for sql in [
            "UPDATE audit_logs SET action='altered'",
            "DELETE FROM audit_logs",
            "TRUNCATE audit_logs",
            "UPDATE authentication_events SET reason='altered'",
            "DELETE FROM authentication_events",
            "TRUNCATE authentication_events",
            "UPDATE material_contributors SET first_material_revision=0",
            "DELETE FROM material_contributors",
            "TRUNCATE material_contributors",
            "UPDATE correction_contributors SET first_version=0",
            "DELETE FROM correction_contributors",
            "TRUNCATE correction_contributors",
            "ALTER TABLE correction_contributors DISABLE TRIGGER "
            "correction_contributors_append_only",
            "ALTER TABLE material_contributors DISABLE TRIGGER material_contributors_append_only",
            "ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_append_only",
            "ALTER TABLE authentication_events DISABLE TRIGGER authentication_events_append_only",
            "CREATE TABLE forbidden_runtime_table(id int)",
            "DROP FUNCTION prevent_audit_log_mutation() CASCADE",
        ]:
            with runtime.begin() as connection, pytest.raises(DBAPIError):
                connection.execute(text(sql))
        assert_runtime_identity(runtime)
        # Trigger adds a defense layer even for an owner who does not deliberately disable it.
        with engine.begin() as connection, pytest.raises(DBAPIError):
            connection.execute(text("TRUNCATE audit_logs"))
        with engine.begin() as connection, pytest.raises(DBAPIError):
            connection.execute(text("TRUNCATE correction_contributors"))
        with engine.begin() as connection, pytest.raises(DBAPIError):
            connection.execute(text("TRUNCATE authentication_events"))
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE migration_owner_fixture(id integer)"))
            connection.execute(text("DROP TABLE migration_owner_fixture"))
    finally:
        runtime.dispose()
        with engine.begin() as connection:
            assert (
                connection.scalar(
                    text(
                        "SELECT count(*) FROM pg_class WHERE relowner="
                        "(SELECT oid FROM pg_roles WHERE rolname=:role)"
                    ),
                    {"role": role},
                )
                == 0
            )
            connection.execute(text(f'DROP OWNED BY "{role}"'))
            connection.execute(text(f'DROP ROLE "{role}"'))


def test_authentication_event_upgrade_preserves_existing_identity_and_rows(monkeypatch):
    name = "nuzenio_auth_event_upgrade_test_" + uuid.uuid4().hex
    url = make_url(get_settings().database_url).set(database=name)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    target = create_engine(url)
    monkeypatch.setattr(get_settings(), "database_url", url.render_as_string(hide_password=False))
    event_id = uuid.uuid4()
    try:
        config = migration_config()
        command.upgrade(config, "c96a1d2273eb")
        with target.begin() as connection:
            connection.execute(
                text(
                    """INSERT INTO authentication_events(
                    id,username_hash,action,successful,reason,request_id)
                    VALUES (:id,:username_hash,'LOGIN_FAILED',false,
                    'legacy fixture','legacy-auth')"""
                ),
                {"id": event_id, "username_hash": "b" * 64},
            )
        command.upgrade(config, "head")
        command.check(config)
        with target.connect() as connection:
            row = connection.execute(
                text("SELECT id,reason FROM authentication_events WHERE id=:id"),
                {"id": event_id},
            ).one()
            assert row == (event_id, "legacy fixture")
        with target.begin() as connection, pytest.raises(DBAPIError):
            connection.execute(
                text("UPDATE authentication_events SET reason='changed' WHERE id=:id"),
                {"id": event_id},
            )
    finally:
        target.dispose()
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


def test_r1_r3_upgrade_from_reviewed_head_preserves_history_without_inventing_authors(monkeypatch):
    name = "nuzenio_reviewed_upgrade_test_" + uuid.uuid4().hex
    url = make_url(get_settings().database_url).set(database=name)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    target = create_engine(url)
    monkeypatch.setattr(get_settings(), "database_url", url.render_as_string(hide_password=False))
    try:
        config = migration_config()
        command.upgrade(config, "a74e9b0216cd")
        cid, sid = uuid.uuid4(), uuid.uuid4()
        with target.begin() as connection:
            connection.execute(
                text("""INSERT INTO event_clusters(id,slug,neutral_headline,
              neutral_headline_hi,category,status,risk_level,review_state,version,material_revision,
              display_order,timeline_json,why_shown,why_shown_hi)
              VALUES (:id,'reviewed-legacy','Unknown contributors','अज्ञात लेखक',
              'Public safety','PUBLISHED','HIGH','APPROVED',7,4,1,'[]','','')"""),
                {"id": cid},
            )
            connection.execute(
                text("""INSERT INTO summary_versions(id,cluster_id,version,language,
              summary_text,evidence_map,generator_name,published_at,decision,row_version)
              VALUES (:id,:cid,2,'hi','पुराना ऐतिहासिक दावा।','{"sentences":[]}',
              'legacy-fixture',now(),'APPROVED',3)"""),
                {"id": sid, "cid": cid},
            )
        command.upgrade(config, "head")
        command.check(config)
        with target.connect() as connection:
            assert connection.execute(
                text(
                    "SELECT status,provenance_complete,material_revision "
                    "FROM event_clusters WHERE id=:id"
                ),
                {"id": cid},
            ).one() == ("HELD", False, 4)
            assert connection.scalar(text("SELECT count(*) FROM material_contributors")) == 0
            row = connection.execute(
                text(
                    "SELECT summary_text,invalidated_at,row_version "
                    "FROM summary_versions WHERE id=:id"
                ),
                {"id": sid},
            ).one()
            assert row[0] == "पुराना ऐतिहासिक दावा।" and row[1] is not None and row[2] == 4
            assert (
                connection.scalar(text("SELECT nuzenio_public_summary(:id, 'hi')"), {"id": cid})
                is None
            )
            assert (
                connection.scalar(text("SELECT nuzenio_current_review(:id)"), {"id": cid}) is False
            )
    finally:
        target.dispose()
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


def test_correction_provenance_upgrade_recovers_only_verifiable_identities(monkeypatch):
    name = "nuzenio_correction_upgrade_test_" + uuid.uuid4().hex
    url = make_url(get_settings().database_url).set(database=name)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    target = create_engine(url)
    monkeypatch.setattr(get_settings(), "database_url", url.render_as_string(hide_password=False))
    try:
        config = migration_config()
        command.upgrade(config, "b85f0e1162da")
        known_cluster, unknown_cluster = uuid.uuid4(), uuid.uuid4()
        correction_id, unknown_correction = uuid.uuid4(), uuid.uuid4()
        creator, resolver = uuid.uuid4(), uuid.uuid4()
        with target.begin() as connection:
            for staff_id, username in ((creator, "known-creator"), (resolver, "known-resolver")):
                connection.execute(
                    text(
                        """INSERT INTO staff_users(
                        id,username,display_name,password_hash,role,version)
                        VALUES (:id,:username,'Known fixture','not-a-real-password-hash',
                        'ADMINISTRATOR',1)"""
                    ),
                    {"id": staff_id, "username": username},
                )
            for cluster_id, slug in (
                (known_cluster, "known-correction-lineage"),
                (unknown_cluster, "unknown-correction-lineage"),
            ):
                connection.execute(
                    text(
                        """INSERT INTO event_clusters(
                        id,slug,neutral_headline,neutral_headline_hi,category,status,
                        risk_level,review_state,version,material_revision,provenance_complete,
                        display_order,timeline_json,why_shown,why_shown_hi)
                        VALUES (:id,:slug,'Legacy fictional correction','काल्पनिक सुधार',
                        'Public safety','PUBLISHED','HIGH','APPROVED',5,3,true,1,'[]','','')"""
                    ),
                    {"id": cluster_id, "slug": slug},
                )
            connection.execute(
                text(
                    """INSERT INTO corrections(
                    id,cluster_id,description,status,published_at,source_url,evidence,
                    resolution,raised_at,resolved_at,created_by_id,resolved_by_id,version)
                    VALUES (:id,:cluster,'Known legacy change','PUBLISHED',now(),
                    'https://fixture.example/known','Known fixture evidence','Applied',
                    now(),now(),:creator,:resolver,2)"""
                ),
                {
                    "id": correction_id,
                    "cluster": known_cluster,
                    "creator": creator,
                    "resolver": resolver,
                },
            )
            connection.execute(
                text(
                    """INSERT INTO corrections(
                    id,cluster_id,description,status,published_at,source_url,evidence,
                    resolution,raised_at,resolved_at,version)
                    VALUES (:id,:cluster,'Unknown legacy change','PUBLISHED',now(),
                    'https://fixture.example/unknown','Unknown fixture evidence','Applied',
                    now(),now(),2)"""
                ),
                {"id": unknown_correction, "cluster": unknown_cluster},
            )
        command.upgrade(config, "head")
        command.check(config)
        with target.connect() as connection:
            known = connection.execute(
                text(
                    "SELECT provenance_complete,status,material_revision "
                    "FROM event_clusters WHERE id=:id"
                ),
                {"id": known_cluster},
            ).one()
            unknown = connection.execute(
                text(
                    "SELECT provenance_complete,status,material_revision "
                    "FROM event_clusters WHERE id=:id"
                ),
                {"id": unknown_cluster},
            ).one()
            assert known == (True, "HELD", 4)
            assert unknown == (False, "HELD", 4)
            recovered = dict(
                connection.execute(
                    text(
                        "SELECT staff_user_id,first_version FROM correction_contributors "
                        "WHERE correction_id=:id"
                    ),
                    {"id": correction_id},
                ).all()
            )
            assert recovered == {creator: 1, resolver: 2}
            assert (
                connection.scalar(
                    text("SELECT count(*) FROM correction_contributors WHERE correction_id=:id"),
                    {"id": unknown_correction},
                )
                == 0
            )
            assert connection.scalar(
                text("SELECT nuzenio_correction_lineage_complete(:id)"),
                {"id": known_cluster},
            )
            assert not connection.scalar(
                text("SELECT nuzenio_correction_lineage_complete(:id)"),
                {"id": unknown_cluster},
            )
    finally:
        target.dispose()
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()
