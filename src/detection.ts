import type { Env } from "./types";

export interface MonitoringDelta {
  isMonitoring: boolean;
  hasBaseline: boolean;
  previousInvestigationId: string | null;
  newArtifactCount: number;
  newSourceCount: number;
  hasNewExposure: boolean;
}

interface InvestigationLineage {
  origin: string;
  watchlist_id: string | null;
  created_at: string;
}

export async function detectMonitoringDelta(env: Env, orgId: string, investigationId: string): Promise<MonitoringDelta> {
  const current = await env.DB.prepare(`SELECT origin, watchlist_id, created_at FROM investigations WHERE id = ?1 AND org_id = ?2 LIMIT 1`).bind(investigationId, orgId).first<InvestigationLineage>();
  if (!current || current.origin !== "monitoring" || !current.watchlist_id) {
    return { isMonitoring: false, hasBaseline: false, previousInvestigationId: null, newArtifactCount: 0, newSourceCount: 0, hasNewExposure: false };
  }

  const previous = await env.DB.prepare(`SELECT id FROM investigations WHERE org_id = ?1 AND watchlist_id = ?2 AND origin = 'monitoring' AND status = 'completed' AND id <> ?3 AND created_at < ?4 ORDER BY created_at DESC, id DESC LIMIT 1`).bind(orgId, current.watchlist_id, investigationId, current.created_at).first<{ id: string }>();

  if (!previous?.id) {
    return { isMonitoring: true, hasBaseline: false, previousInvestigationId: null, newArtifactCount: 0, newSourceCount: 0, hasNewExposure: false };
  }

  const [artifacts, sources] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS count FROM artifacts current WHERE current.investigation_id = ?1 AND current.org_id = ?2 AND NOT EXISTS (SELECT 1 FROM artifacts previous WHERE previous.investigation_id = ?3 AND previous.org_id = ?2 AND previous.type = current.type AND previous.value = current.value)`).bind(investigationId, orgId, previous.id),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM investigation_sources current WHERE current.investigation_id = ?1 AND current.org_id = ?2 AND NOT EXISTS (SELECT 1 FROM investigation_sources previous WHERE previous.investigation_id = ?3 AND previous.org_id = ?2 AND previous.content_sha256 = current.content_sha256)`).bind(investigationId, orgId, previous.id),
  ]);

  const artifactRow = (artifacts.results ?? [])[0] as { count?: unknown } | undefined;
  const sourceRow = (sources.results ?? [])[0] as { count?: unknown } | undefined;
  const newArtifactCount = Number(artifactRow?.count ?? 0) || 0;
  const newSourceCount = Number(sourceRow?.count ?? 0) || 0;

  return {
    isMonitoring: true,
    hasBaseline: true,
    previousInvestigationId: previous.id,
    newArtifactCount,
    newSourceCount,
    hasNewExposure: newArtifactCount > 0 || newSourceCount > 0,
  };
}
