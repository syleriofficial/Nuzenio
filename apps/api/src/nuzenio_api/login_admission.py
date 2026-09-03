"""Atomic fixed-window admission and cross-process Argon2 concurrency leases.

Denied attempts never extend cooldowns. Redis unavailable => fail closed, no hash.
Redis TIME avoids client clock differences. Leases expire after process death.
"""

import uuid
from contextlib import contextmanager, suppress

import redis

from nuzenio_api.config import get_settings

ADMIT = """
local now = redis.call('TIME'); local t = tonumber(now[1])
redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', t)
for i=1,3 do
 if tonumber(redis.call('GET', KEYS[i]) or '0') >= tonumber(ARGV[i]) then return 0 end
end
if redis.call('ZCARD', KEYS[4]) >= tonumber(ARGV[5]) then return 0 end
for i=1,3 do
 local n=redis.call('INCR', KEYS[i]); if n==1 then redis.call('EXPIRE', KEYS[i], ARGV[4]) end
end
redis.call('ZADD', KEYS[4], t+tonumber(ARGV[6]), ARGV[7])
redis.call('EXPIRE', KEYS[4], ARGV[6])
return tonumber(redis.call('GET', KEYS[3]))
"""


class AdmissionDenied(Exception):
    def __init__(self, unavailable=False):
        self.unavailable = unavailable


@contextmanager
def password_admission(account_hash: str, ip_hash: str):
    settings = get_settings()
    client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1, socket_timeout=1)
    prefix = settings.login_key_prefix
    keys = [
        f"{prefix}:global",
        f"{prefix}:ip:{ip_hash}",
        f"{prefix}:account:{account_hash}",
        f"{prefix}:verifiers",
    ]
    token = str(uuid.uuid4())
    try:
        count = client.eval(
            ADMIT,
            4,
            *keys,
            settings.login_global_limit,
            settings.login_ip_limit,
            settings.login_attempt_limit,
            settings.login_window_seconds,
            settings.login_concurrency,
            60,
            token,
        )
    except redis.RedisError as error:
        raise AdmissionDenied(unavailable=True) from error
    if not count:
        raise AdmissionDenied()
    try:
        yield int(count)
    finally:
        with suppress(redis.RedisError):
            client.zrem(keys[3], token)
