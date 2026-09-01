import { createFileRoute } from "@tanstack/react-router";
import { ComingLater } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Cobblestone Tile OS" },
      { name: "description", content: "Company, crew and workflow configuration." },
      { property: "og:title", content: "Settings — Cobblestone Tile OS" },
      { property: "og:description", content: "Company, crew and workflow configuration." },
    ],
  }),
  component: () => (
    <ComingLater
      crumbs={[{ label: "Settings" }]}
      title="Settings"
      note="Company, crews and workflow configuration."
    />
  ),
});
