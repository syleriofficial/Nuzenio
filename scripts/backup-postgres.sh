#!/bin/sh
set -eu

umask 077

: "${NUZENIO_BACKUP_DATABASE_URL:?Set NUZENIO_BACKUP_DATABASE_URL}"
: "${NUZENIO_BACKUP_OUTPUT:?Set NUZENIO_BACKUP_OUTPUT to a new backup file}"

if [ -e "$NUZENIO_BACKUP_OUTPUT" ]; then
  echo "Refusing to overwrite an existing backup file." >&2
  exit 2
fi

output_directory=$(dirname "$NUZENIO_BACKUP_OUTPUT")
if [ ! -d "$output_directory" ] || [ -L "$output_directory" ]; then
  echo "The backup output directory does not exist." >&2
  exit 2
fi
if [ -L "$NUZENIO_BACKUP_OUTPUT" ]; then
  echo "Refusing a symlink backup destination." >&2
  exit 2
fi

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
credential_directory=$(mktemp -d "${TMPDIR:-/tmp}/nuzenio-pgpass.XXXXXX")
pgpass_file="$credential_directory/pgpass"
temporary_output=$(mktemp "$output_directory/.nuzenio-backup.partial.XXXXXX")
cleanup() {
  rm -f -- "$temporary_output"
  rm -f -- "$pgpass_file"
  rmdir "$credential_directory" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM

safe_database_url=$(python3 "$script_directory/postgres-connection.py" \
  --uri-env NUZENIO_BACKUP_DATABASE_URL --pgpass "$pgpass_file")

env -u NUZENIO_BACKUP_DATABASE_URL -u NUZENIO_RESTORE_DATABASE_URL \
  -u PGPASSWORD -u PGSERVICE -u PGSERVICEFILE PGPASSFILE="$pgpass_file" pg_dump \
  --dbname="$safe_database_url" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-acl \
  --file="$temporary_output"

if ! ln -- "$temporary_output" "$NUZENIO_BACKUP_OUTPUT"; then
  echo "Refusing to overwrite a backup destination created during the dump." >&2
  exit 2
fi
rm -f -- "$temporary_output"
rm -f -- "$pgpass_file"
rmdir "$credential_directory"
trap - EXIT HUP INT TERM

echo "PostgreSQL backup completed: $NUZENIO_BACKUP_OUTPUT"
