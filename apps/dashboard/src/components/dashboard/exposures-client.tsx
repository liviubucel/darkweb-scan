"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { IconAlertTriangle, IconClock, IconEyeSearch, IconLoader2, IconScan } from "@tabler/icons-react";
import { engine } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/dashboard/status";
import { cn } from "@/lib/utils";

export function ExposuresClient() {
  const query = useQuery({
    queryKey: ["exposures", 100],
    queryFn: () => engine.exposures(100, 0),
    refetchInterval: 20_000
  });

  const stats = query.data?.stats;
  const items = query.data?.items ?? [];

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Exposure intelligence</p>
          <h1 className="page-title">Detected exposures</h1>
          <p className="page-description">Verified findings associated with your monitored identities, domains and organizations. ZebraByte collection infrastructure and source locations remain private.</p>
        </div>
        <Link href="/investigations/new" className={buttonVariants({ size: "default" })}>Scan an asset <IconScan size={15} /></Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Detected exposures" value={stats?.exposures} note="Verified completed findings" icon={<IconEyeSearch />} loading={query.isLoading} />
        <Metric label="High priority" value={stats?.elevated} note="High or critical risk" icon={<IconAlertTriangle />} loading={query.isLoading} danger={Boolean(stats?.elevated)} />
        <Metric label="Scanning now" value={stats?.scanning} note="Queued or active checks" icon={stats?.scanning ? <IconLoader2 className="animate-spin" /> : <IconScan />} loading={query.isLoading} />
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="page-eyebrow">Last completed scan</p>
                {query.isLoading ? <Skeleton className="mt-2 h-7 w-32" /> : <div className="mt-2 truncate text-[13px] font-medium">{stats?.lastScanAt ? relativeTime(stats.lastScanAt) : "No scan yet"}</div>}
              </div>
              <span className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground"><IconClock size={16} /></span>
            </div>
            <p className="mb-0 mt-3 text-[11px] text-muted-foreground">Most recent intelligence verification</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader>
          <div><p className="page-eyebrow">Findings</p><CardTitle>Exposure history</CardTitle></div>
          <span className="font-mono text-[10px] text-muted-foreground">PRIVATE SOURCE CORPUS</span>
        </CardHeader>
        <div className="divide-y divide-border">
          {query.isLoading && Array.from({ length: 5 }).map((_, index) => <div key={index} className="px-4 py-4"><Skeleton className="h-4 w-1/3" /><Skeleton className="mt-2 h-3 w-2/3" /></div>)}
          {!query.isLoading && items.map((item) => (
            <Link key={item.id} href={`/investigations/${item.id}`} className="grid gap-4 px-4 py-4 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_120px_110px] sm:items-center">
              <div className="min-w-0">
                <p className="m-0 truncate text-[13px] font-medium">{item.asset}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
                  <span>{item.profile === "identity" ? "Identity exposure" : item.profile === "ransomware" ? "Ransomware signal" : item.profile === "corporate" ? "Corporate exposure" : "Exposure finding"}</span>
                  <span>{Number(item.indicator_count || 0)} indicators</span>
                  <span>{Number(item.evidence_count || 0)} evidence items</span>
                  <span>{item.completed_at ? relativeTime(item.completed_at) : "Pending"}</span>
                </div>
                {item.summary && <p className="mb-0 mt-2 line-clamp-2 max-w-4xl text-[11px] leading-5 text-muted-foreground">{item.summary}</p>}
              </div>
              <div className="sm:text-center"><RiskBadge risk={item.risk_level} /></div>
              <div className="font-mono text-[10px] text-muted-foreground sm:text-right">Verified finding</div>
            </Link>
          ))}
          {!query.isLoading && !items.length && <div className="data-empty">No verified exposure has been detected in completed scans yet.</div>}
          {query.isError && <div className="data-empty">Exposure intelligence could not be loaded. Retry after the current deployment completes.</div>}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, note, icon, loading, danger = false }: { label: string; value?: number; note: string; icon: React.ReactNode; loading: boolean; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="page-eyebrow">{label}</p>{loading ? <Skeleton className="mt-2 h-7 w-16" /> : <div className={cn("metric-number", danger && "text-red-300")}>{Number(value || 0)}</div>}</div>
          <span className={cn("grid size-8 place-items-center rounded-md border border-border text-muted-foreground [&_svg]:size-4", danger && "border-red-950 text-red-300")}>{icon}</span>
        </div>
        <p className="mb-0 mt-3 text-[11px] text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
