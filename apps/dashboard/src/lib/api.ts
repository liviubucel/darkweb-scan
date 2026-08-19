import type { Artifact, BillingState, HealthState, Investigation, InvestigationSource, SessionState, Watchlist } from "@/lib/types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function engineFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/engine${path}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {})
    }
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new ApiError(response.status, body.error || `Request failed (${response.status})`);
  return body as T;
}

export const engine = {
  health: () => engineFetch<HealthState>("/health"),
  me: () => engineFetch<SessionState>("/me"),
  investigations: (limit = 50, offset = 0) => engineFetch<{ items: Investigation[]; pagination: { limit: number; offset: number; nextOffset: number | null } }>(`/investigations?limit=${limit}&offset=${offset}`),
  investigation: (id: string) => engineFetch<Investigation>(`/investigations/${encodeURIComponent(id)}`),
  sources: (id: string) => engineFetch<{ items: InvestigationSource[] }>(`/investigations/${encodeURIComponent(id)}/sources`),
  artifacts: (id: string) => engineFetch<{ items: Artifact[] }>(`/investigations/${encodeURIComponent(id)}/artifacts`),
  createInvestigation: (input: { query: string; profile: string }) => engineFetch<{ id: string; status: string; quota: { used: number; limit: number; period: string } }>("/investigations", { method: "POST", body: JSON.stringify(input) }),
  deleteInvestigation: (id: string) => engineFetch<void>(`/investigations/${encodeURIComponent(id)}`, { method: "DELETE" }),
  watchlists: () => engineFetch<{ items: Watchlist[] }>("/watchlists"),
  createWatchlist: (input: { type: Watchlist["type"]; value: string; profile: string; intervalHours: number }) => engineFetch<Watchlist>("/watchlists", { method: "POST", body: JSON.stringify(input) }),
  deleteWatchlist: (id: string) => engineFetch<void>(`/watchlists/${encodeURIComponent(id)}`, { method: "DELETE" }),
  ask: (query: string) => engineFetch<{ answer: string; contextCount: number }>("/intelligence/ask", { method: "POST", body: JSON.stringify({ query }) }),
  correlate: (query: string, topK = 10) => engineFetch<{ matches: unknown[] }>("/intelligence/correlate", { method: "POST", body: JSON.stringify({ query, topK }) }),
  billing: () => engineFetch<BillingState>("/billing"),
  checkout: (plan: "pro" | "business") => engineFetch<{ id: string; url: string }>("/billing/checkout", { method: "POST", body: JSON.stringify({ plan }) }),
  billingPortal: () => engineFetch<{ url: string }>("/billing/portal", { method: "POST", body: "{}" })
};
