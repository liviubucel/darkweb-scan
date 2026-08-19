import { getContainer } from "@cloudflare/containers";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { extractArtifacts } from "./artifacts";
import { rankHits, refineQuery, summarizeInvestigation } from "./ai";
import { markStatus, setInvestigationKnowledgeItem } from "./db";
import { detectMonitoringDelta } from "./detection";
import { indexSource, persistEvidence } from "./intelligence";
import { indexInvestigationKnowledge } from "./knowledge";
import { readRequiredSecret } from "./secrets";
import type { Env, InvestigationWorkflowPayload, NotificationJob, SearchHit, ScrapedSource } from "./types";
import type { TorCollector } from "./container";

interface SearchResponse { results: SearchHit[] }
interface ScrapeResponse { sources: ScrapedSource[] }

const TOR_COLLECTOR_ID = "zebrabyte-shared-tor-collector";

export class InvestigationWorkflow extends WorkflowEntrypoint<Env, InvestigationWorkflowPayload> {
  override async run(event: WorkflowEvent<InvestigationWorkflowPayload>, step: WorkflowStep): Promise<void> {
    const payload = event.payload;
    const maxSources = Math.max(1, Math.min(12, Number(this.env.MAX_SELECTED_SOURCES) || 8));
    await step.do("mark-running", async () => { await markStatus(this.env, payload.investigationId, payload.orgId, "running"); });
    try {
      const refinedQuery = await step.do("refine-query", async () => refineQuery(this.env, payload.query));
      const searchEnginesJson = await step.do("load-collector-config", async () => readRequiredSecret(this.env.ONION_SEARCH_ENGINES_JSON, "Onion search engine configuration"));
      const hits = await step.do("search-onion-indexes", { retries: { limit: 2, delay: "10 seconds", backoff: "exponential" }, timeout: "3 minutes" }, async () => {
        const collector = getContainer<TorCollector>(this.env.TOR_COLLECTOR, TOR_COLLECTOR_ID);
        const raw = (await collector.runRequest("/search", { query: refinedQuery, limit: 60 }, searchEnginesJson)) as SearchResponse;
        return Array.isArray(raw.results) ? raw.results.slice(0, 60) : [];
      });
      const selected = await step.do("rank-search-results", async () => rankHits(this.env, payload.query, hits, maxSources));
      const sources = await step.do("scrape-selected-sources", { retries: { limit: 2, delay: "15 seconds", backoff: "exponential" }, timeout: "5 minutes" }, async () => {
        if (!selected.length) return [];
        const collector = getContainer<TorCollector>(this.env.TOR_COLLECTOR, TOR_COLLECTOR_ID);
        const raw = (await collector.runRequest("/scrape", { urls: selected.map((hit) => hit.url) }, searchEnginesJson)) as ScrapeResponse;
        return Array.isArray(raw.sources) ? raw.sources.slice(0, maxSources) : [];
      });
      const analysis = await step.do("analyze-grounded-evidence", async () => summarizeInvestigation(this.env, payload.query, sources));
      await step.do("persist-results", async () => {
        const now = new Date().toISOString(); const statements: D1PreparedStatement[] = [];
        for (const [index, source] of sources.entries()) {
          const sourceId = crypto.randomUUID();
          const r2Key = await persistEvidence(this.env, payload.orgId, payload.investigationId, sourceId, source);
          await indexSource(this.env, payload.orgId, payload.investigationId, sourceId, source);
          statements.push(this.env.DB.prepare(`INSERT INTO investigation_sources (id, investigation_id, org_id, ordinal, title, onion_url, content_sha256, r2_key, fetched_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`).bind(sourceId, payload.investigationId, payload.orgId, index + 1, source.title, source.url, source.sha256, r2Key, source.fetchedAt));
          for (const artifact of extractArtifacts(source.text)) {
            statements.push(this.env.DB.prepare(`INSERT OR IGNORE INTO artifacts (id, investigation_id, org_id, type, value, source_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`).bind(crypto.randomUUID(), payload.investigationId, payload.orgId, artifact.type, artifact.value, sourceId, now));
          }
        }
        statements.push(this.env.DB.prepare(`UPDATE investigations SET status = 'completed', summary = ?1, risk_level = ?2, source_count = ?3, updated_at = ?4, completed_at = ?4 WHERE id = ?5 AND org_id = ?6`).bind(analysis.summary, analysis.riskLevel, sources.length, now, payload.investigationId, payload.orgId));
        if (statements.length) await this.env.DB.batch(statements);
      });

      try {
        const itemId = await step.do("index-investigation-knowledge", async () => indexInvestigationKnowledge(this.env, payload.orgId, payload.investigationId, payload.query, analysis.riskLevel, analysis.summary, sources));
        if (itemId) {
          await step.do("persist-knowledge-reference", async () => setInvestigationKnowledgeItem(this.env, payload.orgId, payload.investigationId, itemId));
        }
      } catch {
        // AI Search is a secondary retrieval layer. Core investigation evidence remains in D1/R2.
      }

      const delta = await step.do("detect-monitoring-delta", async () => detectMonitoringDelta(this.env, payload.orgId, payload.investigationId));
      let notification: NotificationJob | undefined;
      if (!delta.isMonitoring) {
        notification = { type: "investigation.completed", orgId: payload.orgId, investigationId: payload.investigationId };
      } else if (!delta.hasBaseline) {
        notification = { type: "monitoring.baseline", orgId: payload.orgId, investigationId: payload.investigationId };
      } else if (delta.hasNewExposure) {
        notification = {
          type: "exposure.detected",
          orgId: payload.orgId,
          investigationId: payload.investigationId,
          newArtifactCount: delta.newArtifactCount,
          newSourceCount: delta.newSourceCount,
        };
      }

      if (notification) {
        const job = notification;
        await step.do("notify-result", async () => { await this.env.NOTIFICATIONS.send(job); });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Investigation failed";
      await step.do("mark-failed", async () => { await markStatus(this.env, payload.investigationId, payload.orgId, "failed", message); });
      try {
        await step.do("notify-failure", async () => {
          await this.env.NOTIFICATIONS.send({ type: "investigation.failed", orgId: payload.orgId, investigationId: payload.investigationId });
        });
      } catch {
        // Preserve the investigation error; notification delivery is handled independently.
      }
      throw error;
    }
  }
}
