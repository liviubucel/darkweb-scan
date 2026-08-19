"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import {
  IconActivity,
  IconBuilding,
  IconCreditCard,
  IconDatabaseSearch,
  IconFileSearch,
  IconLayoutDashboard,
  IconMenu2,
  IconRadar,
  IconSettings,
  IconShieldSearch,
  IconX
} from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const primaryNav = [
  { href: "/overview", label: "Threat Command", icon: IconLayoutDashboard },
  { href: "/investigations", label: "Investigations", icon: IconShieldSearch },
  { href: "/monitoring", label: "Monitoring", icon: IconRadar },
  { href: "/intelligence", label: "Intelligence", icon: IconDatabaseSearch },
  { href: "/platform", label: "Platform", icon: IconActivity }
];

const accountNav = [
  { href: "/organization", label: "Organization", icon: IconBuilding },
  { href: "/billing", label: "Plan & billing", icon: IconCreditCard },
  { href: "/account", label: "Account", icon: IconSettings }
];

function NavSection({ items, onNavigate }: { items: typeof primaryNav; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="space-y-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/overview" && pathname.startsWith(`${href}/`));
        return (
          <Link key={href} href={href} onClick={onNavigate} className={cn("flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors", active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>
            <Icon size={16} stroke={1.7} />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/overview" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-background font-mono text-[11px] font-semibold">Z</span>
          <span className="min-w-0 leading-tight"><strong className="block truncate text-[13px] font-semibold">ZebraByte</strong><span className="block truncate text-[10px] text-muted-foreground">Dark Web Intelligence</span></span>
        </Link>
      </div>

      <div className="border-b border-border p-3">
        <OrganizationSwitcher
          hidePersonal={false}
          afterCreateOrganizationUrl="/overview"
          afterSelectOrganizationUrl="/overview"
          afterSelectPersonalUrl="/overview"
          appearance={{ elements: { rootBox: "w-full", organizationSwitcherTrigger: "w-full justify-between rounded-md border border-border bg-background px-2.5 py-2 text-xs hover:bg-accent" } }}
        />
      </div>

      <nav className="flex-1 overflow-y-auto p-3 thin-scrollbar">
        <p className="mb-2 px-2.5 meta-label">Threat intelligence</p>
        <NavSection items={primaryNav} onNavigate={onNavigate} />
        <div className="my-4 border-t border-border" />
        <p className="mb-2 px-2.5 meta-label">Organization</p>
        <NavSection items={accountNav} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium"><IconFileSearch size={14} /> Defensive collection</div>
          <p className="m-0 text-[11px] leading-4 text-muted-foreground">Queries are restricted to authorized investigative use. Raw onion content is not exposed as clickable links.</p>
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = [...primaryNav, ...accountNav].find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="workspace-grid">
      <aside className="desktop-sidebar sticky top-0 flex h-screen flex-col border-r border-border bg-card/40"><SidebarContent /></aside>

      {mobileOpen && <button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border bg-card transition-transform lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="absolute right-2 top-2 z-10"><Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><IconX /></Button></div>
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div className="workspace-main">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button className="lg:hidden" variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><IconMenu2 /></Button>
            <div className="min-w-0"><p className="m-0 truncate text-[11px] text-muted-foreground">Dark Web Intelligence</p><p className="m-0 truncate text-[13px] font-medium">{current?.label ?? "Workspace"}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-md border border-border px-2 py-1 font-mono text-[9px] font-semibold tracking-[.1em] text-muted-foreground sm:inline">PRODUCTION</span>
            <UserButton showName={false} />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
