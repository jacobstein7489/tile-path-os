import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { ArrowRight, Receipt, Package, HardHat, TrendingUp, CheckCircle2 } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Card, CardHeader, Button, Pill, Avatar, IconCircle, TextInput } from '@/tileos/components/ui/core'
import { MiniSteps, StackBar } from '@/tileos/components/ui/progress'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, PEOPLE, type Job } from '@/tileos/data/model'
import { MONEY_STEPS, MONEY_KIND_LABEL, PO_STEPS, type MoneyItem } from '@/tileos/data/work'
import { pictureOf, LAST_WEEK } from '../progressbill'
import { InstallerPOCard } from '../field'
import { Section, Empty } from './kit'

/** a project's money in one place: contract (with approved changes), invoiced and paid so far */
export function jobMoney(job: Job) {
  const p = pictureOf(useStore.getState(), job.id)
  return { contract: p.contract + p.changes, invoiced: p.billed, paid: p.paid, billedPct: p.billedPct, paidPct: p.paidPct }
}
/** the contract, the work in, what's billed and paid — worked out from the estimate, the daily updates and the bills */
export function billingOf(job: Job) {
  return pictureOf(useStore.getState(), job.id)
}

export function MoneyRow({ m, showJob }: { m: MoneyItem; showJob?: boolean }) {
  const s = useStore()
  const job = s.jobs[m.jobId]
  const steps = MONEY_STEPS[m.kind]
  const at = m.state === 'paid' ? steps.length - 1 : m.step
  return (
    <button onClick={() => s.open({ t: 'money', id: m.id })} className="grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_7.5rem_11rem] items-center gap-6 border-b border-line-2 px-5 py-3.5 text-left transition-colors last:border-0 hover:bg-wash md:max-xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:max-xl:gap-x-6 md:max-xl:gap-y-1.5 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:gap-y-3 max-sm:px-4">
      <div className="min-w-0 md:max-xl:row-span-2 md:max-xl:self-center">
        <div className="flex items-center gap-2">
          <Pill tone={m.kind === 'change' ? 'vio' : m.kind === 'progress' ? 'info' : m.kind === 'deposit' ? 'warn' : 'neutral'} size="sm">{MONEY_KIND_LABEL[m.kind]}</Pill>
          <span className={cn('text-[0.78125rem] font-semibold', m.ref ? 'text-ink-2' : 'text-faint')}>{m.ref ? `Invoice ${m.ref}` : m.state === 'upcoming' ? 'Later' : 'Not invoiced yet'}</span>
        </div>
        <div className="mt-1 truncate text-[0.90625rem] font-semibold text-ink">{showJob && job ? `${job.name} · ` : ''}{m.title}</div>
        <div className="truncate text-[0.78125rem] text-muted">{m.note}</div>
      </div>
      <div className="min-w-0 md:max-xl:row-span-2 md:max-xl:self-center max-md:col-span-2 max-md:row-start-2">
        {m.step >= 0 || m.state === 'paid' ? <MiniSteps steps={steps} at={at} tone={m.state === 'paid' ? 'ok' : 'info'} /> : <span className="text-[0.8125rem] font-medium text-muted">{m.due}</span>}
      </div>
      <div className="text-right md:max-xl:col-start-3 md:max-xl:row-start-1 max-md:col-start-2 max-md:row-start-1 max-md:self-start">
        <div className="text-[1rem] font-bold tnum text-ink">{m.amount ? fmtMoney(m.amount) : '—'}</div>
        {m.paid ? <div className="text-[0.75rem] text-muted">{fmtMoney(m.paid)} paid</div> : null}
      </div>
      <div className="flex justify-end md:max-xl:col-start-3 md:max-xl:row-start-2 max-md:col-span-2 max-md:justify-start">
        {m.state === 'paid' ? (
          <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ok-600"><CheckCircle2 className="h-4 w-4" />Paid {m.date}</span>
        ) : m.action ? (
          <span className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[0.625rem] bg-brand-50 px-3 text-[0.8125rem] font-semibold text-brand-700">{m.action}<ArrowRight className="h-3.5 w-3.5" /></span>
        ) : (
          <span className="text-[0.8125rem] font-medium text-muted">{m.due}</span>
        )}
      </div>
    </button>
  )
}

export function MoneyTab({ job }: { job: Job }) {
  const s = useStore()
  const b = billingOf(job)
  const items = s.money.filter((m) => m.jobId === job.id)
  const pos = s.pos.filter((p) => p.jobId === job.id)
  const paid = b.paid
  const billed = b.billed
  const under = Math.max(0, b.installedPct - b.billedPct)

  return (
    <div className="flex flex-col gap-6">
      <Section title="Contract and billing" sub={[smp('Sample amounts'), `Retainage ${s.rules.retainage}%`].filter(Boolean).join(' · ')}>
        <div className="grid grid-cols-4 gap-0 divide-x divide-line-2 border-b border-line-2 max-md:grid-cols-2 max-md:divide-x-0 max-md:[&>*:nth-child(odd)]:border-r max-md:[&>*:nth-child(odd)]:border-line-2 max-md:[&>*:nth-child(-n+2)]:border-b max-md:[&>*:nth-child(-n+2)]:border-line-2">
          {[
            { l: 'Contract', v: fmtMoney(b.contract), sub: 'Approved revision' },
            { l: 'Approved changes', v: '+' + fmtMoney(b.changes), sub: b.pending ? `${fmtMoney(b.pending)} still pending` : 'Nothing pending' },
            { l: 'Billed to date', v: fmtMoney(billed), sub: `${b.billedPct}% · ${fmtMoney(paid)} paid` },
            { l: 'Retainage held', v: fmtMoney(b.retainage), sub: 'Released at closeout' },
          ].map((x) => (
            <div key={x.l} className="min-w-0 px-6 py-4 max-sm:px-4">
              <div className="text-[0.8125rem] font-medium text-muted">{x.l}</div>
              <div className="mt-1 text-[1.25rem] font-bold tnum h-tight text-ink max-sm:text-[1.125rem]">{x.v}</div>
              <div className="text-[0.78125rem] text-muted">{x.sub}</div>
            </div>
          ))}
        </div>
        <div className="px-5 py-5 max-sm:px-4">
          <StackBar
            h={16}
            parts={[
              { pct: b.paidPct, className: 'bg-ok-500', label: 'Paid' },
              { pct: Math.max(0, b.billedPct - b.paidPct), className: 'bg-brand-500', label: 'Billed, not paid' },
              { pct: Math.max(0, under), className: 'bg-warn-300', label: 'Installed, not billed' },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-5 text-[0.8125rem] text-ink-2">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-ok-500" />Paid {b.paidPct}%</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" />Billed, not paid {Math.max(0, b.billedPct - b.paidPct)}%</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-warn-300" />Installed, not billed {Math.max(0, under)}%</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#E9EDF3]" />Remaining</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-muted">
            {job.before?.billed || job.before?.paid ? (
              <span>Before Tile OS: <b className="font-semibold tnum text-ink-2">{fmtMoney(job.before.billed)}</b> billed · <b className="font-semibold tnum text-ink-2">{fmtMoney(job.before.paid)}</b> paid — it’s counted in.</span>
            ) : (
              <span>Started before Tile OS?</span>
            )}
            <button onClick={() => s.open({ t: 'billedbefore', jobId: job.id })} className="font-semibold text-brand-600 hover:underline">{job.before?.billed || job.before?.paid ? 'Change' : 'Put in what was already billed'}</button>
          </div>
          {b.toBill > 0 && (
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-warn-100 bg-warn-50/70 px-4 py-3.5 max-sm:flex-wrap max-sm:gap-3">
              <IconCircle tone="warn" size={40} className="max-sm:hidden"><TrendingUp className="h-5 w-5" /></IconCircle>
              <div className="min-w-0 flex-1 text-[0.875rem] text-ink-2">
                <span className="font-semibold text-ink">The daily updates say {b.installedPct}% is in; {b.billedPct}% is billed.</span> {fmtMoney(b.toBill)} can go on a progress bill now.
              </div>
              <Button size="sm" variant="primary" onClick={() => s.open({ t: 'progress', jobId: job.id, week: LAST_WEEK.key })}>See what to bill</Button>
            </div>
          )}
        </div>
      </Section>

      <Section title="Bills" count={items.length} sub="Every invoice on this project — they go out from QuickBooks">
        <div>
          {items.map((m) => <MoneyRow key={m.id} m={m} />)}
          {!items.length && <Empty>Nothing billed on this project yet.</Empty>}
        </div>
      </Section>
    </div>
  )
}

/** a project that was going before Tile OS: what was billed and paid on it already (QuickBooks has it),
 *  so the weekly progress bill picks up from there and nothing is billed twice */
export function BilledBeforeModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const [billed, setBilled] = React.useState(job?.before?.billed ? String(job.before.billed) : '')
  const [paid, setPaid] = React.useState(job?.before?.paid ? String(job.before.paid) : '')
  const [held, setHeld] = React.useState(job?.before?.retainage ? String(job.before.retainage) : '')
  if (!job) return null
  const num = (v: string) => Math.max(0, Math.round(Number(v.replace(/[^0-9.]/g, '')) || 0))
  const save = () =>
    s.commit(
      (x) => {
        const j = x.jobs[jobId]
        j.before = { billed: num(billed), paid: Math.min(num(paid), num(billed) || num(paid)), retainage: num(held), changes: j.before?.changes || 0 }
      },
      `Saved — ${job.name} picks up from ${fmtMoney(num(billed))} billed`,
      { close: true, sub: 'The next progress bill takes it off, so nothing is billed twice.' },
    )
  const money = (v: string, set: (v: string) => void, label: string, hint: string, auto?: boolean) => (
    <label className="block">
      <span className="mb-1 block text-[0.8125rem] font-semibold text-ink-2">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[0.875rem] text-muted">$</span>
        <TextInput data-autofocus={auto || undefined} inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} placeholder="0" className="h-10 pl-6 tnum" />
      </span>
      <span className="mt-1 block text-[0.75rem] text-muted">{hint}</span>
    </label>
  )
  return (
    <Modal
      level={level}
      size="sm"
      onClose={s.close}
      title="Billed before Tile OS"
      sub={`${job.name} — for a project that was already going: what QuickBooks shows on it so far.`}
      footer={
        <>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {money(billed, setBilled, 'Billed so far', 'Every invoice on it — the deposit too', true)}
        {money(paid, setPaid, 'Paid so far', 'What the client paid on those invoices')}
        {money(held, setHeld, 'Retainage held so far', 'Leave it empty if they don’t hold any')}
        <div className="rounded-xl bg-wash px-3.5 py-2.5 text-[0.8125rem] leading-snug text-ink-2">Set the walls and floors to where they are now in the Scope tab. From then on the daily updates move them, and each week’s bill is what got installed, less what’s billed here.</div>
      </div>
    </Modal>
  )
}
