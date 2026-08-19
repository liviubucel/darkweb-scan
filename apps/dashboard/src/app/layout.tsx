import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/system/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dark Web Intelligence — ZebraByte", template: "%s — ZebraByte" },
  description: "Defensive dark web investigations, monitoring and evidence-grounded threat intelligence.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClerkProvider>
          <QueryProvider>{children}</QueryProvider>
          <Toaster theme="dark" position="bottom-right" richColors closeButton />
        </ClerkProvider>
      </body>
    </html>
  );
}
