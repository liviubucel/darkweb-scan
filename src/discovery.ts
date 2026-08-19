import { getContainer } from "@cloudflare/containers";
import { HttpError } from "./security";
import type {
  AuthContext,
  DiscoveryJob,
  DiscoverySourceInput,
  Env,
  SearchHit,
  ScrapedSource,
} from "./types";
import type { TorCollector } from "./container";

const TOR_COLLECTOR_ID = "zebrabyte-shared-tor-collector";
const ONION_V3 = /^[a-z2-7]{56}\.onion$/i;
const BLOCKED_BINARY_SUFFIXES = /\.(?:7z|apk|bin|bz2|dmg|docx?|exe|gz|iso|jar|msi|pdf|rar|tar|tgz|xlsx?|zip)(?:$|[?#])/i;

interface OnionSourceRow {
  id: string;
  onion_url: string;
  label: string | null;
  source_type: "seed" | "discovered";
  category: "directory" | "research" | "disclosure" | "other";
  enabled: number;
  depth: number;
  priority: number;
  romania_score: number;
  discovered_from: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_crawled_at: string | null;
  next_crawl_at: string;
  failure_count: number;
  last_error: string | null;
  content_sha256: string | null;
}

interface CrawlSource extends ScrapedSource {
  discoveredOnionUrls?: string[];
  bodyBytes?: number;
}

interface ScrapeResponse {
  sources: CrawlSource[];
}

function intVar(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function maxDepth(env: Env): number {
  return intVar(env.CRAWL_MAX_DEPTH, 2, 0, 5);
}

function dailyBudget(env: Env): number {
  return intVar(env.CRAWL_DAILY_PAGE_BUDGET, 120, 1, 5_000);
}

function maxCatalogSources(env: Env): number {
  return intVar(env.CRAWL_MAX_CATALOG_SOURCES, 25_000, 100, 500_000);
}

function maxIndexChars(env: Env): number {
  return intVar(env.CRAWL_INDEX_TEXT_CHARS, 30_000, 2_000, 60_000);
}

function seedRefreshHours(env: Env): number {
  return intVar(env.CRAWL_SEED_REFRESH_HOURS, 12, 1, 720);
}

function discoveredRefreshHours(env: Env): number {
  return intVar(env.CRAWL_DISCOVERED_REFRESH_HOURS, 72, 6, 2_160);
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return normalized || null;
}

function normalizeCategory(value: unknown): OnionSourceRow["category"] {
  if (value === "directory" || value === "research" || value === "disclosure" || value === "other") return value;
  return "research";
}

function normalizePriority(value: unknown): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

export function normalizeOnionUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2_048) throw new HttpError(400, "Invalid onion URL");
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { throw new HttpError(400, "Invalid onion URL"); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new HttpError(400, "Only HTTP(S) onion URLs are supported");
  if (!ONION_V3.test(url.hostname)) throw new HttpError(400, "Only Tor v3 onion services are supported");
  if (url.username || url.password) throw new HttpError(400, "Authenticated onion URLs are not supported");
  if (url.port && url.port !== "80" && url.port !== "443") throw new HttpError(400, "Unsupported onion service port");
  if (BLOCKED_BINARY_SUFFIXES.test(`${url.pathname}${url.search}`)) throw new HttpError(400, "Binary/download URLs are not accepted as crawl sources");
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

export function assertDiscoveryAdmin(auth: AuthContext): void {
  if (auth.orgId.startsWith("personal:")) return;
  if (auth.orgRole === "org:admin" || auth.orgRole === "org:owner") return;
  throw new HttpError(403, "Organization admin role is required to manage discovery sources");
}

function romanianScore(title: string, text: string, url: string): number {
  const haystack = ` ${title} ${text.slice(0, 45_000)} ${url} `.toLocaleLowerCase("ro-RO");
  const signals: Array<[RegExp, number]> = [
    [/\brom[aâ]nia\b|\bromanian\b/g, 3],
    [/\bbucure[sș]ti\b|\bbucharest\b/g, 2],
    [/\bcluj\b|\btimi[sș]oara\b|\bia[sș]i\b|\bbra[sș]ov\b|\bconstan[tț]a\b/g, 1],
    [/\b(?:ron|lei)\b/g, 1],
    [/\b(?:cnp|anaf|sri|dnsc|mai|prim[aă]rie|ministerul)\b/g, 1],
    [/[a-z0-9-]+\.ro\b/g, 3],
    [/[ăâîșţț]/g, 1],
  ];
  let score = 0;
  for (const [pattern, weight] of signals) {
    pattern.lastIndex = 0;
    if (pattern.test(haystack)) score += weight;
  }
  return Math.max(0, Math.min(10, score));
}

function ftsQuery(value: string): string {
  const matches = value.normalize("NFKC").toLocaleLowerCase("ro-RO").match(/[\p{L}\p{N}@._-]{2,}/gu) ?? [];
  const tokens = new Set<string>();
  for (const token of matches) {
    tokens.add(token);
    for (const part of token.split(/[.@_-]+/)) if (part.length >= 3) tokens.add(part);
    if (tokens.size >= 10) break;
  }
  return [...tokens].slice(0, 10).map((token) => `"${token.replace(/"/g, '""')}"`).join(" OR ");
}

export async function searchOnionIndex(env: Env, query: string, limit = 60): Promise<SearchHit[]> {
  const match = ftsQuery(query);
  if (!match) return [];
  const boundedLimit = Math.max(1, Math.min(60, Math.floor(limit)));
  const roWeight = env.MARKET_FOCUS?.toUpperCase() === "RO" ? 0.35 : 0;
  type Row = { url: string; title: string | null; snippet: string | null; romania_score: number | null };
  try {
    const result = await env.DB.prepare(`
      SELECT p.onion_url AS url,
             p.title AS title,
             snippet(onion_pages_fts, 2, '', '', ' … ', 24) AS snippet,
             p.romania_score AS romania_score
      FROM onion_pages_fts
      JOIN onion_pages p ON p.id = onion_pages_fts.page_id
      JOIN onion_sources s ON s.id = p.source_id
      WHERE onion_pages_fts MATCH ?1 AND s.enabled = 1
      ORDER BY (bm25(onion_pages_fts) - (p.romania_score * ?2)) ASC, p.fetched_at DESC
      LIMIT ?3
    `).bind(match, roWeight, boundedLimit).all<Row>();
    return result.results.map((row) => ({
      title: row.title || "Indexed onion source",
      url: row.url,
      snippet: row.snippet || "",
      engine: "zebrabyte-index",
    }));
  } catch (error) {
    console.error("discovery_index_search_failed", error instanceof Error ? error.message : "unknown");
    return [];
  }
}

export async function getDiscoveryStatus(env: Env): Promise<{
  sources: number;
  enabledSources: number;
  indexedPages: number;
  romanianPages: number;
  dueSources: number;
  todayFetched: number;
  dailyBudget: number;
}> {
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const [sources, pages, due, budget] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled FROM onion_sources`),
    env.DB.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN romania_score > 0 THEN 1 ELSE 0 END) AS ro FROM onion_pages`),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM onion_sources WHERE enabled = 1 AND next_crawl_at <= ?1`).bind(now),
    env.DB.prepare(`SELECT pages_fetched FROM crawl_budget WHERE day = ?1 LIMIT 1`).bind(day),
  ]);
  const sourceRow = (sources.results?.[0] ?? {}) as { total?: number; enabled?: number };
  const pageRow = (pages.results?.[0] ?? {}) as { total?: number; ro?: number };
  const dueRow = (due.results?.[0] ?? {}) as { total?: number };
  const budgetRow = (budget.results?.[0] ?? {}) as { pages_fetched?: number };
  return {
    sources: Number(sourceRow.total ?? 0),
    enabledSources: Number(sourceRow.enabled ?? 0),
    indexedPages: Number(pageRow.total ?? 0),
    romanianPages: Number(pageRow.ro ?? 0),
    dueSources: Number(dueRow.total ?? 0),
    todayFetched: Number(budgetRow.pages_fetched ?? 0),
    dailyBudget: dailyBudget(env),
  };
}

export async function listDiscoverySources(env: Env, limit: number, offset: number): Promise<OnionSourceRow[]> {
  const result = await env.DB.prepare(`
    SELECT id, onion_url, label, source_type, category, enabled, depth, priority, romania_score,
           discovered_from, first_seen_at, last_seen_at, last_crawled_at, next_crawl_at,
           failure_count, last_error, content_sha256
    FROM onion_sources
    ORDER BY priority DESC, romania_score DESC, last_seen_at DESC
    LIMIT ?1 OFFSET ?2
  `).bind(Math.max(1, Math.min(100, limit)), Math.max(0, offset)).all<OnionSourceRow>();
  return result.results;
}

export async function addDiscoverySources(env: Env, auth: AuthContext, items: DiscoverySourceInput[]): Promise<{ added: number; existing: number }> {
  assertDiscoveryAdmin(auth);
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw new HttpError(400, "Provide between 1 and 50 discovery sources");
  const status = await getDiscoveryStatus(env);
  if (status.sources >= maxCatalogSources(env)) throw new HttpError(409, "Discovery source catalog limit reached");

  const now = new Date().toISOString();
  let added = 0;
  let existing = 0;
  for (const item of items) {
    const onionUrl = normalizeOnionUrl(item.url);
    const id = crypto.randomUUID();
    const label = normalizeLabel(item.label);
    const category = normalizeCategory(item.category);
    const priority = normalizePriority(item.priority);
    const result = await env.DB.prepare(`
      INSERT OR IGNORE INTO onion_sources
        (id, onion_url, label, source_type, category, enabled, depth, priority, romania_score,
         first_seen_at, last_seen_at, next_crawl_at, failure_count)
      VALUES (?1, ?2, ?3, 'seed', ?4, 1, 0, ?5, 0, ?6, ?6, ?6, 0)
    `).bind(id, onionUrl, label, category, priority, now).run();
    if ((result.meta.changes ?? 0) === 1) {
      added += 1;
      await env.DB.prepare(`INSERT INTO audit_logs (id, org_id, user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?1, ?2, ?3, 'discovery.seed_added', 'onion_source', ?4, ?5, ?6)`).bind(crypto.randomUUID(), auth.orgId, auth.userId, id, JSON.stringify({ label, category, priority }), now).run();
    } else {
      existing += 1;
      await env.DB.prepare(`UPDATE onion_sources SET enabled = 1, label = COALESCE(?1, label), category = ?2, priority = MAX(priority, ?3), last_seen_at = ?4, next_crawl_at = MIN(next_crawl_at, ?4) WHERE onion_url = ?5`).bind(label, category, priority, now, onionUrl).run();
    }
  }
  return { added, existing };
}

export async function disableDiscoverySource(env: Env, auth: AuthContext, id: string): Promise<boolean> {
  assertDiscoveryAdmin(auth);
  const result = await env.DB.prepare(`UPDATE onion_sources SET enabled = 0, next_crawl_at = ?1 WHERE id = ?2`).bind("9999-12-31T23:59:59.999Z", id).run();
  if ((result.meta.changes ?? 0) !== 1) return false;
  await env.DB.prepare(`INSERT INTO audit_logs (id, org_id, user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?1, ?2, ?3, 'discovery.source_disabled', 'onion_source', ?4, '{}', ?5)`).bind(crypto.randomUUID(), auth.orgId, auth.userId, id, new Date().toISOString()).run();
  return true;
}

async function remainingBudget(env: Env): Promise<number> {
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  await env.DB.prepare(`INSERT OR IGNORE INTO crawl_budget (day, pages_fetched, bytes_fetched, updated_at) VALUES (?1, 0, 0, ?2)`).bind(day, now).run();
  const row = await env.DB.prepare(`SELECT pages_fetched FROM crawl_budget WHERE day = ?1 LIMIT 1`).bind(day).first<{ pages_fetched: number }>();
  return Math.max(0, dailyBudget(env) - Number(row?.pages_fetched ?? 0));
}

async function recordBudget(env: Env, bodyBytes: number): Promise<void> {
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  await env.DB.prepare(`
    INSERT INTO crawl_budget (day, pages_fetched, bytes_fetched, updated_at)
    VALUES (?1, 1, ?2, ?3)
    ON CONFLICT(day) DO UPDATE SET
      pages_fetched = pages_fetched + 1,
      bytes_fetched = bytes_fetched + excluded.bytes_fetched,
      updated_at = excluded.updated_at
  `).bind(day, Math.max(0, Math.floor(bodyBytes)), now).run();
}

async function catalogCount(env: Env): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS total FROM onion_sources`).first<{ total: number }>();
  return Number(row?.total ?? 0);
}

async function upsertDiscoveredLinks(env: Env, parent: OnionSourceRow, links: string[]): Promise<void> {
  if (parent.depth >= maxDepth(env) || !links.length) return;
  let total = await catalogCount(env);
  const maximum = maxCatalogSources(env);
  const now = new Date().toISOString();
  const childDepth = parent.depth + 1;
  const childPriority = Math.max(1, parent.priority - 5);
  for (const raw of links.slice(0, intVar(env.CRAWL_MAX_DISCOVERED_LINKS, 20, 1, 50))) {
    if (total >= maximum) break;
    let childUrl: string;
    try { childUrl = normalizeOnionUrl(raw); }
    catch { continue; }
    if (childUrl === parent.onion_url) continue;
    await env.DB.prepare(`
      INSERT INTO onion_links (parent_source_id, child_url, first_seen_at, last_seen_at)
      VALUES (?1, ?2, ?3, ?3)
      ON CONFLICT(parent_source_id, child_url) DO UPDATE SET last_seen_at = excluded.last_seen_at
    `).bind(parent.id, childUrl, now).run();

    const id = crypto.randomUUID();
    const inserted = await env.DB.prepare(`
      INSERT OR IGNORE INTO onion_sources
        (id, onion_url, source_type, category, enabled, depth, priority, romania_score,
         discovered_from, first_seen_at, last_seen_at, next_crawl_at, failure_count)
      VALUES (?1, ?2, 'discovered', 'research', 1, ?3, ?4, 0, ?5, ?6, ?6, ?6, 0)
    `).bind(id, childUrl, childDepth, childPriority, parent.id, now).run();
    if ((inserted.meta.changes ?? 0) === 1) total += 1;
    else await env.DB.prepare(`UPDATE onion_sources SET last_seen_at = ?1 WHERE onion_url = ?2`).bind(now, childUrl).run();
  }
}

function refreshHours(env: Env, row: OnionSourceRow, roScore: number): number {
  if (row.source_type === "seed") return seedRefreshHours(env);
  if (env.MARKET_FOCUS?.toUpperCase() === "RO" && roScore >= 3) return Math.min(24, discoveredRefreshHours(env));
  return discoveredRefreshHours(env);
}

async function markFailure(env: Env, sourceId: string, error: unknown): Promise<void> {
  const row = await env.DB.prepare(`SELECT failure_count FROM onion_sources WHERE id = ?1 LIMIT 1`).bind(sourceId).first<{ failure_count: number }>();
  const failures = Math.max(0, Number(row?.failure_count ?? 0)) + 1;
  const backoffHours = Math.min(168, Math.max(2, 2 ** Math.min(6, failures)));
  const next = new Date(Date.now() + backoffHours * 3_600_000).toISOString();
  const message = error instanceof Error ? error.message.slice(0, 300) : "crawl failed";
  await env.DB.prepare(`UPDATE onion_sources SET failure_count = ?1, last_error = ?2, next_crawl_at = ?3 WHERE id = ?4`).bind(failures, message, next, sourceId).run();
}

async function crawlSource(env: Env, job: DiscoveryJob): Promise<void> {
  const row = await env.DB.prepare(`
    SELECT id, onion_url, label, source_type, category, enabled, depth, priority, romania_score,
           discovered_from, first_seen_at, last_seen_at, last_crawled_at, next_crawl_at,
           failure_count, last_error, content_sha256
    FROM onion_sources WHERE id = ?1 LIMIT 1
  `).bind(job.sourceId).first<OnionSourceRow>();
  if (!row || row.enabled !== 1) return;
  if (row.depth > maxDepth(env)) return;
  if ((await remainingBudget(env)) <= 0) return;

  const collector = getContainer<TorCollector>(env.TOR_COLLECTOR, TOR_COLLECTOR_ID);
  const raw = (await collector.runRequest("/scrape", { urls: [row.onion_url] })) as ScrapeResponse;
  const source = Array.isArray(raw.sources) ? raw.sources[0] : undefined;
  if (!source) throw new Error("Collector returned no crawlable text for source");

  const now = new Date().toISOString();
  const title = source.title?.slice(0, 300) ?? "";
  const excerpt = source.text.slice(0, maxIndexChars(env));
  const roScore = romanianScore(title, excerpt, source.url);
  const pageId = row.id;
  const nextCrawl = new Date(Date.now() + refreshHours(env, row, roScore) * 3_600_000).toISOString();
  const bodyBytes = Math.max(0, Number(source.bodyBytes ?? new TextEncoder().encode(source.text).byteLength));

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO onion_pages (id, source_id, onion_url, title, text_excerpt, content_sha256, fetched_at, romania_score)
      VALUES (?1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ON CONFLICT(source_id) DO UPDATE SET
        onion_url = excluded.onion_url,
        title = excluded.title,
        text_excerpt = excluded.text_excerpt,
        content_sha256 = excluded.content_sha256,
        fetched_at = excluded.fetched_at,
        romania_score = excluded.romania_score
    `).bind(pageId, source.url, title, excerpt, source.sha256, source.fetchedAt || now, roScore),
    env.DB.prepare(`UPDATE onion_sources SET onion_url = ?1, romania_score = ?2, last_seen_at = ?3, last_crawled_at = ?3, next_crawl_at = ?4, failure_count = 0, last_error = NULL, content_sha256 = ?5 WHERE id = ?6`).bind(source.url, roScore, now, nextCrawl, source.sha256, row.id),
  ]);
  await env.DB.prepare(`DELETE FROM onion_pages_fts WHERE page_id = ?1`).bind(pageId).run();
  await env.DB.prepare(`INSERT INTO onion_pages_fts (page_id, title, text_excerpt) VALUES (?1, ?2, ?3)`).bind(pageId, title, excerpt).run();
  await recordBudget(env, bodyBytes);
  await upsertDiscoveredLinks(env, row, Array.isArray(source.discoveredOnionUrls) ? source.discoveredOnionUrls : []);
}

export async function enqueueDueDiscovery(env: Env, forceSeeds = false): Promise<number> {
  const remaining = await remainingBudget(env);
  if (remaining <= 0) return 0;
  const now = new Date().toISOString();
  const limit = Math.min(10, remaining);
  const condition = forceSeeds ? "source_type = 'seed'" : "next_crawl_at <= ?1";
  const statement = forceSeeds
    ? env.DB.prepare(`SELECT id, onion_url, depth FROM onion_sources WHERE enabled = 1 AND ${condition} AND depth <= ?1 ORDER BY priority DESC, romania_score DESC, COALESCE(last_crawled_at, '') ASC LIMIT ?2`).bind(maxDepth(env), limit)
    : env.DB.prepare(`SELECT id, onion_url, depth FROM onion_sources WHERE enabled = 1 AND ${condition} AND depth <= ?2 ORDER BY priority DESC, romania_score DESC, next_crawl_at ASC LIMIT ?3`).bind(now, maxDepth(env), limit);
  const due = await statement.all<{ id: string; onion_url: string; depth: number }>();
  let queued = 0;
  for (const row of due.results) {
    const holdUntil = new Date(Date.now() + 30 * 60_000).toISOString();
    const claimed = await env.DB.prepare(`UPDATE onion_sources SET next_crawl_at = ?1 WHERE id = ?2 AND enabled = 1`).bind(holdUntil, row.id).run();
    if ((claimed.meta.changes ?? 0) !== 1) continue;
    const job: DiscoveryJob = { type: "discovery.crawl", sourceId: row.id, url: row.onion_url, depth: row.depth };
    await env.DISCOVERY.send(job);
    queued += 1;
  }
  return queued;
}

export async function consumeDiscovery(batch: MessageBatch<DiscoveryJob>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body;
    if (!job || job.type !== "discovery.crawl" || !job.sourceId || !job.url) {
      message.ack();
      continue;
    }
    try {
      await crawlSource(env, job);
      message.ack();
    } catch (error) {
      await markFailure(env, job.sourceId, error).catch(() => undefined);
      message.retry({ delaySeconds: 300 });
    }
  }
}
