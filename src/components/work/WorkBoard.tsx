import { useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck2, CheckSquare2, ChevronDown, FolderKanban, Search, UserRound } from "lucide-react";
import { WorkItemDialog } from "@/components/work/WorkItemDialog";
import { OpsRow } from "@/components/work/OpsRow";
import { OpsCanvas, OpsPageHeader, OpsPlane, ObjectMark } from "@/components/ops/PremiumOps";
import { useCapture } from "@/components/ops/CaptureProvider";
import { Button } from "@/components/kit";
import { useCompanies, useProfiles } from "@/lib/people";
import { useProjects } from "@/lib/data";
import { useAuthUser, useMyProfile } from "@/hooks/useAuth";
import { actionState, matchesQuery, workKpiCounts } from "@/lib/queue";
import { compareWorkItems, isComplete, isItemOwnedBy, isOverdue, projectLabel, useWorkFeed, type WorkItemRow } from "@/lib/workitems";
import { cn } from "@/lib/utils";

type Mode = "By Project" | "By Person" | "All Actions";
type Scope = "Mine" | "All";
type Filter = "Open" | "To Do" | "Waiting" | "Scheduled" | "Overdue";

export function WorkBoard({ projectId }: { projectId?: string }) {
  const { data: items = [], isLoading } = useWorkFeed();
  const { data: projects = [] } = useProjects();
  const { data: companies = [] } = useCompanies("customer");
  const { data: profiles = [] } = useProfiles();
  const { user } = useAuthUser();
  const { data: me } = useMyProfile();
  const capture = useCapture();
  const [mode, setMode] = useState<Mode>(projectId ? "All Actions" : "By Project");
  const [scope, setScope] = useState<Scope>("All");
  const [filter, setFilter] = useState<Filter>("Open");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<WorkItemRow | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c.name])), [companies]);
  const ownerName = (item: WorkItemRow) => profiles.find((p) => p.user_id === item.owner_user_id)?.full_name ?? item.owner ?? "Unassigned";
  const customerName = (item: WorkItemRow) => {
    const project = item.project_id ? projectMap.get(item.project_id) : null;
    return (project?.customer_company_id && companyMap.get(project.customer_company_id)) || project?.customer || "Company action";
  };
  const scoped = useMemo(() => {
    const base = (projectId ? items.filter((i) => i.project_id === projectId) : items).filter((i) => !isComplete(i));
    return scope === "Mine" ? base.filter((i) => isItemOwnedBy(i, user?.id, me?.full_name)) : base;
  }, [items, me?.full_name, projectId, scope, user?.id]);
  const counts = useMemo(() => workKpiCounts(scoped), [scoped]);
  const overdue = useMemo(() => scoped.filter(isOverdue).length, [scoped]);
  const visible = useMemo(() => scoped.filter((item) => {
    if (!matchesQuery(item, query)) return false;
    if (filter === "Overdue") return isOverdue(item);
    if (filter === "Open") return true;
    return actionState(item) === filter;
  }).sort(compareWorkItems), [filter, query, scoped]);

  const groups = useMemo(() => {
    if (mode === "All Actions") return [{ key: "all", title: "All company actions", subtitle: "Every open operating action", rows: visible }];
    const map = new Map<string, WorkItemRow[]>();
    visible.forEach((item) => {
      const key = mode === "By Project" ? item.project_id ?? "company" : item.owner_user_id ?? `name:${ownerName(item)}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return [...map.entries()].map(([key, rows]) => {
      const project = mode === "By Project" && key !== "company" ? projectMap.get(key) : null;
      const first = rows[0];
      return {
        key,
        title: mode === "By Project" ? project?.name ?? "Company / Unassigned" : first ? ownerName(first) : "Unassigned",
        subtitle: mode === "By Project" ? (first ? customerName(first) : "Customer not set") : `${new Set(rows.map(projectLabel)).size} projects`,
        rows,
      };
    }).sort((a, b) => b.rows.filter(isOverdue).length - a.rows.filter(isOverdue).length || b.rows.length - a.rows.length);
  }, [mode, visible, projectMap]);

  const toggle = (key: string) => setCollapsed((old) => { const next = new Set(old); next.has(key) ? next.delete(key) : next.add(key); return next; });

  return <OpsCanvas>
    <OpsPageHeader eyebrow="Company action center" title={projectId ? "Project Actions" : "Actions"} summary={isLoading ? "Loading actions…" : `${counts.Open} open actions · ${overdue} overdue`} action={<Button variant="primary" onClick={() => capture()}>Capture</Button>}>
      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {([
          ["Open", counts.Open, FolderKanban], ["To Do", counts["To Do"], CheckSquare2], ["Waiting", counts.Waiting, UserRound], ["Scheduled", counts.Scheduled, CalendarCheck2], ["Overdue", overdue, AlertTriangle],
        ] as [Filter, number, typeof FolderKanban][]).map(([label, value, Icon]) => <button key={label} type="button" onClick={() => setFilter(label)} className={cn("group flex min-h-16 items-center gap-3 rounded-xl border px-3 text-left transition-all", filter === label ? "border-primary/30 bg-primary-soft shadow-[var(--shadow-card)]" : "border-border bg-background/70 hover:-translate-y-0.5 hover:border-border-strong")}><ObjectMark tone={label === "Overdue" ? "red" : label === "Waiting" ? "amber" : label === "Scheduled" ? "green" : "blue"} className="size-9"><Icon className="size-4" /></ObjectMark><span><strong className="block text-[21px] leading-none tabular-nums">{value}</strong><span className="mt-1 block text-[10px] font-bold uppercase text-muted-foreground">{label === "Open" ? "All open" : label}</span></span></button>)}
      </div>
      <div className="mt-4 grid gap-2 lg:grid-cols-[auto_auto_minmax(220px,1fr)]">
        <Segmented values={projectId ? ["All Actions"] : ["By Project", "By Person", "All Actions"]} value={mode} onChange={(v) => setMode(v as Mode)} />
        <Segmented values={["All", "Mine"]} value={scope} onChange={(v) => setScope(v as Scope)} />
        <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/20"><Search className="size-4 text-muted-foreground"/><input className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search actions, projects, people"/></label>
      </div>
    </OpsPageHeader>

    <OpsPlane className="mt-4 divide-y divide-border/70">
      {groups.length ? groups.map((group) => {
        const closed = collapsed.has(group.key);
        const urgent = group.rows.filter(isOverdue).length;
        const nearest = group.rows[0];
        return <section key={group.key}>
          <button type="button" onClick={() => toggle(group.key)} className="grid min-h-[82px] w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-4 text-left transition-colors hover:bg-primary-soft/25 sm:px-5">
            <ObjectMark tone={urgent ? "red" : "ink"}><FolderKanban className="size-5"/></ObjectMark>
            <span className="min-w-0"><span className="flex min-w-0 items-center gap-2"><strong className="truncate text-[16px]">{group.title}</strong><span className="ops-pill ops-pill-neutral">{group.rows.length}</span>{urgent ? <span className="ops-pill ops-pill-red">{urgent} overdue</span> : null}</span><span className="mt-1 block truncate text-[11.5px] text-muted-foreground">{group.subtitle} · Next: {nearest?.title ?? "No action"}</span></span>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", !closed && "rotate-180")}/>
          </button>
          {!closed ? <ul className="border-t border-border/60 bg-background/45 sm:px-3 sm:py-2">{group.rows.map((item) => <OpsRow key={item.id} item={item} selected={false} context={mode === "All Actions" ? [projectLabel(item), customerName(item), item.category] : [item.category, item.waiting_on ? `Waiting on ${item.waiting_on}` : null]} person={mode === "By Person" ? projectLabel(item) : ownerName(item)} onOpen={setSelected}/>)}</ul> : null}
        </section>;
      }) : <div className="grid min-h-56 place-items-center px-6 text-center text-sm text-muted-foreground">No actions match this view.</div>}
    </OpsPlane>
    <WorkItemDialog item={selected} onClose={() => setSelected(null)} />
  </OpsCanvas>;
}

function Segmented({ values, value, onChange }: { values: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="flex h-9 items-center rounded-lg bg-muted p-1">{values.map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={cn("h-7 rounded-md px-3 text-[11.5px] font-bold", value === item ? "bg-card text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground")}>{item}</button>)}</div>;
}