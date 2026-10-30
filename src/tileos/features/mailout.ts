/* Email that goes out from Tile OS itself (the real app, once email is set up in Lovable): a purchase order to the
 * supplier when it's sent or changed, an installer's PO to him, the revised tile quantities to the designer or GC.
 * It comes from the address Settings → Email has for "Everything else" (else the person sending it), copying who it
 * says there; replies go back to that address. When it can't go — no email for them, email not set up — the PO says
 * so on its window, which has "Email it". */
import { useStore, meOf, type Store } from '@/tileos/store'
import { REAL, PUBLISHED } from '@/tileos/lib/save'
import { showPop } from '@/tileos/lib/pop'
import { NOW } from '@/tileos/lib/today'
import { fmtMoney, PEOPLE, crewInfo, type PersonKey } from '@/tileos/data/model'
import { matBy } from './flows'

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

async function go(m: { to: string[]; subject: string; html: string; text?: string }, s: Store): Promise<{ ok: true; from: string } | { ok: false; why: string }> {
  if (!REAL.mail) return { ok: false, why: 'Email isn’t set up in the app yet' }
  const who = sender(s)
  if (!who.from) return { ok: false, why: 'No address to send it from — add one in Settings → Email' }
  const r = await REAL.mail.send({ from: who.from, to: m.to, cc: who.cc.filter((x) => !m.to.includes(x)), replyTo: who.replyTo, subject: m.subject, html: m.html, text: m.text }).catch(() => ({ ok: false as const, why: 'Couldn’t reach the server' }))
  if (!r.ok) return { ok: false, why: r.why === 'nokey' ? 'Email isn’t set up in Lovable yet (the Resend key)' : r.why }
  return { ok: true, from: r.from }
}

/* ---------------- a purchase order to the supplier ---------------- */
export async function emailPO(poId: string, o: { changed?: boolean; quietOk?: boolean } = {}): Promise<boolean> {
  if (!mailLive()) return false
  const s = useStore.getState()
  const p = s.pos.find((x) => x.id === poId)
  if (!p) return false
  const j = s.jobs[p.jobId]
  const to = supplierEmails(s, p.supplier)
  const note = (text: string) => useStore.setState((st: any) => { const x = st.pos.find((y: any) => y.id === poId); if (x) x.log.push({ date: NOW, who: 'system', text }) })
  if (!to.length) {
    note(`Not emailed — ${p.supplier} has no email`)
    showPop({ title: `${p.id} saved — not emailed`, sub: `${p.supplier} has no email in Tile OS. Add it (Suppliers → ${p.supplier}), then “Email it” on the PO.`, tone: 'warn' })
    return false
  }
  const who = sender(s)
  const site = PEOPLE[matBy(s)]
  const sitePhone = s.team.find((x) => x.key === matBy(s))?.phone
  const needed = (p.eta || '').replace(/^Asked for /, '').replace(/^Was /, '')
  /* tile the client bought: our PO is the call for its delivery — no prices on it, the store's order number is */
  const tile = p.kind === 'tile'
  const priced = !tile || p.paidBy === 'us'
  const rows = p.lines.map((l) => (priced ? [l.item, l.qty, l.price != null ? money(l.price) : '', l.price != null && l.n != null ? money(l.price * l.n) : ''] : [l.item, l.qty]))
  const intro = o.changed ? `<b>${esc(p.id)} has changed</b> — this replaces the one we sent before.`
    : p.more && !priced ? `We need more of the tile below${p.storeRef ? ` on order <b>${esc(p.storeRef)}</b>` : ''} — please add it and deliver it. Our reference is <b>${esc(p.id)}</b>.`
    : p.more ? `Here is our purchase order <b>${esc(p.id)}</b> for more of the same tile.`
    : tile && !priced ? `Please deliver the tile below${p.storeRef ? ` from order <b>${esc(p.storeRef)}</b>` : ''} — our reference is <b>${esc(p.id)}</b>.`
      : `Here is our ${tile ? 'tile ' : ''}purchase order <b>${esc(p.id)}</b>${p.storeRef ? ` (your order ${esc(p.storeRef)})` : ''}.`
  const html = frame(`<p>Hi ${esc(p.supplier)} team,</p>
<p>${intro} Please reply to confirm it and the delivery date, with ${esc(p.id)} in the subject.</p>
<p style="margin:0"><b>Project:</b> ${esc(j?.name || '')}<br><b>Deliver to:</b> ${esc(j?.address || '')}${needed ? `<br><b>Needed on site:</b> ${esc(needed)}` : ''}${site ? `<br><b>Site contact:</b> ${esc(site.name)}${sitePhone ? ` · ${esc(sitePhone)}` : ''}` : ''}${p.storeRef ? `<br><b>Your order:</b> ${esc(p.storeRef)}` : ''}</p>
${p.memo ? `<p>${esc(p.memo)}</p>` : ''}
${priced ? table(['Item', 'Qty', 'Price', 'Amount'], rows, ['Total', money(p.amount)]) : table(['Tile', 'Qty'], rows)}
<p>Thank you,<br>${esc(who.name)}<br>Cobblestone Tile</p>`)
  const r = await go({ to, subject: `${p.id}${o.changed ? ' (changed)' : ''}${p.more ? ' · more tile' : tile ? ' · tile' : ''}${p.storeRef ? ` · your order ${p.storeRef}` : ''} · ${j?.name || ''}${needed ? ` · needed ${needed}` : ''}`, html }, s)
  if (!r.ok) {
    note(`The email didn’t go out — ${r.why}`)
    showPop({ title: `${p.id} saved — the email didn’t go out`, sub: `${r.why}. Try “Email it” on the PO again.`, tone: 'warn' })
    return false
  }
  useStore.setState((st: any) => { const x = st.pos.find((y: any) => y.id === poId); if (x) { x.mailed = { at: new Date().toISOString(), to: to.join(', ') }; x.log.push({ date: NOW, who: who.me, text: `Emailed to ${to.join(', ')}${who.cc.length ? ` · copied ${who.cc.join(', ')}` : ''}` }) } })
  if (!o.quietOk) showPop({ title: `${p.id} emailed to ${p.supplier}`, sub: `To ${to.join(', ')}. Their reply comes to ${who.replyTo[0] || 'you'}.` })
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
    note(`Not emailed — ${name} has no email`)
    showPop({ title: `Saved — ${name} wasn’t emailed`, sub: `He has no email in Tile OS. Add it on his page (Installers → ${name}), then “Email it” on his PO.`, tone: 'warn' })
    return false
  }
  const who = sender(s)
  const rows = p.lines.map((l) => [l.item, l.qty, money(l.amount)])
  const cos = p.changes.filter((c) => c.status !== 'pending').map((c) => [`${c.co} · ${c.text}`, c.qty, money(c.amount)])
  const total = p.lines.reduce((n, l) => n + l.amount, 0) + p.changes.filter((c) => c.status !== 'pending').reduce((n, c) => n + c.amount, 0)
  const first = PEOPLE[p.crew]?.short || name.split(' ')[0]
  const html = frame(`<p>Hi ${esc(first)},</p>
<p>${p.rev ? `Here is <b>revision ${p.rev}</b> of your PO <b>${esc(p.id)}</b> — it replaces the one before.` : `Here is your PO <b>${esc(p.id)}</b>.`} Please reply to accept it, or tell us what doesn’t work.</p>
<p style="margin:0"><b>Project:</b> ${esc(j?.name || '')}<br><b>Address:</b> ${esc(j?.address || '')}</p>
${table(['Work', 'Qty', 'Amount'], [...rows, ...cos], ['Total', money(total)])}
<p>Thank you,<br>${esc(who.name)}<br>Cobblestone Tile</p>`)
  const r = await go({ to, subject: `${p.id}${p.rev ? ` revision ${p.rev}` : ''} · ${j?.name || ''} · your PO from Cobblestone Tile`, html }, s)
  if (!r.ok) {
    note(`The email didn’t go out — ${r.why}`)
    showPop({ title: `Saved — the email to ${first} didn’t go out`, sub: `${r.why}. Try “Email it” on his PO again.`, tone: 'warn' })
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
