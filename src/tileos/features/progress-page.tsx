/* Progress billing — what to bill each client for the week, worked out from the daily updates (the way installer pay is).
 * Billing → "Progress to bill": pick the week, see every project's work that week and what it can be billed;
 * one click makes the progress bill. A project's week opens in a window with every wall and floor that moved. */
import * as React from 'react'
import { Check, ChevronRight, Building2, ClipboardList, Receipt, Undo2, FileText, Info, TriangleAlert } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { Status, PX, STICKY_HEAD } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, type Tone } from '@/tileos/data/model'
import { smp } from '@/tileos/lib/save'
import { weekDays, weekRange } from './pay'
import { WeekPicker } from './pay-page'
import { openRoom } from './field'
import {
  billWeeks, weekBills, weekBill, weekOfKey, billTotal, cosDefault, makeBill, makeAllBills, undoBill, billStep,
  BILL_STATE, DEPOSIT_WAY, LAST_WEEK, type WeekBill,
} from './progressbill'

/* ---------------- the weeks, for the dropdown ---------------- */
type WTile = { key: string; label: string; tag?: string; tone: Tone & ('info' | 'warn' | 'bad' | 'ok' | 'neutral'); status: string; amount?: number }
function weekTiles(s: Store): WTile[] {
  return billWeeks(s)
    .map((w): WTile => {
      const rows = weekBills(s, w)
      const toBill = rows.filter((r) => r.state === 'tobill')
      const made = rows.filter((r) => r.state === 'billed')
      return {
        key: w.key,
        label: w.label,
        tag: w.current ? 'This week' : w.key === LAST_WEEK.key ? 'Last week' : undefined,
        tone: w.current ? 'info' : toBill.length ? 'warn' : made.length ? 'ok' : 'neutral',
        status: w.current ? 'So far' : toBill.length ? `${toBill.length} to bill` : made.length ? 'Billed' : rows.length ? 'Nothing to bill' : 'No work logged',
        amount: w.current ? rows.reduce((n, r) => n + r.weekAmount, 0) || undefined : toBill.length ? toBill.reduce((n, r) => n + billTotal(r), 0) : made.length ? made.reduce((n, r) => n + (r.bill?.amount || 0), 0) : undefined,
      }
    })
    .reverse()
}

/** what a row says about where it stands */
function rowStatus(r: WeekBill): { label: string; tone: Tone } {
  if (r.state === 'billed') return billStep(r.bill)
  if (r.state === 'later' && r.bill?.week) return { label: `Billed with ${weekRange(r.bill.week)}`, tone: 'neutral' }
  return BILL_STATE[r.state]
}
/** why there's nothing to bill, in a few words */
function nothingWhy(r: WeekBill) {
  if (r.state === 'deposit') return 'The deposit covers it'
  if (r.state === 'ahead') return 'Bills are caught up'
  if (r.state === 'final') return 'Goes on the final bill'
  if (r.state === 'noprice') return 'No approved estimate'
  if (r.state === 'later') return 'On the next week’s bill'
  return ''
}

/* ---------------- Billing → Progress to bill ---------------- */
export function ProgressToolbar({ week, onWeek }: { week: string; onWeek: (k: string) => void }) {
  const s = useStore()
  const tiles = weekTiles(s)
  const w = weekOfKey(week)
  const cur = tiles.find((t) => t.key === week) || tiles[tiles.length - 1]
  const rows = weekBills(s, w)
  const toBill = rows.filter((r) => r.state === 'tobill')
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
      <WeekPicker weeks={tiles} value={week} onChange={onWeek} />
      <Status tone={cur.tone}>{w.current ? 'Running — bill it Monday' : cur.status}</Status>
      <span className="ml-auto flex items-center gap-3 text-[0.8125rem] text-muted">
        <span>
          {rows.length} {rows.length === 1 ? 'project' : 'projects'} ·{' '}
          <b className="font-semibold tnum text-ink">{fmtMoney(w.current ? rows.reduce((n, r) => n + r.weekAmount, 0) : toBill.reduce((n, r) => n + billTotal(r), 0))}</b>
          {w.current ? ' installed so far' : ' to bill'}
        </span>
        {toBill.length > 1 && <Button size="sm" variant="primary" icon={<Check />} onClick={() => makeAllBills(week)}>Make all {toBill.length} bills</Button>}
      </span>
    </div>
  )
}

const COLS = 'grid grid-cols-[minmax(0,1fr)_7.5rem_10.5rem_8.5rem_10rem_9.25rem] items-center gap-4 max-xl:grid-cols-[minmax(0,1fr)_7.5rem_9.5rem_8.5rem_10rem] max-lg:grid-cols-[minmax(0,1fr)_auto]'
export function ProgressList({ week }: { week: string }) {
  const s = useStore()
  const w = weekOfKey(week)
  const rows = weekBills(s, w)
  return (
    <div>
      <div className={cn(COLS, 'border-b border-line-2 bg-wash py-2 text-[0.75rem] font-semibold text-muted max-lg:hidden', PX, STICKY_HEAD)}>
        <span>Project</span>
        <span className="text-right">Work this week</span>
        <span>Installed · billed</span>
        <span className="text-right">To bill</span>
        <span>Status</span>
        <span className="max-xl:hidden" />
      </div>
      {rows.map((r) => <BillLine key={r.jobId} r={r} only={rows.filter((x) => x.state === 'tobill').length === 1} />)}
      {!rows.length && <div className={cn('py-8 text-center text-[0.84375rem] text-muted', PX)}>{w.current ? 'No daily updates yet this week — it fills in as the site manager sends them.' : 'No work logged that week.'}</div>}
      <div className={cn('flex items-start gap-2 border-t border-line-2 bg-wash/60 py-3 text-[0.78125rem] leading-snug text-muted', PX)}>
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          What got installed (from the daily updates), less {s.rules.retainage}% retainage and what’s already billed. The deposit comes off {DEPOSIT_WAY[s.rules.depositOff || 'first'].label.toLowerCase()}.{smp(' Sample amounts.')}
        </span>
      </div>
    </div>
  )
}

/** one project's week. "Make the bill" is blue only when it's the only one — with more, "Make all" up top is the blue one */
function BillLine({ r, only }: { r: WeekBill; only?: boolean }) {
  const s = useStore()
  const job = s.jobs[r.jobId]
  if (!job) return null
  const st = rowStatus(r)
  const open = () => s.open({ t: 'progress', jobId: r.jobId, week: r.week.key })
  const cos = cosDefault(r.cos)
  const total = billTotal(r)
  const rooms = new Set(r.lines.map((l) => l.room)).size
  const billedPct = r.contract ? Math.min(100, Math.round((r.before / r.contract) * 100)) : 0
  return (
    <div role="button" aria-label={`${job.name} — open the week`} tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open() }} className={cn(COLS, 'min-h-[3.5rem] cursor-pointer border-t border-line-2 bg-white py-2.5 transition-colors first:border-t-0 hover:bg-[#f7f5f0]', PX)}>
      <span className="min-w-0">
        <span className="block truncate text-[0.875rem] font-semibold text-ink">{job.name}</span>
        <span className="block truncate text-[0.78125rem] text-muted">
          {job.client}
          {r.days ? ` · ${r.days} ${r.days === 1 ? 'day' : 'days'} · ${rooms} ${rooms === 1 ? 'room' : 'rooms'}` : ' · nothing moved'}
          <span className="lg:hidden"> · {st.label}</span>
        </span>
      </span>
      <span className="text-right text-[0.84375rem] tnum text-ink-2 max-lg:hidden">{r.weekAmount ? fmtMoney(r.weekAmount) : '—'}</span>
      <span className="min-w-0 max-lg:hidden">
        <span className="flex h-1.5 overflow-hidden rounded-full bg-wash-2">
          <span className="h-full bg-brand-500" style={{ width: `${billedPct}%` }} />
          <span className="h-full bg-warn-300" style={{ width: `${Math.max(0, Math.min(100, r.pct) - billedPct)}%` }} />
        </span>
        <span className="mt-1 block truncate text-[0.75rem] text-muted"><b className="font-semibold text-ink-2">{r.pct}%</b> in · {billedPct}% billed</span>
      </span>
      <span className="text-right">
        {r.state === 'tobill' ? (
          <>
            <span className="block text-[0.9375rem] font-bold tnum text-ink">{fmtMoney(total)}</span>
            {cos.length > 0 && <span className="block truncate text-[0.75rem] text-muted">with {cos.map((c) => c.title.split(' · ')[0]).join(', ')}</span>}
          </>
        ) : r.state === 'billed' && r.bill ? (
          <span className="block text-[0.875rem] font-semibold tnum text-ink-2">{fmtMoney(r.bill.amount || 0)}</span>
        ) : r.state === 'running' ? (
          <span className="block text-[0.8125rem] text-muted">Monday</span>
        ) : (
          <span className="block truncate text-[0.8125rem] text-faint">{nothingWhy(r) || '—'}</span>
        )}
      </span>
      <span className="max-lg:hidden"><Status tone={st.tone}>{st.label}</Status></span>
      <span className="flex justify-end max-xl:hidden" onClick={(e) => e.stopPropagation()}>
        {r.state === 'tobill' ? <Button size="sm" variant={only ? 'primary' : undefined} icon={<Receipt />} onClick={() => makeBill(r.jobId, r.week.key)}>Make the bill</Button>
          : r.bill && (r.state === 'billed' || r.state === 'later') ? <Button size="sm" variant="ghost" icon={<FileText />} onClick={() => s.open({ t: 'money', id: r.bill!.id })}>Open the bill</Button>
            : <Button size="sm" variant="ghost" onClick={open}>See the week</Button>}
      </span>
    </div>
  )
}

/* ================= one project's week ================= */
export function ProgressModal({ jobId, week: wk, level }: { jobId: string; week?: string; level: number }) {
  const s = useStore()
  const week = weekOfKey(wk || LAST_WEEK.key)
  const r = weekBill(s, jobId, week)
  const job = s.jobs[jobId]
  const [coIds, setCoIds] = React.useState<string[]>(() => cosDefault(r.cos).map((c) => c.id))
  if (!job) return null
  const days = weekDays(week)
  const rooms: { room: string; amount: number; lines: WeekBill['lines'] }[] = []
  r.lines.forEach((l) => {
    let g = rooms.find((x) => x.room === l.room)
    if (!g) rooms.push((g = { room: l.room, amount: 0, lines: [] }))
    g.amount += l.amount
    g.lines.push(l)
  })
  const own = r.state === 'billed' && r.bill?.bill?.week === week.key ? r.bill : undefined
  const b = own?.bill
  const pick = r.cos.filter((c) => coIds.includes(c.id))
  const total = r.due + pick.reduce((n, c) => n + (c.amount || 0), 0)
  const canBill = ['tobill', 'deposit', 'ahead'].includes(r.state) && total > 0
  const est = s.estimates.find((e) => e.jobId === jobId && e.status === 'approved')
  const st = rowStatus(r)
  const header = (
    <div className="border-b border-line px-7 pb-4 pt-5 pr-16 max-sm:px-4">
      <div className="flex items-start gap-4 max-md:flex-col">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="inline-flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 max-sm:h-11 max-sm:w-11"><Building2 className="h-6 w-6" /></span>
          <div className="min-w-0">
            <div className="text-[0.8125rem] font-medium text-muted">Progress billing · week of {week.label}</div>
            <h2 className="truncate text-[1.5rem] font-bold tracking-[-0.02em] text-ink max-sm:text-[1.25rem]">{job.name}</h2>
            <div className="mt-0.5 truncate text-[0.84375rem] text-muted">{job.client} · {r.days ? `${r.days} ${r.days === 1 ? 'day' : 'days'} of daily updates` : 'nothing moved that week'}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-stretch gap-3 max-md:w-full">
          <Figure label="Work done this week" value={fmtMoney(r.weekAmount)} sub={`${r.pct}% of the contract in`} />
          <Figure label={own ? 'Billed' : week.current ? 'To bill Monday' : 'To bill'} value={own ? fmtMoney(own.amount || 0) : week.current ? '—' : fmtMoney(canBill || r.state === 'tobill' ? total : 0)} sub={own ? billStep(own).label : week.current ? 'The week isn’t over' : 'After retainage and earlier bills'} strong={!own && !week.current} />
        </div>
      </div>
      {!own && !week.current && r.state !== 'tobill' && (
        <div className={cn('mt-3.5 flex items-start gap-3 rounded-xl border px-4 py-2.5', r.state === 'noprice' ? 'border-bad-100 bg-bad-50' : 'border-line bg-wash')}>
          {r.state === 'noprice' ? <TriangleAlert className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-bad-600" /> : <Info className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-muted" />}
          <div className="min-w-0 text-[0.875rem] leading-snug text-ink-2">
            {r.state === 'deposit' && <><b className="font-semibold text-ink">Nothing to bill yet — the deposit covers it.</b> The work in so far, less retainage, is still less than what’s billed with the deposit. Bills start once the work passes it.</>}
            {r.state === 'ahead' && <><b className="font-semibold text-ink">Nothing to bill — the bills are caught up.</b> What’s billed already covers the work in, less retainage.</>}
            {r.state === 'later' && r.bill && <><b className="font-semibold text-ink">Billed with the week of {weekRange(r.bill.week || r.bill.bill?.week || week.key)}.</b> That bill took in this week’s work too.</>}
            {r.state === 'final' && <><b className="font-semibold text-ink">The rest goes on the final bill.</b> The final bill is made — no more progress bills on this project.</>}
            {r.state === 'noprice' && <><b className="font-semibold text-bad-700">No approved estimate or contract amount.</b> There’s nothing to bill the work against — approve the estimate (or put in the contract amount) and it fills in.</>}
          </div>
        </div>
      )}
    </div>
  )
  const footer = own ? (
    <>
      <span className="inline-flex items-center gap-2 text-[0.84375rem] font-medium text-ok-700"><Check className="h-4 w-4" />{own.title.split(' · ')[0]} · {billStep(own).label}</span>
      {own.step <= 0 && own.state !== 'paid' && <Button className="ml-auto max-sm:ml-0 max-sm:flex-1" variant="ghost" icon={<Undo2 />} onClick={() => undoBill(own.id)}>Take it back</Button>}
      <Button className={cn('max-sm:flex-1', !(own.step <= 0 && own.state !== 'paid') && 'ml-auto')} variant="primary" icon={<FileText />} onClick={() => s.open({ t: 'money', id: own.id })}>Open the bill</Button>
    </>
  ) : week.current ? (
    <span className="text-[0.84375rem] text-muted">The week isn’t over — it grows with every daily update and is ready to bill Monday.</span>
  ) : r.state === 'later' && r.bill ? (
    <>
      <span className="text-[0.84375rem] text-muted">Billed with the week of {weekRange(r.bill.week || week.key)}.</span>
      <Button className="ml-auto" icon={<FileText />} onClick={() => s.open({ t: 'money', id: r.bill!.id })}>Open that bill</Button>
    </>
  ) : canBill ? (
    <>
      <span className="text-[0.84375rem] text-muted">It goes to the PM to check, then to {job.client || 'the client'}.</span>
      <Button className="ml-auto max-sm:ml-0 max-sm:w-full" variant="primary" icon={<Receipt />} onClick={() => makeBill(jobId, week.key, coIds)}>{r.due ? 'Make the progress bill' : 'Bill the change orders'} · {fmtMoney(total)}</Button>
    </>
  ) : r.state === 'noprice' ? (
    <>
      <span className="text-[0.84375rem] text-muted">Nothing can be billed until the project has a price.</span>
      <Button className="ml-auto" onClick={() => s.open({ t: 'job', id: jobId, tab: 'money' })}>Open the project</Button>
    </>
  ) : (
    <span className="text-[0.84375rem] text-muted">Nothing to bill for this week.</span>
  )
  return (
    <Modal level={level} size="xl" onClose={s.close} header={header} footer={footer} title={`${job.name} · ${week.label}`} bodyClass="px-7 py-4 max-sm:px-4">
      <div className="grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-6 max-lg:grid-cols-1">
        {/* every wall and floor that moved, day by day, and what it's worth */}
        <div className="min-w-0 overflow-hidden rounded-2xl border border-line">
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(6,3.25rem)_5.5rem_5.5rem] items-center border-b border-line bg-wash px-4 py-1.5 text-[0.75rem] font-semibold text-muted max-md:grid-cols-[minmax(0,1fr)_5.5rem]">
            <span>Room · wall or floor</span>
            {days.map((d) => <span key={d.date} className="text-center leading-tight max-md:hidden"><span className="block">{d.head}</span><span className="block font-medium text-faint">{d.num}</span></span>)}
            <span className="text-right max-md:hidden">Worth</span>
            <span className="text-right">This week</span>
          </div>
          {rooms.map((g, gi) => (
            <div key={g.room} className={cn(gi > 0 && 'border-t border-line')}>
              <button onClick={() => openRoom(jobId, g.room, 'log')} className="group flex w-full items-center gap-3 px-4 pb-0.5 pt-2 text-left">
                <span className="min-w-0 flex-1 truncate text-[0.875rem] font-bold text-ink group-hover:text-brand-700">
                  {g.room}
                  <ChevronRight className="ml-0.5 inline h-3.5 w-3.5 text-faint opacity-0 transition group-hover:opacity-100" />
                </span>
                <span className="w-[5.5rem] shrink-0 text-right text-[0.84375rem] font-semibold tnum text-ink">{fmtMoney(g.amount)}</span>
              </button>
              {g.lines.map((x) => (
                <div key={x.surface} className="grid grid-cols-[minmax(0,1fr)_repeat(6,3.25rem)_5.5rem_5.5rem] items-center px-4 py-1 text-[0.84375rem] max-md:grid-cols-[minmax(0,1fr)_5.5rem]">
                  <span className="flex min-w-0 items-baseline gap-2 pl-3 max-md:flex-col max-md:gap-0">
                    <span className="truncate text-ink-2">{x.surface}</span>
                    <span className="shrink-0 text-[0.75rem] tnum text-muted">{x.from}% → {x.to}%</span>
                  </span>
                  {days.map((d) => (
                    <span key={d.date} className="flex justify-center max-md:hidden">
                      {x.byDay[d.date] ? <span className="inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded-md bg-brand-50 px-1 text-[0.75rem] font-semibold tnum text-brand-700">+{x.byDay[d.date]}%</span> : <span className="h-1 w-1 rounded-full bg-line" />}
                    </span>
                  ))}
                  <span className="text-right tnum text-muted max-md:hidden">{x.worth ? fmtMoney(x.worth) : '—'}</span>
                  <span className="text-right tnum text-ink">{x.worth ? fmtMoney(x.amount) : '—'}</span>
                </div>
              ))}
              <div className="h-1" />
            </div>
          ))}
          {!rooms.length && <div className="px-4 py-6 text-center text-[0.84375rem] text-muted">Nothing moved on this project that week.</div>}
          <div className="flex items-center justify-between border-t border-line bg-wash px-4 py-2.5 text-[0.875rem] font-bold text-ink">
            <span>Work done this week</span>
            <span className="tnum">{fmtMoney(r.weekAmount)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* how the bill adds up */}
          <section className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[0.875rem] font-bold text-ink">How the bill adds up</span>
              {est && <button onClick={() => s.open({ t: 'estimate', id: est.id })} className="text-[0.78125rem] font-semibold text-brand-600 hover:underline">{est.id}</button>}
            </div>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-wash-2">
              <span className="bg-ok-500" style={{ width: `${pctOf(b ? b.before : r.before, r.contract)}%` }} />
              <span className="bg-brand-500" style={{ width: `${pctOf(b ? b.progress : r.due, r.contract)}%` }} />
              <span className="bg-[#c9d1dc]" style={{ width: `${pctOf(b ? b.held : r.held, r.contract)}%` }} />
            </div>
            <dl className="mt-3 flex flex-col gap-1.5 text-[0.84375rem]">
              <Line label="Contract" value={fmtMoney(r.contract)} />
              <Line label={`Installed through ${b ? b.through : r.through} · ${b ? b.pct : r.pct}%`} value={fmtMoney(b ? b.installed : r.installed)} strong />
              <Line label={`Less retainage ${b ? b.retainagePct : r.retainagePct}%`} value={`−${fmtMoney(b ? b.held : r.held)}`} dot="bg-[#c9d1dc]" />
              {(b ? b.credit : r.credit) > 0 && <Line label="Less the deposit’s share" value={`−${fmtMoney(b ? b.credit : r.credit)}`} />}
              <Line label="Less billed before" value={`−${fmtMoney(b ? b.before : r.before)}`} dot="bg-ok-500" />
              {!b && r.bills.map((x) => <Line key={x.label} sub label={x.label} value={fmtMoney(x.amount)} onClick={x.id ? () => s.open({ t: 'money', id: x.id }) : () => s.open({ t: 'billedbefore', jobId })} />)}
              {!b && !job.before?.billed && <button onClick={() => s.open({ t: 'billedbefore', jobId })} className="self-start pl-4 text-[0.75rem] font-semibold text-brand-600 hover:underline">Billed some of it before Tile OS?</button>}
              <Line label="Progress to bill" value={fmtMoney(b ? b.progress : r.due)} dot="bg-brand-500" strong top />
            </dl>
            {(b ? b.cos.length > 0 : r.cos.length > 0) && (
              <div className="mt-3 border-t border-line-2 pt-3">
                <div className="text-[0.78125rem] font-semibold text-muted">Approved change orders{b ? ' on this bill' : ' — bill them with it'}</div>
                <div className="mt-1.5 flex flex-col gap-1">
                  {b
                    ? b.cos.map((c) => <Line key={c.id} label={c.title} value={`+${fmtMoney(c.amount)}`} />)
                    : r.cos.map((c) => {
                        const on = coIds.includes(c.id)
                        return (
                          <label key={c.id} className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1 text-[0.84375rem] hover:bg-wash', !canBillCOs(r) && 'pointer-events-none opacity-50')}>
                            <input type="checkbox" checked={on} onChange={() => setCoIds((xs) => (on ? xs.filter((x) => x !== c.id) : [...xs, c.id]))} className="mt-0.5 h-4 w-4 shrink-0 accent-[#2650cf]" />
                            <span className="min-w-0 flex-1 leading-snug text-ink-2">{c.title}{/final/i.test(`${c.action} ${c.note}`) ? <span className="block text-[0.75rem] text-muted">Was set to go on the final bill</span> : null}</span>
                            <span className="shrink-0 font-semibold tnum text-ink">+{fmtMoney(c.amount || 0)}</span>
                          </label>
                        )
                      })}
                </div>
              </div>
            )}
            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-2.5">
              <span className="text-[0.875rem] font-bold text-ink">{own ? 'This bill' : 'This bill comes to'}</span>
              <span className="text-[1.125rem] font-bold tnum text-ink">{fmtMoney(own ? own.amount || 0 : canBill || r.state === 'tobill' ? total : 0)}</span>
            </div>
          </section>
          <div className="rounded-2xl bg-wash p-4">
            <div className="flex items-center gap-2 text-[0.84375rem] font-bold text-ink"><ClipboardList className="h-4 w-4 text-muted" />Where it comes from</div>
            <div className="mt-1.5 text-[0.8125rem] leading-snug text-ink-2">The site manager’s daily updates — how far each wall and floor moved — times what each one is worth on {est ? `the approved estimate (${est.id})` : 'the contract'}.</div>
            {rooms.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {rooms.map((g) => <button key={g.room} onClick={() => openRoom(jobId, g.room, 'log')} className="rounded-full border border-line bg-white px-2.5 py-1 text-[0.78125rem] font-medium text-ink-2 hover:border-brand-200 hover:text-brand-700">{g.room}</button>)}
              </div>
            )}
          </div>
          <span className="sr-only">{st.label}</span>
        </div>
      </div>
    </Modal>
  )
}
const canBillCOs = (r: WeekBill) => ['tobill', 'deposit', 'ahead'].includes(r.state)
const pctOf = (n: number, of: number) => (of ? Math.max(0, Math.min(100, (n / of) * 100)) : 0)

function Figure({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={cn('min-w-[10rem] rounded-xl border px-4 py-2.5 max-md:flex-1', strong ? 'border-brand-100 bg-brand-50' : 'border-line bg-wash')}>
      <div className="text-[0.75rem] font-semibold text-muted">{label}</div>
      <div className={cn('text-[1.5rem] font-bold leading-tight tnum', strong ? 'text-brand-700' : 'text-ink')}>{value}</div>
      {sub && <div className="truncate text-[0.75rem] text-muted">{sub}</div>}
    </div>
  )
}
function Line({ label, value, dot, strong, sub, top, onClick }: { label: string; value: string; dot?: string; strong?: boolean; sub?: boolean; top?: boolean; onClick?: () => void }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', top && 'mt-1 border-t border-line-2 pt-2', sub && 'pl-4 text-[0.78125rem]')}>
      <dt className={cn('inline-flex min-w-0 items-center gap-2', sub ? 'text-muted' : 'text-ink-2', strong && 'font-semibold text-ink')}>
        {dot && <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />}
        {onClick ? <button onClick={onClick} className="truncate text-left hover:text-brand-700 hover:underline">{label}</button> : <span className="truncate">{label}</span>}
      </dt>
      <dd className={cn('shrink-0 tnum', strong ? 'font-bold text-ink' : sub ? 'text-muted' : 'font-medium text-ink-2')}>{value}</dd>
    </div>
  )
}
