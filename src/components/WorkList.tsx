import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Combobox, EmptyState, FilterGroup, SearchInput, Table, Td, Th } from "@/components/kit";
import { Highlight } from "@/components/InlineEdit";
import { profileOptions, useProfiles } from "@/lib/people";
import {
  compareWorkItems,
  isComplete,
  projectLabel,
  useCreateWorkItems,
  useSaveWorkItem,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";

/**
 * Canonical work list. Company Work, Today and Project → Open Work all render
 * THIS component against the SAME work_items rows, so star / owner / complete /
 * inline edit / row-open behave identically everywhere.
 */

const VIEWS = ["List", "Grouped by Project"] as const;
type View = (typeof VIEWS)[number];

/** How long a just-completed row stays visible with its green success state. */
const COMPLETE_LINGER_MS = 800;

/** Collapsed project sections persist for the session (not across reloads). */
const collapseMemory = new Map<string, Record<string, boolean>>();

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

function matchesSearch(i: WorkItemRow, q: string) {
  if (!q) return true;
  return [i.title, projectLabel(i), i.next_action, i.owner, i.waiting_on]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
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
        "grid size-9 cursor-pointer place-items-center rounded-lg outline-none",
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
      className="grid size-9 cursor-pointer place-items-center rounded-lg outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span
        className={cn(
          "grid size-[18px] place-items-center rounded-[5px] border",
          "transition-[background-color,border-color,transform] duration-150",
          done
            ? "scale-110 border-success bg-success text-primary-foreground"
            : "border-border-strong bg-background",
        )}
      >
        <svg
          viewBox="0 0 20 20"
          className={cn(
            "size-3 transition-opacity duration-150",
            done ? "opacity-100" : "opacity-0",
          )}
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
  allowAdd = true,
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
  /** "+ Add item" inside each expanded project group. */
  allowAdd?: boolean;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyNote?: string;
}) {
  const { data: profiles = [] } = useProfiles();
  const save = useSaveWorkItem();
  const create = useCreateWorkItems();
  const [view, setView] = useState<View>(defaultView);
  const [filter, setFilter] = useState<string>(defaultFilter);
  const [search, setSearch] = useState("");
  const [justDone, setJustDone] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    () => (viewStorageKey ? collapseMemory.get(viewStorageKey) : undefined) ?? {},
  );
  const [adding, setAdding] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Restore the remembered view after hydration (localStorage is client-only).
  useEffect(() => {
    if (viewStorageKey) setView(readStoredView(viewStorageKey, defaultView));
  }, [viewStorageKey, defaultView]);

  // Session memory for collapsed sections.
  useEffect(() => {
    if (viewStorageKey) collapseMemory.set(viewStorageKey, collapsed);
  }, [collapsed, viewStorageKey]);

  // "/" focuses search, the way every work tool behaves.
  useEffect(() => {
    if (!showSearch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSearch]);

  const chooseView = (next: View) => {
    setView(next);
    if (viewStorageKey && typeof window !== "undefined")
      window.localStorage.setItem(viewStorageKey, next);
  };

  const owners = useMemo(() => profileOptions(profiles), [profiles]);
  const q = search.trim().toLowerCase();

  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map((f) => [f, items.filter((i) => matchFilter(f, i)).length]),
      ) as Record<string, number>,
    [items, filters, matchFilter],
  );

  const rows = useMemo(
    () =>
      items
        .filter((i) => (matchFilter(filter, i) || justDone[i.id]) && matchesSearch(i, q))
        .sort(compareWorkItems),
    [items, filter, q, justDone, matchFilter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: WorkItemRow[] }>();
    for (const i of rows) {
      const key = i.project_id ?? "unassigned";
      if (!map.has(key)) map.set(key, { name: projectLabel(i), items: [] });
      map.get(key)!.items.push(i);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows]);

  // Linger timers are tracked so an unmount (route switch) never fires a
  // state update on a dead component.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    },
    [],
  );

  const clearJustDone = useCallback(
    (id: string) =>
      setJustDone((s) => {
        const { [id]: _drop, ...rest } = s;
        return rest;
      }),
    [],
  );

  const patch = (item: WorkItemRow, p: Partial<WorkItemRow>, note: string) =>
    save.mutate({ id: item.id, patch: p, note });

  const toggleStar = (item: WorkItemRow) =>
    patch(
      item,
      { is_important: !item.is_important },
      item.is_important ? "Unmarked important" : "Marked important",
    );

  const setOwner = (item: WorkItemRow, userId: string | null) => {
    const name = owners.find((o) => o.value === userId)?.label ?? null;
    patch(
      item,
      { owner_user_id: userId, owner: name },
      name ? `Owner set to ${name}` : "Owner cleared",
    );
    toast.success(name ? `Assigned to ${name}` : "Owner cleared");
  };

  const toggleComplete = (item: WorkItemRow, next: boolean) => {
    if (next) {
      setJustDone((s) => ({ ...s, [item.id]: true }));
      toast.success("Completed", {
        action: {
          label: "Undo",
          onClick: () => {
            clearTimeout(timers.current[item.id]);
            delete timers.current[item.id];
            clearJustDone(item.id);
            save.mutate({
              id: item.id,
              patch: { status: "Open", completed_at: null },
              note: "Reopened",
            });
          },
        },
      });
      clearTimeout(timers.current[item.id]);
      timers.current[item.id] = setTimeout(() => {
        delete timers.current[item.id];
        clearJustDone(item.id);
      }, COMPLETE_LINGER_MS);
    } else {
      clearTimeout(timers.current[item.id]);
      delete timers.current[item.id];
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

  const addItem = async (projectKey: string, title: string) => {
    const t = title.trim();
    if (!t) return;
    await create.mutateAsync([
      {
        project_id: projectKey === "unassigned" ? null : projectKey,
        item_type: "Task",
        title: t,
        status: "Open",
      },
    ]);
    toast.success("Added");
  };

  /* ---------------- Desktop rows ---------------- */

  const Rows = ({
    list,
    withProject,
    withHeader = true,
  }: {
    list: WorkItemRow[];
    withProject: boolean;
    withHeader?: boolean;
  }) => (
    <Table className="table-fixed">
      <colgroup>
        <col className="w-[48px]" />
        {withProject ? <col className="w-[15%]" /> : null}
        <col className={withProject ? "w-[27%]" : "w-[34%]"} />
        <col className="w-[14%]" />
        <col className="w-[12%]" />
        <col className="w-[10%]" />
        <col className="w-[17%]" />
        <col className="w-[48px]" />
      </colgroup>
      <thead className={withHeader ? undefined : "sr-only"}>
        <tr className={withHeader ? "bg-muted/60" : undefined}>
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
                  <span className="block break-words">
                    <Highlight text={projectLabel(i)} query={q} />
                  </span>
                </Td>
              ) : null}
              <Td className="group-last:border-0">
                <span
                  className={cn(
                    "block font-medium break-words",
                    done && "text-muted-foreground line-through",
                  )}
                >
                  <Highlight text={i.title} query={q} />
                </span>
              </Td>
              <Td className="group-last:border-0">
                <div onClick={(e) => e.stopPropagation()}>
                  <Combobox
                    options={owners}
                    value={i.owner_user_id}
                    onChange={(v) => setOwner(i, v)}
                    placeholder={i.owner ?? "Unassigned"}
                    className="w-full min-w-0"
                  />
                </div>
              </Td>
              <Td className="group-last:border-0">
                {i.waiting_on ? (
                  <span className="flex items-start gap-1.5 text-secondary-foreground">
                    <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-warning" />
                    <span className="block break-words">
                      <Highlight text={i.waiting_on} query={q} />
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Td>
              <Td className="group-last:border-0">
                <span className="whitespace-nowrap text-muted-foreground">
                  {dueLabel(i.due_date)}
                </span>
              </Td>
              <Td className="group-last:border-0">
                {done ? (
                  <span className="text-[12.5px] font-medium text-success">Completed</span>
                ) : i.next_action ? (
                  <span className="block break-words text-secondary-foreground">
                    <Highlight text={i.next_action} query={q} />
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
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

  /* ---------------- Mobile cards ---------------- */

  const Cards = ({ list, withProject }: { list: WorkItemRow[]; withProject: boolean }) => (
    <ul className="divide-y divide-border/70">
      {list.map((i) => {
        const done = isComplete(i) || Boolean(justDone[i.id]);
        return (
          <li key={i.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(i);
                }
              }}
              className={cn(
                "flex cursor-pointer items-start gap-2 px-3 py-3 transition-colors duration-150 active:bg-muted",
                done && "bg-success-soft/70",
                selectedId === i.id && !done && "bg-primary-soft/70",
              )}
            >
              <StarButton item={i} onToggle={() => toggleStar(i)} />
              <div className="min-w-0 flex-1">
                {withProject ? (
                  <p className="text-[11.5px] font-semibold text-muted-foreground">
                    <Highlight text={projectLabel(i)} query={q} />
                  </p>
                ) : null}
                <p
                  className={cn(
                    "text-[14px] font-medium",
                    done && "text-muted-foreground line-through",
                  )}
                >
                  <Highlight text={i.title} query={q} />
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {i.owner ?? "Unassigned"} · {i.next_action ?? "Open item"}
                </p>
                {i.waiting_on || i.due_date ? (
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px]">
                    {i.waiting_on ? (
                      <span className="flex items-center gap-1.5 text-warning">
                        <span className="size-1.5 rounded-full bg-warning" />
                        Waiting on {i.waiting_on}
                      </span>
                    ) : null}
                    {i.due_date ? (
                      <span className="text-muted-foreground">Needed by {dueLabel(i.due_date)}</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <DoneButton done={done} onChange={(next) => toggleComplete(i, next)} />
            </div>
          </li>
        );
      })}
    </ul>
  );

  const Body = ({
    list,
    withProject,
    withHeader = true,
  }: {
    list: WorkItemRow[];
    withProject: boolean;
    withHeader?: boolean;
  }) => (
    <>
      <div className="hidden md:block">
        <Rows list={list} withProject={withProject} withHeader={withHeader} />
      </div>
      <div className="md:hidden">
        <Cards list={list} withProject={withProject} />
      </div>
    </>
  );

  const AddRow = ({ projectKey }: { projectKey: string }) => {
    const open = Boolean(adding[projectKey]);
    const [value, setValue] = useState("");
    return (
      <div className="border-t border-border/70 px-3 py-2">
        {open ? (
          <input
            autoFocus
            value={value}
            aria-label="What needs to happen"
            placeholder="What needs to happen…"
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => {
              if (!value.trim()) setAdding((s) => ({ ...s, [projectKey]: false }));
            }}
            onKeyDown={async (e) => {
              if (e.key === "Escape") {
                setValue("");
                setAdding((s) => ({ ...s, [projectKey]: false }));
              }
              if (e.key === "Enter") {
                const t = value;
                setValue("");
                await addItem(projectKey, t);
              }
            }}
            className="h-9 w-full rounded-lg border border-ring bg-background px-3 text-[13px] outline-none ring-2 ring-ring/25"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding((s) => ({ ...s, [projectKey]: true }))}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Plus className="size-3.5" /> Add item
          </button>
        )}
      </div>
    );
  };

  const setAllCollapsed = (next: boolean) =>
    setCollapsed(Object.fromEntries(groups.map(([key]) => [key, next])));

  return (
    <div className="space-y-3">
      <div className="sticky top-14 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/95 px-2 py-2 backdrop-blur">
        <FilterGroup
          options={filters.map((f) => ({
            value: f,
            label: f === "Important" ? "★ Important" : f,
            count: counts[f] ?? 0,
          }))}
          value={filter}
          onChange={setFilter}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {showSearch ? (
            <SearchInput
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search work  /"
              className="w-[170px] lg:w-[220px]"
            />
          ) : null}
          {showViewToggle ? (
            <>
              <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
                {VIEWS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => chooseView(v)}
                    className={cn(
                      "h-8 cursor-pointer rounded-md px-2.5 text-[12.5px] font-medium outline-none",
                      "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30",
                      view === v
                        ? "bg-primary-soft text-primary"
                        : "text-secondary-foreground hover:bg-muted",
                    )}
                  >
                    {v === "Grouped by Project" ? "Grouped" : v}
                  </button>
                ))}
              </div>
              {view === "Grouped by Project" ? (
                <div className="flex items-center gap-1 text-[12.5px]">
                  <button
                    type="button"
                    onClick={() => setAllCollapsed(true)}
                    className="h-8 cursor-pointer rounded-md px-2 font-medium text-secondary-foreground outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    Collapse All
                  </button>
                  <span className="text-border-strong">|</span>
                  <button
                    type="button"
                    onClick={() => setAllCollapsed(false)}
                    className="h-8 cursor-pointer rounded-md px-2 font-medium text-secondary-foreground outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    Expand All
                  </button>
                </div>
              ) : null}
            </>
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
          <Body list={rows} withProject={showProjectColumn} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([key, group]) => {
            const openCount = group.items.filter((i) => !isComplete(i) && !justDone[i.id]).length;
            const starCount = group.items.filter((i) => i.is_important && !isComplete(i)).length;
            const waitCount = group.items.filter(
              (i) => !isComplete(i) && (Boolean(i.waiting_on) || i.status === "Waiting"),
            ).length;
            // While searching, matching sections open regardless of session state.
            const isCollapsed = q ? false : Boolean(collapsed[key]);
            return (
              <div key={key} className="surface overflow-hidden">
                <div className="flex items-start gap-2 border-b border-border bg-muted/50 px-3 py-2.5">
                  <button
                    type="button"
                    aria-label={isCollapsed ? "Expand project" : "Collapse project"}
                    aria-expanded={!isCollapsed}
                    onClick={() => setCollapsed((s) => ({ ...s, [key]: !isCollapsed }))}
                    className="mt-0.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                  <div className="min-w-0">
                    {key === "unassigned" ? (
                      <span className="block text-[14.5px] font-semibold tracking-tight">
                        {group.name}
                      </span>
                    ) : (
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: key }}
                        onClick={(e) => e.stopPropagation()}
                        className="block text-[14.5px] font-semibold tracking-tight transition-colors duration-150 hover:text-primary"
                      >
                        <Highlight text={group.name} query={q} />
                      </Link>
                    )}
                    <span className="mt-0.5 block text-[12px] text-muted-foreground tabular-nums">
                      {openCount} open
                      {starCount ? ` · ${starCount} important` : ""}
                      {waitCount ? ` · ${waitCount} waiting` : ""}
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200",
                    isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <Body list={group.items} withProject={false} withHeader={false} />
                    {allowAdd ? <AddRow projectKey={key} /> : null}
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
