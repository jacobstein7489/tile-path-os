import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { WorkList } from "@/components/WorkList";
import { useAuthUser } from "@/hooks/useAuth";
import {
  matchesWorkFilter,
  useWorkFeed,
  WORK_FILTERS,
  type WorkFilter,
  type WorkItemRow,
} from "@/lib/workitems";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>): { view?: "grouped" } =>
    search["view"] === "grouped" ? { view: "grouped" } : {},
  head: () => ({
    meta: [
      { title: "Work — Cobblestone Job Operations" },
      {
        name: "description",
        content:
          "Every open action across all jobs: what needs to happen, who owns it, who we are waiting on and when it is due.",
      },
      { property: "og:title", content: "Work — Cobblestone Job Operations" },
      {
        property: "og:description",
        content: "One board for every open action across all jobs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompanyWorkPage,
});

function CompanyWorkPage() {
  const { data: items = [], isLoading } = useWorkFeed();
  const { user } = useAuthUser();

  const [active, setActive] = useState<WorkItemRow | null>(null);

  // The drawer always reflects the live row, so optimistic edits show instantly.
  const activeItem = active ? (items.find((i) => i.id === active.id) ?? active) : null;

  return (
    <PageShell crumbs={[{ label: "Work" }]} title="Work">
      <WorkList
        items={items}
        isLoading={isLoading}
        onOpen={setActive}
        selectedId={active?.id ?? null}
        filters={WORK_FILTERS}
        matchFilter={(f, item) => matchesWorkFilter(f as WorkFilter, item, user?.id)}
        defaultFilter="All"
        viewStorageKey="cobblestone.companywork.view"
        showSummary
        emptyTitle="Nothing here"
        emptyNote="No actions match this view. Use Capture to log what came in from the field."
      />

      <WorkItemDrawer item={activeItem} onClose={() => setActive(null)} />
    </PageShell>
  );
}
