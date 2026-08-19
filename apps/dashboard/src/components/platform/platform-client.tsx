"use client";

import { useQuery } from "@tanstack/react-query";
import { IconRefresh } from "@tabler/icons-react";
import { engine } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PlatformClient() {
  const health = useQuery({ queryKey: ["health"], queryFn: engine.health, refetchInterval: 30_000 });
  const data = health.data;
  const checks = data ? [
    ["D1 database", data.configuration.database, "Investigation state and metadata"],
    ["Authentication", data.configuration.authentication, "Clerk JWT validation"],
    ["Tor search configuration", data.configuration.onionSearchConfigBound, "Collector search source configuration"],
    ["AI Search", data.configuration.aiSearch, "Organization investigation knowledge"],
    ["Stripe secret", data.configuration.stripeSecretBound, "Server-side billing requests"],
    ["Stripe webhook verification", data.configuration.stripeWebhookSecretBound, "Signed subscription synchronization"],
    ["Email service", data.configuration.email, "Notification delivery binding"],
    ["Flagship", data.configuration.flagship, "Optional feature flags"],
    ["Vector intelligence index", data.configuration.vectorize, "Optional correlation index"]
  ] as const : [];

  return (
    <div className="page-shell max-w-6xl">
      <div className="page-header"><div><p className="page-eyebrow">Operations</p><h1 className="page-title">Platform</h1><p className="page-description">Runtime readiness reported directly by the intelligence engine. Optional bindings are shown separately from capabilities required for core investigations.</p></div><Button variant="outline" size="sm" onClick={() => health.refetch()} disabled={health.isFetching}><IconRefresh className={health.isFetching ? "animate-spin" : ""} /> Refresh</Button></div>
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="page-eyebrow">Engine status</p><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${data?.ready ? "bg-emerald-400" : "bg-amber-400"}`} /><span className="text-sm font-semibold">{data?.ready ? "Operational" : "Configuration pending"}</span></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="page-eyebrow">Version</p><p className="m-0 truncate font-mono text-[11px]">{data?.version ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="page-eyebrow">Last check</p><p className="m-0 text-xs">{formatDate(data?.time)}</p></CardContent></Card>
      </div>
      <Card className="mt-3 overflow-hidden"><CardHeader><div><p className="page-eyebrow">Bindings</p><CardTitle>Runtime configuration</CardTitle></div></CardHeader><div className="divide-y divide-border">{checks.map(([name, enabled, description]) => <div key={name} className="grid gap-2 p-4 sm:grid-cols-[220px_minmax(0,1fr)_90px] sm:items-center"><span className="text-[13px] font-medium">{name}</span><span className="text-[11px] text-muted-foreground">{description}</span><div className="sm:text-right"><Badge variant={enabled ? "success" : "neutral"}>{enabled ? "Bound" : "Not bound"}</Badge></div></div>)}{!data && <div className="data-empty">Loading platform health…</div>}</div></Card>
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Workers AI, D1, R2, Queues, Workflow, Durable Object and the Tor container are provisioned at the engine layer. This dashboard communicates with that Worker through a Cloudflare Service Binding.</p>
    </div>
  );
}
