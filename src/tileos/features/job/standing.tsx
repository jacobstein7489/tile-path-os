/* Where the project stands.
 *   THE LINE (in the header), like the estimate's path: Approved → Getting ready → Crew scheduled → Installing →
 *     Touch-ups → Closed. "Crew scheduled" is locked until getting ready is done.
 *   WHERE IT STANDS (the first tab):
 *     Getting ready, one line for each part (Design · Tile · Site · Installer · Materials): where it's up to — the step
 *       it's on, in words (Waiting on the store · back Thu, Your turn · due Wed) — and whose it is, with their initials
 *       in a circle. A part that's done says so. Nothing opens up inside the list.
 *     Pick a part: its steps as circles, like the estimate's path (✓ done, the one it's on, what comes after), and
 *       under them the step you picked, with its work — only its person does it; anyone else can remind them.
 *     On a computer the part is beside the list, and the part that's up next is open from the start. On a phone the
 *       list is the page; a part opens on its own with Back on top.
 *     Under the parts: the open items.
 *   Once getting ready is done it isn't shown any more (it's done): what's next and the stage (the crew, the
 *     installing, the touch-ups), and beside it the open items — anything still open, each thing once. */
import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Truck, HardHat, CalendarDays, Receipt, TriangleAlert, ListTodo, Package, X } from 'lucide-react'
import { useStore, meOf, isRequest, type Store } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { Circles, Circle, ProgressRing, BAND, type CircleState, type CircleStep } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { labelFromIso, isoFromLabel, TODAY } from '@/tileos/lib/today'
import { stepsFor, type StepView } from '../steps'
import { StepIcon, stepWords } from '../steps-ui'
import { StepInline, PartPath, TITLE, todoOf } from '../stepwin'
import { NextUp } from './next'
import { nextOn } from './plan'
import { installerOf } from '../upcoming'
import { TouchupsList } from '../touchups'
import { allowedFor } from '../newpicker'
import { firstName, useWide } from './kit'
import { tracksFor, lineOf, phaseOf, stepShort, moneyLine, issuesOf, issueKind, bookingOf, roomsOf, problemsOf, type TrackView, type TrackKey, type Phase } from '../tracks'
import type { BoardView } from './board'

/** the part that's open on Where it stands, and the step picked in it */
export type OpenTrack = { track: TrackKey; step: string } | null

/* ================= the line ================= */
/** where the project is — one line, like the estimate's: the step going on now is filled blue and says "Now" */
export function ProjectLine({ job, className }: { job: Job; className?: string }) {
  const s = useStore()
  const line = lineOf(s, job, tracksFor(s, job))
  const here = line.find((x) => x.state === 'now' || x.state === 'bad') || [...line].reverse().find((x) => x.state === 'done')
  return (
    <>
      <Circles
        layout="beside"
        markNow
        size={30}
        className={className}
        label="Where the project is"
        groups={[{ key: 'line', steps: line.map((x, i) => ({ key: x.key, label: x.label, sub: x.sub, state: x.state, lock: x.lock, center: String(i + 1), attrs: { 'data-line': x.key, ...(x.lock ? { 'data-gate': 'locked' } : {}) } })) }]}
      />
      {here && <div className="mt-1.5 truncate text-[0.8125rem] sm:hidden" data-line-now><b className={cn('font-semibold', here.state === 'bad' ? 'text-bad-600' : 'text-brand-700')}>{here.label}</b>{here.sub ? <span className="text-muted"> · {here.sub}</span> : null}</div>}
    </>
  )
}

/* ================= where it stands ================= */
/** the step that's up next: your turn first (a problem before the rest), then anyone's — else the first part still open */
function leadOf(s: Store, job: Job, tracks: TrackView[]): OpenTrack {
  const n = nextOn(s, job)
  const t = n ? tracks.find((x) => x.steps.some((v) => v.key === n.v.key)) : undefined
  if (n && t) return { track: t.key, step: n.v.key }
  const open = tracks.find((x) => x.state !== 'done' && x.lead)
  return open?.lead ? { track: open.key, step: open.lead.key } : null
}
/** a part, opened: on the step it's on (or its last one, when it's done) */
const partOpen = (t: TrackView): OpenTrack => {
  const v = t.lead || [...t.steps].reverse().find((x) => x.state !== 'na') || t.steps[0]
  return v ? { track: t.key, step: v.key } : null
}

export function Stands({ job, open, setOpen, onStep, setView }: {
  job: Job
  open: OpenTrack
  setOpen: (o: OpenTrack) => void
  /** what's next's button: open its step */
  onStep: (k: string) => void
  /** a room, from the installing */
  setView: (v: BoardView) => void
}) {
  const s = useStore()
  const wide = useWide()
  const steps = stepsFor(s, job)
  const tracks = tracksFor(s, job, steps)
  const phase = phaseOf(s, job, tracks)
  const watching = ['client', 'crew'].includes(s.role)
  /* on a computer, while getting ready, the part that's up next is open from the start */
  const auto = wide && phase === 'ready' && !watching
  const sel: OpenTrack = open && tracks.some((t) => t.key === open.track && t.steps.some((v) => v.key === open.step)) ? open : auto ? leadOf(s, job, tracks) : null
  const t = sel ? tracks.find((x) => x.key === sel.track) : undefined
  const v = sel && t ? t.steps.find((x) => x.key === sel.step) : undefined
  /* to a step on any part — a step that isn't open yet points at the one it waits for, wherever that is */
  const pick = (k: string) => { const tk = tracks.find((x) => x.steps.some((y) => y.key === k))?.key; if (tk) setOpen({ track: tk, step: k }) }
  /* the side that shows the part starts at its top when another is picked */
  const right = React.useRef<HTMLDivElement>(null)
  const key = v ? `${t!.key}:${v.key}` : ''
  React.useEffect(() => {
    if (!key) return
    right.current?.scrollTo?.({ top: 0 })
    if (!wide) right.current?.closest('[data-board-tab]')?.scrollTo?.({ top: 0 })
  }, [key, wide])
  const booked = job.stage === 'scheduled' || !!bookingOf(s, job)
  const left = openStepsOf(s, job, steps, phase)
  /* every column is one panel that fills the window — the last card in a column takes the rest of its height */
  const COL = 'scroll-soft flex min-w-0 flex-col gap-3 lg:h-full lg:overflow-y-auto lg:pb-6 [&>*]:shrink-0 lg:[&>*:last-child]:grow'
  /* getting ready is done: no Getting ready list any more. What's next across the top; under it the stage (the crew,
     the installing, the touch-ups) and what's still open on the project, side by side, the same size — each thing
     once. A step opened from Open items shows in place of the stage. */
  if (phase !== 'ready') {
    const punch = s.punch.some((p) => p.jobId === job.id && p.status !== 'verified')
    const hasStage = phase === 'crew' || phase === 'install' || phase === 'punch' || punch
    return (
      <div data-phase={phase} className="flex min-w-0 flex-col gap-3 lg:h-full lg:gap-4">
        {!v && <NextUp job={job} onStep={onStep} />}
        <div className={cn('flex min-w-0 flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:gap-4', (hasStage || v) && 'lg:grid-cols-2')}>
          {(hasStage || v) && (
            <div ref={right} data-stands-main className={COL}>
              {v && t
                ? <PartPane job={job} t={t} v={v} back="Back to the project" onStep={(k) => setOpen({ track: t.key, step: k })} onGo={pick} onBack={!wide ? () => setOpen(null) : undefined} onClose={wide ? () => setOpen(null) : undefined} onDone={() => setOpen(null)} />
                : <Stage job={job} phase={phase} setView={setView} />}
            </div>
          )}
          <div data-stands-side className={cn(COL, v && 'max-lg:hidden')}><OpenIssues job={job} steps={left} onStep={pick} fill /></div>
        </div>
      </div>
    )
  }
  /* getting ready: two panels, the same size — the parts (and anything else open, under them) and the part you picked */
  return (
    <div data-phase={phase} className="flex min-w-0 flex-col gap-3 lg:grid lg:h-full lg:grid-cols-2 lg:gap-4">
      <div data-stands-list className={cn(COL, v && 'max-lg:hidden')}>
        <Parts job={job} tracks={tracks} at={v ? sel?.track : undefined} onPick={(x) => setOpen(partOpen(x))}><OpenIssues job={job} band /></Parts>
      </div>
      {/* the part that's open — or what's next */}
      <div ref={right} data-stands-main className={cn(COL, !v && 'max-lg:order-first')}>
        {v && t ? (
          <>
            {booked && wide && <NextUp job={job} onStep={onStep} />}
            <PartPane
              job={job}
              t={t}
              v={v}
              onStep={(k) => setOpen({ track: t.key, step: k })}
              onGo={pick}
              /* on a phone: back to the parts. While getting ready on a computer there's always a part open — pick
                 another on the left. */
              onBack={!wide ? () => setOpen(null) : undefined}
              onClose={wide && !auto ? () => setOpen(null) : undefined}
              onDone={() => setOpen(null)}
            />
          </>
        ) : (
          <Now job={job} phase={phase} onStep={onStep} setView={setView} />
        )}
      </div>
    </div>
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

/* ---------------- getting ready: one line for each part ---------------- */
/** a part's mark: the same circle as everywhere — ✓ done, ! a problem, a ring that fills as its steps get done (blue
 *  when the step it's on is yours, amber while it waits on someone outside) */
function partCircle(t: TrackView, mine: boolean): CircleStep {
  const state: CircleState = t.state === 'done' ? 'done' : t.state === 'bad' ? 'bad' : t.state === 'wait' ? 'wait' : t.state === 'now' ? (mine ? 'now' : 'todo') : 'later'
  return { key: t.key, label: t.label, state, pct: t.total ? Math.max(8, Math.round((t.done / t.total) * 100)) : 0 }
}
function Parts({ job, tracks, at, onPick, children }: { job: Job; tracks: TrackView[]; at?: TrackKey; onPick: (t: TrackView) => void; /** what else is open, under the parts in the same panel */ children?: React.ReactNode }) {
  const s = useStore()
  const me = meOf(s.role)
  const n = tracks.length
  const done = tracks.filter((t) => t.state === 'done').length
  return (
    <section data-tracks className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex min-w-0 items-baseline gap-2.5 px-4 pb-2.5 pt-3.5 max-sm:px-3">
        <h3 className="shrink-0 text-[1rem] font-semibold text-ink">Getting ready</h3>
        <span className={cn('min-w-0 truncate text-[0.8125rem]', done === n ? 'font-medium text-[#2c8a5b]' : 'text-muted')}>{done === n ? `all ${n} parts done` : `${done} of ${n} parts done`}</span>
      </header>
      <div>
        {tracks.map((t) => {
          const lead = t.state !== 'done' ? t.lead : undefined
          const mine = !!lead && lead.owner === me && (lead.state === 'now' || lead.state === 'bad')
          const w = lead ? stepWords(s, job, lead, me) : null
          const who = lead?.owner
          const on = at === t.key
          return (
            <button
              key={t.key}
              type="button"
              data-track={t.key}
              data-state={t.state}
              data-track-head
              data-mine={mine || undefined}
              data-on={on || undefined}
              aria-current={on || undefined}
              onClick={() => onPick(t)}
              className={cn('flex w-full min-w-0 items-center gap-3 border-t border-line-2 px-4 py-2.5 text-left transition max-sm:px-3', on ? 'bg-[#eef2fd] shadow-[inset_0.1875rem_0_0_#2650cf]' : 'hover:bg-[#faf8f5]')}
            >
              <Circle st={partCircle(t, mine)} size={28} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className={cn('truncate text-[0.9375rem] font-semibold', on ? 'text-ink' : 'text-ink')}>{t.label}</span>
                  {t.state !== 'done' && <span className="shrink-0 text-[0.75rem] tnum text-faint">{t.done} of {t.total}</span>}
                </span>
                <span data-step-words className={cn('mt-0.5 block truncate text-[0.78125rem]', t.state === 'done' ? 'font-medium text-[#2c8a5b]' : w?.tone)}>
                  {t.state === 'done' ? `Done${t.doneOn ? ` ${t.doneOn}` : ''}` : lead ? `${stepShort(s, job, lead)} · ${w!.text}` : 'Nothing open'}
                </span>
              </span>
              {who && PEOPLE[who] && (
                <span data-who className="flex w-[7.25rem] shrink-0 items-center gap-2 max-sm:w-auto">
                  <Avatar who={who} size={26} />
                  <span className={cn('min-w-0 truncate text-[0.8125rem] max-sm:sr-only', who === me ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>{who === me ? 'You' : firstName(who)}</span>
                </span>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-faint lg:hidden" />
            </button>
          )
        })}
      </div>
      {children}
    </section>
  )
}

/* ---------------- a part, open: its steps as circles, the picked one under them ---------------- */
function PartPane({ job, t, v, onStep, onGo, onBack, onClose, onDone, back = 'Getting ready' }: { job: Job; t: TrackView; v: StepView; onStep: (k: string) => void; onGo: (k: string) => void; onBack?: () => void; onClose?: () => void; onDone: () => void; back?: string }) {
  const list = t.steps.filter((x) => x.state !== 'na' || x.key === v.key)
  const title = v.named ? v.label : TITLE[v.key] || v.label
  return (
    <section data-step-view={v.key} data-step-track={t.key} className="min-w-0 overflow-hidden rounded-[0.875rem] border border-line bg-white">
      {onBack && (
        <button onClick={onBack} data-back className="flex w-full items-center gap-1 border-b border-line-2 px-3 py-2.5 text-left text-[0.875rem] font-semibold text-ink-2 hover:bg-wash">
          <ChevronLeft className="h-4 w-4" />{back}
        </button>
      )}
      <header className="flex min-w-0 items-baseline gap-2.5 px-5 pt-4 max-sm:px-4">
        <h3 className="shrink-0 text-[1.0625rem] font-semibold text-ink">{t.label}</h3>
        <span className={cn('min-w-0 truncate text-[0.8125rem]', t.state === 'done' ? 'font-medium text-[#2c8a5b]' : t.state === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>{t.state === 'done' ? `all done${t.doneOn ? ` · ${t.doneOn}` : ''}` : `${t.done} of ${t.total} done`}</span>
        {onClose && <button onClick={onClose} aria-label="Close" data-close-step className="-mr-1.5 ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full text-muted transition hover:bg-wash hover:text-ink"><X className="h-4 w-4" /></button>}
      </header>
      {/* its steps, like the estimate's path — tap one to see it */}
      <div className="border-b border-line-2 px-3 pb-2 pt-3 max-sm:px-1" data-part-path>
        <PartPath job={job} list={list} at={v.key} onPick={onStep} label={`${t.label} — its steps`} />
      </div>
      <div className="px-5 pb-5 pt-4 max-sm:px-4">
        <h4 className="mb-3 text-[1.0625rem] font-semibold leading-snug text-ink">{title}</h4>
        <StepInline job={job} v={v} onGo={onGo} onClose={onDone} />
      </div>
    </section>
  )
}

/* ---------------- what's next, and the stage ---------------- */
function Now({ job, phase, onStep, setView }: { job: Job; phase: Phase; onStep: (k: string) => void; setView: (v: BoardView) => void }) {
  return (
    <>
      <NextUp job={job} onStep={onStep} />
      <Stage job={job} phase={phase} setView={setView} />
    </>
  )
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
  const list = issuesOf(s, job)
  const [all, setAll] = React.useState(false)
  const n = list.length + steps.length
  if (!n && !fill) return null
  /* problems first: a step's problem, then the rest (issuesOf sorts them) */
  const stepRows = [...steps].sort((a, b) => Number(b.state === 'bad') - Number(a.state === 'bad'))
  const max = all || fill ? 99 : 6
  const shownSteps = stepRows.slice(0, max)
  const shown = list.slice(0, Math.max(0, max - shownSteps.length))
  const who = (p: PersonKey) => (
    <span className="flex shrink-0 items-center gap-2" title={p === me ? 'You' : PEOPLE[p]?.name}>
      <Avatar who={p} size={22} />
      <span className={cn('w-[4.5rem] truncate text-[0.8125rem] max-sm:sr-only', p === me ? 'font-medium text-ink' : 'text-ink-2')}>{p === me ? 'You' : firstName(p)}</span>
    </span>
  )
  const ROW = 'flex min-h-[2.75rem] w-full min-w-0 items-center gap-3 border-t border-line-2 px-4 py-2 text-left transition hover:bg-[#f7f5f0] max-sm:px-3'
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
        <span className="text-[0.8125rem] font-semibold text-ink-2">Open items</span>
        <span className="text-[0.8125rem] font-medium tnum text-faint">{n}</span>
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
