from __future__ import annotations

import logging
import re
from contextlib import suppress
from typing import Any

from sqlalchemy import Engine, event
from sqlalchemy.exc import DBAPIError

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
    detail = type(original).__name__
    if isinstance(sqlstate, str) and _SAFE_SQLSTATE.fullmatch(sqlstate):
        detail = f"{detail} (SQLSTATE {sqlstate})"
    # SQLAlchemy chains a replacement exception from the original DBAPI error.
    # Psycopg server details can repeat bound values, so sanitize the chained
    # exception before SQLAlchemy attaches it as __cause__/__context__.
    with suppress(AttributeError, TypeError):
        original.args = (detail,)
    sanitized = _SanitizedDatabaseDriverError(detail)
    return DBAPIError.instance(
        context.statement,
        None,
        sanitized,
        Exception,
        hide_parameters=True,
        connection_invalidated=context.is_disconnect,
        dialect=context.dialect,
    )


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
    return engine
