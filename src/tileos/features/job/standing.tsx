/* Where the project stands — the line on top, and what's going on now on the left.
 *   THE LINE (in the header), like the estimate's path: Approved → Getting ready → Crew scheduled → Installing →
 *     Touch-ups → Closed. "Crew scheduled" is locked until getting ready is done. Billing runs alongside it, on its own
 *     strip, and never stops anything.
 *   THE LEFT, while getting ready: five tracks at the same time — Scope, Tile, Site, Installer, Materials. Each is a
 *     short path of steps with who has it now, when, and one button; tap a step and it opens right there. Nothing is
 *     checked off: a step moves when the real thing happens. Under them, the open issues — each one someone's.
 *   Once the crew is in, the tracks fold to one ✓ line, and the left is the issues, the changes, more tile and the
 *     touch-ups. */
import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus, Truck, HardHat, CalendarDays, Check, Receipt, Minus, TriangleAlert, ListTodo, Hourglass, Package, FileText, Lock } from 'lucide-react'
import { useStore, meOf, isRequest, type Store } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { Circles } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { labelFromIso, isoFromLabel, TODAY } from '@/tileos/lib/today'
import { stepsFor, type StepState, type StepView } from '../steps'
import { StepIcon, TrackDot, DOT_LABEL } from '../steps-ui'
import { TrackSteps, TITLE } from '../stepwin'
import { NextUp } from './next'
import { installerOf } from '../upcoming'
import { TouchupsList } from '../touchups'
import { allowedFor } from '../newpicker'
import { firstName } from './kit'
import { tracksFor, lineOf, phaseOf, stepShort, softWrap, moneyLine, issuesOf, issueKind, bookingOf, type TrackView, type TrackKey } from '../tracks'

/** the track (and the step on it) that's open on the left */
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

/** the money, alongside the line the whole time — what's paid of the contract, and the deposit. Never in the way. */
export function BillingStrip({ job, onOpen, className }: { job: Job; onOpen: () => void; className?: string }) {
  const s = useStore()
  if (['site', 'crew', 'client'].includes(s.role)) return null
  const m = moneyLine(s, job)
  if (!m.total && !m.dep) return null
  return (
    <button onClick={onOpen} data-billing className={cn('flex w-full min-w-0 items-center gap-3 rounded-[0.625rem] border border-[#e1ebe2] bg-[#f5f9f5] px-3 py-1.5 text-left text-[0.8125rem] transition hover:border-[#cadccd] hover:bg-[#f0f6f0] max-sm:gap-2 max-sm:px-2.5', className)}>
      <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#2c4a3e]"><Receipt className="h-3.5 w-3.5" />Billing</span>
      <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[#dfe8df] max-sm:hidden" aria-hidden><span className="block h-full rounded-full bg-[#2c8a5b]" style={{ width: `${m.paidPct}%` }} /></span>
      <span className="min-w-0 flex-1 truncate text-ink-2">
        <b className="font-semibold tnum text-ink">{fmtMoney(m.paid)}</b> paid of <span className="tnum">{fmtMoney(m.total)}</span>
        {m.billed > m.paid && <> · <span className="tnum">{fmtMoney(m.billed - m.paid)}</span> billed</>}
        {m.toBill > 0 && <span className="font-semibold text-brand-700"> · {fmtMoney(m.toBill)} ready to bill</span>}
        {m.dep && m.dep.tone !== 'ok' && <span className="font-medium text-warn-700"> · {m.dep.text}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
    </button>
  )
}

/* ================= the left: what's going on now ================= */
export function ProjectNow({ job, open, setOpen, onStep }: { job: Job; open: OpenTrack; setOpen: (o: OpenTrack) => void; /** open a step on its track (what's next on top) */ onStep?: (k: string) => void }) {
  const s = useStore()
  const tracks = tracksFor(s, job, stepsFor(s, job))
  const phase = phaseOf(s, job, tracks)
  const [unfold, setUnfold] = React.useState(false)
  /* a step that's open has the whole side to itself — the track's steps on top, Back to getting ready */
  const openTrack = open ? tracks.find((t) => t.key === open.track) : undefined
  /* to a step on any track — a step that isn't open yet points at the one it waits for, wherever that is */
  const jump = (k: string) => { const tk = tracks.find((t) => t.steps.some((x) => x.key === k))?.key; if (tk) setOpen({ track: tk, step: k }) }
  if (open && openTrack) return <div data-phase={phase}><StepPage job={job} t={openTrack} k={open.step} onPick={(k) => setOpen({ track: open.track, step: k })} onJump={jump} onBack={() => setOpen(null)} /></div>
  const showTracks = phase === 'ready' || unfold
  return (
    <div className="flex flex-col gap-3" data-phase={phase}>
      <NextUp job={job} onStep={onStep || jump} />
      {showTracks
        ? <Tracks job={job} tracks={tracks} setOpen={setOpen} onFold={phase !== 'ready' ? () => setUnfold(false) : undefined} />
        : <ReadyDone job={job} tracks={tracks} onOpen={() => setUnfold(true)} />}
      {phase === 'crew' && <CrewCard job={job} />}
      {phase === 'punch' && <TouchupsCard job={job} />}
      <OpenIssues job={job} />
      <MoreTile job={job} />
      <Changes job={job} />
      {phase === 'install' && s.punch.some((p) => p.jobId === job.id && p.status !== 'verified') && <TouchupsCard job={job} />}
    </div>
  )
}

/* ---------------- the five tracks ----------------
 * One card: a row for each track, and every step in a straight column under the steps of the other tracks — the
 * same mark in the same place on every row. Under each step: whose it is, or the day it was done. Tap the track's
 * name (or any step) and it opens. */
function Tracks({ job, tracks, setOpen, onFold }: { job: Job; tracks: TrackView[]; setOpen: (o: OpenTrack) => void; onFold?: () => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const n = tracks.length
  const done = tracks.filter((t) => t.state === 'done').length
  const cols = Math.max(1, ...tracks.map((t) => t.steps.filter((v) => v.state !== 'na').length))
  return (
    <section data-tracks className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex min-w-0 items-baseline gap-2.5 border-b border-line-2 px-4 py-2.5 max-sm:px-3">
        <h3 className="shrink-0 text-[1.0625rem] font-semibold text-ink">Getting ready</h3>
        <span className={cn('min-w-0 truncate text-[0.8125rem]', done === n ? 'font-medium text-[#2c8a5b]' : 'text-muted')}>{done === n ? `All ${n} done` : `${done} of ${n} done`}</span>
        {onFold && <button onClick={onFold} className="ml-auto inline-flex shrink-0 items-center gap-1 self-center rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-ink-2 hover:bg-wash"><ChevronUp className="h-3.5 w-3.5" />Fold</button>}
      </header>
      <div className="divide-y divide-line-2" style={{ '--cols': cols } as React.CSSProperties}>
        {tracks.map((t) => <TrackRow key={t.key} job={job} t={t} me={me} onOpen={(k) => setOpen({ track: t.key, step: k })} />)}
      </div>
    </section>
  )
}

/** one track: its name on the left, its steps in the columns — the first step of every track under the first of the
 *  others, the second under the second… */
function TrackRow({ job, t, me, onOpen }: { job: Job; t: TrackView; me: PersonKey; onOpen: (k: string) => void }) {
  const s = useStore()
  const first = t.lead?.key || t.steps[t.steps.length - 1]?.key
  const list = t.steps.filter((v) => v.state !== 'na')
  const doneN = list.filter((v) => v.state === 'done').length
  const status = t.state === 'done' ? { text: t.doneOn ? `Done ${t.doneOn}` : 'Done', cls: 'font-semibold text-[#2c8a5b]' }
    : t.state === 'bad' ? { text: 'Problem', cls: 'font-semibold text-bad-600' }
      : { text: `${doneN} of ${list.length}`, cls: 'text-muted' }
  return (
    <div data-track={t.key} data-state={t.state} className="grid grid-cols-[7rem_repeat(var(--cols),minmax(0,1fr))] items-start gap-y-2 px-4 py-3 max-sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))] max-sm:px-3 max-sm:py-2.5">
      <button onClick={() => first && onOpen(first)} className="group flex min-w-0 flex-col items-start pr-3 text-left max-sm:col-span-full max-sm:flex-row max-sm:items-baseline max-sm:gap-2" data-track-head>
        <span className="flex items-center gap-1 text-[0.9375rem] font-bold text-ink group-hover:text-brand-700">{t.label}<ChevronRight className="h-3.5 w-3.5 text-faint max-sm:hidden" /></span>
        <span className={cn('text-[0.75rem]', status.cls)}>{t.state === 'done' && <Check className="mr-0.5 inline h-3 w-3 align-[-0.125rem]" strokeWidth={3} />}{status.text}</span>
      </button>
      {list.map((v, i) => {
        const lead = t.lead?.key === v.key
        const mine = v.owner === me && (v.state === 'now' || v.state === 'bad')
        const w = stepWho(s, job, v, me)
        const last = i === list.length - 1
        return (
          <button key={v.key} data-step={v.key} data-state={v.state} data-mine={mine || undefined} onClick={() => onOpen(v.key)} title={`${TITLE[v.key] || v.label}${v.note ? ` — ${v.note}` : ''}`} className="group/step flex min-w-0 flex-col items-stretch rounded-lg py-0.5 text-left transition">
            <span className="flex items-center" aria-hidden>
              <TrackDot state={v.state} mine={mine} lead={lead} />
              {!last && <span className={cn('mx-1.5 h-[0.125rem] min-w-0 flex-1 rounded-full', v.state === 'done' ? 'bg-[#2c8a5b]' : 'bg-[#e5e0d7]')} />}
            </span>
            <span className={cn('mt-1.5 line-clamp-2 break-words pr-2 text-[0.8125rem] leading-[1.15rem] group-hover/step:underline group-hover/step:decoration-[#cfc8bc] group-hover/step:underline-offset-2 max-sm:line-clamp-3 max-sm:pr-1 max-sm:text-[0.75rem] max-sm:leading-[0.95rem]', DOT_LABEL[v.state], mine && 'text-brand-700', lead && 'font-bold')}><span className="max-sm:hidden">{stepShort(s, job, v)}</span><span className="sm:hidden">{softWrap(stepShort(s, job, v))}</span></span>
            {w && <span data-who className={cn('mt-0.5 truncate pr-2 text-[0.71875rem] leading-tight max-sm:text-[0.6875rem]', WHO_TONE[w.tone])}>{w.text}</span>}
          </button>
        )
      })}
    </div>
  )
}


/** under a step on its track: whose it is and when — or the day it was done */
export function stepWho(s: Store, job: Job, v: StepView, me: PersonKey): { text: string; tone: 'mine' | 'muted' | 'ink' | 'bad' | 'warn' } | null {
  const who = (p: PersonKey) => (p === me ? 'You' : PEOPLE[p]?.short || '')
  const day = (iso?: string) => (!iso ? '' : iso === TODAY ? 'today' : labelFromIso(iso) === 'Tomorrow' ? 'tomorrow' : labelFromIso(iso))
  switch (v.state) {
    case 'done': return { text: v.doneOn || 'Done', tone: 'muted' }
    case 'na': return null
    case 'later': return { text: who(v.owner), tone: 'muted' }
    case 'bad': return { text: who(v.owner), tone: 'bad' }
    case 'wait': {
      const when = ['delivered', 'matin'].includes(v.key) ? (v.due ? `coming ${day(v.due)}` : 'on the way') : ['design', 'walk'].includes(v.key) ? (v.due ? `set ${day(v.due)}` : 'set') : v.due ? `waiting · back ${day(v.due)}` : 'waiting'
      return { text: `${who(v.owner)} · ${when}`, tone: 'warn' }
    }
    case 'now': {
      const late = !!v.due && v.due < TODAY
      return { text: `${who(v.owner)}${v.due ? ` · ${late ? `was due ${labelFromIso(v.due)}` : day(v.due)}` : ''}`, tone: late ? 'bad' : v.owner === me ? 'mine' : 'ink' }
    }
  }
  return null
}
const WHO_TONE: Record<string, string> = { mine: 'font-semibold text-brand-700', muted: 'text-muted', ink: 'font-medium text-ink-2', bad: 'font-semibold text-bad-600', warn: 'font-medium text-warn-700' }

/** a track open on its own, in place of the tracks: its steps top to bottom like a checklist — each one a line (done
 *  when, whose turn, what it waits for) — and the one that's open shows what's happening and its work right under it.
 *  Back to getting ready on top. */
function StepPage({ job, t, k, onPick, onJump, onBack }: { job: Job; t: TrackView; k: string; onPick: (k: string) => void; onJump: (k: string) => void; onBack: () => void }) {
  const list = t.steps.filter((x) => x.state !== 'na' || x.key === k)
  const v = list.find((x) => x.key === k) || list[0]
  const top = React.useRef<HTMLElement>(null)
  React.useEffect(() => { top.current?.scrollIntoView?.({ block: 'start' }) }, [t.key])
  if (!v) return null
  const done = list.filter((x) => x.state === 'done' || x.state === 'na').length
  return (
    <section ref={top} data-step-view={v.key} data-step-track={t.key} className="overflow-hidden rounded-[0.875rem] border border-line bg-white shadow-card">
      <header className="flex min-w-0 items-center gap-2 border-b border-line-2 px-2.5 py-2">
        <button onClick={onBack} data-back className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[0.8125rem] font-semibold text-ink-2 hover:bg-wash"><ChevronLeft className="h-4 w-4" />Getting ready</button>
        <span className="ml-auto truncate text-[0.8125rem] text-muted"><b className="font-semibold text-ink">{t.label}</b> · {done} of {list.length} done</span>
      </header>
      <TrackSteps job={job} list={list} at={v.key} onPick={onPick} onGo={onJump} onClose={onBack} />
    </section>
  )
}

/** getting ready, folded to one line — a ✓ when every track is done; what's still open (tile that came short,
 *  materials on the way) says so. Tap it to see the tracks again. */
function ReadyDone({ job, tracks, onOpen }: { job: Job; tracks: TrackView[]; onOpen: () => void }) {
  const s = useStore()
  const open = tracks.filter((t) => t.state !== 'done')
  const last = tracks.map((t) => t.doneOn).filter(Boolean).sort((a, b) => (isoFromLabel(a) || '').localeCompare(isoFromLabel(b) || '')).pop()
  const bad = open.some((t) => t.state === 'bad')
  return (
    <button data-ready-folded data-open={open.length || undefined} onClick={onOpen} className={cn('flex w-full min-w-0 items-center gap-3 rounded-[0.875rem] border bg-white px-3.5 py-2.5 text-left transition hover:bg-[#fcfbf9]', bad ? 'border-bad-200' : 'border-line')}>
      {open.length
        ? <StepIcon state={bad ? 'bad' : 'wait'} size={28} />
        : <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2c8a5b] text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[0.9375rem] font-semibold text-ink">{open.length ? `Getting ready — ${tracks.length - open.length} of ${tracks.length} done` : `Getting ready — all ${tracks.length} done`}</span>
        <span className={cn('block truncate text-[0.75rem]', bad ? 'font-medium text-bad-600' : open.length ? 'text-warn-700' : 'text-muted')}>
          {open.length ? open.map((t) => `${t.label}: ${t.lead ? stepShort(s, job, t.lead).toLowerCase() : 'open'}`).join(' · ') : `${tracks.map((t) => t.label).join(' · ')}${last ? ` · the last one ${last}` : ''}`}
        </span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
    </button>
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
      <header className="flex items-center gap-2 border-b border-line-2 px-4 py-2.5">
        <h4 className="text-[0.9375rem] font-bold text-ink">Crew</h4>
        <span className={cn('text-[0.78125rem]', booked ? 'font-medium text-[#2c8a5b]' : 'font-semibold text-brand-700')}>{booked ? 'Scheduled' : 'Everything’s confirmed — pick the days'}</span>
      </header>
      <div className="flex flex-col gap-2 px-4 py-3 text-[0.84375rem]">
        <button onClick={() => (ipo ? s.open({ t: 'ipo', id: ipo.id }) : s.open({ t: 'installerwin', jobId: job.id }))} className="flex min-w-0 items-center gap-2.5 text-left">
          {crew ? <Avatar who={crew} size={30} /> : <span className="inline-flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full bg-wash-2 text-faint"><HardHat className="h-4 w-4" /></span>}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-semibold text-ink">{crew ? PEOPLE[crew]?.name : 'No installer yet'}</span>
            <span className="block truncate text-[0.75rem] text-muted">{ipo ? `${ipo.id} · ${ipo.status === 'Accepted' ? `took it${ipo.date ? ` ${ipo.date}` : ''}` : ipo.status.toLowerCase()}` : 'No PO yet'}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
        </button>
        <div className="flex items-center gap-2.5 text-ink-2">
          <span className="inline-flex w-[1.875rem] justify-center"><CalendarDays className="h-4 w-4 text-faint" /></span>
          {b ? <span><b className="font-semibold text-ink">{labelFromIso(b.start)} – {labelFromIso(b.end)}</b>{b.workers ? ` · ${b.workers} workers` : ''}{b.status === 'pending' ? <span className="text-warn-700"> · waiting for his OK</span> : null}</span> : <span className="text-muted">No days on the calendar yet</span>}
        </div>
        {money && dep && dep.tone === 'warn' && (
          <div className="flex items-center gap-2.5 text-warn-700">
            <span className="inline-flex w-[1.875rem] justify-center"><Receipt className="h-4 w-4" /></span>
            <span className="font-medium">{dep.text.replace(/^./, (c) => c.toUpperCase())} — a warning, not a stop</span>
          </div>
        )}
      </div>
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
    <section data-issues data-none className={cn('flex min-w-0 items-center gap-2 rounded-[0.875rem] border border-line bg-white px-4 py-2 max-sm:px-3', className)}>
      <h4 className="shrink-0 text-[0.875rem] font-semibold text-ink">Open issues</h4>
      <span className="min-w-0 truncate text-[0.8125rem] text-muted">none</span>
      {addMenu}
    </section>
  )
  return (
    <section data-issues className={cn('overflow-hidden rounded-[0.875rem] border bg-white', bad ? 'border-bad-200' : 'border-line', className)}>
      <header className={cn('flex min-w-0 items-center gap-2 border-b px-4 py-2.5', bad ? 'border-bad-100 bg-[#fdf6f5]' : 'border-line-2')}>
        <h4 className={cn('shrink-0 text-[0.9375rem] font-bold', bad ? 'text-bad-700' : 'text-ink')}>Open issues</h4>
        <span className="shrink-0 rounded-full bg-wash-2 px-1.5 text-[0.71875rem] font-bold tnum text-ink-2">{list.length}</span>
        <span className="min-w-0 truncate text-[0.75rem] text-muted max-sm:hidden">anything that comes up — each one is someone’s</span>
        {addMenu}
      </header>
      {(
          <div className="p-1.5">
            {shown.map((t) => {
              const waiting = t.state === 'waiting'
              const due = waiting ? (t.followUp ? `follow up ${dayWord(t.followUp)}` : '') : t.due ? (/^(today|tomorrow|this |next |every )/i.test(t.due) ? dayWord(t.due) : /^(by|before) /i.test(t.due) ? dayWord(t.due) : `by ${t.due}`) : ''
              return (
                <button key={t.id} data-issue={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-[#f6f3ee]">
                  {isRequest(t) ? <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-[#fff1e3] text-[#c2410c]"><Truck className="h-3 w-3" /></span> : <StepIcon state={t.tone === 'bad' ? 'bad' : waiting ? 'wait' : 'now'} size={22} />}
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[0.84375rem] font-semibold text-ink">{t.title}</span>
                    <span className="block truncate text-[0.75rem] text-muted"><b className={cn('font-semibold', t.tone === 'bad' ? 'text-bad-600' : 'text-ink-2')}>{issueKind(t)}</b>{t.where ? ` · ${t.where}` : t.by ? ` · from ${firstName(t.by)}` : ''}</span>
                  </span>
                  <span className="max-w-[40%] shrink-0 text-right leading-tight">
                    <span className={cn('block truncate text-[0.78125rem] font-semibold', waiting ? 'text-warn-700' : t.owner === me ? 'text-brand-700' : 'text-ink-2')}>{waiting ? `Waiting on ${t.waitingOn || 'them'}` : t.owner === me ? 'You' : firstName(t.owner)}</span>
                    {due && <span className="block truncate text-[0.71875rem] text-muted">{due}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      {list.length > shown.length && <button onClick={() => setAll(true)} className="flex w-full items-center justify-center gap-1 border-t border-line-2 px-4 py-2 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50/40">{list.length - shown.length} more<ChevronDown className="h-3.5 w-3.5" /></button>}
    </section>
  )
}

/* ---------------- once it's going: more tile, the changes, the touch-ups ---------------- */
function Box({ title, count, data, children, right }: { title: string; count?: number; data: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section {...{ [`data-${data}`]: '' }} className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-center gap-2 border-b border-line-2 px-4 py-2.5">
        <h4 className="text-[0.9375rem] font-bold text-ink">{title}</h4>
        {count != null && <span className="rounded-full bg-wash-2 px-1.5 text-[0.71875rem] font-bold tnum text-ink-2">{count}</span>}
        {right && <span className="ml-auto">{right}</span>}
      </header>
      <div className="p-1.5">{children}</div>
    </section>
  )
}
const ROW = 'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-[#f6f3ee]'

/** tile that came up short — reordered, coming, back to work */
function MoreTile({ job }: { job: Job }) {
  const s = useStore()
  const list = s.shortages.filter((x) => x.jobId === job.id && x.step !== 'received')
  if (!list.length) return null
  return (
    <Box title="More tile" count={list.length} data="more-tile">
      {list.map((x) => (
        <button key={x.id} onClick={() => s.open({ t: 'short', id: x.id })} className={ROW}>
          <span className={cn('inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full', x.stops ? 'bg-bad-50 text-bad-600' : 'bg-[#fbf3e3] text-warn-700')}><Package className="h-3 w-3" /></span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[0.84375rem] font-semibold text-ink">{x.tag} · {x.qty} {x.unit} short</span>
            <span className="block truncate text-[0.75rem] text-muted">{x.surfaces.map((y) => `${y.room} ${y.surface.toLowerCase()}`).join(', ')}{x.stops ? <b className="font-semibold text-bad-600"> · the crew is stopped</b> : null}</span>
          </span>
          <span className="max-w-[40%] shrink-0 truncate text-right text-[0.78125rem] font-semibold text-warn-700">{x.step === 'reordered' ? (x.eta ? `Coming ${x.eta.replace(/^\w+,\s*/, '')}` : `Reordered${x.orderedFrom ? ` · ${x.orderedFrom}` : ''}`) : <span className="text-bad-600">Not reordered yet</span>}</span>
        </button>
      ))}
    </Box>
  )
}

/** change orders — what changed from the contract, and where each one is */
function Changes({ job }: { job: Job }) {
  const s = useStore()
  /* the site manager sees what changed (it changes his work) — the prices are for whoever sees money */
  if (['crew', 'client'].includes(s.role)) return null
  const money = s.role !== 'site'
  const list = s.money.filter((m) => m.jobId === job.id && m.kind === 'change')
  if (!list.length) return null
  return (
    <Box title="Changes" count={list.length} data="changes">
      {list.map((m) => {
        const words = m.state === 'paid' ? { t: 'Paid', c: 'text-[#2c8a5b]' } : m.step < 0 ? { t: m.due || 'Waiting for the OK', c: 'text-warn-700' } : m.step >= 1 ? { t: 'Billed', c: 'text-ink-2' } : { t: m.due || 'Approved', c: 'text-[#2c8a5b]' }
        return (
          <button key={m.id} onClick={() => (money ? s.open({ t: 'money', id: m.id }) : s.open({ t: 'job', id: job.id, tab: 'scope' }))} className={ROW}>
            <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-wash-2 text-ink-2"><FileText className="h-3 w-3" /></span>
            <span className="min-w-0 flex-1 truncate text-[0.84375rem] font-semibold text-ink">{m.title}</span>
            <span className="shrink-0 text-right leading-tight">
              {money && <span className="block text-[0.8125rem] font-semibold tnum text-ink">{m.amount ? fmtMoney(m.amount) : '—'}</span>}
              <span className={cn('block max-w-[11rem] truncate text-[0.71875rem] font-medium', words.c)}>{words.t}</span>
            </span>
          </button>
        )
      })}
    </Box>
  )
}

function TouchupsCard({ job }: { job: Job }) {
  const s = useStore()
  const canAdd = !['accounting', 'client', 'crew'].includes(s.role)
  return (
    <section data-touchups className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-center gap-2 border-b border-line-2 px-4 py-2.5">
        <h4 className="text-[0.9375rem] font-bold text-ink">Touch-ups</h4>
        {canAdd && <button onClick={() => s.open({ t: 'punchnew', jobId: job.id })} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50"><Plus className="h-3.5 w-3.5" />Add</button>}
      </header>
      <div className="px-4 pb-3 pt-2"><TouchupsList job={job} /></div>
    </section>
  )
}
