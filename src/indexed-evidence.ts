import type { Env, ScrapedSource } from "./types";

interface IndexedRow {
  onion_url: string;
  title: string | null;
  text_excerpt: string;
  content_sha256: string;
  fetched_at: string;
}

export async function loadIndexedEvidence(env: Env, urls: string[], limit = 12): Promise<ScrapedSource[]> {
  const unique = [...new Set(urls)].slice(0, Math.max(1, Math.min(12, limit)));
  if (!unique.length) return [];
  const statements = unique.map((url) => env.DB.prepare(`
    SELECT onion_url, title, text_excerpt, content_sha256, fetched_at
    FROM onion_pages
    WHERE onion_url = ?1
    LIMIT 1
  `).bind(url));
  const results = await env.DB.batch(statements);
  const sources: ScrapedSource[] = [];
  for (const result of results) {
    const row = (result.results?.[0] ?? null) as IndexedRow | null;
    if (!row) continue;
    sources.push({
      url: row.onion_url,
      title: row.title ?? "Indexed onion source",
      text: row.text_excerpt,
      contentType: "text/plain",
      fetchedAt: row.fetched_at,
      sha256: row.content_sha256,
    });
  }
  return sources;
}
