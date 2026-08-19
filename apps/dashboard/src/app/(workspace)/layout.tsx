import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session.isAuthenticated) return session.redirectToSignIn();
  return <AppShell>{children}</AppShell>;
}
