import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, ArrowUpRight, Plus } from "lucide-react";
import { NewProjectModal } from "@/components/NewProjectModal";
import { Button, FilterGroup, SearchInput } from "@/components/kit";
import { PageShell } from "@/components/PageShell";
import { useProjects, useScheduleAssignments, type Project, type ScheduleAssignment } from "@/lib/data";
import { normalizeStage } from "@/lib/lifecycle";
import { compareWorkItems, isComplete, isOverdue, isWaiting, useWorkFeed, type WorkItemRow } from "@/lib/workitems";
import { Dot, stageTone } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({ meta: [
    { title: "Projects — Cobblestone Tile OS" },
    { name: "description", content: "Active tile projects, their next move, responsible crew, relevant date and attention reason." },
    { property: "og:title", content: "Projects — Cobblestone Tile OS" },
    { property: "og:description", content: "Active tile projects and the operational facts that move them forward." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: ProjectsPage,
});

type ProjectView = "Active" | "Upcoming" | "On Hold" | "Completed";
const PROJECT_VIEWS: ProjectView[] = ["Active", "Upcoming", "On Hold", "Completed"];

function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: feed = [] } = useWorkFeed();
  const { data: schedule = [] } = useScheduleAssignments();
  const [filter, setFilter] = useState<ProjectView>("Active");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const workByProject = useMemo(() => {
    const map = new Map<string, WorkItemRow[]>();
    feed.filter((item) => item.project_id && !isComplete(item)).forEach((item) => {
      const list = map.get(item.project_id ?? "") ?? [];
      list.push(item);
      map.set(item.project_id ?? "", list);
    });
    map.forEach((items) => items.sort(compareWorkItems));
    return map;
  }, [feed]);

  const scheduleByProject = useMemo(() => {
    const map = new Map<string, ScheduleAssignment[]>();
    schedule.forEach((item) => {
      const list = map.get(item.project_id) ?? [];
      list.push(item);
      map.set(item.project_id, list);
    });
    return map;
  }, [schedule]);

  const rows = projects.filter((project) => {
    const stage = normalizeStage(project.lifecycle_stage);
    const match = filter === "Completed"
      ? stage === "Complete"
      : filter === "On Hold"
        ? project.exception_state === "On Hold"
        : filter === "Upcoming"
          ? !project.exception_state && ["Ready", "Scheduled"].includes(stage)
          : stage !== "Complete" && !["On Hold", "Cancelled", "Lost"].includes(project.exception_state ?? "");
    const query = search.trim().toLowerCase();
    return match && (!query || `${project.name} ${project.customer ?? ""} ${project.address ?? ""}`.toLowerCase().includes(query));
  });

  return (
    <PageShell
      crumbs={[{ label: "Projects" }]}
      title="Projects"
      subtitle="Current jobs, their next action, and what needs attention."
      actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="size-4" /> New Project</Button>}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0 overflow-x-auto pb-1 sm:pb-0">
          <FilterGroup className="w-max flex-nowrap" options={PROJECT_VIEWS.map((value) => ({ value, label: value }))} value={filter} onChange={(value) => setFilter(value as ProjectView)} />
        </div>
        <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" className="w-full sm:w-[220px] md:w-[280px]" />
      </div>

      <div className="hidden border-t border-border md:block">
        <div className="grid grid-cols-[minmax(260px,1.15fr)_minmax(300px,1.35fr)_minmax(180px,.75fr)_130px] gap-6 border-b border-border px-3 py-2.5 text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          <span>Project / state</span><span>Now</span><span>Responsibility</span><span>Next date</span>
        </div>
        {isLoading ? <div className="py-12 text-sm text-muted-foreground">Loading projects…</div> : rows.length === 0 ? <div className="py-14 text-sm text-muted-foreground">No projects in this view.</div> : rows.map((project) => <ProjectRow key={project.id} project={project} work={workByProject.get(project.id) ?? []} schedule={scheduleByProject.get(project.id) ?? []} />)}
        <div className="flex items-center justify-between border-b border-border px-3 py-3 text-[11.5px] text-muted-foreground"><span>{rows.length} projects</span><span>{filter}</span></div>
      </div>

      <div className="space-y-2.5 md:hidden">
        {isLoading ? <div className="surface px-4 py-8 text-[13px] text-muted-foreground">Loading projects…</div> : rows.length === 0 ? <div className="surface px-4 py-10 text-center text-[13px] text-muted-foreground">No projects in this view.</div> : rows.map((project) => {
          const work = workByProject.get(project.id) ?? [];
          const next = work[0];
          const attention = attentionFor(project, work);
          const date = relevantDateFor(project, work, scheduleByProject.get(project.id) ?? []);
          return <Link key={project.id} to="/projects/$projectId" params={{ projectId: project.id }} className="block border-b border-border bg-card px-4 py-4 transition-colors duration-150 active:bg-muted">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><div className="min-w-0"><h2 className="truncate text-[16px] font-bold">{project.name}</h2><p className="mt-1 truncate text-[12px] text-muted-foreground">{project.address ?? project.customer ?? project.project_type}</p></div><span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10.5px] font-semibold text-secondary-foreground">{project.exception_state ?? normalizeStage(project.lifecycle_stage)}</span></div>
            <div className="mt-4"><span className="v2-kicker">Next move</span><p className="mt-1.5 text-[14px] font-semibold">{next?.title ?? "—"}</p><p className="mt-1 text-[12px] text-muted-foreground">{project.crew_lead ?? project.next_move_owner ?? "Unassigned"} · {date ? fmt(date) : "—"}</p>{attention ? <p className="mt-2 flex items-start gap-1.5 text-[12px] font-medium text-warning"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{attention}</p> : null}</div>
          </Link>;
        })}
      </div>
      <NewProjectModal open={creating} onClose={() => setCreating(false)} />
    </PageShell>
  );
}

function ProjectRow({ project, work, schedule }: { project: Project; work: WorkItemRow[]; schedule: ScheduleAssignment[] }) {
  const navigate = useNavigate();
  const next = work[0];
  const rest = work.length - 1;
  const attention = attentionFor(project, work);
  const relevantDate = relevantDateFor(project, work, schedule);
  return <div tabIndex={0} role="button" onClick={() => navigate({ to: "/projects/$projectId", params: { projectId: project.id } })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void navigate({ to: "/projects/$projectId", params: { projectId: project.id } }); } }} className="group grid cursor-pointer grid-cols-[minmax(260px,1.15fr)_minmax(300px,1.35fr)_minmax(180px,.75fr)_130px] gap-6 border-b border-border bg-card px-3 py-4 outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35">
    <div className="min-w-0"><span className="flex items-center gap-2 truncate text-[14px] font-bold">{project.name}<ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" /></span><span className="mt-1 block truncate text-[11.5px] text-muted-foreground">{project.address ?? project.customer ?? project.project_type}</span><span className="mt-2 inline-flex items-center gap-2 text-[11.5px] font-semibold"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} />{project.exception_state ?? normalizeStage(project.lifecycle_stage)}</span></div>
    <div className="min-w-0">{next ? <><span className="line-clamp-1 text-[13px] font-semibold">{next.title}</span><span className="mt-1 block text-[11.5px] text-muted-foreground">{rest > 0 ? `${rest} more open` : "Only active item"}</span></> : <span className="text-muted-foreground">—</span>}{attention ? <span className="mt-2 flex items-start gap-1.5 text-[11.5px] font-medium text-warning"><AlertCircle className="mt-0.5 size-3 shrink-0" />{attention}</span> : null}</div>
    <div className={cn("text-[12.5px]", !project.crew_lead && !project.next_move_owner && "text-muted-foreground")}><span className="block truncate font-semibold">{project.crew_lead ?? project.next_move_owner ?? "—"}</span><span className="mt-1 block text-[11.5px] text-muted-foreground">Crew / owner</span></div>
    <div className="text-[12.5px] font-semibold">{relevantDate ? fmt(relevantDate) : "—"}</div>
  </div>;
}

function attentionFor(project: Project, work: WorkItemRow[]) {
  const overdue = work.find(isOverdue);
  if (overdue) return `Overdue · ${overdue.title}`;
  const waiting = work.find(isWaiting);
  if (waiting) return waiting.waiting_on ? `Waiting on ${waiting.waiting_on}` : `Waiting · ${waiting.title}`;
  return project.needs_attention ?? project.readiness_note ?? null;
}

function relevantDateFor(project: Project, work: WorkItemRow[], schedule: ScheduleAssignment[]) {
  const today = new Date().toISOString().slice(0, 10);
  const candidateDates = [...work.flatMap((item) => [item.follow_up_on, item.due_date]), ...schedule.map((item) => item.work_date), project.start_date, project.target_date];
  const dates = candidateDates
    .filter((value): value is string => typeof value === "string" && value >= today)
    .sort();
  return dates[0] ?? null;
}

function fmt(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
