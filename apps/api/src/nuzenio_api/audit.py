from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from nuzenio_api.models import AuditLog, StaffUser
from nuzenio_api.serialization import json_safe

SENSITIVE_FRAGMENTS = ("password", "token", "secret", "cookie", "authorization", "csrf")


def redact_sensitive(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): (
                "[REDACTED]"
                if any(fragment in str(key).lower() for fragment in SENSITIVE_FRAGMENTS)
                else redact_sensitive(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_sensitive(item) for item in value]
    return value


def append_audit(
    session: Session,
    *,
    actor: StaffUser | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID | None,
    request_id: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    approval_of_id: uuid.UUID | None = None,
    outcome: str = "SUCCESS",
    reason: str | None = None,
) -> AuditLog:
    record = AuditLog(
        actor_id=actor.id if actor else None,
        actor_role=actor.role.value if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_summary=redact_sensitive(json_safe(before)),
        after_summary=redact_sensitive(json_safe(after)),
        details=redact_sensitive(json_safe(details or {})),
        request_id=request_id,
        ip_address=ip_address,
        user_agent=(user_agent or "")[:500] or None,
        approval_of_id=approval_of_id,
        outcome=outcome,
        reason=reason,
    )
    session.add(record)
    return record
