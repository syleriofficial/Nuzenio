from __future__ import annotations

import json
import threading
from dataclasses import asdict, dataclass
from enum import StrEnum
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from time import monotonic
from typing import Any

from nuzenio_api.config import Settings, get_settings


class WorkerRunOutcome(StrEnum):
    SUCCEEDED = "succeeded"
    SKIPPED = "skipped"
    RETRYING = "retrying"
    DEAD_LETTERED = "dead_lettered"
    LOST_LEASE = "lost_lease"
    FAILED = "failed"
    CANCELLED = "cancelled"
    ACTIVE_ELSEWHERE = "active_elsewhere"
    ALREADY_TERMINAL = "already_terminal"


@dataclass(frozen=True)
class WorkerSnapshot:
    lifecycle: str
    ready: bool
    current_run_id: str | None
    seconds_since_iteration: float | None
    iterations_total: int
    iteration_failures_total: int
    recovered_runs_total: int
    scheduled_runs_total: int
    completed_runs_total: int
    skipped_runs_total: int
    retry_runs_total: int
    dead_letter_runs_total: int
    failed_runs_total: int
    cancelled_runs_total: int
    lost_lease_total: int


class WorkerStatus:
    def __init__(self, *, stale_after_seconds: int) -> None:
        self._lock = threading.Lock()
        self._stale_after_seconds = stale_after_seconds
        self._lifecycle = "starting"
        self._dependencies_ready = False
        self._last_iteration: float | None = None
        self._current_run_id: str | None = None
        self._iterations = 0
        self._failures = 0
        self._recovered = 0
        self._scheduled = 0
        self._completed = 0
        self._skipped = 0
        self._retries = 0
        self._dead_letters = 0
        self._run_failures = 0
        self._cancelled = 0
        self._lost_leases = 0

    def iteration(
        self,
        *,
        dependencies_ready: bool,
        recovered: int = 0,
        scheduled: int = 0,
    ) -> None:
        with self._lock:
            self._lifecycle = "running"
            self._dependencies_ready = dependencies_ready
            self._last_iteration = monotonic()
            self._iterations += 1
            self._recovered += recovered
            self._scheduled += scheduled

    def iteration_failed(self) -> None:
        with self._lock:
            self._dependencies_ready = False
            self._last_iteration = monotonic()
            self._iterations += 1
            self._failures += 1

    def started_run(self, run_id: str) -> None:
        with self._lock:
            self._current_run_id = run_id

    def finished_run(self, outcome: WorkerRunOutcome) -> None:
        with self._lock:
            self._current_run_id = None
            self._completed += int(outcome is WorkerRunOutcome.SUCCEEDED)
            self._skipped += int(outcome is WorkerRunOutcome.SKIPPED)
            self._retries += int(outcome is WorkerRunOutcome.RETRYING)
            self._dead_letters += int(outcome is WorkerRunOutcome.DEAD_LETTERED)
            self._run_failures += int(outcome is WorkerRunOutcome.FAILED)
            self._cancelled += int(outcome is WorkerRunOutcome.CANCELLED)
            self._lost_leases += int(outcome is WorkerRunOutcome.LOST_LEASE)

    def stopping(self) -> None:
        with self._lock:
            self._lifecycle = "stopping"
            self._dependencies_ready = False

    def snapshot(self) -> WorkerSnapshot:
        with self._lock:
            age = monotonic() - self._last_iteration if self._last_iteration is not None else None
            ready = bool(
                self._lifecycle == "running"
                and self._dependencies_ready
                and age is not None
                and age <= self._stale_after_seconds
            )
            return WorkerSnapshot(
                lifecycle=self._lifecycle,
                ready=ready,
                current_run_id=self._current_run_id,
                seconds_since_iteration=round(age, 3) if age is not None else None,
                iterations_total=self._iterations,
                iteration_failures_total=self._failures,
                recovered_runs_total=self._recovered,
                scheduled_runs_total=self._scheduled,
                completed_runs_total=self._completed,
                skipped_runs_total=self._skipped,
                retry_runs_total=self._retries,
                dead_letter_runs_total=self._dead_letters,
                failed_runs_total=self._run_failures,
                cancelled_runs_total=self._cancelled,
                lost_lease_total=self._lost_leases,
            )


def _metrics(snapshot: WorkerSnapshot) -> str:
    values = {
        "nuzenio_worker_ready": int(snapshot.ready),
        "nuzenio_worker_iterations_total": snapshot.iterations_total,
        "nuzenio_worker_iteration_failures_total": snapshot.iteration_failures_total,
        "nuzenio_worker_recovered_runs_total": snapshot.recovered_runs_total,
        "nuzenio_worker_scheduled_runs_total": snapshot.scheduled_runs_total,
        "nuzenio_worker_completed_runs_total": snapshot.completed_runs_total,
        "nuzenio_worker_skipped_runs_total": snapshot.skipped_runs_total,
        "nuzenio_worker_retry_runs_total": snapshot.retry_runs_total,
        "nuzenio_worker_dead_letter_runs_total": snapshot.dead_letter_runs_total,
        "nuzenio_worker_failed_runs_total": snapshot.failed_runs_total,
        "nuzenio_worker_cancelled_runs_total": snapshot.cancelled_runs_total,
        "nuzenio_worker_lost_lease_total": snapshot.lost_lease_total,
    }
    return "\n".join([*(f"{key} {value}" for key, value in values.items()), ""])


def _handler(status: WorkerStatus) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
            snapshot = status.snapshot()
            if self.path == "/health/live":
                self._json(HTTPStatus.OK, {"status": "ok", "service": "nuzenio-worker"})
                return
            if self.path == "/health/ready":
                code = HTTPStatus.OK if snapshot.ready else HTTPStatus.SERVICE_UNAVAILABLE
                self._json(code, asdict(snapshot))
                return
            if self.path == "/metrics":
                body = _metrics(snapshot).encode()
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            self._json(HTTPStatus.NOT_FOUND, {"status": "not_found"})

        def _json(self, code: HTTPStatus, payload: dict[str, Any]) -> None:
            body = json.dumps(payload, separators=(",", ":")).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, _format: str, *_args: Any) -> None:
            return

    return Handler


def start_worker_health_server(
    status: WorkerStatus,
    settings: Settings | None = None,
    *,
    port: int | None = None,
) -> tuple[ThreadingHTTPServer, threading.Thread]:
    configured = settings or get_settings()
    server = ThreadingHTTPServer(
        (
            configured.worker_health_host,
            configured.worker_health_port if port is None else port,
        ),
        _handler(status),
    )
    thread = threading.Thread(
        target=server.serve_forever,
        name="nuzenio-worker-health",
        daemon=True,
    )
    thread.start()
    return server, thread
