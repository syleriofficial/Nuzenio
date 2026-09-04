"""Supervised password subprocesses: release capacity after confirmed exit.

Strict cap: one POSIX LOCAL-filesystem lock domain (container by default; host
when shared by all host processes). Redis supplies fleet rates, NOT a distributed
work cap. Redis errors deny admission and kill work; OS locks survive Redis loss.
"""

import json
import os
import subprocess
import sys
import time

import redis

from nuzenio_api.config import get_settings
from nuzenio_api.login_admission import AdmissionDenied, PasswordAdmission


def _worker_command(deadline):
    return [sys.executable, "-m", "nuzenio_api.password_worker", str(deadline)]


def verify_password(candidate: str, password: str, admission: PasswordAdmission) -> bool:
    deadline = get_settings().login_verifier_timeout_seconds
    end = time.monotonic() + deadline
    payload = json.dumps({"hash": candidate, "password": password}).encode()
    if len(payload) > 16384:
        return False
    child = None
    try:
        admission.redis.ping()
        child = subprocess.Popen(
            _worker_command(deadline),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            pass_fds=(admission.slot_fd,),
            env={
                key: value
                for key, value in os.environ.items()
                if key in {"PATH", "LANG", "PYTHONPATH"}
            },
        )
        while True:
            remaining = end - time.monotonic()
            if remaining <= 0:
                raise AdmissionDenied(unavailable=True)
            admission.redis.ping()
            try:
                output, _ = child.communicate(input=payload, timeout=min(0.1, remaining))
                admission.redis.ping()
                if child.returncode != 0 or output not in (b"0", b"1"):
                    raise AdmissionDenied(unavailable=True)
                return output == b"1"
            except subprocess.TimeoutExpired:
                payload = None
    except (redis.RedisError, OSError) as error:
        raise AdmissionDenied(unavailable=True) from error
    finally:
        if child is not None:
            if child.poll() is None:
                child.kill()
            # Cancellation is NOT termination. Retain the descriptor even if a
            # stuck kernel process cannot yet be reaped; fail closed on capacity.
            child.wait()
            for stream in (child.stdin, child.stdout):
                if stream:
                    stream.close()
