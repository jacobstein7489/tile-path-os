import { useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleAlert,
  Clock3,
  Hammer,
  Sparkles,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { VNextJobQuickView } from "@/components/vnext/VNextJobQuickView";
import {
  VNextPageHeader,
  VNextPanel,
  WorkRow,
  formatDate,
} from "@/components/vnext/VNextPrimitives";
import { useAuthUser, useMyProfile } from "@/hooks/useAuth";
import { useProjects, useScheduleAssignments } from "@/lib/data";
import { useCrews } from "@/lib/data";
import { isComplete, isItemOwnedBy, isOverdue, isWaiting, useWorkFeed } from "@/lib/workitems";
import { isPreAwardStage, stageFamily, vnextStage } from "@/lib/vnext";

export function VNextToday() {
  const { user } = useAuthUser();
  const { data: profile } = useMyProfile();
  const { data: projects = [] } = useProjects();
  const { data: work = [] } = useWorkFeed();
  const { data: schedule = [] } = useScheduleAssignments();
  const { data: crews = [] } = useCrews();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const mine = useMemo(
    () =>
      work.filter((item) => !isComplete(item) && isItemOwnedBy(item, user?.id, profile?.full_name)),
    [profile?.full_name, user?.id, work],
  );
  const followUps = projects.filter(
    (project) =>
      isPreAwardStage(vnextStage(project)) &&
      project.follow_up_date &&
      project.follow_up_date <= today &&
      !project.exception_state,
  );
  const scheduled = schedule.filter((item) => item.work_date === today);
  const urgent = mine.filter(
    (item) =>
      isOverdue(item) ||
      item.due_date === today ||
      (isWaiting(item) && item.follow_up_on && item.follow_up_on <= today),
  );
  const projectName = (id: string) => projects.find((project) => project.id === id)?.name ?? "Job";
  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 17
        ? "Good afternoon"
        : "Good evening";
  return (
    <div className="mx-auto max-w-[1380px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10">
      <VNextPageHeader
        eyebrow="Daily command center"
        title={`${greeting}${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        description="Pricing follow-ups, project moves, crew commitments, blockers, and returns that matter now."
      />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CircleAlert} label="Needs you" value={urgent.length} tone="red" />
        <Metric icon={Clock3} label="Estimate follow-ups" value={followUps.length} tone="amber" />
        <Metric
          icon={CalendarDays}
          label="Crews today"
          value={new Set(scheduled.map((item) => item.crew_id).filter(Boolean)).size}
          tone="blue"
        />
        <Metric icon={Hammer} label="On site" value={scheduled.length} tone="green" />
      </div>
      {urgent[0] ? (
        <section className="mt-5 grid overflow-hidden rounded-[18px] bg-vnext-ink text-vnext-surface shadow-[var(--vnext-shadow-float)] lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="p-6 sm:p-8">
            <p className="vnext-kicker text-vnext-blue-soft">Focus now</p>
            <h2 className="mt-3 max-w-[30ch] font-display text-[26px] leading-tight font-bold sm:text-[31px]">
              {urgent[0].title}
            </h2>
            <p className="mt-2 text-[12px] text-vnext-surface/65">
              {urgent[0].projects?.name ?? "Company action"}
              {urgent[0].waiting_on ? ` · Waiting on ${urgent[0].waiting_on}` : ""}
            </p>
          </div>
          <div className="flex items-end p-5">
            <Link
              to="/work-item/$itemId"
              params={{ itemId: urgent[0].id }}
              className="flex h-10 items-center gap-2 rounded-lg bg-vnext-surface px-4 text-[11.5px] font-bold text-vnext-ink"
            >
              Open action <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      ) : (
        <section className="mt-5 flex items-center gap-4 rounded-[18px] border border-vnext-green/15 bg-vnext-green-soft p-5">
          <span className="grid size-10 place-items-center rounded-xl bg-vnext-surface text-vnext-green">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-[16px] font-bold">
              No urgent action is assigned to you
            </h2>
            <p className="mt-0.5 text-[11.5px] text-vnext-muted">
              Follow-ups and crew commitments remain visible below.
            </p>
          </div>
        </section>
      )}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="space-y-5">
          <VNextPanel title="Your operating actions" eyebrow={`${mine.length} open`}>
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {mine.slice(0, 8).map((item) => (
                <WorkRow key={item.id} item={item} />
              ))}
              {!mine.length ? <Quiet text="Your open actions will appear here." /> : null}
            </div>
          </VNextPanel>
          <VNextPanel title="Estimate follow-ups" eyebrow="Pre-award">
            <div className="space-y-2 p-3">
              {followUps.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedJob(project.id)}
                  className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[11px] border border-vnext-line bg-vnext-surface p-3 text-left"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-vnext-amber-soft text-vnext-amber">
                    <BriefcaseBusiness className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-[12px]">{project.name}</strong>
                    <span className="text-[10.5px] text-vnext-muted">
                      {vnextStage(project)} · Follow up {formatDate(project.follow_up_date)}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-vnext-faint group-hover:text-vnext-blue" />
                </button>
              ))}
              {!followUps.length ? <Quiet text="No estimate follow-up is due." /> : null}
            </div>
          </VNextPanel>
        </div>
        <VNextPanel title="Today on site" eyebrow="Crew movement">
          <div className="space-y-2 p-3">
            {scheduled.map((item) => {
              const crew = crews.find((candidate) => candidate.id === item.crew_id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedJob(item.project_id)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[12px] border border-vnext-line bg-vnext-wash p-3 text-left"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-vnext-blue text-[10px] font-extrabold text-vnext-surface">
                    {crew?.initials ?? "—"}
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-[12px]">
                      {projectName(item.project_id)}
                    </strong>
                    <span className="mt-0.5 block text-[10.5px] text-vnext-muted">
                      {crew?.name ?? "Crew unassigned"} · {item.kind}
                    </span>
                  </span>
                </button>
              );
            })}
            {!scheduled.length ? <Quiet text="No crew assignments are scheduled today." /> : null}
          </div>
        </VNextPanel>
      </div>
      <VNextJobQuickView jobId={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CircleAlert;
  label: string;
  value: number;
  tone: "red" | "amber" | "blue" | "green";
}) {
  const styles = {
    red: "bg-vnext-red-soft text-vnext-red",
    amber: "bg-vnext-amber-soft text-vnext-amber",
    blue: "bg-vnext-blue-soft text-vnext-blue",
    green: "bg-vnext-green-soft text-vnext-green",
  };
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-vnext-line bg-vnext-surface p-3.5 shadow-[var(--vnext-shadow-row)]">
      <span className={`grid size-9 place-items-center rounded-[10px] ${styles[tone]}`}>
        <Icon className="size-4" />
      </span>
      <span>
        <strong className="block font-display text-[21px] leading-none">{value}</strong>
        <span className="mt-1 block text-[9px] font-extrabold text-vnext-faint uppercase">
          {label}
        </span>
      </span>
    </div>
  );
}
function Quiet({ text }: { text: string }) {
  return <p className="rounded-lg bg-vnext-wash p-4 text-[11.5px] text-vnext-muted">{text}</p>;
}
