import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  tone = "primary",
}: {
  value: number;
  className?: string;
  tone?: "primary" | "success" | "muted";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const fill =
    tone === "success" ? "bg-success" : tone === "muted" ? "bg-border-strong" : "bg-primary";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-track", className)}>
      <div
        className={cn("h-full rounded-full transition-all", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
