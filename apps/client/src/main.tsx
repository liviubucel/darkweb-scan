import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  IconAlertTriangle,
  IconBrain,
  IconBuilding,
  IconClock,
  IconEye,
  IconFileSearch,
  IconFingerprint,
  IconLayoutDashboard,
  IconPlus,
  IconRadar,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import "./styles.css";

type View = "overview" | "new" | "investigations" | "exposures" | "monitoring" | "intelligence" | "detail";
type Risk = "none" | "low" | "medium" | "high" | "critical" | string | null;

type Investigation = {
  id: string; query: string; profile: string; origin: string; status: string; risk_level: Risk;
  summary?: string | null; source_count: number; error_message?: string | null;
  created_at: string; updated_at: string; completed_at?: string | null;
};
type Exposure = { id: string; asset: string; profile: string; risk_level: Risk; summary?: string | null; evidence_count: number; indicator_count: number; completed_at?: string | null };
type Watchlist = { id: string; type: string; value: string; profile: string; interval_hours: number; next_run_at: string; active: number };
type Session = { userId: string; orgId: string; orgRole?: string | null; plan: string; usage: { investigations: number; limit: number; remaining: number } };
type SourceRef = { id: string; ordinal: number; content_sha256: string; fetched_at: string };
type Artifact = { id: string; type: string; value: string; created_at: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers || {}) },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function parseHash(): { view: View; id?: string } {
  const hash = location.hash.replace(/^#\/?/, "");
  if (hash.startsWith("investigation/")) return { view: "detail", id: hash.split("/")[1] };
  if (["overview", "new", "investigations", "exposures", "monitoring", "intelligence"].includes(hash)) return { view: hash as View };
  return { view: "overview" };
}

function go(view: View, id?: string) {
  location.hash = view === "detail" && id ? `investigation/${id}` : view;
}

function niceDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function riskVariant(risk: Risk): "neutral" | "info" | "warning" | "danger" {
  const r = String(risk || "none").toLowerCase();
  if (r === "critical" || r === "high") return "danger";
  if (r === "medium") return "warning";
  if (r === "low") return "info";
  return "neutral";
}

const nav = [
  ["overview", "Overview", IconLayoutDashboard],
  ["new", "Scan asset", IconPlus],
  ["investigations", "Investigations", IconFileSearch],
  ["exposures", "Exposures", IconEye],
  ["monitoring", "Monitoring", IconRadar],
  ["intelligence", "Intelligence", IconBrain],
] as const;

function App() {
  const [route, setRoute] = useState(parseHash());
  const [session, setSession] = useState<Session | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    addEventListener("hashchange", onHash);
    if (!location.hash) location.hash = "overview";
    return () => removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    Promise.all([api<Session>("/api/me"), api<any>("/api/health")])
      .then(([me, h]) => { setSession(me); setHealth(h); setError(""); })
      .catch((e) => setError(e.message));
  }, []);

  const currentLabel = nav.find(([key]) => key === route.view)?.[1] || (route.view === "detail" ? "Finding detail" : "Workspace");

  return <div className="zbt-app">
    <aside className="zbt-sidebar">
      <div className="flex h-14 items-center border-b border-border px-4">
        <button onClick={() => go("overview")} className="flex items-center gap-2.5 bg-transparent border-0 text-left text-foreground cursor-pointer">
          <span className="grid size-7 place-items-center rounded-md border border-border bg-background font-mono text-[11px] font-semibold">Z</span>
          <span className="leading-tight"><strong className="block text-[13px]">ZebraByte</strong><span className="block text-[10px] text-muted-foreground">Exposure Intelligence</span></span>
        </button>
      </div>
      <div className="zbt-nav flex-1">
        <p className="meta-label px-2.5 pt-1 pb-1">Workspace</p>
        {nav.map(([key, label, Icon]) => <button key={key} className={`zbt-nav-button ${route.view === key ? "active" : ""}`} onClick={() => go(key)}><Icon stroke={1.7} /><span>{label}</span></button>)}
      </div>
      <div className="border-t border-border p-3">
        <Card><CardContent className="p-3"><div className="text-[11px] font-medium">Private intelligence engine</div><p className="m-0 mt-1 text-[10px] leading-4 text-muted-foreground">Collection sources and infrastructure are internal to ZebraByte. Customer results expose findings, not source topology.</p></CardContent></Card>
      </div>
    </aside>

    <main className="zbt-main">
      <header className="zbt-topbar">
        <div><div className="text-[10px] text-muted-foreground">Exposure Intelligence</div><div className="text-[13px] font-medium">{currentLabel}</div></div>
        <div className="flex items-center gap-2">
          <Badge variant={health?.ready ? "success" : "warning"}>{health?.ready ? "Operational" : "Validation"}</Badge>
          <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground">{session?.plan?.toUpperCase() || "—"}</span>
          <Button variant="ghost" size="sm" onClick={() => (window as any).ZebraByteAuth?.account?.()}><IconUser /> Account</Button>
        </div>
      </header>
      {error && <div className="mx-6 mt-4 rounded-md border border-red-950 bg-red-950/20 px-3 py-2 text-xs text-red-300">{error}</div>}
      {route.view === "overview" && <Overview session={session} health={health} />}
      {route.view === "new" && <NewInvestigation session={session} />}
      {route.view === "investigations" && <Investigations />}
      {route.view === "exposures" && <Exposures />}
      {route.view === "monitoring" && <Monitoring />}
      {route.view === "intelligence" && <Intelligence />}
      {route.view === "detail" && route.id && <Detail id={route.id} />}
    </main>
  </div>;
}

function PageHead({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="zbt-page-head"><div><p className="page-eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}

function Metric({ label, value, note, danger = false }: { label: string; value: string | number; note: string; danger?: boolean }) {
  return <Card><CardContent className="p-4"><p className="page-eyebrow">{label}</p><div className={`metric-number ${danger ? "text-red-300" : ""}`}>{value}</div><p className="m-0 mt-3 text-[11px] text-muted-foreground">{note}</p></CardContent></Card>;
}

function Overview({ session, health }: { session: Session | null; health: any }) {
  const [items, setItems] = useState<Investigation[]>([]);
  const [watches, setWatches] = useState<Watchlist[]>([]);
  useEffect(() => { void Promise.all([api<any>("/api/investigations?limit=50&offset=0"), api<any>("/api/watchlists")]).then(([a, b]) => { setItems(a.items || []); setWatches(b.items || []); }); }, []);
  const running = items.filter(i => ["queued", "running"].includes(i.status)).length;
  const elevated = items.filter(i => ["high", "critical"].includes(String(i.risk_level))).length;
  return <div className="zbt-page">
    <PageHead eyebrow="External exposure intelligence" title="Security exposure overview" description="Monitor breached data, identity exposure and externally observable risk across approved assets." action={<Button onClick={() => go("new")}><IconPlus /> Scan asset</Button>} />
    <div className="zbt-grid-4">
      <Metric label="Investigations" value={items.length} note="Real workflow history" />
      <Metric label="Active scans" value={running} note="Queued or processing" />
      <Metric label="Elevated findings" value={elevated} note="High or critical risk" danger={elevated > 0} />
      <Metric label="Monitored assets" value={watches.length} note="Continuous monitoring" />
    </div>
    <div className="zbt-grid-2 mt-3">
      <Card><CardHeader><CardTitle>Recent investigations</CardTitle><Button variant="ghost" size="sm" onClick={() => go("investigations")}>View all</Button></CardHeader><div>{items.slice(0,6).map(i => <Record key={i.id} item={i} />)}{!items.length && <div className="zbt-empty">No investigations yet.</div>}</div></Card>
      <Card><CardHeader><CardTitle>Protection status</CardTitle></CardHeader><CardContent className="space-y-3 text-xs"><StatusLine label="Authentication" ok={Boolean(health?.configuration?.authentication)} /><StatusLine label="Evidence database" ok={Boolean(health?.configuration?.database)} /><StatusLine label="Private discovery" ok={Boolean(health?.configuration?.inhouseDiscovery)} /><StatusLine label="Workers AI" ok={true} /><StatusLine label="Monitoring" ok={true} /><div className="pt-2 border-t border-border flex justify-between"><span className="text-muted-foreground">Validation allowance</span><span className="font-mono">{session?.usage ? `${session.usage.investigations}/${session.usage.limit}` : "—"}</span></div></CardContent></Card>
    </div>
  </div>;
}

function StatusLine({ label, ok }: { label: string; ok: boolean }) { return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="flex items-center gap-1.5">{ok ? <IconShieldCheck size={14} /> : <IconAlertTriangle size={14} />} {ok ? "Active" : "Pending"}</span></div>; }

function Record({ item }: { item: Investigation }) {
  return <div className="zbt-record" onClick={() => go("detail", item.id)}><div className="min-w-0"><div className="truncate text-[13px] font-medium">{item.query}</div><div className="mt-1 font-mono text-[10px] text-muted-foreground">{item.profile} · {niceDate(item.created_at)}</div></div><div className="flex items-center gap-2"><Badge variant={item.status === "completed" ? "success" : item.status === "failed" ? "danger" : "info"}>{item.status}</Badge><Badge variant={riskVariant(item.risk_level)}>{String(item.risk_level || "none")}</Badge></div></div>;
}

function NewInvestigation({ session }: { session: Session | null }) {
  const [query, setQuery] = useState(""); const [profile, setProfile] = useState("general"); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!query.trim()) return; setBusy(true); setMessage(""); try { const result = await api<any>("/api/investigations", { method: "POST", body: JSON.stringify({ query: query.trim(), profile }) }); go("detail", result.id); } catch (err: any) { setMessage(err.message); } finally { setBusy(false); } };
  return <div className="zbt-page"><PageHead eyebrow="New investigation" title="Scan an asset" description="Check an authorized email, domain, brand or indicator against ZebraByte's private exposure intelligence corpus." />
    <Card><CardContent className="p-5"><form onSubmit={submit} className="space-y-5"><div className="zbt-field"><span>Search target</span><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="example.com or security@example.com" maxLength={300} autoFocus /><small className="text-[10px] text-muted-foreground">Do not enter passwords, credentials or raw secrets.</small></div><div className="zbt-form-grid"><label className="zbt-field"><span>Investigation profile</span><select className="zbt-select" value={profile} onChange={e => setProfile(e.target.value)}><option value="general">General intelligence</option><option value="identity">Identity exposure</option><option value="corporate">Corporate exposure</option><option value="ransomware">Ransomware signals</option></select></label><div className="zbt-field"><span>Collection scope</span><div className="rounded-md border border-border p-3 text-xs"><strong>Defensive only</strong><div className="mt-1 text-[10px] text-muted-foreground">Evidence is verified and summarized without exposing private collection topology.</div></div></div></div>{message && <div className="text-xs text-red-300">{message}</div>}<div className="flex items-center justify-between border-t border-border pt-4"><span className="text-[10px] text-muted-foreground">{session?.usage ? `${session.usage.remaining} validation scans remaining` : "Validation mode"}</span><Button disabled={busy || query.trim().length < 2}>{busy ? "Starting…" : "Start investigation"}</Button></div></form></CardContent></Card>
  </div>;
}

function Investigations() {
  const [items, setItems] = useState<Investigation[]>([]); const [loading, setLoading] = useState(true); const [filter, setFilter] = useState("");
  const load = () => { setLoading(true); api<any>("/api/investigations?limit=50&offset=0").then(r => setItems(r.items || [])).finally(() => setLoading(false)); };
  useEffect(load, []);
  const shown = useMemo(() => items.filter(i => i.query.toLowerCase().includes(filter.toLowerCase())), [items, filter]);
  return <div className="zbt-page"><PageHead eyebrow="Investigation history" title="Investigations" description="Review workflow status, findings and evidence references for approved scans." action={<Button onClick={() => go("new")}><IconPlus /> New scan</Button>} /><Card><CardHeader><div className="flex gap-2 w-full"><Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter investigations" /><Button variant="outline" onClick={load}><IconRefresh /> Refresh</Button></div></CardHeader><div>{loading ? <div className="zbt-empty">Loading…</div> : shown.map(i => <Record key={i.id} item={i} />)}{!loading && !shown.length && <div className="zbt-empty">No investigations found.</div>}</div></Card></div>;
}

function Exposures() {
  const [items, setItems] = useState<Exposure[]>([]); const [stats, setStats] = useState<any>({}); const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); api<any>("/api/exposures?limit=100&offset=0").then(r => { setItems(r.items || []); setStats(r.stats || {}); }).finally(() => setLoading(false)); };
  useEffect(load, []);
  return <div className="zbt-page"><PageHead eyebrow="Exposure intelligence" title="Detected exposures" description="Verified findings associated with monitored identities, domains and organizations. Collection infrastructure remains private to ZebraByte." action={<Button onClick={() => go("new")}><IconSearch /> Scan asset</Button>} /><div className="zbt-grid-4"><Metric label="Detected exposures" value={stats.exposures || 0} note="Completed findings" /><Metric label="High priority" value={stats.elevated || 0} note="High or critical" danger={(stats.elevated || 0) > 0} /><Metric label="Scanning now" value={stats.scanning || 0} note="Queued or active" /><Metric label="Last scan" value={stats.lastScanAt ? niceDate(stats.lastScanAt) : "—"} note="Most recent completed check" /></div><Card className="mt-3"><CardHeader><CardTitle>Exposure history</CardTitle><Button variant="ghost" size="sm" onClick={load}><IconRefresh /> Refresh</Button></CardHeader><div>{loading ? <div className="zbt-empty">Loading…</div> : items.map(i => <div key={i.id} className="zbt-record" onClick={() => go("detail", i.id)}><div><div className="text-[13px] font-medium">{i.asset}</div><div className="mt-1 text-[10px] text-muted-foreground">{i.indicator_count || 0} indicators · {i.evidence_count || 0} evidence items · {niceDate(i.completed_at)}</div></div><Badge variant={riskVariant(i.risk_level)}>{String(i.risk_level || "none")}</Badge></div>)}{!loading && !items.length && <div className="zbt-empty">No verified exposure has been detected yet.</div>}</div></Card></div>;
}

function Monitoring() {
  const [items, setItems] = useState<Watchlist[]>([]); const [type, setType] = useState("domain"); const [value, setValue] = useState(""); const [intervalHours, setIntervalHours] = useState(24); const [busy, setBusy] = useState(false);
  const load = () => api<any>("/api/watchlists").then(r => setItems(r.items || [])); useEffect(() => { void load(); }, []);
  const create = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); try { await api("/api/watchlists", { method: "POST", body: JSON.stringify({ type, value, profile: type === "email" ? "identity" : "corporate", intervalHours }) }); setValue(""); await load(); } finally { setBusy(false); } };
  const remove = async (id: string) => { await api(`/api/watchlists/${encodeURIComponent(id)}`, { method: "DELETE" }); await load(); };
  return <div className="zbt-page"><PageHead eyebrow="Continuous monitoring" title="Monitored assets" description="Track approved domains, identities and brands for newly observed exposure signals." /><div className="zbt-grid-2"><Card><CardHeader><CardTitle>Add monitoring target</CardTitle></CardHeader><CardContent><form onSubmit={create} className="space-y-4"><label className="zbt-field"><span>Type</span><select className="zbt-select" value={type} onChange={e => setType(e.target.value)}><option value="domain">Domain</option><option value="email">Email</option><option value="brand">Brand</option><option value="person">Person</option><option value="keyword">Keyword</option></select></label><label className="zbt-field"><span>Target</span><Input value={value} onChange={e => setValue(e.target.value)} required placeholder="example.com" /></label><label className="zbt-field"><span>Interval</span><select className="zbt-select" value={intervalHours} onChange={e => setIntervalHours(Number(e.target.value))}><option value={24}>Every 24 hours</option><option value={12}>Every 12 hours</option><option value={6}>Every 6 hours</option><option value={1}>Every hour</option></select></label><Button disabled={busy || !value.trim()}>{busy ? "Creating…" : "Create monitor"}</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Active monitoring</CardTitle><Button variant="ghost" size="sm" onClick={() => void load()}><IconRefresh /> Refresh</Button></CardHeader><div>{items.map(i => <div key={i.id} className="zbt-record"><div><div className="text-[13px] font-medium">{i.value}</div><div className="text-[10px] text-muted-foreground">{i.type} · every {i.interval_hours}h · next {niceDate(i.next_run_at)}</div></div><Button variant="ghost" size="icon" onClick={() => void remove(i.id)}><IconTrash /></Button></div>)}{!items.length && <div className="zbt-empty">No monitored assets yet.</div>}</div></Card></div></div>;
}

function Intelligence() {
  const [query, setQuery] = useState(""); const [answer, setAnswer] = useState(""); const [busy, setBusy] = useState(false);
  const ask = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); try { const r = await api<any>("/api/intelligence/ask", { method: "POST", body: JSON.stringify({ query }) }); setAnswer(r.answer || "No grounded answer available."); } catch (err: any) { setAnswer(err.message); } finally { setBusy(false); } };
  return <div className="zbt-page"><PageHead eyebrow="Organization intelligence" title="Ask Intelligence" description="Query evidence retained for your organization. Answers are grounded in collected investigation data." /><Card><CardContent className="p-5"><form onSubmit={ask} className="space-y-4"><Textarea rows={5} value={query} onChange={e => setQuery(e.target.value)} placeholder="What exposure signals have we observed for our organization?" /><Button disabled={busy || query.trim().length < 2}><IconBrain /> {busy ? "Analyzing…" : "Ask Intelligence"}</Button></form>{answer && <div className="mt-5 border-t border-border pt-5 whitespace-pre-wrap text-[13px] leading-6">{answer}</div>}</CardContent></Card></div>;
}

function Detail({ id }: { id: string }) {
  const [item, setItem] = useState<Investigation | null>(null); const [sources, setSources] = useState<SourceRef[]>([]); const [artifacts, setArtifacts] = useState<Artifact[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => {
    let timer: number | undefined;
    const load = async () => { const inv = await api<Investigation>(`/api/investigations/${encodeURIComponent(id)}`); setItem(inv); if (inv.status === "completed") { const [s, a] = await Promise.all([api<any>(`/api/investigations/${id}/sources`), api<any>(`/api/investigations/${id}/artifacts`)]); setSources(s.items || []); setArtifacts(a.items || []); } setLoading(false); if (["queued", "running"].includes(inv.status)) timer = window.setTimeout(load, 5000); };
    void load(); return () => { if (timer) clearTimeout(timer); };
  }, [id]);
  if (loading || !item) return <div className="zbt-page"><div className="zbt-empty">Loading finding…</div></div>;
  return <div className="zbt-page"><PageHead eyebrow="Investigation" title={item.query} description={`${item.profile} · updated ${niceDate(item.updated_at)}`} action={<div className="flex gap-2"><Badge variant={item.status === "completed" ? "success" : item.status === "failed" ? "danger" : "info"}>{item.status}</Badge><Badge variant={riskVariant(item.risk_level)}>{String(item.risk_level || "none")}</Badge></div>} /><div className="zbt-grid-4"><Metric label="Risk" value={String(item.risk_level || "none")} note="Evidence-based assessment" /><Metric label="Evidence" value={item.source_count || 0} note="Verified references" /><Metric label="Indicators" value={artifacts.length} note="Extracted signals" /><Metric label="Observed" value={niceDate(item.completed_at || item.updated_at)} note="Latest completed analysis" /></div><Card className="mt-3"><CardHeader><CardTitle>Assessment</CardTitle><Badge variant="neutral">Workers AI · evidence grounded</Badge></CardHeader><CardContent><div className="whitespace-pre-wrap text-[13px] leading-6">{item.error_message || item.summary || (["queued", "running"].includes(item.status) ? "Investigation is still running. This page refreshes automatically." : "No grounded summary retained.")}</div></CardContent></Card><div className="zbt-grid-2 mt-3"><Card><CardHeader><CardTitle>Evidence references</CardTitle><span className="font-mono text-[10px] text-muted-foreground">PRIVATE SOURCE TOPOLOGY</span></CardHeader><div>{sources.map(s => <div className="p-4 border-t border-border first:border-t-0" key={s.id}><div className="flex justify-between text-xs"><span>Evidence #{s.ordinal}</span><span className="text-muted-foreground">{niceDate(s.fetched_at)}</span></div><code className="mt-2 block break-all rounded-md bg-background p-2 text-[10px] text-muted-foreground">SHA-256 {s.content_sha256}</code></div>)}{!sources.length && <div className="zbt-empty">No retained evidence references yet.</div>}</div></Card><Card><CardHeader><CardTitle>Indicators</CardTitle><span className="font-mono text-[10px] text-muted-foreground">{artifacts.length} ITEMS</span></CardHeader><div className="max-h-[520px] overflow-y-auto">{artifacts.map(a => <div key={a.id} className="grid grid-cols-[90px_minmax(0,1fr)] gap-3 border-t border-border first:border-t-0 p-3"><span className="font-mono text-[9px] uppercase text-muted-foreground">{a.type}</span><code className="break-all text-[11px]">{a.value}</code></div>)}{!artifacts.length && <div className="zbt-empty">No indicators extracted.</div>}</div></Card></div></div>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
