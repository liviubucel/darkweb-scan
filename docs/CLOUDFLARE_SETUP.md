# Cloudflare resource setup

`wrangler.jsonc` is intentionally explicit about every production binding.
Replace all `REPLACE_*` values before deployment.

## Create resources

Suggested names:

- D1: `zebrabyte-darkweb`
- KV: `zebrabyte-darkweb-cache`
- R2: `zebrabyte-darkweb-evidence`
- Vectorize: `zebrabyte-darkweb-intelligence` (768 dimensions, cosine metric)
- Queue: `zebrabyte-darkweb-notifications`
- DLQ: `zebrabyte-darkweb-notifications-dlq`
- Workflow: declared by Wrangler
- Flagship app: `ZebraByte Dark Web Intelligence`
- AI Search namespace: `default`

Create Vectorize with the same embedding shape used by the Worker:

```bash
npx wrangler vectorize create zebrabyte-darkweb-intelligence --dimensions=768 --metric=cosine
```

After creating D1, apply the schema:

```bash
npx wrangler d1 migrations apply zebrabyte-darkweb --remote
```

## Secrets Store

Create or reuse the account Secrets Store and add these Workers-scoped secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ONION_SEARCH_ENGINES_JSON`

The final secret is a JSON array of objects with this shape:

```json
[
  {
    "name": "approved-index",
    "url_template": "http://<56-character-v3-host>.onion/search?q={query}"
  }
]
```

The collector validates every configured search URL and every discovered URL
as a v3 `.onion` target before making a request.

## Clerk

Set the non-secret Worker variables:

- `CLERK_ISSUER`
- `CLERK_JWKS_URL`
- optional `CLERK_AUDIENCE`

The API expects a Clerk session token as a Bearer token and verifies RS256
signature, issuer, expiry, not-before and audience. Organization ID from the
verified token is the tenancy boundary.

## Cost guardrails

- Container type: `lite`.
- `max_instances`: 1 initially.
- Container idle sleep: 10 seconds.
- Workflow selects a bounded source set before scraping.
- Follow-up analysis uses persisted data and does not start Tor.
- D1 is authoritative for quota accounting; Rate Limiter is anti-abuse only.
- Raw evidence is not written to Analytics Engine.
