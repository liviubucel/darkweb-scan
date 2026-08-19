import type { Env } from "./types";
import { HttpError, normalizeQuery } from "./security";

interface EmbeddingResponse { data?: number[][] }

export async function correlateIntelligence(env: Env, orgId: string, rawQuery: unknown, rawTopK: unknown): Promise<{ query: string; matches: Array<{ id: string; score: number; metadata: Record<string, unknown> | null }> }> {
  const query = normalizeQuery(rawQuery, 1_000);
  const requested = typeof rawTopK === "number" ? rawTopK : Number(rawTopK ?? 10);
  const topK = Number.isFinite(requested) ? Math.max(1, Math.min(20, Math.floor(requested))) : 10;

  const embedding = (await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [query], pooling: "cls" })) as EmbeddingResponse;
  const values = embedding.data?.[0];
  if (!values || values.length !== 768) throw new HttpError(502, "Could not create intelligence embedding");

  const result = await env.INTELLIGENCE_INDEX.query(values, {
    topK,
    namespace: orgId,
    returnMetadata: "all",
  });

  const matches = (result.matches ?? []).map((match) => ({
    id: match.id,
    score: match.score,
    metadata: match.metadata ? { ...match.metadata } : null,
  }));

  return { query, matches };
}
