import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, FileText, MoreHorizontal, Pencil, Plus, SwatchBook } from "lucide-react";
import { toast } from "sonner";
import { Button, Drawer, EmptyState, Field, Select, TextArea, TextInput } from "@/components/kit";
import { CreateWorkItemModal, RequestMaterialModal } from "@/components/WorkItemDialogs";
import { Popover, PopoverItem } from "@/components/ops/Popover";
import { useCanEditProject } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAreasWithSurfaces, useInsertRow, useUpdateRow, type Area, type SurfaceFull } from "@/lib/data";
import { useAddZone, useApplyFinishToSurfaces, useEnsureZones, useSaveAssignment, useSaveSelection, type FinishAssignment, type FinishSelection } from "@/lib/finishes";
import { useProjectSetup } from "@/lib/setup";
import { measurementSummary, resolveSpec } from "@/lib/spec";

export const Route = createFileRoute("/_authenticated/projects/$projectId/scope")({
  head: () => ({ meta: [
    { title: "Rooms & Surfaces — Cobblestone Tile OS" },
    { name: "description", content: "Define project rooms, surfaces, finishes, layouts and installation details." },
    { property: "og:title", content: "Rooms & Surfaces — Cobblestone Tile OS" },
    { property: "og:description", content: "Define rooms, surfaces and installation specifications." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ]}), component: ScopeAndDetails,
});

type WorkspaceTab = "Specification" | "Layout" | "Measurements" | "Prep" | "Photos & Notes";
const TABS: WorkspaceTab[] = ["Specification", "Layout", "Measurements", "Prep", "Photos & Notes"];

/**
 * The heart of the product: one continuous working plane. Room and surface
 * navigation are quiet context rails; the selected surface owns the width.
 * All data still reads through the authoritative finish model.
 */
function ScopeAndDetails() {
  const { projectId } = Route.useParams();
  const { areas, surfaces } = useAreasWithSurfaces(projectId);
  const setup = useProjectSetup(projectId);
  const insertArea = useInsertRow("project_areas");
  const insertSurface = useInsertRow("project_surfaces");
  const updateSurface = useUpdateRow("project_surfaces");
  const ensureZones = useEnsureZones(projectId);
  const addZone = useAddZone(projectId);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [surfaceId, setSurfaceId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("Specification");
  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<WorkspaceTab>("Specification");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addArea, setAddArea] = useState(false);
  const [addSurface, setAddSurface] = useState(false);
  const [addFinish, setAddFinish] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [multiFinishOpen, setMultiFinishOpen] = useState(false);
  /** "mobile" drills down, "medium" uses one navigator rail, "wide" shows both rails. */
  const [layout, setLayout] = useState<"mobile" | "medium" | "wide">("mobile");
  const areaList = areas.data ?? [];
  const surfaceList = surfaceListOf(surfaces.data);
  const areaSurfaces = useMemo(() => surfaceList.filter((s) => s.area_id === areaId), [surfaceList, areaId]);
  const area = areaList.find((a) => a.id === areaId) ?? null;
  const surface = surfaceList.find((s) => s.id === surfaceId) ?? null;
  const zones = setup.zoneList.filter((z) => z.surface_id === surfaceId);
  const selectedZone = zones.find((z) => z.id === zoneId) ?? zones.find((z) => z.is_default) ?? zones[0] ?? null;
  const assignment = setup.assignmentList.find((a) => a.zone_id === selectedZone?.id) ?? null;
  const selection = assignment?.finish_selection_id ? setup.selectionList.find((s) => s.id === assignment.finish_selection_id) ?? null : null;

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1400px)");
    const medium = window.matchMedia("(min-width: 1024px)");
    const sync = () => setLayout(wide.matches ? "wide" : medium.matches ? "medium" : "mobile");
    sync();
    wide.addEventListener("change", sync);
    medium.addEventListener("change", sync);
    return () => { wide.removeEventListener("change", sync); medium.removeEventListener("change", sync); };
  }, []);
  useEffect(() => { if (layout !== "mobile" && !areaId && areaList[0]) setAreaId(areaList[0].id); }, [layout, areaId, areaList]);
  useEffect(() => { if (layout !== "mobile" && areaId && !areaSurfaces.some((s) => s.id === surfaceId)) setSurfaceId(areaSurfaces[0]?.id ?? null); }, [layout, areaId, areaSurfaces, surfaceId]);
  useEffect(() => { if (surfaceList.length) ensureZones.mutate(surfaceList.map((s) => s.id)); }, [surfaceList.map((s) => s.id).join(",")]);
  useEffect(() => { setZoneId(zones.find((z) => z.is_default)?.id ?? zones[0]?.id ?? null); }, [surfaceId, zones.map((z) => z.id).join(",")]);
  useEffect(() => { setTab("Specification"); }, [surfaceId]);

  const roomNote = (id: string) => {
    const ids = new Set(surfaceList.filter((s) => s.area_id === id).map((s) => s.id));
    const affected = new Set(setup.requirements.filter((r) => r.state === "blocked" && r.surface_id && ids.has(r.surface_id)).map((r) => r.surface_id));
    if (affected.size) return { text: `${affected.size} need setup`, ok: false };
    if (!ids.size) return { text: "No surfaces", ok: true };
    return { text: "Ready", ok: true };
  };
  const surfaceNote = (id: string) => {
    const ctx = setup.contexts.find((c) => c.surface.id === id && c.zone.is_default);
    const blockers = setup.requirements.filter((r) => r.surface_id === id && r.state === "blocked");
    if (!ctx?.selection) return { text: "Not started", ok: false, quiet: true };
    if (blockers.length) return { text: `${blockers.length} ${blockers.length === 1 ? "decision" : "items"} pending`, ok: false };
    return { text: "Ready", ok: true };
  };
  const surfaceBlockers = surface ? setup.requirements.filter((r) => r.surface_id === surface.id && r.state === "blocked") : [];
  const openEditor = (nextTab: WorkspaceTab, key?: string) => { setEditTab(nextTab); setFocusKey(key ?? null); setEditOpen(true); };

  /** Which zone of the plane is visible right now. */
  const showRooms = layout === "wide" || (layout === "medium" && !areaId) || (layout === "mobile" && !areaId);
  const showSurfaces = layout === "wide" || (layout === "medium" && Boolean(areaId)) || (layout === "mobile" && Boolean(areaId) && !surfaceId);
  const showWorkspace = layout === "wide" || (layout === "medium" ? true : Boolean(surfaceId));

  return <>
    <div className="flex min-h-[calc(100vh-8.5rem)] w-full bg-card">
      {showRooms ? (
        <aside className={cn("min-w-0 shrink-0 border-border", layout === "wide" ? "w-[200px] border-r" : layout === "medium" ? "w-[248px] border-r" : "w-full")}>
          <RailHead label="Rooms" actions={<><RailAction label="Plan" onClick={() => setPlanOpen(true)}><FileText className="size-3.5" /></RailAction><RailAction label="Add room" onClick={() => setAddArea(true)}><Plus className="size-4" /></RailAction></>} />
          <ul>
            {areaList.map((item) => { const note = roomNote(item.id); return (
              <li key={item.id}>
                <button type="button" onClick={() => { setAreaId(item.id); setSurfaceId(null); }} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/60", item.id === areaId && "bg-primary-soft hover:bg-primary-soft")}>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">{item.name}</span>
                    <span className={cn("mt-0.5 block text-[11px]", note.ok ? "text-muted-foreground" : "text-warning")}>{note.text}</span>
                  </span>
                  {layout === "mobile" ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
                </button>
              </li>
            ); })}
          </ul>
          {!areaList.length ? <p className="px-4 py-5 text-[12.5px] text-muted-foreground">No rooms yet. Add the first room to begin setup.</p> : null}
        </aside>
      ) : null}

      {showSurfaces ? (
        <aside className={cn("min-w-0 shrink-0 border-border", layout === "wide" ? "w-[235px] border-r" : layout === "medium" ? "w-[248px] border-r" : "w-full")}>
          <RailHead
            label={layout === "wide" ? "Surfaces" : (area?.name ?? "Surfaces")}
            back={layout !== "wide" ? <button type="button" onClick={() => { setAreaId(null); setSurfaceId(null); }} className="grid size-8 place-items-center text-primary" aria-label="Back to rooms"><ArrowLeft className="size-4" /></button> : undefined}
            actions={<><RailAction label="Apply finish to surfaces" onClick={() => setMultiFinishOpen(true)}><SwatchBook className="size-4" /></RailAction><RailAction label="Add surface" onClick={() => setAddSurface(true)}><Plus className="size-4" /></RailAction></>}
          />
          <ul>
            {areaSurfaces.map((item) => { const note = surfaceNote(item.id); return (
              <li key={item.id}>
                <button type="button" onClick={() => setSurfaceId(item.id)} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/60", item.id === surfaceId && "bg-primary-soft hover:bg-primary-soft")}>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">{item.name}</span>
                    <span className={cn("mt-0.5 block truncate text-[11px]", note.ok ? "text-success" : note.quiet ? "text-muted-foreground" : "text-warning")}>{note.text}</span>
                  </span>
                  {layout === "mobile" ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
                </button>
              </li>
            ); })}
          </ul>
          {area && !areaSurfaces.length ? <p className="px-4 py-5 text-[12.5px] text-muted-foreground">No surfaces in this room yet.</p> : null}
        </aside>
      ) : null}

      {showWorkspace ? (
        <section className="min-w-0 flex-1">
          {!surface ? (
            <p className="px-6 py-10 text-[13px] text-muted-foreground">Select a surface to see its specification and installation decisions.</p>
          ) : <>
            <header className="border-b border-border px-5 pt-6 pb-5 md:px-9 md:pt-8">
              {layout === "mobile" ? <button type="button" onClick={() => setSurfaceId(null)} className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"><ArrowLeft className="size-4" /> {area?.name}</button> : null}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.09em] text-secondary-foreground uppercase">{area?.name ?? "Surface"}</p>
                  <h2 className="mt-1 truncate text-[25px] leading-tight font-bold tracking-[-0.02em] md:text-[31px]">{surface.name}</h2>
                  <p className="mt-1.5 text-[12.5px] text-secondary-foreground">
                    {[(surface as unknown as { surface_kind?: string | null }).surface_kind, selection ? formatFinish(selection) : "Finish specification not mapped"].filter(Boolean).join("  ·  ")}
                  </p>
                  <p className={cn("mt-2.5 text-[12.5px] font-semibold", surfaceBlockers.length ? "text-warning" : "text-success")}>
                    {surfaceBlockers.length
                      ? `Not ready — ${surfaceBlockers.length} open setup item${surfaceBlockers.length === 1 ? "" : "s"}`
                      : "Ready for installation planning"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" variant="primary" onClick={() => openEditor(tab)}><Pencil className="size-3.5" /> Edit</Button>
                  <div className="relative">
                    <RailAction label="Surface actions" onClick={() => setMoreOpen((v) => !v)}><MoreHorizontal className="size-4" /></RailAction>
                    <Popover open={moreOpen} onClose={() => setMoreOpen(false)} align="right" width="md:w-56" title="Surface actions">
                      <PopoverItem onClick={() => { setMoreOpen(false); setIssueOpen(true); }}>Add issue</PopoverItem>
                      <PopoverItem onClick={() => { setMoreOpen(false); setMaterialOpen(true); }}>Request material</PopoverItem>
                      <PopoverItem onClick={() => { setMoreOpen(false); setAddFinish(true); }}>Add finish area</PopoverItem>
                      <PopoverItem tone="muted" onClick={() => { setMoreOpen(false); updateSurface.mutate({ id: surface.id, patch: { archived_at: new Date().toISOString() } }); }}>Archive surface</PopoverItem>
                    </Popover>
                  </div>
                </div>
              </div>
              {zones.length > 1 ? (
                <div className="mt-4 flex gap-4 overflow-x-auto">
                  {zones.map((zone) => <button key={zone.id} type="button" onClick={() => setZoneId(zone.id)} className={cn("shrink-0 text-[12px] font-semibold", zone.id === selectedZone?.id ? "text-primary underline underline-offset-4" : "text-muted-foreground hover:text-foreground")}>{zone.is_default ? "Main field" : zone.name}</button>)}
                </div>
              ) : null}
            </header>

            <nav className="flex gap-5 overflow-x-auto border-b border-border px-5 md:px-9">
              {TABS.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn("shrink-0 border-b-2 py-3 text-[12.5px] font-semibold transition-colors", tab === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{item}</button>)}
            </nav>

            <div className="px-5 py-7 md:px-9 md:py-8">
              <SurfaceSection tab={tab} surface={surface} assignment={assignment} selection={selection} onAdd={openEditor} />
            </div>

            <div className="border-t border-border px-5 py-4 md:px-9">
              <p className={cn("text-[10px] font-bold tracking-[0.09em] uppercase", surfaceBlockers.length ? "text-warning" : "text-success")}>
                {surfaceBlockers.length ? "Not ready" : "Ready"}
              </p>
              <p className="mt-1 text-[12.5px] text-secondary-foreground">
                {surfaceBlockers.length
                  ? surfaceBlockers.map((r) => r.label).slice(0, 3).join("  ·  ")
                  : "Specification, layout and prep information is complete for this surface."}
              </p>
            </div>
          </>}
        </section>
      ) : null}
    </div>

    <NameDrawer open={addArea} title="Add room" placeholder="Master Bathroom" onClose={() => setAddArea(false)} onSave={async (name) => { const row = await insertArea.mutateAsync({ project_id: projectId, name, sort_order: areaList.length + 1 }) as { id: string }; setAreaId(row.id); setSurfaceId(null); setAddArea(false); }} />
    <NameDrawer open={addSurface} title="Add surface" placeholder="Shower Wall A" onClose={() => setAddSurface(false)} onSave={async (name) => { if (!areaId) return; const row = await insertSurface.mutateAsync({ area_id: areaId, name, sort_order: areaSurfaces.length + 1 }) as { id: string }; setSurfaceId(row.id); setAddSurface(false); }} />
    {planOpen ? <ProjectPlanDrawer projectId={projectId} areas={areaList} files={setup.fileList} initialAreaId={areaId} onCreateRoom={async (name) => insertArea.mutateAsync({ project_id: projectId, name, sort_order: areaList.length + 1 }) as Promise<Area>} onClose={() => setPlanOpen(false)} /> : null}
    {surface && assignment && editOpen ? <SurfaceEditDrawer projectId={projectId} surface={surface} assignment={assignment} selection={selection} selections={setup.selectionList} initialTab={editTab} focusKey={focusKey} onClose={() => setEditOpen(false)} /> : null}
    {area && multiFinishOpen ? <MultiFinishDrawer projectId={projectId} roomName={area.name} surfaces={areaSurfaces} zones={setup.zoneList} selections={setup.selectionList} onClose={() => setMultiFinishOpen(false)} /> : null}
    {surface && addFinish ? <NameDrawer open title="Add finish area" placeholder="Accent band" onClose={() => setAddFinish(false)} onSave={async (name) => { const id = await addZone.mutateAsync({ surfaceId: surface.id, name, sortOrder: zones.length }); setZoneId(id); setAddFinish(false); }} /> : null}
    <CreateWorkItemModal open={issueOpen} onClose={() => setIssueOpen(false)} kind="Issue" projectId={projectId} areaId={areaId} surfaceId={surfaceId} />
    <RequestMaterialModal open={materialOpen} onClose={() => setMaterialOpen(false)} projectId={projectId} />
  </>;
}

function surfaceListOf(rows: SurfaceFull[] | undefined) {
  return rows ?? [];
}

/** Quiet uppercase rail heading — a line of type, not a toolbar. */
function RailHead({ label, actions, back }: { label: string; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="flex min-h-12 items-center gap-1.5 border-b border-border px-2.5">
      {back}
      <h2 className="min-w-0 flex-1 truncate px-1.5 text-[10px] font-bold tracking-[0.09em] text-secondary-foreground uppercase">{label}</h2>
      <div className="flex items-center gap-0.5">{actions}</div>
    </header>
  );
}

function RailAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{children}</button>;
}

function SurfaceSection({ tab, surface, assignment, selection, onAdd }: { tab: WorkspaceTab; surface: SurfaceFull; assignment: FinishAssignment | null; selection: FinishSelection | null; onAdd: (tab: WorkspaceTab, key?: string) => void }) {
  /** Everything shown here reads through the authoritative finish model. */
  const spec = resolveSpec({ surface, assignment, selection });
  const measured = measurementSummary(surface);
  const groups: Record<WorkspaceTab, { label: string; value: ReactNode; missing?: boolean }[]> = {
    Specification: [
      { label: "Tile / product", value: selection ? <><b className="block">{selection.label}</b>{[spec.manufacturer, spec.nominalSize].filter(Boolean).length ? <span className="block text-[12px] text-muted-foreground">{[spec.manufacturer, spec.nominalSize].filter(Boolean).join(" · ")}</span> : null}{spec.sku ? <span className="block text-[12px] text-muted-foreground">SKU {spec.sku}</span> : null}</> : "Missing", missing: !selection },
      { label: "Supplier", value: spec.supplier || "Missing", missing: !spec.supplier },
      { label: "Actual / nominal size", value: [spec.actualSize, spec.nominalSize].filter(Boolean).join(" · ") || "Missing", missing: !spec.actualSize && !spec.nominalSize },
      { label: "Grout / joint", value: spec.groutColor ? <><b className="block">{spec.groutColor}</b>{[spec.groutManufacturer, spec.jointSize].filter(Boolean).length ? <span className="block text-[12px] text-muted-foreground">{[spec.groutManufacturer, spec.jointSize].filter(Boolean).join(" · ")}</span> : null}</> : "Missing", missing: !spec.groutColor },
      { label: "Metal / edge", value: [spec.edgeTreatment, spec.metalProfile].filter(Boolean).join(" · ") || "Decision needed", missing: !spec.edgeTreatment && !spec.metalProfile },
      { label: "Finish height / termination", value: [spec.tileHeight, spec.finishTransition].filter(Boolean).join(" · ") || "Decision needed", missing: !spec.tileHeight && !spec.finishTransition },
      { label: "Special instructions", value: assignment?.notes || selection?.notes || "None recorded" },
    ],
    Layout: [
      { label: "Pattern", value: spec.layoutPattern || "Decision needed", missing: !spec.layoutPattern },
      { label: "Direction", value: spec.layoutDirection || "Decision needed", missing: !spec.layoutDirection },
      { label: "Start point", value: spec.startPoint || "Decision needed", missing: !spec.startPoint },
      { label: "Feature alignment", value: spec.coverage || "Decision needed", missing: !spec.coverage },
      { label: "Termination", value: spec.finishTransition || spec.tileHeight || "Decision needed", missing: !spec.finishTransition && !spec.tileHeight },
    ],
    Measurements: [
      { label: "Measured size", value: measured ?? "Not recorded", missing: !measured },
      { label: "Plan area", value: surface.plan_sf ? `${surface.plan_sf} sq ft` : "Not recorded", missing: !surface.plan_sf },
      { label: "Field area", value: surface.field_sf ? `${surface.field_sf} sq ft` : "Not recorded", missing: !surface.field_sf },
      { label: "Surface kind", value: (surface as unknown as { surface_kind?: string | null }).surface_kind || "Not recorded" },
      { label: "Actual tile dimension", value: spec.actualSize || "Not recorded", missing: !spec.actualSize },
      { label: "Grout joint", value: spec.jointSize || "Missing", missing: !spec.jointSize },
    ],
    Prep: [
      { label: "Substrate", value: spec.prep || "Not recorded", missing: !spec.prep },
      { label: "Underlayment", value: spec.underlayment || "Not recorded", missing: !spec.underlayment },
      { label: "Waterproofing", value: spec.waterproofing || "Not recorded", missing: !spec.waterproofing },
      { label: "Prep requirements", value: assignment?.notes || "None recorded" },
    ],
    "Photos & Notes": [
      { label: "Surface notes", value: surface.notes || "No notes yet" },
      { label: "Installer notes", value: assignment?.notes || "No published installer notes" },
    ],
  };
  const focusFor: Record<string, string> = { "Tile / product": "finish_selection_id", Supplier: "supplier", "Actual / nominal size": "tile_size", "Grout / joint": "grout_color", "Metal / edge": "edge_treatment", "Finish height / termination": "tile_height", "Special instructions": "notes", Pattern: "layout_pattern", Direction: "layout_direction", "Start point": "start_point", "Feature alignment": "coverage", Termination: "finish_transition", "Measured size": "measured_length_in", "Plan area": "plan_sf", "Field area": "field_sf", "Actual tile dimension": "actual_size", "Grout joint": "joint_size", Substrate: "prep", Underlayment: "underlayment", Waterproofing: "waterproofing", "Prep requirements": "notes", "Surface notes": "notes", "Installer notes": "notes" };
  const layoutEmpty = tab === "Layout" && !spec.layoutPattern && !spec.layoutDirection && !spec.startPoint;

  return <>
    {layoutEmpty ? <p className="mb-5 max-w-[70ch] text-[13px] text-muted-foreground">No layout image published yet. The decisions recorded below are what the installer will follow.</p> : null}
    <dl className="max-w-[820px]">
      {groups[tab].map((row) => (
        <div key={row.label} className="grid gap-1 border-b border-border py-3.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6">
          <dt className="text-[11px] font-bold tracking-[0.05em] text-muted-foreground uppercase">{row.label}</dt>
          <dd className={cn("min-w-0 text-[13.5px] leading-6", row.missing && "text-warning")}>
            {row.value}
            {row.missing ? <button type="button" onClick={() => onAdd(tab, focusFor[row.label])} className="ml-2 cursor-pointer text-[12px] font-semibold text-primary hover:underline">Add</button> : null}
          </dd>
        </div>
      ))}
    </dl>
    {tab === "Specification" && spec.legacyFallbacks.length ? <p className="mt-5 max-w-[70ch] text-[11.5px] text-muted-foreground">Shown from older records until re-confirmed: {spec.legacyFallbacks.join(", ")}. Saving here writes the current finish specification.</p> : null}
  </>;
}

const EDIT_FIELDS: Record<WorkspaceTab, { key: string; label: string; entity: "surface" | "assignment" | "selection"; type?: "number" | "textarea" }[]> = {
  Specification: [
    { key: "finish_selection_id", label: "Tile selection", entity: "assignment" }, { key: "product", label: "Product identification", entity: "selection" }, { key: "tile_sku", label: "SKU / item number", entity: "selection" }, { key: "manufacturer", label: "Manufacturer", entity: "selection" }, { key: "supplier", label: "Supplier", entity: "selection" }, { key: "tile_size", label: "Nominal size", entity: "selection" }, { key: "tile_finish", label: "Finish", entity: "selection" }, { key: "supplied_by", label: "Supplied by", entity: "selection" }, { key: "grout_manufacturer", label: "Grout manufacturer", entity: "assignment" }, { key: "grout_color", label: "Grout color", entity: "assignment" }, { key: "joint_size", label: "Joint size", entity: "assignment" }, { key: "edge_treatment", label: "Edge treatment", entity: "assignment" }, { key: "metal_profile", label: "Metal / profile", entity: "assignment" }, { key: "tile_height", label: "Finish height", entity: "assignment" }, { key: "notes", label: "Paperwork / specification notes", entity: "selection", type: "textarea" },
  ],
  Layout: [
    { key: "layout_pattern", label: "Pattern", entity: "assignment" }, { key: "layout_direction", label: "Direction", entity: "assignment" }, { key: "start_point", label: "Start / alignment", entity: "assignment" }, { key: "coverage", label: "Feature alignment", entity: "assignment" }, { key: "finish_transition", label: "Termination / transition", entity: "assignment" },
  ],
  Measurements: [
    { key: "surface_kind", label: "Surface kind (floor, wall, curb…)", entity: "surface" }, { key: "uom", label: "Unit of measure", entity: "surface" }, { key: "measured_length_in", label: "Measured length", entity: "surface", type: "number" }, { key: "measured_width_in", label: "Measured width", entity: "surface", type: "number" }, { key: "measured_height_in", label: "Measured height", entity: "surface", type: "number" }, { key: "plan_sf", label: "Plan area (sq ft)", entity: "surface", type: "number" }, { key: "field_sf", label: "Field area (sq ft)", entity: "surface", type: "number" }, { key: "actual_size", label: "Actual tile dimension", entity: "selection" }, { key: "joint_size", label: "Grout joint", entity: "assignment" },
  ],
  Prep: [
    { key: "prep", label: "Substrate / prep", entity: "surface" }, { key: "underlayment", label: "Underlayment", entity: "surface" }, { key: "waterproofing", label: "Waterproofing", entity: "surface" }, { key: "notes", label: "Prep requirements", entity: "assignment", type: "textarea" },
  ],
  "Photos & Notes": [
    { key: "notes", label: "Surface notes", entity: "surface", type: "textarea" }, { key: "notes", label: "Published installer notes", entity: "assignment", type: "textarea" },
  ],
};

function SurfaceEditDrawer({ projectId, surface, assignment, selection, selections, initialTab, focusKey, onClose }: { projectId: string; surface: SurfaceFull; assignment: FinishAssignment; selection: FinishSelection | null; selections: FinishSelection[]; initialTab: WorkspaceTab; focusKey: string | null; onClose: () => void }) {
  const [tab, setTab] = useState(initialTab);
  const updateSurface = useUpdateRow("project_surfaces");
  const saveAssignment = useSaveAssignment(projectId);
  const saveSelection = useSaveSelection(projectId);
  const initialValues = () => {
    const next: Record<string, string> = {};
    Object.values(EDIT_FIELDS).flat().forEach((field) => {
      const record = field.entity === "surface" ? surface : field.entity === "assignment" ? assignment : selection;
      next[`${field.entity}.${field.key}`] = String(record ? (record as unknown as Record<string, unknown>)[field.key] ?? "" : "");
    });
    next["assignment.finish_selection_id"] = assignment.finish_selection_id ?? "";
    return next;
  };
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const pending = updateSurface.isPending || saveAssignment.isPending || saveSelection.isPending;
  const commit = async () => {
    const surfacePatch: Record<string, string | number | null> = {};
    const assignmentPatch: Record<string, string | null> = {};
    const selectionPatch: Record<string, string | null> = {};
    Object.entries(values).forEach(([compound, raw]) => {
      const [entity, key] = compound.split(".");
      if (!entity || !key) return;
      const value = raw.trim() || null;
      const numericSurfaceKeys = ["plan_sf", "field_sf", "measured_length_in", "measured_width_in", "measured_height_in"];
      if (entity === "surface") surfacePatch[key] = numericSurfaceKeys.includes(key) ? (raw.trim() ? Number(raw) : null) : value;
      if (entity === "assignment") assignmentPatch[key] = value;
      if (entity === "selection" && selection) selectionPatch[key] = value;
    });
    await Promise.all([
      updateSurface.mutateAsync({ id: surface.id, patch: surfacePatch }),
      saveAssignment.mutateAsync({ id: assignment.id, patch: assignmentPatch }),
      selection && Object.keys(selectionPatch).length ? saveSelection.mutateAsync({ id: selection.id, patch: selectionPatch }) : Promise.resolve(),
    ]);
    toast.success("Surface changes saved");
    onClose();
  };
  return <Drawer open onClose={onClose} title={`Edit ${surface.name}`} subtitle="Changes save together when you are ready" width="max-w-[620px]" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={pending} onClick={commit}>Save Changes</Button></>}>
    <div className="mb-5 flex overflow-x-auto border-b border-border">{TABS.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn("shrink-0 border-b-2 px-3 py-2.5 text-xs font-semibold", tab === item ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>{item}</button>)}</div>
    <div className="space-y-4">
      {EDIT_FIELDS[tab].map((field, index) => {
        const compound = `${field.entity}.${field.key}`;
        if (field.key === "finish_selection_id") return <Field key={field.key} label="Tile selection"><Select autoFocus={focusKey === field.key} value={values[compound] ?? ""} onChange={(e) => setValues((old) => ({ ...old, [compound]: e.target.value }))}><option value="">Not selected</option>{selections.map((s) => <option key={s.id} value={s.id}>{formatFinish(s)}</option>)}</Select></Field>;
        const key = `${field.entity}-${field.key}-${index}`;
        return <Field key={key} label={field.label}>{field.type === "textarea" ? <TextArea autoFocus={focusKey === field.key} value={values[compound] ?? ""} onChange={(e) => setValues((old) => ({ ...old, [compound]: e.target.value }))} /> : <TextInput autoFocus={focusKey === field.key} type={field.type === "number" ? "number" : "text"} value={values[compound] ?? ""} disabled={field.entity === "selection" && !selection} onChange={(e) => setValues((old) => ({ ...old, [compound]: e.target.value }))} />}</Field>;
      })}
    </div>
  </Drawer>;
}

function ProjectPlanDrawer({ areas, files, initialAreaId, onCreateRoom, onClose }: { projectId: string; areas: (Area & { plan_file_id?: string | null; plan_page?: number | null; plan_location?: unknown })[]; files: { id: string; filename: string; storage_path: string }[]; initialAreaId: string | null; onCreateRoom: (name: string) => Promise<Area>; onClose: () => void }) {
  const updateArea = useUpdateRow("project_areas");
  const [fileId, setFileId] = useState("");
  const [page, setPage] = useState("");
  const [location, setLocation] = useState("");
  const [roomId, setRoomId] = useState(initialAreaId ?? "");
  const [newRoom, setNewRoom] = useState("");
  const file = files.find((f) => f.id === fileId);
  const save = async () => { let targetId = roomId; if (!targetId && newRoom.trim()) targetId = (await onCreateRoom(newRoom.trim())).id; if (!targetId) { toast.error("Choose or create a room"); return; } await updateArea.mutateAsync({ id: targetId, patch: { plan_file_id: fileId || null, plan_page: page ? Number(page) : null, plan_location: location.trim() ? { note: location.trim() } : null } }); toast.success("Plan linked to room"); onClose(); };
  return <Drawer open onClose={onClose} title="Open Plan" subtitle="Start from a project file, then link its location to a room" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!fileId || (!roomId && !newRoom.trim())} loading={updateArea.isPending} onClick={save}>Link plan</Button></>}>
    <div className="space-y-4"><Field label="Attached project plan or file"><Select value={fileId} onChange={(e) => setFileId(e.target.value)}><option value="">Choose a file…</option>{files.map((f) => <option key={f.id} value={f.id}>{f.filename}</option>)}</Select></Field>{file ? <Button onClick={async () => { const { data, error } = await supabase.storage.from("project-files").createSignedUrl(file.storage_path, 300); if (error || !data) toast.error("Could not open that plan"); else window.open(data.signedUrl, "_blank", "noopener"); }}><FileText className="size-4" /> Open {file.filename}</Button> : null}<div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3"><Field label="Page"><TextInput type="number" value={page} onChange={(e) => setPage(e.target.value)} /></Field><Field label="Pin or rough location"><TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Second floor, rear left" /></Field></div><div className="border-t border-border pt-4"><Field label="Link an existing room"><Select value={roomId} onChange={(e) => { setRoomId(e.target.value); if (e.target.value) setNewRoom(""); }}><option value="">Choose a room…</option>{areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><div className="my-3 text-center text-[11px] font-semibold text-muted-foreground">OR CREATE A ROOM</div><Field label="New room name"><TextInput value={newRoom} disabled={Boolean(roomId)} onChange={(e) => setNewRoom(e.target.value)} placeholder="Master Bathroom" /></Field></div>{!files.length ? <p className="text-xs text-muted-foreground">Upload the plan on the Files tab first.</p> : null}</div>
  </Drawer>;
}

function MultiFinishDrawer({ projectId, roomName, surfaces, zones, selections, onClose }: { projectId: string; roomName: string; surfaces: SurfaceFull[]; zones: { id: string; surface_id: string; is_default: boolean }[]; selections: FinishSelection[]; onClose: () => void }) {
  const apply = useApplyFinishToSurfaces(projectId);
  const [selectionId, setSelectionId] = useState("");
  const [surfaceIds, setSurfaceIds] = useState<string[]>([]);
  const toggle = (id: string) => setSurfaceIds((old) => old.includes(id) ? old.filter((value) => value !== id) : [...old, id]);
  return <Drawer open onClose={onClose} title="Apply finish to surfaces" subtitle={roomName} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!selectionId || !surfaceIds.length} loading={apply.isPending} onClick={async () => { await apply.mutateAsync({ surfaceIds, finishSelectionId: selectionId }); toast.success(`Finish applied to ${surfaceIds.length} surfaces`); onClose(); }}>Apply</Button></>}>
    <div className="space-y-5"><Field label="Existing project finish"><Select value={selectionId} onChange={(e) => setSelectionId(e.target.value)}><option value="">Choose a finish…</option>{selections.map((item) => <option key={item.id} value={item.id}>{formatFinish(item)}</option>)}</Select></Field><fieldset><legend className="mb-2 text-xs font-semibold text-muted-foreground">Surfaces</legend><div className="divide-y divide-border border-y border-border">{surfaces.map((item) => { const available = zones.some((zone) => zone.surface_id === item.id && zone.is_default); return <label key={item.id} className={cn("flex min-h-12 cursor-pointer items-center gap-3 py-2 text-sm font-medium", !available && "opacity-50")}><input type="checkbox" checked={surfaceIds.includes(item.id)} disabled={!available} onChange={() => toggle(item.id)} className="size-4 accent-primary" />{item.name}</label>; })}</div></fieldset></div>
  </Drawer>;
}

function formatFinish(selection: FinishSelection) {
  const tag = selection.tile_tag?.trim() || selection.label.trim();
  const product = selection.product?.trim();
  const size = selection.tile_size?.trim();
  const detail = [product && product.toLowerCase() !== "tbd" ? product : null, size].filter(Boolean).join(" · ");
  return detail ? `${tag} · ${detail}` : tag;
}

function NameDrawer({ open, title, placeholder, onClose, onSave }: { open: boolean; title: string; placeholder: string; onClose: () => void; onSave: (name: string) => void | Promise<void> }) { const [name, setName] = useState(""); return <Drawer open={open} onClose={onClose} title={title} footer={<Button variant="primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save</Button>}><Field label="Name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} /></Field></Drawer>; }
function PaneHeader({ title, actions, back }: { title: string; actions?: ReactNode; back?: ReactNode }) { return <header className="flex min-h-14 items-center gap-2 border-b border-border px-3"><div className="min-[1360px]:hidden">{back}</div><h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</h2><div className="flex items-center gap-1">{actions}</div></header>; }
function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) { return <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground">{children}</button>; }
