import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { QuickCapture } from "@/components/QuickCapture";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { WorkList } from "@/components/WorkList";
import { Button, KpiCard, SectionCard } from "@/components/kit";
import {
  isComplete,
  matchesTodayFilter,
  TODAY_FILTERS,
  useWorkFeed,
  type WorkItemRow,
} from "@/lib/workitems";

import { ROLE_LABELS, useAuthUser, useMyProfile, useMyRoles } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Your work for today: the work items you own, their status and the next action for each one.",
      },
      { property: "og:title", content: "Today — Cobblestone Tile OS" },
      { property: "og:description", content: "The work items you own today and the next action." },
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
  const { data: roles = [] } = useMyRoles();
  const [active, setActive] = useState<WorkItemRow | null>(null);
  const [capture, setCapture] = useState(false);

  // Same work_items records as Company Work, narrowed to what this user owns.
  const mine = useMemo(
    () =>
      items.filter((i) =>
        i.owner_user_id ? i.owner_user_id === user?.id : i.owner === profile?.full_name,
      ),
    [items, profile?.full_name, user?.id],
  );

  const openCount = mine.filter((i) => !isComplete(i)).length;
  const completedCount = mine.filter((i) => isComplete(i)).length;
  const waitingCount = mine.filter(
    (i) => !isComplete(i) && (i.waiting_on || i.status === "Waiting"),
  ).length;

  const activeItem = active ? (items.find((i) => i.id === active.id) ?? active) : null;

  return (
    <>
      <AppHeader
        crumbs={[{ label: "Today" }]}
        viewLabel={`${(roles[0] ? ROLE_LABELS[roles[0]] : "My").toUpperCase()} VIEW`}
      />
      <div className="mx-auto max-w-7xl px-8 pt-8 pb-16">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em]">
          Good morning, {profile?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Here is your work for today.</p>

        <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_270px]">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <KpiCard
                icon={<Clock className="size-5" />}
                tone="blue"
                label="Active"
                value={openCount}
              />
              <KpiCard
                icon={<AlertTriangle className="size-5" />}
                tone="amber"
                label="Waiting"
                value={waitingCount}
              />
              <KpiCard
                icon={<CheckCircle2 className="size-5" />}
                tone="green"
                label="Completed"
                value={completedCount}
              />
            </div>

            <WorkList
              items={mine}
              isLoading={isLoading}
              onOpen={setActive}
              selectedId={active?.id ?? null}
              filters={TODAY_FILTERS}
              matchFilter={matchesTodayFilter}
              defaultFilter="Active"
              defaultView={mine.length > 6 ? "Grouped by Project" : "List"}
              viewStorageKey="cobblestone.today.view"
              showProjectColumn={false}
              allowAdd={false}
              emptyTitle="You're clear"
              emptyNote="Nothing assigned to you is active right now. Completed work is under the Completed filter."
            />


          </div>

          <aside className="space-y-3">
            <SectionCard title="Quick Actions">
              <div className="space-y-2.5 px-4 pt-1 pb-4">
                <Button variant="primary" className="w-full" onClick={() => setCapture(true)}>
                  <Plus className="size-4" /> Quick Capture
                </Button>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Log anything from a site visit, call or message. It becomes a real work item on the
                  company board and on the project.
                </p>
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>

      <QuickCapture open={capture} onClose={() => setCapture(false)} />
      <WorkItemDrawer item={activeItem} onClose={() => setActive(null)} />
    </>
  );
}
