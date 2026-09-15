import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAreasWithSurfaces, useScheduleAssignments } from "@/lib/data";
import {
  useFinishAssignments,
  useFinishSelections,
  useFinishZones,
} from "@/lib/finishes";
import { useDesignDecisions, useQuestionRules, ruleApplies, type ZoneContext } from "@/lib/designmeeting";
import { isPackageOutdated, usePackageRevisions, usePackages } from "@/lib/packages";
import { useReadiness, useRecomputeReadiness, readinessSummary } from "@/lib/readiness";

export type ProjectFile = {
  id: string;
  project_id: string;
  filename: string;
  kind: string;
  storage_path: string;
  created_at: string;
};

export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ["project_files", projectId],
    queryFn: async (): Promise<ProjectFile[]> => {
      const { data, error } = await supabase
        .from("project_files")
        .select("id,project_id,filename,kind,storage_path,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectFile[];
    },
  });
}

/**
 * One place that assembles the setup/design graph, keeps derived readiness
 * fresh and produces the Office Setup summary. Nothing here is manually ticked.
 */
export function useProjectSetup(projectId: string) {
  const { areas, surfaces } = useAreasWithSurfaces(projectId);
  const zones = useFinishZones(projectId);
  const assignments = useFinishAssignments(projectId);
  const selections = useFinishSelections(projectId);
  const decisions = useDesignDecisions(projectId);
  const rules = useQuestionRules();
  const files = useProjectFiles(projectId);
  const packages = usePackages(projectId);
  const revisions = usePackageRevisions(projectId);
  const readiness = useReadiness(projectId);
  const schedule = useScheduleAssignments();
  const recompute = useRecomputeReadiness(projectId);

  const areaList = areas.data ?? [];
  const surfaceList = surfaces.data ?? [];
  const zoneList = zones.data ?? [];
  const assignmentList = assignments.data ?? [];
  const selectionList = selections.data ?? [];
  const decisionList = decisions.data ?? [];
  const ruleList = rules.data ?? [];
  const fileList = files.data ?? [];
  const packageList = packages.data ?? [];
  const revisionList = revisions.data ?? [];

  const lastSpecChange = useMemo(() => {
    const stamps = [
      ...assignmentList.map((a) => (a as unknown as { updated_at?: string }).updated_at ?? ""),
      ...selectionList.map((s) => (s as unknown as { updated_at?: string }).updated_at ?? ""),
      ...surfaceList.map((s) => (s as unknown as { updated_at?: string }).updated_at ?? ""),
    ].filter(Boolean);
    return stamps.length ? stamps.sort().at(-1)! : null;
  }, [assignmentList, selectionList, surfaceList]);

  const publishedPackageAreaIds = packageList
    .filter((p) => p.current_revision_no > 0 && p.area_id)
    .map((p) => p.area_id!);
  const outdatedPackageAreaIds = packageList
    .filter((p) => p.area_id && isPackageOutdated({ pkg: p, revisions: revisionList, lastSpecChange }))
    .map((p) => p.area_id!);

  const input = useMemo(
    () => ({
      areas: areaList,
      surfaces: surfaceList,
      zones: zoneList,
      assignments: assignmentList,
      selections: selectionList,
      decisions: decisionList,
      rules: ruleList,
      planFileCount: fileList.length,
      publishedPackageAreaIds,
      outdatedPackageAreaIds,
    }),
    [
      areaList,
      surfaceList,
      zoneList,
      assignmentList,
      selectionList,
      decisionList,
      ruleList,
      fileList.length,
      publishedPackageAreaIds.join(","),
      outdatedPackageAreaIds.join(","),
    ],
  );

  const ready =
    !areas.isLoading &&
    !surfaces.isLoading &&
    !zones.isLoading &&
    !assignments.isLoading &&
    !selections.isLoading &&
    !decisions.isLoading &&
    !rules.isLoading &&
    !files.isLoading &&
    !packages.isLoading &&
    !revisions.isLoading;

  // Keep the derived requirements in step with the records, without loops.
  const signature = JSON.stringify([
    input.planFileCount,
    areaList.map((a) => a.id),
    surfaceList.map((s) => [
      s.id,
      s.waterproofing,
      s.prep,
      (s as unknown as { updated_at?: string }).updated_at ?? "",
    ]),
    zoneList.map((z) => z.id),
    assignmentList.map((a) => [a.id, (a as unknown as { updated_at?: string }).updated_at ?? ""]),
    selectionList.map((s) => [s.id, (s as unknown as { updated_at?: string }).updated_at ?? ""]),
    decisionList.map((d) => [d.id, d.status]),
    ruleList.length,
    publishedPackageAreaIds,
    outdatedPackageAreaIds,
  ]);
  const lastSignature = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || ruleList.length === 0) return;
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    recompute.mutate(input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signature]);

  const requirements = readiness.data ?? [];
  const blockers = requirements.filter((r) => r.state === "blocked");
  const summary = readinessSummary(requirements);

  /** Zone-level contexts used by both Rooms and the Design Meeting. */
  const contexts: (ZoneContext & { areaId: string })[] = [];
  for (const area of areaList) {
    for (const surface of surfaceList.filter((s) => s.area_id === area.id)) {
      for (const zone of zoneList.filter((z) => z.surface_id === surface.id)) {
        const assignment = assignmentList.find((a) => a.zone_id === zone.id) ?? null;
        const selection = assignment?.finish_selection_id
          ? (selectionList.find((s) => s.id === assignment.finish_selection_id) ?? null)
          : null;
        contexts.push({ surface, zone, assignment, selection, areaName: area.name, areaId: area.id });
      }
    }
  }

  const openQuestions = contexts.flatMap((ctx) =>
    ruleList
      .filter((rule) => ruleApplies(rule, ctx))
      .map((rule) => ({ rule, ctx })),
  );

  const mappedZones = contexts.filter((c) => c.selection).length;

  const officeSetup = [
    {
      key: "plan",
      label: "Plan or scope file attached",
      value: fileList.length > 0 ? `${fileList.length} file(s)` : "Nothing uploaded",
      done: fileList.length > 0,
      to: "files" as const,
    },
    {
      key: "rooms",
      label: "Rooms created",
      value: `${areaList.length} room(s)`,
      done: areaList.length > 0,
      to: "scope" as const,
    },
    {
      key: "surfaces",
      label: "Surfaces created",
      value: `${surfaceList.length} surface(s)`,
      done: surfaceList.length > 0,
      to: "scope" as const,
    },
    {
      key: "mapping",
      label: "Finish mapping",
      value: `${mappedZones} of ${contexts.length} zones mapped`,
      done: contexts.length > 0 && mappedZones === contexts.length,
      to: "scope" as const,
    },
    {
      key: "decisions",
      label: "Design decisions still required",
      value: openQuestions.length === 0 ? "None outstanding" : `${openQuestions.length} question(s)`,
      done: openQuestions.length === 0 && contexts.length > 0,
      to: "design" as const,
    },
    {
      key: "package",
      label: "Installer package",
      value:
        areaList.length === 0
          ? "No rooms yet"
          : `${publishedPackageAreaIds.length} of ${areaList.length} room(s) published`,
      done: areaList.length > 0 && publishedPackageAreaIds.length === areaList.length,
      to: "package" as const,
    },
  ];

  return {
    loading: !ready,
    areaList,
    surfaceList,
    zoneList,
    assignmentList,
    selectionList,
    decisionList,
    ruleList,
    fileList,
    packageList,
    revisionList,
    contexts,
    openQuestions,
    requirements,
    blockers,
    summary,
    officeSetup,
    input,
    recompute,
    publishedPackageAreaIds,
    outdatedPackageAreaIds,
    hasScheduleAssignment: (schedule.data ?? []).some((s) => s.project_id === projectId),
  };
}
