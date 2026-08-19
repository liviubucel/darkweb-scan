import type { Metadata } from "next";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/system/query-provider";
import { RuntimeClerkProvider } from "@/components/system/runtime-clerk-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Exposure Intelligence — ZebraByte", template: "%s — ZebraByte" },
  description: "Exposure intelligence, monitoring and evidence-grounded security investigations for approved assets.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RuntimeClerkProvider>
          <QueryProvider>{children}</QueryProvider>
          <Toaster theme="dark" position="bottom-right" richColors closeButton />
        </RuntimeClerkProvider>
      </body>
    </html>
  );
}
