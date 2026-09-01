import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { QuickCapture } from "@/components/QuickCapture";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { WorkList } from "@/components/WorkList";
import { Button } from "@/components/kit";
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
    search['view'] === "grouped" ? { view: "grouped" } : {},
  head: () => ({
    meta: [
      { title: "Company Work — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Every open piece of company work in one board: what needs to happen, who owns it, who we are waiting on and the next action.",
      },
      { property: "og:title", content: "Company Work — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "One workboard for every open item across all tile projects.",
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

  const [capture, setCapture] = useState(false);
  const [active, setActive] = useState<WorkItemRow | null>(null);

  // The drawer always reflects the live row, so optimistic edits show instantly.
  const activeItem = active ? (items.find((i) => i.id === active.id) ?? active) : null;

  return (
    <PageShell
      crumbs={[{ label: "Company Work" }]}
      title="Company Work"
      subtitle="Every actionable record in the company. One item, one record — updating it here updates it everywhere."
      actions={
        <Button variant="primary" onClick={() => setCapture(true)}>
          <Plus className="size-4" /> Quick Capture
        </Button>
      }
    >
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
        emptyNote="No work items match this view. Use Quick Capture to log what came in from the field."
      />

      <QuickCapture open={capture} onClose={() => setCapture(false)} />
      <WorkItemDrawer item={activeItem} onClose={() => setActive(null)} />
    </PageShell>
  );
}
