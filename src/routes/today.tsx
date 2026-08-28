import { createFileRoute } from "@tanstack/react-router";
import { ComingLater } from "@/components/PageShell";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today — Cobblestone Tile OS" },
      {
        name: "description",
        content: "Your owned tasks, questions and material needs that must move today.",
      },
      { property: "og:title", content: "Today — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Tasks, questions and material needs assigned to you today.",
      },
    ],
  }),
  component: () => (
    <ComingLater
      crumbs={[{ label: "Today" }]}
      title="Today"
      note="Work items assigned to you, due or waiting today."
    />
  ),
});
