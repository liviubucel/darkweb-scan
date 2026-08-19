# ZebraByte Dark Web Intelligence

Cloudflare-native dark-web monitoring and defensive threat-intelligence platform by ZEBRABYTE LIMITED.

## Architecture

The public application runs on Cloudflare Workers. Durable orchestration, storage, analysis and notifications use Cloudflare-native services. A small ephemeral Cloudflare Container is used only as the Tor network collector.

Core responsibilities:

- Worker: API, authorization, tenancy, quotas, validation and orchestration.
- Workflows: durable investigation lifecycle and retries.
- Queues: continuous-monitoring jobs and asynchronous notifications.
- D1: application metadata, subscriptions, investigation state, watchlists and audit records.
- R2: retained evidence objects and generated reports.
- KV: Clerk JWKS/config cache.
- Workers AI: query refinement, result ranking and grounded defensive analysis.
- Vectorize: optional semantic correlation across findings after the production index is provisioned.
- AI Search: tenant-scoped investigation knowledge search and RAG.
- Analytics Engine: privacy-safe product and cost telemetry using hashed tenant keys.
- Rate Limiter: application abuse protection; D1 remains authoritative for plan quotas.
- Flagship: feature flags and safe rollout.
- Browser Run: allowlisted HTTPS clear-web enrichment only.
- Email Service: optional security email delivery after the Cloudflare email account/domain is onboarded.
- Version metadata: release-aware observability.
- Durable Objects + Containers: one serialized, short-lived Tor collector.

The Container intentionally contains no customer accounts, billing logic, persistent application database, report engine or AI/provider credentials. Collector application traffic is forced through Tor's SOCKS resolver and only validated v3 `.onion` URLs on ports 80/443 are accepted.

## Safety model

This project is for defensive monitoring, exposure discovery and threat intelligence. It does not expose an arbitrary proxy, generic URL fetcher, vulnerability exploitation workflow or internal-network scanner.

Evidence returned from Tor is treated as untrusted data. AI prompts instruct models not to follow retrieved instructions, and the raw evidence is kept separate from product analytics.

## Deployment

The production Worker is `zbtdarkweb-scan`.

The production KV namespace is already explicitly bound. D1, R2, AI Search, Flagship and Queues use Wrangler automatic provisioning where supported. The Worker also self-initializes the idempotent D1 schema so a newly provisioned database is usable immediately; the formal D1 migration remains in `migrations/`.

External account-specific values are deliberately not committed to this public repository. Configure Clerk, Stripe and Tor search-source settings through Cloudflare variables/secrets after deployment. `keep_vars: true` prevents Wrangler deployments from overwriting dashboard-managed plaintext variables.

```bash
bun install
bun run check
bun run deploy
```

`bun run check` performs TypeScript validation and a Wrangler dry-run. GitHub CI performs the same deployment-config validation plus dependency/security checks.

The container image is built from `Dockerfile` by Wrangler during deployment.

## Optional production integrations

Vectorize is optional until a 768-dimension cosine index is created and bound as `INTELLIGENCE_INDEX`. Correlation returns a controlled unavailable response while the binding is absent; core investigations remain functional.

Email delivery is also optional until Cloudflare Email Service/Email Routing is onboarded. Notification events remain recorded in D1 rather than causing queue retry loops when the email binding is absent.

See `docs/CLOUDFLARE_SETUP.md` for the remaining account-level setup.

## Data retention

Raw R2 evidence is subject to `EVIDENCE_RETENTION_DAYS` (90 days by default). Scheduled Worker maintenance deletes expired evidence objects and clears their R2 references while retaining investigation metadata needed for audit and monitoring history. A native R2 lifecycle rule should be configured as a second enforcement layer once the provisioned bucket name is known.

## Security

Never commit credentials, API keys, `.dev.vars` or customer data. Runtime secrets belong in Cloudflare Worker Secrets or an explicitly configured Cloudflare Secrets Store. See `SECURITY.md`.
