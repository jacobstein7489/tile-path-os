import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckSquare2,
  ChevronDown,
  Clock3,
  Plus,
  Search,
} from "lucide-react";
import { OpsRow, OpsSectionHeading } from "@/components/work/OpsRow";
import { WorkItemDialog } from "@/components/work/WorkItemDialog";
import { useCapture } from "@/components/ops/CaptureProvider";
import { useProfiles } from "@/lib/people";
import { useAuthUser, useMyProfile } from "@/hooks/useAuth";
import { compareWorkItems, isComplete, isItemOwnedBy, projectLabel, useWorkFeed } from "@/lib/workitems";
import type { WorkItemRow } from "@/lib/workitems";
import {
  bucketOrder,
  matchesKpi,
  matchesQuery,
  queueBucket,
  workKpiCounts,
  type WorkKpi,
} from "@/lib/queue";
import { cn } from "@/lib/utils";
import { Button } from "@/components/kit";
import { isOverdue } from "@/lib/workitems";

/**
 * Company action center.
 *
 * Default behaviour is a hard rule: every OPEN work_items record is rendered,
 * organised by the shared queue buckets. The KPI cards are real filters, so a
 * displayed number always reveals its underlying records when clicked.
 */

type Grouping = "Action Queue" | "By Project" | "By Person";
type Scope = "Mine" | "All";

export function WorkBoard() {
  const { data: items = [], isLoading } = useWorkFeed();
  const { data: profiles = [] } = useProfiles();
  const { user } = useAuthUser();
  const { data: myProfile } = useMyProfile();
  const capture = useCapture();

  const [grouping, setGrouping] = useState<Grouping>("Action Queue");
  const [scope, setScope] = useState<Scope>("All");
  const [q, setQ] = useState("");
  const [kpi, setKpi] = useState<WorkKpi | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WorkItemRow | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const ownerName = (item: WorkItemRow) =>
    profiles.find((p) => p.user_id === item.owner_user_id)?.full_name ?? item.owner ?? null;

  const scoped = useMemo(
    () =>
      scope === "Mine"
        ? items.filter((item) => isItemOwnedBy(item, user?.id, myProfile?.full_name))
        : items,
    [items, myProfile?.full_name, scope, user?.id],
  );

  const counts = useMemo(() => workKpiCounts(scoped), [scoped]);

  const visible = useMemo(
    () =>
      scoped.filter((i) => {
        if (showCompleted) return isComplete(i) && matchesQuery(i, q);
        if (isComplete(i)) return false;
        if (kpi && !matchesKpi(kpi, i)) return false;
        return matchesQuery(i, q);
      }),
    [scoped, showCompleted, kpi, q],
  );

  const groups = useMemo(() => {
    const map = new Map<string, WorkItemRow[]>();
    for (const item of visible) {
      const key =
        grouping === "Action Queue"
          ? (queueBucket(item) ?? "Completed")
          : grouping === "By Project"
            ? projectLabel(item)
            : (profiles.find((p) => p.user_id === item.owner_user_id)?.full_name ??
              item.owner ??
              "Unassigned");
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()]
      .map(([key, list]) => ({ key, items: [...list].sort(compareWorkItems) }))
      .sort((a, b) => {
        const last = (k: string) => (k === "Unassigned" || k === "Company / Unassigned" ? 1 : 0);
        if (last(a.key) !== last(b.key)) return last(a.key) - last(b.key);
        if (grouping === "Action Queue") return bucketOrder(a.key) - bucketOrder(b.key);
        if (b.items.length !== a.items.length) return b.items.length - a.items.length;
        return a.key.localeCompare(b.key);
      });
  }, [visible, grouping, profiles]);

  const filtered = Boolean(kpi) || Boolean(q.trim()) || scope === "Mine";
  const resetFilters = () => {
    setKpi(null);
    setQ("");
    setScope("All");
    setShowCompleted(false);
  };

  return (
    <main className="mx-auto w-full max-w-[1380px] px-4 pb-28 md:px-7">
      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-gradient-to-br from-primary-soft/55 to-transparent px-4 py-5 md:px-6">
          <div className="min-w-0">
            <p className="v2-kicker mb-1">Company action queue</p>
            <h1 className="truncate text-[26px] leading-tight font-bold md:text-[34px]">Work</h1>
            <p className="mt-1 truncate text-[12px] text-muted-foreground">
              {isLoading
                ? "Loading company work…"
                : showCompleted
                  ? `${visible.length} completed record${visible.length === 1 ? "" : "s"}`
                  : `${visible.length} of ${counts.Open} open shown${kpi ? ` · ${kpi} filter` : ""}`}
            </p>
          </div>
          <Button variant="primary" onClick={() => capture()}>
            <Plus className="size-4" /> Capture
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          <WorkMetric
            icon={CheckSquare2}
            label="Open"
            value={counts.Open}
            tone="info"
            active={kpi === "Open"}
            onClick={() => {
              setShowCompleted(false);
              setKpi(kpi === "Open" ? null : "Open");
            }}
          />
          <WorkMetric
            icon={Clock3}
            label="Waiting"
            value={counts.Waiting}
            tone="warning"
            active={kpi === "Waiting"}
            onClick={() => {
              setShowCompleted(false);
              setKpi(kpi === "Waiting" ? null : "Waiting");
            }}
          />
          <WorkMetric
            icon={AlertTriangle}
            label="Overdue"
            value={counts.Overdue}
            tone="danger"
            active={kpi === "Overdue"}
            onClick={() => {
              setShowCompleted(false);
              setKpi(kpi === "Overdue" ? null : "Overdue");
            }}
          />
          <WorkMetric
            icon={CalendarCheck2}
            label="Scheduled"
            value={counts.Scheduled}
            tone="success"
            active={kpi === "Scheduled"}
            onClick={() => {
              setShowCompleted(false);
              setKpi(kpi === "Scheduled" ? null : "Scheduled");
            }}
          />
        </div>

        <div className="grid gap-2.5 border-t border-border bg-muted/30 p-3 sm:grid-cols-[auto_auto_minmax(180px,1fr)_auto] sm:items-center md:px-4">
          <Segmented
            options={["Action Queue", "By Project", "By Person"]}
            value={grouping}
            onChange={(v) => setGrouping(v as Grouping)}
          />
          <Segmented
            options={["All", "Mine"]}
            value={scope}
            onChange={(v) => setScope(v as Scope)}
          />
          <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[12.5px] focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search actions, people, jobs"
              className="min-w-0 flex-1 bg-transparent py-1 text-[12.5px] outline-none placeholder:text-muted-foreground"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setShowCompleted((v) => !v);
              setKpi(null);
            }}
            className={cn(
              "shrink-0 text-[11.5px] font-semibold transition-colors",
              showCompleted
                ? "text-foreground underline"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {showCompleted ? "Back to open work" : "Completed history"}
          </button>
        </div>
      </div>

      <div className="pt-4">
        {groups.length ? (
          <div className="workspace-panel overflow-hidden">
            {groups.map((group) => {
              const urgent = group.items.filter(
                (item) => isOverdue(item) || item.is_important,
              ).length;
              const isCollapsed = grouping === "By Project" && !q.trim() && collapsed[group.key];
              return (
                <section key={group.key} className="border-b border-border last:border-b-0">
                  {grouping === "By Project" ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((value) => ({ ...value, [group.key]: !isCollapsed }))
                      }
                      aria-expanded={!isCollapsed}
                      className="grid min-h-[70px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-muted/25 px-4 text-left transition-colors hover:bg-primary-soft/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 focus-visible:outline-none md:px-5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-bold">{group.key}</span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                          {group.items[0]?.title}
                          {urgent ? ` · ${urgent} need attention` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="rounded-full bg-card px-2.5 py-1 text-[11px] font-bold text-secondary-foreground shadow-[var(--shadow-card)]">
                          {group.items.length}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-4 text-muted-foreground transition-transform",
                            !isCollapsed && "rotate-180",
                          )}
                        />
                      </span>
                    </button>
                  ) : (
                    <OpsSectionHeading label={group.key} count={group.items.length} />
                  )}
                  {isCollapsed ? null : (
                    <ul>
                      {group.items.map((item) => (
                        <OpsRow
                          key={item.id}
                          item={item}
                          selected={false}
                          context={
                            grouping === "By Project"
                              ? [
                                  item.category ?? item.item_type,
                                  item.waiting_on ? `Waiting on ${item.waiting_on}` : null,
                                ]
                              : [projectLabel(item), item.category ?? null]
                          }
                          person={grouping === "By Person" ? null : ownerName(item)}
                          onOpen={setSelectedItem}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="workspace-panel px-5 py-10 text-center">
            <p className="text-[13px] font-semibold">
              {isLoading
                ? "Loading…"
                : showCompleted
                  ? "No completed work matches this view."
                  : filtered
                    ? `No work matches ${[kpi, q.trim() && `“${q.trim()}”`, scope === "Mine" && "Mine"]
                        .filter(Boolean)
                        .join(" + ")}.`
                    : "No open work. Capture the next action."}
            </p>
            {filtered ? (
              <Button className="mt-4" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        )}
      </div>
      <WorkItemDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
    </main>
  );
}

function WorkMetric({
  icon: Icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: typeof CheckSquare2;
  label: string;
  value: number;
  tone: "info" | "warning" | "danger" | "success";
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    info: "bg-info-soft text-info",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "grid min-h-[84px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 bg-card px-4 py-3 text-left transition-colors hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 focus-visible:outline-none",
        active && "bg-primary-soft/70 hover:bg-primary-soft/70",
      )}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <strong className="block text-[24px] leading-none font-bold tabular-nums">{value}</strong>
        <span className="mt-1 block truncate text-[11px] font-bold text-muted-foreground uppercase">
          {label}
          {active ? " · filtering" : ""}
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
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
            value === o
              ? "bg-card text-foreground shadow-[var(--shadow-card)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
