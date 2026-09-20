import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CircleAlert, Plus, Search, UserRound } from "lucide-react";
import { Button } from "@/components/kit";
import { VNextJobQuickView } from "@/components/vnext/VNextJobQuickView";
import { VNextNewJob } from "@/components/vnext/VNextNewJob";
import { JobIdentity, VNextPageHeader, formatDate } from "@/components/vnext/VNextPrimitives";
import { useProjects, useScheduleAssignments, type Project } from "@/lib/data";
import { useCompanies, useProfiles } from "@/lib/people";
import { compareWorkItems, isComplete, isOverdue, useWorkFeed } from "@/lib/workitems";
import { isPreAwardStage, readinessRelevant, stageFamily, vnextStage, type VNextStage } from "@/lib/vnext";
import { cn } from "@/lib/utils";

type View = "Active" | "Pre-award" | "Production" | "Closeout" | "On Hold" | "Complete";

export function VNextJobs() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: work = [] } = useWorkFeed();
  const { data: schedule = [] } = useScheduleAssignments();
  const { data: companies = [] } = useCompanies();
  const { data: profiles = [] } = useProfiles();
  const [view, setView] = useState<View>("Active");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const rows = useMemo(() => projects.filter((project) => matchesView(project, view) && matchesQuery(project, query)).sort((a,b) => priority(a) - priority(b)), [projects, query, view]);
  const workByProject = useMemo(() => { const map = new Map<string, typeof work>(); work.filter((item) => item.project_id && !isComplete(item)).sort(compareWorkItems).forEach((item) => { const id = item.project_id; if (!id) return; map.set(id, [...(map.get(id) ?? []), item]); }); return map; }, [work]);
  const counts = (value: View) => projects.filter((project) => matchesView(project, value)).length;
  return <div className="mx-auto max-w-[1380px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10">
    <VNextPageHeader eyebrow="Full lifecycle" title="Jobs" description="One operating record from the first price request through final completion." action={<Button variant="primary" className="bg-vnext-ink hover:bg-vnext-ink/90" onClick={() => setCreating(true)}><Plus className="size-4" /> New price request</Button>} />
    <div className="mt-5 flex flex-col gap-3 rounded-[14px] border border-vnext-line bg-vnext-surface p-3 shadow-[var(--vnext-shadow-panel)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-1 overflow-x-auto">{(["Active","Pre-award","Production","Closeout","On Hold","Complete"] as View[]).map((item) => <button key={item} type="button" onClick={() => setView(item)} className={cn("h-8 shrink-0 rounded-lg px-3 text-[11px] font-bold", view === item ? "bg-vnext-ink text-vnext-surface" : "text-vnext-muted hover:bg-vnext-wash")}>{item} <span className="ml-1 opacity-60">{counts(item)}</span></button>)}</div>
      <label className="relative block sm:w-[260px]"><Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-vnext-faint" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs, customers, addresses" className="h-9 w-full rounded-lg border border-vnext-line bg-vnext-wash pl-9 pr-3 text-[11.5px] outline-none focus:border-vnext-blue" /></label>
    </div>
    <div className="mt-4 space-y-2.5">{isLoading ? <p className="p-8 text-center text-[12px] text-vnext-muted">Loading jobs…</p> : rows.length ? rows.map((project) => {
      const stage = vnextStage(project); const family = stageFamily(stage); const items = workByProject.get(project.id) ?? []; const next = items[0]; const nextAssignment = schedule.filter((item) => item.project_id === project.id && item.work_date >= new Date().toISOString().slice(0,10)).sort((a,b) => a.work_date.localeCompare(b.work_date))[0]; const customer = companies.find((item) => item.id === project.customer_company_id)?.name; const ownerId = isPreAwardStage(stage) ? project.estimator_user_id : project.pm_user_id; const owner = profiles.find((item) => item.user_id === ownerId)?.full_name ?? project.project_manager ?? project.next_move_owner;
      return <button key={project.id} type="button" onClick={() => setSelected(project.id)} className="group grid min-h-[118px] w-full gap-4 overflow-hidden rounded-[16px] border border-vnext-line bg-vnext-surface p-4 text-left shadow-[var(--vnext-shadow-row)] transition hover:-translate-y-0.5 hover:border-vnext-blue/30 hover:shadow-[var(--vnext-shadow-panel)] sm:grid-cols-[minmax(280px,1.35fr)_minmax(210px,0.8fr)_minmax(230px,1fr)_auto] sm:items-center sm:px-5">
        <JobIdentity project={project} customer={customer ?? null} stage={stage} />
        <div className="grid grid-cols-2 gap-2 sm:block sm:space-y-2"><RowFact icon={UserRound} label={isPreAwardStage(stage) ? "Estimator" : "Owner"} value={owner ?? "Unassigned"} /><RowFact icon={CalendarDays} label={dateLabel(stage)} value={formatDate(isPreAwardStage(stage) ? project.follow_up_date ?? project.bid_due_date : nextAssignment?.work_date ?? project.target_date)} /></div>
        <StageSignal project={project} stage={stage} next={next?.title ?? project.next_move} overdue={items.some(isOverdue)} />
        <span className="hidden size-9 place-items-center rounded-full border border-vnext-line text-vnext-faint transition group-hover:border-vnext-blue group-hover:bg-vnext-blue group-hover:text-vnext-surface sm:grid"><ArrowRight className="size-4" /></span>
      </button>;
    }) : <div className="rounded-[16px] border border-dashed border-vnext-line bg-vnext-surface/70 p-12 text-center"><p className="font-display text-[17px] font-bold">No jobs in this view</p><p className="mt-1 text-[11.5px] text-vnext-muted">Choose another lifecycle view or clear the search.</p></div>}</div>
    <VNextJobQuickView jobId={selected} onClose={() => setSelected(null)} />
    <VNextNewJob open={creating} onClose={() => setCreating(false)} />
  </div>;
}

function StageSignal({ project, stage, next, overdue }: { project: Project; stage: VNextStage; next?: string | null; overdue: boolean }) {
  const family = stageFamily(stage); let label = "Next move"; let value = next ?? "Open the job and set the next move";
  if (family === "installation") { label = "Physical progress"; value = `${project.installation_progress}% installed${next ? ` · ${next}` : ""}`; }
  else if (readinessRelevant(stage)) { label = "Upcoming work"; value = project.readiness_pct >= 100 ? `Ready${next ? ` · ${next}` : ""}` : project.readiness_note ?? next ?? "Readiness needs review"; }
  else if (family === "punch") { label = "Punch / return"; }
  else if (family === "billing") { label = "Billing / closeout"; }
  return <div className={cn("rounded-[11px] border px-3.5 py-3", overdue ? "border-vnext-red/15 bg-vnext-red-soft" : "border-vnext-line bg-vnext-wash")}><span className={cn("flex items-center gap-1 text-[9px] font-extrabold uppercase", overdue ? "text-vnext-red" : "text-vnext-faint")}>{overdue ? <CircleAlert className="size-3" /> : null}{label}</span><strong className="mt-1 block line-clamp-2 text-[12px] leading-[1.45]">{value}</strong></div>;
}
function RowFact({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) { return <div className="flex min-w-0 items-center gap-2"><Icon className="size-3.5 shrink-0 text-vnext-blue" /><span className="min-w-0"><span className="block text-[8.5px] font-extrabold text-vnext-faint uppercase">{label}</span><span className="block truncate text-[11px] font-bold">{value}</span></span></div>; }
function dateLabel(stage: VNextStage) { return isPreAwardStage(stage) ? "Follow-up / bid" : stage === "Scheduled" ? "Start" : "Relevant date"; }
function matchesQuery(project: Project, query: string) { const value = query.trim().toLowerCase(); return !value || `${project.name} ${project.customer ?? ""} ${project.address ?? ""} ${project.job_number ?? ""}`.toLowerCase().includes(value); }
function matchesView(project: Project, view: View) { const stage = vnextStage(project); const family = stageFamily(stage); if (view === "On Hold") return project.exception_state === "On Hold"; if (view === "Complete") return stage === "Complete"; if (project.exception_state) return false; if (view === "Pre-award") return family === "preaward"; if (view === "Production") return ["setup","scheduled","installation"].includes(family); if (view === "Closeout") return ["punch","billing"].includes(family); return stage !== "Complete"; }
function priority(project: Project) { const family = stageFamily(vnextStage(project)); return ({ preaward: 0, setup: 1, scheduled: 2, installation: 3, punch: 4, billing: 5, complete: 6 })[family]; }