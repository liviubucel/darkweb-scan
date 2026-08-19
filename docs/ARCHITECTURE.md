# Architecture

## Trust boundaries

1. **Internet edge** — Cloudflare DNS/WAF protects the Worker.
2. **Application Worker** — validates identity, organization, entitlement,
   rate limits and request shape.
3. **Cloudflare data plane** — D1, KV, R2, Workers AI, Vectorize, AI Search,
   Analytics Engine, Flagship, Browser Run, Queues and Workflows are accessed
   through bindings.
4. **Tor collector boundary** — a `lite` Container with outbound network access
   is started only for Tor search/fetch and is stopped after selected sources
   are collected.

## Investigation path

1. Authenticated request creates an investigation row in D1.
2. A Workflow starts with the immutable organization/user/investigation IDs.
3. Workers AI refines the defensive search query.
4. The Tor collector queries configured onion indexes and returns metadata only.
5. Workers AI ranks metadata; only the top bounded set is selected.
6. The same named Container fetches those selected `.onion` URLs.
7. The Container returns normalized text and hashes, then shuts down.
8. Deterministic parsers extract IOCs; Workers AI generates grounded analysis.
9. D1 persists structured findings. Large evidence/report objects can be stored
   in R2 under retention rules.
10. Queue consumers create notifications and alert records.

Follow-up questions and reports use stored investigation context and do not
wake the Tor Container.

## Resource policy

Use a Cloudflare capability when it creates a clear security, reliability,
performance or operating-cost advantage. Do not add bindings merely because
they exist.

Deferred until there is a concrete workload:
- Dynamic Workers: isolated customer-defined analysis code.
- mTLS: B2B API integrations requiring client certificates.
- VPC Service/Network: private enterprise network connectivity.
- Hyperdrive: only if an external PostgreSQL/MySQL database is introduced.
- Images/Media/Stream: only if the product gains a relevant media workflow.
