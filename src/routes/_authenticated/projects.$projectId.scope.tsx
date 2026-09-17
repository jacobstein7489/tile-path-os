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

function ScopeAndDetails() {
  const { projectId } = Route.useParams();
  const { canEdit } = useCanEditProject(projectId);
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
  const [desktop, setDesktop] = useState(false);
  const areaList = areas.data ?? [];
  const surfaceList = surfaces.data ?? [];
  const areaSurfaces = useMemo(() => surfaceList.filter((s) => s.area_id === areaId), [surfaceList, areaId]);
  const area = areaList.find((a) => a.id === areaId) ?? null;
  const surface = surfaceList.find((s) => s.id === surfaceId) ?? null;
  const zones = setup.zoneList.filter((z) => z.surface_id === surfaceId);
  const selectedZone = zones.find((z) => z.id === zoneId) ?? zones.find((z) => z.is_default) ?? zones[0] ?? null;
  const assignment = setup.assignmentList.find((a) => a.zone_id === selectedZone?.id) ?? null;
  const selection = assignment?.finish_selection_id ? setup.selectionList.find((s) => s.id === assignment.finish_selection_id) ?? null : null;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => { if (desktop && !areaId && areaList[0]) setAreaId(areaList[0].id); }, [desktop, areaId, areaList]);
  useEffect(() => { if (desktop && areaId && !areaSurfaces.some((s) => s.id === surfaceId)) setSurfaceId(areaSurfaces[0]?.id ?? null); }, [desktop, areaId, areaSurfaces, surfaceId]);
  useEffect(() => { if (surfaceList.length) ensureZones.mutate(surfaceList.map((s) => s.id)); }, [surfaceList.map((s) => s.id).join(",")]);
  useEffect(() => { setZoneId(zones.find((z) => z.is_default)?.id ?? zones[0]?.id ?? null); }, [surfaceId, zones.map((z) => z.id).join(",")]);
  useEffect(() => { setTab("Specification"); }, [surfaceId]);

  const readinessForArea = (id: string) => {
    const ids = new Set(surfaceList.filter((s) => s.area_id === id).map((s) => s.id));
    const affected = new Set(setup.requirements.filter((r) => r.state === "blocked" && r.surface_id && ids.has(r.surface_id)).map((r) => r.surface_id));
    return affected.size ? `${affected.size} surface${affected.size === 1 ? "" : "s"} need setup` : ids.size ? "Ready" : null;
  };
  const openEditor = (nextTab: WorkspaceTab, key?: string) => { setEditTab(nextTab); setFocusKey(key ?? null); setEditOpen(true); };

  return <>
    <div className="min-h-[620px] border-x border-b border-border bg-card min-[1360px]:grid min-[1360px]:grid-cols-[230px_270px_minmax(0,1fr)]">
      <aside className={cn("min-w-0 border-r border-border", areaId && "hidden min-[1360px]:block")}>
         <PaneHeader title="Rooms" actions={<><Button size="sm" onClick={() => setPlanOpen(true)}><FileText className="size-3.5" /> Plan</Button><IconButton label="Add room" onClick={() => setAddArea(true)}><Plus className="size-4" /></IconButton></>} />
        <div className="divide-y divide-border">
           {areaList.map((item) => { const count = surfaceList.filter((s) => s.area_id === item.id).length; const status = readinessForArea(item.id); return <button key={item.id} type="button" onClick={() => { setAreaId(item.id); setSurfaceId(null); }} className={cn("flex min-h-16 w-full items-center gap-3 px-4 text-left transition-colors duration-150 hover:bg-muted/60", item.id === areaId && "bg-primary-soft/70")}><span className="min-w-0 flex-1"><b className={cn("block truncate text-[13.5px]", item.id === areaId && "text-primary")}>{item.name}</b><span className={cn("text-xs", status === "Ready" ? "text-muted-foreground" : "text-warning")}>{status ?? `${count} surface${count === 1 ? "" : "s"}`}</span></span><ChevronRight className="size-4 text-muted-foreground lg:hidden" /></button>; })}
          {!areaList.length ? <EmptyState title="No rooms yet" note="Add the first room to begin setup." /> : null}
        </div>
      </aside>

       <aside className={cn("min-w-0 border-r border-border", !areaId && "hidden", surfaceId && "hidden min-[1360px]:block")}> 
          <PaneHeader title={area?.name ?? "Surfaces"} back={<button type="button" onClick={() => setAreaId(null)} className="grid size-10 place-items-center text-primary min-[1360px]:hidden" aria-label="Back to rooms"><ArrowLeft className="size-4" /></button>} actions={<><IconButton label="Apply finish to surfaces" onClick={() => setMultiFinishOpen(true)}><SwatchBook className="size-4" /></IconButton><IconButton label="Add surface" onClick={() => setAddSurface(true)}><Plus className="size-4" /></IconButton></>} />
        <div className="divide-y divide-border">
           {areaSurfaces.map((item) => { const ctx = setup.contexts.find((c) => c.surface.id === item.id && c.zone.is_default); const blockers = setup.requirements.filter((r) => r.surface_id === item.id && r.state === "blocked"); const summary = !ctx?.selection ? "Not started" : blockers.length ? `${blockers.length} ${blockers.length === 1 ? "decision" : "items"} pending` : "Ready"; return <button key={item.id} type="button" onClick={() => setSurfaceId(item.id)} className={cn("flex min-h-15 w-full items-center gap-3 px-4 text-left transition-colors duration-150 hover:bg-muted/60", item.id === surfaceId && "bg-primary-soft/70")}><span className="min-w-0 flex-1"><b className={cn("block truncate text-[13.5px]", item.id === surfaceId && "text-primary")}>{item.name}</b><span className={cn("text-xs", summary === "Ready" ? "text-success" : summary === "Not started" ? "text-muted-foreground" : "text-warning")}>{summary}</span></span><ChevronRight className="size-4 text-muted-foreground" /></button>; })}
          {area && !areaSurfaces.length ? <EmptyState title="No surfaces" note="Add the first surface in this room." /> : null}
        </div>
      </aside>

      <section className={cn("min-w-0", !surfaceId && "hidden min-[1360px]:block")}> 
        {!surface ? <div className="grid min-h-[520px] place-items-center"><EmptyState title="Select a surface" note="Its specification and installation decisions will appear here." /></div> : <>
          <header className="border-b border-border px-4 py-4 md:px-6">
             <button type="button" onClick={() => setSurfaceId(null)} className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary min-[1360px]:hidden"><ArrowLeft className="size-4" /> {area?.name}</button>
            <div className="flex items-start gap-4">
               <div className="min-w-0 flex-1"><h2 className="text-[20px] font-semibold md:text-[22px]">{surface.name}</h2><p className="mt-1 text-[13px] text-secondary-foreground">{[(surface as unknown as { surface_kind?: string | null }).surface_kind, selection ? formatFinish(selection) : "Finish specification not mapped"].filter(Boolean).join(" · ")}</p><p className={cn("mt-1 text-xs font-semibold", setup.requirements.some((r) => r.surface_id === surface.id && r.state === "blocked") ? "text-warning" : "text-success")}>{setup.requirements.some((r) => r.surface_id === surface.id && r.state === "blocked") ? `${setup.requirements.filter((r) => r.surface_id === surface.id && r.state === "blocked").length} open setup item(s)` : "Ready"}</p></div>
               <Button size="sm" variant="primary" onClick={() => openEditor(tab)}><Pencil className="size-3.5" /> Edit</Button>
              <div className="relative"><IconButton label="Surface actions" onClick={() => setMoreOpen((v) => !v)}><MoreHorizontal className="size-4" /></IconButton><Popover open={moreOpen} onClose={() => setMoreOpen(false)} align="right" width="md:w-56" title="Surface actions"><PopoverItem onClick={() => { setMoreOpen(false); setIssueOpen(true); }}>Add issue</PopoverItem><PopoverItem onClick={() => { setMoreOpen(false); setMaterialOpen(true); }}>Request material</PopoverItem><PopoverItem onClick={() => { setMoreOpen(false); setAddFinish(true); }}>Add finish area</PopoverItem><PopoverItem tone="muted" onClick={() => { setMoreOpen(false); updateSurface.mutate({ id: surface.id, patch: { archived_at: new Date().toISOString() } }); }}>Archive surface</PopoverItem></Popover></div>
            </div>
            {zones.length > 1 ? <div className="mt-4 flex gap-1 overflow-x-auto">{zones.map((zone) => <button key={zone.id} type="button" onClick={() => setZoneId(zone.id)} className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold", zone.id === selectedZone?.id ? "bg-primary-soft text-primary" : "text-secondary-foreground hover:bg-muted")}>{zone.is_default ? "Main field" : zone.name}</button>)}</div> : null}
          </header>
          <nav className="flex overflow-x-auto border-b border-border px-4 md:px-6">{TABS.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn("shrink-0 border-b-2 px-3 py-3 text-[12.5px] font-semibold", tab === item ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{item}</button>)}</nav>
           <div className="px-5 py-6 md:px-8 md:py-8"><SurfaceSection tab={tab} surface={surface} assignment={assignment} selection={selection} onAdd={openEditor} /></div>
        </>}
      </section>
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

function SurfaceSection({ tab, surface, assignment, selection, onAdd }: { tab: WorkspaceTab; surface: SurfaceFull; assignment: FinishAssignment | null; selection: FinishSelection | null; onAdd: (tab: WorkspaceTab, key?: string) => void }) {
  /** Everything shown here reads through the authoritative finish model. */
  const spec = resolveSpec({ surface, assignment, selection });
  const measured = measurementSummary(surface);
  const groups: Record<WorkspaceTab, { label: string; value: ReactNode; missing?: boolean }[]> = {
    Specification: [
      { label: "Tile", value: selection ? <><b className="block">{selection.label}</b><small className="block text-muted-foreground">{[spec.manufacturer, spec.nominalSize].filter(Boolean).join(" · ")}</small>{spec.sku ? <small className="block text-muted-foreground">SKU {spec.sku}</small> : null}</> : "Missing", missing: !selection },
      { label: "Grout", value: spec.groutColor ? <><b className="block">{spec.groutColor}</b><small className="block text-muted-foreground">{[spec.groutManufacturer, spec.jointSize].filter(Boolean).join(" · ")}</small></> : "Missing", missing: !spec.groutColor },
      { label: "Edge", value: [spec.edgeTreatment, spec.metalProfile].filter(Boolean).join(" · ") || "Missing", missing: !spec.edgeTreatment && !spec.metalProfile },
      { label: "Finish height", value: spec.tileHeight || "Missing", missing: !spec.tileHeight },
    ],
    Layout: [
      { label: "Pattern", value: spec.layoutPattern || "Missing", missing: !spec.layoutPattern },
      { label: "Direction", value: spec.layoutDirection || "Missing", missing: !spec.layoutDirection },
      { label: "Start", value: spec.startPoint || "Missing", missing: !spec.startPoint },
      { label: "Alignment", value: spec.coverage || "Missing", missing: !spec.coverage },
      { label: "Termination", value: spec.finishTransition || spec.tileHeight || "Missing", missing: !spec.finishTransition && !spec.tileHeight },
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
  const focusFor: Record<string, string> = { Tile: "finish_selection_id", Grout: "grout_color", Edge: "edge_treatment", "Finish height": "tile_height", Pattern: "layout_pattern", Direction: "layout_direction", Start: "start_point", Alignment: "coverage", Termination: "finish_transition", "Measured size": "measured_length_in", "Plan area": "plan_sf", "Field area": "field_sf", "Actual tile dimension": "actual_size", "Grout joint": "joint_size", Substrate: "prep", Underlayment: "underlayment", Waterproofing: "waterproofing", "Prep requirements": "notes", "Surface notes": "notes", "Installer notes": "notes" };
  return <>
    <div className="max-w-3xl divide-y divide-border">{groups[tab].map((row) => <div key={row.label} className="grid gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)]"><dt className="text-xs font-semibold text-muted-foreground">{row.label}</dt><dd className={cn("text-[13.5px] leading-6", row.missing && "font-semibold text-warning")}>{row.value}{row.missing ? <button type="button" onClick={() => onAdd(tab, focusFor[row.label])} className="ml-2 cursor-pointer text-xs font-semibold text-primary">Add <ChevronRight className="inline size-3" /></button> : null}</dd></div>)}</div>
    {tab === "Specification" && spec.legacyFallbacks.length ? <p className="mt-5 max-w-3xl rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Shown from older records until re-confirmed: {spec.legacyFallbacks.join(", ")}. Saving here writes the current finish specification.</p> : null}
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
