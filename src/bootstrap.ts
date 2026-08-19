import type { Env } from "./types";

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT,
  security_email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS subscriptions (
  org_id TEXT PRIMARY KEY,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS billing_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS investigations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  profile TEXT NOT NULL DEFAULT 'general',
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'monitoring')),
  watchlist_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  risk_level TEXT,
  summary TEXT,
  source_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  ai_search_item_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_investigations_org_created ON investigations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investigations_watchlist ON investigations(org_id, watchlist_id, created_at DESC);
CREATE TABLE IF NOT EXISTS investigation_sources (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  title TEXT,
  onion_url TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sources_investigation ON investigation_sources(investigation_id, ordinal);
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  source_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(org_id, investigation_id, type, value),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_artifacts_org_type_value ON artifacts(org_id, type, value);
CREATE TABLE IF NOT EXISTS watchlists (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('domain', 'email', 'brand', 'person', 'keyword')),
  value TEXT NOT NULL,
  profile TEXT NOT NULL DEFAULT 'general',
  interval_hours INTEGER NOT NULL DEFAULT 24,
  active INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_investigation_id TEXT,
  next_run_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, type, value)
);
CREATE INDEX IF NOT EXISTS idx_watchlists_due ON watchlists(active, next_run_at);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  investigation_id TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  destination TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_org_created ON alerts(org_id, created_at DESC);
CREATE TABLE IF NOT EXISTS usage (
  org_id TEXT NOT NULL,
  period TEXT NOT NULL,
  investigations INTEGER NOT NULL DEFAULT 0,
  ai_calls INTEGER NOT NULL DEFAULT 0,
  sources_scraped INTEGER NOT NULL DEFAULT 0,
  container_ms INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(org_id, period)
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_logs(org_id, created_at DESC);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  investigation_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  format TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jobs_type_status_updated ON jobs(type, status, updated_at);
`;

let schemaReady: Promise<void> | undefined;

async function createOrHealSchema(env: Env): Promise<void> {
  // The SQL is intentionally idempotent. Running it once per Worker isolate also
  // repairs a partially initialized database instead of checking only one table.
  await env.DB.exec(SCHEMA_SQL);
}

export async function ensureDatabase(env: Env): Promise<void> {
  if (!schemaReady) {
    schemaReady = createOrHealSchema(env).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}
