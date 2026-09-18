import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
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
import { isOverdue, isWaiting, type WorkItemRow } from "@/lib/workitems";
import { cn } from "@/lib/utils";

type Tab = "Overview" | "Work" | "Readiness";

/**
 * Project operating popup. Compact by design: header facts, one dominant next
 * move, then tabbed operational detail so routine review stays one click deep.
 */
export function ProjectQuickViewDialog({
  job,
  onClose,
  onOpenWork,
}: {
  job: ProjectQueueRecord | null;
  onClose: () => void;
  onOpenWork: (item: WorkItemRow) => void;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  if (!job) return null;
  const { project, work, next, attention, upcoming, latestReport } = job;
  const stage = project.exception_state ?? normalizeStage(project.lifecycle_stage);
  const readiness = Math.max(0, Math.min(100, project.readiness_pct ?? 0));
  const progress = Math.max(0, Math.min(100, project.installation_progress ?? 0));
  const overdue = work.filter(isOverdue);
  const waiting = work.filter(isWaiting);

  return (
    <CenterDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={project.name}
      description="Project operating snapshot with current work, readiness, schedule and activity."
    >
      <div className="bg-canvas">
        <header className="border-b border-border bg-card px-4 pt-5 pb-0 sm:px-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[10.5px] font-bold text-primary">
                  {stage}
                </span>
                <span className="rounded-full bg-neutral-chip px-2.5 py-1 text-[10.5px] font-semibold text-secondary-foreground">
                  {project.project_type}
                </span>
                {attention ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-[10.5px] font-bold text-warning">
                    <AlertTriangle className="size-3.5" /> Needs attention
                  </span>
                ) : null}
              </div>
              <h2 className="truncate font-display text-[22px] leading-tight font-bold sm:text-[28px]">
                {project.name}
              </h2>
              <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
                {[project.address, project.customer].filter(Boolean).join(" · ") ||
                  "Project details not yet set"}
              </p>
            </div>
            <Link to="/projects/$projectId" params={{ projectId: project.id }} onClick={onClose}>
              <Button variant="primary">
                <span className="hidden sm:inline">Open full project</span>
                <ExternalLink className="size-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={Layers3}
              label="Readiness"
              value={`${readiness}%`}
              bar={readiness}
              tone="bg-warning"
            />
            <Stat
              icon={Hammer}
              label="Install progress"
              value={`${progress}%`}
              bar={progress}
              tone="bg-info"
            />
            <Stat
              icon={CalendarDays}
              label="Next scheduled"
              value={
                upcoming ? `${formatDate(upcoming.work_date)} · ${upcoming.kind}` : "Not scheduled"
              }
            />
            <Stat
              icon={UserRound}
              label="Crew / owner"
              value={
                project.crew_lead ??
                project.project_manager ??
                project.next_move_owner ??
                "Unassigned"
              }
            />
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto">
            {(["Overview", "Work", "Readiness"] as Tab[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-pressed={tab === value}
                className={cn(
                  "shrink-0 rounded-t-lg border-b-2 px-3.5 py-2.5 text-[12.5px] font-bold transition-colors",
                  tab === value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
                {value === "Work" ? ` · ${work.length}` : ""}
              </button>
            ))}
          </div>
        </header>

        <div className="space-y-3 p-3 sm:p-5">
          <section className="rounded-xl border border-primary/20 bg-primary-soft/55 p-4 shadow-[var(--shadow-card)]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
              <div className="min-w-0">
                <p className="v2-kicker !text-primary">Next move</p>
                <h3 className="mt-1 truncate text-[17px] font-bold sm:text-[19px]">
                  {next?.title ?? project.next_move ?? "Review current project work"}
                </h3>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {next?.next_action ??
                    project.readiness_note ??
                    `${work.length} open item${work.length === 1 ? "" : "s"}`}
                </p>
              </div>
              {next ? (
                <Button variant="primary" onClick={() => onOpenWork(next)}>
                  Open <ArrowRight className="size-4" />
                </Button>
              ) : null}
            </div>
          </section>

          {tab === "Overview" ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel title="Current work" detail={`${work.length} open`}>
                {work.length ? (
                  work.map((item) => <WorkLine key={item.id} item={item} onOpen={onOpenWork} />)
                ) : (
                  <EmptyLine text="No open work on this project." />
                )}
              </Panel>
              <Panel
                title="Recent activity"
                detail={
                  latestReport?.report_date ? formatDate(latestReport.report_date) : "No report"
                }
              >
                <div className="border-t border-border p-4">
                  <p className="text-[12.5px] leading-6">
                    {latestReport?.progress_note ?? "No field update has been submitted yet."}
                  </p>
                  {latestReport?.blockers ? (
                    <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-[11.5px] font-semibold text-warning">
                      {latestReport.blockers}
                    </p>
                  ) : null}
                </div>
              </Panel>
            </div>
          ) : null}

          {tab === "Work" ? (
            <Panel
              title="All open work"
              detail={`${overdue.length} overdue · ${waiting.length} waiting`}
            >
              {work.length ? (
                work.map((item) => <WorkLine key={item.id} item={item} onOpen={onOpenWork} />)
              ) : (
                <EmptyLine text="No open work on this project." />
              )}
            </Panel>
          ) : null}

          {tab === "Readiness" ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel title="Material readiness" detail={project.material_status || "Not evaluated"}>
                <div className="flex items-start gap-3 border-t border-border p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
                    <PackageCheck className="size-4" />
                  </span>
                  <p className="text-[12.5px] leading-6 text-muted-foreground">
                    {project.readiness_note ??
                      "Readiness is derived from this project’s setup, selections and materials."}
                  </p>
                </div>
              </Panel>
              <Panel title="Blockers & attention" detail={`${overdue.length} overdue`}>
                <div className="space-y-2 border-t border-border p-4">
                  {attention ? (
                    <p className="rounded-lg bg-warning-soft px-3 py-2 text-[12px] font-semibold text-warning">
                      {attention}
                    </p>
                  ) : null}
                  {project.needs_attention ? (
                    <p className="text-[12.5px] leading-6">{project.needs_attention}</p>
                  ) : null}
                  {!attention && !project.needs_attention ? (
                    <p className="text-[12.5px] text-muted-foreground">Nothing is flagged.</p>
                  ) : null}
                </div>
              </Panel>
            </div>
          ) : null}
        </div>
      </div>
    </CenterDialog>
  );
}

function WorkLine({ item, onOpen }: { item: WorkItemRow; onOpen: (item: WorkItemRow) => void }) {
  const late = isOverdue(item);
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group grid min-h-13 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-4 py-2.5 text-left transition-colors hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 focus-visible:outline-none"
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold">{item.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {[item.category ?? item.item_type, item.owner, late ? "Overdue" : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

function Panel({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <section className="workspace-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h3 className="text-[13px] font-bold">{title}</h3>
        <span className="truncate text-[11px] font-semibold text-muted-foreground">{detail}</span>
      </div>
      {children}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  bar,
  tone,
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
  bar?: number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-1 truncate text-[13.5px] font-bold">{value}</p>
      {typeof bar === "number" ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-track">
          <div className={cn("h-full rounded-full", tone)} style={{ width: `${bar}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="border-t border-border px-4 py-6 text-[12.5px] text-muted-foreground">{text}</p>
  );
}
function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
