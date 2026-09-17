# Admin create-form reset regression

## Scope

Correction creation and publisher-draft creation previously awaited the admin
mutation before calling `event.currentTarget.reset()`. React clears the event's
current target after synchronous dispatch. Both paths therefore saved the record
but threw `Cannot read properties of null (reading 'reset')` instead of clearing
the form. Production-browser regressions reproduced both failures before the fix.

Both forms now share a submission hook that captures the form element and values
before awaiting. The mutation reports whether the write succeeded. Only confirmed
success resets the form; validation/network failures preserve input. A successful
write still resets when the subsequent list refresh fails, and the existing Retry
control retries the list read, not the write.

A synchronous in-flight guard prevents same-tick duplicate submissions. Controls
remain disabled through save/refresh, so text entered during a pending operation
cannot be silently erased. This is a per-mounted-form UI guard, not server-side
idempotency or protection against an ambiguous transport outcome.

## Repeatable validation

```sh
npm ci
npm run format:check:web
npm run lint:web
npm run test:web
npm --workspace apps/web run test:e2e:admin-forms
```

The dedicated Playwright configuration builds and runs the production Next.js UI,
uses desktop and mobile Chromium, and enforces zero retries. It intercepts admin
HTTP responses for deterministic delayed-success, validation-error, network-error,
and refresh-error scenarios. Assertions cover request payload/CSRF headers, one
request/reset under duplicate submission, preserved fields on failure, successful
retry, and absence of uncaught browser errors.

These eight scenarios per viewport also belong to the existing release browser
suite. They do not start/reset a database or mutate a founder preview. They verify
UI behavior, not backend persistence, production readiness, or real-device Safari.

## Local result — 2026-09-17

- Unfixed production UI: both reset reproductions failed with the expected null
  current-target exception and unchanged form values.
- Fixed production UI: all 16 new desktop/mobile browser cases passed; zero retries.
- Existing web unit suite: 142 passed. Formatting, lint, TypeScript checking, and
  the production build passed in the isolated Linux runner (Node 24.18.1).
- Release-selection regression preserves the original 60 cases and verifies the
  16 additional cases are selected once each (76 total). The full backend-backed
  release suite and remote CI were not run for this uncommitted working tree.
- API, migrations, editorial permissions, and request payload contracts unchanged.
- Existing main checkout and founder preview data were not modified.

The fix requires normal code review and matching CI before merge. This local
validation does not start or update the existing preview, or deploy the change.
