import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarCheck2,
  CheckSquare2,
  Search,
  UserRound,
} from "lucide-react";
import { OpsRow, OpsSectionHeading } from "@/components/work/OpsRow";
import { WorkItemDialog } from "@/components/work/WorkItemDialog";
import { useCapture } from "@/components/ops/CaptureProvider";
import { useCompanies, useProfiles } from "@/lib/people";
import { useProjects } from "@/lib/data";
import { useAuthUser, useMyProfile } from "@/hooks/useAuth";
import {
  compareWorkItems,
  isComplete,
  isItemOwnedBy,
  isOverdue,
  projectLabel,
  useWorkFeed,
  type WorkItemRow,
} from "@/lib/workitems";
import { actionState, matchesKpi, matchesQuery, workKpiCounts, type WorkKpi } from "@/lib/queue";
import { cn } from "@/lib/utils";
import { Button } from "@/components/kit";

type Mode = "By Project" | "By Person" | "All Actions";
type Scope = "Mine" | "All";

export function WorkBoard({ projectId }: { projectId?: string }) {
  const { data: items = [], isLoading } = useWorkFeed();
  const { data: projects = [] } = useProjects();
  const { data: companies = [] } = useCompanies("customer");
  const { data: profiles = [] } = useProfiles();
  const { user } = useAuthUser();
  const { data: myProfile } = useMyProfile();
  const capture = useCapture();
  const [mode, setMode] = useState<Mode>(projectId ? "All Actions" : "By Project");
  const [scope, setScope] = useState<Scope>("All");
  const [q, setQ] = useState("");
  const [kpi, setKpi] = useState<WorkKpi | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<WorkItemRow | null>(null);

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const ownerName = (item: WorkItemRow) =>
    profiles.find((p) => p.user_id === item.owner_user_id)?.full_name ?? item.owner ?? "Unassigned";
  const customerFor = (item: WorkItemRow) => {
    if (!item.project_id) return "Company action";
    const project = projectMap.get(item.project_id);
    return (
      (project?.customer_company_id && companyMap.get(project.customer_company_id)?.name) ||
      project?.customer ||
      "Customer not set"
    );
  };

  const scoped = useMemo(() => {
    const base = projectId ? items.filter((item) => item.project_id === projectId) : items;
    return scope === "Mine"
      ? base.filter((item) => isItemOwnedBy(item, user?.id, myProfile?.full_name))
      : base;
  }, [items, myProfile?.full_name, projectId, scope, user?.id]);
  const counts = useMemo(() => workKpiCounts(scoped), [scoped]);
  const visible = useMemo(
    () =>
      scoped
        .filter((item) =>
          showCompleted
            ? isComplete(item) && matchesQuery(item, q)
            : !isComplete(item) && (!kpi || matchesKpi(kpi, item)) && matchesQuery(item, q),
        )
        .sort(compareWorkItems),
    [kpi, q, scoped, showCompleted],
  );

  const railGroups = useMemo(() => {
    if (mode === "All Actions") return [];
    const map = new Map<string, WorkItemRow[]>();
    visible.forEach((item) => {
      const key =
        mode === "By Project"
          ? (item.project_id ?? "company")
          : (item.owner_user_id ?? `name:${ownerName(item)}`);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    });
    return [...map.entries()]
      .map(([key, rows]) => ({
        key,
        rows,
        urgent: rows.filter((row) => isOverdue(row) || row.is_important).length,
      }))
      .sort((a, b) => b.urgent - a.urgent || b.rows.length - a.rows.length);
  }, [mode, visible, profiles]);

  useEffect(() => {
    if (mode === "All Actions") return;
    if (!railGroups.some((group) => group.key === selectedKey))
      setSelectedKey(railGroups[0]?.key ?? null);
  }, [mode, railGroups, selectedKey]);

  const selectedRows =
    mode === "All Actions"
      ? visible
      : (railGroups.find((group) => group.key === selectedKey)?.rows ?? []);
  const selectedProject =
    mode === "By Project" && selectedKey && selectedKey !== "company"
      ? projectMap.get(selectedKey)
      : null;
  const groupedStates = (["To Do", "Waiting", "Scheduled", "Done"] as const)
    .map((state) => ({ state, rows: selectedRows.filter((item) => actionState(item) === state) }))
    .filter((group) => group.rows.length);

  return (
    <main className="mx-auto w-full max-w-[1480px] px-3 pb-28 sm:px-5 md:px-6">
      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-raised)]">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-gradient-to-br from-primary-soft/65 to-card px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="min-w-0">
            <p className="v2-kicker mb-1">Company operations</p>
            <h1 className="truncate text-[24px] leading-tight font-bold md:text-[27px]">
              {projectId ? "Project Actions" : "Action Center"}
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {isLoading
                ? "Loading actions…"
                : `${counts.Open} open actions across active operations`}
            </p>
          </div>
          <Button onClick={() => capture()}>Capture</Button>
        </header>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,.8fr)]">
          <Metric
            label="All open"
            value={counts.Open}
            icon={BriefcaseBusiness}
            tone="info"
            active={kpi === "Open"}
            onClick={() => {
              setShowCompleted(false);
              setKpi(kpi === "Open" ? null : "Open");
            }}
          />
          <Metric
            label="To do"
            value={counts["To Do"]}
            icon={CheckSquare2}
            tone="neutral"
            active={kpi === "To Do"}
            onClick={() => {
              setShowCompleted(false);
              setKpi(kpi === "To Do" ? null : "To Do");
            }}
          />
          <Metric
            label="Waiting"
            value={counts.Waiting}
            icon={UserRound}
            tone="warning"
            active={kpi === "Waiting"}
            onClick={() => {
              setShowCompleted(false);
              setKpi(kpi === "Waiting" ? null : "Waiting");
            }}
          />
          <Metric
            label="Scheduled"
            value={counts.Scheduled}
            icon={CalendarCheck2}
            tone="success"
            active={kpi === "Scheduled"}
            onClick={() => {
              setShowCompleted(false);
              setKpi(kpi === "Scheduled" ? null : "Scheduled");
            }}
          />
          {counts["Needs Attention"] ? (
            <Metric
              label="Needs attention"
              value={counts["Needs Attention"]}
              icon={AlertTriangle}
              tone="danger"
              active={kpi === "Needs Attention"}
              onClick={() => {
                setShowCompleted(false);
                setKpi(kpi === "Needs Attention" ? null : "Needs Attention");
              }}
            />
          ) : (
            <div className="hidden bg-card lg:block" />
          )}
        </div>
        <div className="grid gap-2 border-t border-border bg-muted/35 p-2.5 sm:grid-cols-[auto_auto_minmax(180px,1fr)_auto] sm:items-center md:px-4">
          <Segmented
            options={projectId ? ["All Actions"] : ["By Project", "By Person", "All Actions"]}
            value={mode}
            onChange={(value) => {
              setMode(value as Mode);
              setSelectedKey(null);
            }}
          />
          <Segmented
            options={["All", "Mine"]}
            value={scope}
            onChange={(value) => setScope(value as Scope)}
          />
          <label className="flex h-8 min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search actions, projects, people"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setShowCompleted((value) => !value);
              setKpi(null);
            }}
            className="text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"
          >
            {showCompleted ? "Back to open" : "Completed history"}
          </button>
        </div>
      </section>

      <section
        className={cn(
          "mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]",
          mode !== "All Actions" &&
            "md:grid md:h-[calc(100dvh-252px)] md:min-h-[480px] md:grid-cols-[260px_minmax(0,1fr)]",
        )}
      >
        {mode !== "All Actions" ? (
          <aside className="border-b border-border bg-muted/20 md:overflow-y-auto md:border-r md:border-b-0">
            <div className="border-b border-border px-3 py-2">
              <p className="v2-kicker">{mode === "By Project" ? "Projects" : "People"}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto p-2 md:block md:space-y-1 md:overflow-x-visible">
              {railGroups.map((group) => {
                const project =
                  mode === "By Project" && group.key !== "company"
                    ? projectMap.get(group.key)
                    : null;
                const firstRow = group.rows[0];
                if (!firstRow) return null;
                const title =
                  mode === "By Project"
                    ? (project?.name ?? "Company / Unassigned")
                    : ownerName(firstRow);
                const customer =
                  mode === "By Project"
                    ? customerFor(firstRow)
                    : `${new Set(group.rows.map(projectLabel)).size} projects`;
                const waiting = group.rows.filter((row) => actionState(row) === "Waiting").length;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setSelectedKey(group.key)}
                    aria-pressed={selectedKey === group.key}
                    className={cn(
                      "min-w-[220px] rounded-lg border px-3 py-2 text-left transition-all md:min-w-0 md:w-full",
                      selectedKey === group.key
                        ? "border-primary/30 bg-primary-soft shadow-[var(--shadow-card)]"
                        : "border-transparent hover:border-border hover:bg-card",
                    )}
                  >
                    <span className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <span className="min-w-0">
                        <strong className="block truncate text-[13.5px]">{title}</strong>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {customer}
                        </span>
                      </span>
                      <span className="grid size-6 place-items-center rounded-md bg-card text-[11px] font-bold shadow-[var(--shadow-card)]">
                        {group.rows.length}
                      </span>
                    </span>
                    <span className="mt-1 flex gap-2 text-[10.5px] font-semibold">
                      <span className="text-warning">{waiting} waiting</span>
                      {group.urgent ? (
                        <span className="text-danger">{group.urgent} urgent</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        ) : null}
        <div className="min-w-0 md:overflow-y-auto">
          {selectedRows.length ? (
            <>
              <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur">
                <p className="v2-kicker">
                  {mode === "All Actions"
                    ? "All company actions"
                    : mode === "By Project"
                      ? "Selected project"
                      : "Selected person"}
                </p>
                <h2 className="mt-1 truncate text-[16px] font-bold">
                  {mode === "All Actions"
                    ? `${visible.length} actions`
                    : mode === "By Project"
                      ? (selectedProject?.name ?? "Company / Unassigned")
                      : selectedRows[0]
                        ? ownerName(selectedRows[0])
                        : "Unassigned"}
                </h2>
                {selectedProject && selectedRows[0] ? (
                  <p className="mt-1 truncate text-[11.5px] text-muted-foreground">
                    {customerFor(selectedRows[0])} · {selectedProject.lifecycle_stage} ·{" "}
                    {selectedProject.readiness_pct}% ready
                  </p>
                ) : null}
              </div>
              {groupedStates.map((group) => (
                <section key={group.state} className="border-b border-border last:border-0">
                  <OpsSectionHeading label={group.state} count={group.rows.length} />
                  <ul>
                    {group.rows.map((item) => (
                      <OpsRow
                        key={item.id}
                        item={item}
                        selected={false}
                        context={
                          mode === "All Actions"
                            ? [
                                projectLabel(item),
                                customerFor(item),
                                item.category ?? item.item_type,
                              ]
                            : [
                                item.category ?? item.item_type,
                                item.waiting_on ? `Waiting on ${item.waiting_on}` : null,
                              ]
                        }
                        person={mode === "By Person" ? null : ownerName(item)}
                        onOpen={setSelectedItem}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </>
          ) : (
            <div className="grid min-h-[240px] place-items-center px-5 text-center text-[13px] text-muted-foreground">
              {isLoading ? "Loading actions…" : "No actions match this view."}
            </div>
          )}
        </div>
      </section>
      <WorkItemDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: "info" | "neutral" | "warning" | "success" | "danger";
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    info: "bg-info-soft text-info",
    neutral: "bg-muted text-foreground",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "grid min-h-[56px] grid-cols-[32px_minmax(0,1fr)] items-center gap-2 bg-card px-3 text-left transition-colors hover:bg-primary-soft/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30",
        active && "bg-primary-soft/70",
      )}
    >
      <span className={cn("grid size-8 place-items-center rounded-lg", tones[tone])}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <strong className="block text-[20px] leading-none tabular-nums">{value}</strong>
        <span className="mt-1 block truncate text-[10.5px] font-bold text-muted-foreground uppercase">
          {label}
        </span>
      </span>
    </button>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center overflow-x-auto rounded-lg bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            "shrink-0 rounded-md px-2.5 py-1 text-[11.5px] font-semibold",
            value === option
              ? "bg-card text-foreground shadow-[var(--shadow-card)]"
              : "text-muted-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
