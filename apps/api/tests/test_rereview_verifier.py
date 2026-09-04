import json
import os
import signal
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import suppress

import pytest
import redis
from fastapi.testclient import TestClient

from nuzenio_api import password_verification
from nuzenio_api.config import get_settings
from nuzenio_api.login_admission import AdmissionDenied, password_admission
from nuzenio_api.main import app


def attempt(name):
    return (
        TestClient(app)
        .post("/v1/admin/auth/login", json={"username": name, "password": "wrong"})
        .status_code
    )


def wait_pid(path):
    end = time.monotonic() + 5
    while time.monotonic() < end:
        if path.exists() and path.read_text():
            return int(path.read_text())
        time.sleep(0.01)
    raise AssertionError("Fixture worker did not start")


def blocked_worker(monkeypatch, tmp_path, deadline=0.4):
    monkeypatch.setattr(get_settings(), "login_concurrency", 1)
    monkeypatch.setattr(get_settings(), "login_verifier_timeout_seconds", deadline)
    pid_file = tmp_path / "verifier.pid"
    command = [
        sys.executable,
        "-c",
        "import os,time;from pathlib import Path;"
        f"Path({str(pid_file)!r}).write_text(str(os.getpid()));time.sleep(90)",
    ]
    monkeypatch.setattr(password_verification, "_worker_command", lambda _: command)
    return pid_file


def assert_dead(pid):
    with pytest.raises(ProcessLookupError):
        os.kill(pid, 0)


def test_still_running_hasher_must_retain_concurrency_slot(monkeypatch, tmp_path):
    pid_file = blocked_worker(monkeypatch, tmp_path, deadline=65)
    with ThreadPoolExecutor(max_workers=1) as pool:
        first = pool.submit(attempt, "old-lease-fixture")
        pid = wait_pid(pid_file)
        try:
            # Actual elapsed time, not a mocked clock; this failed at the reviewed head.
            time.sleep(61)
            assert attempt("new-lease-fixture") == 429
            assert int(pid_file.read_text()) == pid
        finally:
            os.kill(pid, signal.SIGKILL)
        assert first.result(timeout=5) in (401, 503)
    assert_dead(pid)
    with password_admission("recovered", "fixture"):
        pass


def test_stopped_worker_is_killed_reaped_and_capacity_recovers(monkeypatch, tmp_path):
    pid_file = blocked_worker(monkeypatch, tmp_path)
    with ThreadPoolExecutor(max_workers=1) as pool:
        first = pool.submit(attempt, "stopped-fixture")
        pid = wait_pid(pid_file)
        os.kill(pid, signal.SIGSTOP)
        assert attempt("competing-fixture") == 429
        assert first.result(timeout=4) == 503
    assert_dead(pid)
    with password_admission("recovered", "fixture"):
        pass


def test_redis_loss_during_work_terminates_it_before_capacity_release(monkeypatch, tmp_path):
    pid_file = blocked_worker(monkeypatch, tmp_path, deadline=5)
    original_ping = redis.Redis.ping
    with ThreadPoolExecutor(max_workers=1) as pool:
        first = pool.submit(attempt, "redis-loss-fixture")
        pid = wait_pid(pid_file)

        def unavailable(*args, **kwargs):
            raise redis.ConnectionError("Fixture outage")

        monkeypatch.setattr(redis.Redis, "ping", unavailable)
        assert first.result(timeout=4) == 503
    assert_dead(pid)
    monkeypatch.setattr(redis.Redis, "ping", original_ping)
    with password_admission("recovery", "fixture"):
        pass


def test_parent_death_does_not_release_inherited_live_worker_lock(monkeypatch, tmp_path):
    monkeypatch.setattr(get_settings(), "login_concurrency", 1)
    pid_file = tmp_path / "orphan.pid"
    child = None
    # Close the parent's descriptor, as after process death, while the child still
    # has its inherited open-file-description. Redis key loss is not authoritative.
    try:
        with password_admission("parent", "fixture") as admission:
            child = subprocess.Popen(
                [
                    sys.executable,
                    "-c",
                    "import os,time;from pathlib import Path;"
                    f"Path({str(pid_file)!r}).write_text(str(os.getpid()));time.sleep(30)",
                ],
                pass_fds=(admission.slot_fd,),
            )
            wait_pid(pid_file)
        with pytest.raises(AdmissionDenied), password_admission("replacement", "fixture"):
            pytest.fail("Live child ownership was lost")
        os.kill(child.pid, signal.SIGSTOP)
        with pytest.raises(AdmissionDenied), password_admission("replacement2", "fixture"):
            pytest.fail("Suspension must not release capacity")
        os.kill(child.pid, signal.SIGCONT)
        with pytest.raises(AdmissionDenied), password_admission("replacement3", "fixture"):
            pytest.fail("Resumed work still owns capacity")
    finally:
        if child:
            child.kill()
            child.wait()
    with password_admission("recovered", "fixture"):
        pass


def test_capacity_configuration_cannot_change_while_domain_is_live(monkeypatch):
    monkeypatch.setattr(get_settings(), "login_concurrency", 1)
    with password_admission("first", "fixture"):
        monkeypatch.setattr(get_settings(), "login_concurrency", 2)
        with pytest.raises(AdmissionDenied), password_admission("second", "fixture"):
            pytest.fail("Inconsistent process capacity must fail closed")


@pytest.mark.parametrize("signal_to_parent", [signal.SIGSTOP, signal.SIGKILL])
def test_actual_supervisor_suspension_or_death_retains_live_child_capacity(
    monkeypatch, tmp_path, signal_to_parent
):
    settings = get_settings()
    monkeypatch.setattr(settings, "login_concurrency", 1)
    monkeypatch.setattr(settings, "login_attempt_limit", 100)
    monkeypatch.setattr(settings, "login_ip_limit", 100)
    pid_file = tmp_path / "supervised-child.pid"
    child_command = [
        sys.executable,
        "-c",
        "import os,signal,time;from pathlib import Path;"
        "signal.signal(signal.SIGALRM,signal.SIG_DFL);signal.setitimer(signal.ITIMER_REAL,2);"
        f"Path({str(pid_file)!r}).write_text(str(os.getpid()));time.sleep(30)",
    ]
    code = """
import json, sys
from nuzenio_api import password_verification
from nuzenio_api.login_admission import password_admission, AdmissionDenied
password_verification._worker_command = lambda _: json.loads(sys.argv[1])
try:
    with password_admission('supervisor', 'fixture') as admission:
        password_verification.verify_password('fixture', 'fixture', admission)
except AdmissionDenied:
    pass
"""
    env = {
        **os.environ,
        "NUZENIO_ENVIRONMENT": "test",
        "NUZENIO_REDIS_URL": settings.redis_url,
        "NUZENIO_LOGIN_KEY_PREFIX": settings.login_key_prefix,
        "NUZENIO_LOGIN_CONCURRENCY": "1",
        "NUZENIO_LOGIN_LOCK_DIRECTORY": settings.login_lock_directory,
        "NUZENIO_LOGIN_VERIFIER_TIMEOUT_SECONDS": "5",
    }
    parent = subprocess.Popen([sys.executable, "-c", code, json.dumps(child_command)], env=env)
    child_pid = None
    try:
        child_pid = wait_pid(pid_file)
        os.kill(child_pid, signal.SIGSTOP)
        os.kill(parent.pid, signal_to_parent)
        if signal_to_parent == signal.SIGKILL:
            parent.wait(timeout=3)
        # No expiring Redis key can take ownership from suspended/resumable work.
        with pytest.raises(AdmissionDenied), password_admission("competitor", "fixture"):
            pytest.fail("Live child lost capacity after supervisor failure")
        os.kill(child_pid, signal.SIGCONT)
        if signal_to_parent == signal.SIGSTOP:
            os.kill(parent.pid, signal.SIGCONT)
            parent.wait(timeout=6)
        end = time.monotonic() + 6
        while True:
            try:
                with password_admission("recovery", "fixture"):
                    break
            except AdmissionDenied:
                if time.monotonic() > end:
                    raise AssertionError("Terminated work leaked capacity") from None
                time.sleep(0.15)
    finally:
        if parent.poll() is None:
            parent.kill()
        parent.wait()
        if child_pid:
            with suppress(ProcessLookupError):
                os.kill(child_pid, signal.SIGKILL)


def test_cancelling_awaiter_does_not_cancel_or_release_running_work(monkeypatch, tmp_path):
    pid_file = blocked_worker(monkeypatch, tmp_path, deadline=0.8)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(attempt, "cancelled-awaiter")
        pid = wait_pid(pid_file)
        assert future.cancel() is False  # A thread is still executing the supervised work.
        assert attempt("replacement") == 429
        assert future.result(timeout=4) == 503
    assert_dead(pid)
    with password_admission("recovery", "fixture"):
        pass
