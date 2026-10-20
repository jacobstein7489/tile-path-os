/* Schedule — the calendar, and only the calendar (the game plan lives in Projects → Getting ready):
 *   week / 2 weeks: one row per crew (who's working where); month: a regular month, like Google Calendar.
 * Projects that are ready but not booked sit right on the calendar, on the day they can start (dashed) — click to book.
 * On hold shows in red. A clash (one crew, two places) gets a red ring. The header never moves. */
import * as React from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, TriangleAlert, PauseCircle, CalendarX2, Users, HardHat, CalendarCheck2, CalendarPlus } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Avatar, Button, Segmented } from '@/tileos/components/ui/core'
import { Tip, Pop, Modal } from '@/tileos/components/ui/overlay'
import { Page, Card, Bubbles } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, CREW_BLOCK, type PersonKey, type Job } from '@/tileos/data/model'
import { addBusinessDays } from './flows'
import { rowsOf, installerOf } from './upcoming'
import { mondayOf, addDays } from './schedule'
import { TODAY, MONDAY, addDays as addDaysT } from '@/tileos/lib/today'
import { isOff } from './active'

type View = 'week' | '2weeks' | 'month'
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', o)
const dow = (iso: string) => new Date(iso + 'T12:00:00').getDay()
const isWeekday = (iso: string) => { const d = dow(iso); return d > 0 && d < 6 }

/* ---------------- what's on the calendar ---------------- */
export type Kind = 'booked' | 'pending' | 'planned' | 'tobook'
export type Item = { id: string; jobId: string; crew?: PersonKey; start: string; end: string; kind: Kind; label: string; hold?: string; workers?: number }

/** booked and pending bookings, planned (installer picked + a start date), and ready projects nobody is booked for yet */
export function itemsOf(s: Store): Item[] {
  const hold = (jobId: string) => s.jobs[jobId]?.hold?.reason
  const booked: Item[] = s.bookings.filter((b) => s.jobs[b.jobId]).map((b) => ({ id: b.id, crew: b.crew as PersonKey, jobId: b.jobId, start: b.start, end: b.end, label: b.label, workers: b.workers, kind: b.status === 'pending' ? 'pending' : 'booked', hold: hold(b.jobId) }))
  const rest: Item[] = []
  rowsOf(s).forEach((r) => {
    if (s.bookings.some((b) => b.jobId === r.j.id) || !r.p.targetISO) return
    const start = r.p.targetISO < TODAY ? TODAY : r.p.targetISO
    const days = s.ready.find((x) => x.jobId === r.j.id)?.days || 5
    const crew = r.p.installer && r.p.installer !== 'tbd' ? (r.p.installer as PersonKey) : undefined
    rest.push({ id: (crew ? 'plan-' : 'tb-') + r.j.id, crew, jobId: r.j.id, start, end: addBusinessDays(start, days), kind: crew ? 'planned' : 'tobook', label: crew ? 'Planned — not booked yet' : 'Ready to book', hold: hold(r.j.id) })
  })
  return [...booked, ...rest]
}
/** kept for the pages that still ask for crew bars */
export const barsOf = (s: Store) => itemsOf(s).filter((i) => i.crew)
/** ready projects with no start date yet — nothing to put on a day */
const undated = (s: Store) => rowsOf(s).filter((r) => !r.p.targetISO && !s.bookings.some((b) => b.jobId === r.j.id))

/** stack overlapping items into lanes */
function lanesOf<T extends { start: string; end: string }>(items: T[]) {
  const lanes: T[][] = []
  ;[...items].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end)).forEach((b) => {
    const lane = lanes.find((l) => l[l.length - 1].end < b.start)
    if (lane) lane.push(b)
    else lanes.push([b])
  })
  return lanes
}

/* one look for every item, in both views */
function look(it: Item, clash: boolean) {
  const c = it.crew ? CREW_BLOCK[it.crew] : undefined
  if (it.hold) return { className: cn('border border-bad-200 text-bad-700', clash && 'ring-2 ring-bad-500 ring-offset-1'), style: { background: 'repeating-linear-gradient(135deg, #fff1f0 0 6px, #ffe2df 6px 12px)', boxShadow: 'inset 3px 0 0 #d92d20' } as React.CSSProperties }
  if (it.kind === 'tobook') return { className: 'border border-dashed border-[#bcc3cc] bg-white text-ink-2', style: {} }
  if (it.kind === 'planned' || it.kind === 'pending') return { className: cn('border border-dashed bg-white', clash && 'ring-2 ring-bad-500 ring-offset-1'), style: { borderColor: c?.bar, color: c?.text } as React.CSSProperties }
  return { className: cn('border border-transparent', clash && 'ring-2 ring-bad-500 ring-offset-1'), style: { background: c?.bg, color: c?.text, boxShadow: `inset 3px 0 0 ${c?.bar}` } as React.CSSProperties }
}
const sub = (it: Item) => (it.hold ? `On hold · ${it.hold}` : it.kind === 'tobook' ? 'Ready to book — pick an installer' : it.kind === 'planned' ? `${PEOPLE[it.crew!].short} · planned, not booked` : it.kind === 'pending' ? `Waiting for ${PEOPLE[it.crew!].short} to confirm` : `${PEOPLE[it.crew!].short} · ${it.label}`)

type Focus = 'all' | 'working' | 'free' | 'tobook' | 'hold'
export function GamePlanPage() {
  const s = useStore()
  const [focus, setFocus] = React.useState<Focus>('all')
  const [view, setViewRaw] = React.useState<View>(() => { try { return (localStorage.getItem('gp-view') as View) || 'week' } catch { return 'week' } })
  const [anchor, setAnchor] = React.useState(TODAY)
  const setView = (v: View) => { setViewRaw(v); setAnchor(TODAY); try { localStorage.setItem('gp-view', v) } catch { /* private window */ } }
  const shift = (n: number) => {
    if (view === 'month') { const d = new Date(anchor.slice(0, 7) + '-15T12:00:00'); d.setMonth(d.getMonth() + n); setAnchor(d.toISOString().slice(0, 10)) }
    else setAnchor(addDays(mondayOf(anchor), n * (view === 'week' ? 7 : 14)))
  }
  const items = itemsOf(s)
  const clashes = CREWS.filter((c) => lanesOf(items.filter((b) => b.crew === c && b.end >= TODAY)).length > 1)
  const days = view === 'month' ? [] : Array.from({ length: view === 'week' ? 5 : 10 }, (_, i) => addDays(mondayOf(anchor), Math.floor(i / 5) * 7 + (i % 5)))
  const range = view === 'month' ? fmt(anchor.slice(0, 7) + '-01', { month: 'long', year: 'numeric' }) : `${fmt(days[0], { month: 'short', day: 'numeric' })} – ${fmt(days[days.length - 1], { month: days[0].slice(5, 7) === days[days.length - 1].slice(5, 7) ? undefined : 'short', day: 'numeric' })}`
  const noDate = undated(s)
  /* this week, for the counts on top */
  const wkA = mondayOf(TODAY)
  const wkZ = addDays(wkA, 4)
  const busyWk = new Set(items.filter((i) => i.crew && (i.kind === 'booked' || i.kind === 'pending') && i.start <= wkZ && i.end >= wkA).map((i) => i.crew))
  const n = { working: busyWk.size, free: CREWS.filter((c) => !busyWk.has(c)).length, tobook: items.filter((i) => i.kind === 'tobook').length + noDate.length, hold: new Set(items.filter((i) => i.hold).map((i) => i.jobId)).size }
  const pick = (k: Focus) => () => setFocus(focus === k ? 'all' : k)
  return (
    <Page
      title="Schedule"
      sub="Who’s working where, and what’s ready to book."
      bare
      top={
        <Bubbles
          items={[
            { key: 'all', label: 'All crews', count: CREWS.length, icon: <Users />, color: 'slate', on: focus === 'all', onClick: () => setFocus('all') },
            { key: 'working', label: 'Working this week', count: n.working, icon: <HardHat />, color: 'green', on: focus === 'working', onClick: pick('working'), gapBefore: true },
            { key: 'free', label: 'Free this week', count: n.free, icon: <CalendarCheck2 />, color: 'teal', on: focus === 'free', onClick: pick('free') },
            { key: 'tobook', label: 'Ready to book', count: n.tobook, icon: <CalendarPlus />, color: 'violet', on: focus === 'tobook', onClick: pick('tobook') },
            { key: 'hold', label: 'On hold', count: n.hold, icon: <PauseCircle />, color: 'red', on: focus === 'hold', onClick: pick('hold') },
          ]}
        />
      }
    >
      <Card pad={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 max-sm:px-3">
          <div className="flex items-center rounded-[0.625rem] border border-line bg-white">
            <button aria-label="Back" onClick={() => shift(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-l-[0.625rem] text-ink-2 hover:bg-wash"><ChevronLeft className="h-4 w-4" /></button>
            <span className="inline-flex h-9 min-w-[9.375rem] items-center justify-center gap-2 border-x border-line px-3 text-[0.875rem] font-semibold text-ink"><CalendarDays className="h-4 w-4 text-muted" />{range}</span>
            <button aria-label="Forward" onClick={() => shift(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-r-[0.625rem] text-ink-2 hover:bg-wash"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <Button size="sm" onClick={() => setAnchor(TODAY)}>Today</Button>
          <div className="mx-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78125rem] font-medium text-muted max-xl:hidden">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[0.25rem] bg-[#FEF2E7] shadow-[inset_0.1875rem_0_0_#D66A16]" />Booked</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[0.25rem] border border-dashed border-[#D66A16] bg-white" />Planned</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[0.25rem] border border-dashed border-[#bcc3cc] bg-white" />Ready to book</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[0.25rem]" style={{ background: 'repeating-linear-gradient(135deg, #fcf0ee 0 3px, #f6d5cf 3px 6px)', boxShadow: 'inset 3px 0 0 #c03a2d' }} />On hold</span>
            {clashes.length > 0 && <span className="inline-flex items-center gap-1.5 text-bad-600"><TriangleAlert className="h-3.5 w-3.5" />{clashes.map((c) => PEOPLE[c].short).join(', ')} booked in two places</span>}
          </div>
          <div className="ml-auto flex items-center gap-2 max-sm:ml-0 max-sm:w-full">
            {noDate.length > 0 && (
              <Pop align="end" width={340} trigger={<button className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[0.625rem] border border-line px-3 text-[0.8125rem] font-semibold text-ink-2 hover:bg-wash max-md:hidden"><CalendarX2 className="h-3.5 w-3.5" />{noDate.length} ready, no start date</button>}>
                <div className="text-[0.8125rem] font-semibold text-ink">Ready, waiting for a start date</div>
                <div className="mt-2 flex flex-col">
                  {noDate.map((r) => (
                    <button key={r.j.id} onClick={() => s.open({ t: 'job', id: r.j.id })} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-wash">
                      <span className="min-w-0"><span className="block truncate text-[0.84375rem] font-semibold text-ink">{r.j.name}</span><span className="block truncate text-[0.75rem] text-muted">{r.j.client}</span></span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                    </button>
                  ))}
                </div>
              </Pop>
            )}
            <Segmented value={view} onChange={setView} className="h-9 max-sm:w-full max-sm:[&>button]:flex-1 max-sm:[&>button]:justify-center [&>button]:whitespace-nowrap" items={[{ key: 'week', label: 'Week' }, { key: '2weeks', label: '2 weeks' }, { key: 'month', label: 'Month' }]} />
          </div>
        </div>
        {view === 'month' ? <MonthGrid anchor={anchor} items={items} clashes={clashes} focus={focus} /> : <CrewRows days={days} items={items} clashes={clashes} focus={focus} />}
      </Card>
    </Page>
  )
}

function openItem(s: Store, it: Item) {
  const sh = s.jobs[it.jobId]?.hold?.shortage
  if (it.hold && sh) return s.open({ t: 'short', id: sh })
  if (it.kind === 'tobook') return s.open({ t: 'book', jobId: it.jobId })
  if (it.kind === 'planned') return s.open({ t: 'assign', jobId: it.jobId, crew: it.crew, start: it.start })
  return s.open({ t: 'booking', id: it.id })
}

/* ================= week / two weeks: one row per crew ================= */
function CrewRows({ days, items, clashes, focus = 'all' }: { days: string[]; items: Item[]; clashes: PersonKey[]; focus?: Focus }) {
  const s = useStore()
  const cols = days.length
  const first = days[0]
  const last = days[cols - 1]
  const toBook = items.filter((i) => i.kind === 'tobook' && i.end >= first && i.start <= last)
  const all: { key: string; crew?: PersonKey; items: Item[] }[] = [...(toBook.length ? [{ key: 'tobook', items: toBook }] : []), ...CREWS.map((c) => ({ key: c, crew: c, items: items.filter((i) => i.crew === c && i.end >= first && i.start <= last) })).filter((r) => r.items.length || !isOff(useStore.getState(), 'crew', r.crew))]
  const booked = (r: (typeof all)[number]) => r.items.some((i) => i.kind === 'booked' || i.kind === 'pending')
  const rows = all.filter((r) => focus === 'all' ? true : focus === 'tobook' ? !r.crew || r.items.some((i) => i.kind === 'planned') : !r.crew ? false : focus === 'working' ? booked(r) : focus === 'free' ? !booked(r) : r.items.some((i) => i.hold))
  return (
    <div className="scroll-soft overflow-x-auto [--crew:12.5rem] max-sm:[--crew:6.75rem]">
      <div style={{ minWidth: `calc(var(--crew) + ${cols * (cols > 5 ? 84 : 112)}px)` }}>
        <div className="grid border-b border-line bg-wash/60" style={{ gridTemplateColumns: `var(--crew) repeat(${cols}, minmax(0,1fr))` }}>
          <div className="sticky left-0 z-[3] flex items-end bg-[#faf8f5] px-5 pb-2.5 pt-3 text-[0.78125rem] font-semibold text-muted max-sm:px-3">Crew</div>
          {days.map((d, i) => (
            <div key={d} className={cn('min-w-0 border-l py-2 text-center', dow(d) === 1 && i > 0 ? 'border-l-line' : 'border-l-line-2')}>
              <div className="truncate text-[0.71875rem] font-semibold text-muted">{fmt(d, { weekday: 'short' })}{i === 0 || dow(d) === 1 ? ` · ${fmt(d, { month: 'short' })}` : ''}</div>
              <div className={cn('mx-auto mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-[0.90625rem] font-bold tnum', d === TODAY ? 'bg-brand-600 text-white' : 'text-ink')}>{Number(d.slice(8))}</div>
            </div>
          ))}
        </div>
        {rows.map((row) => {
          const lanes = lanesOf(row.items)
          const busy = new Set<string>()
          row.items.forEach((b) => days.forEach((d) => d >= b.start && d <= b.end && busy.add(d)))
          const crew = row.crew
          const now = crew && s.bookings.find((b) => b.crew === crew && b.start <= TODAY && b.end >= TODAY)
          const clash = !!crew && clashes.includes(crew)
          const laneH = 54
          const h = Math.max(1, lanes.length) * laneH + 12
          return (
            <div key={row.key} className={cn('grid border-b border-line-2 last:border-0', !crew && 'bg-[#faf8f5]')} style={{ gridTemplateColumns: `var(--crew) repeat(${cols}, minmax(0,1fr))` }}>
              {crew ? (
                <button onClick={() => s.open({ t: 'sub', id: crew })} className="sticky left-0 z-[3] flex items-center gap-3 bg-white px-5 py-2 text-left hover:bg-wash max-sm:gap-2 max-sm:px-3 max-sm:shadow-[0.0625rem_0_0_var(--color-line-2)]">
                  <Avatar who={crew} size={30} className="max-sm:hidden" />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[0.875rem] font-semibold text-ink">{PEOPLE[crew].name}</span>
                    {clash ? <span className="mt-0.5 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-bad-600"><TriangleAlert className="h-3 w-3" />Clash</span>
                      : <span className={cn('mt-0.5 block truncate text-[0.75rem]', now ? 'text-muted' : 'font-semibold text-ok-700')}>{now ? `${now.workers || 2} people · till ${fmt(now.end, { month: 'short', day: 'numeric' })}` : 'Free now'}</span>}
                  </span>
                </button>
              ) : (
                <div className="sticky left-0 z-[3] flex items-center gap-3 bg-[#faf8f5] px-5 py-2 max-sm:px-3">
                  <span className="inline-flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full border border-dashed border-[#bcc3cc] text-muted max-sm:hidden"><Plus className="h-4 w-4" /></span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[0.875rem] font-semibold text-ink">Ready to book</span>
                    <span className="mt-0.5 block truncate text-[0.75rem] text-muted">No installer yet</span>
                  </span>
                </div>
              )}
              <div className="relative min-w-0" style={{ gridColumn: `2 / span ${cols}`, height: h }}>
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
                  {days.map((d, i) => (
                    <div key={d} className={cn('group relative border-l', dow(d) === 1 && i > 0 ? 'border-l-line' : 'border-l-line-2', d === TODAY && 'bg-brand-50/50')}>
                      {crew && !busy.has(d) && d >= TODAY && (
                        <button aria-label={`Book ${PEOPLE[crew].name} from ${d}`} onClick={() => s.open({ t: 'assign', crew, start: d })} className="absolute inset-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-transparent text-[0.75rem] font-semibold text-faint opacity-0 transition group-hover:border-[#CDD4DE] group-hover:opacity-100 hover:bg-wash hover:text-brand-600">
                          <Plus className="h-3.5 w-3.5" />Book
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {lanes.map((lane, li) => lane.map((b) => {
                  const si = days.findIndex((d) => d >= b.start)
                  let ei = -1
                  days.forEach((d, i) => d <= b.end && (ei = i))
                  if (si < 0 || ei < si) return null
                  const job = s.jobs[b.jobId]
                  const span = ei - si + 1
                  const lk = look(b, clash && b.end >= TODAY)
                  return (
                    <Tip key={b.id} label={`${job?.name} · ${sub(b)} · ${fmt(b.start, { month: 'short', day: 'numeric' })} – ${fmt(b.end, { month: 'short', day: 'numeric' })}`}>
                      <button onClick={() => openItem(s, b)} className={cn('absolute flex min-w-0 flex-col justify-center overflow-hidden rounded-lg px-2.5 text-left transition hover:brightness-[.97]', lk.className)} style={{ ...lk.style, left: `calc(${(si / cols) * 100}% + 3px)`, width: `calc(${(span / cols) * 100}% - 6px)`, top: 6 + li * laneH, height: laneH - 6 }}>
                        <span className="flex min-w-0 items-center gap-1.5 leading-tight">
                          {b.hold && <PauseCircle className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate text-[0.8125rem] font-semibold">{job?.name}</span>
                          {b.kind === 'booked' && !b.hold && job?.pct !== undefined && span >= 2 && <span className="ml-auto shrink-0 text-[0.6875rem] font-bold tnum opacity-80">{job.pct}%</span>}
                          {b.end > last && <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />}
                        </span>
                        <span className="mt-0.5 truncate text-[0.71875rem] leading-tight opacity-80">{b.hold ? `On hold · ${b.hold}` : b.kind === 'tobook' ? 'Pick an installer' : b.kind === 'planned' ? 'Planned — not booked yet' : b.kind === 'pending' ? 'Waiting to confirm' : b.label}</span>
                      </button>
                    </Tip>
                  )
                }))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ================= month: a regular month, like Google Calendar ================= */
function MonthGrid({ anchor, items: all, clashes, focus = 'all' }: { anchor: string; items: Item[]; clashes: PersonKey[]; focus?: Focus }) {
  const s = useStore()
  const items = all.filter((i) => focus === 'all' || focus === 'free' ? true : focus === 'working' ? i.kind === 'booked' || i.kind === 'pending' : focus === 'tobook' ? i.kind === 'tobook' || i.kind === 'planned' : !!i.hold)
  const m = anchor.slice(0, 7)
  const first = m + '-01'
  const start = addDays(first, -dow(first))
  const weeks: string[][] = []
  for (let w = 0; w < 6; w++) {
    const wk = Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i))
    if (w >= 4 && wk[0].slice(0, 7) !== m) break
    weeks.push(wk)
  }
  const MAX = 6
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line bg-wash/60">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => <div key={d} className={cn('py-2 text-center text-[0.75rem] font-semibold text-muted', i > 0 && 'border-l border-line-2')}>{d}</div>)}
      </div>
      {weeks.map((wk) => {
        const a = wk[0]
        const z = wk[6]
        const segs = items.filter((it) => it.end >= a && it.start <= z).map((it) => ({ it, start: it.start < a ? a : it.start, end: it.end > z ? z : it.end }))
        const lanes = lanesOf(segs)
        const shownLanes = lanes.slice(0, MAX)
        const hidden = lanes.slice(MAX).flat()
        const laneH = 24
        return (
          <div key={a} className="relative border-b border-line-2 last:border-0" style={{ minHeight: 34 + Math.max(2, Math.min(lanes.length, MAX)) * laneH + (hidden.length ? 22 : 10) }}>
            <div className="absolute inset-0 grid grid-cols-7">
              {wk.map((d, i) => {
                const out = d.slice(0, 7) !== m
                const more = hidden.filter((h) => h.start <= d && h.end >= d)
                return (
                  <div key={d} className={cn('group relative min-w-0', i > 0 && 'border-l border-line-2', (i === 0 || i === 6) && 'bg-[#fbfbfc]', out && 'bg-[#fafafb]')}>
                    <div className="flex items-center justify-between px-2 pt-1.5">
                      <span className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[0.78125rem] font-semibold tnum', d === TODAY ? 'bg-brand-600 text-white' : out ? 'text-faint' : 'text-ink-2')}>{Number(d.slice(8)) === 1 ? <><span className="max-sm:hidden">{fmt(d, { month: 'short' })}&nbsp;</span>1</> : Number(d.slice(8))}</span>
                      {d >= TODAY && isWeekday(d) && (
                        <Tip label="Book someone from this day">
                          <button aria-label={`Book from ${d}`} onClick={() => s.open({ t: 'assign', start: d })} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-faint opacity-0 transition hover:bg-wash hover:text-brand-600 group-hover:opacity-100"><Plus className="h-3.5 w-3.5" /></button>
                        </Tip>
                      )}
                    </div>
                    {more.length > 0 && (
                      <Pop width={300} trigger={<button className="absolute bottom-1 left-2 text-[0.75rem] font-semibold text-muted hover:text-brand-600">+{more.length} more</button>}>
                        <div className="text-[0.8125rem] font-semibold text-ink">{fmt(d, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                        <div className="mt-2 flex flex-col gap-1">{segs.filter((x) => x.start <= d && x.end >= d).map((x) => <Chip key={x.it.id} it={x.it} clash={!!x.it.crew && clashes.includes(x.it.crew)} />)}</div>
                      </Pop>
                    )}
                  </div>
                )
              })}
            </div>
            {shownLanes.map((lane, li) => lane.map((x) => {
              const si = wk.indexOf(x.start)
              const ei = wk.indexOf(x.end)
              if (si < 0 || ei < 0) return null
              const job = s.jobs[x.it.jobId]
              const lk = look(x.it, !!x.it.crew && clashes.includes(x.it.crew) && x.it.end >= TODAY)
              const contL = x.it.start < a
              const contR = x.it.end > z
              return (
                <Tip key={x.it.id + a} label={`${job?.name} · ${sub(x.it)} · ${fmt(x.it.start, { month: 'short', day: 'numeric' })} – ${fmt(x.it.end, { month: 'short', day: 'numeric' })}`}>
                  <button
                    onClick={() => openItem(s, x.it)}
                    className={cn('absolute flex min-w-0 items-center gap-1 overflow-hidden px-2 text-left text-[0.75rem] font-semibold leading-none transition hover:brightness-[.97] max-sm:px-1 max-sm:text-[0.65625rem]', contL ? 'rounded-l-none' : 'rounded-l-md', contR ? 'rounded-r-none' : 'rounded-r-md', lk.className)}
                    style={{ ...lk.style, left: `calc(${(si / 7) * 100}% + ${contL ? 0 : 3}px)`, width: `calc(${((ei - si + 1) / 7) * 100}% - ${(contL ? 0 : 3) + (contR ? 0 : 3)}px)`, top: 32 + li * laneH, height: laneH - 4 }}
                  >
                    {x.it.hold && <PauseCircle className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{job?.name}</span>
                    {x.it.crew && <span className="shrink-0 font-medium opacity-70 max-md:hidden">· {PEOPLE[x.it.crew].short}</span>}
                    {x.it.kind === 'tobook' && <span className="shrink-0 font-medium text-muted max-md:hidden">· to book</span>}
                  </button>
                </Tip>
              )
            }))}
          </div>
        )
      })}
    </div>
  )
}

/* ================= ready to book — from Today, in a window ================= */
export function ReadyToBookModal({ level }: { level: number }) {
  const s = useStore()
  const items = itemsOf(s).filter((i) => i.kind === 'tobook').sort((a, b) => a.start.localeCompare(b.start))
  const noDate = undated(s)
  const busyThisWeek = new Set(s.bookings.filter((b) => b.start <= addDaysT(MONDAY, 4) && b.end >= TODAY).map((b) => b.crew))
  const free = CREWS.filter((c) => !busyThisWeek.has(c))
  return (
    <Modal level={level} size="lg" onClose={s.close} title="Ready to book" sub="Won and ready, no installer yet — pick one and it lands on the calendar.">
      {free.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-ok-50/70 px-3.5 py-2.5 text-[0.84375rem] text-ink-2">
          <span className="font-semibold text-ok-700">Free this week:</span>
          {free.map((c) => <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-ok-100"><Avatar who={c} size={18} />{PEOPLE[c].short}</span>)}
        </div>
      )}
      <div className="flex flex-col divide-y divide-line-2 overflow-hidden rounded-2xl border border-line">
        {[...items.map((i) => ({ id: i.jobId, when: i.start })), ...noDate.map((r) => ({ id: r.j.id, when: '' }))].map((x) => {
          const j = s.jobs[x.id]
          return (
            <div key={x.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex w-[3.375rem] shrink-0 flex-col items-center rounded-lg bg-wash py-1 leading-tight">
                <span className="text-[0.71875rem] font-semibold text-muted">{x.when ? fmt(x.when, { month: 'short' }) : 'Date'}</span>
                <span className="text-[0.9375rem] font-bold tnum text-ink">{x.when ? Number(x.when.slice(8)) : 'TBD'}</span>
              </span>
              <button onClick={() => s.open({ t: 'job', id: x.id })} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[0.90625rem] font-semibold text-ink hover:text-brand-700">{j?.name}</span>
                <span className="block truncate text-[0.78125rem] text-muted">{j?.client}{x.when ? ` · can start ${fmt(x.when, { weekday: 'short', month: 'short', day: 'numeric' })}` : ' · start date to set'}</span>
              </button>
              <Button size="sm" variant="primary" onClick={() => s.open({ t: 'book', jobId: x.id })}>Pick installer</Button>
            </div>
          )
        })}
        {!items.length && !noDate.length && <div className="px-4 py-8 text-center text-[0.875rem] text-muted">Every ready project has an installer.</div>}
      </div>
    </Modal>
  )
}

function Chip({ it, clash }: { it: Item; clash: boolean }) {
  const s = useStore()
  const lk = look(it, clash)
  return (
    <button onClick={() => openItem(s, it)} className={cn('flex w-full min-w-0 flex-col rounded-md px-2 py-1.5 text-left', lk.className)} style={lk.style}>
      <span className="truncate text-[0.78125rem] font-semibold">{s.jobs[it.jobId]?.name}</span>
      <span className="truncate text-[0.71875rem] opacity-80">{sub(it)}</span>
    </button>
  )
}
export type { Job }
export { installerOf }
