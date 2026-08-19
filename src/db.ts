import type { AuthContext, Env, InvestigationRequest, Plan } from "./types";

export async function getPlan(env: Env, orgId: string): Promise<Plan> {
  const row = await env.DB.prepare("SELECT plan, status FROM subscriptions WHERE org_id = ?1 LIMIT 1").bind(orgId).first<{ plan: Plan; status: string }>();
  if (!row || !["active", "trialing"].includes(row.status)) return "free";
  return row.plan;
}

export async function createInvestigation(env: Env, auth: AuthContext, input: InvestigationRequest): Promise<string> {
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO investigations (id, org_id, user_id, query, profile, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 'queued', ?6, ?6)`).bind(id, auth.orgId, auth.userId, input.query, input.profile ?? "general", now).run();
  return id;
}

export async function getInvestigation(env: Env, orgId: string, id: string) {
  return env.DB.prepare(`SELECT id, query, profile, status, risk_level, summary, source_count, created_at, updated_at, completed_at FROM investigations WHERE id = ?1 AND org_id = ?2`).bind(id, orgId).first();
}

export async function markStatus(env: Env, id: string, orgId: string, status: string, error?: string): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE investigations SET status = ?1, error_message = ?2, updated_at = ?3 WHERE id = ?4 AND org_id = ?5`).bind(status, error ?? null, now, id, orgId).run();
}
