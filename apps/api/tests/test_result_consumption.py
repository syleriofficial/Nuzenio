"""Real PostgreSQL regressions for the production result-consumption boundary."""

from __future__ import annotations

import asyncio
import secrets
import threading
import time
import traceback
from datetime import datetime

import psycopg
import pytest
from sqlalchemy import DateTime, Integer, create_engine, select, text
from sqlalchemy.engine import CursorResult, MappingResult, Result, Row, RowMapping, ScalarResult
from sqlalchemy.exc import MultipleResultsFound, NoResultFound, ResourceClosedError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from sqlalchemy.types import TypeDecorator

from nuzenio_api.config import get_settings
from nuzenio_api.database_security import (
    DetachedDatabaseError,
    engine_logging_options,
    harden_database_engine,
)

CANARY = "12087-04-23 11:37:42.123456"


@pytest.fixture
def secured_engine():
    engine = harden_database_engine(
        create_engine(
            get_settings().database_url,
            pool_pre_ping=True,
            **engine_logging_options("production", sql_echo=False),
        ),
        "production",
    )
    try:
        yield engine
    finally:
        engine.dispose()


def assert_detached(error, canary=CANARY):
    """Inspect diagnostic edges, not explicitly excluded traceback-frame locals."""
    assert isinstance(error, DetachedDatabaseError)
    assert error.__cause__ is None
    assert error.__context__ is None
    assert not any(hasattr(error, key) for key in ("orig", "diag", "statement", "params"))
    pending, seen = [error], set()
    rendered = ["".join(traceback.format_exception(error))]
    while pending:
        value = pending.pop()
        if id(value) in seen:
            continue
        seen.add(id(value))
        assert not isinstance(value, psycopg.Error)
        rendered.extend((str(value), repr(value)))
        if isinstance(value, dict):
            pending.extend(value.keys())
            pending.extend(value.values())
        elif isinstance(value, (tuple, list, set, frozenset)):
            pending.extend(value)
        else:
            pending.extend(getattr(value, "__dict__", {}).values())
            for key in (
                "__cause__",
                "__context__",
                "orig",
                "diag",
                "args",
                "statement",
                "params",
                "parameters",
                "exceptions",
            ):
                item = getattr(value, key, None)
                if item is not None:
                    pending.append(item)
            if type(value).__name__.endswith("Diagnostic"):
                for key in dir(value):
                    if not key.startswith("_"):
                        item = getattr(value, key, None)
                        if item is not None and not callable(item):
                            pending.append(item)
    assert canary not in "\n".join(rendered)


CONSUMERS = {
    "fetchone": lambda r: r.fetchone(),
    "fetchall": lambda r: r.fetchall(),
    "fetchmany": lambda r: r.fetchmany(2),
    "all": lambda r: r.all(),
    "first": lambda r: r.first(),
    "one": lambda r: r.one(),
    "one_or_none": lambda r: r.one_or_none(),
    "scalar": lambda r: r.scalar(),
    "scalar_one": lambda r: r.scalar_one(),
    "scalar_one_or_none": lambda r: r.scalar_one_or_none(),
    "scalars_all": lambda r: r.scalars().all(),
    "scalars_first": lambda r: r.scalars().first(),
    "scalars_one": lambda r: r.scalars().one(),
    "iteration": lambda r: list(r),
    "next": lambda r: next(r),
    "partitions": lambda r: list(r.partitions(2)),
    "mappings": lambda r: r.mappings().all(),
    "tuples": lambda r: r.tuples().all(),
    "unique": lambda r: r.unique().all(),
    "yield_per": lambda r: r.yield_per(1).all(),
}


@pytest.mark.parametrize("consumer", CONSUMERS)
def test_core_buffered_result_errors_are_detached(secured_engine, consumer):
    with secured_engine.connect() as connection:
        result = connection.execute(text("SELECT CAST(:v AS timestamp)"), {"v": CANARY})
        assert isinstance(result, CursorResult)
        with pytest.raises(DetachedDatabaseError) as caught:
            CONSUMERS[consumer](result)
        assert_detached(caught.value)
        assert caught.value.category == "DataError"
        result.close()
        assert result.closed
        connection.rollback()
        assert connection.scalar(text("SELECT 42")) == 42


@pytest.fixture
def mapped_probe(secured_engine):
    class Base(DeclarativeBase):
        pass

    class Probe(Base):
        __tablename__ = "result_probe_" + secrets.token_hex(5)
        id: Mapped[int] = mapped_column(Integer, primary_key=True)
        happened_at: Mapped[datetime] = mapped_column(DateTime)

    table = Probe.__tablename__
    with secured_engine.begin() as connection:
        connection.exec_driver_sql(
            f"CREATE TABLE {table}(id integer PRIMARY KEY, happened_at timestamp)"
        )
        connection.execute(
            text(f"INSERT INTO {table} VALUES (1, CAST(:v AS timestamp))"), {"v": CANARY}
        )
    try:
        yield Probe
    finally:
        with secured_engine.begin() as connection:
            connection.exec_driver_sql(f"DROP TABLE {table}")


@pytest.mark.parametrize("consumer", CONSUMERS)
def test_orm_result_errors_are_detached(secured_engine, mapped_probe, consumer):
    with Session(secured_engine) as session:
        with pytest.raises(DetachedDatabaseError) as caught:
            result = session.execute(select(mapped_probe))
            assert isinstance(result, Result)
            CONSUMERS[consumer](result)
        assert_detached(caught.value)
        session.rollback()
        assert session.scalar(text("SELECT 43")) == 43


@pytest.mark.parametrize("streaming", [False, True])
def test_native_result_types_and_consumption_contract(secured_engine, mapped_probe, streaming):
    with secured_engine.begin() as connection:
        connection.execute(
            text(f"UPDATE {mapped_probe.__tablename__} SET happened_at=:value"),
            {"value": datetime(2026, 4, 23, 11, 37)},
        )
    with secured_engine.connect() as connection:
        if streaming:
            connection = connection.execution_options(yield_per=1)

        def query():
            return connection.execute(text("SELECT i FROM generate_series(1,3) AS g(i)"))

        result = query()
        assert type(result) is CursorResult
        assert list(result.keys()) == ["i"]
        assert type(result.fetchone()) is Row
        assert result.fetchmany(1) == [(2,)]
        assert result.fetchall() == [(3,)]
        assert result.fetchone() is None
        result.close()
        assert result.closed
        with pytest.raises(ResourceClosedError):
            result.fetchone()
        scalar = query().scalars()
        assert type(scalar) is ScalarResult
        assert list(scalar) == [1, 2, 3]
        assert list(scalar) == []
        mapped = query().mappings()
        assert type(mapped) is MappingResult
        values = mapped.all()
        assert all(type(value) is RowMapping for value in values)
        assert [value["i"] for value in values] == [1, 2, 3]
        assert query().yield_per(1).yield_per(2).scalars().all() == [1, 2, 3]
        assert list(query().partitions(2)) == [[(1,), (2,)], [(3,)]]
        assert query().tuples().all() == [(1,), (2,), (3,)]
        assert query().unique().all() == [(1,), (2,), (3,)]
        frozen = query().freeze()
        assert frozen().scalars().all() == frozen().scalars().all() == [1, 2, 3]
        assert query().first() == (1,)
        with pytest.raises(MultipleResultsFound):
            query().one()
        with pytest.raises(NoResultFound):
            connection.execute(text("SELECT 1 WHERE false")).one()
        assert connection.execute(text("SELECT 1 WHERE false")).one_or_none() is None
        assert connection.execute(text("SELECT 1")).scalar_one() == 1
    with Session(secured_engine) as session:
        statement = select(mapped_probe)
        if streaming:
            statement = statement.execution_options(yield_per=1)
        result = session.execute(statement)
        assert isinstance(result, Result)
        instance = result.scalars().one()
        assert type(instance) is mapped_probe
        assert instance.happened_at == datetime(2026, 4, 23, 11, 37)
        assert session.get(mapped_probe, 1) is instance
        assert session.scalars(statement).all() == [instance]
        assert list(session.scalars(statement)) == [instance]


def test_insert_returning_and_no_row_results_keep_native_semantics(secured_engine, mapped_probe):
    with secured_engine.begin() as connection:
        result = connection.execute(
            mapped_probe.__table__.insert().returning(mapped_probe.id),
            [{"id": i, "happened_at": datetime(2026, 1, 1)} for i in range(2, 5)],
        )
        assert type(result) is CursorResult
        assert result.scalars().all() == [2, 3, 4]
        result = connection.execute(
            mapped_probe.__table__.update().where(mapped_probe.id == 4).values(id=5)
        )
        assert result.rowcount == 1
        assert not result.returns_rows
        with pytest.raises(ResourceClosedError):
            result.fetchall()


def test_psycopg_result_metadata_matches_native_driver_behavior(secured_engine):
    ordinary = create_engine(get_settings().database_url)
    snapshots = []
    try:
        for engine in (ordinary, secured_engine):
            with engine.connect() as connection:
                result = connection.execute(text("SELECT 1"))
                snapshot = (result.rowcount, result.returns_rows, result.closed)
                with pytest.raises(AttributeError, match="lastrowid") as caught:
                    _ = result.lastrowid
                snapshots.append((snapshot, type(caught.value)))
                # SQLAlchemy closes the cursor following this unsupported
                # metadata operation, including on an ordinary native engine.
                assert result.cursor.closed
                result.close()
                assert result.closed
                connection.rollback()
                assert connection.scalar(text("SELECT 1")) == 1
        assert snapshots[0] == snapshots[1]
    finally:
        ordinary.dispose()


@pytest.mark.parametrize("stage", ["yield_per_after_execute", "stream_execute", "orm_stream"])
def test_strategy_replacement_stays_protected(secured_engine, mapped_probe, stage):
    with Session(secured_engine) as session:
        with pytest.raises(DetachedDatabaseError) as caught:
            if stage == "orm_stream":
                result = session.scalars(select(mapped_probe).execution_options(yield_per=1))
            else:
                options = {"stream_results": True} if stage == "stream_execute" else {}
                result = (
                    session.execute(
                        text("SELECT CAST(:v AS timestamp)"),
                        {"v": CANARY},
                        execution_options=options,
                    )
                    .yield_per(1)
                    .yield_per(2)
                    .scalars()
                )
            result.all()
        assert_detached(caught.value)
        session.rollback()
        assert session.scalar(text("SELECT 44")) == 44


@pytest.mark.parametrize(
    "failure", [ValueError("safe application error"), asyncio.CancelledError()]
)
def test_application_result_processor_exceptions_are_not_translated(secured_engine, failure):
    class ApplicationType(TypeDecorator):
        impl = Integer
        cache_ok = True

        def process_result_value(self, value, dialect):
            raise failure

    with secured_engine.connect() as connection:
        result = connection.execute(text("SELECT 1 AS v").columns(v=ApplicationType()))
        with pytest.raises(type(failure)) as caught:
            result.fetchone()
        assert caught.value is failure
        result.close()
        connection.rollback()
        assert connection.scalar(text("SELECT 45")) == 45


@pytest.mark.parametrize("terminate", [False, True])
def test_fetch_cancellation_and_disconnect_preserve_bookkeeping(secured_engine, terminate):
    admin = create_engine(get_settings().database_url)
    try:
        with secured_engine.connect() as connection:
            pid = connection.scalar(text("SELECT pg_backend_pid()"))
            result = connection.execution_options(yield_per=1).execute(
                text(
                    "SELECT i, pg_sleep(CASE WHEN i=1 THEN 0 ELSE 5 END) "
                    "FROM generate_series(1,3) AS g(i)"
                )
            )
            assert result.fetchone()[0] == 1
            interrupted = threading.Event()

            def interrupt():
                time.sleep(0.2)
                command = "pg_terminate_backend" if terminate else "pg_cancel_backend"
                with admin.connect() as other:
                    assert other.scalar(text(f"SELECT {command}(:pid)"), {"pid": pid})
                interrupted.set()

            worker = threading.Thread(target=interrupt)
            worker.start()
            try:
                with pytest.raises(DetachedDatabaseError) as caught:
                    result.fetchone()
                assert_detached(caught.value)
                assert caught.value.sqlstate == ("57P01" if terminate else "57014")
                assert caught.value.connection_invalidated is terminate
                assert connection.invalidated is terminate
            finally:
                worker.join(timeout=10)
            assert interrupted.is_set()
            result.close()
            connection.rollback()
            connection.execution_options(stream_results=False, yield_per=None)
            assert connection.scalar(text("SELECT 46")) == 46
    finally:
        admin.dispose()


def test_deferred_commit_failure_remains_detached(secured_engine):
    table = "deferred_result_probe_" + secrets.token_hex(5)
    canary = "deferred-canary-" + secrets.token_hex(8)
    with secured_engine.begin() as connection:
        connection.exec_driver_sql(
            f"CREATE TABLE {table}(v text UNIQUE DEFERRABLE INITIALLY DEFERRED)"
        )
    try:
        with pytest.raises(DetachedDatabaseError) as caught, secured_engine.begin() as connection:
            result = connection.execute(
                text(f"INSERT INTO {table} VALUES (:v), (:v) RETURNING 1"), {"v": canary}
            )
            assert result.scalars().all() == [1, 1]
        assert_detached(caught.value, canary)
        assert caught.value.sqlstate == "23505"
        with secured_engine.connect() as connection:
            assert connection.scalar(text(f"SELECT count(*) FROM {table}")) == 0
    finally:
        with secured_engine.begin() as connection:
            connection.exec_driver_sql(f"DROP TABLE {table}")
