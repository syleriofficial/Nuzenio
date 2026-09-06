from __future__ import annotations

import argparse
import getpass
import secrets

from nuzenio_api.audit import append_audit
from nuzenio_api.auth import create_staff_user
from nuzenio_api.config import get_settings
from nuzenio_api.db import SessionLocal
from nuzenio_api.environment import is_production
from nuzenio_api.models import StaffRole


def main() -> None:
    parser = argparse.ArgumentParser(description="Protected Nuzenio staff account bootstrap")
    subcommands = parser.add_subparsers(dest="command", required=True)
    create = subcommands.add_parser("create", help="Create one staff account")
    create.add_argument("--username", required=True)
    create.add_argument("--display-name", required=True)
    create.add_argument("--role", required=True, choices=[role.value for role in StaffRole])
    args = parser.parse_args()
    settings = get_settings()
    if is_production(settings.environment):
        supplied_token = getpass.getpass("Bootstrap token: ")
        if not settings.bootstrap_token or not secrets.compare_digest(
            supplied_token, settings.bootstrap_token
        ):
            raise SystemExit("A valid NUZENIO_BOOTSTRAP_TOKEN is required in production.")
    password = getpass.getpass("Password: ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")
    with SessionLocal.begin() as session:
        user = create_staff_user(
            session,
            username=args.username,
            display_name=args.display_name,
            password=password,
            role=StaffRole(args.role),
        )
        append_audit(
            session,
            actor=user,
            action="STAFF_BOOTSTRAPPED",
            entity_type="StaffUser",
            entity_id=user.id,
            request_id="staff-cli",
            after={"username": user.username, "role": user.role.value},
        )
    print(f"Created {args.role} account {args.username!r}.")


if __name__ == "__main__":
    main()
