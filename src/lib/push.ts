/* Phone notifications for Tile OS: a device turns them on (its push address is kept, with whose it is), turns them
 * off, or sends itself a test. Only someone the admin let in can turn them on, and only for their own device. The
 * sending is lib/remind.server (every minute, what's due). */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roles = async (context: any): Promise<string[]> => {
  const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  return (data || []).map((r: { role: string }) => r.role);
};
const why = (e: any) => { const m = String(e?.message || e || ""); return /does not exist|relation|schema cache/i.test(m) ? "notable" : "error"; };

/** our public push key — what a browser needs to turn notifications on */
export const pushKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; key: string } | { ok: false; why: string }> => {
    if (!(await roles(context)).length) return { ok: false, why: "denied" };
    try {
      const { vapidKeys } = await import("./remind.server");
      return { ok: true, key: (await vapidKeys()).publicKey };
    } catch (e) {
      return { ok: false, why: why(e) };
    }
  });

/** this device, on: its push address and keys, whose it is (the person on Tile OS) and its time zone */
export const pushSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { endpoint: string; p256dh: string; auth: string; person: string; tz?: string }) => {
    if (!/^https:\/\//.test(String(d?.endpoint || "")) || !d.p256dh || !d.auth || !/^[\w-]{1,40}$/.test(String(d.person || ""))) throw new Error("Not a device");
    return { endpoint: String(d.endpoint).slice(0, 1000), p256dh: String(d.p256dh).slice(0, 200), auth: String(d.auth).slice(0, 100), person: String(d.person), tz: String(d.tz || "").slice(0, 60) || null };
  })
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; why: string }> => {
    if (!(await roles(context)).length) return { ok: false, why: "denied" };
    const { error } = await (context.supabase as any).from("tileos_push").upsert({ ...data, user_id: context.userId }, { onConflict: "endpoint" });
    return error ? { ok: false, why: why(error) } : { ok: true };
  });

/** this device, off */
export const pushDrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { endpoint: string }) => ({ endpoint: String(d?.endpoint || "").slice(0, 1000) }))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    await (context.supabase as any).from("tileos_push").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

/** a test to this person's devices: "Notifications are on" — and whether the every-minute check is running (without
 *  it, nothing comes with the app closed) */
export const pushTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; sent: number; ticking: boolean } | { ok: false; why: string }> => {
    if (!(await roles(context)).length) return { ok: false, why: "denied" };
    try {
      const { sendTo, lastTick } = await import("./remind.server");
      const { data, error } = await (context.supabase as any).from("tileos_push").select("endpoint, p256dh, auth, user_id, person, tz").eq("user_id", context.userId);
      if (error) return { ok: false, why: why(error) };
      const sent = await sendTo(data || [], { title: "Notifications are on", body: "Things due for you will show here, even with the app closed.", tag: "test:" + Date.now() });
      const tick = await lastTick().catch(() => null);
      return { ok: true, sent, ticking: !!tick && Date.now() - Date.parse(tick) < 5 * 60e3 };
    } catch (e) {
      return { ok: false, why: why(e) };
    }
  });
