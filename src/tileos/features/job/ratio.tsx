/* The installer's PO against our estimate — what we pay him next to what we sold the work for. It should stay under a
 * share of the estimate (half, unless Settings says otherwise). Shown big and plain wherever his PO shows:
 *   RatioBlock          — "Leo's PO is 38% of our estimate", the money, and a bar with the line on it
 *   InstallerVsEstimate — the same, then line by line: what we sold it for, his price, his share
 * Before there's a PO it says what to keep it under. */
import * as React from 'react'
import { HardHat } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Tip } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job } from '@/tileos/data/model'
import type { IPO } from '@/tileos/data/field'
import { revTotal } from '@/tileos/data/estimates'
import { poRatio, soldRev, LABOR_LINE, type Ratio } from '../poratio'
import { Section, Empty } from './kit'

/** the installer PO that counts on a project: the newest one he didn't turn down */
export const currentIPO = (s: Pick<Store, 'ipos'>, jobId: string): IPO | undefined => [...s.ipos].reverse().find((p) => p.jobId === jobId && p.status !== 'Rejected')
/** what we sold the work for, and the most his PO should come to */
export function budgetOf(s: Store, job: Job) {
  const sold = revTotal(soldRev(s, job.id)) || job.contract || 0
  const line = s.rules?.laborPct || LABOR_LINE
  return { sold, line, cap: Math.round((sold * line) / 100) }
}
const toneOf = (r: Ratio) => (r.over ? 'bad' : r.pct > r.line - 5 ? 'warn' : 'ok')
const TEXT = { bad: 'text-bad-700', warn: 'text-warn-700', ok: 'text-ok-700' }
const BAR = { bad: 'bg-bad-500', warn: 'bg-warn-500', ok: 'bg-ok-500' }

/** "Leo's PO is 38% of our estimate" — and the bar, with the line marked */
export function RatioBlock({ ipo, className }: { ipo: IPO; className?: string }) {
  const s = useStore()
  const r = poRatio(s, ipo)
  const who = PEOPLE[ipo.crew]?.short || 'His'
  if (!r.total) return <div className={cn('text-[0.875rem] font-semibold text-warn-700', className)}>{who}’s PO has no prices on it yet — open it and put his prices in, then it’s compared with our estimate.</div>
  if (!r.sold) return <div className={cn('text-[0.875rem] text-muted', className)}>{who}’s PO comes to <b className="font-semibold text-ink">{fmtMoney(r.total)}</b>. There’s no estimate to compare it with yet.</div>
  const tone = toneOf(r)
  const left = Math.round((r.sold * r.line) / 100) - r.total
  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[1rem] font-semibold text-ink">{who}’s PO is <span className={cn('font-bold', TEXT[tone])}>{r.pct}%</span> of our estimate</span>
        <span className="text-[0.8125rem] tnum text-muted">{fmtMoney(r.total)} of {fmtMoney(r.sold)}</span>
      </div>
      <div className="relative mt-2.5 h-3 rounded-full bg-wash-2">
        <div className={cn('h-full rounded-full transition-all', BAR[tone])} style={{ width: `${Math.min(100, Math.max(2, r.pct))}%` }} />
        <Tip label={`The line: ${r.line}% of our estimate`}><span className="absolute -bottom-1 -top-1 w-[0.1875rem] rounded-full bg-ink" style={{ left: `calc(${r.line}% - 0.09375rem)` }} /></Tip>
      </div>
      <div className={cn('mt-1.5 text-[0.78125rem]', r.over ? 'font-semibold text-bad-700' : 'text-muted')}>
        {r.over ? `Over the ${r.line}% line by ${fmtMoney(-left)}` : `Under the ${r.line}% line — ${fmtMoney(left)} of room left`}
      </div>
    </div>
  )
}

/** the full comparison — for the project's POs */
export function InstallerVsEstimate({ job }: { job: Job }) {
  const s = useStore()
  const ipo = currentIPO(s, job.id)
  const b = budgetOf(s, job)
  if (!ipo)
    return (
      <Section title="Installer vs our estimate" sub={b.sold ? `Our estimate ${fmtMoney(b.sold)} · his PO should stay under ${b.line}%` : 'No estimate to compare with yet'} action={<Button size="sm" icon={<HardHat />} onClick={() => s.open({ t: 'book', jobId: job.id })}>Book the installer</Button>}>
        <Empty>{b.sold ? <>No installer PO yet. Keep it under <b className="font-semibold text-ink">{fmtMoney(b.cap)}</b> — {b.line}% of our {fmtMoney(b.sold)}.</> : 'No installer PO yet.'}</Empty>
      </Section>
    )
  const r = poRatio(s, ipo)
  const accepted = ipo.status === 'Accepted' ? 'accepted' : ipo.status === 'Sent' ? `waiting for ${PEOPLE[ipo.crew]?.short}’s yes` : 'not sent yet'
  return (
    <Section title="Installer vs our estimate" sub={`${ipo.id} · ${PEOPLE[ipo.crew]?.name} · ${accepted}`} action={<Button size="sm" onClick={() => s.open({ t: 'ipo', id: ipo.id })}>Open his PO</Button>}>
      <RatioBlock ipo={ipo} className="px-5 py-4 max-sm:px-4" />
      {ipo.lines.length > 0 && (
        <div className="border-t border-line-2">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_5.5rem] gap-3 border-b border-line-2 px-5 py-1.5 text-[0.71875rem] font-semibold text-muted max-sm:grid-cols-[minmax(0,1fr)_6rem_4rem] max-sm:px-4">
            <span>Line</span><span className="text-right max-sm:hidden">We sold it for</span><span className="text-right">His price</span><span className="text-right">His share</span>
          </div>
          {ipo.lines.map((l, i) => {
            const x = r.lines[i]
            const over = x?.pct != null && x.pct > r.line
            return (
              <div key={i} className="grid min-h-[2.75rem] grid-cols-[minmax(0,1fr)_8rem_8rem_5.5rem] items-center gap-3 border-t border-line-2 px-5 py-2 first:border-t-0 max-sm:grid-cols-[minmax(0,1fr)_6rem_4rem] max-sm:px-4">
                <span className="min-w-0"><span className="block truncate text-[0.875rem] font-medium text-ink">{l.item}</span><span className="block truncate text-[0.75rem] text-muted">{l.qty}{l.rate ? ` · $${l.rate}/SF` : ''}</span></span>
                <span className="text-right text-[0.84375rem] tnum text-ink-2 max-sm:hidden">{x?.sold ? fmtMoney(x.sold) : '—'}</span>
                <span className="text-right text-[0.875rem] font-semibold tnum text-ink">{fmtMoney(l.amount)}</span>
                <span className={cn('text-right text-[0.84375rem] font-semibold tnum', over ? 'text-bad-600' : x?.pct != null ? 'text-ink-2' : 'text-faint')}>{x?.pct != null ? `${x.pct}%` : '—'}</span>
              </div>
            )
          })}
          {ipo.changes.filter((c) => c.status !== 'pending').map((c) => (
            <div key={c.co} className="grid min-h-[2.75rem] grid-cols-[minmax(0,1fr)_8rem_8rem_5.5rem] items-center gap-3 border-t border-line-2 px-5 py-2 max-sm:grid-cols-[minmax(0,1fr)_6rem_4rem] max-sm:px-4">
              <span className="min-w-0 truncate text-[0.875rem] text-ink">{c.co} · {c.text}</span>
              <span className="text-right text-[0.84375rem] text-faint max-sm:hidden">—</span>
              <span className="text-right text-[0.875rem] font-semibold tnum text-ink">+{fmtMoney(c.amount)}</span>
              <span className="text-right text-faint">—</span>
            </div>
          ))}
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_5.5rem] items-center gap-3 border-t border-line bg-[#fafbfc] px-5 py-2.5 max-sm:grid-cols-[minmax(0,1fr)_6rem_4rem] max-sm:px-4">
            <span className="text-[0.875rem] font-semibold text-ink">Total</span>
            <span className="text-right text-[0.875rem] font-semibold tnum text-ink-2 max-sm:hidden">{r.sold ? fmtMoney(r.sold) : '—'}</span>
            <span className="text-right text-[0.9375rem] font-bold tnum text-ink">{fmtMoney(r.total)}</span>
            <span className={cn('text-right text-[0.9375rem] font-bold tnum', r.sold ? TEXT[toneOf(r)] : 'text-faint')}>{r.sold ? `${r.pct}%` : '—'}</span>
          </div>
        </div>
      )}
    </Section>
  )
}
