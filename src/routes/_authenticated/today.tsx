import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck2, Clock3, FolderKanban, ListChecks, Plus, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { WorkItemPanel } from "@/components/work/WorkItemPanel";
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
  const [active, setActive] = useState<WorkItemRow | null>(null);
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
  const activeItem = active ? (items.find((i) => i.id === active.id) ?? active) : null;
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
          <Button variant="primary" onClick={() => capture()}><Plus className="size-4" /> Capture</Button>
        </div>

        <p className="mt-4 text-[12.5px] font-medium text-secondary-foreground">
          {isLoading ? "Loading your day…" : todaySummaryLine(sections)}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <SummaryCard label="Needs attention" value={sections.needsNow.length} icon={<Sparkles className="size-4" />} tone="danger" />
          <SummaryCard label="Follow-ups" value={sections.followUps.length} icon={<Clock3 className="size-4" />} tone="warning" />
          <SummaryCard label="Scheduled today" value={sections.scheduledToday.length} icon={<CalendarCheck2 className="size-4" />} tone="primary" />
        </div>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_250px]">
          <section className="workspace-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5 md:px-5">
              <div><h2 className="text-[15px] font-semibold">Today’s work</h2><p className="mt-0.5 text-[11.5px] text-muted-foreground">Your active work, follow-ups, and schedule</p></div>
              <ListChecks className="size-5 text-primary" />
            </div>
            <TodaySection label="Needs you now" items={sections.needsNow} empty="Nothing is late or due today." selectedId={active?.id ?? null} onOpen={setActive} />
            <TodaySection label="Follow-ups due" items={sections.followUps} empty="No follow-ups are due yet." selectedId={active?.id ?? null} onOpen={setActive} />
            <TodaySection label="Scheduled today" items={sections.scheduledToday} empty="Nothing is scheduled for today." selectedId={active?.id ?? null} onOpen={setActive} />
          </section>

          <aside className="workspace-panel overflow-hidden xl:sticky xl:top-20">
            <div className="border-b border-border px-4 py-3"><h2 className="text-[13.5px] font-semibold">Quick actions</h2></div>
            <div className="grid gap-1 p-2">
              <QuickAction icon={<Plus className="size-4" />} label="Capture work" onClick={() => capture()} />
              <QuickLink icon={<FolderKanban className="size-4" />} label="Open projects" to="/projects" />
              <QuickLink icon={<ListChecks className="size-4" />} label="Company work" to="/work" />
            </div>
          </aside>
        </div>
      </main>

      <WorkItemPanel item={activeItem} onClose={() => setActive(null)} />
    </>
  );
}

function TodaySection({
  label,
  items,
  empty,
  selectedId,
  onOpen,
}: {
  label: string;
  items: WorkItemRow[];
  empty: string;
  selectedId: string | null;
  onOpen: (item: WorkItemRow) => void;
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
              selected={item.id === selectedId}
              onOpen={onOpen}
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

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "primary" | "warning" | "danger" }) {
  const styles = tone === "danger" ? "bg-danger-soft text-danger" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-info-soft text-info";
  return <div className="workspace-panel flex min-w-0 items-center gap-3 p-3 md:p-4"><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${styles}`}>{icon}</span><div className="min-w-0"><strong className="block text-[22px] leading-none tabular-nums">{value}</strong><span className="mt-1 block truncate text-[10px] font-bold tracking-[0.06em] text-muted-foreground uppercase sm:text-[11px]">{label}</span></div></div>;
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-[12.5px] font-semibold transition-colors hover:bg-primary-soft"><span className="grid size-8 place-items-center rounded-lg bg-info-soft text-info">{icon}</span><span className="min-w-0 flex-1">{label}</span><ArrowRight className="size-3.5 text-muted-foreground" /></button>;
}

function QuickLink({ icon, label, to }: { icon: React.ReactNode; label: string; to: "/projects" | "/work" }) {
  return <Link to={to} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-[12.5px] font-semibold transition-colors hover:bg-primary-soft"><span className="grid size-8 place-items-center rounded-lg bg-muted text-secondary-foreground">{icon}</span><span className="min-w-0 flex-1">{label}</span><ArrowRight className="size-3.5 text-muted-foreground" /></Link>;
}
