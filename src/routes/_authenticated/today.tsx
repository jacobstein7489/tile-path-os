import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { WorkList } from "@/components/WorkList";
import {
  matchesTodayFilter,
  todayBucket,
  TODAY_FILTERS,
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
          "Your day on one screen: what is late, what is due today, what you are waiting on and what comes next.",
      },
      { property: "og:title", content: "Today — Cobblestone Job Operations" },
      { property: "og:description", content: "What is late, due today, waiting and next up." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const { data: items = [], isLoading } = useWorkFeed();
  const { user } = useAuthUser();
  const { data: profile } = useMyProfile();
  const [active, setActive] = useState<WorkItemRow | null>(null);

  // Same work_items records as Work, narrowed to what this user owns.
  const mine = useMemo(
    () =>
      items.filter((i) =>
        i.owner_user_id ? i.owner_user_id === user?.id : i.owner === profile?.full_name,
      ),
    [items, profile?.full_name, user?.id],
  );

  const late = mine.filter((i) => todayBucket(i) === "Overdue").length;
  const due = mine.filter((i) => todayBucket(i) === "Today").length;

  const activeItem = active ? (items.find((i) => i.id === active.id) ?? active) : null;

  return (
    <>
      <AppHeader crumbs={[{ label: "Today" }]} />
      <main className="mx-auto w-full max-w-[1480px] px-4 pt-6 pb-14 md:px-7 md:pt-7">
        <h1 className="text-[24px] leading-tight font-bold tracking-[-0.03em] md:text-[29px]">
          {profile?.full_name?.split(" ")[0]
            ? `Good morning, ${profile.full_name.split(" ")[0]}`
            : "Today"}
        </h1>
        {/* One plain-English line instead of a card wall. */}
        <p className="mt-1.5 text-[13.5px] text-secondary-foreground">
          {late || due ? (
            <>
              {late ? <span className="font-semibold text-danger">{late} late</span> : null}
              {late && due ? " · " : ""}
              {due ? <span className="font-semibold text-primary">{due} due today</span> : null}
              <span className="text-muted-foreground"> · everything else is under Next Up.</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Nothing late and nothing due today. Nice place to be.
            </span>
          )}
        </p>

        <div className="mt-5">
          <WorkList
            items={mine}
            isLoading={isLoading}
            onOpen={setActive}
            selectedId={active?.id ?? null}
            filters={TODAY_FILTERS}
            matchFilter={matchesTodayFilter}
            defaultFilter="Active"
            defaultView="Grouped by Project"
            viewStorageKey="cobblestone.today.view"
            showProjectColumn={false}
            emptyTitle="You're clear"
            emptyNote="Nothing assigned to you is active right now. Completed work is under the Completed filter."
          />
        </div>
      </main>

      <WorkItemDrawer item={activeItem} onClose={() => setActive(null)} />
    </>
  );
}
