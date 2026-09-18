import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  FolderKanban,
  Hammer,
  Layers3,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { NewProjectModal } from "@/components/NewProjectModal";
import { ProjectMoreMenu } from "@/components/ProjectMoreMenu";
import { ProjectStatusUpdateSheet } from "@/components/ProjectStatusUpdateSheet";
import { ProjectQuickViewDialog } from "@/components/projects/ProjectQuickViewDialog";
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
  const selectedJob = jobs.find((job) => job.project.id === selectedId) ?? null;
  const [readiness, setReadiness] = useState<"All" | "Ready" | "Partial" | "Not ready">("All");

  const visible = jobs.filter((job) => {
    if (readiness === "All") return true;
    const pct = job.project.readiness_pct ?? 0;
    if (readiness === "Ready") return pct >= 100;
    if (readiness === "Partial") return pct > 0 && pct < 100;
    return pct <= 0;
  });

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1480px] px-4 pb-28 md:min-h-screen md:px-7 md:pb-10">
      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-gradient-to-br from-primary-soft/55 to-transparent px-4 py-5 md:px-6">
          <div className="min-w-0">
            <p className="v2-kicker mb-1">Project directory</p>
            <h1 className="truncate text-[26px] leading-tight font-bold md:text-[34px]">
              Projects
            </h1>
            <p className="mt-1 truncate text-[12px] text-muted-foreground">
              {visible.length} shown · {activeCount} active
            </p>
          </div>
          <Button variant="primary" onClick={() => onCreating(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden">New</span>
          </Button>
        </header>
        <div className="grid gap-2.5 bg-muted/30 p-3 sm:grid-cols-[minmax(180px,1fr)_auto_auto] sm:items-center md:px-4">
          <label className="relative min-w-0">
            <span className="sr-only">Search projects</span>
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search name, customer or address"
              className="h-9 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-[12.5px] outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <Select
            aria-label="Project stage view"
            value={filter}
            onChange={(event) => onFilter(event.target.value as ProjectView)}
          >
            {(["Active", "Upcoming", "On Hold", "Completed"] as ProjectView[]).map((view) => (
              <option key={view}>{view}</option>
            ))}
          </Select>
          <Select
            aria-label="Readiness filter"
            value={readiness}
            onChange={(event) =>
              setReadiness(event.target.value as "All" | "Ready" | "Partial" | "Not ready")
            }
          >
            {["All", "Ready", "Partial", "Not ready"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </div>
      </div>

      <section
        aria-label="Project portfolio"
        className="workspace-panel mt-4 min-w-0 overflow-hidden"
      >
        {loading ? (
          <QueueMessage>Loading projects…</QueueMessage>
        ) : visible.length === 0 ? (
          <QueueMessage>No projects match this view.</QueueMessage>
        ) : (
          visible.map((job) => (
            <ProjectQueueItem
              key={job.project.id}
              job={job}
              onOpen={() => onSelect(job.project.id)}
              onStatusUpdate={() => onStatusProject(job.project)}
            />
          ))
        )}
      </section>

      <NewProjectModal open={creating} onClose={() => onCreating(false)} />
      {statusProject ? (
        <ProjectStatusUpdateSheet project={statusProject} onClose={() => onStatusProject(null)} />
      ) : null}
      <ProjectQuickViewDialog job={selectedJob} onClose={() => onSelect("")} />
    </main>
  );
}

function ProjectQueueItem({
  job,
  onStatusUpdate,
  onOpen,
}: {
  job: ProjectQueueRecord;
  onStatusUpdate: () => void;
  onOpen: () => void;
}) {
  const { project, next, attention, relevantDate, work } = job;
  const identity =
    [project.address, project.customer].filter(Boolean).join(" · ") || project.project_type;
  const stage = project.exception_state ?? normalizeStage(project.lifecycle_stage);
  const readiness = Math.max(0, Math.min(100, project.readiness_pct ?? 0));
  const progress = Math.max(0, Math.min(100, project.installation_progress ?? 0));

  return (
    <article className="group relative min-w-0 border-b border-border/70 transition-all last:border-b-0 focus-within:bg-primary-soft/40 hover:z-[1] hover:bg-primary-soft/25">
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-x-5 gap-y-3 px-4 py-4 pr-12 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 md:grid-cols-[minmax(240px,1.25fr)_minmax(200px,1fr)_minmax(150px,.75fr)] md:items-center md:px-6 md:pr-16"
      >
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary-soft text-primary shadow-[var(--shadow-card)]">
            <FolderKanban className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[18px] font-bold md:text-[21px]">
              {project.name}
            </h2>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{identity}</p>
            <span className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-neutral-chip px-2.5 py-1 text-[10.5px] font-bold text-secondary-foreground">
              <Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} />
              <span className="truncate">{stage}</span>
            </span>
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <MiniBar icon={Layers3} label="Readiness" value={readiness} tone="bg-warning" />
          <MiniBar icon={Hammer} label="Install" value={progress} tone="bg-info" />
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-background/70 px-3 py-2.5">
          <p className="text-[9.5px] font-bold text-muted-foreground uppercase">Next move</p>
          <p
            className={cn(
              "truncate text-[13px] font-semibold",
              !next && "font-medium text-muted-foreground",
            )}
          >
            {next?.title ?? project.next_move ?? "No current action"}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 truncate">
              <UserRound className="size-3.5 shrink-0" />
              {project.crew_lead ?? project.next_move_owner ?? next?.owner ?? "Unassigned"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5 shrink-0" />
              {relevantDate ? formatDate(relevantDate) : "No date"}
            </span>
            <span className="tabular-nums">{work.length} open</span>
          </p>
          {attention ? (
            <p className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate rounded-lg bg-warning-soft px-2 py-1 text-[11px] font-semibold text-warning">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span className="truncate">{attention}</span>
            </p>
          ) : null}
        </div>
        <span className="absolute top-1/2 right-4 grid size-8 -translate-y-1/2 place-items-center rounded-lg bg-card text-muted-foreground shadow-[var(--shadow-card)] transition-all group-hover:translate-x-0.5 group-hover:text-primary">
          <ChevronRight className="size-4" />
        </span>
      </button>
      <div className="absolute right-2 bottom-2 md:top-2 md:bottom-auto">
        <ProjectMoreMenu project={project} compact onStatusUpdate={onStatusUpdate} />
      </div>
    </article>
  );
}

function MiniBar({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Layers3;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground uppercase">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="size-3.5" />
          {label}
        </span>
        <span className="tabular-nums text-secondary-foreground">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-track">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
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
