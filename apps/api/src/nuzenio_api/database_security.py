from __future__ import annotations

import logging
import re
from collections.abc import Callable
from typing import Any

from sqlalchemy import Connection, Engine, event
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


def _safe_database_error(context: Any) -> DBAPIError:
    original = context.original_exception
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


class _ProductionConnection(Connection):
    """Connection boundary that removes SQLAlchemy/Psycopg exception graphs."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        _call_with_detached_database_errors(super().__init__, *args, **kwargs)

    def _execute_context(self, *args: Any, **kwargs: Any):
        return _call_with_detached_database_errors(super()._execute_context, *args, **kwargs)

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
