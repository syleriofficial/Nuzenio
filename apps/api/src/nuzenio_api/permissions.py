from __future__ import annotations

from enum import StrEnum

from nuzenio_api.models import StaffRole


class Permission(StrEnum):
    STAFF_MANAGE = "staff:manage"
    REVIEW_READ = "review:read"
    CLUSTER_EDIT = "cluster:edit"
    CLAIM_EDIT = "claim:edit"
    SUMMARY_REVIEW = "summary:review"
    HIGH_RISK_APPROVE = "high-risk:approve"
    CORRECTION_MANAGE = "correction:manage"
    PUBLISHER_MANAGE = "publisher:manage"
    RIGHTS_REVIEW = "rights:review"
    FEED_OPERATE = "feed:operate"
    EDITION_PAUSE = "edition:pause"
    AUDIT_READ = "audit:read"
    AUDIT_EXPORT = "audit:export"


ALL_PERMISSIONS = frozenset(Permission)

ROLE_PERMISSIONS: dict[StaffRole, frozenset[Permission]] = {
    StaffRole.ADMINISTRATOR: ALL_PERMISSIONS,
    StaffRole.EDITOR: frozenset(
        {
            Permission.REVIEW_READ,
            Permission.CLUSTER_EDIT,
            Permission.CLAIM_EDIT,
            Permission.SUMMARY_REVIEW,
            Permission.CORRECTION_MANAGE,
        }
    ),
    StaffRole.REVIEWER: frozenset(
        {
            Permission.REVIEW_READ,
            Permission.CLAIM_EDIT,
            Permission.SUMMARY_REVIEW,
            Permission.HIGH_RISK_APPROVE,
            Permission.CORRECTION_MANAGE,
        }
    ),
    StaffRole.PUBLISHER_MANAGER: frozenset(
        {
            Permission.REVIEW_READ,
            Permission.PUBLISHER_MANAGE,
            Permission.RIGHTS_REVIEW,
            Permission.FEED_OPERATE,
        }
    ),
    StaffRole.ANALYST: frozenset(
        {Permission.REVIEW_READ, Permission.AUDIT_READ, Permission.AUDIT_EXPORT}
    ),
}


def permissions_for(role: StaffRole) -> list[str]:
    return sorted(item.value for item in ROLE_PERMISSIONS[role])


def has_permission(role: StaffRole, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS[role]
