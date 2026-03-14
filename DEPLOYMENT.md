# Deployment notes (secure Cloudflare Worker UI + Railway backend)

## Target architecture

Use this split:

```text
Browser -> Cloudflare Worker (UI + proxy) -> Railway FastAPI -> Tor -> .onion sources
```

The Worker serves the UI and forwards requests.
The Railway service runs Python, Tor, scraping, and LLM calls.

## Security model

Do not hardcode secrets in the repository.

Use these runtime secrets:

- Cloudflare Worker:
  - `PYTHON_BACKEND_URL`
  - `BACKEND_SHARED_SECRET`
- Railway:
  - `BACKEND_SHARED_SECRET`
  - `ALLOWED_ORIGINS`
  - `TOR_SOCKS_HOST` optional, default `127.0.0.1`
  - `TOR_SOCKS_PORT` optional, default `9050`
  - `TOR_BOOTSTRAP_TIMEOUT` optional, default `45`
  - your LLM provider keys

The Worker sends `x-backend-secret` to the backend.
The backend rejects any scan request without the correct secret.

## Railway backend setup

Railway should run the Docker container from this repository.
Do not set a custom start command in Railway.
The Docker container already starts Tor and then starts `uvicorn` using `PORT`.

### 1. Create the Railway service

1. Push this repository to GitHub.
2. In Railway, create a new project from this repo.
3. Make sure it builds from the repository Dockerfile.
4. If Railway has a custom Start Command set in the dashboard, remove it.

### 2. Add Railway variables

Set these in Railway `Variables`:

- `BACKEND_SHARED_SECRET`
- `ALLOWED_ORIGINS`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `OLLAMA_BASE_URL` if needed

Example:

- `BACKEND_SHARED_SECRET` = a long random string
- `ALLOWED_ORIGINS` = `https://your-worker.your-subdomain.workers.dev`

### 3. Deploy and verify Railway

After deploy, Railway gives you a public URL such as:

```text
https://your-app.up.railway.app
```

Verify:

- `GET https://your-app.up.railway.app/health`

Expected result:

```json
{
  "status": "healthy",
  "tor_available": true
}
```

Do not test `POST /api/darkweb-scan` directly from the browser unless you also send the shared secret header.

## Cloudflare Worker setup

The Worker is the public frontend and proxy.

### 1. Add Worker secrets

In Cloudflare Worker settings, add:

- `PYTHON_BACKEND_URL` = your Railway public URL
- `BACKEND_SHARED_SECRET` = exactly the same value as in Railway

Use Cloudflare secrets/variables, not `wrangler.toml`, for these values.

### 2. Deploy the Worker

From `cloudflare-worker/`:

```bash
wrangler deploy
```

### 3. Verify Worker

Check:

- Worker root URL loads the UI
- `GET /health` on the Worker works
- submitting a query from the UI reaches Railway

## End-to-end checklist

1. Railway uses Dockerfile build.
2. Railway has no custom Start Command override.
3. Railway `BACKEND_SHARED_SECRET` is set.
4. Railway `ALLOWED_ORIGINS` matches the Worker domain.
5. Worker `PYTHON_BACKEND_URL` points to Railway.
6. Worker `BACKEND_SHARED_SECRET` matches Railway.
7. Worker UI loads and scan requests succeed.
