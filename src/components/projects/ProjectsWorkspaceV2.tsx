import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, CalendarDays, Plus, Search } from "lucide-react";
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
  selectedId: _selectedId,
  creating,
  statusProject,
  onSearch,
  onFilter,
  onSelect: _onSelect,
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
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1480px] px-4 pb-28 md:min-h-screen md:px-7 md:pb-10">
      <header className="grid min-h-[82px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 md:grid-cols-[minmax(180px,1fr)_minmax(240px,420px)_150px_auto] md:py-5">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="truncate font-display text-[24px] font-bold md:text-[28px]">Projects</h1>
          <span className="shrink-0 text-[12px] text-muted-foreground">{activeCount} active</span>
        </div>
        <label className="relative col-span-2 min-w-0 md:col-span-1">
          <span className="sr-only">Search projects</span>
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search projects"
            className="h-9 w-full rounded-md border border-border bg-card pr-3 pl-9 text-[13px] outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <Select aria-label="Project status" value={filter} onChange={(event) => onFilter(event.target.value as ProjectView)} className="col-span-2 md:col-span-1">
          {(["Active", "Upcoming", "On Hold", "Completed"] as ProjectView[]).map((view) => <option key={view}>{view}</option>)}
        </Select>
        <Button variant="primary" onClick={() => onCreating(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">New Project</span>
          <span className="sm:hidden">New</span>
        </Button>
      </header>

      <section aria-label="Project portfolio" className="workspace-panel min-w-0 overflow-hidden">
          {!loading && jobs.length ? (
            <div className="hidden grid-cols-[minmax(190px,1.2fr)_120px_minmax(220px,1.5fr)_140px_110px] gap-4 border-b border-border bg-muted/45 px-5 py-2.5 pr-12 text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase md:grid">
              <span>Project</span><span>Stage</span><span>Next move</span><span>Crew / owner</span><span className="text-right">Relevant date</span>
            </div>
          ) : null}
          {loading ? <QueueMessage>Loading projects…</QueueMessage> : jobs.length === 0 ? <QueueMessage>No projects in this view.</QueueMessage> : jobs.map((job) => (
            <ProjectQueueItem key={job.project.id} job={job} onStatusUpdate={() => onStatusProject(job.project)} />
          ))}
      </section>

      <NewProjectModal open={creating} onClose={() => onCreating(false)} />
      {statusProject ? <ProjectStatusUpdateSheet project={statusProject} onClose={() => onStatusProject(null)} /> : null}
    </main>
  );
}

function ProjectQueueItem({ job, onStatusUpdate }: { job: ProjectQueueRecord; onStatusUpdate: () => void }) {
  const { project, next, attention, relevantDate } = job;
  const identity = [project.address, project.customer].filter(Boolean).join(" · ") || project.project_type;
  const stage = project.exception_state ?? normalizeStage(project.lifecycle_stage);
  return (
    <article className="group relative min-w-0 border-b border-border last:border-b-0 transition-colors hover:bg-muted/45 focus-within:bg-primary-soft/50">
      <Link to="/projects/$projectId" params={{ projectId: project.id }} className="grid min-h-[76px] min-w-0 gap-2 px-4 py-3 pr-12 outline-none md:grid-cols-[minmax(190px,1.2fr)_120px_minmax(220px,1.5fr)_140px_110px] md:items-center md:gap-4 md:px-5 md:pr-12">
        <div className="min-w-0"><h2 className="truncate font-display text-[15px] font-bold">{project.name}</h2><p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{identity}</p></div>
        <p className="flex min-w-0 items-center gap-2 truncate text-[11.5px] font-semibold"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} /><span className="truncate">{stage}</span></p>
        <div className="min-w-0"><p className="text-[9.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase md:hidden">Next move</p><p className={cn("truncate text-[13px] font-semibold", !next && "font-medium text-muted-foreground")}>{next?.title ?? "No current action"}</p></div>
        <p className="truncate text-[11.5px] text-muted-foreground">{project.crew_lead ?? project.next_move_owner ?? next?.owner ?? "Unassigned"}</p>
        <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground md:justify-end"><CalendarDays className="size-3.5 shrink-0" />{relevantDate ? formatDate(relevantDate) : "No date"}</p>
        {attention ? <p className="flex min-w-0 items-center gap-1.5 truncate text-[11.5px] font-semibold text-warning md:col-span-5"><AlertTriangle className="size-3.5 shrink-0" /><span className="truncate">{attention}</span></p> : null}
        <ArrowUpRight className="absolute top-5 right-4 size-4 text-muted-foreground transition-colors group-hover:text-primary" />
      </Link>
      <div className="absolute right-2 bottom-2 md:top-1/2 md:bottom-auto md:-translate-y-1/2"><ProjectMoreMenu project={project} compact onStatusUpdate={onStatusUpdate} /></div>
    </article>
  );
}

function QueueMessage({ children }: { children: ReactNode }) { return <div className="px-6 py-16 text-center text-[13px] text-muted-foreground">{children}</div>; }
function formatDate(date: string) { return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }