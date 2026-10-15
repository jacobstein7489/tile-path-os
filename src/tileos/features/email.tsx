/* What they get — the email exactly as the supplier or client sees it, sent from your connected Gmail.
 * Purchase orders carry Confirm / Can't make the date buttons, invoices a secure Pay button (QuickBooks Payments —
 * we never see or store card numbers), estimates Approve / Ask for changes. Their click updates Tile OS by itself. */
import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { Paperclip, Lock, Check, Mail } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { PEOPLE, fmtMoney, type PersonKey } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { curRev, revTotal } from '@/tileos/data/estimates'
import { ItemThumb } from './items'
import { matBy } from './flows'

export type PODraft = { jobId: string; supplier: string; lines: { itemId: string; n: number; price: number }[]; neededBy: string; id?: string }
export type EmailWhat = { kind: 'po'; draft?: PODraft; poId?: string } | { kind: 'invoice'; id: string } | { kind: 'estimate'; id: string }

export function EmailModal({ what, level }: { what: EmailWhat; level: number }) {
  const s = useStore()
  const sender = (who: PersonKey) => `${PEOPLE[who]?.name || 'Cobblestone'} · Cobblestone Tile`
  let from = '', to = '', subject = '', greeting = '', body: React.ReactNode = null, doc: React.ReactNode = null, buttons: React.ReactNode = null, attach = ''

  if (what.kind === 'po') {
    const po = what.poId ? s.pos.find((p) => p.id === what.poId) : undefined
    const d: PODraft = what.draft || { jobId: po!.jobId, supplier: po!.supplier, neededBy: (po?.eta || '').replace(/^Asked for /, '').replace(/^Was /, ''), id: po?.id, lines: (po?.lines || []).map((l) => ({ itemId: l.itemId || '', n: l.n || 1, price: l.price || 0 })) }
    const j = s.jobs[d.jobId]
    const id = d.id || 'PO-new'
    const total = d.lines.reduce((n, l) => n + l.n * l.price, 0)
    from = sender(matBy(s))
    to = `${d.supplier} · orders desk`
    subject = `${id} · ${j?.name} · needed ${d.neededBy}`
    attach = `${id}.pdf`
    greeting = `Hi ${d.supplier} team,`
    body = <>Please confirm <b>{id}</b> for <b>{j?.name}</b>. Deliver to {j?.address}, needed on site <b>{d.neededBy}</b>. One click below tells us — no need to reply.</>
    buttons = (
      <>
        <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2650cf] px-4 text-[0.875rem] font-semibold text-white"><Check className="h-4 w-4" />Confirm the order</span>
        <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d6dae0] bg-white px-4 text-[0.875rem] font-semibold text-[#394150]">Can’t make the date</span>
      </>
    )
    doc = (
      <Doc title="Purchase order" refNo={id} rows={[['Ship to', j?.address || ''], ['Needed by', d.neededBy], ['Project', j?.name || ''], ['Contact', `${PEOPLE[matBy(s)]?.name} · site`]]}>
        <div className="divide-y divide-[#e8eaee] border-y border-[#e8eaee]">
          {d.lines.map((l, i) => {
            const it = s.items.find((x) => x.id === l.itemId)
            return (
              <div key={i} className="flex items-center gap-3 py-2">
                <ItemThumb item={it} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.84375rem] font-semibold text-[#101828]">{it?.brand ? `${it.brand} ${it.product}` : it?.name}</span>
                  <span className="block truncate text-[0.75rem] text-[#66707f]">{it?.brand ? `${it.name.split(' · ')[0]} · ${it.pack || it.unit}` : it?.name}</span>
                </span>
                <span className="w-20 shrink-0 text-right text-[0.84375rem] tnum text-[#394150]">{l.n} {it?.unit}{l.n === 1 ? '' : 's'}</span>
                <span className="w-20 shrink-0 text-right text-[0.84375rem] tnum text-[#394150] max-sm:hidden">{fmtMoney(l.price, { cents: l.price % 1 !== 0 })}</span>
                <span className="w-20 shrink-0 text-right text-[0.84375rem] font-semibold tnum text-[#101828]">{fmtMoney(l.n * l.price)}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex justify-end gap-6 text-[0.875rem]"><span className="text-[#66707f]">Total{smp(' · sample')}</span><b className="tnum text-[#101828]">{fmtMoney(total)}</b></div>
      </Doc>
    )
  }

  if (what.kind === 'invoice') {
    const m = s.money.find((x) => x.id === what.id)
    if (!m) return null
    const j = s.jobs[m.jobId]
    const c = CUSTOMERS[j?.clientId || '']
    const ap = c?.contacts.find((x) => /accounts payable/i.test(x.role)) || c?.contacts[0]
    const ref = m.ref || '#draft'
    const due = (m.amount || 0) - (m.paid || 0)
    from = `${PEOPLE.accounting?.name || 'Accounting'} · Cobblestone Tile`
    to = ap ? `${ap.name} · ${c?.name}` : c?.name || j?.client || ''
    subject = `Invoice ${ref} · ${j?.name} · ${m.title}`
    attach = `Invoice ${ref}.pdf`
    greeting = `Hello${ap ? ` ${ap.name.split(' ')[0]}` : ''},`
    body = <>Attached is invoice <b>{ref}</b> for <b>{j?.name}</b> — {m.title.toLowerCase()}. You can pay it online in a minute with the button below, by card or bank transfer.</>
    buttons = <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2650cf] px-4 text-[0.875rem] font-semibold text-white"><Lock className="h-4 w-4" />Pay {fmtMoney(due)} securely</span>
    doc = (
      <Doc title="Invoice" refNo={ref} rows={[['Bill to', c?.name || j?.client || ''], ['Project', j?.name || ''], ['Their PO', j?.clientPO || '—'], ['Terms', 'Net 30']]}>
        <div className="flex items-center justify-between border-y border-[#e8eaee] py-2.5 text-[0.875rem]"><span className="text-[#394150]">{m.title}</span><b className="tnum text-[#101828]">{fmtMoney(m.amount || 0)}</b></div>
        {m.paid ? <div className="flex items-center justify-between py-1.5 text-[0.84375rem] text-[#66707f]"><span>Paid</span><span className="tnum">−{fmtMoney(m.paid)}</span></div> : null}
        <div className="mt-1 flex justify-end gap-6 text-[0.875rem]"><span className="text-[#66707f]">Due{smp(' · sample')}</span><b className="tnum text-[#101828]">{fmtMoney(due)}</b></div>
      </Doc>
    )
  }

  if (what.kind === 'estimate') {
    const e = s.estimates.find((x) => x.id === what.id)
    if (!e) return null
    const j = s.jobs[e.jobId]
    const c = CUSTOMERS[j?.clientId || '']
    const r = curRev(e)
    const areas = Array.from(new Set(r.lines.map((l) => l.area)))
    from = sender('ys')
    to = c?.contacts[0] ? `${c.contacts[0].name} · ${c.name}` : j?.client || ''
    subject = `Estimate ${e.id}${r.n > 1 ? ` · revision ${r.n}` : ''} · ${j?.name}`
    attach = `Estimate ${e.id}.pdf · Scope of work.pdf`
    greeting = 'Hello,'
    body = <>Here is our estimate for <b>{j?.name}</b>, with the scope of work room by room. Approve it, or tell us what to change — one click below.</>
    buttons = (
      <>
        <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2650cf] px-4 text-[0.875rem] font-semibold text-white"><Check className="h-4 w-4" />Approve</span>
        <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d6dae0] bg-white px-4 text-[0.875rem] font-semibold text-[#394150]">Ask for changes</span>
      </>
    )
    doc = (
      <Doc title="Estimate" refNo={`${e.id}${r.n > 1 ? ` · R${r.n}` : ''}`} rows={[['For', c?.name || j?.client || ''], ['Project', j?.name || ''], ['Address', j?.address || ''], ['Valid', '30 days']]}>
        <div className="divide-y divide-[#e8eaee] border-y border-[#e8eaee]">
          {areas.map((a) => (
            <div key={a} className="flex items-center justify-between py-2 text-[0.84375rem]"><span className="text-[#394150]">{a} <span className="text-[#9aa1ad]">· {r.lines.filter((l) => l.area === a).length} lines</span></span><b className="tnum text-[#101828]">{fmtMoney(r.lines.filter((l) => l.area === a).reduce((n, l) => n + l.qty * l.rate, 0))}</b></div>
          ))}
        </div>
        <div className="mt-2 flex justify-end gap-6 text-[0.875rem]"><span className="text-[#66707f]">Total{smp(' · sample')}</span><b className="tnum text-[#101828]">{fmtMoney(revTotal(r))}</b></div>
      </Doc>
    )
  }

  return (
    <Modal level={level} size="lg" onClose={s.close} title="What they get" sub="Sent from your connected Gmail. Their click comes back here by itself.">
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
        <div className="flex items-center gap-2 border-b border-line-2 bg-[#f8f9fb] px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#fda29b]" /><span className="h-2.5 w-2.5 rounded-full bg-[#fedf89]" /><span className="h-2.5 w-2.5 rounded-full bg-[#a6f4c5]" />
          <span className="ml-2 inline-flex items-center gap-1.5 text-[0.78125rem] font-semibold text-muted"><Mail className="h-3.5 w-3.5" />Inbox</span>
        </div>
        <div className="border-b border-line-2 px-5 py-3.5 max-sm:px-4">
          <div className="text-[1.0625rem] font-bold leading-snug text-ink">{subject}</div>
          <div className="mt-2 grid grid-cols-[3rem_1fr] gap-y-0.5 text-[0.8125rem]">
            <span className="text-muted">From</span><span className="truncate font-medium text-ink-2">{from}</span>
            <span className="text-muted">To</span><span className="truncate text-ink-2">{to}</span>
          </div>
        </div>
        <div className="bg-[#f4f5f7] px-5 py-5 max-sm:px-3">
          <div className="mx-auto max-w-[35rem] rounded-xl bg-white p-6 shadow-[0_0.0625rem_0.1875rem_rgba(16,24,40,.08)] max-sm:p-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#101828] text-[0.8125rem] font-black text-white">C</span>
              <span className="text-[0.9375rem] font-bold tracking-[-0.01em] text-[#101828]">Cobblestone Tile</span>
            </div>
            <p className="mt-5 text-[0.90625rem] text-[#101828]">{greeting}</p>
            <p className="mt-2 text-[0.90625rem] leading-relaxed text-[#394150]">{body}</p>
            <div className="mt-4 flex flex-wrap gap-2">{buttons}</div>
            <div className="mt-6">{doc}</div>
            <p className="mt-5 text-[0.8125rem] leading-relaxed text-[#66707f]">Questions? Reply to this email — it lands on the project in Tile OS.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-line-2 px-5 py-3 text-[0.8125rem] text-muted max-sm:px-4">
          <Paperclip className="h-4 w-4" /><span className="truncate">{attach}</span>
          {what.kind === 'invoice' && <span className="ml-auto inline-flex shrink-0 items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Card details stay with QuickBooks Payments</span>}
        </div>
      </div>
    </Modal>
  )
}

function Doc({ title, refNo, rows, children }: { title: string; refNo: string; rows: [string, string][]; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e8eaee] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.75rem] font-bold uppercase tracking-[0.08em] text-[#66707f]">{title}</span>
        <span className="text-[0.875rem] font-bold tnum text-[#101828]">{refNo}</span>
      </div>
      <div className="mb-3 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[0.78125rem] max-sm:grid-cols-1">
        {rows.map(([k, v]) => <div key={k} className="min-w-0 truncate"><span className="text-[#9aa1ad]">{k}</span> <span className="text-[#394150]">{v}</span></div>)}
      </div>
      {children}
    </div>
  )
}
