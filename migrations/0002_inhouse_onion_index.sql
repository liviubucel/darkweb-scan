CREATE TABLE IF NOT EXISTS onion_sources (
  id TEXT PRIMARY KEY,
  onion_url TEXT NOT NULL UNIQUE,
  label TEXT,
  source_type TEXT NOT NULL DEFAULT 'discovered' CHECK (source_type IN ('seed', 'discovered')),
  category TEXT NOT NULL DEFAULT 'research' CHECK (category IN ('directory', 'research', 'disclosure', 'other')),
  enabled INTEGER NOT NULL DEFAULT 1,
  depth INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 50,
  romania_score INTEGER NOT NULL DEFAULT 0,
  discovered_from TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_crawled_at TEXT,
  next_crawl_at TEXT NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  content_sha256 TEXT
);
CREATE INDEX IF NOT EXISTS idx_onion_sources_due ON onion_sources(enabled, next_crawl_at, priority DESC, romania_score DESC);
CREATE INDEX IF NOT EXISTS idx_onion_sources_depth ON onion_sources(enabled, depth, priority DESC);
CREATE INDEX IF NOT EXISTS idx_onion_sources_ro ON onion_sources(enabled, romania_score DESC, last_crawled_at DESC);

CREATE TABLE IF NOT EXISTS onion_pages (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  onion_url TEXT NOT NULL,
  title TEXT,
  text_excerpt TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  romania_score INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (source_id) REFERENCES onion_sources(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_onion_pages_fetched ON onion_pages(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_onion_pages_ro ON onion_pages(romania_score DESC, fetched_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS onion_pages_fts USING fts5(
  page_id UNINDEXED,
  title,
  text_excerpt,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS onion_links (
  parent_source_id TEXT NOT NULL,
  child_url TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY(parent_source_id, child_url),
  FOREIGN KEY (parent_source_id) REFERENCES onion_sources(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_onion_links_child ON onion_links(child_url);

CREATE TABLE IF NOT EXISTS crawl_budget (
  day TEXT PRIMARY KEY,
  pages_fetched INTEGER NOT NULL DEFAULT 0,
  bytes_fetched INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
