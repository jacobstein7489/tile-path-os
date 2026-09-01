import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { MapPin, User } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { LifecycleTrack } from "@/components/LifecycleTrack";
import { ProjectMoreMenu } from "@/components/ProjectMoreMenu";
import { useProject, useUpdateProject } from "@/lib/data";
import { Chip, materialTone, stageTone } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_authenticated/projects/$projectId")({
  component: ProjectShell,
});

const PROJECT_TABS = [
  { label: "Overview", to: "/projects/$projectId" as const },
  { label: "Tiles & Finishes", to: "/projects/$projectId/scope" as const },
  { label: "Field", to: "/projects/$projectId/field" as const },
  { label: "Install Materials", to: "/projects/$projectId/materials" as const },
  { label: "Files", to: "/projects/$projectId/files" as const },
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

  const stepsDone = project.stage_steps_done ?? [];

  return (
    <>
      <AppHeader crumbs={[{ label: "Projects", to: "/projects" }, { label: project.name }]} />
      <div className="mx-auto max-w-[1400px] px-8 pt-8 pb-16">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[28px] leading-none font-semibold tracking-[-0.02em]">
                {project.name}
              </h1>
              <Chip tone={stageTone(project.lifecycle_stage, project.exception_state)}>
                {project.exception_state ?? project.lifecycle_stage}
              </Chip>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {project.address ?? "Address not set"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3.5" /> {project.customer ?? "Customer not set"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                {project.project_type}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone={materialTone(project.material_status)}>
              Materials: {project.material_status}
            </Chip>
            {project.project_manager ? <Chip>PM: {project.project_manager}</Chip> : null}
            <ProjectMoreMenu project={project} />
          </div>
        </div>

        <div className="mt-6">
          <LifecycleTrack
            stage={project.lifecycle_stage}
            exceptionState={project.exception_state}
            stepsDone={stepsDone}
            onToggleStep={(step) =>
              update.mutate({
                stage_steps_done: stepsDone.includes(step)
                  ? stepsDone.filter((s) => s !== step)
                  : [...stepsDone, step],
              })
            }
            onAdvance={(to) => update.mutate({ lifecycle_stage: to, stage_steps_done: [] })}
          />
        </div>

        <nav className="mt-7 flex items-center gap-1 border-b border-border">
          {PROJECT_TABS.map((tab) => {
            const href = tab.to.replace("$projectId", projectId);
            const active = pathname === href;
            return (
              <Link
                key={tab.label}
                to={tab.to}
                params={{ projectId }}
                className={cn(
                  "-mb-px border-b-2 px-3.5 pb-3 text-[13px] font-semibold",
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
