import { createFileRoute } from "@tanstack/react-router";

/**
 * TEMPORARY Sprint 1 QA provisioning endpoint.
 * Creates the four disposable QA identities used for the role/RLS matrix tests.
 * Guarded by QA_PROVISION_SECRET. Delete this file once Sprint 1 evidence is captured.
 */
const QA_USERS = [
  { email: "qa.pm@cobblestone.test", full_name: "QA Project Manager", role: "pm" },
  { email: "qa.site@cobblestone.test", full_name: "QA Site Manager", role: "site_manager" },
  {
    email: "qa.office@cobblestone.test",
    full_name: "QA Office Coordinator",
    role: "office_coordinator",
  },
  { email: "qa.norole@cobblestone.test", full_name: "QA No Role", role: null },
] as const;

export const Route = createFileRoute("/api/public/qa-provision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["QA_PROVISION_SECRET"];
        if (!secret || request.headers.get("x-qa-secret") !== secret) {
          return new Response("Forbidden", { status: 403 });
        }
        const password = new URL(request.url).searchParams.get("password");
        if (!password || password.length < 12) {
          return new Response("password query param required", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results: Record<string, string> = {};

        for (const qa of QA_USERS) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: qa.email,
            password,
            email_confirm: true,
            user_metadata: { full_name: qa.full_name },
          });
          let userId = data?.user?.id ?? null;
          if (error && !userId) {
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
            userId = list?.users.find((u) => u.email === qa.email)?.id ?? null;
            if (!userId) {
              results[qa.email] = `error: ${error.message}`;
              continue;
            }
          }
          if (!userId) continue;
          await supabaseAdmin
            .from("profiles")
            .update({ full_name: qa.full_name, is_active: true })
            .eq("user_id", userId);
          if (qa.role) {
            await supabaseAdmin
              .from("user_roles")
              .upsert({ user_id: userId, role: qa.role }, { onConflict: "user_id,role" });
          } else {
            await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
          }
          results[qa.email] = userId;
        }

        return Response.json({ ok: true, users: results });
      },
    },
  },
});
