import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, HardHat, MapPin, User } from "lucide-react";
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
import { Chip, areaStatusTone, materialTone, workItemTone } from "@/lib/status";

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
  const blockers = workItems.filter((w) => w.status !== "Complete" && w.status !== "Resolved / Approved");

  return (
    <div className="space-y-6">
      {/* Identity strip */}
      <section className="surface grid grid-cols-5 divide-x divide-border">
        <Fact icon={<User className="size-4" />} label="Customer" value={project.customer ?? "—"} />
        <Fact icon={<MapPin className="size-4" />} label="Address" value={project.address ?? "—"} />
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
          icon={<AlertTriangle className="size-4" />}
          label="Material Status"
          value={<Chip tone={materialTone(project.material_status)}>{project.material_status}</Chip>}
        />
      </section>

      <div className="grid grid-cols-3 gap-6">
        {/* Readiness / progress */}
        <section className="surface col-span-2 px-6 py-5">
          <h2 className="text-[15px] font-semibold">
            {installing ? "Installation Progress" : "Setup & Readiness"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {installing
              ? "True physical progress rolled up from surfaces to areas to project."
              : "Physical installation has not started, so readiness completion is shown instead of installation percentage."}
          </p>

          <div className="mt-4 flex items-center gap-4">
            <div className="w-16 text-2xl font-bold tabular-nums">
              {installing ? project.installation_progress : project.readiness_pct}%
            </div>
            <ProgressBar
              value={installing ? project.installation_progress : project.readiness_pct}
              tone={installing ? "primary" : "success"}
              className="h-2 flex-1"
            />
          </div>
          {project.readiness_note ? (
            <p className="mt-3 rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
              Why: {project.readiness_note}
            </p>
          ) : null}

          <div className="mt-5 space-y-3 border-t border-border pt-4">
            {areas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
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
        <div className="space-y-6">
          <section className="surface px-6 py-5">
            <h2 className="text-[15px] font-semibold">Next Move</h2>
            <input
              value={project.next_move ?? ""}
              onChange={(e) => update.mutate({ next_move: e.target.value })}
              placeholder="What must happen next?"
              className="mt-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Owner
              <input
                value={project.next_move_owner ?? ""}
                onChange={(e) => update.mutate({ next_move_owner: e.target.value })}
                placeholder="Who owns it?"
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] font-normal text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
              />
            </label>
          </section>

          <section className="surface px-6 py-5">
            <h2 className="text-[15px] font-semibold">Blockers & Open Items</h2>
            {blockers.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">Nothing is holding this project up.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {blockers.map((item) => (
                  <li key={item.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[13px] font-medium">{item.title}</span>
                      <Chip tone={workItemTone(item.status)}>{item.status}</Chip>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.item_type}
                      {item.waiting_on ? ` · Waiting on ${item.waiting_on}` : ""}
                      {item.owner ? ` · Owner ${item.owner}` : ""}
                    </div>
                    {item.next_action ? (
                      <div className="mt-1 text-xs text-primary">Next: {item.next_action}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
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
    <div>
      <div className="flex items-center gap-3">
        <span className="w-56 truncate text-[13px] font-medium">{area.name}</span>
        <Chip tone={areaStatusTone(area.status)}>{area.status}</Chip>
        <div className="ml-auto flex w-52 items-center gap-3">
          <ProgressBar
            value={installing ? area.progress_pct : 0}
            tone={installing ? "primary" : "muted"}
          />
          <span className="w-10 text-right text-xs font-semibold tabular-nums">
            {installing ? `${area.progress_pct}%` : "—"}
          </span>
        </div>
      </div>
      {surfaces.length > 0 ? (
        <ul className="mt-1.5 ml-4 space-y-1">
          {surfaces.map((s) => (
            <li key={s.id} className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="w-52 truncate">{s.name}</span>
              <span>{s.status}</span>
              {installing ? <span className="tabular-nums">{s.progress_pct}%</span> : null}
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
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-[13px] font-medium">{value}</div>
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
