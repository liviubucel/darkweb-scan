import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-5">
        <a href="https://www.zebrabyte.ro" className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-7 place-items-center rounded-md border border-border font-mono text-xs">Z</span>ZebraByte</a>
        <SignUp fallbackRedirectUrl="/overview" signInUrl="/sign-in" />
      </div>
    </main>
  );
}
