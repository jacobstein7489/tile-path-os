import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { LifecycleTrack } from "@/components/LifecycleTrack";
import { LIFECYCLE_STAGES } from "@/lib/lifecycle";
import { useProject, useUpdateProject } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectShell,
});

const PROJECT_TABS = [
  { label: "Overview", to: "/projects/$projectId" as const, exact: true },
  { label: "Scope & Details", to: "/projects/$projectId" as const, exact: true, disabled: true },
  { label: "Field", to: "/projects/$projectId" as const, exact: true, disabled: true },
  { label: "Materials", to: "/projects/$projectId" as const, exact: true, disabled: true },
  { label: "Files", to: "/projects/$projectId" as const, exact: true, disabled: true },
];

function ProjectShell() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading } = useProject(projectId);
  const update = useUpdateProject(projectId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) {
    return (
      <>
        <AppHeader crumbs={[{ label: "Projects", to: "/projects" }, { label: "Loading…" }]} />
        <div className="px-8 pt-10 text-sm text-muted-foreground">Loading project…</div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <AppHeader crumbs={[{ label: "Projects", to: "/projects" }, { label: "Not found" }]} />
        <div className="px-8 pt-10 text-sm text-muted-foreground">
          This project no longer exists.{" "}
          <Link to="/projects" className="text-primary hover:underline">
            Back to projects
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader
        crumbs={[{ label: "Projects", to: "/projects" }, { label: project.name }]}
      />
      <div className="mx-auto max-w-[1400px] px-8 pt-8 pb-16">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[30px] leading-tight font-bold">{project.name}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {project.address ?? "Address not set"}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            Stage
            <select
              value={project.lifecycle_stage}
              onChange={(e) => update.mutate({ lifecycle_stage: e.target.value })}
              className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] font-medium text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
            >
              {LIFECYCLE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6">
          <LifecycleTrack stage={project.lifecycle_stage} exceptionState={project.exception_state} />
        </div>

        <nav className="mt-6 flex items-center gap-1 border-b border-border">
          {PROJECT_TABS.map((tab) => {
            const active = !tab.disabled && pathname === `/projects/${projectId}`;
            return tab.disabled ? (
              <span
                key={tab.label}
                className="cursor-not-allowed px-3.5 pb-3 text-[13px] font-medium text-muted-foreground/60"
                title="Available in a later phase"
              >
                {tab.label}
              </span>
            ) : (
              <Link
                key={tab.label}
                to={tab.to}
                params={{ projectId }}
                className={cn(
                  "-mb-px border-b-2 px-3.5 pb-3 text-[13px] font-medium",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-secondary-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </>
  );
}
