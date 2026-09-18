import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, ChevronRight, FolderKanban, Plus, Search, UserRound } from "lucide-react";
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
        <Select
          aria-label="Project status"
          value={filter}
          onChange={(event) => onFilter(event.target.value as ProjectView)}
          className="col-span-2 md:col-span-1"
        >
          {(["Active", "Upcoming", "On Hold", "Completed"] as ProjectView[]).map((view) => (
            <option key={view}>{view}</option>
          ))}
        </Select>
        <Button variant="primary" onClick={() => onCreating(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">New Project</span>
          <span className="sm:hidden">New</span>
        </Button>
      </header>

      <section aria-label="Project portfolio" className="workspace-panel min-w-0 overflow-hidden">
        {loading ? (
          <QueueMessage>Loading projects…</QueueMessage>
        ) : jobs.length === 0 ? (
          <QueueMessage>No projects in this view.</QueueMessage>
        ) : (
          jobs.map((job) => (
            <ProjectQueueItem
              key={job.project.id}
              job={job}
              onStatusUpdate={() => onStatusProject(job.project)}
            />
          ))
        )}
      </section>

      <NewProjectModal open={creating} onClose={() => onCreating(false)} />
      {statusProject ? (
        <ProjectStatusUpdateSheet project={statusProject} onClose={() => onStatusProject(null)} />
      ) : null}
    </main>
  );
}

function ProjectQueueItem({
  job,
  onStatusUpdate,
}: {
  job: ProjectQueueRecord;
  onStatusUpdate: () => void;
}) {
  const { project, next, attention, relevantDate } = job;
  const identity =
    [project.address, project.customer].filter(Boolean).join(" · ") || project.project_type;
  const stage = project.exception_state ?? normalizeStage(project.lifecycle_stage);
  return (
    <article className="group relative min-w-0 border-b border-border/70 last:border-b-0 transition-all hover:bg-primary-soft/30 focus-within:bg-primary-soft/40">
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        className="grid min-h-[96px] min-w-0 grid-cols-[44px_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-4 pr-12 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 md:grid-cols-[44px_minmax(190px,1.15fr)_minmax(240px,1.25fr)_minmax(150px,.7fr)_110px] md:items-center md:gap-4 md:px-5 md:pr-14"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary-soft text-primary shadow-[var(--shadow-card)]"><FolderKanban className="size-5" /></span>
        <div className="min-w-0">
          <h2 className="truncate font-display text-[16px] font-bold">{project.name}</h2>
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{identity}</p>
          <p className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-neutral-chip px-2.5 py-1 text-[10.5px] font-bold text-secondary-foreground md:mt-1.5"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} /><span className="truncate">{stage}</span></p>
        </div>
        <div className="col-span-2 min-w-0 rounded-lg border border-border bg-background/70 px-3 py-2 md:col-span-1 md:border-l-2 md:border-y-0 md:border-r-0 md:bg-transparent md:px-4 md:py-1">
          <p className="text-[9.5px] font-bold text-muted-foreground uppercase">
            Next move
          </p>
          <p
            className={cn(
              "truncate text-[13px] font-semibold",
              !next && "font-medium text-muted-foreground",
            )}
          >
            {next?.title ?? "No current action"}
          </p>
        </div>
        <p className="col-span-2 flex min-w-0 items-center gap-2 truncate text-[11.5px] text-muted-foreground md:col-span-1">
          <UserRound className="size-3.5 shrink-0" /> {project.crew_lead ?? project.next_move_owner ?? next?.owner ?? "Unassigned"}
        </p>
        <p className="col-span-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground md:col-span-1 md:justify-end">
          <CalendarDays className="size-3.5 shrink-0" />
          {relevantDate ? formatDate(relevantDate) : "No date"}
        </p>
        {attention ? (
          <p className="col-span-2 flex min-w-0 items-center gap-1.5 truncate rounded-lg bg-warning-soft px-2.5 py-1.5 text-[11.5px] font-semibold text-warning md:col-start-3 md:col-end-6">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span className="truncate">{attention}</span>
          </p>
        ) : null}
        <ChevronRight className="absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
      <div className="absolute right-2 bottom-2 md:top-1/2 md:bottom-auto md:-translate-y-1/2">
        <ProjectMoreMenu project={project} compact onStatusUpdate={onStatusUpdate} />
      </div>
    </article>
  );
}

function QueueMessage({ children }: { children: ReactNode }) {
  return <div className="px-6 py-16 text-center text-[13px] text-muted-foreground">{children}</div>;
}
function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
