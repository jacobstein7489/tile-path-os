import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Plus, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button, Field, Select, TextInput } from "@/components/kit";
import { CenterDialog } from "@/components/ops/CenterDialog";
import { FieldReportSheet } from "@/components/FieldReportSheet";
import { ProjectQuickViewDialog } from "@/components/projects/ProjectQuickViewDialog";
import type { ProjectQueueRecord } from "@/components/projects/ProjectsWorkspaceV2";
import { useFieldReports } from "@/lib/fieldreports";
import { Chip } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  OpsCanvas,
  OpsPageHeader,
  OpsPlane,
  ObjectMark,
  StatusPill,
} from "@/components/ops/PremiumOps";
import { readinessPresentation } from "@/lib/projectPresentation";
import {
  useCrews,
  useInsertRow,
  useProjects,
  useScheduleAssignments,
  useUpdateRow,
  type Project,
} from "@/lib/data";
import { compareWorkItems, isComplete, isOverdue, isWaiting, useWorkFeed } from "@/lib/workitems";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule & Crews — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Crew-first scheduling: today, the seven-day crew board, month overview and the ready-to-assign queue.",
      },
      { property: "og:title", content: "Schedule & Crews — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Crew lanes across the week, month overview and jobs ready to assign.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SchedulePage,
});

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type View = "Today" | "Week" | "Month";

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
const iso = (d: Date) => {
  const c = new Date(d);
  c.setMinutes(c.getMinutes() - c.getTimezoneOffset());
  return c.toISOString().slice(0, 10);
};

function SchedulePage() {
  const { data: crews = [] } = useCrews();
  const { data: projects = [] } = useProjects();
  const { data: assignments = [] } = useScheduleAssignments();
  const insertAssignment = useInsertRow("schedule_assignments");
  const updateProject = useUpdateRow("projects");
  const { data: allReports = [] } = useFieldReports();

  const [view, setView] = useState<View>("Week");
  const [offset, setOffset] = useState(0);
  const { data: workFeed = [] } = useWorkFeed();
  const [assignFor, setAssignFor] = useState<{ project: Project; kind: string } | null>(null);
  const [reportFor, setReportFor] = useState<{ project: Project; crewId: string | null } | null>(
    null,
  );
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [mobileZone, setMobileZone] = useState<"Schedule" | "Ready">("Schedule");

  const today = new Date();
  const todayIsoDate = iso(today);

  const weekStart = useMemo(() => {
    const s = mondayOf(today);
    s.setDate(s.getDate() + offset * 7);
    return s;
  }, [offset]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const monthAnchor = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return d;
  }, [offset]);

  const monthCells = useMemo(() => {
    const first = mondayOf(monthAnchor);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(first);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [monthAnchor]);

  const projectById = (id: string) => projects.find((p) => p.id === id);
  const crewById = (id: string | null) => crews.find((c) => c.id === id);
  const forDay = (day: string) => assignments.filter((a) => a.work_date === day);

  const todayAssignments = forDay(todayIsoDate);
  const reportedToday = new Set(
    allReports.filter((r) => r.report_date === todayIsoDate).map((r) => r.project_id),
  );
  const crewsWorkingToday = new Set(todayAssignments.map((a) => a.crew_id).filter(Boolean)).size;

  const unassigned = projects.filter(
    (p) =>
      !p.exception_state &&
      !["Complete", "New Submission", "Estimating", "Proposal"].includes(p.lifecycle_stage) &&
      !assignments.some((a) => a.project_id === p.id && a.crew_id),
  );
  const weekIsos = weekDays.map(iso);
  const returnVisits = assignments.filter(
    (a) => weekIsos.includes(a.work_date) && a.kind === "Return Visit",
  );

  const readyLabel = (p: Project) =>
    p.lifecycle_stage === "Closeout / Return"
      ? { text: "Assign return visit", kind: "Return Visit" }
      : p.lifecycle_stage === "Ready"
        ? { text: "Assign crew and resume", kind: "Tile / Grout" }
        : { text: "Schedule crew", kind: "Tile / Grout" };
  const selectedJob = useMemo((): ProjectQueueRecord | null => {
    if (!selectedProject) return null;
    const work = workFeed
      .filter((item) => item.project_id === selectedProject.id && !isComplete(item))
      .sort(compareWorkItems);
    const projectSchedule = assignments
      .filter((item) => item.project_id === selectedProject.id && item.work_date >= todayIsoDate)
      .sort((a, b) => a.work_date.localeCompare(b.work_date));
    return {
      project: selectedProject,
      work,
      next: work[0],
      attention:
        work.find(isOverdue)?.title ??
        work.find(isWaiting)?.waiting_on ??
        selectedProject.needs_attention,
      relevantDate: projectSchedule[0]?.work_date ?? selectedProject.target_date,
      upcoming: projectSchedule[0],
      latestReport: allReports.find((item) => item.project_id === selectedProject.id),
    };
  }, [allReports, assignments, selectedProject, todayIsoDate, workFeed]);

  const rangeLabel =
    view === "Month"
      ? monthAnchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "Week"
        ? `${weekDays[0]?.toLocaleDateString(undefined, { month: "short", day: "numeric" }) ?? ""} – ${weekDays[6]?.toLocaleDateString(undefined, { month: "short", day: "numeric" }) ?? ""}`
        : today.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          });

  return (
    <>
      <AppHeader crumbs={[{ label: "Schedule & Crews" }]} />
      <OpsCanvas>
        <OpsPageHeader
          eyebrow="Crew operations"
          title="Schedule & Crews"
          summary={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <strong className="text-foreground tabular-nums">{crewsWorkingToday}</strong> of{" "}
                {crews.length} crews working today
              </span>
              <span>
                <strong className="text-foreground tabular-nums">{unassigned.length}</strong> ready
                to assign
              </span>
              <span>
                <strong className="text-foreground tabular-nums">{returnVisits.length}</strong>{" "}
                return visits this week
              </span>
            </span>
          }
          action={
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 shadow-[var(--shadow-card)]">
              {(["Today", "Week", "Month"] as View[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setView(value);
                    setOffset(0);
                  }}
                  aria-pressed={view === value}
                  className={cn(
                    "h-8 rounded-md px-3 text-[11.5px] font-bold transition-colors",
                    view === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-primary-soft/50 hover:text-foreground",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          }
        >
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setOffset((o) => o - 1)}
                aria-label="Previous period"
                disabled={view === "Today"}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[160px] text-center text-[13px] font-bold">{rangeLabel}</span>
              <Button
                size="sm"
                onClick={() => setOffset((o) => o + 1)}
                aria-label="Next period"
                disabled={view === "Today"}
              >
                <ChevronRight className="size-4" />
              </Button>
              {offset !== 0 ? (
                <Button size="sm" onClick={() => setOffset(0)}>
                  Today
                </Button>
              ) : null}
            </div>
            <div className="flex rounded-lg bg-muted p-1 md:hidden">
              <button
                type="button"
                onClick={() => setMobileZone("Schedule")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-bold",
                  mobileZone === "Schedule" && "bg-card shadow-[var(--shadow-card)]",
                )}
              >
                Schedule
              </button>
              <button
                type="button"
                onClick={() => setMobileZone("Ready")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-bold",
                  mobileZone === "Ready" && "bg-card shadow-[var(--shadow-card)]",
                )}
              >
                Ready · {unassigned.length}
              </button>
            </div>
          </div>
        </OpsPageHeader>

        {view === "Week" ? (
          <ReadyQueue
            projects={unassigned}
            readyLabel={readyLabel}
            onAssign={(project, kind) => setAssignFor({ project, kind })}
            onOpen={setSelectedProject}
            className={cn("mt-4", mobileZone !== "Ready" && "hidden md:block")}
          />
        ) : null}

        <div className={cn("mt-4")}>
          {view !== "Week" && mobileZone === "Ready" ? (
            <ReadyQueue
              projects={unassigned}
              readyLabel={readyLabel}
              onAssign={(project, kind) => setAssignFor({ project, kind })}
              onOpen={setSelectedProject}
              className="mb-4 md:hidden"
            />
          ) : null}
          <div className={cn(mobileZone === "Ready" && "hidden md:block")}>
            {view === "Week" ? (
              <OpsPlane>
                <div className="md:hidden">
                  <DayAgenda
                    days={weekDays}
                    assignments={assignments}
                    projects={projects}
                    crews={crews}
                    onOpen={setSelectedProject}
                  />
                </div>
                <div className="overflow-x-auto">
                  <div className="hidden min-w-[760px] md:block">
                    <div className="grid h-11 grid-cols-[112px_repeat(7,minmax(0,1fr))] border-b border-border bg-muted/30">
                      <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">
                        Crew
                      </div>
                      {weekDays.map((d, i) => {
                        const isToday = iso(d) === todayIsoDate;
                        return (
                          <div
                            key={iso(d)}
                            className={cn(
                              "px-2 py-1.5 text-center",
                              isToday && "bg-primary-soft/60",
                            )}
                          >
                            <p className="text-[12px] font-bold">{DAY_LABELS[i]}</p>
                            <p className="text-[11px] text-muted-foreground tabular-nums">
                              {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {crews.map((crew) => (
                      <div
                        key={crew.id}
                        className="grid min-h-[72px] grid-cols-[132px_repeat(7,minmax(0,1fr))] border-b border-border/70 last:border-b-0"
                      >
                        <div className="flex items-center gap-2 px-3 py-2">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-foreground text-[10px] font-bold text-card">
                            {crew.initials}
                          </span>
                          <span className="min-w-0 truncate text-[12.5px] font-bold">
                            {crew.name}
                          </span>
                        </div>
                        {weekDays.map((d) => {
                          const day = iso(d);
                          const cell = assignments.filter(
                            (a) => a.crew_id === crew.id && a.work_date === day,
                          );
                          return (
                            <div
                              key={day}
                              className={cn(
                                "min-h-[72px] border-l border-border/60 bg-background/35 p-1.5 align-top",
                                day === todayIsoDate && "bg-primary-soft/25",
                              )}
                            >
                              {cell.map((a) => {
                                const p = projectById(a.project_id);
                                if (!p) return null;
                                const tone =
                                  a.kind === "Return Visit"
                                    ? "border-info/40 bg-info-soft"
                                    : crew.tone === "green"
                                      ? "border-success/40 bg-success-soft"
                                      : crew.tone === "amber"
                                        ? "border-warning/40 bg-warning-soft"
                                        : "border-primary/30 bg-primary-soft";
                                return (
                                  <button
                                    type="button"
                                    key={a.id}
                                    onClick={() => setSelectedProject(p)}
                                    className={cn(
                                      "mb-1 block w-full rounded-lg border px-2 py-1.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]",
                                      tone,
                                    )}
                                  >
                                    <span className="block truncate text-[11.5px] font-bold">
                                      {p.name}
                                    </span>
                                    <span className="block truncate text-[10.5px] text-muted-foreground">
                                      {a.kind}
                                    </span>
                                  </button>
                                );
                              })}
                              {cell.length === 0 ? (
                                <span className="block px-1 pt-1 text-[9px] font-semibold uppercase text-muted-foreground/45">
                                  Available
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {crews.length === 0 ? (
                      <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                        No crews have been set up yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              </OpsPlane>
            ) : null}

            {view === "Today" ? (
              <section className="workspace-panel overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
                  <div className="min-w-0">
                    <p className="v2-kicker">Working today</p>
                    <p className="mt-0.5 text-[13px] font-semibold">
                      {todayAssignments.length} crew assignment
                      {todayAssignments.length === 1 ? "" : "s"} · daily field report required
                    </p>
                  </div>
                  <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary">
                    <ClipboardCheck className="size-4" />
                  </span>
                </div>
                {todayAssignments.length === 0 ? (
                  <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                    No crews are scheduled today. Assign a job from the ready-to-assign queue above.
                  </p>
                ) : (
                  todayAssignments.map((a) => {
                    const p = projectById(a.project_id);
                    if (!p) return null;
                    const missing = !reportedToday.has(p.id);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedProject(p)}
                            className="block truncate text-[13.5px] font-bold hover:text-primary"
                          >
                            {p.name}
                          </button>
                          <p className="truncate text-[11.5px] text-muted-foreground">
                            {[crewById(a.crew_id)?.name ?? "No crew", a.kind, p.address]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        {missing ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setReportFor({ project: p, crewId: a.crew_id ?? null })}
                          >
                            Report missing
                          </Button>
                        ) : (
                          <Chip tone="green">Reported</Chip>
                        )}
                      </div>
                    );
                  })
                )}
              </section>
            ) : null}

            {view === "Month" ? (
              <section className="workspace-panel overflow-hidden">
                <div className="md:hidden">
                  <MonthAgenda
                    cells={monthCells}
                    assignments={assignments}
                    projects={projects}
                    crews={crews}
                    onOpen={setSelectedProject}
                  />
                </div>
                <div className="hidden grid-cols-7 border-b border-border bg-muted/30 md:grid">
                  {DAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="px-2 py-2.5 text-center text-[10.5px] font-bold text-muted-foreground uppercase"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div className="hidden grid-cols-7 md:grid">
                  {monthCells.map((d) => {
                    const day = iso(d);
                    const inMonth = d.getMonth() === monthAnchor.getMonth();
                    const dayAssignments = forDay(day);
                    return (
                      <div
                        key={day}
                        className={cn(
                          "min-h-[104px] border-r border-b border-border/60 p-1.5",
                          !inMonth && "bg-muted/25",
                          day === todayIsoDate && "bg-primary-soft/30",
                        )}
                      >
                        <p
                          className={cn(
                            "mb-1 px-1 text-[11px] font-bold tabular-nums",
                            inMonth ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {d.getDate()}
                        </p>
                        {dayAssignments.slice(0, 3).map((a) => {
                          const p = projectById(a.project_id);
                          if (!p) return null;
                          return (
                            <button
                              type="button"
                              key={a.id}
                              onClick={() => setSelectedProject(p)}
                              className="mb-1 block truncate rounded-md border border-primary/25 bg-primary-soft px-1.5 py-1 text-[10.5px] font-semibold hover:shadow-[var(--shadow-card)]"
                            >
                              {crewById(a.crew_id)?.initials
                                ? `${crewById(a.crew_id)?.initials} · `
                                : ""}
                              {p.name}
                            </button>
                          );
                        })}
                        {dayAssignments.length > 3 ? (
                          <p className="px-1 text-[10.5px] font-semibold text-muted-foreground">
                            +{dayAssignments.length - 3} more
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </OpsCanvas>

      {assignFor ? (
        <AssignModal
          project={assignFor.project}
          kind={assignFor.kind}
          onClose={() => setAssignFor(null)}
          onSave={async (values) => {
            await insertAssignment.mutateAsync({
              project_id: assignFor.project.id,
              crew_id: values.crew_id || null,
              work_date: values.work_date,
              kind: values.kind,
              status: "Scheduled",
            });
            const crewName = crews.find((c) => c.id === values.crew_id)?.name ?? null;
            await updateProject.mutateAsync({
              id: assignFor.project.id,
              patch: {
                crew_lead: crewName,
                ...(assignFor.project.lifecycle_stage === "Ready"
                  ? { lifecycle_stage: "Scheduled" }
                  : {}),
              },
            });
            setAssignFor(null);
          }}
        />
      ) : null}
      {reportFor ? (
        <FieldReportSheet
          projectId={reportFor.project.id}
          projectName={reportFor.project.name}
          defaultCrewId={reportFor.crewId}
          onClose={() => setReportFor(null)}
        />
      ) : null}
      <ProjectQuickViewDialog job={selectedJob} onClose={() => setSelectedProject(null)} />
    </>
  );
}

function ReadyQueue({
  projects,
  readyLabel,
  onAssign,
  onOpen,
  className,
}: {
  projects: Project[];
  readyLabel: (project: Project) => { text: string; kind: string };
  onAssign: (project: Project, kind: string) => void;
  onOpen: (project: Project) => void;
  className?: string;
}) {
  return (
    <aside className={cn("ops-plane overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-warning-soft/35 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-warning" />
          <div>
            <h2 className="text-[13px] font-bold">Ready to schedule</h2>
            <p className="text-[10.5px] text-muted-foreground">
              {projects.length} jobs need a crew
            </p>
          </div>
        </div>
        <StatusPill tone="amber">{projects.length} waiting</StatusPill>
      </div>
      <div className="grid max-h-[250px] gap-2 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-4">
        {projects.length ? (
          projects.map((project) => {
            const label = readyLabel(project);
            const readiness = readinessPresentation(project);
            return (
              <article
                key={project.id}
                className="rounded-xl border border-border bg-background/70 p-3"
              >
                <button type="button" onClick={() => onOpen(project)} className="w-full text-left">
                  <strong className="block truncate text-[13px]">{project.name}</strong>
                  <span
                    className={cn(
                      "mt-2 inline-flex rounded-md px-2 py-1 text-[10.5px] font-bold",
                      readiness.tone === "green"
                        ? "bg-success-soft text-success"
                        : readiness.tone === "red"
                          ? "bg-danger-soft text-danger"
                          : "bg-warning-soft text-warning",
                    )}
                  >
                    {readiness.label}
                  </span>
                  {readiness.detail ? (
                    <span className="mt-1 line-clamp-2 text-[10.5px] text-muted-foreground">
                      {readiness.detail}
                    </span>
                  ) : null}
                  <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                    {project.next_move ?? label.text}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="primary"
                  className="mt-2 h-7 w-full text-[11.5px]"
                  onClick={() => onAssign(project, label.kind)}
                >
                  <Plus className="size-3.5" /> Assign crew
                </Button>
              </article>
            );
          })
        ) : (
          <p className="p-3 text-[12px] text-muted-foreground">
            Every active job has a crew assignment.
          </p>
        )}
      </div>
    </aside>
  );
}

function DayAgenda({
  days,
  assignments,
  projects,
  crews,
  onOpen,
}: {
  days: Date[];
  assignments: ReturnType<typeof useScheduleAssignments>["data"] extends infer T
    ? NonNullable<T>
    : never;
  projects: Project[];
  crews: ReturnType<typeof useCrews>["data"] extends infer T ? NonNullable<T> : never;
  onOpen: (project: Project) => void;
}) {
  const [selected, setSelected] = useState(iso(new Date()));
  const rows = assignments.filter((item) => item.work_date === selected);
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
        {days.map((day) => (
          <button
            key={iso(day)}
            type="button"
            onClick={() => setSelected(iso(day))}
            className={cn(
              "min-w-12 rounded-lg px-2 py-2 text-center text-[11px] font-bold",
              selected === iso(day)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {day.toLocaleDateString(undefined, { weekday: "short" })}
            <span className="block text-[10px]">{day.getDate()}</span>
          </button>
        ))}
      </div>
      <div className="p-2">
        {rows.length ? (
          rows.map((item) => {
            const project = projects.find((p) => p.id === item.project_id);
            if (!project) return null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(project)}
                className="mb-2 flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left"
              >
                <span className="min-w-0">
                  <strong className="block truncate text-[13px]">{project.name}</strong>
                  <span className="text-[11px] text-muted-foreground">
                    {crews.find((crew) => crew.id === item.crew_id)?.name ?? "Unassigned"} ·{" "}
                    {item.kind}
                  </span>
                </span>
                <ChevronRight className="size-4" />
              </button>
            );
          })
        ) : (
          <p className="p-4 text-center text-[12px] text-muted-foreground">
            No crews scheduled this day.
          </p>
        )}
      </div>
    </div>
  );
}

function MonthAgenda({
  cells,
  assignments,
  projects,
  crews,
  onOpen,
}: {
  cells: Date[];
  assignments: NonNullable<ReturnType<typeof useScheduleAssignments>["data"]>;
  projects: Project[];
  crews: NonNullable<ReturnType<typeof useCrews>["data"]>;
  onOpen: (project: Project) => void;
}) {
  const activeDays = cells.filter((day) => assignments.some((item) => item.work_date === iso(day)));
  return (
    <div className="divide-y divide-border">
      {activeDays.length ? (
        activeDays.map((day) => {
          const rows = assignments.filter((item) => item.work_date === iso(day));
          return (
            <section key={iso(day)}>
              <div className="bg-muted/35 px-4 py-2 text-[11px] font-bold uppercase">
                {day.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="p-2">
                {rows.map((item) => {
                  const project = projects.find((entry) => entry.id === item.project_id);
                  if (!project) return null;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpen(project)}
                      className="mb-2 flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left last:mb-0"
                    >
                      <span className="min-w-0">
                        <strong className="block truncate text-[13px]">{project.name}</strong>
                        <span className="text-[11px] text-muted-foreground">
                          {crews.find((crew) => crew.id === item.crew_id)?.name ?? "Unassigned"} ·{" "}
                          {item.kind}
                        </span>
                      </span>
                      <ChevronRight className="size-4" />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      ) : (
        <p className="p-6 text-center text-[12px] text-muted-foreground">
          Nothing scheduled this month.
        </p>
      )}
    </div>
  );
}

function AssignModal({
  project,
  kind,
  onClose,
  onSave,
}: {
  project: Project;
  kind: string;
  onClose: () => void;
  onSave: (values: { crew_id: string; work_date: string; kind: string }) => void;
}) {
  const { data: crews = [] } = useCrews();
  const [values, setValues] = useState({
    crew_id: "",
    work_date: new Date().toISOString().slice(0, 10),
    kind,
  });
  return (
    <CenterDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Schedule ${project.name}`}
      description="Choose the crew, day, and visit type for this ready project."
    >
      <div className="bg-canvas p-3.5 sm:p-4">
        <div className="rounded-lg border border-primary/15 bg-primary-soft/45 p-3">
          <p className="text-[10px] font-bold text-primary uppercase">Assignment context</p>
          <p className="mt-1 text-[15px] font-bold">{project.name}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {readinessPresentation(project).label} · {project.lifecycle_stage}
          </p>
        </div>
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-3.5">
          <Field label="Crew">
            <Select
              value={values.crew_id}
              onChange={(e) => setValues((v) => ({ ...v, crew_id: e.target.value }))}
            >
              <option value="">Select crew…</option>
              {crews
                .filter((c) => !c.is_open_lane)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Date">
              <TextInput
                type="date"
                value={values.work_date}
                onChange={(e) => setValues((v) => ({ ...v, work_date: e.target.value }))}
              />
            </Field>
            <Field label="Visit type">
              <Select
                value={values.kind}
                onChange={(e) => setValues((v) => ({ ...v, kind: e.target.value }))}
              >
                <option>Tile / Grout</option>
                <option>Return Visit</option>
                <option>Site Walkthrough</option>
                <option>Punch</option>
              </Select>
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onSave(values)}
            disabled={!values.crew_id}
            {...(!values.crew_id ? { disabledReason: "Choose a crew" } : {})}
          >
            Save assignment
          </Button>
        </div>
      </div>
    </CenterDialog>
  );
}
