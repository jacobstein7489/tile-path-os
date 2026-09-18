import { createFileRoute } from "@tanstack/react-router";
import { WorkBoard } from "@/components/work/WorkBoard";

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
  return <WorkBoard projectId={projectId} />;
}
