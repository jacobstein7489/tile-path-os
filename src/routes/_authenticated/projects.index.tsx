import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { NewProjectModal } from "@/components/NewProjectModal";
import { Button, FilterGroup, SearchInput, Select, Table, Td, Th } from "@/components/kit";
import { PageShell } from "@/components/PageShell";
import { ProgressBar } from "@/components/ProgressBar";
import { useProjects, type Project } from "@/lib/data";
import {
  MORE_PROJECT_FILTERS,
  PRIMARY_PROJECT_FILTERS,
  matchesFilter,
  showsInstallationProgress,
  type ProjectFilter,
} from "@/lib/lifecycle";
import { compareWorkItems, isComplete, useWorkFeed, type WorkItemRow } from "@/lib/workitems";
import { Dot, materialTone, stageTone } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Every tile installation project with its lifecycle stage, readiness, material status, blockers and the next move.",
      },
      { property: "og:title", content: "Projects — Cobblestone Tile OS" },
      {
        property: "og:description",
        content:
          "Every tile project with lifecycle stage, readiness, material status, blockers and next move.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: feed = [] } = useWorkFeed();

  // What needs to happen comes from the same open Work Items Company Work uses.
  const workByProject = useMemo(() => {
    const map = new Map<string, WorkItemRow[]>();
    feed
      .filter((i) => i.project_id && !isComplete(i))
      .forEach((i) => {
        const list = map.get(i.project_id!) ?? [];
        list.push(i);
        map.set(i.project_id!, list);
      });
    map.forEach((list) => list.sort(compareWorkItems));
    return map;
  }, [feed]);
  const [filter, setFilter] = useState<ProjectFilter>("All");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const rows = projects.filter(
    (p) =>
      matchesFilter(filter, p.lifecycle_stage, p.exception_state) &&
      (search.trim() === "" || p.name.toLowerCase().includes(search.trim().toLowerCase())),
  );

  return (
    <PageShell
      crumbs={[{ label: "Projects" }]}
      title="Projects"
      subtitle="Every project, where it is up to and what must happen next."
      actions={
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New Lead
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <FilterGroup
          options={PRIMARY_PROJECT_FILTERS.map((f) => ({ value: f, label: f }))}
          value={filter}
          onChange={(v) => setFilter(v as ProjectFilter)}
        />
        <Select
          value={(MORE_PROJECT_FILTERS as readonly string[]).includes(filter) ? filter : ""}
          onChange={(e) => setFilter((e.target.value || "All") as ProjectFilter)}
          className="w-[160px]"
          aria-label="More filters"
        >
          <option value="">More filters</option>
          {MORE_PROJECT_FILTERS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </Select>
        <div className="w-full md:ml-auto md:w-auto">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects"
            className="w-full md:w-[240px]"
          />
        </div>
      </div>

      <div className="surface hidden overflow-hidden md:block">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-[14px] font-semibold tracking-tight">
            {filter === "All" ? "All projects" : filter}
          </h2>
          <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
            {rows.length} of {projects.length}
          </span>
        </div>
        <Table className="table-fixed">
          {/* Five columns only: who, where it is, who is on it, when, what is next. */}
          <colgroup>
            <col className="w-[26%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col />
          </colgroup>
          <thead>
            <tr className="bg-muted/50">
              {["Project", "Stage", "Crew", "Dates", "Open work"].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <Td colSpan={5} className="text-muted-foreground">
                  Loading projects…
                </Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td colSpan={5} className="py-12 text-center text-muted-foreground">
                  No projects in this view.
                </Td>
              </tr>
            ) : (
              rows.map((p) => (
                <ProjectRow key={p.id} project={p} work={workByProject.get(p.id) ?? []} />
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* Mobile: cards instead of a squeezed table. */}
      <div className="space-y-2.5 md:hidden">
        {isLoading ? (
          <div className="surface px-4 py-8 text-[13px] text-muted-foreground">
            Loading projects…
          </div>
        ) : rows.length === 0 ? (
          <div className="surface px-4 py-10 text-center text-[13px] text-muted-foreground">
            No projects in this view.
          </div>
        ) : (
          rows.map((p) => {
            const work = workByProject.get(p.id) ?? [];
            const lead = work[0];
            const installing = showsInstallationProgress(p.lifecycle_stage);
            return (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                className="surface block px-4 py-3.5 transition-colors duration-150 active:bg-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] leading-snug font-bold tracking-[-0.01em]">
                      {p.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {p.exception_state ?? p.lifecycle_stage} · {p.project_type}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums">
                    {installing ? p.installation_progress : p.readiness_pct}%
                  </span>
                </div>
                <div className="mt-2.5">
                  <ProgressBar
                    value={installing ? p.installation_progress : p.readiness_pct}
                    tone="primary"
                  />
                </div>
                <p className="mt-2.5 text-[13px] leading-snug font-semibold">
                  {lead ? lead.title : "No open work"}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {[
                    p.crew_lead ?? "Unassigned",
                    fmt(p.start_date) + " → " + fmt(p.target_date),
                  ].join(" · ")}
                </p>
              </Link>
            );
          })
        )}
      </div>

      <NewProjectModal open={creating} onClose={() => setCreating(false)} />
    </PageShell>
  );
}

function ProjectRow({
  project: p,
  work,
}: {
  project: Project;
  /** Open work items for this project, already sorted: important first. */
  work: WorkItemRow[];
}) {
  const installing = showsInstallationProgress(p.lifecycle_stage);
  const navigate = useNavigate();
  const lead = work[0];
  const rest = work.length - 1;
  const pct = installing ? p.installation_progress : p.readiness_pct;
  return (
    <tr
      tabIndex={0}
      role="button"
      onClick={() => navigate({ to: "/projects/$projectId", params: { projectId: p.id } })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void navigate({ to: "/projects/$projectId", params: { projectId: p.id } });
        }
      }}
      className="group cursor-pointer outline-none transition-colors duration-150 hover:bg-muted/50 active:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35"
    >
      <Td className="group-last:border-0">
        <span className="block truncate text-[13.5px] font-bold tracking-tight text-foreground">
          {p.name}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
          {p.customer ?? p.project_type}
        </span>
      </Td>
      <Td className="group-last:border-0">
        <span className="flex items-start gap-2 text-[12.5px] font-medium">
          {p.exception_state ? (
            <span className="mt-[5px]">
              <Dot tone={stageTone(p.lifecycle_stage, p.exception_state)} />
            </span>
          ) : null}
          <span className="min-w-0 leading-snug text-secondary-foreground">
            {p.exception_state ?? p.lifecycle_stage}
            <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
              {pct}% {installing ? "installed" : "ready"}
            </span>
          </span>
        </span>
      </Td>
      <Td className="group-last:border-0">
        {p.crew_lead ? (
          <span className="block truncate text-[12.5px]">{p.crew_lead}</span>
        ) : (
          <span className="text-[12px] text-muted-foreground">Unassigned</span>
        )}
      </Td>
      <Td className="text-[12px] whitespace-nowrap text-muted-foreground group-last:border-0">
        {fmt(p.start_date)} → {fmt(p.target_date)}
      </Td>
      {/* One operational column, from the same open work items the Work board uses. */}
      <Td className="group-last:border-0">
        {lead ? (
          <span className="flex items-start gap-2">
            {lead.is_important ? (
              <span className="mt-[5px]">
                <Dot tone="red" />
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] leading-snug font-semibold text-foreground">
                {lead.title}
              </span>
              <span className={cn("mt-0.5 block text-[11px] text-muted-foreground")}>
                {lead.owner ?? "Unassigned"}
                {rest > 0 ? ` · +${rest} more open` : ""}
              </span>
            </span>
            <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-colors duration-100 group-hover:text-foreground" />
          </span>
        ) : (
          <span className="text-[12.5px] text-muted-foreground">No open work</span>
        )}
      </Td>
    </tr>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
