import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ProjectsWorkspaceV2, type ProjectQueueRecord } from "@/components/projects/ProjectsWorkspaceV2";
import { useProjects, useScheduleAssignments, type Project, type ScheduleAssignment } from "@/lib/data";
import { useFieldReports, type FieldReport } from "@/lib/fieldreports";
import { normalizeStage } from "@/lib/lifecycle";
import { compareWorkItems, isComplete, isOverdue, isWaiting, useWorkFeed, type WorkItemRow } from "@/lib/workitems";

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

  const activeCount = useMemo(() => projects.filter((project) => matchesView(project, "Active")).length, [projects]);
  const jobs = useMemo(() => projects
    .filter((project) => matchesView(project, filter) && matchesSearch(project, search))
    .map((project): ProjectQueueRecord => {
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

  return <ProjectsWorkspaceV2
    jobs={jobs}
    activeCount={activeCount}
    loading={isLoading}
    search={search}
    filter={filter}
    selectedId={selectedId}
    creating={creating}
    statusProject={statusProject}
    onSearch={setSearch}
    onFilter={setFilter}
    onSelect={setSelectedId}
    onCreating={setCreating}
    onStatusProject={setStatusProject}
  />;
}

function groupWork(feed: WorkItemRow[]) {
  const map = new Map<string, WorkItemRow[]>();
  feed.filter((item) => item.project_id && !isComplete(item)).forEach((item) => {
    const projectId = item.project_id;
    if (!projectId) return;
    const list = map.get(projectId) ?? [];
    list.push(item);
    map.set(projectId, list);
  });
  map.forEach((items) => items.sort(compareWorkItems));
  return map;
}

function groupSchedule(schedule: ScheduleAssignment[]) {
  const map = new Map<string, ScheduleAssignment[]>();
  schedule.forEach((item) => {
    const list = map.get(item.project_id) ?? [];
    list.push(item);
    map.set(item.project_id, list);
  });
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
    .filter((value): value is string => typeof value === "string" && value >= today)
    .sort();
  return dates[0] ?? null;
}

function nextSchedule(schedule: ScheduleAssignment[]) {
  const today = new Date().toISOString().slice(0, 10);
  return schedule.filter((item) => item.work_date >= today).sort((a, b) => a.work_date.localeCompare(b.work_date))[0];
}