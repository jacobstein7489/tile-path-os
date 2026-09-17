import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/kit";
import { WorkList } from "@/components/WorkList";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { useCapture } from "@/components/ops/CaptureProvider";
import { isComplete, isWaiting, useWorkFeed, type WorkItemRow } from "@/lib/workitems";
import { useAuthUser } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/work")({
  head: () => ({ meta: [
    { title: "Work — Cobblestone Tile OS" },
    { name: "description", content: "All company work, grouped by project and managed from one shared task drawer." },
    { property: "og:title", content: "Work — Cobblestone Tile OS" },
    { property: "og:description", content: "All company work, grouped by project." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: WorkPage,
});

const FILTERS = ["All", "Important", "My Work", "Waiting", "Completed"] as const;

function WorkPage() {
  const { data: items = [], isLoading } = useWorkFeed();
  const { user } = useAuthUser();
  const capture = useCapture();
  const [active, setActive] = useState<WorkItemRow | null>(null);
  const live = active ? items.find((i) => i.id === active.id) ?? active : null;
  const matches = (filter: string, item: WorkItemRow) => {
    if (filter === "Completed") return isComplete(item);
    if (isComplete(item)) return false;
    if (filter === "Important") return item.is_important;
    if (filter === "My Work") return item.owner_user_id === user?.id;
    if (filter === "Waiting") return isWaiting(item);
    return true;
  };
  return <>
    <PageShell crumbs={[{ label: "Work" }]} title="Work" subtitle="Everything the company needs to move, in one place.">
      <WorkList items={items} isLoading={isLoading} onOpen={setActive} selectedId={active?.id ?? null} filters={FILTERS} matchFilter={matches} defaultFilter="All" defaultView="Grouped by Project" viewStorageKey="cobble-work-view" startCollapsed={false} maxVisiblePerGroup={5} toolbarRight={<Button size="sm" variant="primary" onClick={() => capture()}><Plus className="size-4" /> Capture</Button>} emptyTitle="No work here" emptyNote="Change the filter or capture the next action." />
    </PageShell>
    <WorkItemDrawer item={live} onClose={() => setActive(null)} />
  </>;
}