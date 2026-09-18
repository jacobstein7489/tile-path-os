import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarCheck2, Clock3, ListChecks, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { WorkItemDialog } from "@/components/work/WorkItemDialog";
import { OpsRow, OpsSectionHeading } from "@/components/work/OpsRow";
import { useCapture } from "@/components/ops/CaptureProvider";
import { Button } from "@/components/kit";
import { todaySections, todaySummaryLine } from "@/lib/today";
import {
  isItemOwnedBy,
  projectLabel,
  todayIso,
  useWorkFeed,
  type WorkItemRow,
} from "@/lib/workitems";
import { useAuthUser, useMyProfile } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Your day on one screen: what needs you now, which follow-ups are due, what is scheduled today and your open next moves.",
      },
      { property: "og:title", content: "Today — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "What needs you now, follow-ups due, work scheduled today and open next moves.",
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

type Focus = "needsNow" | "followUps" | "scheduledToday" | "nextMoves";

function TodayPage() {
  const { data: items = [], isLoading } = useWorkFeed();
  const { user } = useAuthUser();
  const { data: profile } = useMyProfile();
  const capture = useCapture();
  const today = todayIso();
  const [selectedItem, setSelectedItem] = useState<WorkItemRow | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);

  // Same work_items records as Work, narrowed to this person. Legacy rows that
  // never got an owner_user_id still match on the stored owner name.
  const mine = useMemo(
    () => items.filter((item) => isItemOwnedBy(item, user?.id, profile?.full_name)),
    [items, profile?.full_name, user?.id],
  );

  const sections = useMemo(() => todaySections(mine, today), [mine, today]);
  const first = profile?.full_name?.split(" ")[0];
  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const shows = (key: Focus) => !focus || focus === key;

  return (
    <>
      <AppHeader crumbs={[{ label: "Today" }]} />

      <main className="mx-auto w-full max-w-[1380px] px-4 pb-28 md:px-6">
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-gradient-to-br from-primary-soft/55 to-transparent px-4 py-3.5 md:px-5">
            <div className="min-w-0">
              <p className="v2-kicker mb-1">Daily command center</p>
              <h1 className="truncate text-[24px] leading-tight font-bold md:text-[27px]">
                {first ? `${greeting()}, ${first}` : "Today"}
              </h1>
              <p className="mt-1 truncate text-[12px] text-muted-foreground">
                {dateLine} · {isLoading ? "Loading your day…" : todaySummaryLine(sections)}
              </p>
            </div>
            <Button variant="primary" onClick={() => capture()}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Capture</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
            <TodayMetric
              icon={AlertTriangle}
              label="Needs attention"
              value={sections.needsNow.length}
              tone="danger"
              active={focus === "needsNow"}
              onClick={() => setFocus(focus === "needsNow" ? null : "needsNow")}
            />
            <TodayMetric
              icon={Clock3}
              label="Follow-ups"
              value={sections.followUps.length}
              tone="warning"
              active={focus === "followUps"}
              onClick={() => setFocus(focus === "followUps" ? null : "followUps")}
            />
            <TodayMetric
              icon={CalendarCheck2}
              label="Scheduled today"
              value={sections.scheduledToday.length}
              tone="info"
              active={focus === "scheduledToday"}
              onClick={() => setFocus(focus === "scheduledToday" ? null : "scheduledToday")}
            />
            <TodayMetric
              icon={ListChecks}
              label="Open next moves"
              value={sections.nextMoves.length}
              tone="success"
              active={focus === "nextMoves"}
              onClick={() => setFocus(focus === "nextMoves" ? null : "nextMoves")}
            />
          </div>
        </div>

        <section className="workspace-panel mt-3 overflow-hidden">
          {shows("needsNow") && sections.needsNow.length ? (
            <TodaySection
              label="Needs you now"
              items={sections.needsNow}
              onOpen={setSelectedItem}
            />
          ) : null}
          {shows("followUps") && sections.followUps.length ? (
            <TodaySection
              label="Follow-ups due"
              items={sections.followUps}
              onOpen={setSelectedItem}
            />
          ) : null}
          {shows("scheduledToday") && sections.scheduledToday.length ? (
            <TodaySection
              label="Scheduled today"
              items={sections.scheduledToday}
              onOpen={setSelectedItem}
            />
          ) : null}
          {shows("nextMoves") && sections.nextMoves.length ? (
            <TodaySection
              label="Your open next moves"
              items={sections.nextMoves}
              onOpen={setSelectedItem}
            />
          ) : null}
          {!sections.needsNow.length &&
          !sections.followUps.length &&
          !sections.scheduledToday.length &&
          !sections.nextMoves.length ? (
            <div className="flex min-h-28 items-center justify-between gap-4 px-4 py-5 sm:px-5">
              <div>
                <p className="text-[14px] font-bold">Your day is clear</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  No assigned actions need attention right now.
                </p>
              </div>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
                <ListChecks className="size-4" />
              </span>
            </div>
          ) : null}
        </section>
        {focus ? (
          <div className="mt-3">
            <Button onClick={() => setFocus(null)}>Show all sections</Button>
          </div>
        ) : null}
      </main>
      <WorkItemDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
    </>
  );
}

function TodayMetric({
  icon: Icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: "danger" | "warning" | "info" | "success";
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "grid min-h-[56px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 bg-card px-3 py-2 text-left transition-colors hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 focus-visible:outline-none",
        active && "bg-primary-soft/70 hover:bg-primary-soft/70",
      )}
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <strong className="block text-[20px] leading-none font-bold tabular-nums">{value}</strong>
        <span className="mt-1 block truncate text-[11px] font-bold text-muted-foreground uppercase">
          {label}
          {active ? " · filtering" : ""}
        </span>
      </span>
    </button>
  );
}

function TodaySection({
  label,
  items,
  onOpen,
}: {
  label: string;
  items: WorkItemRow[];
  onOpen: (item: WorkItemRow) => void;
}) {
  return (
    <section className="border-b border-border last:border-b-0">
      <OpsSectionHeading label={label} count={items.length} />
      <ul>
        {items.map((item) => (
          <OpsRow
            key={item.id}
            item={item}
            selected={false}
            context={[projectLabel(item), item.category ?? null]}
            person={item.waiting_on ? `Waiting on ${item.waiting_on}` : null}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}
