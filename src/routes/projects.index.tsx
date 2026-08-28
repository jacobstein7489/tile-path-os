import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Filter, Search } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { ProgressBar } from "@/components/ProgressBar";
import { useProjects, type Project } from "@/lib/data";
import { PROJECT_FILTERS, matchesFilter, showsInstallationProgress, type ProjectFilter } from "@/lib/lifecycle";
import { Chip, Dot, materialTone, stageTone } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/")({
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
  const [filter, setFilter] = useState<ProjectFilter>("All");
  const [search, setSearch] = useState("");

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
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PROJECT_FILTERS.map((f) => (
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
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects"
              className="h-9 w-[220px] rounded-lg border border-border bg-background pr-3 pl-9 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
          </label>
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-[13px] font-medium hover:bg-muted"
          >
            <Filter className="size-4" /> Filters
          </button>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold">{filter === "All" ? "All Projects" : filter}</h2>
          <span className="text-xs text-muted-foreground">
            Showing {rows.length} of {projects.length} projects
          </span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="border-b border-border bg-muted/50">
            <tr>
              {[
                "Project",
                "Stage",
                "Readiness",
                "Installation Progress",
                "Crew",
                "Dates",
                "Material Status",
                "Needs Attention",
                "Next Move",
              ].map((h) => (
                <th key={h} className="table-head-cell">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="table-cell-base text-muted-foreground">
                  Loading projects…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-cell-base text-muted-foreground">
                  No projects in this view.
                </td>
              </tr>
            ) : (
              rows.map((p) => <ProjectRow key={p.id} project={p} />)
            )}
          </tbody>
        </table>
        </div>
      </div>
    </PageShell>
  );
}

function ProjectRow({ project: p }: { project: Project }) {
  const installing = showsInstallationProgress(p.lifecycle_stage);
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/40">
      <td className="table-cell-base whitespace-nowrap">
        <Link
          to="/projects/$projectId"
          params={{ projectId: p.id }}
          className="font-semibold text-primary hover:underline"
        >
          {p.name}
        </Link>
        <div className="mt-0.5 text-xs text-muted-foreground">{p.project_type}</div>
      </td>
      <td className="table-cell-base">
        <Chip tone={stageTone(p.lifecycle_stage, p.exception_state)}>
          {p.exception_state ?? p.lifecycle_stage}
        </Chip>
      </td>
      <td className="table-cell-base">
        <div className="flex items-center gap-2">
          <span className="w-8 text-xs font-semibold tabular-nums">{p.readiness_pct}%</span>
          <ProgressBar value={p.readiness_pct} tone="success" className="w-20" />
        </div>
      </td>
      <td className="table-cell-base">
        {installing ? (
          <div className="flex items-center gap-2">
            <span className="w-8 text-xs font-semibold tabular-nums">{p.installation_progress}%</span>
            <ProgressBar value={p.installation_progress} className="w-20" />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Not started</span>
        )}
      </td>
      <td className="table-cell-base">
        {p.crew_lead ? (
          <span className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
              {initials(p.crew_lead)}
            </span>
            {p.crew_lead}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
      </td>
      <td className="table-cell-base whitespace-nowrap text-muted-foreground">
        {fmt(p.start_date)} → {fmt(p.target_date)}
      </td>
      <td className="table-cell-base">
        <Chip tone={materialTone(p.material_status)}>{p.material_status}</Chip>
      </td>
      <td className="table-cell-base">
        {p.needs_attention ? (
          <span className="flex items-start gap-2">
            <span className="mt-1.5">
              <Dot tone="red" />
            </span>
            <span>{p.needs_attention}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Clear</span>
        )}
      </td>
      <td className="table-cell-base">
        <Link
          to="/projects/$projectId"
          params={{ projectId: p.id }}
          className="inline-flex max-w-[165px] items-center gap-1.5 rounded-lg border border-primary/25 bg-primary-soft px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-accent"
        >
          <span className="truncate">{p.next_move ?? "Open project"}</span>
          <ArrowRight className="size-3.5 shrink-0" />
        </Link>
        {p.next_move_owner ? (
          <div className="mt-1 text-[11px] text-muted-foreground">Owner: {p.next_move_owner}</div>
        ) : null}
      </td>
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
