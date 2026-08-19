import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-5">
        <a href="https://www.zebrabyte.ro" className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-7 place-items-center rounded-md border border-border font-mono text-xs">Z</span>ZebraByte</a>
        <SignIn fallbackRedirectUrl="/overview" signUpUrl="/sign-up" />
        <p className="max-w-sm text-center text-xs leading-5 text-muted-foreground">Authorized access only. Authentication events and investigation activity may be retained for security and audit purposes.</p>
      </div>
    </main>
  );
}
