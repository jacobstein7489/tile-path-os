/* Where the project stands.
 *   THE LINE (in the header), like the estimate's path: Approved → Getting ready → Crew scheduled → Installing →
 *     Touch-ups → Closed. "Crew scheduled" is locked until getting ready is done.
 *   WHERE IT STANDS (the first tab), two sides that never move:
 *     left — getting ready, part by part (Design · Tile · Site · Installer · Materials): every step one line — its mark,
 *            its name, where it's up to in words (Your turn · due Wed, Waiting on the store · back Thu, After Check
 *            quantities) and whose it is, with their initials in a circle. A part that's all done is one line. Under
 *            it, the open issues and any tile that came short.
 *     right — the step you picked, with its work (only its person does it; anyone else can remind them). Pick another
 *            on the left and it shows instead — nothing opens inside anything. On a computer the step that's up next
 *            is open from the start; once the crew is in, the right is what's next — the crew, the installing, the
 *            touch-ups.
 *   On a phone, one side at a time: the list, then the step with Back on top.
 * Billing has its own tab — it never sits on top of the work. */
import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Truck, HardHat, CalendarDays, Check, Receipt, TriangleAlert, ListTodo, Package, X } from 'lucide-react'
import { useStore, meOf, isRequest, type Store } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { Circles, ProgressRing } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { labelFromIso, TODAY } from '@/tileos/lib/today'
import { stepsFor, type StepView } from '../steps'
import { StepIcon, StepLine } from '../steps-ui'
import { StepInline, TITLE } from '../stepwin'
import { NextUp } from './next'
import { nextOn } from './plan'
import { installerOf } from '../upcoming'
import { TouchupsList } from '../touchups'
import { allowedFor } from '../newpicker'
import { firstName, useWide } from './kit'
import { tracksFor, lineOf, phaseOf, stepShort, moneyLine, issuesOf, issueKind, bookingOf, roomsOf, type TrackView, type TrackKey, type Phase } from '../tracks'
import type { BoardView } from './board'

/** the step that's picked on Where it stands (and the part it's in) */
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
  /* on a computer, while getting ready, the step that's up next is open from the start */
  const auto = wide && phase === 'ready' && !watching
  const sel: OpenTrack = open && tracks.some((t) => t.key === open.track && t.steps.some((v) => v.key === open.step)) ? open : auto ? leadOf(s, job, tracks) : null
  const t = sel ? tracks.find((x) => x.key === sel.track) : undefined
  const v = sel && t ? t.steps.find((x) => x.key === sel.step) : undefined
  const pick = (k: string) => { const tk = tracks.find((x) => x.steps.some((y) => y.key === k))?.key; if (tk) setOpen({ track: tk, step: k }) }
  /* the side that shows the step starts at its top when another is picked */
  const right = React.useRef<HTMLDivElement>(null)
  const key = v ? `${t!.key}:${v.key}` : ''
  React.useEffect(() => {
    if (!key) return
    right.current?.scrollTo?.({ top: 0 })
    if (!wide) right.current?.closest('[data-board-tab]')?.scrollTo?.({ top: 0 })
  }, [key, wide])
  const booked = job.stage === 'scheduled' || !!bookingOf(s, job)
  return (
    <div data-phase={phase} className="flex min-w-0 flex-col gap-3 lg:grid lg:h-full lg:grid-cols-[25rem_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[28.5rem_minmax(0,1fr)] 2xl:grid-cols-[31rem_minmax(0,1fr)]">
      {/* left: getting ready, the open issues, more tile — it stays put */}
      <div data-stands-list className={cn('scroll-soft flex min-w-0 flex-col gap-3 lg:h-full lg:overflow-y-auto lg:pb-6 lg:pr-0.5 [&>*]:shrink-0', v && 'max-lg:hidden')}>
        <ReadyList job={job} tracks={tracks} phase={phase} sel={v ? sel : null} onPick={(o) => setOpen(o)} />
        <OpenIssues job={job} />
        <MoreTile job={job} />
      </div>
      {/* right: the step that's picked — or what's next */}
      <div ref={right} data-stands-main className={cn('scroll-soft flex min-w-0 flex-col gap-3 lg:h-full lg:overflow-y-auto lg:pb-6 [&>*]:shrink-0', !v && 'max-lg:order-first')}>
        {v && t ? (
          <>
            {phase === 'ready' && booked && wide && <NextUp job={job} onStep={onStep} />}
            <StepPane
              job={job}
              t={t}
              v={v}
              onGo={pick}
              /* on a phone: back to the list. Once the crew is in: back to what's next. While getting ready on a
                 computer there's always a step open — pick another on the left. */
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

/* ---------------- left: getting ready, part by part ---------------- */
function ReadyList({ job, tracks, phase, sel, onPick }: { job: Job; tracks: TrackView[]; phase: Phase; sel: OpenTrack; onPick: (o: OpenTrack) => void }) {
  const n = tracks.length
  const done = tracks.filter((t) => t.state === 'done').length
  /* the step that's picked is always in view on the list (it may be further down, in its part) */
  const ref = React.useRef<HTMLElement>(null)
  const selKey = sel ? `${sel.track}:${sel.step}` : ''
  React.useEffect(() => {
    const box = ref.current?.closest('[data-stands-list]') as HTMLElement | null
    const row = ref.current?.querySelector('[data-on]') as HTMLElement | null
    if (!box || !row || box.scrollHeight <= box.clientHeight + 2) return
    const b = box.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    if (r.top < b.top + 8) box.scrollTop += r.top - b.top - 56
    else if (r.bottom > b.bottom - 8) box.scrollTop += r.bottom - b.bottom + 56
  }, [selKey])
  return (
    <section ref={ref} data-tracks className="rounded-[0.875rem] border border-line bg-white">
      {/* its name stays on top while the list scrolls */}
      <header className="flex min-w-0 items-baseline gap-2.5 rounded-t-[0.875rem] bg-white px-4 pb-2 pt-3 max-sm:px-3 lg:sticky lg:top-0 lg:z-[2]">
        <h3 className="shrink-0 text-[1rem] font-semibold text-ink">Getting ready</h3>
        <span className={cn('min-w-0 truncate text-[0.8125rem]', done === n ? 'font-medium text-[#2c8a5b]' : 'text-muted')}>{done === n ? `all ${n} parts done` : `${done} of ${n} parts done`}</span>
      </header>
      <div className="overflow-hidden rounded-b-[0.875rem]">
        {tracks.map((t) => <Part key={t.key} job={job} t={t} sel={sel} onPick={onPick} folded={t.state === 'done' && !(sel?.track === t.key)} phase={phase} />)}
      </div>
    </section>
  )
}

/** one part: its name and how far it is on a light band, then its steps. All done: one line — tap it to see them. */
function Part({ job, t, sel, onPick, folded: fold0 }: { job: Job; t: TrackView; sel: OpenTrack; onPick: (o: OpenTrack) => void; folded: boolean; phase: Phase }) {
  const s = useStore()
  const me = meOf(s.role)
  const [unfold, setUnfold] = React.useState(false)
  const [showDone, setShowDone] = React.useState(false)
  const done = t.state === 'done'
  const folded = fold0 && !unfold
  const isSel = (v: StepView) => sel?.track === t.key && sel.step === v.key
  const all = t.steps.filter((v) => v.state !== 'na' || isSel(v))
  /* a part that's still open: what's done in it is one quiet line (tap it to see them) — its open steps are the list */
  const doneHere = done ? [] : all.filter((v) => v.state === 'done' && !isSel(v))
  const foldDone = doneHere.length >= 2 && !showDone
  const list = foldDone ? all.filter((v) => !doneHere.includes(v)) : all
  const mineOpen = list.some((v) => v.owner === me && (v.state === 'now' || v.state === 'bad'))
  const head = done
    ? <span className="inline-flex items-center gap-1 text-[0.78125rem] font-semibold text-[#2c8a5b]"><Check className="h-3.5 w-3.5" strokeWidth={3} />Done{t.doneOn ? ` ${t.doneOn}` : ''}</span>
    : t.state === 'bad'
      ? <span className="text-[0.78125rem] font-semibold text-bad-600">Problem · {t.done} of {t.total} done</span>
      : <span className="text-[0.78125rem] text-muted">{t.done} of {t.total} done</span>
  return (
    <div data-track={t.key} data-state={t.state} className="border-t border-line-2">
      <button
        type="button"
        data-track-head
        aria-expanded={done ? !folded : undefined}
        onClick={() => (done ? setUnfold(folded) : t.lead && onPick({ track: t.key, step: t.lead.key }))}
        className="flex w-full min-w-0 items-center gap-2 bg-[#f8f6f2] px-4 py-1.5 text-left transition hover:bg-[#f3f0ea] max-sm:px-3"
      >
        <span className={cn('min-w-0 truncate text-[0.8125rem] font-bold uppercase tracking-[0.04em]', done ? 'text-ink-2' : 'text-ink')}>{t.label}</span>
        {mineOpen && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-label="Something here is yours" />}
        <span className="ml-auto shrink-0">{head}</span>
        {done && <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-faint transition', !folded && 'rotate-180')} />}
      </button>
      {!folded && doneHere.length >= 2 && (
        <button type="button" data-done-fold aria-expanded={!foldDone} onClick={() => setShowDone(foldDone)} className="flex w-full min-w-0 items-center gap-3 border-t border-line-2 px-4 py-1.5 text-left transition hover:bg-[#faf8f5] max-sm:px-3">
          <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center"><span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2c4a3e] text-white"><Check className="h-2.5 w-2.5" strokeWidth={3.4} /></span></span>
          <span className="min-w-0 flex-1 truncate text-[0.78125rem] text-muted"><b className="font-semibold text-ink-2">{doneHere.length} done</b> · {doneHere.map((v) => stepShort(s, job, v)).join(' · ')}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-faint transition', !foldDone && 'rotate-180')} />
        </button>
      )}
      {!folded && list.map((v) => <StepLine key={v.key} job={job} v={v} me={me} on={isSel(v)} title={TITLE[v.key] || v.label} onPick={() => onPick({ track: t.key, step: v.key })} />)}
    </div>
  )
}

/* ---------------- right: the step that's picked ---------------- */
function StepPane({ job, t, v, onGo, onBack, onClose, onDone }: { job: Job; t: TrackView; v: StepView; onGo: (k: string) => void; onBack?: () => void; onClose?: () => void; onDone: () => void }) {
  const title = v.named ? v.label : TITLE[v.key] || v.label
  return (
    <section data-step-view={v.key} data-step-track={t.key} className="min-w-0 overflow-hidden rounded-[0.875rem] border border-line bg-white">
      {onBack && (
        <button onClick={onBack} data-back className="flex w-full items-center gap-1 border-b border-line-2 px-3 py-2 text-left text-[0.84375rem] font-semibold text-ink-2 hover:bg-wash">
          <ChevronLeft className="h-4 w-4" />Getting ready
        </button>
      )}
      <header className="flex min-w-0 items-start gap-3 px-5 pb-1 pt-4 max-sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-muted">{t.label}</div>
          <h3 className="mt-0.5 text-[1.125rem] font-semibold leading-snug text-ink">{title}</h3>
        </div>
        {onClose && <button onClick={onClose} aria-label="Close the step" data-close-step className="-mr-1.5 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-wash hover:text-ink"><X className="h-4 w-4" /></button>}
      </header>
      <div className="px-5 pb-5 pt-3 max-sm:px-4">
        <StepInline job={job} v={v} onGo={onGo} onClose={onDone} />
      </div>
    </section>
  )
}

/* ---------------- right, once the crew is in: what's next ---------------- */
function Now({ job, phase, onStep, setView }: { job: Job; phase: Phase; onStep: (k: string) => void; setView: (v: BoardView) => void }) {
  const s = useStore()
  const punch = s.punch.some((p) => p.jobId === job.id && p.status !== 'verified')
  return (
    <>
      <NextUp job={job} onStep={onStep} />
      {phase === 'crew' && <CrewCard job={job} />}
      {phase === 'install' && <Installing job={job} setView={setView} />}
      {(phase === 'punch' || (phase === 'install' && punch)) && <TouchupsCard job={job} />}
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

/* ---------------- open issues: anything that comes up, each one someone's ---------------- */
/** "Today", "This week", "Before Fri" read in a sentence: today, this week, before Fri */
const dayWord = (d: string) => d.replace(/^(Today|Tomorrow|This|Next|Every|By|Before)\b/, (w) => w.toLowerCase())
export function OpenIssues({ job, className }: { job: Job; className?: string }) {
  const s = useStore()
  const me = meOf(s.role)
  const list = issuesOf(s, job)
  const [all, setAll] = React.useState(false)
  const shown = all ? list : list.slice(0, 4)
  const canAdd = !['client', 'accounting', 'crew'].includes(s.role)
  const bad = list.some((t) => t.tone === 'bad')
  const addMenu = canAdd && (
    <Menu align="end" width={280} trigger={<button aria-label="Add an issue" className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50"><Plus className="h-3.5 w-3.5" />Add</button>}>
      <MenuLabel>An issue on {job.name}</MenuLabel>
      <MenuItem icon={<TriangleAlert className="h-4 w-4" />} hint="Tile wrong, broken or short · site not ready" onSelect={() => s.open({ t: 'problem', jobId: job.id })}>A problem</MenuItem>
      <MenuItem icon={<Truck className="h-4 w-4" />} hint="Material or a tool, brought to the job" onSelect={() => s.open({ t: 'need', jobId: job.id })}>Need something on site</MenuItem>
      {allowedFor(s.role, 'task') && <MenuItem icon={<ListTodo className="h-4 w-4" />} hint="A question to answer, something to chase" onSelect={() => s.open({ t: 'newtask', jobId: job.id })}>Something for someone to do</MenuItem>}
    </Menu>
  )
  /* nothing open: one quiet line — not a box saying so */
  if (!list.length) return (
    <section data-issues data-none className={cn('flex min-w-0 items-center gap-2 rounded-[0.875rem] border border-line bg-white px-4 py-2.5 max-sm:px-3', className)}>
      <h4 className="shrink-0 text-[0.9375rem] font-semibold text-ink">Open issues</h4>
      <span className="min-w-0 truncate text-[0.8125rem] text-muted">none</span>
      {addMenu}
    </section>
  )
  return (
    <section data-issues className={cn('overflow-hidden rounded-[0.875rem] border bg-white', bad ? 'border-bad-200' : 'border-line', className)}>
      <header className="flex min-w-0 items-center gap-2 px-4 pb-1.5 pt-3 max-sm:px-3">
        <h4 className={cn('shrink-0 text-[0.9375rem] font-semibold', bad ? 'text-bad-700' : 'text-ink')}>Open issues</h4>
        <span className="shrink-0 text-[0.8125rem] font-medium tnum text-faint">{list.length}</span>
        {addMenu}
      </header>
      <div className="px-1.5 pb-1.5">
        {shown.map((t) => {
          const waiting = t.state === 'waiting'
          const due = waiting ? (t.followUp ? `back ${dayWord(t.followUp)}` : '') : t.due ? (/^(today|tomorrow|this |next |every |by |before )/i.test(t.due) ? dayWord(t.due) : `due ${t.due}`) : ''
          const words = waiting ? `Waiting on ${t.waitingOn || 'them'}${due ? ` · ${due}` : ''}` : `${issueKind(t)}${due ? ` · ${due}` : ''}`
          return (
            <button key={t.id} data-issue={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full min-w-0 items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-[#f6f3ee]">
              {isRequest(t) ? <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-[#fff1e3] text-[#c2410c]"><Truck className="h-3 w-3" /></span> : <StepIcon state={t.tone === 'bad' ? 'bad' : waiting ? 'wait' : 'now'} size={22} />}
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[0.875rem] font-semibold text-ink">{t.title}</span>
                <span className={cn('mt-0.5 block truncate text-[0.75rem]', t.tone === 'bad' ? 'font-semibold text-bad-600' : waiting ? 'text-warn-700' : 'text-muted')}>{words}{t.where ? <span className="font-normal text-muted"> · {t.where}</span> : null}</span>
              </span>
              <span className="flex w-[8.25rem] shrink-0 items-center gap-2 max-sm:w-auto">
                <Avatar who={t.owner} size={24} />
                <span className={cn('min-w-0 truncate text-[0.8125rem] max-sm:sr-only', t.owner === me ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>{t.owner === me ? 'You' : firstName(t.owner)}</span>
              </span>
            </button>
          )
        })}
      </div>
      {list.length > shown.length && <button onClick={() => setAll(true)} className="flex w-full items-center justify-center gap-1 border-t border-line-2 px-4 py-2 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50/40">{list.length - shown.length} more<ChevronDown className="h-3.5 w-3.5" /></button>}
    </section>
  )
}

/* ---------------- tile that came up short — reordered, coming, back to work ---------------- */
function MoreTile({ job }: { job: Job }) {
  const s = useStore()
  const list = s.shortages.filter((x) => x.jobId === job.id && x.step !== 'received')
  if (!list.length) return null
  return (
    <section data-more-tile className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-center gap-2 px-4 pb-1.5 pt-3 max-sm:px-3">
        <h4 className="text-[0.9375rem] font-semibold text-ink">More tile</h4>
        <span className="text-[0.8125rem] font-medium tnum text-faint">{list.length}</span>
      </header>
      <div className="px-1.5 pb-1.5">
        {list.map((x) => (
          <button key={x.id} onClick={() => s.open({ t: 'short', id: x.id })} className="flex w-full min-w-0 items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-[#f6f3ee]">
            <span className={cn('inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full', x.stops ? 'bg-bad-50 text-bad-600' : 'bg-[#fbf3e3] text-warn-700')}><Package className="h-3 w-3" /></span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.875rem] font-semibold text-ink">{x.tag} · {x.qty} {x.unit} short</span>
              <span className="mt-0.5 block truncate text-[0.75rem] text-muted">{x.surfaces.map((y) => `${y.room} ${y.surface.toLowerCase()}`).join(', ')}{x.stops ? <b className="font-semibold text-bad-600"> · the crew is stopped</b> : null}</span>
            </span>
            <span className="max-w-[40%] shrink-0 truncate text-right text-[0.78125rem] font-semibold text-warn-700">{x.step === 'reordered' ? (x.eta ? `Coming ${x.eta.replace(/^\w+,\s*/, '')}` : `Reordered${x.orderedFrom ? ` · ${x.orderedFrom}` : ''}`) : <span className="text-bad-600">Not reordered yet</span>}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function TouchupsCard({ job }: { job: Job }) {
  const s = useStore()
  const canAdd = !['accounting', 'client', 'crew'].includes(s.role)
  return (
    <section data-touchups className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-center gap-2 border-b border-line-2 px-5 py-3">
        <h3 className="text-[1rem] font-semibold text-ink">Touch-ups</h3>
        {canAdd && <button onClick={() => s.open({ t: 'punchnew', jobId: job.id })} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50"><Plus className="h-3.5 w-3.5" />Add</button>}
      </header>
      <div className="px-5 pb-3 pt-2"><TouchupsList job={job} /></div>
    </section>
  )
}
