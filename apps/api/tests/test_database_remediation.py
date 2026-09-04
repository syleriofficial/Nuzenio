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
from nuzenio_api.db_roles import provision_runtime


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
            "UPDATE material_contributors SET first_material_revision=0",
            "DELETE FROM material_contributors",
            "TRUNCATE material_contributors",
            "ALTER TABLE material_contributors DISABLE TRIGGER material_contributors_append_only",
            "ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_append_only",
            "CREATE TABLE forbidden_runtime_table(id int)",
            "DROP FUNCTION prevent_audit_log_mutation() CASCADE",
        ]:
            with runtime.begin() as connection, pytest.raises(DBAPIError):
                connection.execute(text(sql))
        # Trigger adds a defense layer even for an owner who does not deliberately disable it.
        with engine.begin() as connection, pytest.raises(DBAPIError):
            connection.execute(text("TRUNCATE audit_logs"))
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
