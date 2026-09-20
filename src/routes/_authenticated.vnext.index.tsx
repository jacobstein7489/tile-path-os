import { createFileRoute } from "@tanstack/react-router";
import { VNextToday } from "@/components/vnext/VNextToday";

export const Route = createFileRoute("/_authenticated/vnext/")({
  head: () => ({ meta: [
    { title: "Today — Cobblestone VNext" },
    { name: "description", content: "Daily priorities across estimating and tile operations." },
    { property: "og:title", content: "Today — Cobblestone VNext" },
    { property: "og:description", content: "Daily priorities across estimating and tile operations." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: VNextToday,
});