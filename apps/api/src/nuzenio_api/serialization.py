"""Canonical JSON boundaries: reject unknown values rather than dropping audit data."""

from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID


def json_safe(value: Any) -> Any:
    if isinstance(value, Enum):
        return json_safe(value.value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [json_safe(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise TypeError(f"Unsupported audit value: {type(value).__name__}")
