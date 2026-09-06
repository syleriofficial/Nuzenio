from __future__ import annotations

import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def executable(directory: Path, name: str, body: str) -> Path:
    target = directory / name
    target.write_text("#!/bin/sh\nset -eu\n" + body)
    target.chmod(0o755)
    return target


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
        "NUZENIO_BACKUP_DATABASE_URL": "postgresql://fixture/nuzenio",
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
        "NUZENIO_RESTORE_DATABASE_URL": "postgresql://fixture/nuzenio_restore_verify",
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
        "NUZENIO_RESTORE_DATABASE_URL": "postgresql://fixture/nuzenio",
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
