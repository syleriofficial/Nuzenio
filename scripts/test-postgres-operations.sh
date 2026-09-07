#!/usr/bin/env bash
set -euo pipefail

: "${NUZENIO_BACKUP_DATABASE_URL:?Set the disposable PostgreSQL source URI}"
: "${POSTGRES_PASSWORD:?Set the disposable PostgreSQL password}"

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
test_directory=$(mktemp -d)
real_pg_dump=$(command -v pg_dump)
secret_file="$test_directory/expected-secret"
printf '%s' "$POSTGRES_PASSWORD" > "$secret_file"
chmod 600 "$secret_file"
unset POSTGRES_PASSWORD

cleanup() {
  jobs -pr | xargs -r kill 2>/dev/null || true
  rm -rf -- "$test_directory"
}
trap cleanup EXIT HUP INT TERM

wrapper_directory="$test_directory/bin"
mkdir "$wrapper_directory"
cat > "$wrapper_directory/pg_dump" <<'WRAPPER'
#!/bin/sh
sleep "${NUZENIO_PG_DUMP_DELAY:-0}"
secret=$(cat "$NUZENIO_SECRET_FILE")
if tr '\0' ' ' < "/proc/$$/cmdline" | grep -F "$secret" >/dev/null ||
   tr '\0' '\n' < "/proc/$$/environ" | grep -F "$secret" >/dev/null; then
  echo credential-exposed > "$NUZENIO_PROCESS_RESULT"
fi
exec "$NUZENIO_REAL_PG_DUMP" "$@"
WRAPPER
chmod 700 "$wrapper_directory/pg_dump"

run_backup() {
  PATH="$wrapper_directory:$PATH" \
  PGPASSWORD="$(cat "$secret_file")" \
  NUZENIO_REAL_PG_DUMP="$real_pg_dump" \
  NUZENIO_SECRET_FILE="$secret_file" \
  NUZENIO_PROCESS_RESULT="$test_directory/process-result" \
  NUZENIO_BACKUP_OUTPUT="$1" \
    "$script_directory/backup-postgres.sh"
}

# A predictable legacy partial symlink cannot intercept the new random temporary file.
touch "$test_directory/victim"
ln -s "$test_directory/victim" "$test_directory/safe.dump.partial.$$"
run_backup "$test_directory/safe.dump" >/dev/null
pg_restore --list "$test_directory/safe.dump" >/dev/null
test ! -s "$test_directory/victim"
test ! -e "$test_directory/process-result"
test "$(stat -c '%a' "$test_directory/safe.dump")" = 600

# Valid repeated allowlisted query parameters still reach the real pg_dump boundary.
parameterized_source_url="${NUZENIO_BACKUP_DATABASE_URL}?connect_timeout=5&application_name=Nuzenio%20Backup&application_name=Nuzenio%20Validation"
NUZENIO_BACKUP_DATABASE_URL="$parameterized_source_url" \
  run_backup "$test_directory/parameterized.dump" >/dev/null
pg_restore --list "$test_directory/parameterized.dump" >/dev/null

# A symlink destination is rejected without modifying its target.
printf preserve > "$test_directory/symlink-target"
ln -s "$test_directory/symlink-target" "$test_directory/symlink.dump"
if run_backup "$test_directory/symlink.dump" >/dev/null 2>&1; then
  echo "A symlink destination was accepted." >&2
  exit 1
fi
test "$(cat "$test_directory/symlink-target")" = preserve

# A destination appearing after pg_dump starts wins atomically and is never overwritten.
NUZENIO_PG_DUMP_DELAY=1 run_backup "$test_directory/raced.dump" >/dev/null 2>&1 &
race_pid=$!
sleep 0.2
touch "$test_directory/raced.dump"
if wait "$race_pid"; then
  echo "A destination race overwrote an existing file." >&2
  exit 1
fi
test ! -s "$test_directory/raced.dump"
test -z "$(find "$test_directory" -name '.nuzenio-backup.partial.*' -print -quit)"

# Two writers cannot both publish the same destination.
set +e
NUZENIO_PG_DUMP_DELAY=0.3 run_backup "$test_directory/concurrent.dump" >/dev/null 2>&1 &
first_pid=$!
NUZENIO_PG_DUMP_DELAY=0.3 run_backup "$test_directory/concurrent.dump" >/dev/null 2>&1 &
second_pid=$!
wait "$first_pid"; first_status=$?
wait "$second_pid"; second_status=$?
set -e
test $((first_status + second_status)) -ne 0
test "$first_status" -eq 0 -o "$second_status" -eq 0
pg_restore --list "$test_directory/concurrent.dump" >/dev/null

# An interrupted wrapper/dump leaves no partial or final artifact.
set +e
PATH="$wrapper_directory:$PATH" \
NUZENIO_REAL_PG_DUMP="$real_pg_dump" \
NUZENIO_SECRET_FILE="$secret_file" \
NUZENIO_PROCESS_RESULT="$test_directory/process-result" \
NUZENIO_PG_DUMP_DELAY=10 \
NUZENIO_BACKUP_OUTPUT="$test_directory/interrupted.dump" \
  timeout --signal=TERM 0.3 "$script_directory/backup-postgres.sh" >/dev/null 2>&1
interrupted_status=$?
set -e
test "$interrupted_status" -ne 0
test ! -e "$test_directory/interrupted.dump"
test -z "$(find "$test_directory" -name '.nuzenio-backup.partial.*' -print -quit)"

# URI option injection and malformed variants are rejected before real psql can execute.
touch "$test_directory/input.dump"
malicious_values=(
  '--command=CREATE TABLE restore_guard_bypass(id integer)'
  '-cCREATE TABLE restore_guard_bypass(id integer)'
  " postgresql://user:pass@postgres/$POSTGRES_DB"
  $'postgresql://user:pass@postgres/database\n'
  'not-a-uri'
  'mysql://user:pass@postgres/nuzenio_review_source'
  "postgresql://user:pass@postgres/$POSTGRES_DB?application_name=%00"
  "postgresql://user:pass@postgres/$POSTGRES_DB?application_name=%0A"
  "postgresql://user:pass@postgres/$POSTGRES_DB?application_name=%2500"
  "postgresql://user:pass@postgres/$POSTGRES_DB?application_name=%250D"
  "postgresql://user:pass@postgres/$POSTGRES_DB?application_name=%25E2%2580%25AE"
  "postgresql://user:pass@postgres/$POSTGRES_DB?application_name=ok&application_name=%250A"
  "postgresql://user:pass@postgres/$POSTGRES_DB?application_name=%"
  "postgresql://user:pass@postgres/$POSTGRES_DB?application_name=%ZZ"
  "postgresql://user:pass@postgres/$POSTGRES_DB?application_name=%0G"
  "postgresql://user:pass@postgres/$POSTGRES_DB?application_name=%25ZZ"
  "postgresql://user:pass@postgres/$POSTGRES_DB?application_name=%2525ZZ"
)
for malicious in "${malicious_values[@]}"; do
  if NUZENIO_RESTORE_DATABASE_URL="$malicious" \
    NUZENIO_RESTORE_INPUT="$test_directory/input.dump" \
    NUZENIO_RESTORE_CONFIRM_DATABASE="$POSTGRES_DB" \
    PGHOST=postgres PGUSER="$POSTGRES_USER" PGDATABASE="$POSTGRES_DB" \
      "$script_directory/restore-postgres.sh" >/dev/null 2>&1; then
    echo "An unsafe PostgreSQL URI was accepted." >&2
    exit 1
  fi
done
secret=$(cat "$secret_file")
test "$(PGPASSWORD="$secret" psql --host=postgres --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" --tuples-only --no-align \
  --command="SELECT to_regclass('public.restore_guard_bypass') IS NULL")" = t

echo "PostgreSQL operation security tests passed."
