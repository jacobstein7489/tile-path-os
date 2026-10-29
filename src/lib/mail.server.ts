/* Email that Tile OS sends — purchase orders to suppliers, invoices to clients, invites to the team — on the server
 * only, through Resend (resend.com), from the company's own addresses. The key comes from Lovable → More → Settings →
 * Secrets: RESEND_API_KEY. Replies go to whoever the email is from (or its Reply-To), never to Tile OS. */
const RESEND = "https://api.resend.com";

export const mailKey = () => (process.env["RESEND_API_KEY"] || "").trim();
export const mailConfigured = () => !!mailKey();

export type Attachment = { filename: string; content: string /* base64 */ };
export type Mail = { from: string; to: string[]; cc?: string[]; bcc?: string[]; replyTo?: string[]; subject: string; html: string; text?: string; attachments?: Attachment[]; /** false: no copy to the sender (an invite — its link is theirs alone) */ copy?: boolean };

const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;
const clean = (list?: string[]) => Array.from(new Set((list || []).map((x) => String(x || "").trim().toLowerCase()).filter((x) => EMAIL.test(x)))).slice(0, 20);
const domainOf = (addr: string) => (addr.match(/@([^>\s]+)>?\s*$/)?.[1] || "").toLowerCase();

/** the domains Resend sends for (a key with "Sending access" only can't see them — then it just tries) */
let memo: { at: number; list: { name: string; status: string }[] } | null = null;
export async function domains(): Promise<{ name: string; status: string }[] | null> {
  if (memo && Date.now() - memo.at < 5 * 60_000) return memo.list;
  try {
    const res = await fetch(`${RESEND}/domains`, { headers: { Authorization: `Bearer ${mailKey()}` } });
    if (!res.ok) return null;
    const j: any = await res.json().catch(() => ({}));
    const list = (j.data || []).map((d: any) => ({ name: String(d.name || "").toLowerCase(), status: String(d.status || "") }));
    memo = { at: Date.now(), list };
    return list;
  } catch {
    return null;
  }
}

export async function send(m: Mail): Promise<{ ok: true; id: string; from: string } | { ok: false; why: string }> {
  if (!mailConfigured()) return { ok: false, why: "nokey" };
  const to = clean(m.to);
  if (!to.length) return { ok: false, why: "No email address to send it to" };
  let from = m.from;
  let replyTo = clean(m.replyTo);
  /* an address on a domain Resend doesn't send for (someone's Gmail): it goes out from the company's verified domain,
     and replies still go to that person */
  const list = await domains();
  const ok = list?.filter((d) => d.status === "verified").map((d) => d.name) || null;
  if (ok && ok.length && !ok.some((d) => domainOf(from) === d || domainOf(from).endsWith("." + d))) {
    const name = from.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim() || "Cobblestone Tile";
    const bare = from.match(/<([^>]+)>/)?.[1] || from;
    if (EMAIL.test(bare) && !replyTo.includes(bare.toLowerCase())) replyTo = [bare.toLowerCase(), ...replyTo];
    from = `${name} <office@${ok[0]}>`;
  }
  const body: Record<string, unknown> = { from, to, subject: m.subject.slice(0, 250), html: m.html };
  const cc = clean(m.cc).filter((x) => !to.includes(x));
  /* sent from here, it isn't in that inbox's Sent folder — so the address it comes from (or the person it stands for)
     gets a copy, like QuickBooks' "send me a copy" */
  const own = m.copy === false ? "" : (replyTo[0] || from.match(/<([^>]+)>/)?.[1] || from).trim().toLowerCase();
  const bcc = clean([...(m.bcc || []), ...(EMAIL.test(own) ? [own] : [])]).filter((x) => !to.includes(x) && !cc.includes(x));
  if (cc.length) body.cc = cc;
  if (bcc.length) body.bcc = bcc;
  if (replyTo.length) body.reply_to = replyTo;
  if (m.text) body.text = m.text;
  if (m.attachments?.length) body.attachments = m.attachments.slice(0, 5);
  try {
    const res = await fetch(`${RESEND}/emails`, { method: "POST", headers: { Authorization: `Bearer ${mailKey()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(j.message || j.error || `Resend said ${res.status}`);
      return { ok: false, why: /domain/i.test(msg) && /verif/i.test(msg) ? `${domainOf(from) || "The domain"} isn’t verified in Resend yet — finish the DNS step there` : msg };
    }
    return { ok: true, id: String(j.id || ""), from };
  } catch (e: any) {
    return { ok: false, why: String(e?.message || e).slice(0, 200) };
  }
}

/** a plain, safe piece of text for an email */
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
