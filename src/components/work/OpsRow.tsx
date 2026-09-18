import { CalendarDays, ChevronRight, CircleAlert, Clock3, Star, UserRound } from "lucide-react";
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
  onOpen,
}: {
  item: WorkItemRow;
  selected: boolean;
  context?: Array<string | null | undefined>;
  person?: string | null;
  onOpen: (item: WorkItemRow) => void;
}) {
  const late = isOverdue(item);
  const waiting = isWaiting(item);
  const date = dateLabel(item);
  const sub = (context ?? []).filter(Boolean).join("  ·  ");
  const StateIcon = late ? CircleAlert : waiting ? Clock3 : CalendarDays;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={cn(
          "group grid min-h-[88px] w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-border/70 px-3 py-3 text-left transition-all duration-150 last:border-b-0",
          "hover:bg-primary-soft/35 focus-visible:bg-primary-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 md:px-5",
          selected && "bg-primary-soft hover:bg-primary-soft",
        )}
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl border shadow-[var(--shadow-card)]",
            late
              ? "border-danger/15 bg-danger-soft text-danger"
              : waiting
                ? "border-warning/15 bg-warning-soft text-warning"
                : "border-info/15 bg-info-soft text-info",
          )}
        >
          <StateIcon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="min-w-0 truncate text-[14px] leading-snug font-bold sm:text-[14.5px]">
              {item.title}
            </span>
            {item.is_important ? (
              <Star className="size-3 shrink-0 translate-y-[-1px] fill-warning text-warning" />
            ) : null}
          </span>
          {sub ? <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">{sub}</span> : null}
          {item.next_action ? (
            <span className="mt-1 hidden truncate text-[11.5px] font-medium text-secondary-foreground sm:block">
              Next · {item.next_action}
            </span>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-2 text-[11.5px] sm:gap-3">
          <span className="flex flex-col items-end gap-0.5">
            {date ? (
              <span
                className={cn(
                  "tabular-nums",
                  late
                    ? "font-semibold text-danger"
                    : waiting
                      ? "text-warning"
                      : "text-secondary-foreground",
                )}
              >
                {date}
              </span>
            ) : null}
            {person ? (
              <span className="hidden max-w-[150px] items-center gap-1 truncate text-muted-foreground sm:inline-flex">
                <UserRound className="size-3 shrink-0" /> {person}
              </span>
            ) : null}
          </span>
          <ChevronRight className="size-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
        </span>
      </button>
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
