import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Circle, Package, Pencil, Plus } from "lucide-react";
import {
  Button,
  EmptyState,
  Field,
  Modal,
  SectionCard,
  Select,
  TextArea,
  TextInput,
} from "@/components/kit";
import { CreateWorkItemModal } from "@/components/WorkItemDialogs";
import { RequestMaterialModal } from "@/components/WorkItemDialogs";
import { ProgressBar } from "@/components/ProgressBar";
import { FinishZonesPanel } from "@/components/ops/FinishZones";
import { PlanReference } from "@/components/ops/PlanReference";
import { Chip, areaStatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  useAreasWithSurfaces,
  useInsertRow,
  useMaterialItems,
  useUpdateRow,
  type Area,
  type SurfaceFull,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/projects/$projectId/scope")({
  component: ScopeAndDetails,
});

function ScopeAndDetails() {
  const { projectId } = Route.useParams();
  const { areas, surfaces } = useAreasWithSurfaces(projectId);
  const { data: materials = [] } = useMaterialItems(projectId);
  const insertArea = useInsertRow("project_areas");
  const insertSurface = useInsertRow("project_surfaces");
  const updateSurface = useUpdateRow("project_surfaces");

  const areaList = areas.data ?? [];
  const surfaceList = surfaces.data ?? [];

  const [areaId, setAreaId] = useState<string | null>(null);
  const [surfaceId, setSurfaceId] = useState<string | null>(null);
  const [addArea, setAddArea] = useState(false);
  const [addSurface, setAddSurface] = useState(false);
  const [editSurface, setEditSurface] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  useEffect(() => {
    if (!areaId && areaList.length > 0) setAreaId(areaList[0]!.id);
  }, [areaId, areaList]);

  const areaSurfaces = useMemo(
    () => surfaceList.filter((s) => s.area_id === areaId),
    [surfaceList, areaId],
  );

  useEffect(() => {
    if (areaSurfaces.length > 0 && !areaSurfaces.some((s) => s.id === surfaceId)) {
      setSurfaceId(areaSurfaces[0]!.id);
    }
  }, [areaSurfaces, surfaceId]);

  const surface = areaSurfaces.find((s) => s.id === surfaceId) ?? null;
  const area = areaList.find((a) => a.id === areaId) ?? null;
  const linked = materials.filter((m) => m.surface_id === surface?.id || m.area_id === areaId);

  const overall = areaList.length
    ? Math.round(areaList.reduce((sum, a) => sum + a.progress_pct, 0) / areaList.length)
    : 0;
  const roomsComplete = areaList.filter((a) => a.status === "Complete").length;

  return (
    <>
      <div className="grid grid-cols-[236px_236px_minmax(0,1fr)] items-start gap-4">
        {/* Rooms */}
        <SectionCard
          title="Rooms"
          actions={
            <button
              type="button"
              onClick={() => setAddArea(true)}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline"
            >
              <Plus className="size-3.5" /> Add room
            </button>
          }
        >
          <div className="border-b border-border px-5 pb-4">
            <div className="flex items-center justify-between text-[12px] font-medium text-secondary-foreground">
              <span>Overall progress</span>
              <span className="font-semibold text-foreground">{overall}%</span>
            </div>
            <ProgressBar value={overall} className="mt-2" />
            <div className="mt-2 text-[11.5px] text-muted-foreground">
              {roomsComplete} of {areaList.length} rooms complete
            </div>
          </div>
          <div className="divide-y divide-border">
            {areaList.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAreaId(a.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition-colors",
                  a.id === areaId ? "bg-accent" : "hover:bg-muted/60",
                )}
              >
                <div className="min-w-0">
                  <div
                    className={cn(
                      "truncate text-[13px] font-semibold",
                      a.progress_pct === 0 ? "text-muted-foreground" : "text-foreground",
                      a.id === areaId && "text-primary",
                    )}
                  >
                    {a.name}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {
                      surfaceList.filter((s) => s.area_id === a.id && s.status === "Complete")
                        .length
                    }{" "}
                    of {surfaceList.filter((s) => s.area_id === a.id).length} surfaces
                  </div>
                </div>
                <span className="text-[12px] font-semibold text-secondary-foreground">
                  {a.progress_pct}%
                </span>
              </button>
            ))}
            {areaList.length === 0 ? (
              <EmptyState
                title="No rooms yet"
                note="Rooms are built during estimating and carry forward."
              />
            ) : null}
          </div>
        </SectionCard>

        {/* Surfaces */}
        <SectionCard
          title={area?.name ?? "Surfaces"}
          actions={
            <button
              type="button"
              onClick={() => setAddSurface(true)}
              disabled={!areaId}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline disabled:text-muted-foreground"
              title={areaId ? undefined : "Select a room first"}
            >
              <Plus className="size-3.5" /> Add surface
            </button>
          }
        >
          <div className="border-b border-border px-5 pb-4">
            <div className="text-[12px] text-secondary-foreground">
              {areaSurfaces.filter((s) => s.status === "Complete").length} of {areaSurfaces.length}{" "}
              surfaces complete
            </div>
            <ProgressBar value={area?.progress_pct ?? 0} className="mt-2" />
          </div>
          {area ? <PlanReference projectId={projectId} area={area} canEdit /> : null}
          <div className="divide-y divide-border">
            {areaSurfaces.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSurfaceId(s.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition-colors",
                  s.id === surfaceId ? "bg-accent" : "hover:bg-muted/60",
                )}
              >
                <div className="min-w-0">
                  <div
                    className={cn(
                      "truncate text-[13px] font-semibold",
                      s.id === surfaceId ? "text-primary" : "text-foreground",
                    )}
                  >
                    {s.name}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">{s.status}</div>
                </div>
                {s.status === "Complete" ? (
                  <CheckCircle2 className="size-[18px] shrink-0 text-success" />
                ) : s.status === "Working" ? (
                  <span className="size-[15px] shrink-0 rounded-full bg-warning" />
                ) : s.status === "Blocked" ? (
                  <AlertTriangle className="size-[17px] shrink-0 text-danger" />
                ) : (
                  <Circle className="size-[17px] shrink-0 text-border-strong" />
                )}
              </button>
            ))}
            {areaSurfaces.length === 0 ? <EmptyState title="No surfaces in this room" /> : null}
          </div>
        </SectionCard>

        {/* Surface workspace */}
        <SectionCard
          title={surface?.name ?? "Surface"}
          badge={
            surface ? <Chip tone={areaStatusTone(surface.status)}>{surface.status}</Chip> : null
          }
          actions={
            <>
              <Button size="sm" onClick={() => setIssueOpen(true)} disabled={!surface}>
                <AlertTriangle className="size-4" /> Add issue
              </Button>
              <Button size="sm" onClick={() => setOrderOpen(true)} disabled={!surface}>
                <Package className="size-4" /> Order item
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!surface}
                onClick={() =>
                  surface &&
                  updateSurface.mutate({
                    id: surface.id,
                    patch: { detail_confirmed: !surface.detail_confirmed },
                  })
                }
              >
                <CheckCircle2 className="size-4" />
                {surface?.detail_confirmed ? "Detail confirmed" : "Confirm detail"}
              </Button>
            </>
          }
        >
          {!surface ? (
            <EmptyState
              title="Select a surface"
              note="Tile, grout, metal and layout live on the surface."
            />
          ) : (
            <div className="space-y-4 px-5 pt-1 pb-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold">Surface details</h3>
                <Button size="sm" onClick={() => setEditSurface(true)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <DetailCard
                  label="Tile"
                  lines={[
                    `${surface.tile_tag ?? "—"} ${surface.tile_size ?? ""}`.trim(),
                    surface.manufacturer ?? "",
                    surface.tile_sku ? `SKU: ${surface.tile_sku}` : "",
                    surface.tile_finish ?? "",
                  ]}
                />
                <DetailCard
                  label="Grout"
                  lines={[
                    surface.grout_manufacturer ?? "",
                    surface.grout_color ?? "—",
                    surface.joint_size ? `Joint: ${surface.joint_size}` : "",
                  ]}
                />
                <DetailCard label="Metal / Trim" lines={[surface.metal_profile ?? "—"]} />
                <DetailCard
                  label="Layout Direction"
                  lines={[
                    surface.layout_pattern ?? "—",
                    surface.layout_direction ?? "",
                    surface.start_point ? `Start: ${surface.start_point}` : "",
                  ]}
                />
                <DetailCard
                  label="Finish / Height"
                  lines={[surface.tile_height ?? "—", surface.finish_transition ?? ""]}
                />
                <DetailCard
                  label="Prep / Waterproofing"
                  lines={[
                    surface.prep ?? "—",
                    surface.waterproofing ?? "",
                    surface.underlayment ?? "",
                  ]}
                />
              </div>
              <FinishZonesPanel projectId={projectId} surface={surface} canEdit />

              <DetailCard label="Notes" lines={[surface.notes ?? "No notes yet."]} />

              <div>
                <h3 className="mb-2 text-[13px] font-semibold">Linked items</h3>
                <div className="flex flex-wrap gap-2">
                  {linked.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-[12px]"
                    >
                      <span className="font-semibold">{m.name}</span>
                      <Chip
                        tone={m.status === "Ready" || m.status === "Received" ? "green" : "amber"}
                      >
                        {m.status}
                      </Chip>
                    </span>
                  ))}
                  {linked.length === 0 ? (
                    <span className="text-[12.5px] text-muted-foreground">
                      No material items linked to this area yet.
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Add room */}
      <NameModal
        open={addArea}
        title="Add room / area"
        placeholder="Master Bathroom"
        onClose={() => setAddArea(false)}
        onSave={async (name) => {
          const row = (await insertArea.mutateAsync({
            project_id: projectId,
            name,
            sort_order: areaList.length + 1,
          })) as { id: string };
          setAreaId(row.id);
          setAddArea(false);
        }}
      />
      {/* Add surface */}
      <NameModal
        open={addSurface}
        title="Add surface / feature"
        placeholder="Shower Wall A"
        onClose={() => setAddSurface(false)}
        onSave={async (name) => {
          if (!areaId) return;
          const row = (await insertSurface.mutateAsync({
            area_id: areaId,
            name,
            sort_order: areaSurfaces.length + 1,
          })) as { id: string };
          setSurfaceId(row.id);
          setAddSurface(false);
        }}
      />

      {surface && editSurface ? (
        <EditSurfaceModal
          surface={surface}
          onClose={() => setEditSurface(false)}
          onSave={async (patch) => {
            await updateSurface.mutateAsync({ id: surface.id, patch });
            setEditSurface(false);
          }}
        />
      ) : null}

      <CreateWorkItemModal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        kind="Issue"
        projectId={projectId}
        areaId={areaId}
        surfaceId={surfaceId}
      />
      <RequestMaterialModal
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        projectId={projectId}
      />
    </>
  );
}

function DetailCard({ label, lines }: { label: string; lines: string[] }) {
  const shown = lines.filter(Boolean);
  return (
    <div className="rounded-xl border border-border bg-muted/25 px-4 py-3">
      <div className="text-[11.5px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 space-y-0.5">
        {(shown.length ? shown : ["—"]).map((l, i) => (
          <div
            key={i}
            className={cn(
              "text-[12.5px]",
              i === 0 ? "font-semibold text-foreground" : "text-secondary-foreground",
            )}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function NameModal({
  open,
  title,
  placeholder,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  placeholder: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  if (!open) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim()}
            {...(!name.trim() ? { disabledReason: "Enter a name" } : {})}
          >
            Save
          </Button>
        </>
      }
    >
      <Field label="Name">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
        />
      </Field>
    </Modal>
  );
}

const SURFACE_FIELDS: { key: keyof SurfaceFull; label: string }[] = [
  { key: "status", label: "Status" },
  { key: "progress_pct", label: "Progress %" },
  { key: "plan_sf", label: "Plan SF" },
  { key: "field_sf", label: "Field SF" },
  { key: "tile_tag", label: "Tile tag" },
  { key: "tile_size", label: "Tile size" },
  { key: "tile_sku", label: "Tile SKU" },
  { key: "tile_finish", label: "Tile finish" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "supplier", label: "Supplier" },
  { key: "grout_manufacturer", label: "Grout manufacturer" },
  { key: "grout_color", label: "Grout / colour" },
  { key: "joint_size", label: "Joint size" },
  { key: "metal_profile", label: "Metal / profile" },
  { key: "layout_pattern", label: "Layout pattern" },
  { key: "layout_direction", label: "Direction" },
  { key: "start_point", label: "Start point" },
  { key: "tile_height", label: "Tile height" },
  { key: "finish_transition", label: "Finish / transition" },
  { key: "prep", label: "Prep" },
  { key: "waterproofing", label: "Waterproofing" },
  { key: "underlayment", label: "Underlayment" },
];

function EditSurfaceModal({
  surface,
  onClose,
  onSave,
}: {
  surface: SurfaceFull;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of SURFACE_FIELDS) {
      const v = surface[f.key];
      init[f.key as string] = v === null || v === undefined ? "" : String(v);
    }
    init["notes"] = surface.notes ?? "";
    return init;
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${surface.name}`}
      subtitle="Tile, grout, metal, layout and prep belong to this exact surface."
      width="max-w-3xl"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              const patch: Record<string, unknown> = { notes: values["notes"] || null };
              for (const f of SURFACE_FIELDS) {
                const raw = values[f.key as string] ?? "";
                if (f.key === "progress_pct") patch[f.key] = Number(raw || 0);
                else if (f.key === "plan_sf" || f.key === "field_sf")
                  patch[f.key] = raw === "" ? null : Number(raw);
                else patch[f.key as string] = raw === "" ? null : raw;
              }
              onSave(patch);
            }}
          >
            Save surface
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3.5">
        {SURFACE_FIELDS.map((f) => (
          <Field key={f.key as string} label={f.label}>
            {f.key === "status" ? (
              <Select
                value={values["status"] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
              >
                {["Not Ready", "Ready", "Working", "Blocked", "Complete"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            ) : (
              <TextInput
                value={values[f.key as string] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key as string]: e.target.value }))}
              />
            )}
          </Field>
        ))}
      </div>
      <Field label="Notes">
        <TextArea
          value={values["notes"] ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
        />
      </Field>
    </Modal>
  );
}
