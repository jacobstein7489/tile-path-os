/* Intuit sends the admin back here after he connects QuickBooks: the one-time word is checked, the company's tokens are
 * kept on the server, and he lands back on Settings → Connections. */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/quickbooks/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { readConn, writeConn, exchangeCode } = await import("@/lib/quickbooks.server");
        const url = new URL(request.url);
        const back = (how: string) => new Response(null, { status: 302, headers: { Location: `${url.origin}/#/settings/${how}/connections` } });
        const code = url.searchParams.get("code") || "";
        const realmId = url.searchParams.get("realmId") || "";
        const state = url.searchParams.get("state") || "";
        if (url.searchParams.get("error")) return back("qb-no");
        try {
          const c = await readConn();
          const fresh = c?.state && c.state === state && c.state_expires && Date.parse(c.state_expires) > Date.now();
          if (!code || !realmId || !fresh) return back("qb-expired");
          await exchangeCode(c?.origin || url.origin, code, realmId);
          return back("qb-ok");
        } catch (e) {
          console.error("QuickBooks connect failed", e);
          try { await writeConn({ state: null, state_expires: null }); } catch { /* fine */ }
          return back("qb-fail");
        }
      },
    },
  },
});
