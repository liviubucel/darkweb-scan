import { authenticate, isAuthenticationConfigured } from "./auth";
import { track } from "./analytics";
import { createBillingPortal, createCheckout, getBillingState, handleStripeWebhook } from "./billing";
import { ensureDatabase } from "./bootstrap";
import { correlateIntelligence } from "./correlation";
import {
  consumeInvestigationQuota,
  createInvestigation,
  deleteInvestigationRecords,
  ensureOrganization,
  getExposureStats,
  getInvestigation,
  getInvestigationDeletionTargets,
  getPlan,
  getUsage,
  listExposures,
  listInvestigationArtifacts,
  listInvestigations,
  listInvestigationSources,
  markStatus,
  refundInvestigationQuota,
} from "./db";
import {
  addDiscoverySources,
  assertDiscoveryAdmin,
  consumeDiscovery,
  disableDiscoverySource,
  enqueueDueDiscovery,
  getDiscoveryStatus,
  listDiscoverySources,
} from "./discovery";
import { InvestigationWorkflow } from "./workflow";
import { browserMarkdown, validateClearWebUrl } from "./enrichment";
import { askTenantKnowledge, deleteInvestigationKnowledge } from "./knowledge";
import { consumeMonitoring, createWatchlist, deleteWatchlist, enqueueDueMonitoring, listWatchlists } from "./monitoring";
import { consumeNotifications } from "./notifications";
import { enforceEvidenceRetention } from "./retention";
import { TorCollector } from "./container";
import { HttpError, json, normalizeQuery, readJson, safeId, withSecurityHeaders } from "./security";
import type {
  DiscoveryJob,
  DiscoverySourceInput,
  Env,
  InvestigationRequest,
  InvestigationWorkflowPayload,
  MonitoringJob,
  NotificationJob,
  Plan,
  QueueJob,
  WatchlistInput,
} from "./types";

export { InvestigationWorkflow, TorCollector };

async function enforceRateLimit(env: Env, orgId: string, plan: Plan): Promise<void> {
  const limiter = plan === "free" ? env.FREE_RATE_LIMITER : env.PAID_RATE_LIMITER;
  const { success } = await limiter.limit({ key: `${orgId}:api` });
  if (!success) throw new HttpError(429, "Rate limit exceeded");
}

async function flagEnabled(env: Env, key: string, context: Record<string, unknown>): Promise<boolean> {
  if (!env.FLAGS) return true;
  try { return await env.FLAGS.getBooleanValue(key, true, context); }
  catch { return true; }
}

function configured(value: string | undefined): boolean {
  const normalized = value?.trim();
  return Boolean(normalized && !normalized.startsWith("REPLACE_"));
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
  await ensureDatabase(env);

  if (request.method === "GET" && url.pathname === "/api/health") {
    const authentication = isAuthenticationConfigured(env);
    const discovery = await getDiscoveryStatus(env);
    const discoveryReady = discovery.enabledSources > 0;
    return json({
      ok: true,
      ready: authentication && discoveryReady,
      service: env.APP_NAME,
      version: env.CF_VERSION_METADATA.id,
      time: new Date().toISOString(),
      configuration: {
        database: true,
        authentication,
        inhouseDiscovery: true,
        discoveryReady,
        discoverySources: discovery.enabledSources,
        indexedPages: discovery.indexedPages,
        romanianPages: discovery.romanianPages,
        marketFocus: env.MARKET_FOCUS ?? "GLOBAL",
        dailyCrawlBudget: discovery.dailyBudget,
        todayCrawledPages: discovery.todayFetched,
        externalFallbackConfigured: configured(env.FALLBACK_DISCOVERY_URL) && Boolean(env.FALLBACK_DISCOVERY_API_KEY),
        stripePricing: configured(env.STRIPE_PRICE_PRO) || configured(env.STRIPE_PRICE_BUSINESS),
        stripeSecretBound: Boolean(env.STRIPE_SECRET_KEY),
        stripeWebhookSecretBound: Boolean(env.STRIPE_WEBHOOK_SECRET),
        vectorize: Boolean(env.INTELLIGENCE_INDEX),
        aiSearch: Boolean(env.AI_SEARCH),
        flagship: Boolean(env.FLAGS),
        email: Boolean(env.EMAIL),
      },
    });
  }

  if (request.method === "POST" && url.pathname === "/api/stripe/webhook") {
    return handleStripeWebhook(request, env);
  }

  const auth = await authenticate(request, env);
  await ensureOrganization(env, auth);
  const plan = await getPlan(env, auth.orgId);
  await enforceRateLimit(env, auth.orgId, plan);

  if (request.method === "GET" && url.pathname === "/api/me") {
    const usage = await getUsage(env, auth.orgId, plan);
    return json({ userId: auth.userId, orgId: auth.orgId, orgRole: auth.orgRole ?? null, plan, usage });
  }

  if (request.method === "GET" && url.pathname === "/api/usage") {
    return json(await getUsage(env, auth.orgId, plan));
  }

  if (request.method === "GET" && url.pathname === "/api/exposures") {
    const limit = boundedInteger(url.searchParams.get("limit"), 50, 1, 100);
    const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 5_000);
    const [stats, items] = await Promise.all([
      getExposureStats(env, auth.orgId),
      listExposures(env, auth.orgId, limit, offset),
    ]);
    return json({ stats, items, pagination: { limit, offset, nextOffset: items.length === limit ? offset + limit : null } });
  }

  if (request.method === "GET" && url.pathname === "/api/billing") {
    return json(await getBillingState(env, auth.orgId));
  }

  if (request.method === "POST" && url.pathname === "/api/billing/checkout") {
    const body = await readJson<{ plan?: unknown }>(request, 2_048);
    const session = await createCheckout(env, auth, body.plan, request.url);
    await track(env, "billing_checkout_created", auth.orgId, plan);
    return json(session, 201);
  }

  if (request.method === "POST" && url.pathname === "/api/billing/portal") {
    const portal = await createBillingPortal(env, auth, request.url);
    await track(env, "billing_portal_created", auth.orgId, plan);
    return json(portal, 201);
  }

  if (request.method === "POST" && url.pathname === "/api/enrichment/clearweb") {
    if (plan === "free") throw new HttpError(403, "Clear-web enrichment requires a paid plan");
    const body = await readJson<{ url?: unknown }>(request, 4_096);
    const target = validateClearWebUrl(body.url, env);
    const markdown = await browserMarkdown(env, target);
    await track(env, "browser_enrichment", auth.orgId, plan, [markdown.length]);
    return json({ url: target, markdown });
  }

  if (request.method === "GET" && url.pathname === "/api/discovery/status") {
    return json(await getDiscoveryStatus(env));
  }

  if (request.method === "GET" && url.pathname === "/api/discovery/sources") {
    assertDiscoveryAdmin(auth);
    const limit = boundedInteger(url.searchParams.get("limit"), 50, 1, 100);
    const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 50_000);
    const items = await listDiscoverySources(env, limit, offset);
    return json({ items, pagination: { limit, offset, nextOffset: items.length === limit ? offset + limit : null } });
  }

  if (request.method === "POST" && url.pathname === "/api/discovery/sources") {
    assertDiscoveryAdmin(auth);
    const body = await readJson<{ items?: unknown }>(request, 64_000);
    if (!Array.isArray(body.items)) throw new HttpError(400, "items must be an array");
    const result = await addDiscoverySources(env, auth, body.items as DiscoverySourceInput[]);
    const queued = await enqueueDueDiscovery(env, true);
    await track(env, "discovery_seeds_added", auth.orgId, plan, [result.added, result.existing, queued]);
    return json({ ...result, queued }, 201);
  }

  if (request.method === "POST" && url.pathname === "/api/discovery/crawl") {
    assertDiscoveryAdmin(auth);
    const queued = await enqueueDueDiscovery(env, true);
    await track(env, "discovery_refresh_requested", auth.orgId, plan, [queued]);
    return json({ queued }, 202);
  }

  const discoverySourceMatch = url.pathname.match(/^\/api\/discovery\/sources\/([a-zA-Z0-9_-]{8,96})$/);
  if (request.method === "DELETE" && discoverySourceMatch?.[1]) {
    assertDiscoveryAdmin(auth);
    const id = discoverySourceMatch[1];
    if (!safeId(id)) throw new HttpError(400, "Invalid discovery source id");
    const disabled = await disableDiscoverySource(env, auth, id);
    if (!disabled) throw new HttpError(404, "Discovery source not found");
    await track(env, "discovery_source_disabled", auth.orgId, plan);
    return new Response(null, { status: 204 });
  }

  if (request.method === "POST" && url.pathname === "/api/intelligence/correlate") {
    if (plan === "free") throw new HttpError(403, "Intelligence correlation requires a paid plan");
    const body = await readJson<{ query?: unknown; topK?: unknown }>(request, 8_192);
    const result = await correlateIntelligence(env, auth.orgId, body.query, body.topK);
    await track(env, "intelligence_correlation", auth.orgId, plan, [result.matches.length]);
    return json(result);
  }

  if (request.method === "POST" && url.pathname === "/api/intelligence/ask") {
    if (plan === "free") throw new HttpError(403, "Investigation knowledge search requires a paid plan");
    const body = await readJson<{ query?: unknown }>(request, 8_192);
    const result = await askTenantKnowledge(env, auth.orgId, body.query);
    await track(env, "intelligence_ask", auth.orgId, plan, [result.contextCount]);
    return json(result);
  }

  if (request.method === "GET" && url.pathname === "/api/watchlists") {
    return json({ items: await listWatchlists(env, auth.orgId) });
  }

  if (request.method === "POST" && url.pathname === "/api/watchlists") {
    const enabled = await flagEnabled(env, "monitoring", { userId: auth.userId, orgId: auth.orgId, plan });
    if (!enabled) throw new HttpError(503, "Monitoring is temporarily unavailable");
    const body = await readJson<WatchlistInput>(request, 4_096);
    const watchlist = await createWatchlist(env, auth, plan, body);
    await track(env, "watchlist_created", auth.orgId, plan, [watchlist.interval_hours]);
    return json(watchlist, 201);
  }

  const watchlistMatch = url.pathname.match(/^\/api\/watchlists\/([a-zA-Z0-9_-]{8,96})$/);
  if (request.method === "DELETE" && watchlistMatch?.[1]) {
    const id = watchlistMatch[1];
    if (!safeId(id)) throw new HttpError(400, "Invalid watchlist id");
    const deleted = await deleteWatchlist(env, auth, id);
    if (!deleted) throw new HttpError(404, "Watchlist not found");
    await track(env, "watchlist_deleted", auth.orgId, plan);
    return new Response(null, { status: 204 });
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
    const enabled = await flagEnabled(env, "investigations", { userId: auth.userId, orgId: auth.orgId, plan });
    if (!enabled) throw new HttpError(503, "Investigations are temporarily unavailable");

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
    await track(env, "investigation_created", auth.orgId, plan, [query.length, quota.used, quota.limit]);
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
      if (targets.sourceIds.length && env.INTELLIGENCE_INDEX) await env.INTELLIGENCE_INDEX.deleteByIds(targets.sourceIds);
      if (targets.aiSearchItemId) await deleteInvestigationKnowledge(env, auth.orgId, targets.aiSearchItemId).catch(() => undefined);
      const deleted = await deleteInvestigationRecords(env, auth, id);
      if (!deleted) throw new HttpError(404, "Investigation not found");
      await track(env, "investigation_deleted", auth.orgId, plan, [targets.objectKeys.length, targets.sourceIds.length]);
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
      console.error("request_failed", error instanceof Error ? { name: error.name, message: error.message, stack: error.stack?.slice(0, 1_500) } : { name: "unknown" });
      return json({ error: "Internal server error" }, 500);
    }
  },
  async queue(batch: MessageBatch<QueueJob>, env: Env): Promise<void> {
    await ensureDatabase(env);
    if (batch.queue === "zebrabyte-darkweb-discovery") {
      await consumeDiscovery(batch as unknown as MessageBatch<DiscoveryJob>, env);
      return;
    }
    if (batch.queue === "zebrabyte-darkweb-monitoring") {
      await consumeMonitoring(batch as unknown as MessageBatch<MonitoringJob>, env);
      return;
    }
    if (batch.queue === "zebrabyte-darkweb-notifications") {
      await consumeNotifications(batch as unknown as MessageBatch<NotificationJob>, env);
      return;
    }
    batch.ackAll();
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await ensureDatabase(env);
    await Promise.all([
      enqueueDueMonitoring(env),
      enqueueDueDiscovery(env),
      enforceEvidenceRetention(env),
    ]);
  },
} satisfies ExportedHandler<Env>;