import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ClipboardCheck, FileText, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Popover } from "@/components/ops/Popover";
import { ProjectMoreMenu } from "@/components/ProjectMoreMenu";
import { FieldReportSheet } from "@/components/FieldReportSheet";
import { ProjectStatusUpdateSheet } from "@/components/ProjectStatusUpdateSheet";
import { Button, UnderlineTabs } from "@/components/kit";
import { useProject, useUpdateProject } from "@/lib/data";
import { useProjectSetup } from "@/lib/setup";
import { useProfiles } from "@/lib/people";
import { useCanEditProject } from "@/hooks/useAuth";
import { canEnterStage, nextStage, normalizeStage } from "@/lib/lifecycle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({ component: ProjectShell });

const PROJECT_TABS = [
  { label: "Overview", to: "/projects/$projectId" as const, value: "/projects/$projectId" },
  { label: "Rooms", to: "/projects/$projectId/scope" as const, value: "/projects/$projectId/scope" },
  { label: "Work", to: "/projects/$projectId/tasks" as const, value: "/projects/$projectId/tasks" },
  { label: "Files", to: "/projects/$projectId/files" as const, value: "/projects/$projectId/files" },
];
const MORE_TABS = [
  { label: "Design Meeting", hint: "Resolve layout and treatment choices", to: "/projects/$projectId/design" as const, value: "/projects/$projectId/design" },
  { label: "Installer Package", hint: "Review installer-ready room details", to: "/projects/$projectId/package" as const, value: "/projects/$projectId/package" },
  { label: "Updates", hint: "Daily and project status updates", to: "/projects/$projectId/updates" as const, value: "/projects/$projectId/updates" },
  { label: "Materials", hint: "Tiles, finishes and install materials", to: "/projects/$projectId/tiles" as const, value: "/projects/$projectId/tiles" },
  { label: "Schedule", hint: "Crew assignments and dates", to: "/projects/$projectId/schedule" as const, value: "/projects/$projectId/schedule" },
  { label: "Field", hint: "Progress by area and visit checklist", to: "/projects/$projectId/field" as const, value: "/projects/$projectId/field" },
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
  const [stageOpen, setStageOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  if (isLoading) return <><AppHeader crumbs={[{ label: "Projects", to: "/projects" }, { label: "Loading…" }]} /><div className="px-8 pt-10 text-sm text-muted-foreground">Loading project…</div></>;
  if (!project) return <><AppHeader crumbs={[{ label: "Projects", to: "/projects" }, { label: "Not found" }]} /><div className="px-8 pt-10 text-sm text-muted-foreground">This project no longer exists. <Link to="/projects" className="text-primary hover:underline">Back to projects</Link></div></>;

  const pmName = profiles.find((p) => p.user_id === project.pm_user_id)?.full_name ?? project.project_manager;
  const resolve = (value: string) => value.replace("$projectId", projectId);
  const moreActive = MORE_TABS.find((t) => pathname === resolve(t.value));
  const activeTab = PROJECT_TABS.find((tab) => pathname === resolve(tab.value))?.value ?? (moreActive ? "more" : "/projects/$projectId");
  const stage = normalizeStage(project.lifecycle_stage);
  const following = nextStage(stage);
  const gate = following ? canEnterStage(following, { blockers: setup.blockers.length, hasScheduleAssignment: setup.hasScheduleAssignment }) : null;

  return <>
    <div className="hidden md:block"><AppHeader crumbs={[{ label: "Projects", to: "/projects" }, { label: project.name }]} /></div>
    <div className="mx-auto max-w-[1480px] px-0 pb-16 md:px-7 md:pt-4">
      <header className="border-b border-border bg-card">
        <div className="flex items-center gap-2 px-4 py-2.5 md:px-0 md:py-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="truncate text-[17px] leading-none font-semibold md:text-[26px]">{project.name}</h1>
              <div className="relative shrink-0">
                <button type="button" onClick={() => setStageOpen((v) => !v)} className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-secondary-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground">
                  {project.exception_state ?? stage}<ChevronDown className={cn("size-3.5 transition-transform", stageOpen && "rotate-180")} />
                </button>
                <Popover open={stageOpen} onClose={() => setStageOpen(false)} width="md:w-72" title="Project stage">
                  <div className="px-2.5 py-2">
                    <div className="text-sm font-semibold">Current · {stage}</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{setup.blockers.length ? `${setup.blockers.length} setup item${setup.blockers.length === 1 ? "" : "s"} still block readiness.` : "Current readiness requirements are clear."}</p>
                    {following ? <Button className="mt-3 w-full" variant="primary" disabled={!canEdit || !gate?.ok} {...(!gate?.ok && gate?.reason ? { disabledReason: gate.reason } : {})} onClick={() => { update.mutate({ lifecycle_stage: following }); setStageOpen(false); }}>Advance to {following}</Button> : <div className="mt-3 text-xs font-semibold text-success">Project complete</div>}
                  </div>
                </Popover>
              </div>
            </div>
             <div className="mt-1.5 truncate text-[12px] text-muted-foreground md:mt-2 md:text-[12.5px]">
               <span className="md:hidden">{project.address ?? project.customer ?? "Address not set"}{pmName ? ` · PM ${pmName}` : ""}</span>
               <span className="hidden md:inline">{project.address ?? "Address not set"} · {project.customer ?? "Customer not set"}{pmName ? ` · PM ${pmName}` : ""}</span>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="relative hidden md:block">
              <Button variant="primary" onClick={() => setUpdateOpen((v) => !v)}><Plus className="size-4" /> Update</Button>
              <Popover open={updateOpen} onClose={() => setUpdateOpen(false)} align="right" width="md:w-64" title="Add update">
                <button type="button" onClick={() => { setUpdateOpen(false); setDailyOpen(true); }} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-muted"><ClipboardCheck className="size-4 text-primary" /><span><b className="block text-sm">Daily Update</b><span className="text-xs text-muted-foreground">Fast field report</span></span></button>
                <button type="button" onClick={() => { setUpdateOpen(false); setStatusOpen(true); }} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-muted"><FileText className="size-4 text-primary" /><span><b className="block text-sm">Project Status Update</b><span className="text-xs text-muted-foreground">Concise shareable summary</span></span></button>
              </Popover>
            </div>
            <div className="hidden md:block"><ProjectMoreMenu project={project} /></div>
            <div className="md:hidden"><ProjectMoreMenu compact project={project} onDailyUpdate={() => setDailyOpen(true)} onStatusUpdate={() => setStatusOpen(true)} /></div>
          </div>
        </div>
        <div className="flex items-end gap-0 px-1 md:gap-1 md:px-0">
          <UnderlineTabs className="min-w-0 flex-1 justify-between border-b-0 [&_a]:px-2 md:justify-start md:[&_a]:px-3.5" items={PROJECT_TABS.map((t) => ({ ...t, params: { projectId } }))} value={activeTab} />
          <div className="relative shrink-0">
            <button type="button" onClick={() => setMoreOpen((v) => !v)} className={cn("-mb-px inline-flex cursor-pointer items-center gap-1 border-b-2 px-2 pb-3 text-[13px] transition-colors duration-150 md:px-3.5 md:text-[13.5px]", activeTab === "more" ? "border-primary font-semibold text-primary" : "border-transparent font-medium text-secondary-foreground hover:text-foreground")}>More<ChevronDown className={cn("hidden size-3.5 transition-transform sm:block", moreOpen && "rotate-180")} /></button>
            <Popover open={moreOpen} onClose={() => setMoreOpen(false)} align="right" width="md:w-72" title="Project tools">
              {MORE_TABS.map((t) => <Link key={t.value} to={t.to} params={{ projectId }} onClick={() => setMoreOpen(false)} className={cn("flex min-h-11 flex-col justify-center rounded-lg px-2.5 py-1.5", pathname === resolve(t.value) ? "bg-primary-soft text-primary" : "hover:bg-muted")}><span className="text-[13.5px] font-semibold">{t.label}</span><span className="text-[11.5px] text-muted-foreground">{t.hint}</span></Link>)}
            </Popover>
          </div>
        </div>
      </header>
      <main className="bg-card"><Outlet /></main>
    </div>
    {dailyOpen ? <FieldReportSheet projectId={projectId} projectName={project.name} onClose={() => setDailyOpen(false)} /> : null}
    {statusOpen ? <ProjectStatusUpdateSheet project={project} onClose={() => setStatusOpen(false)} /> : null}
  </>;
}
