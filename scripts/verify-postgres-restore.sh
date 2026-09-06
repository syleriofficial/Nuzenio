#!/bin/sh
set -eu

: "${NUZENIO_BACKUP_DATABASE_URL:?Set NUZENIO_BACKUP_DATABASE_URL}"
: "${NUZENIO_RESTORE_DATABASE_URL:?Set NUZENIO_RESTORE_DATABASE_URL}"
: "${NUZENIO_RESTORE_CONFIRM_DATABASE:?Set NUZENIO_RESTORE_CONFIRM_DATABASE}"

verification_directory=$(mktemp -d)
backup_file="$verification_directory/nuzenio-restore-verification.dump"
script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cleanup() {
  rm -rf -- "$verification_directory"
}
trap cleanup EXIT HUP INT TERM

NUZENIO_BACKUP_OUTPUT="$backup_file" "$script_directory/backup-postgres.sh"
NUZENIO_RESTORE_INPUT="$backup_file" "$script_directory/restore-postgres.sh"

query() {
  psql "$1" --no-psqlrc --tuples-only --no-align --command="$2"
}

source_revision=$(query "$NUZENIO_BACKUP_DATABASE_URL" "SELECT version_num FROM alembic_version")
restore_revision=$(query "$NUZENIO_RESTORE_DATABASE_URL" "SELECT version_num FROM alembic_version")
source_clusters=$(query "$NUZENIO_BACKUP_DATABASE_URL" "SELECT count(*) FROM event_clusters")
restore_clusters=$(query "$NUZENIO_RESTORE_DATABASE_URL" "SELECT count(*) FROM event_clusters")
source_audits=$(query "$NUZENIO_BACKUP_DATABASE_URL" "SELECT count(*) FROM audit_logs")
restore_audits=$(query "$NUZENIO_RESTORE_DATABASE_URL" "SELECT count(*) FROM audit_logs")

if [ "$source_revision" != "$restore_revision" ] || \
   [ "$source_clusters" != "$restore_clusters" ] || \
   [ "$source_audits" != "$restore_audits" ] || \
   [ "$restore_clusters" = "0" ]; then
  echo "Restore verification failed: source and restored invariants differ." >&2
  exit 1
fi

echo "Restore verification passed: revision=$restore_revision clusters=$restore_clusters audits=$restore_audits"
