import { consumeInvestigationQuota, getPlan, markStatus, refundInvestigationQuota } from "./db";
import { track } from "./analytics";
import { HttpError } from "./security";
import type { AuthContext, Env, InvestigationProfile, InvestigationWorkflowPayload, MonitoringJob, Plan, WatchlistInput, WatchlistType } from "./types";

interface WatchlistRow {
  id: string;
  org_id: string;
  created_by: string;
  type: WatchlistType;
  value: string;
  profile: InvestigationProfile;
  interval_hours: number;
  active: number;
  last_run_at: string | null;
  last_investigation_id: string | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

const MIN_INTERVAL_HOURS: Record<Exclude<Plan, "free">, number> = {
  pro: 24,
  business: 6,
  enterprise: 1,
};

function defaultProfile(type: WatchlistType): InvestigationProfile {
  if (type === "email" || type === "person") return "identity";
  if (type === "domain" || type === "brand") return "corporate";
  return "general";
}

function normalizeWatchValue(type: WatchlistType, raw: unknown): string {
  if (typeof raw !== "string") throw new HttpError(400, "watchlist value must be a string");
  const value = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (value.length < 2 || value.length > 200) throw new HttpError(400, "watchlist value has an invalid length");

  if (type === "email") {
    const normalized = value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,63}$/.test(normalized)) throw new HttpError(400, "invalid email watchlist value");
    return normalized;
  }

  if (type === "domain") {
    const normalized = value.toLowerCase().replace(/\.$/, "");
    if (normalized.endsWith(".onion") || normalized.includes("://")) throw new HttpError(400, "watch a registered clear-web domain, not a URL or onion service");
    if (normalized.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized)) throw new HttpError(400, "invalid domain watchlist value");
    return normalized;
  }

  return value;
}

function normalizedType(raw: unknown): WatchlistType {
  if (raw === "domain" || raw === "email" || raw === "brand" || raw === "person" || raw === "keyword") return raw;
  throw new HttpError(400, "unsupported watchlist type");
}

function intervalForPlan(plan: Plan, requested: unknown): number {
  if (plan === "free") throw new HttpError(403, "Continuous monitoring requires a paid plan");
  const minimum = MIN_INTERVAL_HOURS[plan];
  const numeric = typeof requested === "number" ? requested : Number(requested ?? minimum);
  if (!Number.isFinite(numeric)) throw new HttpError(400, "invalid monitoring interval");
  return Math.max(minimum, Math.min(720, Math.floor(numeric)));
}

function nextDate(from: string | Date, intervalHours: number): string {
  const base = from instanceof Date ? from.getTime() : Date.parse(from);
  const safeBase = Number.isFinite(base) ? Math.max(base, Date.now()) : Date.now();
  return new Date(safeBase + intervalHours * 3_600_000).toISOString();
}

function queryForWatchlist(row: Pick<WatchlistRow, "type" | "value">): string {
  if (row.type === "domain") return `"${row.value}"`;
  if (row.type === "email") return `"${row.value}"`;
  return row.value;
}

export async function createWatchlist(env: Env, auth: AuthContext, plan: Plan, input: WatchlistInput): Promise<WatchlistRow> {
  const type = normalizedType(input.type);
  const value = normalizeWatchValue(type, input.value);
  const intervalHours = intervalForPlan(plan, input.intervalHours);
  const profile = input.profile && ["general", "identity", "corporate", "ransomware"].includes(input.profile) ? input.profile : defaultProfile(type);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(`INSERT INTO watchlists (id, org_id, created_by, type, value, profile, interval_hours, active, next_run_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?8, ?8)`).bind(id, auth.orgId, auth.userId, type, value, profile, intervalHours, now).run();
  } catch {
    throw new HttpError(409, "This watchlist already exists");
  }

  const row = await env.DB.prepare(`SELECT * FROM watchlists WHERE id = ?1 AND org_id = ?2`).bind(id, auth.orgId).first<WatchlistRow>();
  if (!row) throw new HttpError(500, "Could not create watchlist");
  return row;
}

export async function listWatchlists(env: Env, orgId: string): Promise<WatchlistRow[]> {
  const result = await env.DB.prepare(`SELECT id, org_id, created_by, type, value, profile, interval_hours, active, last_run_at, last_investigation_id, next_run_at, created_at, updated_at FROM watchlists WHERE org_id = ?1 ORDER BY created_at DESC`).bind(orgId).all<WatchlistRow>();
  return result.results;
}

export async function deleteWatchlist(env: Env, auth: AuthContext, id: string): Promise<boolean> {
  const result = await env.DB.prepare(`DELETE FROM watchlists WHERE id = ?1 AND org_id = ?2`).bind(id, auth.orgId).run();
  if ((result.meta.changes ?? 0) !== 1) return false;
  await env.DB.prepare(`INSERT INTO audit_logs (id, org_id, user_id, action, target_type, target_id, metadata_json, created_at) VALUES (?1, ?2, ?3, 'watchlist.deleted', 'watchlist', ?4, '{}', ?5)`).bind(crypto.randomUUID(), auth.orgId, auth.userId, id, new Date().toISOString()).run();
  return true;
}

async function sendMonitoringJob(env: Env, job: MonitoringJob): Promise<void> {
  await env.MONITORING.send(job);
}

export async function enqueueDueMonitoring(env: Env): Promise<void> {
  const now = new Date().toISOString();

  const queued = await env.DB.prepare(`SELECT payload_json FROM jobs WHERE type = 'monitoring.run' AND status = 'queued' ORDER BY created_at ASC LIMIT 50`).all<{ payload_json: string | null }>();
  for (const row of queued.results) {
    if (!row.payload_json) continue;
    try {
      const job = JSON.parse(row.payload_json) as MonitoringJob;
      if (job.type === "monitoring.run" && job.runId && job.watchlistId && job.orgId) await sendMonitoringJob(env, job);
    } catch {
      // Malformed internal jobs are ignored and can be inspected through audit/ops tooling.
    }
  }

  const due = await env.DB.prepare(`SELECT id, org_id, created_by, type, value, profile, interval_hours, active, last_run_at, last_investigation_id, next_run_at, created_at, updated_at FROM watchlists WHERE active = 1 AND next_run_at <= ?1 ORDER BY next_run_at ASC LIMIT 50`).bind(now).all<WatchlistRow>();

  for (const row of due.results) {
    const runId = `${row.id}:${row.next_run_at}`;
    const job: MonitoringJob = { type: "monitoring.run", runId, watchlistId: row.id, orgId: row.org_id };
    const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO jobs (id, org_id, type, status, payload_json, created_at, updated_at) VALUES (?1, ?2, 'monitoring.run', 'queued', ?3, ?4, ?4)`).bind(runId, row.org_id, JSON.stringify(job), now).run();
    if ((inserted.meta.changes ?? 0) === 1) await sendMonitoringJob(env, job);
    await env.DB.prepare(`UPDATE watchlists SET next_run_at = ?1, updated_at = ?2 WHERE id = ?3 AND org_id = ?4`).bind(nextDate(row.next_run_at, row.interval_hours), now, row.id, row.org_id).run();
  }
}

async function claimJob(env: Env, runId: string): Promise<"claimed" | "done" | "busy" | "missing"> {
  const existing = await env.DB.prepare(`SELECT status, updated_at FROM jobs WHERE id = ?1 AND type = 'monitoring.run' LIMIT 1`).bind(runId).first<{ status: string; updated_at: string }>();
  if (!existing) return "missing";
  if (["completed", "skipped", "quota_exhausted"].includes(existing.status)) return "done";
  const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString();
  const result = await env.DB.prepare(`UPDATE jobs SET status = 'processing', updated_at = ?1 WHERE id = ?2 AND type = 'monitoring.run' AND (status = 'queued' OR (status = 'processing' AND updated_at < ?3))`).bind(new Date().toISOString(), runId, staleBefore).run();
  return (result.meta.changes ?? 0) === 1 ? "claimed" : "busy";
}

function nextMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 1, 0, 0)).toISOString();
}

export async function consumeMonitoring(batch: MessageBatch<MonitoringJob>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body;
    if (!job || job.type !== "monitoring.run" || !job.runId || !job.watchlistId || !job.orgId) {
      message.ack();
      continue;
    }

    const claim = await claimJob(env, job.runId);
    if (claim === "done" || claim === "missing") { message.ack(); continue; }
    if (claim === "busy") { message.retry({ delaySeconds: 60 }); continue; }

    try {
      const row = await env.DB.prepare(`SELECT id, org_id, created_by, type, value, profile, interval_hours, active, last_run_at, last_investigation_id, next_run_at, created_at, updated_at FROM watchlists WHERE id = ?1 AND org_id = ?2 LIMIT 1`).bind(job.watchlistId, job.orgId).first<WatchlistRow>();
      if (!row || row.active !== 1) {
        await env.DB.prepare(`UPDATE jobs SET status = 'skipped', updated_at = ?1 WHERE id = ?2`).bind(new Date().toISOString(), job.runId).run();
        message.ack();
        continue;
      }

      const plan = await getPlan(env, row.org_id);
      if (plan === "free") {
        await env.DB.batch([
          env.DB.prepare(`UPDATE watchlists SET active = 0, updated_at = ?1 WHERE id = ?2 AND org_id = ?3`).bind(new Date().toISOString(), row.id, row.org_id),
          env.DB.prepare(`UPDATE jobs SET status = 'skipped', updated_at = ?1 WHERE id = ?2`).bind(new Date().toISOString(), job.runId),
        ]);
        message.ack();
        continue;
      }

      try {
        await consumeInvestigationQuota(env, row.org_id, plan);
      } catch (error) {
        if (error instanceof HttpError && error.status === 429) {
          await env.DB.batch([
            env.DB.prepare(`UPDATE watchlists SET next_run_at = ?1, updated_at = ?2 WHERE id = ?3 AND org_id = ?4`).bind(nextMonth(), new Date().toISOString(), row.id, row.org_id),
            env.DB.prepare(`UPDATE jobs SET status = 'quota_exhausted', updated_at = ?1 WHERE id = ?2`).bind(new Date().toISOString(), job.runId),
          ]);
          message.ack();
          continue;
        }
        throw error;
      }

      const investigationId = crypto.randomUUID();
      const now = new Date().toISOString();
      const query = queryForWatchlist(row);
      await env.DB.prepare(`INSERT INTO investigations (id, org_id, user_id, query, profile, origin, watchlist_id, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 'monitoring', ?6, 'queued', ?7, ?7)`).bind(investigationId, row.org_id, row.created_by, query, row.profile, row.id, now).run();

      const payload: InvestigationWorkflowPayload = { investigationId, orgId: row.org_id, userId: row.created_by, query, profile: row.profile };
      try {
        await env.INVESTIGATION_WORKFLOW.create({ id: investigationId, params: payload });
      } catch (error) {
        await refundInvestigationQuota(env, row.org_id).catch(() => undefined);
        await markStatus(env, investigationId, row.org_id, "failed", "Monitoring workflow could not be started").catch(() => undefined);
        throw error;
      }

      await env.DB.batch([
        env.DB.prepare(`UPDATE watchlists SET last_run_at = ?1, last_investigation_id = ?2, updated_at = ?1 WHERE id = ?3 AND org_id = ?4`).bind(now, investigationId, row.id, row.org_id),
        env.DB.prepare(`UPDATE jobs SET status = 'completed', payload_json = ?1, updated_at = ?2 WHERE id = ?3`).bind(JSON.stringify({ ...job, investigationId }), now, job.runId),
      ]);
      track(env, "monitoring_investigation_created", row.org_id, plan, [row.interval_hours]);
      message.ack();
    } catch {
      await env.DB.prepare(`UPDATE jobs SET status = 'queued', updated_at = ?1 WHERE id = ?2`).bind(new Date().toISOString(), job.runId).run().catch(() => undefined);
      message.retry({ delaySeconds: 120 });
    }
  }
}
