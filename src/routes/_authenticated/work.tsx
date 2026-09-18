import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { WorkBoard } from "@/components/work/WorkBoard";

export const Route = createFileRoute("/_authenticated/work")({
  head: () => ({
    meta: [
      { title: "Action Center — Cobblestone Job Operations" },
      {
        name: "description",
        content:
          "Every open company action, grouped by job or by person, opened in one shared work item panel.",
      },
      { property: "og:title", content: "Action Center — Cobblestone Job Operations" },
      { property: "og:description", content: "All company work, grouped by job or by person." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkPage,
});

function WorkPage() {
  return (
    <>
      <AppHeader crumbs={[{ label: "Action Center" }]} />
      <WorkBoard />
    </>
  );
}
