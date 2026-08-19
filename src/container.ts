import { Container } from "@cloudflare/containers";

export class TorCollector extends Container {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "10s";
  enableInternet = true;
  pingEndpoint = "health";

  override async onActivityExpired(): Promise<void> { await this.stop(); }

  async runRequest(path: "/search" | "/scrape", body: unknown, searchEnginesJson: string): Promise<unknown> {
    await this.startAndWaitForPorts({
      ports: 8080,
      startOptions: { envVars: { ONION_SEARCH_ENGINES_JSON: searchEnginesJson, COLLECTOR_MODE: "defensive" }, enableInternet: true },
      cancellationOptions: { portReadyTimeoutMS: 30_000 },
    });
    const response = await this.containerFetch(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const text = await response.text();
    if (!response.ok) throw new Error(`Collector ${path} failed with ${response.status}`);
    try { return JSON.parse(text); } catch { throw new Error("Collector returned invalid JSON"); }
  }

  async shutdown(): Promise<void> { await this.stop(); }
}
