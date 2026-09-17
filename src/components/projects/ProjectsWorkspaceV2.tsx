import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CalendarDays, MapPin, Plus, Search, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { NewProjectModal } from "@/components/NewProjectModal";
import { ProjectMoreMenu } from "@/components/ProjectMoreMenu";
import { ProjectStatusUpdateSheet } from "@/components/ProjectStatusUpdateSheet";
import { Button, Select } from "@/components/kit";
import type { Project, ScheduleAssignment } from "@/lib/data";
import type { FieldReport } from "@/lib/fieldreports";
import { normalizeStage } from "@/lib/lifecycle";
import { Dot, stageTone } from "@/lib/status";
import type { WorkItemRow } from "@/lib/workitems";
import { cn } from "@/lib/utils";

export type ProjectQueueRecord = {
  project: Project;
  work: WorkItemRow[];
  next: WorkItemRow | undefined;
  attention: string | null;
  relevantDate: string | null;
  upcoming: ScheduleAssignment | undefined;
  latestReport: FieldReport | undefined;
};

type ProjectView = "Active" | "Upcoming" | "On Hold" | "Completed";

export function ProjectsWorkspaceV2({
  jobs,
  activeCount,
  loading,
  search,
  filter,
  selectedId,
  creating,
  statusProject,
  onSearch,
  onFilter,
  onSelect,
  onCreating,
  onStatusProject,
}: {
  jobs: ProjectQueueRecord[];
  activeCount: number;
  loading: boolean;
  search: string;
  filter: ProjectView;
  selectedId: string | null;
  creating: boolean;
  statusProject: Project | null;
  onSearch: (value: string) => void;
  onFilter: (value: ProjectView) => void;
  onSelect: (id: string) => void;
  onCreating: (open: boolean) => void;
  onStatusProject: (project: Project | null) => void;
}) {
  const selected = jobs.find((job) => job.project.id === selectedId) ?? jobs[0];

  return (
    <main className="min-h-dvh bg-background md:min-h-screen">
      <header className="grid h-[68px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-card px-4 md:px-7">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="truncate font-display text-[24px] font-bold md:text-[28px]">Projects</h1>
          <span className="shrink-0 text-[12px] text-muted-foreground">{activeCount} active</span>
        </div>
        <Button variant="primary" onClick={() => onCreating(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">New Project</span>
          <span className="sm:hidden">New</span>
        </Button>
      </header>

      <div className="grid min-h-[58px] gap-2 border-b border-border bg-card px-4 py-2.5 sm:grid-cols-[minmax(0,520px)_160px] sm:items-center sm:gap-3 md:px-7">
        <label className="relative min-w-0">
          <span className="sr-only">Search projects</span>
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search projects"
            className="h-9 w-full rounded-md border border-border bg-card pr-3 pl-9 text-[13px] outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <Select aria-label="Project status" value={filter} onChange={(event) => onFilter(event.target.value as ProjectView)}>
          {(["Active", "Upcoming", "On Hold", "Completed"] as ProjectView[]).map((view) => <option key={view}>{view}</option>)}
        </Select>
      </div>

      <div className="min-[1360px]:grid min-[1360px]:min-h-[calc(100dvh-126px)] min-[1360px]:grid-cols-[64fr_36fr]">
        <section aria-label="Project operations queue" className="min-w-0 bg-card min-[1360px]:border-r min-[1360px]:border-border">
          {loading ? <QueueMessage>Loading projects…</QueueMessage> : jobs.length === 0 ? <QueueMessage>No projects in this view.</QueueMessage> : jobs.map((job) => (
            <ProjectQueueItem key={job.project.id} job={job} selected={job.project.id === selected?.project.id} onSelect={() => onSelect(job.project.id)} />
          ))}
        </section>

        <aside aria-label="Selected project inspector" className="sticky top-0 hidden h-[calc(100dvh-126px)] overflow-y-auto bg-card min-[1360px]:block">
          {selected ? <ProjectInspector job={selected} onUpdate={() => onStatusProject(selected.project)} /> : <QueueMessage>Select a project to inspect it.</QueueMessage>}
        </aside>
      </div>

      <NewProjectModal open={creating} onClose={() => onCreating(false)} />
      {statusProject ? <ProjectStatusUpdateSheet project={statusProject} onClose={() => onStatusProject(null)} /> : null}
    </main>
  );
}

function ProjectQueueItem({ job, selected, onSelect }: { job: ProjectQueueRecord; selected: boolean; onSelect: () => void }) {
  const { project, next, attention, relevantDate } = job;
  const identity = [project.address, project.customer].filter(Boolean).join(" · ") || project.project_type;
  const stage = project.exception_state ?? normalizeStage(project.lifecycle_stage);
  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "hidden min-h-[98px] w-full cursor-pointer grid-cols-[32fr_50fr_18fr] items-center gap-5 border-b border-border px-6 py-4 text-left outline-none transition-colors duration-150 md:grid min-[1360px]:px-7",
          selected ? "bg-primary-soft" : "bg-card hover:bg-muted/60",
        )}
      >
        <div className="min-w-0">
          <h2 className="truncate font-display text-[16px] font-bold">{project.name}</h2>
          <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{identity}</p>
          <p className="mt-2 flex items-center gap-2 text-[11.5px] font-semibold"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} />{stage}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">Next move</p>
          <p className={cn("mt-1 line-clamp-2 text-[14px] leading-snug font-semibold", !next && "font-medium text-muted-foreground")}>{next?.title ?? "No current action"}</p>
          {attention ? <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-warning"><AlertTriangle className="size-3.5 shrink-0" /><span className="truncate">{attention}</span></p> : null}
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate text-[11.5px] font-semibold">{project.crew_lead ?? project.next_move_owner ?? next?.owner ?? "—"}</p>
          <p className="mt-2 text-[11.5px] text-muted-foreground">{relevantDate ? formatDate(relevantDate) : "—"}</p>
        </div>
      </button>

      <Link to="/projects/$projectId" params={{ projectId: project.id }} className="block border-b border-border bg-card px-4 py-4 transition-colors active:bg-primary-soft md:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <h2 className="truncate font-display text-[15px] font-bold">{project.name}</h2>
          <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] font-semibold"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} />{stage}</span>
        </div>
        <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{identity}</p>
        <p className="mt-3 line-clamp-2 text-[13px] leading-snug font-semibold">{next?.title ?? "No current action"}</p>
        {attention ? <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-warning"><AlertTriangle className="size-3.5 shrink-0" /><span className="truncate">{attention}</span></p> : null}
        <p className="mt-2 text-[11px] text-muted-foreground">{project.crew_lead ?? project.next_move_owner ?? next?.owner ?? "Unassigned"} · {relevantDate ? formatDate(relevantDate) : "—"}</p>
      </Link>
    </>
  );
}

function ProjectInspector({ job, onUpdate }: { job: ProjectQueueRecord; onUpdate: () => void }) {
  const navigate = useNavigate();
  const { project, work, next, attention, upcoming, latestReport } = job;
  const blockers = work.filter((item) => item.status === "Waiting" || Boolean(item.waiting_on)).slice(0, 2);
  const readiness = project.readiness_note || (project.readiness_pct >= 100 ? "Ready for the next stage." : "Readiness has not been evaluated.");
  const latestUpdate = latestReport?.progress_note ?? latestReport?.next_work ?? latestReport?.blockers ?? latestReport?.notes;

  return (
    <div className="flex min-h-full flex-col px-7 py-7">
      <div className="border-b border-border pb-6">
        <p className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">Selected project</p>
        <h2 className="mt-2 font-display text-[24px] leading-tight font-bold">{project.name}</h2>
        <p className="mt-2 flex items-start gap-2 text-[12px] text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" />{project.address ?? project.customer ?? project.project_type}</p>
        <p className="mt-4 flex items-center gap-2 text-[12px] font-semibold"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} />{project.exception_state ?? normalizeStage(project.lifecycle_stage)}</p>
      </div>

      <section className="border-b border-border py-6">
        <InspectorLabel>Next move</InspectorLabel>
        <p className="mt-2 text-[18px] leading-snug font-bold">{next?.title ?? "No current action"}</p>
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><UserRound className="size-3.5" />{next?.owner ?? project.next_move_owner ?? project.crew_lead ?? "Unassigned"}</p>
      </section>

      <InspectorSection label="Waiting / blocked">
        {blockers.length ? blockers.map((item) => <div key={item.id} className="not-last:mb-3"><p className="font-semibold text-foreground">{item.title}</p><p className="mt-0.5 text-warning">{item.waiting_on ? `Waiting on ${item.waiting_on}` : "Waiting"}</p></div>) : <p className={attention ? "font-semibold text-warning" : "text-muted-foreground"}>{attention ?? "Nothing currently blocking work."}</p>}
      </InspectorSection>
      <InspectorSection label="Upcoming">
        {upcoming ? <><p className="font-semibold text-foreground">{upcoming.kind}</p><p className="mt-1 flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="size-3.5" />{formatDate(upcoming.work_date)}{upcoming.notes ? ` · ${upcoming.notes}` : ""}</p></> : <p className="text-muted-foreground">Nothing scheduled.</p>}
      </InspectorSection>
      <InspectorSection label="Readiness"><p className="font-semibold text-foreground">{project.readiness_pct >= 100 ? "Ready" : "Not ready"}</p><p className="mt-1 text-muted-foreground">{readiness}</p></InspectorSection>
      <InspectorSection label="Latest update"><p className={latestUpdate ? "text-foreground" : "text-muted-foreground"}>{latestUpdate ?? "No field update recorded."}</p>{latestReport ? <p className="mt-1 text-[11px] text-muted-foreground">{latestReport.submitted_by_name ?? "Team"} · {formatDate(latestReport.report_date)}</p> : null}</InspectorSection>

      <div className="mt-auto flex items-center gap-2 border-t border-border pt-5">
        <Button variant="primary" className="flex-1" onClick={() => navigate({ to: "/projects/$projectId", params: { projectId: project.id } })}>Open Project <ArrowRight className="size-4" /></Button>
        <Button onClick={onUpdate}>Update</Button>
        <ProjectMoreMenu project={project} compact onStatusUpdate={onUpdate} />
      </div>
    </div>
  );
}

function InspectorLabel({ children }: { children: ReactNode }) { return <p className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{children}</p>; }
function InspectorSection({ label, children }: { label: string; children: ReactNode }) { return <section className="border-b border-border py-5 text-[13px] leading-relaxed"><InspectorLabel>{label}</InspectorLabel><div className="mt-2">{children}</div></section>; }
function QueueMessage({ children }: { children: ReactNode }) { return <div className="px-6 py-16 text-center text-[13px] text-muted-foreground">{children}</div>; }
function formatDate(date: string) { return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }