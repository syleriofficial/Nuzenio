from __future__ import annotations

import os
import stat
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]


def executable(directory: Path, name: str, body: str) -> Path:
    target = directory / name
    target.write_text("#!/bin/sh\nset -eu\n" + body)
    target.chmod(0o755)
    return target


def test_connection_helper_uses_restricted_pgpass_and_passwordless_output(tmp_path) -> None:
    pgpass = tmp_path / "pgpass"
    result = subprocess.run(
        [
            ROOT / "scripts/postgres-connection.py",
            "--uri-env",
            "FIXTURE_DATABASE_URL",
            "--pgpass",
            pgpass,
        ],
        env={
            **os.environ,
            "FIXTURE_DATABASE_URL": (
                "postgresql://fixture:unique%3Amarker%5Csegment@db.example/nuzenio"
            ),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "unique" not in result.stdout + result.stderr
    assert stat.S_IMODE(pgpass.stat().st_mode) == 0o600
    assert pgpass.read_text() == ("db.example:5432:nuzenio:fixture:unique\\:marker\\\\segment\n")


@pytest.mark.parametrize(
    "query",
    [
        "application_name=%00",
        "application_name=%0A",
        "application_name=%0a",
        "application_name=%0D",
        "application_name=%0d",
        "application_name=%2500",
        "application_name=%250A",
        "application_name=%250d",
        "application_name=%25E2%2580%25AE",
        "application_name=raw\nline",
        "application_name=raw\rline",
        "application_name=raw\u0085line",
        "application_name=raw\u202eline",
        "application_name%0A=fixture",
        "application_name%250A=fixture",
        "sslmode=%00require",
        "application_name=first&application_name=%250A",
    ],
)
def test_connection_helper_rejects_raw_encoded_and_double_encoded_query_controls(query) -> None:
    result = subprocess.run(
        [
            ROOT / "scripts/postgres-connection.py",
            "--uri-env",
            "FIXTURE_DATABASE_URL",
            "--validate-only",
        ],
        env={
            **os.environ,
            "FIXTURE_DATABASE_URL": (f"postgresql://fixture:fixture@db.example/nuzenio?{query}"),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 2
    assert "Invalid PostgreSQL connection URI" in result.stderr


def test_connection_helper_preserves_valid_repeated_allowlisted_parameters() -> None:
    result = subprocess.run(
        [
            ROOT / "scripts/postgres-connection.py",
            "--uri-env",
            "FIXTURE_DATABASE_URL",
            "--validate-only",
        ],
        env={
            **os.environ,
            "FIXTURE_DATABASE_URL": (
                "postgresql://fixture:fixture@db.example/nuzenio"
                "?sslmode=require&application_name=Nuzenio%20Backup"
                "&application_name=Nuzenio%20Restore"
            ),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "sslmode=require" in result.stdout
    assert result.stdout.count("application_name=") == 2


@pytest.mark.parametrize(
    "query",
    [
        "application_name=%",
        "application_name=%Z",
        "application_name=%ZZ",
        "application_name=%0G",
        "application_name=%G0",
        "application_name=trailing%",
        "application_name=%%",
        "application_name=valid%20value%ZZ",
        "application_name=%25ZZ",
        "application_name=%2525ZZ",
        "application_name%ZZ=value",
        "application_name=first&application_name=%ZZ",
        "application_name=%C3%28",
    ],
)
def test_connection_helper_rejects_malformed_percent_escapes(query) -> None:
    result = subprocess.run(
        [
            ROOT / "scripts/postgres-connection.py",
            "--uri-env",
            "FIXTURE_DATABASE_URL",
            "--validate-only",
        ],
        env={
            **os.environ,
            "FIXTURE_DATABASE_URL": f"postgresql://fixture:fixture@db.example/nuzenio?{query}",
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 2
    assert "Invalid PostgreSQL connection URI" in result.stderr


def test_compose_ci_is_isolated_health_checked_and_always_torn_down() -> None:
    workflow = (ROOT / ".github/workflows/ci.yml").read_text()
    assert (
        "COMPOSE_PROJECT_NAME: nuzenio-ci-${{ github.run_id }}-${{ github.run_attempt }}"
        in workflow
    )
    assert "docker compose up --detach --wait --wait-timeout 180 api worker" in workflow
    assert "http://127.0.0.1:18000/health/ready" in workflow
    assert "http://localhost:8001/health/ready" in workflow
    assert "docker compose --profile ci run --rm restore-verify" in workflow
    assert "if: always()" in workflow
    assert "down --volumes --remove-orphans" in workflow
    assert "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" in workflow


def test_backup_is_atomic_and_refuses_overwrite(tmp_path) -> None:
    bin_directory = tmp_path / "bin"
    bin_directory.mkdir()
    executable(
        bin_directory,
        "pg_dump",
        """
for argument in "$@"; do
  case "$argument" in --file=*) output=${argument#--file=} ;; esac
done
test -n "${output:-}"
printf 'fixture-backup' > "$output"
""",
    )
    output = tmp_path / "backup.dump"
    environment = {
        **os.environ,
        "PATH": f"{bin_directory}:{os.environ['PATH']}",
        "NUZENIO_BACKUP_DATABASE_URL": "postgresql://fixture:fixture@db.example/nuzenio",
        "NUZENIO_BACKUP_OUTPUT": str(output),
    }

    first = subprocess.run(
        [ROOT / "scripts/backup-postgres.sh"],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert first.returncode == 0
    assert output.read_text() == "fixture-backup"
    assert not list(tmp_path.glob("*.partial.*"))

    second = subprocess.run(
        [ROOT / "scripts/backup-postgres.sh"],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert second.returncode == 2
    assert "Refusing to overwrite" in second.stderr


def test_restore_requires_confirmed_empty_disposable_database(tmp_path) -> None:
    bin_directory = tmp_path / "bin"
    bin_directory.mkdir()
    calls = tmp_path / "restore-calls"
    executable(
        bin_directory,
        "psql",
        """
case "$*" in
  *current_database*) printf 'nuzenio_restore_verify\\n' ;;
  *) printf '%s\\n' "${FIXTURE_TABLE_COUNT:-0}" ;;
esac
""",
    )
    executable(
        bin_directory,
        "pg_restore",
        f"printf '%s\\n' \"$*\" > '{calls}'\n",
    )
    backup = tmp_path / "backup.dump"
    backup.write_text("fixture")
    environment = {
        **os.environ,
        "PATH": f"{bin_directory}:{os.environ['PATH']}",
        "NUZENIO_RESTORE_DATABASE_URL": (
            "postgresql://fixture:fixture@db.example/nuzenio_restore_verify"
        ),
        "NUZENIO_RESTORE_INPUT": str(backup),
        "NUZENIO_RESTORE_CONFIRM_DATABASE": "nuzenio_restore_verify",
    }

    restored = subprocess.run(
        [ROOT / "scripts/restore-postgres.sh"],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert restored.returncode == 0
    arguments = calls.read_text()
    assert "--single-transaction" in arguments
    assert "--exit-on-error" in arguments
    assert "--clean" not in arguments

    calls.unlink()
    blocked = subprocess.run(
        [ROOT / "scripts/restore-postgres.sh"],
        env={**environment, "FIXTURE_TABLE_COUNT": "1"},
        capture_output=True,
        text=True,
        check=False,
    )
    assert blocked.returncode == 2
    assert "not empty" in blocked.stderr
    assert not calls.exists()


def test_restore_rejects_wrong_confirmation_and_non_disposable_name(tmp_path) -> None:
    bin_directory = tmp_path / "bin"
    bin_directory.mkdir()
    executable(bin_directory, "psql", "printf 'nuzenio\\n'\n")
    executable(bin_directory, "pg_restore", "exit 99\n")
    backup = tmp_path / "backup.dump"
    backup.write_text("fixture")
    base = {
        **os.environ,
        "PATH": f"{bin_directory}:{os.environ['PATH']}",
        "NUZENIO_RESTORE_DATABASE_URL": "postgresql://fixture:fixture@db.example/nuzenio",
        "NUZENIO_RESTORE_INPUT": str(backup),
    }

    mismatch = subprocess.run(
        [ROOT / "scripts/restore-postgres.sh"],
        env={**base, "NUZENIO_RESTORE_CONFIRM_DATABASE": "different_restore"},
        capture_output=True,
        text=True,
        check=False,
    )
    assert mismatch.returncode == 2
    assert "does not match" in mismatch.stderr

    unsafe = subprocess.run(
        [ROOT / "scripts/restore-postgres.sh"],
        env={**base, "NUZENIO_RESTORE_CONFIRM_DATABASE": "nuzenio"},
        capture_output=True,
        text=True,
        check=False,
    )
    assert unsafe.returncode == 2
    assert "restore or recovery" in unsafe.stderr


def test_restore_verifier_validates_both_connections_before_backup(tmp_path) -> None:
    bin_directory = tmp_path / "bin"
    bin_directory.mkdir()
    called = tmp_path / "pg-dump-called"
    executable(bin_directory, "pg_dump", f"touch '{called}'\nexit 99\n")
    result = subprocess.run(
        [ROOT / "scripts/verify-postgres-restore.sh"],
        env={
            **os.environ,
            "PATH": f"{bin_directory}:{os.environ['PATH']}",
            "NUZENIO_BACKUP_DATABASE_URL": ("postgresql://fixture:fixture@db.example/nuzenio"),
            "NUZENIO_RESTORE_DATABASE_URL": "--command=SELECT 1",
            "NUZENIO_RESTORE_CONFIRM_DATABASE": "nuzenio_restore_verify",
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 2
    assert "Invalid PostgreSQL connection URI" in result.stderr
    assert not called.exists()


@pytest.mark.parametrize("operation", ["backup", "restore"])
def test_operation_rejects_invalid_connection_before_temporary_files(tmp_path, operation) -> None:
    bin_directory = tmp_path / "bin"
    bin_directory.mkdir()
    called = tmp_path / "mktemp-called"
    executable(bin_directory, "mktemp", f"touch '{called}'\nexit 99\n")
    environment = {
        **os.environ,
        "PATH": f"{bin_directory}:{os.environ['PATH']}",
    }
    if operation == "backup":
        command = ROOT / "scripts/backup-postgres.sh"
        environment.update(
            {
                "NUZENIO_BACKUP_DATABASE_URL": "--command=SELECT 1",
                "NUZENIO_BACKUP_OUTPUT": str(tmp_path / "backup.dump"),
            }
        )
    else:
        command = ROOT / "scripts/restore-postgres.sh"
        backup = tmp_path / "input.dump"
        backup.write_bytes(b"fixture")
        environment.update(
            {
                "NUZENIO_RESTORE_DATABASE_URL": "--command=SELECT 1",
                "NUZENIO_RESTORE_INPUT": str(backup),
                "NUZENIO_RESTORE_CONFIRM_DATABASE": "nuzenio_restore_verify",
            }
        )
    result = subprocess.run([command], env=environment, capture_output=True, text=True, check=False)
    assert result.returncode == 2
    assert "Invalid PostgreSQL connection URI" in result.stderr
    assert not called.exists()


@pytest.mark.parametrize("operation", ["backup", "restore", "verify"])
def test_operations_reject_encoded_query_controls_before_tools_or_filesystem_mutation(
    tmp_path, operation
) -> None:
    bin_directory = tmp_path / "bin"
    bin_directory.mkdir()
    called = tmp_path / "tool-called"
    for name in ("mktemp", "psql", "pg_dump", "pg_restore"):
        executable(bin_directory, name, f"touch '{called}'\nexit 99\n")

    invalid_url = (
        "postgresql://fixture:fixture@db.example/nuzenio_restore_verify"
        "?application_name=%250Aunique-marker"
    )
    output = tmp_path / "backup.dump"
    backup = tmp_path / "input.dump"
    backup.write_bytes(b"fixture")
    environment = {
        **os.environ,
        "PATH": f"{bin_directory}:{os.environ['PATH']}",
    }
    if operation == "backup":
        command = ROOT / "scripts/backup-postgres.sh"
        environment.update(
            {
                "NUZENIO_BACKUP_DATABASE_URL": invalid_url,
                "NUZENIO_BACKUP_OUTPUT": str(output),
            }
        )
    elif operation == "restore":
        command = ROOT / "scripts/restore-postgres.sh"
        environment.update(
            {
                "NUZENIO_RESTORE_DATABASE_URL": invalid_url,
                "NUZENIO_RESTORE_INPUT": str(backup),
                "NUZENIO_RESTORE_CONFIRM_DATABASE": "nuzenio_restore_verify",
            }
        )
    else:
        command = ROOT / "scripts/verify-postgres-restore.sh"
        environment.update(
            {
                "NUZENIO_BACKUP_DATABASE_URL": invalid_url,
                "NUZENIO_RESTORE_DATABASE_URL": (
                    "postgresql://fixture:fixture@db.example/nuzenio_restore_verify"
                ),
                "NUZENIO_RESTORE_CONFIRM_DATABASE": "nuzenio_restore_verify",
            }
        )

    result = subprocess.run([command], env=environment, capture_output=True, text=True, check=False)
    assert result.returncode == 2
    assert "Invalid PostgreSQL connection URI" in result.stderr
    assert not called.exists()
    assert not output.exists()


@pytest.mark.parametrize("operation", ["backup", "restore", "verify"])
@pytest.mark.parametrize(
    "query",
    [
        "application_name=%",
        "application_name=%ZZ",
        "application_name=%0G",
        "application_name=%25ZZ",
        "application_name=%2525ZZ",
        "application_name%ZZ=value",
        "application_name=first&application_name=%ZZ",
    ],
)
def test_operations_reject_malformed_percent_before_tools_or_filesystem_mutation(
    tmp_path, operation, query
) -> None:
    bin_directory = tmp_path / "bin"
    bin_directory.mkdir()
    called = tmp_path / "tool-called"
    for name in ("mktemp", "psql", "pg_dump", "pg_restore"):
        executable(bin_directory, name, f"touch '{called}'\nexit 99\n")

    invalid_url = f"postgresql://fixture:fixture@db.example/nuzenio_restore_verify?{query}"
    output = tmp_path / "backup.dump"
    backup = tmp_path / "input.dump"
    backup.write_bytes(b"fixture")
    environment = {**os.environ, "PATH": f"{bin_directory}:{os.environ['PATH']}"}
    if operation == "backup":
        command = ROOT / "scripts/backup-postgres.sh"
        environment.update(
            {"NUZENIO_BACKUP_DATABASE_URL": invalid_url, "NUZENIO_BACKUP_OUTPUT": str(output)}
        )
    elif operation == "restore":
        command = ROOT / "scripts/restore-postgres.sh"
        environment.update(
            {
                "NUZENIO_RESTORE_DATABASE_URL": invalid_url,
                "NUZENIO_RESTORE_INPUT": str(backup),
                "NUZENIO_RESTORE_CONFIRM_DATABASE": "nuzenio_restore_verify",
            }
        )
    else:
        command = ROOT / "scripts/verify-postgres-restore.sh"
        environment.update(
            {
                "NUZENIO_BACKUP_DATABASE_URL": invalid_url,
                "NUZENIO_RESTORE_DATABASE_URL": (
                    "postgresql://fixture:fixture@db.example/nuzenio_restore_verify"
                ),
                "NUZENIO_RESTORE_CONFIRM_DATABASE": "nuzenio_restore_verify",
            }
        )

    result = subprocess.run([command], env=environment, capture_output=True, text=True, check=False)
    assert result.returncode == 2
    assert "Invalid PostgreSQL connection URI" in result.stderr
    assert not called.exists()
    assert not output.exists()


@pytest.mark.parametrize(
    "value",
    [
        "--command=SELECT 1",
        "-cSELECT 1",
        " postgresql://user:pass@db.example/restore",
        "postgresql://user:pass@db.example/restore\n",
        "not-a-uri",
        "mysql://user:pass@db.example/restore",
        "postgresql://db.example/restore",
        "postgresql://user:pass@db.example/restore?password=second-secret",
        "postgresql://user:pass@xn--a.example/restore",
    ],
)
def test_restore_rejects_malformed_or_option_shaped_connection_before_psql(tmp_path, value):
    bin_directory = tmp_path / "bin"
    bin_directory.mkdir()
    called = tmp_path / "psql-called"
    executable(bin_directory, "psql", f"touch '{called}'\nexit 99\n")
    executable(bin_directory, "pg_restore", "exit 99\n")
    backup = tmp_path / "backup.dump"
    backup.write_text("fixture")
    result = subprocess.run(
        [ROOT / "scripts/restore-postgres.sh"],
        env={
            **os.environ,
            "PATH": f"{bin_directory}:{os.environ['PATH']}",
            "NUZENIO_RESTORE_DATABASE_URL": value,
            "NUZENIO_RESTORE_INPUT": str(backup),
            "NUZENIO_RESTORE_CONFIRM_DATABASE": "nuzenio_restore_verify",
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 2
    assert "Invalid PostgreSQL connection URI" in result.stderr
    assert not called.exists()


def test_backup_uses_random_restricted_temp_and_atomic_no_clobber(tmp_path) -> None:
    bin_directory = tmp_path / "bin"
    bin_directory.mkdir()
    executable(
        bin_directory,
        "pg_dump",
        """
for argument in "$@"; do
  case "$argument" in --file=*) output=${argument#--file=} ;; esac
done
printf 'fixture-backup' > "$output"
touch "${FIXTURE_DESTINATION_RACE:?}"
""",
    )
    output = tmp_path / "backup.dump"
    result = subprocess.run(
        [ROOT / "scripts/backup-postgres.sh"],
        env={
            **os.environ,
            "PATH": f"{bin_directory}:{os.environ['PATH']}",
            "NUZENIO_BACKUP_DATABASE_URL": (
                "postgresql://fixture:unique-marker@db.example/nuzenio"
            ),
            "NUZENIO_BACKUP_OUTPUT": str(output),
            "FIXTURE_DESTINATION_RACE": str(output),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 2
    assert output.read_bytes() == b""
    assert not list(tmp_path.glob(".nuzenio-backup.partial.*"))
    assert "unique-marker" not in result.stdout + result.stderr


def test_backup_rejects_destination_symlink_without_touching_target(tmp_path) -> None:
    target = tmp_path / "target"
    target.write_text("preserve")
    output = tmp_path / "backup.dump"
    output.symlink_to(target)
    result = subprocess.run(
        [ROOT / "scripts/backup-postgres.sh"],
        env={
            **os.environ,
            "NUZENIO_BACKUP_DATABASE_URL": ("postgresql://fixture:fixture@db.example/nuzenio"),
            "NUZENIO_BACKUP_OUTPUT": str(output),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 2
    assert target.read_text() == "preserve"


def test_backup_rejects_symlink_in_destination_directory_chain(tmp_path) -> None:
    bin_directory = tmp_path / "bin"
    bin_directory.mkdir()
    executable(bin_directory, "pg_dump", "exit 99\n")
    real_directory = tmp_path / "real" / "backups"
    real_directory.mkdir(parents=True)
    linked_parent = tmp_path / "linked"
    linked_parent.symlink_to(tmp_path / "real", target_is_directory=True)
    output = linked_parent / "backups" / "backup.dump"
    result = subprocess.run(
        [ROOT / "scripts/backup-postgres.sh"],
        env={
            **os.environ,
            "PATH": f"{bin_directory}:{os.environ['PATH']}",
            "NUZENIO_BACKUP_DATABASE_URL": ("postgresql://fixture:fixture@db.example/nuzenio"),
            "NUZENIO_BACKUP_OUTPUT": str(output),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 2
    assert "must not traverse symbolic links" in result.stderr
    assert not (real_directory / "backup.dump").exists()
