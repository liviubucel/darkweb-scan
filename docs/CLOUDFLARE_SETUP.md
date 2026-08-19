# Cloudflare production setup

The repository is designed so the Worker can deploy before account-specific Clerk, Stripe, Email Service or Vectorize configuration is complete. Missing optional integrations degrade to controlled unavailable states instead of blocking the entire Worker deployment.

## Resources managed by Wrangler

The production Worker name is `zbtdarkweb-scan`.

The existing production KV namespace is explicitly bound as `CACHE`.

Wrangler automatic provisioning is used for supported resources where the configuration intentionally omits a resource identifier:

- D1 binding: `DB`
- R2 binding: `EVIDENCE`
- AI Search namespace: `AI_SEARCH` / `default`
- Flagship binding: `FLAGS`
- Queues: `zebrabyte-darkweb-notifications` and `zebrabyte-darkweb-monitoring`
- dead-letter queues declared by the queue consumers

Workers AI, Browser Run, Analytics Engine, Workflows, Rate Limiter, Durable Objects, Containers and Version Metadata are declared directly in `wrangler.jsonc`.

For a deployment executed directly with Wrangler, newly created identifiers can be written back to the local config. For Git-connected deployments from the Cloudflare dashboard, Cloudflare can provision the resources but does not write the generated identifiers back into this Git repository. After the first successful production deployment, record the real production D1 database ID, R2 bucket name and Flagship app ID from the dashboard and pin those identifiers in `wrangler.jsonc` where the binding supports them. This makes the repository the durable source of truth instead of depending indefinitely on dashboard-only generated state.

The D1 binding points at `migrations/`. The Worker also runs an idempotent schema bootstrap once per runtime isolate, which means a newly auto-provisioned D1 database can serve requests immediately and a partially initialized schema can heal missing tables/indexes.

After the production D1 resource has been provisioned and pinned, record/apply the formal migration with:

```bash
bun run db:migrate
```

## Validate before deployment

```bash
bun install
bun run typecheck
bun run deploy:dry
```

or:

```bash
bun run check
```

The GitHub security workflow also performs TypeScript validation, Wrangler dry-run/config validation, dependency audits, Python compilation, Python dependency audit, unresolved-placeholder rejection and legacy-project marker checks.

## Clerk authentication

Configure these Worker plaintext variables in Cloudflare after the Worker exists:

- `CLERK_ISSUER` — required
- `CLERK_JWKS_URL` — required HTTPS JWKS endpoint
- `CLERK_AUDIENCE` — optional if the Clerk token uses an audience you want to enforce
- `CLERK_AUTHORIZED_PARTIES` — recommended comma-separated allowed origins

`CLERK_AUTHORIZED_PARTIES` falls back to the current request origin if it is not configured, so `azp` is still checked rather than accepting any authorized party.

Optional:

- `APP_ORIGIN` — explicit canonical HTTPS application origin. Billing falls back to the HTTPS origin of the current request when this is absent.

Until the required Clerk variables exist, authenticated API routes return a controlled `503 Authentication is not configured`. `/api/health` remains available for deployment/readiness checks and does not disclose secret values.

## Stripe billing

Configure these plaintext Worker variables:

- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_BUSINESS`

Configure these as Cloudflare Worker Secrets, or as bindings from a real Cloudflare Secrets Store after its store ID exists:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

The application accepts either a normal Worker-secret string or a Secrets Store binding exposing `get()`.

The Stripe webhook endpoint is:

```text
/api/stripe/webhook
```

Webhook bodies are size-limited, verified with Stripe HMAC SHA-256 signatures and a five-minute timestamp tolerance before event processing. Subscription events are idempotent in D1.

## Tor search configuration

Configure this as a Worker Secret or Secrets Store secret:

- `ONION_SEARCH_ENGINES_JSON`

Expected JSON shape:

```json
[
  {
    "name": "approved-index",
    "url_template": "http://<56-character-v3-host>.onion/search?q={query}"
  }
]
```

Only configured search indexes are queried. The collector validates configured search URLs, redirects and discovered URLs as v3 `.onion` services; only HTTP/HTTPS and ports 80/443 are accepted.

The collector explicitly disables inherited HTTP proxy environment settings and forces application traffic through `socks5h://127.0.0.1:9050`.

The production Tor configuration uses:

- Container instance type: `lite`
- `max_instances`: `1`
- shared collector Durable Object ID
- serialized collector operations
- `sleepAfter`: `10s`
- Tor bootstrap window: 90 seconds
- Worker container-port readiness timeout: 120 seconds
- scrape response budget: approximately 700 KB, below the Cloudflare Workflows 1 MiB persisted step-result limit

A production deployment is not considered Tor-verified until container logs show `Bootstrapped 100%` and a real defensive investigation completes successfully.

## Vectorize correlation

Vectorize is intentionally optional in the initial deployment because a production index must be created explicitly.

Create the index with the embedding shape used by the Worker:

```bash
npx wrangler vectorize create zebrabyte-darkweb-intelligence --dimensions=768 --metric=cosine
```

Then add this binding to `wrangler.jsonc`:

```json
"vectorize": [
  {
    "binding": "INTELLIGENCE_INDEX",
    "index_name": "zebrabyte-darkweb-intelligence"
  }
]
```

The Worker uses `@cf/baai/bge-base-en-v1.5`, verifies 768-dimensional output and hashes the organization identifier before using it as the Vectorize namespace. Until Vectorize is bound, core investigations still work and correlation returns a controlled unavailable response.

## AI Search

`AI_SEARCH` is a namespace-level binding to the account's `default` AI Search namespace. Each ZebraByte organization receives a hashed tenant instance ID. Only defensive summaries, risk data and source references are indexed; the complete raw evidence remains in R2/D1-backed investigation storage.

## Email Service

Email delivery is intentionally not bound in the initial Wrangler config because Cloudflare requires Email Routing/Email Service onboarding and a verified sender/destination setup first.

After onboarding the sender domain/address, add:

```json
"send_email": [
  {
    "name": "EMAIL"
  }
]
```

`EMAIL_FROM` currently defaults to `security@zebrabyte.ro`; the sender domain/address must be valid for the Cloudflare email account before enabling this binding.

Without the binding, notification jobs do not retry forever. The application records the alert in D1 with `email_not_configured` and acknowledges the Queue message.

## Evidence retention

`EVIDENCE_RETENTION_DAYS` defaults to 90 days.

The scheduled Worker enforces retention at the application layer by deleting expired evidence/report objects from R2 and clearing their object references in D1 while retaining investigation metadata needed for audit and monitoring history.

After Wrangler provisions the real R2 bucket and its name is visible in Cloudflare, add an R2 lifecycle rule as a second enforcement layer, for example:

```bash
npx wrangler r2 bucket lifecycle add <PROVISIONED_BUCKET_NAME> zebrabyte-evidence-expiry evidence/ --expire-days 90
```

## Monitoring and quotas

D1 is authoritative for investigation quotas. Rate Limiter is used only for request abuse protection.

Default monthly investigation quotas:

- Free: 3
- Pro: 100
- Business: 1000
- Enterprise: 10000

Minimum monitoring cadence:

- Pro: 24 hours
- Business: 6 hours
- Enterprise: 1 hour

A new watchlist immediately queues its first baseline investigation. Later completed monitoring runs are compared with the previous completed run using artifact `(type, value)` pairs and source content hashes. Only actual new exposure generates an exposure notification; unchanged monitoring runs do not generate completion spam.

## Health/readiness

Use:

```text
GET /api/health
```

It reports Worker/version health and boolean readiness for optional integrations without returning credentials or secret contents.

## Values that must never be committed

Do not commit:

- Stripe secret keys or webhook secrets
- Clerk private credentials
- Tor source configuration if it is operationally sensitive
- `.dev.vars`
- Cloudflare API tokens
- customer data or retrieved evidence

`keep_vars: true` is enabled so account-specific plaintext variables configured in the Cloudflare dashboard are retained across Wrangler deployments.
