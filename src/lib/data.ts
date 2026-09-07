import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Project = {
  id: string;
  name: string;
  address: string | null;
  customer: string | null;
  project_type: string;
  lifecycle_stage: string;
  exception_state: string | null;
  readiness_pct: number;
  readiness_note: string | null;
  installation_progress: number;
  crew_lead: string | null;
  start_date: string | null;
  target_date: string | null;
  material_status: string;
  needs_attention: string | null;
  next_move: string | null;
  next_move_owner: string | null;
  stage_steps_done: string[];
  project_manager: string | null;
  archived_at?: string | null;
  customer_company_id?: string | null;
  gc_company_id?: string | null;
  primary_contact_id?: string | null;
  pm_user_id?: string | null;
  site_manager_user_id?: string | null;
  salesperson_user_id?: string | null;
  estimator_user_id?: string | null;
  source?: string | null;
  bid_due_date?: string | null;
  follow_up_date?: string | null;
  intake_notes?: string | null;
  job_number?: string | null;
  commission_user_id?: string | null;
  /** Manual for now; later this comes from the approved contract/estimate. */
  commissionable_amount?: number | null;
  commissionable_source?: string;
  /** Project-level override of the salesperson default rate (percent). */
  commission_rate_override?: number | null;
  commission_status?: string;
  commission_plan_id?: string | null;
  /** Frozen copy of the plan applied when the job was signed. */
  commission_plan_snapshot?: import("@/lib/commissions").PlanSnapshot | null;
};

export type Area = {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  status: string;
  progress_pct: number;
  notes: string | null;
};

export type Surface = {
  id: string;
  area_id: string;
  name: string;
  sort_order: number;
  status: string;
  progress_pct: number;
  plan_sf: number | null;
  tile_tag: string | null;
  tile_size: string | null;
};

export type WorkItem = {
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
  impact: string | null;
  next_action: string | null;
};

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: async (): Promise<Project | null> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Project | null;
    },
  });
}

export function useAreas(projectId: string) {
  return useQuery({
    queryKey: ["areas", projectId],
    queryFn: async (): Promise<Area[]> => {
      const { data, error } = await supabase
        .from("project_areas")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Area[];
    },
  });
}

export function useSurfaces(areaIds: string[]) {
  return useQuery({
    queryKey: ["surfaces", areaIds],
    enabled: areaIds.length > 0,
    queryFn: async (): Promise<Surface[]> => {
      const { data, error } = await supabase
        .from("project_surfaces")
        .select("*")
        .in("area_id", areaIds)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Surface[];
    },
  });
}

export function useWorkItems(projectId: string) {
  return useQuery({
    queryKey: ["work_items", projectId],
    queryFn: async (): Promise<WorkItem[]> => {
      const { data, error } = await supabase
        .from("work_items")
        .select("*")
        .eq("project_id", projectId)
        .is("archived_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkItem[];
    },
  });
}

/** Patch any project by id — used by cross-project sheets (leads, commissions). */
export function useUpdateAnyProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Project> }) => {
      const { error } = await supabase.from("projects").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Project>) => {
      const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/* ============================================================
 * Extended records: crews, schedule, materials, POs, receipts,
 * visit checklist and cross-project work items.
 * ============================================================ */

export type Crew = {
  id: string;
  name: string;
  initials: string;
  tone: string;
  sort_order: number;
  is_open_lane: boolean;
};

export type ScheduleAssignment = {
  id: string;
  project_id: string;
  crew_id: string | null;
  work_date: string;
  span_days: number;
  kind: string;
  status: string;
  notes: string | null;
};

export type MaterialItem = {
  id: string;
  project_id: string;
  area_id: string | null;
  surface_id: string | null;
  name: string;
  spec: string | null;
  category: string;
  goes_to: string | null;
  supplier: string | null;
  responsibility: string | null;
  unit: string | null;
  required_qty: number | null;
  ordered_qty: number;
  received_qty: number;
  damaged_qty: number;
  status: string;
  next_step: string | null;
  expected_date: string | null;
  needs_attention: boolean;
  notes: string | null;
  updated_at: string;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier: string;
  project_id: string | null;
  status: string;
  expected_date: string | null;
  notes: string | null;
  created_at: string;
};

export type MaterialReceipt = {
  id: string;
  material_item_id: string;
  po_id: string | null;
  receipt_date: string;
  received_qty: number;
  damaged_qty: number;
  wrong_qty: number;
  packing_slip: string | null;
  notes: string | null;
  created_at: string;
};

export type VisitChecklistItem = {
  id: string;
  project_id: string;
  visit_date: string;
  label: string;
  done: boolean;
  sort_order: number;
};

export type SurfaceFull = Surface & {
  tile_sku: string | null;
  tile_finish: string | null;
  manufacturer: string | null;
  supplier: string | null;
  grout_color: string | null;
  grout_manufacturer: string | null;
  joint_size: string | null;
  metal_profile: string | null;
  layout_pattern: string | null;
  layout_direction: string | null;
  start_point: string | null;
  tile_height: string | null;
  finish_transition: string | null;
  prep: string | null;
  waterproofing: string | null;
  underlayment: string | null;
  field_sf: number | null;
  notes: string | null;
  detail_confirmed: boolean;
};

export type WorkItemFull = WorkItem & {
  priority: string;
  completed_at: string | null;
  owner_user_id?: string | null;
  waiting_on_user_id?: string | null;
  waiting_on_contact_id?: string | null;
  waiting_on_company_id?: string | null;
};

export function useCrews() {
  return useQuery({
    queryKey: ["crews"],
    queryFn: async (): Promise<Crew[]> => {
      const { data, error } = await supabase.from("crews").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Crew[];
    },
  });
}

export function useScheduleAssignments() {
  return useQuery({
    queryKey: ["schedule"],
    queryFn: async (): Promise<ScheduleAssignment[]> => {
      const { data, error } = await supabase
        .from("schedule_assignments")
        .select("*")
        .order("work_date");
      if (error) throw error;
      return (data ?? []) as ScheduleAssignment[];
    },
  });
}

export function useMaterialItems(projectId?: string) {
  return useQuery({
    queryKey: ["material_items", projectId ?? "all"],
    queryFn: async (): Promise<MaterialItem[]> => {
      let q = supabase.from("material_items").select("*").order("created_at");
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MaterialItem[];
    },
  });
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async (): Promise<PurchaseOrder[]> => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PurchaseOrder[];
    },
  });
}

export function useReceipts() {
  return useQuery({
    queryKey: ["material_receipts"],
    queryFn: async (): Promise<MaterialReceipt[]> => {
      const { data, error } = await supabase
        .from("material_receipts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MaterialReceipt[];
    },
  });
}

export function useAllWorkItems() {
  return useQuery({
    queryKey: ["work_items", "all"],
    queryFn: async (): Promise<WorkItemFull[]> => {
      const { data, error } = await supabase
        .from("work_items")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkItemFull[];
    },
  });
}

export function useVisitChecklist(projectId: string) {
  return useQuery({
    queryKey: ["visit_checklist", projectId],
    queryFn: async (): Promise<VisitChecklistItem[]> => {
      const { data, error } = await supabase
        .from("visit_checklist_items")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as VisitChecklistItem[];
    },
  });
}

export function useAreasWithSurfaces(projectId: string) {
  const areas = useAreas(projectId);
  const areaIds = (areas.data ?? []).map((a) => a.id);
  const surfaces = useQuery({
    queryKey: ["surfaces_full", projectId, areaIds.join(",")],
    enabled: areaIds.length > 0,
    queryFn: async (): Promise<SurfaceFull[]> => {
      const { data, error } = await supabase
        .from("project_surfaces")
        .select("*")
        .in("area_id", areaIds)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as SurfaceFull[];
    },
  });
  return { areas, surfaces };
}

/* ---------------- Generic persistence helpers ---------------- */

const RELATED_KEYS = [
  "projects",
  "project",
  "areas",
  "surfaces",
  "surfaces_full",
  "work_items",
  "material_items",
  "purchase_orders",
  "material_receipts",
  "schedule",
  "visit_checklist",
  "crews",
];

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    for (const key of RELATED_KEYS) qc.invalidateQueries({ queryKey: [key] });
  };
}

type TableName =
  | "projects"
  | "project_areas"
  | "project_surfaces"
  | "work_items"
  | "material_items"
  | "purchase_orders"
  | "po_lines"
  | "material_receipts"
  | "schedule_assignments"
  | "visit_checklist_items"
  | "crews";

export function useInsertRow<T extends Record<string, unknown>>(table: TableName) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (row: T) => {
      const { data, error } = await supabase
        .from(table)
        .insert(row as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateRow<T extends Record<string, unknown>>(table: TableName) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: T }) => {
      const { error } = await supabase
        .from(table)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteRow(table: TableName) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Recompute a material line's totals from its append-only receipt history. */
export function materialStatusFrom(
  item: Pick<MaterialItem, "required_qty" | "ordered_qty" | "received_qty" | "damaged_qty">,
): string {
  const required = item.required_qty ?? 0;
  const good = item.received_qty;
  if (required > 0 && good >= required) return item.damaged_qty > 0 ? "Received" : "Ready";
  if (good > 0) return "Partially Received";
  if (item.ordered_qty > 0) return "Ordered";
  if (required > 0) return "To Order";
  return "Needed";
}
