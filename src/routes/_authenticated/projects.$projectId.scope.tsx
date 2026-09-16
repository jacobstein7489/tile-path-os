import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronRight, FileText, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, Drawer, EmptyState, Field, Select, TextArea, TextInput } from "@/components/kit";
import { CreateWorkItemModal, RequestMaterialModal } from "@/components/WorkItemDialogs";
import { Popover, PopoverItem } from "@/components/ops/Popover";
import { useCanEditProject } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAreasWithSurfaces, useInsertRow, useUpdateRow, type Area, type SurfaceFull } from "@/lib/data";
import { useAddZone, useCreateSelection, useEnsureZones, useSaveAssignment, useSaveSelection, type FinishAssignment, type FinishSelection, type FinishZone } from "@/lib/finishes";
import { useProjectSetup } from "@/lib/setup";

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
  const [planOpen, setPlanOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addArea, setAddArea] = useState(false);
  const [addSurface, setAddSurface] = useState(false);
  const [addFinish, setAddFinish] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const areaList = areas.data ?? [];
  const surfaceList = surfaces.data ?? [];
  const areaSurfaces = useMemo(() => surfaceList.filter((s) => s.area_id === areaId), [surfaceList, areaId]);
  const area = areaList.find((a) => a.id === areaId) ?? null;
  const surface = surfaceList.find((s) => s.id === surfaceId) ?? null;
  const zones = setup.zoneList.filter((z) => z.surface_id === surfaceId);
  const selectedZone = zones.find((z) => z.id === zoneId) ?? zones.find((z) => z.is_default) ?? zones[0] ?? null;
  const assignment = setup.assignmentList.find((a) => a.zone_id === selectedZone?.id) ?? null;
  const selection = assignment?.finish_selection_id ? setup.selectionList.find((s) => s.id === assignment.finish_selection_id) ?? null : null;

  useEffect(() => { if (!areaId && areaList[0]) setAreaId(areaList[0].id); }, [areaId, areaList]);
  useEffect(() => { if (areaId && !areaSurfaces.some((s) => s.id === surfaceId)) setSurfaceId(areaSurfaces[0]?.id ?? null); }, [areaId, areaSurfaces, surfaceId]);
  useEffect(() => { if (surfaceList.length) ensureZones.mutate(surfaceList.map((s) => s.id)); }, [surfaceList.map((s) => s.id).join(",")]);
  useEffect(() => { setZoneId(zones.find((z) => z.is_default)?.id ?? zones[0]?.id ?? null); }, [surfaceId, zones.map((z) => z.id).join(",")]);
  useEffect(() => { setTab("Specification"); }, [surfaceId]);

  const readinessFor = (kind: "area" | "surface", id: string) => {
    const rows = setup.requirements.filter((r) => kind === "area" ? r.area_id === id : r.surface_id === id);
    const blocked = rows.filter((r) => r.state === "blocked").length;
    return blocked ? `${blocked} missing` : rows.some((r) => r.state === "met") ? "Ready" : null;
  };

  return <>
    <div className="min-h-[620px] border-x border-b border-border bg-card lg:grid lg:grid-cols-[230px_270px_minmax(0,1fr)]">
      <aside className={cn("min-w-0 border-r border-border", areaId && "hidden lg:block")}>
        <PaneHeader title="Rooms" actions={<><Button size="sm" onClick={() => setPlanOpen(true)} disabled={!area}><FileText className="size-3.5" /> Plan</Button><IconButton label="Add room" onClick={() => setAddArea(true)}><Plus className="size-4" /></IconButton></>} />
        <div className="divide-y divide-border">
          {areaList.map((item) => { const count = surfaceList.filter((s) => s.area_id === item.id).length; const status = readinessFor("area", item.id); return <button key={item.id} type="button" onClick={() => { setAreaId(item.id); setSurfaceId(null); }} className={cn("flex min-h-16 w-full items-center gap-3 px-4 text-left transition-colors duration-150 hover:bg-muted/60", item.id === areaId && "bg-primary-soft/70")}><span className="min-w-0 flex-1"><b className={cn("block truncate text-[13.5px]", item.id === areaId && "text-primary")}>{item.name}</b><span className="text-xs text-muted-foreground">{count} surface{count === 1 ? "" : "s"}</span></span>{status ? <span className={cn("text-[11px] font-semibold", status === "Ready" ? "text-success" : "text-warning")}>{status}</span> : null}<ChevronRight className="size-4 text-muted-foreground lg:hidden" /></button>; })}
          {!areaList.length ? <EmptyState title="No rooms yet" note="Add the first room to begin setup." /> : null}
        </div>
      </aside>

      <aside className={cn("min-w-0 border-r border-border", !areaId && "hidden", surfaceId && "hidden lg:block")}>
        <PaneHeader title={area?.name ?? "Surfaces"} back={<button type="button" onClick={() => setAreaId(null)} className="grid size-10 place-items-center text-primary lg:hidden" aria-label="Back to rooms"><ArrowLeft className="size-4" /></button>} actions={<IconButton label="Add surface" onClick={() => setAddSurface(true)}><Plus className="size-4" /></IconButton>} />
        <div className="divide-y divide-border">
          {areaSurfaces.map((item) => { const ctx = setup.contexts.find((c) => c.surface.id === item.id && c.zone.is_default); const summary = ctx?.selection ? [ctx.selection.tile_tag || ctx.selection.label, ctx.selection.tile_size].filter(Boolean).join(" · ") : "Finish missing"; const missing = !ctx?.selection; return <button key={item.id} type="button" onClick={() => setSurfaceId(item.id)} className={cn("flex min-h-15 w-full items-center gap-3 px-4 text-left transition-colors duration-150 hover:bg-muted/60", item.id === surfaceId && "bg-primary-soft/70")}><span className="min-w-0 flex-1"><b className={cn("block truncate text-[13.5px]", item.id === surfaceId && "text-primary")}>{item.name}</b><span className={cn("text-xs", missing ? "text-warning" : "text-muted-foreground")}>{summary}</span></span><ChevronRight className="size-4 text-muted-foreground" /></button>; })}
          {area && !areaSurfaces.length ? <EmptyState title="No surfaces" note="Add the first surface in this room." /> : null}
        </div>
      </aside>

      <section className={cn("min-w-0", !surfaceId && "hidden lg:block")}>
        {!surface ? <div className="grid min-h-[520px] place-items-center"><EmptyState title="Select a surface" note="Its specification and installation decisions will appear here." /></div> : <>
          <header className="border-b border-border px-4 py-4 md:px-6">
            <button type="button" onClick={() => setSurfaceId(null)} className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary lg:hidden"><ArrowLeft className="size-4" /> {area?.name}</button>
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1"><h2 className="text-[20px] font-semibold md:text-[22px]">{surface.name}</h2><p className="mt-1 text-[13px] text-secondary-foreground">{selection ? [selection.tile_tag || selection.label, selection.product, selection.tile_size].filter(Boolean).join(" · ") : "Finish specification not mapped"}</p><p className="mt-0.5 text-xs text-muted-foreground">{[assignment?.grout_color, assignment?.layout_direction, assignment?.layout_pattern].filter(Boolean).join(" · ") || "Installation choices not recorded"}</p></div>
              <Button size="sm" variant="primary" onClick={() => setEditOpen(true)}><Pencil className="size-3.5" /> Edit</Button>
              <div className="relative"><IconButton label="Surface actions" onClick={() => setMoreOpen((v) => !v)}><MoreHorizontal className="size-4" /></IconButton><Popover open={moreOpen} onClose={() => setMoreOpen(false)} align="right" width="md:w-56" title="Surface actions"><PopoverItem onClick={() => { setMoreOpen(false); setIssueOpen(true); }}>Add issue</PopoverItem><PopoverItem onClick={() => { setMoreOpen(false); setMaterialOpen(true); }}>Request material</PopoverItem><PopoverItem onClick={() => { setMoreOpen(false); setAddFinish(true); }}>Add finish area</PopoverItem><PopoverItem tone="muted" onClick={() => { setMoreOpen(false); updateSurface.mutate({ id: surface.id, patch: { archived_at: new Date().toISOString() } }); }}>Archive surface</PopoverItem></Popover></div>
            </div>
            {zones.length > 1 ? <div className="mt-4 flex gap-1 overflow-x-auto">{zones.map((zone) => <button key={zone.id} type="button" onClick={() => setZoneId(zone.id)} className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold", zone.id === selectedZone?.id ? "bg-primary-soft text-primary" : "text-secondary-foreground hover:bg-muted")}>{zone.is_default ? "Main field" : zone.name}</button>)}</div> : null}
          </header>
          <nav className="flex overflow-x-auto border-b border-border px-4 md:px-6">{TABS.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn("shrink-0 border-b-2 px-3 py-3 text-[12.5px] font-semibold", tab === item ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{item}</button>)}</nav>
          <div className="px-5 py-6 md:px-8 md:py-8"><SurfaceSection tab={tab} surface={surface} assignment={assignment} selection={selection} /></div>
        </>}
      </section>
    </div>

    <NameDrawer open={addArea} title="Add room" placeholder="Master Bathroom" onClose={() => setAddArea(false)} onSave={async (name) => { const row = await insertArea.mutateAsync({ project_id: projectId, name, sort_order: areaList.length + 1 }) as { id: string }; setAreaId(row.id); setSurfaceId(null); setAddArea(false); }} />
    <NameDrawer open={addSurface} title="Add surface" placeholder="Shower Wall A" onClose={() => setAddSurface(false)} onSave={async (name) => { if (!areaId) return; const row = await insertSurface.mutateAsync({ area_id: areaId, name, sort_order: areaSurfaces.length + 1 }) as { id: string }; setSurfaceId(row.id); setAddSurface(false); }} />
    {area && planOpen ? <PlanDrawer projectId={projectId} area={area} files={setup.fileList} onClose={() => setPlanOpen(false)} /> : null}
    {surface && assignment && editOpen ? <SurfaceEditDrawer projectId={projectId} surface={surface} assignment={assignment} selection={selection} selections={setup.selectionList} initialTab={tab} onClose={() => setEditOpen(false)} /> : null}
    {surface && addFinish ? <NameDrawer open title="Add finish area" placeholder="Accent band" onClose={() => setAddFinish(false)} onSave={async (name) => { const id = await addZone.mutateAsync({ surfaceId: surface.id, name, sortOrder: zones.length }); setZoneId(id); setAddFinish(false); }} /> : null}
    <CreateWorkItemModal open={issueOpen} onClose={() => setIssueOpen(false)} kind="Issue" projectId={projectId} areaId={areaId} surfaceId={surfaceId} />
    <RequestMaterialModal open={materialOpen} onClose={() => setMaterialOpen(false)} projectId={projectId} />
  </>;
}

function SurfaceSection({ tab, surface, assignment, selection }: { tab: WorkspaceTab; surface: SurfaceFull; assignment: FinishAssignment | null; selection: FinishSelection | null }) {
  const groups: Record<WorkspaceTab, { label: string; value: ReactNode; missing?: boolean }[]> = {
    Specification: [
      { label: "Tile", value: selection ? <><b>{selection.label}</b><small>{[selection.manufacturer, selection.tile_size].filter(Boolean).join(" · ")}</small>{selection.tile_sku ? <small>SKU {selection.tile_sku}</small> : null}</> : "Missing", missing: !selection },
      { label: "Grout", value: assignment?.grout_color ? <><b>{assignment.grout_color}</b><small>{[assignment.grout_manufacturer, assignment.joint_size].filter(Boolean).join(" · ")}</small></> : "Missing", missing: !assignment?.grout_color },
      { label: "Edge", value: [assignment?.edge_treatment, assignment?.metal_profile].filter(Boolean).join(" · ") || "Missing", missing: !assignment?.edge_treatment && !assignment?.metal_profile },
      { label: "Finish height", value: assignment?.tile_height || "Missing", missing: !assignment?.tile_height },
    ],
    Layout: [
      { label: "Pattern", value: assignment?.layout_pattern || "Missing", missing: !assignment?.layout_pattern },
      { label: "Direction", value: assignment?.layout_direction || "Missing", missing: !assignment?.layout_direction },
      { label: "Start", value: assignment?.start_point || "Missing", missing: !assignment?.start_point },
      { label: "Alignment", value: assignment?.coverage || "Missing", missing: !assignment?.coverage },
      { label: "Termination", value: assignment?.finish_transition || assignment?.tile_height || "Missing", missing: !assignment?.finish_transition && !assignment?.tile_height },
    ],
    Measurements: [
      { label: "Plan dimensions", value: surface.plan_sf ? `${surface.plan_sf} sq ft` : "Not recorded", missing: !surface.plan_sf },
      { label: "Field dimensions", value: surface.field_sf ? `${surface.field_sf} sq ft` : "Not recorded", missing: !surface.field_sf },
      { label: "Area", value: surface.field_sf ?? surface.plan_sf ? `${surface.field_sf ?? surface.plan_sf} sq ft` : "Not calculated", missing: !surface.field_sf && !surface.plan_sf },
      { label: "Actual tile dimension", value: selection?.actual_size || "Not recorded", missing: !selection?.actual_size },
      { label: "Grout joint", value: assignment?.joint_size || "Missing", missing: !assignment?.joint_size },
    ],
    Prep: [
      { label: "Substrate", value: surface.prep || "Not recorded", missing: !surface.prep },
      { label: "Underlayment", value: surface.underlayment || "Not recorded", missing: !surface.underlayment },
      { label: "Waterproofing", value: surface.waterproofing || "Not recorded", missing: !surface.waterproofing },
      { label: "Prep requirements", value: assignment?.notes || "None recorded" },
    ],
    "Photos & Notes": [
      { label: "Surface notes", value: surface.notes || "No notes yet" },
      { label: "Installer notes", value: assignment?.notes || "No published installer notes" },
    ],
  };
  return <div className="max-w-3xl divide-y divide-border">{groups[tab].map((row) => <div key={row.label} className="grid gap-1 py-4 sm:grid-cols-[150px_minmax(0,1fr)]"><dt className="text-xs font-semibold text-muted-foreground">{row.label}</dt><dd className={cn("text-[13.5px] leading-6", row.missing && "font-semibold text-warning")}>{row.value}{row.missing ? <button type="button" className="ml-2 text-xs font-semibold text-primary">Add <ChevronRight className="inline size-3" /></button> : null}</dd></div>)}</div>;
}

const EDIT_FIELDS: Record<WorkspaceTab, { key: string; label: string; entity: "surface" | "assignment" | "selection"; type?: "number" | "textarea" }[]> = {
  Specification: [
    { key: "finish_selection_id", label: "Tile selection", entity: "assignment" }, { key: "grout_manufacturer", label: "Grout manufacturer", entity: "assignment" }, { key: "grout_color", label: "Grout color", entity: "assignment" }, { key: "joint_size", label: "Joint size", entity: "assignment" }, { key: "edge_treatment", label: "Edge treatment", entity: "assignment" }, { key: "metal_profile", label: "Metal / profile", entity: "assignment" }, { key: "tile_height", label: "Finish height", entity: "assignment" },
  ],
  Layout: [
    { key: "layout_pattern", label: "Pattern", entity: "assignment" }, { key: "layout_direction", label: "Direction", entity: "assignment" }, { key: "start_point", label: "Start / alignment", entity: "assignment" }, { key: "coverage", label: "Feature alignment", entity: "assignment" }, { key: "finish_transition", label: "Termination / transition", entity: "assignment" },
  ],
  Measurements: [
    { key: "plan_sf", label: "Plan area (sq ft)", entity: "surface", type: "number" }, { key: "field_sf", label: "Field area (sq ft)", entity: "surface", type: "number" }, { key: "actual_size", label: "Actual tile dimension", entity: "selection" }, { key: "joint_size", label: "Grout joint", entity: "assignment" },
  ],
  Prep: [
    { key: "prep", label: "Substrate / prep", entity: "surface" }, { key: "underlayment", label: "Underlayment", entity: "surface" }, { key: "waterproofing", label: "Waterproofing", entity: "surface" }, { key: "notes", label: "Prep requirements", entity: "assignment", type: "textarea" },
  ],
  "Photos & Notes": [
    { key: "notes", label: "Surface notes", entity: "surface", type: "textarea" }, { key: "notes", label: "Published installer notes", entity: "assignment", type: "textarea" },
  ],
};

function SurfaceEditDrawer({ projectId, surface, assignment, selection, selections, initialTab, onClose }: { projectId: string; surface: SurfaceFull; assignment: FinishAssignment; selection: FinishSelection | null; selections: FinishSelection[]; initialTab: WorkspaceTab; onClose: () => void }) {
  const [tab, setTab] = useState(initialTab);
  const updateSurface = useUpdateRow("project_surfaces");
  const saveAssignment = useSaveAssignment(projectId);
  const saveSelection = useSaveSelection(projectId);
  const createSelection = useCreateSelection(projectId);
  const [newTile, setNewTile] = useState("");
  const save = (entity: string, key: string, raw: string) => { const value = raw.trim() || null; if (entity === "surface") updateSurface.mutate({ id: surface.id, patch: { [key]: key === "plan_sf" || key === "field_sf" ? (raw ? Number(raw) : null) : value } }); else if (entity === "assignment") saveAssignment.mutate({ id: assignment.id, patch: { [key]: value } }); else if (selection) saveSelection.mutate({ id: selection.id, patch: { [key]: value } }); };
  return <Drawer open onClose={onClose} title={`Edit ${surface.name}`} subtitle="Edit one category at a time" width="max-w-[620px]">
    <div className="mb-5 flex overflow-x-auto border-b border-border">{TABS.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn("shrink-0 border-b-2 px-3 py-2.5 text-xs font-semibold", tab === item ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>{item}</button>)}</div>
    <div className="space-y-4">
      {EDIT_FIELDS[tab].map((field, index) => {
        if (field.key === "finish_selection_id") return <div key={field.key} className="space-y-2"><Field label="Tile selection"><Select value={assignment.finish_selection_id ?? ""} onChange={(e) => saveAssignment.mutate({ id: assignment.id, patch: { finish_selection_id: e.target.value || null } })}><option value="">Not selected</option>{selections.map((s) => <option key={s.id} value={s.id}>{[s.label, s.tile_size, s.manufacturer].filter(Boolean).join(" · ")}</option>)}</Select></Field><div className="flex gap-2"><TextInput value={newTile} onChange={(e) => setNewTile(e.target.value)} placeholder="Add a tile to this job" /><Button disabled={!newTile.trim()} onClick={async () => { const id = await createSelection.mutateAsync({ label: newTile.trim() }); saveAssignment.mutate({ id: assignment.id, patch: { finish_selection_id: id } }); setNewTile(""); }}>Add</Button></div></div>;
        const record = field.entity === "surface" ? surface : field.entity === "assignment" ? assignment : selection;
        const current = record ? (record as unknown as Record<string, unknown>)[field.key] : null;
        const key = `${field.entity}-${field.key}-${index}`;
        return <Field key={key} label={field.label}>{field.type === "textarea" ? <TextArea defaultValue={String(current ?? "")} onBlur={(e) => save(field.entity, field.key, e.target.value)} /> : <TextInput type={field.type === "number" ? "number" : "text"} defaultValue={String(current ?? "")} disabled={field.entity === "selection" && !selection} onBlur={(e) => save(field.entity, field.key, e.target.value)} />}</Field>;
      })}
    </div>
  </Drawer>;
}

function PlanDrawer({ projectId, area, files, onClose }: { projectId: string; area: Area & { plan_file_id?: string | null; plan_page?: number | null; plan_location?: unknown }; files: { id: string; filename: string; storage_path: string }[]; onClose: () => void }) {
  const updateArea = useUpdateRow("project_areas");
  const file = files.find((f) => f.id === area.plan_file_id);
  const location = area.plan_location as { note?: string } | null;
  return <Drawer open onClose={onClose} title={`${area.name} plan reference`} subtitle="Link this room to its place in the project plans">
    <div className="space-y-4"><Field label="Plan or scope file"><Select defaultValue={area.plan_file_id ?? ""} onChange={(e) => updateArea.mutate({ id: area.id, patch: { plan_file_id: e.target.value || null } })}><option value="">Not linked</option>{files.map((f) => <option key={f.id} value={f.id}>{f.filename}</option>)}</Select></Field><Field label="Page"><TextInput type="number" defaultValue={area.plan_page ?? ""} onBlur={(e) => updateArea.mutate({ id: area.id, patch: { plan_page: e.target.value ? Number(e.target.value) : null } })} /></Field><Field label="Location note"><TextInput defaultValue={location?.note ?? ""} placeholder="Second floor, rear left" onBlur={(e) => updateArea.mutate({ id: area.id, patch: { plan_location: e.target.value ? { note: e.target.value } : null } })} /></Field>{file ? <Button onClick={async () => { const { data, error } = await supabase.storage.from("project-files").createSignedUrl(file.storage_path, 300); if (error || !data) toast.error("Could not open that plan"); else window.open(data.signedUrl, "_blank", "noopener"); }}><FileText className="size-4" /> Open {file.filename}</Button> : null}</div>
  </Drawer>;
}

function NameDrawer({ open, title, placeholder, onClose, onSave }: { open: boolean; title: string; placeholder: string; onClose: () => void; onSave: (name: string) => void | Promise<void> }) { const [name, setName] = useState(""); return <Drawer open={open} onClose={onClose} title={title} footer={<Button variant="primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save</Button>}><Field label="Name"><TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} /></Field></Drawer>; }
function PaneHeader({ title, actions, back }: { title: string; actions?: ReactNode; back?: ReactNode }) { return <header className="flex min-h-14 items-center gap-2 border-b border-border px-3"><div className="lg:hidden">{back}</div><h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</h2><div className="flex items-center gap-1">{actions}</div></header>; }
function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) { return <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground">{children}</button>; }
