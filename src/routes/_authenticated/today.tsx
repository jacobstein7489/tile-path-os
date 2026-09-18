import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
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
          <Button variant="primary" onClick={() => capture()}><Plus className="size-4" /> Capture</Button>
        </div>

        <p className="mt-4 text-[12.5px] font-medium text-secondary-foreground">
          {isLoading ? "Loading your day…" : todaySummaryLine(sections)}
        </p>

        <section className="workspace-panel mt-5 overflow-hidden">
          <TodaySection label="Needs you now" items={sections.needsNow} empty="Nothing is late or due today." />
          <TodaySection label="Follow-ups due" items={sections.followUps} empty="No follow-ups are due yet." />
          <TodaySection label="Scheduled today" items={sections.scheduledToday} empty="Nothing is scheduled for today." />
        </section>
      </main>
    </>
  );
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

