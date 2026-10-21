/* The project — one window, one shape, in every part of the job:
 *   on top, the job's four parts as one bar that fills as it goes (Getting ready · Installing · Touch-ups · Billed and
 *   paid) — the project opens on the part it's in;
 *   the main side: a big ring with how far that part is, and its pieces as tiles, each with a ring of its own —
 *   getting ready: underlayment, the installer, the deliveries…; installing: the rooms;
 *   the right side: the project itself — the tile and the grout with the store's paperwork, the messages, the files.
 * Tap anything and it opens right there, with "Back to the project" on top — never a window on a window. */
import * as React from 'react'
import { Check, Plus, Upload, Paperclip, MessageCircle, Package, History, Building2, CalendarDays, Receipt, ChevronRight, Grid2x2, FileText, Truck, HardHat, Clock3 } from 'lucide-react'
import { useStore, meOf, isRequest } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { roomPct, tilesOf, GROUTS, filesFor } from '@/tileos/data/jobs'
import { TODAY, labelFromIso, daysBetween } from '@/tileos/lib/today'
import { isGettingReady, stepsFor, stepCounts, lanesFor, type StepView, type LaneView } from '../steps'
import { StepIcon } from '../steps-ui'
import { StepInline, StepTabs, todoOf } from '../stepwin'
import { pictureOf } from '../progressbill'
import { RoomsTab, SurfaceDetail } from './rooms'
import { MoneyTab } from './money-tab'
import { TouchupsList } from '../touchups'
import { firstName } from './kit'
import { useSaveStatus } from '@/tileos/lib/save'
import { keepFiles } from '@/tileos/lib/files'
import { surfacePct, SURF_LABEL } from '@/tileos/data/jobs'
import { Thread } from '../messages'
import { DocPanel, PanelBar } from '../docview'
import { FilesTab, HistoryTab } from './files'
import { ScopeTab } from './scope-tab'
import { POsTab } from './pos-tab'

export type Part = 'ready' | 'install' | 'punch' | 'money'
const PRICING = ['request', 'estimating', 'proposal', 'followup']
const IN_FIELD = ['installation', 'punch', 'closeout', 'complete']
const isDone = (v: StepView) => v.state === 'done' || v.state === 'na'
/** the store's paperwork and the tile and grout belong to the tile — they show with it, not in the list of steps */
const TILE_LANES = ['paper', 'grout']

/** something opened in the window: a step, a room, the conversation, a file… */
export type BoardView = null | { t: 'step'; k: string } | { t: 'room'; name: string } | { t: 'chat' } | { t: 'file'; id: string } | { t: 'files' } | { t: 'scope' } | { t: 'log' } | { t: 'orders' }

/** where the project is — the part it opens on */
export function partOf(job: Job): Part {
  if (job.stage === 'installation') return 'install'
  if (job.stage === 'punch') return 'punch'
  if (['closeout', 'complete'].includes(job.stage)) return 'money'
  return 'ready'
}

type PartState = 'done' | 'now' | 'later' | 'bad'
export type PartView = { key: Part; label: string; short: string; pct: number; state: PartState; sub: string; subShort: string }

/** the four parts and how far each is — for the bar in the header */
export function useParts(job: Job): PartView[] {
  const s = useStore()
  const money = s.role !== 'site' && s.role !== 'crew'
  const pricing = PRICING.includes(job.stage)
  const ready = isGettingReady(job)
  const inField = IN_FIELD.includes(job.stage)
  const past = !ready && !pricing
  const steps = pricing ? [] : stepsFor(s, job).filter((v) => v.state !== 'na')
  const lanes = lanesFor(steps)
  const c = stepCounts(steps)
  const lDone = lanes.filter((l) => l.state === 'done').length
  const allDone = c.total > 0 && c.done === c.total
  const b = s.bookings.find((x) => x.jobId === job.id)
  const crew = (job.crew || b?.crew) as PersonKey | undefined
  const startIso = b?.start || s.prep[job.id]?.targetISO
  const start = job.dates?.start || (startIso ? labelFromIso(startIso) : undefined)
  const lateStart = !inField && !pricing && !!startIso && startIso < TODAY
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const punchOpen = punch.filter((p) => p.status !== 'verified')
  const pic = money ? pictureOf(s, job.id) : null
  const pct = job.pct ?? 0
  return [
    {
      key: 'ready', label: 'Getting ready', short: 'Ready',
      pct: pricing ? 0 : past ? 100 : c.total ? Math.round((c.done / c.total) * 100) : 0,
      state: past ? 'done' : pricing ? 'later' : c.bad ? 'bad' : 'now',
      sub: past ? 'Done' : pricing ? 'Once the estimate is won' : c.bad ? `${c.done} of ${c.total} done · ${c.bad} ${c.bad === 1 ? 'problem' : 'problems'}` : allDone ? `All ${c.total} done — ready to start` : `${c.done} of ${c.total} done`,
      subShort: past ? 'Done' : pricing ? 'Not yet' : c.bad ? `${c.bad} ${c.bad === 1 ? 'problem' : 'problems'}` : `${c.done} of ${c.total}`,
    },
    {
      key: 'install', label: 'Installing', short: 'Installing',
      pct: inField ? (job.stage === 'installation' ? pct : 100) : 0,
      state: inField ? (job.stage === 'installation' ? 'now' : 'done') : lateStart ? 'bad' : 'later',
      sub: inField ? (job.stage === 'installation' ? `${pct}% installed${crew ? ` · ${PEOPLE[crew]?.short}` : ''}` : `Done${job.dates?.finish ? ` ${job.dates.finish}` : ''}`) : start ? (lateStart ? `Late — was to start ${start}` : `Starts ${start}${crew ? ` · ${PEOPLE[crew]?.short}` : ''}`) : 'No start date yet',
      subShort: inField ? (job.stage === 'installation' ? `${pct}%` : 'Done') : start ? (lateStart ? 'Late' : start) : 'No date',
    },
    {
      key: 'punch', label: 'Touch-ups', short: 'Touch-ups',
      pct: punch.length ? Math.round(((punch.length - punchOpen.length) / punch.length) * 100) : 0,
      state: punch.length && !punchOpen.length ? 'done' : punchOpen.length ? 'now' : ['closeout', 'complete'].includes(job.stage) ? 'done' : 'later',
      sub: punchOpen.length ? `${punchOpen.length} open` : punch.length ? 'All checked' : ['closeout', 'complete'].includes(job.stage) ? 'None' : inField ? 'None yet' : 'After the installing',
      subShort: punchOpen.length ? `${punchOpen.length} open` : punch.length ? 'Checked' : inField ? 'None yet' : 'Later',
    },
    ...(money && pic ? [{
      key: 'money' as Part, label: 'Billed and paid', short: 'Billed',
      pct: pic.paidPct,
      state: (job.stage === 'complete' ? 'done' : pic.billed ? 'now' : 'later') as PartState,
      sub: pic.billed ? `${fmtMoney(pic.paid)} of ${fmtMoney(pic.contract + pic.changes)} paid` : 'Nothing billed yet',
      subShort: pic.billed ? `${pic.paidPct}% paid` : 'Not yet',
    }] : []),
  ]
}

/* ---------------- the bar in the header: the four parts as one line that fills ---------------- */
const BAR: Record<PartState, string> = { done: 'bg-[#2c8a5b]', now: 'bg-brand-600', later: 'bg-transparent', bad: 'bg-brand-600' }
export function Track({ parts, at, onPick, className }: { parts: PartView[]; at: Part; onPick: (p: Part) => void; className?: string }) {
  const cur = parts.find((p) => p.key === at)
  return (
    <div className={className}>
      {/* phones: the part you're looking at, in words */}
      {cur && <div className="mb-1.5 flex items-baseline justify-between gap-2 sm:hidden"><span className="truncate text-[0.8125rem] font-semibold text-ink">{cur.label}</span><span className={cn('shrink-0 text-[0.75rem]', cur.state === 'bad' ? 'font-semibold text-bad-600' : 'text-muted')}>{cur.subShort}</span></div>}
      <ol aria-label="The project, part by part" className="grid gap-x-1.5" style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))` }}>
        {parts.map((p) => {
          const on = p.key === at
          const fill = p.state === 'done' ? 100 : p.state === 'later' ? 0 : Math.max(p.pct, 4)
          return (
            <li key={p.key} className="min-w-0">
              <button data-part={p.key} onClick={() => onPick(p.key)} aria-current={on ? 'step' : undefined} aria-label={`${p.label} — ${p.sub}`} className={cn('block w-full rounded-lg px-2 pb-1.5 pt-2 text-left transition max-sm:px-0.5 max-sm:py-1', on ? 'bg-[#f3f0ea] max-sm:bg-transparent' : 'hover:bg-[#f6f3ee]/80')}>
                <span className="relative block h-1.5 overflow-hidden rounded-full bg-[#e9e4db]">
                  <span className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-700', BAR[p.state])} style={{ width: `${fill}%` }} />
                </span>
                <span className="mt-1.5 flex min-w-0 items-center gap-1 max-sm:hidden">
                  {p.state === 'done' && <Check className="h-3.5 w-3.5 shrink-0 text-[#2c8a5b]" strokeWidth={3} />}
                  <span className={cn('truncate text-[0.8125rem] font-semibold leading-tight', on ? 'text-ink' : p.state === 'later' ? 'text-muted' : 'text-ink-2')}>{p.label}</span>
                </span>
                <span className={cn('block truncate text-[0.75rem] leading-tight max-sm:hidden', p.state === 'bad' ? 'font-semibold text-bad-600' : p.state === 'now' ? 'text-brand-700' : p.state === 'done' ? 'text-muted' : 'text-faint')}>{p.sub}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ---------------- rings ---------------- */
const RING: Record<string, { arc: string; track: string; text: string }> = {
  done: { arc: '#2c8a5b', track: '#dcefe3', text: 'text-[#2c8a5b]' },
  now: { arc: '#2650cf', track: '#e3e9fb', text: 'text-ink' },
  bad: { arc: '#d7342a', track: '#f6dcd9', text: 'text-bad-600' },
  wait: { arc: '#d98c0b', track: '#f8ead0', text: 'text-warn-700' },
  later: { arc: '#c9c3b8', track: '#ece8e1', text: 'text-faint' },
}
/** a ring that fills: the words in the middle say how far */
export function ProgressRing({ pct, state, size = 44, stroke, children }: { pct: number; state: keyof typeof RING; size?: number; stroke?: number; children?: React.ReactNode }) {
  const w = stroke ?? (size >= 70 ? 7 : size >= 40 ? 4.5 : 3.5)
  const r = (size - w) / 2
  const c = 2 * Math.PI * r
  const t = RING[state] || RING.later
  const fill = state === 'done' ? 100 : Math.max(0, Math.min(100, pct))
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.track} strokeWidth={w} />
        {fill > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.arc} strokeWidth={w} strokeLinecap="round" strokeDasharray={`${(c * fill) / 100} ${c}`} className="transition-[stroke-dasharray] duration-700" />}
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center font-bold tnum leading-none', t.text, size >= 70 ? 'text-[1.125rem]' : size >= 40 ? 'text-[0.71875rem]' : 'text-[0.625rem]')}>
        {children ?? (state === 'done' ? <Check className={size >= 70 ? 'h-7 w-7' : size >= 40 ? 'h-4 w-4' : 'h-3 w-3'} strokeWidth={3} /> : `${Math.round(fill)}%`)}
      </span>
    </span>
  )
}
/** a lane's ring: done ✓, a problem !, waiting a clock, else how many of its steps are done */
function LaneRing({ lane, size = 44 }: { lane: LaneView; size?: number }) {
  const st = lane.state === 'na' ? 'done' : (lane.state as string)
  const pct = lane.total ? (lane.done / lane.total) * 100 : 0
  return (
    <ProgressRing pct={st === 'now' ? Math.max(pct, 8) : pct} state={st as keyof typeof RING} size={size}>
      {st === 'done' ? undefined : st === 'bad' ? '!' : st === 'wait' ? <Clock3 className={size >= 40 ? 'h-4 w-4' : 'h-3 w-3'} strokeWidth={2.4} /> : `${lane.done}/${lane.total}`}
    </ProgressRing>
  )
}

/* ---------------- words for a step ---------------- */
const TONE: Record<string, string> = { ok: 'text-[#2c8a5b]', bad: 'text-bad-600 font-medium', warn: 'text-warn-700', me: 'text-brand-700 font-semibold', quiet: 'text-faint', plain: 'text-ink-2' }
/** where a lane stands, in one line: done, a problem and what, waiting on what, or whose turn */
function laneStatus(l: LaneView, me: PersonKey): { text: string; tone: string } {
  const v = l.at
  if (l.state === 'done') return { text: v.doneOn ? `Done ${v.doneOn}` : 'Done', tone: 'ok' }
  if (l.state === 'bad') return { text: v.note ? `Problem — ${v.note}` : 'Problem', tone: 'bad' }
  if (l.state === 'wait') {
    const n = v.note || ''
    return { text: /^waiting/i.test(n) ? n : n ? `Waiting — ${n}` : `Waiting${v.due ? ` · ${labelFromIso(v.due)}` : ''}`, tone: 'warn' }
  }
  if (l.state === 'later') return { text: v.waitsFor ? `Not yet · after ${v.waitsFor.toLowerCase()}` : 'Not yet', tone: 'quiet' }
  const who = v.owner === me ? 'You' : firstName(v.owner) || PEOPLE[v.owner]?.short || ''
  const late = !!v.due && v.due < TODAY
  const step = l.steps.length > 1 && v.short.toLowerCase() !== l.label.toLowerCase() ? ` · ${v.short}` : ''
  return { text: `${who}${late ? ' · late' : ''}${step}`, tone: late ? 'bad' : v.owner === me ? 'me' : 'plain' }
}
const laneAttrs = (l: LaneView) => ({ 'data-lane': l.key, 'data-step': l.at.key, 'data-has': l.steps.map((x) => x.key).join(' ') })

/** the lane's number in a circle: a check when it's done, an ! when it's a problem, blue when it's someone's turn */
function NumMark({ n, state }: { n: number; state: StepView['state'] }) {
  const box = 'inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full text-[0.71875rem] font-bold tnum'
  if (state === 'done') return <span className={cn(box, 'bg-[#2c8a5b] text-white')}><Check className="h-3 w-3" strokeWidth={3.2} /></span>
  if (state === 'bad') return <span className={cn(box, 'bg-bad-500 text-white')}>!</span>
  if (state === 'now') return <span className={cn(box, 'bg-white text-brand-700 ring-2 ring-inset ring-brand-600')}>{n}</span>
  if (state === 'wait') return <span className={cn(box, 'bg-white text-warn-700 ring-[0.09375rem] ring-inset ring-warn-500')}>{n}</span>
  return <span className={cn(box, 'bg-white text-faint ring-[0.09375rem] ring-inset ring-[#d9d3c9]')}>{n}</span>
}

/* ---------------- the top of the main side: a big ring, how far, the few facts ---------------- */
function Hero({ pct, state, ring, title, sub, alert, alertTone = 'bad', facts }: { pct: number; state: keyof typeof RING; ring?: React.ReactNode; title: string; sub: React.ReactNode; alert?: string; alertTone?: 'bad' | 'warn'; facts?: React.ReactNode[] }) {
  return (
    <section className="flex items-center gap-5 rounded-[1rem] border border-[#e8e2d8] bg-white px-5 py-4 shadow-card max-sm:gap-3.5 max-sm:px-4 max-sm:py-3.5" data-hero>
      <ProgressRing pct={pct} state={state} size={76}>{ring}</ProgressRing>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[1.375rem] font-semibold leading-tight tracking-[-0.01em] text-ink max-sm:text-[1.1875rem]">{title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.90625rem] text-ink-2">{sub}{alert && <span className={cn('inline-flex items-center rounded-full px-2 py-px text-[0.78125rem] font-semibold', alertTone === 'bad' ? 'bg-bad-50 text-bad-700 ring-1 ring-bad-100' : 'bg-warn-50 text-warn-700 ring-1 ring-warn-100')}>{alert}</span>}</div>
        {!!facts?.filter(Boolean).length && <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-faint">{facts.filter(Boolean).map((f, i) => <span key={i} className="inline-flex items-center gap-1.5">{f}</span>)}</div>}
      </div>
    </section>
  )
}

/** one piece of getting ready as a tile: its ring, its name, where it stands */
function LaneTile({ lane, me, onClick }: { lane: LaneView; me: PersonKey; onClick: () => void }) {
  const w = laneStatus(lane, me)
  const mine = (lane.state === 'now' || lane.state === 'bad') && lane.at.owner === me && lane.at.state !== 'wait'
  return (
    <button {...laneAttrs(lane)} onClick={onClick} className={cn('group relative flex min-w-0 items-center gap-3 rounded-[0.875rem] border bg-white px-3 py-3 text-left transition hover:-translate-y-px hover:shadow-card max-sm:gap-2 max-sm:px-2.5 max-sm:py-2.5', mine ? 'border-brand-300 shadow-[0_0_0_0.1875rem_rgba(38,80,207,.08)]' : lane.state === 'bad' ? 'border-bad-200' : 'border-[#e8e2d8] hover:border-[#d8d1c5]')}>
      <LaneRing lane={lane} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[0.875rem] font-semibold leading-tight', lane.state === 'later' ? 'text-ink-2' : 'text-ink')}>{lane.label}</span>
        <span className={cn('mt-0.5 block truncate text-[0.75rem] leading-tight', TONE[w.tone] || TONE.plain)}>{w.text}</span>
      </span>
      {mine && <span className="absolute -top-2 right-2.5 rounded-full bg-brand-600 px-2 py-px text-[0.65625rem] font-bold uppercase tracking-[0.03em] text-white shadow-btn">Your turn</span>}
    </button>
  )
}

/* ---------------- Getting ready ---------------- */
function ReadyPart({ job, open }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const steps = stepsFor(s, job).filter((v) => v.state !== 'na')
  const lanes = lanesFor(steps)
  const grid = lanes.filter((l) => !TILE_LANES.includes(l.key))
  const c = stepCounts(steps)
  const done = lanes.filter((l) => l.state === 'done').length
  const allDone = lanes.length > 0 && done === lanes.length
  const b = s.bookings.find((x) => x.jobId === job.id)
  const startIso = b?.start || s.prep[job.id]?.targetISO
  const start = job.dates?.start || (startIso ? labelFromIso(startIso) : undefined)
  const crew = (job.crew || b?.crew) as PersonKey | undefined
  const tasks = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done' && !t.title.startsWith('Touch-ups at') && !t.step)
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0
  const days = startIso ? daysBetween(TODAY, startIso) : null
  const lateStart = days != null && days < 0
  const past = !isGettingReady(job) && !PRICING.includes(job.stage)
  return (
    <div className="flex flex-col gap-4">
      <Hero
        pct={past ? 100 : pct}
        state={past || allDone ? 'done' : 'now'}
        title={past ? 'Got ready' : allDone ? 'Ready to start' : 'Getting ready'}
        sub={past ? 'Every step done before the job started' : allDone ? 'Every step done — start when the crew is there' : `${c.done} of ${c.total} done`}
        alert={!past && c.bad ? `${c.bad} ${c.bad === 1 ? 'problem' : 'problems'}` : undefined}
        facts={past ? [] : [
          <span className={cn('inline-flex items-center gap-1.5', lateStart && 'font-semibold text-bad-600')}><CalendarDays />{start ? (lateStart ? `Late — was to start ${start}` : `Starts ${start}${days != null && days >= 0 ? ` · ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}` : ''}`) : 'No start date yet'}</span>,
          <><HardHat />{crew ? PEOPLE[crew]?.short : 'No installer yet'}</>,
        ]}
      />
      <div className="grid grid-cols-3 gap-2.5 pt-1 max-xl:grid-cols-2 max-sm:gap-2" aria-label="The steps">
        {grid.map((l) => <LaneTile key={l.key} lane={l} me={me} onClick={() => open({ t: 'step', k: l.at.key })} />)}
      </div>
      {tasks.length > 0 && (
        <section className="overflow-hidden rounded-[0.875rem] border border-[#e8e2d8] bg-white">
          <div className="flex items-center gap-2 border-b border-line-2 px-4 py-2"><span className="text-[0.8125rem] font-semibold text-ink-2">Also open</span><span className="rounded-full bg-wash-2 px-1.5 text-[0.71875rem] font-bold tnum text-ink-2">{tasks.length}</span></div>
          {tasks.map((t) => (
            <button key={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full items-center gap-3 border-b border-line-2 px-4 py-2 text-left transition last:border-b-0 hover:bg-[#f6f3ee]">
              {isRequest(t) ? <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-[#fff1e3] text-[#c2410c]"><Truck className="h-3 w-3" /></span> : <StepIcon state={t.tone === 'bad' ? 'bad' : t.state === 'waiting' ? 'wait' : 'now'} size={22} />}
              <span className="min-w-0 flex-1"><span className="block truncate text-[0.875rem] font-medium text-ink">{t.title}</span>{t.state === 'waiting' ? <span className="block truncate text-[0.75rem] text-muted">Waiting on {t.waitingOn}</span> : t.req ? <span className="block truncate text-[0.75rem] text-muted">{t.req.trip === 'onway' ? 'On the way' : 'Asked'}{t.by ? ` by ${firstName(t.by)}` : ''}</span> : null}</span>
              <Avatar who={t.owner} size={22} />
              <span className={cn('shrink-0 text-[0.78125rem]', t.owner === me ? 'font-semibold text-brand-700' : 'text-ink-2')}>{t.owner === me ? 'You' : firstName(t.owner)}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  )
}

/** one step, open right on the project: back, the lane's path, the step itself */
function StepOpen({ job, k, back, setK }: { job: Job; k: string; back: () => void; setK: (k: string) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const steps = stepsFor(s, job).filter((v) => v.state !== 'na' || v.key === k)
  const lanes = lanesFor(steps)
  const v = steps.find((x) => x.key === k)
  const lane = v ? lanes.find((l) => l.steps.some((x) => x.key === k)) : undefined
  if (!v || !lane) return null
  return (
    <div data-panel className="@container">
      <PanelBar title={lane.label} sub={lane.total > 1 ? `${lane.done} of ${lane.total} done` : undefined} onBack={back} back="Back to the project" />
      <div className="px-5 py-4 max-sm:px-3">
        <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <LaneRing lane={lane} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.75rem] font-semibold text-muted">{lane.label}{lane.total > 1 ? ` · ${lane.done} of ${lane.total} done` : ''}</span>
              <span className="block truncate text-[1.0625rem] font-semibold leading-tight text-ink">{isDone(v) ? v.label : todoOf(v)}</span>
            </span>
          </div>
          {lane.steps.length > 1 && <StepTabs list={lane.steps} at={v.key} go={(x) => x && setK(x.key)} me={me} />}
          <div className="px-5 pb-5 pt-4 max-sm:px-4"><StepInline key={v.key} job={job} v={v} onClose={back} /></div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Installing: the rooms as tiles, each a ring ---------------- */
function InstallPart({ job, open }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const inField = IN_FIELD.includes(job.stage)
  const b = s.bookings.find((x) => x.jobId === job.id)
  const startIso = b?.start || s.prep[job.id]?.targetISO
  const start = job.dates?.start || (startIso ? labelFromIso(startIso) : undefined)
  const crew = (job.crew || b?.crew) as PersonKey | undefined
  const pct = inField ? (job.stage === 'installation' ? job.pct ?? 0 : 100) : 0
  const doneRooms = rooms.filter((r) => roomPct(r) >= 100).length
  const going = rooms.filter((r) => { const p = roomPct(r); return p > 0 && p < 100 }).length
  /* blocked is a problem (red); waiting on material or on hold is waiting (amber) */
  const blocked = rooms.filter((r) => r.surfaces.some((y) => y.state === 'blocked')).length
  const waiting = rooms.filter((r) => !r.surfaces.some((y) => y.state === 'blocked') && r.surfaces.some((y) => ['waitmat', 'hold'].includes(y.state))).length
  const sf = rooms.flatMap((r) => r.surfaces).reduce((n, x) => n + (x.sf || 0), 0)
  if (!rooms.length) return <RoomsTab job={job} />
  return (
    <div className="flex flex-col gap-4">
      <Hero
        pct={pct}
        state={!inField ? 'later' : pct >= 100 ? 'done' : 'now'}
        ring={!inField ? '–' : undefined}
        title={!inField ? 'Installing' : pct >= 100 ? 'Installed' : `${pct}% installed`}
        sub={!inField ? (start ? `Starts ${start}${crew ? ` with ${PEOPLE[crew]?.short}` : ''} — these rooms get installed` : 'No start date yet — it comes with the installer’s PO') : `${doneRooms} of ${rooms.length} rooms done${going ? ` · ${going} going` : ''}`}
        alert={inField && blocked ? `${blocked} ${blocked === 1 ? 'room' : 'rooms'} blocked` : inField && waiting ? `${waiting} waiting` : undefined}
        alertTone={blocked ? 'bad' : 'warn'}
        facts={[
          crew ? <><HardHat />{PEOPLE[crew]?.short}</> : null,
          job.dates?.start ? <><CalendarDays />{job.dates.start} – {job.dates.finish || '…'}</> : null,
          sf ? <><Grid2x2 />{sf.toLocaleString('en-US')} SF</> : null,
        ]}
      />
      <div className="grid grid-cols-3 gap-2.5 max-xl:grid-cols-2 max-sm:gap-2" aria-label="The rooms">
        {rooms.map((x) => {
          const p = roomPct(x)
          const wait = x.surfaces.filter((y) => ['blocked', 'waitmat', 'hold'].includes(y.state))
          const stuck = wait.some((y) => y.state === 'blocked')
          const st: keyof typeof RING = !inField ? 'later' : p >= 100 ? 'done' : stuck ? 'bad' : wait.length ? 'wait' : p > 0 ? 'now' : 'later'
          return (
            <button key={x.name} data-room={x.name} onClick={() => open({ t: 'room', name: x.name })} className={cn('flex min-w-0 items-center gap-3 rounded-[0.875rem] border bg-white px-3 py-3 text-left transition hover:-translate-y-px hover:shadow-card max-sm:gap-2 max-sm:px-2.5 max-sm:py-2.5', st === 'bad' ? 'border-bad-200' : 'border-[#e8e2d8] hover:border-[#d8d1c5]')}>
              <ProgressRing pct={inField ? p : 0} state={st}>{!inField ? x.surfaces.length : undefined}</ProgressRing>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.875rem] font-semibold leading-tight text-ink">{x.name}</span>
                <span className={cn('mt-0.5 block truncate text-[0.75rem] leading-tight', st === 'bad' ? 'font-medium text-bad-600' : st === 'wait' ? 'text-warn-700' : st === 'done' ? 'text-[#2c8a5b]' : st === 'now' ? 'text-brand-700' : 'text-muted')}>
                  {!inField ? `${x.surfaces.length} walls and floors` : p >= 100 ? 'Done' : wait.length ? `${stuck ? 'Blocked' : 'Waiting'} — ${(wait.find((y) => y.state === 'blocked') || wait[0]).reason || SURF_LABEL[wait[0].state]}` : p > 0 ? `${x.surfaces.filter((y) => y.state === 'done').length} of ${x.surfaces.length} done` : 'Not started'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** one room, open on the project: its walls and floors — tap one for its tile, grout, layout and photos */
function RoomOpen({ job, name, back }: { job: Job; name: string; back: () => void }) {
  const s = useStore()
  const r = (s.rooms[job.id] || []).find((x) => x.name === name)
  const [openSf, setOpenSf] = React.useState<string | null>(null)
  const inField = IN_FIELD.includes(job.stage)
  if (!r) return null
  const p = roomPct(r)
  const entries = (s.diary[job.id] || []).filter((e) => e.rooms.some((x) => x.room === r.name))
  return (
    <div data-panel>
      <PanelBar title={r.name} sub={inField ? `${p}% installed · ${r.surfaces.filter((x) => x.state === 'done').length} of ${r.surfaces.length} done` : `${r.surfaces.length} walls and floors`} onBack={back} back="Back to the project" right={entries.length ? <Button size="sm" variant="ghost" icon={<FileText />} onClick={() => s.open({ t: 'room', jobId: job.id, room: r.name, view: 'log' })}>Daily log · {entries.length}</Button> : undefined} />
      <div className="px-5 py-4 max-sm:px-3">
        <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
          {r.surfaces.map((x) => {
            const tile = tilesOf(job.id).find((t) => t.tag === x.tile)
            const g = x.grout || tile?.grout
            const on = openSf === x.name
            const waiting = ['blocked', 'waitmat', 'hold', 'unknown'].includes(x.state)
            return (
              <div key={x.name} className="border-b border-line-2 last:border-b-0">
                <button data-surface={x.name} onClick={() => setOpenSf(on ? null : x.name)} aria-expanded={on} className={cn('flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-[#f6f3ee]', on && 'bg-[#f6f3ee]')}>
                  <TileImg tile={tile} size={34} radius={8} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.90625rem] font-semibold text-ink">{x.name}<span className="font-normal text-muted"> · {tile ? `${x.tile} ${tile.name}` : x.tile || 'no tile yet'}{g ? ` · ${GROUTS[g]?.name || g} grout` : ''}</span></span>
                    <span className={cn('block truncate text-[0.78125rem]', waiting ? 'font-medium text-bad-600' : x.state === 'working' ? 'text-brand-700' : x.state === 'done' ? 'text-[#2c8a5b]' : 'text-muted')}>{x.state === 'working' ? `In progress · ${surfacePct(x)}%` : SURF_LABEL[x.state]}{x.reason ? ` — ${x.reason}` : ''}{x.sf ? ` · ${x.sf} SF` : ''}</span>
                  </span>
                  <ChevronRight className={cn('h-4 w-4 shrink-0 text-faint transition', on && 'rotate-90')} />
                </button>
                {on && <div className="border-t border-line-2 bg-white"><SurfaceDetail job={job} room={r} sf={x} /></div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Touch-ups and the money ---------------- */
function PunchPart({ job }: { job: Job }) {
  const s = useStore()
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const open = punch.filter((p) => p.status !== 'verified')
  const canAdd = !['accounting', 'client', 'crew'].includes(s.role)
  const pct = punch.length ? Math.round(((punch.length - open.length) / punch.length) * 100) : 0
  return (
    <div className="flex flex-col gap-4">
      <Hero pct={pct} state={!punch.length ? 'later' : open.length ? 'now' : 'done'} ring={!punch.length ? '–' : undefined} title="Touch-ups" sub={punch.length ? (open.length ? `${open.length} open · ${punch.length - open.length} of ${punch.length} checked` : `All ${punch.length} checked`) : 'None yet — the walkthrough’s list goes here'} />
      <section className="rounded-[0.875rem] border border-[#e8e2d8] bg-white px-4 pb-4 pt-3">
        {canAdd && <div className="mb-2 flex justify-end"><Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'punchnew', jobId: job.id })}>Add touch-ups</Button></div>}
        <TouchupsList job={job} />
      </section>
    </div>
  )
}
function MoneyPart({ job }: { job: Job }) {
  const s = useStore()
  const pic = pictureOf(s, job.id)
  const total = pic.contract + pic.changes
  return (
    <div className="flex flex-col gap-4">
      <Hero pct={pic.paidPct} state={job.stage === 'complete' || (total > 0 && pic.paid >= total) ? 'done' : pic.billed ? 'now' : 'later'} ring={!pic.billed ? '–' : undefined} title="Billed and paid" sub={pic.billed ? `${fmtMoney(pic.paid)} of ${fmtMoney(total)} paid` : 'Nothing billed yet'} facts={[total ? <><Receipt />{fmtMoney(pic.billed)} billed</> : null, total ? <>{fmtMoney(total - pic.paid)} still open</> : null]} />
      <MoneyTab job={job} />
    </div>
  )
}

/* ---------------- the right side: the project, the same in every part ---------------- */
export function Box({ title, right, children, className }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('border-b border-line px-5 py-4 last:border-b-0 max-sm:px-4', className)}>
      <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[0.9375rem] font-semibold text-ink">{title}</span>{right}</div>
      {children}
    </section>
  )
}

/** a step that belongs to the tile (the store's paperwork, the grout) — one line with its ring, inside the tile's box */
function LaneLine({ lane, label, me, onClick }: { lane: LaneView; label: string; me: PersonKey; onClick: () => void }) {
  const w = laneStatus(lane, me)
  return (
    <button {...laneAttrs(lane)} onClick={onClick} className={cn('-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#f6f3ee]', lane.state === 'bad' && 'bg-bad-50/60')}>
      <LaneRing lane={lane} size={36} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[0.84375rem] font-semibold text-ink">{label}</span>
        <span className={cn('mt-0.5 block truncate text-[0.75rem]', TONE[w.tone] || TONE.plain)}>{w.text}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
    </button>
  )
}

/** the tile and the grout — every tile with its picture and grout, the store's paperwork and the grout picks with it */
function TileBox({ job, open }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const rooms = s.rooms[job.id] || []
  const tiles = tilesOf(job.id)
  const lanes = PRICING.includes(job.stage) ? [] : lanesFor(stepsFor(s, job).filter((v) => v.state !== 'na'))
  const paper = lanes.find((l) => l.key === 'paper')
  const grout = lanes.find((l) => l.key === 'grout')
  const mine = [paper, grout].filter(Boolean) as LaneView[]
  const done = mine.reduce((n, l) => n + l.done, 0)
  const total = mine.reduce((n, l) => n + l.total, 0)
  const showSteps = isGettingReady(job) && mine.some((l) => l.state !== 'done')
  return (
    <Box title="Tile and grout" right={total && isGettingReady(job) ? <span className={cn('text-[0.75rem] font-semibold tnum', done === total ? 'text-[#2c8a5b]' : 'text-muted')}>{done} of {total} done</span> : tiles.length ? <span className="text-[0.75rem] text-muted">{tiles.length}</span> : undefined}>
      {paper && <LaneLine lane={paper} label="The store’s paperwork" me={me} onClick={() => open({ t: 'step', k: paper.at.key })} />}
      {grout && <LaneLine lane={grout} label="Tile and grout picked" me={me} onClick={() => open({ t: 'step', k: grout.at.key })} />}
      {(paper || grout) && tiles.length > 0 && <div className="my-1.5 h-px bg-line-2" />}
      {tiles.length ? tiles.map((t) => {
        const g = t.grout ? GROUTS[t.grout] : undefined
        const on = rooms.flatMap((r) => r.surfaces).filter((x) => x.tile === t.tag)
        return (
          <button key={t.tag} onClick={() => s.open({ t: 'tile', jobId: job.id, tag: t.tag })} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#f6f3ee]">
            <TileImg tile={t} size={36} radius={8} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.84375rem] font-semibold text-ink"><span className="tnum">{t.tag}</span> · {t.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[0.75rem]">{g ? <><span className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: g.color }} /><span className="truncate text-ink-2">{g.name}{t.joint ? ` · ${t.joint}` : ''}</span></> : <span className="text-warn-700">No grout yet</span>}{on.length ? <span className="truncate text-faint">· {on.length} {on.length === 1 ? 'surface' : 'surfaces'}</span> : null}</span>
            </span>
          </button>
        )
      }) : <div className="pt-1 text-[0.8125rem] text-muted">No tile yet — it comes in with the store’s paperwork.</div>}
    </Box>
  )
}

/** the files kept with the project — plans, paperwork, photos. Tap one and it opens right here. */
function FilesBox({ job, open }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const save = useSaveStatus()
  const files = s.files.filter((f) => f.jobId === job.id)
  const sample = save.mode === 'sample' && save.where !== 'cloud' ? filesFor(job.id) : []
  const add = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const upload = async (list: File[]) => {
    if (!list.length) return
    setBusy(true)
    const photos = list.filter((f) => f.type.startsWith('image/'))
    const other = list.filter((f) => !f.type.startsWith('image/'))
    if (photos.length) await keepFiles(job.id, photos, 'photo')
    if (other.length) await keepFiles(job.id, other, /plan|drawing|arch/i.test(other[0].name) ? 'plans' : 'other')
    setBusy(false)
  }
  const n = files.length + sample.length
  const row = 'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#f6f3ee]'
  return (
    <Box title="Files" right={<span className="flex items-center gap-1">{n > 3 && <button onClick={() => open({ t: 'files' })} className="rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50">All {n}</button>}<button onClick={() => add.current?.click()} disabled={busy} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50"><Upload className="h-3.5 w-3.5" />{busy ? 'Adding…' : 'Add'}</button></span>}>
      <input ref={add} type="file" multiple className="hidden" aria-label="Add files — Files" onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; void upload(f) }} />
      {n === 0 && <button onClick={() => add.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d6cfc3] py-3.5 text-[0.8125rem] font-medium text-muted hover:border-brand-300 hover:text-brand-700"><Paperclip className="h-4 w-4" />Plans, paperwork, photos — add them here</button>}
      <div className="-mx-2">
        {files.slice(-3).reverse().map((f) => (
          <button key={f.id} onClick={() => open({ t: 'file', id: f.id })} title={f.name} className={row}>
            {f.thumb ? <img src={f.thumb} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" /> : <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wash text-[0.5625rem] font-bold uppercase text-muted">{(f.name.split('.').pop() || f.kind).slice(0, 4)}</span>}
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink-2">{f.name}</span>
          </button>
        ))}
        {files.length < 3 && sample.slice(0, 3 - files.length).map((d) => (
          <button key={d.name} onClick={() => open({ t: 'files' })} title={d.name} className={row}>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wash text-muted"><FileText className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink-2">{d.name}</span>
            <span className="shrink-0 text-[0.71875rem] text-faint">{d.rev}</span>
          </button>
        ))}
      </div>
    </Box>
  )
}

/** the conversation, the last two things said — tap it and it opens right here */
function MessagesBox({ job, open }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const msgs = s.messages[job.id] || []
  const unread = msgs.slice(s.seen?.[`${job.id}|${me}`]?.n || 0).filter((m) => m.who !== me).length
  const said = (m: (typeof msgs)[number]) => (m.deleted ? 'Deleted message' : m.audio || m.audioPath ? '🎤 Voice note' : m.file ? `📄 ${m.file.name}` : m.media?.length || m.photos?.length ? '📷 Photo' : m.text)
  return (
    <Box title="Messages" right={unread ? <span className="rounded-full bg-bad-500 px-1.5 text-[0.71875rem] font-bold text-white">{unread} new</span> : undefined}>
      <button onClick={() => open({ t: 'chat' })} className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left transition hover:bg-[#f6f3ee]">
        {msgs.length ? msgs.slice(-2).map((m) => (
          <span key={m.id} className="flex items-start gap-2 py-1">
            <Avatar who={m.who} size={22} />
            <span className="min-w-0 flex-1 text-[0.8125rem] leading-snug"><b className="font-semibold text-ink">{m.who === me ? 'You' : PEOPLE[m.who]?.short || 'Someone'}</b> <span className="line-clamp-2 text-ink-2">{said(m)}</span></span>
          </span>
        )) : <span className="block py-1 text-[0.8125rem] text-muted">No messages yet — write to the team, send a photo or a voice note.</span>}
        <span className="mt-1 inline-flex items-center gap-1 text-[0.78125rem] font-semibold text-brand-700"><MessageCircle className="h-3.5 w-3.5" />Open the conversation</span>
      </button>
    </Box>
  )
}

export function ProjectInfo({ job, open }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const money = s.role !== 'site' && s.role !== 'crew'
  const rooms = s.rooms[job.id] || []
  const sf = rooms.flatMap((r) => r.surfaces).reduce((n, x) => n + (x.sf || 0), 0)
  return (
    <div>
      <TileBox job={job} open={open} />
      <MessagesBox job={job} open={open} />
      <FilesBox job={job} open={open} />
      <section className="px-5 py-3.5 max-sm:px-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] font-semibold text-brand-700">
          <button onClick={() => open({ t: 'scope' })} className="inline-flex items-center gap-1.5 hover:underline"><Grid2x2 className="h-3.5 w-3.5" />Scope of work{rooms.length ? <span className="font-normal text-muted">· {rooms.length} rooms{sf ? `, ${sf.toLocaleString('en-US')} SF` : ''}</span> : null}</button>
          {money && <button onClick={() => open({ t: 'orders' })} className="inline-flex items-center gap-1.5 hover:underline"><Package className="h-3.5 w-3.5" />Orders</button>}
          <button onClick={() => open({ t: 'log' })} className="inline-flex items-center gap-1.5 hover:underline"><History className="h-3.5 w-3.5" />What happened</button>
        </div>
      </section>
    </div>
  )
}

/* ---------------- something opened on the project, with Back on top ---------------- */
const FULL: string[] = ['chat', 'file']
function InPlace({ job, view, back, setView }: { job: Job; view: NonNullable<BoardView>; back: () => void; setView: (v: BoardView) => void }) {
  const b = 'Back to the project'
  const page = (title: string, body: React.ReactNode, sub?: string) => (
    <div data-panel={view.t}>
      <PanelBar title={title} sub={sub} onBack={back} back={b} />
      <div className="px-5 py-4 max-sm:px-3">{body}</div>
    </div>
  )
  switch (view.t) {
    case 'step': return <StepOpen job={job} k={view.k} back={back} setK={(k) => setView({ t: 'step', k })} />
    case 'room': return <RoomOpen job={job} name={view.name} back={back} />
    case 'chat': return (
      <div className="flex h-full min-h-0 flex-col" data-panel="chat">
        <PanelBar title="Messages" sub={`${job.name} — the team, the crew and the GC`} onBack={back} back={b} />
        <div className="min-h-0 flex-1"><Thread jobId={job.id} outside={useStore.getState().role === 'client'} /></div>
      </div>
    )
    case 'file': return <DocPanel jobId={job.id} fileId={view.id} onBack={back} back={b} />
    case 'files': return page('Files and photos', <FilesTab job={job} />)
    case 'scope': return page('Scope of work', <ScopeTab job={job} />, 'every wall and floor — its tile, grout and layout')
    case 'log': return page('What happened', <HistoryTab job={job} />)
    case 'orders': return page('All the orders', <POsTab job={job} onScope={() => setView({ t: 'scope' })} />)
  }
}

/* ---------------- the body: the part on the left, the project on the right ---------------- */
export function ProjectBoard({ job, part, view, setView }: { job: Job; part: Part; view: BoardView; setView: (v: BoardView) => void }) {
  const s = useStore()
  const money = s.role !== 'site' && s.role !== 'crew'
  const pricing = PRICING.includes(job.stage)
  const top = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { top.current?.scrollTo?.({ top: 0 }) }, [view, part])
  const full = !!view && FULL.includes(view.t)
  const main = view ? <InPlace job={job} view={view} back={() => setView(null)} setView={setView} /> : (
    <div className="px-5 py-4 max-sm:px-3">
      {part === 'ready' && (pricing
        ? <div className="rounded-[0.875rem] border border-line bg-white px-4 py-8 text-center text-[0.875rem] text-muted">Paperwork, the design meeting, the site, the installer, deliveries, the deposit — the flow starts once the estimate is won.</div>
        : <ReadyPart job={job} open={setView} />)}
      {part === 'install' && <InstallPart job={job} open={setView} />}
      {part === 'punch' && <PunchPart job={job} />}
      {part === 'money' && money && <MoneyPart job={job} />}
    </div>
  )
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_22.5rem] max-lg:h-auto max-lg:grid-cols-1">
      <div ref={top} className={cn('min-h-0 min-w-0 border-r border-line bg-[#f7f5f1] max-lg:border-r-0', full ? 'flex flex-col max-lg:h-[78dvh]' : 'scroll-soft lg:overflow-y-auto')} data-board-main>{main}</div>
      <aside className="scroll-soft min-h-0 min-w-0 bg-white max-lg:border-t max-lg:border-line lg:overflow-y-auto"><ProjectInfo job={job} open={setView} /></aside>
    </div>
  )
}

/** the window's footer line: where the money stands (on Billed and paid), else the dates and the client */
export function ProjectFoot({ job, part }: { job: Job; part: Part }) {
  const s = useStore()
  const money = s.role !== 'site' && s.role !== 'crew'
  const pic = money && part === 'money' ? pictureOf(s, job.id) : null
  if (pic && pic.billed > 0) return <span className="inline-flex items-center gap-2 text-[0.84375rem] text-muted"><Receipt className="h-4 w-4 text-faint" />{fmtMoney(pic.paid)} paid of {fmtMoney(pic.contract + pic.changes)} · {fmtMoney(pic.contract + pic.changes - pic.paid)} open</span>
  return null
}

/** a desktop-sized window — the step opens on the right; on a phone it opens over the list */
export function useWide() {
  const [wide, setWide] = React.useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true))
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const f = () => setWide(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return wide
}
