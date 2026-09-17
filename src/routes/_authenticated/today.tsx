import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/kit";
import { FieldReportSheet } from "@/components/FieldReportSheet";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { WorkList } from "@/components/WorkList";
import { useFieldReports } from "@/lib/fieldreports";
import { useProjects, useScheduleAssignments } from "@/lib/data";
import {
  isComplete,
  isDueToday,
  isOverdue,
  isWaiting,
  todayBucket,
  todayIso,
  useWorkFeed,
  type WorkItemRow,
} from "@/lib/workitems";

import { useAuthUser, useMyProfile } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Cobblestone Job Operations" },
      {
        name: "description",
        content:
          "Your day on one screen: what is late, what is due today, what you are following up on and what comes next.",
      },
      { property: "og:title", content: "Today — Cobblestone Job Operations" },
      { property: "og:description", content: "What is late, due today, following up and next up." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TodayPage,
});

type Focus = "Overdue" | "Today" | "Waiting Follow-Ups" | "Completed";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function TodayPage() {
  const { data: items = [], isLoading } = useWorkFeed();
  const { user } = useAuthUser();
  const { data: profile } = useMyProfile();
  const [active, setActive] = useState<WorkItemRow | null>(null);
  const [focus] = useState<Focus | null>(null);
  const [report, setReport] = useState<{ id: string; name: string; crewId: string | null } | null>(
    null,
  );

  const today = todayIso();
  const { data: schedule = [] } = useScheduleAssignments();
  const { data: projects = [] } = useProjects();
  const { data: reports = [] } = useFieldReports();

  // Same work_items records as Work, narrowed to what this user owns.
  const mine = useMemo(
    () =>
      items.filter((i) =>
        i.owner_user_id ? i.owner_user_id === user?.id : i.owner === profile?.full_name,
      ),
    [items, profile?.full_name, user?.id],
  );

  const counts = {
    Overdue: mine.filter(isOverdue).length,
    Today: mine.filter((i) => todayBucket(i) === "Today").length,
    "Waiting Follow-Ups": mine.filter((i) => todayBucket(i) === "Waiting Follow-Ups").length,
    Completed: mine.filter((i) => isComplete(i) && (i.completed_at ?? "").slice(0, 10) === today)
      .length,
  };

  // Jobs scheduled today that still have no daily update.
  const needsUpdate = useMemo(() => {
    const reported = new Set(
      reports.filter((r) => r.report_date === today).map((r) => r.project_id),
    );
    const seen = new Set<string>();
    const out: { id: string; name: string; crewId: string | null }[] = [];
    for (const a of schedule) {
      if (a.work_date !== today || !a.project_id) continue;
      if (reported.has(a.project_id) || seen.has(a.project_id)) continue;
      seen.add(a.project_id);
      out.push({
        id: a.project_id,
        name: projects.find((p) => p.id === a.project_id)?.name ?? "Job",
        crewId: a.crew_id ?? null,
      });
    }
    return out;
  }, [schedule, reports, today, projects]);

  const activeItem = active ? (items.find((i) => i.id === active.id) ?? active) : null;

  return (
    <>
      <AppHeader crumbs={[{ label: "Today" }]} />
      <main className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-20 md:px-8 md:pt-8">
        <h1 className="text-[27px] leading-tight font-bold tracking-[-0.03em] md:text-[34px]">
          {profile?.full_name?.split(" ")[0]
            ? `${greeting()}, ${profile.full_name.split(" ")[0]}`
            : "Today"}
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {counts.Overdue || counts.Today
            ? "Here is what needs you first."
            : "Nothing late and nothing due today."}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-y border-border py-3 text-[12.5px] text-muted-foreground"><span><b className="text-danger">{counts.Overdue}</b> overdue</span><span><b className="text-foreground">{counts.Today}</b> due today</span><span><b className="text-warning">{counts["Waiting Follow-Ups"]}</b> follow-ups</span><span><b className="text-success">{counts.Completed}</b> completed</span></div>

        {/* Site manager reminder: today's jobs still missing a daily update. */}
        {needsUpdate.length ? (
          <section className="surface mt-4 px-4 py-4 md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold tracking-[-0.01em]">
                  Daily update still needed
                </h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {needsUpdate.map((p) => p.name).join(" · ")}
                </p>
              </div>
              <Button variant="primary" onClick={() => setReport(needsUpdate[0]!)}>
                <ClipboardCheck className="size-4" /> Daily update
              </Button>
            </div>
          </section>
        ) : null}

        <div className="mt-4">
          <WorkList
            items={mine}
            isLoading={isLoading}
            onOpen={setActive}
            selectedId={active?.id ?? null}
            filters={["Active"]}
            matchFilter={(_f, i) =>
              focus === "Completed"
                ? isComplete(i)
                : !isComplete(i) && (!focus || todayBucket(i) === focus)
            }
            defaultFilter="Active"
            sectionsByBucket
            showViewToggle={false}
            showSearch={false}
            allowAdd={false}
             maxVisiblePerGroup={5}
            showProjectColumn
            emptyTitle={focus ? `Nothing ${focus.toLowerCase()}` : "You're clear"}
            emptyNote={
              focus
                ? "Tap the card again to see your whole day."
                : "Nothing assigned to you is open right now."
            }
          />
        </div>
      </main>

      <WorkItemDrawer item={activeItem} onClose={() => setActive(null)} />
      {report ? (
        <FieldReportSheet
          projectId={report.id}
          projectName={report.name}
          defaultCrewId={report.crewId}
          onClose={() => setReport(null)}
        />
      ) : null}
    </>
  );
}

/* Kept for reference in one place: Today's date helpers come from the work engine. */
void isDueToday;
void isWaiting;
