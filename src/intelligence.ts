import type { Env, ScrapedSource } from "./types";

async function tenantPrefix(orgId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(orgId));
  const bytes = new Uint8Array(digest); let binary = "";
  for (const byte of bytes.slice(0, 16)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function persistEvidence(env: Env, orgId: string, investigationId: string, sourceId: string, source: ScrapedSource): Promise<string> {
  const prefix = await tenantPrefix(orgId);
  const key = `evidence/${prefix}/${investigationId}/${sourceId}.json`;
  await env.EVIDENCE.put(key, JSON.stringify({ version: 1, investigationId, sourceId, title: source.title, onionUrl: source.url, text: source.text, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }), {
    httpMetadata: { contentType: "application/json" }, customMetadata: { investigationId, sourceId, contentSha256: source.sha256 },
  });
  return key;
}

export async function indexSource(env: Env, orgId: string, investigationId: string, sourceId: string, source: ScrapedSource): Promise<void> {
  if (!env.INTELLIGENCE_INDEX) return;
  const text = `${source.title}\n${source.text}`.slice(0, 12_000);
  const embedding = (await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [text], pooling: "cls" })) as { data?: number[][] };
  const values = embedding.data?.[0]; if (!values || values.length !== 768) return;
  await env.INTELLIGENCE_INDEX.upsert([{ id: sourceId, namespace: orgId, values, metadata: { investigationId, sourceId, fetchedAt: source.fetchedAt } }]);
}
