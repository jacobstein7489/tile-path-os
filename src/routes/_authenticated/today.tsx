import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { WorkItemPanel } from "@/components/work/WorkItemPanel";
import { OpsRow, OpsSectionHeading } from "@/components/work/OpsRow";
import { useCapture } from "@/components/ops/CaptureProvider";
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

      <main className="mx-auto w-full max-w-[820px] px-4 pt-6 pb-28 md:px-8 md:pt-9">
        {/* Compact header line — no hero, no cards. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-border pb-4">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] leading-tight font-bold tracking-[-0.02em] md:text-[25px]">
              {first ? `${greeting()}, ${first}` : "Today"}
            </h1>
            <p className="mt-1 truncate text-[11.5px] text-muted-foreground">
              {dateLine}
              {profile?.full_name ? ` · ${profile.full_name}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => capture()}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" /> Capture
          </button>
        </div>

        <p className="pt-3 text-[12.5px] font-medium text-secondary-foreground">
          {isLoading ? "Loading your day…" : todaySummaryLine(sections)}
        </p>

        {/* One continuous document plane: three lists, hairlines only. */}
        <div className="mt-7 space-y-8">
          <TodaySection
            label="Needs you now"
            items={sections.needsNow}
            empty="Nothing is late or due today."
            selectedId={active?.id ?? null}
            onOpen={setActive}
          />
          <TodaySection
            label="Follow-ups due"
            items={sections.followUps}
            empty="No follow-ups are due yet."
            selectedId={active?.id ?? null}
            onOpen={setActive}
          />
          <TodaySection
            label="Scheduled today"
            items={sections.scheduledToday}
            empty="Nothing is scheduled for today."
            selectedId={active?.id ?? null}
            onOpen={setActive}
          />
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
    <section>
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
        <p className="py-3.5 text-[12.5px] text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
