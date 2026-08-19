import { authenticate } from "./auth";
import { track } from "./analytics";
import { createBillingPortal, createCheckout, getBillingState, handleStripeWebhook } from "./billing";
import { consumeInvestigationQuota, createInvestigation, getInvestigation, getPlan, getUsage, markStatus, refundInvestigationQuota } from "./db";
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

  const match = url.pathname.match(/^\/api\/investigations\/([a-zA-Z0-9_-]{8,96})$/);
  if (request.method === "GET" && match?.[1]) {
    const id = match[1]; if (!safeId(id)) throw new HttpError(400, "Invalid investigation id");
    const investigation = await getInvestigation(env, auth.orgId, id);
    if (!investigation) throw new HttpError(404, "Investigation not found");
    return json(investigation);
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
