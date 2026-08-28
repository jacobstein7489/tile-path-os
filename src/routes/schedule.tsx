import { createFileRoute } from "@tanstack/react-router";
import { ComingLater } from "@/components/PageShell";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — Cobblestone Tile OS" },
      { name: "description", content: "Crew schedules, assignments and return visits." },
      { property: "og:title", content: "Schedule — Cobblestone Tile OS" },
      { property: "og:description", content: "Crew schedules, assignments and return visits." },
    ],
  }),
  component: () => (
    <ComingLater
      crumbs={[{ label: "Schedule" }]}
      title="Schedule"
      note="Crew assignments and return visits."
    />
  ),
});
