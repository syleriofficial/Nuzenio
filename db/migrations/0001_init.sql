CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT NOT NULL, feed_url TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL CHECK(language IN ('hi','en')), category TEXT NOT NULL DEFAULT 'india',
  state TEXT NOT NULL DEFAULT '', rights_status TEXT NOT NULL DEFAULT 'pending',
  rights_evidence TEXT NOT NULL DEFAULT '', rights_checked_at TEXT NOT NULL DEFAULT '',
  rights_expires_at TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 0,
  allow_title INTEGER NOT NULL DEFAULT 0, allow_link INTEGER NOT NULL DEFAULT 0,
  etag TEXT NOT NULL DEFAULT '', last_modified TEXT NOT NULL DEFAULT '', last_fetched_at TEXT
);
CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
  title TEXT NOT NULL, url TEXT NOT NULL, published_at TEXT NOT NULL, language TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'india', state TEXT NOT NULL DEFAULT '',
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(source_id,url)
);
CREATE INDEX IF NOT EXISTS idx_news_language_date ON news_items(language,published_at DESC);
CREATE TABLE IF NOT EXISTS originals (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, language TEXT NOT NULL CHECK(language IN ('hi','en')),
  category TEXT NOT NULL DEFAULT 'india', title TEXT NOT NULL, body TEXT NOT NULL,
  author TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','published')) DEFAULT 'draft',
  published_at TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
  target_id TEXT NOT NULL, happened_at TEXT NOT NULL
);
