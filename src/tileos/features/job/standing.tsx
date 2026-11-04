/* Where the project stands.
 *   THE LINE (in the header), like the estimate's path: Approved → Getting ready → Crew scheduled → Installing →
 *     Touch-ups → Closed. "Crew scheduled" is locked until getting ready is done.
 *   WHERE IT STANDS (the first tab), while getting ready — one screen, nothing on the side, nothing folded:
 *     on top, what's yours on the project (or whose turn it is);
 *     then every part (Design · Tile · Site · Installer · Materials) in a band, every one of its steps under it, one
 *       line each — the step, whose it is, and where it's at: done, what came of it (3 rooms · 5 surfaces, all 3
 *       tiles here · Oct 28); open, whose turn it is. On a wide screen the parts sit in two columns, so it's all there
 *       at once. Steps that follow each other are joined by a line down the left.
 *     Tap a step and its own small window opens — the step and nothing else. Nothing opens inside the list.
 *     Under the parts: the open items.
 *   Once getting ready is done it isn't shown any more (it's done): what's next and the stage (the crew, the
 *     installing, the touch-ups), and beside it the open items — anything still open, each thing once. */
import * as React from 'react'
import { ChevronDown, ChevronRight, Plus, Truck, HardHat, CalendarDays, Receipt, TriangleAlert, ListTodo, Package } from 'lucide-react'
import { useStore, meOf, isRequest, type Store } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { Circles, Circle, ProgressRing, BAND, BAND_LABEL, BAND_STRONG, bandStyle, bandLabel, HEAD_ROW, BandCount, type CircleState, type CircleStep } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { labelFromIso, isoFromLabel, TODAY } from '@/tileos/lib/today'
import { stepsFor, type StepView } from '../steps'
import { StepIcon, stepWords } from '../steps-ui'
import { todoOf, chainsOf, stepNow } from '../stepwin'
import { NextUp } from './next'
import { nextOn } from './plan'
import { installerOf } from '../upcoming'
import { TouchupsList } from '../touchups'
import { allowedFor } from '../newpicker'
import { firstName } from './kit'
import { tracksFor, lineOf, phaseOf, stepShort, moneyLine, issuesOf, issueKind, bookingOf, roomsOf, problemsOf, type TrackView, type TrackKey, type Phase } from '../tracks'
import type { BoardView } from './board'

/** the part that's open on Where it stands, and the step picked in it */
export type OpenTrack = { track: TrackKey; step: string } | null

/* ================= the line ================= */
/** where the project is — like a parcel's tracking line: the six stages evenly spaced on one line, each one's name and
 *  where it's at under its circle, and the line green up to the stage going on. Only while installing does it run on
 *  into the next one, as far as the install has got; getting ready says "3 of 5 done" under its circle instead. On a
 *  phone, the circles alone and the stage going on in words under them. */
export function ProjectLine({ job, className }: { job: Job; className?: string }) {
  const s = useStore()
  const line = lineOf(s, job, tracksFor(s, job))
  const here = line.find((x) => x.state === 'now' || x.state === 'bad') || [...line].reverse().find((x) => x.state === 'done')
  const steps = line.map((x, i) => ({ key: x.key, label: x.label, sub: x.sub, state: x.state, lock: x.lock, link: x.link, center: String(i + 1), attrs: { 'data-line': x.key, ...(x.lock ? { 'data-gate': 'locked' } : {}) } }))
  return (
    <div className={className} data-project-line>
      <Circles size={28} className="max-sm:hidden" label="Where the project is" groups={[{ key: 'line', steps }]} />
      <Circles layout="beside" markNow size={26} className="sm:hidden" label="Where the project is" groups={[{ key: 'line', steps }]} />
      {here && <div className="mt-1.5 truncate text-[0.8125rem] sm:hidden" data-line-now><b className={cn('font-semibold', here.state === 'bad' ? 'text-bad-600' : 'text-brand-700')}>{here.label}</b>{here.sub ? <span className="text-muted"> · {here.sub}</span> : null}</div>}
    </div>
  )
}

/* ================= where it stands ================= */
export function Stands({ job, open, setOpen, onStep, setView }: {
  job: Job
  /** a step a link or "Your turn" asked for — its window opens */
  open: OpenTrack
  setOpen: (o: OpenTrack) => void
  /** what's next's button: open its step */
  onStep: (k: string) => void
  /** a room, from the installing */
  setView: (v: BoardView) => void
}) {
  const s = useStore()
  const steps = stepsFor(s, job)
  const tracks = tracksFor(s, job, steps)
  const phase = phaseOf(s, job, tracks)
  /* a step opens in its own small window — never inside the list */
  const pick = (k: string) => s.open({ t: 'step', jobId: job.id, k })
  React.useEffect(() => {
    if (!open) return
    setOpen(null)
    if (tracks.some((t) => t.steps.some((v) => v.key === open.step))) pick(open.step)
  }, [open])
  const left = openStepsOf(s, job, steps, phase)
  /* every column is one panel that fills the window — the last card in a column takes the rest of its height */
  const COL = 'scroll-soft flex min-w-0 flex-col gap-3 lg:h-full lg:overflow-y-auto lg:pb-6 [&>*]:shrink-0 lg:[&>*:last-child]:grow'
  /* getting ready is done: no Getting ready list any more. What's next across the top; under it the stage (the crew,
     the installing, the touch-ups) and what's still open on the project, side by side, the same size — each thing
     once. */
  if (phase !== 'ready') {
    const punch = s.punch.some((p) => p.jobId === job.id && p.status !== 'verified')
    const hasStage = phase === 'crew' || phase === 'install' || phase === 'punch' || punch
    return (
      <div data-phase={phase} className="flex min-w-0 flex-col gap-3 lg:h-full lg:gap-4">
        <NextUp job={job} onStep={pick} />
        <div className={cn('flex min-w-0 flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:gap-4', hasStage && 'lg:grid-cols-2')}>
          {hasStage && <div data-stands-main className={COL}><Stage job={job} phase={phase} setView={setView} /></div>}
          <div data-stands-side className={COL}><OpenIssues job={job} steps={left} onStep={pick} fill /></div>
        </div>
      </div>
    )
  }
  /* getting ready: one screen — what's yours on top, then every part with every step under it, and the open items */
  return (
    <div data-phase={phase} className="flex min-w-0 flex-col gap-3 lg:h-full lg:gap-4">
      <div data-stands-main className={COL}>
        <NextUp job={job} onStep={pick} />
        <ReadyList job={job} tracks={tracks} onPick={pick} />
      </div>
    </div>
  )
}

/* ---------------- getting ready: every part, every step, one line each ----------------
 * The part's name in a band (done, or how many of its steps are); under it every one of its steps, one line each: the
 * step, whose it is, where it's at — done, what came of it. Nothing folds and nothing opens inside the list: tap a
 * step and its own window opens. Steps that follow each other are joined by a line down the left. On a wide screen
 * the parts are in two columns (in order, down the first and on into the second), so every step is in view at once. */
const LINE_COLS = 'md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,1.4fr)] md:items-center md:gap-x-5'
function stateOf(s: Store, job: Job, x: StepView, me: PersonKey): { text: string; tone: string } {
  const late = x.state === 'now' && !!x.due && x.due < TODAY
  if (x.state === 'now') return late ? { text: `Late · was due ${labelFromIso(x.due!)}`, tone: 'font-medium text-bad-600' } : x.owner === me ? { text: 'Your turn', tone: 'font-semibold text-brand-700' } : { text: 'To do', tone: 'text-ink-2' }
  if (x.state === 'done') return { text: resultOf(s, job, x, me), tone: 'text-[#2c6b4b]' }
  if (x.state === 'bad') return { text: x.note || 'A problem', tone: 'font-medium text-bad-600' }
  if (x.state === 'wait') { const w = stepNow(x, me); return { text: w.full && w.full.length <= 90 ? w.full : w.text, tone: 'text-warn-700' } }
  if (x.key === 'qty' && x.state === 'later') return { text: 'Checks itself', tone: 'text-muted' }
  return stepWords(s, job, x, me)
}
/** what came of a finished step, in a few words — and when */
function resultOf(s: Store, job: Job, x: StepView, me: PersonKey): string {
  const on = x.doneOn ? ` · ${x.doneOn}` : ''
  const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`
  const tiles = Object.values(s.tiles[job.id] || {})
  const rooms = s.rooms[job.id] || []
  const checks = s.checks.filter((c) => c.jobId === job.id)
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const plain = () => { const t = (x.note || '').trim(); return t && !/^done$/i.test(t) ? t : `Done${on}` }
  switch (x.key) {
    case 'getpaper': { const f = s.files.filter((y) => y.jobId === job.id && y.kind === 'paperwork').length; return `Got it${f ? ` · ${n(f, 'file')}` : ''}${on}` }
    case 'rooms': { const surf = rooms.reduce((k, r) => k + r.surfaces.length, 0); return [rooms.length ? n(rooms.length, 'room') : '', surf ? n(surf, 'surface') : '', tiles.length ? n(tiles.length, 'tile') : ''].filter(Boolean).join(' · ') || plain() }
    case 'qty': return stepNow(x, me).text
    case 'order': { const c = checks.find((y) => y.supplier); return c ? `${c.supplier}${c.eta ? ` · delivery ${c.eta}` : ''}` : stepNow(x, me).text }
    case 'delivered': {
      if (!checks.length) return stepNow(x, me).text
      const all = checks.every((c) => c.ordered > 0 && c.received >= c.ordered)
      return all ? `All ${n(checks.length, 'tile')} here${on}` : checks.filter((c) => c.received < c.ordered).map((c) => `${c.tag} ${c.received} of ${c.ordered} ${c.unit}`).join(' · ')
    }
    case 'installer': { const crew = (ipo?.crew || installerOf(s, job)) as PersonKey | undefined; return crew ? `${PEOPLE[crew]?.name || crew}${ipo ? ` · ${ipo.id}` : ''}` : plain() }
    case 'confirmed': return ipo?.status === 'Accepted' ? `${PEOPLE[ipo.crew]?.short || 'He'} said yes${ipo.date ? ` · ${ipo.date}` : on}` : plain()
    case 'heights': {
      const a = Object.values(s.stepRecs[job.id]?.heights?.checks || {}) as { ok?: boolean; fixed?: boolean; na?: boolean }[]
      if (!a.length) return plain()
      const good = a.filter((c) => c.ok || c.fixed || c.na).length
      return good === a.length ? `All ${a.length} checked — OK${on}` : `${good} of ${a.length} OK`
    }
    default: return plain()
  }
}
function ReadyList({ job, tracks, onPick }: { job: Job; tracks: TrackView[]; onPick: (k: string) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const n = tracks.length
  const done = tracks.filter((t) => t.state === 'done').length
  const parts = tracks.map((t) => ({ t, list: t.steps.filter((x) => x.state !== 'na') }))
  /* two columns on a wide screen: the parts in order, down the first and on into the second — split where the two
     come out closest to the same height */
  const size = (ps: typeof parts) => ps.reduce((k, p) => k + p.list.length + 1, 0)
  let cut = parts.length
  for (let i = 1, best = Infinity; i < parts.length; i++) {
    const tall = Math.max(size(parts.slice(0, i)), size(parts.slice(i)))
    if (tall < best) { best = tall; cut = i }
  }
  const cols = [parts.slice(0, cut), parts.slice(cut)].filter((c) => c.length)
  const part = ({ t, list }: (typeof parts)[number]) => {
    const finished = t.state === 'done'
    return (
      <div key={t.key} data-track={t.key} data-step-track={t.key} data-state={t.state}>
        <div data-track-head className={cn(BAND_STRONG, 'w-full px-5 text-left max-sm:px-4')} style={bandStyle(finished ? 'ok' : 'neutral')}>
          <span className={bandLabel(finished ? 'ok' : 'neutral')}>{t.label}</span>
          <span className={cn('text-[0.8125rem] tnum', finished ? 'font-semibold text-[#1f6b45]' : 'text-muted')} data-part-count>{finished ? `Done${t.doneOn ? ` ${t.doneOn}` : ''}` : `${t.done} of ${t.total} done`}</span>
        </div>
        <div data-part-path>
          {chainsOf(list).map((g) => g.map((x, i) => <StepLine key={x.key} job={job} x={x} me={me} up={g.length > 1 && i > 0} down={g.length > 1 && i < g.length - 1} onClick={() => onPick(x.key)} />))}
        </div>
      </div>
    )
  }
  return (
    <section data-tracks className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex min-w-0 items-baseline gap-2.5 px-5 pb-3 pt-4 max-sm:px-4">
        <h3 className="shrink-0 text-[1.0625rem] font-semibold text-ink">Getting ready</h3>
        <span className={cn('min-w-0 truncate text-[0.875rem]', done === n ? 'font-medium text-[#2c8a5b]' : 'text-muted')}>{done === n ? `all ${n} parts done` : `${done} of ${n} parts done`}</span>
      </header>
      <div className={cn('min-w-0', cols.length > 1 && 'xl:grid xl:grid-cols-2 xl:divide-x xl:divide-line-2')} data-part-cols={cols.length}>
        {cols.map((c, i) => (
          <div key={i} className="min-w-0" data-part-col={i}>
            <div className={cn(HEAD_ROW, LINE_COLS, 'px-5 max-md:hidden', i > 0 && 'max-xl:hidden')}><span>Step</span><span>Whose</span><span>Where it is</span></div>
            {c.map(part)}
          </div>
        ))}
      </div>
      <OpenIssues job={job} band />
    </section>
  )
}
/** one step, one line: its mark (joined to the steps before and after it when they follow each other), its name,
 *  whose it is, where it's at — in full, on as many lines as it takes. Tap it: its own window. */
function StepLine({ job, x, me, up, down, onClick }: { job: Job; x: StepView; me: PersonKey; up: boolean; down: boolean; onClick: () => void }) {
  const s = useStore()
  const st = stateOf(s, job, x, me)
  const who = x.owner === me ? 'You' : PEOPLE[x.owner]?.short || ''
  const lineTone = (k: boolean) => (k ? 'bg-[#2c8a5b]' : 'bg-[#d9d3c9]')
  return (
    <button type="button" onClick={onClick} data-track-step={x.key} data-state={x.state} className={cn('relative block min-h-11 w-full border-t border-line-2 px-5 py-1.5 text-left transition row-hover max-sm:min-h-12 max-sm:px-4 max-sm:py-2', LINE_COLS)}>
      {/* the line joining it to the step before and the one after */}
      {up && <span className={cn('absolute left-[1.71875rem] top-0 h-[calc(50%-0.625rem)] w-0.5 max-sm:left-[1.46875rem]', lineTone(x.state === 'done'))} aria-hidden />}
      {down && <span className={cn('absolute bottom-0 left-[1.71875rem] h-[calc(50%-0.625rem)] w-0.5 max-sm:left-[1.46875rem]', lineTone(x.state === 'done'))} aria-hidden />}
      <span className="flex min-w-0 items-center gap-3">
        <span className="relative z-[1] inline-flex h-5 w-5 shrink-0 items-center justify-center bg-inherit"><StepIcon state={x.state} size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[0.9375rem] leading-snug', x.state === 'later' ? 'font-medium text-ink-2' : 'font-semibold text-ink')} data-step-name>{stepShort(s, job, x)}</span>
          <span className={cn('block text-[0.8125rem] leading-snug md:hidden', st.tone)}>{[who, st.text].filter(Boolean).join(' · ')}</span>
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-2 max-md:hidden">{x.owner && PEOPLE[x.owner] && <Avatar who={x.owner} size={20} />}<span className={cn('min-w-0 text-[0.875rem] leading-snug', x.owner === me ? 'font-medium text-ink' : 'text-ink-2')}>{who}</span></span>
      <span className={cn('min-w-0 text-[0.875rem] leading-snug max-md:hidden', st.tone)} data-step-now>{st.text}</span>
    </button>
  )
}

/** once getting ready is done: its steps that are still open (a problem, something left to do) — they go on Open items,
 *  except the ones that are already there another way (tile that came short is its own item) */
function openStepsOf(s: Store, job: Job, steps: StepView[], phase: Phase): StepView[] {
  if (phase === 'ready') return []
  const inPart = new Set(tracksFor(s, job, steps).flatMap((t) => t.steps.map((v) => v.key)))
  const listed = new Set(problemsOf(s, job, steps).map((p) => p.step).filter(Boolean))
  return steps.filter((v) => inPart.has(v.key) && ['bad', 'now', 'wait'].includes(v.state) && (v.state !== 'bad' || listed.has(v.key)))
}

/** the stage the project is at: the crew, the installing, the touch-ups */
function Stage({ job, phase, setView }: { job: Job; phase: Phase; setView: (v: BoardView) => void }) {
  const s = useStore()
  const punch = s.punch.some((p) => p.jobId === job.id && p.status !== 'verified')
  return (
    <>
      {phase === 'crew' && <CrewCard job={job} />}
      {phase === 'install' && <Installing job={job} setView={setView} />}
      {(phase === 'punch' || punch) && <TouchupsCard job={job} />}
    </>
  )
}

/* ---------------- the crew: who, his PO, the days ---------------- */
function CrewCard({ job }: { job: Job }) {
  const s = useStore()
  const crew = (installerOf(s, job) || job.crew) as PersonKey | undefined
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const b = bookingOf(s, job)
  const booked = job.stage === 'scheduled' || !!b
  const dep = moneyLine(s, job).dep
  const money = !['site', 'crew', 'client'].includes(s.role)
  return (
    <section data-crew className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-center gap-2 border-b border-line-2 px-5 py-3">
        <h3 className="text-[1rem] font-semibold text-ink">Crew</h3>
        <span className={cn('text-[0.8125rem]', booked ? 'font-medium text-[#2c8a5b]' : 'text-muted')}>{booked ? 'Scheduled' : 'Getting ready is done — pick the days'}</span>
      </header>
      <div className="flex flex-col gap-2.5 px-5 py-3.5 text-[0.875rem]">
        <button onClick={() => (ipo ? s.open({ t: 'ipo', id: ipo.id }) : s.open({ t: 'installerwin', jobId: job.id }))} className="flex min-w-0 items-center gap-3 text-left">
          {crew ? <Avatar who={crew} size={32} /> : <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wash-2 text-faint"><HardHat className="h-4 w-4" /></span>}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-semibold text-ink">{crew ? PEOPLE[crew]?.name : 'No installer yet'}</span>
            <span className="block truncate text-[0.78125rem] text-muted">{ipo ? `${ipo.id} · ${ipo.status === 'Accepted' ? `accepted${ipo.date ? ` ${ipo.date}` : ''}` : ipo.status.toLowerCase()}` : 'No PO yet'}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
        </button>
        <div className="flex items-center gap-3 text-ink-2">
          <span className="inline-flex w-8 justify-center"><CalendarDays className="h-4 w-4 text-faint" /></span>
          {b ? <span><b className="font-semibold text-ink">{labelFromIso(b.start)} – {labelFromIso(b.end)}</b>{b.workers ? ` · ${b.workers} workers` : ''}{b.status === 'pending' ? <span className="text-warn-700"> · waiting for his OK</span> : null}</span> : <span className="text-muted">No days on the calendar yet</span>}
        </div>
        {money && dep && dep.tone === 'warn' && (
          <div className="flex items-center gap-3 text-warn-700">
            <span className="inline-flex w-8 justify-center"><Receipt className="h-4 w-4" /></span>
            <span className="font-medium">{dep.text.replace(/^./, (c) => c.toUpperCase())} — a warning, not a stop</span>
          </div>
        )}
      </div>
    </section>
  )
}

/* ---------------- installing: how far, who, the days — and each room ---------------- */
function Installing({ job, setView }: { job: Job; setView: (v: BoardView) => void }) {
  const s = useStore()
  const rooms = roomsOf(s, job)
  const sfAll = rooms.reduce((n, r) => n + (r.sf || 0), 0)
  const pct = job.pct ?? (sfAll ? Math.round(rooms.reduce((n, r) => n + (r.sf || 0) * r.pct, 0) / sfAll) : 0)
  const crew = (installerOf(s, job) || job.crew) as PersonKey | undefined
  const b = bookingOf(s, job)
  const dates = job.dates?.start ? `${job.dates.start} – ${job.dates.finish || '…'}` : b ? `${labelFromIso(b.start)} – ${labelFromIso(b.end)}` : ''
  const last = (s.diary[job.id] || [])[0]
  const stopped = rooms.filter((r) => r.state === 'stopped').length
  return (
    <section data-installing className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex min-w-0 items-center gap-3.5 border-b border-line-2 px-5 py-3.5 max-sm:px-4">
        <ProgressRing pct={pct} size={46} tone={stopped ? 'bad' : 'info'} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[1rem] font-semibold text-ink">Installing — {pct}% in</span>
          <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">{[crew ? PEOPLE[crew]?.name : 'No installer', dates].filter(Boolean).join(' · ')}{stopped ? <b className="font-semibold text-bad-600"> · {stopped} {stopped === 1 ? 'room' : 'rooms'} stopped</b> : null}</span>
        </span>
      </header>
      <div className="p-1.5">
        {rooms.map((r) => (
          <button key={r.room.name} data-install-room={r.room.name} onClick={() => setView({ t: 'room', name: r.room.name })} className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_8rem_5.5rem] items-center gap-3 rounded-lg px-3.5 py-2 text-left transition hover:bg-[#f6f3ee] max-sm:grid-cols-[minmax(0,1fr)_5rem_4.5rem] max-sm:px-2.5">
            <span className="min-w-0 truncate text-[0.875rem] font-medium text-ink">{r.room.name}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-[#ece8e1]" aria-hidden><span className={cn('block h-full rounded-full', r.state === 'stopped' ? 'bg-bad-500' : r.state === 'done' ? 'bg-[#2c8a5b]' : 'bg-brand-600')} style={{ width: `${r.pct}%` }} /></span>
            <span className={cn('text-right text-[0.8125rem] tnum', r.state === 'stopped' ? 'font-semibold text-bad-600' : r.state === 'done' ? 'font-medium text-[#2c8a5b]' : 'text-ink-2')}>{r.state === 'done' ? 'Done' : r.state === 'stopped' ? 'Stopped' : `${r.pct}%`}</span>
          </button>
        ))}
        {!rooms.length && <div className="px-3.5 py-2.5 text-[0.84375rem] text-muted">No rooms on this project.</div>}
      </div>
      <footer className="border-t border-line-2 px-5 py-2.5 text-[0.8125rem] text-muted max-sm:px-4">
        {last ? <>Last daily update <b className="font-semibold text-ink-2">{last.date}</b> · {last.who === meOf(s.role) ? 'you' : firstName(last.who)}</> : 'No daily update yet — it’s on the site manager’s Today every day'}
      </footer>
    </section>
  )
}

/* ---------------- open items: anything else open on the project — problems first, then what we wait on, then what
 * someone has to do — each one someone's, one line each: what it is, when, whose. Nothing open: nothing shown. They're
 * added with the project's one + Add, on top. ---------------- */
/** "Today", "This week", "Before Fri" read in a sentence: today, this week, before Fri */
const dayWord = (d: string) => d.replace(/^(Today|Tomorrow|This|Next|Every|By|Before)\b/, (w) => w.toLowerCase())
export function OpenIssues({ job, className, steps = [], onStep, band, fill }: { job: Job; className?: string; /** getting ready's steps still open (once it's done) */ steps?: StepView[]; onStep?: (k: string) => void; /** under the parts, in the same panel: a band and its lines */ band?: boolean; /** its own panel beside the stage — there even when nothing's open */ fill?: boolean }) {
  const s = useStore()
  const me = meOf(s.role)
  /* tailored to whoever's looking: what's theirs comes first (a problem before the rest), then everyone else's */
  const list = [...issuesOf(s, job)].sort((a, b) => Number(b.owner === me) - Number(a.owner === me))
  const [all, setAll] = React.useState(false)
  const n = list.length + steps.length
  if (!n && !fill) return null
  /* problems first: a step's problem, then the rest (issuesOf sorts them) — yours before anyone else's */
  const stepRows = [...steps].sort((a, b) => Number(b.owner === me) - Number(a.owner === me) || Number(b.state === 'bad') - Number(a.state === 'bad'))
  const max = all || fill ? 99 : 6
  const shownSteps = stepRows.slice(0, max)
  const shown = list.slice(0, Math.max(0, max - shownSteps.length))
  const who = (p: PersonKey) => (
    <span className="flex shrink-0 items-center gap-2" title={p === me ? 'You' : PEOPLE[p]?.name}>
      <Avatar who={p} size={22} />
      <span className={cn('w-[4.5rem] truncate text-[0.8125rem] max-sm:sr-only', p === me ? 'font-medium text-ink' : 'text-ink-2')}>{p === me ? 'You' : firstName(p)}</span>
    </span>
  )
  const ROW = 'flex min-h-[2.75rem] w-full min-w-0 items-center gap-3 border-t border-line-2 px-4 py-2 text-left transition row-hover max-sm:px-3'
  const rows = (
    <>
      {shownSteps.map((v) => (
        <button key={'s:' + v.key} data-issue={'step:' + v.key} title={v.note} onClick={() => onStep?.(v.key)} className={ROW}>
          <StepIcon state={v.state === 'bad' ? 'bad' : v.state === 'wait' ? 'wait' : 'now'} size={20} />
          <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-ink">{v.state === 'bad' && v.note ? v.note.split(' · ')[0].replace(/^No — /, '') : todoOf(v)}</span>
          {who(v.owner)}
        </button>
      ))}
      {shown.map((t) => {
        const waiting = t.state === 'waiting'
        const lateDue = !waiting && !!t.due && (/late/i.test(t.due) || (isoFromLabel(t.due) || '9') < TODAY)
        const when = waiting ? (t.followUp ? `back ${dayWord(t.followUp)}` : 'waiting') : t.due ? (/late/i.test(t.due) ? t.due : lateDue ? `due ${t.due}` : dayWord(t.due)) : ''
        return (
          <button key={t.id} data-issue={t.id} title={[issueKind(t), t.waitingOn ? `waiting on ${t.waitingOn}` : '', t.where].filter(Boolean).join(' · ')} onClick={() => s.open({ t: 'task', id: t.id })} className={ROW}>
            {isRequest(t) ? <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#fff1e3] text-[#c2410c]"><Truck className="h-3 w-3" /></span> : <StepIcon state={t.tone === 'bad' ? 'bad' : waiting ? 'wait' : 'now'} size={20} />}
            <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-ink">{t.title}</span>
            {when && <span className={cn('shrink-0 text-[0.75rem]', lateDue ? 'font-medium text-bad-600' : 'text-muted')}>{when}</span>}
            {who(t.owner)}
          </button>
        )
      })}
      {n > shownSteps.length + shown.length && <button onClick={() => setAll(true)} className="flex w-full items-center justify-center gap-1 border-t border-line-2 px-4 py-2 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50/40">{n - shownSteps.length - shown.length} more<ChevronDown className="h-3.5 w-3.5" /></button>}
    </>
  )
  /* under the parts: a band like every group, then its lines */
  if (band) return (
    <div data-issues className={className}>
      <div className={cn(BAND, 'px-4 max-sm:px-3')}>
        <span className={BAND_LABEL}>Open items</span>
        <BandCount n={n} />
      </div>
      {rows}
    </div>
  )
  return (
    <section data-issues data-none={!n || undefined} className={cn('flex min-w-0 flex-col overflow-hidden rounded-[0.875rem] border border-line bg-white', className)}>
      <header className="flex min-h-12 min-w-0 shrink-0 items-center gap-2 px-4 max-sm:px-3">
        <h4 className="shrink-0 text-[0.9375rem] font-semibold text-ink">Open items</h4>
        <span className="shrink-0 text-[0.8125rem] font-medium tnum text-faint">{n}</span>
      </header>
      {rows}
      {!n && <div className="border-t border-line-2 px-4 py-6 text-center text-[0.84375rem] text-muted max-sm:px-3">Nothing else open on this project.</div>}
    </section>
  )
}

function TouchupsCard({ job }: { job: Job }) {
  const s = useStore()
  const canAdd = !['accounting', 'client', 'crew'].includes(s.role)
  return (
    <section data-touchups className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex min-h-12 items-center gap-2 px-5 max-sm:px-4">
        <h3 className="text-[0.9375rem] font-semibold text-ink">Touch-ups</h3>
        {canAdd && <button onClick={() => s.open({ t: 'punchnew', jobId: job.id })} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50"><Plus className="h-3.5 w-3.5" />Add</button>}
      </header>
      <TouchupsList job={job} />
    </section>
  )
}
