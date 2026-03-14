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
  const backendBase = env.PYTHON_BACKEND_URL?.replace(/\/+$/, "");
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
      model: payload.model ?? "auto",
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
      :root {
        --bg: #f4efe3;
        --panel: rgba(255, 251, 245, 0.9);
        --ink: #1e1a16;
        --muted: #5f564d;
        --line: rgba(40, 29, 20, 0.12);
        --accent: #c94f2d;
        --accent-2: #184c61;
        --ok: #2e6a4f;
        --warn: #9a6611;
        --shadow: 0 20px 50px rgba(54, 39, 26, 0.12);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(201, 79, 45, 0.16), transparent 28%),
          radial-gradient(circle at top right, rgba(24, 76, 97, 0.18), transparent 32%),
          linear-gradient(180deg, #f7f1e7 0%, #efe5d6 100%);
        min-height: 100vh;
      }

      .shell {
        width: min(1120px, calc(100% - 32px));
        margin: 32px auto 56px;
      }

      .hero {
        padding: 28px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--panel);
        backdrop-filter: blur(8px);
        box-shadow: var(--shadow);
      }

      .eyebrow {
        margin: 0 0 10px;
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font: 700 12px/1.2 Arial, sans-serif;
      }

      h1 {
        margin: 0;
        font-size: clamp(2.2rem, 5vw, 4.6rem);
        line-height: 0.95;
      }

      .sub {
        max-width: 760px;
        margin: 14px 0 0;
        color: var(--muted);
        font: 400 1.05rem/1.65 Arial, sans-serif;
      }

      .search {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 14px;
        margin-top: 24px;
      }

      textarea {
        width: 100%;
        min-height: 112px;
        resize: vertical;
        padding: 18px 18px;
        border-radius: 20px;
        border: 1px solid rgba(32, 24, 16, 0.18);
        background: rgba(255, 255, 255, 0.8);
        color: var(--ink);
        font: 400 1rem/1.6 Arial, sans-serif;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);
      }

      button {
        align-self: stretch;
        min-width: 172px;
        border: 0;
        border-radius: 18px;
        padding: 0 22px;
        color: white;
        background: linear-gradient(135deg, var(--accent), #a63e20);
        font: 700 1rem/1 Arial, sans-serif;
        cursor: pointer;
        box-shadow: 0 14px 30px rgba(158, 64, 33, 0.28);
      }

      button:disabled {
        cursor: wait;
        opacity: 0.75;
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 14px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.72);
        color: var(--muted);
        font: 600 0.9rem/1 Arial, sans-serif;
      }

      .layout {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 20px;
        margin-top: 22px;
      }

      .panel {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--panel);
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      .section {
        padding: 22px;
        border-top: 1px solid var(--line);
      }

      .section:first-child {
        border-top: 0;
      }

      .label {
        margin: 0 0 8px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font: 700 11px/1.2 Arial, sans-serif;
      }

      .big {
        margin: 0;
        font-size: 1.95rem;
        line-height: 1;
      }

      .copy {
        margin: 0;
        color: var(--muted);
        font: 400 0.98rem/1.7 Arial, sans-serif;
      }

      .status {
        display: none;
        margin-top: 18px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.72);
        font: 600 0.95rem/1.5 Arial, sans-serif;
      }

      .status.visible { display: block; }
      .status.loading { color: var(--accent-2); }
      .status.ok { color: var(--ok); }
      .status.warn { color: var(--warn); }
      .status.error { color: #8e1f1f; }

      .summary {
        white-space: pre-wrap;
        color: var(--ink);
        font: 400 1rem/1.8 Arial, sans-serif;
      }

      .empty {
        display: none;
        padding: 34px 24px;
        text-align: center;
      }

      .empty.visible { display: block; }

      .empty h2 {
        margin: 0 0 12px;
        font-size: 1.8rem;
      }

      .results {
        display: grid;
        gap: 14px;
      }

      .result {
        padding: 18px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.72);
      }

      .result h3 {
        margin: 0 0 8px;
        font-size: 1.1rem;
      }

      .result a {
        color: var(--accent-2);
        text-decoration: none;
        word-break: break-all;
        font: 600 0.94rem/1.5 Arial, sans-serif;
      }

      .result p {
        margin: 10px 0 0;
        color: var(--muted);
        font: 400 0.96rem/1.65 Arial, sans-serif;
      }

      .hidden {
        display: none;
      }

      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .search {
          grid-template-columns: 1fr;
        }

        button {
          min-height: 56px;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">ZebraByte Dark Web Scan</p>
        <h1>Dark web search, explained like a normal product.</h1>
        <p class="sub">
          Write what you want to investigate. The system will search dark web indexes,
          extract likely matches, and present the findings in plain language instead of raw JSON.
        </p>

        <div class="search">
          <textarea id="query" placeholder="Example: leaked credentials for company x, ransomware leak site, combo list for sector y"></textarea>
          <button id="run">Run scan</button>
        </div>

        <div class="meta">
          <div class="pill">UI on Cloudflare Worker</div>
          <div class="pill">Search and Tor on backend</div>
          <div class="pill">Built for non-technical review</div>
        </div>

        <div id="status" class="status"></div>
      </section>

      <section class="layout">
        <aside class="panel">
          <div class="section">
            <p class="label">Original Query</p>
            <p id="queryValue" class="copy">No search yet.</p>
          </div>
          <div class="section">
            <p class="label">Refined Query</p>
            <p id="refinedValue" class="copy">Waiting for first scan.</p>
          </div>
          <div class="section">
            <p class="label">Results Found</p>
            <p id="resultCount" class="big">0</p>
          </div>
          <div class="section">
            <p class="label">What This Means</p>
            <p id="meaningValue" class="copy">
              Search results and summary will appear here after the first run.
            </p>
          </div>
        </aside>

        <section class="panel">
          <div id="emptyState" class="empty visible">
            <h2>Start with a query</h2>
            <p class="copy">
              Try a topic like <strong>ransomware leak site</strong>,
              <strong>breach database</strong>, or <strong>combo list</strong>.
            </p>
          </div>

          <div id="resultsWrap" class="hidden">
            <div class="section">
              <p class="label">Summary</p>
              <div id="summary" class="summary"></div>
            </div>
            <div class="section">
              <p class="label">Sources</p>
              <div id="results" class="results"></div>
            </div>
          </div>
        </section>
      </section>
    </main>

    <script>
      const statusEl = document.getElementById("status");
      const queryEl = document.getElementById("query");
      const runBtn = document.getElementById("run");
      const queryValueEl = document.getElementById("queryValue");
      const refinedValueEl = document.getElementById("refinedValue");
      const resultCountEl = document.getElementById("resultCount");
      const meaningValueEl = document.getElementById("meaningValue");
      const summaryEl = document.getElementById("summary");
      const resultsEl = document.getElementById("results");
      const resultsWrapEl = document.getElementById("resultsWrap");
      const emptyStateEl = document.getElementById("emptyState");

      function setStatus(text, type) {
        statusEl.textContent = text;
        statusEl.className = "status visible " + type;
      }

      function clearStatus() {
        statusEl.textContent = "";
        statusEl.className = "status";
      }

      function setLoading(isLoading) {
        runBtn.disabled = isLoading;
        runBtn.textContent = isLoading ? "Scanning..." : "Run scan";
      }

      function escapeHtml(value) {
        return value
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;");
      }

      function renderNoResults(data) {
        queryValueEl.textContent = data.query || "No query";
        refinedValueEl.textContent = data.refined_query || "No refined query";
        resultCountEl.textContent = "0";
        meaningValueEl.textContent =
          "The scan completed, but the dark web indexes queried by the backend did not return usable matches for this term.";
        summaryEl.textContent =
          "No relevant results were found for this search right now. This usually means the query is too narrow, the indexed hidden services are offline, or the current onion indexes do not contain matching data.";
        resultsEl.innerHTML = "";
        emptyStateEl.classList.add("visible");
        emptyStateEl.innerHTML =
          "<h2>No results found</h2><p class='copy'>Try broader or adjacent terms such as <strong>breach</strong>, <strong>combo</strong>, <strong>dump</strong>, <strong>forum</strong>, or a company and incident name together.</p>";
        resultsWrapEl.classList.remove("hidden");
      }

      function renderResults(data) {
        queryValueEl.textContent = data.query || "No query";
        refinedValueEl.textContent = data.refined_query || "No refined query";
        resultCountEl.textContent = String(data.total_results ?? 0);
        meaningValueEl.textContent =
          (data.total_results ?? 0) > 0
            ? "The scan found candidate pages. Review the source cards first, then use the summary to decide what deserves deeper investigation."
            : "The scan ran successfully but did not find useful pages for this query.";

        summaryEl.textContent = data.summary || "No summary available.";
        resultsEl.innerHTML = (data.results || [])
          .map((item) => {
            const title = escapeHtml(item.title || "Untitled result");
            const url = escapeHtml(item.url || "");
            const snippet = escapeHtml(item.snippet || "No snippet available.");
            return '<article class="result">' +
              "<h3>" + title + "</h3>" +
              '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + "</a>" +
              "<p>" + snippet + "</p>" +
              "</article>";
          })
          .join("");

        emptyStateEl.classList.remove("visible");
        resultsWrapEl.classList.remove("hidden");

        if (!data.results || data.results.length === 0) {
          renderNoResults(data);
        }
      }

      async function runScan() {
        const query = queryEl.value.trim();
        if (!query) {
          setStatus("Write a search query first.", "warn");
          return;
        }

        setLoading(true);
        setStatus("Searching dark web indexes and collecting candidate pages...", "loading");

        try {
          const res = await fetch("/api/darkweb-scan", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ query }),
          });

          const contentType = res.headers.get("content-type") || "";
          const data = contentType.includes("application/json")
            ? await res.json()
            : { error: await res.text() };

          if (!res.ok) {
            throw new Error(data.detail || data.error || "Scan failed.");
          }

          renderResults(data);

          if ((data.total_results ?? 0) > 0) {
            setStatus("Scan complete. Results are ready to review.", "ok");
          } else {
            setStatus("Scan complete. No matching results were found for this query.", "warn");
          }
        } catch (err) {
          emptyStateEl.classList.add("visible");
          emptyStateEl.innerHTML =
            "<h2>Scan failed</h2><p class='copy'>The backend could not complete this request. Check provider quota, backend secrets, or temporary onion index availability.</p>";
          resultsWrapEl.classList.add("hidden");
          setStatus(err.message || "Unexpected error.", "error");
        } finally {
          setLoading(false);
        }
      }

      runBtn.addEventListener("click", runScan);
      queryEl.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          runScan();
        }
      });
    </script>
  </body>
</html>`;
}
