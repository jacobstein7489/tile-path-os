import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChipTone } from "@/lib/status";

/* ============================================================
 * Universal Work Item engine.
 * One record per actionable thing. Everything (Dashboard, Today,
 * Project, Install Materials) reads and writes these same rows.
 * ============================================================ */

export const WORK_ITEM_TYPES = [
  "Task",
  "Question / Decision",
  "Dependency",
  "Field Verification",
  "Install Material Need",
  "Punch / Return Work",
  "Return Work",
  "Potential Change",
  "Approval",
  "Tile Follow-up",
] as const;

export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];

export const OWNERS = ["Office", "PM", "Site Manager", "Designer", "Crew"] as const;

export const WORK_ITEM_STATUSES = [
  "Open",
  "Waiting",
  "Price Needed",
  "Crew Needed",
  "Measurement Needed",
  "Test Needed",
  "To Order",
  "Setup Needed",
  "Needs Pricing",
  "Expected",
  "Scheduled",
  "Complete",
] as const;

export type WorkItemRow = {
  id: string;
  project_id: string;
  area_id: string | null;
  surface_id: string | null;
  item_type: string;
  title: string;
  description: string | null;
  owner: string | null;
  waiting_on: string | null;
  status: string;
  due_date: string | null;
  priority: string;
  impact: string | null;
  next_action: string | null;
  workflow_step: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  projects?: { name: string } | null;
};

export type WorkItemEvent = {
  id: string;
  work_item_id: string;
  kind: string;
  message: string;
  actor: string | null;
  created_at: string;
};

/* ---------------- Workflows ---------------- */

export type Workflow = { steps: string[]; nextAction: Record<string, string> };

export const WORKFLOWS: Partial<Record<string, Workflow>> = {
  "Return Work": {
    steps: [
      "Scope confirmed",
      "Installer selected",
      "Get price",
      "Approve price",
      "Labor PO",
      "Schedule return visit",
      "Perform work",
      "Verify work",
      "Close",
    ],
    nextAction: {
      "Scope confirmed": "Select installer",
      "Installer selected": "Get price from installer",
      "Get price": "Get price from installer",
      "Approve price": "Approve price / create labor PO",
      "Labor PO": "Create labor PO",
      "Schedule return visit": "Schedule return visit",
      "Perform work": "Perform work",
      "Verify work": "Verify work",
      Close: "Close item",
    },
  },
  "Punch / Return Work": {
    steps: [
      "Scope confirmed",
      "Installer selected",
      "Get price",
      "Approve price",
      "Schedule return visit",
      "Perform work",
      "Verify work",
      "Close",
    ],
    nextAction: {
      "Scope confirmed": "Select installer",
      "Installer selected": "Assign installer",
      "Get price": "Get price",
      "Approve price": "Approve price",
      "Schedule return visit": "Schedule return visit",
      "Perform work": "Perform work",
      "Verify work": "Verify work",
      Close: "Close item",
    },
  },
  "Field Verification": {
    steps: [
      "Measure",
      "Record dimensions",
      "Order",
      "Confirm order",
      "Receive",
      "Schedule installation",
      "Install",
      "Verify",
    ],
    nextAction: {
      Measure: "Measure on site",
      "Record dimensions": "Record dimensions",
      Order: "Place order",
      "Confirm order": "Confirm order",
      Receive: "Receive item",
      "Schedule installation": "Schedule installation",
      Install: "Install",
      Verify: "Verify work",
    },
  },
  "Install Material Need": {
    steps: [
      "Need identified",
      "Order / confirm stock",
      "Receive / pick up",
      "Deliver to site",
      "Ready",
    ],
    nextAction: {
      "Need identified": "Order or confirm stock",
      "Order / confirm stock": "Order or confirm stock",
      "Receive / pick up": "Receive or pick up",
      "Deliver to site": "Deliver to site",
      Ready: "Mark ready",
    },
  },
  Dependency: {
    steps: [
      "Waiting on contractor",
      "Contractor says ready",
      "Field verify",
      "Release affected work",
    ],
    nextAction: {
      "Waiting on contractor": "Follow up",
      "Contractor says ready": "Field verify",
      "Field verify": "Field verify on site",
      "Release affected work": "Release affected work",
    },
  },
};

export function workflowFor(item: Pick<WorkItemRow, "item_type">) {
  return WORKFLOWS[item.item_type];
}

/** Advance a workflow-backed item one step and derive its next action. */
export function advanceWorkflow(item: WorkItemRow) {
  const wf = workflowFor(item);
  if (!wf) return null;
  const first = wf.steps[0] ?? "";
  const final = wf.steps[wf.steps.length - 1] ?? "";
  const current = item.workflow_step ?? first;
  const idx = wf.steps.indexOf(current);
  const next = wf.steps[Math.min(idx + 1, wf.steps.length - 1)] ?? final;
  return {
    workflow_step: next,
    next_action: wf.nextAction[next] ?? next,
    status: next === final ? "Complete" : "Open",
    completed_at: next === final ? new Date().toISOString() : null,
  };
}

/* ---------------- Buckets & tones ---------------- */

export const WORK_FILTERS = ["Open", "Needs Action", "Waiting", "Upcoming", "Completed"] as const;
export type WorkFilter = (typeof WORK_FILTERS)[number];

export function isComplete(item: WorkItemRow) {
  return item.status === "Complete" || Boolean(item.completed_at);
}

export function matchesWorkFilter(filter: WorkFilter, item: WorkItemRow) {
  const done = isComplete(item);
  switch (filter) {
    case "Completed":
      return done;
    case "Open":
      return !done;
    case "Waiting":
      return !done && (Boolean(item.waiting_on) || item.status === "Waiting");
    case "Needs Action":
      return !done && !item.waiting_on && item.status !== "Waiting";
    case "Upcoming":
      return !done && Boolean(item.due_date);
  }
}

export function statusTone(status: string): ChipTone {
  if (status === "Complete") return "green";
  if (status === "Waiting" || status === "Expected") return "amber";
  if (
    status === "Price Needed" ||
    status === "Crew Needed" ||
    status === "Needs Pricing" ||
    status === "Measurement Needed" ||
    status === "Test Needed"
  )
    return "red";
  if (status === "To Order" || status === "Setup Needed") return "amber";
  return "blue";
}

export function typeTone(type: string): ChipTone {
  switch (type) {
    case "Install Material Need":
      return "green";
    case "Dependency":
      return "amber";
    case "Return Work":
    case "Punch / Return Work":
      return "violet";
    case "Potential Change":
      return "red";
    case "Field Verification":
      return "blue";
    default:
      return "neutral";
  }
}

/* ---------------- Data access ---------------- */

const FEED_KEY = ["work_feed"];

export function useWorkFeed() {
  return useQuery({
    queryKey: FEED_KEY,
    queryFn: async (): Promise<WorkItemRow[]> => {
      const { data, error } = await supabase
        .from("work_items")
        .select("*, projects(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WorkItemRow[];
    },
  });
}

export function useWorkItemEvents(workItemId: string | null) {
  return useQuery({
    queryKey: ["work_item_events", workItemId],
    enabled: Boolean(workItemId),
    queryFn: async (): Promise<WorkItemEvent[]> => {
      const { data, error } = await supabase
        .from("work_item_events")
        .select("*")
        .eq("work_item_id", workItemId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkItemEvent[];
    },
  });
}

function useInvalidateWork() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: FEED_KEY });
    qc.invalidateQueries({ queryKey: ["work_items"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    if (id) qc.invalidateQueries({ queryKey: ["work_item_events", id] });
  };
}

export function useSaveWorkItem() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
      note,
    }: {
      id: string;
      patch: Partial<WorkItemRow>;
      note?: string;
    }) => {
      const { error } = await supabase
        .from("work_items")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
      if (note) {
        await supabase
          .from("work_item_events")
          .insert({ work_item_id: id, kind: "update", message: note, actor: "Yaakov" });
      }
    },
    onSuccess: (_d, vars) => invalidate(vars.id),
  });
}

export function useAddWorkNote() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const { error } = await supabase
        .from("work_item_events")
        .insert({ work_item_id: id, kind: "note", message, actor: "Yaakov" });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidate(vars.id),
  });
}

export type NewWorkItem = {
  project_id: string;
  item_type: string;
  title: string;
  description?: string | null;
  owner?: string | null;
  waiting_on?: string | null;
  status?: string;
  due_date?: string | null;
  priority?: string;
  next_action?: string | null;
  area_id?: string | null;
  surface_id?: string | null;
};

export function useCreateWorkItems() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: async (rows: NewWorkItem[]) => {
      const payload = rows.map((r) => ({
        ...r,
        status: r.status ?? "Open",
        priority: r.priority ?? "Medium",
        created_by: "Yaakov",
        workflow_step: WORKFLOWS[r.item_type]?.steps[0] ?? null,
      }));
      const { data, error } = await supabase
        .from("work_items")
        .insert(payload as never)
        .select("id");
      if (error) throw error;
      const ids = ((data ?? []) as { id: string }[]).map((d) => d.id);
      if (ids.length) {
        await supabase.from("work_item_events").insert(
          ids.map((id) => ({
            work_item_id: id,
            kind: "created",
            message: "Work item created",
            actor: "Yaakov",
          })) as never,
        );
      }
      return ids;
    },
    onSuccess: () => invalidate(),
  });
}
