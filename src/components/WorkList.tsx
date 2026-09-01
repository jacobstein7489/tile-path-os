import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { toast } from "sonner";
import {
  Checkbox,
  Combobox,
  EmptyState,
  FilterGroup,
  SearchInput,
  Table,
  Td,
  Th,
} from "@/components/kit";
import { profileOptions, useProfiles } from "@/lib/people";
import { useAuthUser } from "@/hooks/useAuth";
import {
  compareWorkItems,
  isComplete,
  projectLabel,
  useSaveWorkItem,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";

/**
 * Shared work list. Today, Project → Open Work and any other surface read and
 * write the SAME work_items rows through this one component, so a change made
 * anywhere is visible everywhere.
 */

const VIEWS = ["List", "Grouped by Project"] as const;
type View = (typeof VIEWS)[number];

export type WorkListFilter = "Active" | "Important" | "Waiting" | "Completed";

const FILTERS: WorkListFilter[] = ["Active", "Important", "Waiting", "Completed"];

function matches(filter: WorkListFilter, item: WorkItemRow) {
  const done = isComplete(item);
  switch (filter) {
    case "Completed":
      return done;
    case "Active":
      return !done;
    case "Important":
      return !done && Boolean(item.is_important);
    case "Waiting":
      return !done && (Boolean(item.waiting_on) || item.status === "Waiting");
  }
}

function dueLabel(due: string | null) {
  if (!due) return "—";
  return new Date(due + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function WorkList({
  items,
  onOpen,
  showProjectColumn = true,
  showViewToggle = true,
  showSearch = true,
  isLoading = false,
  emptyTitle = "Nothing open",
  emptyNote = "No work matches this view.",
}: {
  items: WorkItemRow[];
  onOpen: (item: WorkItemRow) => void;
  showProjectColumn?: boolean;
  showViewToggle?: boolean;
  showSearch?: boolean;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyNote?: string;
}) {
  const { data: profiles = [] } = useProfiles();
  const save = useSaveWorkItem();
  const [view, setView] = useState<View>("List");
  const [filter, setFilter] = useState<WorkListFilter>("Active");
  const [search, setSearch] = useState("");
  const [justDone, setJustDone] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const owners = useMemo(() => profileOptions(profiles), [profiles]);

  const counts = useMemo(
    () =>
      Object.fromEntries(FILTERS.map((f) => [f, items.filter((i) => matches(f, i)).length])) as
        Record<WorkListFilter, number>,
    [items],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(
        (i) =>
          (matches(filter, i) || justDone[i.id]) &&
          (!q ||
            i.title.toLowerCase().includes(q) ||
            projectLabel(i).toLowerCase().includes(q)),
      )
      .sort(compareWorkItems);
  }, [items, filter, search, justDone]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: WorkItemRow[] }>();
    for (const i of rows) {
      const key = i.project_id ?? "unassigned";
      if (!map.has(key)) map.set(key, { name: projectLabel(i), items: [] });
      map.get(key)!.items.push(i);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows]);

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

  const clearJustDone = (id: string) =>
    setJustDone((s) => {
      const { [id]: _drop, ...rest } = s;
      return rest;
    });

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
      setTimeout(() => clearJustDone(item.id), 700);
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

  const StarCell = ({ item }: { item: WorkItemRow }) => (
    <button
      type="button"
      aria-label={item.is_important ? "Unmark important" : "Mark important"}
      onClick={(e) => {
        e.stopPropagation();
        toggleStar(item);
      }}
      className="grid size-7 place-items-center rounded-md transition-colors hover:bg-muted"
    >
      <Star
        className={cn(
          "size-4",
          item.is_important ? "fill-warning text-warning" : "text-muted-foreground/60",
        )}
      />
    </button>
  );

  const OwnerCell = ({ item }: { item: WorkItemRow }) => (
    <div onClick={(e) => e.stopPropagation()}>
      <Combobox
        options={owners}
        value={item.owner_user_id}
        onChange={(v) => setOwner(item, v)}
        placeholder={item.owner ?? "Unassigned"}
        className="w-[140px]"
      />
    </div>
  );

  const DoneCell = ({ item }: { item: WorkItemRow }) => (
    <div onClick={(e) => e.stopPropagation()}>
      <Checkbox
        checked={isComplete(item) || Boolean(justDone[item.id])}
        onChange={(next) => toggleComplete(item, next)}
      />
    </div>
  );

  const headers = [
    ...(showProjectColumn ? ["Project"] : []),
    "What Needs To Happen",
    "Owner",
    "Waiting On",
    "Needed By",
    "Next Action",
  ];

  const Rows = ({ list, withProject }: { list: WorkItemRow[]; withProject: boolean }) => (
    <Table className="table-fixed">
      <colgroup>
        <col className="w-[42px]" />
        {withProject ? <col className="w-[15%]" /> : null}
        <col className={withProject ? "w-[27%]" : "w-[36%]"} />
        <col className="w-[14%]" />
        <col className="w-[11%]" />
        <col className="w-[9%]" />
        <col className="w-[16%]" />
        <col className="w-[42px]" />
      </colgroup>
      <thead>
        <tr className="bg-muted/60">
          <Th> </Th>
          {(withProject ? headers : headers.filter((h) => h !== "Project")).map((h) => (
            <Th key={h}>{h}</Th>
          ))}
          <Th> </Th>
        </tr>
      </thead>
      <tbody>
        {list.map((i) => {
          const done = isComplete(i) || Boolean(justDone[i.id]);
          return (
            <tr
              key={i.id}
              onClick={() => onOpen(i)}
              className={cn(
                "group cursor-pointer transition-colors duration-150 hover:bg-muted/50",
                done && "bg-success-soft/60",
                !done && (i.waiting_on || i.status === "Waiting") && "bg-warning-soft/20",
              )}
            >
              <Td className="group-last:border-0">
                <StarCell item={i} />
              </Td>
              {withProject ? (
                <Td className="font-semibold group-last:border-0">
                  <span className="block break-words">{projectLabel(i)}</span>
                </Td>
              ) : null}
              <Td className="group-last:border-0">
                <span className={cn("line-clamp-2", done && "text-muted-foreground line-through")}>
                  {i.title}
                </span>
              </Td>
              <Td className="group-last:border-0">
                <OwnerCell item={i} />
              </Td>
              <Td className="text-secondary-foreground group-last:border-0">
                {i.waiting_on ?? "—"}
              </Td>
              <Td className="whitespace-nowrap text-muted-foreground group-last:border-0">
                {dueLabel(i.due_date)}
              </Td>
              <Td className="group-last:border-0">
                <span className="line-clamp-2 font-medium text-foreground group-hover:text-primary">
                  {done ? "" : (i.next_action ?? "Open item")}
                </span>
              </Td>
              <Td className="group-last:border-0">
                <DoneCell item={i} />
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
          options={FILTERS.map((f) => ({
            value: f,
            label: f === "Important" ? "★ Important" : f,
            count: counts[f],
          }))}
          value={filter}
          onChange={(v) => setFilter(v as WorkListFilter)}
        />
        <div className="ml-auto flex items-center gap-2">
          {showSearch ? (
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search work"
              className="w-[180px]"
            />
          ) : null}
          {showViewToggle ? (
            <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "h-8 rounded-md px-3 text-[12.5px] font-medium transition-colors duration-150",
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
                    onClick={() => setCollapsed((s) => ({ ...s, [key]: !isCollapsed }))}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                  {key === "unassigned" ? (
                    <span className="text-[14.5px] font-semibold tracking-tight">
                      {group.name}
                    </span>
                  ) : (
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: key }}
                      className="text-[14.5px] font-semibold tracking-tight transition-colors hover:text-primary"
                    >
                      {group.name}
                    </Link>
                  )}
                  <span className="text-[12.5px] text-muted-foreground tabular-nums">
                    · {openCount} open{starCount ? ` · ${starCount} important` : ""}
                  </span>
                </div>
                {isCollapsed ? null : <Rows list={group.items} withProject={false} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
