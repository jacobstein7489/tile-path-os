import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Plus,
  Star,
} from "lucide-react";

import { toast } from "sonner";
import {
  Button,
  Combobox,
  DateField,
  EmptyState,
  SearchInput,
  Table,
  Td,
  Th,
} from "@/components/kit";
import { Highlight } from "@/components/InlineEdit";
import { profileOptions, useProfiles } from "@/lib/people";
import {
  compareWorkItems,
  isComplete,
  isDueToday,
  isOverdue,
  isWaiting,
  projectLabel,
  useCreateWorkItems,
  useSaveWorkItem,
  workSummary,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";

/**
 * Canonical work list. Company Work, Today and Project → Open Work all render
 * THIS component against the SAME work_items rows, so star / owner / complete /
 * inline edit / row-open behave identically everywhere.
 */

const VIEWS = ["List", "Grouped by Project", "By Person"] as const;
type View = (typeof VIEWS)[number];

type SummaryKey = "Open" | "Unassigned" | "Waiting" | "Overdue";

/** The summary strip narrows the list instead of just reporting a number. */
function matchesSummaryKey(key: SummaryKey, i: WorkItemRow) {
  if (isComplete(i)) return false;
  if (key === "Open") return true;
  if (key === "Unassigned") return !i.owner_user_id && !i.owner;
  if (key === "Waiting") return isWaiting(i);
  return isOverdue(i);
}

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
        "-m-1 grid size-11 cursor-pointer place-items-center rounded-full outline-none",
        "transition-[background-color,transform] duration-150 active:scale-90",
        on ? "hover:bg-warning-soft" : "hover:bg-muted",
        "focus-visible:ring-2 focus-visible:ring-primary/30",
      )}
    >
      <Star
        className={cn(
          "size-[18px] transition-[color,transform] duration-150",
          on
            ? "scale-110 fill-warning text-warning"
            : "text-muted-foreground/60 hover:scale-110 hover:text-foreground",
        )}
        strokeWidth={on ? 2 : 1.9}
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
      className="-m-1 grid size-11 cursor-pointer place-items-center rounded-full outline-none transition-[background-color,transform] duration-150 hover:bg-success-soft active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span
        className={cn(
          "grid size-[20px] place-items-center rounded-full border-[1.5px]",
          "transition-[background-color,border-color,transform] duration-150",
          done
            ? "scale-110 border-success bg-success text-primary-foreground"
            : "border-border-strong bg-background text-transparent group-hover:border-success/70 group-hover:text-success/50",
        )}
      >
        <svg
          viewBox="0 0 20 20"
          className={cn(
            "size-3 transition-transform duration-150",
            done ? "scale-100" : "scale-75",
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path d="M4 10.5l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
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
  showSummary = false,
  startCollapsed = true,
  toolbarRight,
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
  /** Quiet one-line summary above the controls (Company Work / Today). */
  showSummary?: boolean;
  /** Grouped sections start closed so the page opens as a short scannable list. */
  startCollapsed?: boolean;
  /** Right-side toolbar slot, e.g. Quick Capture. */
  toolbarRight?: ReactNode;
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

  /** Summary strip focus — Open / Unassigned / Waiting / Overdue. */
  const [focus, setFocus] = useState<SummaryKey | null>(null);
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
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable)
        return;
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
        .filter(
          (i) =>
            (matchFilter(filter, i) || justDone[i.id]) &&
            matchesSearch(i, q) &&
            (!focus || matchesSummaryKey(focus, i) || justDone[i.id]),
        )
        .sort(compareWorkItems),
    [items, filter, q, justDone, matchFilter, focus],
  );

  const byPerson = view === "By Person";
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: WorkItemRow[] }>();
    for (const i of rows) {
      const key = byPerson ? (i.owner_user_id ?? "unassigned") : (i.project_id ?? "unassigned");
      const name = byPerson
        ? (profiles.find((p) => p.user_id === i.owner_user_id)?.full_name ??
          i.owner ??
          "Unassigned")
        : projectLabel(i);
      if (!map.has(key)) map.set(key, { name, items: [] });
      map.get(key)!.items.push(i);
    }
    // Unassigned work sits first — it is the pile that needs an owner.
    return [...map.entries()].sort((a, b) => {
      if ((a[0] === "unassigned") !== (b[0] === "unassigned"))
        return a[0] === "unassigned" ? -1 : 1;
      return a[1].name.localeCompare(b[1].name);
    });
  }, [rows, byPerson, profiles]);

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

  const addItem = async (projectKey: string, draft: Partial<WorkItemRow> & { title: string }) => {
    const t = draft.title.trim();
    if (!t) return;
    await create.mutateAsync([
      {
        ...draft,
        project_id: projectKey === "unassigned" ? null : projectKey,
        item_type: "Task",
        title: t,
        status: "Open",
      },
    ]);
    toast.success("Item added");
  };

  /* ---------------- Desktop rows ---------------- */

  const Cols = ({ withProject }: { withProject: boolean }) => (
    <colgroup>
      <col className="w-[44px]" />
      {withProject ? <col className="w-[17%]" /> : null}
      <col />
      <col className="w-[168px]" />
      <col className="w-[92px]" />
      <col className="w-[48px]" />
    </colgroup>
  );

  const HeaderCells = ({ withProject }: { withProject: boolean }) => (
    <tr className="bg-muted/50">
      <Th>
        <span className="sr-only">Important</span>
      </Th>
      {withProject ? <Th>Project</Th> : null}
      <Th>Action</Th>
      <Th>Owner</Th>
      <Th>Due</Th>
      <Th>
        <span className="sr-only">Done</span>
      </Th>
    </tr>
  );

  /** One sticky header row shared by all project groups in the grouped view. */
  const GroupedHeader = () => (
    <div className="surface sticky top-[116px] z-[9] hidden overflow-hidden md:block">
      <Table className="table-fixed">
        <Cols withProject={false} />
        <thead>
          <HeaderCells withProject={false} />
        </thead>
      </Table>
    </div>
  );

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
      <Cols withProject={withProject} />
      <thead className={withHeader ? undefined : "sr-only"}>
        <HeaderCells withProject={withProject} />
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
              <Td className="pr-0 pl-3 group-last:border-0">
                <StarButton item={i} onToggle={() => toggleStar(i)} />
              </Td>
              {withProject ? (
                <Td className="group-last:border-0">
                  <span className="block truncate text-[12.5px] font-semibold text-secondary-foreground">
                    <Highlight text={projectLabel(i)} query={q} />
                  </span>
                </Td>
              ) : null}
              <Td className="group-last:border-0">
                <span
                  className={cn(
                    "block text-[13.5px] leading-snug font-semibold break-words",
                    done && "text-muted-foreground line-through",
                  )}
                >
                  <Highlight text={i.title} query={q} />
                </span>
                {/* One quiet subline instead of three extra columns. */}
                {!done && (i.waiting_on || i.next_action) ? (
                  <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                    {i.waiting_on ? (
                      <span className="text-warning">Waiting on {i.waiting_on}</span>
                    ) : null}
                    {i.waiting_on && i.next_action ? " · " : ""}
                    {i.next_action ? <Highlight text={i.next_action} query={q} /> : null}
                  </span>
                ) : null}
                {done ? (
                  <span className="mt-0.5 block text-[12px] font-medium text-success">
                    Completed
                  </span>
                ) : null}
              </Td>
              <Td className="group-last:border-0">
                <div onClick={(e) => e.stopPropagation()}>
                  <Combobox
                    options={owners}
                    value={i.owner_user_id}
                    onChange={(v) => setOwner(i, v)}
                    placeholder={i.owner ?? "Unassigned"}
                    className="w-full min-w-0 [&>button]:border-transparent [&>button]:bg-transparent [&>button]:px-1.5 [&>button]:hover:bg-muted"
                  />
                </div>
              </Td>
              <Td className="group-last:border-0">
                <span
                  className={cn(
                    "text-[12.5px] font-medium whitespace-nowrap tabular-nums",
                    !done && isOverdue(i)
                      ? "text-danger"
                      : !done && isDueToday(i)
                        ? "text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  {!done && isDueToday(i) ? "Today" : dueLabel(i.due_date)}
                </span>
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
                "flex min-h-[64px] cursor-pointer items-start gap-3 px-3 py-3.5 transition-colors duration-150 active:bg-muted",
                done && "bg-success-soft/70",
                selectedId === i.id && !done && "bg-primary-soft/70",
              )}
            >
              <span className="pt-0.5">
                <StarButton item={i} onToggle={() => toggleStar(i)} />
              </span>
              <div className="min-w-0 flex-1">
                {withProject ? (
                  <p className="truncate text-[11.5px] font-semibold text-muted-foreground">
                    <Highlight text={projectLabel(i)} query={q} />
                  </p>
                ) : null}
                <p
                  className={cn(
                    "text-[14.5px] leading-snug font-semibold",
                    done && "text-muted-foreground line-through",
                  )}
                >
                  <Highlight text={i.title} query={q} />
                </p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {i.owner ?? "Unassigned"}
                  {i.next_action ? ` · ${i.next_action}` : ""}
                </p>
                {i.waiting_on || i.due_date ? (
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                    {i.waiting_on ? (
                      <span className="flex items-center gap-1.5 text-warning">
                        <span className="size-1.5 rounded-full bg-warning" />
                        Waiting on {i.waiting_on}
                      </span>
                    ) : null}
                    {i.due_date ? (
                      <span className="text-muted-foreground">
                        Needed by {dueLabel(i.due_date)}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <span className="pt-0.5">
                <DoneButton done={done} onChange={(next) => toggleComplete(i, next)} />
              </span>
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

  /** Deliberate inline composer: title first, optional detail fields alongside. */
  const AddRow = ({ projectKey }: { projectKey: string }) => {
    const open = Boolean(adding[projectKey]);
    const [title, setTitle] = useState("");
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [waiting, setWaiting] = useState("");
    const [due, setDue] = useState("");
    const [next, setNext] = useState("");
    const [notes, setNotes] = useState("");
    const [expanded, setExpanded] = useState(false);

    const close = () => {
      setAdding((s) => ({ ...s, [projectKey]: false }));
      setTitle("");
      setOwnerId(null);
      setWaiting("");
      setDue("");
      setNext("");
      setNotes("");
      setExpanded(false);
    };

    const submit = async () => {
      if (!title.trim()) return;
      await addItem(projectKey, {
        title: title.trim(),
        owner_user_id: ownerId,
        owner: owners.find((o) => o.value === ownerId)?.label ?? null,
        waiting_on: waiting.trim() || null,
        due_date: due || null,
        next_action: next.trim() || null,
        description: notes.trim() || null,
      });
      close();
    };

    if (!open) {
      return (
        <div className="border-t border-border/70 px-3 py-2">
          <button
            type="button"
            onClick={() => setAdding((s) => ({ ...s, [projectKey]: true }))}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-muted-foreground outline-none transition-colors duration-150 hover:bg-primary-soft hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Plus className="size-4" /> Add item
          </button>
        </div>
      );
    }

    return (
      <div className="border-t border-border/70 bg-muted/30 px-3 py-3">
        <div className="space-y-2.5">
          <input
            autoFocus
            value={title}
            aria-label="What needs to happen"
            placeholder="What needs to happen…"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Enter") void submit();
            }}
            className="h-10 w-full rounded-lg border border-ring bg-background px-3 text-[13.5px] font-medium outline-none ring-2 ring-ring/25"
          />
          {expanded ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                  Owner
                </span>
                <Combobox
                  options={owners}
                  value={ownerId}
                  onChange={setOwnerId}
                  placeholder="Unassigned"
                  className="w-full"
                />
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                  Needed by
                </span>
                <DateField
                  value={due || null}
                  label="Needed by"
                  placeholder="No date"
                  onChange={(v) => setDue(v ?? "")}
                />
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                  Waiting on
                </span>
                <input
                  value={waiting}
                  aria-label="Waiting on"
                  placeholder="Nobody"
                  onChange={(e) => setWaiting(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                  Next action
                </span>
                <input
                  value={next}
                  aria-label="Next action"
                  placeholder="The very next step"
                  onChange={(e) => setNext(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div className="sm:col-span-2">
                <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                  Notes
                </span>
                <textarea
                  rows={2}
                  value={notes}
                  aria-label="Notes"
                  placeholder="Context, decisions, anything useful."
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void submit()}
              disabled={!title.trim()}
            >
              Add item
            </Button>
            <Button size="sm" onClick={close}>
              Cancel
            </Button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-auto cursor-pointer text-[12px] font-semibold text-primary outline-none hover:underline"
            >
              {expanded ? "Fewer details" : "More details"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const setAllCollapsed = (next: boolean) =>
    setCollapsed(Object.fromEntries(groups.map(([key]) => [key, next])));

  const anyExpanded = groups.some(([key]) => !(collapsed[key] ?? startCollapsed));

  const ViewToggle = () => (
    <div className="flex shrink-0 items-center rounded-lg border border-border bg-background p-0.5">
      {VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => chooseView(v)}
          className={cn(
            "h-8 cursor-pointer rounded-md px-2.5 text-[12.5px] font-semibold outline-none",
            "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30",
            view === v
              ? "bg-primary-soft text-primary"
              : "text-secondary-foreground hover:bg-muted",
          )}
        >
          {v === "Grouped by Project" ? "By Project" : v}
        </button>
      ))}
    </div>
  );

  const CollapseButton = () => (
    <button
      type="button"
      onClick={() => setAllCollapsed(anyExpanded)}
      className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12.5px] font-semibold text-secondary-foreground outline-none transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      {anyExpanded ? (
        <ChevronsDownUp className="size-3.5" />
      ) : (
        <ChevronsUpDown className="size-3.5" />
      )}
      {anyExpanded ? "Collapse all" : "Expand all"}
    </button>
  );

  /** Quiet management answer line: how much is open, unowned, waiting, late. */
  const summary = useMemo(() => workSummary(items), [items]);
  const summaryKeys: SummaryKey[] = ["Open", "Unassigned", "Waiting", "Overdue"];
  const summaryTone: Record<SummaryKey, string> = {
    Open: "text-secondary-foreground",
    Unassigned: "text-secondary-foreground",
    Waiting: "text-warning",
    Overdue: "text-danger",
  };

  /** Filter chips: one scannable row, scrollable on a phone rather than hidden. */
  const FilterChips = () => (
    <div className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {filters.map((f) => {
        const active = filter === f;
        return (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold whitespace-nowrap outline-none",
              "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f === "Important" ? "★ Important" : f}
            <span className={cn("tabular-nums", active ? "opacity-80" : "opacity-60")}>
              {counts[f] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      {showSummary ? (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px]">
          {summaryKeys.map((key, idx) => (
            <span key={key} className="flex items-center gap-1.5">
              {idx > 0 ? <span className="text-border-strong">·</span> : null}
              <button
                type="button"
                onClick={() => setFocus(focus === key ? null : key)}
                aria-pressed={focus === key}
                className={cn(
                  "cursor-pointer rounded-md px-1 py-0.5 font-medium outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30",
                  focus === key ? "bg-foreground text-background" : summaryTone[key],
                )}
              >
                <span className="font-bold tabular-nums">{summary[key]}</span> {key.toLowerCase()}
              </button>
            </span>
          ))}
          {focus ? (
            <button
              type="button"
              onClick={() => setFocus(null)}
              className="ml-1 cursor-pointer text-[12px] font-semibold text-primary hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="sticky top-14 z-10 rounded-xl border border-border bg-background/95 px-2 py-2 backdrop-blur">
        {/* One control row on desktop; wraps to two on a phone. */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="w-full min-w-0 md:w-auto">
            <FilterChips />
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 md:ml-auto md:w-auto md:flex-nowrap">

            {showViewToggle ? <ViewToggle /> : null}
            {showViewToggle && view !== "List" ? <CollapseButton /> : null}
            {showSearch ? (
              <SearchInput
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search work…"
                className="min-w-0 flex-1 md:w-[220px] md:flex-none"
              />
            ) : null}
            {toolbarRight ? <div className="shrink-0">{toolbarRight}</div> : null}
          </div>
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
          <GroupedHeader />
          {groups.map(([key, group]) => {
            const openCount = group.items.filter((i) => !isComplete(i) && !justDone[i.id]).length;
            const starCount = group.items.filter((i) => i.is_important && !isComplete(i)).length;
            const waitCount = group.items.filter(
              (i) => !isComplete(i) && (Boolean(i.waiting_on) || i.status === "Waiting"),
            ).length;
            // While searching, matching sections open regardless of session state.
            const isCollapsed = q ? false : (collapsed[key] ?? startCollapsed);
            return (
              <div key={key} className="surface overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border-strong/70 bg-muted/60 px-2 py-2.5 md:px-2.5">
                  <button
                    type="button"
                    aria-label={isCollapsed ? "Expand project" : "Collapse project"}
                    aria-expanded={!isCollapsed}
                    onClick={() => setCollapsed((s) => ({ ...s, [key]: !isCollapsed }))}
                    className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground outline-none transition-[background-color,transform] duration-150 hover:bg-background hover:text-foreground active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                  <div className="min-w-0">
                    {byPerson || key === "unassigned" ? (
                      <span className="block truncate text-[15px] font-bold tracking-[-0.01em]">
                        {group.name}
                      </span>
                    ) : (
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: key }}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate text-[15px] font-bold tracking-[-0.01em] transition-colors duration-150 hover:text-primary hover:underline"
                      >
                        <Highlight text={group.name} query={q} />
                      </Link>
                    )}
                    <span className="mt-0.5 block text-[11.5px] font-medium text-muted-foreground tabular-nums">
                      {[
                        openCount ? `${openCount} open` : "",
                        starCount ? `${starCount} important` : "",
                        waitCount ? `${waitCount} waiting` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No open work"}
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
