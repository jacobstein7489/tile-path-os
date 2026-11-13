/* The assistant's answers, sent on as they're written (lib/talk.server) — the first words show right away. */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/talk")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { talk } = await import("@/lib/talk.server");
        return talk(request);
      },
    },
  },
});
