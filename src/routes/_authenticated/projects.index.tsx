import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { NewProjectModal } from "@/components/NewProjectModal";
import { ProjectMoreMenu } from "@/components/ProjectMoreMenu";
import { ProjectStatusUpdateSheet } from "@/components/ProjectStatusUpdateSheet";
import { Button, Select } from "@/components/kit";
import { useProjects, useScheduleAssignments, type Project, type ScheduleAssignment } from "@/lib/data";
import { useFieldReports, type FieldReport } from "@/lib/fieldreports";
import { normalizeStage } from "@/lib/lifecycle";
import { compareWorkItems, isComplete, isOverdue, isWaiting, useWorkFeed, type WorkItemRow } from "@/lib/workitems";
import { Dot, stageTone } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({ meta: [
    { title: "Projects — Cobblestone Tile OS" },
    { name: "description", content: "Active tile projects, their next move, responsible crew, relevant date and attention reason." },
    { property: "og:title", content: "Projects — Cobblestone Tile OS" },
    { property: "og:description", content: "Active projects and the operational facts that move them forward." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: ProjectsPage,
});

type ProjectView = "Active" | "Upcoming" | "On Hold" | "Completed";
const PROJECT_VIEWS: ProjectView[] = ["Active", "Upcoming", "On Hold", "Completed"];

type ProjectOps = {
  project: Project;
  work: WorkItemRow[];
  next: WorkItemRow | undefined;
  attention: string | null;
  relevantDate: string | null;
  upcoming: ScheduleAssignment | undefined;
  latestReport: FieldReport | undefined;
};

function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: feed = [] } = useWorkFeed();
  const { data: schedule = [] } = useScheduleAssignments();
  const { data: reports = [] } = useFieldReports();
  const [filter, setFilter] = useState<ProjectView>("Active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusProject, setStatusProject] = useState<Project | null>(null);

  const workByProject = useMemo(() => groupWork(feed), [feed]);
  const scheduleByProject = useMemo(() => groupSchedule(schedule), [schedule]);
  const reportByProject = useMemo(() => {
    const map = new Map<string, FieldReport>();
    reports.forEach((report) => { if (!map.has(report.project_id)) map.set(report.project_id, report); });
    return map;
  }, [reports]);

  const jobs = useMemo(() => projects
    .filter((project) => matchesView(project, filter) && matchesSearch(project, search))
    .map((project): ProjectOps => {
      const work = workByProject.get(project.id) ?? [];
      const projectSchedule = scheduleByProject.get(project.id) ?? [];
      return {
        project,
        work,
        next: work[0],
        attention: attentionFor(project, work),
        relevantDate: relevantDateFor(project, work, projectSchedule),
        upcoming: nextSchedule(projectSchedule),
        latestReport: reportByProject.get(project.id),
      };
    }), [filter, projects, reportByProject, scheduleByProject, search, workByProject]);

  useEffect(() => {
    if (!jobs.length) { setSelectedId(null); return; }
    if (!selectedId || !jobs.some((job) => job.project.id === selectedId)) setSelectedId(jobs[0]?.project.id ?? null);
  }, [jobs, selectedId]);

  const selected = jobs.find((job) => job.project.id === selectedId) ?? jobs[0];

  return (
    <main className="min-h-[calc(100dvh-48px)] bg-card">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-4 py-3 md:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-[20px] font-bold">Projects</h1>
            <span className="shrink-0 text-[12px] text-muted-foreground">{jobs.length} in view</span>
          </div>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}><Plus className="size-4" /> <span className="hidden sm:inline">New Project</span><span className="sm:hidden">New</span></Button>
      </header>

      <div className="grid border-b border-border bg-background px-4 py-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center sm:gap-3 md:px-6 lg:px-8 xl:grid-cols-[minmax(320px,560px)_180px_1fr]">
        <label className="relative min-w-0">
          <span className="sr-only">Search projects</span>
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a project, address, or customer" className="h-9 w-full rounded-md border border-border bg-card pr-3 pl-9 text-[13px] outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </label>
        <Select aria-label="Project state" value={filter} onChange={(event) => setFilter(event.target.value as ProjectView)} className="mt-2 sm:mt-0">
          {PROJECT_VIEWS.map((view) => <option key={view} value={view}>{view}</option>)}
        </Select>
        <p className="hidden justify-self-end text-[11.5px] text-muted-foreground xl:block">Select a job to inspect it without leaving the queue.</p>
      </div>

      <div className="lg:grid lg:min-h-[calc(100dvh-157px)] lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_440px]">
        <section aria-label="Project queue" className="min-w-0 bg-card lg:border-r lg:border-border">
          {isLoading ? <QueueMessage>Loading projects…</QueueMessage> : jobs.length === 0 ? <QueueMessage>No projects in this view.</QueueMessage> : (
            <div>
              {jobs.map((job) => <ProjectQueueRow key={job.project.id} job={job} selected={job.project.id === selected?.project.id} onSelect={() => setSelectedId(job.project.id)} />)}
            </div>
          )}
        </section>

        <aside aria-label="Selected project preview" className="sticky top-[157px] hidden h-[calc(100dvh-157px)] overflow-y-auto bg-canvas lg:block">
          {selected ? <ProjectPreview job={selected} onUpdate={() => setStatusProject(selected.project)} /> : <div className="grid h-full place-items-center p-8 text-[13px] text-muted-foreground">Select a project to preview it.</div>}
        </aside>
      </div>

      <NewProjectModal open={creating} onClose={() => setCreating(false)} />
      {statusProject ? <ProjectStatusUpdateSheet project={statusProject} onClose={() => setStatusProject(null)} /> : null}
    </main>
  );
}

function ProjectQueueRow({ job, selected, onSelect }: { job: ProjectOps; selected: boolean; onSelect: () => void }) {
  const { project, next, attention, relevantDate } = job;
  const identity = [project.address, project.customer].filter(Boolean).join(" · ") || project.project_type;
  const stage = project.exception_state ?? normalizeStage(project.lifecycle_stage);
  return (
    <>
      <button type="button" onClick={onSelect} className={cn("group hidden w-full cursor-pointer grid-cols-[minmax(190px,.85fr)_minmax(240px,1.35fr)_auto] items-center gap-6 border-b border-border px-6 py-4 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 lg:grid xl:px-8", selected ? "bg-primary-soft/55 shadow-[inset_3px_0_0_var(--color-primary)]" : "bg-card hover:bg-muted/50")}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2"><h2 className="truncate text-[14px] font-bold">{project.name}</h2><ChevronRight className={cn("size-3.5 shrink-0 transition-transform", selected ? "translate-x-0 text-primary" : "-translate-x-1 text-muted-foreground opacity-0 group-hover:translate-x-0 group-hover:opacity-100")} /></div>
          <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{identity}</p>
          <p className="mt-2 flex items-center gap-2 text-[11.5px] font-semibold"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} />{stage}</p>
        </div>
        <div className="min-w-0">
          <span className="text-[9.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">Next move</span>
          <p className={cn("mt-1 line-clamp-2 text-[13px] font-semibold leading-snug", !next && "text-muted-foreground")}>{next?.title ?? "No current action"}</p>
          {attention ? <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-warning"><AlertCircle className="size-3 shrink-0" /><span className="truncate">{attention}</span></p> : null}
        </div>
        <div className="w-[120px] min-w-0 text-right">
          <p className="truncate text-[11.5px] font-semibold">{project.crew_lead ?? project.next_move_owner ?? "—"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{relevantDate ? fmt(relevantDate) : "—"}</p>
        </div>
      </button>

      <Link to="/projects/$projectId" params={{ projectId: project.id }} className="block border-b border-border bg-card px-4 py-4 transition-colors duration-150 active:bg-muted lg:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0"><h2 className="truncate text-[15px] font-bold">{project.name}</h2><p className="mt-1 truncate text-[11.5px] text-muted-foreground">{identity}</p></div>
          <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] font-semibold"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} />{stage}</span>
        </div>
        <p className="mt-3 line-clamp-2 text-[13px] font-semibold leading-snug">{next?.title ?? "No current action"}</p>
        {attention ? <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-warning"><AlertCircle className="size-3 shrink-0" /><span className="truncate">{attention}</span></p> : null}
        <p className="mt-2 text-[11px] text-muted-foreground">{project.crew_lead ?? project.next_move_owner ?? "Unassigned"} · {relevantDate ? fmt(relevantDate) : "—"}</p>
      </Link>
    </>
  );
}

function ProjectPreview({ job, onUpdate }: { job: ProjectOps; onUpdate: () => void }) {
  const navigate = useNavigate();
  const { project, next, attention, upcoming, latestReport } = job;
  const readiness = project.readiness_note || (project.readiness_pct > 0 ? "No recorded readiness reason." : "Not evaluated.");
  return <div className="flex min-h-full flex-col px-7 py-7 xl:px-9">
    <div className="border-b border-border pb-6">
      <p className="text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase">Selected project</p>
      <h2 className="mt-2 text-[23px] leading-tight font-bold">{project.name}</h2>
      <p className="mt-2 flex items-start gap-2 text-[12px] text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" />{project.address ?? project.customer ?? project.project_type}</p>
      <p className="mt-4 flex items-center gap-2 text-[12px] font-semibold"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} />{project.exception_state ?? normalizeStage(project.lifecycle_stage)}</p>
    </div>

    <section className="border-b border-border py-6">
      <p className="text-[10px] font-bold tracking-[0.1em] text-primary uppercase">Next move</p>
      <p className="mt-2 text-[18px] leading-snug font-bold">{next?.title ?? "No current action"}</p>
      {next?.next_action ? <p className="mt-2 text-[12.5px] leading-relaxed text-secondary-foreground">{next.next_action}</p> : null}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><UserRound className="size-3.5" />{next?.owner ?? project.next_move_owner ?? project.crew_lead ?? "Unassigned"}</span>
        {next?.due_date || next?.follow_up_on ? <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{fmt(next.follow_up_on ?? next.due_date ?? "")}</span> : null}
      </div>
    </section>

    <PreviewFact label="Waiting / blocked" value={attention ?? "Nothing currently flagged."} tone={attention ? "warning" : "quiet"} />
    <PreviewFact label="Upcoming" value={upcoming ? `${fmt(upcoming.work_date)} · ${upcoming.kind}${upcoming.notes ? ` · ${upcoming.notes}` : ""}` : "Nothing scheduled."} icon={<Clock3 className="size-3.5" />} />
    <PreviewFact label="Readiness" value={readiness} />
    <PreviewFact label="Latest update" value={latestReport ? `${fmt(latestReport.report_date)} · ${latestReport.progress_note ?? latestReport.next_work ?? "Update recorded"}` : "No field update recorded."} />

    <div className="mt-auto flex items-center gap-2 border-t border-border pt-6">
      <Button variant="primary" className="flex-1" onClick={() => navigate({ to: "/projects/$projectId", params: { projectId: project.id } })}>Open Project <ArrowRight className="size-4" /></Button>
      <Button onClick={onUpdate}>Update</Button>
      <ProjectMoreMenu project={project} compact onStatusUpdate={onUpdate} />
    </div>
  </div>;
}

function PreviewFact({ label, value, tone = "default", icon }: { label: string; value: string; tone?: "default" | "warning" | "quiet"; icon?: ReactNode }) {
  return <section className="border-b border-border py-5"><p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.09em] text-muted-foreground uppercase">{icon}{label}</p><p className={cn("mt-2 text-[12.5px] leading-relaxed", tone === "warning" ? "font-semibold text-warning" : tone === "quiet" ? "text-muted-foreground" : "text-secondary-foreground")}>{value}</p></section>;
}

function QueueMessage({ children }: { children: ReactNode }) { return <div className="px-6 py-16 text-center text-[13px] text-muted-foreground">{children}</div>; }

function groupWork(feed: WorkItemRow[]) {
  const map = new Map<string, WorkItemRow[]>();
  feed.filter((item) => item.project_id && !isComplete(item)).forEach((item) => { const list = map.get(item.project_id ?? "") ?? []; list.push(item); map.set(item.project_id ?? "", list); });
  map.forEach((items) => items.sort(compareWorkItems));
  return map;
}

function groupSchedule(schedule: ScheduleAssignment[]) {
  const map = new Map<string, ScheduleAssignment[]>();
  schedule.forEach((item) => { const list = map.get(item.project_id) ?? []; list.push(item); map.set(item.project_id, list); });
  return map;
}

function matchesView(project: Project, filter: ProjectView) {
  const stage = normalizeStage(project.lifecycle_stage);
  if (filter === "Completed") return stage === "Complete";
  if (filter === "On Hold") return project.exception_state === "On Hold";
  if (filter === "Upcoming") return !project.exception_state && ["Ready", "Scheduled"].includes(stage);
  return stage !== "Complete" && !["On Hold", "Cancelled", "Lost"].includes(project.exception_state ?? "");
}

function matchesSearch(project: Project, search: string) {
  const query = search.trim().toLowerCase();
  return !query || `${project.name} ${project.customer ?? ""} ${project.address ?? ""}`.toLowerCase().includes(query);
}

function attentionFor(project: Project, work: WorkItemRow[]) {
  const overdue = work.find(isOverdue);
  if (overdue) return `Overdue · ${overdue.title}`;
  const waiting = work.find(isWaiting);
  if (waiting) return waiting.waiting_on ? `Waiting on ${waiting.waiting_on}` : `Waiting · ${waiting.title}`;
  return project.needs_attention ?? (project.readiness_pct < 100 ? project.readiness_note : null);
}

function relevantDateFor(project: Project, work: WorkItemRow[], schedule: ScheduleAssignment[]) {
  const today = new Date().toISOString().slice(0, 10);
  const dates = [...work.flatMap((item) => [item.follow_up_on, item.due_date]), ...schedule.map((item) => item.work_date), project.start_date, project.target_date]
    .filter((value): value is string => typeof value === "string" && value >= today).sort();
  return dates[0] ?? null;
}

function nextSchedule(schedule: ScheduleAssignment[]) {
  const today = new Date().toISOString().slice(0, 10);
  return schedule.filter((item) => item.work_date >= today).sort((a, b) => a.work_date.localeCompare(b.work_date))[0];
}

function fmt(date: string) { return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }