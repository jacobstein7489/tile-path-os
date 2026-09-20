import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  ExternalLink,
  Hammer,
  Layers3,
  UserRound,
} from "lucide-react";
import { CenterDialog } from "@/components/ops/CenterDialog";
import { WorkItemPanel } from "@/components/work/WorkItemPanel";
import type { ProjectQueueRecord } from "@/components/projects/ProjectsWorkspaceV2";
import { Button } from "@/components/kit";
import { useCompanies, useContacts } from "@/lib/people";
import { normalizeStage } from "@/lib/lifecycle";
import { actionState } from "@/lib/queue";
import { useProjectSetup } from "@/lib/setup";
import { isOverdue, type WorkItemRow } from "@/lib/workitems";
import { cn } from "@/lib/utils";

type Tab = "Overview" | "Actions" | "Rooms / Readiness" | "Schedule / Activity";

export function ProjectQuickViewDialog({
  job,
  onClose,
  onOpenWork,
  backLabel,
  onBack,
  onOpenCustomer,
}: {
  job: ProjectQueueRecord | null;
  onClose: () => void;
  onOpenWork?: ((item: WorkItemRow) => void) | undefined;
  backLabel?: string | undefined;
  onBack?: (() => void) | undefined;
  onOpenCustomer?: ((companyId: string) => void) | undefined;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [workItem, setWorkItem] = useState<WorkItemRow | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [savedScroll, setSavedScroll] = useState(0);
  if (!job) return null;
  const drillWork = (item: WorkItemRow) => {
    if (onOpenWork) return onOpenWork(item);
    setSavedScroll(bodyRef.current?.scrollTop ?? 0);
    setWorkItem(item);
  };
  const backToProject = () => {
    setWorkItem(null);
    requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: savedScroll }));
  };
  return (
    <CenterDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={workItem?.title ?? job.project.name}
      description="Project operating workspace"
      bodyClassName="overflow-hidden"
    >
      <div className="flex h-[calc(100dvh-0.5rem)] max-h-[84dvh] flex-col bg-canvas sm:h-[min(760px,84dvh)]">
        {workItem ? (
          <>
            <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2.5">
              <Button size="sm" onClick={backToProject}>
                <ArrowLeft className="size-4" /> Back to project
              </Button>
              <span className="min-w-0 truncate text-[12px] font-semibold text-muted-foreground">
                {job.project.name}
              </span>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3.5">
              <WorkItemPanel item={workItem} compact />
            </div>
          </>
        ) : (
          <ProjectView
            job={job}
            tab={tab}
            setTab={setTab}
            onWork={drillWork}
            onClose={onClose}
            backLabel={backLabel}
            onBack={onBack}
            onOpenCustomer={onOpenCustomer}
            bodyRef={bodyRef}
          />
        )}
      </div>
    </CenterDialog>
  );
}

function ProjectView({
  job,
  tab,
  setTab,
  onWork,
  onClose,
  backLabel,
  onBack,
  onOpenCustomer,
  bodyRef,
}: {
  job: ProjectQueueRecord;
  tab: Tab;
  setTab: (tab: Tab) => void;
  onWork: (item: WorkItemRow) => void;
  onClose: () => void;
  backLabel?: string | undefined;
  onBack?: (() => void) | undefined;
  onOpenCustomer?: ((companyId: string) => void) | undefined;
  bodyRef: React.RefObject<HTMLDivElement | null>;
}) {
  const setup = useProjectSetup(job.project.id);
  const { data: companies = [] } = useCompanies();
  const { data: contacts = [] } = useContacts();
  const { project, work, next, attention, upcoming, latestReport } = job;
  const customer = companies.find((item) => item.id === project.customer_company_id);
  const contact = contacts.find((item) => item.id === project.primary_contact_id);
  const stage = project.exception_state ?? normalizeStage(project.lifecycle_stage);
  const grouped = useMemo(
    () =>
      (["To Do", "Waiting", "Scheduled"] as const)
        .map((state) => ({ state, rows: work.filter((item) => actionState(item) === state) }))
        .filter((group) => group.rows.length),
    [work],
  );
  return (
    <>
      <header className="relative shrink-0 overflow-hidden border-b border-border bg-card px-4 pt-4 sm:px-6 sm:pt-5 after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-primary">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary"
          >
            <ArrowLeft className="size-3.5" /> {backLabel ?? "Back"}
          </button>
        ) : null}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                {stage}
              </span>
              {attention ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">
                  <AlertTriangle className="size-3" /> Attention
                </span>
              ) : null}
            </div>
            <h2 className="mt-1.5 truncate text-[23px] font-bold sm:text-[27px]">{project.name}</h2>
            <button
              type="button"
              disabled={!project.customer_company_id || !onOpenCustomer}
              onClick={() =>
                project.customer_company_id && onOpenCustomer?.(project.customer_company_id)
              }
              className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate text-[12px] font-semibold text-primary disabled:text-muted-foreground"
            >
              <Building2 className="size-3.5 shrink-0" />{" "}
              {customer?.name ?? project.customer ?? "Customer not set"}
              {contact ? ` · ${contact.full_name}` : ""}
            </button>
          </div>
          <Link to="/projects/$projectId" params={{ projectId: project.id }} onClick={onClose}>
            <Button variant="primary">
              <span className="hidden sm:inline">Open full project</span>
              <ExternalLink className="size-4" />
            </Button>
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
          <HeaderFact icon={Layers3} label="Readiness" value={`${project.readiness_pct ?? 0}%`} />
          <HeaderFact
            icon={Hammer}
            label="Installed"
            value={`${project.installation_progress ?? 0}%`}
          />
          <HeaderFact
            icon={UserRound}
            label="Crew / owner"
            value={project.crew_lead ?? project.project_manager ?? "Unassigned"}
          />
          <HeaderFact
            icon={CalendarDays}
            label="Next date"
            value={upcoming ? formatDate(upcoming.work_date) : "Not scheduled"}
          />
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto rounded-t-xl bg-muted/55 p-1 pb-0">
          {(["Overview", "Actions", "Rooms / Readiness", "Schedule / Activity"] as Tab[]).map(
            (value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "h-9 shrink-0 rounded-t-lg border-b-2 px-3 text-[11.5px] font-bold",
                  tab === value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground",
                )}
              >
                {value}
                {value === "Actions" ? ` · ${work.length}` : ""}
              </button>
            ),
          )}
        </nav>
      </header>
       <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
        {tab === "Overview" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
            <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-foreground p-5 text-card shadow-[var(--shadow-raised)] sm:p-6">
              <p className="ops-eyebrow !text-primary-soft">Next move</p>
              <h3 className="mt-2 text-[21px] font-bold">
                {next?.title ?? project.next_move ?? "Review current project work"}
              </h3>
              <p className="mt-2 text-[12px] leading-5 text-card/65">
                {next?.next_action ??
                  attention ??
                  project.readiness_note ??
                  `${work.length} open actions`}
              </p>
              {next ? (
                <Button variant="primary" size="sm" className="mt-3" onClick={() => onWork(next)}>
                  Open action <ArrowRight className="size-4" />
                </Button>
              ) : null}
            </section>
            <section className="workspace-panel px-4 py-3">
              <p className="v2-kicker">Operating context</p>
              <Fact
                label="Readiness reason"
                value={project.readiness_note ?? "No readiness note"}
              />
              <Fact
                label="Next schedule"
                value={
                  upcoming
                    ? `${formatDate(upcoming.work_date)} · ${upcoming.kind}`
                    : "Not scheduled"
                }
              />
              <Fact
                label="Latest activity"
                value={latestReport?.progress_note ?? "No field update yet"}
              />
            </section>
          </div>
        ) : null}
        {tab === "Actions" ? (
          <section className="workspace-panel overflow-hidden">
            {grouped.length ? (
              grouped.map((group) => (
                <div key={group.state} className="border-b border-border last:border-0">
                  <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5">
                    <h3 className="text-[11px] font-bold uppercase">{group.state}</h3>
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {group.rows.length}
                    </span>
                  </div>
                  {group.rows.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onWork(item)}
                      className="grid min-h-[54px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-4 py-2 text-left hover:bg-primary-soft/35"
                    >
                      <span className="min-w-0">
                        <strong className="block truncate text-[13.5px]">{item.title}</strong>
                        <span className="text-[11px] text-muted-foreground">
                          {[
                            item.owner,
                            item.waiting_on && `Waiting on ${item.waiting_on}`,
                            isOverdue(item) && "Overdue",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <Empty text="No open actions on this project." />
            )}
          </section>
        ) : null}
        {tab === "Rooms / Readiness" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Panel title="Rooms & surfaces">
              <QuickFacts
                values={[
                  ["Rooms", setup.areaList.length],
                  ["Surfaces", setup.surfaceList.length],
                  ["Open decisions", setup.openQuestions.length],
                  ["Published rooms", setup.publishedPackageAreaIds.length],
                ]}
              />
            </Panel>
            <Panel title="Readiness blockers">
              {setup.blockers.length ? (
                setup.blockers.map((item) => (
                  <div
                    key={item.id}
                    className="border-t border-border px-4 py-2.5 first:border-t-0"
                  >
                    <strong className="block text-[12.5px]">{item.label}</strong>
                    <span className="text-[11px] text-muted-foreground">{item.detail}</span>
                  </div>
                ))
              ) : (
                <Empty text="Current readiness requirements are clear." />
              )}
            </Panel>
          </div>
        ) : null}
        {tab === "Schedule / Activity" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Panel title="Schedule">
              {upcoming ? (
                <Fact
                  label={formatDate(upcoming.work_date)}
                  value={`${upcoming.kind}${project.crew_lead ? ` · ${project.crew_lead}` : ""}`}
                />
              ) : (
                <Empty text="No upcoming assignment." />
              )}
            </Panel>
            <Panel title="Latest activity">
              <p className="p-3.5 text-[12px] leading-5">
                {latestReport?.progress_note ?? "No field update has been submitted."}
              </p>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}

function HeaderFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-background/65 px-2.5 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <p className="text-[9.5px] font-bold text-muted-foreground uppercase">{label}</p>
        <p className="truncate text-[11.5px] font-bold">{value}</p>
      </span>
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border py-2 last:border-0">
      <p className="text-[10px] font-bold text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 text-[12px] leading-5">{value}</p>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="workspace-panel overflow-hidden">
      <h3 className="px-4 py-2.5 text-[13px] font-bold">{title}</h3>
      <div className="border-t border-border">{children}</div>
    </section>
  );
}
function QuickFacts({ values }: { values: [string, number][] }) {
  return (
    <div className="grid grid-cols-2 gap-px bg-border">
      {values.map(([label, value]) => (
        <div key={label} className="bg-card p-3">
          <strong className="block text-[18px]">{value}</strong>
          <span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span>
        </div>
      ))}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="p-4 text-[12.5px] text-muted-foreground">{text}</p>;
}
function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
