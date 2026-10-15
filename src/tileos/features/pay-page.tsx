/* Installer pay — pick the week from the dropdown (this week, last week, the weeks before), see every installer in it.
 * Each week is the site manager's daily updates × the rates on the installer's PO; his bill sits next to it. */
import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { ArrowRight, Check, HardHat, MessageCircleQuestion, Undo2, TriangleAlert, ClipboardList, ChevronRight, ChevronLeft, ChevronDown, CircleCheckBig, FileText, CalendarDays } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Modal, Pop } from '@/tileos/components/ui/overlay'
import { Page, Status, Row, Col, Meta, PX } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type PersonKey } from '@/tileos/data/model'
import { PAY_WEEKS, THIS_WEEK, PAY_STATE, payRows, payRow, payGrid, poBalance, mismatchWhy, approvePay, askAboutPay, undoPay, weekDays, payOpen, paidWeeks, type PayRow, type PaidRow } from './pay'
import { openRoom } from './field'

const jobsLabel = (s: Store, r: PayRow) => (r.calc.jobs.length === 1 ? s.jobs[r.calc.jobs[0]]?.name : r.calc.jobs.length ? `${r.calc.jobs.length} projects` : '—')
type Tone = 'info' | 'warn' | 'bad' | 'ok' | 'neutral'
type WeekTile = { key: string; label: string; tag?: string; tone: Tone; status: string; amount?: number; kind: 'paid' | 'live' | 'now'; rows: PayRow[]; paid: PaidRow[] }
const TONE_TXT: Record<Tone, string> = { info: 'text-brand-700', warn: 'text-warn-700', bad: 'text-bad-700', ok: 'text-ok-700', neutral: 'text-muted' }
const TONE_DOT: Record<Tone, string> = { info: 'bg-brand-500', warn: 'bg-warn-500', bad: 'bg-bad-500', ok: 'bg-ok-500', neutral: 'bg-faint' }
const isDone = (r: PayRow) => r.state === 'approved' || r.state === 'paid'

/** every week, oldest first: the paid weeks before, the weeks from the daily updates, and this week so far */
export function payWeekTiles(s: Store): WeekTile[] {
  const live = [...PAY_WEEKS].reverse().map((w): WeekTile => {
    const rows = payRows(s, w)
    const open = rows.filter((r) => !isDone(r))
    const off = rows.some((r) => r.state === 'check' || r.state === 'asked')
    const allPaid = rows.length > 0 && rows.every((r) => r.state === 'paid')
    return {
      key: w.key, label: w.label, tag: w.key === PAY_WEEKS[0].key ? 'Last week' : undefined, kind: 'live', rows, paid: [],
      tone: !rows.length ? 'neutral' : !open.length ? 'ok' : off ? 'bad' : 'warn',
      status: !rows.length ? 'Nobody worked' : allPaid ? 'Paid' : !open.length ? 'Approved' : off ? 'Bill doesn’t match' : 'To approve',
      amount: rows.length ? (open.length ? open : rows).reduce((n, r) => n + r.owe, 0) : undefined,
    }
  })
  const now = payRows(s, THIS_WEEK)
  return [
    ...paidWeeks(s).map((h): WeekTile => ({ key: h.key, label: h.label, kind: 'paid', tone: h.rows.length ? 'ok' : 'neutral', status: h.rows.length ? 'Paid' : 'Nobody worked', amount: h.rows.length ? h.total : undefined, rows: [], paid: h.rows })),
    ...live,
    { key: THIS_WEEK.key, label: THIS_WEEK.label, tag: 'This week', kind: 'now', tone: 'info', status: 'So far', amount: now.reduce((n, r) => n + r.calc.total, 0), rows: now, paid: [] },
  ]
}

export function PayPage() {
  const s = useStore()
  const tiles = payWeekTiles(s)
  const lastOpen = payRows(s, PAY_WEEKS[0]).some((r) => !isDone(r))
  const [sel, setSel] = React.useState(lastOpen ? PAY_WEEKS[0].key : THIS_WEEK.key)
  const w = tiles.find((t) => t.key === sel) || tiles[tiles.length - 1]
  const n = w.kind === 'paid' ? w.paid.length : w.rows.length
  const total = w.kind === 'paid' ? w.paid.reduce((x, r) => x + r.total, 0) : w.kind === 'now' ? w.rows.reduce((x, r) => x + r.calc.total, 0) : w.rows.reduce((x, r) => x + r.owe, 0)
  const toApprove = w.kind === 'live' ? w.rows.filter((r) => !isDone(r) && r.state !== 'asked') : []
  return (
    <Page
      title="Installer pay"
      sub="Daily updates × the rates on each installer’s PO = what he earns. Approve the week and it’s paid Friday"
      toolbar={
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <WeekPicker weeks={tiles} value={w.key} onChange={setSel} />
          <Status tone={w.tone}>{w.kind === 'now' ? 'Running — approve it Monday' : w.status}</Status>
          <span className="ml-auto flex items-center gap-3 text-[0.8125rem] text-muted">
            <span>{n} {n === 1 ? 'installer' : 'installers'} · <b className="font-semibold tnum text-ink">{fmtMoney(total)}</b>{w.kind === 'now' ? ' so far' : ''}</span>
            {toApprove.length > 1 && toApprove.every((r) => r.state === 'ready') && <Button size="sm" variant="primary" icon={<Check />} onClick={() => toApprove.forEach((r) => approvePay(r.crew, w.key))}>Approve all {toApprove.length}</Button>}
          </span>
        </div>
      }
    >
      {w.kind === 'paid' ? (
        <div>
          <div className={cn('grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_8.125rem_10rem_8.125rem] items-center gap-3 border-b border-line-2 bg-wash py-2 text-[0.75rem] font-semibold text-muted max-lg:hidden', PX)}>
            <span>Installer</span><span>Project</span><span className="text-right">Paid</span><span>Status</span><span />
          </div>
          {w.paid.map((r) => <PaidLine key={r.crew} r={r} />)}
          {!w.paid.length && <div className={cn('py-8 text-center text-[0.84375rem] text-muted', PX)}>Nobody worked that week.</div>}
        </div>
      ) : (
        <div>
          <div className={cn('grid grid-cols-[minmax(0,1fr)_4.5rem_5.75rem_8.125rem_8.125rem_10.625rem_10rem] items-center gap-3 border-b border-line-2 bg-wash py-2 text-[0.75rem] font-semibold text-muted max-lg:hidden', PX)}>
            <span>Installer</span><span className="text-right">Days</span><span className="text-right">Work done</span><span className="text-right">From the updates</span><span className="text-right">His bill</span><span>Status</span><span />
          </div>
          {w.rows.map((r) => <PayLine key={r.crew} r={r} weekKey={w.key} />)}
          {!w.rows.length && <div className={cn('py-8 text-center text-[0.84375rem] text-muted', PX)}>{w.kind === 'now' ? 'No daily updates yet this week — it fills in as the site manager sends them.' : 'Nobody worked that week.'}</div>}
        </div>
      )}
    </Page>
  )
}

/** the week, from a dropdown: newest first, this week on top — arrows step one week */
export function WeekPicker({ weeks, value, onChange }: { weeks: Pick<WeekTile, 'key' | 'label' | 'tag' | 'tone' | 'status' | 'amount'>[]; value: string; onChange: (k: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const i = weeks.findIndex((x) => x.key === value)
  const cur = weeks[i]
  const list = [...weeks].reverse()
  const listRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }), 20)
    return () => window.clearTimeout(t)
  }, [open])
  const step = (d: number) => { const j = i + d; if (j >= 0 && j < weeks.length) onChange(weeks[j].key) }
  return (
    <div className="flex items-center gap-1">
      <button aria-label="Week before" disabled={i <= 0} onClick={() => step(-1)} className="inline-flex h-9 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-wash disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
      <Pop
        open={open}
        onOpenChange={setOpen}
        width={340}
        trigger={
          <button aria-label="Pick a week" className="inline-flex h-9 min-w-[14.375rem] items-center gap-2 rounded-[0.625rem] border border-line bg-white pl-3 pr-2.5 text-left text-[0.875rem] shadow-xs transition hover:border-[#cbd1d9]">
            <CalendarDays className="h-4 w-4 shrink-0 text-faint" />
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{cur.label}{cur.tag ? <span className="font-normal text-muted"> · {cur.tag}</span> : null}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
          </button>
        }
      >
        <div ref={listRef} role="listbox" aria-label="Weeks" className="scroll-soft -m-4 max-h-[min(22.5rem,60vh)] overflow-y-auto p-1.5">
          {list.map((x) => {
            const on = x.key === value
            return (
              <button key={x.key} role="option" aria-selected={on} onClick={() => { onChange(x.key); setOpen(false) }} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors', on ? 'bg-brand-50' : 'hover:bg-wash')}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink">{x.label}{x.tag && <span className="font-normal text-muted"> · {x.tag}</span>}</span>
                  <span className={cn('mt-0.5 flex items-center gap-1.5 text-[0.78125rem] font-medium', TONE_TXT[x.tone])}><span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[x.tone])} />{x.status}</span>
                </span>
                {x.amount != null && <span className="shrink-0 text-[0.875rem] font-semibold tnum text-ink">{fmtMoney(x.amount)}</span>}
                {on ? <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} /> : <span className="w-4 shrink-0" />}
              </button>
            )
          })}
        </div>
      </Pop>
      <button aria-label="Week after" disabled={i >= weeks.length - 1} onClick={() => step(1)} className="inline-flex h-9 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-wash disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
    </div>
  )
}

function PayLine({ r, weekKey }: { r: PayRow; weekKey: string }) {
  const s = useStore()
  const st = PAY_STATE[r.state]
  const open = () => s.open({ t: 'pay', crew: r.crew, week: weekKey })
  return (
    <div role="button" aria-label={`${PEOPLE[r.crew].name} — open his week`} tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open() }} className={cn('grid min-h-[3.25rem] cursor-pointer grid-cols-[minmax(0,1fr)_4.5rem_5.75rem_8.125rem_8.125rem_10.625rem_10rem] items-center gap-3 border-t border-line-2 bg-white py-2 transition-colors first:border-t-0 hover:bg-[#f7f8fa] max-lg:grid-cols-[minmax(0,1fr)_auto]', PX)}>
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar who={r.crew} size={28} />
        <span className="min-w-0">
          <span className="block truncate text-[0.875rem] font-semibold text-ink">{PEOPLE[r.crew].name}</span>
          <span className="block truncate text-[0.78125rem] text-muted">{jobsLabel(s, r)}<span className="lg:hidden"> · {st.label}</span></span>
        </span>
      </span>
      <span className="text-right text-[0.84375rem] tnum text-ink-2 max-lg:hidden">{r.calc.days} {r.calc.days === 1 ? 'day' : 'days'}</span>
      <span className="text-right text-[0.84375rem] tnum text-ink-2 max-lg:hidden">{r.calc.sf ? `${r.calc.sf} SF` : '—'}</span>
      <span className="text-right text-[0.875rem] font-semibold tnum text-ink">{fmtMoney(r.calc.total)}</span>
      <span className="text-right max-lg:hidden">
        {r.bill ? (
          <span className="block leading-tight">
            <span className={cn('block text-[0.84375rem] font-semibold tnum', r.state === 'check' || r.state === 'asked' ? 'text-bad-600' : 'text-ink')}>{fmtMoney(r.bill.amount)}</span>
            <span className={cn('block text-[0.75rem] font-medium', Math.abs(r.diff) > 25 ? 'text-bad-600' : 'text-ok-700')}>{Math.abs(r.diff) > 25 ? `${r.diff > 0 ? '+' : '−'}${fmtMoney(Math.abs(r.diff))}` : 'Matches'}</span>
          </span>
        ) : <span className="text-[0.8125rem] text-faint">No bill yet</span>}
      </span>
      <span className="max-lg:hidden"><Status tone={st.tone}>{r.state === 'approved' || r.state === 'paid' ? `${st.label} ${r.rec?.date}` : st.label}</Status></span>
      <span className="flex justify-end max-lg:hidden" onClick={(e) => e.stopPropagation()}>
        {r.state === 'running' ? <span className="text-[0.8125rem] text-muted">Approve it Monday</span>
          : r.state === 'ready' || r.state === 'nobill' ? <Button size="sm" variant="primary" icon={<Check />} onClick={() => approvePay(r.crew, weekKey)}>Approve {fmtMoney(r.owe)}</Button>
            : r.state === 'check' || r.state === 'asked' ? <Button size="sm" onClick={open}>See the difference</Button>
              : <span className="text-[0.8125rem] font-semibold tnum text-ok-700">{fmtMoney(r.owe)}</span>}
      </span>
    </div>
  )
}

/** a week paid before the daily updates were in the app — what went out, and on which PO */
function PaidLine({ r }: { r: PaidRow }) {
  const s = useStore()
  const open = () => s.open({ t: 'ipo', id: r.jobs[0].ipo })
  return (
    <div role="button" aria-label={`${PEOPLE[r.crew].name} — paid ${r.paidOn}`} tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open() }} className={cn('grid min-h-[3.25rem] cursor-pointer grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_8.125rem_10rem_8.125rem] items-center gap-3 border-t border-line-2 bg-white py-2 transition-colors first:border-t-0 hover:bg-[#f7f8fa] max-lg:grid-cols-[minmax(0,1fr)_auto]', PX)}>
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar who={r.crew} size={28} />
        <span className="min-w-0">
          <span className="block truncate text-[0.875rem] font-semibold text-ink">{PEOPLE[r.crew].name}</span>
          <span className="block truncate text-[0.78125rem] text-muted lg:hidden">{r.jobs.map((j) => s.jobs[j.jobId]?.name || j.jobId).join(' · ')} · Paid {r.paidOn}</span>
        </span>
      </span>
      <span className="truncate text-[0.84375rem] text-ink-2 max-lg:hidden">{r.jobs.map((j) => s.jobs[j.jobId]?.name || j.jobId).join(' · ')}<span className="ml-2 text-[0.78125rem] text-faint">{r.jobs.map((j) => j.ipo).join(' · ')}</span></span>
      <span className="text-right text-[0.875rem] font-semibold tnum text-ink">{fmtMoney(r.total)}</span>
      <span className="max-lg:hidden"><Status tone="ok">Paid {r.paidOn}</Status></span>
      <span className="flex justify-end max-lg:hidden" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="ghost" icon={<FileText />} onClick={open}>His PO</Button></span>
    </div>
  )
}

/* ================= the whole week in a window (from Today — no jumping to another page) ================= */
export function PayWeekModal({ level }: { level: number }) {
  const s = useStore()
  const week = PAY_WEEKS[0]
  const rows = payRows(s, week)
  const total = rows.reduce((n, r) => n + r.owe, 0)
  return (
    <Modal level={level} size="lg" onClose={s.close} title={`Installer pay · week of ${week.label}`} sub={`From the site manager’s daily updates × the rates on each PO${smp(' · sample amounts')}`}>
      <div className="flex flex-col divide-y divide-line-2 overflow-hidden rounded-2xl border border-line">
        {rows.map((r) => {
          const st = PAY_STATE[r.state]
          return (
            <button key={r.crew} onClick={() => s.open({ t: 'pay', crew: r.crew, week: week.key })} className="flex items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f7f8fa]">
              <Avatar who={r.crew} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.90625rem] font-semibold text-ink">{PEOPLE[r.crew].name}</span>
                <span className="block truncate text-[0.78125rem] text-muted">{jobsLabel(s, r)} · {r.calc.days} days{r.bill ? ` · his bill ${fmtMoney(r.bill.amount)}` : ' · no bill yet'}</span>
              </span>
              <span className="text-[0.9375rem] font-bold tnum text-ink">{fmtMoney(r.calc.total)}</span>
              <span className="w-[9.375rem] shrink-0 text-right max-sm:hidden">
                {r.state === 'ready' || r.state === 'nobill' ? (
                  <Button size="sm" variant="primary" icon={<Check />} onClick={(e) => { e.stopPropagation(); approvePay(r.crew, week.key) }}>Approve</Button>
                ) : <Status tone={st.tone}>{st.label}</Status>}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between px-1 text-[0.875rem]"><span className="text-muted">{rows.length} installers</span><b className="tnum text-ink">{fmtMoney(total)}</b></div>
    </Modal>
  )
}

/* ================= one installer's week ================= */
export function PayModal({ crew, week: wk, level }: { crew: PersonKey; week?: string; level: number }) {
  const s = useStore()
  const week = [THIS_WEEK, ...PAY_WEEKS].find((w) => w.key === wk) || PAY_WEEKS[0]
  const row = payRow(s, crew, week)
  if (!row) return null
  const name = PEOPLE[crew].short
  const grid = payGrid(row)
  const days = weekDays(week)
  const why = mismatchWhy(row)
  const pos = row.calc.jobs.map((j) => poBalance(s, crew, j, week)).filter((x): x is NonNullable<typeof x> => !!x)
  const st = PAY_STATE[row.state]
  const off = row.state === 'check' || row.state === 'asked'
  const many = row.calc.jobs.length > 1
  const header = (
    <div className="border-b border-line px-7 pb-4 pt-5 pr-16 max-sm:px-4">
      <div className="flex items-start gap-4 max-md:flex-col">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar who={crew} size={52} />
          <div className="min-w-0">
            <div className="text-[0.8125rem] font-medium text-muted">Installer pay · week of {week.label}</div>
            <h2 className="truncate text-[1.5rem] font-bold tracking-[-0.02em] text-ink">{PEOPLE[crew].name}</h2>
            <div className="mt-0.5 truncate text-[0.84375rem] text-muted">{row.calc.jobs.map((j) => s.jobs[j]?.name).join(' · ')} · {row.calc.days} {row.calc.days === 1 ? 'day' : 'days'} · {row.calc.sf} SF</div>
          </div>
        </div>
        <div className="flex shrink-0 items-stretch gap-3 max-md:w-full">
          <Figure label="From the daily updates" value={fmtMoney(row.calc.total)} sub={`${row.calc.days} daily ${row.calc.days === 1 ? 'update' : 'updates'}`} />
          <Figure label="His bill" value={row.bill ? fmtMoney(row.bill.amount) : '—'} sub={row.bill ? row.bill.came : 'Not in yet'} bad={off} />
        </div>
      </div>
      {why && (
        <div className="mt-3.5 flex items-start gap-3 rounded-xl border border-bad-100 bg-bad-50 px-4 py-2.5">
          <TriangleAlert className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-bad-600" />
          <div className="min-w-0 text-[0.875rem] leading-snug text-ink-2">
            <span className="font-semibold text-bad-700">{why.text}</span>
            {why.rooms.map((r) => (
              <span key={r.room} className="block">
                <b className="font-semibold text-ink">{r.room}</b> — he billed {fmtMoney(r.bill)}; the updates show {fmtMoney(r.calc)} ({r.where}).
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
  const footer =
    row.state === 'running' ? (
      <span className="text-[0.84375rem] text-muted">The week isn’t over — it grows with every daily update and is ready to approve Monday.</span>
    ) : row.state === 'approved' || row.state === 'paid' ? (
      <>
        <span className="inline-flex items-center gap-2 text-[0.84375rem] font-medium text-ok-700"><CircleCheckBig className="h-4 w-4" />{st.label} {row.rec?.date} · {fmtMoney(row.owe)}{row.state === 'approved' ? ' · a bill in QuickBooks' : ''}</span>
        {row.state === 'approved' && <Button className="ml-auto" variant="ghost" icon={<Undo2 />} onClick={() => undoPay(crew, week.key)}>Undo</Button>}
      </>
    ) : (
      <>
        <span className="text-[0.84375rem] text-muted">
          {row.state === 'check' ? 'Approving pays what the daily updates show.' : row.state === 'asked' ? `Asked ${name} ${row.rec?.date} — waiting for his answer.` : row.state === 'ready' ? 'His bill matches the daily updates.' : `No bill from ${name} yet — he gets this as his statement.`}
        </span>
        {row.state === 'check' && <Button className="ml-auto max-sm:ml-0 max-sm:flex-1" icon={<MessageCircleQuestion />} onClick={() => askAboutPay(crew, week.key)}>Ask {name}</Button>}
        <Button className={cn('max-sm:flex-1', row.state !== 'check' && 'ml-auto')} variant="primary" icon={<Check />} onClick={() => approvePay(crew, week.key)}>Approve {fmtMoney(row.owe)}</Button>
      </>
    )
  return (
    <Modal level={level} size="xl" onClose={s.close} header={header} footer={footer} title={`${PEOPLE[crew].name} · ${week.label}`} bodyClass="px-7 py-4 max-sm:px-4">
      <div className="grid grid-cols-[minmax(0,1fr)_18.75rem] items-start gap-6 max-lg:grid-cols-1">
        {/* every wall and floor he moved, day by day */}
        <div className="min-w-0 overflow-hidden rounded-2xl border border-line">
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(6,3.25rem)_4.375rem_5.25rem] items-center border-b border-line bg-wash px-4 py-1.5 text-[0.75rem] font-semibold text-muted max-md:grid-cols-[minmax(0,1fr)_5.25rem]">
            <span>Room · surface</span>
            {days.map((d) => <span key={d.date} className="text-center leading-tight max-md:hidden"><span className="block">{d.head}</span><span className="block font-medium text-faint">{d.num}</span></span>)}
            <span className="text-right max-md:hidden">SF</span>
            <span className="text-right">Amount</span>
          </div>
          {grid.map((g, gi) => (
            <div key={g.jobId + g.room} className={cn(gi > 0 && 'border-t border-line')}>
              <button onClick={() => openRoom(g.jobId, g.room, 'log')} className="group flex w-full items-center gap-3 px-4 pb-0.5 pt-2 text-left">
                <span className="min-w-0 flex-1 truncate text-[0.875rem] font-bold text-ink group-hover:text-brand-700">
                  {g.room}{many && <span className="ml-2 text-[0.78125rem] font-medium text-muted">{s.jobs[g.jobId]?.name}</span>}
                  <ChevronRight className="ml-0.5 inline h-3.5 w-3.5 text-faint opacity-0 transition group-hover:opacity-100" />
                </span>
                {g.bill != null && Math.abs(g.bill - g.amount) > 5 && <span className="shrink-0 rounded-full bg-bad-50 px-2 py-0.5 text-[0.75rem] font-semibold text-bad-700">He billed {fmtMoney(g.bill)}</span>}
                <span className="w-[5.25rem] shrink-0 text-right text-[0.84375rem] font-semibold tnum text-ink">{fmtMoney(g.amount)}</span>
              </button>
              {g.surfaces.map((x) => (
                <div key={x.surface} className="grid grid-cols-[minmax(0,1fr)_repeat(6,3.25rem)_4.375rem_5.25rem] items-center px-4 py-1 text-[0.84375rem] max-md:grid-cols-[minmax(0,1fr)_5.25rem]">
                  <span className="flex min-w-0 items-baseline gap-2 pl-3 max-md:flex-col max-md:gap-0">
                    <span className="truncate text-ink-2">{x.surface}</span>
                    <span className="shrink-0 truncate text-[0.75rem] text-muted">{x.from}% → {x.to}%{x.lump ? ` · ${x.how.split(' · ')[0]}, lump sum` : x.rate ? ` · $${x.rate}/SF` : ''}</span>
                  </span>
                  {days.map((d) => (
                    <span key={d.date} className="flex justify-center max-md:hidden">
                      {x.byDay[d.date] ? <span className="inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded-md bg-brand-50 px-1 text-[0.75rem] font-semibold tnum text-brand-700">+{x.byDay[d.date]}%</span> : <span className="h-1 w-1 rounded-full bg-line" />}
                    </span>
                  ))}
                  <span className="text-right tnum text-ink-2 max-md:hidden">{x.sf != null ? Math.round(x.sf) : '—'}</span>
                  <span className="text-right tnum text-ink">{fmtMoney(x.amount)}</span>
                </div>
              ))}
              <div className="h-1" />
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-line bg-wash px-4 py-2.5 text-[0.875rem] font-bold text-ink">
            <span>What we owe {name} for the week</span>
            <span className="tnum">{fmtMoney(row.calc.total)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {pos.map((p) => {
            const pct = (n: number) => `${Math.max(0, Math.min(100, (n / p.total) * 100))}%`
            return (
              <button key={p.ipo.id} onClick={() => s.open({ t: 'ipo', id: p.ipo.id })} className="rounded-2xl border border-line bg-white p-4 text-left transition hover:border-brand-200 hover:shadow-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.875rem] font-bold text-ink">On his PO</span>
                  <span className="text-[0.78125rem] font-semibold text-muted">{p.ipo.id}</span>
                </div>
                <div className="truncate text-[0.78125rem] text-muted">{s.jobs[p.ipo.jobId]?.name}</div>
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-wash-2">
                  <span className="bg-ok-500" style={{ width: pct(p.before) }} />
                  <span className="bg-brand-500" style={{ width: pct(p.now) }} />
                </div>
                <dl className="mt-3 flex flex-col gap-1.5 text-[0.84375rem]">
                  <Line label="PO total" value={fmtMoney(p.total)} />
                  <Line label={`Paid before${p.weeks && !p.earlier ? ` · ${p.weeks} ${p.weeks === 1 ? 'week' : 'weeks'}` : ''}`} value={fmtMoney(p.before)} dot="bg-ok-500" />
                  <Line label="This week" value={fmtMoney(p.now)} dot="bg-brand-500" />
                  <Line label="Left on the PO" value={fmtMoney(p.left)} strong bad={p.left < 0} />
                </dl>
              </button>
            )
          })}
          <div className="rounded-2xl bg-wash p-4">
            <div className="flex items-center gap-2 text-[0.84375rem] font-bold text-ink"><ClipboardList className="h-4 w-4 text-muted" />Where it comes from</div>
            <div className="mt-1.5 text-[0.8125rem] leading-snug text-ink-2">Yakov’s daily updates — how far each wall and floor moved, with photos — times the rates on {name}’s PO.</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {grid.map((g) => <button key={g.jobId + g.room} onClick={() => openRoom(g.jobId, g.room, 'log')} className="rounded-full border border-line bg-white px-2.5 py-1 text-[0.78125rem] font-medium text-ink-2 hover:border-brand-200 hover:text-brand-700">{g.room}</button>)}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
function Figure({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className={cn('min-w-[9.375rem] rounded-xl border px-4 py-2.5 max-md:flex-1', bad ? 'border-bad-100 bg-bad-50' : 'border-line bg-wash')}>
      <div className="text-[0.75rem] font-semibold text-muted">{label}</div>
      <div className={cn('text-[1.5rem] font-bold leading-tight tnum', bad ? 'text-bad-600' : 'text-ink')}>{value}</div>
      {sub && <div className="truncate text-[0.75rem] text-muted">{sub}</div>}
    </div>
  )
}
function Line({ label, value, dot, strong, bad }: { label: string; value: string; dot?: string; strong?: boolean; bad?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', strong && 'border-t border-line-2 pt-1.5')}>
      <dt className="inline-flex items-center gap-2 text-muted">{dot && <span className={cn('h-2 w-2 rounded-full', dot)} />}{label}</dt>
      <dd className={cn('tnum', strong ? 'font-bold text-ink' : 'font-medium text-ink-2', bad && 'text-bad-600')}>{value}</dd>
    </div>
  )
}

/* ================= on Today: the week's pay, ready for a yes ================= */
export function PayTaskRow() {
  const s = useStore()
  const open = payOpen(s)
  if (!open.length) return null
  const off = open.filter((r) => r.state === 'check')
  const total = open.reduce((n, r) => n + r.owe, 0)
  const go = () => s.open({ t: 'payweek' })
  return (
    <Row
      onClick={go}
      lead={<span className="inline-flex h-[1.375rem] w-[1.375rem] items-center justify-center rounded-full bg-brand-50 text-brand-600"><ArrowRight className="h-3 w-3" strokeWidth={3} /></span>}
      title={<>Installer pay · week of {PAY_WEEKS[0].label}</>}
      meta={
        <>
          <span className="shrink-0"><Status tone={off.length ? 'bad' : 'warn'}>{off.length ? `${off.length} bill doesn’t match` : 'Today'}</Status></span>
          <Meta icon={<HardHat />}>{open.length} installers · {fmtMoney(total)}</Meta>
          <Meta className="max-lg:hidden">From the daily updates</Meta>
        </>
      }
    >
      <Col w={170} right className="max-md:hidden"><Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); go() }}>Review the week</Button></Col>
    </Row>
  )
}
export const payDue = (s: Store) => (['owner', 'accounting'].includes(s.role) && !(s.rules.autoOff || []).includes('pay-review') ? (payOpen(s).length ? 1 : 0) : 0)
