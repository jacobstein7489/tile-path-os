import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { toast } from "sonner";
import { Combobox, EmptyState, FilterGroup, SearchInput, Table, Td, Th } from "@/components/kit";
import { profileOptions, useProfiles } from "@/lib/people";
import {
  compareWorkItems,
  isComplete,
  projectLabel,
  useSaveWorkItem,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";

/**
 * Canonical work list. Company Work, Today and Project → Open Work all render
 * THIS component against the SAME work_items rows, so star / owner / complete /
 * row-open behave identically everywhere.
 */

const VIEWS = ["List", "Grouped by Project"] as const;
type View = (typeof VIEWS)[number];

/** How long a just-completed row stays visible with its green success state. */
const COMPLETE_LINGER_MS = 800;

function dueLabel(due: string | null) {
  if (!due) return "—";
  return new Date(due + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function readStoredView(key: string | undefined, fallback: View): View {
  if (!key || typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  return raw === "List" || raw === "Grouped by Project" ? raw : fallback;
}

/* ---------------- Shared cells ---------------- */

function StarButton({ item, onToggle }: { item: WorkItemRow; onToggle: () => void }) {
  const on = Boolean(item.is_important);
  return (
    <button
      type="button"
      title={on ? "Remove important" : "Mark important"}
      aria-label={on ? "Remove important" : "Mark important"}
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "grid size-8 cursor-pointer place-items-center rounded-lg outline-none",
        "transition-[background-color,transform] duration-150 active:scale-90",
        "hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30",
      )}
    >
      <Star
        className={cn(
          "size-[17px] transition-colors duration-150",
          on
            ? "fill-warning text-warning"
            : "text-muted-foreground/50 hover:text-secondary-foreground",
        )}
        strokeWidth={on ? 2 : 1.8}
      />
    </button>
  );
}

/** Completion control with an immediate, tasteful green check. */
function DoneButton({ done, onChange }: { done: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      title={done ? "Reopen item" : "Mark complete"}
      aria-label={done ? "Reopen item" : "Mark complete"}
      aria-pressed={done}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!done);
      }}
      className="grid size-8 cursor-pointer place-items-center rounded-lg outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span
        className={cn(
          "grid size-[18px] place-items-center rounded-[5px] border",
          "transition-[background-color,border-color,transform] duration-150",
          done
            ? "scale-105 border-success bg-success text-primary-foreground"
            : "border-border-strong bg-background",
        )}
      >
        <svg
          viewBox="0 0 20 20"
          className={cn("size-3 transition-opacity duration-150", done ? "opacity-100" : "opacity-0")}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path d="M4 10.5l4 4 8-8" strokeLinecap="round" />
        </svg>
      </span>
    </button>
  );
}

export function WorkList({
  items,
  onOpen,
  selectedId = null,
  filters,
  matchFilter,
  defaultFilter,
  defaultView = "Grouped by Project",
  viewStorageKey,
  showProjectColumn = true,
  showViewToggle = true,
  showSearch = true,
  isLoading = false,
  emptyTitle = "Nothing open",
  emptyNote = "No work matches this view.",
}: {
  items: WorkItemRow[];
  onOpen: (item: WorkItemRow) => void;
  /** Row whose drawer is open — stays visibly selected. */
  selectedId?: string | null;
  filters: readonly string[];
  matchFilter: (filter: string, item: WorkItemRow) => boolean;
  defaultFilter: string;
  defaultView?: View;
  /** localStorage key so the last selected view is remembered per surface. */
  viewStorageKey?: string;
  /** Project surfaces already know the project, so the column is redundant there. */
  showProjectColumn?: boolean;
  showViewToggle?: boolean;
  showSearch?: boolean;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyNote?: string;
}) {
  const { data: profiles = [] } = useProfiles();
  const save = useSaveWorkItem();
  const [view, setView] = useState<View>(defaultView);
  const [filter, setFilter] = useState<string>(defaultFilter);
  const [search, setSearch] = useState("");
  const [justDone, setJustDone] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Restore the remembered view after hydration (localStorage is client-only).
  useEffect(() => {
    if (viewStorageKey) setView(readStoredView(viewStorageKey, defaultView));
  }, [viewStorageKey, defaultView]);

  const chooseView = (next: View) => {
    setView(next);
    if (viewStorageKey && typeof window !== "undefined")
      window.localStorage.setItem(viewStorageKey, next);
  };

  const owners = useMemo(() => profileOptions(profiles), [profiles]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map((f) => [f, items.filter((i) => matchFilter(f, i)).length]),
      ) as Record<string, number>,
    [items, filters, matchFilter],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(
        (i) =>
          (matchFilter(filter, i) || justDone[i.id]) &&
          (!q || i.title.toLowerCase().includes(q) || projectLabel(i).toLowerCase().includes(q)),
      )
      .sort(compareWorkItems);
  }, [items, filter, search, justDone, matchFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: WorkItemRow[] }>();
    for (const i of rows) {
      const key = i.project_id ?? "unassigned";
      if (!map.has(key)) map.set(key, { name: projectLabel(i), items: [] });
      map.get(key)!.items.push(i);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows]);

  const clearJustDone = useCallback(
    (id: string) =>
      setJustDone((s) => {
        const { [id]: _drop, ...rest } = s;
        return rest;
      }),
    [],
  );

  const toggleStar = (item: WorkItemRow) =>
    save.mutate({
      id: item.id,
      patch: { is_important: !item.is_important },
      note: item.is_important ? "Unmarked important" : "Marked important",
    });

  const setOwner = (item: WorkItemRow, userId: string | null) => {
    const name = owners.find((o) => o.value === userId)?.label ?? null;
    save.mutate({
      id: item.id,
      patch: { owner_user_id: userId, owner: name },
      note: name ? `Owner set to ${name}` : "Owner cleared",
    });
    toast.success(name ? `Assigned to ${name}` : "Owner cleared");
  };

  const toggleComplete = (item: WorkItemRow, next: boolean) => {
    if (next) {
      setJustDone((s) => ({ ...s, [item.id]: true }));
      toast.success("Completed", {
        action: {
          label: "Undo",
          onClick: () => {
            clearJustDone(item.id);
            save.mutate({
              id: item.id,
              patch: { status: "Open", completed_at: null },
              note: "Reopened",
            });
          },
        },
      });
      setTimeout(() => clearJustDone(item.id), COMPLETE_LINGER_MS);
    } else {
      clearJustDone(item.id);
      toast.success("Item restored");
    }
    save.mutate({
      id: item.id,
      patch: next
        ? { status: "Complete", completed_at: new Date().toISOString() }
        : { status: "Open", completed_at: null },
      note: next ? "Marked complete" : "Reopened",
    });
  };

  const Rows = ({ list, withProject }: { list: WorkItemRow[]; withProject: boolean }) => (
    <Table className="table-fixed">
      <colgroup>
        <col className="w-[46px]" />
        {withProject ? <col className="w-[15%]" /> : null}
        <col className={withProject ? "w-[27%]" : "w-[35%]"} />
        <col className="w-[14%]" />
        <col className="w-[12%]" />
        <col className="w-[9%]" />
        <col className="w-[17%]" />
        <col className="w-[46px]" />
      </colgroup>
      <thead>
        <tr className="bg-muted/60">
          <Th> </Th>
          {withProject ? <Th>Project</Th> : null}
          <Th>What Needs To Happen</Th>
          <Th>Owner</Th>
          <Th>Waiting On</Th>
          <Th>Needed By</Th>
          <Th>Next Action</Th>
          <Th> </Th>
        </tr>
      </thead>
      <tbody>
        {list.map((i) => {
          const done = isComplete(i) || Boolean(justDone[i.id]);
          const selected = selectedId === i.id;
          return (
            <tr
              key={i.id}
              tabIndex={0}
              role="button"
              onClick={() => onOpen(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(i);
                }
              }}
              className={cn(
                "group cursor-pointer outline-none transition-colors duration-150",
                "hover:bg-muted/60 active:bg-muted",
                "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35",
                done && "bg-success-soft/70",
                selected && !done && "bg-primary-soft/70 ring-1 ring-inset ring-primary/25",
              )}
            >
              <Td className="group-last:border-0">
                <StarButton item={i} onToggle={() => toggleStar(i)} />
              </Td>
              {withProject ? (
                <Td className="font-semibold group-last:border-0">
                  <span className="block break-words">{projectLabel(i)}</span>
                </Td>
              ) : null}
              <Td className="group-last:border-0">
                <span
                  className={cn(
                    "line-clamp-2 font-medium",
                    done && "text-muted-foreground line-through",
                  )}
                >
                  {i.title}
                </span>
              </Td>
              <Td className="group-last:border-0">
                <div onClick={(e) => e.stopPropagation()}>
                  <Combobox
                    options={owners}
                    value={i.owner_user_id}
                    onChange={(v) => setOwner(i, v)}
                    placeholder={i.owner ?? "Unassigned"}
                    className="w-[140px]"
                  />
                </div>
              </Td>
              <Td className="group-last:border-0">
                {i.waiting_on ? (
                  <span className="flex items-center gap-1.5 text-secondary-foreground">
                    <span className="size-1.5 shrink-0 rounded-full bg-warning" />
                    <span className="truncate">{i.waiting_on}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Td>
              <Td className="whitespace-nowrap text-muted-foreground group-last:border-0">
                {dueLabel(i.due_date)}
              </Td>
              <Td className="group-last:border-0">
                {done ? (
                  <span className="text-[12.5px] font-medium text-success">Completed</span>
                ) : (
                  <span className="line-clamp-2 text-secondary-foreground transition-colors duration-150 group-hover:text-primary">
                    {i.next_action ?? "Open item"}
                  </span>
                )}
              </Td>
              <Td className="group-last:border-0">
                <DoneButton done={done} onChange={(next) => toggleComplete(i, next)} />
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <FilterGroup
          options={filters.map((f) => ({
            value: f,
            label: f === "Important" ? "★ Important" : f,
            count: counts[f] ?? 0,
          }))}
          value={filter}
          onChange={setFilter}
        />
        <div className="ml-auto flex items-center gap-2">
          {showSearch ? (
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search work"
              className="w-[190px]"
            />
          ) : null}
          {showViewToggle ? (
            <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => chooseView(v)}
                  className={cn(
                    "h-8 cursor-pointer rounded-md px-3 text-[12.5px] font-medium outline-none",
                    "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30",
                    view === v
                      ? "bg-primary-soft text-primary"
                      : "text-secondary-foreground hover:bg-muted",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="surface px-5 py-10 text-[13px] text-muted-foreground">Loading work…</div>
      ) : rows.length === 0 ? (
        <div className="surface overflow-hidden">
          <EmptyState title={emptyTitle} note={emptyNote} />
        </div>
      ) : !showViewToggle || view === "List" ? (
        <div className="surface overflow-hidden">
          <Rows list={rows} withProject={showProjectColumn} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([key, group]) => {
            const openCount = group.items.filter((i) => !isComplete(i) && !justDone[i.id]).length;
            const starCount = group.items.filter((i) => i.is_important && !isComplete(i)).length;
            const isCollapsed = Boolean(collapsed[key]);
            return (
              <div key={key} className="surface overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <button
                    type="button"
                    aria-label={isCollapsed ? "Expand project" : "Collapse project"}
                    aria-expanded={!isCollapsed}
                    onClick={() => setCollapsed((s) => ({ ...s, [key]: !isCollapsed }))}
                    className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                  {key === "unassigned" ? (
                    <span className="text-[14.5px] font-semibold tracking-tight">{group.name}</span>
                  ) : (
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: key }}
                      className="text-[14.5px] font-semibold tracking-tight transition-colors duration-150 hover:text-primary"
                    >
                      {group.name}
                    </Link>
                  )}
                  <span className="text-[12.5px] text-muted-foreground tabular-nums">
                    · {openCount} open{starCount ? ` · ${starCount} important` : ""}
                  </span>
                </div>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200",
                    isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <Rows list={group.items} withProject={false} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
