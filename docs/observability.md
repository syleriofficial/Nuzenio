# Production observability

Nuzenio emits newline-delimited JSON to standard output in production. Logs contain an ISO-8601
timestamp, severity, service, event name and the request/correlation ID when available. Request logs
use route templates rather than raw paths and do not include bodies, query strings, cookies,
authorization values or client IPs by default. Fields whose names indicate passwords, tokens,
secrets, cookies, authorization or CSRF values are recursively redacted.
Free-form third-party messages cross the same sanitizer boundary: common PostgreSQL/Redis credential
URIs, bearer/cookie values and standalone or identifier-qualified password/token/secret assignments
are redacted in plain, escaped-JSON, common YAML-block, single- and double-percent-encoded forms.
Qualified keys use `_`, `.` or `-` separators; ordinary words such as `secretary`, `tokenizer` and
`passwordless` are not treated as secret keys. Assignment scanning is a bounded single-pass state
machine rather than a backtracking regular expression. Sanitization scans a bounded 16,384-character
window before applying
the final 8,192-character output limit, and conservatively redacts a credential authority truncated
inside that window. Detection uses at most two bounded decoding shadows and never emits a decoded
representation. Application code should still prefer stable structured event names. Redaction is
defense in depth, not permission to log request bodies or secret-bearing exception text, and novel
encodings remain an operational risk.

Production rejects SQL echo configuration. The shared engine policy independently parses the exact
environment value; malformed values fail closed. All application-owned production engines force SQL
and pool echo off, enable SQLAlchemy parameter hiding and replace driver exceptions with bounded type
and SQLSTATE diagnostics. After SQLAlchemy completes transaction/pool bookkeeping, the production
connection boundary raises a metadata-only `DetachedDatabaseError`; it retains no driver exception,
diagnostic object, statement or parameters, and normal session rollback remains required before
reuse.
Result consumption has the same detachment boundary: a delegating fetch strategy surrounds native
SQLAlchemy fetch operations after its driver-error handlers exit. It preserves native Core/ORM
result objects, cleanup, exhaustion, streaming and `yield_per` strategy replacement. SQLAlchemy has
no public around-fetch hook; `Engine._connection_cls`, private connection methods and
`CursorResult.cursor_strategy` are version-sensitive integrations. The regression matrix validates
SQLAlchemy 2.0.52 with Psycopg 3.3.5 on Python 3.12 and 3.14; the dependency range is not an assurance
that every future release is compatible. Re-run the integration matrix on upgrades. Psycopg's cached
rowcount and unsupported `lastrowid` retain native behavior; PostgreSQL inserts use `RETURNING`.
Application result processors remain responsible for their own exceptions, which are not translated
into database errors. Traceback-local collection must remain disabled: this policy does not erase
arbitrary process memory or traceback frame locals.

The application owns the complete `sqlalchemy` logging namespace: direct
handlers are removed, DEBUG result-row records are suppressed and safe statement diagnostics route
through the configured root handlers. In production, each handler configured at initialization gets
an independently sanitized `LogRecord` clone before its own filters, formatter or emitter can inspect
the message, arguments, structured extras, stack text or exception data. Repeated Nuzenio logging
initialization replaces only its own marked handler, preserves unrelated root telemetry handlers and
does not wrap a handler more than once. Password-bearing role DDL executes
through Psycopg beneath SQLAlchemy statement logging while retaining driver quoting and transaction
semantics. This boundary cannot protect values deliberately embedded as SQL literals; application
queries carrying private values must use bound parameters. Database/platform logs remain an
independent infrastructure boundary. Deliberate privileged logging reconfiguration after secure
application initialization is outside this guarantee; deployment startup must not add unreviewed
post-initialization handlers.

Replacement records compose positional/mapping percent-format messages before sanitization and
always clear `args`; raw templates/arguments are not retained in custom fields. Composition parses
at most 16,384 template characters and 128 conversions, caps widths/precision and the combined scan
buffer before rendering, and accepts only bounded builtin scalar values. It never invokes arbitrary
application `__str__`/`__repr__` or custom mapping hooks. Malformed formats, missing keys, oversized
fields and unsupported objects produce a constant omission event without raw arguments or formatting
exceptions. This intentionally changes nonprimitive diagnostic `%s` rendering; prefer stable event
names with structured fields for such data. Sensitive interpolations are redacted as whole values,
including embedded whitespace/delimiters. Final output retains the existing 8,192-character limit
and bounded single/double-encoding protections. Safe ordinary primitive interpolation, handler
levels/filters/formatters/destinations and original application objects remain unchanged.

`X-Request-ID` may be supplied by an upstream proxy when it contains only alphanumeric characters,
hyphen, underscore or dot and is at most 80 characters; otherwise the API creates a UUID. Return the
ID to the user when investigating a failed request. Feed runs retain their durable request ID and log
their run/feed IDs, state, attempt and bounded operational counts—not publisher response bodies.

## Health surfaces

| Service | Endpoint | Meaning |
| --- | --- | --- |
| API | `/health/live` | Process can handle HTTP. It does not claim dependency availability. |
| API | `/health/ready` and compatibility `/health` | PostgreSQL query and bounded Redis ping succeed. |
| Worker | `:8001/health/live` | Worker health server is running. Internal-only. |
| Worker | `:8001/health/ready` | Main loop recently completed a PostgreSQL/Redis-backed iteration and is not stopping. |
| API | `/metrics` | OpenMetrics text; bearer-token protected when `NUZENIO_METRICS_TOKEN` is set and required in production. |
| Worker | `:8001/metrics` | Internal lifecycle counters; do not expose publicly. |

Readiness probes may remove a process from service but must not restart it on their own. Liveness
failure is appropriate for restart. The worker completes bounded in-flight work after SIGTERM; its
fetcher already enforces an absolute deadline. Deployments should allow at least 20 seconds before
SIGKILL.

## Metrics and initial alert thresholds

The repository supplies metrics and thresholds, not a paid collector. A Prometheus-compatible
scraper, existing platform metrics agent or periodic authenticated check can collect them.

| Signal | Initial threshold | Operator response |
| --- | --- | --- |
| API readiness | 2 consecutive failures or >1% over 5 minutes | Check PostgreSQL/Redis before restarting application processes. |
| Worker readiness | Not ready for 60 seconds | Inspect worker logs, queue and database connectivity. |
| `nuzenio_worker_abandoned_runs` | Any value >0 for 2 minutes | Confirm lease expiry/recovery; do not manually complete the row. |
| `nuzenio_queue_depth{queue="ready"}` | >100 for 10 minutes | Check worker capacity and oldest durable `FeedRun`. |
| Scheduled queue | Sustained growth for 15 minutes | Check Redis dispatch and rights/kill-switch state. |
| Retrying feed runs | >10% of feed runs over 15 minutes | Group by feed/error code; pause a failing source if needed. |
| `nuzenio_dead_letters_unreplayed` | >0 for 15 minutes or any increase | Triage; replay only after the underlying cause and current rights are verified. |
| Pending high-risk review | Oldest pending >15 minutes for urgent public safety; >60 minutes otherwise | Escalate to an independent reviewer; never auto-approve. |
| Pending standard review | Oldest pending >4 hours | Review editorial staffing and queue ownership. |

Counters reset on process restart; feed, retry, lease, dead-letter and review gauges are rebuilt from
PostgreSQL/Redis. Alert rules must tolerate deployment resets. Until a time-series collector is
selected, operators should preserve container logs and periodically record the authenticated metrics
snapshot. Metrics endpoints return `Cache-Control: no-store`.

Feed execution returns a typed outcome for success, rights/kill-switch skip, retry, dead letter,
failure, cancellation, already-active work and lease/fencing loss. Worker completion metrics consume
that outcome directly: fenced work increments the lost-lease counter and never the success counter.
These counters are process-local and restart; the durable feed-run state remains authoritative.

## Diagnostics boundaries

The API metric surface exposes counts only. Internal errors, rights evidence, review notes and feed
payloads remain in permission-gated workflows and structured service logs. Worker health exposes a
current run UUID for correlation but no URL or publisher content. Keep the worker port on the private
service network. The default `NUZENIO_LOG_CLIENT_IP=false` supports data minimization; enabling it
requires a documented retention/legal basis.
