"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { IconClockHour4, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import { engine } from "@/lib/api";
import type { Watchlist } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  type: z.enum(["domain", "email", "brand", "person", "keyword"]),
  value: z.string().trim().min(2).max(200),
  profile: z.enum(["general", "identity", "corporate", "ransomware"]),
  intervalHours: z.number().int().min(1).max(720)
});

export function MonitoringClient() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<Watchlist["type"]>("domain");
  const [profile, setProfile] = useState("corporate");
  const [interval, setIntervalValue] = useState(24);
  const me = useQuery({ queryKey: ["me"], queryFn: engine.me });
  const watchlists = useQuery({ queryKey: ["watchlists"], queryFn: engine.watchlists, refetchInterval: 30_000 });
  const create = useMutation({ mutationFn: engine.createWatchlist, onSuccess: () => { toast.success("Monitoring target created"); queryClient.invalidateQueries({ queryKey: ["watchlists"] }); }, onError: (error: Error) => toast.error(error.message) });
  const remove = useMutation({ mutationFn: engine.deleteWatchlist, onSuccess: () => { toast.success("Monitoring target removed"); queryClient.invalidateQueries({ queryKey: ["watchlists"] }); }, onError: (error: Error) => toast.error(error.message) });

  const minimum = useMemo(() => me.data?.plan === "enterprise" ? 1 : me.data?.plan === "business" ? 6 : 24, [me.data?.plan]);

  function submit(formData: FormData) {
    const parsed = schema.safeParse({ type, value: formData.get("value"), profile, intervalHours: interval });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid monitoring target");
    create.mutate(parsed.data);
  }

  return (
    <div className="page-shell">
      <div className="page-header"><div><p className="page-eyebrow">Continuous monitoring</p><h1 className="page-title">Watchlists</h1><p className="page-description">Schedule recurring defensive investigations for approved domains, identities, brands and keywords. Monitoring consumes the same monthly investigation quota.</p></div><Button variant="outline" size="sm" onClick={() => watchlists.refetch()} disabled={watchlists.isFetching}><IconRefresh className={watchlists.isFetching ? "animate-spin" : ""} /> Refresh</Button></div>

      <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader><div><p className="page-eyebrow">Add target</p><CardTitle>Monitoring policy</CardTitle></div></CardHeader>
          <CardContent>
            {me.data?.plan === "free" && <div className="mb-4 rounded-md border border-amber-900/60 bg-amber-950/20 p-3 text-[11px] leading-5 text-amber-200">Continuous monitoring requires a paid plan. You can still create manual investigations on the Free plan.</div>}
            <form action={submit} className="space-y-4">
              <Field label="Target type"><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring" value={type} onChange={(event) => setType(event.target.value as Watchlist["type"])}><option value="domain">Domain</option><option value="email">Email</option><option value="brand">Brand</option><option value="person">Person</option><option value="keyword">Keyword</option></select></Field>
              <Field label="Target"><Input name="value" placeholder={type === "domain" ? "example.com" : type === "email" ? "security@example.com" : "Approved search target"} required /></Field>
              <Field label="Profile"><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring" value={profile} onChange={(event) => setProfile(event.target.value)}><option value="corporate">Corporate exposure</option><option value="identity">Identity exposure</option><option value="general">General intelligence</option><option value="ransomware">Ransomware signals</option></select></Field>
              <Field label="Interval"><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring" value={interval} onChange={(event) => setIntervalValue(Number(event.target.value))}><option value={24}>Every 24 hours</option><option value={12}>Every 12 hours</option><option value={6}>Every 6 hours</option><option value={1}>Every hour</option></select><span className="mt-1 block text-[10px] text-muted-foreground">Minimum for {me.data?.plan ?? "your plan"}: {minimum}h. The engine enforces this server-side.</span></Field>
              <Button type="submit" className="w-full" disabled={create.isPending || me.data?.plan === "free"}><IconPlus /> {create.isPending ? "Creating…" : "Create watchlist"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader><div><p className="page-eyebrow">Active monitoring</p><CardTitle>{watchlists.data?.items.length ?? 0} targets</CardTitle></div></CardHeader>
          <div className="divide-y divide-border">
            {(watchlists.data?.items ?? []).map((item) => <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_130px_140px_auto] sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><p className="m-0 truncate text-[13px] font-medium">{item.value}</p><Badge variant={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Paused"}</Badge></div><p className="m-0 mt-1 font-mono text-[10px] text-muted-foreground">{item.type} · {item.profile}</p></div><div><p className="m-0 text-[10px] text-muted-foreground">LAST RUN</p><p className="m-0 mt-1 text-xs">{relativeTime(item.last_run_at)}</p></div><div><p className="m-0 text-[10px] text-muted-foreground">NEXT RUN</p><p className="m-0 mt-1 flex items-center gap-1 text-xs"><IconClockHour4 size={13} /> {relativeTime(item.next_run_at)}</p></div><div className="flex justify-end gap-1">{item.last_investigation_id && <Link href={`/investigations/${item.last_investigation_id}`} className="rounded-md border border-border px-2 py-1.5 text-[11px] hover:bg-accent">Last result</Link>}<Button variant="ghost" size="icon" aria-label={`Delete ${item.value}`} onClick={() => { if (window.confirm(`Remove monitoring for ${item.value}?`)) remove.mutate(item.id); }}><IconTrash /></Button></div></div>)}
            {!watchlists.data?.items.length && <div className="data-empty">{watchlists.isLoading ? "Loading watchlists…" : "No monitoring targets configured."}</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-medium">{label}</span>{children}</label>; }
