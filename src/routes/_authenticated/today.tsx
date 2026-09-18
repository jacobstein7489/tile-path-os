import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarCheck2, Clock3, Plus, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { OpsRow, OpsSectionHeading } from "@/components/work/OpsRow";
import { useCapture } from "@/components/ops/CaptureProvider";
import { Button } from "@/components/kit";
import { todaySections, todaySummaryLine } from "@/lib/today";
import { projectLabel, todayIso, useWorkFeed, type WorkItemRow } from "@/lib/workitems";
import { useAuthUser, useMyProfile } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Cobblestone Job Operations" },
      {
        name: "description",
        content:
          "Your day on one screen: what needs you now, which follow-ups are due and what is scheduled today.",
      },
      { property: "og:title", content: "Today — Cobblestone Job Operations" },
      {
        property: "og:description",
        content: "What needs you now, follow-ups due and work scheduled today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TodayPage,
});

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
  const capture = useCapture();
  const today = todayIso();

  // Same work_items records as Work, narrowed to this person. Legacy rows that
  // never got an owner_user_id still match on the stored owner name.
  const mine = useMemo(
    () =>
      items.filter((i) =>
        i.owner_user_id
          ? i.owner_user_id === user?.id
          : Boolean(profile?.full_name) && i.owner === profile?.full_name,
      ),
    [items, profile?.full_name, user?.id],
  );

  const sections = useMemo(() => todaySections(mine, today), [mine, today]);
  const first = profile?.full_name?.split(" ")[0];
  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <AppHeader crumbs={[{ label: "Today" }]} />

      <main className="mx-auto w-full max-w-[1380px] px-4 pt-5 pb-28 md:px-7 md:pt-7">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-[24px] leading-tight font-bold md:text-[30px]">
              {first ? `${greeting()}, ${first}` : "Today"}
            </h1>
            <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
              {dateLine}
              {profile?.full_name ? ` · ${profile.full_name}` : ""}
            </p>
          </div>
          <Button variant="primary" onClick={() => capture()}>
            <Plus className="size-4" /> Capture
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5 md:gap-4">
          <TodayMetric icon={AlertTriangle} label="Needs attention" value={sections.needsNow.length} tone="danger" />
          <TodayMetric icon={Clock3} label="Follow-ups" value={sections.followUps.length} tone="warning" />
          <TodayMetric icon={CalendarCheck2} label="Scheduled today" value={sections.scheduledToday.length} tone="info" />
        </div>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_240px]">
        <section className="workspace-panel overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/30 px-4 py-3.5 md:px-5">
            <div className="min-w-0">
              <p className="v2-kicker">Your operational queue</p>
              <p className="mt-0.5 truncate text-[13px] font-semibold text-secondary-foreground">{isLoading ? "Loading your day…" : todaySummaryLine(sections)}</p>
            </div>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Sparkles className="size-4" /></span>
          </div>
          <TodaySection
            label="Needs you now"
            items={sections.needsNow}
            empty="Nothing is late or due today."
          />
          <TodaySection
            label="Follow-ups due"
            items={sections.followUps}
            empty="No follow-ups are due yet."
          />
          <TodaySection
            label="Scheduled today"
            items={sections.scheduledToday}
            empty="Nothing is scheduled for today."
          />
        </section>
        <aside className="workspace-panel hidden overflow-hidden xl:block">
          <div className="border-b border-border px-4 py-3.5"><p className="v2-kicker">Quick action</p><h2 className="mt-1 text-[15px] font-bold">Log field activity</h2></div>
          <div className="p-4"><p className="text-[12px] leading-relaxed text-muted-foreground">Capture a call, site update, question, or next move without leaving Today.</p><Button variant="primary" className="mt-4 w-full" onClick={() => capture()}><Plus className="size-4" /> Capture update</Button></div>
        </aside>
        </div>
      </main>
    </>
  );
}

function TodayMetric({ icon: Icon, label, value, tone }: { icon: typeof AlertTriangle; label: string; value: number; tone: "danger" | "warning" | "info" }) {
  const tones = { danger: "bg-danger-soft text-danger", warning: "bg-warning-soft text-warning", info: "bg-info-soft text-info" } as const;
  return <div className="workspace-panel grid min-h-[92px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-3 md:px-4"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-4" /></span><span className="min-w-0"><strong className="block text-[22px] leading-none font-bold tabular-nums md:text-[26px]">{value}</strong><span className="mt-1 block truncate text-[10px] font-bold text-muted-foreground uppercase md:text-[11px]">{label}</span></span></div>;
}

function TodaySection({
  label,
  items,
  empty,
}: {
  label: string;
  items: WorkItemRow[];
  empty: string;
}) {
  return (
    <section className="border-b border-border last:border-b-0">
      <OpsSectionHeading label={label} count={items.length} />
      {items.length ? (
        <ul>
          {items.map((item) => (
            <OpsRow
              key={item.id}
              item={item}
              selected={false}
              context={[projectLabel(item), item.category ?? null]}
              person={item.waiting_on ? `Waiting on ${item.waiting_on}` : null}
            />
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-[12.5px] text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
