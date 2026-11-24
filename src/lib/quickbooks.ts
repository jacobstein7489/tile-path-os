/* QuickBooks Online for Tile OS: Tile OS makes and changes the invoices and records the payments; QuickBooks gets
 * each one, and keeps the books. Payments made in QuickBooks (a client paying the invoice online) come back.
 * The admin connects it once (Settings → Connections → QuickBooks). Only the team can use it; only the admin can
 * connect or disconnect. */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { qbConfigured, qbEnv, readConn, writeConn, dropConn, newState, authorizeUrl, revoke, api, query, quote, toBase64, QbError } from "./quickbooks.server";
import { send as sendMail, mailConfigured } from "./mail.server";

const roles = async (context: any): Promise<string[]> => {
  const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  return (data || []).map((r: { role: string }) => r.role);
};
const plain = (e: any) => (e instanceof QbError ? { why: e.why, detail: e.message } : { why: "error", detail: String(e?.message || e).slice(0, 300) });

export type QbStatus = { configured: boolean; connected: boolean; company?: string; env: "sandbox" | "production"; since?: string; mail: boolean; problem?: string };
/** is it set up, is it connected, to which company — and is email set up */
export const qbStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QbStatus> => {
    const base = { configured: qbConfigured(), connected: false, env: qbEnv(), mail: mailConfigured() };
    if (!(await roles(context)).length) return base;
    try {
      const c = await readConn();
      return { ...base, connected: !!c?.refresh_token, company: c?.company || undefined, since: c?.connected_at || undefined };
    } catch (e: any) {
      return { ...base, problem: e instanceof QbError ? e.why : "error" };
    }
  });

/** the admin connects: a one-time word is kept, and he goes to Intuit to say yes */
export const qbConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; url: string } | { ok: false; why: string; detail?: string }> => {
    if (!(await roles(context)).includes("admin")) return { ok: false, why: "denied" };
    if (!qbConfigured()) return { ok: false, why: "nokeys" };
    try {
      const origin = new URL(getRequest().url).origin;
      const state = newState();
      await writeConn({ state, state_expires: new Date(Date.now() + 15 * 60_000).toISOString(), origin, connected_by: context.userId });
      return { ok: true, url: authorizeUrl(origin, state) };
    } catch (e) {
      return { ok: false, ...plain(e) };
    }
  });

export const qbDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; why?: string }> => {
    if (!(await roles(context)).includes("admin")) return { ok: false, why: "denied" };
    await revoke();
    await dropConn().catch(() => null);
    return { ok: true };
  });

/** QuickBooks' products and services — which one each kind of bill goes to */
export const qbItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; items: { id: string; name: string; type: string }[] } | { ok: false; why: string; detail?: string }> => {
    if (!(await roles(context)).length) return { ok: false, why: "denied" };
    try {
      const r = await query("SELECT * FROM Item WHERE Active = true MAXRESULTS 1000");
      const items = (r.Item || []).filter((i: any) => ["Service", "NonInventory", "Inventory"].includes(i.Type)).map((i: any) => ({ id: String(i.Id), name: String(i.FullyQualifiedName || i.Name), type: String(i.Type) }));
      return { ok: true, items };
    } catch (e) {
      return { ok: false, ...plain(e) };
    }
  });

/* ---------------- invoices ---------------- */
export type InvoiceIn = {
  /** already in QuickBooks: its id and SyncToken — it's changed, not made twice */
  qbId?: string;
  sync?: string;
  customer: { name: string; email?: string; address?: string; qbId?: string };
  lines: { amount: number; description: string; itemId?: string; itemName?: string }[];
  txnDate?: string;
  dueDate?: string;
  /** what the client sees on it, and our own note on it (QuickBooks keeps both) */
  memo?: string;
  note?: string;
  /** Tile OS's number — used when the company numbers its own invoices in QuickBooks */
  docNumber?: string;
  /** a bill invoiced before QuickBooks was connected: look for it there by its number first (same client or same
   *  amount) and link to it rather than make it twice */
  findFirst?: boolean;
};
export type InvoiceOut = { ok: true; id: string; sync: string; doc?: string; total: number; balance: number; customerId: string; link?: string; /** it was in QuickBooks already (accounting made it there) — linked, not made again */ linked?: boolean } | { ok: false; why: string; detail?: string };

let customNumbers: boolean | null = null;
async function usesCustomNumbers() {
  if (customNumbers !== null) return customNumbers;
  try {
    const p = await api("GET", "/preferences");
    customNumbers = !!p?.Preferences?.SalesFormsPrefs?.CustomTxnNumbers;
  } catch {
    customNumbers = false;
  }
  return customNumbers;
}
/** a company's name without the parts that differ between two lists: "The Park Ave. Partners, LLC" → "parkavepartners" */
const bare = (n: string) => n.toLowerCase().replace(/&/g, "and").replace(/\b(the|llc|l\.l\.c|inc|incorporated|corp|corporation|co|company|ltd|limited|group)\b\.?/g, "").replace(/[^a-z0-9]/g, "");
async function customerFor(c: InvoiceIn["customer"]): Promise<string> {
  if (c.qbId) return c.qbId;
  const name = c.name.trim().slice(0, 100) || "Client";
  const found = await query(`SELECT * FROM Customer WHERE DisplayName = ${quote(name)}`);
  if (found.Customer?.[0]?.Id) return String(found.Customer[0].Id);
  /* the same client under a slightly different name in QuickBooks ("Park Ave Partners LLC"): use that one rather than
     make a second customer */
  const first = name.split(/\s+/).find((w) => w.replace(/[^a-z0-9]/gi, "").length > 1)?.replace(/[%']/g, "");
  if (first && bare(name)) {
    const near = await query(`SELECT * FROM Customer WHERE DisplayName LIKE ${quote(first + "%")} MAXRESULTS 100`);
    const same = (near.Customer || []).filter((x: any) => bare(String(x.DisplayName || "")) === bare(name) || bare(String(x.CompanyName || "")) === bare(name));
    if (same.length === 1) return String(same[0].Id);
  }
  const made = await api("POST", "/customer", {
    DisplayName: name,
    CompanyName: name,
    ...(c.email ? { PrimaryEmailAddr: { Address: c.email } } : {}),
    ...(c.address ? { BillAddr: { Line1: c.address.slice(0, 500) } } : {}),
  });
  return String(made.Customer.Id);
}
const itemMemo = new Map<string, string>();
async function itemFor(l: InvoiceIn["lines"][number]): Promise<string> {
  if (l.itemId) return l.itemId;
  const key = (l.itemName || "").trim();
  if (key && itemMemo.has(key)) return itemMemo.get(key)!;
  if (key) {
    const leaf = key.split(":").pop()!;
    const r = await query(`SELECT * FROM Item WHERE Name = ${quote(leaf)}`);
    const hit = (r.Item || []).find((i: any) => i.FullyQualifiedName === key) || r.Item?.[0];
    if (hit?.Id) { itemMemo.set(key, String(hit.Id)); return String(hit.Id); }
  }
  /* nothing picked and nothing by that name: QuickBooks' own "Services" item, or the first service there is */
  if (itemMemo.has("*")) return itemMemo.get("*")!;
  const r = await query("SELECT * FROM Item WHERE Type = 'Service' AND Active = true MAXRESULTS 50");
  const any = (r.Item || []).find((i: any) => /^services?$/i.test(i.Name)) || r.Item?.[0];
  if (!any?.Id) throw new QbError("noitem", "QuickBooks has no service item to put the bill on. Add one (Sales → Products and services)");
  itemMemo.set("*", String(any.Id));
  return String(any.Id);
}
async function linkOf(id: string) {
  try {
    const j = await api("GET", `/invoice/${encodeURIComponent(id)}`, undefined, { query: { include: "invoiceLink" } });
    return (j?.Invoice?.InvoiceLink as string) || undefined;
  } catch {
    return undefined;
  }
}

/** make the invoice in QuickBooks — or change the one that's there — from what Tile OS has */
export const qbPushInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: InvoiceIn) => {
    if (!d || !d.customer?.name || !Array.isArray(d.lines) || !d.lines.length) throw new Error("Nothing to invoice");
    if (d.lines.some((l) => typeof l.amount !== "number" || !isFinite(l.amount))) throw new Error("A line has no amount");
    return d;
  })
  .handler(async ({ data, context }): Promise<InvoiceOut> => {
    if (!(await roles(context)).length) return { ok: false, why: "denied" };
    try {
      if (!data.qbId && data.findFirst && data.docNumber) {
        const doc = data.docNumber.replace(/^#/, "").slice(0, 21);
        const total = data.lines.reduce((n, l) => n + l.amount, 0);
        const r = await query(`SELECT * FROM Invoice WHERE DocNumber = ${quote(doc)} MAXRESULTS 20`);
        const hit = (r.Invoice || []).find((inv: any) => bare(String(inv.CustomerRef?.name || "")) === bare(data.customer.name) || Math.abs(Number(inv.TotalAmt || 0) - total) < 1);
        if (hit) return { ok: true, linked: true, id: String(hit.Id), sync: String(hit.SyncToken), doc: hit.DocNumber || undefined, total: Number(hit.TotalAmt || 0), balance: Number(hit.Balance || 0), customerId: String(hit.CustomerRef?.value || ""), link: await linkOf(String(hit.Id)) };
      }
      const customerId = await customerFor(data.customer);
      const Line: Record<string, unknown>[] = [];
      for (const l of data.lines) {
        const amt = Math.round(l.amount * 100) / 100;
        Line.push({ Amount: amt, DetailType: "SalesItemLineDetail", Description: l.description.slice(0, 4000), SalesItemLineDetail: { ItemRef: { value: await itemFor(l) }, Qty: 1, UnitPrice: amt } });
      }
      const body: Record<string, unknown> = {
        CustomerRef: { value: customerId },
        Line,
        ...(data.txnDate ? { TxnDate: data.txnDate } : {}),
        ...(data.dueDate ? { DueDate: data.dueDate } : {}),
        ...(data.memo ? { CustomerMemo: { value: data.memo.slice(0, 1000) } } : {}),
        ...(data.note ? { PrivateNote: data.note.slice(0, 4000) } : {}),
        ...(data.customer.email ? { BillEmail: { Address: data.customer.email } } : {}),
        AllowOnlineCreditCardPayment: true,
        AllowOnlineACHPayment: true,
      };
      if (!data.qbId && data.docNumber && (await usesCustomNumbers())) body.DocNumber = data.docNumber.replace(/^#/, "").slice(0, 21);
      let inv: any;
      if (data.qbId) {
        const upd = async (sync: string) => (await api("POST", "/invoice", { ...body, Id: data.qbId, SyncToken: sync, sparse: true })).Invoice;
        try {
          inv = await upd(data.sync || "0");
        } catch (e) {
          if (!(e instanceof QbError) || e.why !== "stale") throw e;
          /* someone changed it in QuickBooks in the meantime: take its newest version and change that */
          const cur = await api("GET", `/invoice/${encodeURIComponent(data.qbId)}`);
          inv = await upd(String(cur.Invoice.SyncToken));
        }
      } else {
        inv = (await api("POST", "/invoice", body)).Invoice;
      }
      return { ok: true, id: String(inv.Id), sync: String(inv.SyncToken), doc: inv.DocNumber || undefined, total: Number(inv.TotalAmt || 0), balance: Number(inv.Balance || 0), customerId, link: await linkOf(String(inv.Id)) };
    } catch (e) {
      return { ok: false, ...plain(e) };
    }
  });

/** email the invoice (or the estimate) to the client: from Tile OS (the address and Cc in Settings → Email), with
 *  QuickBooks' own PDF — and, on an invoice, its Pay button. Without email set up, QuickBooks sends it itself. */
export const qbSendInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; to: string; cc?: string[]; from?: string; replyTo?: string[]; subject?: string; html?: string; file?: string; kind?: "invoice" | "estimate" }) => {
    if (!d?.id || !/^\S+@\S+\.\S+$/.test(String(d.to || "").trim())) throw new Error("No email address for the client");
    return { ...d, kind: d.kind === "estimate" ? ("estimate" as const) : ("invoice" as const) };
  })
  .handler(async ({ data, context }): Promise<{ ok: true; via: "tileos" | "quickbooks" } | { ok: false; why: string; detail?: string }> => {
    if (!(await roles(context)).length) return { ok: false, why: "denied" };
    try {
      if (mailConfigured() && data.from && data.html) {
        const pdf = await api("GET", `/${data.kind}/${encodeURIComponent(data.id)}/pdf`, undefined, { pdf: true });
        const r = await sendMail({ from: data.from, to: [data.to], cc: data.cc, replyTo: data.replyTo, subject: data.subject || (data.kind === "estimate" ? "Estimate" : "Invoice"), html: data.html, attachments: [{ filename: data.file || `${data.kind}.pdf`, content: toBase64(pdf) }] });
        if (r.ok) return { ok: true, via: "tileos" };
        if (r.why !== "nokey") return { ok: false, why: "mail", detail: r.why };
      }
      await api("POST", `/${data.kind}/${encodeURIComponent(data.id)}/send`, "", { query: { sendTo: data.to.trim() }, contentType: "application/octet-stream" });
      return { ok: true, via: "quickbooks" };
    } catch (e) {
      return { ok: false, ...plain(e) };
    }
  });

/* ---------------- estimates ---------------- */
export type EstimateIn = Omit<InvoiceIn, "findFirst" | "dueDate"> & { /** how long the price holds */ expires?: string; /** the client said yes */ accepted?: boolean };
export type EstimateOut = { ok: true; id: string; sync: string; doc?: string; total: number; customerId: string } | { ok: false; why: string; detail?: string };
/** the estimate in QuickBooks — made the first time it goes to the client, changed with each revision */
export const qbPushEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: EstimateIn) => {
    if (!d || !d.customer?.name || !Array.isArray(d.lines) || !d.lines.length) throw new Error("Nothing on the estimate");
    if (d.lines.some((l) => typeof l.amount !== "number" || !isFinite(l.amount))) throw new Error("A line has no amount");
    return d;
  })
  .handler(async ({ data, context }): Promise<EstimateOut> => {
    if (!(await roles(context)).length) return { ok: false, why: "denied" };
    try {
      const customerId = await customerFor(data.customer);
      const Line: Record<string, unknown>[] = [];
      for (const l of data.lines) {
        const amt = Math.round(l.amount * 100) / 100;
        Line.push({ Amount: amt, DetailType: "SalesItemLineDetail", Description: l.description.slice(0, 4000), SalesItemLineDetail: { ItemRef: { value: await itemFor(l) }, Qty: 1, UnitPrice: amt } });
      }
      const body: Record<string, unknown> = {
        CustomerRef: { value: customerId },
        Line,
        ...(data.txnDate ? { TxnDate: data.txnDate } : {}),
        ...(data.expires ? { ExpirationDate: data.expires } : {}),
        ...(data.memo ? { CustomerMemo: { value: data.memo.slice(0, 1000) } } : {}),
        ...(data.note ? { PrivateNote: data.note.slice(0, 4000) } : {}),
        ...(data.customer.email ? { BillEmail: { Address: data.customer.email } } : {}),
        ...(data.accepted ? { TxnStatus: "Accepted" } : {}),
      };
      if (!data.qbId && data.docNumber && (await usesCustomNumbers())) body.DocNumber = data.docNumber.replace(/^#/, "").slice(0, 21);
      let est: any;
      if (data.qbId) {
        const upd = async (sync: string) => (await api("POST", "/estimate", { ...body, Id: data.qbId, SyncToken: sync, sparse: true })).Estimate;
        try {
          est = await upd(data.sync || "0");
        } catch (e) {
          if (!(e instanceof QbError) || e.why !== "stale") throw e;
          const cur = await api("GET", `/estimate/${encodeURIComponent(data.qbId)}`);
          est = await upd(String(cur.Estimate.SyncToken));
        }
      } else {
        est = (await api("POST", "/estimate", body)).Estimate;
      }
      return { ok: true, id: String(est.Id), sync: String(est.SyncToken), doc: est.DocNumber || undefined, total: Number(est.TotalAmt || 0), customerId };
    } catch (e) {
      return { ok: false, ...plain(e) };
    }
  });

/** a payment recorded in Tile OS goes on the invoice in QuickBooks */
export const qbPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { invoiceId: string; customerId: string; amount: number; date?: string; ref?: string; note?: string }) => {
    if (!d?.invoiceId || !d.customerId || !(d.amount > 0)) throw new Error("Nothing to record");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ ok: true; id: string } | { ok: false; why: string; detail?: string }> => {
    if (!(await roles(context)).length) return { ok: false, why: "denied" };
    try {
      const amt = Math.round(data.amount * 100) / 100;
      const p = await api("POST", "/payment", {
        CustomerRef: { value: data.customerId },
        TotalAmt: amt,
        ...(data.date ? { TxnDate: data.date } : {}),
        ...(data.ref ? { PaymentRefNum: data.ref.slice(0, 21) } : {}),
        ...(data.note ? { PrivateNote: data.note.slice(0, 4000) } : {}),
        Line: [{ Amount: amt, LinkedTxn: [{ TxnId: data.invoiceId, TxnType: "Invoice" }] }],
      });
      return { ok: true, id: String(p.Payment.Id) };
    } catch (e) {
      return { ok: false, ...plain(e) };
    }
  });

/* ---------------- what we paid each installer: his bills and checks ---------------- */
export type QbPaidLine = { desc: string; item?: string; account?: string; qty?: number; rate?: number; amount: number; customer?: string; customerId?: string };
/** what we billed a customer (an invoice): to compare with what we paid the installer for the same customer */
export type QbBilled = { customerId: string; customer: string; date: string; total: number };
export type QbPaid = { id: string; kind: "Bill" | "Purchase"; vendorId: string; vendor: string; date: string; total: number; memo?: string; lines: QbPaidLine[] };
/** every bill and check to a vendor since a day (a year back, unless asked): its lines as they are in QuickBooks — what
 *  it was for, how many, at what price, for which customer — and the invoices to customers since then (what each
 *  customer was charged). Read only: nothing in QuickBooks changes */
export const qbVendorBills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { since?: string }) => ({ since: /^\d{4}-\d{2}-\d{2}$/.test(String(d?.since || "")) ? String(d.since) : "" }))
  .handler(async ({ data, context }): Promise<{ ok: true; since: string; vendors: { id: string; name: string }[]; bills: QbPaid[]; invoices: QbBilled[] } | { ok: false; why: string; detail?: string }> => {
    if (!(await roles(context)).length) return { ok: false, why: "denied" };
    const since = data.since || new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    /* QuickBooks hands back 1000 at a time */
    const all = async (entity: string, where = ""): Promise<any[]> => {
      const out: any[] = [];
      for (let at = 1; at < 20000; at += 1000) {
        const r = await query(`SELECT * FROM ${entity}${where ? " WHERE " + where : ""} STARTPOSITION ${at} MAXRESULTS 1000`);
        const got: any[] = r[entity] || [];
        out.push(...got);
        if (got.length < 1000) break;
      }
      return out;
    };
    const lineOf = (l: any): QbPaidLine => {
      const d = l.ItemBasedExpenseLineDetail || l.AccountBasedExpenseLineDetail || {};
      return {
        desc: String(l.Description || "").slice(0, 300),
        ...(d.ItemRef?.name ? { item: String(d.ItemRef.name) } : {}),
        ...(d.AccountRef?.name ? { account: String(d.AccountRef.name) } : {}),
        ...(Number(d.Qty) ? { qty: Number(d.Qty) } : {}),
        ...(Number(d.UnitPrice) ? { rate: Number(d.UnitPrice) } : {}),
        amount: Number(l.Amount || 0),
        ...(d.CustomerRef?.name ? { customer: String(d.CustomerRef.name) } : {}),
        ...(d.CustomerRef?.value ? { customerId: String(d.CustomerRef.value) } : {}),
      };
    };
    const expense = (l: any) => l?.DetailType === "ItemBasedExpenseLineDetail" || l?.DetailType === "AccountBasedExpenseLineDetail";
    try {
      const day = quote(since);
      const [vendors, bills, checks, invoices] = await Promise.all([all("Vendor"), all("Bill", `TxnDate >= ${day}`), all("Purchase", `TxnDate >= ${day}`), all("Invoice", `TxnDate >= ${day}`)]);
      const out: QbPaid[] = [
        ...bills.map((b: any): QbPaid => ({ id: "b" + b.Id, kind: "Bill", vendorId: String(b.VendorRef?.value || ""), vendor: String(b.VendorRef?.name || ""), date: String(b.TxnDate || ""), total: Number(b.TotalAmt || 0), ...(b.PrivateNote ? { memo: String(b.PrivateNote).slice(0, 300) } : {}), lines: (b.Line || []).filter(expense).map(lineOf) })),
        /* checks, cash and card payments to a vendor (not to an employee or a customer) */
        ...checks.filter((p: any) => p.EntityRef?.value && (!p.EntityRef.type || p.EntityRef.type === "Vendor")).map((p: any): QbPaid => ({ id: "p" + p.Id, kind: "Purchase", vendorId: String(p.EntityRef.value), vendor: String(p.EntityRef.name || ""), date: String(p.TxnDate || ""), total: Number(p.TotalAmt || 0), ...(p.PrivateNote ? { memo: String(p.PrivateNote).slice(0, 300) } : {}), lines: (p.Line || []).filter(expense).map(lineOf) })),
      ].filter((x) => x.vendorId);
      const billed: QbBilled[] = invoices.filter((i: any) => i.CustomerRef?.value).map((i: any) => ({ customerId: String(i.CustomerRef.value), customer: String(i.CustomerRef.name || ""), date: String(i.TxnDate || ""), total: Number(i.TotalAmt || 0) }));
      return { ok: true, since, vendors: vendors.map((v: any) => ({ id: String(v.Id), name: String(v.DisplayName || v.CompanyName || [v.GivenName, v.FamilyName].filter(Boolean).join(" ") || "") })), bills: out, invoices: billed };
    } catch (e) {
      return { ok: false, ...plain(e) };
    }
  });

/** where invoices stand in QuickBooks — what's still open on each — so a payment made there shows here */
export const qbPull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { ids: string[] }) => ({ ids: Array.from(new Set((Array.isArray(d?.ids) ? d.ids : []).map((x) => String(x).replace(/[^0-9]/g, "")).filter(Boolean))).slice(0, 200) }))
  .handler(async ({ data, context }): Promise<{ ok: true; invoices: { id: string; balance: number; total: number; doc?: string; sync: string }[] } | { ok: false; why: string; detail?: string }> => {
    if (!(await roles(context)).length) return { ok: false, why: "denied" };
    if (!data.ids.length) return { ok: true, invoices: [] };
    try {
      const out: { id: string; balance: number; total: number; doc?: string; sync: string }[] = [];
      for (let i = 0; i < data.ids.length; i += 50) {
        const part = data.ids.slice(i, i + 50);
        const r = await query(`SELECT * FROM Invoice WHERE Id IN (${part.map((x) => quote(x)).join(", ")}) MAXRESULTS 1000`);
        for (const inv of r.Invoice || []) out.push({ id: String(inv.Id), balance: Number(inv.Balance || 0), total: Number(inv.TotalAmt || 0), doc: inv.DocNumber || undefined, sync: String(inv.SyncToken) });
      }
      return { ok: true, invoices: out };
    } catch (e) {
      return { ok: false, ...plain(e) };
    }
  });
