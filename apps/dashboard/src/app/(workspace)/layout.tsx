import { AppShell } from "@/components/shell/app-shell";
import { WorkspaceAuthBoundary } from "@/components/system/runtime-clerk-provider";

export const dynamic = "force-dynamic";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceAuthBoundary><AppShell>{children}</AppShell></WorkspaceAuthBoundary>;
}
