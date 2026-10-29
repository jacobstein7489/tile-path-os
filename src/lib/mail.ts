/* Email from Tile OS — a purchase order to the supplier, an invoice note — through the server (Resend), from the
 * company's own addresses with the Cc set for that kind (Settings → Email). Only the team can send. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { send, mailConfigured, domains } from "./mail.server";

const team = async (context: any) => {
  const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  return (data || []).length > 0;
};

export type MailStatus = { configured: boolean; domains: { name: string; status: string }[] | null };
export const mailStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MailStatus> => {
    if (!(await team(context))) return { configured: false, domains: null };
    return { configured: mailConfigured(), domains: mailConfigured() ? await domains() : null };
  });

export type MailIn = { from: string; to: string[]; cc?: string[]; replyTo?: string[]; subject: string; html: string; text?: string };
export const sendTileMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: MailIn) => {
    if (!d || !Array.isArray(d.to) || !d.to.length) throw new Error("No one to send it to");
    if (!d.subject || !d.html) throw new Error("An empty email");
    if (d.html.length > 400_000) throw new Error("The email is too big");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ ok: true; id: string; from: string } | { ok: false; why: string }> => {
    if (!(await team(context))) return { ok: false, why: "Only the team can send email from Tile OS" };
    return send({ from: data.from, to: data.to, cc: data.cc, replyTo: data.replyTo, subject: data.subject, html: data.html, text: data.text });
  });
