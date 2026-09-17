import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { WorkItemPanel } from "@/components/work/WorkItemPanel";
import { todaySections, todaySummaryLine, followUpDate } from "@/lib/today";
import {
  actionDate,
  isOverdue,
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

function shortDate(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TodayPage() {
  const { data: items = [], isLoading } = useWorkFeed();
  const { user } = useAuthUser();
  const { data: profile } = useMyProfile();
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

  return (
    <>
      <AppHeader crumbs={[{ label: "Today" }]} />
      <main className="mx-auto w-full max-w-[840px] px-4 pt-7 pb-24 md:px-7 md:pt-10">
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em] md:text-[30px]">
          {first ? `${greeting()}, ${first}` : "Today"}
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {isLoading ? "Loading your day…" : todaySummaryLine(sections)}
        </p>

        <div className="mt-8 space-y-9">
          <Section
            label="Needs you now"
            items={sections.needsNow}
            empty="Nothing is late or due today."
            selectedId={active?.id ?? null}
            onOpen={setActive}
            today={today}
          />
          <Section
            label="Follow-ups due"
            items={sections.followUps}
            empty="No follow-ups are due yet."
            selectedId={active?.id ?? null}
            onOpen={setActive}
            today={today}
          />
          <Section
            label="Scheduled today"
            items={sections.scheduledToday}
            empty="Nothing is scheduled for today."
            selectedId={active?.id ?? null}
            onOpen={setActive}
            today={today}
          />
        </div>
      </main>

      <WorkItemPanel item={activeItem} onClose={() => setActive(null)} />
    </>
  );
}

function Section({
  label,
  items,
  empty,
  selectedId,
  onOpen,
  today,
}: {
  label: string;
  items: WorkItemRow[];
  empty: string;
  selectedId: string | null;
  onOpen: (item: WorkItemRow) => void;
  today: string;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-border pb-2">
        <h2 className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </h2>
        {items.length ? (
          <span className="text-[11px] text-muted-foreground">{items.length}</span>
        ) : null}
      </div>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <TodayRow
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onOpen={onOpen}
              today={today}
            />
          ))}
        </ul>
      ) : (
        <p className="py-4 text-[13px] text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function TodayRow({
  item,
  selected,
  onOpen,
  today,
}: {
  item: WorkItemRow;
  selected: boolean;
  onOpen: (item: WorkItemRow) => void;
  today: string;
}) {
  const late = isOverdue(item);
  const waiting = item.waiting_on?.trim();
  const follow = followUpDate(item);
  const date = actionDate(item);

  // One quiet context line only: who we are waiting on, or the date that matters.
  let context: string | null = null;
  if (waiting) {
    context = follow
      ? `Waiting on ${waiting} · follow up ${follow === today ? "today" : shortDate(follow)}`
      : `Waiting on ${waiting}`;
  } else if (date) {
    context = late ? `Late — was due ${shortDate(date)}` : `Due ${date === today ? "today" : shortDate(date)}`;
  } else if (item.next_action) {
    context = item.next_action;
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={cn(
          "flex w-full items-start gap-3 border-b border-border px-1 py-3 text-left transition-colors hover:bg-muted/50",
          selected && "bg-selected",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[11px] text-muted-foreground">
              {projectLabel(item)}
            </span>
            {item.is_important ? (
              <Star className="size-3 shrink-0 fill-warning text-warning" />
            ) : null}
          </span>
          <span className="mt-0.5 block text-[14px] font-semibold tracking-[-0.01em]">
            {item.title}
          </span>
          {context ? (
            <span
              className={cn(
                "mt-0.5 block truncate text-[12px]",
                late ? "text-danger" : waiting ? "text-warning" : "text-muted-foreground",
              )}
            >
              {context}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
