import type { AuthContext, Env, InvestigationRequest, Plan } from "./types";
import { HttpError } from "./security";

export async function getPlan(env: Env, orgId: string): Promise<Plan> {
  const row = await env.DB.prepare("SELECT plan, status FROM subscriptions WHERE org_id = ?1 LIMIT 1").bind(orgId).first<{ plan: Plan; status: string }>();
  if (!row || !["active", "trialing"].includes(row.status)) return "free";
  return row.plan;
}

function monthlyPeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

function investigationLimit(env: Env, plan: Plan): number {
  const configured: Record<Plan, string> = {
    free: env.PLAN_FREE_INVESTIGATIONS,
    pro: env.PLAN_PRO_INVESTIGATIONS,
    business: env.PLAN_BUSINESS_INVESTIGATIONS,
    enterprise: env.PLAN_ENTERPRISE_INVESTIGATIONS,
  };
  const parsed = Number(configured[plan]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export async function consumeInvestigationQuota(env: Env, orgId: string, plan: Plan): Promise<{ used: number; limit: number; period: string }> {
  const period = monthlyPeriod();
  const limit = investigationLimit(env, plan);
  await env.DB.prepare(`INSERT OR IGNORE INTO usage (org_id, period, investigations) VALUES (?1, ?2, 0)`).bind(orgId, period).run();
  const result = await env.DB.prepare(`UPDATE usage SET investigations = investigations + 1 WHERE org_id = ?1 AND period = ?2 AND investigations < ?3`).bind(orgId, period, limit).run();
  if ((result.meta.changes ?? 0) !== 1) throw new HttpError(429, "Monthly investigation quota reached");
  const row = await env.DB.prepare(`SELECT investigations FROM usage WHERE org_id = ?1 AND period = ?2`).bind(orgId, period).first<{ investigations: number }>();
  return { used: row?.investigations ?? limit, limit, period };
}

export async function refundInvestigationQuota(env: Env, orgId: string): Promise<void> {
  const period = monthlyPeriod();
  await env.DB.prepare(`UPDATE usage SET investigations = CASE WHEN investigations > 0 THEN investigations - 1 ELSE 0 END WHERE org_id = ?1 AND period = ?2`).bind(orgId, period).run();
}

export async function getUsage(env: Env, orgId: string, plan: Plan): Promise<{ period: string; investigations: number; limit: number; remaining: number }> {
  const period = monthlyPeriod();
  const limit = investigationLimit(env, plan);
  const row = await env.DB.prepare(`SELECT investigations FROM usage WHERE org_id = ?1 AND period = ?2`).bind(orgId, period).first<{ investigations: number }>();
  const investigations = row?.investigations ?? 0;
  return { period, investigations, limit, remaining: Math.max(0, limit - investigations) };
}

export async function createInvestigation(env: Env, auth: AuthContext, input: InvestigationRequest): Promise<string> {
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO investigations (id, org_id, user_id, query, profile, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 'queued', ?6, ?6)`).bind(id, auth.orgId, auth.userId, input.query, input.profile ?? "general", now).run();
  return id;
}

export async function listInvestigations(env: Env, orgId: string, limit: number, offset: number) {
  const result = await env.DB.prepare(`SELECT id, query, profile, status, risk_level, source_count, created_at, updated_at, completed_at FROM investigations WHERE org_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2 OFFSET ?3`).bind(orgId, limit, offset).all();
  return result.results;
}

export async function getInvestigation(env: Env, orgId: string, id: string) {
  return env.DB.prepare(`SELECT id, query, profile, status, risk_level, summary, source_count, error_message, created_at, updated_at, completed_at FROM investigations WHERE id = ?1 AND org_id = ?2`).bind(id, orgId).first();
}

export async function listInvestigationSources(env: Env, orgId: string, investigationId: string) {
  const result = await env.DB.prepare(`SELECT id, ordinal, title, onion_url, content_sha256, fetched_at FROM investigation_sources WHERE investigation_id = ?1 AND org_id = ?2 ORDER BY ordinal ASC`).bind(investigationId, orgId).all();
  return result.results;
}

export async function listInvestigationArtifacts(env: Env, orgId: string, investigationId: string) {
  const result = await env.DB.prepare(`SELECT id, type, value, source_id, created_at FROM artifacts WHERE investigation_id = ?1 AND org_id = ?2 ORDER BY type ASC, value ASC LIMIT 1000`).bind(investigationId, orgId).all();
  return result.results;
}

export async function getInvestigationDeletionTargets(env: Env, orgId: string, investigationId: string): Promise<{ sourceIds: string[]; objectKeys: string[] }> {
  const [sources, reports] = await env.DB.batch([
    env.DB.prepare(`SELECT id, r2_key FROM investigation_sources WHERE investigation_id = ?1 AND org_id = ?2`).bind(investigationId, orgId),
    env.DB.prepare(`SELECT r2_key FROM reports WHERE investigation_id = ?1 AND org_id = ?2`).bind(investigationId, orgId),
  ]);
  const sourceRows = (sources.results ?? []) as Array<{ id?: unknown; r2_key?: unknown }>;
  const reportRows = (reports.results ?? []) as Array<{ r2_key?: unknown }>;
  const sourceIds = sourceRows.map((row) => typeof row.id === "string" ? row.id : "").filter(Boolean);
  const objectKeys = [...sourceRows, ...reportRows].map((row) => typeof row.r2_key === "string" ? row.r2_key : "").filter(Boolean);
  return { sourceIds, objectKeys };
}

export async function deleteInvestigationRecords(env: Env, auth: AuthContext, investigationId: string): Promise<boolean> {
  const exists = await env.DB.prepare(`SELECT id FROM investigations WHERE id = ?1 AND org_id = ?2 LIMIT 1`).bind(investigationId, auth.orgId).first();
  if (!exists) return false;
  const auditId = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM artifacts WHERE investigation_id = ?1 AND org_id = ?2`).bind(investigationId, auth.orgId),
    env.DB.prepare(`DELETE FROM investigation_sources WHERE investigation_id = ?1 AND org_id = ?2`).bind(investigationId, auth.orgId),
    env.DB.prepare(`DELETE FROM reports WHERE investigation_id = ?1 AND org_id = ?2`).bind(investigationId, auth.orgId),
    env.DB.prepare(`DELETE FROM alerts WHERE investigation_id = ?1 AND org_id = ?2`).bind(investigationId, auth.orgId),
    env.DB.prepare(`DELETE FROM investigations WHERE id = ?1 AND org_id = ?2`).bind(investigationId, auth.orgId),
    env.DB.prepare(`INSERT INTO audit_logs (id, org_id, user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?1, ?2, ?3, 'investigation.deleted', 'investigation', ?4, '{}', ?5)`).bind(auditId, auth.orgId, auth.userId, investigationId, now),
  ]);
  return true;
}

export async function markStatus(env: Env, id: string, orgId: string, status: string, error?: string): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE investigations SET status = ?1, error_message = ?2, updated_at = ?3 WHERE id = ?4 AND org_id = ?5`).bind(status, error ?? null, now, id, orgId).run();
}
