"""Redis pre-hash rates and non-expiring local OS capacity locks.

The hard cap is per shared LOCAL lock directory, not a distributed lease.
A child inherits the descriptor: parent death never frees live work's slot.
Never unlock explicitly or unlink/rotate these files while workers exist.
"""

import fcntl
import os
import stat
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from time import monotonic, sleep

import redis

from nuzenio_api.config import get_settings

ADMIT = """
for i=1,3 do
 if tonumber(redis.call('GET', KEYS[i]) or '0') >= tonumber(ARGV[i]) then return 0 end
end
for i=1,3 do
 local n=redis.call('INCR', KEYS[i]); if n==1 then redis.call('EXPIRE', KEYS[i], ARGV[4]) end
end
return tonumber(redis.call('GET', KEYS[3]))
"""
_CONFIG_LOCK_TIMEOUT_SECONDS = 0.25
_CONFIG_LOCK_RETRY_SECONDS = 0.005


class AdmissionDenied(Exception):
    def __init__(self, unavailable=False):
        self.unavailable = unavailable


@dataclass(frozen=True)
class PasswordAdmission:
    count: int
    slot_fd: int
    redis: redis.Redis


def _open_lock(path):
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    info = os.fstat(fd)
    if info.st_uid != os.getuid() or info.st_mode & 0o077 or not stat.S_ISREG(info.st_mode):
        os.close(fd)
        raise AdmissionDenied(unavailable=True)
    return fd


def _capacity_slot():
    settings = get_settings()
    directory = Path(settings.login_lock_directory)
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise AdmissionDenied(unavailable=True)
    config_fd = _open_lock(directory / "capacity")
    try:
        deadline = monotonic() + _CONFIG_LOCK_TIMEOUT_SECONDS
        while True:
            try:
                fcntl.flock(config_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError as error:
                if monotonic() >= deadline:
                    raise AdmissionDenied(unavailable=True) from error
                sleep(_CONFIG_LOCK_RETRY_SECONDS)
        configured = os.read(config_fd, 32)
        capacity = str(settings.login_concurrency).encode()
        if configured and configured != capacity:
            raise AdmissionDenied(unavailable=True)
        if not configured:
            os.write(config_fd, capacity)
            os.fsync(config_fd)
    finally:
        os.close(config_fd)
    for index in range(settings.login_concurrency):
        fd = _open_lock(directory / f"slot-{index}")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return fd
        except BlockingIOError:
            os.close(fd)
        except BaseException:
            os.close(fd)
            raise
    raise AdmissionDenied()


@contextmanager
def password_admission(account_hash: str, ip_hash: str):
    settings = get_settings()
    client = redis.Redis.from_url(
        settings.redis_url, socket_connect_timeout=0.2, socket_timeout=0.2
    )
    prefix = settings.login_key_prefix
    keys = [
        f"{prefix}:global",
        f"{prefix}:ip:{ip_hash}",
        f"{prefix}:account:{account_hash}",
    ]
    fd = None
    try:
        try:
            count = client.eval(
                ADMIT,
                3,
                *keys,
                settings.login_global_limit,
                settings.login_ip_limit,
                settings.login_attempt_limit,
                settings.login_window_seconds,
            )
            if not count:
                raise AdmissionDenied()
            fd = _capacity_slot()
        except (redis.RedisError, OSError) as error:
            raise AdmissionDenied(unavailable=True) from error
        yield PasswordAdmission(int(count), fd, client)
    finally:
        # Close only: LOCK_UN would also release an inherited child's ownership.
        if fd is not None:
            os.close(fd)
        client.close()
