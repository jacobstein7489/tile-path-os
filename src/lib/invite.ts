/* Inviting someone to Tile OS, on the server: the admin gives an email and a login type; the app sends the invite
 * email, they pick a password, and they're in with that login — no waiting room. Only the admin can do this. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Ask = { email: string; name: string; role: string; redirectTo?: string };
export type Sent = { ok: true; already?: boolean } | { ok: false; why: string };
const ROLES = new Set(["admin", "pm", "office_coordinator", "estimator", "site_manager", "accounting", "installer", "viewer"]);

export const sendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: Ask) => {
    const email = String(d?.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("That email doesn’t look right");
    if (!ROLES.has(d.role)) throw new Error("Pick a login type");
    return { email, name: String(d.name || "").slice(0, 120), role: d.role, redirectTo: typeof d.redirectTo === "string" ? d.redirectTo.slice(0, 300) : undefined };
  })
  .handler(async ({ data, context }): Promise<Sent> => {
    const { data: mine } = await (context.supabase as any).from("user_roles").select("role").eq("user_id", context.userId);
    if (!(mine || []).some((r: { role: string }) => r.role === "admin")) return { ok: false, why: "Only the admin invites people" };
    const admin = supabaseAdmin as any;
    const giveRole = (uid: string) => admin.from("user_roles").upsert({ user_id: uid, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
    const { data: res, error } = await admin.auth.admin.inviteUserByEmail(data.email, { data: { full_name: data.name }, redirectTo: data.redirectTo });
    if (error) {
      /* already signed up: just give them the login type — they're in next time they open the app */
      if (/already|registered|exists/i.test(error.message || "")) {
        const { data: prof } = await admin.from("profiles").select("user_id").eq("email", data.email).maybeSingle();
        if (prof?.user_id) { await giveRole(prof.user_id); return { ok: true, already: true }; }
      }
      return { ok: false, why: error.message || "Couldn’t send it" };
    }
    if (res?.user?.id) await giveRole(res.user.id);
    return { ok: true };
  });
