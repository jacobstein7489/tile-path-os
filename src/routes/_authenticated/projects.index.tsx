import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { NewProjectModal } from "@/components/NewProjectModal";
import { Button, FilterGroup, SearchInput, Table, Td, Th } from "@/components/kit";
import { PageShell } from "@/components/PageShell";
import { ProgressBar } from "@/components/ProgressBar";
import { useProjects, type Project } from "@/lib/data";
import { PROJECT_FILTERS, matchesFilter, showsInstallationProgress, type ProjectFilter } from "@/lib/lifecycle";
import { Chip, Dot, materialTone, stageTone } from "@/lib/status";

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
          <Plus className="size-4" /> New Project
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        <FilterGroup
          options={PROJECT_FILTERS.map((f) => ({ value: f, label: f }))}
          value={filter}
          onChange={(v) => setFilter(v as ProjectFilter)}
        />
        <div className="ml-auto">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects"
            className="w-[220px]"
          />
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight">
            {filter === "All" ? "All Projects" : filter}
          </h2>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {rows.length} of {projects.length} projects
          </span>
        </div>
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[18%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead>
            <tr className="bg-muted/60">
              {[
                "Project",
                "Stage",
                "Progress",
                "Crew",
                "Dates",
                "Materials",
                "Needs Attention",
                "Next Move",
              ].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <Td colSpan={8} className="text-muted-foreground">
                  Loading projects…
                </Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td colSpan={8} className="text-muted-foreground text-center py-12">
                  No projects in this view.
                </Td>
              </tr>
            ) : (
              rows.map((p) => <ProjectRow key={p.id} project={p} />)
            )}
          </tbody>
        </Table>
      </div>
      <NewProjectModal open={creating} onClose={() => setCreating(false)} />
    </PageShell>
  );
}

function ProjectRow({ project: p }: { project: Project }) {
  const installing = showsInstallationProgress(p.lifecycle_stage);
  const navigate = useNavigate();
  return (
    <tr
      onClick={() => navigate({ to: "/projects/$projectId", params: { projectId: p.id } })}
      className="group cursor-pointer transition-colors hover:bg-muted/50"
    >
      <Td className="whitespace-nowrap group-last:border-0">
        <span className="text-[13px] font-semibold tracking-tight text-foreground">{p.name}</span>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{p.project_type}</div>
      </Td>
      <Td className="group-last:border-0">
        <Chip tone={stageTone(p.lifecycle_stage, p.exception_state)}>
          {p.exception_state ?? p.lifecycle_stage}
        </Chip>
      </Td>
      <Td className="group-last:border-0">
        <div className="flex items-center gap-2">
          <ProgressBar
            value={installing ? p.installation_progress : p.readiness_pct}
            tone={installing ? "primary" : "success"}
            className="w-12"
          />
          <span className="text-xs font-semibold tabular-nums">
            {installing ? p.installation_progress : p.readiness_pct}%
          </span>
        </div>
        <div className="mt-0.5 text-[10.5px] tracking-tight text-muted-foreground">
          {installing ? "Installation" : "Readiness"}
        </div>
      </Td>
      <Td className="group-last:border-0">
        {p.crew_lead ? (
          <span className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
              {initials(p.crew_lead)}
            </span>
            <span className="truncate">{p.crew_lead}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground group-last:border-0">
        {fmt(p.start_date)} → {fmt(p.target_date)}
      </Td>
      <Td className="group-last:border-0">
        <Chip tone={materialTone(p.material_status)}>{p.material_status}</Chip>
      </Td>
      <Td className="group-last:border-0">
        {p.needs_attention ? (
          <span className="flex items-start gap-2">
            <span className="mt-1.5">
              <Dot tone="red" />
            </span>
            <span className="text-[12px] leading-snug">{p.needs_attention}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Clear</span>
        )}
      </Td>
      <Td className="group-last:border-0">
        <span className="flex w-full max-w-full items-start gap-1.5 rounded-lg border border-primary/25 bg-primary-soft px-2.5 py-1.5 text-[12px] leading-snug font-medium text-primary">
          <span className="min-w-0 flex-1 whitespace-normal">{p.next_move ?? "Open project"}</span>
          <ArrowRight className="mt-0.5 size-3.5 shrink-0" />
        </span>
        {p.next_move_owner ? (
          <div className="mt-1 text-[11px] text-muted-foreground">Owner: {p.next_move_owner}</div>
        ) : null}
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
