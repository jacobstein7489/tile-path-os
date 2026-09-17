import type { SurfaceFull } from "@/lib/data";
import type { FinishAssignment, FinishSelection, FinishZone } from "@/lib/finishes";

/**
 * ONE authoritative reader for a treated surface specification.
 *
 * `finish_selection` (product identity) and `finish_assignment` (per-location
 * installation facts) are the source of truth and the only write path.
 * The legacy flat `project_surfaces` columns are preserved for compatibility,
 * but they are only ever consulted as a fallback when the authoritative record
 * has no value — so a stale legacy value can never contradict what the office
 * has specified, and nothing that was recorded before the structured model
 * existed is silently dropped from the installer package.
 *
 * `prep`, `waterproofing` and `underlayment` genuinely belong to the physical
 * surface, so those stay surface-owned.
 */

export type ResolvedSpec = {
  product: string | null;
  manufacturer: string | null;
  sku: string | null;
  nominalSize: string | null;
  actualSize: string | null;
  tileFinish: string | null;
  supplier: string | null;
  suppliedBy: string | null;
  groutManufacturer: string | null;
  groutColor: string | null;
  jointSize: string | null;
  metalProfile: string | null;
  edgeTreatment: string | null;
  layoutPattern: string | null;
  layoutDirection: string | null;
  startPoint: string | null;
  coverage: string | null;
  tileHeight: string | null;
  finishTransition: string | null;
  prep: string | null;
  waterproofing: string | null;
  underlayment: string | null;
  features: string[];
  instructions: string | null;
  /** Fields whose only value came from a legacy flat surface column. */
  legacyFallbacks: string[];
};

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
const txt = (v: unknown) => (blank(v) ? null : String(v).trim());

export function resolveSpec(args: {
  surface: SurfaceFull;
  zone?: FinishZone | null;
  assignment: FinishAssignment | null;
  selection: FinishSelection | null;
}): ResolvedSpec {
  const { surface, assignment, selection } = args;
  const legacyFallbacks: string[] = [];

  /** Authoritative first; legacy flat column only fills a genuine gap. */
  const pick = (label: string, authoritative: unknown, legacy?: unknown) => {
    const a = txt(authoritative);
    if (a) return a;
    const l = txt(legacy);
    if (l) {
      legacyFallbacks.push(label);
      return l;
    }
    return null;
  };

  const surfaceAny = surface as unknown as Record<string, unknown>;
  const features = Array.isArray(surfaceAny["features"])
    ? (surfaceAny["features"] as unknown[]).map((f) => String(f)).filter(Boolean)
    : [];

  return {
    product: pick("Product", selection?.product ?? selection?.label, surface.tile_tag),
    manufacturer: pick("Manufacturer", selection?.manufacturer, surface.manufacturer),
    sku: pick("SKU", selection?.tile_sku, surface.tile_sku),
    nominalSize: pick("Nominal size", selection?.tile_size, surface.tile_size),
    actualSize: pick("Actual tile size", selection?.actual_size),
    tileFinish: pick("Tile finish", selection?.tile_finish, surface.tile_finish),
    supplier: pick("Supplier", selection?.supplier, surface.supplier),
    suppliedBy: pick("Supplied by", selection?.supplied_by),
    groutManufacturer: pick("Grout manufacturer", assignment?.grout_manufacturer, surface.grout_manufacturer),
    groutColor: pick("Grout color", assignment?.grout_color, surface.grout_color),
    jointSize: pick("Joint size", assignment?.joint_size, surface.joint_size),
    metalProfile: pick("Metal / profile", assignment?.metal_profile, surface.metal_profile),
    edgeTreatment: pick("Edge treatment", assignment?.edge_treatment),
    layoutPattern: pick("Pattern", assignment?.layout_pattern, surface.layout_pattern),
    layoutDirection: pick("Direction", assignment?.layout_direction, surface.layout_direction),
    startPoint: pick("Start point", assignment?.start_point, surface.start_point),
    coverage: pick("Feature alignment", assignment?.coverage),
    tileHeight: pick("Finish height", assignment?.tile_height, surface.tile_height),
    finishTransition: pick("Termination / transition", assignment?.finish_transition, surface.finish_transition),
    prep: txt(surface.prep),
    waterproofing: txt(surface.waterproofing),
    underlayment: txt(surface.underlayment),
    features,
    instructions: txt(assignment?.notes) ?? txt(surface.notes),
    legacyFallbacks,
  };
}

/** Measurement summary from the geometry fields already in the schema. */
export function measurementSummary(surface: SurfaceFull): string | null {
  const s = surface as unknown as Record<string, unknown>;
  const uom = txt(s["uom"]) ?? "in";
  const dims = [s["measured_length_in"], s["measured_width_in"], s["measured_height_in"]]
    .map((v) => (blank(v) ? null : String(v)))
    .filter(Boolean);
  const area = surface.field_sf ?? surface.plan_sf;
  const parts: string[] = [];
  if (dims.length) parts.push(`${dims.join(" × ")} ${uom}`);
  if (area) parts.push(`${area} sq ft`);
  return parts.length ? parts.join(" · ") : null;
}
