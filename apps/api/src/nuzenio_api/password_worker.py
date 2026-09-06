"""One bounded password check; credentials travel over stdin, never argv/logs.

The inherited capacity FD stays open until exit. Do not import application
configuration, database clients or authentication code into this child.
"""

import json
import os
import resource
import signal
import sys


def main():
    # If only the supervisor is stopped, this timer still kills work. If the child
    # is stopped too, its descriptor keeps capacity occupied until actual exit.
    signal.signal(signal.SIGALRM, signal.SIG_DFL)
    signal.setitimer(signal.ITIMER_REAL, float(sys.argv[1]))
    resource.setrlimit(resource.RLIMIT_CPU, (2, 3))
    if sys.platform.startswith("linux"):
        resource.setrlimit(resource.RLIMIT_AS, (384 * 1024 * 1024, 384 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    from argon2 import PasswordHasher, extract_parameters
    from argon2.exceptions import InvalidHashError, VerificationError
    from argon2.low_level import Type

    valid = False
    try:
        payload = json.loads(sys.stdin.buffer.read(16385))
        candidate, password = payload["hash"], payload["password"]
        params = extract_parameters(candidate)
        if (
            params.type == Type.ID
            and params.memory_cost <= 65536
            and params.time_cost <= 3
            and params.parallelism <= 2
            and params.hash_len <= 32
            and params.salt_len <= 16
            and len(password) <= 1024
        ):
            valid = PasswordHasher().verify(candidate, password)
    except (VerificationError, InvalidHashError, ValueError, KeyError, TypeError):
        pass
    os.write(1, b"1" if valid else b"0")


if __name__ == "__main__":
    main()
