import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flag,
  RefreshCw,
  Users,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button, Field, KpiCard, Modal, SectionCard, Select, TextInput } from "@/components/kit";
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
        content: "View crew schedules, manage assignments and plan the week ahead.",
      },
      { property: "og:title", content: "Schedule & Crews — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Weekly crew lanes, unassigned jobs and return visits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SchedulePage,
});

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

function SchedulePage() {
  const { data: crews = [] } = useCrews();
  const { data: projects = [] } = useProjects();
  const { data: assignments = [] } = useScheduleAssignments();
  const insertAssignment = useInsertRow("schedule_assignments");
  const updateProject = useUpdateRow("projects");
  const [weekOffset, setWeekOffset] = useState(0);
  const [assignFor, setAssignFor] = useState<{ project: Project; kind: string } | null>(null);

  const start = mondayOf(new Date());
  start.setDate(start.getDate() + weekOffset * 7);
  const days = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekIsos = days.map(iso);
  const weekAssignments = assignments.filter((a) => weekIsos.includes(a.work_date));

  const projectById = (id: string) => projects.find((p) => p.id === id);
  const crewsWorking = new Set(weekAssignments.map((a) => a.crew_id)).size;
  const unassigned = projects.filter(
    (p) =>
      !p.exception_state &&
      !["Complete", "New Submission", "Estimating", "Proposal"].includes(p.lifecycle_stage) &&
      !assignments.some((a) => a.project_id === p.id && a.crew_id),
  );
  const returnVisits = weekAssignments.filter((a) => a.kind === "Return Visit");
  const finishingSoon = projects.filter((p) => p.lifecycle_stage === "Closeout / Return");

  const readyToAssign = projects
    .filter((p) => ["Closeout / Return", "Ready", "Setup"].includes(p.lifecycle_stage))
    .slice(0, 4);

  const readyLabel = (p: Project) =>
    p.lifecycle_stage === "Closeout / Return"
      ? p.needs_attention
        ? { text: "Confirm touch-ups", kind: "Return Visit" }
        : { text: "Assign return visit", kind: "Return Visit" }
      : p.lifecycle_stage === "Ready"
        ? { text: "Assign crew and resume", kind: "Tile / Grout" }
        : { text: "Start setup", kind: "Tile / Grout" };

  return (
    <>
      <AppHeader crumbs={[{ label: "Schedule & Crews" }]} />
      <div className="mx-auto max-w-7xl mx-auto px-8 pt-8 pb-16">
        <h1 className="text-[30px] leading-tight font-bold tracking-[-0.02em]">
          Schedule &amp; Crews
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          View crew schedules, manage assignments and plan the week ahead.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground tabular-nums">{crewsWorking}</span> of{" "}
            {crews.length} crews working today
          </span>
          <span>
            <span className="font-semibold text-foreground tabular-nums">{unassigned.length}</span>{" "}
            jobs ready to assign
          </span>
          <span>
            <span className="font-semibold text-foreground tabular-nums">
              {returnVisits.length}
            </span>{" "}
            return visits this week
          </span>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_320px] items-start gap-5">
          <SectionCard
            title="Weekly Crew Schedule"
            icon={<CalendarDays className="size-[18px] text-primary" />}
            actions={
              <>
                <Button size="sm" onClick={() => setWeekOffset(0)}>
                  Today
                </Button>
                <Button
                  size="sm"
                  onClick={() => setWeekOffset((w) => w - 1)}
                  aria-label="Previous week"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => setWeekOffset((w) => w + 1)}
                  aria-label="Next week"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr>
                    <th className="w-[110px] border-b border-border px-4 py-2.5 text-left text-[11.5px] font-semibold text-muted-foreground">
                      Crew
                    </th>
                    {days.map((d, i) => (
                      <th
                        key={i}
                        className="border-b border-border px-2 py-2.5 text-center text-[12px] font-semibold"
                      >
                        {DAY_LABELS[i]}
                        <div className="text-[11px] font-normal text-muted-foreground">
                          {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {crews.map((crew) => (
                    <tr key={crew.id}>
                      <td className="border-b border-border/70 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="grid size-7 place-items-center rounded-full bg-muted text-[10.5px] font-bold text-secondary-foreground">
                            {crew.initials}
                          </span>
                          <span className="text-[13px] font-semibold">{crew.name}</span>
                        </div>
                      </td>
                      {crew.is_open_lane ? (
                        <td colSpan={6} className="border-b border-border/70 px-3 py-3 text-center">
                          <div className="rounded-lg border border-dashed border-border-strong py-3 text-[12.5px] text-muted-foreground">
                            Open for assignment
                          </div>
                        </td>
                      ) : (
                        days.map((d) => {
                          const day = iso(d);
                          const cell = weekAssignments.filter(
                            (a) => a.crew_id === crew.id && a.work_date === day,
                          );
                          return (
                            <td
                              key={day}
                              className="border-b border-border/70 px-1.5 py-2 align-top"
                            >
                              {cell.map((a) => {
                                const p = projectById(a.project_id);
                                const tone =
                                  a.kind === "Return Visit"
                                    ? "border-info/40 bg-info-soft"
                                    : crew.tone === "green"
                                      ? "border-success/40 bg-success-soft"
                                      : crew.tone === "blue"
                                        ? "border-info/40 bg-info-soft"
                                        : crew.tone === "amber"
                                          ? "border-warning/40 bg-warning-soft"
                                          : "border-primary/30 bg-primary-soft";
                                return p ? (
                                  <Link
                                    key={a.id}
                                    to="/projects/$projectId"
                                    params={{ projectId: p.id }}
                                    className={cn(
                                      "mb-1.5 block rounded-lg border px-2 py-1.5 text-left transition-shadow hover:shadow-[var(--shadow-card)]",
                                      tone,
                                    )}
                                  >
                                    <div className="truncate text-[11.5px] font-semibold text-foreground">
                                      {p.name}
                                    </div>
                                    <div className="truncate text-[10.5px] text-muted-foreground">
                                      {a.kind}
                                    </div>
                                  </Link>
                                ) : null;
                              })}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Ready to Assign"
            icon={<Users className="size-[18px] text-primary" />}
            bodyClassName="divide-y divide-border"
          >
            {readyToAssign.map((p) => {
              const label = readyLabel(p);
              return (
                <div key={p.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: p.id }}
                      className="block truncate text-[13px] font-semibold text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="truncate text-[12px] text-muted-foreground">{label.text}</div>
                  </div>
                  <Button size="sm" onClick={() => setAssignFor({ project: p, kind: label.kind })}>
                    {label.text.split(" ").slice(0, 2).join(" ")}
                  </Button>
                </div>
              );
            })}
            <Link
              to="/projects"
              className="block px-5 py-3.5 text-[12.5px] font-semibold text-primary hover:underline"
            >
              View all unassigned jobs →
            </Link>
          </SectionCard>
        </div>
      </div>

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
                next_move:
                  values.kind === "Return Visit"
                    ? `Return visit scheduled for ${values.work_date}`
                    : `Crew ${crewName ?? "TBD"} scheduled for ${values.work_date}`,
                next_move_owner: "Office",
                ...(assignFor.project.lifecycle_stage === "Ready"
                  ? { lifecycle_stage: "Scheduled" }
                  : {}),
              },
            });
            setAssignFor(null);
          }}
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
