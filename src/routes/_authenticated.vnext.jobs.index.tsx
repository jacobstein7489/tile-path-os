import { createFileRoute } from "@tanstack/react-router";
import { VNextJobs } from "@/components/vnext/VNextJobs";

export const Route = createFileRoute("/_authenticated/vnext/jobs/")({
  head: () => ({
    meta: [
      { title: "Jobs — Cobblestone VNext" },
      {
        name: "description",
        content: "Every Cobblestone job from first price request through completion.",
      },
      { property: "og:title", content: "Jobs — Cobblestone VNext" },
      {
        property: "og:description",
        content: "Every Cobblestone job from first price request through completion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VNextJobs,
});
