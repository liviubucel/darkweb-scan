import type { Env, Plan } from "./types";

async function tenantAnalyticsKey(orgId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`zebrabyte-analytics:${orgId}`));
  return [...new Uint8Array(digest).slice(0, 16)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function track(env: Env, event: string, orgId: string, plan: Plan | "unknown", values: number[] = []): Promise<void> {
  const version = env.CF_VERSION_METADATA;
  const tenantKey = await tenantAnalyticsKey(orgId);
  env.ANALYTICS.writeDataPoint({
    indexes: [tenantKey],
    blobs: [event, plan, version.id, version.tag ?? ""],
    doubles: values.slice(0, 20),
  });
}
