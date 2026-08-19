export type Plan = "free" | "pro" | "business" | "enterprise";

export interface AuthContext {
  userId: string;
  orgId: string;
  orgRole?: string;
  sessionId?: string;
}

export interface InvestigationRequest {
  query: string;
  profile?: "general" | "identity" | "corporate" | "ransomware";
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
}

export interface ExtractedArtifact {
  type: "email" | "domain" | "ipv4" | "sha256" | "bitcoin";
  value: string;
}

export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  BROWSER: { quickAction(action: string, input: Record<string, unknown>): Promise<Response> };
  DB: D1Database;
  CACHE: KVNamespace;
  EVIDENCE: R2Bucket;
  INTELLIGENCE_INDEX: VectorizeIndex;
  AI_SEARCH: unknown;
  ANALYTICS: AnalyticsEngineDataset;
  FLAGS: { getBooleanValue(key: string, defaultValue: boolean, context?: Record<string, unknown>): Promise<boolean> };
  EMAIL: {
    send(message: {
      to: string;
      from: string | { email: string; name?: string };
      subject: string;
      text?: string;
      html?: string;
    }): Promise<{ messageId: string }>;
  };
  STRIPE_SECRET_KEY: { get(): Promise<string> };
  STRIPE_WEBHOOK_SECRET: { get(): Promise<string> };
  ONION_SEARCH_ENGINES_JSON: { get(): Promise<string> };
  FREE_RATE_LIMITER: RateLimit;
  PAID_RATE_LIMITER: RateLimit;
  NOTIFICATIONS: Queue<NotificationJob>;
  INVESTIGATION_WORKFLOW: Workflow;
  TOR_COLLECTOR: DurableObjectNamespace;
  CF_VERSION_METADATA: WorkerVersionMetadata;
  APP_NAME: string;
  CLERK_ISSUER: string;
  CLERK_JWKS_URL: string;
  CLERK_AUDIENCE: string;
  CLERK_AUTHORIZED_PARTIES: string;
  EVIDENCE_RETENTION_DAYS: string;
  MAX_SELECTED_SOURCES: string;
  MAX_QUERY_CHARS: string;
  ALLOWED_BROWSER_HOSTS: string;
  EMAIL_FROM: string;
}

export interface NotificationJob {
  type: "investigation.completed" | "investigation.failed" | "exposure.detected";
  orgId: string;
  investigationId: string;
  recipient?: string;
}
