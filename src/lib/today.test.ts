import { describe, expect, it } from "vitest";
import { todaySections } from "./today";
import type { WorkItemRow } from "./workitems";

const base: WorkItemRow = {
  id: "1",
  project_id: null,
  area_id: null,
  surface_id: null,
  item_type: "Task",
  title: "t",
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
  priority: "Normal",
  impact: null,
  next_action: null,
  workflow_step: null,
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  completed_at: null,
};
const row = (o: Partial<WorkItemRow>): WorkItemRow => ({ ...base, ...o });
const TODAY = "2026-09-17";

describe("todaySections", () => {
  it("hides waiting work with a future follow-up", () => {
    const s = todaySections(
      [row({ id: "a", status: "Waiting", waiting_on: "GC", follow_up_on: "2026-09-30" })],
      TODAY,
    );
    expect(s.needsNow).toHaveLength(0);
    expect(s.followUps).toHaveLength(0);
  });

  it("resurfaces waiting work when the follow-up is due", () => {
    const s = todaySections(
      [
        row({ id: "a", status: "Waiting", waiting_on: "GC", follow_up_on: TODAY }),
        row({ id: "b", status: "Waiting", waiting_on: "GC", follow_up_on: "2026-09-01" }),
      ],
      TODAY,
    );
    expect(s.followUps.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("shows scheduled work only on its date, and never without one", () => {
    const s = todaySections(
      [
        row({ id: "a", status: "Scheduled", due_date: TODAY }),
        row({ id: "b", status: "Scheduled", due_date: "2026-09-20" }),
        row({ id: "c", status: "Scheduled" }),
      ],
      TODAY,
    );
    expect(s.scheduledToday.map((i) => i.id)).toEqual(["a"]);
    expect(s.needsNow).toHaveLength(0);
  });

  it("puts overdue first in Needs you now and excludes done work", () => {
    const s = todaySections(
      [
        row({ id: "due", due_date: TODAY }),
        row({ id: "late", due_date: "2026-08-01" }),
        row({ id: "star", is_important: true }),
        row({ id: "done", status: "Complete", due_date: "2026-08-01" }),
        row({ id: "later", due_date: "2026-12-01" }),
      ],
      TODAY,
    );
    expect(s.needsNow.map((i) => i.id)).toEqual(["late", "star", "due"]);
  });
});
