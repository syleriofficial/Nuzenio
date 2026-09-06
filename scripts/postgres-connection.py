#!/usr/bin/env python3
"""Validate a PostgreSQL URI and split its password into a restricted pgpass file."""

from __future__ import annotations

import argparse
import ipaddress
import os
import re
import stat
import sys
from pathlib import Path
from urllib.parse import parse_qsl, quote, unquote, urlencode, urlsplit

_COMPONENT = re.compile(r"[A-Za-z0-9_.-]+")
_HOST_LABEL = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?")
_QUERY_KEYS = {
    "application_name",
    "channel_binding",
    "connect_timeout",
    "sslcert",
    "sslkey",
    "sslmode",
    "sslrootcert",
    "target_session_attrs",
}


def _decoded(value: str, label: str) -> str:
    result = unquote(value)
    if not result or any(character.isspace() or ord(character) < 32 for character in result):
        raise ValueError(f"Invalid {label}")
    return result


def _pgpass_field(value: str) -> str:
    return value.replace("\\", "\\\\").replace(":", "\\:")


def _validate_hostname(hostname: str) -> None:
    if any(character.isspace() or ord(character) < 32 for character in hostname):
        raise ValueError("Invalid PostgreSQL hostname")
    try:
        ipaddress.ip_address(hostname)
        return
    except ValueError:
        pass
    try:
        ascii_hostname = hostname.encode("idna").decode("ascii")
    except UnicodeError as error:
        raise ValueError("Invalid PostgreSQL hostname") from error
    if ascii_hostname != hostname or len(hostname) > 253 or hostname.endswith("."):
        raise ValueError("Invalid PostgreSQL hostname")
    if any(not _HOST_LABEL.fullmatch(label) for label in hostname.split(".")):
        raise ValueError("Invalid PostgreSQL hostname")


def split_connection_uri(uri: str) -> tuple[str, str]:
    if not uri or uri != uri.strip() or any(ord(character) < 32 for character in uri):
        raise ValueError("Invalid PostgreSQL connection URI")
    parsed = urlsplit(uri)
    if parsed.scheme not in {"postgres", "postgresql"} or parsed.fragment:
        raise ValueError("Invalid PostgreSQL connection URI")
    if parsed.username is None or parsed.hostname is None or parsed.path in {"", "/"}:
        raise ValueError("PostgreSQL URI requires user, host and database")
    username = _decoded(parsed.username, "username")
    database = _decoded(parsed.path[1:], "database")
    hostname = parsed.hostname
    if not _COMPONENT.fullmatch(username) or not _COMPONENT.fullmatch(database):
        raise ValueError("PostgreSQL username and database must use safe canonical characters")
    _validate_hostname(hostname)
    try:
        port = parsed.port or 5432
    except ValueError as error:
        raise ValueError("Invalid PostgreSQL port") from error
    if not 1 <= port <= 65535:
        raise ValueError("Invalid PostgreSQL port")
    password = unquote(parsed.password or "")
    if any(ord(character) < 32 for character in password):
        raise ValueError("Invalid PostgreSQL password")
    query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
    if any(key not in _QUERY_KEYS for key, _ in query):
        raise ValueError("Unsupported PostgreSQL URI parameter")
    safe_host = f"[{hostname}]" if ":" in hostname else hostname
    authority = f"{quote(username, safe='')}@{safe_host}:{port}"
    safe_uri = f"postgresql://{authority}/{quote(database, safe='')}"
    if query:
        safe_uri += "?" + urlencode(query)
    pgpass = ":".join(
        _pgpass_field(value)
        for value in (hostname, str(port), database, username, password)
    )
    return safe_uri, pgpass + "\n"


def write_pgpass(path: Path, line: str, *, append: bool) -> None:
    flags = os.O_WRONLY | os.O_NOFOLLOW
    if append:
        flags |= os.O_APPEND
    else:
        flags |= os.O_CREAT | os.O_EXCL
    descriptor = os.open(path, flags, 0o600)
    try:
        os.fchmod(descriptor, stat.S_IRUSR | stat.S_IWUSR)
        os.write(descriptor, line.encode())
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def main() -> None:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--uri-env", required=True)
    parser.add_argument("--pgpass", required=True, type=Path)
    parser.add_argument("--append", action="store_true")
    args = parser.parse_args()
    try:
        uri = os.environ.get(args.uri_env, "")
        safe_uri, pgpass = split_connection_uri(uri)
        write_pgpass(args.pgpass, pgpass, append=args.append)
    except Exception:
        print("Invalid PostgreSQL connection URI.", file=sys.stderr)
        raise SystemExit(2) from None
    print(safe_uri)


if __name__ == "__main__":
    main()
