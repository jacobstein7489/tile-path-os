import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  HardHat,
  Layers,
  ListChecks,
  MessageSquarePlus,
  Package,
  TriangleAlert,
} from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import {
  Button,
  Checkbox,
  EmptyState,
  SectionCard,
  Table,
  Td,
  Th,
} from "@/components/kit";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import type { WorkItemRow } from "@/lib/workitems";
import { CreateWorkItemModal, RequestMaterialModal, type WorkItemKind } from "@/components/WorkItemDialogs";
import { showsInstallationProgress } from "@/lib/lifecycle";
import {
  useAreasWithSurfaces,
  useProject,
  useUpdateRow,
  useVisitChecklist,
  useWorkItems,
  type WorkItemFull,
} from "@/lib/data";
import { Chip, areaStatusTone, materialTone, workItemTone } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/projects/$projectId/")({
  head: () => ({
    meta: [
      { title: "Project Overview — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Where the project is up to: lifecycle stage, readiness, blockers, crew, dates and the next move.",
      },
      { property: "og:title", content: "Project Overview — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Lifecycle stage, readiness, blockers, crew, dates and the next move.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectOverview,
});

function ProjectOverview() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { areas, surfaces } = useAreasWithSurfaces(projectId);
  const { data: items = [] } = useWorkItems(projectId);
  const { data: checklist = [] } = useVisitChecklist(projectId);
  const updateChecklist = useUpdateRow("visit_checklist_items");
  const updateItem = useUpdateRow("work_items");
  const [create, setCreate] = useState<WorkItemKind | null>(null);
  const [material, setMaterial] = useState(false);
  const [openItem, setOpenItem] = useState<WorkItemRow | null>(null);

  if (!project) return null;

  const areaList = areas.data ?? [];
  const surfaceList = surfaces.data ?? [];
  const installing = showsInstallationProgress(project.lifecycle_stage);
  const open = (items as WorkItemFull[]).filter((i) => i.status !== "Complete");
  const blockers = open.filter((i) => ["Issue", "Question", "Decision"].includes(i.item_type));
  const headline = installing ? project.installation_progress : project.readiness_pct;

  return (
    <>
      {/* Progress headline */}
      <section className="surface px-6 py-5">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {installing ? "Overall installation progress" : "Setup & readiness completion"}
            </div>
            <div className="mt-1 flex items-end gap-2.5">
              <span className="text-[34px] leading-none font-semibold tracking-[-0.02em]">
                {headline}%
              </span>
              <span className="pb-1 text-[13px] text-muted-foreground">
                {installing
                  ? `${surfaceList.filter((s) => s.status === "Complete").length} of ${surfaceList.length} surfaces complete`
                  : (project.readiness_note ?? "Readiness explains what is still outstanding.")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone={materialTone(project.material_status)}>
              Materials: {project.material_status}
            </Chip>
            {project.crew_lead ? <Chip tone="blue">Crew: {project.crew_lead}</Chip> : null}
          </div>
        </div>
        <ProgressBar value={headline} className="mt-4" />
        {!installing ? (
          <p className="mt-2.5 text-[12px] text-muted-foreground">
            Installation progress is intentionally hidden until the project reaches Installation.
          </p>
        ) : null}
      </section>

      {/* Facts */}
      <div className="mt-5 grid grid-cols-4 gap-4">
        <Fact icon={<HardHat className="size-4" />} label="Crew" value={project.crew_lead ?? "Not assigned"} />
        <Fact
          icon={<CalendarDays className="size-4" />}
          label="Dates"
          value={
            project.start_date || project.target_date
              ? `${project.start_date ?? "—"} → ${project.target_date ?? "—"}`
              : "Not scheduled"
          }
        />
        <Fact
          icon={<Layers className="size-4" />}
          label="Scope"
          value={`${areaList.length} areas · ${surfaceList.length} surfaces`}
        />
        <Fact
          icon={<Package className="size-4" />}
          label="Next move owner"
          value={project.next_move_owner ?? "Unassigned"}
        />
      </div>

      {/* Next move */}
      <SectionCard
        className="mt-5"
        title="Next move"
        icon={<ListChecks className="size-[18px] text-primary" />}
        bodyClassName="px-5 pb-5"
      >
        <p className="text-[14px] font-medium">
          {project.next_move ?? "No next move recorded yet."}
        </p>
        {project.needs_attention ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-danger">
            <TriangleAlert className="size-4" /> {project.needs_attention}
          </p>
        ) : null}
      </SectionCard>

      {/* Three panels */}
      <div className="mt-5 grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-start gap-5">
        <SectionCard
          title="Where the job stands"
          subtitle="Surface progress rolls up to the area, then to the project."
          bodyClassName="divide-y divide-border"
        >
          {areaList.map((a) => (
            <div key={a.id} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] font-semibold">{a.name}</span>
                  <Chip tone={areaStatusTone(a.status)}>{a.status}</Chip>
                </div>
                <span className="text-[12.5px] font-semibold tabular-nums">{a.progress_pct}%</span>
              </div>
              <ProgressBar value={a.progress_pct} className="mt-2" />
              <div className="mt-1.5 text-[11.5px] text-muted-foreground">
                {surfaceList.filter((s) => s.area_id === a.id && s.status === "Complete").length} of{" "}
                {surfaceList.filter((s) => s.area_id === a.id).length} surfaces complete
              </div>
            </div>
          ))}
          {areaList.length === 0 ? (
            <EmptyState
              title="No areas yet"
              note="Areas and surfaces are created during estimating and reused after approval."
            />
          ) : null}
        </SectionCard>

        <SectionCard
          title="Today's site visit"
          icon={<ClipboardCheck className="size-[18px] text-primary" />}
          bodyClassName="space-y-2.5 px-5 pb-5"
        >
          {checklist.map((c) => (
            <Checkbox
              key={c.id}
              checked={c.done}
              strike
              label={c.label}
              onChange={(next) => updateChecklist.mutate({ id: c.id, patch: { done: next } })}
            />
          ))}
          {checklist.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              No visit items yet — add a task or field update below.
            </p>
          ) : null}
        </SectionCard>
      </div>

      {/* Open items */}
      <SectionCard
        className="mt-5"
        title="Open items and next actions"
        badge={<Chip tone={blockers.length ? "red" : "green"}>{open.length} open</Chip>}
      >
        {open.length === 0 ? (
          <EmptyState title="Nothing outstanding" note="Blockers, questions and needs appear here." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Item</Th>
                <Th>Owner</Th>
                <Th>Waiting on</Th>
                <Th>Impact</Th>
                <Th>Next action</Th>
                <Th className="text-right">Resolve</Th>
              </tr>
            </thead>
            <tbody>
              {open.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => setOpenItem(i as unknown as WorkItemRow)}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/50"
                >
                  <Td>
                    <Chip tone={workItemTone(i.item_type)}>{i.item_type}</Chip>
                  </Td>
                  <Td>
                    <div className="font-semibold">{i.title}</div>
                    {i.description ? (
                      <div className="text-muted-foreground">{i.description}</div>
                    ) : null}
                  </Td>
                  <Td>{i.owner ?? "—"}</Td>
                  <Td>{i.waiting_on ?? "—"}</Td>
                  <Td>{i.impact ?? "—"}</Td>
                  <Td>{i.next_action ?? "—"}</Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateItem.mutate({
                          id: i.id,
                          patch: { status: "Complete", completed_at: new Date().toISOString() },
                        });
                      }}
                    >
                      <CheckCircle2 className="size-3.5" /> Resolve
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      {/* Footer quick actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(["Field Update", "Task", "Question", "Punch / Return Item"] as WorkItemKind[]).map((k) => (
          <Button key={k} onClick={() => setCreate(k)}>
            <MessageSquarePlus className="size-4" /> Add {k}
          </Button>
        ))}
        <Button variant="primary" onClick={() => setMaterial(true)}>
          <Package className="size-4" /> Request material
        </Button>
        <Link
          to="/projects/$projectId/scope"
          params={{ projectId }}
          className="ml-auto text-[13px] font-semibold text-primary hover:underline"
        >
          Open Tiles &amp; Finishes →
        </Link>
      </div>

      {create ? (
        <CreateWorkItemModal open onClose={() => setCreate(null)} kind={create} projectId={projectId} />
      ) : null}
      <WorkItemDrawer item={openItem} onClose={() => setOpenItem(null)} />
      <RequestMaterialModal open={material} onClose={() => setMaterial(false)} projectId={projectId} />
    </>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="surface px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-1 truncate text-[13.5px] font-semibold">{value}</div>
    </div>
  );
}
