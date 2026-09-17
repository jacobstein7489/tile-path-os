import { Star } from "lucide-react";
import { isOverdue, isWaiting, todayIso, type WorkItemRow } from "@/lib/workitems";
import { currentMoveState } from "@/lib/moveforward";
import { cn } from "@/lib/utils";

/**
 * The one operational row used by Today and Work. A hairline-separated line of
 * type, never a card: dominant action, quiet context beneath, restrained
 * metadata on the right. The whole row opens the shared WorkItemPanel.
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
  onOpen,
  /** Quiet line beneath the action. Falsey parts are dropped. */
  context,
  /** Right-hand metadata, e.g. the owner or who we are waiting on. */
  person,
}: {
  item: WorkItemRow;
  selected: boolean;
  onOpen: (item: WorkItemRow) => void;
  context?: Array<string | null | undefined>;
  person?: string | null;
}) {
  const late = isOverdue(item);
  const waiting = isWaiting(item);
  const date = dateLabel(item);
  const sub = (context ?? []).filter(Boolean).join("  ·  ");

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={cn(
          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-border px-1 py-3 text-left transition-colors duration-100",
          "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none md:px-2",
          selected && "bg-primary-soft hover:bg-primary-soft",
        )}
      >
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-1.5">
            {late ? <span className="size-1.5 shrink-0 translate-y-[-2px] rounded-full bg-danger" /> : null}
            {!late && waiting ? (
              <span className="size-1.5 shrink-0 translate-y-[-2px] rounded-full bg-warning" />
            ) : null}
            <span className="min-w-0 truncate text-[14.5px] leading-snug font-semibold tracking-[-0.01em]">
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

        <span className="flex shrink-0 flex-col items-end gap-0.5 text-[11.5px]">
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
      </button>
    </li>
  );
}

/** Uppercase hairline heading used above every list on Today and Work. */
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
    <div className="flex items-baseline justify-between gap-3 border-b border-foreground/15 pb-1.5">
      <h2 className="text-[10px] font-bold tracking-[0.09em] text-secondary-foreground uppercase">
        {label}
        {typeof count === "number" && count > 0 ? (
          <span className="ml-2 font-semibold text-muted-foreground">{count}</span>
        ) : null}
      </h2>
      {right}
    </div>
  );
}
