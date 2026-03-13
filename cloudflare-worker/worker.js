export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (url.pathname === "/api/darkweb-scan" && request.method === "POST") {
      return proxyScanRequest(request, env);
    }

    if (url.pathname === "/health") {
      return Response.json(
        { status: "ok", service: "cloudflare-worker" },
        { headers: corsHeaders() }
      );
    }

    return new Response(frontendHtml(), {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        ...corsHeaders(),
      },
    });
  },
};

async function proxyScanRequest(request, env) {
  const backendBase = env.PYTHON_BACKEND_URL;
  const backendSecret = env.BACKEND_SHARED_SECRET;

  if (!backendBase) {
    return Response.json(
      { error: "PYTHON_BACKEND_URL is not configured." },
      { status: 500, headers: corsHeaders() }
    );
  }

  if (!backendSecret) {
    return Response.json(
      { error: "BACKEND_SHARED_SECRET is not configured." },
      { status: 500, headers: corsHeaders() }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: corsHeaders() }
    );
  }

  const backendResponse = await fetch(`${backendBase}/api/darkweb-scan`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-backend-secret": backendSecret,
    },
    body: JSON.stringify({
      query: payload.query,
      threads: payload.threads ?? 4,
      model: payload.model ?? "gemini-2.5-flash",
    }),
  });

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: {
      "content-type":
        backendResponse.headers.get("content-type") ?? "application/json",
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
}

function frontendHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>ZebraByte Dark Web Scan</title>
    <style>
      body { font-family: sans-serif; margin: 2rem; max-width: 900px; }
      textarea { width: 100%; min-height: 100px; }
      button { margin-top: 12px; padding: 8px 14px; }
      pre { white-space: pre-wrap; background: #111; color: #eee; padding: 1rem; border-radius: 8px; }
    </style>
  </head>
  <body>
    <h1>ZebraByte Dark Web Scan</h1>
    <p>UI runs on Cloudflare Worker. Heavy Python/Tor scan runs on backend.</p>
    <textarea id="query" placeholder="ex: leaked credentials company-x"></textarea>
    <br />
    <button id="run">Run scan</button>
    <pre id="out">Ready.</pre>
    <script>
      const out = document.getElementById("out");
      document.getElementById("run").onclick = async () => {
        const query = document.getElementById("query").value.trim();
        if (!query) {
          out.textContent = "Please enter a query.";
          return;
        }
        out.textContent = "Scanning...";
        try {
          const res = await fetch("/api/darkweb-scan", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ query }),
          });
          const data = await res.json();
          out.textContent = JSON.stringify(data, null, 2);
        } catch (err) {
          out.textContent = "Error: " + err.message;
        }
      };
    </script>
  </body>
</html>`;
}
