# Secret rotation runbook

No production secret belongs in Git, Compose defaults, command-line arguments, screenshots or support
logs. Inject secrets through the chosen platform secret mechanism and restrict the migration identity
to reviewed migration/provisioning jobs.

Backup and restore accept a connection URI only through a named environment variable, validate it,
write credentials to an ephemeral mode-0600 `PGPASSFILE`, remove the password-bearing variable from
PostgreSQL child processes and pass a passwordless explicit `--dbname` value. The scripts trap normal,
failure and interruption paths to remove that file. Treat access to the parent process environment as
secret access and run operational tooling in a dedicated restricted job/container.

## Roles and ownership

- **Migration owner:** owns schema objects and runs Alembic plus role provisioning. The API and worker
  must never receive this URL.
- **Runtime role:** has application DML but no DDL/table ownership. It cannot update, delete or truncate
  append-only audit/contributor tables.
- **Audit reader:** can select only `audit_logs` and `authentication_events`; it cannot mutate those
  tables or inspect general application tables.

`python -m nuzenio_api.db_roles` requires separate migration, runtime and audit-reader values in
production. Re-run it after every migration so grants include new tables, then validate both restricted
identities before starting traffic.

## Rotation sequence

1. Keep the live-feed environment and persistent kill switches enabled. Pause writers for a database
   credential rotation.
2. Create a new random credential in the secret manager. Never pass it as a CLI argument.
3. Run the privileged role-provisioning job with the migration URL and the new role passwords.
4. Update API/worker or audit-tool secret references and perform a rolling restart.
5. Verify API/worker readiness and the expected database identity/privileges.
6. Revoke the old credential, then inspect authentication/audit and readiness failures.
7. Record the change ticket, actor, timestamps and verification outcome outside the secret value.

For Redis, provision a new TLS credential, update clients, verify queue recovery from PostgreSQL, then
revoke the old value. Do not restore stale Redis data as an authority.

Rotating `NUZENIO_SESSION_HASH_PEPPER` intentionally invalidates every staff session. Announce the
maintenance, rotate the value, restart every API process, revoke any remaining session rows and verify
fresh login/CSRF flows. Rotate `NUZENIO_BOOTSTRAP_TOKEN` after bootstrap use or suspected exposure.
Rotate `NUZENIO_METRICS_TOKEN` by briefly accepting the new collector configuration before removing
the old secret; this foundation supports one token, so a no-gap rotation requires a short coordinated
maintenance window.

After any suspected compromise, preserve append-only evidence, revoke staff sessions, rotate all
affected credentials, verify role grants and perform an isolated restore drill. Database-owner and
infrastructure-administrator actions remain outside application-level append-only guarantees.
