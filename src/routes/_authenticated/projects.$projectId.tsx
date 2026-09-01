import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { MapPin, User } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { LifecycleTrack } from "@/components/LifecycleTrack";
import { ProjectMoreMenu } from "@/components/ProjectMoreMenu";
import { UnderlineTabs } from "@/components/kit";
import { useProject, useUpdateProject, useWorkItems } from "@/lib/data";
import { useProfiles } from "@/lib/people";
import { useCanEditProject } from "@/hooks/useAuth";
import { Chip, materialTone, stageTone } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectShell,
});

const PROJECT_TABS = [
  { label: "Overview", to: "/projects/$projectId" as const, value: "/projects/$projectId" },
  {
    label: "Tiles & Finishes",
    to: "/projects/$projectId/scope" as const,
    value: "/projects/$projectId/scope",
  },
  {
    label: "Field",
    to: "/projects/$projectId/field" as const,
    value: "/projects/$projectId/field",
  },
  {
    label: "Install Materials",
    to: "/projects/$projectId/materials" as const,
    value: "/projects/$projectId/materials",
  },
  {
    label: "Files",
    to: "/projects/$projectId/files" as const,
    value: "/projects/$projectId/files",
  },
];

function ProjectShell() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading } = useProject(projectId);
  const update = useUpdateProject(projectId);
  const { canEdit } = useCanEditProject(projectId);
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
  const firstTab = PROJECT_TABS[0];
  const activeTab =
    PROJECT_TABS.find((tab) => pathname === tab.value.replace("$projectId", projectId))?.value ??
    firstTab?.value ??
    "/projects/$projectId";

  return (
    <>
      <AppHeader crumbs={[{ label: "Projects", to: "/projects" }, { label: project.name }]} />
      <div className="mx-auto max-w-7xl px-8 pt-8 pb-16">
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
              <span className="inline-flex items-center gap-1.5">{project.project_type}</span>
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
            {...(canEdit
              ? {
                  onToggleStep: (step: string) =>
                    update.mutate({
                      stage_steps_done: stepsDone.includes(step)
                        ? stepsDone.filter((s) => s !== step)
                        : [...stepsDone, step],
                    }),
                  onAdvance: (to: string) =>
                    update.mutate({ lifecycle_stage: to, stage_steps_done: [] }),
                }
              : {})}
          />
        </div>

        <UnderlineTabs
          className="mt-7"
          items={PROJECT_TABS.map((t) => ({ ...t, params: { projectId } }))}
          value={activeTab}
        />

        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </>
  );
}
