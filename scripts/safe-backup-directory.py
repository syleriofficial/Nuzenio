#!/usr/bin/env python3
"""Resolve a backup parent only when every existing path component is non-symlinked."""

from __future__ import annotations

import os
from pathlib import Path


def main() -> None:
    raw = os.environ.get("NUZENIO_BACKUP_OUTPUT", "")
    if not raw or any(ord(character) < 32 for character in raw):
        raise SystemExit(2)
    destination = Path(raw)
    if destination.name in {"", ".", ".."}:
        raise SystemExit(2)
    parent = destination.parent
    absolute_parent = Path(os.path.abspath(parent))
    try:
        resolved_parent = parent.resolve(strict=True)
    except (OSError, RuntimeError):
        raise SystemExit(2) from None
    if resolved_parent != absolute_parent or not resolved_parent.is_dir():
        raise SystemExit(2)
    print(resolved_parent)


if __name__ == "__main__":
    main()
