import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardCheck,
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
import { FieldReportSheet } from "@/components/FieldReportSheet";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { WorkList } from "@/components/WorkList";
import { useFieldReports } from "@/lib/fieldreports";
import {
  compareWorkItems,
  isComplete,
  matchesTodayFilter,
  TODAY_FILTERS,
  useWorkFeed,
  type WorkItemRow,
} from "@/lib/workitems";

import {
  CreateWorkItemModal,
  RequestMaterialModal,
  type WorkItemKind,
} from "@/components/WorkItemDialogs";
import { showsInstallationProgress } from "@/lib/lifecycle";
import { useAreasWithSurfaces, useProject, useUpdateProject } from "@/lib/data";
import { useCrews } from "@/lib/data";
import { useProfiles } from "@/lib/people";
import { useCanEditProject } from "@/hooks/useAuth";
import { Chip, areaStatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$projectId/")({
  head: () => ({
    meta: [
      { title: "Project Overview — Cobblestone Job Operations" },
      {
        name: "description",
        content:
          "Where the project is up to: lifecycle stage, readiness, blockers, crew, dates and the next move.",
      },
      { property: "og:title", content: "Project Overview — Cobblestone Job Operations" },
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
  const [report, setReport] = useState(false);
  const { data: reports = [] } = useFieldReports(projectId);
  const latestReport = reports[0] ?? null;

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
  const leadWork = [...projectWork.filter((i) => !isComplete(i))].sort(compareWorkItems)[0] ?? null;
  const openCount = projectWork.filter((i) => !isComplete(i)).length;

  return (
    <>
      {/* Readiness band: where the job stands and the facts people edit. */}
      <section className="surface px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold whitespace-nowrap">
              {installing ? "Installing" : "Getting ready"}
            </span>
            <span className="text-[15px] font-bold tabular-nums">{headline}%</span>
          </div>
          <ProgressBar value={headline} className="min-w-[120px] flex-1" />
          <span className="text-[12.5px] whitespace-nowrap text-muted-foreground">
            {openCount} open action{openCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4 md:grid-cols-4 md:gap-3">
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
                ? `${fmt(project.start_date)} → ${fmt(project.target_date)}`
                : "Not scheduled"
            }
            onClick={() => setPanel("dates")}
          />
          <Fact
            icon={<Layers className="size-4" />}
            label="Rooms"
            value={`${areaList.length} areas · ${surfaceList.length} surfaces`}
            onClick={() => setPanel("scope")}
          />
          <Fact
            icon={<MessageSquarePlus className="size-4" />}
            label="Next move owner"
            value={nextOwner}
            onClick={() => setPanel("next")}
          />
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Next move */}
        <button
          type="button"
          onClick={() => setPanel("next")}
          className="surface block w-full cursor-pointer px-4 py-4 text-left transition-colors hover:border-border-strong hover:bg-muted/30 md:px-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Next move
              </div>
              <p className="mt-1.5 text-[15px] font-medium leading-snug">
                {leadWork ? leadWork.title : "No open work"}
              </p>
              {leadWork ? (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-secondary-foreground">
                  {leadWork.is_important ? (
                    <TriangleAlert className="size-4 shrink-0 text-danger" />
                  ) : null}
                  {[leadWork.next_action, leadWork.owner].filter(Boolean).join(" · ") ||
                    leadWork.status}
                  {openCount > 1 ? ` · +${openCount - 1} other open items` : ""}
                </p>
              ) : null}
            </div>
          </div>
        </button>

        {/* Latest Daily Update */}
        <section className="surface px-4 py-4 md:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Latest Daily Update
              </div>
              {latestReport ? (
                <>
                  <p className="mt-1.5 text-[13.5px] font-medium leading-snug">
                    {latestReport.progress_note ?? "Report submitted with no progress note."}
                  </p>
                  <p className="mt-1.5 text-[12px] text-muted-foreground">
                    {[
                      fmt(latestReport.report_date),
                      latestReport.crew_label,
                      latestReport.worker_count ? `${latestReport.worker_count} on site` : null,
                      latestReport.areas_worked,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {latestReport.blockers ? (
                    <p className="mt-1.5 inline-flex items-start gap-1.5 text-[12.5px] text-danger">
                      <TriangleAlert className="mt-px size-4 shrink-0" />
                      {latestReport.blockers}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-[13px] text-muted-foreground">
                  No Daily Updates yet on this job.
                </p>
              )}
            </div>
            <Button size="sm" variant="primary" onClick={() => setReport(true)}>
              <ClipboardCheck className="size-4" /> Daily update
            </Button>
          </div>
        </section>
      </div>

      {/* Open Work */}
      <section className="mt-4">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Open Work</h2>
            <p className="text-[12.5px] text-muted-foreground">
              The same records the company board and Today use.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setCreate("Task")}>
              <MessageSquarePlus className="size-4" /> Add task
            </Button>
            <Button size="sm" onClick={() => setMaterial(true)}>
              <Package className="size-4" /> Request material
            </Button>
          </div>
        </div>
        <WorkList
          items={projectWork}
          onOpen={setOpenItem}
          selectedId={openItem?.id ?? null}
          filters={TODAY_FILTERS}
          matchFilter={matchesTodayFilter}
          defaultFilter="Active"
          showProjectColumn={false}
          showViewToggle={false}
          showSearch={false}
          emptyTitle="Nothing open on this project"
          emptyNote="Use Add task or Quick Capture to log what came in from the field."
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
        title="Rooms"
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
            Open Rooms →
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
      {report ? (
        <FieldReportSheet
          projectId={projectId}
          projectName={project.name}
          onClose={() => setReport(false)}
          defaultCrewId={null}
        />
      ) : null}
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
      className="group rounded-xl border border-border bg-background px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-muted/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          <span className="text-primary">{icon}</span>
          {label}
        </span>
      </div>
      <div className="mt-1 truncate text-[13.5px] font-semibold">{value}</div>
    </button>
  );
}

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
