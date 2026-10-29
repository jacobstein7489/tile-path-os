/* QuickBooks, from Tile OS's side. Tile OS makes the invoices, changes them and records the payments; each one goes
 * to QuickBooks by itself, and QuickBooks keeps the books. A payment made in QuickBooks — the client paying online,
 * accounting entering a check there — comes back here every few minutes and closes the bill. The invoice email goes out
 * from Tile OS (the address and Cc in Settings → Email) with QuickBooks' own PDF and its Pay button; without email set
 * up, QuickBooks sends it itself. Nothing goes to QuickBooks from the preview or the sample projects. */
import * as React from 'react'
import { useStore, meOf, newTask, closeTasks, type Store } from '@/tileos/store'
import { REAL } from '@/tileos/lib/save'
import { showPop } from '@/tileos/lib/pop'
import { NOW } from '@/tileos/lib/today'
import { fmtMoney, PEOPLE, type Customer, type PersonKey } from '@/tileos/data/model'
import type { MoneyItem } from '@/tileos/data/work'
import { curRev, type Estimate, type EstRev } from '@/tileos/data/estimates'
import type { InvoiceIn, EstimateIn } from '@/lib/quickbooks'
import { applyPayment } from './flows'

/* ---------------- where it stands ---------------- */
export type QbView = { known: boolean; configured: boolean; connected: boolean; company?: string; env?: 'sandbox' | 'production'; since?: string; mail: boolean; problem?: string; pulled?: number }
let view: QbView = { known: false, configured: false, connected: false, mail: false }
const subs = new Set<() => void>()
function setView(p: Partial<QbView>) { view = { ...view, ...p }; subs.forEach((f) => f()) }
export function useQb(): QbView {
  return React.useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => view, () => view)
}
/** QuickBooks is connected, and this is the company's own data */
export const qbLive = () => !!REAL.qb && REAL.cloud && view.connected

const WORDS: Record<string, string> = {
  notconnected: 'QuickBooks isn’t connected — Settings → Connections',
  reconnect: 'QuickBooks has to be connected again — Settings → Connections',
  auth: 'QuickBooks didn’t accept the app’s keys — check them in Lovable (Settings → Secrets)',
  denied: 'Only the team can do this',
  notable: 'One step is left in Lovable: type “Apply pending Supabase migrations” in its chat',
  noitem: 'QuickBooks has no service to put the bill on — add one there (Sales → Products and services)',
  nokeys: 'The QuickBooks keys aren’t in Lovable yet',
  offline: 'Couldn’t reach the server — check the internet and try again',
}
/** a plain reason from a QuickBooks answer */
export const qbWords = (r: { why: string; detail?: string }) => (['api', 'error', 'mail', 'db'].includes(r.why) ? r.detail || 'QuickBooks said no' : WORDS[r.why] || r.detail || 'Couldn’t reach QuickBooks')

export async function refreshQb(): Promise<QbView> {
  if (!REAL.qb) return view
  try {
    const st = await REAL.qb.status()
    setView({ known: true, problem: undefined, company: undefined, since: undefined, ...st })
  } catch {
    setView({ known: true, problem: 'offline' })
  }
  return view
}

/* ---------------- quiet changes ---------------- */
/* What QuickBooks already has isn't something Undo can take back — these change the bill without an Undo step */
function quiet(id: string, f: (m: MoneyItem, s: Store) => void) {
  useStore.setState((s: any) => { const m = s.money.find((x: MoneyItem) => x.id === id); if (m) f(m, s) })
}
const r2 = (n: number) => Math.round(n * 100) / 100
const byMe = (): PersonKey => meOf(useStore.getState().role)
const L = (who: PersonKey, text: string) => ({ date: NOW, who, text })

/* ---------------- who it's billed to ---------------- */
const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/
/** the client's billing people: accounts payable (or the first person with an email), any email marked billing, else
 *  the client's own email */
export function billTo(s: Pick<Store, 'jobs' | 'clients'>, jobId: string): { client?: Customer; clientId?: string; name: string; first?: string; emails: string[] } {
  const j = s.jobs[jobId]
  const c = j ? s.clients[j.clientId] : undefined
  const ap = c?.contacts.find((x) => /accounts? payable|billing|accounting|\bap\b/i.test(x.role) && EMAIL.test(x.email || '')) || c?.contacts.find((x) => EMAIL.test(x.email || ''))
  const billing = [...(c?.more || []), ...(c?.contacts || []).flatMap((x) => x.more || [])].filter((r) => r.kind === 'email' && /bill|invoice|payable|accounting/i.test(r.label || '')).map((r) => r.value)
  const emails = Array.from(new Set([ap?.email, ...billing, ap ? '' : c?.email].map((x) => (x || '').trim().toLowerCase()).filter((x) => EMAIL.test(x))))
  return { client: c, clientId: j?.clientId, name: c?.name || j?.client || 'Client', first: ap?.name?.split(' ')[0], emails }
}

/** a bill goes to QuickBooks once it's invoiced: a deposit or final bill when it's sent, a progress bill once the PM
 *  approved it, retainage when its release is asked for. Change orders bill on the next progress bill. */
export const invoicedYet = (m: MoneyItem) => !!m.amount && m.kind !== 'custpo' && m.kind !== 'change' && (m.state === 'paid' || (m.kind === 'progress' ? m.step >= 2 : m.step >= 1))

/** the invoice as QuickBooks gets it — a progress bill with its lines (the work, each change order), the rest one line */
function invoiceOf(s: Store, m: MoneyItem, findFirst: boolean): InvoiceIn {
  const j = s.jobs[m.jobId]
  const to = billTo(s, m.jobId)
  const item = (s.rules.qbItems || {})[m.kind as 'deposit']
  const one = (amount: number, description: string, kind = m.kind) => {
    const it = (s.rules.qbItems || {})[kind as 'deposit'] || item
    return { amount: r2(amount), description, ...(it ? { itemId: it.id } : {}) }
  }
  let lines = [one(m.amount || 0, `${j?.name || 'Project'} — ${m.title}`)]
  const b = m.bill
  if (b) {
    const parts = [one(b.progress, `${j?.name || 'Project'} — work installed through ${b.through} (${b.pct}% of ${fmtMoney(b.contract)}, less retainage and billed before)`), ...b.cos.map((c) => one(c.amount, `${j?.name || 'Project'} — ${c.title}`, 'change'))]
    if (Math.abs(parts.reduce((n, l) => n + l.amount, 0) - (m.amount || 0)) < 0.01) lines = parts.filter((l) => l.amount !== 0)
  }
  const qb = m.qb?.id && !m.qb.gone ? m.qb : undefined
  return {
    qbId: qb?.id,
    sync: qb?.sync,
    customer: { name: to.name, email: to.emails[0], address: to.client?.address || undefined, qbId: qb?.customerId || to.client?.qbId },
    lines,
    memo: [j?.name, j?.clientPO ? `Your PO ${j.clientPO}` : ''].filter(Boolean).join(' · ') || undefined,
    note: `From Tile OS · ${m.title}`,
    docNumber: m.ref || undefined,
    findFirst: findFirst && !qb,
  }
}

/* ---------------- putting a bill in QuickBooks ---------------- */
const busy = new Set<string>()
/** make the bill's invoice in QuickBooks, or change the one there to match Tile OS. `email`: then email it to the
 *  client. Says what happened unless it's asked to be quiet. */
export async function pushBill(id: string, o: { email?: boolean; quietOk?: boolean; findFirst?: boolean } = {}): Promise<boolean> {
  if (!REAL.qb || !REAL.cloud) return false
  if (!view.known || !view.connected) await refreshQb()
  if (!view.connected) return false
  const s = useStore.getState()
  const m = s.money.find((x) => x.id === id)
  if (!m || !m.amount || busy.has(id)) return false
  busy.add(id)
  try {
    const fresh = !m.qb?.id || !!m.qb.gone
    const r = await REAL.qb.push(invoiceOf(s, m, !!o.findFirst))
    if (!r.ok) {
      quiet(id, (x) => { x.qb = { ...(x.qb || {}), error: qbWords(r) }; x.log.push(L('system', `Not in QuickBooks yet — ${qbWords(r)}`)) })
      if (r.why === 'reconnect' || r.why === 'notconnected') void refreshQb()
      showPop({ title: 'Not in QuickBooks yet', sub: `${qbWords(r)}. It’s saved here — try again from the bill.`, tone: 'warn' })
      return false
    }
    const doc = r.doc ? '#' + r.doc.replace(/^#/, '') : undefined
    const before = r2(useStore.getState().money.find((x) => x.id === id)?.paid || 0)
    quiet(id, (x, st) => {
      const was = x.qb || {}
      x.qb = {
        ...was, id: r.id, sync: r.sync, doc: r.doc, customerId: r.customerId, link: r.link || was.link, total: r.total, balance: r.balance,
        at: new Date().toISOString(), error: undefined, gone: undefined,
        /* the payments recorded here: on a bill that was already in QuickBooks (accounting made it there) they're
           counted as there; on a new invoice they go to QuickBooks right after this */
        ...(fresh ? { sent: 0, fromQb: 0, before: r.linked ? before : 0, linked: r.linked || undefined } : {}),
      }
      if (doc) x.ref = doc
      const c = st.clients[st.jobs[x.jobId]?.clientId || '']
      if (c && r.customerId && c.qbId !== r.customerId) c.qbId = r.customerId
      x.log.push(L('system', r.linked ? `Linked to invoice ${doc || ''} already in QuickBooks` : fresh ? `In QuickBooks as invoice ${doc || ''}` : `Updated in QuickBooks${doc ? ` · ${doc}` : ''}`))
    })
    /* a new invoice for a bill that has payments recorded on it already: they go on it there too */
    if (fresh && !r.linked && before > 0) await pushPayment(id, before, 'Recorded in Tile OS before it was in QuickBooks', { quietOk: true })
    if (o.email) return await emailBill(id, { first: true })
    if (!o.quietOk) showPop({ title: r.linked ? `Linked to ${doc || 'the invoice'} in QuickBooks` : fresh ? `In QuickBooks as ${doc || 'a new invoice'}` : 'QuickBooks is updated', sub: r.linked ? 'It was there already — nothing was made twice.' : undefined })
    return true
  } catch (e: any) {
    quiet(id, (x) => { x.qb = { ...(x.qb || {}), error: WORDS.offline } })
    showPop({ title: 'Not in QuickBooks yet', sub: WORDS.offline, tone: 'warn' })
    return false
  } finally {
    busy.delete(id)
  }
}

/* ---------------- the invoice email ---------------- */
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
function invoiceHtml(o: { hello: string; doc: string; job: string; title: string; open: number; link?: string; reminder?: boolean; by: string }) {
  const pay = o.link ? `<p style="margin:22px 0"><a href="${esc(o.link)}" style="display:inline-block;background:#2650cf;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:10px">Pay ${esc(fmtMoney(o.open, { cents: o.open % 1 !== 0 }))} online</a></p><p style="color:#5b5f68;font-size:14px">By card or bank transfer, through QuickBooks’ secure page.</p>` : ''
  const lead = o.reminder
    ? `A friendly reminder: invoice <b>${esc(o.doc)}</b> for <b>${esc(o.job)}</b> — ${esc(o.title)} — has <b>${esc(fmtMoney(o.open, { cents: o.open % 1 !== 0 }))}</b> open. It’s attached again.`
    : `Attached is invoice <b>${esc(o.doc)}</b> for <b>${esc(o.job)}</b> — ${esc(o.title)}.`
  return `<div style="font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1b18;max-width:560px">
<p>${esc(o.hello)}</p>
<p>${lead}</p>${pay}
<p>Questions about it? Just reply to this email.</p>
<p>Thank you,<br>${esc(o.by)}<br>Cobblestone Tile</p>
</div>`
}
/** email the invoice to the client's billing people, from the address Settings → Email has for invoices (else the
 *  person sending it), copying who it says — QuickBooks' PDF attached, its Pay button in the email */
export async function emailBill(id: string, o: { reminder?: boolean; first?: boolean } = {}): Promise<boolean> {
  if (!REAL.qb) return false
  const s = useStore.getState()
  const m = s.money.find((x) => x.id === id)
  if (!m?.qb?.id) return false
  const j = s.jobs[m.jobId]
  const to = billTo(s, m.jobId)
  const doc = m.ref || (m.qb.doc ? '#' + m.qb.doc : 'invoice')
  if (!to.emails.length) {
    quiet(id, (x) => x.log.push(L('system', `Not emailed — ${to.name} has no email for invoices`)))
    showPop({ title: o.first ? `In QuickBooks as ${doc} — not emailed` : 'Not emailed', sub: `${to.name} has no email for invoices. Add one on their page (Clients → ${to.name}), then use “Email it” on the bill.`, tone: 'warn' })
    return false
  }
  const mail = s.rules.email || {}
  const me = byMe()
  const mine = s.team.find((x) => x.key === me)
  const fromAddr = mail.invoices || REAL.email || mine?.email
  const name = PEOPLE[me]?.name || 'Cobblestone Tile'
  const open = r2((m.amount || 0) - (m.paid || 0))
  const cc = Array.from(new Set([...(mail.cc || []), ...(mail.ccInvoices || []), ...to.emails.slice(1)]))
  const r = await REAL.qb.send({
    id: m.qb.id, to: to.emails[0], cc,
    from: fromAddr ? `${mail.invoices ? 'Cobblestone Tile' : `${name} · Cobblestone Tile`} <${fromAddr}>` : undefined,
    replyTo: fromAddr ? [fromAddr] : undefined,
    subject: o.reminder ? `Reminder: invoice ${doc} · ${j?.name || ''}` : `Invoice ${doc} · ${j?.name || ''} · ${m.title}`,
    html: invoiceHtml({ hello: `Hello${to.first ? ` ${to.first}` : ''},`, doc, job: j?.name || 'the project', title: m.title.toLowerCase(), open, link: m.qb.link, reminder: o.reminder, by: name }),
    file: `Invoice ${doc.replace(/^#/, '')}.pdf`,
  }).catch(() => ({ ok: false as const, why: 'offline' }))
  if (!r.ok) {
    quiet(id, (x) => x.log.push(L('system', `The email didn’t go out — ${qbWords(r)}`)))
    showPop({ title: o.first ? `In QuickBooks as ${doc} — the email didn’t go out` : 'The email didn’t go out', sub: `${qbWords(r)}. Try “Email it” on the bill again.`, tone: 'warn' })
    return false
  }
  const list = [to.emails[0], ...cc].join(', ')
  quiet(id, (x, st) => {
    if (!x.qb) return
    x.qb.emailed = new Date().toISOString()
    x.qb.emailedTo = to.emails[0]
    x.log.push(L(me, `${o.reminder ? 'Reminder emailed' : 'Emailed'} to ${list}${r.via === 'quickbooks' ? ' (sent by QuickBooks)' : ''}`))
    /* the reminder that was waiting on someone's Today is done */
    closeTasks(st, st.tasks.filter((t) => t.id.startsWith(`remind-${id}-`) && t.state !== 'done').map((t) => t.id), 'Reminder sent')
  })
  showPop({ title: o.reminder ? `Reminder sent to ${to.emails[0]}` : `Invoice ${doc} sent to ${to.emails[0]}`, sub: o.first ? `It’s in QuickBooks too${m.qb.link ? ', with the Pay button in the email' : ''}.` : cc.length ? `Copied: ${cc.join(', ')}` : undefined })
  return true
}

/* ---------------- estimates ---------------- */
/** the estimate as QuickBooks gets it: one line per area — what's in it, and what the area comes to */
function estimateOf(s: Store, e: Estimate, rev: EstRev, accepted: boolean): EstimateIn {
  const j = s.jobs[e.jobId]
  const c = j ? s.clients[j.clientId] : undefined
  const to = estimateTo(s, e)
  const it = (s.rules.qbItems || {}).progress
  const areas = Array.from(new Set(rev.lines.map((l) => l.area)))
  const lines = areas.map((a) => {
    const ls = rev.lines.filter((l) => l.area === a)
    const parts = ls.map((l) => {
      const item = s.items.find((x) => x.id === l.itemId)
      return `${l.desc || item?.name || 'Work'}${l.surface ? ` (${l.surface})` : ''} — ${l.qty.toLocaleString('en-US')} ${item?.unit || ''}`.trim()
    })
    return { amount: r2(ls.reduce((n, l) => n + l.qty * l.rate, 0)), description: `${a}: ${parts.join('; ')}`, ...(it ? { itemId: it.id } : {}) }
  }).filter((l) => l.amount !== 0)
  return {
    qbId: e.qb?.id, sync: e.qb?.sync,
    customer: { name: c?.name || j?.client || 'Client', email: to[0], address: c?.address || undefined, qbId: e.qb?.customerId || c?.qbId },
    lines,
    memo: [j?.name, j?.address, rev.n > 1 ? `Revision ${rev.n}` : ''].filter(Boolean).join(' · ') || undefined,
    note: `From Tile OS · ${e.id}${rev.n > 1 ? ` revision ${rev.n}` : ''}`,
    docNumber: e.id.replace(/^E-/, ''),
    accepted,
  }
}
/** who an estimate goes to: the client's first person with an email, else the client's email */
export function estimateTo(s: Pick<Store, 'jobs' | 'clients'>, e: Estimate): string[] {
  const j = s.jobs[e.jobId]
  const c = j ? s.clients[j.clientId] : undefined
  return Array.from(new Set([c?.contacts?.find((x) => EMAIL.test(x.email || ''))?.email, c?.email].map((x) => (x || '').trim().toLowerCase()).filter((x) => EMAIL.test(x)))).slice(0, 1)
}
/** put the estimate in QuickBooks (a revision changes the one there) and, `email`, send it to the client with
 *  QuickBooks' PDF. `accepted`: the client said yes — it's marked accepted there. */
export async function pushEstimate(estId: string, o: { email?: boolean; accepted?: boolean } = {}): Promise<boolean> {
  if (!REAL.qb || !REAL.cloud) return false
  if (!view.known || !view.connected) await refreshQb()
  if (!view.connected) return false
  const s = useStore.getState()
  const e = s.estimates.find((x) => x.id === estId)
  if (!e) return false
  const rev = o.accepted ? [...e.revs].reverse().find((r) => r.status === 'approved') || curRev(e) : [...e.revs].reverse().find((r) => r.status === 'sent') || curRev(e)
  const est = estimateOf(s, e, rev, !!o.accepted)
  if (!est.lines.length) return false
  const note = (text: string, patch: Partial<NonNullable<Estimate['qb']>> = {}) => useStore.setState((st: any) => { const x = st.estimates.find((y: Estimate) => y.id === estId); if (!x) return; x.qb = { ...(x.qb || {}), ...patch }; x.log.push(L('system', text)) })
  const r = await REAL.qb.estimate(est).catch(() => ({ ok: false as const, why: 'offline' }))
  if (!r.ok) {
    note(`Not in QuickBooks yet — ${qbWords(r)}`, { error: qbWords(r) })
    showPop({ title: o.email ? `${e.id} is marked sent — but it didn’t go out` : 'QuickBooks didn’t take the estimate', sub: `${qbWords(r)}.${o.email ? ' Download PDF and email it yourself this time.' : ''}`, tone: 'warn' })
    return false
  }
  const fresh = !e.qb?.id
  useStore.setState((st: any) => { const x = st.estimates.find((y: Estimate) => y.id === estId); const c = st.clients[st.jobs[e.jobId]?.clientId || '']; if (c && r.customerId && c.qbId !== r.customerId) c.qbId = r.customerId; if (x) x.qb = { ...(x.qb || {}), id: r.id, sync: r.sync, doc: r.doc, customerId: r.customerId, at: new Date().toISOString(), error: undefined } })
  note(o.accepted ? 'Marked accepted in QuickBooks' : fresh ? `In QuickBooks as estimate ${r.doc ? '#' + r.doc : ''}` : `Updated in QuickBooks${rev.n > 1 ? ` · revision ${rev.n}` : ''}`)
  if (!o.email) return true
  /* the email: from the estimates address (else the person sending it), with QuickBooks' PDF */
  const to = estimateTo(s, e)
  const j = s.jobs[e.jobId]
  if (!to.length) {
    note('Not emailed — the client has no email')
    showPop({ title: `${e.id} is in QuickBooks — not emailed`, sub: `${j?.client || 'The client'} has no email in Tile OS. Add one on their page, or send it from QuickBooks.`, tone: 'warn' })
    return false
  }
  const mail = s.rules.email || {}
  const me = byMe()
  const mine = s.team.find((x) => x.key === me)
  const fromAddr = mail.estimates || REAL.email || mine?.email
  const name = PEOPLE[me]?.name || 'Cobblestone Tile'
  const c = j ? s.clients[j.clientId] : undefined
  const first = c?.contacts?.find((x) => (x.email || '').toLowerCase() === to[0])?.name?.split(' ')[0]
  const total = rev.lines.reduce((n, l) => n + l.qty * l.rate, 0)
  const html = `<div style="font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1b18;max-width:560px">
<p>Hello${first ? ` ${esc(first)}` : ''},</p>
<p>Attached is our estimate <b>${esc(e.id)}</b>${rev.n > 1 ? ` (revision ${rev.n})` : ''} for <b>${esc(j?.name || 'the project')}</b> — ${esc(fmtMoney(total))}.</p>
<p>Reply to approve it, or tell us what you’d like to change.</p>
<p>Thank you,<br>${esc(name)}<br>Cobblestone Tile</p>
</div>`
  const sent = await REAL.qb.send({ id: r.id, kind: 'estimate', to: to[0], cc: Array.from(new Set([...(mail.cc || []), ...(mail.ccEstimates || [])])), from: fromAddr ? `${mail.estimates ? 'Cobblestone Tile' : `${name} · Cobblestone Tile`} <${fromAddr}>` : undefined, replyTo: fromAddr ? [fromAddr] : undefined, subject: `Estimate ${e.id}${rev.n > 1 ? ` · revision ${rev.n}` : ''} · ${j?.name || ''}`, html, file: `Estimate ${e.id}${rev.n > 1 ? `-R${rev.n}` : ''}.pdf` }).catch(() => ({ ok: false as const, why: 'offline' }))
  if (!sent.ok) {
    note(`The email didn’t go out — ${qbWords(sent)}`)
    showPop({ title: `${e.id} is in QuickBooks — the email didn’t go out`, sub: `${qbWords(sent)}. Send it from QuickBooks, or Download PDF and email it.`, tone: 'warn' })
    return false
  }
  note(`Emailed to ${to[0]}${sent.via === 'quickbooks' ? ' (sent by QuickBooks)' : ''}`, { emailed: new Date().toISOString(), emailedTo: to[0] })
  showPop({ title: `${e.id} emailed to ${to[0]}`, sub: 'With the PDF from QuickBooks. It’s in QuickBooks too.' })
  return true
}

/* ---------------- payments ---------------- */
/** a payment recorded here goes on the invoice in QuickBooks; if it can't now, it's kept and goes again by itself */
export async function pushPayment(id: string, amount: number, how?: string, o: { quietOk?: boolean } = {}): Promise<boolean> {
  if (!REAL.qb || !(amount > 0)) return false
  const m = useStore.getState().money.find((x) => x.id === id)
  if (!m?.qb?.id || !m.qb.customerId) return false
  const r = await REAL.qb.pay({ invoiceId: m.qb.id, customerId: m.qb.customerId, amount: r2(amount), ref: how && how.length <= 21 ? how : undefined, note: `Recorded in Tile OS by ${PEOPLE[byMe()]?.name || 'the office'}${how ? ` · ${how}` : ''}` }).catch(() => ({ ok: false as const, why: 'offline' }))
  if (!r.ok) {
    quiet(id, (x) => { if (x.qb) x.qb.unsent = [...(x.qb.unsent || []), { amount: r2(amount), how, at: new Date().toISOString() }] })
    showPop({ title: 'Payment saved here — not in QuickBooks yet', sub: `${qbWords(r)}. It goes to QuickBooks by itself next time.`, tone: 'warn' })
    return false
  }
  quiet(id, (x) => {
    if (!x.qb) return
    x.qb.sent = r2((x.qb.sent || 0) + amount)
    x.qb.balance = r2(Math.max(0, (x.qb.balance ?? x.amount ?? 0) - amount))
    x.log.push(L('system', `${fmtMoney(amount, { cents: amount % 1 !== 0 })} recorded in QuickBooks too`))
  })
  if (!o.quietOk) showPop({ title: `${fmtMoney(amount, { cents: amount % 1 !== 0 })} recorded — QuickBooks too`, sub: 'The invoice there shows it paid.' })
  return true
}
/** payments that didn't reach QuickBooks: once more */
export async function retryUnsent(): Promise<void> {
  if (!REAL.qb) return
  for (const m of useStore.getState().money.filter((x) => x.qb?.id && x.qb.unsent?.length)) {
    const list = m.qb!.unsent!
    quiet(m.id, (x) => { if (x.qb) x.qb.unsent = undefined })
    for (const p of list) await pushPayment(m.id, p.amount, p.how, { quietOk: true })
  }
}

/* ---------------- what happened in QuickBooks comes here ---------------- */
let pulling = false
/** each bill's invoice in QuickBooks: what's been paid there that isn't here yet is recorded ("Paid in QuickBooks");
 *  a payment taken off there comes off here. Returns how many bills changed. */
export async function pullQb(o: { say?: boolean } = {}): Promise<number> {
  if (!REAL.qb || pulling) return 0
  const bills = useStore.getState().money.filter((m) => m.qb?.id && !m.qb.gone && m.amount).slice(-200)
  if (!bills.length) { setView({ pulled: Date.now() }); if (o.say) showPop({ title: 'Up to date with QuickBooks', sub: 'No invoices there from Tile OS yet.' }); return 0 }
  pulling = true
  try {
    const r = await REAL.qb.pull(bills.map((m) => m.qb!.id!)).catch(() => ({ ok: false as const, why: 'offline' }))
    if (!r.ok) {
      if (r.why === 'reconnect' || r.why === 'notconnected') void refreshQb()
      if (o.say) showPop({ title: 'Couldn’t check QuickBooks', sub: qbWords(r), tone: 'warn' })
      return 0
    }
    const there = new Map(r.invoices.map((x) => [x.id, x]))
    let changed = 0
    for (const b of bills) {
      const inv = there.get(b.qb!.id!)
      if (!inv) { quiet(b.id, (x) => { if (x.qb) { x.qb.gone = true; x.log.push(L('system', 'Deleted in QuickBooks')) } }); changed++; continue }
      const m = useStore.getState().money.find((x) => x.id === b.id)
      if (!m?.qb) continue
      const paidThere = r2(inv.total - inv.balance)
      const known = r2((m.qb.sent || 0) + (m.qb.fromQb || 0) + (m.qb.before || 0))
      const extra = r2(paidThere - known)
      quiet(m.id, (x, st) => {
        if (!x.qb) return
        x.qb.balance = inv.balance
        x.qb.total = inv.total
        x.qb.sync = inv.sync
        if (inv.doc) x.qb.doc = inv.doc
        if (extra >= 0.01) {
          /* paid in QuickBooks: recorded here, and not sent back */
          x.qb.fromQb = r2((x.qb.fromQb || 0) + extra)
          applyPayment(st, x.id, extra, 'Paid in QuickBooks', 'system')
        } else if (extra <= -0.01) {
          /* a payment taken off in QuickBooks (deleted, or the check bounced): it comes off here */
          let off = -extra
          for (const k of ['fromQb', 'sent', 'before'] as const) { const t = Math.min(off, x.qb[k] || 0); x.qb[k] = r2((x.qb[k] || 0) - t); off = r2(off - t) }
          x.paid = r2(Math.max(0, (x.paid || 0) + extra))
          if (x.state === 'paid' && x.amount && x.paid < x.amount - 0.01) { x.state = 'waiting'; x.step = x.kind === 'progress' ? 3 : 1; x.date = undefined; x.action = 'Record payment' }
          if (x.state !== 'paid' && x.amount) x.due = `${fmtMoney(x.amount - (x.paid || 0))} open`
          x.log.push(L('system', `QuickBooks shows ${fmtMoney(-extra, { cents: extra % 1 !== 0 })} less paid — taken off here to match`))
        }
      })
      if (Math.abs(extra) >= 0.01) changed++
    }
    setView({ pulled: Date.now() })
    if (changed) showPop({ title: changed === 1 ? 'A bill changed in QuickBooks' : `${changed} bills changed in QuickBooks`, sub: 'Payments made there are on the bills here now.' })
    else if (o.say) showPop({ title: 'Up to date with QuickBooks', sub: 'Nothing new paid there.' })
    return changed
  } finally {
    pulling = false
  }
}

/* ---------------- invoice reminders (Settings → Automations) ---------------- */
/** an unpaid invoice that went out — or was last reminded — that many days ago lands on accounting's Today (the admin's,
 *  with nobody in accounting), ready to send with one click. One per bill and email, whoever's app sees it first. */
export function remindLate() {
  const s = useStore.getState()
  if ((s.rules.autoOff || []).includes('inv-remind')) return
  const days = Math.max(1, s.rules.reminderDays || 3)
  const books = s.team.find((m) => m.role === 'accounting' && m.status !== 'off')
  const owner = (books?.key as PersonKey) || meOf('owner')
  const add = s.money.filter((m) => m.state !== 'paid' && m.qb?.id && !m.qb.gone && m.qb.emailed && (m.qb.balance ?? 1) > 0.005 && Date.now() - Date.parse(m.qb.emailed) >= days * 86_400_000)
    .filter((m) => !s.tasks.some((t) => t.id === `remind-${m.id}-${m.qb!.emailed!.slice(0, 10)}`))
  if (!add.length) return
  useStore.setState((st: any) => {
    for (const m of add) {
      const j = st.jobs[m.jobId]
      const open = (m.amount || 0) - (m.paid || 0)
      newTask(st, { id: `remind-${m.id}-${m.qb!.emailed!.slice(0, 10)}`, jobId: m.jobId, title: `Remind ${billTo(st, m.jobId).name} — invoice ${m.ref || ''} has ${fmtMoney(open)} open`, type: 'Money', owner, for: [books ? 'accounting' : 'owner'], state: 'now', due: 'Today', tone: 'warn', where: `${j?.name || ''} · ${m.title}`, action: { label: 'Remind', kind: 'money:' + m.id } })
    }
  })
}

/* ---------------- keeping in step while the app is open ---------------- */
let timer: ReturnType<typeof setInterval> | null = null
let onVis: (() => void) | null = null
const seesMoney = () => ['owner', 'pm', 'accounting'].includes(useStore.getState().role)
/** payments that didn't reach QuickBooks go again, then what's been paid there comes here */
export async function syncQb(o: { say?: boolean } = {}) {
  if (!REAL.qb) return
  if (!view.connected) { await refreshQb(); if (!view.connected) return }
  await retryUnsent()
  await pullQb(o)
  remindLate()
}
/** the real app, once it's open: where QuickBooks stands, then a look every 10 minutes (and when the app comes back
 *  into view) — by whoever can see the money */
export async function startQbSync() {
  stopQbSync()
  if (!REAL.qb || typeof document === 'undefined') return
  await refreshQb()
  const tick = () => { if (document.visibilityState === 'visible' && seesMoney() && view.connected) void syncQb() }
  tick()
  timer = setInterval(tick, 10 * 60_000)
  onVis = () => { if (document.visibilityState === 'visible' && Date.now() - (view.pulled || 0) > 3 * 60_000) tick() }
  document.addEventListener('visibilitychange', onVis)
}
export function stopQbSync() {
  if (timer) clearInterval(timer)
  timer = null
  if (onVis && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
  onVis = null
}

/* ---------------- connecting ---------------- */
/** the admin connects: off to Intuit to say yes, back on Settings → Connections */
export async function connectQb(): Promise<void> {
  if (!REAL.qb) return
  const r = await REAL.qb.connect().catch(() => ({ ok: false as const, why: 'offline' }))
  if (!r.ok) { showPop({ title: 'Couldn’t start connecting', sub: r.why === 'denied' ? 'Only the admin connects QuickBooks.' : qbWords(r), tone: 'warn' }); return }
  window.location.href = r.url
}
export async function disconnectQb(): Promise<void> {
  if (!REAL.qb) return
  const r = await REAL.qb.disconnect().catch(() => ({ ok: false, why: 'offline' }))
  if (!r.ok) { showPop({ title: 'Couldn’t disconnect', sub: r.why === 'denied' ? 'Only the admin can.' : qbWords({ why: r.why || 'error' }), tone: 'warn' }); return }
  await refreshQb()
  showPop({ title: 'QuickBooks disconnected', sub: 'Nothing more goes there until it’s connected again. The invoices already there stay.' })
}
/** back from Intuit (the address says how it went): say so */
export function qbArrived(how: string) {
  const say: Record<string, { title: string; sub: string; tone?: 'warn' }> = {
    'qb-ok': { title: 'QuickBooks is connected', sub: 'Every invoice made here goes there now, and payments made there come back.' },
    'qb-no': { title: 'QuickBooks wasn’t connected', sub: 'The connection was cancelled on the QuickBooks page. Try again when you’re ready.', tone: 'warn' },
    'qb-expired': { title: 'That took too long', sub: 'The QuickBooks page waits 15 minutes. Click Connect QuickBooks again.', tone: 'warn' },
    'qb-fail': { title: 'QuickBooks didn’t connect', sub: 'Usually the keys in Lovable don’t match the app on developer.intuit.com, or its Redirect URL is missing. Check both, then try again.', tone: 'warn' },
  }
  const p = say[how]
  if (p) setTimeout(() => showPop(p), 400)
  void refreshQb().then(() => { if (how === 'qb-ok') void syncQb() })
}
