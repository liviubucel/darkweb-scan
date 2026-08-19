# Production readiness checklist

This file separates repository work from account-level configuration that cannot safely live in source control.

## Repository / Worker

- [x] Worker name aligned with Cloudflare Git build: `zbtdarkweb-scan`.
- [x] Current Wrangler and Workers runtime types pinned.
- [x] Production KV namespace bound as `CACHE`.
- [x] D1/R2/AI Search/Flagship/Queues configured for supported Wrangler provisioning.
- [x] D1 schema is idempotent and self-bootstraps at runtime.
- [x] GitHub CI validates TypeScript and performs a Wrangler deployment dry-run.
- [x] Tor collector restricted to validated v3 `.onion` HTTP/HTTPS URLs on ports 80/443.
- [x] Collector application traffic forced through Tor SOCKS5h.
- [x] One shared `lite` Container, one instance maximum, serialized calls, 10-second idle sleep.
- [x] Workflow scrape output bounded below the 1 MiB persisted-step result limit.
- [x] Workers AI input/output budgets bounded to model context limits.
- [x] D1 quota enforcement separated from request rate limiting.
- [x] Monitoring baseline/change detection wired into the Workflow.
- [x] Notification delivery idempotent.
- [x] Evidence retention enforced by scheduled Worker maintenance.
- [x] Tenant identifiers hashed before Vectorize/Analytics namespace/index use.
- [x] Public production configuration contains no fake `REPLACE_*` values.

## Cloudflare account

- [ ] Confirm the next Cloudflare Git deployment completes with the current `main` branch.
- [ ] Confirm auto-provisioned D1, R2, AI Search, Flagship and Queues appear in the Worker bindings.
- [ ] Run/confirm the D1 migration record with `bun run db:migrate` after the provisioned database exists.
- [ ] Add a native R2 lifecycle rule for the provisioned evidence bucket (90 days by default).
- [ ] Create and bind the 768-dimension cosine Vectorize index if semantic correlation is required.
- [ ] Onboard Cloudflare Email Service/Email Routing and verify the ZebraByte sender domain/address before adding the `EMAIL` binding.
- [ ] Attach the final custom domain and verify `/api/health` through that domain.

## Clerk

- [ ] Configure `CLERK_ISSUER`.
- [ ] Configure `CLERK_JWKS_URL`.
- [ ] Configure `CLERK_AUTHORIZED_PARTIES` for the final application origin(s).
- [ ] Configure `CLERK_AUDIENCE` if the production token template uses an audience.
- [ ] Verify a real organization token resolves to the correct organization ID and role.

## Stripe

- [ ] Configure `STRIPE_PRICE_PRO`.
- [ ] Configure `STRIPE_PRICE_BUSINESS`.
- [ ] Store `STRIPE_SECRET_KEY` as a Cloudflare secret.
- [ ] Store `STRIPE_WEBHOOK_SECRET` as a Cloudflare secret.
- [ ] Register the production `/api/stripe/webhook` endpoint in Stripe.
- [ ] Verify Checkout, subscription update/cancel and Billing Portal end-to-end.

## Tor collector

- [ ] Store `ONION_SEARCH_ENGINES_JSON` as a Cloudflare secret or real Secrets Store binding.
- [ ] Confirm deployed Container logs reach `Bootstrapped 100%`.
- [ ] Run one controlled defensive investigation and verify search, scrape, R2 evidence, D1 metadata and completion state.
- [ ] Run a second monitoring investigation and verify baseline/change comparison.

## Security / operations

- [ ] Revoke/rotate any credential that ever appeared in superseded Git history.
- [ ] Remove the obsolete external deployment integration that still posts unrelated GitHub status checks.
- [ ] Review Cloudflare WAF/rate-limit rules at the final custom domain.
- [ ] Confirm observability/log retention contains no raw customer evidence outside the intended R2/D1 stores.

A deployment is production-ready only after the account-level checks above are completed against the real Cloudflare environment. Repository correctness alone cannot prove Tor bootstrap, Clerk issuance, Stripe webhooks, sender-domain verification or external resource permissions.
