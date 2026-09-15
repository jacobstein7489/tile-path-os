import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Check, ChevronDown, ClipboardCheck, Layers3, PackageCheck, TriangleAlert } from "lucide-react";
import { Button, EmptyState, SectionCard } from "@/components/kit";
import { FieldReportSheet } from "@/components/FieldReportSheet";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { useProject } from "@/lib/data";
import { useFieldReports } from "@/lib/fieldreports";
import { useProjectSetup } from "@/lib/setup";
import { compareWorkItems, isComplete, isWaiting, useWorkFeed, type WorkItemRow } from "@/lib/workitems";
import { useScheduleAssignments } from "@/lib/data";
import { READINESS_CATEGORIES } from "@/lib/readiness";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$projectId/")({
  head: () => ({ meta: [
    { title: "Project Overview — Cobblestone Tile OS" },
    { name: "description", content: "The next move, current blockers, upcoming work and readiness for this tile project." },
    { property: "og:title", content: "Project Overview — Cobblestone Tile OS" },
    { property: "og:description", content: "The next move, blockers, upcoming work and readiness." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: ProjectOverview,
});

function ProjectOverview() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: feed = [] } = useWorkFeed();
  const { data: reports = [] } = useFieldReports(projectId);
  const { data: schedule = [] } = useScheduleAssignments();
  const setup = useProjectSetup(projectId);
  const [active, setActive] = useState<WorkItemRow | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const work = useMemo(() => feed.filter((i) => i.project_id === projectId && !isComplete(i)).sort(compareWorkItems), [feed, projectId]);
  if (!project) return null;
  const next = work[0] ?? null;
  const waiting = work.filter(isWaiting).slice(0, 3);
  const upcoming = schedule.filter((s) => s.project_id === projectId && s.work_date >= new Date().toISOString().slice(0,10)).sort((a,b) => a.work_date.localeCompare(b.work_date)).slice(0,3);
  const latest = reports[0] ?? null;
  const live = active ? feed.find((i) => i.id === active.id) ?? active : null;
  return <>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.85fr)]">
      <div className="space-y-4">
        <section className="surface overflow-hidden">
          <div className="border-b border-border px-5 py-3 text-[11px] font-bold uppercase text-muted-foreground">Next move</div>
          {next ? <button type="button" onClick={() => setActive(next)} className="group flex w-full items-start gap-4 px-5 py-5 text-left hover:bg-muted/40">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><ArrowRight className="size-4" /></span>
            <span className="min-w-0 flex-1"><b className="block text-[18px] leading-snug">{next.title}</b><span className="mt-1 block text-[13px] text-muted-foreground">{[next.owner ?? "Unassigned", next.due_date ? formatDate(next.due_date) : null, work.length > 1 ? `${work.length - 1} more open` : null].filter(Boolean).join(" · ")}</span></span>
            <ArrowRight className="mt-2 size-4 text-muted-foreground group-hover:text-primary" />
          </button> : <EmptyState title="No open work" note="This project has no recorded next action." />}
        </section>

        <SectionCard title="Waiting" badge={<span className="text-xs font-semibold text-muted-foreground">{waiting.length ? `${waiting.length} shown` : "Clear"}</span>}>
          {waiting.length ? <div className="divide-y divide-border">{waiting.map((item) => <button key={item.id} onClick={() => setActive(item)} className="flex min-h-14 w-full items-center gap-3 px-5 text-left hover:bg-muted/40"><TriangleAlert className="size-4 shrink-0 text-warning" /><span className="min-w-0 flex-1"><b className="block truncate text-[13.5px]">{item.title}</b><span className="text-xs text-muted-foreground">Waiting on {item.waiting_on ?? "an external response"}</span></span><ArrowRight className="size-4 text-muted-foreground" /></button>)}</div> : <p className="px-5 pb-4 text-[13px] text-muted-foreground">Nothing is waiting on someone else.</p>}
        </SectionCard>

        <SectionCard title="Readiness" subtitle="Requirements are derived from project records, not a manual score." actions={<Button size="sm" onClick={() => setReadinessOpen((v) => !v)}>{readinessOpen ? "Hide detail" : "View detail"}<ChevronDown className={cn("size-4", readinessOpen && "rotate-180")} /></Button>}>
          <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-3">{READINESS_CATEGORIES.map((category) => { const rows = setup.requirements.filter((r) => r.category === category); const blocked = rows.filter((r) => r.state === "blocked").length; return <div key={category} className="bg-card px-4 py-3"><div className="flex items-center gap-2"><span className={cn("grid size-5 place-items-center rounded-full", blocked ? "bg-warning-soft text-warning" : rows.length ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>{blocked ? "!" : <Check className="size-3" />}</span><b className="text-[12.5px]">{category}</b></div><p className="mt-1 pl-7 text-xs text-muted-foreground">{!rows.length ? "Not evaluated" : blocked ? `${blocked} blocker${blocked === 1 ? "" : "s"}` : "Ready"}</p></div>; })}</div>
          {readinessOpen ? <div className="divide-y divide-border border-t border-border">{setup.requirements.map((r) => <div key={r.id} className="flex gap-3 px-5 py-3"><span className={cn("mt-0.5 size-2 shrink-0 rounded-full", r.state === "blocked" ? "bg-warning" : r.state === "met" ? "bg-success" : "bg-border-strong")} /><span><b className="block text-[13px]">{r.label}</b>{r.detail ? <span className="text-xs text-muted-foreground">{r.detail}</span> : null}</span></div>)}</div> : null}
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard title="Upcoming" icon={<CalendarDays className="size-4 text-primary" />}>
          {upcoming.length ? <div className="divide-y divide-border">{upcoming.map((s) => <div key={s.id} className="px-5 py-3"><b className="block text-[13px]">{formatDate(s.work_date)}</b><span className="text-xs text-muted-foreground">{s.kind}{s.notes ? ` · ${s.notes}` : ""}</span></div>)}</div> : <p className="px-5 pb-4 text-[13px] text-muted-foreground">Nothing scheduled next.</p>}
        </SectionCard>
        <SectionCard title="Latest Daily Update" icon={<ClipboardCheck className="size-4 text-primary" />} actions={<Button size="sm" onClick={() => setReportOpen(true)}>Add</Button>}>
          {latest ? <div className="px-5 pb-4"><p className="text-[13.5px] leading-relaxed">{latest.progress_note ?? "Update submitted without a progress note."}</p><p className="mt-2 text-xs text-muted-foreground">{[formatDate(latest.report_date), latest.crew_label, latest.areas_worked].filter(Boolean).join(" · ")}</p>{latest.blockers ? <p className="mt-2 text-xs text-warning">Blocker · {latest.blockers}</p> : null}</div> : <p className="px-5 pb-4 text-[13px] text-muted-foreground">No Daily Update has been submitted.</p>}
        </SectionCard>
        <nav className="surface divide-y divide-border overflow-hidden">
          <QuickLink to="/projects/$projectId/scope" projectId={projectId} icon={<Layers3 className="size-4" />} label="Rooms & surfaces" meta={`${setup.areaList.length} rooms · ${setup.surfaceList.length} surfaces`} />
          <QuickLink to="/projects/$projectId/design" projectId={projectId} icon={<TriangleAlert className="size-4" />} label="Design Meeting" meta={`${setup.openQuestions.length} decisions open`} />
          <QuickLink to="/projects/$projectId/package" projectId={projectId} icon={<PackageCheck className="size-4" />} label="Installer Package" meta={`${setup.publishedPackageAreaIds.length} of ${setup.areaList.length} rooms published`} />
        </nav>
      </div>
    </div>
    <WorkItemDrawer item={live} onClose={() => setActive(null)} />
    {reportOpen ? <FieldReportSheet projectId={projectId} projectName={project.name} onClose={() => setReportOpen(false)} /> : null}
  </>;
}

function QuickLink({ to, projectId, icon, label, meta }: { to: "/projects/$projectId/scope" | "/projects/$projectId/design" | "/projects/$projectId/package"; projectId: string; icon: React.ReactNode; label: string; meta: string }) { return <Link to={to} params={{ projectId }} className="flex min-h-14 items-center gap-3 px-4 hover:bg-muted/40"><span className="text-primary">{icon}</span><span className="min-w-0 flex-1"><b className="block text-[13px]">{label}</b><span className="block truncate text-xs text-muted-foreground">{meta}</span></span><ArrowRight className="size-4 text-muted-foreground" /></Link>; }
function formatDate(value: string) { return new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }); }