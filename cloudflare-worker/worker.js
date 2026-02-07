const BACKEND_URL = env.PYTHON_BACKEND_URL || 'https://zebrabyte.up.railway.app';

const backendResponse = await fetch(`${BACKEND_URL}/api/darkweb-scan`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: target, threads: 4, model: 'gpt-5-mini' })
});