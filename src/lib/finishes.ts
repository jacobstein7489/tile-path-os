import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sprint 1 finish model.
 *
 * - project_surfaces  = the physical object (geometry, prep, waterproofing)
 * - finish_zone       = one treated area of a surface; every surface has one default zone
 * - finish_selection  = REUSABLE project-level product specification (tile / manufacturer / SKU)
 * - finish_assignment = the zone-specific effective installation spec (grout, joint, metal,
 *                       pattern, direction, start point, height / termination)
 *
 * The same selection may serve many zones; the location-specific decisions never live on it.
 */

export type FinishZone = {
  id: string;
  project_id: string;
  surface_id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  notes: string | null;
  archived_at: string | null;
};

export type FinishSelection = {
  id: string;
  project_id: string;
  label: string;
  tile_tag: string | null;
  product: string | null;
  manufacturer: string | null;
  tile_sku: string | null;
  tile_size: string | null;
  actual_size: string | null;
  tile_finish: string | null;
  supplier: string | null;
  supplied_by: string | null;
  spec_status: string;
  revision_no: number;
  confirmed_at: string | null;
  notes: string | null;
  archived_at: string | null;
};

export type FinishAssignment = {
  id: string;
  project_id: string;
  zone_id: string;
  finish_selection_id: string | null;
  grout_manufacturer: string | null;
  grout_color: string | null;
  joint_size: string | null;
  metal_profile: string | null;
  edge_treatment: string | null;
  layout_pattern: string | null;
  layout_direction: string | null;
  start_point: string | null;
  tile_height: string | null;
  finish_transition: string | null;
  coverage: string | null;
  sort_order: number;
  spec_status: string;
  confirmed_at: string | null;
  notes: string | null;
  archived_at: string | null;
};

/** Fields that make a selection "specified enough" to hand to an installer. */
export const SELECTION_REQUIRED: (keyof FinishSelection)[] = ["manufacturer"];
/** Location-specific fields that must be decided per zone. */
export const ASSIGNMENT_REQUIRED: (keyof FinishAssignment)[] = [
  "grout_color",
  "joint_size",
  "layout_direction",
  "start_point",
];

export function useFinishZones(projectId: string) {
  return useQuery({
    queryKey: ["finish_zones", projectId],
    queryFn: async (): Promise<FinishZone[]> => {
      const { data, error } = await supabase
        .from("finish_zone")
        .select("*")
        .eq("project_id", projectId)
        .is("archived_at", null)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as FinishZone[];
    },
  });
}

export function useFinishSelections(projectId: string) {
  return useQuery({
    queryKey: ["finish_selections", projectId],
    queryFn: async (): Promise<FinishSelection[]> => {
      const { data, error } = await supabase
        .from("finish_selection")
        .select("*")
        .eq("project_id", projectId)
        .is("archived_at", null)
        .order("label");
      if (error) throw error;
      return (data ?? []) as FinishSelection[];
    },
  });
}

export function useFinishAssignments(projectId: string) {
  return useQuery({
    queryKey: ["finish_assignments", projectId],
    queryFn: async (): Promise<FinishAssignment[]> => {
      const { data, error } = await supabase
        .from("finish_assignment")
        .select("*")
        .eq("project_id", projectId)
        .is("archived_at", null)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as FinishAssignment[];
    },
  });
}

export const FINISH_KEYS = [
  "finish_zones",
  "finish_selections",
  "finish_assignments",
  "readiness",
  "design_decisions",
];

export function useInvalidateFinishes(projectId: string) {
  const qc = useQueryClient();
  return () => {
    for (const key of FINISH_KEYS) qc.invalidateQueries({ queryKey: [key, projectId] });
  };
}

/** Ensures every surface has its implicit default zone + assignment. Safe to re-run. */
export function useEnsureZones(projectId: string) {
  const invalidate = useInvalidateFinishes(projectId);
  return useMutation({
    mutationFn: async (surfaceIds: string[]) => {
      if (surfaceIds.length === 0) return;
      const { data: zones } = await supabase
        .from("finish_zone")
        .select("id,surface_id")
        .in("surface_id", surfaceIds);
      const have = new Set((zones ?? []).map((z) => z.surface_id));
      const missing = surfaceIds.filter((id) => !have.has(id));
      if (missing.length > 0) {
        const { data: created, error } = await supabase
          .from("finish_zone")
          .insert(
            missing.map((surface_id) => ({
              project_id: projectId,
              surface_id,
              name: "Main",
              is_default: true,
              sort_order: 0,
            })),
          )
          .select("id");
        if (error) throw error;
        for (const z of created ?? []) {
          await supabase
            .from("finish_assignment")
            .insert({ project_id: projectId, zone_id: z.id, sort_order: 0 });
        }
      }
      const allZoneIds = [...(zones ?? []).map((z) => z.id)];
      if (allZoneIds.length > 0) {
        const { data: assigns } = await supabase
          .from("finish_assignment")
          .select("zone_id")
          .in("zone_id", allZoneIds);
        const haveA = new Set((assigns ?? []).map((a) => a.zone_id));
        const missingA = allZoneIds.filter((id) => !haveA.has(id));
        if (missingA.length > 0) {
          await supabase
            .from("finish_assignment")
            .insert(
              missingA.map((zone_id) => ({ project_id: projectId, zone_id, sort_order: 0 })),
            );
        }
      }
    },
    onSuccess: invalidate,
  });
}

export function useAddZone(projectId: string) {
  const invalidate = useInvalidateFinishes(projectId);
  return useMutation({
    mutationFn: async ({
      surfaceId,
      name,
      sortOrder,
    }: {
      surfaceId: string;
      name: string;
      sortOrder: number;
    }) => {
      const { data, error } = await supabase
        .from("finish_zone")
        .insert({
          project_id: projectId,
          surface_id: surfaceId,
          name,
          sort_order: sortOrder,
          is_default: false,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: aErr } = await supabase
        .from("finish_assignment")
        .insert({ project_id: projectId, zone_id: data.id, sort_order: sortOrder });
      if (aErr) throw aErr;
      return data.id;
    },
    onSuccess: invalidate,
  });
}

export function useSaveAssignment(projectId: string) {
  const invalidate = useInvalidateFinishes(projectId);
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<FinishAssignment> }) => {
      const { error } = await supabase.from("finish_assignment").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSaveSelection(projectId: string) {
  const invalidate = useInvalidateFinishes(projectId);
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<FinishSelection> }) => {
      const { error } = await supabase.from("finish_selection").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCreateSelection(projectId: string) {
  const invalidate = useInvalidateFinishes(projectId);
  return useMutation({
    mutationFn: async (patch: Partial<FinishSelection> & { label: string }) => {
      const { data, error } = await supabase
        .from("finish_selection")
        .insert({ ...patch, project_id: projectId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });
}

export function selectionSummary(s: FinishSelection | null | undefined) {
  if (!s) return "No tile selected";
  return [s.label, s.tile_size, s.manufacturer].filter(Boolean).join(" · ");
}

/** True when this surface genuinely has more than one treatment. */
export function hasMultipleZones(zones: FinishZone[], surfaceId: string) {
  return zones.filter((z) => z.surface_id === surfaceId).length > 1;
}
