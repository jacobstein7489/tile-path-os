/* Schedule — the calendar, and only the calendar (the game plan lives in Projects → Getting ready):
 *   week: one row per crew — who's working where — each bar just the project's name, all in one calm color (dashed
 *     while it waits for his OK or is only planned; striped when the project is on hold). Month: a regular month.
 *   Under it, the projects ready to book — one line each; tap one to pick the installer.
 * No legend, no counts on top, no second line on the bars. On a phone: one line per crew — what he's on, or free. */
import * as React from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, TriangleAlert, PauseCircle, CalendarX2, Users, HardHat, CalendarCheck2, CalendarPlus } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Avatar, Button, Segmented } from '@/tileos/components/ui/core'
import { Tip, Pop, Modal } from '@/tileos/components/ui/overlay'
import { Page, Card, Bubbles, useFill } from '@/tileos/components/ui/page'
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

/* one look for every item, in both views: one calm color for the crews' work — not a color per crew */
function look(it: Item, clash: boolean) {
  const ring = clash && 'ring-2 ring-bad-500 ring-offset-1'
  if (it.hold) return { className: cn('border border-[#ecd6d2] text-[#8f2f24]', ring), style: { background: 'repeating-linear-gradient(135deg, #fbf3f1 0 6px, #f6e6e2 6px 12px)' } as React.CSSProperties }
  if (it.kind === 'tobook') return { className: 'border border-dashed border-[#bcc3cc] bg-white text-ink-2', style: {} }
  if (it.kind === 'planned' || it.kind === 'pending') return { className: cn('border border-dashed border-[#9fb3e6] bg-white text-[#1f3d8f]', ring), style: {} }
  return { className: cn('border border-[#dbe3f8] bg-[#eef2fc] text-[#1f3d8f]', ring), style: {} }
}
const sub = (it: Item) => (it.hold ? `On hold · ${it.hold}` : it.kind === 'tobook' ? 'Ready to book — pick an installer' : it.kind === 'planned' ? `${PEOPLE[it.crew!].short} · planned, not booked` : it.kind === 'pending' ? `Waiting for ${PEOPLE[it.crew!].short} to confirm` : `${PEOPLE[it.crew!].short} · ${it.label}`)

type Focus = 'all' | 'working' | 'free' | 'tobook' | 'hold'
export function GamePlanPage() {
  const s = useStore()
  const [viewRaw, setViewRaw] = React.useState<View>(() => { try { const v = localStorage.getItem('gp-view') as View; return v === 'month' ? 'month' : 'week' } catch { return 'week' } })
  const [anchor, setAnchor] = React.useState(TODAY)
  const setView = (v: View) => { setViewRaw(v); setAnchor(TODAY); try { localStorage.setItem('gp-view', v) } catch { /* private window */ } }
  /* a phone always shows the week, as one line per crew — a month of little bars is no use there */
  const [phone, setPhone] = React.useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
  React.useEffect(() => { const mq = window.matchMedia('(max-width: 767px)'); const f = () => setPhone(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f) }, [])
  const view = phone ? 'week' : viewRaw
  const shift = (n: number) => {
    if (view === 'month') { const d = new Date(anchor.slice(0, 7) + '-15T12:00:00'); d.setMonth(d.getMonth() + n); setAnchor(d.toISOString().slice(0, 10)) }
    else setAnchor(addDays(mondayOf(anchor), n * 7))
  }
  const items = itemsOf(s)
  const fill = useFill<HTMLDivElement>()
  const clashes = CREWS.filter((c) => lanesOf(items.filter((b) => b.crew === c && b.end >= TODAY)).length > 1)
  const days = view === 'month' ? [] : Array.from({ length: 5 }, (_, i) => addDays(mondayOf(anchor), i))
  const range = view === 'month' ? fmt(anchor.slice(0, 7) + '-01', { month: 'long', year: 'numeric' }) : `${fmt(days[0], { month: 'short', day: 'numeric' })} – ${fmt(days[days.length - 1], { month: days[0].slice(5, 7) === days[days.length - 1].slice(5, 7) ? undefined : 'short', day: 'numeric' })}`
  return (
    <Page
      title="Schedule"
      bare
      actions={
        <div className="flex w-full flex-wrap items-center gap-2" data-sched-bar>
          <div className="flex items-center rounded-[0.625rem] border border-line bg-white">
            <button aria-label="Back" onClick={() => shift(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-l-[0.625rem] text-ink-2 hover:bg-wash"><ChevronLeft className="h-4 w-4" /></button>
            <span className="inline-flex h-9 min-w-[8.5rem] items-center justify-center border-x border-line px-3 text-[0.875rem] font-semibold text-ink">{range}</span>
            <button aria-label="Forward" onClick={() => shift(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-r-[0.625rem] text-ink-2 hover:bg-wash"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <Button size="sm" className="h-9" onClick={() => setAnchor(TODAY)}>Today</Button>
          <Segmented value={view} onChange={setView} className="ml-auto h-9 max-md:hidden [&>button]:whitespace-nowrap" items={[{ key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }]} />
        </div>
      }
    >
      {/* the week and what's ready to book, side by side, filling the screen — nothing to scroll to */}
      <div ref={fill} className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-stretch">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-[#ebe6dd] bg-white shadow-card">
          {clashes.length > 0 && <div className="flex items-center gap-1.5 border-b border-line-2 px-5 py-2 text-[0.8125rem] font-medium text-bad-600 max-sm:px-3"><TriangleAlert className="h-3.5 w-3.5" />{clashes.map((c) => PEOPLE[c].short).join(', ')} booked in two places</div>}
          {view === 'month'
            ? <MonthGrid anchor={anchor} items={items} clashes={clashes} />
            : <>
                <div className="flex min-h-0 flex-1 flex-col max-md:hidden"><CrewRows days={days} items={items} clashes={clashes} /></div>
                <div className="md:hidden"><CrewList days={days} items={items} clashes={clashes} /></div>
              </>}
        </section>
        <ReadyList />
      </div>
    </Page>
  )
}

/** the projects ready for a crew that nobody's booked for yet — one line each; tap one to pick the installer. Beside
 *  the week, the same height. */
function ReadyList() {
  const s = useStore()
  const dated = itemsOf(s).filter((i) => i.kind === 'tobook').sort((a, b) => a.start.localeCompare(b.start))
  const rows = [...dated.map((i) => ({ id: i.jobId, when: i.start })), ...undated(s).map((r) => ({ id: r.j.id, when: '' }))].filter((x) => s.jobs[x.id])
  return (
    <section data-ready-list className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-[#ebe6dd] bg-white shadow-card">
      <header className="flex h-[3.25rem] shrink-0 items-center gap-2 border-b border-line-2 px-5">
        <h2 className="text-[0.9375rem] font-semibold text-ink">Ready to book</h2>
        <span className="text-[0.8125rem] font-medium tnum text-faint">{rows.length}</span>
      </header>
      {rows.map((x) => {
        const j = s.jobs[x.id]
        return (
          <button key={x.id} onClick={() => s.open({ t: 'book', jobId: x.id })} data-ready-row={x.id} title={`${j.client} — pick the installer`} className="flex min-h-[2.75rem] w-full min-w-0 items-center gap-3 border-b border-line-2 px-5 py-2 text-left transition hover:bg-[#f7f5f0]">
            <span className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-ink">{j.name}</span>
            <span className="shrink-0 text-[0.8125rem] text-muted">{x.when ? fmt(x.when, { month: 'short', day: 'numeric' }) : 'No date'}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
          </button>
        )
      })}
      {!rows.length && <div className="px-5 py-6 text-[0.84375rem] text-muted">Every ready project has an installer.</div>}
    </section>
  )
}

/** a phone: one line per crew — what he's on this week (or free); tap it for the booking */
function CrewList({ days, items, clashes }: { days: string[]; items: Item[]; clashes: PersonKey[] }) {
  const s = useStore()
  const first = days[0]
  const last = days[days.length - 1]
  const crews = CREWS.filter((c) => items.some((i) => i.crew === c && i.end >= first && i.start <= last) || !isOff(s, 'crew', c))
  return (
    <div data-crew-list>
      {crews.map((c) => {
        const mine = items.filter((i) => i.crew === c && i.end >= first && i.start <= last).sort((a, b) => a.start.localeCompare(b.start))
        const it = mine[0]
        const job = it ? s.jobs[it.jobId] : undefined
        return (
          <button key={c} onClick={() => (it ? openItem(s, it) : s.open({ t: 'assign', crew: c, start: TODAY }))} className="flex min-h-[3.25rem] w-full min-w-0 items-center gap-3 border-t border-line-2 px-4 py-2 text-left first:border-t-0">
            <Avatar who={c} size={28} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.875rem] font-semibold text-ink">{PEOPLE[c].name}</span>
              <span className={cn('block truncate text-[0.75rem]', clashes.includes(c) ? 'font-medium text-bad-600' : it?.hold ? 'text-[#8f2f24]' : 'text-muted')}>
                {it ? `${job?.name}${it.hold ? ' · on hold' : it.kind === 'pending' ? ' · waiting for his OK' : it.kind === 'planned' ? ' · planned' : ''} · ${fmt(it.start, { month: 'short', day: 'numeric' })} – ${fmt(it.end, { month: 'short', day: 'numeric' })}${mine.length > 1 ? ` · +${mine.length - 1}` : ''}` : 'Free this week'}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
          </button>
        )
      })}
    </div>
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
function CrewRows({ days, items, clashes }: { days: string[]; items: Item[]; clashes: PersonKey[] }) {
  const s = useStore()
  const cols = days.length
  const first = days[0]
  const last = days[cols - 1]
  const rows = CREWS.map((c) => ({ key: c, crew: c, items: items.filter((i) => i.crew === c && i.end >= first && i.start <= last) })).filter((r) => r.items.length || !isOff(useStore.getState(), 'crew', r.crew))
  return (
    <div className="flex flex-1 flex-col [--crew:12rem]" data-crew-rows>
      <div className="grid border-b border-line-2" style={{ gridTemplateColumns: `var(--crew) repeat(${cols}, minmax(0,1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={d} className="min-w-0 py-2.5 text-center">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8125rem] tnum', d === TODAY ? 'bg-brand-600 font-semibold text-white' : 'text-muted')}>{fmt(d, { weekday: 'short' })} {Number(d.slice(8))}</span>
          </div>
        ))}
      </div>
      {rows.map((row) => {
        const lanes = lanesOf(row.items)
        const busy = new Set<string>()
        row.items.forEach((b) => days.forEach((d) => d >= b.start && d <= b.end && busy.add(d)))
        const crew = row.crew
        const clash = clashes.includes(crew)
        const laneH = 44
        const h = Math.max(1, lanes.length) * laneH + 8
        return (
          <div key={row.key} className="grid flex-1 border-b border-line-2 last:border-0" style={{ gridTemplateColumns: `var(--crew) repeat(${cols}, minmax(0,1fr))`, minHeight: h }} data-crew-row={crew}>
            <button onClick={() => s.open({ t: 'sub', id: crew })} className="flex min-w-0 items-center gap-2.5 px-5 py-2 text-left hover:bg-wash">
              <Avatar who={crew} size={26} />
              <span className="min-w-0 truncate text-[0.875rem] font-semibold text-ink">{PEOPLE[crew].name}</span>
              {clash && <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-bad-600" aria-label="Booked in two places" />}
            </button>
            <div className="relative min-w-0" style={{ gridColumn: `2 / span ${cols}` }}>
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
                {days.map((d) => (
                  <div key={d} className={cn('group relative', d === TODAY && 'bg-brand-50/40')}>
                    {!busy.has(d) && d >= TODAY && (
                      <button aria-label={`Book ${PEOPLE[crew].name} from ${d}`} onClick={() => s.open({ t: 'assign', crew, start: d })} className="absolute inset-1 flex items-center justify-center gap-1 rounded-lg border border-dashed border-transparent text-[0.75rem] font-semibold text-faint opacity-0 transition group-hover:border-[#CDD4DE] group-hover:opacity-100 hover:bg-wash hover:text-brand-600">
                        <Plus className="h-3.5 w-3.5" />Book
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {/* the bars sit in the middle of the row, however tall the row grows */}
              <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ height: h }}>
              {lanes.map((lane, li) => lane.map((b) => {
                const si = days.findIndex((d) => d >= b.start)
                let ei = -1
                days.forEach((d, i) => d <= b.end && (ei = i))
                if (si < 0 || ei < si) return null
                const job = s.jobs[b.jobId]
                const span = ei - si + 1
                const lk = look(b, clash && b.end >= TODAY)
                const tag = b.hold ? 'on hold' : b.kind === 'pending' ? 'waiting for his OK' : b.kind === 'planned' ? 'planned' : ''
                return (
                  <Tip key={b.id} label={`${job?.name} · ${sub(b)} · ${fmt(b.start, { month: 'short', day: 'numeric' })} – ${fmt(b.end, { month: 'short', day: 'numeric' })}`}>
                    <button onClick={() => openItem(s, b)} data-bar={b.jobId} className={cn('pointer-events-auto absolute flex min-w-0 items-center gap-1.5 overflow-hidden rounded-lg px-3 text-left transition hover:brightness-[.97]', lk.className)} style={{ ...lk.style, left: `calc(${(si / cols) * 100}% + 3px)`, width: `calc(${(span / cols) * 100}% - 6px)`, top: 6 + li * laneH, height: laneH - 8 }}>
                      {b.hold && <PauseCircle className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate text-[0.8125rem] font-semibold">{job?.name}</span>
                      {tag && <span className="shrink-0 truncate text-[0.75rem] font-medium opacity-75">· {tag}</span>}
                      {b.end > last && <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />}
                    </button>
                  </Tip>
                )
              }))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ================= month: a regular month, like Google Calendar ================= */
function MonthGrid({ anchor, items, clashes }: { anchor: string; items: Item[]; clashes: PersonKey[] }) {
  const s = useStore()
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
      <div className="grid grid-cols-7 border-b border-line-2">
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
