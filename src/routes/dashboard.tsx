import { createFileRoute } from "@tanstack/react-router";
import { ComingLater } from "@/components/PageShell";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Cobblestone Tile OS" },
      {
        name: "description",
        content:
          "Company-wide view of tile installation projects: what is moving, what is blocked and who owns the next action.",
      },
      { property: "og:title", content: "Dashboard — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Company-wide view of tile installation projects and next actions.",
      },
    ],
  }),
  component: () => (
    <ComingLater
      crumbs={[{ label: "Dashboard" }]}
      title="Dashboard"
      note="Company overview across all projects."
    />
  ),
});
