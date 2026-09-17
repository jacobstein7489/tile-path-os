import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
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

/**
 * The operating brief for one job: a single document column of plain-language
 * sections. No cards, no metrics — every line is derived from the live
 * readiness, work, schedule and field-report data already in the app.
 */
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

  return (
    <>
      <div className="mx-auto w-full max-w-[960px] px-4 pt-7 pb-24 md:px-8 md:pt-9">
        <Brief label="Where we are">
          <p className="text-[17px] leading-relaxed font-semibold tracking-[-0.01em] md:text-[19px]">
            {stage}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-6 text-secondary-foreground">{whereWeAre}</p>
        </Brief>

        <Brief label="Next move">
          {next.work ? (
            <button
              type="button"
              onClick={() => setActive(next.work ?? null)}
              className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-end gap-4 text-left"
            >
              <span className="min-w-0">
                <span className="block text-[21px] leading-tight font-bold tracking-[-0.02em] md:text-[26px]">
                  {next.title}
                </span>
                <span className="mt-1.5 block text-[12.5px] text-muted-foreground">{next.detail}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 pb-1 text-[12.5px] font-semibold text-primary">
                Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ) : next.to ? (
            <Link
              to={next.to}
              params={{ projectId }}
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4"
            >
              <span className="min-w-0">
                <span className="block text-[21px] leading-tight font-bold tracking-[-0.02em] md:text-[26px]">
                  {next.title}
                </span>
                <span className="mt-1.5 block text-[12.5px] text-muted-foreground">{next.detail}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 pb-1 text-[12.5px] font-semibold text-primary">
                Continue <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ) : (
            <div>
              <p className="text-[21px] leading-tight font-bold md:text-[26px]">{next.title}</p>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">{next.detail}</p>
            </div>
          )}
        </Brief>

        <Brief
          label="Waiting / blocked"
          right={
            waitingAll.length > 3 ? (
              <Link
                to="/projects/$projectId/tasks"
                params={{ projectId }}
                className="text-[11.5px] font-semibold text-primary hover:underline"
              >
                View all {waitingAll.length}
              </Link>
            ) : null
          }
        >
          {waiting.length ? (
            <ul>
              {waiting.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setActive(item)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-border py-2.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">{item.title}</span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                        {item.waiting_on ?? "External confirmation"}
                      </span>
                    </span>
                    {item.follow_up_on ? (
                      <span className="shrink-0 text-[11.5px] text-warning">
                        Follow up {formatDate(item.follow_up_on)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">Nothing currently blocking work.</p>
          )}
        </Brief>

        <Brief label="Upcoming">
          {upcoming.length ? (
            <ul>
              {upcoming.slice(0, 3).map((s) => (
                <li
                  key={s.id}
                  className="grid grid-cols-[110px_minmax(0,1fr)] gap-4 border-b border-border py-2.5"
                >
                  <span className="text-[12.5px] font-semibold tabular-nums">
                    {formatDate(s.work_date)}
                  </span>
                  <span className="min-w-0 text-[13px]">
                    {s.kind}
                    {s.notes ? (
                      <span className="text-muted-foreground"> · {s.notes}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">Nothing scheduled yet.</p>
          )}
        </Brief>

        <Brief label="Readiness">
          <p
            className={cn(
              "text-[15px] font-bold",
              conclusion.tone === "green"
                ? "text-success"
                : conclusion.tone === "amber"
                  ? "text-warning"
                  : "text-muted-foreground",
            )}
          >
            {conclusion.label}
          </p>
          {reasons.length ? (
            <ul className="mt-2">
              {reasons.map((r) => (
                <li
                  key={r.category}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border py-2 text-[13px]"
                >
                  <span className="min-w-0 truncate">{r.category}</span>
                  <span className="shrink-0 text-[12px] text-warning">{r.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">
              {evaluated
                ? "Every setup requirement on this job is satisfied."
                : "Readiness starts once rooms and surfaces exist."}
            </p>
          )}
          <Link
            to="/projects/$projectId/scope"
            params={{ projectId }}
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary"
          >
            Open rooms &amp; surfaces <ArrowRight className="size-3.5" />
          </Link>
        </Brief>

        <Brief
          label="Latest update"
          right={
            <Link
              to="/projects/$projectId/updates"
              params={{ projectId }}
              className="text-[11.5px] font-semibold text-primary hover:underline"
            >
              All updates
            </Link>
          }
        >
          {latest ? (
            <>
              <p className="text-[11.5px] font-semibold text-secondary-foreground">
                {formatDate(latest.report_date)}
                {latest.crew_label ? ` · ${latest.crew_label}` : ""}
              </p>
              <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-6 whitespace-pre-line">
                {latest.progress_note ?? "Update submitted without a progress note."}
              </p>
              {latest.blockers ? (
                <p className="mt-2 text-[12.5px] text-warning">Waiting · {latest.blockers}</p>
              ) : null}
            </>
          ) : (
            <p className="text-[13.5px] text-muted-foreground">No daily update has been submitted.</p>
          )}
        </Brief>

        {roomRows.length ? (
          <Brief label="Room readiness" last>
            <ul>
              {roomRows.map((room) => (
                <li key={room.id}>
                  <Link
                    to="/projects/$projectId/scope"
                    params={{ projectId }}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-border py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <span className="min-w-0 truncate text-[13.5px] font-semibold">{room.name}</span>
                    <span
                      className={cn(
                        "shrink-0 text-[12px]",
                        room.ok ? "text-success" : "text-warning",
                      )}
                    >
                      {room.note}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Brief>
        ) : null}
      </div>

      <WorkItemPanel item={live} onClose={() => setActive(null)} />
    </>
  );
}

/** One labelled band of the brief. Rules and whitespace only — never a card. */
function Brief({
  label,
  right,
  children,
  last,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={cn("py-6 md:py-7", !last && "border-b border-border")}>
      <div className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)] md:gap-8">
        <div className="flex items-baseline justify-between gap-3 md:block">
          <h2 className="text-[10px] font-bold tracking-[0.09em] text-secondary-foreground uppercase">
            {label}
          </h2>
          {right ? <span className="md:mt-2 md:block">{right}</span> : null}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
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
