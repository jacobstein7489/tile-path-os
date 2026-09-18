import { currentMoveState } from "@/lib/moveforward";
import {
  actionDate,
  compareWorkItems,
  isComplete,
  isDueToday,
  isOverdue,
  todayIso,
  type WorkItemRow,
} from "@/lib/workitems";

/**
 * Today's three operational sections, derived from the SAME work_items rows
 * the Work screen reads. No copies, no stored buckets, no timers: every
 * decision here is date-driven, so a waiting item resurfaces on its own the
 * day its follow-up becomes due.
 */

export type TodaySections = {
  needsNow: WorkItemRow[];
  followUps: WorkItemRow[];
  scheduledToday: WorkItemRow[];
  /**
   * Fallback so the command center is never blank: every other open item this
   * person owns, so undated work is still workable from Today.
   */
  nextMoves: WorkItemRow[];
};

/** The date a scheduled item is scheduled for: the item's existing date field. */
function scheduledDate(item: WorkItemRow) {
  return item.due_date ?? null;
}

/** The date a waiting item is meant to be chased again. */
function followUpDate(item: WorkItemRow) {
  return item.follow_up_on ?? item.due_date ?? null;
}

function hasFutureDate(item: WorkItemRow, today: string) {
  const d = actionDate(item);
  return Boolean(d && d > today);
}

export function todaySections(items: WorkItemRow[], today = todayIso()): TodaySections {
  const active = items.filter((i) => !isComplete(i));

  const scheduledToday = active.filter(
    (i) => currentMoveState(i) === "Scheduled" && scheduledDate(i) === today,
  );

  const followUps = active.filter((i) => {
    if (currentMoveState(i) !== "Waiting") return false;
    const d = followUpDate(i);
    return Boolean(d && d <= today);
  });

  const needsNow = active.filter((i) => {
    const state = currentMoveState(i);
    // Waiting and Scheduled work has its own section; never show it twice.
    if (state === "Waiting" || state === "Scheduled" || state === "Done") return false;
    return isOverdue(i) || isDueToday(i) || (i.is_important && !hasFutureDate(i, today));
  });

  const placed = new Set([...scheduledToday, ...followUps, ...needsNow].map((i) => i.id));
  const nextMoves = active.filter((i) => !placed.has(i.id));

  return {
    nextMoves: [...nextMoves].sort(compareWorkItems),
    // Overdue first, then due today, then the normal work sort.
    needsNow: [...needsNow].sort((a, b) => {
      const oa = isOverdue(a) ? 0 : 1;
      const ob = isOverdue(b) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return compareWorkItems(a, b);
    }),
    // Most overdue follow-up first.
    followUps: [...followUps].sort((a, b) => {
      const da = followUpDate(a) ?? "";
      const db = followUpDate(b) ?? "";
      if (da !== db) return da < db ? -1 : 1;
      return compareWorkItems(a, b);
    }),
    scheduledToday: [...scheduledToday].sort(compareWorkItems),
  };
}

/** Quiet one-line summary, straight from the real section counts. */
export function todaySummaryLine(s: TodaySections) {
  const parts: string[] = [];
  if (s.needsNow.length) parts.push(`${s.needsNow.length} need attention`);
  if (s.followUps.length) parts.push(`${s.followUps.length} follow-ups`);
  if (s.scheduledToday.length) parts.push(`${s.scheduledToday.length} scheduled`);
  return parts.length ? parts.join(" · ") : "Nothing needs you right now.";
}

export { followUpDate, scheduledDate };
