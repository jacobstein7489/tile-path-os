import { ArrowUpRight, CalendarDays, CircleAlert, Clock3, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { isOverdue, isWaiting, todayIso, type WorkItemRow } from "@/lib/workitems";
import { currentMoveState } from "@/lib/moveforward";
import { cn } from "@/lib/utils";

/**
 * The one operational row used by Today and Work. It carries a compact visual
 * state anchor while keeping the whole row available to the shared panel.
 */

export function shortDate(iso: string | null | undefined) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The single most useful date word for a row. */
export function dateLabel(item: WorkItemRow) {
  const today = todayIso();
  const waiting = currentMoveState(item) === "Waiting";
  const d = waiting ? (item.follow_up_on ?? item.due_date) : item.due_date;
  if (!d) return null;
  if (d === today) return waiting ? "Follow up today" : "Today";
  if (d < today) return waiting ? `Follow up ${shortDate(d)}` : `Late · ${shortDate(d)}`;
  return waiting ? `Follow up ${shortDate(d)}` : (shortDate(d) as string);
}

export function OpsRow({
  item,
  selected,
  /** Quiet line beneath the action. Falsey parts are dropped. */
  context,
  /** Right-hand metadata, e.g. the owner or who we are waiting on. */
  person,
}: {
  item: WorkItemRow;
  selected: boolean;
  context?: Array<string | null | undefined>;
  person?: string | null;
}) {
  const late = isOverdue(item);
  const waiting = isWaiting(item);
  const date = dateLabel(item);
  const sub = (context ?? []).filter(Boolean).join("  ·  ");
  const StateIcon = late ? CircleAlert : waiting ? Clock3 : CalendarDays;

  return (
    <li>
      <Link
        to="/work/$itemId"
        params={{ itemId: item.id }}
        className={cn(
          "group grid min-h-[66px] w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-border/80 px-3 py-2.5 text-left transition-colors duration-150 last:border-b-0",
          "hover:bg-muted/55 focus-visible:bg-muted/55 focus-visible:outline-none md:px-4",
          selected && "bg-primary-soft hover:bg-primary-soft",
        )}
      >
        <span className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          late ? "bg-danger-soft text-danger" : waiting ? "bg-warning-soft text-warning" : "bg-info-soft text-info",
        )}>
          <StateIcon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="min-w-0 truncate text-[14px] leading-snug font-semibold">
              {item.title}
            </span>
            {item.is_important ? (
              <Star className="size-3 shrink-0 translate-y-[-1px] fill-warning text-warning" />
            ) : null}
          </span>
          {sub ? (
            <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{sub}</span>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-3 text-[11.5px]">
          <span className="flex flex-col items-end gap-0.5">
          {date ? (
            <span
              className={cn(
                "tabular-nums",
                late ? "font-semibold text-danger" : waiting ? "text-warning" : "text-secondary-foreground",
              )}
            >
              {date}
            </span>
          ) : null}
          {person ? <span className="max-w-[150px] truncate text-muted-foreground">{person}</span> : null}
          </span>
          <ArrowUpRight className="hidden size-4 text-muted-foreground transition-colors group-hover:text-primary sm:block" />
        </span>
      </Link>
    </li>
  );
}

/** Compact section heading used above operational groups. */
export function OpsSectionHeading({
  label,
  count,
  right,
}: {
  label: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <h2 className="text-[11px] font-bold tracking-[0.08em] text-secondary-foreground uppercase">
        {label}
        {typeof count === "number" && count > 0 ? (
          <span className="ml-2 font-semibold text-muted-foreground">{count}</span>
        ) : null}
      </h2>
      {right}
    </div>
  );
}
