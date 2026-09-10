# Rights-safe publisher pilot checklist

Milestone 2C does not authorize a live publisher. The environment kill switch and persistent edition/
feed controls remain on, all configured feeds are fictional `.example` fixtures, and dry runs perform
validation without fetching. Enabling any real source requires explicit legal, product, security and
editorial approval outside this milestone.

## Legal and rights evidence

- Identify the contracting publisher organization, beneficial/operating ownership and authorized
  contact.
- Verify each domain independently and retain dated ownership evidence.
- Record the licence/API/RSS terms and the exact evidence location; do not embed access tokens in URLs.
- Decide each right separately: headline, snippet, thumbnail, generated summary, translation, audio,
  full-text storage and full-text display.
- Keep full-text display disabled. Record effective and expiry dates and a review owner.
- Define territory, editions, attribution wording, link requirements and any commercial restrictions.
- Define permitted retention for raw responses, article metadata, excerpts, thumbnails, generated
  summaries, translations, logs, backups and deleted/taken-down material.

## Editorial and user-facing obligations

- Agree the publisher correction contact, expected acknowledgement/turnaround and evidence format.
- Confirm how publisher corrections propagate to clusters, claims, summaries, briefs and saved/offline
  state while preserving prior versions.
- Define takedown authority, emergency contact, target response time and audit requirements.
- Verify original links, organization-level source counting, syndication handling and machine-
  translation labels.
- Confirm no full article is ingested or displayed and every summary sentence has same-cluster evidence.

## Technical dry run

- Move organization, domain, rights and feed through separate version-bound reviews.
- Revalidate HTTPS URL parsing, public DNS answers, redirect targets, pinned connection IP, content type,
  response/decompression budget, XML safety, text sanitation and per-source rate limits.
- Confirm no publisher-supplied headers or embedded URL credentials are accepted.
- Execute the no-fetch dry-run and preserve its result in the review record.
- Test expiry/revocation during an in-flight fixture fetch and confirm fencing prevents persistence.
- Test pause, global kill switch, bounded retry, dead-letter and correction/takedown fixture workflows.

## Go/no-go control

Four independent approvals are required: publisher manager, legal/rights owner, security/operations and
editorial owner. Record the approved feed IDs, rights-policy versions/hashes, dates and rollback owner.
Only a separately reviewed deployment change may disable the environment kill switch, and persistent
feed controls should initially remain paused for a manual canary. Re-enable the kill switch immediately
on rights ambiguity, unsafe content, unexpected volume, correction failure or security anomaly.
