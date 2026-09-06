#!/bin/sh
set -eu

: "${NUZENIO_BACKUP_DATABASE_URL:?Set NUZENIO_BACKUP_DATABASE_URL}"
: "${NUZENIO_RESTORE_DATABASE_URL:?Set NUZENIO_RESTORE_DATABASE_URL}"
: "${NUZENIO_RESTORE_CONFIRM_DATABASE:?Set NUZENIO_RESTORE_CONFIRM_DATABASE}"

verification_directory=$(mktemp -d)
backup_file="$verification_directory/nuzenio-restore-verification.dump"
script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
pgpass_file="$verification_directory/pgpass"
cleanup() {
  rm -rf -- "$verification_directory"
}
trap cleanup EXIT HUP INT TERM

NUZENIO_BACKUP_OUTPUT="$backup_file" "$script_directory/backup-postgres.sh"
NUZENIO_RESTORE_INPUT="$backup_file" "$script_directory/restore-postgres.sh"

safe_source_url=$(python3 "$script_directory/postgres-connection.py" \
  --uri-env NUZENIO_BACKUP_DATABASE_URL --pgpass "$pgpass_file")
safe_restore_url=$(python3 "$script_directory/postgres-connection.py" \
  --uri-env NUZENIO_RESTORE_DATABASE_URL --pgpass "$pgpass_file" --append)

query() {
  env -u NUZENIO_BACKUP_DATABASE_URL -u NUZENIO_RESTORE_DATABASE_URL \
    -u PGPASSWORD -u PGSERVICE -u PGSERVICEFILE PGPASSFILE="$pgpass_file" \
    psql --dbname="$1" --no-psqlrc --tuples-only \
    --no-align --command="$2"
}

source_revision=$(query "$safe_source_url" "SELECT version_num FROM alembic_version")
restore_revision=$(query "$safe_restore_url" "SELECT version_num FROM alembic_version")
source_clusters=$(query "$safe_source_url" "SELECT count(*) FROM event_clusters")
restore_clusters=$(query "$safe_restore_url" "SELECT count(*) FROM event_clusters")
source_audits=$(query "$safe_source_url" "SELECT count(*) FROM audit_logs")
restore_audits=$(query "$safe_restore_url" "SELECT count(*) FROM audit_logs")

if [ "$source_revision" != "$restore_revision" ] || \
   [ "$source_clusters" != "$restore_clusters" ] || \
   [ "$source_audits" != "$restore_audits" ] || \
   [ "$restore_clusters" = "0" ]; then
  echo "Restore verification failed: source and restored invariants differ." >&2
  exit 1
fi

echo "Restore verification passed: revision=$restore_revision clusters=$restore_clusters audits=$restore_audits"
