"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconArrowLeft, IconClock, IconDatabase, IconFingerprint, IconTrash } from "@tabler/icons-react";
import { engine } from "@/lib/api";
import { formatDate, titleCase } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge, StatusBadge } from "@/components/dashboard/status";
import { cn } from "@/lib/utils";

export function InvestigationDetail({ id }: { id: string }) {
  const router = useRouter();
  const investigation = useQuery({ queryKey: ["investigation", id], queryFn: () => engine.investigation(id), refetchInterval: (query) => ["queued", "running"].includes(String(query.state.data?.status)) ? 5_000 : false });
  const sources = useQuery({ queryKey: ["investigation", id, "sources"], queryFn: () => engine.sources(id), enabled: investigation.data?.status === "completed" });
  const artifacts = useQuery({ queryKey: ["investigation", id, "artifacts"], queryFn: () => engine.artifacts(id), enabled: investigation.data?.status === "completed" });
  const deleteMutation = useMutation({ mutationFn: () => engine.deleteInvestigation(id), onSuccess: () => { toast.success("Investigation deleted"); router.push("/investigations"); }, onError: (error: Error) => toast.error(error.message) });

  if (investigation.isLoading) return <div className="page-shell"><div className="data-empty">Loading investigation…</div></div>;
  if (investigation.isError || !investigation.data) return <div className="page-shell"><Card><CardContent className="data-empty">This investigation could not be loaded.</CardContent></Card></div>;

  const item = investigation.data;
  const isActive = item.status === "queued" || item.status === "running";
  const sourceItems = sources.data?.items ?? [];
  const artifactItems = artifacts.data?.items ?? [];

  return (
    <div className="page-shell">
      <div className="mb-5 flex items-center justify-between gap-3"><Link href="/investigations" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}><IconArrowLeft /> Investigations</Link><Button variant="destructive" size="sm" disabled={isActive || deleteMutation.isPending} onClick={() => { if (window.confirm("Delete this investigation and its retained evidence? This cannot be undone.")) deleteMutation.mutate(); }}><IconTrash /> Delete</Button></div>
      <div className="page-header"><div className="min-w-0"><p className="page-eyebrow">Investigation</p><h1 className="page-title break-words">{item.query}</h1><div className="mt-3 flex flex-wrap items-center gap-2"><StatusBadge status={item.status} /><RiskBadge risk={item.risk_level} /><span className="font-mono text-[10px] text-muted-foreground">{item.profile}</span><span className="font-mono text-[10px] text-muted-foreground">{item.origin}</span></div></div></div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Risk level" value={titleCase(String(item.risk_level ?? "none"))} icon={<IconFingerprint />} />
        <Fact label="Retained sources" value={String(item.source_count ?? 0)} icon={<IconDatabase />} />
        <Fact label="Indicators" value={String(artifactItems.length)} icon={<IconFingerprint />} />
        <Fact label="Updated" value={formatDate(item.updated_at)} icon={<IconClock />} compact />
      </div>

      <Card className="mt-3">
        <CardHeader><div><p className="page-eyebrow">Grounded assessment</p><CardTitle>Workers AI summary</CardTitle></div><span className="font-mono text-[10px] text-muted-foreground">EVIDENCE-BOUND</span></CardHeader>
        <CardContent>
          {isActive ? <div className="flex items-center gap-3 py-7 text-sm text-muted-foreground"><span className="size-2 animate-pulse rounded-full bg-foreground" /> Workflow {item.status}. This view refreshes automatically.</div> : item.status === "failed" ? <div className="rounded-md border border-red-950 bg-red-950/20 p-3 text-sm text-red-300">{item.error_message || "Investigation failed before analysis completed."}</div> : <div className="whitespace-pre-wrap text-[13px] leading-6 text-foreground/90">{item.summary || "No grounded summary was retained for this investigation."}</div>}
        </CardContent>
      </Card>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader><div><p className="page-eyebrow">Evidence</p><CardTitle>Retained source references</CardTitle></div><span className="font-mono text-[10px] text-muted-foreground">{sourceItems.length} SOURCES</span></CardHeader>
          <div className="divide-y divide-border">
            {sourceItems.map((source) => <div key={source.id} className="p-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="m-0 break-words text-[13px] font-medium">{source.ordinal}. {source.title || "Untitled source"}</p><p className="m-0 mt-1 text-[11px] text-muted-foreground">Fetched {formatDate(source.fetched_at)}</p></div><span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">SHA-256</span></div><code className="mt-3 block break-all rounded-md bg-background p-2 text-[10px] leading-4 text-muted-foreground">{source.content_sha256}</code></div>)}
            {!sourceItems.length && <div className="data-empty">{isActive ? "Sources will appear after collection completes." : "No retained source references."}</div>}
          </div>
        </Card>

        <Card>
          <CardHeader><div><p className="page-eyebrow">Indicators</p><CardTitle>Extracted artifacts</CardTitle></div><span className="font-mono text-[10px] text-muted-foreground">{artifactItems.length} ITEMS</span></CardHeader>
          <div className="max-h-[560px] divide-y divide-border overflow-y-auto thin-scrollbar">
            {artifactItems.map((artifact) => <div key={artifact.id} className="grid grid-cols-[90px_minmax(0,1fr)] gap-3 p-3"><span className="font-mono text-[9px] uppercase tracking-[.08em] text-muted-foreground">{artifact.type}</span><code className="break-all text-[11px] text-foreground/85">{artifact.value}</code></div>)}
            {!artifactItems.length && <div className="data-empty">{isActive ? "Indicators will appear after analysis completes." : "No indicators were extracted."}</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Fact({ label, value, icon, compact = false }: { label: string; value: string; icon: React.ReactNode; compact?: boolean }) {
  return <Card><CardContent className="flex items-start justify-between gap-4 p-4"><div className="min-w-0"><p className="page-eyebrow">{label}</p><p className={compact ? "m-0 text-[12px] font-medium" : "m-0 text-xl font-semibold tracking-tight"}>{value}</p></div><span className="text-muted-foreground [&_svg]:size-4">{icon}</span></CardContent></Card>;
}
