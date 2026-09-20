import { createFileRoute } from "@tanstack/react-router";
import { VNextJobOverview } from "@/components/vnext/VNextJobOverview";

export const Route = createFileRoute("/_authenticated/vnext/jobs/$jobId/")({
  head: () => ({ meta: [
    { title: "Job Overview — Cobblestone VNext" },
    { name: "description", content: "A full-lifecycle operating view of a Cobblestone tile job." },
    { property: "og:title", content: "Job Overview — Cobblestone VNext" },
    { property: "og:description", content: "A full-lifecycle operating view of a Cobblestone tile job." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: VNextJobOverview,
});