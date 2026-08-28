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
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkItem[];
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
