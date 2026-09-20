import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FileText,
  Layers3,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/kit";
import { WorkItemDialog } from "@/components/work/WorkItemDialog";
import { VNextJobQuickView } from "@/components/vnext/VNextJobQuickView";
import { VNextLifecycle } from "@/components/vnext/VNextLifecycle";
import { JobIdentity, VNextPanel, WorkRow, formatDate } from "@/components/vnext/VNextPrimitives";
import {
  useAreasWithSurfaces,
  useProject,
  useScheduleAssignments,
  useUpdateProject,
  type Project,
} from "@/lib/data";
import { useFieldReports } from "@/lib/fieldreports";
import { useCompanies, useProfiles } from "@/lib/people";
import { useProjectSetup } from "@/lib/setup";
import { compareWorkItems, isComplete, useWorkFeed, type WorkItemRow } from "@/lib/workitems";
import {
  isPreAwardStage,
  nextVNextStage,
  readinessRelevant,
  stageFamily,
  storedVNextStage,
  vnextStage,
} from "@/lib/vnext";

export function VNextJobOverview() {
  const { jobId } = useParams({ from: "/_authenticated/vnext/jobs/$jobId/" });
  const { data: project, isLoading } = useProject(jobId);
  const { data: companies = [] } = useCompanies();
  const { data: profiles = [] } = useProfiles();
  const { data: feed = [] } = useWorkFeed();
  const { data: schedule = [] } = useScheduleAssignments();
  const { data: reports = [] } = useFieldReports(jobId);
  const { areas, surfaces } = useAreasWithSurfaces(jobId);
  const setup = useProjectSetup(jobId);
  const update = useUpdateProject(jobId);
  const [quickOpen, setQuickOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<WorkItemRow | null>(null);
  const work = useMemo(
    () =>
      feed.filter((item) => item.project_id === jobId && !isComplete(item)).sort(compareWorkItems),
    [feed, jobId],
  );
  if (isLoading) return <div className="p-10 text-[12px] text-vnext-muted">Loading job…</div>;
  if (!project)
    return (
      <div className="p-10">
        <p className="font-display text-xl font-bold">Job not found</p>
        <Link to="/vnext/jobs" className="mt-3 inline-flex text-sm font-bold text-vnext-blue">
          Back to Jobs
        </Link>
      </div>
    );
  const stage = vnextStage(project);
  const family = stageFamily(stage);
  const nextStage = nextVNextStage(stage);
  const customer =
    companies.find((item) => item.id === project.customer_company_id)?.name ?? project.customer;
  const ownerId = isPreAwardStage(stage) ? project.estimator_user_id : project.pm_user_id;
  const owner =
    profiles.find((item) => item.user_id === ownerId)?.full_name ??
    project.project_manager ??
    project.next_move_owner;
  const upcoming = schedule
    .filter(
      (item) =>
        item.project_id === jobId && item.work_date >= new Date().toISOString().slice(0, 10),
    )
    .sort((a, b) => a.work_date.localeCompare(b.work_date))[0];
  const canAdvance =
    nextStage &&
    !(nextStage === "Ready" && setup.blockers.length > 0) &&
    !(nextStage === "Scheduled" && !upcoming) &&
    !(nextStage === "Complete" && work.length > 0);
  const disabledReason = nextStage
    ? advanceBlock(nextStage, setup.blockers.length, Boolean(upcoming), work.length)
    : undefined;
  const advance = async () => {
    if (!nextStage || !canAdvance) return;
    await update.mutateAsync({
      lifecycle_stage: storedVNextStage(nextStage),
      ...(nextStage === "Awarded" ? { awarded_at: new Date().toISOString() } : {}),
    });
    toast.success(`Job advanced to ${nextStage}`);
  };
  const nextMove = project.next_move ?? work[0]?.title ?? fallback(family);
  const rooms = areas.data ?? [];
  const surfaceRows = surfaces.data ?? [];
  return (
    <div className="mx-auto max-w-[1460px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
      <div className="flex items-center justify-between">
        <Link
          to="/vnext/jobs"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-vnext-muted hover:text-vnext-ink"
        >
          <ArrowLeft className="size-3.5" /> Jobs
        </Link>
        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          className="text-[11px] font-bold text-vnext-blue"
        >
          Open quick view
        </button>
      </div>
      <header className="mt-4 overflow-hidden rounded-[18px] border border-vnext-line bg-vnext-surface shadow-[var(--vnext-shadow-panel)]">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
          <JobIdentity project={project} customer={customer} stage={stage} />
          <div className="grid grid-cols-2 gap-2 sm:min-w-[360px]">
            <HeaderFact label="Owner" value={owner ?? "Unassigned"} />
            <HeaderFact
              label="Relevant date"
              value={formatDate(
                isPreAwardStage(stage)
                  ? (project.follow_up_date ?? project.bid_due_date)
                  : (upcoming?.work_date ?? project.target_date),
              )}
            />
          </div>
        </div>
        <div className="border-t border-vnext-line bg-vnext-wash/55 px-4 py-3 sm:px-7">
          <VNextLifecycle stage={stage} />
        </div>
        <nav
          className="flex gap-1 overflow-x-auto border-t border-vnext-line px-3 sm:px-6"
          aria-label="Job sections"
        >
          <Tab to="/vnext/jobs/$jobId" jobId={jobId} label="Overview" active />
          <Tab
            to="/vnext/jobs/$jobId/estimate"
            jobId={jobId}
            label={isPreAwardStage(stage) ? "Estimate / Scope" : "Estimate history"}
          />
          <LegacyTab to="/projects/$projectId/scope" id={jobId} label="Rooms" />
          <LegacyTab to="/projects/$projectId/tasks" id={jobId} label="Work" />
          <LegacyTab to="/projects/$projectId/files" id={jobId} label="Files" />
          <LegacyTab to="/projects/$projectId/updates" id={jobId} label="More" />
        </nav>
      </header>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.75fr)]">
        <div className="space-y-5">
          <section className="grid overflow-hidden rounded-[18px] border border-vnext-ink bg-vnext-ink text-vnext-surface shadow-[var(--vnext-shadow-float)] sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="p-6 sm:p-8">
              <p className="vnext-kicker text-vnext-blue-soft">Where the job stands</p>
              <h2 className="mt-3 max-w-[30ch] font-display text-[26px] leading-[1.18] font-bold sm:text-[31px]">
                {nextMove}
              </h2>
              <p className="mt-3 max-w-[70ch] text-[12px] leading-5 text-vnext-surface/65">
                {contextLine(project, stage, work.length, setup.blockers.length)}
              </p>
            </div>
            {nextStage ? (
              <div className="flex items-end border-t border-vnext-surface/10 p-5 sm:w-[220px] sm:border-t-0 sm:border-l">
                <Button
                  variant="secondary"
                  className="w-full border-vnext-surface/20 bg-vnext-surface text-vnext-ink"
                  disabled={!canAdvance || update.isPending}
                  {...(disabledReason ? { disabledReason } : {})}
                  onClick={() => void advance()}
                >
                  Advance to {nextStage} <ArrowRight className="size-3.5" />
                </Button>
              </div>
            ) : null}
          </section>
          <StageOverview
            family={family}
            project={project}
            rooms={rooms.length}
            surfaces={surfaceRows.length}
            files={setup.fileList.length}
            blockers={setup.blockers}
            scheduleDate={upcoming?.work_date}
            latestReport={reports[0]?.progress_note ?? reports[0]?.blockers ?? null}
            work={work}
          />
          <VNextPanel title="Open actions" eyebrow="Move the job forward">
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {work.map((item) => (
                <WorkRow key={item.id} item={item} onClick={() => setSelectedWork(item)} />
              ))}
              {!work.length ? (
                <p className="p-3 text-[11.5px] text-vnext-muted">No open work remains.</p>
              ) : null}
            </div>
          </VNextPanel>
        </div>
        <div className="space-y-5">
          <VNextPanel title="Job pulse">
            <div className="grid grid-cols-2 gap-px bg-vnext-line">
              <Pulse icon={Layers3} label="Rooms" value={String(rooms.length)} />
              <Pulse icon={ClipboardList} label="Surfaces" value={String(surfaceRows.length)} />
              <Pulse icon={FileText} label="Files" value={String(setup.fileList.length)} />
              <Pulse icon={CircleAlert} label="Open actions" value={String(work.length)} />
            </div>
          </VNextPanel>
          <VNextPanel title="Recent activity">
            <div className="space-y-4 p-4">
              {reports.slice(0, 4).map((report) => (
                <div
                  key={report.id}
                  className="relative pl-4 before:absolute before:top-1 before:bottom-[-16px] before:left-[3px] before:w-px before:bg-vnext-line last:before:hidden after:absolute after:top-1 after:left-0 after:size-[7px] after:rounded-full after:bg-vnext-blue"
                >
                  <p className="text-[10px] font-extrabold text-vnext-faint uppercase">
                    {formatDate(report.report_date)}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-5">
                    {report.progress_note ?? report.notes ?? "Field update submitted"}
                  </p>
                </div>
              ))}
              {!reports.length ? (
                <p className="text-[11.5px] text-vnext-muted">
                  Activity appears here as the job moves.
                </p>
              ) : null}
            </div>
          </VNextPanel>
        </div>
      </div>
      <VNextJobQuickView jobId={quickOpen ? jobId : null} onClose={() => setQuickOpen(false)} />
      <WorkItemDialog item={selectedWork} onClose={() => setSelectedWork(null)} />
    </div>
  );
}

function StageOverview({
  family,
  project,
  rooms,
  surfaces,
  files,
  blockers,
  scheduleDate,
  latestReport,
  work,
}: {
  family: ReturnType<typeof stageFamily>;
  project: Project;
  rooms: number;
  surfaces: number;
  files: number;
  blockers: { id: string; label: string; detail: string | null }[];
  scheduleDate: string | undefined;
  latestReport: string | null;
  work: WorkItemRow[];
}) {
  if (family === "preaward")
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <VNextPanel title="Estimate position" eyebrow="Commercial path">
          <div className="grid grid-cols-2 gap-px bg-vnext-line">
            <Metric label="Bid due" value={formatDate(project.bid_due_date)} />
            <Metric label="Follow-up" value={formatDate(project.follow_up_date)} />
            <Metric label="Plans / files" value={String(files)} />
            <Metric label="Scope rooms" value={String(rooms)} />
          </div>
        </VNextPanel>
        <VNextPanel title="Request brief" eyebrow="What is being priced">
          <p className="p-5 text-[12px] leading-5 text-vnext-muted">
            {project.intake_notes ?? "No intake or scope notes have been recorded."}
          </p>
        </VNextPanel>
      </div>
    );
  if (family === "setup")
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <VNextPanel title="Rooms & surfaces" eyebrow="Source of truth">
          <div className="grid grid-cols-2 gap-px bg-vnext-line">
            <Metric label="Rooms" value={String(rooms)} />
            <Metric label="Surfaces" value={String(surfaces)} />
          </div>
          <p className="p-4 text-[11.5px] text-vnext-muted">
            Selections, measurements, decisions and installer instructions resolve at the physical
            surface.
          </p>
        </VNextPanel>
        <VNextPanel title="Readiness — why">
          <div className="space-y-2 p-4">
            {blockers.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-lg bg-vnext-amber-soft px-3 py-2">
                <strong className="block text-[11.5px]">{item.label}</strong>
                <span className="text-[10.5px] text-vnext-muted">
                  {item.detail ?? "Requirement is not met"}
                </span>
              </div>
            ))}
            {!blockers.length ? (
              <p className="text-[12px] font-bold text-vnext-green">Upcoming work is ready.</p>
            ) : null}
          </div>
        </VNextPanel>
      </div>
    );
  if (family === "scheduled")
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <VNextPanel title="Start plan">
          <div className="grid grid-cols-2 gap-px bg-vnext-line">
            <Metric label="Date" value={formatDate(scheduleDate ?? project.start_date)} />
            <Metric label="Crew" value={project.crew_lead ?? "Unassigned"} />
          </div>
        </VNextPanel>
        <VNextPanel title="Start protection">
          <p className="p-5 text-[12px] leading-5 text-vnext-muted">
            {blockers.length
              ? `${blockers.length} recorded requirement${blockers.length === 1 ? "" : "s"} could threaten the start.`
              : "No readiness threat is recorded for the scheduled start."}
          </p>
        </VNextPanel>
      </div>
    );
  if (family === "installation")
    return (
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <VNextPanel title="Physical progress" eyebrow="Installation">
          <div className="p-6">
            <strong className="font-display text-[42px]">{project.installation_progress}%</strong>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-vnext-wash">
              <span
                className="block h-full rounded-full bg-vnext-blue"
                style={{ width: `${Math.max(0, Math.min(100, project.installation_progress))}%` }}
              />
            </div>
          </div>
        </VNextPanel>
        <VNextPanel title="Latest field position">
          <p className="p-5 text-[12px] leading-5 text-vnext-muted">
            {latestReport ?? "No field update has been submitted."}
          </p>
        </VNextPanel>
      </div>
    );
  if (family === "punch")
    return (
      <VNextPanel title="Punch / return work" eyebrow="Finish cleanly">
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {work
            .filter((item) => /punch|return/i.test(item.item_type))
            .map((item) => (
              <WorkRow key={item.id} item={item} />
            ))}
          {!work.some((item) => /punch|return/i.test(item.item_type)) ? (
            <p className="text-[11.5px] text-vnext-muted">No open punch or return items.</p>
          ) : null}
        </div>
      </VNextPanel>
    );
  if (family === "billing")
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <VNextPanel title="Billing position">
          <p className="p-5 text-[12px] text-vnext-muted">
            A dedicated invoice status and change-order ledger are not stored yet. Existing closeout
            actions remain visible.
          </p>
        </VNextPanel>
        <VNextPanel title="Closeout actions">
          <div className="space-y-2 p-3">
            {work.map((item) => (
              <WorkRow key={item.id} item={item} />
            ))}
          </div>
        </VNextPanel>
      </div>
    );
  return (
    <VNextPanel title="Job complete">
      <div className="flex items-center gap-3 p-5 text-vnext-green">
        <CheckCircle2 className="size-5" />
        <span className="text-[12px] font-bold">
          The full operating record remains available for reference.
        </span>
      </div>
    </VNextPanel>
  );
}
function Tab({
  to,
  jobId,
  label,
  active = false,
}: {
  to: "/vnext/jobs/$jobId" | "/vnext/jobs/$jobId/estimate";
  jobId: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      params={{ jobId }}
      className={`flex h-11 shrink-0 items-center border-b-2 px-3 text-[11.5px] font-bold ${active ? "border-vnext-blue text-vnext-blue" : "border-transparent text-vnext-muted"}`}
    >
      {label}
    </Link>
  );
}
function LegacyTab({
  to,
  id,
  label,
}: {
  to:
    | "/projects/$projectId/scope"
    | "/projects/$projectId/tasks"
    | "/projects/$projectId/files"
    | "/projects/$projectId/updates";
  id: string;
  label: string;
}) {
  return (
    <Link
      to={to}
      params={{ projectId: id }}
      className="flex h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-[11.5px] font-bold text-vnext-muted"
    >
      {label}
    </Link>
  );
}
function HeaderFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-vnext-line bg-vnext-wash px-3 py-2">
      <span className="block text-[8.5px] font-extrabold text-vnext-faint uppercase">{label}</span>
      <strong className="mt-0.5 block truncate text-[11px]">{value}</strong>
    </div>
  );
}
function Pulse({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-vnext-surface p-4">
      <Icon className="size-4 text-vnext-blue" />
      <strong className="mt-2 block font-display text-[22px]">{value}</strong>
      <span className="text-[9px] font-extrabold text-vnext-faint uppercase">{label}</span>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-vnext-surface p-5">
      <span className="text-[9px] font-extrabold text-vnext-faint uppercase">{label}</span>
      <strong className="mt-1 block text-[14px]">{value}</strong>
    </div>
  );
}
function fallback(family: ReturnType<typeof stageFamily>) {
  return {
    preaward: "Complete scope review and move the estimate forward",
    setup: "Resolve the next room or decision blocker",
    scheduled: "Protect the scheduled start",
    installation: "Move the next room toward completion",
    punch: "Clear the next return item",
    billing: "Finish billing and closeout",
    complete: "Job complete",
  }[family];
}
function contextLine(
  project: { intake_notes?: string | null; readiness_note?: string | null },
  stage: ReturnType<typeof vnextStage>,
  open: number,
  blockers: number,
) {
  if (isPreAwardStage(stage))
    return project.intake_notes ?? `${open} open estimating action${open === 1 ? "" : "s"}.`;
  if (readinessRelevant(stage))
    return blockers
      ? `${blockers} readiness requirement${blockers === 1 ? "" : "s"} need attention. ${project.readiness_note ?? ""}`
      : "No current readiness blocker prevents the next planned work.";
  return `${open} open operating action${open === 1 ? "" : "s"} remain visible on this job.`;
}
function advanceBlock(next: string, blockers: number, scheduled: boolean, open: number) {
  if (next === "Ready" && blockers) return `${blockers} readiness blockers remain`;
  if (next === "Scheduled" && !scheduled) return "Create a crew assignment first";
  if (next === "Complete" && open) return `${open} open actions must be reviewed`;
  return undefined;
}
