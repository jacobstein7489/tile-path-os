import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Area, SurfaceFull } from "@/lib/data";
import type { FinishAssignment, FinishSelection, FinishZone } from "@/lib/finishes";
import { measurementSummary, resolveSpec } from "@/lib/spec";

/**
 * Installer packages are built from the SAME surface / zone / assignment / selection
 * records the office edits. Publishing writes an immutable snapshot revision;
 * a later specification change requires a new revision — nothing is overwritten.
 */

export type InstallerPackage = {
  id: string;
  project_id: string;
  area_id: string | null;
  title: string;
  current_revision_no: number;
  updated_at: string;
};

export type PackageRevision = {
  id: string;
  package_id: string;
  project_id: string;
  revision_no: number;
  snapshot: PackageSnapshot;
  published_by_name: string | null;
  published_at: string;
  change_note: string | null;
};

export type PackageSnapshotRow = {
  surface: string;
  zone: string;
  tile: string;
  manufacturer: string;
  sku: string;
  size: string;
  grout: string;
  joint: string;
  edge: string;
  pattern: string;
  direction: string;
  start: string;
  height: string;
  transition: string;
  prep: string;
  waterproofing: string;
  /** Added in Sprint 1 — older revisions simply do not carry these. */
  actual_size?: string;
  tile_finish?: string;
  supplier?: string;
  alignment?: string;
  underlayment?: string;
  measurements?: string;
  features?: string;
  instructions?: string;
};

export type PackageSnapshot = {
  room: string;
  generated_at: string;
  rows: PackageSnapshotRow[];
};

export function usePackages(projectId: string) {
  return useQuery({
    queryKey: ["installer_packages", projectId],
    queryFn: async (): Promise<InstallerPackage[]> => {
      const { data, error } = await supabase
        .from("installer_package")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data ?? []) as InstallerPackage[];
    },
  });
}

export function usePackageRevisions(projectId: string) {
  return useQuery({
    queryKey: ["package_revisions", projectId],
    queryFn: async (): Promise<PackageRevision[]> => {
      const { data, error } = await supabase
        .from("installer_package_revision")
        .select("*")
        .eq("project_id", projectId)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PackageRevision[];
    },
  });
}

const dash = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

/**
 * The package is built from the authoritative selection/assignment records via
 * `resolveSpec`, never from the legacy flat surface columns directly.
 */
export function buildSnapshot(args: {
  area: Area;
  surfaces: SurfaceFull[];
  zones: FinishZone[];
  assignments: FinishAssignment[];
  selections: FinishSelection[];
}): PackageSnapshot {
  const rows: PackageSnapshotRow[] = [];
  for (const surface of args.surfaces.filter((s) => s.area_id === args.area.id)) {
    for (const zone of args.zones.filter((z) => z.surface_id === surface.id)) {
      const a = args.assignments.find((x) => x.zone_id === zone.id) ?? null;
      const sel = a?.finish_selection_id
        ? (args.selections.find((s) => s.id === a.finish_selection_id) ?? null)
        : null;
      const spec = resolveSpec({ surface, zone, assignment: a, selection: sel });
      rows.push({
        surface: surface.name,
        zone: zone.is_default ? "Main" : zone.name,
        tile: dash(sel?.label ?? spec.product),
        manufacturer: dash(spec.manufacturer),
        sku: dash(spec.sku),
        size: dash(spec.nominalSize),
        actual_size: dash(spec.actualSize),
        tile_finish: dash(spec.tileFinish),
        supplier: dash([spec.supplier, spec.suppliedBy].filter(Boolean).join(" · ")),
        grout: dash([spec.groutManufacturer, spec.groutColor].filter(Boolean).join(" ")),
        joint: dash(spec.jointSize),
        edge: dash([spec.edgeTreatment, spec.metalProfile].filter(Boolean).join(" · ")),
        pattern: dash(spec.layoutPattern),
        direction: dash(spec.layoutDirection),
        start: dash(spec.startPoint),
        alignment: dash(spec.coverage),
        height: dash(spec.tileHeight),
        transition: dash(spec.finishTransition),
        prep: dash(spec.prep),
        waterproofing: dash(spec.waterproofing),
        underlayment: dash(spec.underlayment),
        measurements: dash(measurementSummary(surface)),
        features: dash(spec.features.join(" · ")),
        instructions: dash(spec.instructions),
      });
    }
  }
  return { room: args.area.name, generated_at: new Date().toISOString(), rows };
}

/** Publishing always appends the next revision; existing revisions stay untouched. */
export function usePublishPackage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      area,
      snapshot,
      publishedByName,
      changeNote,
    }: {
      area: Area;
      snapshot: PackageSnapshot;
      publishedByName: string | null;
      changeNote?: string;
    }) => {
      let pkgId: string;
      let nextRev = 1;
      const { data: existing } = await supabase
        .from("installer_package")
        .select("id,current_revision_no")
        .eq("project_id", projectId)
        .eq("area_id", area.id)
        .maybeSingle();

      if (existing) {
        pkgId = existing.id;
        nextRev = (existing.current_revision_no ?? 0) + 1;
      } else {
        const { data, error } = await supabase
          .from("installer_package")
          .insert({
            project_id: projectId,
            area_id: area.id,
            title: `${area.name} installer package`,
          })
          .select("id")
          .single();
        if (error) throw error;
        pkgId = data.id;
      }

      const { error: rErr } = await supabase.from("installer_package_revision").insert({
        package_id: pkgId,
        project_id: projectId,
        revision_no: nextRev,
        snapshot: snapshot as unknown as never,
        published_by_name: publishedByName,
        change_note: changeNote ?? null,
      });
      if (rErr) throw rErr;

      const { error: uErr } = await supabase
        .from("installer_package")
        .update({ current_revision_no: nextRev })
        .eq("id", pkgId);
      if (uErr) throw uErr;
      return nextRev;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installer_packages", projectId] });
      qc.invalidateQueries({ queryKey: ["package_revisions", projectId] });
      qc.invalidateQueries({ queryKey: ["readiness", projectId] });
    },
  });
}

/** A published package is stale when the specification changed after publication. */
export function isPackageOutdated(args: {
  pkg: InstallerPackage;
  revisions: PackageRevision[];
  lastSpecChange: string | null;
}) {
  const latest = args.revisions
    .filter((r) => r.package_id === args.pkg.id)
    .sort((a, b) => b.published_at.localeCompare(a.published_at))[0];
  if (!latest) return true;
  if (!args.lastSpecChange) return false;
  return args.lastSpecChange > latest.published_at;
}
