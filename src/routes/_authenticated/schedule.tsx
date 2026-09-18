import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Plus,
  Users,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button, Field, Modal, Select, TextInput } from "@/components/kit";
import { FieldReportSheet } from "@/components/FieldReportSheet";
import { useFieldReports } from "@/lib/fieldreports";
import { Chip } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  useCrews,
  useInsertRow,
  useProjects,
  useScheduleAssignments,
  useUpdateRow,
  type Project,
} from "@/lib/data";

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
  const [queueOpen, setQueueOpen] = useState(true);
  const [assignFor, setAssignFor] = useState<{ project: Project; kind: string } | null>(null);
  const [reportFor, setReportFor] = useState<{ project: Project; crewId: string | null } | null>(
    null,
  );

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
      <main className="mx-auto w-full max-w-[1480px] px-4 pb-28 md:px-7 md:pb-12">
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-border bg-gradient-to-br from-primary-soft/55 to-transparent px-4 py-5 md:px-6">
            <div className="min-w-0">
              <p className="v2-kicker mb-1">Crew-first scheduling</p>
              <h1 className="truncate text-[26px] leading-tight font-bold md:text-[34px]">
                Schedule &amp; Crews
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
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
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-card)]">
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
                    "rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors",
                    view === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-primary-soft/50 hover:text-foreground",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 px-3 py-2.5 md:px-4">
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
            <button
              type="button"
              onClick={() => setQueueOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-primary hover:bg-primary-soft/50"
            >
              <Users className="size-4" />
              Ready to assign · {unassigned.length}
              {queueOpen ? " (hide)" : " (show)"}
            </button>
          </div>

          {queueOpen ? (
            <div className="border-t border-border bg-card px-3 py-3 md:px-4">
              {unassigned.length === 0 ? (
                <p className="px-1 py-2 text-[12.5px] text-muted-foreground">
                  Every active job has a crew assignment.
                </p>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {unassigned.map((p) => {
                    const label = readyLabel(p);
                    return (
                      <div
                        key={p.id}
                        className="min-w-[236px] shrink-0 rounded-xl border border-border bg-background/70 p-3"
                      >
                        <p className="truncate text-[13px] font-bold">{p.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {p.lifecycle_stage} · readiness {p.readiness_pct ?? 0}%
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {p.next_move ?? label.text}
                        </p>
                        <div className="mt-2.5 flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setAssignFor({ project: p, kind: label.kind })}
                          >
                            <Plus className="size-3.5" /> Assign
                          </Button>
                          <Link
                            to="/projects/$projectId"
                            params={{ projectId: p.id }}
                            className="text-[11.5px] font-semibold text-primary hover:underline"
                          >
                            Open
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {view === "Week" ? (
          <section className="workspace-panel mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[130px_repeat(7,minmax(0,1fr))] border-b border-border bg-muted/30">
                  <div className="px-3 py-2.5 text-[10.5px] font-bold text-muted-foreground uppercase">
                    Crew
                  </div>
                  {weekDays.map((d, i) => {
                    const isToday = iso(d) === todayIsoDate;
                    return (
                      <div
                        key={iso(d)}
                        className={cn(
                          "px-2 py-2.5 text-center",
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
                    className="grid grid-cols-[130px_repeat(7,minmax(0,1fr))] border-b border-border/70 last:border-b-0"
                  >
                    <div className="flex items-center gap-2 px-3 py-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-chip text-[10.5px] font-bold text-secondary-foreground">
                        {crew.initials}
                      </span>
                      <span className="min-w-0 truncate text-[12.5px] font-bold">{crew.name}</span>
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
                            "min-h-[74px] border-l border-border/60 p-1.5 align-top",
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
                              <Link
                                key={a.id}
                                to="/projects/$projectId"
                                params={{ projectId: p.id }}
                                className={cn(
                                  "mb-1.5 block rounded-lg border px-2 py-1.5 transition-shadow hover:shadow-[var(--shadow-card)]",
                                  tone,
                                )}
                              >
                                <span className="block truncate text-[11.5px] font-bold">
                                  {p.name}
                                </span>
                                <span className="block truncate text-[10.5px] text-muted-foreground">
                                  {a.kind}
                                </span>
                              </Link>
                            );
                          })}
                          {cell.length === 0 ? (
                            <span className="block h-full rounded-lg border border-dashed border-border/70" />
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
          </section>
        ) : null}

        {view === "Today" ? (
          <section className="workspace-panel mt-4 overflow-hidden">
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
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: p.id }}
                        className="block truncate text-[13.5px] font-bold hover:text-primary"
                      >
                        {p.name}
                      </Link>
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
          <section className="workspace-panel mt-4 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="px-2 py-2.5 text-center text-[10.5px] font-bold text-muted-foreground uppercase"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
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
                        <Link
                          key={a.id}
                          to="/projects/$projectId"
                          params={{ projectId: p.id }}
                          className="mb-1 block truncate rounded-md border border-primary/25 bg-primary-soft px-1.5 py-1 text-[10.5px] font-semibold hover:shadow-[var(--shadow-card)]"
                        >
                          {crewById(a.crew_id)?.initials
                            ? `${crewById(a.crew_id)?.initials} · `
                            : ""}
                          {p.name}
                        </Link>
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
      </main>

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
    </>
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
    <Modal
      open
      onClose={onClose}
      title={`Schedule ${project.name}`}
      subtitle="Creates a persistent crew assignment and updates the project's next move."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onSave(values)}
            disabled={!values.crew_id}
            {...(!values.crew_id ? { disabledReason: "Choose a crew" } : {})}
          >
            Save assignment
          </Button>
        </>
      }
    >
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
      <div className="grid grid-cols-2 gap-3.5">
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
    </Modal>
  );
}
