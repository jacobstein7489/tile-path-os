import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Area, SurfaceFull } from "@/lib/data";
import type { FinishAssignment, FinishSelection, FinishZone } from "@/lib/finishes";
import { ruleApplies, type DesignDecision, type QuestionRule, type ZoneContext } from "@/lib/designmeeting";

/**
 * Readiness is DERIVED. The named requirements below are the source of truth;
 * the percentage is only a summary and can never be edited by hand.
 *
 * Recomputation is deterministic: each requirement carries a stable
 * (scope_key, requirement_key) identity, so recomputing updates the same row,
 * creates newly applicable ones and retires the rest. No duplicate blockers.
 */

export const READINESS_CATEGORIES = [
  "Room / Surface setup",
  "Finish specification",
  "Design decisions",
  "Installer package",
  "Material readiness",
  "Site / dependency readiness",
] as const;

export type RequirementState = "met" | "blocked" | "not_evaluated";

export type ReadinessRequirement = {
  id: string;
  project_id: string;
  area_id: string | null;
  surface_id: string | null;
  zone_id: string | null;
  scope_key: string;
  requirement_key: string;
  category: string;
  label: string;
  detail: string | null;
  state: RequirementState;
  work_item_id: string | null;
  sort_order: number;
  computed_at: string;
};

type Computed = Omit<ReadinessRequirement, "id" | "project_id" | "computed_at">;

export function useReadiness(projectId: string) {
  return useQuery({
    queryKey: ["readiness", projectId],
    queryFn: async (): Promise<ReadinessRequirement[]> => {
      const { data, error } = await supabase
        .from("readiness_requirement")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ReadinessRequirement[];
    },
  });
}

export type ReadinessInput = {
  areas: Area[];
  surfaces: SurfaceFull[];
  zones: FinishZone[];
  assignments: FinishAssignment[];
  selections: FinishSelection[];
  decisions: DesignDecision[];
  rules: QuestionRule[];
  planFileCount: number;
  publishedPackageAreaIds: string[];
  outdatedPackageAreaIds: string[];
};

/** Pure: build the full requirement list from real records. */
export function computeRequirements(input: ReadinessInput): Computed[] {
  const out: Computed[] = [];
  const push = (r: Partial<Computed> & Pick<Computed, "scope_key" | "requirement_key" | "category" | "label" | "state">) =>
    out.push({
      area_id: null,
      surface_id: null,
      zone_id: null,
      detail: null,
      work_item_id: null,
      sort_order: out.length,
      ...r,
    } as Computed);

  // --- Project level setup ---
  push({
    scope_key: "project",
    requirement_key: "plan_attached",
    category: "Room / Surface setup",
    label: "Plan or scope file attached",
    state: input.planFileCount > 0 ? "met" : "blocked",
    detail: input.planFileCount > 0 ? `${input.planFileCount} file(s)` : "No file uploaded yet",
  });
  push({
    scope_key: "project",
    requirement_key: "rooms_created",
    category: "Room / Surface setup",
    label: "Rooms created",
    state: input.areas.length > 0 ? "met" : "blocked",
    detail: `${input.areas.length} room(s)`,
  });
  push({
    scope_key: "project",
    requirement_key: "surfaces_created",
    category: "Room / Surface setup",
    label: "Surfaces created",
    state: input.surfaces.length > 0 ? "met" : "blocked",
    detail: `${input.surfaces.length} surface(s)`,
  });

  // --- Per surface / zone ---
  for (const area of input.areas) {
    const areaSurfaces = input.surfaces.filter((s) => s.area_id === area.id);
    if (areaSurfaces.length === 0) {
      push({
        scope_key: `area:${area.id}`,
        requirement_key: "has_surfaces",
        category: "Room / Surface setup",
        label: `${area.name} — no surfaces yet`,
        state: "blocked",
        area_id: area.id,
      });
    }

    for (const surface of areaSurfaces) {
      const zones = input.zones.filter((z) => z.surface_id === surface.id);
      if (zones.length === 0) {
        push({
          scope_key: `surface:${surface.id}`,
          requirement_key: "has_zone",
          category: "Room / Surface setup",
          label: `${surface.name} — no finish zone`,
          state: "blocked",
          area_id: area.id,
          surface_id: surface.id,
        });
        continue;
      }

      for (const zone of zones) {
        const assignment = input.assignments.find((a) => a.zone_id === zone.id) ?? null;
        const selection = assignment?.finish_selection_id
          ? (input.selections.find((s) => s.id === assignment.finish_selection_id) ?? null)
          : null;
        const zoneLabel = `${area.name} · ${surface.name}${zone.is_default ? "" : ` (${zone.name})`}`;
        const ctx: ZoneContext = { surface, zone, assignment, selection, areaName: area.name };

        push({
          scope_key: `zone:${zone.id}`,
          requirement_key: "tile_selected",
          category: "Finish specification",
          label: `${zoneLabel} — tile product selected`,
          state: selection ? "met" : "blocked",
          detail: selection ? selection.label : "No finish selection linked",
          area_id: area.id,
          surface_id: surface.id,
          zone_id: zone.id,
        });

        // One requirement per genuinely applicable, readiness-relevant question.
        for (const rule of input.rules) {
          if (!rule.required_for_readiness) continue;
          if (rule.target_key === "assignment.finish_selection_id") continue;
          const decision = input.decisions.find(
            (d) => d.question_key === rule.key && d.zone_id === zone.id,
          );
          const applies = ruleApplies(rule, ctx);
          if (!applies && !(decision && decision.status === "unresolved")) continue;
          push({
            scope_key: `zone:${zone.id}`,
            requirement_key: `question:${rule.key}`,
            category: rule.readiness_category,
            label: `${zoneLabel} — ${rule.prompt}`,
            state: applies ? "blocked" : "met",
            detail:
              decision?.status === "unresolved"
                ? "Unresolved — tracked as work"
                : "Not confirmed yet",
            work_item_id: decision?.work_item_id ?? null,
            area_id: area.id,
            surface_id: surface.id,
            zone_id: zone.id,
          });
        }
      }
    }

    // --- Installer package per room ---
    const published = input.publishedPackageAreaIds.includes(area.id);
    const outdated = input.outdatedPackageAreaIds.includes(area.id);
    push({
      scope_key: `area:${area.id}`,
      requirement_key: "installer_package",
      category: "Installer package",
      label: `${area.name} — installer package published`,
      state: published && !outdated ? "met" : "blocked",
      detail: !published
        ? "Not published"
        : outdated
          ? "Specification changed since the last revision"
          : "Published",
      area_id: area.id,
    });
  }

  // --- Truthful placeholders for what Sprint 1 does not yet evaluate ---
  push({
    scope_key: "project",
    requirement_key: "material_readiness",
    category: "Material readiness",
    label: "Material readiness",
    state: "not_evaluated",
    detail: "Existing delivery records only — the procurement engine arrives in Sprint 2",
  });
  push({
    scope_key: "project",
    requirement_key: "site_readiness",
    category: "Site / dependency readiness",
    label: "Site and trade dependencies",
    state: "not_evaluated",
    detail: "Not evaluated in this sprint",
  });

  return out;
}

export function readinessSummary(rows: Pick<ReadinessRequirement, "state">[]) {
  const met = rows.filter((r) => r.state === "met").length;
  const blocked = rows.filter((r) => r.state === "blocked").length;
  const evaluated = met + blocked;
  return {
    met,
    blocked,
    evaluated,
    pct: evaluated === 0 ? 0 : Math.round((met / evaluated) * 100),
    ready: blocked === 0 && evaluated > 0,
  };
}

/** Idempotent: upsert every computed requirement, retire the rest. */
export function useRecomputeReadiness(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReadinessInput) => {
      const computed = computeRequirements(input);
      const now = new Date().toISOString();

      if (computed.length > 0) {
        const { error } = await supabase.from("readiness_requirement").upsert(
          computed.map((c) => ({ ...c, project_id: projectId, computed_at: now })),
          { onConflict: "project_id,scope_key,requirement_key" },
        );
        if (error) throw error;
      }

      // Retire anything that is no longer applicable.
      const { data: stale } = await supabase
        .from("readiness_requirement")
        .select("id,scope_key,requirement_key")
        .eq("project_id", projectId)
        .lt("computed_at", now);
      const keep = new Set(computed.map((c) => `${c.scope_key}|${c.requirement_key}`));
      const remove = (stale ?? []).filter(
        (r) => !keep.has(`${r.scope_key}|${r.requirement_key}`),
      );
      if (remove.length > 0) {
        const { error } = await supabase
          .from("readiness_requirement")
          .delete()
          .in("id", remove.map((r) => r.id));
        if (error) throw error;
      }

      const summary = readinessSummary(computed);
      const { error: pErr } = await supabase
        .from("projects")
        .update({ readiness_pct: summary.pct, readiness_computed_at: now })
        .eq("id", projectId);
      if (pErr) throw pErr;
      return summary;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["readiness", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
