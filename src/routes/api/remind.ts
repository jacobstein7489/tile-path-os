/* Every minute the database asks here what's due, and the server sends it to each person's phones (lib/remind.server).
 * Asking twice changes nothing: each thing goes once. */
import { createFileRoute } from "@tanstack/react-router";

const run = async () => {
  const { remindNow } = await import("@/lib/remind.server");
  try {
    return Response.json(await remindNow());
  } catch (e) {
    console.error("remind failed", e);
    return Response.json({ ok: false, why: String((e as Error)?.message || e).slice(0, 200) }, { status: 500 });
  }
};

export const Route = createFileRoute("/api/remind")({
  server: {
    handlers: {
      GET: run,
      POST: run,
    },
  },
});
