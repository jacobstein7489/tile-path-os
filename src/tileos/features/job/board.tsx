/* The project, in the same shape as the estimate: the header carries its four parts as rings (Getting ready,
 * Installing, Touch-ups, Billed and paid — how far each one is, in one look), the main column is the part you're on,
 * and the right side is the project — who's on it, the client, the dates, the scope, the files, the messages — until
 * you tap something: then the right side is that thing (a step with its lane's path on top, a room with its
 * surfaces). One shape for every part; nothing nested. On a phone the step opens over the list. */
import * as React from 'react'
import { X, Check, Plus, Grid2x2, Paperclip, MessageCircle, Package, History, ListTodo, ChevronRight, Building2, CalendarDays, HardHat, Receipt } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { roomPct, tilesOf } from '@/tileos/data/jobs'
import { Ring } from '@/tileos/components/ui/progress'
import { TODAY, labelFromIso, md } from '@/tileos/lib/today'
import { isGettingReady, stepsFor, stepCounts, lanesFor, type StepView, type LaneView } from '../steps'
import { StepIcon } from '../steps-ui'
import { StepInline, StepTabs, todoOf } from '../stepwin'
import { unreadOf } from '../messages'
import { pictureOf } from '../progressbill'
import { installerOf } from '../upcoming'
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
  const stroke = size >= 44 ? 4 : 3.5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const fill = state === 'done' ? 100 : Math.max(0, Math.min(100, pct))
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={state === 'bad' ? '#f3d3cf' : '#e9e4db'} strokeWidth={stroke} />
        {fill > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING[state]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * fill) / 100} ${c}`} className="transition-[stroke-dasharray] duration-500" />}
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center font-bold tnum', size >= 44 ? 'text-[0.75rem]' : 'text-[0.6875rem]', state === 'done' ? 'text-[#2c8a5b]' : state === 'bad' ? 'text-bad-600' : state === 'now' ? 'text-ink' : 'text-faint')}>
        {state === 'done' ? <Check className={size >= 44 ? 'h-[1.125rem] w-[1.125rem]' : 'h-4 w-4'} strokeWidth={3} /> : state === 'later' && !pct ? '–' : `${Math.round(pct)}%`}
      </span>
    </span>
  )
}

/** the track in the header: the four parts, joined by a line — the same place the estimate has its path */
export function Track({ parts, at, onPick, className }: { parts: PartView[]; at: Part; onPick: (p: Part) => void; className?: string }) {
  return (
    <ol aria-label="The project, part by part" className={cn('grid items-start', className)} style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))` }}>
      {parts.map((p, i) => {
        const on = p.key === at
        const prevDone = i > 0 && parts[i - 1].state === 'done'
        return (
          <li key={p.key} className="relative flex min-w-0 flex-col items-center">
            {i > 0 && <span className={cn('absolute top-[1.3125rem] h-[0.125rem] rounded-full', prevDone ? 'bg-[#2c8a5b]' : 'bg-[#e5e0d7]')} style={{ left: 'calc(-50% + 2.125rem)', right: 'calc(50% + 2.125rem)' }} />}
            <button onClick={() => onPick(p.key)} aria-current={on ? 'step' : undefined} aria-label={`${p.label} — ${p.sub}`} className={cn('group relative z-[1] flex w-full max-w-[13rem] flex-col items-center rounded-xl px-2 pb-1.5 pt-1 text-center transition max-sm:px-0.5', on ? 'bg-[#f6f3ee] ring-1 ring-[#e9e4db]' : 'hover:bg-[#f6f3ee]/70')}>
              <span className="max-sm:hidden"><PartRing pct={p.pct} state={p.state} size={44} /></span>
              <span className="sm:hidden"><PartRing pct={p.pct} state={p.state} size={40} /></span>
              <span className={cn('mt-1 max-w-full truncate text-[0.84375rem] font-semibold max-sm:text-[0.75rem]', on ? 'text-ink' : p.state === 'later' ? 'text-muted' : 'text-ink-2')}><span className="max-sm:hidden">{p.label}</span><span className="sm:hidden">{p.short}</span></span>
              <span className={cn('mt-0.5 max-w-full truncate text-[0.75rem] max-sm:text-[0.6875rem]', p.state === 'bad' ? 'font-semibold text-bad-600' : p.state === 'done' ? 'text-[#2c8a5b]' : p.state === 'now' ? 'text-ink-2' : 'text-faint')}><span className="max-sm:hidden">{p.sub}</span><span className="sm:hidden">{p.subShort}</span></span>
            </button>
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
    <button data-lane={lane.key} data-step={at.key} data-has={lane.steps.map((x) => x.key).join(' ')} onClick={onClick} aria-current={on ? 'true' : undefined} className={cn('flex w-full items-center gap-3 border-b border-line-2 border-l-[0.1875rem] px-3 py-2 text-left transition last:border-b-0', on ? 'border-l-brand-600 bg-brand-50/70' : 'border-l-transparent hover:bg-[#f6f3ee]')}>
      <NumMark n={n} state={state} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[0.875rem] leading-[1.25rem]', muted ? 'text-ink-2' : state === 'later' ? 'text-muted' : 'font-medium text-ink')}>{lane.label}{!past && <Dots steps={lane.steps} />}</span>
        {note && <span className={cn('block truncate text-[0.75rem] leading-[1rem]', w.tone === 'bad' ? 'text-bad-600' : 'text-muted')}>{note.replace(/ — $/, '')}</span>}
      </span>
      <span className={cn('shrink-0 text-[0.78125rem] tnum', TONE[w.tone] || TONE.plain)}>{w.text}</span>
    </button>
  )
}

/* ---------------- the right side: the project ---------------- */
function SideRow({ icon, label, sub, on, hot }: { icon: React.ReactNode; label: string; sub?: string; on: () => void; hot?: boolean }) {
  return (
    <button onClick={on} className="flex w-full items-center gap-3 border-b border-line-2 py-2.5 text-left transition last:border-b-0 hover:bg-[#f6f3ee]">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5625rem] bg-wash text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-semibold text-ink">{label}</span>
        {sub && <span className={cn('block truncate text-[0.78125rem]', hot ? 'font-semibold text-brand-700' : 'text-muted')}>{sub}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
    </button>
  )
}
function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-line-2 py-2 last:border-b-0">
      <dt className="w-[5.5rem] shrink-0 text-[0.8125rem] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-[0.84375rem] text-ink">{children}</dd>
    </div>
  )
}
/** who's on the project: the office, the site manager, the installer — like "Who does what" on an estimate */
function OnIt({ job }: { job: Job }) {
  const s = useStore()
  const me = meOf(s.role)
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const steps = isGettingReady(job) ? stepsFor(s, job) : []
  const owners = Array.from(new Set(steps.filter((v) => v.state === 'now' || v.state === 'bad' || v.state === 'wait').map((v) => v.owner)))
  const slots: { label: string; who?: PersonKey; on?: () => void }[] = [
    { label: 'Runs it', who: (job.pm as PersonKey) || 'ys' },
    { label: 'Site manager', who: (job.site as PersonKey) || (s.team.find((m) => m.role === 'site' && m.status !== 'off')?.key as PersonKey | undefined) },
    { label: 'Installer', who: crew, on: crew ? () => s.open({ t: 'installerwin', jobId: job.id }) : undefined },
  ]
  return (
    <div className="grid gap-2">
      {slots.map((x) => {
        const body = (
          <span className={cn('flex w-full items-center gap-2.5 rounded-[0.6875rem] border px-2.5 py-2 text-left', x.who && owners.includes(x.who) ? 'border-brand-300 bg-brand-50' : 'border-line bg-white')}>
            {x.who ? <Avatar who={x.who} size={28} /> : <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wash text-faint"><HardHat className="h-3.5 w-3.5" /></span>}
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[0.71875rem] font-semibold text-muted">{x.label}{x.who && owners.includes(x.who) && <span className="ml-1.5 text-brand-700">· has a step now</span>}</span>
              <span className="block truncate text-[0.84375rem] font-semibold text-ink">{x.who ? (x.who === me ? `${PEOPLE[x.who]?.name} (you)` : PEOPLE[x.who]?.name) : 'Nobody yet'}</span>
            </span>
          </span>
        )
        return x.on ? <button key={x.label} onClick={x.on} className="block w-full">{body}</button> : <div key={x.label}>{body}</div>
      })}
    </div>
  )
}
/** the project on the right side: who's on it, the client, the dates, the deposit — and everything else, one row each */
export function ProjectInfo({ job }: { job: Job }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const sf = rooms.flatMap((r) => r.surfaces).reduce((n, x) => n + (x.sf || 0), 0)
  const tiles = tilesOf(job.id).length
  const files = s.files.filter((f) => f.jobId === job.id).length
  const unread = unreadOf(s, job.id)
  const orders = s.pos.filter((p) => p.jobId === job.id).length + s.ipos.filter((p) => p.jobId === job.id).length
  const money = s.role !== 'site' && s.role !== 'crew'
  const b = s.bookings.find((x) => x.jobId === job.id)
  const dates = job.dates?.start ? `${job.dates.start} – ${job.dates.finish || '…'}` : b ? `${md(b.start)} – ${md(b.end)}` : s.prep[job.id]?.targetISO ? `Wants ${labelFromIso(s.prep[job.id].targetISO!)}` : 'No dates yet'
  const dep = s.money.find((m) => m.jobId === job.id && m.kind === 'deposit')
  const open = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done').length
  return (
    <div className="px-6 py-5 max-sm:px-4">
      <div className="mb-2 text-[0.8125rem] font-medium text-muted">Who’s on it</div>
      <OnIt job={job} />
      <dl className="mt-4">
        <Prop label="Client"><button onClick={() => s.open({ t: 'customer', id: job.clientId })} className="font-medium text-brand-700 hover:underline">{job.client}</button></Prop>
        <Prop label="Address">{job.address}</Prop>
        <Prop label="Dates">{dates}</Prop>
        {money && dep && <Prop label="Deposit"><button onClick={() => s.open({ t: 'money', id: dep.id })} className={cn('font-medium hover:underline', dep.state === 'paid' ? 'text-[#2c8a5b]' : dep.step >= 1 ? 'text-warn-700' : 'text-ink-2')}>{fmtMoney(dep.amount || 0)} · {dep.state === 'paid' ? `paid${dep.date ? ' ' + dep.date : ''}` : dep.step >= 1 ? 'invoiced, not paid' : 'not invoiced'}</button></Prop>}
      </dl>
      <div className="mt-4 border-t border-line-2">
        <SideRow icon={<Grid2x2 />} label="Scope of work" sub={rooms.length ? `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}${tiles ? ` · ${tiles} ${tiles === 1 ? 'tile' : 'tiles'} and their grout` : ''}` : 'Rooms, walls and floors, tiles and grout'} on={() => s.open({ t: 'scopewin', jobId: job.id })} />
        <SideRow icon={<Paperclip />} label="Files and photos" sub={files ? `${files}` : 'Plans, paperwork, pictures'} on={() => s.open({ t: 'files', jobId: job.id })} />
        <SideRow icon={<MessageCircle />} label="Messages" sub={unread ? `${unread} new` : 'With the team on this project'} hot={unread > 0} on={() => s.open({ t: 'chat', jobId: job.id })} />
        {money && <SideRow icon={<Package />} label="Orders" sub={orders ? `${orders}` : 'Tile, materials, the installer’s PO'} on={() => s.open({ t: 'orderswin', jobId: job.id })} />}
        <SideRow icon={<ListTodo />} label="Everything open" sub={open ? `${open} open — mine, everyone’s, done` : 'Mine, everyone’s, done'} on={() => s.open({ t: 'whatsopen', jobId: job.id })} />
        <SideRow icon={<History />} label="What happened" sub="Every change, by whom, when" on={() => s.open({ t: 'history', jobId: job.id })} />
      </div>
    </div>
  )
}

/* ---------------- the body: the part on the left, the thing you tapped (or the project) on the right ---------------- */
export function ProjectBoard({ job, part }: { job: Job; part: Part }) {
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
  const lDone = lanes.filter((l) => l.state === 'done').length
  const b = s.bookings.find((x) => x.jobId === job.id)
  const crew = (job.crew || b?.crew) as PersonKey | undefined
  const startIso = b?.start || s.prep[job.id]?.targetISO
  const start = job.dates?.start || (startIso ? labelFromIso(startIso) : undefined)
  const lateStart = !inField && !pricing && !!startIso && startIso < TODAY
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const punchOpen = punch.filter((p) => p.status !== 'verified')
  const pct = job.pct ?? 0
  /* the step open on the right: the one you tapped — until then, the project */
  const [focus, setFocus] = React.useState<string | null>(null)
  React.useEffect(() => { setFocus(null) }, [part])
  const rooms = s.rooms[job.id] || []
  /* the room on the right: the one being worked on, else the first that isn't done */
  const [room, setRoom] = React.useState<string | undefined>(() => (rooms.find((r) => r.surfaces.some((x) => x.state === 'working')) || rooms.find((r) => roomPct(r) < 100) || rooms[0])?.name)
  const focused = focus ? steps.find((v) => v.key === focus) : undefined
  const focusedLane = focused ? lanes.find((l) => l.steps.some((x) => x.key === focused.key)) : undefined
  const open = (k: string) => { if (wide) setFocus(k); else s.open({ t: 'step', jobId: job.id, k }) }
  const tasks = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done' && !t.title.startsWith('Touch-ups at') && !t.step)
  const canAdd = !['accounting', 'client', 'crew'].includes(s.role)

  const main = (
    <>
      {part === 'ready' && (
        pricing ? (
          <div className="rounded-[0.875rem] border border-line bg-white px-4 py-8 text-center text-[0.875rem] text-muted">Paperwork, the design meeting, the site, the installer, deliveries, the deposit — the flow starts once the estimate is won.</div>
        ) : (
          <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <span className="text-[0.9375rem] font-semibold text-ink">The flow</span>
              <span className={cn('text-[0.78125rem]', c.bad ? 'font-semibold text-bad-600' : 'text-muted')}>{past ? 'All done' : c.bad ? `${lDone} of ${lanes.length} done · ${c.bad} ${c.bad === 1 ? 'problem' : 'problems'}` : `${lDone} of ${lanes.length} done`}</span>
            </div>
            <div>
              {lanes.map((l, i) => <LaneLine key={l.key} n={i + 1} lane={l} me={me} past={past} on={wide && focusedLane?.key === l.key} onClick={() => open(l.at.key)} />)}
            </div>
            {tasks.length > 0 && (
              <div className="border-t border-line">
                <div className="bg-[#faf8f5] px-4 py-1.5 text-[0.71875rem] font-semibold text-muted">Also on this project</div>
                {tasks.map((t) => (
                  <button key={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full items-center gap-3 border-t border-line-2 px-3 py-2 text-left transition hover:bg-[#f6f3ee]">
                    <StepIcon state={t.tone === 'bad' ? 'bad' : t.state === 'waiting' ? 'wait' : 'now'} size={22} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[0.875rem] font-medium text-ink">{t.title}</span>{t.tone === 'bad' ? <span className="block truncate text-[0.75rem] text-bad-600">{t.detail?.split('\n')[0]}</span> : t.state === 'waiting' ? <span className="block truncate text-[0.75rem] text-muted">Waiting on {t.waitingOn}</span> : null}</span>
                    <span className={cn('shrink-0 text-[0.78125rem]', t.owner === me ? 'font-semibold text-brand-700' : 'text-ink-2')}>{t.owner === me ? 'You' : firstName(t.owner) || PEOPLE[t.owner]?.short}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      )}

      {part === 'install' && (
        <>
          {!inField && (
            <div className={cn('mb-3 rounded-[0.875rem] border bg-white px-4 py-2.5 text-[0.875rem]', lateStart ? 'border-bad-200 text-bad-700' : 'border-line text-ink-2')}>
              {lateStart ? `It was to start ${start} — it hasn’t.` : start ? `Starts ${start}${crew ? ` with ${PEOPLE[crew]?.short}` : ''}. These rooms get installed.` : 'No start date yet — it comes with the installer’s PO. These rooms get installed.'}
            </div>
          )}
          {rooms.length ? (
            <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <span className="text-[0.9375rem] font-semibold text-ink">Rooms</span>
                <span className="text-[0.78125rem] text-muted">{inField ? `${pct}% installed · ${rooms.filter((r) => roomPct(r) >= 100).length} of ${rooms.length} done` : `${rooms.length}`}</span>
              </div>
              <div>
                {rooms.map((r) => {
                  const p = roomPct(r)
                  const waiting = r.surfaces.filter((x) => ['blocked', 'waitmat', 'hold'].includes(x.state)).length
                  const on = wide && room === r.name
                  return (
                    <button key={r.name} data-room={r.name} onClick={() => (wide ? setRoom(r.name) : s.open({ t: 'room', jobId: job.id, room: r.name }))} aria-current={on ? 'true' : undefined} className={cn('flex w-full items-center gap-3 border-b border-line-2 border-l-[0.1875rem] px-3 py-2 text-left transition last:border-b-0', on ? 'border-l-brand-600 bg-brand-50/70' : 'border-l-transparent hover:bg-[#f6f3ee]')}>
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
          ) : <RoomsTab job={job} />}
        </>
      )}

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

  /* the right side: the step you tapped (with its lane's path), the room, or the project */
  const side = wide && part === 'ready' && focused ? (
    <div data-panel className="@container flex min-h-[24rem] flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line py-3 pl-5 pr-3">
        <StepIcon state={past ? 'done' : focused.state} size={22} />
        <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{isDone(focused) || past ? focused.label : todoOf(focused)}</span>
        <button onClick={() => setFocus(null)} aria-label="Close the step" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-wash hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      {focusedLane && focusedLane.steps.length > 1 && <StepTabs list={focusedLane.steps} at={focused.key} go={(x) => x && setFocus(x.key)} me={me} />}
      <div className="min-h-0 flex-1 px-5 pb-5 pt-3">
        <StepInline key={focused.key} job={job} v={focused} onClose={() => setFocus(null)} />
      </div>
    </div>
  ) : wide && part === 'install' && rooms.length ? (
    <div data-panel className="flex min-h-[24rem] flex-col"><RoomPanel key={room} job={job} room={room} /></div>
  ) : (
    <ProjectInfo job={job} />
  )

  return (
    <div className="grid min-h-full grid-cols-[minmax(0,1fr)_26rem] max-lg:grid-cols-1">
      <div className="min-w-0 border-r border-line px-6 py-5 max-lg:border-r-0 max-sm:px-4">{main}</div>
      <aside className="min-w-0 max-lg:border-t max-lg:border-line lg:sticky lg:top-0 lg:self-start">{side}</aside>
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
