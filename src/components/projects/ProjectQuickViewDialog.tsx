import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Hammer,
  Layers3,
  PackageCheck,
  UserRound,
} from "lucide-react";
import { CenterDialog } from "@/components/ops/CenterDialog";
import type { ProjectQueueRecord } from "@/components/projects/ProjectsWorkspaceV2";
import { Button } from "@/components/kit";
import { normalizeStage } from "@/lib/lifecycle";
import type { WorkItemRow } from "@/lib/workitems";
import { cn } from "@/lib/utils";

export function ProjectQuickViewDialog({
  job,
  onClose,
  onOpenWork,
}: {
  job: ProjectQueueRecord | null;
  onClose: () => void;
  onOpenWork: (item: WorkItemRow) => void;
}) {
  if (!job) return null;
  const { project, work, next, attention, upcoming, latestReport } = job;
  const stage = project.exception_state ?? normalizeStage(project.lifecycle_stage);
  const readiness = Math.max(0, Math.min(100, project.readiness_pct ?? 0));
  const progress = Math.max(0, Math.min(100, project.installation_progress ?? 0));

  return (
    <CenterDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={project.name}
      description="Project operating snapshot with current work, readiness, schedule, and activity."
    >
      <div className="bg-canvas">
        <header className="relative overflow-hidden border-b border-border bg-card px-5 py-6 sm:px-8 sm:py-7">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-primary" />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-5">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-bold text-primary">{stage}</span>
                <span className="rounded-full bg-neutral-chip px-3 py-1 text-[11px] font-semibold text-secondary-foreground">{project.project_type}</span>
              </div>
              <h2 className="font-display text-[25px] leading-tight font-bold sm:text-[32px]">{project.name}</h2>
              <p className="mt-2 text-[13px] text-muted-foreground sm:text-[14px]">
                {[project.address, project.customer].filter(Boolean).join(" · ") || "Project details not yet set"}
              </p>
            </div>
            <Link to="/projects/$projectId" params={{ projectId: project.id }} onClick={onClose}>
              <Button variant="primary"><span className="hidden sm:inline">Open full project</span><ExternalLink className="size-4" /></Button>
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ProgressCard label="Readiness" value={readiness} icon={Layers3} tone={readiness < 100 ? "warning" : "success"} />
            <ProgressCard label="Physical progress" value={progress} icon={Hammer} tone="info" />
          </div>
        </header>

        <div className="grid gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.8fr)]">
          <div className="space-y-4">
            <section className="rounded-xl border border-primary/20 bg-primary-soft/55 p-5 shadow-[var(--shadow-card)]">
              <p className="v2-kicker !text-primary">Next move</p>
              <h3 className="mt-2 text-[20px] font-bold">{next?.title ?? project.next_move ?? "Review current project work"}</h3>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{next?.next_action ?? project.readiness_note ?? `${work.length} open item${work.length === 1 ? "" : "s"}`}</p>
              {next ? <Button variant="primary" className="mt-4" onClick={() => onOpenWork(next)}>Open action <ArrowRight className="size-4" /></Button> : null}
            </section>

            <section className="workspace-panel overflow-hidden">
              <SectionHead icon={ClipboardList} title="Current work" detail={`${work.length} open`} />
              {work.length ? work.slice(0, 5).map((item) => (
                <button key={item.id} type="button" onClick={() => onOpenWork(item)} className="group grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-4 py-3 text-left transition-colors hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30">
                  <span className="min-w-0"><span className="block truncate text-[13.5px] font-bold">{item.title}</span><span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{item.category ?? item.item_type}{item.owner ? ` · ${item.owner}` : ""}</span></span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              )) : <EmptyLine text="No open work on this project." />}
            </section>

            <section className="workspace-panel overflow-hidden">
              <SectionHead icon={CheckCircle2} title="Recent activity" detail={latestReport?.report_date ? formatDate(latestReport.report_date) : "No report"} />
              <div className="border-t border-border p-4">
                <p className="text-[13px] leading-6">{latestReport?.progress_note ?? "No field update has been submitted yet."}</p>
                {latestReport?.blockers ? <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-[12px] font-semibold text-warning">{latestReport.blockers}</p> : null}
              </div>
            </section>
          </div>

          <div className="space-y-4">
            {attention ? <section className="rounded-xl border border-warning/20 bg-warning-soft p-4"><p className="flex items-center gap-2 text-[11px] font-bold text-warning uppercase"><AlertTriangle className="size-4" /> Needs attention</p><p className="mt-2 text-[13px] font-semibold leading-5">{attention}</p></section> : null}
            <section className="workspace-panel p-4">
              <p className="v2-kicker">Schedule & crew</p>
              <InfoRow icon={CalendarDays} label="Next date" value={upcoming ? `${formatDate(upcoming.work_date)} · ${upcoming.kind}` : "Nothing scheduled"} />
              <InfoRow icon={UserRound} label="Crew / owner" value={project.crew_lead ?? project.project_manager ?? project.next_move_owner ?? "Unassigned"} />
            </section>
            <section className="workspace-panel p-4">
              <p className="v2-kicker">Material readiness</p>
              <div className="mt-3 flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success-soft text-success"><PackageCheck className="size-4" /></span><div><p className="text-[13.5px] font-bold">{project.material_status || "Not evaluated"}</p><p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">{project.readiness_note ?? "Readiness is derived from the project’s current setup and materials."}</p></div></div>
            </section>
          </div>
        </div>
      </div>
    </CenterDialog>
  );
}

function SectionHead({ icon: Icon, title, detail }: { icon: typeof ClipboardList; title: string; detail: string }) {
  return <div className="flex items-center justify-between gap-3 px-4 py-3.5"><h3 className="flex items-center gap-2 text-[14px] font-bold"><span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span>{title}</h3><span className="text-[11.5px] font-semibold text-muted-foreground">{detail}</span></div>;
}

function ProgressCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Layers3; tone: "warning" | "success" | "info" }) {
  const colors = { warning: "bg-warning text-warning", success: "bg-success text-success", info: "bg-info text-info" } as const;
  return <div className="rounded-xl border border-border bg-background/70 p-4"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[12px] font-bold text-secondary-foreground"><Icon className={cn("size-4", colors[tone].split(" ")[1])} />{label}</span><strong className="text-[18px] tabular-nums">{value}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-track"><div className={cn("h-full rounded-full", colors[tone].split(" ")[0])} style={{ width: `${value}%` }} /></div></div>;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="mt-3 flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info-soft text-info"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-[10px] font-bold text-muted-foreground uppercase">{label}</p><p className="mt-0.5 text-[12.5px] font-semibold leading-5">{value}</p></div></div>;
}

function EmptyLine({ text }: { text: string }) { return <p className="border-t border-border px-4 py-6 text-[12.5px] text-muted-foreground">{text}</p>; }
function formatDate(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }