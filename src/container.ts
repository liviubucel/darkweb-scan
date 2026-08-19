import { Container } from "@cloudflare/containers";

export class TorCollector extends Container {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "10s";
  enableInternet = true;
  pingEndpoint = "localhost/health";

  private operationTail: Promise<void> = Promise.resolve();

  override async onActivityExpired(): Promise<void> { await this.stop(); }

  async runRequest(path: "/search" | "/scrape", body: unknown, searchEnginesJson = "[]"): Promise<unknown> {
    const previous = this.operationTail;
    let release!: () => void;
    this.operationTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;

    try {
      await this.startAndWaitForPorts({
        ports: 8080,
        startOptions: {
          envVars: { ONION_SEARCH_ENGINES_JSON: searchEnginesJson, COLLECTOR_MODE: "defensive" },
          enableInternet: true,
        },
        cancellationOptions: { portReadyTimeoutMS: 120_000 },
      });
      const response = await this.containerFetch(`http://localhost${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Collector ${path} failed with ${response.status}`);
      try { return JSON.parse(text); } catch { throw new Error("Collector returned invalid JSON"); }
    } finally {
      release();
    }
  }
}
