import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FinishAssignment, FinishSelection, FinishZone } from "@/lib/finishes";
import type { SurfaceFull } from "@/lib/data";

/**
 * Smart Design Meeting.
 *
 * Questions come from the question_rule table (data-driven), but writes never do:
 * every rule points at an ALLOWLISTED field below. A rule can never touch an
 * arbitrary table or column, and a confirmed answer always updates the real
 * source-of-truth record before it is logged in design_decision.
 */

export type QuestionRule = {
  id: string;
  key: string;
  prompt: string;
  help_text: string | null;
  scope: string;
  applies_to_surface_types: string[];
  applies_when: Record<string, unknown> | null;
  answer_type: string;
  options: string[] | null;
  target_key: string;
  required_for_readiness: boolean;
  readiness_category: string;
  sort_order: number;
  is_active: boolean;
};

export type DesignDecision = {
  id: string;
  project_id: string;
  session_id: string | null;
  area_id: string | null;
  surface_id: string | null;
  zone_id: string | null;
  question_key: string;
  prompt: string | null;
  answer_value: string | null;
  status: string;
  work_item_id: string | null;
  decided_at: string | null;
};

/* ---------------- Allowlisted write targets ---------------- */

type TargetEntity = "assignment" | "selection" | "surface";
type Target = { entity: TargetEntity; field: string };

export const TARGET_MAP: Record<string, Target> = {
  "assignment.finish_selection_id": { entity: "assignment", field: "finish_selection_id" },
  "assignment.grout_manufacturer": { entity: "assignment", field: "grout_manufacturer" },
  "assignment.grout_color": { entity: "assignment", field: "grout_color" },
  "assignment.joint_size": { entity: "assignment", field: "joint_size" },
  "assignment.metal_profile": { entity: "assignment", field: "metal_profile" },
  "assignment.edge_treatment": { entity: "assignment", field: "edge_treatment" },
  "assignment.layout_pattern": { entity: "assignment", field: "layout_pattern" },
  "assignment.layout_direction": { entity: "assignment", field: "layout_direction" },
  "assignment.start_point": { entity: "assignment", field: "start_point" },
  "assignment.tile_height": { entity: "assignment", field: "tile_height" },
  "assignment.finish_transition": { entity: "assignment", field: "finish_transition" },
  "assignment.coverage": { entity: "assignment", field: "coverage" },
  "assignment.notes": { entity: "assignment", field: "notes" },
  "selection.manufacturer": { entity: "selection", field: "manufacturer" },
  "selection.tile_sku": { entity: "selection", field: "tile_sku" },
  "selection.tile_size": { entity: "selection", field: "tile_size" },
  "selection.tile_finish": { entity: "selection", field: "tile_finish" },
  "selection.supplier": { entity: "selection", field: "supplier" },
  "selection.supplied_by": { entity: "selection", field: "supplied_by" },
  "selection.notes": { entity: "selection", field: "notes" },
  "surface.waterproofing": { entity: "surface", field: "waterproofing" },
  "surface.prep": { entity: "surface", field: "prep" },
  "surface.underlayment": { entity: "surface", field: "underlayment" },
};

export function targetFor(rule: QuestionRule): Target | null {
  return TARGET_MAP[rule.target_key] ?? null;
}

/* ---------------- Data ---------------- */

export function useQuestionRules() {
  return useQuery({
    queryKey: ["question_rules"],
    queryFn: async (): Promise<QuestionRule[]> => {
      const { data, error } = await supabase
        .from("question_rule")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as QuestionRule[];
    },
  });
}

export function useDesignDecisions(projectId: string) {
  return useQuery({
    queryKey: ["design_decisions", projectId],
    queryFn: async (): Promise<DesignDecision[]> => {
      const { data, error } = await supabase
        .from("design_decision")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as DesignDecision[];
    },
  });
}

/* ---------------- Applicability ---------------- */

export type ZoneContext = {
  surface: SurfaceFull & { surface_kind?: string | null; features?: unknown };
  zone: FinishZone;
  assignment: FinishAssignment | null;
  selection: FinishSelection | null;
  areaName: string;
};

function surfaceTypeMatches(rule: QuestionRule, ctx: ZoneContext) {
  const types = rule.applies_to_surface_types ?? [];
  if (types.length === 0) return true;
  const kind = (ctx.surface.surface_kind ?? "").toLowerCase();
  const name = `${ctx.surface.name} ${ctx.zone.name}`.toLowerCase();
  return types.some((t) => {
    const needle = t.toLowerCase();
    return kind === needle || name.includes(needle);
  });
}

function isBlank(v: unknown) {
  return v === null || v === undefined || String(v).trim() === "";
}

/** Only unresolved, applicable questions. Known information is never re-asked. */
export function ruleApplies(rule: QuestionRule, ctx: ZoneContext): boolean {
  if (!surfaceTypeMatches(rule, ctx)) return false;
  const w = (rule.applies_when ?? {}) as Record<string, unknown>;

  if (typeof w["assignment_missing"] === "string") {
    const f = w["assignment_missing"] as string;
    if (!isBlank((ctx.assignment as Record<string, unknown> | null)?.[f])) return false;
  }
  if (typeof w["selection_missing"] === "string") {
    const f = w["selection_missing"] as string;
    if (!ctx.selection) return false; // pick the product first
    if (!isBlank((ctx.selection as unknown as Record<string, unknown>)[f])) return false;
  }
  if (typeof w["surface_missing"] === "string") {
    const f = w["surface_missing"] as string;
    if (!isBlank((ctx.surface as unknown as Record<string, unknown>)[f])) return false;
  }
  if (w["assignment_equals"] && typeof w["assignment_equals"] === "object") {
    const pairs = w["assignment_equals"] as Record<string, string>;
    for (const [f, expected] of Object.entries(pairs)) {
      if ((ctx.assignment as Record<string, unknown> | null)?.[f] !== expected) return false;
    }
  }
  if (typeof w["surface_feature"] === "string") {
    const needle = (w["surface_feature"] as string).toLowerCase();
    const features = Array.isArray(ctx.surface.features)
      ? (ctx.surface.features as unknown[]).map((x) => String(x).toLowerCase())
      : [];
    const named = `${ctx.surface.name} ${ctx.zone.name}`.toLowerCase();
    if (!features.includes(needle) && !named.includes(needle)) return false;
  }

  // The tile product question only applies while no product is attached.
  if (rule.target_key === "assignment.finish_selection_id" && ctx.selection) return false;
  return true;
}

export function validateAnswer(rule: QuestionRule, value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter an answer";
  if (rule.answer_type === "choice" || rule.answer_type === "selection_ref") {
    if (rule.answer_type === "choice") {
      const opts = rule.options ?? [];
      if (opts.length > 0 && !opts.includes(v)) return "Pick one of the listed options";
    }
  }
  if (rule.answer_type === "number" && Number.isNaN(Number(v))) return "Enter a number";
  if (rule.answer_type === "boolean" && !["Yes", "No"].includes(v)) return "Answer Yes or No";
  return null;
}

/* ---------------- Confirm / unresolved ---------------- */

function scopeIds(ctx: ZoneContext, areaId: string) {
  return {
    area_id: areaId,
    surface_id: ctx.surface.id,
    zone_id: ctx.zone.id,
  };
}

export function useConfirmDecision(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rule,
      ctx,
      areaId,
      value,
      sessionId,
    }: {
      rule: QuestionRule;
      ctx: ZoneContext;
      areaId: string;
      value: string;
      sessionId: string | null;
    }) => {
      const problem = validateAnswer(rule, value);
      if (problem) throw new Error(problem);
      const target = targetFor(rule);
      if (!target) throw new Error(`No approved write target for ${rule.key}`);

      const { data: priorDecision } = await supabase
        .from("design_decision")
        .select("work_item_id")
        .eq("project_id", projectId)
        .eq("question_key", rule.key)
        .eq("zone_id", ctx.zone.id)
        .maybeSingle();

      // 1. Write the real source-of-truth record through the allowlisted field.
      if (target.entity === "assignment") {
        if (!ctx.assignment) throw new Error("This zone has no finish assignment yet");
        const { error } = await supabase
          .from("finish_assignment")
          .update({ [target.field]: value } as never)
          .eq("id", ctx.assignment.id);
        if (error) throw error;
      } else if (target.entity === "selection") {
        if (!ctx.selection) throw new Error("Pick the tile product first");
        const { error } = await supabase
          .from("finish_selection")
          .update({ [target.field]: value } as never)
          .eq("id", ctx.selection.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_surfaces")
          .update({ [target.field]: value } as never)
          .eq("id", ctx.surface.id);
        if (error) throw error;
      }

      // 2. Log the decision (history only — never the source of truth).
      const { error: dErr } = await supabase.from("design_decision").upsert(
        {
          project_id: projectId,
          session_id: sessionId,
          ...scopeIds(ctx, areaId),
          question_key: rule.key,
          prompt: rule.prompt,
          answer_value: value,
          status: "confirmed",
          decided_at: new Date().toISOString(),
        },
        { onConflict: "project_id,question_key,zone_id" },
      );
      if (dErr) throw dErr;

      // 3. Close any work item that existed only to chase this answer.
      if (priorDecision?.work_item_id) {
        await supabase
          .from("work_items")
          .update({ status: "Complete", completed_at: new Date().toISOString() })
          .eq("id", priorDecision.work_item_id);
        await supabase.from("work_item_events").insert({
          work_item_id: priorDecision.work_item_id,
          kind: "resolved",
          message: `Design decision confirmed: ${rule.prompt} → ${value}`,
        });
      }
    },
    onSuccess: () => {
      for (const k of ["finish_assignments", "finish_selections", "surfaces_full", "design_decisions", "readiness"]) {
        qc.invalidateQueries({ queryKey: [k] });
      }
      qc.invalidateQueries({ queryKey: ["work_items"] });
    },
  });
}

/**
 * Unresolved answer → exactly ONE work item, reused forever. A second call
 * appends an event to the same item instead of creating a duplicate task.
 */
export function useMarkUnresolved(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rule,
      ctx,
      areaId,
      note,
      sessionId,
    }: {
      rule: QuestionRule;
      ctx: ZoneContext;
      areaId: string;
      note?: string;
      sessionId: string | null;
    }) => {
      const { data: prior } = await supabase
        .from("design_decision")
        .select("id,work_item_id")
        .eq("project_id", projectId)
        .eq("question_key", rule.key)
        .eq("zone_id", ctx.zone.id)
        .maybeSingle();

      let workItemId = prior?.work_item_id ?? null;
      const label = `${ctx.areaName} · ${ctx.surface.name}${ctx.zone.is_default ? "" : ` (${ctx.zone.name})`}`;

      if (workItemId) {
        await supabase.from("work_item_events").insert({
          work_item_id: workItemId,
          kind: "followup",
          message: note?.trim() ? note.trim() : `Still unresolved: ${rule.prompt}`,
        });
      } else {
        const { data: created, error } = await supabase
          .from("work_items")
          .insert({
            project_id: projectId,
            area_id: areaId,
            surface_id: ctx.surface.id,
            item_type: "Question / Decision",
            category: "Layout / Decision",
            title: `${rule.prompt} — ${label}`,
            description: note?.trim() || null,
            status: "Open",
            next_action: "Confirm in design meeting",
          })
          .select("id")
          .single();
        if (error) throw error;
        workItemId = created.id;
        await supabase.from("work_item_events").insert({
          work_item_id: workItemId,
          kind: "created",
          message: `Raised from the design meeting: ${rule.prompt}`,
        });
      }

      const { error: dErr } = await supabase.from("design_decision").upsert(
        {
          project_id: projectId,
          session_id: sessionId,
          ...scopeIds(ctx, areaId),
          question_key: rule.key,
          prompt: rule.prompt,
          status: "unresolved",
          work_item_id: workItemId,
        },
        { onConflict: "project_id,question_key,zone_id" },
      );
      if (dErr) throw dErr;
      return workItemId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["design_decisions"] });
      qc.invalidateQueries({ queryKey: ["work_items"] });
      qc.invalidateQueries({ queryKey: ["readiness"] });
    },
  });
}

export function useOpenSession(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: open } = await supabase
        .from("design_meeting_session")
        .select("id")
        .eq("project_id", projectId)
        .is("completed_at", null)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (open?.id) return open.id as string;
      const { data, error } = await supabase
        .from("design_meeting_session")
        .insert({ project_id: projectId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["design_sessions", projectId] }),
  });
}
