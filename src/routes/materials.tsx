import { createFileRoute } from "@tanstack/react-router";
import { ComingLater } from "@/components/PageShell";

export const Route = createFileRoute("/materials")({
  head: () => ({
    meta: [
      { title: "Materials — Cobblestone Tile OS" },
      {
        name: "description",
        content: "Finish and installation materials, purchase orders and receiving.",
      },
      { property: "og:title", content: "Materials — Cobblestone Tile OS" },
      {
        property: "og:description",
        content: "Finish and installation materials, purchase orders and receiving.",
      },
    ],
  }),
  component: () => (
    <ComingLater
      crumbs={[{ label: "Materials" }]}
      title="Materials"
      note="Finish materials, installation materials, POs and receiving."
    />
  ),
});
