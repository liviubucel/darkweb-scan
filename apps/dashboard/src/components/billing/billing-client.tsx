"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconArrowUpRight, IconCheck, IconCreditCard } from "@tabler/icons-react";
import { engine } from "@/lib/api";
import { formatDate, titleCase } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export function BillingClient() {
  const me = useQuery({ queryKey: ["me"], queryFn: engine.me });
  const billing = useQuery({ queryKey: ["billing"], queryFn: engine.billing });
  const checkout = useMutation({ mutationFn: engine.checkout, onSuccess: (session) => { window.location.assign(session.url); }, onError: (error: Error) => toast.error(error.message) });
  const portal = useMutation({ mutationFn: engine.billingPortal, onSuccess: (session) => { window.location.assign(session.url); }, onError: (error: Error) => toast.error(error.message) });
  const usage = me.data?.usage;
  const usagePct = usage?.limit ? (usage.investigations / usage.limit) * 100 : 0;

  return (
    <div className="page-shell max-w-6xl">
      <div className="page-header"><div><p className="page-eyebrow">Organization</p><h1 className="page-title">Plan & billing</h1><p className="page-description">Subscription state is synchronized from Stripe by signed webhook events. Pricing remains controlled in Stripe rather than hard-coded into the application.</p></div>{billing.data?.status === "active" || billing.data?.status === "trialing" ? <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}><IconCreditCard /> Manage billing</Button> : null}</div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader><div><p className="page-eyebrow">Current subscription</p><CardTitle>{titleCase(billing.data?.plan ?? me.data?.plan ?? "free")}</CardTitle></div><Badge variant={billing.data?.status === "active" || billing.data?.status === "trialing" ? "success" : "neutral"}>{titleCase(billing.data?.status ?? "inactive")}</Badge></CardHeader>
          <CardContent className="space-y-5"><div><div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Monthly investigations</span><span className="font-mono">{usage ? `${usage.investigations} / ${usage.limit}` : "—"}</span></div><Progress value={usagePct} /></div><dl className="space-y-3 text-xs"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Current period</dt><dd>{usage?.period ?? "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Period end</dt><dd>{formatDate(billing.data?.current_period_end)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Organization</dt><dd className="max-w-[220px] truncate font-mono text-[10px]">{me.data?.orgId ?? "—"}</dd></div></dl></CardContent>
        </Card>
        <Card>
          <CardHeader><div><p className="page-eyebrow">Capabilities</p><CardTitle>Plan access</CardTitle></div></CardHeader>
          <CardContent className="space-y-2 text-xs"><Capability text="Manual dark-web investigations" /><Capability text="Evidence retention and investigation history" /><Capability text="Cloudflare Workers AI grounded analysis" /><Capability text="Continuous monitoring on paid plans" enabled={me.data?.plan !== "free"} /><Capability text="Organization intelligence search on paid plans" enabled={me.data?.plan !== "free"} /></CardContent>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <PlanCard name="Pro" description="For continuous defensive monitoring and organization intelligence search." onSelect={() => checkout.mutate("pro")} loading={checkout.isPending} disabled={me.data?.plan === "pro"} />
        <PlanCard name="Business" description="For higher investigation volume and shorter monitoring intervals." onSelect={() => checkout.mutate("business")} loading={checkout.isPending} disabled={me.data?.plan === "business"} />
      </div>
    </div>
  );
}

function Capability({ text, enabled = true }: { text: string; enabled?: boolean }) { return <div className={`flex items-center gap-2 ${enabled ? "text-foreground/90" : "text-muted-foreground"}`}><span className={`grid size-4 place-items-center rounded-full border ${enabled ? "border-emerald-800 text-emerald-300" : "border-border"}`}>{enabled ? <IconCheck size={10} /> : "–"}</span>{text}</div>; }
function PlanCard({ name, description, onSelect, loading, disabled }: { name: string; description: string; onSelect: () => void; loading: boolean; disabled: boolean }) { return <Card><CardHeader><div><p className="page-eyebrow">Upgrade</p><CardTitle>{name}</CardTitle></div></CardHeader><CardContent><p className="mt-0 text-xs leading-5 text-muted-foreground">{description}</p><p className="text-[11px] leading-5 text-muted-foreground">Price and billing interval are read from the Stripe Price configured for this environment.</p><Button className="mt-2" variant="outline" onClick={onSelect} disabled={loading || disabled}>{disabled ? "Current plan" : `Continue to ${name}`} {!disabled && <IconArrowUpRight />}</Button></CardContent></Card>; }
