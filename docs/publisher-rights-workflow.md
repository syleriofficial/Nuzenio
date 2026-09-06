# Publisher and rights workflow

## Evidence-visible approval

Reviewers see domain ownership evidence and all eight rights permissions, evidence URL,
effective/expiry/revocation dates, reviewer/date, previous approved snapshot and latest 100 review transitions. Approval must submit
the displayed version and snapshot hash. The API rejects absent/stale snapshots and audits the
exact reviewed snapshot. Hash binding identifies the approved record, not whether a staff member
actually read the external contract or that a contract grants legally valid rights.

Changes to publisher/domain/rights/feed state and final ingestion persistence share ordered locks.
Queued/retrying jobs are invalidated in the same control transaction. In-flight fetch results are
discarded when rights expire, are revoked, or approval versions/kill switches change.

## Separate approval objects

A publisher organization, each domain, each rights policy and each source feed have independent lifecycle records and version numbers. Approval of one does not imply approval of another.

The lifecycle is:

```text
Draft → Submitted → Under review → Approved → Paused
  ↑          │             │           │          │
  └──────────┘             └→ Rejected └→ Blocked ┘
                                │            │
                                └→ Draft     └→ Under review
```

Every transition requires the version observed by the reviewer and creates an audit event. Direct state jumps are rejected.

## Publisher organization

Record the legal/operating owner, verified contact, correction route and descriptive policy. The organization becomes active only after review. Pausing, blocking or rejecting it pauses its feeds. Multiple domains owned by this record count as one independent source in reader diversity.

## Domain verification

Store a normalized domain and ownership evidence. Verification is explicit at approval; a feed URL must belong to the selected verified domain. DNS/network safety validation does not replace legal ownership review.

## Rights policy

Capture each permission independently:

- headline use;
- snippet storage/display;
- thumbnail use;
- generated summaries;
- translation;
- audio generation;
- full-text storage;
- full-text display.

Headline, snippet and generated-summary permissions plus a rights-evidence URL are mandatory before approval. Effective and optional expiry dates are stored with reviewer identity and timestamp. Full-text display is hard-disabled in Milestone 2B even if requested. Blocking rights records the revocation time. Expiry or revocation automatically pauses dependent feeds when the scheduler or registry evaluates them, and the execution gate independently refuses stale rights.

## Feed review

Create a feed only against the same organization’s verified domain and rights record. Before approval:

1. Confirm the parent publisher is approved and active.
2. Approve the domain and mandatory rights.
3. Run dry validation. It performs no fetch and reports rights and URL/DNS safety findings.
4. Move the feed through Submitted and Under review to Approved.
5. Set a bounded polling interval and per-minute source limit.

Manual and scheduled runs repeat every gate. Paused, blocked, rejected, killed or rights-expired feeds cannot execute. Seed feeds are fictional `.example` values, and Compose keeps the global feed kill switch on.

## Evidence retention

Rights evidence URLs, ownership notes, reviewer IDs, effective/expiry/revocation timestamps and audit history should be retained for the applicable contract and legal period. Evidence links may require access controls outside Nuzenio; never place private document tokens in these URLs.
