import { describe, expect, it } from "vitest";
import { QUEUE_BUCKETS, matchesKpi, queueBucket, workKpiCounts } from "@/lib/queue";
import { isComplete, isItemOwnedBy, todayIso, type WorkItemRow } from "@/lib/workitems";

function item(patch: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: Math.random().toString(36).slice(2),
    project_id: null,
    area_id: null,
    surface_id: null,
    item_type: "Task",
    title: "Item",
    description: null,
    owner: null,
    owner_user_id: null,
    waiting_on: null,
    waiting_on_user_id: null,
    waiting_on_contact_id: null,
    waiting_on_company_id: null,
    status: "Open",
    is_important: false,
    due_date: null,
    follow_up_on: null,
    category: null,
    priority: "Normal",
    impact: null,
    next_action: null,
    workflow_step: null,
    created_by: null,
    created_at: new Date().toISOString(),
    completed_at: null,
    ...patch,
  };
}

const bare = item();
const late = item({ due_date: "2020-01-01" });
const dueToday = item({ due_date: todayIso() });
const waiting = item({ status: "Waiting", waiting_on: "GC" });
const scheduled = item({ status: "Scheduled", due_date: "2099-01-01" });
const important = item({ is_important: true });
const done = item({ status: "Complete", completed_at: new Date().toISOString() });

const all = [bare, late, dueToday, waiting, scheduled, important, done];

describe("action queue", () => {
  it("includes legacy owner labels in Mine without rewriting ownership", () => {
    expect(
      isItemOwnedBy(item({ owner_user_id: "user-1", owner: "Old Name" }), "user-1", "Sam Lee"),
    ).toBe(true);
    expect(
      isItemOwnedBy(item({ owner_user_id: null, owner: "Sam Lee" }), "user-1", "Sam Lee"),
    ).toBe(true);
    expect(
      isItemOwnedBy(item({ owner_user_id: null, owner: "Someone Else" }), "user-1", "Sam Lee"),
    ).toBe(false);
  });
  it("assigns every open item to exactly one bucket", () => {
    const open = all.filter((i) => !isComplete(i));
    for (const i of open) {
      const bucket = queueBucket(i);
      expect(bucket).not.toBeNull();
      expect(QUEUE_BUCKETS).toContain(bucket!);
    }
    expect(queueBucket(done)).toBeNull();
  });

  it("never hides an open item that lacks dates", () => {
    expect(queueBucket(bare)).toBe("Open · no date yet");
  });

  it("default rendered count equals the Open KPI count", () => {
    const rendered = all.filter((i) => queueBucket(i) !== null).length;
    expect(rendered).toBe(workKpiCounts(all).Open);
    expect(rendered).toBeGreaterThan(0);
  });

  it("classifies dates and states deterministically", () => {
    expect(queueBucket(late)).toBe("Due or overdue");
    expect(queueBucket(dueToday)).toBe("Due or overdue");
    expect(queueBucket(waiting)).toBe("Waiting or follow-up");
    expect(queueBucket(scheduled)).toBe("Scheduled or upcoming");
    expect(queueBucket(important)).toBe("Needs attention");
  });

  it("KPI filters select the records their counts promise", () => {
    const counts = workKpiCounts(all);
    for (const kpi of ["Open", "To Do", "Waiting", "Scheduled", "Needs Attention"] as const) {
      expect(all.filter((i) => matchesKpi(kpi, i)).length).toBe(counts[kpi]);
    }
    expect(counts["Needs Attention"]).toBeGreaterThanOrEqual(1);
    expect(counts["To Do"]).toBe(4);
    expect(counts.Waiting).toBe(1);
    expect(counts.Scheduled).toBe(1);
    expect(matchesKpi("Open", done)).toBe(false);
    expect(matchesKpi("Needs Attention", late)).toBe(true);
  });
});
