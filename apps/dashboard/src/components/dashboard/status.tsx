import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";
import type { RiskLevel } from "@/lib/types";

export function StatusBadge({ status }: { status: string }) {
  const variant = status === "completed" ? "success" : status === "failed" ? "danger" : status === "running" || status === "queued" ? "info" : "neutral";
  return <Badge variant={variant}>{titleCase(status)}</Badge>;
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const normalized = String(risk ?? "none").toLowerCase();
  const variant = normalized === "critical" || normalized === "high" ? "danger" : normalized === "medium" ? "warning" : normalized === "low" ? "info" : "neutral";
  return <Badge variant={variant}>{titleCase(normalized)}</Badge>;
}
