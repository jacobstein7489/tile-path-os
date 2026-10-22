/* The project — one window that fills the screen, the same shape as the estimate:
 *   on top, every part of the job as a circle that fills — getting ready piece by piece (the tile paperwork, the tile
 *   and grout, the underlayment, the installer, the deliveries, the deposit…), then installing, touch-ups, the money.
 *   Tap a circle and it opens underneath. The project opens on where it is: your turn first, else a problem, else
 *   what's going on; once it's being installed, the rooms.
 *   On the right, what's around it: what else is open, the conversation, the files.
 * Anything you open from there — a room, the conversation, a file — opens in the same place, with Back on top. */
import * as React from 'react'
import { Plus, Upload, Paperclip, MessageCircle, Package, History, Receipt, ChevronRight, Grid2x2, FileText, Truck, HardHat, CalendarDays } from 'lucide-react'
import { useStore, meOf, isRequest, type Store } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { TileImg } from '@/tileos/components/ui/swatch'
import { Circles, Circle, type CircleGroup, type CircleState, type CircleStep } from '@/tileos/components/ui/page'
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
import { Thread, ConvoHead } from '../messages'
import { DocPanel, PanelBar } from '../docview'
import { FilesTab, HistoryTab } from './files'
import { ScopeTab } from './scope-tab'
import { POsTab } from './pos-tab'

export type Part = 'ready' | 'install' | 'punch' | 'money'
const PRICING = ['request', 'estimating', 'proposal', 'followup']
const IN_FIELD = ['installation', 'punch', 'closeout', 'complete']
const isDone = (v: StepView) => v.state === 'done' || v.state === 'na'

/** the circle that's open: a piece of getting ready (its lane: 'paper', 'grout', 'installer'…), or a part after it — '@install',
 *  '@punch', '@money' (a lane can be called 'money' too: the deposit) */
export type Sel = string
/** something opened from the circle or the side: a room, the conversation, a file… */
export type BoardView = null | { t: 'room'; name: string } | { t: 'chat' } | { t: 'file'; id: string } | { t: 'files' } | { t: 'scope' } | { t: 'log' } | { t: 'orders' }

/** where the project is — the part it opens on */
export function partOf(job: Job): Part {
  if (job.stage === 'installation') return 'install'
  if (job.stage === 'punch') return 'punch'
  if (['closeout', 'complete'].includes(job.stage)) return 'money'
  return 'ready'
}

/** the words under a circle — short */
const SHORT: Record<string, string> = { paper: 'Tile paperwork', grout: 'Tile & grout', installer: 'Installer', store: 'Tile delivery', materials: 'Our materials', money: 'Deposit' }
const laneLabel = (l: LaneView) => SHORT[l.key] || l.label
const laneCircle = (st: StepView['state']): CircleState => (st === 'done' || st === 'na' ? 'done' : st === 'bad' ? 'bad' : st === 'wait' ? 'wait' : st === 'now' ? 'now' : 'later')
const isMine = (l: LaneView, me: PersonKey) => (l.state === 'now' || l.state === 'bad') && l.at.owner === me && l.at.state !== 'wait'
const laneAttrs = (l: LaneView) => ({ 'data-lane': l.key, 'data-step': l.at.key, 'data-has': l.steps.map((x) => x.key).join(' ') })

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
const TONE: Record<string, string> = { ok: 'text-[#2c8a5b]', bad: 'text-bad-600 font-medium', warn: 'text-warn-700', me: 'text-brand-700 font-semibold', quiet: 'text-faint', plain: 'text-ink-2' }
/** under a circle there's room for a few words — whose turn, "Problem", "Waiting", "Done Oct 6" */
function circleSub(l: LaneView, me: PersonKey): string {
  const v = l.at
  if (l.state === 'done') return v.doneOn ? `Done ${v.doneOn}` : 'Done'
  if (l.state === 'bad') return 'Problem'
  if (l.state === 'wait') return v.due ? `Waiting · ${labelFromIso(v.due)}` : 'Waiting'
  if (l.state === 'later') return 'Not yet'
  return v.owner === me ? 'Your turn' : firstName(v.owner) || PEOPLE[v.owner]?.short || ''
}

/** the lanes of getting ready */
function lanesOf(s: Store, job: Job): LaneView[] {
  return PRICING.includes(job.stage) ? [] : lanesFor(stepsFor(s, job).filter((v) => v.state !== 'na'))
}
/** the lane getting ready opens on: your turn first, then a problem, then what's going on, then what's next */
function readySel(s: Store, job: Job): Sel | undefined {
  const me = meOf(s.role)
  const lanes = lanesOf(s, job)
  const pick = lanes.find((l) => isMine(l, me)) || lanes.find((l) => l.state === 'bad') || lanes.find((l) => l.state === 'now') || lanes.find((l) => l.state === 'wait') || lanes.find((l) => l.state === 'later')
  return pick?.key || lanes[0]?.key
}
/** where the window opens — the part the project is in, or the part a link asks for */
export function defaultSel(s: Store, job: Job, part?: Part): Sel {
  const p = part || (s.role === 'accounting' ? 'money' : partOf(job))
  if (p === 'ready') return readySel(s, job) || '@install'
  return '@' + p
}

/* ---------------- the four parts after getting ready, for their circles ---------------- */
type PartState = 'done' | 'now' | 'later' | 'bad'
export type PartView = { key: Part; label: string; short: string; pct: number; state: PartState; sub: string; subShort: string }
export function useParts(job: Job): PartView[] {
  const s = useStore()
  const money = s.role !== 'site' && s.role !== 'crew'
  const pricing = PRICING.includes(job.stage)
  const ready = isGettingReady(job)
  const inField = IN_FIELD.includes(job.stage)
  const past = !ready && !pricing
  const steps = pricing ? [] : stepsFor(s, job).filter((v) => v.state !== 'na')
  const c = stepCounts(steps)
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
      subShort: inField ? (job.stage === 'installation' ? (crew ? PEOPLE[crew]?.short || `${pct}%` : `${pct}%`) : 'Done') : start ? (lateStart ? 'Late' : `Starts ${start}`) : 'No date yet',
    },
    {
      key: 'punch', label: 'Touch-ups', short: 'Touch-ups',
      pct: punch.length ? Math.round(((punch.length - punchOpen.length) / punch.length) * 100) : 0,
      state: punch.length && !punchOpen.length ? 'done' : punchOpen.length ? 'now' : ['closeout', 'complete'].includes(job.stage) ? 'done' : 'later',
      sub: punchOpen.length ? `${punchOpen.length} open` : punch.length ? 'All checked' : ['closeout', 'complete'].includes(job.stage) ? 'None' : inField ? 'None yet' : 'After the installing',
      subShort: punchOpen.length ? `${punchOpen.length} open` : punch.length ? 'All checked' : inField ? 'None yet' : 'Later',
    },
    ...(money && pic ? [{
      key: 'money' as Part, label: 'Billed and paid', short: 'Billed',
      pct: pic.paidPct,
      state: (job.stage === 'complete' ? 'done' : pic.billed ? 'now' : 'later') as PartState,
      sub: pic.billed ? `${fmtMoney(pic.paid)} of ${fmtMoney(pic.contract + pic.changes)} paid` : 'Nothing billed yet',
      subShort: pic.billed ? `${pic.paidPct}% paid` : 'Not billed yet',
    }] : []),
  ]
}

/** "9 of 18 done · 1 problem" — how far getting ready is, in steps */
function readyWords(s: Store, job: Job): string {
  const c = stepCounts(stepsFor(s, job).filter((v) => v.state !== 'na'))
  return `${c.done} of ${c.total} done${c.bad ? ` · ${c.bad} ${c.bad === 1 ? 'problem' : 'problems'}` : ''}`
}
/** the circles on top: every piece of getting ready, then installing, touch-ups and the money */
export function ProjectCircles({ job, sel, onPick, className }: { job: Job; sel: Sel; onPick: (k: Sel) => void; className?: string }) {
  const s = useStore()
  const me = meOf(s.role)
  const lanes = lanesOf(s, job)
  const parts = useParts(job)
  const ready = parts.find((p) => p.key === 'ready')!
  const groups: CircleGroup[] = []
  if (lanes.length) {
    groups.push({
      key: 'ready', label: 'Getting ready', sub: lanes.every((l) => l.state === 'done') ? 'All done' : readyWords(s, job), subTone: lanes.some((l) => l.state === 'bad') ? 'bad' : undefined,
      onLabel: () => onPick(readySel(s, job) || lanes[0].key),
      steps: lanes.map((l, i): CircleStep => ({
        key: l.key, label: laneLabel(l), sub: circleSub(l, me), state: laneCircle(l.state),
        pct: l.total > 1 && l.state !== 'done' ? Math.round((l.done / l.total) * 100) : undefined,
        center: String(i + 1), mine: isMine(l, me), attrs: laneAttrs(l),
      })),
    })
  }
  parts.filter((p) => p.key !== 'ready').forEach((p) => {
    const st: CircleState = p.state === 'done' ? 'done' : p.state === 'bad' ? 'bad' : p.state === 'now' ? 'now' : 'later'
    groups.push({ key: p.key, steps: [{ key: '@' + p.key, label: p.label, sub: p.subShort, state: st, pct: p.state === 'now' ? Math.max(p.pct, 4) : 0, center: p.state === 'now' ? `${p.pct}%` : '', attrs: { 'data-part': p.key } }] })
  })
  return <Circles groups={groups} at={sel} onPick={onPick} className={className} label="The project, part by part" />
}

/* ---------------- the top of what's open underneath: what it is, how far, the few facts ---------------- */
function BodyHead({ title, sub, alert, alertTone = 'bad', facts, right }: { title: React.ReactNode; sub?: React.ReactNode; alert?: string; alertTone?: 'bad' | 'warn'; facts?: React.ReactNode[]; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <h3 className="text-[1.125rem] font-semibold leading-tight tracking-[-0.005em] text-ink">{title}</h3>
      {sub && <span className="text-[0.875rem] text-ink-2">{sub}</span>}
      {alert && <span className={cn('inline-flex items-center rounded-full px-2 py-px text-[0.78125rem] font-semibold', alertTone === 'bad' ? 'bg-bad-50 text-bad-700 ring-1 ring-bad-100' : 'bg-warn-50 text-warn-700 ring-1 ring-warn-100')}>{alert}</span>}
      {!!facts?.filter(Boolean).length && <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-faint">{facts.filter(Boolean).map((f, i) => <span key={i} className="inline-flex items-center gap-1.5">{f}</span>)}</span>}
      {right && <span className="ml-auto flex items-center gap-2">{right}</span>}
    </div>
  )
}

/* ---------------- a piece of getting ready, open under its circle ---------------- */
function LaneBody({ job, laneKey }: { job: Job; laneKey: string }) {
  const s = useStore()
  const me = meOf(s.role)
  const steps = stepsFor(s, job).filter((v) => v.state !== 'na')
  const lanes = lanesFor(steps)
  const lane = lanes.find((l) => l.key === laneKey)
  const [k, setK] = React.useState<string | null>(null)
  if (!lane) return null
  const v = lane.steps.find((x) => x.key === k) || lane.at
  const n = lanes.indexOf(lane) + 1
  const w = laneStatus(lane, me)
  return (
    <div data-panel className="@container">
      <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3 max-sm:px-4">
          <Circle st={{ key: lane.key, label: lane.label, state: laneCircle(lane.state), pct: lane.total > 1 && lane.state !== 'done' ? (lane.done / lane.total) * 100 : undefined, center: String(n) }} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.0625rem] font-semibold leading-tight text-ink">{isDone(v) ? v.label : todoOf(v)}</span>
            <span className="mt-0.5 block truncate text-[0.8125rem]"><span className="font-semibold text-ink-2">{lane.label}</span>{lane.total > 1 ? <span className="text-muted"> · {lane.done} of {lane.total} done</span> : null}<span className={cn(' ', TONE[w.tone] || TONE.plain)}> · {w.text}</span></span>
          </span>
        </div>
        {lane.steps.length > 1 && <StepTabs list={lane.steps} at={v.key} go={(x) => x && setK(x.key)} me={me} />}
        <div className="px-5 pb-5 pt-4 max-sm:px-4"><StepInline key={v.key} job={job} v={v} /></div>
      </div>
    </div>
  )
}

/* ---------------- Installing: the rooms, each a circle ---------------- */
function InstallBody({ job, open }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const inField = IN_FIELD.includes(job.stage)
  const b = s.bookings.find((x) => x.jobId === job.id)
  const startIso = b?.start || s.prep[job.id]?.targetISO
  const start = job.dates?.start || (startIso ? labelFromIso(startIso) : undefined)
  const days = startIso ? daysBetween(TODAY, startIso) : null
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
    <div>
      <BodyHead
        title={!inField ? 'Installing' : pct >= 100 ? 'Installed' : `${pct}% installed`}
        sub={!inField ? (start ? `Starts ${start}${days != null && days >= 0 ? ` · ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}` : ''}` : 'No start date yet') : `${doneRooms} of ${rooms.length} rooms done${going ? ` · ${going} going` : ''}`}
        alert={inField && blocked ? `${blocked} ${blocked === 1 ? 'room' : 'rooms'} blocked` : inField && waiting ? `${waiting} waiting` : undefined}
        alertTone={blocked ? 'bad' : 'warn'}
        facts={[crew ? <><HardHat />{PEOPLE[crew]?.short}</> : <><HardHat />No installer yet</>, job.dates?.start ? <><CalendarDays />{job.dates.start} – {job.dates.finish || '…'}</> : null, sf ? <><Grid2x2 />{sf.toLocaleString('en-US')} SF</> : null]}
      />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14.5rem,1fr))] gap-2.5 max-sm:grid-cols-2 max-sm:gap-2" aria-label="The rooms">
        {rooms.map((x) => {
          const p = roomPct(x)
          const wait = x.surfaces.filter((y) => ['blocked', 'waitmat', 'hold'].includes(y.state))
          const stuck = wait.some((y) => y.state === 'blocked')
          const st: CircleState = !inField ? 'later' : p >= 100 ? 'done' : stuck ? 'bad' : wait.length ? 'wait' : p > 0 ? 'now' : 'later'
          return (
            <button key={x.name} data-room={x.name} onClick={() => open({ t: 'room', name: x.name })} className={cn('flex min-w-0 items-center gap-3 rounded-[0.875rem] border bg-white px-3 py-2.5 text-left transition hover:-translate-y-px hover:shadow-card max-sm:gap-2 max-sm:px-2.5', st === 'bad' ? 'border-bad-200' : 'border-[#e8e2d8] hover:border-[#d8d1c5]')}>
              <Circle st={{ key: x.name, label: x.name, state: st, pct: inField ? p : 0, center: !inField ? String(x.surfaces.length) : `${p}%` }} size={40} />
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
      <PanelBar title={r.name} sub={inField ? `${p}% installed · ${r.surfaces.filter((x) => x.state === 'done').length} of ${r.surfaces.length} done` : `${r.surfaces.length} walls and floors`} onBack={back} back="All the rooms" right={entries.length ? <Button size="sm" variant="ghost" icon={<FileText />} onClick={() => s.open({ t: 'room', jobId: job.id, room: r.name, view: 'log' })}>Daily log · {entries.length}</Button> : undefined} />
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
function PunchBody({ job }: { job: Job }) {
  const s = useStore()
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const open = punch.filter((p) => p.status !== 'verified')
  const canAdd = !['accounting', 'client', 'crew'].includes(s.role)
  return (
    <div>
      <BodyHead title="Touch-ups" sub={punch.length ? (open.length ? `${open.length} open · ${punch.length - open.length} of ${punch.length} checked` : `All ${punch.length} checked`) : 'None yet — the walkthrough’s list goes here'} right={canAdd ? <Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'punchnew', jobId: job.id })}>Add touch-ups</Button> : undefined} />
      <section className="rounded-[0.875rem] border border-[#e8e2d8] bg-white px-4 pb-4 pt-3"><TouchupsList job={job} /></section>
    </div>
  )
}
function MoneyBody({ job }: { job: Job }) {
  const s = useStore()
  const pic = pictureOf(s, job.id)
  const total = pic.contract + pic.changes
  return (
    <div>
      <BodyHead title="Billed and paid" sub={pic.billed ? `${fmtMoney(pic.paid)} of ${fmtMoney(total)} paid` : 'Nothing billed yet'} facts={[total ? <><Receipt />{fmtMoney(pic.billed)} billed</> : null, total ? <>{fmtMoney(total - pic.paid)} still open</> : null]} />
      <MoneyTab job={job} />
    </div>
  )
}

/* ---------------- the right side: what's around the job, the same in every part ---------------- */
export function Box({ title, right, children, className }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('border-b border-line px-5 py-4 last:border-b-0 max-sm:px-4', className)}>
      <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[0.9375rem] font-semibold text-ink">{title}</span>{right}</div>
      {children}
    </section>
  )
}

/** what else is open on the job — requests, questions, things to chase — that isn't one of the circles */
function AlsoOpen({ job }: { job: Job }) {
  const s = useStore()
  const me = meOf(s.role)
  const tasks = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done' && !t.title.startsWith('Touch-ups at') && !t.step)
  if (!tasks.length) return null
  return (
    <Box title={<>Also open <span className="ml-1 rounded-full bg-wash-2 px-1.5 text-[0.71875rem] font-bold tnum text-ink-2">{tasks.length}</span></>}>
      <div className="-mx-2">
        {tasks.map((t) => (
          <button key={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#f6f3ee]">
            {isRequest(t) ? <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-[#fff1e3] text-[#c2410c]"><Truck className="h-3 w-3" /></span> : <StepIcon state={t.tone === 'bad' ? 'bad' : t.state === 'waiting' ? 'wait' : 'now'} size={22} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.84375rem] font-medium text-ink">{t.title}</span>
              <span className={cn('block truncate text-[0.75rem]', t.owner === me ? 'font-semibold text-brand-700' : 'text-muted')}>{t.state === 'waiting' ? `Waiting on ${t.waitingOn}` : t.req ? `${t.req.trip === 'onway' ? 'On the way' : 'Asked'}${t.by ? ` by ${firstName(t.by)}` : ''}` : t.owner === me ? 'You' : firstName(t.owner)}</span>
            </span>
          </button>
        ))}
      </div>
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
      {n === 0 && <button onClick={() => add.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d6cfc3] py-3 text-[0.8125rem] font-medium text-muted hover:border-brand-300 hover:text-brand-700"><Paperclip className="h-4 w-4" />Plans, paperwork, photos</button>}
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
      <AlsoOpen job={job} />
      <MessagesBox job={job} open={open} />
      <FilesBox job={job} open={open} />
      <section className="px-5 py-3.5 max-sm:px-4">
        <div className="flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-brand-700">
          <button onClick={() => open({ t: 'scope' })} className="inline-flex items-center gap-1.5 hover:underline"><Grid2x2 className="h-3.5 w-3.5" />Scope of work{rooms.length ? <span className="font-normal text-muted">· {rooms.length} rooms{sf ? `, ${sf.toLocaleString('en-US')} SF` : ''}</span> : null}</button>
          {money && <button onClick={() => open({ t: 'orders' })} className="inline-flex items-center gap-1.5 hover:underline"><Package className="h-3.5 w-3.5" />All the orders</button>}
          <button onClick={() => open({ t: 'log' })} className="inline-flex items-center gap-1.5 hover:underline"><History className="h-3.5 w-3.5" />What happened</button>
        </div>
      </section>
    </div>
  )
}

/* ---------------- something opened on the project, with Back on top ---------------- */
const FULL: string[] = ['chat', 'file']
function InPlace({ job, view, back, setView, backLabel }: { job: Job; view: NonNullable<BoardView>; back: () => void; setView: (v: BoardView) => void; backLabel: string }) {
  const page = (title: string, body: React.ReactNode, sub?: string) => (
    <div data-panel={view.t}>
      <PanelBar title={title} sub={sub} onBack={back} back={backLabel} />
      <div className="px-5 py-4 max-sm:px-3">{body}</div>
    </div>
  )
  switch (view.t) {
    case 'room': return <RoomOpen job={job} name={view.name} back={back} />
    case 'chat': return (
      <div className="flex h-full min-h-0 flex-col" data-panel="chat">
        <ConvoHead jobId={job.id} onBack={back} backLabel={backLabel} />
        <div className="min-h-0 flex-1"><Thread jobId={job.id} outside={useStore.getState().role === 'client'} /></div>
      </div>
    )
    case 'file': return <DocPanel jobId={job.id} fileId={view.id} onBack={back} back={backLabel} />
    case 'files': return page('Files and photos', <FilesTab job={job} />)
    case 'scope': return page('Scope of work', <ScopeTab job={job} />, 'every wall and floor — its tile, grout and layout')
    case 'log': return page('What happened', <HistoryTab job={job} />)
    case 'orders': return page('All the orders', <POsTab job={job} onScope={() => setView({ t: 'scope' })} />)
  }
}

/* ---------------- the body: the open circle on the left, what's around it on the right ---------------- */
export function ProjectBoard({ job, sel, view, setView }: { job: Job; sel: Sel; view: BoardView; setView: (v: BoardView) => void }) {
  const s = useStore()
  const money = s.role !== 'site' && s.role !== 'crew'
  const pricing = PRICING.includes(job.stage)
  const top = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { top.current?.scrollTo?.({ top: 0 }) }, [view, sel])
  const full = !!view && FULL.includes(view.t)
  const lanes = lanesOf(s, job)
  const lane = lanes.find((l) => l.key === sel)
  const selLabel = sel === '@install' ? 'Back to the rooms' : lane ? `Back to ${laneLabel(lane).toLowerCase()}` : sel === '@punch' ? 'Back to the touch-ups' : sel === '@money' ? 'Back to billed and paid' : 'Back'
  const main = view ? <InPlace job={job} view={view} back={() => setView(null)} setView={setView} backLabel={view.t === 'room' ? 'All the rooms' : selLabel} /> : (
    <div className="px-5 py-4 max-sm:px-3">
      {pricing ? <div className="rounded-[0.875rem] border border-line bg-white px-4 py-8 text-center text-[0.875rem] text-muted">Paperwork, the design meeting, the site, the installer, deliveries, the deposit — the flow starts once the estimate is won.</div>
        : lane ? <LaneBody key={lane.key} job={job} laneKey={lane.key} />
        : sel === '@punch' ? <PunchBody job={job} />
        : sel === '@money' && money ? <MoneyBody job={job} />
        : <InstallBody job={job} open={setView} />}
    </div>
  )
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_21rem] max-lg:h-auto max-lg:grid-cols-1">
      <div ref={top} className={cn('min-h-0 min-w-0 border-r border-line bg-[#f7f5f1] max-lg:border-r-0', full ? 'flex flex-col max-lg:h-[78dvh]' : 'scroll-soft lg:overflow-y-auto')} data-board-main>{main}</div>
      <aside className="scroll-soft min-h-0 min-w-0 bg-white max-lg:border-t max-lg:border-line lg:overflow-y-auto"><ProjectInfo job={job} open={setView} /></aside>
    </div>
  )
}

/** the window's footer line: where the money stands, when the money is open */
export function ProjectFoot({ job, sel }: { job: Job; sel: Sel }) {
  const s = useStore()
  const money = s.role !== 'site' && s.role !== 'crew'
  const pic = money && sel === '@money' ? pictureOf(s, job.id) : null
  if (pic && pic.billed > 0) return <span className="inline-flex items-center gap-2 text-[0.84375rem] text-muted"><Receipt className="h-4 w-4 text-faint" />{fmtMoney(pic.paid)} paid of {fmtMoney(pic.contract + pic.changes)} · {fmtMoney(pic.contract + pic.changes - pic.paid)} open</span>
  return null
}
/** the lane a step is in — for "Your turn" in the footer */
export function laneOfStep(s: Store, job: Job, k: string): Sel | undefined {
  return lanesOf(s, job).find((l) => l.steps.some((x) => x.key === k))?.key
}

/** a desktop-sized window */
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
