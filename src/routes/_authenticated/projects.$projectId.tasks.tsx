import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/kit";
import { WorkItemDrawer } from "@/components/WorkItemDrawer";
import { WorkList } from "@/components/WorkList";
import { CreateWorkItemModal } from "@/components/WorkItemDialogs";
import {
  compareWorkItems,
  isComplete,
  matchesTodayFilter,
  TODAY_FILTERS,
  useWorkFeed,
  type WorkItemRow,
} from "@/lib/workitems";

export const Route = createFileRoute("/_authenticated/projects/$projectId/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Cobblestone Job Operations" },
      {
        name: "description",
        content: "Open tasks and follow-ups for this project.",
      },
      { property: "og:title", content: "Tasks — Cobblestone Job Operations" },
      { property: "og:description", content: "Open tasks and follow-ups for this project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectTasksPage,
});

function ProjectTasksPage() {
  const { projectId } = Route.useParams();
  const { data: feed = [] } = useWorkFeed();
  const [active, setActive] = useState<WorkItemRow | null>(null);
  const [creating, setCreating] = useState(false);

  const projectWork = feed.filter((i) => i.project_id === projectId);
  const sorted = [...projectWork].sort(compareWorkItems);
  const activeItem = active ? (sorted.find((i) => i.id === active.id) ?? active) : null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Open Tasks</h2>
          <p className="text-[12.5px] text-muted-foreground">
            {projectWork.filter((i) => !isComplete(i)).length} open ·{" "}
            {projectWork.filter((i) => isComplete(i)).length} completed
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <MessageSquarePlus className="size-4" /> Add task
        </Button>
      </div>
      <WorkList
        items={projectWork}
        onOpen={setActive}
        selectedId={active?.id ?? null}
        filters={TODAY_FILTERS}
        matchFilter={matchesTodayFilter}
        defaultFilter="Active"
        showProjectColumn={false}
        showViewToggle={false}
        showSearch={false}
        emptyTitle="Nothing open on this project"
        emptyNote="Use Add task or Quick Capture to log what came in from the field."
      />
      <WorkItemDrawer item={activeItem} onClose={() => setActive(null)} />
      <CreateWorkItemModal
        open={creating}
        onClose={() => setCreating(false)}
        kind="Task"
        projectId={projectId}
      />
    </section>
  );
}
