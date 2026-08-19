"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ClientConfig {
  publishableKey: string;
  accountPortalOrigin?: string;
}

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-md border border-border font-mono text-xs font-semibold">Z</span><div><p className="m-0 text-sm font-semibold">ZebraByte</p><p className="m-0 text-[11px] text-muted-foreground">Exposure Intelligence</p></div></div>
          <Skeleton className="h-2 w-full" />
          <p className="m-0 text-[11px] text-muted-foreground">Securing your workspace session…</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function RuntimeClerkProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("https://auth.zebrabyte.ro/v1/public/clerk-config", { credentials: "omit", cache: "no-store", headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Clerk config unavailable (${response.status})`);
        return response.json() as Promise<ClientConfig>;
      })
      .then((value) => {
        if (cancelled) return;
        if (!value.publishableKey) throw new Error("Missing publishable key");
        setConfig(value);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  if (failed) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <Card className="w-full max-w-md"><CardContent className="p-5"><p className="m-0 text-sm font-semibold">Authentication service unavailable</p><p className="mb-0 mt-2 text-[12px] leading-5 text-muted-foreground">The ZebraByte identity service could not initialize this workspace. Refresh the page or check the service status.</p></CardContent></Card>
      </div>
    );
  }

  if (!config) return <LoadingScreen />;
  return <ClerkProvider publishableKey={config.publishableKey}>{children}</ClerkProvider>;
}

export function WorkspaceAuthBoundary({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    const redirect = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(`https://accounts.zebrabyte.ro/sign-in?redirect_url=${encodeURIComponent(redirect)}`);
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) return <LoadingScreen />;
  return children;
}
