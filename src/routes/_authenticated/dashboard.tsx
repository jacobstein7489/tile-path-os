import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { QuickCapture } from "@/components/QuickCapture";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import {
  Button,
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
  matchesWorkFilter,
  projectLabel,
  useSaveWorkItem,
  useWorkFeed,
  WORK_FILTERS,
  type WorkFilter,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>): { view?: "grouped" } =>
    search['view'] === "grouped" ? { view: "grouped" } : {},
  head: () => ({
    meta: [
      { title: "Company Work — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Every open piece of company work in one board: what needs to happen, who owns it, who we are waiting on and the next action.",
      },
      { property: "og:title", content: "Company Work — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "One workboard for every open item across all tile projects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompanyWorkPage,
});

const VIEWS = ["List", "Grouped by Project"] as const;
type View = (typeof VIEWS)[number];

function dueLabel(due: string | null) {
  if (!due) return "—";
  return new Date(due + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function rowTone(item: WorkItemRow, justDone: boolean) {
  if (justDone || isComplete(item)) return "bg-success-soft/60";
  if (item.status === "Blocked") return "bg-danger-soft/30";
  if (item.waiting_on || item.status === "Waiting") return "bg-warning-soft/25";
  return "";
}

function CompanyWorkPage() {
  const { data: items = [], isLoading } = useWorkFeed();
  const { user } = useAuthUser();
  const { data: profiles = [] } = useProfiles();
  const save = useSaveWorkItem();

  const [view, setView] = useState<View>("List");
  const [filter, setFilter] = useState<WorkFilter>("All");
  const [search, setSearch] = useState("");
  const [capture, setCapture] = useState(false);
  const [active, setActive] = useState<WorkItemRow | null>(null);
  const [justDone, setJustDone] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const owners = useMemo(() => profileOptions(profiles), [profiles]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        WORK_FILTERS.map((f) => [f, items.filter((i) => matchesWorkFilter(f, i, user?.id)).length]),
      ) as Record<WorkFilter, number>,
    [items, user?.id],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(
        (i) =>
          (matchesWorkFilter(filter, i, user?.id) || justDone[i.id]) &&
          (!q ||
            i.title.toLowerCase().includes(q) ||
            projectLabel(i).toLowerCase().includes(q)),
      )
      .sort(compareWorkItems);
  }, [items, filter, search, user?.id, justDone]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: WorkItemRow[] }>();
    for (const i of rows) {
      const key = i.project_id ?? "unassigned";
      if (!map.has(key)) map.set(key, { name: projectLabel(i), items: [] });
      map.get(key)!.items.push(i);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows]);

  const activeItem = active ? (items.find((i) => i.id === active.id) ?? active) : null;

  const toggleStar = (item: WorkItemRow) => {
    save.mutate({
      id: item.id,
      patch: { is_important: !item.is_important },
      note: item.is_important ? "Unmarked important" : "Marked important",
    });
  };

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
            setJustDone((s) => {
              const { [item.id]: _drop, ...rest } = s;
              return rest;
            });
            save.mutate({
              id: item.id,
              patch: { status: "Open", completed_at: null },
              note: "Reopened",
            });
          },
        },
      });
      setTimeout(
        () =>
          setJustDone((s) => {
            const { [item.id]: _drop, ...rest } = s;
            return rest;
          }),
        700,
      );
    }
    save.mutate({
      id: item.id,
      patch: next
        ? { status: "Complete", completed_at: new Date().toISOString() }
        : { status: "Open", completed_at: null },
      note: next ? "Marked complete" : "Reopened",
    });
  };

  const StarButton = ({ item }: { item: WorkItemRow }) => (
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
          "size-4 transition-colors",
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
        className="w-[150px]"
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

  return (
    <PageShell
      crumbs={[{ label: "Company Work" }]}
      title="Company Work"
      subtitle="Every actionable record in the company. One item, one record — updating it here updates it everywhere."
      actions={
        <Button variant="primary" onClick={() => setCapture(true)}>
          <Plus className="size-4" /> Quick Capture
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        <FilterGroup
          options={WORK_FILTERS.map((f) => ({
            value: f,
            label: f === "Important" ? "★ Important" : f,
            count: counts[f],
          }))}
          value={filter}
          onChange={(v) => setFilter(v as WorkFilter)}
        />

        <div className="ml-auto flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search work"
            className="w-[200px]"
          />
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
        </div>
      </div>

      {isLoading ? (
        <div className="surface px-5 py-10 text-[13px] text-muted-foreground">
          Loading company work…
        </div>
      ) : rows.length === 0 ? (
        <div className="surface overflow-hidden">
          <EmptyState
            title="Nothing here"
            note="No work items match this view. Use Quick Capture to log what came in from the field."
            action={
              <Button className="mt-2" onClick={() => setCapture(true)}>
                <Plus className="size-4" /> Quick Capture
              </Button>
            }
          />
        </div>
      ) : view === "List" ? (
        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight">{filter} work</h2>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {rows.length} of {items.length} records
            </span>
          </div>
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[44px]" />
              <col className="w-[14%]" />
              <col className="w-[27%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
              <col className="w-[16%]" />
              <col className="w-[44px]" />
            </colgroup>
            <thead>
              <tr className="bg-muted/60">
                <Th> </Th>
                {["Project", "What Needs To Happen", "Owner", "Waiting On", "Needed By", "Next Action"].map(
                  (h) => (
                    <Th key={h}>{h}</Th>
                  ),
                )}
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => setActive(i)}
                  className={cn(
                    "group cursor-pointer transition-colors duration-150 hover:bg-muted/50",
                    rowTone(i, Boolean(justDone[i.id])),
                    active?.id === i.id && "bg-primary-soft/60 ring-1 ring-inset ring-primary/25",
                  )}
                >
                  <Td className="group-last:border-0">
                    <StarButton item={i} />
                  </Td>
                  <Td className="font-semibold group-last:border-0">
                    <span className="block break-words">{projectLabel(i)}</span>
                  </Td>
                  <Td className="group-last:border-0">
                    <span className="line-clamp-2">{i.title}</span>
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
                    <span className="line-clamp-2 font-medium text-foreground transition-colors group-hover:text-primary">
                      {i.next_action ?? "Open item"}
                    </span>
                  </Td>
                  <Td className="group-last:border-0">
                    <DoneCell item={i} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([projectId, group]) => {
            const openCount = group.items.filter(
              (i) => !isComplete(i) && !justDone[i.id],
            ).length;
            const starCount = group.items.filter((i) => i.is_important && !isComplete(i)).length;
            const isCollapsed = Boolean(collapsed[projectId]);
            return (
              <div key={projectId} className="surface overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <button
                    type="button"
                    aria-label={isCollapsed ? "Expand project" : "Collapse project"}
                    onClick={() => setCollapsed((s) => ({ ...s, [projectId]: !isCollapsed }))}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                  {projectId === "unassigned" ? (
                    <span className="text-[14.5px] font-semibold tracking-tight">{group.name}</span>
                  ) : (
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId }}
                      className="text-[14.5px] font-semibold tracking-tight transition-colors hover:text-primary"
                    >
                      {group.name}
                    </Link>
                  )}
                  <span className="text-[12.5px] text-muted-foreground tabular-nums">
                    · {openCount} open
                    {starCount ? ` · ${starCount} important` : ""}
                  </span>
                </div>

                {isCollapsed ? null : (
                  <Table className="table-fixed">
                    <colgroup>
                      <col className="w-[44px]" />
                      <col className="w-[33%]" />
                      <col className="w-[17%]" />
                      <col className="w-[13%]" />
                      <col className="w-[9%]" />
                      <col className="w-[20%]" />
                      <col className="w-[44px]" />
                    </colgroup>
                    <tbody>
                      {group.items.map((i) => (
                        <tr
                          key={i.id}
                          onClick={() => setActive(i)}
                          className={cn(
                            "group cursor-pointer transition-colors duration-150 hover:bg-muted/50",
                            rowTone(i, Boolean(justDone[i.id])),
                            active?.id === i.id &&
                              "bg-primary-soft/60 ring-1 ring-inset ring-primary/25",
                          )}
                        >
                          <Td className="group-last:border-0">
                            <StarButton item={i} />
                          </Td>
                          <Td className="group-last:border-0">
                            <span className="line-clamp-2 font-medium">{i.title}</span>
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
                            <span className="line-clamp-2 text-secondary-foreground transition-colors group-hover:text-primary">
                              {i.next_action ?? "Open item"}
                            </span>
                          </Td>
                          <Td className="group-last:border-0">
                            <DoneCell item={i} />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            );
          })}
        </div>
      )}

      <QuickCapture open={capture} onClose={() => setCapture(false)} />
      <WorkItemDrawer item={activeItem} onClose={() => setActive(null)} />
    </PageShell>
  );
}
