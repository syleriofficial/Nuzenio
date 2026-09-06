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
if [ ! -d "$output_directory" ]; then
  echo "The backup output directory does not exist." >&2
  exit 2
fi

temporary_output="${NUZENIO_BACKUP_OUTPUT}.partial.$$"
cleanup() {
  rm -f -- "$temporary_output"
}
trap cleanup EXIT HUP INT TERM

pg_dump \
  --dbname="$NUZENIO_BACKUP_DATABASE_URL" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-acl \
  --file="$temporary_output"

mv -- "$temporary_output" "$NUZENIO_BACKUP_OUTPUT"
trap - EXIT HUP INT TERM

echo "PostgreSQL backup completed: $NUZENIO_BACKUP_OUTPUT"
