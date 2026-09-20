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
import { CustomerQuickViewDialog } from "@/components/customers/CustomersWorkspace";
import { Button, Select } from "@/components/kit";
import type { Project, ScheduleAssignment } from "@/lib/data";
import type { FieldReport } from "@/lib/fieldreports";
import { normalizeStage } from "@/lib/lifecycle";
import { Dot, stageTone } from "@/lib/status";
import type { WorkItemRow } from "@/lib/workitems";
import { useCompanies, type Company } from "@/lib/people";
import { cn } from "@/lib/utils";
import {
  OpsCanvas,
  OpsPageHeader,
  OpsPlane,
  ObjectMark,
  OpsMeter,
  StatusPill,
} from "@/components/ops/PremiumOps";

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
  const { data: companies = [] } = useCompanies("customer");
  const [selectedCustomer, setSelectedCustomer] = useState<Company | null>(null);
  const [readiness, setReadiness] = useState<"All" | "Ready" | "Partial" | "Not ready">("All");

  const visible = jobs.filter((job) => {
    if (readiness === "All") return true;
    const pct = job.project.readiness_pct ?? 0;
    if (readiness === "Ready") return pct >= 100;
    if (readiness === "Partial") return pct > 0 && pct < 100;
    return pct <= 0;
  });

  return (
    <OpsCanvas>
      <OpsPageHeader
        eyebrow="Project operations"
        title="Projects"
        summary={`${visible.length} shown · ${activeCount} active`}
        action={
          <Button variant="primary" onClick={() => onCreating(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      >
        <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto_auto] sm:items-center">
          <label className="relative min-w-0">
            <span className="sr-only">Search projects</span>
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search name, customer or address"
              className="h-8 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-[12.5px] outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
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
      </OpsPageHeader>

      <section
        aria-label="Project portfolio"
        className="ops-plane mt-4 min-w-0 overflow-hidden p-2 sm:p-3"
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
              onOpenCustomer={() => {
                const company = companies.find(
                  (item) => item.id === job.project.customer_company_id,
                );
                if (company) setSelectedCustomer(company);
              }}
            />
          ))
        )}
      </section>

      <NewProjectModal open={creating} onClose={() => onCreating(false)} />
      {statusProject ? (
        <ProjectStatusUpdateSheet project={statusProject} onClose={() => onStatusProject(null)} />
      ) : null}
      <ProjectQuickViewDialog
        job={selectedJob}
        onClose={() => onSelect("")}
        onOpenCustomer={(companyId) => {
          const company = companies.find((item) => item.id === companyId);
          if (company) {
            onSelect("");
            setSelectedCustomer(company);
          }
        }}
      />
      {selectedCustomer ? (
        <CustomerQuickViewDialog
          company={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onProject={(project) => {
            setSelectedCustomer(null);
            onSelect(project.id);
          }}
        />
      ) : null}
    </OpsCanvas>
  );
}

function ProjectQueueItem({
  job,
  onStatusUpdate,
  onOpen,
  onOpenCustomer,
}: {
  job: ProjectQueueRecord;
  onStatusUpdate: () => void;
  onOpen: () => void;
  onOpenCustomer: () => void;
}) {
  const { project, next, attention, relevantDate, work } = job;
  const identity = project.address ?? project.project_type;
  const stage = project.exception_state ?? normalizeStage(project.lifecycle_stage);
  const readiness = Math.max(0, Math.min(100, project.readiness_pct ?? 0));
  const progress = Math.max(0, Math.min(100, project.installation_progress ?? 0));

  return (
    <article className="group relative mb-2 min-w-0 overflow-hidden rounded-xl border border-border bg-background/60 transition-all last:mb-0 focus-within:border-primary/30 focus-within:bg-card hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card hover:shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-x-5 gap-y-3 px-4 py-3.5 pr-12 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 md:min-h-[112px] md:grid-cols-[minmax(280px,1.15fr)_minmax(190px,.75fr)_minmax(280px,1fr)] md:items-center md:px-5 md:pr-14"
      >
        <div className="flex min-w-0 items-start gap-3">
          <ObjectMark tone="ink">
            <FolderKanban className="size-5" />
          </ObjectMark>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[16px] font-bold md:text-[18px]">
              {project.name}
            </h2>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{identity}</p>
            {project.customer ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenCustomer();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenCustomer();
                  }
                }}
                className="mt-1 block max-w-full truncate text-[11.5px] font-bold text-primary hover:underline"
              >
                {project.customer}
              </span>
            ) : null}
            <StatusPill tone="blue">
              <Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} />
              <span className="truncate">{stage}</span>
            </StatusPill>
          </div>
        </div>

        <div className="min-w-0 space-y-1.5">
          <OpsMeter
            label="Readiness"
            value={readiness}
            tone={readiness >= 100 ? "green" : "amber"}
          />
          <OpsMeter label="Installed" value={progress} />
        </div>

        <div className="min-w-0 px-1 py-1">
          <p className="ops-eyebrow">Next move</p>
          <p
            className={cn(
              "mt-1 line-clamp-2 text-[14px] leading-5 font-bold",
              !next && "font-medium text-muted-foreground",
            )}
          >
            {next?.title ?? project.next_move ?? "No current action"}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
            <p className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate rounded-md bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span className="truncate">{attention}</span>
            </p>
          ) : null}
        </div>
        <span className="absolute top-1/2 right-4 grid size-7 -translate-y-1/2 place-items-center rounded-md bg-card text-muted-foreground shadow-[var(--shadow-card)] transition-all group-hover:translate-x-0.5 group-hover:text-primary">
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
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-track">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function QueueMessage({ children }: { children: ReactNode }) {
  return <div className="px-6 py-12 text-center text-[13px] text-muted-foreground">{children}</div>;
}
function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
