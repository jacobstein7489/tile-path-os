import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Clock, ListChecks, SlidersHorizontal, UserPlus } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Avatar, SearchInput } from "@/components/kit";
import { StatCard, StatCardRow } from "@/components/ops/StatCards";
import { GroupSection } from "@/components/ops/GroupSection";
import { TaskRow } from "@/components/ops/TaskRow";
import { TaskDrawer } from "@/components/ops/TaskDrawer";
import { Popover, PopoverItem } from "@/components/ops/Popover";
import { useCapture } from "@/components/ops/CaptureProvider";
import { useAuthUser } from "@/hooks/useAuth";
import { useProfiles } from "@/lib/people";
import {
  compareWorkItems,
  isComplete,
  isDueSoon,
  isOverdue,
  isWaiting,
  useWorkFeed,
  workSummary,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/work")({
  head: () => ({
    meta: [
      { title: "Work — Cobblestone Job Operations" },
      {
        name: "description",
        content:
          "Every open task across all jobs, grouped by project or by person: what needs to happen, who owns it and when.",
      },
      { property: "og:title", content: "Work — Cobblestone Job Operations" },
      { property: "og:description", content: "Every open task across all jobs, by project or person." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkPage,
});

type Lens = "Open" | "Unassigned" | "Waiting" | "Overdue";
const EXTRA_FILTERS = ["My tasks", "Important", "Due soon", "Completed"] as const;
type Extra = (typeof EXTRA_FILTERS)[number];

function WorkPage() {
  const { data: items = [] } = useWorkFeed();
  const { data: profiles = [] } = useProfiles();
  const { user } = useAuthUser();
  const capture = useCapture();

  const [mode, setMode] = useState<"project" | "person">("project");
  const [lens, setLens] = useState<Lens>("Open");
  const [extra, setExtra] = useState<Extra | null>(null);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<WorkItemRow | null>(null);

  const summary = workSummary(items);
  const activeItem = active ? (items.find((i) => i.id === active.id) ?? active) : null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => {
        if (extra === "Completed") return isComplete(i);
        if (isComplete(i)) return false;
        if (extra === "My tasks" && i.owner_user_id !== user?.id) return false;
        if (extra === "Important" && !i.is_important) return false;
        if (extra === "Due soon" && !isDueSoon(i)) return false;
        if (lens === "Unassigned" && (i.owner_user_id || i.owner)) return false;
        if (lens === "Waiting" && !isWaiting(i)) return false;
        if (lens === "Overdue" && !isOverdue(i)) return false;
        return true;
      })
      .filter((i) =>
        q ? `${i.title} ${i.projects?.name ?? ""} ${i.owner ?? ""}`.toLowerCase().includes(q) : true,
      )
      .sort(compareWorkItems);
  }, [items, lens, extra, query, user?.id]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; title: string; projectId: string | null; rows: WorkItemRow[] }>();
    for (const item of visible) {
      const key =
        mode === "project"
          ? (item.project_id ?? "company")
          : (item.owner_user_id ?? "unassigned");
      const title =
        mode === "project"
          ? (item.projects?.name ?? "Company / no project")
          : (profiles.find((p) => p.user_id === item.owner_user_id)?.full_name ??
            item.owner ??
            "Unassigned");
      const existing = map.get(key);
      if (existing) existing.rows.push(item);
      else
        map.set(key, {
          key,
          title,
          projectId: mode === "project" ? item.project_id : null,
          rows: [item],
        });
    }
    return [...map.values()].sort((a, b) => b.rows.length - a.rows.length);
  }, [visible, mode, profiles]);

  const isOpen = (key: string) => openGroups[key] ?? false;
  const allOpen = groups.length > 0 && groups.every((g) => isOpen(g.key));

  return (
    <PageShell
      crumbs={[{ label: "Work" }]}
      title="Work"
      subtitle="Everything open across every job."
    >
      <StatCardRow>
        {(
          [
            ["Open", summary.Open, "neutral", <ListChecks className="size-4" key="a" />],
            ["Unassigned", summary.Unassigned, "blue", <UserPlus className="size-4" key="b" />],
            ["Waiting", summary.Waiting, "amber", <Clock className="size-4" key="c" />],
            ["Overdue", summary.Overdue, "red", <AlertTriangle className="size-4" key="d" />],
          ] as const
        ).map(([label, value, tone, icon]) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            tone={tone}
            icon={icon}
            active={lens === label}
            onClick={() => setLens(label as Lens)}
          />
        ))}
      </StatCardRow>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border bg-card p-0.5">
          {(
            [
              ["project", "By project"],
              ["person", "By person"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "min-h-10 cursor-pointer rounded-[10px] px-3.5 text-[13.5px] font-semibold transition-colors duration-150",
                mode === value
                  ? "bg-primary-soft text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setOpenGroups(
              allOpen ? {} : Object.fromEntries(groups.map((g) => [g.key, true])),
            )
          }
          className="min-h-10 cursor-pointer rounded-xl border border-border bg-card px-3.5 text-[13.5px] font-semibold hover:bg-muted"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks"
            className="w-[150px] sm:w-56"
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-[13.5px] font-semibold",
                extra ? "border-primary/40 bg-primary-soft text-primary" : "border-border bg-card hover:bg-muted",
              )}
            >
              <SlidersHorizontal className="size-4" />
              <span className="hidden sm:inline">{extra ?? "Filters"}</span>
            </button>
            <Popover
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              align="right"
              title="Filters"
              width="md:w-52"
            >
              {EXTRA_FILTERS.map((f) => (
                <PopoverItem
                  key={f}
                  active={extra === f}
                  onClick={() => {
                    setExtra(extra === f ? null : f);
                    setFiltersOpen(false);
                  }}
                >
                  {f}
                </PopoverItem>
              ))}
            </Popover>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {!groups.length ? (
          <div className="surface flex flex-col items-center gap-3 px-6 py-14 text-center">
            <p className="text-[15px] font-semibold">Nothing here</p>
            <p className="max-w-sm text-[13.5px] text-muted-foreground">
              No tasks match this view.
            </p>
            <button
              type="button"
              onClick={() => capture()}
              className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Capture something
            </button>
          </div>
        ) : (
          groups.map((g) => {
            const overdue = g.rows.filter(isOverdue).length;
            const waiting = g.rows.filter(isWaiting).length;
            const meta = [
              `${g.rows.length} open`,
              overdue ? `${overdue} overdue` : null,
              waiting ? `${waiting} waiting` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const person =
              mode === "person" ? profiles.find((p) => p.full_name === g.title) : undefined;
            return (
              <GroupSection
                key={g.key}
                title={mode === "person" ? g.title.toUpperCase() : g.title}
                meta={meta}
                open={isOpen(g.key)}
                onToggle={() => setOpenGroups((prev) => ({ ...prev, [g.key]: !isOpen(g.key) }))}
                projectId={g.projectId}
                {...(person
                  ? {
                      avatar: (
                        <Avatar
                          initials={person.initials || person.full_name.slice(0, 1)}
                          tone={person.avatar_tone}
                          size={30}
                        />
                      ),
                    }
                  : {})}
              >
                {g.rows.map((row) => (
                  <TaskRow
                    key={row.id}
                    item={row}
                    onOpen={setActive}
                    selected={active?.id === row.id}
                    showOwner={mode === "project"}
                  />
                ))}
              </GroupSection>
            );
          })
        )}
      </div>

      <TaskDrawer
        item={activeItem}
        onClose={() => setActive(null)}
        onOpenTask={(id) => {
          const next = items.find((i) => i.id === id);
          setActive(next ?? null);
        }}
      />
    </PageShell>
  );
}
