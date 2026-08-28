import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, HardHat, Layers, Package, TriangleAlert } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import { showsInstallationProgress } from "@/lib/lifecycle";
import {
  useAreas,
  useProject,
  useSurfaces,
  useUpdateProject,
  useWorkItems,
  type Area,
} from "@/lib/data";
import { Chip, Dot, areaStatusTone, materialTone, workItemTone } from "@/lib/status";

export const Route = createFileRoute("/projects/$projectId/")({
  head: () => ({
    meta: [
      { title: "Project Overview — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Where the project is up to: lifecycle stage, readiness, blockers, crew, dates and the next move.",
      },
      { property: "og:title", content: "Project Overview — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Lifecycle stage, readiness, blockers, crew, dates and the next move.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectOverview,
});

function ProjectOverview() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: areas = [] } = useAreas(projectId);
  const { data: surfaces = [] } = useSurfaces(areas.map((a) => a.id));
  const { data: workItems = [] } = useWorkItems(projectId);
  const update = useUpdateProject(projectId);

  if (!project) return null;
  const installing = showsInstallationProgress(project.lifecycle_stage);
  const open = workItems.filter(
    (w) => w.status !== "Complete" && w.status !== "Resolved / Approved",
  );

  return (
    <div className="space-y-5">
      {/* Fact strip */}
      <section className="surface grid grid-cols-4 divide-x divide-border">
        <Fact
          icon={<HardHat className="size-4" />}
          label="Crew"
          value={project.crew_lead ?? "Not assigned"}
        />
        <Fact
          icon={<CalendarDays className="size-4" />}
          label="Dates"
          value={`${fmt(project.start_date)} → ${fmt(project.target_date)}`}
        />
        <Fact
          icon={<Package className="size-4" />}
          label="Materials"
          value={<Chip tone={materialTone(project.material_status)}>{project.material_status}</Chip>}
        />
        <Fact
          icon={<Layers className="size-4" />}
          label="Scope"
          value={`${areas.length} area${areas.length === 1 ? "" : "s"} · ${surfaces.length} surface${surfaces.length === 1 ? "" : "s"}`}
        />
      </section>

      <div className="grid grid-cols-3 gap-5">
        {/* Readiness / progress */}
        <section className="surface col-span-2 overflow-hidden">
          <div className="border-b border-border px-6 py-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">
                  {installing ? "Installation Progress" : "Setup & Readiness"}
                </h2>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                  {installing
                    ? "True physical progress rolled up from surfaces to areas to project."
                    : "Physical installation has not started, so setup and readiness completion is shown instead of an installation percentage."}
                </p>
              </div>
              <div className="text-right">
                <div className="text-[30px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                  {installing ? project.installation_progress : project.readiness_pct}
                  <span className="text-lg font-medium text-muted-foreground">%</span>
                </div>
                <div className="mt-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {installing ? "Installed" : "Ready"}
                </div>
              </div>
            </div>
            <ProgressBar
              value={installing ? project.installation_progress : project.readiness_pct}
              tone={installing ? "primary" : "success"}
              className="mt-4 h-2"
            />
            {project.readiness_note ? (
              <p className="mt-4 rounded-lg border border-info/15 bg-info-soft px-3 py-2.5 text-xs leading-relaxed text-info">
                <span className="font-semibold">Why: </span>
                {project.readiness_note}
              </p>
            ) : null}
          </div>

          <div className="divide-y divide-border">
            {areas.length === 0 ? (
              <p className="px-6 py-5 text-xs text-muted-foreground">
                No areas entered yet — the estimator builds areas and surfaces during takeoff.
              </p>
            ) : (
              areas.map((area) => (
                <AreaRow
                  key={area.id}
                  area={area}
                  installing={installing}
                  surfaces={surfaces.filter((s) => s.area_id === area.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Next move + blockers */}
        <div className="space-y-5">
          <section className="surface px-6 py-5">
            <h2 className="text-[15px] font-semibold tracking-tight">Next Move</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              One action, one owner. This is what moves the project forward.
            </p>
            <input
              value={project.next_move ?? ""}
              onChange={(e) => update.mutate({ next_move: e.target.value })}
              placeholder="What must happen next?"
              className="mt-3.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] font-medium outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <label className="mt-2.5 block text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Owner
              <input
                value={project.next_move_owner ?? ""}
                onChange={(e) => update.mutate({ next_move_owner: e.target.value })}
                placeholder="Who owns it?"
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] font-normal tracking-normal text-foreground normal-case outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>
          </section>

          <section className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-[15px] font-semibold tracking-tight">Blockers & Open Items</h2>
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                {open.length}
              </span>
            </div>
            {open.length === 0 ? (
              <p className="px-6 py-5 text-xs text-muted-foreground">
                Nothing is holding this project up.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {open.map((item) => (
                  <li key={item.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[13px] leading-snug font-medium">{item.title}</span>
                      <Chip tone={workItemTone(item.status)}>{item.status}</Chip>
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {item.item_type}
                      {item.waiting_on ? ` · Waiting on ${item.waiting_on}` : ""}
                      {item.owner ? ` · Owner ${item.owner}` : ""}
                    </div>
                    {item.next_action ? (
                      <div className="mt-2 flex items-start gap-2 text-xs text-secondary-foreground">
                        <span className="mt-1.5">
                          <Dot tone="blue" />
                        </span>
                        <span>{item.next_action}</span>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {project.needs_attention ? (
            <section className="surface border-danger/20 bg-danger-soft/50 px-6 py-4">
              <div className="flex items-start gap-2.5">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
                <div>
                  <div className="text-[13px] font-semibold text-danger">Needs Attention</div>
                  <p className="mt-1 text-xs leading-relaxed text-secondary-foreground">
                    {project.needs_attention}
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AreaRow({
  area,
  installing,
  surfaces,
}: {
  area: Area;
  installing: boolean;
  surfaces: { id: string; name: string; progress_pct: number; status: string }[];
}) {
  return (
    <div className="px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{area.name}</span>
        <Chip tone={areaStatusTone(area.status)}>{area.status}</Chip>
        <div className="flex w-48 items-center gap-3">
          <ProgressBar
            value={installing ? area.progress_pct : 0}
            tone={installing ? "primary" : "muted"}
          />
          <span className="w-9 text-right text-xs font-semibold text-muted-foreground tabular-nums">
            {installing ? `${area.progress_pct}%` : "—"}
          </span>
        </div>
      </div>
      {surfaces.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5 border-l border-border pl-4">
          {surfaces.map((s) => (
            <li key={s.id} className="flex items-center gap-3 text-xs">
              <span className="min-w-0 flex-1 truncate text-secondary-foreground">{s.name}</span>
              <span className="text-muted-foreground">{s.status}</span>
              {installing ? (
                <span className="w-9 text-right font-medium tabular-nums">{s.progress_pct}%</span>
              ) : (
                <span className="w-9" />
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </div>
        <div className="mt-1 truncate text-[13px] font-medium">{value}</div>
      </div>
    </div>
  );
}

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
