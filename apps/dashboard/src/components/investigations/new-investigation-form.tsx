"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { IconArrowRight, IconInfoCircle } from "@tabler/icons-react";
import { engine } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const schema = z.object({
  query: z.string().trim().min(2, "Enter at least two characters").max(300, "Search target is too long"),
  profile: z.enum(["general", "identity", "corporate", "ransomware"])
});

const profiles = [
  { value: "general", name: "General intelligence", description: "Broad defensive discovery across approved search sources." },
  { value: "identity", name: "Identity exposure", description: "Prioritizes email addresses, aliases and identity-related indicators." },
  { value: "corporate", name: "Corporate exposure", description: "Prioritizes domains, organization names and business assets." },
  { value: "ransomware", name: "Ransomware signals", description: "Prioritizes extortion, leak-site and ransomware-context signals." }
] as const;

export function NewInvestigationForm() {
  const router = useRouter();
  const [profile, setProfile] = useState<(typeof profiles)[number]["value"]>("corporate");
  const me = useQuery({ queryKey: ["me"], queryFn: engine.me });
  const mutation = useMutation({
    mutationFn: engine.createInvestigation,
    onSuccess: (result) => { toast.success("Investigation queued"); router.push(`/investigations/${result.id}`); },
    onError: (error: Error) => toast.error(error.message)
  });

  const usage = me.data?.usage;
  const usagePct = usage?.limit ? (usage.investigations / usage.limit) * 100 : 0;

  function submit(formData: FormData) {
    const parsed = schema.safeParse({ query: formData.get("query"), profile });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid investigation request"); return; }
    mutation.mutate(parsed.data);
  }

  return (
    <div className="page-shell max-w-5xl">
      <div className="page-header"><div><p className="page-eyebrow">Defensive collection</p><h1 className="page-title">New investigation</h1><p className="page-description">Start a bounded dark-web investigation for an asset, identity or indicator you are authorized to assess.</p></div></div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardHeader><div><p className="page-eyebrow">Search target</p><CardTitle>Investigation parameters</CardTitle></div></CardHeader>
          <CardContent>
            <form action={submit} className="space-y-6">
              <label className="block"><span className="mb-2 block text-xs font-medium">Target or approved search term</span><Input name="query" autoComplete="off" maxLength={300} placeholder="example.com, security@example.com, organization or approved keyword" required /><span className="mt-2 block text-[11px] leading-5 text-muted-foreground">Do not submit passwords, credentials, private keys or unrelated personal data.</span></label>
              <fieldset><legend className="mb-2 text-xs font-medium">Investigation profile</legend><div className="grid gap-2 sm:grid-cols-2">{profiles.map((item) => <button key={item.value} type="button" onClick={() => setProfile(item.value)} className={`rounded-md border p-3 text-left transition-colors ${profile === item.value ? "border-foreground/50 bg-accent" : "border-border bg-background hover:bg-accent/50"}`}><span className="block text-xs font-semibold">{item.name}</span><span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{item.description}</span></button>)}</div></fieldset>
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><IconInfoCircle className="mt-0.5 shrink-0" size={14} /><span>Collection runs inside an isolated Tor container. Workers AI evaluates retained evidence; it does not fabricate sources.</span></div><Button type="submit" disabled={mutation.isPending || (usage?.remaining ?? 1) <= 0}>{mutation.isPending ? "Queuing…" : "Start investigation"}<IconArrowRight /></Button></div>
            </form>
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader><div><p className="page-eyebrow">Monthly quota</p><CardTitle>{me.data?.plan?.toUpperCase() ?? "Plan"}</CardTitle></div></CardHeader>
          <CardContent className="space-y-4"><div><div className="mb-2 flex justify-between font-mono text-[10px] text-muted-foreground"><span>USED</span><span>{usage ? `${usage.investigations} / ${usage.limit}` : "—"}</span></div><Progress value={usagePct} /></div><p className="m-0 text-[11px] leading-5 text-muted-foreground">{usage ? `${usage.remaining} investigations remaining in ${usage.period}.` : "Checking current usage…"}</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
