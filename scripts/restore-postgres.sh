#!/bin/sh
set -eu

: "${NUZENIO_RESTORE_DATABASE_URL:?Set NUZENIO_RESTORE_DATABASE_URL}"
: "${NUZENIO_RESTORE_INPUT:?Set NUZENIO_RESTORE_INPUT to a custom-format backup}"
: "${NUZENIO_RESTORE_CONFIRM_DATABASE:?Confirm the exact disposable target database name}"

if [ ! -r "$NUZENIO_RESTORE_INPUT" ]; then
  echo "The restore input is not readable." >&2
  exit 2
fi

target_database=$(
  psql "$NUZENIO_RESTORE_DATABASE_URL" --no-psqlrc --tuples-only --no-align \
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

existing_tables=$(psql "$NUZENIO_RESTORE_DATABASE_URL" --no-psqlrc --tuples-only --no-align \
  --command="SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema')")
if [ "$existing_tables" != "0" ]; then
  echo "Restore target is not empty; no changes were made." >&2
  exit 2
fi

pg_restore \
  --dbname="$NUZENIO_RESTORE_DATABASE_URL" \
  --exit-on-error \
  --single-transaction \
  --no-owner \
  --no-acl \
  "$NUZENIO_RESTORE_INPUT"

echo "PostgreSQL restore completed into confirmed empty database: $target_database"
