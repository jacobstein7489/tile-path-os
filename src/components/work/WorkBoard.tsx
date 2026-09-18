import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { OpsRow, OpsSectionHeading } from "@/components/work/OpsRow";
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

  const openCount = items.filter((i) => !isComplete(i)).length;
  const waitingCount = items.filter((i) => !isComplete(i) && currentMoveState(i) === "Waiting").length;
  const overdueCount = items.filter(isOverdue).length;
  const scheduledCount = items.filter((i) => !isComplete(i) && currentMoveState(i) === "Scheduled").length;

  return (
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

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
          <span><b className="text-foreground">{openCount}</b> open</span>
          <span><b className="text-warning">{waitingCount}</b> waiting</span>
          <span><b className="text-danger">{overdueCount}</b> overdue</span>
          <span><b className="text-primary">{scheduledCount}</b> scheduled</span>
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
            <div className="workspace-panel overflow-hidden">
              {groups.map((group) => {
                return (
                  <section key={group.key} className="border-b border-border last:border-b-0">
                    <OpsSectionHeading label={group.key} count={group.items.length} />
                    <ul>
                      {group.items.map((item) => (
                        <OpsRow
                          key={item.id}
                          item={item}
                          selected={false}
                          context={
                            grouping === "By Project"
                              ? [item.category ?? item.item_type, item.waiting_on ? `Waiting on ${item.waiting_on}` : null]
                              : [projectLabel(item), item.category ?? null]
                          }
                          person={grouping === "By Project" ? ownerName(item) : null}
                        />
                      ))}
                    </ul>
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

