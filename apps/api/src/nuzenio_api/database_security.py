from __future__ import annotations

from nuzenio_api.environment import Environment, is_production


def engine_logging_options(environment: Environment, *, sql_echo: bool) -> dict[str, bool]:
    """Return the one logging policy used by every application-owned SQLAlchemy engine."""

    production = is_production(environment)
    return {
        "echo": False if production else sql_echo,
        "echo_pool": False,
        "hide_parameters": production,
    }
