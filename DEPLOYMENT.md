# Deployment notes (Cloudflare Worker UI + Railway backend)

## Target architecture

Use this split:

```text
Browser -> Cloudflare Worker (UI + proxy) -> Railway FastAPI -> Tor -> .onion sources
```

This project should not run the dark-web scan directly inside Vercel or Cloudflare Workers because the scan depends on:
- Python packages such as `requests`, `bs4`, and LLM SDKs,
- concurrent scraping,
- a local Tor SOCKS proxy on `127.0.0.1:9050`.

## Why Vercel is not the right backend

Vercel serverless functions are a poor fit for this scanner because they do not provide a stable local Tor daemon and are not designed for slower, thread-heavy dark-web scraping.

Use Vercel only if you want a separate static frontend. Do not place the Tor-dependent scan logic there.

## Railway backend setup

Railway should run the Docker container from this repository. The container installs Tor and starts it before launching the FastAPI app.

Do not override the container start command in Railway. The Docker container now reads `PORT` itself and starts `uvicorn` correctly.

### 1. Create the Railway service

1. Push this repository to GitHub.
2. In Railway, create a new project from that GitHub repo.
3. Make sure Railway builds from the repository Dockerfile.

### 2. Configure environment variables

Set the variables you actually use for the LLM provider:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `OLLAMA_BASE_URL` if applicable

### 3. Deploy the backend

After deploy, Railway should expose a public URL such as:

```text
https://your-app.up.railway.app
```

### 4. Verify the backend

Test these endpoints:

- `GET /health`
- `POST /api/darkweb-scan`

Example request body:

```json
{
  "query": "leaked credentials company x",
  "threads": 4,
  "model": "gpt-5-mini"
}
```

## Cloudflare Worker setup

The Worker already acts as:
- the frontend,
- the public entrypoint,
- the proxy to the Railway backend.

### 1. Configure the backend URL

Open `cloudflare-worker/wrangler.toml` and set:

```toml
PYTHON_BACKEND_URL = "https://your-app.up.railway.app"
```

### 2. Deploy the Worker

From `cloudflare-worker/`, deploy with Wrangler:

```bash
wrangler deploy
```

### 3. Test the Worker

Check:

- `GET /health`
- load the Worker root URL in the browser,
- submit a query from the UI,
- confirm the Worker forwards the request to Railway.

## End-to-end checklist

1. Railway backend is online.
2. `GET https://your-app.up.railway.app/health` returns healthy status.
3. Worker `PYTHON_BACKEND_URL` points to that Railway URL.
4. Worker deploy succeeds.
5. Worker UI loads and `POST /api/darkweb-scan` returns scan results.
