import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { ArrowRight, Receipt, Package, HardHat, TrendingUp, CheckCircle2, Plus } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Card, CardHeader, Button, Pill, Avatar, IconCircle, TextInput } from '@/tileos/components/ui/core'
import { MiniSteps, StackBar } from '@/tileos/components/ui/progress'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { installerOf } from '../upcoming'
import { pickInstaller } from '../flows2'
import { MONEY_STEPS, MONEY_KIND_LABEL, PO_STEPS, type MoneyItem } from '@/tileos/data/work'
import { pictureOf, LAST_WEEK } from '../progressbill'
import { InstallerPOCard } from '../field'
import { Section, Empty, Strip } from './kit'
import { HEAD_ROW, Group, BAND_LABEL } from '@/tileos/components/ui/page'
import { curRev, revTotal } from '@/tileos/data/estimates'
import { poRatio } from '../poratio'
import type { IPO } from '@/tileos/data/field'

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
    <button onClick={() => s.open({ t: 'money', id: m.id })} className="grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_7.5rem_11rem] items-center gap-6 border-b border-line-2 px-5 py-3 text-left transition-colors last:border-0 row-hover md:max-xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:max-xl:gap-x-6 md:max-xl:gap-y-1.5 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:gap-y-3 max-sm:px-4">
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
        <div className="text-[1rem] font-bold tnum text-ink">{m.amount ? fmtMoney(m.amount) : ''}</div>
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

/* Billing on a project — the same list as Estimates: one line that says it all on top (billed of the contract, paid —
 * and the one button: bill what's installed); then one list with the column names on top and a gray band for each
 * part — Bills, Contract — one line each: what · where it is · the date · how much. The installer's PO under it. */
const COLS = 'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_7.5rem_7.5rem] items-center gap-x-6'
/** one line: what · where it is · the date · how much (a phone: what and how much, where it is under them) */
const LINE = cn(COLS, 'min-h-12 w-full min-w-0 border-t border-line-2 px-5 py-2 text-left transition-colors row-hover max-sm:flex max-sm:flex-wrap max-sm:gap-x-3 max-sm:gap-y-0.5 max-sm:px-4')
/** the column names over the lines */
const HEAD = cn(HEAD_ROW, COLS, 'px-5 max-sm:hidden')
const NAME = 'min-w-0 flex-1 truncate text-[0.9375rem] text-ink'
const MID = 'flex min-w-0 items-center gap-2 text-[0.8125rem] max-sm:order-3 max-sm:basis-full max-sm:text-[0.75rem]'
const DATE = 'truncate text-right text-[0.8125rem] tnum text-muted max-sm:hidden'
const AMT = 'shrink-0 text-right text-[0.875rem] font-semibold tnum text-ink max-sm:order-2 max-sm:ml-auto'
/** where a bill is, in a word or two — the invoice, and how far it got */
function billWhere(m: MoneyItem): { text: string; cls: string } {
  const ref = m.ref ? (m.ref.startsWith('#') ? m.ref : `#${m.ref}`) : ''
  if (m.state === 'paid') return { text: [ref, 'Paid'].filter(Boolean).join(' · '), cls: 'font-medium text-[#2c8a5b]' }
  if (m.paid) return { text: [ref, `${fmtMoney(m.paid)} paid`].filter(Boolean).join(' · '), cls: 'text-ink-2' }
  const steps = MONEY_STEPS[m.kind]
  if (m.step < 0 || m.state === 'upcoming') return { text: m.due || 'Later', cls: 'text-muted' }
  if (!ref) return { text: 'Not invoiced yet', cls: 'font-medium text-warn-700' }
  return { text: [ref, steps[m.step] || ''].filter(Boolean).join(' · ') || '', cls: 'text-ink-2' }
}
/** a bill's date: when it was paid, when it's due, or when it went out */
function billDate(m: MoneyItem): string {
  if (m.state === 'paid') return m.date ? `Paid ${m.date}` : 'Paid'
  if (/^Due /.test(m.due || '')) return m.due!
  const sent = [...(m.log || [])].reverse().find((l) => /\bsent\b/i.test(l.text))?.date
  return sent ? `Sent ${sent}` : ''
}
export function MoneyTab({ job }: { job: Job }) {
  const s = useStore()
  const b = billingOf(job)
  const bills = s.money.filter((m) => m.jobId === job.id && m.kind !== 'change')
  const cos = s.money.filter((m) => m.jobId === job.id && m.kind === 'change')
  const ests = s.estimates.filter((e) => e.jobId === job.id)
  const before = job.before?.changes || 0
  const canChange = s.role !== 'accounting'
  const contract = b.contract + b.changes
  const pct = contract ? Math.min(100, Math.round((b.billed / contract) * 100)) : 0
  const paidPct = contract ? Math.min(100, Math.round((b.paid / contract) * 100)) : 0
  const anyContract = ests.length > 0 || cos.length > 0 || before > 0
  return (
    <div className="flex flex-col gap-4" data-billing-tab>
      {/* the one line, a slim bar under it — and the one thing to do */}
      <section className="rounded-[0.875rem] border border-line bg-white px-5 py-4 max-sm:px-4" data-money-strip>
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="text-[1rem] text-ink-2"><b className="text-[1.125rem] font-semibold tnum text-ink">{fmtMoney(b.billed)}</b> billed of <span className="font-semibold tnum text-ink">{fmtMoney(contract)}</span> <span className="font-semibold tnum text-ink" data-billed-pct>({pct}%)</span><span className="text-faint"> · </span><span className="tnum">{fmtMoney(b.paid)}</span> paid</div>
            <div className="mt-2 h-1.5 max-w-[32rem] overflow-hidden rounded-full bg-[#ece8e1]" title={`${pct}% billed · ${paidPct}% paid`}>
              <div className="relative h-full rounded-full bg-[#b9c7ee]" style={{ width: `${pct}%` }}><div className="absolute inset-y-0 left-0 rounded-full bg-brand-600" style={{ width: pct ? `${(paidPct / pct) * 100}%` : 0 }} /></div>
            </div>
            <div className="mt-1.5 text-[0.75rem] text-muted">{b.retainage ? <>{fmtMoney(b.retainage)} held back ({s.rules.retainage}%) until the end · </> : null}QuickBooks sends the bills</div>
          </div>
          {b.toBill > 0 && <Button variant="primary" className="max-sm:w-full" onClick={() => s.open({ t: 'progress', jobId: job.id, week: LAST_WEEK.key })}>Bill {fmtMoney(b.toBill)} now</Button>}
        </div>
      </section>

      {/* one list, like Estimates: the column names, then Bills and Contract, each under its own band */}
      <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white" data-money-list>
        <div className={HEAD}><span>What</span><span>Where it is</span><span className="text-right">Date</span><span className="text-right">Amount</span></div>
        <div data-bills>
          <Group label="Bills" count={bills.length} />
          {bills.map((m) => {
            const w = billWhere(m)
            return (
              <button key={m.id} onClick={() => s.open({ t: 'money', id: m.id })} className={LINE} data-bill={m.id}>
                <span className={NAME}>{m.title}</span>
                <span className={MID}>
                  <span className={cn('min-w-0 truncate', w.cls)}>{w.text}</span>
                  {m.action && m.state !== 'paid' && <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[0.75rem] font-semibold text-brand-700" data-bill-next>{m.action}</span>}
                </span>
                <span className={DATE}>{billDate(m)}</span>
                <span className={AMT}>{m.amount ? fmtMoney(m.amount) : ''}</span>
              </button>
            )
          })}
          {!bills.length && <div className="border-t border-line-2 px-5 py-3 text-[0.875rem] text-muted max-sm:px-4">Nothing billed on this project yet.</div>}
        </div>
        <div data-changes-table>
          <Group label="Contract" right={canChange ? <button type="button" onClick={() => s.open({ t: 'sitechange', jobId: job.id })} className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-700 hover:underline" data-add-co><Plus className="h-3.5 w-3.5" />Change order</button> : undefined} />
          {ests.map((e) => {
            const r = curRev(e)
            return (
              <button key={e.id} onClick={() => (e.revs.some((x) => x.sentOn) || e.status === 'approved' ? s.open({ t: 'estsend', id: e.id, sent: true }) : s.open({ t: 'estimate', id: e.id }))} className={LINE} data-est-line={e.id}>
                <span className={NAME}>Estimate {e.id}{e.revs.length > 1 ? ` · revision ${r?.n}` : ''}</span>
                <span className={cn(MID, e.status === 'approved' ? 'text-ink-2' : 'text-warn-700')}><span className="truncate">{e.status === 'approved' ? 'Approved' : 'Not approved yet'}</span></span>
                <span className={DATE}>{e.status === 'approved' && e.approvedOn ? e.approvedOn : ''}</span>
                <span className={AMT}>{fmtMoney(revTotal(r))}</span>
              </button>
            )
          })}
          {cos.map((m) => {
            const sent = [...(m.log || [])].reverse().find((l) => /\bsent\b/i.test(l.text))?.date
            return (
              <button key={m.id} onClick={() => s.open({ t: 'money', id: m.id })} className={LINE} data-co-line={m.id}>
                <span className={NAME}>{m.title}</span>
                <span className={cn(MID, m.step < 0 ? 'font-medium text-warn-700' : m.state === 'paid' ? 'font-medium text-[#2c8a5b]' : 'text-ink-2')}><span className="truncate">{m.state === 'paid' ? 'Paid' : m.step < 0 ? 'Waiting for the client’s yes' : m.state === 'waiting' ? 'Billed' : 'Approved'}</span></span>
                <span className={DATE}>{m.state === 'paid' && m.date ? `Paid ${m.date}` : sent ? `Sent ${sent}` : ''}</span>
                <span className={AMT}>{fmtMoney(m.amount || m.meta?.estimate || 0)}</span>
              </button>
            )
          })}
          {before > 0 && (
            <div className={cn(LINE, 'hover:bg-transparent')}>
              <span className={NAME}>Changes approved before Tile OS</span>
              <span className={cn(MID, 'text-ink-2')}><span className="truncate">Approved</span></span>
              <span className={DATE}></span>
              <span className={AMT}>{fmtMoney(before)}</span>
            </div>
          )}
          {!anyContract && <div className="border-t border-line-2 px-5 py-3 text-[0.875rem] text-muted max-sm:px-4">No estimate in the system for this project. It was priced before Tile OS.</div>}
          {anyContract && (
            <div className={cn(COLS, 'min-h-12 border-t border-line bg-white px-5 py-2 max-sm:flex max-sm:px-4')} data-contract-total>
              <span className="min-w-0 flex-1 text-[0.9375rem] font-semibold text-ink">Contract</span>
              <span className="max-sm:hidden" /><span className="max-sm:hidden" />
              <span className="shrink-0 text-right text-[0.9375rem] font-bold tnum text-ink">{fmtMoney(contract)}</span>
            </div>
          )}
        </div>
      </section>

      <InstallerSheet job={job} />

      <div className="flex flex-wrap items-center gap-2 px-1 text-[0.8125rem] text-muted">
        {job.before?.billed || job.before?.paid
          ? <>Before Tile OS: <b className="font-semibold tnum text-ink-2">{fmtMoney(job.before.billed)}</b> billed · <b className="font-semibold tnum text-ink-2">{fmtMoney(job.before.paid)}</b> paid · counted in.</>
          : 'Started before Tile OS?'}
        <button onClick={() => s.open({ t: 'billedbefore', jobId: job.id })} className="font-semibold text-brand-700 hover:underline">{job.before?.billed || job.before?.paid ? 'Change it' : 'Put in what was already billed'}</button>
      </div>
    </div>
  )
}

/* ---------------- the installer's PO against what we sell the work for ----------------
 * Side by side, line by line: what the estimate gets for each piece of work, what his PO pays for it, and the share.
 * The company's line (half, unless Settings says otherwise) is on the bar — a line over it is the one to look at.
 * Every number adds up: the rest of the estimate (materials, the general lines) is its own line. */
const IPO_COLS = 'grid grid-cols-[minmax(0,1.6fr)_7rem_7rem_4.5rem] items-center gap-x-6 max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3'
function InstallerSheet({ job }: { job: Job }) {
  const s = useStore()
  const ipo0: IPO | undefined = [...s.ipos].reverse().find((p) => p.jobId === job.id && p.status !== 'Rejected')
  /* a draft with nothing priced on it isn't a PO yet — it's who's on the job */
  const blank = !!ipo0 && ipo0.status === 'Draft' && !ipo0.lines.some((l) => (l.amount || 0) > 0) && !ipo0.changes.length
  const ipo = blank ? undefined : ipo0
  /* its own band, like Bills and Contract — the installer's circle, which PO, where it stands; the button on the right */
  const head = (right?: React.ReactNode) => (
    <header className="flex min-h-12 items-center gap-x-3 gap-y-0.5 border-b border-line-2 bg-[#f6f6f4] px-5 py-2 max-sm:px-4" data-band>
      <span className="flex min-w-0 flex-1 items-center gap-2.5 max-sm:flex-wrap max-sm:gap-y-0.5">
        <span className={BAND_LABEL}>Installer PO</span>
        {ipo && <span className="inline-flex min-w-0 items-center gap-2 text-[0.8125rem] text-ink-2 max-sm:basis-full"><Avatar who={ipo.crew} size={20} /><span className="min-w-0 truncate"><b className="font-medium text-ink">{PEOPLE[ipo.crew]?.name}</b> · {ipo.id}{ipo.rev ? ` · rev ${ipo.rev}` : ''} · <span className={ipo.status === 'Accepted' ? 'font-medium text-[#2c8a5b]' : ipo.status === 'Sent' ? 'font-medium text-warn-700' : 'text-muted'}>{ipo.status === 'Accepted' ? `accepted ${ipo.date}` : ipo.status === 'Sent' ? 'waiting for his OK' : 'draft, not sent'}</span></span></span>}
      </span>
      {right && <span className="flex shrink-0 items-center gap-2">{right}</span>}
    </header>
  )
  if (blank && ipo0) return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white" data-installer-sheet data-installer-blank>
      {head(<Button size="sm" onClick={() => s.open({ t: 'ipo', id: ipo0.id })}>Make his PO</Button>)}
      <div className="border-t border-line-2 px-5 py-3 text-[0.84375rem] text-ink-2 max-sm:px-4">{PEOPLE[ipo0.crew]?.name || 'The installer'} is on this job. No PO with prices yet. Make one when you’re ready; it isn’t sent until you send it.</div>
    </section>
  )
  if (!ipo) {
    /* before there's a PO: what his PO should stay under, from what we sell the work for */
    const r0 = poRatio(s, { jobId: job.id, lines: [], changes: [] })
    const line = r0.line
    const budget = r0.sold ? Math.floor((r0.sold * line) / 100) : 0
    /* he's on the job without a PO (a job already going, or a handshake) — make one when you're ready */
    const on = installerOf(s, job) as PersonKey | undefined
    const turned = [...s.ipos].reverse().find((p) => p.jobId === job.id)?.status === 'Rejected'
    if (on && PEOPLE[on] && !turned) return (
      <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white" data-installer-sheet data-installer-no-po>
        {head(<Button size="sm" onClick={() => pickInstaller(job.id, on)}>Make his PO</Button>)}
        <div className="border-t border-line-2 px-5 py-3 text-[0.84375rem] text-ink-2 max-sm:px-4">{PEOPLE[on].name} is on this job · no PO.{budget ? <> At {line}% of the estimate, his PO would stay under <b className="font-semibold tnum text-ink">{fmtMoney(budget)}</b>.</> : null}</div>
      </section>
    )
    return (
      <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white" data-installer-sheet>
        {head(<Button size="sm" onClick={() => s.open({ t: 'installerwin', jobId: job.id })}>Pick the installer</Button>)}
        <div className="border-t border-line-2 px-5 py-3 text-[0.84375rem] text-ink-2 max-sm:px-4" data-ipo-budget>{budget ? <>No installer PO yet. At {line}% of the estimate, his PO should stay under <b className="font-semibold tnum text-ink">{fmtMoney(budget)}</b> · it's drafted from the scope and shows here next to the estimate, line by line.</> : 'No installer PO yet. His PO is drafted from the scope, and it shows here next to the estimate.'}</div>
      </section>
    )
  }
  const r = poRatio(s, ipo)
  const tone = !r.sold ? 'neutral' : r.over ? 'bad' : r.pct > r.line - 5 ? 'warn' : 'ok'
  const pctCls = (pct?: number) => (pct == null ? 'text-faint' : pct > r.line ? 'font-semibold text-bad-600' : 'text-ink-2')
  const lineSold = r.lines.reduce((n, l) => n + (l.sold || 0), 0)
  /* each change order on his PO next to what the client pays for it */
  const cos = ipo.changes.map((c) => {
    const m = s.money.find((x) => x.jobId === job.id && x.kind === 'change' && x.title.startsWith(c.co))
    const sold = m ? m.amount || m.meta?.estimate || 0 : 0
    return { c, sold, pct: sold ? Math.round((c.amount / sold) * 100) : undefined, approved: !!m && m.step >= 0 }
  })
  /* approved change orders that aren't on his PO (materials, work by others): their own line, so it all adds up */
  const onPO = new Set(cos.map((x) => x.c.co))
  const otherCOs = s.money.filter((m) => m.jobId === job.id && m.kind === 'change' && m.step >= 0 && !onPO.has(m.title.split(' · ')[0])).reduce((n, m) => n + (m.amount || m.meta?.estimate || 0), 0)
  const rest = Math.max(0, r.estimate - lineSold)
  const row = (k: string, what: React.ReactNode, sold: number | null, his: number | null, pct?: number, sub?: string) => (
    <div key={k} className={cn(IPO_COLS, 'min-h-[2.75rem] border-t border-line-2 px-5 py-2 text-[0.875rem] max-sm:px-4')} data-ipo-line={k}>
      <span className="min-w-0">
        <span className="block truncate text-ink">{what}</span>
        {sub && <span className="block truncate text-[0.75rem] text-muted">{sub}</span>}
        <span className="block truncate text-[0.75rem] text-muted sm:hidden">{[sold != null ? `We sell it for ${fmtMoney(sold)}` : '', his != null ? `his PO ${fmtMoney(his)}` : ''].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="text-right tnum text-ink-2 max-sm:hidden">{sold != null ? fmtMoney(sold) : ''}</span>
      <span className="text-right tnum text-ink max-sm:hidden">{his != null ? fmtMoney(his) : ''}</span>
      <span className={cn('text-right tnum', pctCls(pct))}>{pct != null ? `${pct}%` : ''}</span>
    </div>
  )
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white" data-installer-sheet>
      {head(<Button size="sm" onClick={() => s.open({ t: 'ipo', id: ipo.id })}>{ipo.status === 'Accepted' ? 'Open his PO' : 'Adjust his PO'}</Button>)}
      {/* the one line: his PO's share of what we sell the work for, on a bar with the company's line */}
      <div className="px-5 py-3.5 max-sm:px-4" data-ratio>
        {r.sold ? (
          <>
            <div className="text-[0.9375rem] text-ink-2">His PO is <b className={cn('font-semibold tnum', tone === 'bad' ? 'text-bad-600' : 'text-ink')}>{r.pct}%</b> of the estimate<span className="text-faint"> · </span><span className="tnum">{fmtMoney(r.total)}</span> of <span className="tnum">{fmtMoney(r.sold)}</span><span className="text-faint"> · </span>keep it under {r.line}%</div>
            <div className="relative mt-2 h-1.5 max-w-[32rem] rounded-full bg-[#ece8e1]">
              <div className={cn('h-full rounded-full', tone === 'bad' ? 'bg-bad-500' : tone === 'warn' ? 'bg-warn-500' : 'bg-[#2c8a5b]')} style={{ width: `${Math.min(100, Math.max(2, r.pct))}%` }} />
              <span className="absolute -bottom-1 -top-1 w-[0.1875rem] rounded-full bg-ink" style={{ left: `calc(${r.line}% - 0.09375rem)` }} title={`The line: ${r.line}% of the estimate`} />
            </div>
          </>
        ) : <div className="text-[0.84375rem] text-muted">No estimate in the system to compare his PO with.</div>}
      </div>
      <div className={cn(HEAD_ROW, IPO_COLS, 'px-5 max-sm:hidden')}><span>Work</span><span className="text-right">We sell it for</span><span className="text-right">His PO</span><span className="text-right">Share</span></div>
      {ipo.lines.map((l, i) => row('l' + i, l.item, r.lines[i]?.sold || null, l.amount, r.lines[i]?.pct, l.qty))}
      {cos.map((x) => row(x.c.co, `${x.c.co} · ${x.c.text}`, x.sold || null, x.c.amount, x.pct, x.c.status === 'pending' ? 'Waiting for the client’s yes, not counted yet' : x.c.qty))}
      {r.sold > 0 && rest > 0 && row('rest', 'The rest of the estimate', rest, null, undefined, 'Materials and the general lines, not his work')}
      {otherCOs > 0 && row('otherco', 'Other approved change orders', otherCOs, null, undefined, 'Not on his PO')}
      <div className={cn(IPO_COLS, 'min-h-[2.75rem] border-t border-line bg-white px-5 py-2 text-[0.875rem] font-semibold max-sm:px-4')} data-ipo-total>
        <span className="min-w-0 text-ink-2">Total<span className="block truncate text-[0.75rem] font-normal text-muted sm:hidden">{r.sold ? `We sell it for ${fmtMoney(r.sold)} · his PO ${fmtMoney(r.total)}` : `His PO ${fmtMoney(r.total)}`}</span></span>
        <span className="text-right tnum text-ink max-sm:hidden">{r.sold ? fmtMoney(r.sold) : ''}</span>
        <span className="text-right tnum text-ink max-sm:hidden">{fmtMoney(r.total)}</span>
        <span className={cn('text-right tnum', tone === 'bad' ? 'text-bad-600' : 'text-ink')}>{r.sold ? `${r.pct}%` : ''}</span>
      </div>
    </section>
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
      `Saved · ${job.name} picks up from ${fmtMoney(num(billed))} billed`,
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
      sub={`${job.name}. For a project that was already going: what QuickBooks shows on it so far.`}
      footer={
        <>
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" onClick={save}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {money(billed, setBilled, 'Billed so far', 'Every invoice on it. The deposit too', true)}
        {money(paid, setPaid, 'Paid so far', 'What the client paid on those invoices')}
        {money(held, setHeld, 'Retainage held so far', 'Leave it empty if they don’t hold any')}
        <div className="rounded-xl bg-wash px-3.5 py-2.5 text-[0.8125rem] leading-snug text-ink-2">Set the walls and floors to where they are now in the Scope tab. From then on the daily updates move them, and each week’s bill is what got installed, less what’s billed here.</div>
      </div>
    </Modal>
  )
}
