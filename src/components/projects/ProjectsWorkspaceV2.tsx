import { Link } from "@tanstack/react-router";
import { AlertTriangle, Plus, Search } from "lucide-react";
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
    <main className="min-h-dvh bg-background md:min-h-screen">
      <header className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-card px-4 py-3 md:grid-cols-[minmax(180px,1fr)_minmax(240px,420px)_150px_auto] md:px-7">
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

      <section aria-label="Project operations list" className="min-w-0 bg-card">
        <div className="hidden min-h-10 grid-cols-[26fr_12fr_31fr_13fr_10fr_8fr] items-center gap-4 border-b border-border px-6 text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase md:grid md:px-7">
          <span>Project</span><span>Stage</span><span>Next move</span><span>Crew / owner</span><span>Relevant date</span><span>Attention</span>
        </div>
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
    <>
      <div className="relative hidden border-b border-border bg-card transition-colors duration-150 hover:bg-muted/60 md:block">
        <Link to="/projects/$projectId" params={{ projectId: project.id }} className="grid min-h-[66px] grid-cols-[26fr_12fr_31fr_13fr_10fr_8fr] items-center gap-4 px-6 pr-14 py-2.5 outline-none focus-visible:bg-primary-soft md:px-7 md:pr-16">
        <div className="min-w-0">
          <h2 className="truncate font-display text-[16px] font-bold">{project.name}</h2>
          <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{identity}</p>
        </div>
        <p className="flex min-w-0 items-center gap-2 truncate text-[11.5px] font-semibold"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} /><span className="truncate">{stage}</span></p>
        <div className="min-w-0">
          <p className={cn("line-clamp-2 text-[13.5px] leading-snug font-semibold", !next && "font-medium text-muted-foreground")}>{next?.title ?? "No current action"}</p>
        </div>
        <p className="truncate text-[11.5px] font-semibold">{project.crew_lead ?? project.next_move_owner ?? next?.owner ?? "—"}</p>
        <p className="text-[11.5px] text-muted-foreground">{relevantDate ? formatDate(relevantDate) : "—"}</p>
        <p className={cn("min-w-0 truncate text-[11.5px] font-semibold", attention ? "text-warning" : "text-muted-foreground")}>{attention ?? "—"}</p>
        </Link>
        <div className="absolute top-1/2 right-3 -translate-y-1/2"><ProjectMoreMenu project={project} compact onStatusUpdate={onStatusUpdate} /></div>
      </div>

      <Link to="/projects/$projectId" params={{ projectId: project.id }} className="block border-b border-border bg-card px-4 py-4 transition-colors active:bg-primary-soft md:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <h2 className="truncate font-display text-[15px] font-bold">{project.name}</h2>
          <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] font-semibold"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} />{stage}</span>
        </div>
        <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{identity}</p>
        <p className="mt-2.5 line-clamp-2 text-[13px] leading-snug font-semibold">{next?.title ?? "No current action"}</p>
        {attention ? <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-warning"><AlertTriangle className="size-3.5 shrink-0" /><span className="truncate">{attention}</span></p> : null}
        <p className="mt-2 text-[11px] text-muted-foreground">{project.crew_lead ?? project.next_move_owner ?? next?.owner ?? "Unassigned"} · {relevantDate ? formatDate(relevantDate) : "—"}</p>
      </Link>
    </>
  );
}

function QueueMessage({ children }: { children: ReactNode }) { return <div className="px-6 py-16 text-center text-[13px] text-muted-foreground">{children}</div>; }
function formatDate(date: string) { return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }