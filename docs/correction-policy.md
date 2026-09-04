# Correction policy

## Remediation safeguards

Audit and revision snapshots use one recursive JSON encoder, so timestamps/UUIDs/enums cannot
silently break transactional corrections or suppression. Audit failures roll back domain changes.
Document/correction links require HTTPS without credentials or ambiguous authorities.

Changed summary wording must receive a new explicit sentence-level evidence mapping via the summary
revision API. Copying an old map does not prove coverage of new text: invalid mappings stay pending
and are filtered from public readers. Brief corrections operate on stable UUID membership; saved
snapshots have their old payload removed and are marked invalidated. Offline devices cannot be
forcibly recalled while disconnected; a reconnect/update is required. The new service worker does
not cache live reader/API data and purges legacy Nuzenio caches on activation.

Nuzenio aggregates and summarizes publisher reporting; it does not silently rewrite published history. A correction must be attributable, reviewable and visible wherever affected content is presented.

## Intake

A staff member opens a correction against exactly one article or cluster and records:

- the issue in English and, when available, Hindi;
- the correction source URL;
- an evidence/reference note;
- the creator and correlation ID;
- the intake timestamp.

Do not include credentials, unpublished personal data or confidential documents in the URL or free-text evidence field.

## Assessment and application

The resolver identifies all affected fields before applying one version-checked transaction. Cluster changes require the current cluster version and article metadata changes require the current article version. Supported impacts include article metadata, neutral cluster headlines, claim wording/state, replacement summary versions, brief membership and saved/offline snapshot markers. An article correction is also marked on every cluster containing that article.

Before each destructive-looking content change, `ContentRevision` stores the prior version and snapshot. `CorrectionImpact` records each affected entity and action. Published summary text is never overwritten: corrected text creates a new pending `SummaryVersion` using the previous evidence map. Affected summaries can therefore be reviewed or kept suppressed. Material changes hold the cluster when another review is required.

Every applied correction invalidates the affected cluster's derived summaries even when no
replacement wording is supplied. Claim/evidence edits invalidate summaries whose maps depend on
the affected evidence; malformed legacy maps are retired conservatively. Article corrections
invalidate every containing cluster. Both languages are covered; historical versions retain text,
maps, timestamps and invalidation reasons in authenticated administration only. Invalidated IDs
cannot be re-approved: create a fresh mapped revision, approve it and restore the cluster (plus
independent high-risk review when required). A copied historical map is not evidence for new text.
Publishing a new revision in one language retires older versions of that language without erasing
an independently regenerated other-language version. Unaffected clusters remain usable.

Search eligibility is enforced in SQL before matching/counting/pagination, using the exact same
public summary selection as detail/feeds/sources/briefs. The For You and Following routes consume
the public feed. Reader API responses are no-store and the current PWA stores no live content.

The public cluster exposes published correction history and a corrected marker. Offline snapshots receive a version increment and correction reference so a later sync cannot present stale content as current. Removing a story from a brief preserves the prior brief revision.

## Resolution

Resolution text should say what changed and why, without repeating unsupported allegations. Publication records resolver identity, resolution and timestamps. Turnaround is measured as `resolved_at - raised_at`. A closed correction cannot be applied twice; a new issue requires a new correction record.

## Targets for future policy

Milestone 2C should define severity/SLA bands, public correction-link presentation, publisher acknowledgement tracking, reader sync delivery and an explicit decision flow for corrections that do not change Nuzenio copy.
