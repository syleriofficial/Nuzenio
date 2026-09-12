# Milestone 3B: private reader reports

Readers can submit an English/Hindi report on a publicly eligible story. The UI
confirms success only after PostgreSQL commits the report and its audit event.
Reports are unverified private submissions, never evidence, votes, automated
corrections or authority to publish. No story, summary, review or alert is changed.

## Setup and migration

Apply the forward migration `6d0a4f2b8c91 → 76d934bfa102` using the migration-owner
identity, then rerun the existing runtime/audit-role provisioning and assertions.
Compose already runs provisioning after migrations. The new `reader_reports`
table is initially empty; existing content/IDs and prior migrations are untouched.
Downgrade is deliberately refused: use a reviewed forward migration to preserve submissions.

The Next.js server needs `NUZENIO_API_BASE_URL` and the exact, canonical
`NUZENIO_REPORT_WEB_ORIGIN` opened in the browser. For a localhost preview:

```sh
NUZENIO_REPORT_WEB_ORIGIN=http://localhost:3000 npm run dev:web
```

Use the matching `127.0.0.1` origin instead if that is the browser address; aliases
are not interchangeable. Set these variables in the web process environment or
untracked `apps/web/.env.local`; copying the root example alone does not export it
to Next.js. Production must use its HTTPS browser origin and existing TLS/ingress
controls. Missing/malformed origin fails closed with 503. The proxy never trusts
Host or forwarded headers to infer an allowed origin.

## Public contract

`POST /api/reader/reports` is the same-origin web proxy to `POST /v1/reader-reports`.
It accepts only JSON, at most 16 KiB within five seconds, with these fields:

```json
{
  "submissionId": "ca3b2a4a-5cf8-4e8b-92c4-f7fa73599a85",
  "storySlug": "open-language-model-india-labs",
  "language": "en",
  "category": "INACCURATE",
  "details": "Please review the context of this fictional story."
}
```

Categories are INACCURATE, OUTDATED, UNCLEAR and OTHER. Details are plain text,
10–2,000 characters; unexpected fields and control characters are rejected.
The story must satisfy the existing public summary/review/evidence gates.
The only acknowledgment is `202 {"accepted":true}`. There is no public report ID,
status lookup, report listing or reporter identity. HTML-like text is rendered as
text in the staff inbox, never inserted as markup.

A random submission UUID is generated without weak-random fallback. The open form
reuses it when retrying the identical payload after an uncertain response. The DB
unique key makes simultaneous exact retries one report and one submission audit;
the same key with changed content is 409. Existing exact retries can acknowledge a
saved report even after the story becomes unavailable. Changing content or reopening
the form creates a new submission intent: there is no semantic deduplication or
cross-reload duplicate guarantee. Drafts/keys are memory-only, not browser storage.

Failures retain the open draft and never announce success. Closing/reloading loses
the draft. Public form requests have a 12-second deadline; the proxy bounds upstream
work at eight seconds and returns only safe acknowledgments/error responses.
The proxy forwards no staff cookies, authorization or client-IP headers and never
uses fixtures as a successful fallback. API/admin/proxy responses are no-store and
outside the service-worker static allowlist.

## Staff workflow and privacy

Administrators, Editors and Reviewers have `report:read` and `report:manage`.
Publisher Managers and Analysts cannot read the inbox. The audit-only DB identity
cannot SELECT report text. Reader accounts/contact details are not collected.

- `GET /v1/admin/reader-reports`: status filter, stable oldest-first pagination;
  `page` starts at 1 and `page_size` is at most 50. Submission/payload hashes omitted.
- `PATCH /v1/admin/reader-reports/{id}`: existing session, permission and CSRF controls;
  body contains `expectedVersion`, `status` and a 10–1,000 character `note`.
- Allowed transitions: NEW → REVIEWING → RESOLVED or DISMISSED. Row locking plus
  expected-version checks reject stale/competing transitions with 409. Closed
  reports cannot be reopened or edited by this API.
- Report and metadata-only audit commit atomically. Audit records contain actor,
  report ID, action, status/version and correlation ID, not report text or staff notes.
  Only the latest note is retained in the report; this is not a note-history system.
- Existing logout, account switching and private request cancellation clear inbox
  data from memory; reports are not persisted to browser storage.

Triage closure does not assert that the reported allegation is true. Any factual
change must use the existing independent editorial correction/approval workflow.

## Abuse and operational boundaries

Redis atomically enforces separate global and hashed-peer fixed-window admission
before reading the API body. Defaults: 120 global and 30 peer attempts per 60 seconds;
denials do not extend windows. Redis failure returns 503, never an in-memory fallback.
Keys expire within two windows and contain no raw IP, report text or user agent.
As with fixed windows generally, traffic can burst at the boundary.

Proxy visitors share its peer bucket; this is intentionally coarse, not per-user
or bot-proof protection. Do not forward untrusted X-Forwarded-For to “fix” fairness.
A real launch requires reviewed trusted-ingress rate limiting, request/concurrency
and storage limits, abuse monitoring and a documented retention/deletion policy.
There is no CAPTCHA, scheduled purge, contact workflow or public notifications in
this milestone. No automatic deletion is introduced. Reports/backups can contain
user-entered personal data despite the warning; restrict access and retention.

## Validation and handoff

Regression coverage exercises persistence, identical/conflicting/concurrent retries,
public eligibility, malformed/body-size/encoding/origin rejection, Redis admission,
RBAC/CSRF, competing triage, audit rollback, runtime/audit DB identities and migrations.
Production Playwright covers desktop/mobile submission, lost acknowledgment and retry,
Hindi, rate errors retaining drafts, staff visibility, private rendering, status
persistence and unchanged story content. The release suite requires zero retries.

Standalone `playwright.reports.config.ts` is only for an isolated seeded test stack:
it creates reports and updates their triage status. Never point it at the founder's
existing preview or production. Test-only staff accounts come from the existing
guarded E2E setup, not production bootstrap. Initial local browser attempts exposed
insecure-context setup, loopback normalization and nested-label issues; they were
corrected without relaxing origin checks or confidentiality assertions.

This is implementation evidence, not an independent security review or production
approval. No live feeds, publisher contact, merge or deployment are part of 3B.
