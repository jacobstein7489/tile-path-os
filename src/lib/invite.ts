/* Inviting someone to Tile OS, on the server: the admin gives an email and a login type; the app sends the invite
 * email, they pick a password, and they're in with that login — no waiting room. If the email doesn't reach them
 * (spam, a typo, the mail service), the admin gets a one-time link to text them instead. Only the admin can do this. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Ask = { email: string; name: string; role: string; redirectTo?: string };
export type Sent = { ok: true; already?: boolean; resent?: boolean; sentAt?: string } | { ok: false; why: string };
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

/** the auth user with this email, if there is one */
const findUser = async (admin: any, email: string) => {
  for (let page = 1; page <= 10; page++) {
    const { data: res, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = (res?.users || []).find((x: any) => String(x.email || "").toLowerCase() === email);
    if (u) return u;
    if (!res?.users?.length || res.users.length < 200) return null;
  }
  return null;
};

/** make sure the account exists and can sign in, with the login type — never takes anything away */
async function ready(admin: any, data: { email: string; name: string; role: string }) {
  let u = await findUser(admin, data.email);
  let fresh = false;
  if (!u) {
    const { data: made, error } = await admin.auth.admin.createUser({ email: data.email, email_confirm: true, user_metadata: { full_name: data.name } });
    if (error && !already(error)) throw error;
    u = made?.user || (await findUser(admin, data.email));
    fresh = true;
  } else if (!u.email_confirmed_at) {
    await admin.auth.admin.updateUserById(u.id, { email_confirm: true });
  }
  if (!u) throw new Error("Couldn’t make the account");
  await admin.from("user_roles").upsert({ user_id: u.id, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
  await admin.from("profiles").update({ is_active: true }).eq("user_id", u.id);
  return { u, fresh };
}

/* The invite goes out as the invite email ("You're invited to Tile OS") — never a password reset. Someone who was on
 * the team before and was taken off, or who never signed in, starts fresh: their old account is closed and a new
 * invite goes out, so what they get is always an invite. Someone already on the team who signs in gets nothing —
 * they already have their password. The link opens the published app (never a preview), which asks for a password. */
export const sendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(check)
  .handler(async ({ data, context }): Promise<Sent> => {
    if (!(await isAdmin(context))) return { ok: false, why: "Only the admin invites people" };
    const admin = supabaseAdmin as any;
    try {
      const old = await findUser(admin, data.email);
      if (old) {
        if (old.id === context.userId) return { ok: false, why: "That’s your own login" };
        const [{ data: roles }, { data: prof }] = await Promise.all([
          admin.from("user_roles").select("role").eq("user_id", old.id),
          admin.from("profiles").select("is_active").eq("user_id", old.id).maybeSingle(),
        ]);
        const onTeam = (roles || []).length > 0 && prof?.is_active !== false;
        if (onTeam && old.last_sign_in_at) {
          /* already in — make sure the login type is the one picked now */
          await admin.from("user_roles").upsert({ user_id: old.id, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
          return { ok: true, already: true };
        }
        /* taken off the team before, or never signed in: close the old account so the invite is a real invite */
        await admin.from("user_roles").delete().eq("user_id", old.id);
        await admin.from("profiles").delete().eq("user_id", old.id);
        const { error: delErr } = await admin.auth.admin.deleteUser(old.id);
        if (delErr) return { ok: false, why: why(delErr) };
      }
      const { data: inv, error } = await admin.auth.admin.inviteUserByEmail(data.email, { redirectTo: data.redirectTo, data: data.name ? { full_name: data.name } : {} });
      if (error) return { ok: false, why: why(error) };
      const id = inv?.user?.id || (await findUser(admin, data.email))?.id;
      if (!id) return { ok: false, why: "The invite went out, but the account wasn’t made — try once more" };
      await admin.from("user_roles").upsert({ user_id: id, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
      await admin.from("profiles").update({ is_active: true, ...(data.name ? { full_name: data.name } : {}) }).eq("user_id", id);
      return { ok: true, resent: !!old, sentAt: new Date().toISOString() };
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
    try {
      const { u } = await ready(admin, data);
      const r = await admin.auth.admin.generateLink({ type: "recovery", email: data.email, options: { redirectTo: data.redirectTo } });
      if (r.error) return { ok: false, why: why(r.error) };
      /* the link goes straight to the app, which checks the token itself — it never stops at the sign-in service, so
         it can't land on a Lovable page whatever the Cloud's address settings say */
      const hashed = r.data?.properties?.hashed_token;
      const base = String(data.redirectTo || "https://cobblestone.lovable.app").replace(/[#?].*$/, "").replace(/\/$/, "");
      const link = hashed ? `${base}/#/welcome?th=${encodeURIComponent(hashed)}&type=recovery` : r.data?.properties?.action_link;
      if (!link) return { ok: false, why: "No link came back" };
      return { ok: true, link, already: !!u.last_sign_in_at };
    } catch (e) {
      return { ok: false, why: why(e) };
    }
  });

/** where each invite stands, by email: when it went out, whether they've signed in — for the Team page. The admin only. */
export type Standing = { invited?: string; signedIn?: string; confirmed?: string; made?: string }
export const inviteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { emails: string[] }) => ({ emails: Array.from(new Set((Array.isArray(d?.emails) ? d.emails : []).map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))).slice(0, 200) }))
  .handler(async ({ data, context }): Promise<{ ok: true; users: Record<string, Standing> } | { ok: false; why: string }> => {
    if (!(await isAdmin(context))) return { ok: false, why: "Only the admin sees this" };
    const admin = supabaseAdmin as any;
    const want = new Set(data.emails);
    const users: Record<string, Standing> = {};
    try {
      for (let page = 1; page <= 10 && want.size; page++) {
        const { data: res, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return { ok: false, why: why(error) };
        for (const u of res?.users || []) {
          const e = String(u.email || "").toLowerCase();
          if (!want.has(e)) continue;
          users[e] = { invited: u.invited_at || undefined, signedIn: u.last_sign_in_at || undefined, confirmed: u.email_confirmed_at || u.confirmed_at || undefined, made: u.created_at || undefined };
        }
        if (!res?.users?.length || res.users.length < 200) break;
      }
      return { ok: true, users };
    } catch (e) {
      return { ok: false, why: why(e) };
    }
  });

/** the login type for an email's account — made a moment ago by the sign-in link the app just sent, or long ago.
 *  The email itself goes out from the browser (supabase.auth.signInWithOtp), the same way as a password link, so
 *  it lands wherever those land. The admin only. */
export type Granted = { ok: true; signedIn: boolean; again: boolean } | { ok: false; why: string }
export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { email: string; name: string; role: string }) => {
    const email = String(d?.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("That email doesn’t look right");
    if (!ROLES.has(d.role)) throw new Error("Pick a login type");
    return { email, name: String(d.name || "").slice(0, 120), role: d.role };
  })
  .handler(async ({ data, context }): Promise<Granted> => {
    if (!(await isAdmin(context))) return { ok: false, why: "Only the admin invites people" };
    const admin = supabaseAdmin as any;
    try {
      let u: any = null;
      for (let i = 0; i < 4 && !u; i++) {
        u = await findUser(admin, data.email);
        if (!u) await new Promise((r) => setTimeout(r, 700));
      }
      if (!u) return { ok: false, why: "The account wasn’t made — the sign-in link may not have gone out. Try again in a minute." };
      await admin.from("user_roles").upsert({ user_id: u.id, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
      await admin.from("profiles").update({ is_active: true }).eq("user_id", u.id);
      if (data.name) {
        const { data: prof } = await admin.from("profiles").select("user_id, full_name").eq("user_id", u.id).maybeSingle();
        if (prof && !prof.full_name) await admin.from("profiles").update({ full_name: data.name }).eq("user_id", u.id);
        if (!u.user_metadata?.full_name) await admin.auth.admin.updateUserById(u.id, { user_metadata: { ...(u.user_metadata || {}), full_name: data.name } });
      }
      const madeNow = u.created_at && Date.now() - new Date(u.created_at).getTime() < 60_000;
      return { ok: true, signedIn: !!u.last_sign_in_at, again: !madeNow };
    } catch (e) {
      return { ok: false, why: why(e) };
    }
  });

/** before an invite goes out: the account for this email — made right here if there isn't one (this works even with
 *  sign-ups turned off, where a new person can't make their own), with the login type and a confirmed email, so the
 *  email that goes out next is the plain "set your password" one. Someone taken off the team before is back in.
 *  The admin only. */
export type Prepped = { ok: true; exists: boolean; signedIn: boolean; made?: boolean } | { ok: false; why: string }
export const prepInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { email: string; name: string; role: string; create?: boolean }) => {
    const email = String(d?.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("That email doesn’t look right");
    if (!ROLES.has(d.role)) throw new Error("Pick a login type");
    return { email, name: String(d.name || "").slice(0, 120), role: d.role, create: d?.create !== false };
  })
  .handler(async ({ data, context }): Promise<Prepped> => {
    if (!(await isAdmin(context))) return { ok: false, why: "Only the admin invites people" };
    const admin = supabaseAdmin as any;
    try {
      let u = await findUser(admin, data.email);
      let made = false;
      if (!u && data.create) {
        const { data: mk, error } = await admin.auth.admin.createUser({ email: data.email, email_confirm: true, user_metadata: data.name ? { full_name: data.name } : {} });
        if (error && !already(error)) return { ok: false, why: why(error) };
        u = mk?.user || (await findUser(admin, data.email));
        made = !!u;
      }
      if (!u) return { ok: true, exists: false, signedIn: false };
      if (!u.email_confirmed_at) await admin.auth.admin.updateUserById(u.id, { email_confirm: true });
      await admin.from("user_roles").upsert({ user_id: u.id, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
      /* someone taken off the team before: back in */
      await admin.from("profiles").update({ is_active: true, ...(data.name ? { full_name: data.name } : {}) }).eq("user_id", u.id);
      return { ok: true, exists: !made, signedIn: !!u.last_sign_in_at, made };
    } catch (e) {
      return { ok: false, why: why(e) };
    }
  });

/** someone taken off the team: their account is closed — signing in no longer works, and adding them back later
 *  sends them a fresh invite (not a password reset). Never your own login. The admin only. */
export type Removed = { ok: true; removed: boolean } | { ok: false; why: string }
export const removeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { email?: string; uid?: string }) => ({ email: String(d?.email || "").trim().toLowerCase(), uid: String(d?.uid || "").trim() }))
  .handler(async ({ data, context }): Promise<Removed> => {
    if (!(await isAdmin(context))) return { ok: false, why: "Only the admin takes people off the team" };
    const admin = supabaseAdmin as any;
    try {
      let id = /^[0-9a-f-]{36}$/i.test(data.uid) ? data.uid : "";
      if (!id && /^\S+@\S+\.\S+$/.test(data.email)) id = (await findUser(admin, data.email))?.id || "";
      if (!id) return { ok: true, removed: false };
      if (id === context.userId) return { ok: false, why: "That’s your own login — it stays" };
      const { error } = await admin.from("user_roles").delete().eq("user_id", id);
      if (error) return { ok: false, why: why(error) };
      await admin.from("profiles").delete().eq("user_id", id);
      const { error: delErr } = await admin.auth.admin.deleteUser(id);
      if (delErr) {
        /* the account couldn't be closed: at least it can't open anything */
        await admin.from("profiles").update({ is_active: false }).eq("user_id", id);
      }
      return { ok: true, removed: true };
    } catch (e) {
      return { ok: false, why: why(e) };
    }
  });
