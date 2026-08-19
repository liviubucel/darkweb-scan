# Security Policy

Report suspected vulnerabilities through ZebraByte's security reporting
channel rather than opening a public issue containing exploit details,
credentials, personal data or dark-web evidence.

## Repository rules

- No production secrets, tokens or credentials in Git.
- No raw dark-web evidence in logs, issues, CI artifacts or Analytics Engine.
- No wildcard CORS for authenticated APIs.
- No arbitrary URL fetch endpoint.
- Tor collection is restricted to validated `.onion` hostnames and ports 80/443.
- Clear-web browser enrichment uses an explicit hostname allowlist.
- Customer isolation is enforced by organization ID on every data query.
- Application quotas are authoritative in D1; edge rate limiting is
  supplementary abuse protection.
- Secrets Store is used for runtime secrets.
