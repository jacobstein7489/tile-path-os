import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function OpsCanvas({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "ops-canvas mx-auto w-full max-w-[1500px] px-4 pb-28 pt-5 md:px-7 md:pb-10",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function OpsPageHeader({
  eyebrow,
  title,
  summary,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  summary?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="ops-hero">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <p className="ops-eyebrow">{eyebrow}</p>
          <h1 className="ops-title">{title}</h1>
          {summary ? <div className="ops-summary">{summary}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function OpsPlane({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("ops-plane", className)}>{children}</section>;
}

export function ObjectMark({
  children,
  tone = "blue",
  className,
}: {
  children: ReactNode;
  tone?: "blue" | "amber" | "green" | "red" | "ink";
  className?: string;
}) {
  return <span className={cn("ops-mark", `ops-mark-${tone}`, className)}>{children}</span>;
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "amber" | "green" | "red";
}) {
  return <span className={cn("ops-pill", `ops-pill-${tone}`)}>{children}</span>;
}

export function OpsMeter({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: number;
  tone?: "blue" | "amber" | "green";
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-bold uppercase text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground tabular-nums">{safe}%</span>
      </div>
      <div className="ops-meter">
        <span
          className={cn(
            tone === "amber" ? "bg-warning" : tone === "green" ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}
