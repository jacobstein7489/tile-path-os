import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, ClipboardCheck } from "lucide-react";
import { Drawer } from "@/components/kit";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { useProject, useScheduleAssignments } from "@/lib/data";
import { useFieldReports } from "@/lib/fieldreports";
import { useProjectSetup } from "@/lib/setup";
import { READINESS_CATEGORIES, type ReadinessRequirement } from "@/lib/readiness";
import { compareWorkItems, isComplete, isWaiting, useWorkFeed, type WorkItemRow } from "@/lib/workitems";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$projectId/")({
  head: () => ({ meta: [
    { title: "Project Overview — Cobblestone Tile OS" },
    { name: "description", content: "The next move, current blockers, upcoming work and readiness for this tile project." },
    { property: "og:title", content: "Project Overview — Cobblestone Tile OS" },
    { property: "og:description", content: "The next move, blockers, upcoming work and readiness." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}), component: ProjectOverview,
});

type NextMove = { title: string; detail: string; to?: "/projects/$projectId/scope" | "/projects/$projectId/design" | "/projects/$projectId/package"; work?: WorkItemRow };

function ProjectOverview() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: feed = [] } = useWorkFeed();
  const { data: reports = [] } = useFieldReports(projectId);
  const { data: schedule = [] } = useScheduleAssignments();
  const setup = useProjectSetup(projectId);
  const [active, setActive] = useState<WorkItemRow | null>(null);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [readinessCategory, setReadinessCategory] = useState<string | null>(null);
  const work = useMemo(() => feed.filter((i) => i.project_id === projectId && !isComplete(i)).sort(compareWorkItems), [feed, projectId]);
  if (!project) return null;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = schedule.filter((s) => s.project_id === projectId && s.work_date >= today).sort((a,b) => a.work_date.localeCompare(b.work_date));
  const waiting = work.filter(isWaiting).slice(0, 3);
  const latest = reports[0] ?? null;
  const setupMove = deriveSetupMove(setup);
  const urgent = work.find((i) => (i.due_date && i.due_date < today) || i.priority === "High");
  const followup = work.find((i) => i.follow_up_on && i.follow_up_on <= today);
  const next: NextMove = setupMove ?? (urgent ? { title: urgent.title, detail: urgent.due_date && urgent.due_date < today ? `Overdue · ${formatDate(urgent.due_date)}` : "High priority", work: urgent } : followup ? { title: followup.title, detail: `Follow up ${formatDate(followup.follow_up_on)}`, work: followup } : upcoming[0] ? { title: upcoming[0].kind, detail: formatDate(upcoming[0].work_date) } : { title: "Review open project work", detail: `${work.length} open item${work.length === 1 ? "" : "s"}` });
  const live = active ? feed.find((i) => i.id === active.id) ?? active : null;

  return <>
    <div className="bg-card">
      <section className="grid min-h-[240px] border-b border-border md:grid-cols-[190px_minmax(0,1fr)]">
        <div className="border-b border-border bg-foreground px-5 py-6 text-background md:border-r md:border-b-0 md:px-6 md:py-8"><span className="v2-kicker !text-background/55">Operational brief</span><div className="mt-8 text-[12px] text-background/65">Current stage</div><div className="mt-1 text-xl font-bold">{project.exception_state ?? project.lifecycle_stage}</div><button type="button" onClick={() => { setReadinessCategory(null); setReadinessOpen(true); }} className="mt-8 text-xs font-semibold text-background underline underline-offset-4">View readiness</button></div>
        <div className="px-5 py-7 md:px-10 md:py-9"><Eyebrow>Next move</Eyebrow>{next.work ? <button type="button" onClick={() => setActive(next.work ?? null)} className="group mt-4 flex w-full items-end gap-5 text-left"><span className="min-w-0 flex-1"><strong className="block text-[26px] leading-tight font-bold md:text-[36px]">{next.title}</strong><span className="mt-2 block text-sm text-muted-foreground">{next.detail}</span></span><span className="mb-1 inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary">Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span></button> : next.to ? <Link to={next.to} params={{ projectId }} className="group mt-4 flex items-end gap-5"><span className="min-w-0 flex-1"><strong className="block text-[26px] leading-tight font-bold md:text-[36px]">{next.title}</strong><span className="mt-2 block text-sm text-muted-foreground">{next.detail}</span></span><span className="mb-1 inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary">Continue <ArrowRight className="size-4" /></span></Link> : <div className="mt-4"><strong className="block text-[26px] leading-tight font-bold md:text-[36px]">{next.title}</strong><span className="mt-2 block text-sm text-muted-foreground">{next.detail}</span></div>}</div>
      </section>

      <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <div className="divide-y divide-border lg:border-r lg:border-border">
           <section className="px-5 py-8 md:px-10">
             <div className="flex items-center justify-between"><Eyebrow>Waiting on</Eyebrow>{waiting.length ? <Link to="/projects/$projectId/tasks" params={{ projectId }} className="text-xs font-semibold text-primary">View all waiting</Link> : null}</div>
            <div className="mt-3 divide-y divide-border">
              {waiting.length ? waiting.map((item) => <button key={item.id} type="button" onClick={() => setActive(item)} className="group flex min-h-16 w-full items-center gap-4 text-left"><span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{item.title}</b><span className="mt-0.5 block text-xs text-muted-foreground">{item.waiting_on ?? "External confirmation"}{item.follow_up_on ? ` · Follow up ${formatDate(item.follow_up_on)}` : ""}</span></span><ChevronRight className="size-4 text-muted-foreground group-hover:text-primary" /></button>) : <p className="py-5 text-sm text-muted-foreground">Nothing is waiting on someone else.</p>}
            </div>
          </section>
           <section className="px-5 py-8 md:px-10">
            <div className="flex items-center justify-between"><Eyebrow>Latest update</Eyebrow><Link to="/projects/$projectId/updates" params={{ projectId }} className="text-xs font-semibold text-primary">View updates</Link></div>
            {latest ? <div className="mt-4"><div className="flex items-center gap-2 text-xs font-semibold text-secondary-foreground"><ClipboardCheck className="size-4 text-primary" />{formatDate(latest.report_date)}{latest.crew_label ? ` · ${latest.crew_label}` : ""}</div><p className="mt-3 max-w-2xl whitespace-pre-line text-[14px] leading-7">{latest.progress_note ?? "Update submitted without a progress note."}</p>{latest.blockers ? <p className="mt-3 text-sm text-warning">Waiting · {latest.blockers}</p> : null}</div> : <p className="mt-4 text-sm text-muted-foreground">No Daily Update has been submitted.</p>}
          </section>
        </div>
        <div className="divide-y divide-border">
           <section className="px-5 py-8 md:px-8">
            <div className="flex items-center justify-between"><Eyebrow>Setup status</Eyebrow><button type="button" onClick={() => { setReadinessCategory(null); setReadinessOpen(true); }} className="text-xs font-semibold text-primary">View detail</button></div>
            <div className="mt-3 divide-y divide-border">
              {setupRows(setup).map((row) => <button key={row.label} type="button" onClick={() => { setReadinessCategory(row.category); setReadinessOpen(true); }} className="flex min-h-12 w-full items-center justify-between gap-3 text-left"><span className="text-[13.5px] font-medium">{row.label}</span><span className={cn("text-xs font-semibold", row.tone === "green" ? "text-success" : row.tone === "amber" ? "text-warning" : "text-muted-foreground")}>{row.value}</span></button>)}
            </div>
            <Link to="/projects/$projectId/scope" params={{ projectId }} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">Continue setup <ArrowRight className="size-4" /></Link>
          </section>
          <section className="px-5 py-7 md:px-7">
            <Eyebrow>Upcoming</Eyebrow>
            {upcoming[0] ? <div className="mt-4 flex gap-3"><CalendarDays className="mt-0.5 size-4 text-primary" /><div><b className="block text-[13.5px]">{formatDate(upcoming[0].work_date)}</b><span className="text-xs text-muted-foreground">{upcoming[0].kind}{upcoming[0].notes ? ` · ${upcoming[0].notes}` : ""}</span></div></div> : <p className="mt-4 text-sm text-muted-foreground">Nothing scheduled.</p>}
          </section>
        </div>
      </div>
    </div>
    <WorkItemDrawer item={live} onClose={() => setActive(null)} />
    <ReadinessDrawer open={readinessOpen} onClose={() => setReadinessOpen(false)} requirements={setup.requirements} areas={setup.areaList} surfaces={setup.surfaceList} selected={readinessCategory} onSelect={setReadinessCategory} />
  </>;
}

function deriveSetupMove(setup: ReturnType<typeof useProjectSetup>): NextMove | null {
  const blocked = setup.requirements.filter((r) => r.state === "blocked");
  const by = (category: string) => blocked.filter((r) => r.category === category);
  if (by("Room / Surface setup").length) return { title: "Complete rooms and surfaces", detail: affectedSurfaceSummary(by("Room / Surface setup"), setup), to: "/projects/$projectId/scope" };
  if (by("Finish specification").length) return { title: "Finish project specifications", detail: affectedSurfaceSummary(by("Finish specification"), setup), to: "/projects/$projectId/scope" };
  if (by("Design decisions").length) return { title: "Finish design decisions", detail: affectedSurfaceSummary(by("Design decisions"), setup, "need decisions"), to: "/projects/$projectId/design" };
  if (by("Installer package").length) return { title: "Prepare installer package", detail: `${by("Installer package").length} room package${by("Installer package").length === 1 ? "" : "s"} remaining`, to: "/projects/$projectId/package" };
  return null;
}

function setupRows(setup: ReturnType<typeof useProjectSetup>) {
  const labels: Record<string, string> = { "Room / Surface setup": "Rooms & surfaces", "Finish specification": "Finish mapping", "Design decisions": "Design decisions", "Installer package": "Installer package", "Material readiness": "Materials" };
  return READINESS_CATEGORIES.slice(0, 5).map((category) => { const rows = setup.requirements.filter((r) => r.category === category); const blockedRows = rows.filter((r) => r.state === "blocked"); const evaluated = rows.some((r) => r.state !== "not_evaluated"); return { category, label: labels[category] ?? category, value: !evaluated ? "Not evaluated" : blockedRows.length ? affectedSurfaceSummary(blockedRows, setup) : "Ready", tone: !evaluated ? "neutral" : blockedRows.length ? "amber" : "green" }; });
}

function affectedSurfaceSummary(rows: ReadinessRequirement[], setup: ReturnType<typeof useProjectSetup>, suffix = "need setup") {
  const surfaceIds = new Set(rows.map((row) => row.surface_id).filter(Boolean));
  const areaIds = new Set(rows.map((row) => row.area_id).filter(Boolean));
  if (surfaceIds.size) return `${surfaceIds.size} surface${surfaceIds.size === 1 ? "" : "s"} ${suffix}`;
  if (areaIds.size) return `${areaIds.size} room${areaIds.size === 1 ? "" : "s"} ${suffix}`;
  if (!setup.areaList.length) return "Add the first room";
  return "Project setup needs attention";
}

function ReadinessDrawer({ open, onClose, requirements, areas, surfaces, selected, onSelect }: { open: boolean; onClose: () => void; requirements: ReadinessRequirement[]; areas: { id: string; name: string }[]; surfaces: { id: string; area_id: string; name: string }[]; selected: string | null; onSelect: (value: string | null) => void }) {
  const rows = selected ? requirements.filter((r) => r.category === selected) : [];
  return <Drawer open={open} onClose={onClose} title={selected ?? "Setup status"} subtitle={selected ? "Room and surface detail" : "Readiness grouped by responsibility"}>
    {selected ? <div><button type="button" onClick={() => onSelect(null)} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="size-4" /> All categories</button><div className="divide-y divide-border">{rows.map((row) => { const surface = surfaces.find((s) => s.id === row.surface_id); const area = areas.find((a) => a.id === (row.area_id ?? surface?.area_id)); return <div key={row.id} className="flex gap-3 py-3"><span className={cn("mt-1.5 size-2 shrink-0 rounded-full", row.state === "met" ? "bg-success" : row.state === "blocked" ? "bg-warning" : "bg-border-strong")} /><div><b className="block text-[13px]">{[area?.name, surface?.name].filter(Boolean).join(" · ") || "Project"}</b><span className="text-xs leading-relaxed text-muted-foreground">{row.label}{row.detail ? ` · ${row.detail}` : ""}</span></div></div>; })}</div></div> : <div className="divide-y divide-border">{READINESS_CATEGORIES.map((category) => { const cat = requirements.filter((r) => r.category === category); const blocked = cat.filter((r) => r.state === "blocked").length; const met = cat.filter((r) => r.state === "met").length; const evaluated = cat.some((r) => r.state !== "not_evaluated"); return <button key={category} type="button" onClick={() => onSelect(category)} className="flex min-h-16 w-full items-center gap-3 text-left"><span className={cn("grid size-6 place-items-center rounded-full", !evaluated ? "bg-muted text-muted-foreground" : blocked ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>{!evaluated ? "—" : blocked ? blocked : <Check className="size-3.5" />}</span><span className="min-w-0 flex-1"><b className="block text-sm">{category}</b><span className="text-xs text-muted-foreground">{!evaluated ? "Not evaluated" : blocked ? `${blocked} remaining · ${met} ready` : `${met} ready`}</span></span><ChevronRight className="size-4 text-muted-foreground" /></button>; })}</div>}
  </Drawer>;
}
function Eyebrow({ children }: { children: React.ReactNode }) { return <h2 className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">{children}</h2>; }
function formatDate(value: string | null | undefined) { if (!value) return ""; return new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
