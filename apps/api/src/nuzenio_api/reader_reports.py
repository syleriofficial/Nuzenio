"""Anonymous write-only reports and protected, transactional staff triage."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import math
import time
import unicodedata
import uuid
from datetime import datetime
from typing import Annotated, Literal

import redis
from fastapi import APIRouter, Depends, Query, Request
from pydantic import ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from nuzenio_api.audit import append_audit
from nuzenio_api.auth import AuthenticatedStaff, request_metadata, require_permission
from nuzenio_api.config import get_settings
from nuzenio_api.db import get_db
from nuzenio_api.models import EventCluster, ReaderReport
from nuzenio_api.permissions import Permission
from nuzenio_api.repositories import ReaderRepository
from nuzenio_api.schemas import APIModel, Pagination
from nuzenio_api.services import ApplicationError

router = APIRouter(tags=["reader reports"])
SessionDep = Annotated[Session, Depends(get_db)]
State = Literal["NEW", "REVIEWING", "RESOLVED", "DISMISSED"]
BODY_LIMIT = 16_384


def clean_text(value: str) -> str:
    if any(unicodedata.category(char) in {"Cc", "Cs"} and char not in "\n\t" for char in value):
        raise ValueError("Unsupported control character")
    value = value.strip()
    if len(value) < 10:
        raise ValueError("Please provide at least ten characters")
    return value


class Submission(APIModel):
    model_config = ConfigDict(extra="forbid")
    submission_id: uuid.UUID
    story_slug: str = Field(
        strict=True, min_length=1, max_length=300, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
    )
    language: Literal["en", "hi"]
    category: Literal["INACCURATE", "OUTDATED", "UNCLEAR", "OTHER"]
    details: str = Field(strict=True, min_length=10, max_length=2000)
    _clean_details = field_validator("details")(clean_text)


class Transition(APIModel):
    model_config = ConfigDict(extra="forbid")
    expected_version: int = Field(strict=True, ge=1)
    status: State
    note: str = Field(strict=True, min_length=10, max_length=1000)
    _clean_note = field_validator("note")(clean_text)


class ReportRead(APIModel):
    id: uuid.UUID
    story_slug: str
    cluster_id: uuid.UUID | None
    language: str
    category: str
    details: str
    status: State
    version: int
    resolution_note: str
    handled_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ReportPage(APIModel):
    items: list[ReportRead]
    pagination: Pagination


def fail(code: str, status: int, message: str) -> None:
    raise ApplicationError(code=code, status=status, message=message)


# Atomic global + peer fixed-window admission. No report text, raw IP, UUID or
# user agent is stored in Redis. The proxy does not forward untrusted client IPs:
# proxied visitors intentionally share a peer bucket until trusted ingress exists.
ADMISSION = """
for i=1,2 do
  if tonumber(redis.call('GET',KEYS[i]) or '0') >= tonumber(ARGV[i]) then return 0 end
end
for i=1,2 do
  local value=redis.call('INCR',KEYS[i])
  if value == 1 then redis.call('EXPIRE',KEYS[i],ARGV[3]) end
end
return 1
"""


def admit(peer: str | None) -> None:
    settings = get_settings()
    peer_hash = hmac.new(
        settings.session_hash_pepper.encode(), (peer or "unknown").encode(), hashlib.sha256
    ).hexdigest()
    window = int(time.time()) // settings.report_window_seconds
    prefix = f"{settings.report_key_prefix}:{window}"
    try:
        with redis.Redis.from_url(
            settings.redis_url, socket_connect_timeout=1, socket_timeout=1
        ) as client:
            allowed = client.eval(
                ADMISSION,
                2,
                f"{prefix}:global",
                f"{prefix}:{peer_hash}",
                settings.report_global_limit,
                settings.report_peer_limit,
                settings.report_window_seconds * 2,
            )
    except redis.RedisError:
        fail("report_limiter_unavailable", 503, "Report submission is temporarily unavailable.")
    if allowed != 1:
        fail("report_rate_limited", 429, "Too many report attempts. Please try again later.")


async def read_body(request: Request) -> bytes:
    if request.headers.get("content-type", "").split(";")[0].lower() != "application/json":
        fail("report_content_type", 415, "Send an application/json report.")
    if request.headers.get("content-encoding", "identity").lower() != "identity":
        fail("report_encoding", 415, "Encoded report bodies are not supported.")
    data = bytearray()
    try:
        async with asyncio.timeout(5):
            async for chunk in request.stream():
                if len(data) + len(chunk) > BODY_LIMIT:
                    fail("report_too_large", 413, "The report body is too large.")
                data.extend(chunk)
    except TimeoutError:
        fail("report_timeout", 408, "Report upload timed out.")
    return bytes(data)


def persist(payload: Submission, session: Session, request_id: str) -> dict:
    canonical = payload.model_dump(mode="json", exclude={"submission_id"})
    fingerprint = hashlib.sha256(
        json.dumps(canonical, sort_keys=True, ensure_ascii=True).encode()
    ).hexdigest()
    key = hashlib.sha256(str(payload.submission_id).encode()).hexdigest()
    # Existing exact retries remain acknowledgable even if the story is later
    # withdrawn. There is no public report/status read and no report data returned.
    previous = session.scalar(select(ReaderReport).where(ReaderReport.submission_hash == key))
    if previous:
        if previous.payload_hash != fingerprint:
            fail("report_conflict", 409, "This submission identifier was already used.")
        return {"accepted": True}
    cluster = session.scalar(
        ReaderRepository.reader_ready_clusters(payload.language).where(
            EventCluster.slug == payload.story_slug
        )
    )
    if cluster is None:
        fail("report_story_unavailable", 404, "This story is not publicly available.")
    report_id = session.scalar(
        insert(ReaderReport)
        .values(
            id=uuid.uuid4(),
            cluster_id=cluster.id,
            story_slug=payload.story_slug,
            language=payload.language,
            category=payload.category,
            details=payload.details,
            submission_hash=key,
            payload_hash=fingerprint,
        )
        .on_conflict_do_nothing(index_elements=[ReaderReport.submission_hash])
        .returning(ReaderReport.id)
    )
    if report_id is None:
        previous = session.scalar(select(ReaderReport).where(ReaderReport.submission_hash == key))
        if previous is None or previous.payload_hash != fingerprint:
            fail("report_conflict", 409, "This submission identifier was already used.")
    else:
        append_audit(
            session,
            actor=None,
            action="READER_REPORT_SUBMITTED",
            entity_type="reader_report",
            entity_id=report_id,
            request_id=request_id,
            after={"status": "NEW", "version": 1},
        )
    session.commit()
    return {"accepted": True}


@router.post(
    "/v1/reader-reports",
    status_code=202,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {"schema": Submission.model_json_schema(by_alias=True)}
            },
        }
    },
)
async def submit_report(request: Request, session: SessionDep) -> dict:
    origin = request.headers.get("origin")
    if origin is not None and origin not in get_settings().cors_origins:
        fail("report_origin", 403, "The request origin is not allowed.")
    request_id, peer, _ = request_metadata(request)
    await run_in_threadpool(admit, peer)
    raw = await read_body(request)
    try:
        payload = Submission.model_validate_json(raw)
    except ValidationError:
        fail("invalid_report", 422, "Check the report fields and their length limits.")
    return await run_in_threadpool(persist, payload, session, request_id)


@router.get("/v1/admin/reader-reports", response_model=ReportPage)
def list_reports(
    session: SessionDep,
    context: Annotated[AuthenticatedStaff, Depends(require_permission(Permission.REPORT_READ))],
    status: State | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
) -> ReportPage:
    statement = select(ReaderReport)
    if status:
        statement = statement.where(ReaderReport.status == status)
    total = session.scalar(select(func.count()).select_from(statement.subquery())) or 0
    items = session.scalars(
        statement.order_by(ReaderReport.created_at, ReaderReport.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return ReportPage(
        items=items,
        pagination=Pagination(
            page=page, page_size=page_size, total=total, total_pages=math.ceil(total / page_size)
        ),
    )


@router.patch("/v1/admin/reader-reports/{report_id}", response_model=ReportRead)
def transition_report(
    report_id: uuid.UUID,
    payload: Transition,
    session: SessionDep,
    context: Annotated[
        AuthenticatedStaff, Depends(require_permission(Permission.REPORT_MANAGE, csrf=True))
    ],
) -> ReaderReport:
    report = session.scalar(
        select(ReaderReport).where(ReaderReport.id == report_id).with_for_update()
    )
    if report is None:
        fail("report_not_found", 404, "Report not found.")
    if report.version != payload.expected_version:
        fail("report_stale", 409, "This report changed. Refresh before retrying.")
    allowed = {"NEW": {"REVIEWING"}, "REVIEWING": {"RESOLVED", "DISMISSED"}}
    if payload.status not in allowed.get(report.status, set()):
        fail("report_transition", 409, "This status transition is not allowed.")
    before = {"status": report.status, "version": report.version}
    report.status = payload.status
    report.version += 1
    report.resolution_note = payload.note
    report.handled_by_id = context.user.id
    append_audit(
        session,
        actor=context.user,
        action="READER_REPORT_TRIAGED",
        entity_type="reader_report",
        entity_id=report.id,
        request_id=context.request_id,
        before=before,
        after={"status": report.status, "version": report.version},
    )
    session.commit()
    return report
