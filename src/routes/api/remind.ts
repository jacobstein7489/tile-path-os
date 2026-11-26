/* Every minute the database asks here what's due, and the server sends it to each person's phones (lib/remind.server).
 * Asking twice changes nothing: each thing goes once. */
import { createFileRoute } from "@tanstack/react-router";

const run = async () => {
  const { remindNow, crewMorningMail } = await import("@/lib/remind.server");
  /* last night's crew list again at 7 AM, by itself — whether or not anyone has the app on a phone */
  const crewMail = await crewMorningMail().catch((e) => ({ sent: false, why: String((e as Error)?.message || e).slice(0, 200) }));
  try {
    return Response.json({ ...(await remindNow()), crewMail });
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
