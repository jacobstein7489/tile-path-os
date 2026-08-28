import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const chipVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-neutral-chip text-muted-foreground",
        blue: "bg-info-soft text-info",
        green: "bg-success-soft text-success",
        amber: "bg-warning-soft text-warning",
        red: "bg-danger-soft text-danger",
        violet: "bg-violet-soft text-violet",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type ChipTone = NonNullable<VariantProps<typeof chipVariants>["tone"]>;

export function Chip({
  tone,
  children,
  className,
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn(chipVariants({ tone }), className)}>{children}</span>;
}

export function Dot({ tone }: { tone: ChipTone }) {
  const map: Record<ChipTone, string> = {
    neutral: "bg-muted-foreground",
    blue: "bg-info",
    green: "bg-success",
    amber: "bg-warning",
    red: "bg-danger",
    violet: "bg-violet",
  };
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", map[tone])} />;
}

export function stageTone(stage: string, exception: string | null): ChipTone {
  if (exception === "On Hold") return "amber";
  if (exception) return "neutral";
  switch (stage) {
    case "Installation":
      return "blue";
    case "Complete":
      return "green";
    case "Punch / Return":
      return "violet";
    case "Scheduled":
    case "Ready to Schedule":
      return "green";
    default:
      return "neutral";
  }
}

export function materialTone(status: string): ChipTone {
  switch (status) {
    case "Ready":
    case "Received":
      return "green";
    case "Ordered":
    case "Expected":
    case "Partially Received":
      return "blue";
    case "Short":
    case "Wrong":
    case "Damaged":
      return "red";
    case "To Order":
      return "amber";
    default:
      return "neutral";
  }
}

export function areaStatusTone(status: string): ChipTone {
  switch (status) {
    case "Ready":
      return "green";
    case "Working":
      return "blue";
    case "Blocked":
      return "red";
    case "Complete":
      return "green";
    default:
      return "neutral";
  }
}

export function workItemTone(status: string): ChipTone {
  switch (status) {
    case "Complete":
    case "Resolved / Approved":
    case "Approved":
      return "green";
    case "Waiting":
      return "amber";
    case "Needs Answer":
      return "red";
    default:
      return "blue";
  }
}
