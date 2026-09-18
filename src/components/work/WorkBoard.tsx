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
import { useAuthUser } from "@/hooks/useAuth";
import {
  compareWorkItems,
  isComplete,
  projectLabel,
  useWorkFeed,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";
import { Button } from "@/components/kit";
import { currentMoveState } from "@/lib/moveforward";
import { isOverdue } from "@/lib/workitems";

/**
 * Company action center. The same work_items records the rest of the app reads,
 * grouped into quiet operational lists — never cards, never a spreadsheet.
 * Every row opens the shared WorkItemPanel.
 */

type Grouping = "Action Queue" | "By Project" | "By Person";
type Scope = "Mine" | "All";

export function WorkBoard() {
  const { data: items = [], isLoading } = useWorkFeed();
  const { data: profiles = [] } = useProfiles();
  const { user } = useAuthUser();
  const capture = useCapture();

  const [grouping, setGrouping] = useState<Grouping>("Action Queue");
  const [scope, setScope] = useState<Scope>("All");
  const [q, setQ] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WorkItemRow | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const ownerName = (item: WorkItemRow) =>
    profiles.find((p) => p.user_id === item.owner_user_id)?.full_name ?? item.owner ?? null;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (showCompleted !== isComplete(i)) return false;
      if (scope === "Mine" && i.owner_user_id !== user?.id) return false;
      if (!needle) {
        if (showCompleted) return true;
        const state = currentMoveState(i);
        return (
          isOverdue(i) ||
          i.is_important ||
          state === "Waiting" ||
          state === "Scheduled" ||
          Boolean(i.due_date || i.follow_up_on)
        );
      }
      return [i.title, i.description, i.waiting_on, i.owner, i.category, projectLabel(i)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [items, q, scope, showCompleted, user?.id]);

  const groups = useMemo(() => {
    const map = new Map<string, WorkItemRow[]>();
    for (const item of visible) {
      const key =
        grouping === "Action Queue"
          ? actionBucket(item)
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
        // Unassigned / no-job buckets always sit last.
        const last = (k: string) => (k === "Unassigned" || k === "Company / Unassigned" ? 1 : 0);
        const la = last(a.key);
        const lb = last(b.key);
        if (la !== lb) return la - lb;
        if (grouping === "Action Queue")
          return ACTION_BUCKETS.indexOf(a.key) - ACTION_BUCKETS.indexOf(b.key);
        if (b.items.length !== a.items.length) return b.items.length - a.items.length;
        return a.key.localeCompare(b.key);
      });
  }, [visible, grouping, profiles]);

  const openCount = items.filter((i) => !isComplete(i)).length;
  const waitingCount = items.filter(
    (i) => !isComplete(i) && currentMoveState(i) === "Waiting",
  ).length;
  const overdueCount = items.filter(isOverdue).length;
  const scheduledCount = items.filter(
    (i) => !isComplete(i) && currentMoveState(i) === "Scheduled",
  ).length;

  return (
    <main className="mx-auto w-full max-w-[1380px] px-4 pb-28 md:px-7">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 pt-6 md:pt-9">
        <div className="min-w-0">
          <p className="v2-kicker mb-1.5">Company action queue</p>
          <h1 className="truncate text-[28px] leading-tight font-bold md:text-[38px]">Work</h1>
          <p className="mt-1 truncate text-[11.5px] text-muted-foreground">
            {isLoading
              ? "Loading company work…"
              : `${visible.length} actionable now · ${openCount} total open`}
          </p>
        </div>
        <Button variant="primary" onClick={() => capture()}>
          <Plus className="size-4" /> Capture
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <WorkMetric icon={CheckSquare2} label="Open" value={openCount} tone="info" />
        <WorkMetric icon={Clock3} label="Waiting" value={waitingCount} tone="warning" />
        <WorkMetric icon={AlertTriangle} label="Overdue" value={overdueCount} tone="danger" />
        <WorkMetric icon={CalendarCheck2} label="Scheduled" value={scheduledCount} tone="success" />
      </div>

      <div className="workspace-panel sticky top-16 z-10 mt-5 grid gap-3 p-3 backdrop-blur sm:grid-cols-[auto_auto_minmax(180px,1fr)_auto] sm:items-center md:p-4">
        <Segmented
          options={["Action Queue", "By Project", "By Person"]}
          value={grouping}
          onChange={(v) => setGrouping(v as Grouping)}
        />
        <Segmented options={["All", "Mine"]} value={scope} onChange={(v) => setScope(v as Scope)} />
        <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-[12.5px] focus-within:ring-2 focus-within:ring-primary/20">
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
          onClick={() => setShowCompleted((v) => !v)}
          className={cn(
            "shrink-0 text-[11.5px] font-medium transition-colors",
            showCompleted
              ? "text-foreground underline"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {showCompleted ? "Back to open work" : "Completed history"}
        </button>
      </div>

      <div className="pt-5">
        {groups.length ? (
          <div className="workspace-panel overflow-hidden">
            {groups.map((group) => {
              const urgent = group.items.filter(
                (item) => isOverdue(item) || item.is_important,
              ).length;
              const isExpanded =
                grouping !== "By Project" || Boolean(expanded[group.key]) || Boolean(q);
              return (
                <section key={group.key} className="border-b border-border last:border-b-0">
                  {grouping === "By Project" ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((value) => ({ ...value, [group.key]: !isExpanded }))
                      }
                      aria-expanded={isExpanded}
                      className="grid min-h-[74px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-muted/25 px-4 text-left transition-colors hover:bg-primary-soft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 md:px-5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-bold">{group.key}</span>
                        <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">
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
                            isExpanded && "rotate-180",
                          )}
                        />
                      </span>
                    </button>
                  ) : (
                    <OpsSectionHeading label={group.key} count={group.items.length} />
                  )}
                  {isExpanded ? (
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
                          person={
                            grouping === "By Project" || grouping === "Action Queue"
                              ? ownerName(item)
                              : null
                          }
                          onOpen={setSelectedItem}
                        />
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-[12.5px] text-muted-foreground">
            {isLoading
              ? "Loading…"
              : showCompleted
                ? "No completed work matches this view."
                : "No work here. Change the view or capture the next action."}
          </p>
        )}
      </div>
      <WorkItemDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
    </main>
  );
}

const ACTION_BUCKETS = [
  "Needs attention",
  "Due or overdue",
  "Waiting or follow-up",
  "Upcoming or scheduled",
];

function actionBucket(item: WorkItemRow) {
  if (item.is_important || (item.priority === "High" && !item.due_date)) return "Needs attention";
  if (isOverdue(item) || item.due_date === new Date().toISOString().slice(0, 10))
    return "Due or overdue";
  if (currentMoveState(item) === "Waiting" || item.follow_up_on) return "Waiting or follow-up";
  return "Upcoming or scheduled";
}

function WorkMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckSquare2;
  label: string;
  value: number;
  tone: "info" | "warning" | "danger" | "success";
}) {
  const tones = {
    info: "bg-info-soft text-info",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
  } as const;
  return (
    <div className="workspace-panel grid min-h-[88px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="size-4" />
      </span>
      <span>
        <strong className="block text-[24px] leading-none font-bold tabular-nums">{value}</strong>
        <span className="mt-1 block text-[11px] font-bold text-muted-foreground uppercase">
          {label}
        </span>
      </span>
    </div>
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
