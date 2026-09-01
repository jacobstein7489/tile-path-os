import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { QuickCapture } from "@/components/QuickCapture";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { Button, EmptyState, Select, Table, Td, Th } from "@/components/kit";
import { Chip } from "@/lib/status";
import {
  matchesWorkFilter,
  statusTone,
  typeTone,
  useWorkFeed,
  WORK_FILTERS,
  WORK_ITEM_TYPES,
  type WorkFilter,
  type WorkItemRow,
} from "@/lib/workitems";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
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

function CompanyWorkPage() {
  const { data: items = [], isLoading } = useWorkFeed();
  const [filter, setFilter] = useState<WorkFilter>("Open");
  const [project, setProject] = useState("");
  const [owner, setOwner] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [capture, setCapture] = useState(false);
  const [active, setActive] = useState<WorkItemRow | null>(null);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        WORK_FILTERS.map((f) => [f, items.filter((i) => matchesWorkFilter(f, i)).length]),
      ) as Record<WorkFilter, number>,
    [items],
  );

  const projectNames = useMemo(
    () => [...new Set(items.map((i) => i.projects?.name).filter(Boolean) as string[])].sort(),
    [items],
  );
  const owners = useMemo(
    () => [...new Set(items.map((i) => i.owner).filter(Boolean) as string[])].sort(),
    [items],
  );

  const rows = items.filter(
    (i) =>
      matchesWorkFilter(filter, i) &&
      (!project || i.projects?.name === project) &&
      (!owner || i.owner === owner) &&
      (!type || i.item_type === type) &&
      (!search.trim() || i.title.toLowerCase().includes(search.trim().toLowerCase())),
  );

  // Keep the drawer in sync with fresh data after a save.
  const activeItem = active ? (items.find((i) => i.id === active.id) ?? active) : null;

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
      <div className="flex flex-wrap items-center gap-2">
        {WORK_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "h-9 rounded-lg border px-3.5 text-[13px] font-medium transition-colors",
              filter === f
                ? "border-primary/30 bg-primary-soft text-primary"
                : "border-border bg-background text-secondary-foreground hover:bg-muted",
            )}
          >
            {f}
            <span className="ml-1.5 text-[12px] tabular-nums opacity-70">{counts[f]}</span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <label className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search work"
              className="h-9 w-[190px] rounded-lg border border-border bg-background pr-3 pl-9 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </label>
          <Select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="w-[150px]"
            aria-label="Filter by project"
          >
            <option value="">All projects</option>
            {projectNames.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-[130px]"
            aria-label="Filter by owner"
          >
            <option value="">All owners</option>
            {owners.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-[170px]"
            aria-label="Filter by type"
          >
            <option value="">All types</option>
            {WORK_ITEM_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-[15px] font-semibold tracking-tight">{filter} work</h2>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {rows.length} of {items.length} records
          </span>
        </div>

        {isLoading ? (
          <div className="px-5 py-10 text-[13px] text-muted-foreground">Loading company work…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing here"
            note="No work items match this view. Use Quick Capture to log what came in from the field."
            action={
              <Button className="mt-2" onClick={() => setCapture(true)}>
                <Plus className="size-4" /> Quick Capture
              </Button>
            }
          />
        ) : (
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[24%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead className="bg-muted/60">
              <tr>
                {[
                  "Project",
                  "What Needs To Happen",
                  "Type",
                  "Owner",
                  "Waiting On",
                  "Status",
                  "Needed By",
                  "Next Action",
                ].map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => setActive(i)}
                  className="cursor-pointer transition-colors last:[&>td]:border-0 hover:bg-muted/50"
                >
                  <Td className="font-semibold whitespace-nowrap">
                    {i.projects?.name ?? "—"}
                  </Td>
                  <Td>
                    <span className="line-clamp-2">{i.title}</span>
                  </Td>
                  <Td>
                    <Chip tone={typeTone(i.item_type)}>{i.item_type}</Chip>
                  </Td>
                  <Td className="text-secondary-foreground">{i.owner ?? "—"}</Td>
                  <Td className="text-secondary-foreground">{i.waiting_on ?? "—"}</Td>
                  <Td>
                    <Chip tone={statusTone(i.status)}>{i.status}</Chip>
                  </Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {i.due_date
                      ? new Date(i.due_date + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </Td>
                  <Td className="font-medium text-primary">
                    <span className="line-clamp-2">{i.next_action ?? "Open item"}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <QuickCapture open={capture} onClose={() => setCapture(false)} />
      <WorkItemDrawer item={activeItem} onClose={() => setActive(null)} />
    </PageShell>
  );
}
