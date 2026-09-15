import { useEffect, useState } from "react";
import { Layers, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, Drawer, Field, Select, TextInput } from "@/components/kit";
import { Chip } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { SurfaceFull } from "@/lib/data";
import {
  selectionSummary,
  useAddZone,
  useCreateSelection,
  useEnsureZones,
  useFinishAssignments,
  useFinishSelections,
  useFinishZones,
  useSaveAssignment,
  useSaveSelection,
  type FinishAssignment,
  type FinishSelection,
} from "@/lib/finishes";

/**
 * Finish zones for one surface.
 *
 * Every surface has one implicit "Main" zone, so simple jobs never see zone
 * management. The tile product is a reusable project-level selection; grout,
 * joint, edge and layout are per-zone installation choices.
 */

const ASSIGNMENT_FIELDS: { key: keyof FinishAssignment; label: string }[] = [
  { key: "grout_manufacturer", label: "Grout manufacturer" },
  { key: "grout_color", label: "Grout color" },
  { key: "joint_size", label: "Joint size" },
  { key: "edge_treatment", label: "Edge treatment" },
  { key: "metal_profile", label: "Metal / profile" },
  { key: "layout_pattern", label: "Pattern" },
  { key: "layout_direction", label: "Direction" },
  { key: "start_point", label: "Start point" },
  { key: "tile_height", label: "Height / termination" },
  { key: "finish_transition", label: "Transition" },
  { key: "coverage", label: "Coverage" },
];

const SELECTION_FIELDS: { key: keyof FinishSelection; label: string }[] = [
  { key: "label", label: "Label / tag" },
  { key: "product", label: "Product" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "tile_sku", label: "SKU" },
  { key: "tile_size", label: "Nominal size" },
  { key: "actual_size", label: "Actual size" },
  { key: "tile_finish", label: "Finish" },
  { key: "supplier", label: "Supplier" },
  { key: "supplied_by", label: "Supplied by" },
];

export function FinishZonesPanel({
  projectId,
  surface,
  canEdit,
}: {
  projectId: string;
  surface: SurfaceFull;
  canEdit: boolean;
}) {
  const zones = useFinishZones(projectId);
  const assignments = useFinishAssignments(projectId);
  const selections = useFinishSelections(projectId);
  const ensure = useEnsureZones(projectId);
  const addZone = useAddZone(projectId);
  const saveAssignment = useSaveAssignment(projectId);
  const [editZone, setEditZone] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [zoneName, setZoneName] = useState("");

  const zoneList = (zones.data ?? []).filter((z) => z.surface_id === surface.id);
  const assignmentList = assignments.data ?? [];
  const selectionList = selections.data ?? [];

  // Guarantee the invisible default zone exists for this surface.
  useEffect(() => {
    if (zones.isLoading || !canEdit) return;
    if (zoneList.length === 0) ensure.mutate([surface.id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones.isLoading, surface.id, zoneList.length]);

  const openZone = zoneList.find((z) => z.id === editZone) ?? null;
  const openAssignment = openZone
    ? (assignmentList.find((a) => a.zone_id === openZone.id) ?? null)
    : null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
          <Layers className="size-4 text-primary" />
          Finish zones
          {zoneList.length > 1 ? <Chip tone="blue">{zoneList.length}</Chip> : null}
        </h3>
        <Button size="sm" disabled={!canEdit} onClick={() => setAdding(true)}>
          <Plus className="size-3.5" /> Add finish zone
        </Button>
      </div>

      <div className="space-y-2">
        {zoneList.map((z) => {
          const a = assignmentList.find((x) => x.zone_id === z.id) ?? null;
          const sel = a?.finish_selection_id
            ? (selectionList.find((s) => s.id === a.finish_selection_id) ?? null)
            : null;
          return (
            <button
              key={z.id}
              type="button"
              onClick={() => setEditZone(z.id)}
              className="block w-full rounded-xl border border-border bg-muted/25 px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-semibold">
                  {z.is_default ? "Main treatment" : z.name}
                </span>
                <Chip tone={sel ? "green" : "amber"}>{sel ? "Tile mapped" : "No tile yet"}</Chip>
              </div>
              <div className={cn("mt-1 text-[12.5px]", sel ? "text-foreground" : "text-muted-foreground")}>
                {selectionSummary(sel)}
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                {[a?.grout_color, a?.joint_size, a?.layout_direction, a?.start_point]
                  .filter(Boolean)
                  .join(" · ") || "Grout, joint and layout not recorded"}
              </div>
            </button>
          );
        })}
        {zoneList.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">Preparing the default zone…</p>
        ) : null}
      </div>

      {adding ? (
        <Drawer
          open
          onClose={() => setAdding(false)}
          title="Add a finish zone"
          subtitle={`${surface.name} — only for surfaces with more than one treatment`}
        >
          <div className="space-y-4">
            <Field label="Zone name">
              <TextInput
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Accent band, Niche back, Border…"
              />
            </Field>
            <Button
              variant="primary"
              disabled={!zoneName.trim()}
              onClick={() =>
                addZone
                  .mutateAsync({
                    surfaceId: surface.id,
                    name: zoneName.trim(),
                    sortOrder: zoneList.length,
                  })
                  .then((id) => {
                    setZoneName("");
                    setAdding(false);
                    setEditZone(id);
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : "Could not add zone"))
              }
            >
              Add zone
            </Button>
          </div>
        </Drawer>
      ) : null}

      {openZone && openAssignment ? (
        <ZoneDrawer
          projectId={projectId}
          title={`${surface.name} — ${openZone.is_default ? "Main treatment" : openZone.name}`}
          assignment={openAssignment}
          selections={selectionList}
          canEdit={canEdit}
          onClose={() => setEditZone(null)}
          onSaveAssignment={(patch) =>
            saveAssignment.mutate({ id: openAssignment.id, patch })
          }
        />
      ) : null}
    </div>
  );
}

function ZoneDrawer({
  projectId,
  title,
  assignment,
  selections,
  canEdit,
  onClose,
  onSaveAssignment,
}: {
  projectId: string;
  title: string;
  assignment: FinishAssignment;
  selections: FinishSelection[];
  canEdit: boolean;
  onClose: () => void;
  onSaveAssignment: (patch: Partial<FinishAssignment>) => void;
}) {
  const createSelection = useCreateSelection(projectId);
  const saveSelection = useSaveSelection(projectId);
  const [newLabel, setNewLabel] = useState("");
  const selection = selections.find((s) => s.id === assignment.finish_selection_id) ?? null;

  return (
    <Drawer open onClose={onClose} title={title} subtitle="Tile product is reused; the choices below are for this zone only">
      <div className="space-y-5">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Tile product (reusable across surfaces)
          </div>
          <div className="mt-2 space-y-2">
            <Select
              value={assignment.finish_selection_id ?? ""}
              disabled={!canEdit}
              onChange={(e) =>
                onSaveAssignment({ finish_selection_id: e.target.value || null })
              }
            >
              <option value="">Not selected</option>
              {selections.map((s) => (
                <option key={s.id} value={s.id}>
                  {[s.label, s.tile_size, s.manufacturer].filter(Boolean).join(" · ")}
                </option>
              ))}
            </Select>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Or add a new tile to this job">
                  <TextInput
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="T-17 Calacatta 12x24"
                  />
                </Field>
              </div>
              <Button
                disabled={!canEdit || !newLabel.trim()}
                onClick={() =>
                  createSelection
                    .mutateAsync({ label: newLabel.trim() })
                    .then((id) => {
                      setNewLabel("");
                      onSaveAssignment({ finish_selection_id: id });
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : "Could not add"))
                }
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        {selection ? (
          <div>
            <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Product specification — shared wherever this tile is used
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {SELECTION_FIELDS.map((f) => (
                <Field key={String(f.key)} label={f.label}>
                  <TextInput
                    defaultValue={(selection[f.key] as string | null) ?? ""}
                    disabled={!canEdit}
                    onBlur={(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                      const value = e.target.value.trim();
                      if (value === ((selection[f.key] as string | null) ?? "")) return;
                      saveSelection.mutate({
                        id: selection.id,
                        patch: { [f.key]: value || null } as Partial<FinishSelection>,
                      });
                    }}
                  />
                </Field>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            This zone only
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {ASSIGNMENT_FIELDS.map((f) => (
              <Field key={String(f.key)} label={f.label}>
                <TextInput
                  defaultValue={(assignment[f.key] as string | null) ?? ""}
                  disabled={!canEdit}
                  onBlur={(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                    const value = e.target.value.trim();
                    if (value === ((assignment[f.key] as string | null) ?? "")) return;
                    onSaveAssignment({ [f.key]: value || null } as Partial<FinishAssignment>);
                  }}
                />
              </Field>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
