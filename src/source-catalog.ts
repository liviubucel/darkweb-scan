import { normalizeOnionUrl } from "./discovery";
import type { DiscoverySourceInput, Env, SecretBinding } from "./types";

interface PrivateCatalogItem extends DiscoverySourceInput {}

async function readSecret(binding: SecretBinding | undefined): Promise<string | undefined> {
  if (!binding) return undefined;
  if (typeof binding === "string") return binding;
  try { return await binding.get(); }
  catch { return undefined; }
}

function normalizeCatalogItem(value: unknown): PrivateCatalogItem | undefined {
  if (typeof value === "string") return { url: value, category: "research", priority: 50 };
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.url !== "string") return undefined;
  const category = row.category === "directory" || row.category === "research" || row.category === "disclosure" || row.category === "other"
    ? row.category
    : "research";
  const parsedPriority = Number(row.priority ?? 50);
  const priority = Number.isFinite(parsedPriority) ? Math.max(1, Math.min(100, Math.floor(parsedPriority))) : 50;
  const label = typeof row.label === "string" ? row.label.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120) : undefined;
  return { url: row.url, category, priority, ...(label ? { label } : {}) };
}

export async function bootstrapPrivateSourceCatalog(env: Env): Promise<{ configured: boolean; accepted: number; inserted: number }> {
  const raw = await readSecret(env.ZBT_INTERNAL_SOURCE_CATALOG);
  if (!raw?.trim()) return { configured: false, accepted: 0, inserted: 0 };

  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch {
    console.error("private_source_catalog_invalid_json");
    return { configured: true, accepted: 0, inserted: 0 };
  }
  if (!Array.isArray(parsed)) {
    console.error("private_source_catalog_not_array");
    return { configured: true, accepted: 0, inserted: 0 };
  }

  const now = new Date().toISOString();
  let accepted = 0;
  let inserted = 0;
  for (const rawItem of parsed.slice(0, 5_000)) {
    const item = normalizeCatalogItem(rawItem);
    if (!item) continue;
    let onionUrl: string;
    try { onionUrl = normalizeOnionUrl(item.url); }
    catch { continue; }
    accepted += 1;
    const id = crypto.randomUUID();
    const result = await env.DB.prepare(`
      INSERT OR IGNORE INTO onion_sources
        (id, onion_url, label, source_type, category, enabled, depth, priority, romania_score,
         first_seen_at, last_seen_at, next_crawl_at, failure_count)
      VALUES (?1, ?2, ?3, 'seed', ?4, 1, 0, ?5, 0, ?6, ?6, ?6, 0)
    `).bind(id, onionUrl, item.label ?? null, item.category ?? "research", item.priority ?? 50, now).run();
    if ((result.meta.changes ?? 0) === 1) inserted += 1;
    else {
      await env.DB.prepare(`
        UPDATE onion_sources
        SET enabled = 1,
            label = COALESCE(?1, label),
            category = ?2,
            priority = MAX(priority, ?3),
            last_seen_at = ?4
        WHERE onion_url = ?5
      `).bind(item.label ?? null, item.category ?? "research", item.priority ?? 50, now, onionUrl).run();
    }
  }
  return { configured: true, accepted, inserted };
}
