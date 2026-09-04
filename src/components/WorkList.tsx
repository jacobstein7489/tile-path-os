import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
} from "lucide-react";

import { toast } from "sonner";
import {
  Avatar,
  Button,
  Combobox,
  DateField,
  EmptyState,
  SearchInput,
  SummaryCard,
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
  todayBucket,
  todayIso,
  useCreateWorkItems,
  useSaveWorkItem,
  workSummary,
  TODAY_BUCKETS,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";

/**
 * Canonical work list. Work, Today and Project → Open Work all render THIS
 * component against the SAME work_items rows, so star / owner / date /
 * complete / open-editor behave identically everywhere.
 *
 * A row shows five things and nothing else: star, action, owner, date, done.
 * Contextual detail (waiting on, follow-up) appears only when it exists.
 */

const VIEWS = ["Grouped by Project", "By Person"] as const;
type View = (typeof VIEWS)[number];

type SummaryKey = "Open" | "Unassigned" | "Waiting" | "Overdue";

/** The summary cards narrow the board instead of just reporting a number. */
function matchesSummaryKey(key: SummaryKey, i: WorkItemRow) {
  if (isComplete(i)) return false;
  if (key === "Open") return true;
  if (key === "Unassigned") return !i.owner_user_id && !i.owner;
  if (key === "Waiting") return isWaiting(i);
  return isOverdue(i);
}

/** How long a just-completed row stays visible with its green success state. */
const COMPLETE_LINGER_MS = 850;

/** Collapsed sections persist for the session (not across reloads). */
const collapseMemory = new Map<string, Record<string, boolean>>();

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function shortDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Human date chip: Overdue, Today, Tomorrow, or Sep 7. */
function dateChip(value: string | null, done: boolean) {
  if (!value) return { label: "Add date", tone: "muted" as const };
  const today = todayIso();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tIso = tomorrow.toISOString().slice(0, 10);
  if (!done && value < today) return { label: `Overdue · ${shortDate(value)}`, tone: "red" as const };
  if (value === today) return { label: "Today", tone: "blue" as const };
  if (value === tIso) return { label: "Tomorrow", tone: "blue" as const };
  return { label: shortDate(value), tone: "plain" as const };
}

function readStoredView(key: string | undefined, fallback: View): View {
  if (!key || typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  return raw === "By Person" || raw === "Grouped by Project" ? raw : fallback;
}

function matchesSearch(i: WorkItemRow, q: string) {
  if (!q) return true;
  return [i.title, projectLabel(i), i.owner, i.waiting_on]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

/* ---------------- Row controls ---------------- */

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
        "grid size-11 shrink-0 cursor-pointer place-items-center rounded-full outline-none",
        "transition-[background-color,transform] duration-150 active:scale-90",
        on ? "hover:bg-warning-soft" : "hover:bg-muted",
        "focus-visible:ring-2 focus-visible:ring-primary/30",
      )}
    >
      <Star
        className={cn(
          "size-[19px] transition-[color,transform] duration-150",
          on
            ? "scale-110 fill-warning text-warning"
            : "text-muted-foreground/55 hover:scale-110 hover:text-foreground",
        )}
        strokeWidth={on ? 2 : 1.9}
      />
    </button>
  );
}

/** Completion control: hover previews green, the click lands instantly. */
function DoneButton({ done, onChange }: { done: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      title={done ? "Reopen action" : "Mark complete"}
      aria-label={done ? "Reopen action" : "Mark complete"}
      aria-pressed={done}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!done);
      }}
      className="group/done grid size-11 shrink-0 cursor-pointer place-items-center rounded-full outline-none transition-[background-color,transform] duration-150 hover:bg-success-soft active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span
        className={cn(
          "grid size-[22px] place-items-center rounded-full border-[1.5px]",
          "transition-[background-color,border-color,transform,color] duration-150",
          done
            ? "scale-110 border-success bg-success text-primary-foreground"
            : "border-border-strong bg-background text-transparent group-hover/done:border-success group-hover/done:bg-success/10 group-hover/done:text-success",
        )}
      >
        <Check className={cn("size-3.5 transition-transform duration-150", done ? "scale-100" : "scale-90")} strokeWidth={3.2} />
      </span>
    </button>
  );
}

/** Compact owner chip that opens a small searchable picker in place. */
function OwnerCell({
  item,
  options,
  onChange,
}: {
  item: WorkItemRow;
  options: { value: string; label: string }[];
  onChange: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrap = useRef<HTMLDivElement | null>(null);
  const name = options.find((o) => o.value === item.owner_user_id)?.label ?? item.owner ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const list = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div ref={wrap} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="Change owner"
        onClick={() => {
          setOpen((v) => !v);
          setQuery("");
        }}
        className={cn(
          "flex h-9 max-w-[160px] cursor-pointer items-center gap-2 rounded-full px-2 outline-none",
          "transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30",
          open && "bg-muted",
        )}
      >
        {name ? (
          <Avatar initials={initialsOf(name)} size={24} />
        ) : (
          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed border-border-strong text-[10px] text-muted-foreground">
            ?
          </span>
        )}
        <span
          className={cn(
            "truncate text-[12.5px] font-medium",
            name ? "text-secondary-foreground" : "text-muted-foreground",
          )}
        >
          {name ? name.split(" ")[0] : "Unassigned"}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-1 w-[240px] overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-raised)]">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Assign to…"
              className="h-10 w-full bg-transparent text-[13px] outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {item.owner_user_id || item.owner ? (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="w-full cursor-pointer px-3 py-2.5 text-left text-[12.5px] text-muted-foreground hover:bg-muted"
                >
                  Unassign
                </button>
              </li>
            ) : null}
            {list.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted"
                >
                  <Avatar initials={initialsOf(o.label)} size={24} />
                  <span className="truncate text-[13px]">{o.label}</span>
                  {o.value === item.owner_user_id ? (
                    <Check className="ml-auto size-3.5 text-primary" />
                  ) : null}
                </button>
              </li>
            ))}
            {list.length === 0 ? (
              <li className="px-3 py-3 text-[12.5px] text-muted-foreground">No people match</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Date chip that opens the calendar straight from the row. */
function DateCell({
  value,
  done,
  onChange,
}: {
  value: string | null;
  done: boolean;
  onChange: (next: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const chip = dateChip(value, done);
  const tone: Record<string, string> = {
    red: "text-danger",
    blue: "text-primary",
    plain: "text-secondary-foreground",
    muted: "text-muted-foreground/70",
  };
  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="Set date"
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (typeof el.showPicker === "function") el.showPicker();
          else el.focus();
        }}
        className={cn(
          "flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold whitespace-nowrap outline-none",
          "transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30",
          tone[chip.tone],
        )}
      >
        {!value ? <CalendarPlus className="size-4" /> : null}
        {chip.label}
      </button>
      <input
        ref={ref}
        type="date"
        aria-label="Set date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="pointer-events-none absolute inset-0 size-full opacity-0"
      />
    </div>
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
  sectionsByBucket = false,
  toolbarRight,
}: {
  items: WorkItemRow[];
  onOpen: (item: WorkItemRow) => void;
  /** Row whose editor is open — stays visibly selected. */
  selectedId?: string | null;
  filters: readonly string[];
  matchFilter: (filter: string, item: WorkItemRow) => boolean;
  defaultFilter: string;
  defaultView?: View;
  /** localStorage key so the last selected view is remembered per surface. */
  viewStorageKey?: string;
  /** Project surfaces already know the project, so the label is redundant there. */
  showProjectColumn?: boolean;
  showViewToggle?: boolean;
  showSearch?: boolean;
  /** "+ Add action" inside each expanded group. */
  allowAdd?: boolean;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyNote?: string;
  /** Four substantial clickable cards above the board. */
  showSummary?: boolean;
  /** Grouped sections start closed so the page opens short and scannable. */
  startCollapsed?: boolean;
  /** Today: fixed Overdue / Today / Follow-ups / Next Up sections, always open. */
  sectionsByBucket?: boolean;
  /** Right-side toolbar slot, e.g. Capture. */
  toolbarRight?: ReactNode;
}) {
  const { data: profiles = [] } = useProfiles();
  const save = useSaveWorkItem();
  const create = useCreateWorkItems();
  const [view, setView] = useState<View>(defaultView);
  const [filter, setFilter] = useState<string>(defaultFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [justDone, setJustDone] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    () => (viewStorageKey ? collapseMemory.get(viewStorageKey) : undefined) ?? {},
  );
  const [adding, setAdding] = useState<Record<string, boolean>>({});

  /** Summary focus — Open / Unassigned / Waiting / Overdue. */
  const [focus, setFocus] = useState<SummaryKey | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const filterWrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (viewStorageKey) setView(readStoredView(viewStorageKey, defaultView));
  }, [viewStorageKey, defaultView]);

  useEffect(() => {
    if (viewStorageKey) collapseMemory.set(viewStorageKey, collapsed);
  }, [collapsed, viewStorageKey]);

  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent) => {
      if (filterWrap.current && !filterWrap.current.contains(e.target as Node)) setFilterOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

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
    if (sectionsByBucket) {
      const done = rows.filter((i) => isComplete(i) || justDone[i.id]);
      const out: [string, { name: string; items: WorkItemRow[] }][] = TODAY_BUCKETS.map(
        (bucket) => [
          bucket,
          {
            name: bucket === "Waiting Follow-Ups" ? "Follow-ups" : bucket,
            items: rows.filter((i) => todayBucket(i) === bucket),
          },
        ],
      );
      if (done.length) out.push(["completed", { name: "Completed", items: done }]);
      return out.filter(([, g]) => g.items.length > 0);
    }
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
  }, [rows, byPerson, profiles, sectionsByBucket, justDone]);

  // Linger timers are tracked so an unmount never fires state on a dead component.
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

  const setDate = (item: WorkItemRow, next: string | null) => {
    const waiting = isWaiting(item) && Boolean(item.follow_up_on);
    patch(
      item,
      waiting ? { follow_up_on: next } : { due_date: next },
      next ? `Date set to ${shortDate(next)}` : "Date cleared",
    );
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
      toast.success("Action reopened");
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
    toast.success("Action added");
  };

  /* ---------------- One row, same markup on desktop and phone ---------------- */

  const Row = ({ item, withProject }: { item: WorkItemRow; withProject: boolean }) => {
    const done = isComplete(item) || Boolean(justDone[item.id]);
    const selected = selectedId === item.id;
    const waiting = !done && isWaiting(item);
    const dateValue = waiting && item.follow_up_on ? item.follow_up_on : item.due_date;

    const context = [
      waiting && item.waiting_on ? `Waiting on ${item.waiting_on}` : "",
      item.category && !waiting ? item.category : "",
    ].filter(Boolean);

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(item);
          }
        }}
        className={cn(
          "flex cursor-pointer items-start gap-1 px-2 py-2.5 outline-none transition-colors duration-150 md:items-center md:gap-2 md:px-3",
          "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35",
          done && "bg-success-soft/60",
          selected && !done && "bg-primary-soft/60",
        )}
      >
        <StarButton item={item} onToggle={() => toggleStar(item)} />

        <div className="min-w-0 flex-1 py-1">
          {withProject ? (
            <p className="truncate text-[11.5px] font-semibold tracking-[0.02em] text-muted-foreground">
              <Highlight text={projectLabel(item)} query={q} />
            </p>
          ) : null}
          <p
            className={cn(
              "text-[14.5px] leading-snug font-semibold tracking-[-0.01em]",
              done && "text-muted-foreground line-through",
            )}
          >
            <Highlight text={item.title} query={q} />
          </p>
          {done ? (
            <p className="mt-1 text-[12px] font-semibold text-success">Completed</p>
          ) : context.length ? (
            <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
              {waiting && item.waiting_on ? (
                <span className="text-warning">Waiting on {item.waiting_on}</span>
              ) : (
                context[0]
              )}
            </p>
          ) : null}

          {/* Phone: owner and date sit under the action, still tappable. */}
          <div className="mt-1 flex items-center gap-1 md:hidden">
            <OwnerCell item={item} options={owners} onChange={(v) => setOwner(item, v)} />
            <DateCell value={dateValue} done={done} onChange={(v) => setDate(item, v)} />
          </div>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          <OwnerCell item={item} options={owners} onChange={(v) => setOwner(item, v)} />
          <div className="w-[150px] text-right">
            <DateCell value={dateValue} done={done} onChange={(v) => setDate(item, v)} />
          </div>
        </div>

        <DoneButton done={done} onChange={(next) => toggleComplete(item, next)} />
      </div>
    );
  };

  const Body = ({ list, withProject }: { list: WorkItemRow[]; withProject: boolean }) => (
    <div className="divide-y divide-border/70">
      {list.map((i) => (
        <Row key={i.id} item={i} withProject={withProject} />
      ))}
    </div>
  );

  /** Inline composer: one field, optional detail behind More. */
  const AddRow = ({ projectKey }: { projectKey: string }) => {
    const open = Boolean(adding[projectKey]);
    const [title, setTitle] = useState("");
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [due, setDue] = useState("");
    const [expanded, setExpanded] = useState(false);

    const close = () => {
      setAdding((s) => ({ ...s, [projectKey]: false }));
      setTitle("");
      setOwnerId(null);
      setDue("");
      setExpanded(false);
    };

    const submit = async () => {
      if (!title.trim()) return;
      await addItem(projectKey, {
        title: title.trim(),
        owner_user_id: ownerId,
        owner: owners.find((o) => o.value === ownerId)?.label ?? null,
        due_date: due || null,
      });
      close();
    };

    if (!open) {
      return (
        <div className="border-t border-border/70 px-2 py-1.5">
          <button
            type="button"
            onClick={() => setAdding((s) => ({ ...s, [projectKey]: true }))}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-muted-foreground outline-none transition-colors duration-150 hover:bg-primary-soft hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Plus className="size-4" /> Add action
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
            className="h-11 w-full rounded-lg border border-ring bg-background px-3 text-[16px] font-medium outline-none ring-2 ring-ring/25 md:text-[14px]"
          />
          {expanded ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">
                  Assign to
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
                <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">
                  Due
                </span>
                <DateField
                  value={due || null}
                  label="Due"
                  placeholder="No date"
                  onChange={(v) => setDue(v ?? "")}
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
              Add action
            </Button>
            <Button size="sm" onClick={close}>
              Cancel
            </Button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-auto cursor-pointer text-[12.5px] font-semibold text-primary outline-none hover:underline"
            >
              {expanded ? "Less" : "More"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const setAllCollapsed = (next: boolean) =>
    setCollapsed(Object.fromEntries(groups.map(([key]) => [key, next])));

  const anyExpanded = groups.some(([key]) => !(collapsed[key] ?? startCollapsed));

  /* ---------------- Header controls ---------------- */

  const summary = useMemo(() => workSummary(items), [items]);
  const summaryCards: { key: SummaryKey; tone: "blue" | "neutral" | "amber" | "red" }[] = [
    { key: "Open", tone: "blue" },
    { key: "Unassigned", tone: "neutral" },
    { key: "Waiting", tone: "amber" },
    { key: "Overdue", tone: "red" },
  ];

  const activeFilterLabel = filter === defaultFilter ? null : filter;

  const FiltersMenu = () => (
    <div ref={filterWrap} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setFilterOpen((v) => !v)}
        aria-expanded={filterOpen}
        className={cn(
          "flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-[13px] font-semibold outline-none",
          "transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30",
          activeFilterLabel ? "border-primary/40 bg-primary-soft text-primary" : "text-secondary-foreground",
        )}
      >
        <SlidersHorizontal className="size-4" />
        {activeFilterLabel ?? "Filters"}
      </button>
      {filterOpen ? (
        <div className="absolute right-0 z-50 mt-1 w-[220px] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-[var(--shadow-raised)]">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setFilterOpen(false);
              }}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-muted",
                filter === f ? "font-semibold text-primary" : "text-secondary-foreground",
              )}
            >
              <span>{f}</span>
              <span className="text-[12px] text-muted-foreground tabular-nums">
                {counts[f] ?? 0}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const ViewToggle = () => (
    <div className="flex shrink-0 items-center rounded-lg border border-border bg-background p-0.5">
      {VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => chooseView(v)}
          className={cn(
            "h-9 cursor-pointer rounded-md px-3 text-[13px] font-semibold outline-none",
            "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/30",
            view === v ? "bg-primary-soft text-primary" : "text-secondary-foreground hover:bg-muted",
          )}
        >
          {v === "Grouped by Project" ? "By Project" : "By Person"}
        </button>
      ))}
    </div>
  );

  const CollapseButton = () => (
    <button
      type="button"
      onClick={() => setAllCollapsed(anyExpanded)}
      className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[13px] font-semibold text-secondary-foreground outline-none transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      {anyExpanded ? (
        <ChevronsDownUp className="size-4" />
      ) : (
        <ChevronsUpDown className="size-4" />
      )}
      {anyExpanded ? "Collapse all" : "Expand all"}
    </button>
  );

  return (
    <div className="space-y-4">
      {showSummary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.key}
              label={card.key}
              value={summary[card.key]}
              tone={card.tone}
              active={focus === card.key}
              onClick={() => setFocus(focus === card.key ? null : card.key)}
            />
          ))}
        </div>
      ) : null}

      {showViewToggle || showSearch || toolbarRight ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {showViewToggle ? <ViewToggle /> : null}
          {showViewToggle && !sectionsByBucket ? <CollapseButton /> : null}
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            {showSearch ? (
              <SearchInput
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search actions…"
                className="min-w-0 flex-1 md:w-[240px] md:flex-none"
              />
            ) : null}
            {filters.length > 1 ? <FiltersMenu /> : null}
            {toolbarRight ? <div className="shrink-0">{toolbarRight}</div> : null}
          </div>
        </div>
      ) : null}

      {focus ? (
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          Showing {focus.toLowerCase()} only
          <button
            type="button"
            onClick={() => setFocus(null)}
            className="cursor-pointer font-semibold text-primary hover:underline"
          >
            Clear
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="surface px-5 py-10 text-[13.5px] text-muted-foreground">
          Loading actions…
        </div>
      ) : rows.length === 0 ? (
        <div className="surface overflow-hidden">
          <EmptyState title={emptyTitle} note={emptyNote} />
        </div>
      ) : !showViewToggle && !sectionsByBucket ? (
        <div className="surface overflow-hidden">
          <Body list={rows} withProject={showProjectColumn} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([key, group]) => {
            const openCount = group.items.filter((i) => !isComplete(i) && !justDone[i.id]).length;
            const starCount = group.items.filter((i) => i.is_important && !isComplete(i)).length;
            const waitCount = group.items.filter((i) => !isComplete(i) && isWaiting(i)).length;
            const overdueCount = group.items.filter((i) => !isComplete(i) && isOverdue(i)).length;
            // Today's sections are always open; searching also opens matches.
            const isCollapsed = sectionsByBucket
              ? false
              : q
                ? false
                : (collapsed[key] ?? startCollapsed);

            const meta = sectionsByBucket
              ? `${group.items.length} action${group.items.length === 1 ? "" : "s"}`
              : [
                  openCount ? `${openCount} open` : "",
                  starCount ? `${starCount} important` : "",
                  waitCount ? `${waitCount} waiting` : "",
                  !byPerson && overdueCount ? `${overdueCount} overdue` : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "No open work";

            return (
              <div key={key} className="surface overflow-hidden">
                {sectionsByBucket ? (
                  <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        key === "Overdue"
                          ? "bg-danger"
                          : key === "Today"
                            ? "bg-primary"
                            : key === "Waiting Follow-Ups"
                              ? "bg-warning"
                              : key === "completed"
                                ? "bg-success"
                                : "bg-border-strong",
                      )}
                    />
                    <h3 className="text-[14.5px] font-bold tracking-[-0.01em]">{group.name}</h3>
                    <span className="text-[12.5px] font-medium text-muted-foreground tabular-nums">
                      {meta}
                    </span>
                  </div>
                ) : (
                  /* The whole header toggles — the chevron is only a cue. */
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    onClick={() => setCollapsed((s) => ({ ...s, [key]: !isCollapsed }))}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-3.5 text-left outline-none",
                      "transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30",
                      !isCollapsed && "border-b border-border",
                    )}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground">
                      {isCollapsed ? (
                        <ChevronRight className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-bold tracking-[-0.015em]">
                        <Highlight text={group.name} query={q} />
                      </span>
                      <span className="mt-0.5 block text-[12.5px] font-medium text-muted-foreground tabular-nums">
                        {meta}
                      </span>
                    </span>
                    {!byPerson && key !== "unassigned" ? (
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: key }}
                        onClick={(e) => e.stopPropagation()}
                        className="hidden shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-primary transition-colors duration-150 hover:bg-primary-soft md:block"
                      >
                        Open job
                      </Link>
                    ) : null}
                  </button>
                )}

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200",
                    isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <Body list={group.items} withProject={byPerson || sectionsByBucket} />
                    {allowAdd && !sectionsByBucket ? <AddRow projectKey={key} /> : null}
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
