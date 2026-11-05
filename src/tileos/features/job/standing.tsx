/* Where the project stands.
 *   THE LINE (in the header), like the estimate's path: Approved → Getting ready → Crew scheduled → Installing →
 *     Touch-ups → Closed. "Crew scheduled" is locked until getting ready is done.
 *   WHERE IT STANDS (the first tab), while getting ready — calm, one list:
 *     the things a new job needs, in the order the job goes (Estimate · Tile paperwork · Design meeting · Site check ·
 *       Installer · Setting materials · Tile delivery), one line each: what's up on it and whose it is. What's done is
 *       one quiet line at the bottom. Tap a line: its own window, done right there.
 *     Under it: the open items.
 *   Once getting ready is done it isn't shown any more (it's done): what's next and the stage (the crew, the
 *     installing, the touch-ups), and beside it the open items — anything still open, each thing once. */
import * as React from 'react'
import { ChevronDown, ChevronRight, Plus, Truck, HardHat, CalendarDays, Receipt } from 'lucide-react'
import { useStore, meOf, isRequest, type Store } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { Circles, ProgressRing, BAND, BAND_LABEL, BandCount } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { labelFromIso, isoFromLabel, TODAY } from '@/tileos/lib/today'
import { stepsFor, type StepView } from '../steps'
import { StepIcon } from '../steps-ui'
import { todoOf, stepNow, StepInline } from '../stepwin'
import { useReadBusy } from '../paperread'
import { NextUp } from './next'
import { installerOf } from '../upcoming'
import { TouchupsList } from '../touchups'
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
    /* while getting ready: its line's window, on that step; after: the step's own */
    const t = tracks.find((x) => x.steps.some((v) => v.key === open.step))
    if (t && phase === 'ready') s.open({ t: 'part', jobId: job.id, track: t.key, step: open.step })
    else if (t) pick(open.step)
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
  /* getting ready: the list — each line says whose it is — and the open items, only as tall as that. The crew already
     booked: "Start the job" over it */
  const booked = job.stage === 'scheduled' || !!bookingOf(s, job)
  return (
    <div data-phase={phase} className="flex min-w-0 flex-col gap-3 lg:h-full lg:gap-4">
      <div data-stands-main className={COL.replace(' lg:[&>*:last-child]:grow', '')}>
        {booked && <NextUp job={job} onStep={pick} />}
        <ReadyList job={job} tracks={tracks} />
      </div>
    </div>
  )
}

/* ---------------- getting ready: the things a new job needs, one line each ----------------
 * In the order the job goes: the estimate (what we're tiling), the tile paperwork (what tile goes where), the design
 * meeting, the site check (the levels and the rest), the installer and his PO, our setting materials, the tile
 * delivery. Each line: what it is, what's up on it now — said plainly — and whose it is. Tap one: its own window,
 * where it's done right there. What's done isn't a line any more — one quiet line at the bottom names it. */
/** what's up on a line, in a few words — the line's name says what it's about, so these don't repeat it */
const LINE_NOW: Record<string, string> = {
  estimate: 'Add it — the rooms come from it',
  getpaper: 'Get it from the store',
  rooms: 'Upload it — every tile on its walls and floors',
  qty: 'Check the quantities',
  design: 'Set the meeting',
  change: 'Confirm the scope after the meeting',
  layouts: 'Set the layouts',
  heights: 'Power, water, drains, the rough-in, floor levels',
  level: 'Measure the floors — high and low',
  fixes: 'Check the fixes again on site',
  sheets: 'Print and hang the room sheets',
  walk: 'Walk him through the job',
  confirmed: 'Get his yes',
  setup: 'Decide the underlayment',
  materials: 'Order them',
  matin: 'Did they come?',
  order: 'Get the delivery date',
  delivered: 'Check it in — count what came',
}
/** what a step that isn't open yet comes after, in a few words */
const AFTER_WORDS: Record<string, string> = {
  estimate: 'the estimate', getpaper: 'the paperwork', rooms: 'the paperwork', tile: 'the paperwork', qty: 'the quantities', design: 'the meeting',
  layouts: 'the layouts', heights: 'the site check', installer: 'his PO', order: 'the delivery date', setup: 'the underlayment', materials: 'the order',
}
function lineNow(s: Store, job: Job, t: TrackView, me: PersonKey): { text: string; tone: string } {
  const v = t.lead
  if (!v || t.state === 'done') return { text: 'Done', tone: 'text-[#2c6b4b]' }
  const late = !!v.due && v.due < TODAY && (v.state === 'now' || v.state === 'bad')
  const lateWord = late ? ` · was due ${labelFromIso(v.due!)}` : ''
  if (v.state === 'bad') return { text: (v.note || 'A problem').split(' · ')[0].replace(/^No — /, '') + lateWord, tone: 'font-medium text-bad-600' }
  if (v.state === 'wait') return { text: stepNow(v, me).text, tone: 'text-warn-700' }
  if (v.state === 'later') return { text: `After ${AFTER_WORDS[v.waitsKey || ''] || (v.waitsFor || 'the step before').toLowerCase()}`, tone: 'text-muted' }
  /* under way: how far, when the step counts it ("3 of 12 walls and floors have their tile") */
  const note = (v.note || '').split(' · ')[0]
  const counted = /\d+ of \d+/.test(note) || (v.key === 'rooms' && /\bneeds?\b/.test(v.note || '')) ? (v.key === 'rooms' ? v.note || note : note) : ''
  const crew = v.key === 'installer' ? installerOf(s, job) : undefined
  const text = v.key === 'installer' ? (crew ? `Send ${PEOPLE[crew]?.short || 'him'} his PO` : 'Pick him and send his PO') : counted || LINE_NOW[v.key] || todoOf(v)
  return { text: text + lateWord, tone: late ? 'font-medium text-bad-600' : 'text-ink-2' }
}
/** the columns every line shares, so they line up top to bottom: its mark · its name · whose · what's up · › (a phone:
 *  its mark · the name over what's up · whose · ›) */
const LINE_GRID = 'grid min-h-[3.25rem] items-center gap-x-4 grid-cols-[1.25rem_10.5rem_9.5rem_minmax(0,1fr)_1rem] max-sm:grid-cols-[1.25rem_minmax(0,1fr)_1.5rem_1rem] max-sm:gap-x-3'
function ReadyList({ job, tracks }: { job: Job; tracks: TrackView[] }) {
  const s = useStore()
  const me = meOf(s.role)
  const n = tracks.length
  const open = tracks.filter((t) => t.state !== 'done')
  const done = tracks.filter((t) => t.state === 'done')
  const openLine = (k: TrackKey) => s.open({ t: 'part', jobId: job.id, track: k })
  return (
    <section data-tracks className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex min-w-0 items-baseline gap-2.5 px-5 pb-3 pt-4 max-sm:px-4">
        <h3 className="shrink-0 text-[1.0625rem] font-semibold text-ink">Getting ready</h3>
        <span className={cn('min-w-0 truncate text-[0.875rem]', !open.length ? 'font-medium text-[#2c8a5b]' : 'text-muted')} data-ready-count>{!open.length ? `all ${n} done` : `${done.length} of ${n} done`}</span>
      </header>
      <div data-ready-lines>
        {open.map((t) => <LineRow key={t.key} job={job} t={t} me={me} onOpen={() => openLine(t.key)} />)}
        {done.length > 0 && (
          <div className={cn(LINE_GRID, 'border-t border-line-2 px-5 py-2.5 max-sm:px-4')} data-lines-done={done.length}>
            <StepIcon state="done" size={20} />
            <span className="text-[0.9375rem] font-semibold text-[#2c6b4b] max-sm:hidden">Done</span>
            <span className="col-span-3 min-w-0 text-[0.875rem] leading-relaxed text-muted max-sm:text-[0.8125rem]">
              <span className="font-semibold text-[#2c6b4b] sm:hidden">Done · </span>
              {done.map((t, i) => (
                <React.Fragment key={t.key}>
                  {i > 0 && <span aria-hidden> · </span>}
                  <button type="button" onClick={() => openLine(t.key)} className="font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline" data-line-done={t.key}>{t.label}</button>
                </React.Fragment>
              ))}
            </span>
          </div>
        )}
      </div>
      <OpenIssues job={job} band />
    </section>
  )
}
/** one line of getting ready: its mark, its name, what's up on it, whose it is — tap it for its window */
function LineRow({ job, t, me, onOpen }: { job: Job; t: TrackView; me: PersonKey; onOpen: () => void }) {
  const s = useStore()
  const v = t.lead
  const w = lineNow(s, job, t, me)
  const who = v?.owner
  const mine = !!v && v.owner === me && (v.state === 'now' || v.state === 'bad')
  return (
    <button type="button" onClick={onOpen} data-ready-line={t.key} data-state={t.state} data-line-step={v?.key} className={cn(LINE_GRID, 'w-full border-t border-line-2 px-5 py-2 text-left transition row-hover max-sm:px-4')}>
      <StepIcon state={t.state} size={20} />
      <span className="min-w-0 truncate text-[0.9375rem] font-semibold text-ink max-sm:hidden" data-line-name>{t.label}</span>
      <span className="flex min-w-0 items-center gap-2 max-sm:order-2" title={who ? (who === me ? 'You' : PEOPLE[who]?.name) : undefined}>
        {who && <Avatar who={who} size={22} />}
        {who && <span className={cn('truncate text-[0.8125rem] max-sm:sr-only', mine ? 'font-semibold text-brand-700' : who === me ? 'font-medium text-ink' : 'text-ink-2')} data-line-who={who}>{who === me ? 'You' : firstName(who)}</span>}
      </span>
      <span className="min-w-0 max-sm:order-1">
        <span className="block truncate text-[0.9375rem] font-semibold leading-snug text-ink sm:hidden">{t.label}</span>
        <span className={cn('block truncate text-[0.875rem] leading-snug max-sm:text-[0.8125rem]', w.tone)} data-line-now>{w.text}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-faint max-sm:order-3" />
    </button>
  )
}
/** one line's window: what's up on it, done right here — nothing opens on top of it, nothing sends you somewhere
 *  else. A line with more than one step has them across the top, like a parcel's tracking (✓ done, the one it's on,
 *  what comes after) — tap one to see it. It opens on the step that's up (or the one asked for). */
const STAY = () => {}
export function PartModal({ jobId, track, step, level }: { jobId: string; track: TrackKey; step?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const t = job ? tracksFor(s, job).find((x) => x.key === track) : undefined
  const list = t ? t.steps.filter((x) => x.state !== 'na') : []
  const [at, setAt] = React.useState<string>(() => (step && list.some((x) => x.key === step) ? step : (t?.lead || list.find((x) => x.state !== 'done') || list[0])?.key) || '')
  const v = list.find((x) => x.key === at) || list[0]
  /* done — move forward: the step open here gets done, and the line's next one opens by itself (a beat to see the ✓);
     the whole line done, when it was opened to do it: the window closes by itself */
  const seen = React.useRef<{ k: string; st: string } | null>(null)
  const openedOpen = React.useRef(t?.state !== 'done')
  const busy = useReadBusy(jobId)
  const top = s.modals.length - 1 === level
  React.useEffect(() => {
    if (!v || !t) return
    const was = seen.current
    seen.current = { k: v.key, st: v.state }
    if (!was || was.k !== v.key || was.st === 'done' || v.state !== 'done') return
    const next = t.lead && t.lead.key !== v.key ? t.lead.key : undefined
    if (next) { const id = setTimeout(() => setAt(next), 650); return () => clearTimeout(id) }
  }, [v?.key, v?.state])
  React.useEffect(() => {
    if (!t || t.state !== 'done' || !openedOpen.current || !top || busy) return
    const id = setTimeout(() => useStore.getState().closeLevel(level), 650)
    return () => clearTimeout(id)
  }, [t?.state, top, busy])
  if (!job || !t) return null
  return (
    <Modal level={level} size="md" onClose={s.close} title={t.label} sub={job.name} bodyClass="p-0">
      <div className="min-w-0 px-6 pb-6 pt-4 max-sm:px-4 max-sm:pt-3" data-track={t.key} data-step-track={t.key} data-state={t.state}>
        {list.length > 1 && <LinePath job={job} list={list} at={v?.key} onPick={setAt} />}
        {v
          ? <div data-part-open={v.key}><StepInline key={v.key} job={job} v={v} onClose={STAY} /></div>
          : <div className="py-6 text-center text-[0.875rem] text-muted">Nothing on this one for this project.</div>}
      </div>
    </Modal>
  )
}
/** a line's steps across the top of its window, in order — ✓ done, the one it's on, what comes after; tap one to see it */
function LinePath({ job, list, at, onPick }: { job: Job; list: StepView[]; at?: string; onPick: (k: string) => void }) {
  const s = useStore()
  return (
    <nav aria-label="Its steps" className="-mx-1 mb-4 flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-line-2 pb-0.5" data-part-path>
      {list.map((x, i) => {
        const on = x.key === at
        return (
          <React.Fragment key={x.key}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#b5ad9f]" aria-hidden />}
            <button type="button" onClick={() => onPick(x.key)} aria-current={on ? 'step' : undefined} data-track-step={x.key} data-state={x.state} {...(on ? { 'data-on': '' } : {})}
              className={cn('-mb-[0.1875rem] inline-flex min-h-10 items-center gap-2 border-b-2 px-1 text-[0.875rem] font-semibold transition', on ? 'border-brand-600 text-ink' : 'border-transparent text-ink-2 hover:text-ink')}>
              <StepIcon state={x.state} size={16} />
              <span data-step-name>{stepShort(s, job, x)}</span>
            </button>
          </React.Fragment>
        )
      })}
    </nav>
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
