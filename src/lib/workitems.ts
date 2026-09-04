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

/* ---------------- Simple task model (Job Operations scope) ----------------
 * Users only ever see four statuses and eight optional action categories.
 * Legacy status values in the database still map cleanly onto these four.
 */

export const TASK_STATUSES = ["To Do", "In Progress", "Waiting", "Done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_CATEGORIES = [
  "Follow Up / Confirm",
  "Measure / Verify",
  "Material / Order",
  "Schedule / Crew",
  "Layout / Decision",
  "Install / Finish",
  "Punch / Repair",
  "Change Order / Admin",
] as const;

/** Every stored status collapses to one of the four the user understands. */
export function simpleStatus(status: string): TaskStatus {
  if (status === "Complete" || status === "Done") return "Done";
  if (status === "Waiting" || status === "Expected") return "Waiting";
  if (status === "Open" || status === "To Do" || status === "Setup Needed") return "To Do";
  return "In Progress";
}

/** What we write back when the user picks one of the four statuses. */
export function storedStatus(status: TaskStatus): string {
  if (status === "Done") return "Complete";
  if (status === "To Do") return "Open";
  return status;
}

export type WorkItemRow = {

  id: string;
  project_id: string | null;
  area_id: string | null;
  surface_id: string | null;
  item_type: string;
  title: string;
  description: string | null;
  owner: string | null;
  owner_user_id: string | null;
  waiting_on: string | null;
  waiting_on_user_id: string | null;
  waiting_on_contact_id: string | null;
  waiting_on_company_id: string | null;
  status: string;
  is_important: boolean;
  due_date: string | null;
  follow_up_on?: string | null;
  category?: string | null;
  source_field_report_id?: string | null;

  priority: string;
  impact: string | null;
  next_action: string | null;
  workflow_step: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  archived_at?: string | null;
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

export const WORK_FILTERS = ["All", "Important", "My Work", "Waiting", "Completed"] as const;
export type WorkFilter = (typeof WORK_FILTERS)[number];

/** Today / My Work uses the same records, already narrowed to the signed-in user. */
export const TODAY_FILTERS = ["Active", "Important", "Waiting", "Completed"] as const;

export function matchesTodayFilter(filter: string, item: WorkItemRow) {
  const done = isComplete(item);
  switch (filter) {
    case "Completed":
      return done;
    case "Important":
      return !done && Boolean(item.is_important);
    case "Waiting":
      return !done && (Boolean(item.waiting_on) || item.status === "Waiting");
    default:
      return !done;
  }
}


/** Company-level work has no project; label it plainly instead of "—". */
export function projectLabel(item: Pick<WorkItemRow, "project_id" | "projects">) {
  return item.project_id ? (item.projects?.name ?? "Project") : "Company / Unassigned";
}

export function isComplete(item: WorkItemRow) {
  return item.status === "Complete" || Boolean(item.completed_at);
}

export function matchesWorkFilter(filter: WorkFilter, item: WorkItemRow, userId?: string | null) {
  const done = isComplete(item);
  switch (filter) {
    case "Completed":
      return done;
    case "All":
      return !done;
    case "Important":
      return !done && Boolean(item.is_important);
    case "My Work":
      return !done && Boolean(userId) && item.owner_user_id === userId;
    case "Waiting":
      return !done && (Boolean(item.waiting_on) || item.status === "Waiting");
  }
}

/** Starred work first, then earliest needed-by, then newest. */
export function compareWorkItems(a: WorkItemRow, b: WorkItemRow) {
  if (Boolean(a.is_important) !== Boolean(b.is_important)) return a.is_important ? -1 : 1;
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  return a.created_at < b.created_at ? 1 : -1;
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
        .select("*, projects(name, archived_at)")
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as (WorkItemRow & {
        projects?: { name: string; archived_at?: string | null } | null;
      })[];
      // Company-level work (no project) always shows; project work hides with its project.
      return rows.filter((r) => !r.project_id || !r.projects?.archived_at);
    },
  });
}

/**
 * The plain-language action a user takes on a workflow item. The software
 * advances the underlying workflow itself — the user never sees "advance step".
 */
export function workflowActionLabel(item: WorkItemRow): string | null {
  const wf = workflowFor(item);
  if (!wf) return null;
  const step = item.workflow_step ?? wf.steps[0] ?? "";
  const s = step.toLowerCase();
  if (/order|stock/.test(s)) return "Mark ordered";
  if (/receive|pick up/.test(s)) return "Mark received";
  if (/deliver/.test(s)) return "Confirm delivery";
  if (/schedule/.test(s)) return "Schedule return";
  if (/verif/.test(s)) return "Mark verified";
  if (/measure/.test(s)) return "Mark measured";
  if (/dimension/.test(s)) return "Record dimensions";
  if (/price/.test(s)) return "Mark priced";
  if (/install|perform/.test(s)) return "Mark work done";
  if (/installer/.test(s)) return "Installer assigned";
  if (/waiting|contractor/.test(s)) return "Mark ready";
  if (/release/.test(s)) return "Release affected work";
  if (/close/.test(s)) return "Close item";
  if (/scope/.test(s)) return "Scope confirmed";
  if (/field verify/.test(s)) return "Mark verified";
  return `Mark ${step.toLowerCase()} done`;
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
  const qc = useQueryClient();
  return useMutation({
    // Optimistic: the row flips in the UI immediately, the write catches up.
    onMutate: ({ id, patch }: { id: string; patch: Partial<WorkItemRow>; note?: string }) => {
      const previous = qc.getQueryData<WorkItemRow[]>(FEED_KEY);
      qc.setQueryData<WorkItemRow[]>(FEED_KEY, (rows) =>
        rows?.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
      return { previous };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(FEED_KEY, ctx.previous);
    },

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
          .insert({
            work_item_id: id,
            kind: "update",
            message: note,
            actor: await currentActorName(),
          });
      }
    },
    // The row already flipped optimistically, so only the feed and this item's
    // history need refreshing — no project-wide refetch on every keystroke.
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: FEED_KEY });
      qc.invalidateQueries({ queryKey: ["work_item_events", vars.id] });
    },
  });
}

/** The signed-in user's display name, used as the actor on work-item history. */
export async function currentActorName(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return "System";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  return profile?.full_name ?? user.email ?? "System";
}

export function useAddWorkNote() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const { error } = await supabase
        .from("work_item_events")
        .insert({ work_item_id: id, kind: "note", message, actor: await currentActorName() });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidate(vars.id),
  });
}

export type NewWorkItem = {
  project_id: string | null;
  item_type: string;
  title: string;
  description?: string | null;
  owner?: string | null;
  owner_user_id?: string | null;
  waiting_on?: string | null;
  waiting_on_user_id?: string | null;
  status?: string;
  due_date?: string | null;
  priority?: string;
  next_action?: string | null;
  is_important?: boolean;
  area_id?: string | null;
  surface_id?: string | null;
};

/* ---------------- Duplicate protection (bulk import) ---------------- */

function normalizeTitle(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|to|for|of|on|in|and|please|need|needs|confirm)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token overlap similarity, 0–1. Cheap and good enough for paste-time warnings. */
export function titleSimilarity(a: string, b: string) {
  const ta = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared += 1;
  });
  return shared / Math.min(ta.size, tb.size);
}

/** The most likely existing OPEN work item a proposed line duplicates. */
export function findDuplicate(
  proposed: { title: string; project_id: string | null },
  open: WorkItemRow[],
) {
  let best: { item: WorkItemRow; score: number } | null = null;
  for (const item of open) {
    if (isComplete(item)) continue;
    if ((item.project_id ?? null) !== (proposed.project_id ?? null)) continue;
    const score = titleSimilarity(proposed.title, item.title);
    if (score >= 0.6 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}

export function useCreateWorkItems() {
  const invalidate = useInvalidateWork();
  return useMutation({
    mutationFn: async (rows: NewWorkItem[]) => {
      const actor = await currentActorName();
      const payload = rows.map((r) => ({
        ...r,
        status: r.status ?? "Open",
        priority: r.priority ?? "Medium",
        created_by: actor,
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
            actor,
          })) as never,
        );
      }
      return ids;
    },
    onSuccess: () => invalidate(),
  });
}
