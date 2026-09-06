"""Canonical deployment-environment classification shared by every entry point."""

from __future__ import annotations

import os
from enum import StrEnum


class Environment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


def parse_environment(value: object) -> Environment:
    """Accept only canonical supported values; malformed production must fail closed."""

    if isinstance(value, Environment):
        return value
    if not isinstance(value, str) or not value:
        raise ValueError("Environment must be one of: development, test, production")
    try:
        return Environment(value)
    except ValueError as error:
        raise ValueError("Environment must be one of: development, test, production") from error


def environment_from_os(*, default: Environment | None = None) -> Environment:
    raw = os.environ.get("NUZENIO_ENVIRONMENT")
    if raw is None:
        if default is None:
            raise ValueError("NUZENIO_ENVIRONMENT is required")
        return default
    return parse_environment(raw)


def is_production(environment: Environment) -> bool:
    return environment is Environment.PRODUCTION
