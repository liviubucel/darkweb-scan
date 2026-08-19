import type { AuthContext, Env, Plan } from "./types";
import { HttpError } from "./security";

interface StripeEvent {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
}

function isPersonalOrg(auth: AuthContext): boolean {
  return auth.orgId === `personal:${auth.userId}`;
}

export function requireBillingAdmin(auth: AuthContext): void {
  if (isPersonalOrg(auth)) return;
  if (!auth.orgRole || !["org:admin", "org:owner"].includes(auth.orgRole)) {
    throw new HttpError(403, "Organization administrator role required");
  }
}

function planPrice(env: Env, plan: Plan): string | undefined {
  if (plan === "pro") return env.STRIPE_PRICE_PRO || undefined;
  if (plan === "business") return env.STRIPE_PRICE_BUSINESS || undefined;
  return undefined;
}

function pricePlan(env: Env, priceId: string | undefined): Plan | undefined {
  if (priceId && priceId === env.STRIPE_PRICE_PRO) return "pro";
  if (priceId && priceId === env.STRIPE_PRICE_BUSINESS) return "business";
  return undefined;
}

async function stripePost(env: Env, path: string, params: URLSearchParams): Promise<Record<string, unknown>> {
  const secret = await env.STRIPE_SECRET_KEY.get();
  if (!secret) throw new HttpError(503, "Billing is not configured");
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new HttpError(502, "Billing provider request failed");
  return payload;
}

export async function createCheckout(env: Env, auth: AuthContext, requestedPlan: unknown): Promise<{ id: string; url: string }> {
  requireBillingAdmin(auth);
  const plan = requestedPlan === "pro" || requestedPlan === "business" ? requestedPlan : undefined;
  if (!plan) throw new HttpError(400, "Unsupported plan");
  const price = planPrice(env, plan);
  if (!price) throw new HttpError(503, "Plan pricing is not configured");
  const origin = new URL(env.APP_ORIGIN);
  if (origin.protocol !== "https:") throw new HttpError(500, "Invalid application origin");

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", price);
  params.set("line_items[0][quantity]", "1");
  params.set("client_reference_id", auth.orgId);
  params.set("success_url", `${origin.origin}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin.origin}/app/billing?checkout=cancelled`);
  params.set("metadata[zebrabyte_org_id]", auth.orgId);
  params.set("metadata[zebrabyte_plan]", plan);
  params.set("subscription_data[metadata][zebrabyte_org_id]", auth.orgId);
  params.set("subscription_data[metadata][zebrabyte_plan]", plan);

  const session = await stripePost(env, "/v1/checkout/sessions", params);
  if (typeof session.id !== "string" || typeof session.url !== "string") throw new HttpError(502, "Billing provider returned an invalid session");
  return { id: session.id, url: session.url };
}

export async function createBillingPortal(env: Env, auth: AuthContext): Promise<{ url: string }> {
  requireBillingAdmin(auth);
  const subscription = await env.DB.prepare(`SELECT provider_customer_id FROM subscriptions WHERE org_id = ?1 LIMIT 1`).bind(auth.orgId).first<{ provider_customer_id: string | null }>();
  if (!subscription?.provider_customer_id) throw new HttpError(404, "No billing customer found");
  const origin = new URL(env.APP_ORIGIN);
  const params = new URLSearchParams();
  params.set("customer", subscription.provider_customer_id);
  params.set("return_url", `${origin.origin}/app/billing`);
  const portal = await stripePost(env, "/v1/billing_portal/sessions", params);
  if (typeof portal.url !== "string") throw new HttpError(502, "Billing provider returned an invalid portal session");
  return { url: portal.url };
}

function parseStripeSignature(header: string): { timestamp: number; signatures: string[] } {
  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t") timestamp = Number(value);
    if (key === "v1" && value) signatures.push(value);
  }
  if (!Number.isFinite(timestamp) || timestamp <= 0 || !signatures.length) throw new HttpError(400, "Invalid webhook signature");
  return { timestamp, signatures };
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

async function verifyStripeWebhook(env: Env, body: string, signatureHeader: string): Promise<void> {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) throw new HttpError(400, "Webhook timestamp outside tolerance");
  const secret = await env.STRIPE_WEBHOOK_SECRET.get();
  if (!secret) throw new HttpError(503, "Billing webhook is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = hex(digest);
  if (!signatures.some((candidate) => constantTimeEqual(candidate.toLowerCase(), expected))) throw new HttpError(400, "Invalid webhook signature");
}

function getString(object: Record<string, unknown>, key: string): string | undefined {
  const value = object[key];
  return typeof value === "string" ? value : undefined;
}
function getMetadata(object: Record<string, unknown>): Record<string, string> {
  const raw = object.metadata;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") output[key] = value;
  return output;
}
function subscriptionPriceId(object: Record<string, unknown>): string | undefined {
  const items = object.items;
  if (!items || typeof items !== "object" || Array.isArray(items)) return undefined;
  const data = (items as Record<string, unknown>).data;
  if (!Array.isArray(data)) return undefined;
  for (const item of data) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const price = (item as Record<string, unknown>).price;
    if (price && typeof price === "object" && !Array.isArray(price) && typeof (price as Record<string, unknown>).id === "string") return (price as Record<string, unknown>).id as string;
  }
  return undefined;
}
function customerId(object: Record<string, unknown>): string | undefined {
  const customer = object.customer;
  if (typeof customer === "string") return customer;
  if (customer && typeof customer === "object" && !Array.isArray(customer) && typeof (customer as Record<string, unknown>).id === "string") return (customer as Record<string, unknown>).id as string;
  return undefined;
}

async function syncSubscription(env: Env, object: Record<string, unknown>, eventType: string): Promise<void> {
  const metadata = getMetadata(object);
  const orgId = metadata.zebrabyte_org_id;
  if (!orgId || orgId.length > 256) return;
  const subscriptionId = getString(object, "id");
  if (!subscriptionId) return;
  const plan = pricePlan(env, subscriptionPriceId(object));
  if (!plan) return;
  const status = eventType === "customer.subscription.deleted" ? "canceled" : (getString(object, "status") ?? "inactive");
  const periodEndRaw = object.current_period_end;
  const periodEnd = typeof periodEndRaw === "number" && Number.isFinite(periodEndRaw) ? new Date(periodEndRaw * 1000).toISOString() : null;
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO subscriptions (org_id, provider_customer_id, provider_subscription_id, plan, status, current_period_end, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(org_id) DO UPDATE SET provider_customer_id = excluded.provider_customer_id, provider_subscription_id = excluded.provider_subscription_id, plan = excluded.plan, status = excluded.status, current_period_end = excluded.current_period_end, updated_at = excluded.updated_at`).bind(orgId, customerId(object) ?? null, subscriptionId, plan, status, periodEnd, now).run();
}

export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 1_048_576) throw new HttpError(413, "Webhook body too large");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 1_048_576) throw new HttpError(413, "Webhook body too large");
  const signature = request.headers.get("stripe-signature");
  if (!signature) throw new HttpError(400, "Missing webhook signature");
  await verifyStripeWebhook(env, body, signature);

  let event: StripeEvent;
  try { event = JSON.parse(body) as StripeEvent; } catch { throw new HttpError(400, "Invalid webhook JSON"); }
  if (!event.id || !event.type) throw new HttpError(400, "Invalid webhook event");
  const existing = await env.DB.prepare(`SELECT event_id FROM billing_events WHERE event_id = ?1 LIMIT 1`).bind(event.id).first();
  if (existing) return new Response(null, { status: 204 });

  const object = event.data?.object;
  if (object && ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.resumed", "customer.subscription.paused"].includes(event.type)) {
    await syncSubscription(env, object, event.type);
  }
  await env.DB.prepare(`INSERT OR IGNORE INTO billing_events (event_id, event_type, processed_at) VALUES (?1, ?2, ?3)`).bind(event.id, event.type, new Date().toISOString()).run();
  return new Response(null, { status: 204 });
}

export async function getBillingState(env: Env, orgId: string): Promise<Record<string, unknown>> {
  const row = await env.DB.prepare(`SELECT plan, status, current_period_end, updated_at FROM subscriptions WHERE org_id = ?1 LIMIT 1`).bind(orgId).first<Record<string, unknown>>();
  return row ?? { plan: "free", status: "inactive", current_period_end: null };
}
