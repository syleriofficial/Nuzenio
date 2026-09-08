from __future__ import annotations

import logging
import re
from collections.abc import Callable
from typing import Any

from sqlalchemy import Connection, Engine, event
from sqlalchemy.engine import CursorResult
from sqlalchemy.engine.cursor import ResultFetchStrategy
from sqlalchemy.exc import DBAPIError, SQLAlchemyError

from nuzenio_api.environment import Environment, is_production, parse_environment

_SAFE_SQLSTATE = re.compile(r"[A-Z0-9]{5}")
_SQLALCHEMY_LOGGER_ROOTS = (
    "sqlalchemy",
    "sqlalchemy.engine",
    "sqlalchemy.engine.Engine",
    "sqlalchemy.pool",
)


class _SanitizedDatabaseDriverError(Exception):
    """Non-secret production replacement for a database-driver exception."""

    def __init__(self, category: str, sqlstate: str | None) -> None:
        self.category = category
        self.sqlstate = sqlstate
        suffix = f" (SQLSTATE {sqlstate})" if sqlstate else ""
        super().__init__(f"{category}{suffix}")


class DetachedDatabaseError(SQLAlchemyError):
    """Metadata-only database failure with no reachable driver exception."""

    def __init__(
        self,
        *,
        category: str,
        sqlstate: str | None,
        connection_invalidated: bool,
    ) -> None:
        self.category = category
        self.sqlstate = sqlstate
        self.connection_invalidated = connection_invalidated
        suffix = f", SQLSTATE {sqlstate}" if sqlstate else ""
        super().__init__(f"Database operation failed ({category}{suffix}).")


class _ProductionSQLAlchemyFilter(logging.Filter):
    """Drop result-row DEBUG records even if a descendant level is changed later."""

    _nuzenio_sqlalchemy_filter = True

    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno >= logging.INFO


def configure_sqlalchemy_logging(environment: Environment | str) -> None:
    """Own SQLAlchemy namespace routing and remove unsafe direct handlers."""

    production = is_production(parse_environment(environment))
    if not production:
        return
    logger_names = set(_SQLALCHEMY_LOGGER_ROOTS)
    logger_names.update(
        name
        for name in logging.root.manager.loggerDict
        if name == "sqlalchemy" or name.startswith("sqlalchemy.")
    )
    for logger_name in logger_names:
        logger = logging.getLogger(logger_name)
        # SQLAlchemy's echo helpers and operator-installed namespace handlers
        # bypass the application's structured boundary, so the application owns
        # routing for this namespace and sends records through the root handlers.
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)
        for existing_filter in logger.filters[:]:
            if getattr(existing_filter, "_nuzenio_sqlalchemy_filter", False):
                logger.removeFilter(existing_filter)
        logger.addFilter(_ProductionSQLAlchemyFilter())
        logger.setLevel(logging.INFO)
        logger.disabled = False
        logger.propagate = True


def _safe_database_error(context: Any) -> DBAPIError | None:
    original = context.original_exception
    if not isinstance(original, context.dialect.loaded_dbapi.Error):
        # handle_error also observes non-driver failures (for example the
        # unsupported Psycopg lastrowid attribute). Preserve their native type.
        return None
    sqlstate = getattr(original, "sqlstate", None)
    if not isinstance(sqlstate, str) or not _SAFE_SQLSTATE.fullmatch(sqlstate):
        sqlstate = None
    # This is an intermediate SQLAlchemy-compatible error. The outer production
    # connection boundary discards its complete graph after SQLAlchemy finishes
    # normal transaction and pool bookkeeping; it never mutates the driver error.
    sanitized = _SanitizedDatabaseDriverError(type(original).__name__, sqlstate)
    return DBAPIError.instance(
        context.statement,
        None,
        sanitized,
        Exception,
        hide_parameters=True,
        connection_invalidated=context.is_disconnect,
        dialect=context.dialect,
    )


def _detached_database_error(error: DBAPIError) -> DetachedDatabaseError:
    original = error.orig
    sqlstate = getattr(original, "sqlstate", None)
    if not isinstance(sqlstate, str) or not _SAFE_SQLSTATE.fullmatch(sqlstate):
        sqlstate = None
    category = getattr(original, "category", None)
    if not isinstance(category, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,79}", category):
        category = type(error).__name__
    return DetachedDatabaseError(
        category=category,
        sqlstate=sqlstate,
        connection_invalidated=bool(error.connection_invalidated),
    )


def _call_with_detached_database_errors(operation: Callable[..., Any], *args: Any, **kwargs: Any):
    """Raise only after leaving the active DBAPI exception context.

    SQLAlchemy must first perform its normal rollback/invalidation bookkeeping.
    The caught exception is deliberately not retained by the replacement.
    """

    detached: DetachedDatabaseError | None = None
    try:
        return operation(*args, **kwargs)
    except DBAPIError as error:
        detached = _detached_database_error(error)
    if detached is not None:
        raise detached from None
    raise AssertionError("Database exception translation reached an invalid state")


def _protect_result_consumption(result: CursorResult[Any]) -> None:
    if not isinstance(result.cursor_strategy, _ProductionFetchStrategy):
        result.cursor_strategy = _ProductionFetchStrategy(result.cursor_strategy)


class _ProductionFetchStrategy(ResultFetchStrategy):
    """Detach *after* SQLAlchemy's fetch strategy handles the driver failure.

    SQLAlchemy has no public around-fetch error hook. This narrow, private 2.x
    integration preserves the actual CursorResult/ScalarResult/ORM objects and
    delegates cursor cleanup and pool invalidation to their original strategy.
    Compatibility tests cover strategy replacement, buffered and streaming
    consumption. Revalidate this boundary whenever SQLAlchemy is upgraded.
    """

    __slots__ = ("_delegate",)

    def __init__(self, delegate: ResultFetchStrategy) -> None:
        self._delegate = delegate

    @property
    def alternate_cursor_description(self):
        return self._delegate.alternate_cursor_description

    def _invoke(self, method: str, result: CursorResult[Any], *args: Any):
        try:
            return _call_with_detached_database_errors(
                getattr(self._delegate, method), result, *args
            )
        finally:
            # yield_per() and close/exhaustion may replace the native strategy.
            # Protect its replacement without changing cursor/result semantics.
            _protect_result_consumption(result)

    def fetchone(self, result, dbapi_cursor, hard_close=False):
        return self._invoke("fetchone", result, dbapi_cursor, hard_close)

    def fetchmany(self, result, dbapi_cursor, size=None):
        return self._invoke("fetchmany", result, dbapi_cursor, size)

    def fetchall(self, result, dbapi_cursor):
        return self._invoke("fetchall", result, dbapi_cursor)

    def soft_close(self, result, dbapi_cursor):
        return self._invoke("soft_close", result, dbapi_cursor)

    def hard_close(self, result, dbapi_cursor):
        return self._invoke("hard_close", result, dbapi_cursor)

    def yield_per(self, result, dbapi_cursor, num):
        return self._invoke("yield_per", result, dbapi_cursor, num)

    def handle_exception(self, result, dbapi_cursor, error):
        # Keep SQLAlchemy's metadata-property handling unchanged. Psycopg's
        # rowcount is a cached integer; PostgreSQL inserts use RETURNING rather
        # than lastrowid. Driver I/O lives in the protected fetch methods above.
        return self._delegate.handle_exception(result, dbapi_cursor, error)


class _ProductionConnection(Connection):
    """Connection boundary that removes SQLAlchemy/Psycopg exception graphs."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        _call_with_detached_database_errors(super().__init__, *args, **kwargs)

    def _execute_context(self, *args: Any, **kwargs: Any):
        result = _call_with_detached_database_errors(super()._execute_context, *args, **kwargs)
        _protect_result_consumption(result)
        return result

    def _commit_impl(self) -> None:
        _call_with_detached_database_errors(super()._commit_impl)

    def _rollback_impl(self) -> None:
        _call_with_detached_database_errors(super()._rollback_impl)

    def close(self) -> None:
        _call_with_detached_database_errors(super().close)


def engine_logging_options(environment: Environment | str, *, sql_echo: bool) -> dict[str, bool]:
    """Return the one logging policy used by every application-owned SQLAlchemy engine."""

    parsed_environment = parse_environment(environment)
    production = is_production(parsed_environment)
    return {
        "echo": False if production else sql_echo,
        "echo_pool": False,
        "hide_parameters": production,
    }


def harden_database_engine(engine: Engine, environment: Environment | str) -> Engine:
    """Hide driver-provided parameter details at the production engine boundary."""

    parsed_environment = parse_environment(environment)
    configure_sqlalchemy_logging(parsed_environment)
    if is_production(parsed_environment):
        event.listen(engine, "handle_error", _safe_database_error, retval=True)
        # Engine.connect() consults this factory for API, worker, ORM, Alembic,
        # and role-provisioning connections. SQLAlchemy remains responsible for
        # transaction/pool handling; only the already-processed outward error is
        # replaced at the outer connection boundary.
        engine._connection_cls = _ProductionConnection  # type: ignore[attr-defined]
    return engine
