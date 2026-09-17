import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, ListChecks, Plus, Search } from "lucide-react";
import { OpsRow, OpsSectionHeading } from "@/components/work/OpsRow";
import { WorkItemPanel } from "@/components/work/WorkItemPanel";
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

const PER_GROUP = 5;

type Grouping = "By Project" | "By Person";
type Scope = "Mine" | "All";

export function WorkBoard() {
  const { data: items = [], isLoading } = useWorkFeed();
  const { data: profiles = [] } = useProfiles();
  const { user } = useAuthUser();
  const capture = useCapture();

  const [grouping, setGrouping] = useState<Grouping>("By Project");
  const [scope, setScope] = useState<Scope>("All");
  const [q, setQ] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<WorkItemRow | null>(null);

  const ownerName = (item: WorkItemRow) =>
    profiles.find((p) => p.user_id === item.owner_user_id)?.full_name ?? item.owner ?? null;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (showCompleted !== isComplete(i)) return false;
      if (scope === "Mine" && i.owner_user_id !== user?.id) return false;
      if (!needle) return true;
      return [i.title, i.description, i.waiting_on, i.owner, i.category, projectLabel(i)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [items, q, scope, showCompleted, user?.id]);

  const groups = useMemo(() => {
    const map = new Map<string, WorkItemRow[]>();
    for (const item of visible) {
      const key =
        grouping === "By Project"
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
        if (b.items.length !== a.items.length) return b.items.length - a.items.length;
        return a.key.localeCompare(b.key);
      });
  }, [visible, grouping, profiles]);

  const activeItem = active ? (items.find((i) => i.id === active.id) ?? active) : null;
  const openCount = items.filter((i) => !isComplete(i)).length;
  const waitingCount = items.filter((i) => !isComplete(i) && currentMoveState(i) === "Waiting").length;
  const overdueCount = items.filter(isOverdue).length;
  const scheduledCount = items.filter((i) => !isComplete(i) && currentMoveState(i) === "Scheduled").length;

  return (
    <>
      <main className="mx-auto w-full max-w-[1380px] px-4 pb-28 md:px-7">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 pt-5 md:pt-7">
          <div className="min-w-0">
            <h1 className="truncate text-[24px] leading-tight font-bold md:text-[30px]">
              Work
            </h1>
            <p className="mt-1 truncate text-[11.5px] text-muted-foreground">
              {isLoading ? "Loading company work…" : `${openCount} open across every job`}
            </p>
          </div>
          <Button variant="primary" onClick={() => capture()}><Plus className="size-4" /> Capture</Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <WorkMetric label="Open" value={openCount} icon={<ListChecks className="size-4" />} tone="primary" />
          <WorkMetric label="Waiting" value={waitingCount} icon={<Clock3 className="size-4" />} tone="warning" />
          <WorkMetric label="Overdue" value={overdueCount} icon={<AlertTriangle className="size-4" />} tone="danger" />
          <WorkMetric label="Scheduled" value={scheduledCount} icon={<CalendarClock className="size-4" />} tone="success" />
        </div>

        <div className="workspace-panel sticky top-16 z-10 mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 px-3 py-2.5 backdrop-blur md:px-4">
          <Segmented
            options={["By Project", "By Person"]}
            value={grouping}
            onChange={(v) => setGrouping(v as Grouping)}
          />
          <Segmented
            options={["All", "Mine"]}
            value={scope}
            onChange={(v) => setScope(v as Scope)}
          />
          <label className="flex min-w-[140px] flex-1 items-center gap-2 text-[12.5px]">
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
              showCompleted ? "text-foreground underline" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {showCompleted ? "Back to open work" : "Completed history"}
          </button>
        </div>

        <div className="pt-5">
          {groups.length ? (
            <div className="grid items-start gap-4 xl:grid-cols-2">
              {groups.map((group) => {
                const open = expanded[group.key];
                const shown = open ? group.items : group.items.slice(0, PER_GROUP);
                return (
                  <section key={group.key} className="workspace-panel overflow-hidden">
                    <OpsSectionHeading label={group.key} count={group.items.length} />
                    <ul>
                      {shown.map((item) => (
                        <OpsRow
                          key={item.id}
                          item={item}
                          selected={item.id === active?.id}
                          onOpen={setActive}
                          context={
                            grouping === "By Project"
                              ? [item.category ?? item.item_type, item.waiting_on ? `Waiting on ${item.waiting_on}` : null]
                              : [projectLabel(item), item.category ?? null]
                          }
                          person={grouping === "By Project" ? ownerName(item) : null}
                        />
                      ))}
                    </ul>
                    {group.items.length > PER_GROUP ? (
                      <button
                        type="button"
                        onClick={() => setExpanded((s) => ({ ...s, [group.key]: !open }))}
                        className="w-full border-t border-border px-4 py-3 text-left text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary-soft"
                      >
                        {open ? "Show less" : `View all ${group.items.length}`}
                      </button>
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
      </main>

      <WorkItemPanel item={activeItem} onClose={() => setActive(null)} />
    </>
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

function WorkMetric({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "primary" | "warning" | "danger" | "success" }) {
  const styles = tone === "warning" ? "bg-warning-soft text-warning" : tone === "danger" ? "bg-danger-soft text-danger" : tone === "success" ? "bg-success-soft text-success" : "bg-info-soft text-info";
  return <div className="workspace-panel flex items-center gap-3 p-3.5"><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${styles}`}>{icon}</span><div><strong className="block text-[22px] leading-none tabular-nums">{value}</strong><span className="mt-1 block text-[10.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{label}</span></div></div>;
}
