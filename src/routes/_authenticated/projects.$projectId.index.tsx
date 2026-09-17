import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, CircleAlert, Clock3, Layers3 } from "lucide-react";
import { WorkItemPanel } from "@/components/work/WorkItemPanel";
import { useProject, useScheduleAssignments, useAreasWithSurfaces } from "@/lib/data";
import { useFieldReports } from "@/lib/fieldreports";
import { useProjectSetup } from "@/lib/setup";
import { READINESS_CATEGORIES, type ReadinessRequirement } from "@/lib/readiness";
import {
  compareWorkItems,
  isComplete,
  isWaiting,
  useWorkFeed,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$projectId/")({
  head: () => ({
    meta: [
      { title: "Project Overview — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "The next move, current blockers, upcoming work and readiness for this tile project.",
      },
      { property: "og:title", content: "Project Overview — Cobblestone Tile OS" },
      { property: "og:description", content: "The next move, blockers, upcoming work and readiness." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectOverview,
});

type SetupLink = "/projects/$projectId/scope" | "/projects/$projectId/design" | "/projects/$projectId/package";
type NextMove = { title: string; detail: string; to?: SetupLink; work?: WorkItemRow };

/** A visual command center backed by the existing project operating data. */
function ProjectOverview() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: feed = [] } = useWorkFeed();
  const { data: reports = [] } = useFieldReports(projectId);
  const { data: schedule = [] } = useScheduleAssignments();
  const { areas, surfaces } = useAreasWithSurfaces(projectId);
  const setup = useProjectSetup(projectId);
  const [active, setActive] = useState<WorkItemRow | null>(null);

  const work = useMemo(
    () => feed.filter((i) => i.project_id === projectId && !isComplete(i)).sort(compareWorkItems),
    [feed, projectId],
  );
  if (!project) return null;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = schedule
    .filter((s) => s.project_id === projectId && s.work_date >= today)
    .sort((a, b) => a.work_date.localeCompare(b.work_date));
  const waitingAll = work.filter(isWaiting);
  const waiting = waitingAll.slice(0, 3);
  const latest = reports[0] ?? null;
  const stage = project.exception_state ?? project.lifecycle_stage;

  const setupMove = deriveSetupMove(setup);
  const urgent = work.find((i) => (i.due_date && i.due_date < today) || i.priority === "High");
  const followup = work.find((i) => i.follow_up_on && i.follow_up_on <= today);
  const next: NextMove =
    setupMove ??
    (urgent
      ? {
          title: urgent.title,
          detail:
            urgent.due_date && urgent.due_date < today
              ? `Overdue · ${formatDate(urgent.due_date)}`
              : "High priority",
          work: urgent,
        }
      : followup
        ? { title: followup.title, detail: `Follow up ${formatDate(followup.follow_up_on)}`, work: followup }
        : upcoming[0]
          ? { title: upcoming[0].kind, detail: formatDate(upcoming[0].work_date) }
          : {
              title: "Review open project work",
              detail: `${work.length} open item${work.length === 1 ? "" : "s"}`,
            });

  const blocked = setup.requirements.filter((r) => r.state === "blocked");
  const evaluated = setup.requirements.some((r) => r.state !== "not_evaluated");
  const conclusion = !evaluated
    ? { label: "Not evaluated", tone: "muted" as const }
    : blocked.length === 0
      ? { label: "Ready", tone: "green" as const }
      : blocked.length <= 2
        ? { label: "Partial", tone: "amber" as const }
        : { label: "Not ready", tone: "amber" as const };

  const reasons = READINESS_CATEGORIES.map((category) => {
    const rows = setup.requirements.filter((r) => r.category === category);
    const bad = rows.filter((r) => r.state === "blocked");
    if (!rows.length || !bad.length) return null;
    return { category, reason: affectedSurfaceSummary(bad, setup) };
  }).filter(Boolean) as { category: string; reason: string }[];

  const areaList = areas.data ?? [];
  const surfaceList = surfaces.data ?? [];
  const roomRows = areaList.map((area) => {
    const ids = new Set(surfaceList.filter((s) => s.area_id === area.id).map((s) => s.id));
    const affected = new Set(
      setup.requirements
        .filter((r) => r.state === "blocked" && r.surface_id && ids.has(r.surface_id))
        .map((r) => r.surface_id),
    );
    return {
      id: area.id,
      name: area.name,
      note: affected.size
        ? `${affected.size} surface${affected.size === 1 ? "" : "s"} need setup`
        : ids.size
          ? "Ready"
          : "No surfaces yet",
      ok: !affected.size && ids.size > 0,
    };
  });

  const live = active ? (feed.find((i) => i.id === active.id) ?? active) : null;
  const whereWeAre = stateSentence(stage, blocked.length, waitingAll.length, upcoming.length);

  const nextContent = (
    <>
      <span className="block text-[10px] font-bold tracking-[0.08em] text-primary uppercase">Next move</span>
      <span className="mt-4 block max-w-[22ch] font-display text-[24px] leading-[1.18] font-bold md:text-[30px]">{next.title}</span>
      <span className="mt-2 block text-[12.5px] text-muted-foreground">{next.detail}</span>
      <span className="mt-7 inline-flex items-center gap-2 text-[12.5px] font-bold text-primary">{next.work ? "Open work item" : next.to ? "Continue setup" : "Review work"}<ArrowRight className="size-4" /></span>
    </>
  );

  return (
    <>
      <div className="mx-auto w-full max-w-[1280px] px-4 pt-5 pb-24 md:px-7 md:pt-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">Project command center</p>
            <h2 className="mt-1 font-display text-[22px] font-bold md:text-[26px]">{stage}</h2>
            <p className="mt-1 max-w-[68ch] text-[12.5px] leading-5 text-muted-foreground">{whereWeAre}</p>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[11.5px] font-semibold shadow-card">{work.length} open item{work.length === 1 ? "" : "s"}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
          {next.work ? (
            <button type="button" onClick={() => setActive(next.work ?? null)} className="group min-h-[218px] rounded-xl border border-primary/25 bg-primary-soft p-6 text-left shadow-raised transition-transform hover:-translate-y-0.5 md:p-8">{nextContent}</button>
          ) : next.to ? (
            <Link to={next.to} params={{ projectId }} className="group min-h-[218px] rounded-xl border border-primary/25 bg-primary-soft p-6 shadow-raised transition-transform hover:-translate-y-0.5 md:p-8">{nextContent}</Link>
          ) : (
            <div className="min-h-[218px] rounded-xl border border-primary/25 bg-primary-soft p-6 shadow-raised md:p-8">{nextContent}</div>
          )}

          <Panel title="Readiness" icon={<Layers3 className="size-4" />} className="min-h-[218px]">
            <p className={cn("mt-1 text-[22px] font-bold", conclusion.tone === "green" ? "text-success" : conclusion.tone === "amber" ? "text-warning" : "text-muted-foreground")}>{conclusion.label}</p>
            <div className="mt-4 space-y-3">
              {reasons.length ? reasons.slice(0, 3).map((r) => <div key={r.category} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-[12px]"><span className="truncate font-semibold">{r.category}</span><span className="text-right text-warning">{r.reason}</span></div>) : <p className="text-[12.5px] leading-5 text-muted-foreground">{evaluated ? "Every setup requirement on this job is satisfied." : "Readiness starts once rooms and surfaces exist."}</p>}
            </div>
            <Link to="/projects/$projectId/scope" params={{ projectId }} className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-bold text-primary">Review readiness <ArrowRight className="size-3.5" /></Link>
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            <Panel title="Waiting / blocked" icon={<CircleAlert className="size-4" />} action={waitingAll.length > 3 ? <Link to="/projects/$projectId/tasks" params={{ projectId }}>View all {waitingAll.length}</Link> : undefined}>
              {waiting.length ? <div className="mt-1 space-y-2">{waiting.map((item) => <button key={item.id} type="button" onClick={() => setActive(item)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-warning-soft px-3.5 py-3 text-left"><span className="min-w-0"><span className="block truncate text-[13px] font-bold">{item.title}</span><span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{item.waiting_on ?? "External confirmation"}</span></span>{item.follow_up_on ? <span className="text-[11px] font-semibold text-warning">{formatDate(item.follow_up_on)}</span> : null}</button>)}</div> : <p className="mt-2 text-[13px] text-muted-foreground">Nothing currently blocking work.</p>}
            </Panel>
            {roomRows.length ? <Panel title="Room readiness" icon={<Layers3 className="size-4" />}>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">{roomRows.map((room) => <Link key={room.id} to="/projects/$projectId/scope" params={{ projectId }} className="rounded-lg border border-border bg-background/50 p-3 transition-colors hover:bg-primary-soft"><span className="block truncate text-[13px] font-bold">{room.name}</span><span className={cn("mt-1 block text-[11.5px]", room.ok ? "text-success" : "text-warning")}>{room.note}</span></Link>)}</div>
            </Panel> : null}
          </div>

          <div className="grid content-start gap-4">
            <Panel title="Upcoming" icon={<CalendarDays className="size-4" />}>
              {upcoming.length ? <div className="mt-1 space-y-3">{upcoming.slice(0, 3).map((s) => <div key={s.id} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3"><span className="text-[11.5px] font-bold text-primary">{formatDate(s.work_date)}</span><p className="min-w-0 text-[12.5px] font-semibold">{s.kind}{s.notes ? <span className="font-normal text-muted-foreground"> · {s.notes}</span> : null}</p></div>)}</div> : <p className="mt-2 text-[13px] text-muted-foreground">Nothing scheduled yet.</p>}
            </Panel>
            <Panel title="Latest update" icon={<Clock3 className="size-4" />} action={<Link to="/projects/$projectId/updates" params={{ projectId }}>All updates</Link>}>
              {latest ? <><p className="mt-1 text-[11.5px] font-semibold text-muted-foreground">{formatDate(latest.report_date)}{latest.crew_label ? ` · ${latest.crew_label}` : ""}</p><p className="mt-2 text-[13px] leading-6 whitespace-pre-line">{latest.progress_note ?? "Update submitted without a progress note."}</p>{latest.blockers ? <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-[12px] text-warning">Waiting · {latest.blockers}</p> : null}</> : <p className="mt-2 text-[13px] text-muted-foreground">No daily update has been submitted.</p>}
            </Panel>
          </div>
        </div>
      </div>
      <WorkItemPanel item={live} onClose={() => setActive(null)} />
    </>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-5 shadow-card md:p-6", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[13px] font-bold">{icon ? <span className="text-muted-foreground">{icon}</span> : null}{title}</h2>
        {action ? <span className="text-[11.5px] font-bold text-primary">{action}</span> : null}
      </div>
      {children}
    </section>
  );
}

function stateSentence(stage: string, blocked: number, waiting: number, upcoming: number) {
  const parts: string[] = [];
  parts.push(
    blocked
      ? `${blocked} setup requirement${blocked === 1 ? "" : "s"} still open`
      : "Setup requirements are satisfied",
  );
  if (waiting) parts.push(`${waiting} item${waiting === 1 ? "" : "s"} waiting on someone else`);
  parts.push(upcoming ? `${upcoming} date${upcoming === 1 ? "" : "s"} on the schedule` : "nothing on the schedule yet");
  return `${parts.join(" · ")}.`;
}

function deriveSetupMove(setup: ReturnType<typeof useProjectSetup>): NextMove | null {
  const blocked = setup.requirements.filter((r) => r.state === "blocked");
  const by = (category: string) => blocked.filter((r) => r.category === category);
  if (by("Room / Surface setup").length)
    return {
      title: "Complete rooms and surfaces",
      detail: affectedSurfaceSummary(by("Room / Surface setup"), setup),
      to: "/projects/$projectId/scope",
    };
  if (by("Finish specification").length)
    return {
      title: "Finish project specifications",
      detail: affectedSurfaceSummary(by("Finish specification"), setup),
      to: "/projects/$projectId/scope",
    };
  if (by("Design decisions").length)
    return {
      title: "Finish design decisions",
      detail: affectedSurfaceSummary(by("Design decisions"), setup, "need decisions"),
      to: "/projects/$projectId/design",
    };
  if (by("Installer package").length)
    return {
      title: "Prepare installer package",
      detail: `${by("Installer package").length} room package${by("Installer package").length === 1 ? "" : "s"} remaining`,
      to: "/projects/$projectId/package",
    };
  return null;
}

function affectedSurfaceSummary(
  rows: ReadinessRequirement[],
  setup: ReturnType<typeof useProjectSetup>,
  suffix = "need setup",
) {
  const surfaceIds = new Set(rows.map((row) => row.surface_id).filter(Boolean));
  const areaIds = new Set(rows.map((row) => row.area_id).filter(Boolean));
  if (surfaceIds.size) return `${surfaceIds.size} surface${surfaceIds.size === 1 ? "" : "s"} ${suffix}`;
  if (areaIds.size) return `${areaIds.size} room${areaIds.size === 1 ? "" : "s"} ${suffix}`;
  if (!setup.areaList.length) return "Add the first room";
  return "Project setup needs attention";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
