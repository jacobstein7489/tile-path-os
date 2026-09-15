import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ClipboardCheck, FileText, MapPin, Plus, User } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { LifecycleTrack } from "@/components/LifecycleTrack";
import { LifecycleRail } from "@/components/ops/LifecycleRail";
import { Popover } from "@/components/ops/Popover";
import { ProjectMoreMenu } from "@/components/ProjectMoreMenu";
import { FieldReportSheet } from "@/components/FieldReportSheet";
import { ProjectStatusUpdateSheet } from "@/components/ProjectStatusUpdateSheet";
import { Button, UnderlineTabs } from "@/components/kit";
import { useProject, useUpdateProject } from "@/lib/data";
import { useProjectSetup } from "@/lib/setup";
import { useProfiles } from "@/lib/people";
import { useCanEditProject } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Chip, stageTone } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectShell,
});

const PROJECT_TABS = [
  { label: "Overview", to: "/projects/$projectId" as const, value: "/projects/$projectId" },
  {
    label: "Work",
    to: "/projects/$projectId/tasks" as const,
    value: "/projects/$projectId/tasks",
  },
  {
    label: "Rooms",
    to: "/projects/$projectId/scope" as const,
    value: "/projects/$projectId/scope",
  },
  {
    label: "Files",
    to: "/projects/$projectId/files" as const,
    value: "/projects/$projectId/files",
  },
];

const MORE_TABS = [
  { label: "Updates", hint: "Daily and project status updates", to: "/projects/$projectId/updates" as const, value: "/projects/$projectId/updates" },
  {
    label: "Materials",
    hint: "Tiles, finishes and install materials",
    to: "/projects/$projectId/tiles" as const,
    value: "/projects/$projectId/tiles",
  },
  { label: "Schedule", hint: "Crew assignments and dates", to: "/projects/$projectId/schedule" as const, value: "/projects/$projectId/schedule" },
  {
    label: "Field",
    hint: "Progress by area and visit checklist",
    to: "/projects/$projectId/field" as const,
    value: "/projects/$projectId/field",
  },
  { label: "Commercial", hint: "Project commercial details", to: "/projects/$projectId/materials" as const, value: "/projects/$projectId/materials" },
];

function ProjectShell() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading } = useProject(projectId);
  const update = useUpdateProject(projectId);
  const { canEdit } = useCanEditProject(projectId);
  const { data: profiles = [] } = useProfiles();
  const setup = useProjectSetup(projectId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

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

  const nameOf = (userId?: string | null) =>
    profiles.find((p) => p.user_id === userId)?.full_name ?? null;
  const pmName = nameOf(project.pm_user_id) ?? project.project_manager;

  const resolve = (value: string) => value.replace("$projectId", projectId);
  const firstTab = PROJECT_TABS[0];
  const moreActive = MORE_TABS.find((t) => pathname === resolve(t.value));
  const activeTab =
    PROJECT_TABS.find((tab) => pathname === resolve(tab.value))?.value ??
    (moreActive ? "more" : (firstTab?.value ?? "/projects/$projectId"));

  return (
    <>
      <AppHeader crumbs={[{ label: "Projects", to: "/projects" }, { label: project.name }]} />
       <div className="mx-auto max-w-[1400px] px-4 pt-5 pb-16 md:px-7 md:pt-6">
         <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
             <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="text-[26px] leading-none font-semibold tracking-[-0.02em] md:text-[28px]">
                 <span className="truncate">{project.name}</span>
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
               {pmName ? <span className="inline-flex items-center gap-1.5">PM · {pmName}</span> : null}
               {project.crew_lead ? <span className="inline-flex items-center gap-1.5">Crew · {project.crew_lead}</span> : null}
            </div>
          </div>
           <div className="flex shrink-0 items-center gap-2">
             <div className="relative">
               <Button variant="primary" onClick={() => setUpdateOpen((v) => !v)}><Plus className="size-4" /> Update</Button>
               <Popover open={updateOpen} onClose={() => setUpdateOpen(false)} align="right" width="md:w-64" title="Add update">
                 <button type="button" onClick={() => { setUpdateOpen(false); setDailyOpen(true); }} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-muted"><ClipboardCheck className="size-4 text-primary" /><span><b className="block text-sm">Daily Update</b><span className="text-xs text-muted-foreground">Fast field report</span></span></button>
                 <button type="button" onClick={() => { setUpdateOpen(false); setStatusOpen(true); }} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-muted"><FileText className="size-4 text-primary" /><span><b className="block text-sm">Project Status Update</b><span className="text-xs text-muted-foreground">Concise shareable summary</span></span></button>
               </Popover>
             </div>
            <ProjectMoreMenu project={project} />
          </div>
        </div>

         <div className="mt-3 border-y border-border/70 py-1">
          <LifecycleRail
            stage={project.lifecycle_stage}
            exceptionState={project.exception_state}
            detail={
              <LifecycleTrack
                stage={project.lifecycle_stage}
                exceptionState={project.exception_state}
                blockers={setup.blockers.map((b) => ({
                  label: b.label,
                  detail: b.detail,
                  category: b.category,
                }))}
                hasScheduleAssignment={setup.hasScheduleAssignment}
                {...(canEdit
                  ? { onAdvance: (to: string) => update.mutate({ lifecycle_stage: to }) }
                  : {})}
              />
            }
          />
        </div>

         <div className="mt-3 flex items-end gap-1 border-b border-border">
           <UnderlineTabs
             className="min-w-0 flex-1 border-b-0"
            items={PROJECT_TABS.map((t) => ({ ...t, params: { projectId } }))}
            value={activeTab}
          />
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3.5 pb-3 text-[13.5px] outline-none transition-colors duration-150",
                activeTab === "more"
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent font-medium text-secondary-foreground hover:text-foreground",
              )}
            >
              {moreActive ? moreActive.label : "More"}
              <ChevronDown className={cn("size-3.5 transition-transform", moreOpen && "rotate-180")} />
            </button>
            <Popover
              open={moreOpen}
              onClose={() => setMoreOpen(false)}
              align="right"
              width="md:w-72"
               title="Project tools"
            >
              {MORE_TABS.map((t) => (
                <Link
                  key={t.value}
                  to={t.to}
                  params={{ projectId }}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex min-h-11 flex-col justify-center rounded-lg px-2.5 py-1.5 md:min-h-10",
                    pathname === resolve(t.value)
                      ? "bg-primary-soft text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  <span className="text-[14px] font-semibold md:text-[13.5px]">{t.label}</span>
                  <span className="text-[11.5px] text-muted-foreground">{t.hint}</span>
                </Link>
              ))}
            </Popover>
          </div>
        </div>

         <div className="mt-5">
          <Outlet />
        </div>
      </div>
       {dailyOpen ? <FieldReportSheet projectId={projectId} projectName={project.name} onClose={() => setDailyOpen(false)} /> : null}
       {statusOpen ? <ProjectStatusUpdateSheet project={project} onClose={() => setStatusOpen(false)} /> : null}
    </>
  );
}
