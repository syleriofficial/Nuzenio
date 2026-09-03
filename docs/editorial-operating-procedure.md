# Editorial operating procedure

## Revision-bound review and allocation

Any material edit supersedes prior reviews. Only the current pending material revision can be
approved/rejected. Drafter and final reviewer must differ, even when both are administrators.
Alert readiness requires a third independent identity on that same current published revision.
An old review ID cannot approve new content, and repeated decisions conflict.
Summary approval/rejection preserves the current draft author: reviewing text does not transfer its
authorship or make the original drafter eligible for final approval.

Merge moves articles, claims/evidence, documents, correction history and timeline entries into the
target; old source summaries remain preserved but pending. Split partitions article membership
exactly once, clones claim wording where evidence spans groups and partitions evidence by its
article destination. Primary documents and document evidence stay on the first result; the old
timeline stays there as history. Corrections are carried forward to every result. Claims without
remaining evidence are not exposed by readers. All resulting clusters are held and old summaries
become pending with revision snapshots. Staff must regenerate/re-map/review before restoration.

Brief membership is updated transactionally using UUIDs; it is independent of headline/slug edits.
The summary revision API accepts explicit sentence evidence maps. Approval validates structural
coverage, not truth: editorial source checking remains mandatory.

## Standard cluster workflow

1. An editor opens the queue, compares organization-level sources and checks claim evidence.
2. Headline, claim or cluster membership changes are submitted with the version that was reviewed. A conflict means the editor must reload and reconcile the newer record.
3. Claims require at least one persisted evidence reference. Summary approval is rejected when its evidence map is empty.
4. The editor may attach an official primary document by canonical HTTPS URL and issuer.
5. Merge moves unique article memberships into the selected target and preserves source clusters as held records. Split requires every article to appear exactly once across at least two new clusters.
6. Suppression immediately removes a cluster from public reader queries. Restoration is blocked for unapproved high-risk content.

## High-risk dual control

The high-risk gate applies to elections, communal violence, war, terrorism, health emergencies, public safety and market-moving reporting. Material edits create or refresh a pending review and hold the cluster from public feeds.

The drafter records the proposed wording or facts. A different Reviewer or Administrator checks the evidence, decision and notes and then approves or rejects. Approval records both identities and timestamps; rejection keeps the cluster held. Alert readiness is a separate state requiring explicit approval by an authorized person who is neither drafter nor final reviewer. No public alert is sent in this milestone.

## Correction workflow

1. Open a correction against exactly one cluster or article. Record the external correction source and evidence reference.
2. Assess affected headline, claims, summaries, briefs and saved snapshots.
3. Apply the correction with current versions. The service records pre-change revisions and impact rows instead of silently replacing history.
4. New summary text becomes a pending version and holds affected content until review. Public cluster history is marked corrected.
5. Record a clear resolution. Turnaround is measured from `raised_at` to `resolved_at`.

Detailed correction rules are in [correction-policy.md](correction-policy.md).

## Source and feed controls

Publisher, domain, rights and feed approvals are separate. Do not approve a feed until its dry-run is valid and the required headline, snippet and generated-summary rights are current. Full-text display must remain off. Pause or block a source immediately for rights revocation, unsafe behavior or material ownership uncertainty. The Administrator can pause the India edition when a systemic editorial issue warrants it.

## Audit review

Use the audit search by action, entity, actor, correlation ID or outcome to reconstruct a decision. Exports are capped at 10,000 rows and redact sensitive key names. Application code cannot update or delete records; any retention operation must be an explicit database-administration procedure outside the application role and consistent with legal requirements.
