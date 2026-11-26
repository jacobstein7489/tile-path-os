/* Email that goes out from Tile OS itself (the real app, once email is set up in Lovable): a purchase order to the
 * supplier when it's sent or changed, an installer's PO to him, the revised tile quantities to the designer or GC.
 * It comes from the address Settings → Email has for "Everything else" (else the person sending it), copying who it
 * says there; replies go back to that address. When it can't go — no email for them, email not set up — the PO says
 * so on its window, which has "Email it". */
import { useStore, meOf, clockNow, type Store } from '@/tileos/store'
import { REAL, PUBLISHED } from '@/tileos/lib/save'
import { showPop } from '@/tileos/lib/pop'
import { NOW, TOMORROW, md, isoFromLabel } from '@/tileos/lib/today'
import { fmtMoney, PEOPLE, crewInfo, type PersonKey } from '@/tileos/data/model'
import type { PO } from '@/tileos/data/work'
import { matBy } from './flows'
import { crewMailCompose } from '@/tileos/lib/crewmail'

/** the real app, with email from Tile OS switched on in Lovable (if it isn't, sending says so) */
export const mailLive = () => !!REAL.mail && REAL.cloud
const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/
const clean = (list: (string | undefined)[]) => Array.from(new Set(list.map((x) => (x || '').trim().toLowerCase()).filter((x) => EMAIL.test(x))))
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const money = (n: number) => fmtMoney(n, { cents: n % 1 !== 0 })

/** who an email from Tile OS comes from, who's copied, and the signature */
function sender(s: Store) {
  const mail = s.rules.email || {}
  const me = meOf(s.role)
  const mine = s.team.find((x) => x.key === me)
  const addr = mail.other || REAL.email || mine?.email || ''
  const name = PEOPLE[me]?.name || 'Cobblestone Tile'
  return { from: addr ? `${mail.other ? 'Cobblestone Tile' : `${name} · Cobblestone Tile`} <${addr}>` : '', replyTo: addr ? [addr] : [], cc: clean([...(mail.cc || []), ...(mail.ccOther || [])]), name, me, phone: mine?.phone }
}
/** a supplier's emails (Suppliers → their page): the main one, then any marked for orders */
export function supplierEmails(s: Pick<Store, 'suppliers'>, name: string): string[] {
  const sup = (s.suppliers || []).find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase())
  if (!sup) return []
  const more = (sup.more || []).filter((r) => r.kind === 'email')
  const orders = more.filter((r) => /order|po|purchas|sales/i.test(r.label || '')).map((r) => r.value)
  return clean([...orders, sup.email, ...(orders.length ? [] : more.map((r) => r.value))]).slice(0, 3)
}
/** an installer's email (his page under Installers) */
export function installerEmails(s: Pick<Store, 'team'>, crew: PersonKey): string[] {
  const m = s.team.find((x) => x.key === crew)
  const ci = crewInfo[crew]
  return clean([m?.email, ci?.email, ...[...(m?.more || []), ...(ci?.more || [])].filter((r) => r.kind === 'email').map((r) => r.value)]).slice(0, 2)
}

/* every email: the company's logo on top (served by the published app), the message, the company's name under it */
const frame = (inner: string) => `<div style="font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1b18;max-width:640px">
<img src="${PUBLISHED}/logo-email.png" width="130" alt="Cobblestone Tile Installation" style="display:block;width:130px;height:auto;border:0;margin:0 0 18px">
${inner}
<p style="margin:22px 0 0;padding-top:12px;border-top:1px solid #ece7df;font-size:12px;color:#8a857b">Cobblestone Tile Installation</p>
</div>`
const table = (head: string[], rows: string[][], total?: [string, string]) => `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px">
<tr>${head.map((h, i) => `<th style="text-align:${i ? 'right' : 'left'};padding:8px 6px;border-bottom:1px solid #d9d3c9;color:#5b5f68;font-weight:600">${esc(h)}</th>`).join('')}</tr>
${rows.map((r) => `<tr>${r.map((c, i) => `<td style="text-align:${i ? 'right' : 'left'};padding:8px 6px;border-bottom:1px solid #ece8e1">${esc(c)}</td>`).join('')}</tr>`).join('\n')}
${total ? `<tr><td colspan="${head.length - 1}" style="text-align:right;padding:10px 6px;font-weight:700">${esc(total[0])}</td><td style="text-align:right;padding:10px 6px;font-weight:700">${esc(total[1])}</td></tr>` : ''}
</table>`

type Pic = { filename: string; content: string; content_id?: string; content_type?: string }
async function go(m: { to: string[]; subject: string; html: string; text?: string; attachments?: Pic[]; /** a reply: the emails already on its thread */ thread?: string[] }, s: Store): Promise<{ ok: true; from: string; id: string; threaded?: boolean } | { ok: false; why: string }> {
  if (!REAL.mail) return { ok: false, why: 'Email isn’t set up in the app yet' }
  const who = sender(s)
  if (!who.from) return { ok: false, why: 'No address to send it from. Add one in Settings → Email' }
  const r = await REAL.mail.send({ from: who.from, to: m.to, cc: who.cc.filter((x) => !m.to.includes(x)), replyTo: who.replyTo, subject: m.subject, html: m.html, text: m.text, ...(m.attachments?.length ? { attachments: m.attachments } : {}), ...(m.thread?.length ? { thread: m.thread } : {}) }).catch(() => ({ ok: false as const, why: 'Couldn’t reach the server' }))
  if (!r.ok) return { ok: false, why: r.why === 'nokey' ? 'Email isn’t set up in Lovable yet (the Resend key)' : r.why }
  return { ok: true, from: r.from, id: r.id, threaded: r.threaded }
}

/* ---------------- a purchase order to the supplier ---------------- */
/** the day it's needed on site, as a date (an email is read later — never “Today” or “Thu”) */
function neededOn(p: PO) {
  const w = (p.eta || '').replace(/^Asked for /, '').replace(/^Was /, '').trim()
  const iso = w ? isoFromLabel(w) : ''
  return iso ? md(iso) : w
}
/** a message typed in a box, as the email's paragraphs — a blank line between paragraphs, a line break kept */
const paras = (text: string) => text.trim().split(/\n\s*\n/).map((x) => `<p>${esc(x.trim()).replace(/\n/g, '<br>')}</p>`).join('\n')
/** a tile's photo in the email, next to its line: the picture goes along with it, shown in place */
function tilePic(s: Store, jobId: string, tag?: string): Pic | null {
  const photo = tag ? s.tiles[jobId]?.[tag]?.photo : undefined
  const m = photo && /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(photo)
  if (!m || !tag) return null
  return { filename: `${tag}.${m[1].split('/')[1].replace('jpeg', 'jpg')}`, content: m[2], content_id: `tile-${tag.replace(/[^a-z0-9-]/gi, '')}`, content_type: m[1] }
}
/** what a PO says to the store — the words of the email (typed over on the review) — before the lines */
export function poWords(s: Store, p: PO, o: { changed?: boolean; many?: boolean } = {}): { subject: string; message: string } {
  const j = s.jobs[p.jobId]
  const who = sender(s)
  const needed = neededOn(p)
  const tile = p.kind === 'tile'
  const priced = !tile || p.paidBy === 'us'
  const intro = o.changed ? `${p.id} has changed. This replaces the one we sent before.`
    : p.more && !priced ? `We need more of the tile below${p.storeRef ? ` on order ${p.storeRef}` : ''}. Please add it and deliver it. Our reference is ${p.id}.`
    : p.more ? `Here is our purchase order ${p.id} for more of the same tile.`
    : tile && !priced ? `Please deliver the tile below${p.storeRef ? ` from order ${p.storeRef}` : ''}. Our reference is ${p.id}.`
      : `Here is our ${tile ? 'tile ' : ''}purchase order ${p.id}${p.storeRef ? ` (your order ${p.storeRef})` : ''}.`
  const message = `${o.many ? 'Hi,' : `Hi ${p.supplier} team,`}\n\n${intro}\nPlease reply to confirm it and the delivery date, with ${p.id} in the subject.\n\nThank you,\n${who.name}\nCobblestone Tile`
  const subject = `${p.id}${o.changed ? ' (changed)' : ''}${p.more ? ' · more tile' : tile ? ' · tile' : ''}${p.storeRef ? ` · your order ${p.storeRef}` : ''} · ${j?.name || ''}${needed ? ` · needed ${needed}` : ''}`
  return { subject, message }
}
/** the whole email for a PO — the words (yours, or the usual ones), where it goes, and each line, a tile with its photo */
export function poMail(s: Store, p: PO, o: { changed?: boolean; subject?: string; message?: string } = {}) {
  const j = s.jobs[p.jobId]
  const words = poWords(s, p, o)
  const site = PEOPLE[matBy(s)]
  const sitePhone = s.team.find((x) => x.key === matBy(s))?.phone
  const needed = neededOn(p)
  const tile = p.kind === 'tile'
  const priced = !tile || p.paidBy === 'us'
  const pics: Pic[] = []
  const cell = 'padding:8px 6px;border-bottom:1px solid #ece8e1;vertical-align:middle'
  const head = (h: string, right?: boolean) => `<th style="text-align:${right ? 'right' : 'left'};padding:8px 6px;border-bottom:1px solid #d9d3c9;color:#5b5f68;font-weight:600">${esc(h)}</th>`
  const rows = p.lines.map((l) => {
    const pic = tilePic(s, p.jobId, l.tag)
    if (pic && !pics.some((x) => x.content_id === pic.content_id)) pics.push(pic)
    const img = pic ? `<img src="cid:${pic.content_id}" width="56" height="56" alt="${esc(l.tag)}" style="display:block;width:56px;height:56px;border-radius:6px;object-fit:cover;border:1px solid #e4dfd6">` : ''
    return `<tr>${tile ? `<td style="${cell};width:64px">${img}</td>` : ''}<td style="${cell}">${esc(l.item)}</td><td style="${cell};text-align:right;white-space:nowrap">${esc(l.qty)}</td>${priced ? `<td style="${cell};text-align:right">${l.price != null ? esc(money(l.price)) : ''}</td><td style="${cell};text-align:right">${l.price != null && l.n != null ? esc(money(l.price * l.n)) : ''}</td>` : ''}</tr>`
  }).join('\n')
  const cols = (tile ? 1 : 0) + 2 + (priced ? 2 : 0)
  const table = `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px">
<tr>${tile ? head('') : ''}${head(tile ? 'Tile' : 'Item')}${head('Qty', true)}${priced ? head('Price', true) + head('Amount', true) : ''}</tr>
${rows}
${priced ? `<tr><td colspan="${cols - 1}" style="text-align:right;padding:10px 6px;font-weight:700">Total</td><td style="text-align:right;padding:10px 6px;font-weight:700">${esc(money(p.amount))}</td></tr>` : ''}
</table>`
  const details = `<p style="margin:0"><b>PO:</b> ${esc(p.id)}<br><b>Project:</b> ${esc(j?.name || '')}<br><b>Deliver to:</b> ${esc(j?.address || '')}${needed ? `<br><b>Needed on site:</b> ${esc(needed)}` : ''}${site ? `<br><b>Site contact:</b> ${esc(site.name)}${sitePhone ? ` · ${esc(sitePhone)}` : ''}` : ''}${p.storeRef ? `<br><b>Your order:</b> ${esc(p.storeRef)}` : ''}</p>`
  const message = (o.message ?? words.message).trim()
  /* the words first (with the greeting and the sign-off), then the order itself */
  const parts = message.split(/\n\s*\n/)
  const sign = parts.length > 1 && /^(thank|thanks|best|regards)/i.test(parts[parts.length - 1].trim()) ? parts.pop()! : ''
  const html = frame(`${paras(parts.join('\n\n'))}
${details}
${p.memo ? `<p>${esc(p.memo)}</p>` : ''}
${table}
${sign ? paras(sign) : ''}`)
  return { to: supplierEmails(s, p.supplier), subject: (o.subject ?? words.subject).trim() || words.subject, html, attachments: pics }
}
export async function emailPO(poId: string, o: { changed?: boolean; quietOk?: boolean; subject?: string; message?: string } = {}): Promise<boolean> {
  if (!mailLive()) return false
  const s = useStore.getState()
  const p = s.pos.find((x) => x.id === poId)
  if (!p) return false
  const note = (text: string) => useStore.setState((st: any) => { const x = st.pos.find((y: any) => y.id === poId); if (x) x.log.push({ date: NOW, who: 'system', text }) })
  const m = poMail(s, p, o)
  const to = m.to
  if (!to.length) {
    note(`Not emailed · ${p.supplier} has no email`)
    showPop({ title: `${p.id} saved, not emailed`, sub: `${p.supplier} has no email in Tile OS. Add it (Suppliers → ${p.supplier}), then “Email it” on the PO.`, tone: 'warn' })
    return false
  }
  const who = sender(s)
  /* a change goes on the same email as the order (a reply to it) — the store sees one thread for the PO */
  const reply = !!o.changed && !!p.mailed?.thread?.length
  const subject = reply ? reSubject(p.mailed!.subject || m.subject) : m.subject
  const r = await go({ to, subject, html: m.html, attachments: m.attachments, ...(reply ? { thread: p.mailed!.thread } : {}) }, s)
  if (!r.ok) {
    note(`The email didn’t go out · ${r.why}`)
    showPop({ title: `${p.id} saved. The email didn’t go out`, sub: `${r.why}. Try “Email it” on the PO again.`, tone: 'warn' })
    return false
  }
  useStore.setState((st: any) => {
    const x = st.pos.find((y: any) => y.id === poId)
    if (!x) return
    const was = x.mailed
    x.mailed = reply && was ? { ...was, at: new Date().toISOString(), to: to.join(', '), thread: [...(was.thread || []), r.id].filter(Boolean) } : { at: new Date().toISOString(), to: to.join(', '), subject, thread: r.id ? [r.id] : [] }
    x.log.push({ date: NOW, time: clockNow(), who: who.me, text: `Emailed to ${to.join(', ')}${who.cc.length ? ` · copied ${who.cc.join(', ')}` : ''}` })
  })
  if (!o.quietOk) showPop({ title: `${p.id} emailed to ${p.supplier}`, sub: `To ${to.join(', ')}. Their reply comes to ${who.replyTo[0] || 'you'}.` })
  return true
}
/* ---------------- on the order's own email: a follow-up, the cancel ---------------- */
/** "Re: " once — the subject a reply on a thread carries */
const reSubject = (subject: string) => (/^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`)
/** the subject a reply on the PO's email goes out with — the order's own subject, so it lands on that thread */
export function poThreadSubject(s: Store, p: PO) { return reSubject(p.mailed?.subject || poWords(s, p).subject) }
/** cancelling a PO: the words to the store (typed over before it goes) — the lines under them, the same table as the
 *  order's, so the store sees exactly what's off */
export function cancelWords(s: Store, p: PO): { subject: string; message: string } {
  const j = s.jobs[p.jobId]
  const who = sender(s)
  return {
    subject: poThreadSubject(s, p),
    message: `Hi ${p.supplier} team,\n\nPlease cancel our order ${p.id}${p.storeRef ? ` (your order ${p.storeRef})` : ''} for ${j?.name || 'the project'}.\nPlease reply to confirm it’s cancelled.\n\nThank you,\n${who.name}\nCobblestone Tile`,
  }
}
/** following up on a PO they haven't confirmed: the words (typed over before it goes) */
export function followWords(s: Store, p: PO): string {
  const who = sender(s)
  const sent = p.mailed?.at ? new Date(p.mailed.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : p.date || ''
  return `Hi ${p.supplier} team,\n\nFollowing up on our order ${p.id}${sent ? ` from ${sent}` : ''}${p.storeRef ? ` (your order ${p.storeRef})` : ''}.\nCan you please confirm it and the delivery date?\n\nThank you,\n${who.name}\nCobblestone Tile`
}
/** a reply on the PO's own email — the same look as the order (the words, the details, each line with its picture),
 *  on the same thread in their inbox and in ours */
async function poReply(poId: string, message: string, what: 'cancel' | 'follow'): Promise<{ ok: true; to: string[]; threaded: boolean } | { ok: false; why: string }> {
  const s = useStore.getState()
  const p = s.pos.find((x) => x.id === poId)
  if (!p) return { ok: false, why: 'No such PO' }
  const to = supplierEmails(s, p.supplier)
  if (!to.length) return { ok: false, why: `${p.supplier} has no email in Tile OS` }
  const subject = poThreadSubject(s, p)
  const m = poMail(s, p, { subject, message })
  const r = await go({ to, subject, html: m.html, attachments: m.attachments, thread: p.mailed?.thread }, s)
  if (!r.ok) return r
  useStore.setState((st: any) => {
    const x = st.pos.find((y: any) => y.id === poId)
    if (!x) return
    x.mailed = { ...(x.mailed || { subject }), at: new Date().toISOString(), to: to.join(', '), subject: x.mailed?.subject || subject, thread: [...(x.mailed?.thread || []), r.id].filter(Boolean) }
    x.log.push({ date: NOW, time: clockNow(), who: meOf(st.role), text: what === 'cancel' ? `Cancel emailed to ${to.join(', ')}` : `Followed up by email · ${to.join(', ')}` })
  })
  return { ok: true, to, threaded: !!r.threaded }
}
export async function emailCancel(poId: string, words: { subject?: string; message: string }): Promise<boolean> {
  if (!mailLive()) return false
  const p = useStore.getState().pos.find((x) => x.id === poId)
  if (!p) return false
  const r = await poReply(poId, words.message, 'cancel')
  if (!r.ok) { showPop({ title: `${p.id} cancelled. The email didn’t go out`, sub: `${r.why}. Call ${p.supplier}.`, tone: 'warn' }); return false }
  showPop({ title: `${p.id} cancelled`, sub: `${p.supplier} got it on the order’s own email. Their reply comes to you.` })
  return true
}
/** follow up by email, on the order's own email — the to-do comes back tomorrow if they still don't answer */
export async function emailFollow(poId: string, message: string): Promise<boolean> {
  if (!mailLive()) return false
  const p = useStore.getState().pos.find((x) => x.id === poId)
  if (!p) return false
  const r = await poReply(poId, message, 'follow')
  if (!r.ok) { showPop({ title: 'The follow-up didn’t go out', sub: `${r.why}. Call ${p.supplier}.`, tone: 'warn' }); return false }
  useStore.getState().commit((st) => {
    st.tasks.filter((t) => t.state === 'waiting' && t.action?.kind === 'po:' + poId).forEach((t) => {
      t.followUp = md(TOMORROW)
      t.followUps = (t.followUps || 0) + 1
      ;(t.log ||= []).push({ date: NOW, time: clockNow(), who: meOf(st.role), text: `Followed up by email · back ${md(TOMORROW)}` })
    })
  }, `Followed up with ${p.supplier}`, { tone: 'wait', sub: `On the order’s own email. If they don’t answer, it’s back on your list tomorrow.` })
  return true
}

/* ---------------- an installer's PO to him ---------------- */
export async function emailIPO(ipoId: string, o: { quietOk?: boolean } = {}): Promise<boolean> {
  if (!mailLive()) return false
  const s = useStore.getState()
  const p = s.ipos.find((x) => x.id === ipoId)
  if (!p) return false
  const j = s.jobs[p.jobId]
  const name = PEOPLE[p.crew]?.name || 'the installer'
  const to = installerEmails(s, p.crew)
  const note = (text: string) => useStore.setState((st: any) => { const x = st.ipos.find((y: any) => y.id === ipoId); if (x) x.log.push({ date: NOW, who: 'system', text }) })
  if (!to.length) {
    note(`Not emailed · ${name} has no email`)
    showPop({ title: `Saved · ${name} wasn’t emailed`, sub: `He has no email in Tile OS. Add it on his page (Installers → ${name}), then “Email it” on his PO.`, tone: 'warn' })
    return false
  }
  const who = sender(s)
  const rows = p.lines.map((l) => [l.item, l.qty, money(l.amount)])
  const cos = p.changes.filter((c) => c.status !== 'pending').map((c) => [`${c.co} · ${c.text}`, c.qty, money(c.amount)])
  const total = p.lines.reduce((n, l) => n + l.amount, 0) + p.changes.filter((c) => c.status !== 'pending').reduce((n, c) => n + c.amount, 0)
  const first = PEOPLE[p.crew]?.short || name.split(' ')[0]
  const html = frame(`<p>Hi ${esc(first)},</p>
<p>${p.rev ? `Here is <b>revision ${p.rev}</b> of your PO <b>${esc(p.id)}</b>. It replaces the one before.` : `Here is your PO <b>${esc(p.id)}</b>.`} Please reply to accept it, or tell us what doesn’t work.</p>
<p style="margin:0"><b>Project:</b> ${esc(j?.name || '')}<br><b>Address:</b> ${esc(j?.address || '')}</p>
${table(['Work', 'Qty', 'Amount'], [...rows, ...cos], ['Total', money(total)])}
<p>Thank you,<br>${esc(who.name)}<br>Cobblestone Tile</p>`)
  const r = await go({ to, subject: `${p.id}${p.rev ? ` revision ${p.rev}` : ''} · ${j?.name || ''} · your PO from Cobblestone Tile`, html }, s)
  if (!r.ok) {
    note(`The email didn’t go out · ${r.why}`)
    showPop({ title: `Saved. The email to ${first} didn’t go out`, sub: `${r.why}. Try “Email it” on his PO again.`, tone: 'warn' })
    return false
  }
  useStore.setState((st: any) => { const x = st.ipos.find((y: any) => y.id === ipoId); if (x) { x.mailed = { at: new Date().toISOString(), to: to.join(', ') }; x.log.push({ date: NOW, who: who.me, text: `Emailed to ${to.join(', ')}` }) } })
  if (!o.quietOk) showPop({ title: `${p.id} emailed to ${first}`, sub: `To ${to.join(', ')}. His reply comes to ${who.replyTo[0] || 'you'}.` })
  return true
}

/* ---------------- any short note (the revised tile quantities) ---------------- */
export async function emailText(o: { to: string; subject: string; text: string }): Promise<{ ok: true; from: string } | { ok: false; why: string }> {
  const to = clean(o.to.split(/[,;\s]+/))
  if (!to.length) return { ok: false, why: 'That isn’t an email address' }
  const html = frame(o.text.split(/\n{2,}/).map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`).join('\n'))
  return go({ to, subject: o.subject, html, text: o.text }, useStore.getState())
}

/* ---------------- the crew list: where every crew works that day — to the office, when the site manager sends it ---------------- */
export type CrewLine = { jobId: string; crew: PersonKey; workers: number; note: string }
const NOT_TO = ['estimator', 'takeoff', 'crew', 'client']
/** who gets the crew list: the people picked (Settings → Automations → Crew list) — none picked: everyone on the team
 *  but estimating (the admin, the office, the site manager, materials, the books) */
export function crewMailPeople(s: Pick<Store, 'rules' | 'team'>): PersonKey[] {
  const picked = s.rules.crewMail?.to
  if (picked) return picked
  return s.team.filter((m) => m.status !== 'off' && !NOT_TO.includes(m.role as string) && PEOPLE[m.key as PersonKey]).map((m) => m.key as PersonKey)
}
/** their emails (a person with no email on the team isn't on it — the window says so) */
export const crewMailTo = (s: Pick<Store, 'rules' | 'team'>) => clean(crewMailPeople(s).map((p) => s.team.find((m) => m.key === p)?.email))
/** the email, word for word (lib/crewmail — the same words the server uses for that morning's, by itself) */
export function crewMailWords(s: Store, rows: CrewLine[], day: string): { subject: string; html: string; text: string } {
  return crewMailCompose({ jobs: s.jobs, punch: s.punch, nameOf: (k) => PEOPLE[k as PersonKey]?.name, shortOf: (k) => PEOPLE[k as PersonKey]?.short, by: PEOPLE[meOf(s.role)]?.name || 'the site manager', site: PUBLISHED }, rows, day)
}
/** send it: to everyone it goes to (a test: only to you) */
export async function emailCrewList(rows: CrewLine[], day: string, o: { test?: boolean } = {}): Promise<{ ok: true; to: string[] } | { ok: false; why: string }> {
  const s = useStore.getState()
  const me = s.team.find((m) => m.key === meOf(s.role))
  const to = o.test ? clean([REAL.email, me?.email]) : crewMailTo(s)
  if (!to.length) return { ok: false, why: o.test ? 'There’s no email for you on the team' : 'Nobody to send it to. Pick who gets it in Settings → Automations → Crew list' }
  const m = crewMailWords(s, rows, day)
  const r = await go({ to, subject: o.test ? `Test · ${m.subject}` : m.subject, html: m.html, text: m.text }, s)
  return r.ok ? { ok: true, to } : r
}
