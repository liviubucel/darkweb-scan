export type InvestigationStatus = "queued" | "running" | "completed" | "failed" | string;
export type RiskLevel = "critical" | "high" | "medium" | "low" | "none" | string | null;
export type Plan = "free" | "pro" | "business" | "enterprise";

export interface Usage {
  period: string;
  investigations: number;
  limit: number;
  remaining: number;
}

export interface SessionState {
  userId: string;
  orgId: string;
  orgRole: string | null;
  plan: Plan;
  usage: Usage;
}

export interface Investigation {
  id: string;
  query: string;
  profile: string;
  origin: string;
  watchlist_id?: string | null;
  status: InvestigationStatus;
  risk_level: RiskLevel;
  summary?: string | null;
  source_count: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface InvestigationSource {
  id: string;
  ordinal: number;
  content_sha256: string;
  fetched_at: string;
}

export interface ExposureFinding {
  id: string;
  asset: string;
  profile: string;
  risk_level: RiskLevel;
  summary?: string | null;
  evidence_count: number;
  completed_at: string;
  indicator_count: number;
  email_indicators: number;
  domain_indicators: number;
}

export interface ExposureStats {
  exposures: number;
  elevated: number;
  scanning: number;
  lastScanAt: string | null;
}

export interface Artifact {
  id: string;
  type: string;
  value: string;
  source_id: string;
  created_at: string;
}

export interface Watchlist {
  id: string;
  type: "domain" | "email" | "brand" | "person" | "keyword";
  value: string;
  profile: string;
  interval_hours: number;
  active: number;
  last_run_at: string | null;
  last_investigation_id: string | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

export interface HealthState {
  ok: boolean;
  ready: boolean;
  service: string;
  version: string;
  time: string;
  configuration: {
    database: boolean;
    authentication: boolean;
    inhouseDiscovery?: boolean;
    discoveryReady?: boolean;
    discoverySources?: number;
    indexedPages?: number;
    romanianPages?: number;
    marketFocus?: string;
    dailyCrawlBudget?: number;
    todayCrawledPages?: number;
    externalFallbackConfigured?: boolean;
    stripePricing: boolean;
    stripeSecretBound: boolean;
    stripeWebhookSecretBound: boolean;
    vectorize: boolean;
    aiSearch: boolean;
    flagship: boolean;
    email: boolean;
  };
}

export interface BillingState {
  plan: Plan;
  status: string;
  current_period_end: string | null;
  updated_at?: string | null;
}
