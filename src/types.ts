export type Plan = "free" | "pro" | "business" | "enterprise";
export type InvestigationProfile = "general" | "identity" | "corporate" | "ransomware";
export type WatchlistType = "domain" | "email" | "brand" | "person" | "keyword";
export type SecretBinding = string | { get(): Promise<string> };

export interface AuthContext {
  userId: string;
  orgId: string;
  orgRole?: string;
  sessionId?: string;
}

export interface InvestigationRequest {
  query: string;
  profile?: InvestigationProfile;
}

export interface InvestigationWorkflowPayload {
  investigationId: string;
  orgId: string;
  userId: string;
  query: string;
  profile: string;
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  engine: string;
}

export interface ScrapedSource {
  url: string;
  title: string;
  text: string;
  contentType: string;
  fetchedAt: string;
  sha256: string;
  discoveredOnionUrls?: string[];
  bodyBytes?: number;
}

export interface ExtractedArtifact {
  type: "email" | "domain" | "ipv4" | "sha256" | "bitcoin";
  value: string;
}

export interface WatchlistInput {
  type: WatchlistType;
  value: string;
  intervalHours?: number;
  profile?: InvestigationProfile;
}

export interface DiscoverySourceInput {
  url: string;
  label?: string;
  category?: "directory" | "research" | "disclosure" | "other";
  priority?: number;
}

export interface DiscoveryJob {
  type: "discovery.crawl";
  sourceId: string;
  url: string;
  depth: number;
}

export interface FlagshipBinding {
  getBooleanValue(key: string, defaultValue: boolean, context?: Record<string, unknown>): Promise<boolean>;
}

export interface EmailBinding {
  send(message: {
    to: string;
    from: string | { email: string; name?: string };
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId: string }>;
}

export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  BROWSER: { quickAction(action: string, input: Record<string, unknown>): Promise<Response> };
  DB: D1Database;
  CACHE: KVNamespace;
  EVIDENCE: R2Bucket;
  INTELLIGENCE_INDEX?: VectorizeIndex;
  AI_SEARCH?: unknown;
  ANALYTICS: AnalyticsEngineDataset;
  FLAGS?: FlagshipBinding;
  EMAIL?: EmailBinding;
  STRIPE_SECRET_KEY?: SecretBinding;
  STRIPE_WEBHOOK_SECRET?: SecretBinding;
  FALLBACK_DISCOVERY_API_KEY?: SecretBinding;
  FREE_RATE_LIMITER: RateLimit;
  PAID_RATE_LIMITER: RateLimit;
  NOTIFICATIONS: Queue<NotificationJob>;
  MONITORING: Queue<MonitoringJob>;
  DISCOVERY: Queue<DiscoveryJob>;
  INVESTIGATION_WORKFLOW: Workflow;
  TOR_COLLECTOR: DurableObjectNamespace;
  CF_VERSION_METADATA: WorkerVersionMetadata;
  APP_NAME: string;
  APP_ORIGIN?: string;
  CLERK_ISSUER?: string;
  CLERK_JWKS_URL?: string;
  CLERK_AUDIENCE?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_BUSINESS?: string;
  FALLBACK_DISCOVERY_URL?: string;
  MARKET_FOCUS?: string;
  CRAWL_DAILY_PAGE_BUDGET?: string;
  CRAWL_MAX_DEPTH?: string;
  CRAWL_MAX_DISCOVERED_LINKS?: string;
  CRAWL_SEED_REFRESH_HOURS?: string;
  CRAWL_DISCOVERED_REFRESH_HOURS?: string;
  CRAWL_MAX_CATALOG_SOURCES?: string;
  CRAWL_INDEX_TEXT_CHARS?: string;
  EVIDENCE_RETENTION_DAYS: string;
  MAX_SELECTED_SOURCES: string;
  MAX_QUERY_CHARS: string;
  ALLOWED_BROWSER_HOSTS: string;
  EMAIL_FROM: string;
  PLAN_FREE_INVESTIGATIONS: string;
  PLAN_PRO_INVESTIGATIONS: string;
  PLAN_BUSINESS_INVESTIGATIONS: string;
  PLAN_ENTERPRISE_INVESTIGATIONS: string;
}

export interface NotificationJob {
  type: "investigation.completed" | "investigation.failed" | "exposure.detected" | "monitoring.baseline";
  orgId: string;
  investigationId: string;
  recipient?: string;
  newArtifactCount?: number;
  newSourceCount?: number;
}

export interface MonitoringJob {
  type: "monitoring.run";
  runId: string;
  watchlistId: string;
  orgId: string;
}

export type QueueJob = NotificationJob | MonitoringJob | DiscoveryJob;
