import { tenantNamespace } from "./intelligence";
import type { Env } from "./types";
import { HttpError, normalizeQuery } from "./security";

interface EmbeddingResponse { data?: number[][] }

function embeddingQuery(value: string): string {
  return value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 220).join(" ").slice(0, 1_600);
}

export async function correlateIntelligence(env: Env, orgId: string, rawQuery: unknown, rawTopK: unknown): Promise<{ query: string; matches: Array<{ id: string; score: number; metadata: Record<string, unknown> | null }> }> {
  if (!env.INTELLIGENCE_INDEX) throw new HttpError(503, "Intelligence correlation is not configured yet");
  const query = normalizeQuery(rawQuery, 1_000);
  const requested = typeof rawTopK === "number" ? rawTopK : Number(rawTopK ?? 10);
  const topK = Number.isFinite(requested) ? Math.max(1, Math.min(20, Math.floor(requested))) : 10;

  const input = embeddingQuery(query);
  const embedding = (await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [input], pooling: "cls" })) as EmbeddingResponse;
  const values = embedding.data?.[0];
  if (!values || values.length !== 768) throw new HttpError(502, "Could not create intelligence embedding");

  const result = await env.INTELLIGENCE_INDEX.query(values, {
    topK,
    namespace: await tenantNamespace(orgId),
    returnMetadata: "all",
  });

  const matches = (result.matches ?? []).map((match) => ({
    id: match.id,
    score: match.score,
    metadata: match.metadata ? { ...match.metadata } : null,
  }));

  return { query, matches };
}
