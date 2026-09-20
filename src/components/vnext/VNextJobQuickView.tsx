import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, ClipboardList, FileText, Layers3, MapPin, UserRound } from "lucide-react";
import { CenterDialog } from "@/components/ops/CenterDialog";
import { Button } from "@/components/kit";
import { WorkItemPanel } from "@/components/work/WorkItemPanel";
import { VNextLifecycle } from "@/components/vnext/VNextLifecycle";
import { JobIdentity, VNextPanel, WorkRow, formatDate } from "@/components/vnext/VNextPrimitives";
import { useAreasWithSurfaces, useProject, useScheduleAssignments, type Project } from "@/lib/data";
import { useFieldReports } from "@/lib/fieldreports";
import { useCompanies, useProfiles } from "@/lib/people";
import { useProjectFiles } from "@/lib/setup";
import { compareWorkItems, isComplete, useWorkFeed } from "@/lib/workitems";
import { isPreAwardStage, readinessRelevant, stageFamily, vnextStage } from "@/lib/vnext";

export function VNextJobQuickView({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  if (!jobId) return null;
  return <VNextJobQuickViewLoaded jobId={jobId} onClose={onClose} />;
}

function VNextJobQuickViewLoaded({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data: project } = useProject(jobId);
  const { data: companies = [] } = useCompanies();
  const { data: profiles = [] } = useProfiles();
  const { data: feed = [] } = useWorkFeed();
  const { data: schedule = [] } = useScheduleAssignments();
  const { data: reports = [] } = useFieldReports(jobId);
  const { data: files = [] } = useProjectFiles(jobId);
  const { areas, surfaces } = useAreasWithSurfaces(jobId);
  const [selectedWork, setSelectedWork] = useState<import("@/lib/workitems").WorkItemRow | null>(null);
  if (!project) return null;
  const stage = vnextStage(project); const family = stageFamily(stage);
  const work = feed.filter((item) => item.project_id === jobId && !isComplete(item)).sort(compareWorkItems);
  const customer = companies.find((item) => item.id === project.customer_company_id)?.name ?? project.customer;
  const owner = profiles.find((item) => item.user_id === (isPreAwardStage(stage) ? project.estimator_user_id : project.pm_user_id))?.full_name ?? project.project_manager ?? project.next_move_owner;
  const nextSchedule = schedule.filter((item) => item.project_id === jobId && item.work_date >= new Date().toISOString().slice(0, 10)).sort((a,b) => a.work_date.localeCompare(b.work_date))[0];
  const areaCount = areas.data?.length ?? 0; const surfaceCount = surfaces.data?.length ?? 0;
  return <CenterDialog open onOpenChange={(next) => !next && onClose()} title={project.name} description="VNext job operating workspace" className="sm:max-w-[1140px]" bodyClassName="bg-vnext-canvas">
    <div className="vnext min-h-full">
      {selectedWork ? <><header className="sticky top-0 z-20 flex items-center gap-3 border-b border-vnext-line bg-vnext-surface px-5 py-3"><Button size="sm" onClick={() => setSelectedWork(null)}>Back to job</Button><span className="truncate text-[11px] font-bold text-vnext-muted">{project.name}</span></header><div className="p-3 sm:p-5"><WorkItemPanel item={selectedWork} compact /></div></> : <>
      <header className="sticky top-0 z-20 border-b border-vnext-line bg-vnext-surface/97 px-5 py-4 backdrop-blur sm:px-7">
        <div className="flex items-start justify-between gap-4"><JobIdentity project={project} customer={customer} stage={stage} /><Link to="/vnext/jobs/$jobId" params={{ jobId }} className="mr-8 hidden h-9 items-center gap-2 rounded-lg bg-vnext-ink px-3.5 text-[11.5px] font-bold text-vnext-surface sm:flex">Open full job <ArrowRight className="size-3.5" /></Link></div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[10.5px] sm:grid-cols-4"><Fact icon={UserRound} label="Owner" value={owner ?? "Unassigned"} /><Fact icon={MapPin} label="Address" value={project.address ?? "Not set"} /><Fact icon={CalendarDays} label="Relevant date" value={formatDate(isPreAwardStage(stage) ? project.follow_up_date ?? project.bid_due_date : nextSchedule?.work_date ?? project.target_date)} /><Fact icon={ClipboardList} label="Open actions" value={String(work.length)} /></div>
      </header>
      <div className="border-b border-vnext-line bg-vnext-surface px-5 py-3 sm:px-7"><VNextLifecycle stage={stage} compact /></div>
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-[16px] bg-vnext-ink p-5 text-vnext-surface shadow-[var(--vnext-shadow-float)] sm:p-6"><p className="vnext-kicker text-vnext-blue-soft">Where the job stands</p><h3 className="mt-3 max-w-[28ch] font-display text-[23px] leading-tight font-bold">{project.next_move ?? nextMoveFallback(family)}</h3><p className="mt-2 max-w-[70ch] text-[12px] leading-5 text-vnext-surface/70">{stageContext(project, family, work.length, nextSchedule?.work_date)}</p></section>
          <StageBody family={family} project={project} work={work} files={files.length} areas={areaCount} surfaces={surfaceCount} nextSchedule={nextSchedule?.work_date} report={reports[0]?.progress_note ?? reports[0]?.blockers ?? null} />
        </div>
        <div className="space-y-4">
          <VNextPanel title="Open actions" eyebrow={`${work.length} active`}>{work.length ? <div className="space-y-2 p-3">{work.map((item) => <WorkRow key={item.id} item={item} onClick={() => setSelectedWork(item)} />)}</div> : <Empty text="No open actions on this job." />}</VNextPanel>
          <VNextPanel title="Recent activity"><div className="space-y-3 p-4">{reports.slice(0,3).map((report) => <div key={report.id} className="border-l-2 border-vnext-blue-soft pl-3"><p className="text-[11px] font-bold">{formatDate(report.report_date)} · {report.submitted_by_name ?? "Field update"}</p><p className="mt-1 text-[11px] leading-4 text-vnext-muted">{report.progress_note ?? report.notes ?? "Update submitted"}</p></div>)}{!reports.length ? <p className="text-[11.5px] text-vnext-muted">No field activity yet.</p> : null}</div></VNextPanel>
        </div>
      </div>
      <div className="border-t border-vnext-line bg-vnext-surface px-5 py-3 sm:hidden"><Link to="/vnext/jobs/$jobId" params={{ jobId }} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-vnext-ink text-[12px] font-bold text-vnext-surface">Open full job <ArrowRight className="size-4" /></Link></div>
      </>}
    </div>
  </CenterDialog>;
}

function StageBody({ family, project, work, files, areas, surfaces, nextSchedule, report }: { family: ReturnType<typeof stageFamily>; project: Project; work: import("@/lib/workitems").WorkItemRow[]; files: number; areas: number; surfaces: number; nextSchedule: string | undefined; report: string | null }) {
  if (family === "preaward") return <div className="grid gap-4 sm:grid-cols-2"><VNextPanel title="Estimate & proposal" eyebrow="Pre-award"><div className="grid grid-cols-2 gap-px bg-vnext-line"><Metric label="Bid due" value={formatDate(project.bid_due_date)} /><Metric label="Follow-up" value={formatDate(project.follow_up_date)} /><Metric label="Plans / files" value={String(files)} /><Metric label="Revision" value="Not tracked" /></div></VNextPanel><VNextPanel title="Scope at a glance"><div className="p-4"><p className="text-[12px] leading-5 text-vnext-muted">{project.intake_notes ?? "No request notes have been recorded."}</p><div className="mt-4 flex gap-5"><Metric label="Rooms" value={String(areas)} /><Metric label="Surfaces" value={String(surfaces)} /></div></div></VNextPanel></div>;
  if (family === "setup") return <div className="grid gap-4 sm:grid-cols-2"><VNextPanel title="Rooms & decisions" eyebrow="Physical scope"><div className="grid grid-cols-2 gap-px bg-vnext-line"><Metric label="Rooms" value={String(areas)} /><Metric label="Surfaces" value={String(surfaces)} /></div><p className="p-4 text-[11.5px] text-vnext-muted">Selections and design decisions remain anchored to the room and surface records.</p></VNextPanel><VNextPanel title="Can upcoming work proceed?" eyebrow="Readiness"><div className="p-4"><strong className="text-[17px]">{project.readiness_pct >= 100 ? "Ready" : project.readiness_pct > 0 ? "Partial" : "Not ready"}</strong><p className="mt-2 text-[11.5px] leading-5 text-vnext-muted">{project.readiness_note ?? "Review the room and surface requirements for the specific reason."}</p></div></VNextPanel></div>;
  if (family === "scheduled") return <div className="grid gap-4 sm:grid-cols-2"><VNextPanel title="Start plan"><div className="grid grid-cols-2 gap-px bg-vnext-line"><Metric label="Start" value={formatDate(nextSchedule ?? project.start_date)} /><Metric label="Crew" value={project.crew_lead ?? "Unassigned"} /></div></VNextPanel><VNextPanel title="Start readiness"><div className="p-4"><strong className="text-[17px]">{project.readiness_pct >= 100 ? "Ready" : "Start needs review"}</strong><p className="mt-2 text-[11.5px] text-vnext-muted">{project.readiness_note ?? "No readiness threat is recorded."}</p></div></VNextPanel></div>;
  if (family === "installation") return <div className="grid gap-4 sm:grid-cols-[0.7fr_1.3fr]"><VNextPanel title="Installed"><div className="p-5"><strong className="font-display text-[34px]">{project.installation_progress}%</strong><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-vnext-wash"><span className="block h-full rounded-full bg-vnext-blue" style={{ width: `${Math.min(100, Math.max(0, project.installation_progress))}%` }} /></div></div></VNextPanel><VNextPanel title="Latest field position"><div className="p-4 text-[12px] leading-5 text-vnext-muted">{report ?? "No field update has been submitted."}</div></VNextPanel></div>;
  if (family === "punch") return <VNextPanel title="Punch / return position"><div className="grid grid-cols-2 gap-px bg-vnext-line"><Metric label="Open return items" value={String(work.filter((item) => /punch|return/i.test(item.item_type)).length)} /><Metric label="All open actions" value={String(work.length)} /></div></VNextPanel>;
  if (family === "billing") return <VNextPanel title="Closeout position"><div className="grid grid-cols-2 gap-px bg-vnext-line"><Metric label="Open closeout items" value={String(work.length)} /><Metric label="Billing status" value="Not tracked" /></div></VNextPanel>;
  return <VNextPanel title="Completed job"><div className="p-5 text-[12px] text-vnext-muted">Operational work is complete. The record remains available as job history.</div></VNextPanel>;
}
function Fact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="flex min-w-0 items-center gap-2 rounded-lg bg-vnext-wash px-2.5 py-2"><Icon className="size-3.5 shrink-0 text-vnext-blue" /><span className="min-w-0"><span className="block text-[8.5px] font-extrabold text-vnext-faint uppercase">{label}</span><span className="block truncate font-bold">{value}</span></span></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-vnext-surface p-4"><span className="block text-[9px] font-extrabold text-vnext-faint uppercase">{label}</span><strong className="mt-1 block text-[13px]">{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <p className="p-4 text-[11.5px] text-vnext-muted">{text}</p>; }
function nextMoveFallback(family: ReturnType<typeof stageFamily>) { return ({ preaward: "Confirm scope and move the estimate forward", setup: "Resolve the next room or selection blocker", scheduled: "Confirm the crew and protect the start", installation: "Move the next room toward completion", punch: "Clear the next return item", billing: "Finish billing and closeout", complete: "Job complete" })[family]; }
function stageContext(project: { readiness_note?: string | null; intake_notes?: string | null }, family: ReturnType<typeof stageFamily>, open: number, next?: string) { if (family === "preaward") return project.intake_notes ?? `${open} open action${open === 1 ? "" : "s"} support this price request.`; if (family === "scheduled") return next ? `Scheduled for ${formatDate(next)}. Confirm anything that could threaten the start.` : "No upcoming crew assignment is recorded."; if (readinessRelevant(family === "setup" ? "Setup" : "Installation")) return project.readiness_note ?? `${open} open action${open === 1 ? "" : "s"} remain visible beside the operating context.`; return `${open} open action${open === 1 ? "" : "s"} remain on this job.`; }