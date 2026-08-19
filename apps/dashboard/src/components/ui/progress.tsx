import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
  const bounded = Math.max(0, Math.min(100, value));
  return <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}><div className="h-full bg-foreground transition-[width]" style={{ width: `${bounded}%` }} /></div>;
}
