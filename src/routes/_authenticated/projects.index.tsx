import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { NewProjectModal } from "@/components/NewProjectModal";
import { Button, FilterGroup, SearchInput, Table, Td, Th } from "@/components/kit";
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

      <div className="surface hidden overflow-hidden md:block">
        <Table className="table-fixed">
          <colgroup><col className="w-[24%]" /><col className="w-[12%]" /><col className="w-[27%]" /><col className="w-[13%]" /><col className="w-[11%]" /><col /></colgroup>
          <thead><tr className="bg-muted/40">{["Project", "Stage", "Next move", "Crew / owner", "Relevant date", "Attention"].map((heading) => <Th key={heading}>{heading}</Th>)}</tr></thead>
          <tbody>
            {isLoading ? <tr><Td colSpan={6} className="py-10 text-center text-muted-foreground">Loading projects…</Td></tr> : rows.length === 0 ? <tr><Td colSpan={6} className="py-12 text-center text-muted-foreground">No projects in this view.</Td></tr> : rows.map((project) => <ProjectRow key={project.id} project={project} work={workByProject.get(project.id) ?? []} schedule={scheduleByProject.get(project.id) ?? []} />)}
          </tbody>
        </Table>
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-[12px] text-muted-foreground"><span className="font-medium tabular-nums">{rows.length} projects</span><span>{filter}</span></div>
      </div>

      <div className="space-y-2.5 md:hidden">
        {isLoading ? <div className="surface px-4 py-8 text-[13px] text-muted-foreground">Loading projects…</div> : rows.length === 0 ? <div className="surface px-4 py-10 text-center text-[13px] text-muted-foreground">No projects in this view.</div> : rows.map((project) => {
          const work = workByProject.get(project.id) ?? [];
          const next = work[0];
          const attention = attentionFor(project, work);
          const date = relevantDateFor(project, work, scheduleByProject.get(project.id) ?? []);
          return <Link key={project.id} to="/projects/$projectId" params={{ projectId: project.id }} className="surface block px-4 py-4 transition-colors duration-150 active:bg-muted">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><div className="min-w-0"><h2 className="truncate text-[15px] font-bold">{project.name}</h2><p className="mt-0.5 truncate text-[12px] text-muted-foreground">{project.address ?? project.customer ?? project.project_type}</p></div><span className="shrink-0 text-[12px] font-semibold text-secondary-foreground">{project.exception_state ?? normalizeStage(project.lifecycle_stage)}</span></div>
            <div className="mt-3 border-t border-border pt-3"><span className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">Next move</span><p className="mt-1 text-[13px] font-semibold">{next?.title ?? "—"}</p><p className="mt-1 text-[12px] text-muted-foreground">{project.crew_lead ?? project.next_move_owner ?? "Unassigned"} · {date ? fmt(date) : "—"}</p>{attention ? <p className="mt-2 flex items-start gap-1.5 text-[12px] font-medium text-warning"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{attention}</p> : null}</div>
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
  return <tr tabIndex={0} role="button" onClick={() => navigate({ to: "/projects/$projectId", params: { projectId: project.id } })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void navigate({ to: "/projects/$projectId", params: { projectId: project.id } }); } }} className="group cursor-pointer outline-none transition-colors duration-150 hover:bg-muted/40 active:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35">
    <Td><span className="block truncate text-[13.5px] font-bold">{project.name}</span><span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{project.address ?? project.customer ?? project.project_type}</span></Td>
    <Td><span className="inline-flex items-center gap-2 text-[12px] font-medium"><Dot tone={stageTone(project.lifecycle_stage, project.exception_state)} /><span>{project.exception_state ?? normalizeStage(project.lifecycle_stage)}</span></span></Td>
    <Td>{next ? <span className="block"><span className="line-clamp-1 text-[12.5px] font-semibold">{next.title}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{rest > 0 ? `+${rest} more open` : next.owner ?? "Unassigned"}</span></span> : <span className="text-muted-foreground">—</span>}</Td>
    <Td><span className={cn("block truncate text-[12.5px]", !project.crew_lead && !project.next_move_owner && "text-muted-foreground")}>{project.crew_lead ?? project.next_move_owner ?? "—"}</span></Td>
    <Td className="whitespace-nowrap text-[12px] text-muted-foreground">{relevantDate ? fmt(relevantDate) : "—"}</Td>
    <Td>{attention ? <span className="line-clamp-2 text-[12px] font-medium text-warning">{attention}</span> : <span className="text-muted-foreground">—</span>}</Td>
  </tr>;
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
