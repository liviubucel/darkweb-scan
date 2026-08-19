import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.06em]", {
  variants: {
    variant: {
      neutral: "border-border bg-muted text-muted-foreground",
      success: "border-emerald-900/70 bg-emerald-950/50 text-emerald-300",
      warning: "border-amber-900/70 bg-amber-950/40 text-amber-300",
      danger: "border-red-900/70 bg-red-950/45 text-red-300",
      info: "border-sky-900/70 bg-sky-950/45 text-sky-300"
    }
  },
  defaultVariants: { variant: "neutral" }
});

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
