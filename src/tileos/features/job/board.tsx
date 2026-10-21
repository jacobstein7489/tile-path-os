/* The project, like the estimate: a track on top with its four parts as rings — how far each one is, in one look —
 * and under it the part you're on, in full. Getting ready is the flow, one line per lane (the paperwork, the
 * underlayment, the meeting… the installer, the tile from the store, our materials, the deposit): each line says which
 * step it's on and whose turn it is, and a lane with a few steps shows them as dots. Tap a line and the step opens
 * beside the list (on a desktop) or over it (on a phone). Installing is the rooms, Touch-ups the list, Billed and
 * paid the money. The scope, the files, the messages are one tap under the track. */
import * as React from 'react'
import { X, Check, Play, Plus, Grid2x2, Paperclip, MessageCircle, Package, History } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { roomPct } from '@/tileos/data/jobs'
import { Ring } from '@/tileos/components/ui/progress'
import { TODAY, labelFromIso } from '@/tileos/lib/today'
import { isGettingReady, stepsFor, stepCounts, lanesFor, type StepView, type LaneView } from '../steps'
import { StepIcon } from '../steps-ui'
import { StepInline, StepTabs, todoOf } from '../stepwin'
import { unreadOf } from '../messages'
import { tilesOf } from '@/tileos/data/jobs'
import { pictureOf } from '../progressbill'
import { startProject } from '../flows'
import { RoomsTab, RoomPanel } from './rooms'
import { MoneyTab } from './money-tab'
import { TouchupsList } from '../touchups'
import { firstName } from './kit'

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
type PartView = { key: Part; label: string; short: string; pct: number; state: PartState; sub: string; subShort: string }

/* ---------------- one ring: how far a part is ---------------- */
const RING: Record<PartState, string> = { done: '#2c8a5b', now: '#2650cf', later: '#c9c3b8', bad: '#d7342a' }
function PartRing({ pct, state, size }: { pct: number; state: PartState; size: number }) {
  const stroke = size >= 48 ? 4.5 : 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const fill = state === 'done' ? 100 : Math.max(0, Math.min(100, pct))
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={state === 'bad' ? '#f3d3cf' : '#e9e4db'} strokeWidth={stroke} />
        {fill > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING[state]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * fill) / 100} ${c}`} className="transition-[stroke-dasharray] duration-500" />}
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center font-bold tnum', size >= 48 ? 'text-[0.78125rem]' : 'text-[0.6875rem]', state === 'done' ? 'text-[#2c8a5b]' : state === 'bad' ? 'text-bad-600' : state === 'now' ? 'text-ink' : 'text-faint')}>
        {state === 'done' ? <Check className={size >= 48 ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={3} /> : state === 'later' && !pct ? '–' : `${Math.round(pct)}%`}
      </span>
    </span>
  )
}

/** the track: the four parts, joined by a line, the one you're on marked */
function Track({ parts, at, onPick }: { parts: PartView[]; at: Part; onPick: (p: Part) => void }) {
  return (
    <ol aria-label="The project, part by part" className="grid items-start" style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))` }}>
      {parts.map((p, i) => {
        const on = p.key === at
        const prevDone = i > 0 && parts[i - 1].state === 'done'
        return (
          <li key={p.key} className="relative flex min-w-0 flex-col items-center">
            {i > 0 && <span className={cn('absolute top-[1.375rem] h-[0.125rem] rounded-full', prevDone ? 'bg-[#2c8a5b]' : 'bg-[#e5e0d7]')} style={{ left: 'calc(-50% + 2.25rem)', right: 'calc(50% + 2.25rem)' }} />}
            <button onClick={() => onPick(p.key)} aria-current={on ? 'step' : undefined} aria-label={`${p.label} — ${p.sub}`} className={cn('group relative z-[1] flex w-full max-w-[13rem] flex-col items-center rounded-xl px-2 pb-1.5 pt-1 text-center transition max-sm:px-0.5', on ? 'bg-white shadow-[0_0.0625rem_0.1875rem_rgba(28,26,22,.08)] ring-1 ring-[#e9e4db]' : 'hover:bg-white/70')}>
              <span className="max-sm:hidden"><PartRing pct={p.pct} state={p.state} size={48} /></span>
              <span className="sm:hidden"><PartRing pct={p.pct} state={p.state} size={44} /></span>
              <span className={cn('mt-1 max-w-full truncate text-[0.875rem] font-semibold max-sm:text-[0.75rem]', on ? 'text-ink' : p.state === 'later' ? 'text-muted' : 'text-ink-2')}><span className="max-sm:hidden">{p.label}</span><span className="sm:hidden">{p.short}</span></span>
              <span className={cn('mt-0.5 max-w-full truncate text-[0.75rem] max-sm:text-[0.6875rem]', p.state === 'bad' ? 'font-semibold text-bad-600' : p.state === 'done' ? 'text-[#2c8a5b]' : p.state === 'now' ? 'text-ink-2' : 'text-faint')}><span className="max-sm:hidden">{p.sub}</span><span className="sm:hidden">{p.subShort}</span></span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------------- the flow: one numbered line per step ---------------- */
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

/** the step's number in a circle: a check when it's done, an ! when it's a problem, blue when it's someone's turn */
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

/** one line of the flow: the number, the lane, the word on the right — and under it the step it's on, or the problem */
function LaneLine({ n, lane, me, on, onClick, past }: { n: number; lane: LaneView; me: PersonKey; on?: boolean; onClick: () => void; past?: boolean }) {
  const at = lane.at
  const state = past ? 'done' : lane.state
  const w = past ? { text: 'Done', tone: 'ok' } : lane.state === 'done' ? { text: at.doneOn ? `Done ${at.doneOn}` : 'Done', tone: 'ok' } : stepWord(at, me)
  /* the step the lane is on, when it isn't the lane itself (the installer lane on "Show him the job") */
  const sub = lane.steps.length > 1 && at.short.toLowerCase() !== lane.label.toLowerCase() ? at.short : ''
  /* what's going on in the lane, in a few words: the problem, the wait, or the step it's on */
  const note = past || state === 'done' || state === 'later' ? '' : [sub, at.note || ''].filter(Boolean).join(at.state === 'bad' || at.state === 'wait' ? ' — ' : ' · ')
  const muted = past || state === 'done'
  return (
    <button data-lane={lane.key} data-step={at.key} data-has={lane.steps.map((x) => x.key).join(' ')} onClick={onClick} aria-current={on ? 'true' : undefined} className={cn('flex w-full items-center gap-3 border-l-[0.1875rem] px-3 py-[0.3125rem] text-left transition max-sm:py-2 [@media(max-height:900px)]:py-[0.25rem]', on ? 'border-brand-600 bg-brand-50/70' : 'border-transparent hover:bg-[#f6f3ee]')}>
      <NumMark n={n} state={state} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[0.875rem] leading-[1.25rem]', muted ? 'text-ink-2' : state === 'later' ? 'text-muted' : 'font-medium text-ink')}>{lane.label}{!past && <Dots steps={lane.steps} />}</span>
        {note && <span className={cn('block truncate text-[0.75rem] leading-[1rem]', w.tone === 'bad' ? 'text-bad-600' : 'text-muted')}>{note.replace(/ — $/, '')}</span>}
      </span>
      <span className={cn('shrink-0 text-[0.78125rem] tnum', TONE[w.tone] || TONE.plain)}>{w.text}</span>
    </button>
  )
}

/** under the track: the scope, the files, the messages, the orders, everything that happened — one tap each */
function Links({ job }: { job: Job }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const sf = rooms.flatMap((r) => r.surfaces).reduce((n, x) => n + (x.sf || 0), 0)
  const tiles = tilesOf(job.id).length
  const files = s.files.filter((f) => f.jobId === job.id).length
  const unread = unreadOf(s, job.id)
  const orders = s.pos.filter((p) => p.jobId === job.id).length + s.ipos.filter((p) => p.jobId === job.id).length
  const money = s.role !== 'site' && s.role !== 'crew'
  const item = (icon: React.ReactNode, label: string, sub: string | undefined, on: () => void, hot?: boolean) => (
    <button key={label} onClick={on} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-[0.8125rem] font-semibold text-ink-2 transition hover:bg-white hover:text-ink">
      <span className="text-faint [&>svg]:h-[0.875rem] [&>svg]:w-[0.875rem]">{icon}</span>{label}{sub && <span className={cn('font-normal', hot ? 'font-semibold text-brand-700' : 'text-muted')}>{sub}</span>}
    </button>
  )
  return (
    <div className="no-scrollbar -mx-1 mt-1.5 flex items-center gap-x-2 overflow-x-auto px-1 max-sm:gap-x-1">
      {item(<Grid2x2 />, 'Scope of work', rooms.length ? `· ${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}${tiles ? ` · ${tiles} ${tiles === 1 ? 'tile' : 'tiles'}` : ''}` : '· nothing yet', () => s.open({ t: 'scopewin', jobId: job.id }))}
      {item(<Paperclip />, 'Files and photos', files ? `· ${files}` : undefined, () => s.open({ t: 'files', jobId: job.id }))}
      {item(<MessageCircle />, 'Messages', unread ? `· ${unread} new` : undefined, () => s.open({ t: 'chat', jobId: job.id }), unread > 0)}
      {money && item(<Package />, 'Orders', orders ? `· ${orders}` : undefined, () => s.open({ t: 'orderswin', jobId: job.id }))}
      {item(<History />, 'What happened', undefined, () => s.open({ t: 'history', jobId: job.id }))}
    </div>
  )
}

/* ---------------- the board ---------------- */
export function ProjectBoard({ job, part0 }: { job: Job; part0?: string }) {
  const s = useStore()
  const me = meOf(s.role)
  const wide = useWide()
  const money = s.role !== 'site' && s.role !== 'crew'
  const pricing = PRICING.includes(job.stage)
  const ready = isGettingReady(job)
  const inField = IN_FIELD.includes(job.stage)
  const past = !ready && !pricing
  /* past getting ready the steps still show (all done): when each thing happened is part of the picture */
  const steps = pricing ? [] : stepsFor(s, job).filter((v) => v.state !== 'na')
  const lanes = lanesFor(steps)
  const c = stepCounts(steps)
  const b = s.bookings.find((x) => x.jobId === job.id)
  const crew = (job.crew || b?.crew) as PersonKey | undefined
  const startIso = b?.start || s.prep[job.id]?.targetISO
  const start = job.dates?.start || (startIso ? labelFromIso(startIso) : undefined)
  const lateStart = !inField && !pricing && !!startIso && startIso < TODAY
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const punchOpen = punch.filter((p) => p.status !== 'verified')
  const pic = money ? pictureOf(s, job.id) : null
  const pct = job.pct ?? 0
  const allDone = c.total > 0 && c.done === c.total
  const lDone = lanes.filter((l) => l.state === 'done').length

  const parts: PartView[] = [
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
  const [part, setPart] = React.useState<Part>(() => (part0 && parts.some((p) => p.key === part0) ? (part0 as Part) : s.role === 'accounting' && parts.some((p) => p.key === 'money') ? 'money' : partOf(job)))
  /* the step open beside the list: the one that's yours now, else whoever's turn it is */
  const [focus, setFocus] = React.useState<string | null>(null)
  const rooms = s.rooms[job.id] || []
  /* the room open beside the list: the one being worked on, else the first that isn't done */
  const [room, setRoom] = React.useState<string | undefined>(() => (rooms.find((r) => r.surfaces.some((x) => x.state === 'working')) || rooms.find((r) => roomPct(r) < 100) || rooms[0])?.name)
  const auto = steps.find((v) => (v.state === 'now' || v.state === 'bad') && v.owner === me) || steps.find((v) => v.state === 'now' || v.state === 'bad') || steps.find((v) => v.state === 'wait')
  const focused = (focus ? steps.find((v) => v.key === focus) : undefined) || (focus ? undefined : auto)
  const focusedLane = focused ? lanes.find((l) => l.steps.some((x) => x.key === focused.key)) : undefined
  const open = (k: string) => { if (wide) setFocus(k); else s.open({ t: 'step', jobId: job.id, k }) }
  const tasks = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done' && !t.title.startsWith('Touch-ups at') && !t.step)
  const canAdd = !['accounting', 'client', 'crew'].includes(s.role)

  return (
    <div className="flex min-h-0 flex-col">
      <Track parts={parts} at={part} onPick={setPart} />
      <Links job={job} />

      {/* ---- Getting ready: the flow, and the step you're on ---- */}
      {part === 'ready' && (
        pricing ? (
          <div className="mt-3 rounded-[0.875rem] border border-[#ebe6dd] bg-white px-4 py-8 text-center text-[0.875rem] text-muted">Paperwork, the design meeting, the site, the installer, deliveries, the deposit — the flow starts once the estimate is won.</div>
        ) : (
          <div className={cn('mt-3 grid min-h-0 gap-3', wide && 'grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]')}>
            <section className="min-w-0 overflow-hidden rounded-[0.875rem] border border-[#ebe6dd] bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-line-2 px-4 py-2">
                <span className="text-[0.9375rem] font-semibold text-ink">The flow</span>
                <span className={cn('text-[0.78125rem]', c.bad ? 'font-semibold text-bad-600' : 'text-muted')}>{past ? 'All done' : parts[0].sub}</span>
              </div>
              <div className="py-1.5">
                {lanes.map((l, i) => <LaneLine key={l.key} n={i + 1} lane={l} me={me} past={past} on={wide && focusedLane?.key === l.key} onClick={() => open(l.at.key)} />)}
                {tasks.length > 0 && (
                  <>
                    <div className="px-4 pb-0.5 pt-3 text-[0.71875rem] font-semibold text-faint">Also on this project</div>
                    {tasks.map((t) => (
                      <button key={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full items-center gap-3 border-l-[0.1875rem] border-transparent px-3 py-[0.4375rem] text-left transition hover:bg-[#f6f3ee]">
                        <StepIcon state={t.tone === 'bad' ? 'bad' : t.state === 'waiting' ? 'wait' : 'now'} size={22} />
                        <span className="min-w-0 flex-1"><span className="block truncate text-[0.875rem] font-medium text-ink">{t.title}</span>{t.tone === 'bad' ? <span className="block truncate text-[0.75rem] text-bad-600">{t.detail?.split('\n')[0]}</span> : t.state === 'waiting' ? <span className="block truncate text-[0.75rem] text-muted">Waiting on {t.waitingOn}</span> : null}</span>
                        <span className={cn('shrink-0 text-[0.78125rem]', t.owner === me ? 'font-semibold text-brand-700' : 'text-ink-2')}>{t.owner === me ? 'You' : firstName(t.owner) || PEOPLE[t.owner]?.short}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
              {!wide && !past && allDone && ['ready', 'scheduled'].includes(job.stage) && <div className="border-t border-line-2 px-3 py-2"><Button size="sm" variant="primary" className="w-full" icon={<Play />} onClick={() => startProject(job.id)}>Start the job</Button></div>}
            </section>

            {wide && (
              <aside data-panel className="@container flex min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-[0.875rem] border border-[#ebe6dd] bg-white">
                {focused ? (
                  <>
                    <div className="flex shrink-0 items-center gap-2.5 border-b border-line-2 py-2.5 pl-4 pr-2">
                      <StepIcon state={past ? 'done' : focused.state} size={22} />
                      <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{isDone(focused) || past ? focused.label : todoOf(focused)}</span>
                      {focus && <button onClick={() => setFocus(null)} aria-label="Close the step" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-wash hover:text-ink"><X className="h-4 w-4" /></button>}
                    </div>
                    {focusedLane && focusedLane.steps.length > 1 && <StepTabs list={focusedLane.steps} at={focused.key} go={(x) => x && setFocus(x.key)} me={me} />}
                    <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-3">
                      <StepInline key={focused.key} job={job} v={focused} onClose={() => setFocus(null)} />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                    <StepIcon state="done" size={40} />
                    <div className="mt-3 text-[1rem] font-semibold text-ink">{past ? 'Getting ready is done' : allDone ? 'Every step is done' : 'Nothing waiting on anyone'}</div>
                    <div className="mt-1 max-w-[20rem] text-[0.84375rem] text-muted">{past ? `The crew started${job.dates?.start ? ` ${job.dates.start}` : ''}. Tap a step to see when it happened.` : allDone ? (start ? `The job is set to start ${start}${crew ? ` with ${PEOPLE[crew]?.short}` : ''}.` : 'Pick the start date and start the job.') : 'Tap a step on the left to see it.'}</div>
                    {!past && allDone && ['ready', 'scheduled'].includes(job.stage) && <Button className="mt-4" variant="primary" icon={<Play />} onClick={() => startProject(job.id)}>Start the job</Button>}
                  </div>
                )}
              </aside>
            )}
          </div>
        )
      )}

      {/* ---- Installing: the rooms, and the one you tapped ---- */}
      {part === 'install' && (
        <div className="mt-3 min-w-0">
          {!inField && (
            <div className={cn('mb-3 rounded-[0.875rem] border bg-white px-4 py-2.5 text-[0.875rem]', lateStart ? 'border-bad-200 text-bad-700' : 'border-[#ebe6dd] text-ink-2')}>
              {lateStart ? `It was to start ${start} — it hasn’t.` : start ? `Starts ${start}${crew ? ` with ${PEOPLE[crew]?.short}` : ''}. These rooms get installed.` : 'No start date yet — it comes with the installer’s PO. These rooms get installed.'}
            </div>
          )}
          {rooms.length ? (
            <div className={cn('grid min-h-0 gap-3', wide && 'grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]')}>
              <section className="min-w-0 self-start overflow-hidden rounded-[0.875rem] border border-[#ebe6dd] bg-white">
                <div className="flex items-center justify-between gap-2 border-b border-line-2 px-4 py-2.5">
                  <span className="text-[0.9375rem] font-semibold text-ink">Rooms</span>
                  <span className="text-[0.78125rem] text-muted">{inField ? `${pct}% installed · ${rooms.filter((r) => roomPct(r) >= 100).length} of ${rooms.length} done` : `${rooms.length}`}</span>
                </div>
                <div className="py-1.5">
                  {rooms.map((r) => {
                    const p = roomPct(r)
                    const waiting = r.surfaces.filter((x) => ['blocked', 'waitmat', 'hold'].includes(x.state)).length
                    const on = wide && room === r.name
                    return (
                      <button key={r.name} data-room={r.name} onClick={() => (wide ? setRoom(r.name) : s.open({ t: 'room', jobId: job.id, room: r.name }))} aria-current={on ? 'true' : undefined} className={cn('flex w-full items-center gap-3 border-l-[0.1875rem] px-3 py-[0.4375rem] text-left transition', on ? 'border-brand-600 bg-brand-50/70' : 'border-transparent hover:bg-[#f6f3ee]')}>
                        <Ring pct={inField ? p : 0} size={22} stroke={3} tone={p >= 100 ? 'ok' : waiting ? 'bad' : p > 0 ? 'info' : 'neutral'} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.875rem] font-medium leading-[1.25rem] text-ink">{r.name}</span>
                          <span className={cn('block truncate text-[0.75rem] leading-[1rem]', waiting ? 'text-bad-600' : 'text-muted')}>{waiting ? `${waiting} ${waiting === 1 ? 'surface' : 'surfaces'} waiting` : `${r.surfaces.length} ${r.surfaces.length === 1 ? 'surface' : 'surfaces'}${inField ? ` · ${r.surfaces.filter((x) => x.state === 'done').length} done` : ''}`}</span>
                        </span>
                        <span className={cn('shrink-0 text-[0.78125rem] tnum', p >= 100 ? 'text-[#2c8a5b]' : p > 0 ? 'font-semibold text-ink' : 'text-faint')}>{!inField ? '' : p >= 100 ? 'Done' : p > 0 ? `${p}%` : 'Not started'}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
              {wide && <aside data-panel className="flex min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-[0.875rem] border border-[#ebe6dd] bg-white"><RoomPanel key={room} job={job} room={room} /></aside>}
            </div>
          ) : <RoomsTab job={job} />}
        </div>
      )}

      {/* ---- Touch-ups ---- */}
      {part === 'punch' && (
        <section className="mt-3 min-w-0 rounded-[0.875rem] border border-[#ebe6dd] bg-white px-4 pb-4 pt-3">
          {punch.length > 0 && (
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[0.9375rem] font-semibold text-ink">{punchOpen.length ? `${punchOpen.length} open` : 'All checked'}<span className="font-normal text-muted"> · {punch.length} in all</span></span>
              {canAdd && <Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'punchnew', jobId: job.id })}>Add touch-ups</Button>}
            </div>
          )}
          <TouchupsList job={job} />
        </section>
      )}

      {/* ---- Billed and paid ---- */}
      {part === 'money' && money && <div className="mt-3 min-w-0"><MoneyTab job={job} /></div>}
    </div>
  )
}

/** a desktop-sized window — the step opens beside the list; on a phone it opens over it */
function useWide() {
  const [wide, setWide] = React.useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true))
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const f = () => setWide(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return wide
}
