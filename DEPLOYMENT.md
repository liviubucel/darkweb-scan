# Deployment notes (Vercel / Railway / Cloudflare Worker)

## Why Vercel fails for this project

This scanner needs a **long-running Python process + local Tor daemon (SOCKS5 on 127.0.0.1:9050)** to query `.onion` sources.

Vercel serverless functions are not a good fit because:
- no persistent Tor service in the same runtime,
- strict execution time limits for slow dark-web queries,
- thread-heavy scraping workload is better in a regular container.

## Recommended split architecture

- **Cloudflare Worker**: edge UI + lightweight API proxy.
- **Railway (or similar container platform)**: Python FastAPI backend with Tor installed/running.

```text
Browser -> Cloudflare Worker (UI/proxy) -> Railway FastAPI -> Tor -> .onion sources
```

## Railway backend setup

1. Deploy this repository on Railway.
2. Use start command:
   `uvicorn api_server:app --host 0.0.0.0 --port ${PORT}`
3. Ensure environment variables for your LLM provider are configured.
4. Verify backend:
   - `GET /health`
   - `POST /api/darkweb-scan`

## Cloudflare Worker setup

1. Go to `cloudflare-worker/`.
2. Set `PYTHON_BACKEND_URL` in `wrangler.toml` (or env vars in dashboard).
3. Deploy with Wrangler.
4. The worker serves a minimal UI and forwards POST `/api/darkweb-scan` to Python backend.

## If you still want Vercel

Use Vercel only for static frontend (or Next.js UI), and call the Railway API for scan jobs.
Do not run Tor-dependent scan logic inside Vercel serverless functions.
