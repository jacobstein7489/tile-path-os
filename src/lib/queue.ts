import { currentMoveState } from "@/lib/moveforward";
import { isComplete, isDueToday, isOverdue, isWaiting, type WorkItemRow } from "@/lib/workitems";

/* ============================================================
 * Action queue classification.
 *
 * ONE rule set shared by Work and Today. It is deliberately
 * exhaustive: every OPEN work item lands in exactly one bucket,
 * so an open record can never disappear from the default view
 * just because it has no due date or follow-up date.
 * ============================================================ */

export const QUEUE_BUCKETS = [
  "Needs attention",
  "Due or overdue",
  "Waiting or follow-up",
  "Scheduled or upcoming",
  "Open · no date yet",
] as const;

export type QueueBucket = (typeof QUEUE_BUCKETS)[number];

/** Classify an open item. Complete items return null (they are history). */
export function queueBucket(item: WorkItemRow): QueueBucket | null {
  if (isComplete(item)) return null;
  const state = currentMoveState(item);
  if (isOverdue(item) || isDueToday(item)) return "Due or overdue";
  if (item.is_important || item.priority === "High") return "Needs attention";
  if (state === "Waiting" || isWaiting(item) || item.follow_up_on) return "Waiting or follow-up";
  if (state === "Scheduled" || item.due_date) return "Scheduled or upcoming";
  return "Open · no date yet";
}

export function bucketOrder(bucket: string) {
  const i = (QUEUE_BUCKETS as readonly string[]).indexOf(bucket);
  return i === -1 ? QUEUE_BUCKETS.length : i;
}

/* ---------------- KPI filters ---------------- */

export const WORK_KPIS = ["Open", "Waiting", "Overdue", "Scheduled"] as const;
export type WorkKpi = (typeof WORK_KPIS)[number];

/** Does this record belong to the given KPI card? */
export function matchesKpi(kpi: WorkKpi, item: WorkItemRow) {
  if (isComplete(item)) return false;
  switch (kpi) {
    case "Open":
      return true;
    case "Waiting":
      return currentMoveState(item) === "Waiting" || isWaiting(item);
    case "Overdue":
      return isOverdue(item);
    case "Scheduled":
      return currentMoveState(item) === "Scheduled";
  }
}

export function workKpiCounts(items: WorkItemRow[]): Record<WorkKpi, number> {
  return {
    Open: items.filter((i) => matchesKpi("Open", i)).length,
    Waiting: items.filter((i) => matchesKpi("Waiting", i)).length,
    Overdue: items.filter((i) => matchesKpi("Overdue", i)).length,
    Scheduled: items.filter((i) => matchesKpi("Scheduled", i)).length,
  };
}

/** Free-text match over the fields a user would actually search. */
export function matchesQuery(item: WorkItemRow, needle: string) {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return [
    item.title,
    item.description,
    item.waiting_on,
    item.owner,
    item.category,
    item.projects?.name,
  ]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}
