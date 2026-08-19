# ZebraByte Dark Web Intelligence

Cloudflare-native dark web monitoring and threat-intelligence platform by
ZEBRABYTE LIMITED.

## Architecture

The public application runs on Cloudflare Workers. Durable orchestration,
storage, analysis and notifications use Cloudflare-native services. A small
ephemeral Cloudflare Container is used only as the Tor network collector.

Core responsibilities:

- Worker: API, authorization, tenancy, quotas, validation and orchestration.
- Workflows: durable investigation lifecycle and retries.
- Queues: asynchronous notifications and background fan-out.
- D1: application metadata and investigation state.
- R2: large evidence objects and generated reports.
- KV: short-lived cache and JWKS/config cache.
- Workers AI: query refinement, relevance ranking and grounded analysis.
- Vectorize: semantic correlation across findings.
- AI Search: investigation knowledge search and RAG.
- Analytics Engine: privacy-safe product and cost telemetry.
- Rate Limiter: plan-aware application rate limits.
- Flagship: feature flags and safe rollout.
- Browser Run: allowlisted clear-web enrichment only.
- Email Service: security alerts and reports.
- Secrets Store: account-level runtime secrets.
- Version metadata: release-aware observability.
- Durable Objects + Containers: isolated, short-lived Tor access.

The Container intentionally contains no customer accounts, billing logic,
persistent application database, report engine or AI provider credentials.

## Safety model

This project is for defensive monitoring, exposure discovery and threat
intelligence. The collector accepts only validated `.onion` targets and does
not provide arbitrary URL fetching, vulnerability exploitation or internal
network access.

## Deployment

Resource identifiers in `wrangler.jsonc` use explicit `REPLACE_*` placeholders
until the Cloudflare resources are provisioned. See
`docs/CLOUDFLARE_SETUP.md`.

```bash
npm install
npm run typecheck
npm run deploy
```

The container image is built from `Dockerfile` by Wrangler during deployment.

## Security

Never commit credentials or `.dev.vars`. Runtime secrets belong in Cloudflare
Secrets Store. See `SECURITY.md`.
