import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronRight,
  HardHat,
  Layers,
  MessageSquarePlus,
  Package,
  TriangleAlert,
} from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import {
  Button,
  Drawer,
  EmptyState,
  Field,
  TextInput,
  SectionCard,
  TextArea,
} from "@/components/kit";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { WorkList } from "@/components/WorkList";
import { useWorkFeed, type WorkItemRow } from "@/lib/workitems";
import {
  CreateWorkItemModal,
  RequestMaterialModal,
  type WorkItemKind,
} from "@/components/WorkItemDialogs";
import { showsInstallationProgress } from "@/lib/lifecycle";
import {
  useAreasWithSurfaces,
  useProject,
  useUpdateProject,
} from "@/lib/data";
import { useCrews } from "@/lib/data";
import { useProfiles } from "@/lib/people";
import { useCanEditProject } from "@/hooks/useAuth";
import { Chip, areaStatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

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

type FactPanel = "crew" | "dates" | "scope" | "next";

function ProjectOverview() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { areas, surfaces } = useAreasWithSurfaces(projectId);
  const { data: feed = [] } = useWorkFeed();
  const { data: profiles = [] } = useProfiles();
  const { data: crews = [] } = useCrews();
  const { canEdit } = useCanEditProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const [create, setCreate] = useState<WorkItemKind | null>(null);
  const [material, setMaterial] = useState(false);
  const [openItem, setOpenItem] = useState<WorkItemRow | null>(null);
  const [panel, setPanel] = useState<FactPanel | null>(null);

  if (!project) return null;

  const areaList = areas.data ?? [];
  const surfaceList = surfaces.data ?? [];
  const installing = showsInstallationProgress(project.lifecycle_stage);
  const projectWork = feed.filter((i) => i.project_id === projectId);
  const headline = installing ? project.installation_progress : project.readiness_pct;
  const nameOf = (userId?: string | null) =>
    profiles.find((p) => p.user_id === userId)?.full_name ?? null;
  const pmName = nameOf(project.pm_user_id) ?? project.project_manager ?? "Not assigned";
  const siteName = nameOf(project.site_manager_user_id);
  const crewLabel = project.crew_lead ?? siteName ?? "Not assigned";
  const nextOwner = nameOf(project.pm_user_id) ?? project.next_move_owner ?? "Unassigned";

  return (
    <>
      {/* Command bar: progress + the four contextual facts, one viewport band */}
      <section className="surface px-6 py-5">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {installing ? "Overall installation progress" : "Setup & readiness completion"}
            </div>
            <div className="mt-1 flex items-end gap-2.5">
              <span className="text-[32px] leading-none font-semibold tracking-[-0.02em]">
                {headline}%
              </span>
              <span className="pb-1 text-[13px] text-muted-foreground">
                {installing
                  ? `${surfaceList.filter((s) => s.status === "Complete").length} of ${surfaceList.length} surfaces complete`
                  : (project.readiness_note ?? "Readiness explains what is still outstanding.")}
              </span>
            </div>
          </div>
        </div>
        <ProgressBar value={headline} className="mt-3.5" />
        {!installing ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Installation progress stays hidden until the project reaches Installation.
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-4 gap-3 border-t border-border pt-4">
          <Fact
            icon={<HardHat className="size-4" />}
            label="Crew"
            value={crewLabel}
            onClick={() => setPanel("crew")}
          />
          <Fact
            icon={<CalendarDays className="size-4" />}
            label="Dates"
            value={
              project.start_date || project.target_date
                ? `${project.start_date ?? "—"} → ${project.target_date ?? "—"}`
                : "Not scheduled"
            }
            onClick={() => setPanel("dates")}
          />
          <Fact
            icon={<Layers className="size-4" />}
            label="Scope"
            value={`${areaList.length} areas · ${surfaceList.length} surfaces`}
            onClick={() => setPanel("scope")}
          />
          <Fact
            icon={<Layers className="size-4" />}
            label="Next move owner"
            value={nextOwner}
            onClick={() => setPanel("next")}
          />
        </div>
      </section>

      {/* Next move */}
      <button
        type="button"
        onClick={() => setPanel("next")}
        className="surface mt-4 block w-full cursor-pointer px-5 py-4 text-left transition-colors hover:border-border-strong hover:bg-muted/40"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Next move
            </div>
            <p className="mt-1 text-[14px] font-medium">
              {project.next_move ?? "No next move recorded yet."}
            </p>
            {project.needs_attention ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-danger">
                <TriangleAlert className="size-4 shrink-0" /> {project.needs_attention}
              </p>
            ) : null}
          </div>
          <ChevronRight className="mt-4 size-4 shrink-0 text-muted-foreground" />
        </div>
      </button>

      {/* Where the job stands */}
      <div className="mt-4">
        <SectionCard
          title="Area status"
          subtitle="Surface progress rolls up to the area, then to the project."
          bodyClassName="divide-y divide-border"
        >
          {areaList.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-5 py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-[13px] font-semibold">{a.name}</span>
                <Chip tone={areaStatusTone(a.status)}>{a.status}</Chip>
              </div>
              <ProgressBar value={a.progress_pct} className="w-[38%]" />
              <span className="w-9 text-right text-[12.5px] font-semibold tabular-nums">
                {a.progress_pct}%
              </span>
            </div>
          ))}
          {areaList.length === 0 ? (
            <EmptyState
              title="No areas yet"
              note="Areas and surfaces are created during estimating and reused after approval."
            />
          ) : null}
        </SectionCard>
      </div>

      {/* Open Work — the same work_items records as Company Work and Today. */}
      <section className="mt-4">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Open Work</h2>
            <p className="text-[12.5px] text-muted-foreground">
              The same records the company board and Today use. Completed work stays under the
              Completed filter.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCreate("Task")}>
              <MessageSquarePlus className="size-4" /> Add work item
            </Button>
            <Button size="sm" onClick={() => setMaterial(true)}>
              <Package className="size-4" /> Request material
            </Button>
          </div>
        </div>
        <WorkList
          items={projectWork}
          onOpen={setOpenItem}
          showProjectColumn={false}
          showViewToggle={false}
          showSearch={false}
          emptyTitle="Nothing open on this project"
          emptyNote="Use Add work item or Quick Capture to log what came in from the field."
        />
      </section>

      {/* Contextual fact drawers */}
      <Drawer
        open={panel === "crew"}
        onClose={() => setPanel(null)}
        title="Crew & ownership"
        subtitle={project.name}
      >
        <div className="space-y-4">
          <Field label="Crew lead">
            <TextInput
              defaultValue={project.crew_lead ?? ""}
              placeholder="Crew lead"
              disabled={!canEdit}
              onBlur={(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                canEdit && updateProject.mutate({ crew_lead: e.target.value || null })
              }
            />
          </Field>
          <ReadRow label="Project manager" value={pmName} />
          <ReadRow label="Site manager" value={siteName ?? "Not assigned"} />
          <div>
            <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Configured crews
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {crews.map((c) => (
                <Chip key={c.id}>{c.name}</Chip>
              ))}
              {crews.length === 0 ? (
                <span className="text-[12.5px] text-muted-foreground">
                  No crews configured yet — add them in Settings.
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Drawer>

      <Drawer
        open={panel === "dates"}
        onClose={() => setPanel(null)}
        title="Dates"
        subtitle={project.name}
      >
        <div className="space-y-4">
          <Field label="Start date">
            <TextInput
              type="date"
              defaultValue={project.start_date ?? ""}
              disabled={!canEdit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                canEdit && updateProject.mutate({ start_date: e.target.value || null })
              }
            />
          </Field>
          <Field label="Target completion">
            <TextInput
              type="date"
              defaultValue={project.target_date ?? ""}
              disabled={!canEdit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                canEdit && updateProject.mutate({ target_date: e.target.value || null })
              }
            />
          </Field>
          <Link
            to="/schedule"
            className="inline-block text-[13px] font-semibold text-primary hover:underline"
          >
            Open the weekly crew schedule →
          </Link>
        </div>
      </Drawer>

      <Drawer
        open={panel === "scope"}
        onClose={() => setPanel(null)}
        title="Scope"
        subtitle={`${areaList.length} areas · ${surfaceList.length} surfaces`}
      >
        <div className="space-y-4">
          {areaList.map((a) => (
            <div key={a.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold">{a.name}</span>
                <Chip tone={areaStatusTone(a.status)}>{a.status}</Chip>
              </div>
              <ul className="mt-1.5 space-y-1">
                {surfaceList
                  .filter((s) => s.area_id === a.id)
                  .map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 text-[12.5px] text-secondary-foreground"
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="tabular-nums text-muted-foreground">{s.progress_pct}%</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <Link
            to="/projects/$projectId/scope"
            params={{ projectId }}
            className="inline-block text-[13px] font-semibold text-primary hover:underline"
          >
            Open Tiles &amp; Finishes →
          </Link>
        </div>
      </Drawer>

      <Drawer
        open={panel === "next"}
        onClose={() => setPanel(null)}
        title="Next move"
        subtitle={project.name}
      >
        <div className="space-y-4">
          <Field label="Next move">
            <TextArea
              rows={3}
              defaultValue={project.next_move ?? ""}
              disabled={!canEdit}
              onBlur={(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                canEdit && updateProject.mutate({ next_move: e.target.value || null })
              }
            />
          </Field>
          <Field label="Needs attention">
            <TextArea
              rows={2}
              defaultValue={project.needs_attention ?? ""}
              disabled={!canEdit}
              onBlur={(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                canEdit && updateProject.mutate({ needs_attention: e.target.value || null })
              }
            />
          </Field>
          <ReadRow label="Owner" value={nextOwner} />
          {!canEdit ? (
            <p className="text-[12px] text-muted-foreground">
              You have read-only access to this project.
            </p>
          ) : null}
        </div>
      </Drawer>

      {create ? (
        <CreateWorkItemModal
          open
          onClose={() => setCreate(null)}
          kind={create}
          projectId={projectId}
        />
      ) : null}
      <WorkItemDrawer item={openItem} onClose={() => setOpenItem(null)} />
      <RequestMaterialModal
        open={material}
        onClose={() => setMaterial(false)}
        projectId={projectId}
      />
    </>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-semibold">{value}</span>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-border bg-background px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-muted/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {label}
        </span>
        <ChevronRight className="size-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-1 truncate text-[13.5px] font-semibold">{value}</div>
    </button>
  );
}
