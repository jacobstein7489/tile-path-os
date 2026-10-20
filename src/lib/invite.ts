/* Inviting someone to Tile OS, on the server: the admin gives an email and a login type; the app sends the invite
 * email, they pick a password, and they're in with that login — no waiting room. If the email doesn't reach them
 * (spam, a typo, the mail service), the admin gets a one-time link to text them instead. Only the admin can do this. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Ask = { email: string; name: string; role: string; redirectTo?: string };
export type Sent = { ok: true; already?: boolean } | { ok: false; why: string };
export type Linked = { ok: true; link: string; already?: boolean } | { ok: false; why: string };
const ROLES = new Set(["admin", "pm", "office_coordinator", "estimator", "site_manager", "accounting", "installer", "viewer"]);

const check = (d: Ask) => {
  const email = String(d?.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("That email doesn’t look right");
  if (!ROLES.has(d.role)) throw new Error("Pick a login type");
  return { email, name: String(d.name || "").slice(0, 120), role: d.role, redirectTo: typeof d.redirectTo === "string" ? d.redirectTo.slice(0, 300) : undefined };
};
const isAdmin = async (context: any) => {
  const { data: mine } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  return (mine || []).some((r: { role: string }) => r.role === "admin");
};
const already = (e: any) => /already|registered|exists/i.test(e?.message || "");
/** the plain reason, for the admin's screen */
const why = (e: any) => {
  const m = String(e?.message || "");
  if (/rate limit|too many/i.test(m)) return "The mail service is rate-limited right now — send a link instead, or try again in an hour";
  if (/SUPABASE_SERVICE_ROLE_KEY|service role/i.test(m)) return "The app’s server key isn’t set up in Lovable Cloud yet";
  return m || "Couldn’t send it";
};

export const sendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(check)
  .handler(async ({ data, context }): Promise<Sent> => {
    if (!(await isAdmin(context))) return { ok: false, why: "Only the admin invites people" };
    const admin = supabaseAdmin as any;
    const giveRole = (uid: string) => admin.from("user_roles").upsert({ user_id: uid, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
    try {
      const { data: res, error } = await admin.auth.admin.inviteUserByEmail(data.email, { data: { full_name: data.name }, redirectTo: data.redirectTo });
      if (error) {
        /* already signed up: just give them the login type — they're in next time they open the app */
        if (already(error)) {
          const { data: prof } = await admin.from("profiles").select("user_id").eq("email", data.email).maybeSingle();
          if (prof?.user_id) { await giveRole(prof.user_id); return { ok: true, already: true }; }
        }
        return { ok: false, why: why(error) };
      }
      if (res?.user?.id) await giveRole(res.user.id);
      return { ok: true };
    } catch (e) {
      return { ok: false, why: why(e) };
    }
  });

/** a one-time link that signs them in and asks for a password — for a text message, when the email doesn't land */
export const inviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(check)
  .handler(async ({ data, context }): Promise<Linked> => {
    if (!(await isAdmin(context))) return { ok: false, why: "Only the admin invites people" };
    const admin = supabaseAdmin as any;
    const giveRole = (uid: string) => admin.from("user_roles").upsert({ user_id: uid, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
    try {
      /* new to the app: an invite link (it makes the account). Already in: a sign-in link. */
      let r = await admin.auth.admin.generateLink({ type: "invite", email: data.email, options: { data: { full_name: data.name }, redirectTo: data.redirectTo } });
      let was = false;
      if (r.error && already(r.error)) { was = true; r = await admin.auth.admin.generateLink({ type: "magiclink", email: data.email, options: { redirectTo: data.redirectTo } }); }
      if (r.error) return { ok: false, why: why(r.error) };
      const uid = r.data?.user?.id;
      if (uid) await giveRole(uid);
      const link = r.data?.properties?.action_link;
      if (!link) return { ok: false, why: "No link came back" };
      return { ok: true, link, already: was };
    } catch (e) {
      return { ok: false, why: why(e) };
    }
  });
