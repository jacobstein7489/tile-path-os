import { createFileRoute } from "@tanstack/react-router";
import { VNextEstimating } from "@/components/vnext/VNextEstimating";

export const Route = createFileRoute("/_authenticated/vnext/jobs/$jobId/estimate")({
  head: () => ({ meta: [
    { title: "Estimating Workspace — Cobblestone VNext" },
    { name: "description", content: "Tile scope, quantities, plans, questions and proposal follow-up." },
    { property: "og:title", content: "Estimating Workspace — Cobblestone VNext" },
    { property: "og:description", content: "Tile scope, quantities, plans, questions and proposal follow-up." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: VNextEstimating,
});