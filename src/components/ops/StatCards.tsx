import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "blue" | "amber" | "green" | "red" | "neutral";

const TONES: Record<StatTone, { chip: string; ring: string }> = {
  blue: { chip: "bg-info-soft text-info", ring: "border-info/35 ring-info/20" },
  amber: { chip: "bg-warning-soft text-warning", ring: "border-warning/35 ring-warning/20" },
  green: { chip: "bg-success-soft text-success", ring: "border-success/35 ring-success/20" },
  red: { chip: "bg-danger-soft text-danger", ring: "border-danger/35 ring-danger/20" },
  neutral: { chip: "bg-muted text-secondary-foreground", ring: "border-primary/35 ring-primary/20" },
};

/** The four numbers at the top of Today and Work. Large, calm, clickable. */
export function StatCard({
  label,
  value,
  tone = "neutral",
  icon,
  active,
  onClick,
}: {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      {...(onClick ? { onClick, "aria-pressed": Boolean(active) } : { disabled: true })}
      className={cn(
        "flex min-h-[92px] flex-col justify-between rounded-[14px] border border-border bg-card px-4 py-3.5 text-left shadow-[var(--shadow-card)] outline-none",
        onClick &&
          "cursor-pointer transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-[1px] hover:shadow-[var(--shadow-raised)] focus-visible:ring-2 focus-visible:ring-primary/30",
        active && cn("ring-1 ring-inset", t.ring),
      )}
    >
      <span className={cn("grid size-8 place-items-center rounded-[10px]", t.chip)}>{icon}</span>
      <span>
        <span className="block text-[28px] leading-none font-bold tracking-[-0.03em] tabular-nums">
          {value}
        </span>
        <span className="mt-1.5 block text-[12.5px] font-semibold text-muted-foreground">
          {label}
        </span>
      </span>
    </button>
  );
}

export function StatCardRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}
