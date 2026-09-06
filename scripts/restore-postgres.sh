#!/bin/sh
set -eu

umask 077

: "${NUZENIO_RESTORE_DATABASE_URL:?Set NUZENIO_RESTORE_DATABASE_URL}"
: "${NUZENIO_RESTORE_INPUT:?Set NUZENIO_RESTORE_INPUT to a custom-format backup}"
: "${NUZENIO_RESTORE_CONFIRM_DATABASE:?Confirm the exact disposable target database name}"

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
env -u NUZENIO_BACKUP_DATABASE_URL \
  python3 "$script_directory/postgres-connection.py" \
    --uri-env NUZENIO_RESTORE_DATABASE_URL --validate-only >/dev/null
credential_directory=$(mktemp -d "${TMPDIR:-/tmp}/nuzenio-pgpass.XXXXXX")
pgpass_file="$credential_directory/pgpass"
cleanup() {
  rm -f -- "$pgpass_file"
  rmdir "$credential_directory" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM

safe_database_url=$(python3 "$script_directory/postgres-connection.py" \
  --uri-env NUZENIO_RESTORE_DATABASE_URL --pgpass "$pgpass_file")

if [ ! -r "$NUZENIO_RESTORE_INPUT" ]; then
  echo "The restore input is not readable." >&2
  exit 2
fi

target_database=$(
  env -u NUZENIO_BACKUP_DATABASE_URL -u NUZENIO_RESTORE_DATABASE_URL \
    -u PGPASSWORD -u PGSERVICE -u PGSERVICEFILE PGPASSFILE="$pgpass_file" psql \
    --dbname="$safe_database_url" --no-psqlrc --tuples-only --no-align \
    --command='SELECT current_database()'
)

if [ "$target_database" != "$NUZENIO_RESTORE_CONFIRM_DATABASE" ]; then
  echo "Restore confirmation does not match the connected database." >&2
  exit 2
fi

case "$target_database" in
  *restore*|*recovery*) ;;
  *)
    echo "Restore targets must have an explicit restore or recovery database name." >&2
    exit 2
    ;;
esac

existing_tables=$(env -u NUZENIO_BACKUP_DATABASE_URL -u NUZENIO_RESTORE_DATABASE_URL \
  -u PGPASSWORD -u PGSERVICE -u PGSERVICEFILE PGPASSFILE="$pgpass_file" psql \
  --dbname="$safe_database_url" --no-psqlrc --tuples-only --no-align \
  --command="SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema')")
if [ "$existing_tables" != "0" ]; then
  echo "Restore target is not empty; no changes were made." >&2
  exit 2
fi

env -u NUZENIO_BACKUP_DATABASE_URL -u NUZENIO_RESTORE_DATABASE_URL \
  -u PGPASSWORD -u PGSERVICE -u PGSERVICEFILE PGPASSFILE="$pgpass_file" pg_restore \
  --dbname="$safe_database_url" \
  --exit-on-error \
  --single-transaction \
  --no-owner \
  --no-acl \
  -- "$NUZENIO_RESTORE_INPUT"

echo "PostgreSQL restore completed into confirmed empty database: $target_database"
rm -f -- "$pgpass_file"
rmdir "$credential_directory"
trap - EXIT HUP INT TERM
