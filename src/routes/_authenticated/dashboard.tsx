import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/work", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Work — Cobblestone Job Operations" },
      {
        name: "description",
        content:
          "Every open action across all jobs: what needs to happen, who owns it, who we are waiting on and when it is due.",
      },
      { property: "og:title", content: "Work — Cobblestone Job Operations" },
      {
        property: "og:description",
        content: "One board for every open action across all jobs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
