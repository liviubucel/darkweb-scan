import type { Env } from "./types";

function retentionDays(env: Env): number {
  const parsed = Number(env.EVIDENCE_RETENTION_DAYS);
  if (!Number.isFinite(parsed)) return 90;
  return Math.max(1, Math.min(3650, Math.floor(parsed)));
}

export async function enforceEvidenceRetention(env: Env): Promise<{ evidenceDeleted: number; reportsDeleted: number }> {
  const cutoff = new Date(Date.now() - retentionDays(env) * 86_400_000).toISOString();

  const [sources, reports] = await env.DB.batch([
    env.DB.prepare(`SELECT id, r2_key FROM investigation_sources WHERE r2_key <> '' AND fetched_at < ?1 ORDER BY fetched_at ASC LIMIT 250`).bind(cutoff),
    env.DB.prepare(`SELECT id, r2_key FROM reports WHERE r2_key <> '' AND created_at < ?1 ORDER BY created_at ASC LIMIT 100`).bind(cutoff),
  ]);

  const sourceRows = (sources.results ?? []) as Array<{ id?: unknown; r2_key?: unknown }>;
  const reportRows = (reports.results ?? []) as Array<{ id?: unknown; r2_key?: unknown }>;
  const sourceTargets = sourceRows.filter((row): row is { id: string; r2_key: string } => typeof row.id === "string" && typeof row.r2_key === "string" && row.r2_key.length > 0);
  const reportTargets = reportRows.filter((row): row is { id: string; r2_key: string } => typeof row.id === "string" && typeof row.r2_key === "string" && row.r2_key.length > 0);

  const keys = [...sourceTargets.map((row) => row.r2_key), ...reportTargets.map((row) => row.r2_key)];
  if (keys.length) await env.EVIDENCE.delete(keys);

  const updates: D1PreparedStatement[] = [];
  for (const row of sourceTargets) updates.push(env.DB.prepare(`UPDATE investigation_sources SET r2_key = '' WHERE id = ?1 AND r2_key = ?2`).bind(row.id, row.r2_key));
  for (const row of reportTargets) updates.push(env.DB.prepare(`UPDATE reports SET r2_key = '' WHERE id = ?1 AND r2_key = ?2`).bind(row.id, row.r2_key));
  if (updates.length) await env.DB.batch(updates);

  return { evidenceDeleted: sourceTargets.length, reportsDeleted: reportTargets.length };
}
