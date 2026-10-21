/* The project, in the same shape as the estimate: the header carries its four parts as rings (Getting ready,
 * Installing, Touch-ups, Billed and paid). The main side is the work of the part you're on, and what to look at first
 * is on top: in Getting ready, what's YOUR turn, then what's with others, then what's done. Tap a step and it opens
 * right there, with a back arrow — one window, nothing on top of it. Installing is the rooms; tap one and its walls
 * and floors open the same way. The right side is the project, the same in every part: the tile and the grout, the
 * files, the messages, the scope. */
import * as React from 'react'
import { Check, Plus, Paperclip, MessageCircle, Package, History, ListTodo, Building2, CalendarDays, Receipt, ChevronLeft, ChevronRight, ArrowRight, Grid2x2, FileText, Upload, Play, Truck } from 'lucide-react'
import { useStore, meOf, isRequest } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { roomPct, tilesOf, GROUTS, filesFor } from '@/tileos/data/jobs'
import { Ring } from '@/tileos/components/ui/progress'
import { TODAY, labelFromIso } from '@/tileos/lib/today'
import { isGettingReady, stepsFor, stepCounts, lanesFor, type StepView, type LaneView } from '../steps'
import { StepIcon } from '../steps-ui'
import { StepInline, StepTabs, todoOf } from '../stepwin'
import { pictureOf } from '../progressbill'
import { startProject } from '../flows'
import { RoomsTab, SurfaceDetail } from './rooms'
import { MoneyTab } from './money-tab'
import { TouchupsList } from '../touchups'
import { firstName } from './kit'
import { useSaveStatus } from '@/tileos/lib/save'
import { keepFiles, openFile } from '@/tileos/lib/files'
import { surfacePct, SURF_LABEL } from '@/tileos/data/jobs'

export type Part = 'ready' | 'install' | 'punch' | 'money'
const PRICING = ['request', 'estimating', 'proposal', 'followup']
const IN_FIELD = ['installation', 'punch', 'closeout', 'complete']
const isDone = (v: StepView) => v.state === 'done' || v.state === 'na'

/** where the project is — the part it opens on */
export function partOf(job: Job): Part {
  if (job.stage === 'installation') return 'install'
  if (job.stage === 'punch') return 'punch'
  if (['closeout', 'complete'].includes(job.stage)) return 'money'
  return 'ready'
}

type PartState = 'done' | 'now' | 'later' | 'bad'
export type PartView = { key: Part; label: string; short: string; pct: number; state: PartState; sub: string; subShort: string }

/** the four parts and how far each is — for the rings in the header */
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
      sub: past ? 'Done' : pricing ? 'Once the estimate is won' : c.bad ? `${lDone} of ${lanes.length} done · ${c.bad} ${c.bad === 1 ? 'problem' : 'problems'}` : allDone ? `All ${lanes.length} done — ready to start` : `${lDone} of ${lanes.length} done`,
      subShort: past ? 'Done' : pricing ? 'Not yet' : c.bad ? `${c.bad} ${c.bad === 1 ? 'problem' : 'problems'}` : `${lDone} of ${lanes.length}`,
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

/* ---------------- one ring: how far a part is ---------------- */
const RING: Record<PartState, string> = { done: '#2c8a5b', now: '#2650cf', later: '#c9c3b8', bad: '#d7342a' }
function PartRing({ pct, state, size }: { pct: number; state: PartState; size: number }) {
  const stroke = size >= 44 ? 4 : 3
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const fill = state === 'done' ? 100 : Math.max(0, Math.min(100, pct))
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={state === 'bad' ? '#f3d3cf' : '#e9e4db'} strokeWidth={stroke} />
        {fill > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING[state]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * fill) / 100} ${c}`} className="transition-[stroke-dasharray] duration-500" />}
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center font-bold tnum', size >= 44 ? 'text-[0.75rem]' : 'text-[0.625rem]', state === 'done' ? 'text-[#2c8a5b]' : state === 'bad' ? 'text-bad-600' : state === 'now' ? 'text-ink' : 'text-faint')}>
        {state === 'done' ? <Check className={size >= 44 ? 'h-[1.125rem] w-[1.125rem]' : 'h-3.5 w-3.5'} strokeWidth={3} /> : state === 'later' && !pct ? '–' : `${Math.round(pct)}%`}
      </span>
    </span>
  )
}

/** the track in the header: the four parts in one row, each a ring with its words beside it — the same place the
 *  estimate has its path, and the same height */
export function Track({ parts, at, onPick, className }: { parts: PartView[]; at: Part; onPick: (p: Part) => void; className?: string }) {
  return (
    <ol aria-label="The project, part by part" className={cn('no-scrollbar flex items-stretch gap-1 overflow-x-auto', className)}>
      {parts.map((p, i) => {
        const on = p.key === at
        return (
          <li key={p.key} className="flex min-w-0 flex-1 items-center">
            <button onClick={() => onPick(p.key)} aria-current={on ? 'step' : undefined} aria-label={`${p.label} — ${p.sub}`} className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition max-sm:flex-col max-sm:gap-1 max-sm:px-0.5 max-sm:text-center', on ? 'bg-[#f6f3ee] ring-1 ring-[#e9e4db]' : 'hover:bg-[#f6f3ee]/70')}>
              <PartRing pct={p.pct} state={p.state} size={34} />
              <span className="min-w-0 leading-tight max-sm:w-full">
                <span className={cn('block truncate text-[0.8125rem] font-semibold', on ? 'text-ink' : p.state === 'later' ? 'text-muted' : 'text-ink-2')}><span className="max-sm:hidden">{p.label}</span><span className="sm:hidden">{p.short}</span></span>
                <span className={cn('block truncate text-[0.71875rem]', p.state === 'bad' ? 'font-semibold text-bad-600' : p.state === 'done' ? 'text-[#2c8a5b]' : p.state === 'now' ? 'text-ink-2' : 'text-faint')}><span className="max-sm:hidden">{p.sub}</span><span className="sm:hidden">{p.subShort}</span></span>
              </span>
            </button>
            {i < parts.length - 1 && <span className={cn('mx-0.5 h-[0.125rem] w-3 shrink-0 rounded-full max-sm:hidden', p.state === 'done' ? 'bg-[#2c8a5b]' : 'bg-[#e5e0d7]')} />}
          </li>
        )
      })}
    </ol>
  )
}

/* ---------------- the flow: one line per lane ---------------- */
/** what a step line says on its right: whose turn, waiting, done — in a word or two */
function stepWord(v: StepView, me: PersonKey): { text: string; tone: 'ok' | 'bad' | 'warn' | 'me' | 'quiet' | 'plain' } {
  if (v.state === 'done') return { text: v.doneOn ? `Done ${v.doneOn}` : 'Done', tone: 'ok' }
  if (v.state === 'na') return { text: 'Not needed', tone: 'quiet' }
  if (v.state === 'bad') return { text: 'Problem', tone: 'bad' }
  if (v.state === 'wait') return { text: v.due ? `Waiting · ${labelFromIso(v.due)}` : 'Waiting', tone: 'warn' }
  if (v.state === 'later') return { text: 'Not yet', tone: 'quiet' }
  const who = v.owner === me ? 'You' : firstName(v.owner) || PEOPLE[v.owner]?.short || ''
  const late = v.due && v.due < TODAY
  return { text: late ? `${who} · late` : who, tone: late ? 'bad' : v.owner === me ? 'me' : 'plain' }
}
const TONE: Record<string, string> = { ok: 'text-[#2c8a5b]', bad: 'text-bad-600 font-semibold', warn: 'text-warn-700', me: 'text-brand-700 font-semibold', quiet: 'text-faint', plain: 'text-ink-2' }

/** the lane's number in a circle: a check when it's done, an ! when it's a problem, blue when it's someone's turn */
function NumMark({ n, state }: { n: number; state: StepView['state'] }) {
  const box = 'inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full text-[0.71875rem] font-bold tnum'
  if (state === 'done') return <span className={cn(box, 'bg-[#2c8a5b] text-white')}><Check className="h-3 w-3" strokeWidth={3.2} /></span>
  if (state === 'bad') return <span className={cn(box, 'bg-bad-500 text-white')}>!</span>
  if (state === 'now') return <span className={cn(box, 'bg-white text-brand-700 ring-2 ring-inset ring-brand-600')}>{n}</span>
  if (state === 'wait') return <span className={cn(box, 'bg-white text-warn-700 ring-[0.09375rem] ring-inset ring-warn-500')}>{n}</span>
  return <span className={cn(box, 'bg-white text-faint ring-[0.09375rem] ring-inset ring-[#d9d3c9]')}>{n}</span>
}

/** a lane's steps as dots: green done, blue where it's going on, red for a problem, amber waiting, hollow not yet */
function Dots({ steps }: { steps: StepView[] }) {
  if (steps.length < 2) return null
  const tone = (st: StepView['state']) => st === 'done' || st === 'na' ? 'bg-[#2c8a5b]' : st === 'bad' ? 'bg-bad-500' : st === 'now' ? 'bg-white ring-[0.125rem] ring-inset ring-brand-600' : st === 'wait' ? 'bg-white ring-[0.125rem] ring-inset ring-warn-500' : 'bg-white ring-1 ring-inset ring-[#d2ccc1]'
  return <span className="ml-1.5 inline-flex shrink-0 items-center gap-[0.1875rem] align-middle" aria-label={`${steps.filter((x) => x.state === 'done' || x.state === 'na').length} of ${steps.length} steps done`}>{steps.map((x) => <span key={x.key} className={cn('inline-block h-[0.4375rem] w-[0.4375rem] rounded-full', tone(x.state))} />)}</span>
}

/* ---------------- Getting ready: your turn, with others, done ---------------- */
/** a lane to do: the number, what it is, the step it's on and what it needs — and who has it */
function LaneRow({ n, lane, me, big, onClick }: { n: number; lane: LaneView; me: PersonKey; big?: boolean; onClick: () => void }) {
  const at = lane.at
  const w = stepWord(at, me)
  const sub = lane.steps.length > 1 && at.short.toLowerCase() !== lane.label.toLowerCase() ? at.short : ''
  const note = [sub, at.note || ''].filter(Boolean).join(at.state === 'bad' || at.state === 'wait' ? ' — ' : ' · ')
  return (
    <button data-lane={lane.key} data-step={at.key} data-has={lane.steps.map((x) => x.key).join(' ')} onClick={onClick} className={cn('group flex w-full items-center gap-3 border-b border-line-2 px-4 text-left transition last:border-b-0 hover:bg-[#f6f3ee]', big ? 'py-3' : 'py-2')}>
      <NumMark n={n} state={lane.state} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate leading-[1.25rem]', big ? 'text-[0.9375rem] font-semibold text-ink' : 'text-[0.875rem] font-medium text-ink')}>{big ? todoOf(at) : lane.label}{!big && <Dots steps={lane.steps} />}</span>
        {(big || at.state === 'bad' || at.state === 'wait') && note && <span className={cn('block truncate text-[0.78125rem] leading-[1.125rem]', at.state === 'bad' ? 'text-bad-600' : 'text-muted')}>{big ? `${lane.label}${note ? ` · ${note}` : ''}` : note}</span>}
      </span>
      {big
        ? <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-brand-600 px-3 text-[0.8125rem] font-semibold text-white shadow-btn transition group-hover:bg-brand-700">Open<ArrowRight className="h-3.5 w-3.5" /></span>
        : <span className="flex shrink-0 items-center gap-2">
            {at.state !== 'wait' && at.state !== 'bad' && <Avatar who={at.owner} size={22} />}
            <span className={cn('text-[0.78125rem] tnum', TONE[w.tone] || TONE.plain)}>{w.text}</span>
          </span>}
    </button>
  )
}
function Head({ children, n, tone }: { children: React.ReactNode; n?: number; tone?: 'me' | 'bad' }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-1.5 pt-1">
      <span className={cn('text-[0.8125rem] font-semibold', tone === 'me' ? 'text-brand-700' : tone === 'bad' ? 'text-bad-700' : 'text-ink-2')}>{children}</span>
      {n != null && <span className={cn('rounded-full px-1.5 text-[0.71875rem] font-bold tnum', tone === 'me' ? 'bg-brand-600 text-white' : 'bg-wash-2 text-ink-2')}>{n}</span>}
    </div>
  )
}
function Flow({ job, open }: { job: Job; open: (k: string) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const steps = stepsFor(s, job).filter((v) => v.state !== 'na')
  const lanes = lanesFor(steps)
  const num = (l: LaneView) => lanes.indexOf(l) + 1
  const active = lanes.filter((l) => l.state === 'now' || l.state === 'bad' || l.state === 'wait')
  const mine = active.filter((l) => l.at.owner === me && l.at.state !== 'wait')
  const others = active.filter((l) => !mine.includes(l)).sort((a, b) => (a.state === 'bad' ? 0 : 1) - (b.state === 'bad' ? 0 : 1) || num(a) - num(b))
  const later = lanes.filter((l) => l.state === 'later')
  const done = lanes.filter((l) => l.state === 'done')
  const tasks = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done' && !t.title.startsWith('Touch-ups at') && !t.step)
  const allDone = lanes.length > 0 && done.length === lanes.length
  return (
    <div className="flex flex-col gap-4">
      {allDone && ['setup', 'verification', 'ready', 'scheduled'].includes(job.stage) && (
        <div className="flex items-center gap-4 rounded-[0.875rem] border border-ok-100 bg-ok-50 px-5 py-4">
          <StepIcon state="done" size={34} />
          <span className="min-w-0 flex-1"><span className="block text-[1rem] font-semibold text-ink">Everything is ready</span><span className="block text-[0.84375rem] text-ink-2">All {lanes.length} steps are done. Start the job when the crew is there.</span></span>
          {['ready', 'scheduled'].includes(job.stage) && <Button variant="primary" icon={<Play />} onClick={() => startProject(job.id)}>Start the job</Button>}
        </div>
      )}
      {!allDone && (
        <section>
          <Head n={mine.length} tone="me">Your turn</Head>
          {mine.length ? (
            <div className="overflow-hidden rounded-[0.875rem] border border-brand-100 bg-white shadow-[0_0.0625rem_0.125rem_rgba(38,80,207,.06)]">
              {mine.map((l) => <LaneRow key={l.key} n={num(l)} lane={l} me={me} big onClick={() => open(l.at.key)} />)}
            </div>
          ) : <div className="rounded-[0.875rem] border border-dashed border-[#ddd6ca] px-4 py-3 text-[0.84375rem] text-muted">Nothing on this project is waiting on you.</div>}
        </section>
      )}
      {others.length > 0 && (
        <section>
          <Head n={others.length}>With others</Head>
          <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
            {others.map((l) => <LaneRow key={l.key} n={num(l)} lane={l} me={me} onClick={() => open(l.at.key)} />)}
          </div>
        </section>
      )}
      {tasks.length > 0 && (
        <section>
          <Head n={tasks.length}>Requests and questions</Head>
          <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
            {tasks.map((t) => (
              <button key={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full items-center gap-3 border-b border-line-2 px-4 py-2 text-left transition last:border-b-0 hover:bg-[#f6f3ee]">
                {isRequest(t) ? <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-[#fff1e3] text-[#c2410c]"><Truck className="h-3 w-3" /></span> : <StepIcon state={t.tone === 'bad' ? 'bad' : t.state === 'waiting' ? 'wait' : 'now'} size={22} />}
                <span className="min-w-0 flex-1"><span className="block truncate text-[0.875rem] font-medium text-ink">{t.title}</span>{t.state === 'waiting' ? <span className="block truncate text-[0.75rem] text-muted">Waiting on {t.waitingOn}</span> : t.req ? <span className="block truncate text-[0.75rem] text-muted">{t.req.trip === 'onway' ? 'On the way' : 'Asked'}{t.by ? ` by ${firstName(t.by)}` : ''}</span> : null}</span>
                <Avatar who={t.owner} size={22} />
                <span className={cn('shrink-0 text-[0.78125rem]', t.owner === me ? 'font-semibold text-brand-700' : 'text-ink-2')}>{t.owner === me ? 'You' : firstName(t.owner)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {(later.length > 0 || done.length > 0) && (
        <section className="flex flex-col gap-2 rounded-[0.875rem] bg-[#f6f3ee] px-4 py-3">
          {later.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[0.78125rem] font-semibold text-muted">Then</span>
              {later.map((l) => <button key={l.key} data-lane={l.key} data-step={l.at.key} data-has={l.steps.map((x) => x.key).join(' ')} onClick={() => open(l.at.key)} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-white px-2.5 text-[0.78125rem] font-medium text-ink-2 hover:border-[#cdc7bc]"><span className="text-faint tnum">{num(l)}</span>{l.label}</button>)}
            </div>
          )}
          {done.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[0.78125rem] font-semibold text-muted">Done</span>
              {done.map((l) => <button key={l.key} data-lane={l.key} data-step={l.at.key} data-has={l.steps.map((x) => x.key).join(' ')} onClick={() => open(l.at.key)} className="inline-flex h-7 items-center gap-1 rounded-full bg-white px-2.5 text-[0.78125rem] font-medium text-[#2c4a3e] ring-1 ring-[#d5e7dc] hover:bg-ok-50"><Check className="h-3.5 w-3.5 text-[#2c8a5b]" strokeWidth={3} />{l.label}</button>)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

/** one step, open right on the project: back to the list, the lane's path, the step itself */
function StepOpen({ job, k, back, setK }: { job: Job; k: string; back: () => void; setK: (k: string) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const steps = stepsFor(s, job).filter((v) => v.state !== 'na' || v.key === k)
  const lanes = lanesFor(steps)
  const v = steps.find((x) => x.key === k)
  const lane = v ? lanes.find((l) => l.steps.some((x) => x.key === k)) : undefined
  if (!v || !lane) return null
  const n = lanes.indexOf(lane) + 1
  return (
    <div data-panel className="@container">
      <button onClick={back} className="mb-3 inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-[0.84375rem] font-semibold text-brand-700 hover:bg-brand-50"><ChevronLeft className="h-4 w-4" />All steps</button>
      <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <NumMark n={n} state={lane.state} />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.75rem] font-semibold text-muted">Step {n} of {lanes.length} · {lane.label}</span>
            <span className="block truncate text-[1.0625rem] font-semibold leading-tight text-ink">{isDone(v) ? v.label : todoOf(v)}</span>
          </span>
        </div>
        {lane.steps.length > 1 && <StepTabs list={lane.steps} at={v.key} go={(x) => x && setK(x.key)} me={me} />}
        <div className="px-5 pb-5 pt-4 max-sm:px-4"><StepInline key={v.key} job={job} v={v} onClose={back} /></div>
      </div>
    </div>
  )
}

/* ---------------- Installing: the rooms; tap one and its walls and floors open right there ---------------- */
function Rooms({ job, room, setRoom }: { job: Job; room: string | null; setRoom: (r: string | null) => void }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const inField = IN_FIELD.includes(job.stage)
  const [openSf, setOpenSf] = React.useState<string | null>(null)
  const b = s.bookings.find((x) => x.jobId === job.id)
  const startIso = b?.start || s.prep[job.id]?.targetISO
  const start = job.dates?.start || (startIso ? labelFromIso(startIso) : undefined)
  const crew = (job.crew || b?.crew) as PersonKey | undefined
  if (!rooms.length) return <RoomsTab job={job} />
  const r = room ? rooms.find((x) => x.name === room) : undefined
  if (r) {
    const p = roomPct(r)
    const entries = (s.diary[job.id] || []).filter((e) => e.rooms.some((x) => x.room === r.name))
    return (
      <div>
        <button onClick={() => { setRoom(null); setOpenSf(null) }} className="mb-3 inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-[0.84375rem] font-semibold text-brand-700 hover:bg-brand-50"><ChevronLeft className="h-4 w-4" />All rooms</button>
        <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3">
            <Ring pct={inField ? p : 0} size={34} stroke={3.5} tone={p >= 100 ? 'ok' : p > 0 ? 'info' : 'neutral'} />
            <span className="min-w-0 flex-1">
              <span className="block text-[1.0625rem] font-semibold leading-tight text-ink">{r.name}</span>
              <span className="block text-[0.8125rem] text-muted">{inField ? `${p}% installed · ${r.surfaces.filter((x) => x.state === 'done').length} of ${r.surfaces.length} done${entries[0] ? ` · last update ${entries[0].day}` : ''}` : `${r.surfaces.length} walls and floors to install`}</span>
            </span>
            {entries.length > 0 && <Button size="sm" variant="ghost" icon={<FileText />} onClick={() => s.open({ t: 'room', jobId: job.id, room: r.name, view: 'log' })}>Daily log · {entries.length}</Button>}
          </div>
          {r.surfaces.map((x) => {
            const tile = tilesOf(job.id).find((t) => t.tag === x.tile)
            const g = x.grout || tile?.grout
            const on = openSf === x.name
            const waiting = ['blocked', 'waitmat', 'hold', 'unknown'].includes(x.state)
            return (
              <div key={x.name} className="border-b border-line-2 last:border-b-0">
                <button data-surface={x.name} onClick={() => setOpenSf(on ? null : x.name)} aria-expanded={on} className={cn('flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-[#f6f3ee]', on && 'bg-[#f6f3ee]')}>
                  <TileImg tile={tile} size={30} radius={7} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.875rem] font-semibold text-ink">{x.name}<span className="font-normal text-muted"> · {tile ? `${x.tile} ${tile.name}` : x.tile || 'no tile yet'}{g ? ` · ${GROUTS[g]?.name || g} grout` : ''}</span></span>
                    <span className={cn('block truncate text-[0.75rem]', waiting ? 'font-medium text-bad-600' : x.state === 'working' ? 'text-brand-700' : x.state === 'done' ? 'text-[#2c8a5b]' : 'text-muted')}>{x.state === 'working' ? `In progress · ${surfacePct(x)}%` : SURF_LABEL[x.state]}{x.reason ? ` — ${x.reason}` : ''}{x.sf ? ` · ${x.sf} SF` : ''}</span>
                  </span>
                  <ChevronRight className={cn('h-4 w-4 shrink-0 text-faint transition', on && 'rotate-90')} />
                </button>
                {on && <div className="border-t border-line-2 bg-white"><SurfaceDetail job={job} room={r} sf={x} /></div>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {!inField && <div className="rounded-[0.875rem] border border-line bg-white px-4 py-2.5 text-[0.875rem] text-ink-2">{start ? `Starts ${start}${crew ? ` with ${PEOPLE[crew]?.short}` : ''}. These rooms get installed.` : 'No start date yet — it comes with the installer’s PO. These rooms get installed.'}</div>}
      <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
        {rooms.map((x) => {
          const p = roomPct(x)
          const waiting = x.surfaces.filter((y) => ['blocked', 'waitmat', 'hold'].includes(y.state)).length
          return (
            <button key={x.name} data-room={x.name} onClick={() => setRoom(x.name)} className="flex w-full items-center gap-4 border-b border-line-2 px-4 py-3 text-left transition last:border-b-0 hover:bg-[#f6f3ee]">
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[0.9375rem] font-semibold text-ink">{x.name}</span>
                  <span className={cn('shrink-0 text-[0.8125rem] tnum', p >= 100 ? 'text-[#2c8a5b]' : p > 0 ? 'font-semibold text-ink' : 'text-faint')}>{!inField ? `${x.surfaces.length} walls and floors` : p >= 100 ? 'Done' : p > 0 ? `${p}%` : 'Not started'}</span>
                </span>
                {inField && <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#ece7de]"><span className={cn('block h-full rounded-full', p >= 100 ? 'bg-[#2c8a5b]' : waiting ? 'bg-bad-500' : 'bg-brand-600')} style={{ width: `${Math.max(p, p > 0 ? 3 : 0)}%` }} /></span>}
                {waiting > 0 && <span className="mt-1 block text-[0.75rem] font-medium text-bad-600">{waiting} {waiting === 1 ? 'wall or floor' : 'walls and floors'} waiting — {x.surfaces.find((y) => ['blocked', 'waitmat', 'hold'].includes(y.state))?.reason || 'see the room'}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- the right side: the project, the same in every part ---------------- */
export function Box({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4 last:border-b-0 max-sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[0.875rem] font-semibold text-ink">{title}</span>{right}</div>
      {children}
    </section>
  )
}
/** the files kept with a project — plans, paperwork, photos — as pictures you can open, and Add. Documents the
 *  estimate is still missing show as empty tiles to fill. Used on the project and on the estimate. */
export function FilesBox({ jobId, title = 'Files', missing = [], named = [] }: { jobId: string; title?: string; missing?: string[]; named?: string[] }) {
  const s = useStore()
  const save = useSaveStatus()
  const files = s.files.filter((f) => f.jobId === jobId)
  const sample = save.mode === 'sample' && save.where !== 'cloud' ? filesFor(jobId) : []
  const add = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const upload = async (list: File[]) => {
    if (!list.length) return
    setBusy(true)
    const photos = list.filter((f) => f.type.startsWith('image/'))
    const other = list.filter((f) => !f.type.startsWith('image/'))
    if (photos.length) await keepFiles(jobId, photos, 'photo')
    if (other.length) await keepFiles(jobId, other, /plan|drawing|arch/i.test(other[0].name) ? 'plans' : 'other')
    setBusy(false)
  }
  /* documents the estimate says came in, when no file of theirs is kept here (the sample) */
  const names = files.length || sample.length ? [] : named
  const n = files.length + sample.length + names.length
  return (
    <Box title={title} right={<span className="flex items-center gap-1">{n > 0 && <button onClick={() => s.open({ t: 'files', jobId })} className="rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50">All {n}</button>}<button onClick={() => add.current?.click()} disabled={busy} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50"><Upload className="h-3.5 w-3.5" />{busy ? 'Adding…' : 'Add'}</button></span>}>
      <input ref={add} type="file" multiple className="hidden" aria-label={`Add files — ${title}`} onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; void upload(f) }} />
      {n === 0 && !missing.length && <button onClick={() => add.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d6cfc3] py-4 text-[0.8125rem] font-medium text-muted hover:border-brand-300 hover:text-brand-700"><Paperclip className="h-4 w-4" />Plans, paperwork, photos — add them here</button>}
      {(n > 0 || missing.length > 0) && (
        <div className="grid grid-cols-3 gap-2">
          {files.slice(-6).reverse().map((f) => (
            <button key={f.id} onClick={() => void openFile(f)} title={f.name} className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-white text-left transition hover:border-[#cdc7bc]">
              {f.thumb ? <img src={f.thumb} alt="" className="aspect-[4/3] w-full object-cover" /> : <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-wash text-muted"><FileText className="h-6 w-6" /><span className="text-[0.625rem] font-semibold uppercase tracking-wide">{(f.name.split('.').pop() || f.kind).slice(0, 4)}</span></span>}
              <span className="block truncate px-1.5 py-1 text-[0.6875rem] font-medium text-ink-2">{f.name}</span>
            </button>
          ))}
          {files.length < 6 && sample.slice(0, 6 - files.length).map((d) => (
            <button key={d.name} onClick={() => s.open({ t: 'files', jobId })} title={d.name} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-white text-left transition hover:border-[#cdc7bc]">
              <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-wash text-muted"><FileText className="h-6 w-6" /><span className="text-[0.625rem] font-semibold uppercase tracking-wide">{d.kind}</span></span>
              <span className="block truncate px-1.5 py-1 text-[0.6875rem] font-medium text-ink-2">{d.name}</span>
            </button>
          ))}
          {names.map((name) => (
            <button key={'n' + name} onClick={() => s.open({ t: 'files', jobId })} title={name} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-white text-left transition hover:border-[#cdc7bc]">
              <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-wash text-muted"><FileText className="h-6 w-6" /><span className="text-[0.625rem] font-semibold uppercase tracking-wide">In</span></span>
              <span className="block truncate px-1.5 py-1 text-[0.6875rem] font-medium text-ink-2">{name}</span>
            </button>
          ))}
          {missing.map((name) => (
            <button key={'m' + name} onClick={() => add.current?.click()} title={`${name} — missing, add it`} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-dashed border-warn-300 bg-[#fffaf0] text-left transition hover:border-warn-500">
              <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 text-warn-700"><Upload className="h-5 w-5" /><span className="text-[0.625rem] font-semibold uppercase tracking-wide">Missing</span></span>
              <span className="block truncate px-1.5 py-1 text-[0.6875rem] font-medium text-warn-800">{name}</span>
            </button>
          ))}
        </div>
      )}
    </Box>
  )
}

/** the project on the right: the tile and the grout, the files, the messages, the scope — always there */
export function ProjectInfo({ job }: { job: Job }) {
  const s = useStore()
  const me = meOf(s.role)
  const rooms = s.rooms[job.id] || []
  const sf = rooms.flatMap((r) => r.surfaces).reduce((n, x) => n + (x.sf || 0), 0)
  const tiles = tilesOf(job.id)
  const msgs = s.messages[job.id] || []
  const unread = msgs.slice(s.seen?.[`${job.id}|${me}`]?.n || 0).filter((m) => m.who !== me).length
  const money = s.role !== 'site' && s.role !== 'crew'
  const orders = s.pos.filter((p) => p.jobId === job.id).length + s.ipos.filter((p) => p.jobId === job.id).length
  const open = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done').length
  const said = (m: (typeof msgs)[number]) => (m.audio || m.audioPath ? '🎤 Voice note' : m.media?.length || m.photos?.length ? '📷 Photo' : m.text)
  return (
    <div>
      <Box title="Tile and grout" right={tiles.length ? <span className="text-[0.75rem] text-muted">{tiles.length}</span> : undefined}>
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
        }) : <div className="text-[0.8125rem] text-muted">No tile yet — it comes in with the tile paperwork.</div>}
      </Box>
      <FilesBox jobId={job.id} />
      <Box title="Messages" right={unread ? <span className="rounded-full bg-bad-500 px-1.5 text-[0.71875rem] font-bold text-white">{unread} new</span> : undefined}>
        <button onClick={() => s.open({ t: 'chat', jobId: job.id })} className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left transition hover:bg-[#f6f3ee]">
          {msgs.length ? msgs.slice(-2).map((m) => (
            <span key={m.id} className="flex items-start gap-2 py-1">
              <Avatar who={m.who} size={22} />
              <span className="min-w-0 flex-1 text-[0.8125rem] leading-snug"><b className="font-semibold text-ink">{m.who === me ? 'You' : PEOPLE[m.who]?.short || 'Someone'}</b> <span className="text-ink-2">{said(m)}</span><span className="ml-1 text-[0.71875rem] text-faint">{m.time}</span></span>
            </span>
          )) : <span className="block py-1 text-[0.8125rem] text-muted">No messages yet — write to the team, send a photo or a voice note.</span>}
          <span className="mt-1 inline-flex items-center gap-1 text-[0.78125rem] font-semibold text-brand-700"><MessageCircle className="h-3.5 w-3.5" />Open the conversation</span>
        </button>
      </Box>
      <Box title="Scope of work">
        <button onClick={() => s.open({ t: 'scopewin', jobId: job.id })} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#f6f3ee]">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-wash text-muted"><Grid2x2 className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[0.84375rem] font-semibold text-ink">{rooms.length ? `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}` : 'No rooms yet'}</span><span className="block text-[0.75rem] text-muted">Every wall and floor — its tile, grout and layout</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
        </button>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.78125rem] font-semibold text-brand-700">
          {money && <button onClick={() => s.open({ t: 'orderswin', jobId: job.id })} className="inline-flex items-center gap-1 hover:underline"><Package className="h-3.5 w-3.5" />Orders{orders ? ` · ${orders}` : ''}</button>}
          <button onClick={() => s.open({ t: 'whatsopen', jobId: job.id })} className="inline-flex items-center gap-1 hover:underline"><ListTodo className="h-3.5 w-3.5" />Everything open{open ? ` · ${open}` : ''}</button>
          <button onClick={() => s.open({ t: 'history', jobId: job.id })} className="inline-flex items-center gap-1 hover:underline"><History className="h-3.5 w-3.5" />What happened</button>
        </div>
      </Box>
    </div>
  )
}

/* ---------------- the body: the work on the left, the project on the right ---------------- */
export function ProjectBoard({ job, part }: { job: Job; part: Part }) {
  const s = useStore()
  const money = s.role !== 'site' && s.role !== 'crew'
  const pricing = PRICING.includes(job.stage)
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const punchOpen = punch.filter((p) => p.status !== 'verified')
  const canAdd = !['accounting', 'client', 'crew'].includes(s.role)
  /* a step open on the left, or a room — the back arrow brings you back; changing the part closes it */
  const [step, setStep] = React.useState<string | null>(null)
  const [room, setRoom] = React.useState<string | null>(null)
  React.useEffect(() => { setStep(null); setRoom(null) }, [part])
  const top = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { top.current?.scrollTo?.({ top: 0 }) }, [step, room])
  const main = (
    <>
      {part === 'ready' && (pricing
        ? <div className="rounded-[0.875rem] border border-line bg-white px-4 py-8 text-center text-[0.875rem] text-muted">Paperwork, the design meeting, the site, the installer, deliveries, the deposit — the flow starts once the estimate is won.</div>
        : step ? <StepOpen job={job} k={step} back={() => setStep(null)} setK={setStep} /> : <Flow job={job} open={setStep} />)}
      {part === 'install' && <Rooms job={job} room={room} setRoom={setRoom} />}
      {part === 'punch' && (
        <section className="rounded-[0.875rem] border border-line bg-white px-4 pb-4 pt-3">
          {punch.length > 0 && (
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[0.9375rem] font-semibold text-ink">{punchOpen.length ? `${punchOpen.length} open` : 'All checked'}<span className="font-normal text-muted"> · {punch.length} in all</span></span>
              {canAdd && <Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'punchnew', jobId: job.id })}>Add touch-ups</Button>}
            </div>
          )}
          <TouchupsList job={job} />
        </section>
      )}
      {part === 'money' && money && <MoneyTab job={job} />}
    </>
  )
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_22.5rem] max-lg:h-auto max-lg:grid-cols-1">
      <div ref={top} className="scroll-soft min-h-0 min-w-0 border-r border-line bg-[#faf8f5] px-5 py-4 max-lg:border-r-0 max-sm:px-3 lg:overflow-y-auto">{main}</div>
      <aside className="scroll-soft min-h-0 min-w-0 bg-white max-lg:border-t max-lg:border-line lg:overflow-y-auto"><ProjectInfo job={job} /></aside>
    </div>
  )
}

/** the window's footer line: where the money stands (on Billed and paid), else the dates and the client */
export function ProjectFoot({ job, part }: { job: Job; part: Part }) {
  const s = useStore()
  const money = s.role !== 'site' && s.role !== 'crew'
  const pic = money && part === 'money' ? pictureOf(s, job.id) : null
  if (pic && pic.billed > 0) return <span className="inline-flex items-center gap-2 text-[0.84375rem] text-muted"><Receipt className="h-4 w-4 text-faint" />{fmtMoney(pic.paid)} paid of {fmtMoney(pic.contract + pic.changes)} · {fmtMoney(pic.contract + pic.changes - pic.paid)} open</span>
  const dates = job.dates?.start ? `${job.dates.start} – ${job.dates.finish || '…'}` : ''
  return <span className="inline-flex min-w-0 items-center gap-2 text-[0.84375rem] text-muted"><CalendarDays className="h-4 w-4 shrink-0 text-faint" /><span className="truncate">{dates || 'No dates yet'}</span><Building2 className="ml-2 h-4 w-4 shrink-0 text-faint" /><span className="truncate">{job.client}</span></span>
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
