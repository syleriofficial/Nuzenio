CREATE TABLE IF NOT EXISTS private_drafts (
 id TEXT PRIMARY KEY NOT NULL,
 owner_email TEXT NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('news','stories')),
 slug TEXT NOT NULL,
 title TEXT NOT NULL,
 category TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved_for_manual_release')),
 content_json TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE (owner_email,kind,slug)
);
CREATE INDEX IF NOT EXISTS private_drafts_owner_status ON private_drafts (owner_email,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS private_audit (
 id TEXT PRIMARY KEY NOT NULL,
 draft_id TEXT NOT NULL,
 actor_email TEXT NOT NULL,
 action TEXT NOT NULL,
 previous_status TEXT,
 next_status TEXT,
 occurred_at TEXT NOT NULL,
 detail TEXT,
 FOREIGN KEY (draft_id) REFERENCES private_drafts(id)
);
CREATE INDEX IF NOT EXISTS private_audit_by_draft ON private_audit (draft_id,occurred_at);
