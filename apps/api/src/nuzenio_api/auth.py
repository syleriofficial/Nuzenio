from __future__ import annotations

import hashlib
import hmac
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from argon2.low_level import Type
from fastapi import Depends, Request
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from nuzenio_api.audit import append_audit
from nuzenio_api.config import get_settings
from nuzenio_api.db import get_db
from nuzenio_api.models import (
    AuthenticationEvent,
    LoginThrottle,
    StaffRole,
    StaffSession,
    StaffUser,
)
from nuzenio_api.permissions import Permission, has_permission, permissions_for
from nuzenio_api.services import ApplicationError

PASSWORD_HASHER = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)
_DUMMY_HASH = PASSWORD_HASHER.hash("not-a-real-nuzenio-password")


def _now() -> datetime:
    return datetime.now(UTC)


def normalize_username(value: str) -> str:
    return value.strip().casefold()


def _keyed_hash(value: str) -> str:
    settings = get_settings()
    return hmac.new(
        settings.session_hash_pepper.encode(), value.encode(), hashlib.sha256
    ).hexdigest()


def hash_session_token(value: str) -> str:
    return _keyed_hash(f"session:{value}")


def hash_csrf_token(value: str) -> str:
    return _keyed_hash(f"csrf:{value}")


def hash_login_subject(username: str, ip_address: str | None) -> str:
    return _keyed_hash(f"login:{normalize_username(username)}:{ip_address or 'unknown'}")


def validate_password(password: str) -> None:
    if (
        len(password) < 12
        or not any(character.islower() for character in password)
        or not any(character.isupper() for character in password)
        or not any(character.isdigit() for character in password)
        or not any(not character.isalnum() for character in password)
    ):
        raise ValueError(
            "Password must be at least 12 characters and include upper, lower, number, and symbol."
        )


def create_staff_user(
    session: Session,
    *,
    username: str,
    display_name: str,
    password: str,
    role: StaffRole,
) -> StaffUser:
    normalized = normalize_username(username)
    if not normalized or len(normalized) > 120:
        raise ValueError("Username must contain between 1 and 120 characters.")
    validate_password(password)
    if session.scalar(select(StaffUser.id).where(StaffUser.username == normalized)):
        raise ValueError("A staff account with that username already exists.")
    user = StaffUser(
        username=normalized,
        display_name=display_name.strip(),
        password_hash=PASSWORD_HASHER.hash(password),
        role=role,
        active=True,
    )
    session.add(user)
    session.flush()
    return user


@dataclass(frozen=True)
class LoginResult:
    user: StaffUser
    session: StaffSession
    session_token: str
    csrf_token: str


@dataclass(frozen=True)
class AuthenticatedStaff:
    user: StaffUser
    session: StaffSession
    request_id: str
    ip_address: str | None
    user_agent: str | None

    @property
    def permissions(self) -> list[str]:
        return permissions_for(self.user.role)


def request_metadata(request: Request) -> tuple[str, str | None, str | None]:
    request_id = getattr(request.state, "request_id", "unknown")
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return request_id, ip_address, user_agent


class AuthService:
    def __init__(self, session: Session):
        self.session = session
        self.settings = get_settings()

    def _auth_event(
        self,
        *,
        username: str,
        user: StaffUser | None,
        successful: bool,
        reason: str | None,
        request_id: str,
        ip_address: str | None,
        user_agent: str | None,
        action: str = "LOGIN",
    ) -> None:
        self.session.add(
            AuthenticationEvent(
                user_id=user.id if user else None,
                username_hash=_keyed_hash(f"username:{normalize_username(username)}"),
                action=action,
                successful=successful,
                reason=reason,
                request_id=request_id,
                ip_address=ip_address,
                user_agent=(user_agent or "")[:500] or None,
            )
        )

    def login(
        self,
        *,
        username: str,
        password: str,
        request_id: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> LoginResult:
        now = _now()
        normalized = normalize_username(username)
        subject_hash = hash_login_subject(normalized, ip_address)
        throttle = self.session.scalar(
            select(LoginThrottle)
            .where(LoginThrottle.subject_hash == subject_hash)
            .with_for_update()
        )
        if throttle is None:
            throttle = LoginThrottle(subject_hash=subject_hash, window_started_at=now)
            self.session.add(throttle)
            self.session.flush()
        user = self.session.scalar(select(StaffUser).where(StaffUser.username == normalized))
        locked = bool(throttle.locked_until and throttle.locked_until > now)
        candidate_hash = user.password_hash if user else _DUMMY_HASH
        valid = False
        try:
            valid = PASSWORD_HASHER.verify(candidate_hash, password)
        except (VerificationError, InvalidHashError):
            valid = False
        valid = bool(valid and user and user.active and not locked)

        if not valid:
            throttle.failed_attempts += 1
            if throttle.failed_attempts >= self.settings.login_attempt_limit:
                throttle.locked_until = now + timedelta(minutes=self.settings.login_lockout_minutes)
            reason = "LOCKED" if locked or throttle.locked_until else "INVALID_CREDENTIALS"
            self._auth_event(
                username=normalized,
                user=user,
                successful=False,
                reason=reason,
                request_id=request_id,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            append_audit(
                self.session,
                actor=user,
                action="STAFF_LOGIN",
                entity_type="StaffUser",
                entity_id=user.id if user else None,
                request_id=request_id,
                ip_address=ip_address,
                user_agent=user_agent,
                outcome="FAILURE",
                reason=reason,
            )
            self.session.commit()
            raise ApplicationError(
                code="login_failed",
                message="Unable to sign in with those credentials. Please try again later.",
                status=429 if reason == "LOCKED" else 401,
            )

        throttle.failed_attempts = 0
        throttle.locked_until = None
        throttle.window_started_at = now
        session_token = secrets.token_urlsafe(32)
        csrf_token = secrets.token_urlsafe(32)
        staff_session = StaffSession(
            user_id=user.id,
            token_hash=hash_session_token(session_token),
            csrf_hash=hash_csrf_token(csrf_token),
            expires_at=now + timedelta(minutes=self.settings.session_ttl_minutes),
            ip_address=ip_address,
            user_agent=(user_agent or "")[:500] or None,
        )
        user.last_login_at = now
        self.session.add(staff_session)
        self.session.flush()
        self._auth_event(
            username=normalized,
            user=user,
            successful=True,
            reason=None,
            request_id=request_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        append_audit(
            self.session,
            actor=user,
            action="STAFF_LOGIN",
            entity_type="StaffSession",
            entity_id=staff_session.id,
            request_id=request_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.session.commit()
        self.session.refresh(staff_session)
        return LoginResult(user, staff_session, session_token, csrf_token)

    def logout(self, context: AuthenticatedStaff) -> None:
        context.session.revoked_at = _now()
        self._auth_event(
            username=context.user.username,
            user=context.user,
            successful=True,
            reason=None,
            action="LOGOUT",
            request_id=context.request_id,
            ip_address=context.ip_address,
            user_agent=context.user_agent,
        )
        append_audit(
            self.session,
            actor=context.user,
            action="STAFF_LOGOUT",
            entity_type="StaffSession",
            entity_id=context.session.id,
            request_id=context.request_id,
            ip_address=context.ip_address,
            user_agent=context.user_agent,
        )
        self.session.commit()

    def revoke_user_sessions(
        self, user_id: object, *, except_session_id: object | None = None
    ) -> int:
        statement = (
            update(StaffSession)
            .where(StaffSession.user_id == user_id, StaffSession.revoked_at.is_(None))
            .values(revoked_at=_now())
        )
        if except_session_id:
            statement = statement.where(StaffSession.id != except_session_id)
        return int(self.session.execute(statement).rowcount or 0)


def current_staff(
    request: Request,
    session: Annotated[Session, Depends(get_db)],
) -> AuthenticatedStaff:
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    if not raw_token:
        raise ApplicationError(
            code="authentication_required",
            message="Staff authentication is required.",
            status=401,
        )
    staff_session = session.scalar(
        select(StaffSession)
        .where(StaffSession.token_hash == hash_session_token(raw_token))
        .options(selectinload(StaffSession.user))
    )
    now = _now()
    if (
        staff_session is None
        or staff_session.revoked_at is not None
        or staff_session.expires_at <= now
        or not staff_session.user.active
    ):
        raise ApplicationError(
            code="session_invalid",
            message="The staff session is invalid or expired.",
            status=401,
        )
    request_id, ip_address, user_agent = request_metadata(request)
    return AuthenticatedStaff(
        user=staff_session.user,
        session=staff_session,
        request_id=request_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )


def require_permission(
    permission: Permission, *, csrf: bool = False
) -> Callable[..., AuthenticatedStaff]:
    def dependency(
        request: Request,
        context: Annotated[AuthenticatedStaff, Depends(current_staff)],
    ) -> AuthenticatedStaff:
        if not has_permission(context.user.role, permission):
            raise ApplicationError(
                code="permission_denied",
                message="This staff role is not authorized for the requested operation.",
                status=403,
            )
        if csrf:
            settings = get_settings()
            header_token = request.headers.get("x-csrf-token")
            cookie_token = request.cookies.get(settings.csrf_cookie_name)
            if (
                not header_token
                or not cookie_token
                or not secrets.compare_digest(header_token, cookie_token)
                or not secrets.compare_digest(
                    hash_csrf_token(header_token), context.session.csrf_hash
                )
            ):
                raise ApplicationError(
                    code="csrf_failed",
                    message="The request could not be verified. Refresh and try again.",
                    status=403,
                )
        return context

    return dependency
