import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { ArrowRight, Receipt, Package, HardHat, TrendingUp, CheckCircle2, Plus } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Card, CardHeader, Button, Pill, Avatar, IconCircle, TextInput } from '@/tileos/components/ui/core'
import { MiniSteps, StackBar } from '@/tileos/components/ui/progress'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, PEOPLE, type Job } from '@/tileos/data/model'
import { MONEY_STEPS, MONEY_KIND_LABEL, PO_STEPS, type MoneyItem } from '@/tileos/data/work'
import { pictureOf, LAST_WEEK } from '../progressbill'
import { InstallerPOCard } from '../field'
import { Section, Empty, Strip } from './kit'
import { curRev, revTotal } from '@/tileos/data/estimates'

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
    <button onClick={() => s.open({ t: 'money', id: m.id })} className="grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_7.5rem_11rem] items-center gap-6 border-b border-line-2 px-5 py-3 text-left transition-colors last:border-0 hover:bg-wash md:max-xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:max-xl:gap-x-6 md:max-xl:gap-y-1.5 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:gap-y-3 max-sm:px-4">
 <div className="min-w-0 md:max-xl:row-span-2 md:max-xl:self-center">
 <div className="flex items-center gap-2">
 <span className="text-[0.78125rem] font-medium text-muted">{MONEY_KIND_LABEL[m.kind]}</span>
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
          <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[#2c4a3e]"><CheckCircle2 className="h-4 w-4" />Paid {m.date}</span>
        ) : m.action ? (
          <span className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[0.625rem] border border-line bg-white px-3 text-[0.8125rem] font-semibold text-ink">{m.action}<ArrowRight className="h-3.5 w-3.5" /></span>
        ) : (
          <span className="text-[0.8125rem] font-medium text-muted">{m.due}</span>
        )}
      </div>
    </button>
  )
}

/* Billing on a project — plain, in light lines: the numbers in one row (and the one button: bill what's installed),
 * the bills (each one's invoice and where it is), the estimate and its changes. */
const T_HEAD = 'grid divide-x divide-line-2 border-b border-line-2 bg-wash text-[0.75rem] font-semibold text-muted max-md:hidden [&>span]:flex [&>span]:h-9 [&>span]:min-w-0 [&>span]:items-center [&>span]:px-4 [&>span:first-child]:pl-5'
const T_ROW = 'grid w-full divide-x divide-line-2 border-b border-line-2 text-left transition-colors last:border-b-0 hover:bg-[#f8f6f2] max-md:divide-x-0'
const T_CELL = 'flex min-w-0 items-center px-4 py-2.5'
const BILL_COLS = 'grid-cols-[minmax(0,1.6fr)_8rem_minmax(0,1.2fr)_8rem] max-md:grid-cols-[minmax(0,1fr)_auto]'
const CHANGE_COLS = 'grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_8rem] max-md:grid-cols-[minmax(0,1fr)_auto]'
function TableCard({ title, count, right, children, ...rest }: { title: string; count?: number; right?: React.ReactNode; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white shadow-card" {...rest}>
      <header className="flex min-h-12 items-center gap-2 border-b border-line-2 px-5 py-2 max-sm:px-4">
        <h3 className="text-[0.96875rem] font-semibold text-ink">{title}</h3>
        {count !== undefined && <span className="text-[0.8125rem] font-semibold tnum text-faint">{count}</span>}
        {right && <span className="ml-auto flex items-center gap-2">{right}</span>}
      </header>
      {children}
    </section>
  )
}
/** where a bill is, in a word or two */
function billWhere(m: MoneyItem): { text: string; cls: string } {
  if (m.state === 'paid') return { text: `Paid${m.date ? ` ${m.date}` : ''}`, cls: 'font-semibold text-[#2c8a5b]' }
  if (m.paid) return { text: `${fmtMoney(m.paid)} paid`, cls: 'text-ink-2' }
  const steps = MONEY_STEPS[m.kind]
  if (m.step < 0 || m.state === 'upcoming') return { text: m.due || 'Later', cls: 'text-muted' }
  return { text: steps[m.step] || '—', cls: 'text-ink-2' }
}
export function MoneyTab({ job }: { job: Job }) {
  const s = useStore()
  const b = billingOf(job)
  const bills = s.money.filter((m) => m.jobId === job.id && m.kind !== 'change')
  const cos = s.money.filter((m) => m.jobId === job.id && m.kind === 'change')
  const ests = s.estimates.filter((e) => e.jobId === job.id)
  const before = job.before?.changes || 0
  const canChange = s.role !== 'accounting'
  const numbers = [
    { label: 'Contract', value: fmtMoney(b.contract + b.changes), title: b.changes ? `With ${fmtMoney(b.changes)} of approved changes` : undefined },
    { label: 'Billed', value: fmtMoney(b.billed), sub: `${b.billedPct}%` },
    { label: 'Paid', value: fmtMoney(b.paid) },
    { label: 'Retainage held', value: fmtMoney(b.retainage), title: `${s.rules.retainage}% · released at closeout` },
  ]
  return (
    <div className="flex flex-col gap-4" data-billing-tab>
      {/* the numbers, in one row — and the one thing to do */}
      <div className="flex items-stretch overflow-hidden rounded-[0.875rem] border border-line bg-white shadow-card max-md:flex-col" data-money-strip>
        <div className="grid flex-1 grid-cols-4 divide-x divide-line-2 max-md:grid-cols-2">
          {numbers.map((n) => (
            <div key={n.label} className="min-w-0 px-5 py-3 max-sm:px-4" title={n.title}>
              <div className="text-[0.75rem] font-medium text-muted">{n.label}</div>
              <div className="mt-0.5 truncate text-[1.125rem] font-semibold tnum text-ink">{n.value}{n.sub && <span className="ml-1.5 text-[0.8125rem] font-medium text-muted">{n.sub}</span>}</div>
            </div>
          ))}
        </div>
        {b.toBill > 0 && (
          <div className="flex items-center border-l border-line-2 px-4 max-md:border-l-0 max-md:border-t max-md:py-3">
            <Button variant="primary" className="max-md:w-full" onClick={() => s.open({ t: 'progress', jobId: job.id, week: LAST_WEEK.key })}>Bill {fmtMoney(b.toBill)} now</Button>
          </div>
        )}
      </div>

      <TableCard title="Bills" count={bills.length} right={<span className="text-[0.78125rem] text-muted">Sent from QuickBooks</span>} data-bills>
        {bills.length > 0 && <div className={cn(T_HEAD, BILL_COLS)}><span>Bill</span><span>Invoice</span><span>Where it is</span><span className="justify-end">Amount</span></div>}
        {bills.map((m) => {
          const w = billWhere(m)
          return (
            <button key={m.id} onClick={() => s.open({ t: 'money', id: m.id })} className={cn(T_ROW, BILL_COLS)} data-bill={m.id}>
              <span className={cn(T_CELL, 'pl-5 max-sm:pl-4')}>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink">{m.title}</span>
                  <span className={cn('hidden truncate text-[0.75rem] max-md:block', w.cls)}>{m.ref ? (m.ref.startsWith('#') ? m.ref : `#${m.ref}`) : m.state === 'upcoming' ? 'Later' : 'Not invoiced yet'} · {w.text}</span>
                </span>
              </span>
              <span className={cn(T_CELL, 'max-md:hidden')}><span className={cn('truncate text-[0.8125rem]', m.ref ? 'text-ink-2' : 'text-faint')}>{m.ref ? (m.ref.startsWith('#') ? m.ref : `#${m.ref}`) : m.state === 'upcoming' ? 'Later' : 'Not invoiced yet'}</span></span>
              <span className={cn(T_CELL, 'max-md:hidden')}><span className={cn('truncate text-[0.8125rem]', w.cls)}>{w.text}</span>{m.action && m.state !== 'paid' && <span className="ml-auto shrink-0 pl-3 text-[0.8125rem] font-semibold text-brand-700">{m.action} →</span>}</span>
              <span className={cn(T_CELL, 'justify-end')}><span className="text-[0.875rem] font-semibold tnum text-ink">{m.amount ? fmtMoney(m.amount) : '—'}</span></span>
            </button>
          )
        })}
        {!bills.length && <div className="px-5 py-3 text-[0.84375rem] text-muted">Nothing billed on this project yet.</div>}
      </TableCard>

      <TableCard title="Estimate and changes" count={ests.length + cos.length + (before ? 1 : 0)} right={canChange ? <Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'sitechange', jobId: job.id })}>Client wants a change</Button> : undefined} data-changes-table>
        {ests.map((e) => {
          const r = curRev(e)
          return (
            <button key={e.id} onClick={() => s.open({ t: 'estimate', id: e.id })} className={cn(T_ROW, CHANGE_COLS)} data-est-line={e.id}>
              <span className={cn(T_CELL, 'pl-5 max-sm:pl-4')}><span className="truncate text-[0.875rem] font-semibold text-ink">Estimate {e.id}{e.revs.length > 1 ? ` · revision ${r?.n}` : ''}</span></span>
              <span className={cn(T_CELL, 'max-md:hidden')}><span className="truncate text-[0.8125rem] text-ink-2">{e.status === 'approved' ? `Approved${e.approvedOn ? ` ${e.approvedOn}` : ''}` : 'Not approved yet'}</span></span>
              <span className={cn(T_CELL, 'justify-end')}><span className="text-[0.875rem] font-semibold tnum text-ink">{fmtMoney(revTotal(r))}</span></span>
            </button>
          )
        })}
        {cos.map((m) => (
          <button key={m.id} onClick={() => s.open({ t: 'money', id: m.id })} className={cn(T_ROW, CHANGE_COLS)} data-co-line={m.id}>
            <span className={cn(T_CELL, 'pl-5 max-sm:pl-4')}><span className="truncate text-[0.875rem] font-semibold text-ink">{m.title}</span></span>
            <span className={cn(T_CELL, 'max-md:hidden')}><span className={cn('truncate text-[0.8125rem]', m.step < 0 ? 'text-warn-700' : 'text-ink-2')}>{m.state === 'paid' ? 'Paid' : m.step < 0 ? 'Waiting for the client’s yes' : m.state === 'waiting' ? 'Billed' : 'Approved'}</span></span>
            <span className={cn(T_CELL, 'justify-end')}><span className="text-[0.875rem] font-semibold tnum text-ink">{fmtMoney(m.amount || m.meta?.estimate || 0)}</span></span>
          </button>
        ))}
        {before > 0 && (
          <div className={cn(T_ROW, CHANGE_COLS, 'hover:bg-transparent')}>
            <span className={cn(T_CELL, 'pl-5 max-sm:pl-4')}><span className="truncate text-[0.875rem] font-semibold text-ink">Changes approved before Tile OS</span></span>
            <span className={cn(T_CELL, 'max-md:hidden')}><span className="text-[0.8125rem] text-ink-2">Approved</span></span>
            <span className={cn(T_CELL, 'justify-end')}><span className="text-[0.875rem] font-semibold tnum text-ink">{fmtMoney(before)}</span></span>
          </div>
        )}
        {!ests.length && !cos.length && !before && <div className="px-5 py-3 text-[0.84375rem] text-muted">No estimate in the system for this project — it was priced before Tile OS.</div>}
      </TableCard>

      <div className="flex flex-wrap items-center gap-2 px-1 text-[0.8125rem] text-muted">
        {job.before?.billed || job.before?.paid
          ? <>Before Tile OS: <b className="font-semibold tnum text-ink-2">{fmtMoney(job.before.billed)}</b> billed · <b className="font-semibold tnum text-ink-2">{fmtMoney(job.before.paid)}</b> paid — counted in.</>
          : 'Started before Tile OS?'}
        <button onClick={() => s.open({ t: 'billedbefore', jobId: job.id })} className="font-semibold text-brand-700 hover:underline">{job.before?.billed || job.before?.paid ? 'Change it' : 'Put in what was already billed'}</button>
      </div>
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
