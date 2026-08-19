"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IconArrowRight, IconAlertTriangle, IconLoader2, IconRadar, IconShieldCheck, IconShieldSearch } from "@tabler/icons-react";
import { engine } from "@/lib/api";
import type { Investigation } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RiskBadge, StatusBadge } from "@/components/dashboard/status";
import { cn } from "@/lib/utils";

function buildTrend(items: Investigation[]) {
  const output: Array<{ day: string; investigations: number }> = [];
  const today = new Date();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset));
    const key = date.toISOString().slice(0, 10);
    output.push({ day: key, investigations: items.filter((item) => item.created_at.slice(0, 10) === key).length });
  }
  return output;
}

export function OverviewClient() {
  const investigations = useQuery({ queryKey: ["investigations", 50], queryFn: () => engine.investigations(50, 0), refetchInterval: 20_000 });
  const me = useQuery({ queryKey: ["me"], queryFn: engine.me });
  const watchlists = useQuery({ queryKey: ["watchlists"], queryFn: engine.watchlists });
  const health = useQuery({ queryKey: ["health"], queryFn: engine.health, refetchInterval: 30_000 });

  const items = investigations.data?.items ?? [];
  const running = items.filter((item) => item.status === "queued" || item.status === "running").length;
  const elevated = items.filter((item) => ["critical", "high"].includes(String(item.risk_level ?? "").toLowerCase())).length;
  const completed = items.filter((item) => item.status === "completed").length;
  const trend = buildTrend(items);
  const usage = me.data?.usage;
  const usagePct = usage?.limit ? (usage.investigations / usage.limit) * 100 : 0;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div><p className="page-eyebrow">Threat intelligence</p><h1 className="page-title">Threat Command</h1><p className="page-description">Operational view of current investigations, monitored assets and evidence-backed exposure signals.</p></div>
        <Link href="/investigations/new" className={buttonVariants({ size: "default" })}>New investigation <IconArrowRight size={15} /></Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Investigations" value={items.length} note={`${completed} completed`} icon={<IconShieldSearch />} />
        <Metric label="Active workflows" value={running} note="Queued or running" icon={running ? <IconLoader2 className="animate-spin" /> : <IconShieldCheck />} />
        <Metric label="Elevated findings" value={elevated} note="High or critical risk" icon={<IconAlertTriangle />} danger={elevated > 0} />
        <Metric label="Watchlists" value={watchlists.data?.items.length ?? 0} note="Continuous monitoring targets" icon={<IconRadar />} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,.7fr)]">
        <Card>
          <CardHeader><div><p className="page-eyebrow">14 day activity</p><CardTitle>Investigation volume</CardTitle></div><span className="font-mono text-[10px] text-muted-foreground">REAL WORKFLOW DATA</span></CardHeader>
          <CardContent className="h-[280px] pt-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="oklch(0.22 0 0)" />
                <XAxis dataKey="day" tickFormatter={(value) => value.slice(5)} axisLine={false} tickLine={false} tick={{ fill: "oklch(0.58 0 0)", fontSize: 10 }} minTickGap={28} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "oklch(0.58 0 0)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "oklch(0.14 0 0)", border: "1px solid oklch(0.23 0 0)", borderRadius: 6, fontSize: 11 }} labelStyle={{ color: "oklch(0.65 0 0)" }} />
                <Area type="monotone" dataKey="investigations" stroke="oklch(0.84 0 0)" fill="oklch(0.84 0 0)" fillOpacity={0.06} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><p className="page-eyebrow">Current plan</p><CardTitle>{me.data?.plan?.toUpperCase() ?? "—"}</CardTitle></div></CardHeader>
          <CardContent className="space-y-5">
            <div><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">Monthly investigations</span><span className="font-mono">{usage ? `${usage.investigations} / ${usage.limit}` : "—"}</span></div><Progress value={usagePct} /></div>
            <dl className="space-y-3 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Engine</dt><dd>{health.data?.ready ? "Operational" : "Configuration pending"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Workers AI</dt><dd>Native binding</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Evidence store</dt><dd>{health.data?.configuration.database ? "Available" : "Unavailable"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">AI Search</dt><dd>{health.data?.configuration.aiSearch ? "Available" : "Unavailable"}</dd></div>
            </dl>
            <Link href="/billing" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>Plan & billing</Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader><div><p className="page-eyebrow">Priority queue</p><CardTitle>Recent investigations</CardTitle></div><Link href="/investigations" className="text-xs text-muted-foreground hover:text-foreground">View all</Link></CardHeader>
        <div className="divide-y divide-border">
          {items.slice(0, 7).map((item) => (
            <Link key={item.id} href={`/investigations/${item.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_120px_90px_100px] sm:items-center">
              <div className="min-w-0"><p className="m-0 truncate text-[13px] font-medium">{item.query}</p><p className="m-0 mt-1 truncate font-mono text-[10px] text-muted-foreground">{item.profile} · {relativeTime(item.created_at)}</p></div>
              <div className="hidden sm:block"><StatusBadge status={item.status} /></div>
              <div className="hidden sm:block"><RiskBadge risk={item.risk_level} /></div>
              <div className="text-right font-mono text-[10px] text-muted-foreground">{item.source_count ?? 0} sources</div>
            </Link>
          ))}
          {!items.length && <div className="data-empty">No investigations yet. Start with an asset or identity you are authorized to investigate.</div>}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, note, icon, danger = false }: { label: string; value: number; note: string; icon: React.ReactNode; danger?: boolean }) {
  return <Card><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="page-eyebrow">{label}</p><div className={cn("metric-number", danger && "text-red-300")}>{value}</div></div><span className={cn("grid size-8 place-items-center rounded-md border border-border text-muted-foreground [&_svg]:size-4", danger && "border-red-950 text-red-300")}>{icon}</span></div><p className="mb-0 mt-3 text-[11px] text-muted-foreground">{note}</p></CardContent></Card>;
}
