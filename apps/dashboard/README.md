# ZebraByte Dark Web Intelligence Dashboard

Production dashboard for the ZebraByte Dark Web Intelligence engine.

## Architecture

This application is intentionally deployed as a separate Cloudflare Worker from `zbtdarkweb-scan`.

- Next.js 16 App Router + React 19
- shadcn/ui conventions (`base-nova`) + Tailwind CSS 4
- Clerk for user, organization and session management
- TanStack Query for server-state caching
- TanStack Table for investigation tables
- Recharts for investigation activity derived from real workflow records
- OpenNext for Cloudflare Workers
- Cloudflare Service Binding `INTELLIGENCE_API` to `zbtdarkweb-scan`

The browser calls only same-origin `/api/engine/*` routes. Those route handlers forward authenticated requests over the Service Binding. The engine remains the source of truth for authorization, rate limits, quotas and plan enforcement.

## Cloudflare deployment

Create a second Workers Build for this repository with the root directory set to:

```text
apps/dashboard
```

Use:

```text
Build command: bun run build
Deploy command: bun run deploy
```

Set the Clerk build/runtime variables from `.env.example` in Cloudflare Workers Builds. Do not commit production Clerk keys.

The Wrangler config binds:

```text
INTELLIGENCE_API -> zbtdarkweb-scan
```

## Security properties

- No authentication tokens are written to `localStorage`.
- Workspace pages require Clerk authentication on the server.
- Engine requests are authenticated again by the backend Worker.
- No OpenAI, Gemini, Anthropic or Sentry dependency is included.
- Raw `.onion` URLs are not rendered as clickable links in investigation detail.
- Security response headers are emitted by the Next.js Worker.
- Billing prices are not hard-coded in the frontend; Stripe remains the billing source of truth.

## Local development

Run the engine and dashboard separately. Service Bindings are resolved by Wrangler in Cloudflare preview mode; standard `next dev` is intended for UI development.

```bash
bun install
bun run dev
```

For a production-runtime preview:

```bash
bun run preview
```
