# Draft inbox implementation validation — 2026-09-12

Implementation branch: `feat/milestone-3c1-draft-inbox`.
Base: `6e1f7cd00ac7e010cf723881835f9febeaf8e5b8` (merged reader-reports milestone).
This is implementation validation, not independent review or production approval.

## Executed

| Gate | Result |
| --- | --- |
| Complete API/security suite, macOS Python 3.14.4, disposable password-authenticated PostgreSQL/Redis | 1,104 passed |
| Inbox plus database-remediation suite, Linux Python 3.12.3 | 38 passed, two existing test-client deprecation warnings |
| Web unit suite | 142 passed |
| Fresh Linux Node 22.13.0 / npm 10.9.2 install, format, lint, tests, build | Passed |
| Existing production Playwright suite, Linux Chromium | 60 passed, three projects, effective retries zero |
| Additional offline inbox production Playwright suite | 6 passed, desktop/mobile, effective retries zero |
| Python Ruff / web formatting and lint / TypeScript production build | Passed |
| Clean migration, legacy upgrades, row preservation, schema drift | Passed; head `a81c3d7e520b` |
| Real runtime/audit-role inbox access | Passed |
| Compose build/start: PostgreSQL, Redis, API, worker | Healthy |
| Runtime-role offline fixture import | 8 new items, then 0; no network fetch |
| Real PostgreSQL backup/restore and operation-security script | Passed |
| Disposable Compose teardown on successful and failed harness runs | Completed; existing projects preserved |
| npm and Python dependency audits | No known vulnerabilities reported |

Browser execution used the Linux Playwright image with Node 24.18.1/npm 11.16.0.
Node 22.13.0/npm 10.9.2 was separately validated with a clean dependency tree.
Database integrations used SQLAlchemy 2.0.52 and Psycopg 3.3.5.
Native macOS browser execution was not used as browser evidence.

The existing stream-close cancellation message appeared during the old browser suite without test
failures. This milestone does not change streaming code or broaden the earlier bounded diagnosis.

## Initial failures and corrections

- The first full API run had two fixture-interference failures: new sources could be selected by
  older tests using an arbitrary first feed. Inbox tests now use a separate module-scoped disposable
  database. Old assertions were not changed; the corrected full suite passed.
- First new browser assertions used broad status/alert selectors and checked analyst denial before
  login completed. Named/scoped locators and explicit login-completion assertions fixed the harness;
  no retries or relaxed status-code expectations were introduced.
- Initial Docker copy included macOS extended attributes. A clean attribute-free source archive was
  used for the Linux runner; no product behavior changed.
- An initial Compose verification attempted to read `alembic_version` using the restricted runtime
  role. That denial is expected. Revision verification moved to the existing owner identity; runtime
  privileges were not widened.
- The operation-script canary initially used the local default password, which also appeared in the
  non-secret username/database. The harness now uses distinct generated disposable credentials, as
  CI does. The existing security script was not changed, and subsequently passed.

## Preservation and next gate

No live publisher source, paid model, feed activation, notification or deployment was used.
Main and existing founder/walkthrough preview services were preserved. New code is in a separate
worktree. Test containers/data belong only to this validation and are disposable.

GitHub exact-commit CI has **not** been claimed for this local implementation. Push/PR and a fresh
independent review are the next gates; this report does not authorize merging.
See [workflow, API and deliberate limitations](draft-inbox.md).
