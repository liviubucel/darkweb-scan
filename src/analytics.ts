import type { Env, Plan } from "./types";

export function track(env: Env, event: string, orgId: string, plan: Plan | "unknown", values: number[] = []): void {
  const version = env.CF_VERSION_METADATA;
  env.ANALYTICS.writeDataPoint({ indexes: [orgId], blobs: [event, plan, version.id, version.tag ?? ""], doubles: values.slice(0, 20) });
}
