import { authenticate } from "./auth";
import { track } from "./analytics";
import { createBillingPortal, createCheckout, getBillingState, handleStripeWebhook } from "./billing";
import { correlateIntelligence } from "./correlation";
import {
  consumeInvestigationQuota,
  createInvestigation,
  deleteInvestigationRecords,
  getInvestigation,
  getInvestigationDeletionTargets,
  getPlan,
  getUsage,
  listInvestigationArtifacts,
  listInvestigations,
  listInvestigationSources,
  markStatus,
  refundInvestigationQuota,
} from "./db";
import { InvestigationWorkflow } from "./workflow";
import { browserMarkdown, validateClearWebUrl } from "./enrichment";
import { consumeNotifications } from "./notifications";
import { TorCollector } from "./container";
import { HttpError, json, normalizeQuery, readJson, safeId, withSecurityHeaders } from "./security";
import type { Env, InvestigationRequest, InvestigationWorkflowPayload, Plan } from "./types";

export { InvestigationWorkflow, TorCollector };

async function enforceRateLimit(env: Env, orgId: string, plan: Plan): Promise<void> {
  const limiter = plan === "free" ? env.FREE_RATE_LIMITER : env.PAID_RATE_LIMITER;
  const { success } = await limiter.limit({ key: `${orgId}:api` });
  if (!success) throw new HttpError(429, "Rate limit exceeded");
}

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new HttpError(400, "Invalid pagination value");
  return Math.max(minimum, Math.min(maximum, parsed));
}

async function ensureInvestigation(env: Env, orgId: string, id: string) {
  const investigation = await getInvestigation(env, orgId, id);
  if (!investigation) throw new HttpError(404, "Investigation not found");
  return investigation as Record<string, unknown>;
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/health") {
    return json({ ok: true, service: env.APP_NAME, version: env.CF_VERSION_METADATA.id, time: new Date().toISOString() });
  }
  if (request.method === "POST" && url.pathname === "/api/stripe/webhook") {
    return handleStripeWebhook(request, env);
  }

  const auth = await authenticate(request, env);
  const plan = await getPlan(env, auth.orgId);
  await enforceRateLimit(env, auth.orgId, plan);

  if (request.method === "GET" && url.pathname === "/api/me") {
    const usage = await getUsage(env, auth.orgId, plan);
    return json({ userId: auth.userId, orgId: auth.orgId, orgRole: auth.orgRole ?? null, plan, usage });
  }

  if (request.method === "GET" && url.pathname === "/api/usage") {
    return json(await getUsage(env, auth.orgId, plan));
  }

  if (request.method === "GET" && url.pathname === "/api/billing") {
    return json(await getBillingState(env, auth.orgId));
  }

  if (request.method === "POST" && url.pathname === "/api/billing/checkout") {
    const body = await readJson<{ plan?: unknown }>(request, 2_048);
    const session = await createCheckout(env, auth, body.plan);
    track(env, "billing_checkout_created", auth.orgId, plan);
    return json(session, 201);
  }

  if (request.method === "POST" && url.pathname === "/api/billing/portal") {
    const portal = await createBillingPortal(env, auth);
    track(env, "billing_portal_created", auth.orgId, plan);
    return json(portal, 201);
  }

  if (request.method === "POST" && url.pathname === "/api/enrichment/clearweb") {
    if (plan === "free") throw new HttpError(403, "Clear-web enrichment requires a paid plan");
    const body = await readJson<{ url?: unknown }>(request, 4_096);
    const target = validateClearWebUrl(body.url, env);
    const markdown = await browserMarkdown(env, target);
    track(env, "browser_enrichment", auth.orgId, plan, [markdown.length]);
    return json({ url: target, markdown });
  }

  if (request.method === "POST" && url.pathname === "/api/intelligence/correlate") {
    if (plan === "free") throw new HttpError(403, "Intelligence correlation requires a paid plan");
    const body = await readJson<{ query?: unknown; topK?: unknown }>(request, 8_192);
    const result = await correlateIntelligence(env, auth.orgId, body.query, body.topK);
    track(env, "intelligence_correlation", auth.orgId, plan, [result.matches.length]);
    return json(result);
  }

  if (request.method === "GET" && url.pathname === "/api/investigations") {
    const limit = boundedInteger(url.searchParams.get("limit"), 25, 1, 50);
    const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 5_000);
    const items = await listInvestigations(env, auth.orgId, limit, offset);
    return json({ items, pagination: { limit, offset, nextOffset: items.length === limit ? offset + limit : null } });
  }

  if (request.method === "POST" && url.pathname === "/api/investigations") {
    const body = await readJson<InvestigationRequest>(request, 8_192);
    const query = normalizeQuery(body.query, Number(env.MAX_QUERY_CHARS) || 300);
    const requestedProfile = body.profile ?? "general";
    const profile: NonNullable<InvestigationRequest["profile"]> = ["general", "identity", "corporate", "ransomware"].includes(requestedProfile) ? requestedProfile : "general";
    const featureEnabled = await env.FLAGS.getBooleanValue("investigations", true, { targetingKey: auth.orgId, plan, userId: auth.userId });
    if (!featureEnabled) throw new HttpError(503, "Investigations are temporarily unavailable");

    const quota = await consumeInvestigationQuota(env, auth.orgId, plan);
    let id: string | undefined;
    try {
      id = await createInvestigation(env, auth, { query, profile });
      const payload: InvestigationWorkflowPayload = { investigationId: id, orgId: auth.orgId, userId: auth.userId, query, profile };
      await env.INVESTIGATION_WORKFLOW.create({ id, params: payload });
    } catch (error) {
      await refundInvestigationQuota(env, auth.orgId).catch(() => undefined);
      if (id) await markStatus(env, id, auth.orgId, "failed", "Workflow could not be started").catch(() => undefined);
      throw error;
    }
    track(env, "investigation_created", auth.orgId, plan, [query.length, quota.used, quota.limit]);
    return json({ id, status: "queued", quota }, 202);
  }

  const sourcesMatch = url.pathname.match(/^\/api\/investigations\/([a-zA-Z0-9_-]{8,96})\/sources$/);
  if (request.method === "GET" && sourcesMatch?.[1]) {
    const id = sourcesMatch[1];
    if (!safeId(id)) throw new HttpError(400, "Invalid investigation id");
    await ensureInvestigation(env, auth.orgId, id);
    return json({ items: await listInvestigationSources(env, auth.orgId, id) });
  }

  const artifactsMatch = url.pathname.match(/^\/api\/investigations\/([a-zA-Z0-9_-]{8,96})\/artifacts$/);
  if (request.method === "GET" && artifactsMatch?.[1]) {
    const id = artifactsMatch[1];
    if (!safeId(id)) throw new HttpError(400, "Invalid investigation id");
    await ensureInvestigation(env, auth.orgId, id);
    return json({ items: await listInvestigationArtifacts(env, auth.orgId, id) });
  }

  const match = url.pathname.match(/^\/api\/investigations\/([a-zA-Z0-9_-]{8,96})$/);
  if (match?.[1]) {
    const id = match[1];
    if (!safeId(id)) throw new HttpError(400, "Invalid investigation id");

    if (request.method === "GET") {
      return json(await ensureInvestigation(env, auth.orgId, id));
    }

    if (request.method === "DELETE") {
      const investigation = await ensureInvestigation(env, auth.orgId, id);
      if (["queued", "running"].includes(String(investigation.status))) throw new HttpError(409, "Running investigations cannot be deleted");
      const targets = await getInvestigationDeletionTargets(env, auth.orgId, id);
      for (const key of targets.objectKeys) await env.EVIDENCE.delete(key);
      if (targets.sourceIds.length) await env.INTELLIGENCE_INDEX.deleteByIds(targets.sourceIds);
      const deleted = await deleteInvestigationRecords(env, auth, id);
      if (!deleted) throw new HttpError(404, "Investigation not found");
      track(env, "investigation_deleted", auth.orgId, plan, [targets.objectKeys.length, targets.sourceIds.length]);
      return new Response(null, { status: 204 });
    }
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error("request_failed", error instanceof Error ? error.name : "unknown");
      return json({ error: "Internal server error" }, 500);
    }
  },
  async queue(batch: MessageBatch<import("./types").NotificationJob>, env: Env): Promise<void> {
    await consumeNotifications(batch, env);
  },
} satisfies ExportedHandler<Env>;
