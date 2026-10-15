/* The project at a glance, read the same way on every project:
 *   the bar on top — every part of the project in order (the paperwork, the design meeting, the site, the installer,
 *     the deliveries, then installing, touch-ups, billed and closed): how far each part is (its bar fills), who has
 *     it now and how many of its steps are done — and how much of the whole project is done. Click a part and only
 *     that part's steps open, numbered 1, 2, 3.
 *   To do — everything open on the project, in four groups (your turn, others, waiting, coming up), every row on the
 *     same grid: what · who · when · one button.
 *   At a glance — the five facts, each in the same shape. What we're tiling — the rooms.
 * Plus the project's estimate, and changing the project's own details. */
import * as React from 'react'
import { FileText, Pencil, Check, Building2, Plus, CalendarDays, Clock3, ListPlus, HardHat, Grid2x2, Package, Wallet, Ruler } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Field } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { Status } from '@/tileos/components/ui/page'
import { SearchSelect } from '@/tileos/components/ui/select'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey, type Tone } from '@/tileos/data/model'
import { tilesOf, tileOf, floorsOf, roomPct, CUSTOMERS } from '@/tileos/data/jobs'
import { curRev, revTotal, type Estimate } from '@/tileos/data/estimates'
import { timeLabel } from '@/tileos/data/calendar'
import { TODAY, labelFromIso, isoFromLabel, md } from '@/tileos/lib/today'
import { isGettingReady, stepsFor, stepCounts, takesTile, realOwner, type StepView } from '../steps'
import { StepIcon, AddStep } from '../steps-ui'
import { openStep, todoOf } from '../stepwin'
import { installerOf } from '../upcoming'
import { matBy } from '../flows'
import { materialStatus } from '../takeoff'
import { poRatio } from '../poratio'
import { CAT, catOf } from '../estimates'
import { billingOf } from './money-tab'
import { tileStatus } from './scope-tab'
import { budgetOf } from './ratio'
import { todoLines, type NowState } from './todo'
import { Section, Empty, Group, Who, ROW, firstName, Word, Strip } from './kit'

const PRICING = ['request', 'estimating', 'proposal', 'followup']
const IN_FIELD = ['installation', 'punch', 'closeout', 'complete']
type SetTab = (t: any) => void

/* ================= the bar on top ================= */
export type PhaseState = 'done' | 'active' | 'wait' | 'bad' | 'todo'
export type PhaseCell = { key: string; label: string; state: PhaseState; frac: number; who?: PersonKey; line: string; onClick?: () => void }
const PARTS: { key: string; label: string }[] = [
  { key: 'paper', label: 'Paperwork' },
  { key: 'meet', label: 'Design meeting' },
  { key: 'site', label: 'Site' },
  { key: 'installer', label: 'Installer' },
  { key: 'deliver', label: 'Deliveries' },
]
export function projectPath(s: Store, job: Job, setTab?: SetTab): PhaseCell[] {
  const ready = isGettingReady(job)
  const past = !ready && !PRICING.includes(job.stage)
  const steps = ready ? stepsFor(s, job) : []
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const parts: PhaseCell[] = PARTS.map((ph) => {
    if (!ready) return { key: ph.key, label: ph.label, state: past ? 'done' : 'todo', frac: past ? 1 : 0, line: past ? 'Done' : '' }
    const items = steps.filter((v) => v.phase === ph.key && v.state !== 'na')
    const done = items.filter((v) => v.state === 'done').length
    const bad = items.find((v) => v.state === 'bad')
    const now = items.find((v) => v.state === 'now')
    const wait = items.find((v) => v.state === 'wait')
    const all = !items.length || done === items.length
    const first = bad || now || wait || items.find((v) => v.state === 'later') || items[0]
    return {
      key: ph.key,
      label: ph.label,
      state: all ? 'done' : bad ? 'bad' : now ? 'active' : wait ? 'wait' : 'todo',
      frac: items.length ? done / items.length : 1,
      who: all ? undefined : first?.owner,
      line: all ? 'Done' : bad ? 'Problem' : `${done} of ${items.length} done`,
      onClick: first ? () => openStep(job.id, first.key) : undefined,
    }
  })
  const st = job.stage
  const b = s.bookings.find((x) => x.jobId === job.id)
  const start = job.dates?.start || (b ? md(b.start) : s.prep[job.id]?.targetISO ? labelFromIso(s.prep[job.id]!.targetISO!) : undefined)
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const punchOpen = punch.filter((p) => p.status !== 'verified').length
  const money = s.role !== 'site'
  const billed = money ? billingOf(job).billedPct : 0
  return [
    ...parts,
    {
      key: 'install', label: 'Installing',
      state: st === 'installation' ? 'active' : ['punch', 'closeout', 'complete'].includes(st) ? 'done' : 'todo',
      frac: st === 'installation' ? (job.pct ?? 0) / 100 : ['punch', 'closeout', 'complete'].includes(st) ? 1 : 0,
      who: ['punch', 'closeout', 'complete'].includes(st) ? undefined : crew,
      line: st === 'installation' ? `${job.pct ?? 0}% installed` : ['punch', 'closeout', 'complete'].includes(st) ? 'Done' : start ? `Starts ${start}` : crew ? 'No dates yet' : 'No installer yet',
      onClick: setTab ? () => setTab('installer') : undefined,
    },
    {
      key: 'punch', label: 'Touch-ups',
      state: st === 'punch' ? (punchOpen ? 'active' : 'done') : ['closeout', 'complete'].includes(st) ? 'done' : 'todo',
      frac: ['closeout', 'complete'].includes(st) ? 1 : punch.length ? (punch.length - punchOpen) / punch.length : 0,
      line: st === 'punch' ? (punchOpen ? `${punchOpen} open` : 'All fixed') : ['closeout', 'complete'].includes(st) ? 'Done' : '',
      onClick: setTab ? () => setTab('installer') : undefined,
    },
    {
      key: 'close', label: 'Billed and closed',
      state: st === 'complete' ? 'done' : st === 'closeout' ? 'active' : 'todo',
      frac: st === 'complete' ? 1 : billed / 100,
      line: st === 'complete' ? 'Done' : money && billed ? `${billed}% billed` : '',
      onClick: setTab && money ? () => setTab('money') : undefined,
    },
  ]
}

/** how much of the whole project is done — every part counts the same, so it's exactly how much of the bar is filled */
export const overallPct = (cells: PhaseCell[]) => Math.round((cells.reduce((n, c) => n + (c.state === 'done' ? 1 : Math.max(0, Math.min(1, c.frac))), 0) / Math.max(1, cells.length)) * 100)

/** every part of the project, left to right, each the same width: its name, a bar that fills as its steps get done,
 *  how many are done and who has it. On the left, how much of the whole project is done. Click a part to open it. */
export function PhaseBar({ cells }: { cells: PhaseCell[] }) {
  const me = meOf(useStore((s) => s.role))
  const pct = overallPct(cells)
  return (
    <div className="flex items-stretch gap-3">
      <div className="flex w-[4.5rem] shrink-0 flex-col justify-center border-r border-line-2 pr-3 max-sm:w-[3.75rem]" aria-label={`The project is ${pct}% done`}>
        <span className="text-[1.5rem] font-semibold leading-none tracking-[-0.01em] tnum text-ink max-sm:text-[1.25rem]">{pct}%</span>
        <span className="mt-1 text-[0.65625rem] font-bold uppercase tracking-[0.08em] text-muted">done</span>
      </div>
      <ol className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Where the project is">
        {cells.map((c) => {
          const frac = c.state === 'done' ? 1 : Math.max(0, Math.min(1, c.frac))
          const who = c.state !== 'done' && c.who && PEOPLE[c.who] ? (c.who === me ? 'You' : firstName(c.who)) : ''
          const now = c.state === 'active' || c.state === 'bad' || c.state === 'wait'
          return (
            <li key={c.key} className="min-w-[6.75rem] flex-1">
              <button
                onClick={c.onClick}
                disabled={!c.onClick}
                aria-label={`${c.label} — ${c.state === 'done' ? 'done' : [c.line, who].filter(Boolean).join(', ') || 'not started'}`}
                className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left transition enabled:hover:bg-wash disabled:cursor-default"
              >
                <span className={cn('w-full truncate text-[0.8125rem]', c.state === 'bad' ? 'font-semibold text-bad-700' : now ? 'font-semibold text-ink' : c.state === 'done' ? 'font-medium text-ink-2' : 'font-medium text-muted')}>{c.label}</span>
                <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-[#e4e7eb]">
                  {frac > 0 && <span className={cn('block h-full rounded-full', c.state === 'bad' ? 'bg-bad-500' : 'bg-[#2c4a3e]')} style={{ width: `${Math.max(6, frac * 100)}%` }} />}
                </span>
                <span className="mt-1.5 flex w-full min-w-0 items-baseline gap-1.5 text-[0.71875rem] leading-tight">
                  <span className={cn('shrink-0 tnum', c.state === 'done' ? 'font-semibold text-[#2c4a3e]' : c.state === 'bad' ? 'font-semibold text-bad-700' : now ? 'font-medium text-ink-2' : 'text-muted')}>{c.line || '\u00a0'}</span>
                  {who && <span className={cn('ml-auto min-w-0 truncate max-sm:hidden', who === 'You' ? 'font-semibold text-ink' : 'text-muted')}>{who}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** the one thing to press: my next step on this project — or, if it's someone else's turn, whose and what */
export function nextOn(s: Store, job: Job): { v: StepView; mine: boolean } | null {
  if (!isGettingReady(job)) return null
  const me = meOf(s.role)
  const open = stepsFor(s, job).filter((v) => v.state === 'now' || v.state === 'bad')
  const rank = (v: StepView) => (v.owner === me ? 0 : 2) + (v.state === 'bad' ? 0 : 1)
  const v = [...open].sort((a, b) => rank(a) - rank(b))[0]
  return v ? { v, mine: v.owner === me } : null
}

/* ================= To do ================= */
type Mark = { kind: 'step'; state: StepView['state'] } | { kind: 'item'; status: NowState } | { kind: 'task'; waiting: boolean } | { kind: 'meet' }
type GroupKey = 'mine' | 'others' | 'wait' | 'coming'
export type TodoRow = { key: string; group: GroupKey; mark: Mark; title: string; note?: string; noteTone?: 'bad' | 'warn'; who?: PersonKey; when: string; late?: boolean; run?: () => void }
const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'mine', label: 'Your turn' },
  { key: 'others', label: 'Others' },
  { key: 'wait', label: 'Waiting' },
  { key: 'coming', label: 'Coming up' },
]
const dueWords = (iso?: string): { when: string; late: boolean } => (!iso ? { when: '—', late: false } : iso < TODAY ? { when: `Late · ${md(iso)}`, late: true } : { when: labelFromIso(iso), late: false })
/** a meeting the design-meeting or show-the-installer step already stands for — it's that step's row, not its own */
const stepMeeting = (e: { title: string; kind?: string; with?: string }) => /design/i.test(e.title) || (e.kind === 'walkthrough' && /installer|crew/i.test(`${e.title} ${e.with || ''}`))

/** everything open on a project, as rows on one grid — any stage */
export function todoRows(s: Store, job: Job, setTab: SetTab): TodoRow[] {
  const me = meOf(s.role)
  const ready = isGettingReady(job)
  const rows: TodoRow[] = []
  const turn = (who: PersonKey | undefined, bad: boolean, waiting: boolean): GroupKey => (waiting ? 'wait' : who === me ? 'mine' : 'others')
  /* the checklist steps that are someone's turn, or waiting */
  const steps = ready ? stepsFor(s, job) : []
  steps.filter((v) => v.state === 'now' || v.state === 'bad' || v.state === 'wait').forEach((v) => {
    const w = v.state === 'wait' ? { when: v.due ? labelFromIso(v.due) : '—', late: false } : dueWords(v.due)
    rows.push({ key: 's:' + v.key, group: turn(v.owner, v.state === 'bad', v.state === 'wait'), mark: { kind: 'step', state: v.state }, title: todoOf(v), note: v.note, noteTone: v.state === 'bad' ? 'bad' : v.state === 'wait' ? 'warn' : undefined, who: v.owner, when: w.when, late: w.late, run: () => openStep(job.id, v.key) })
  })
  /* what this stage needs that isn't a step (the install, touch-ups, closing out), the tasks, the meetings —
   * each with the person whose part it is: the site manager has the site, whoever orders has the materials, the
   * books have the bills, the admin books the return visit */
  const { lines } = todoLines(s, job, setTab, ready)
  const stepTasks = new Set(steps.map((v) => v.taskId).filter(Boolean))
  const holder = (r: string) => s.team.find((m) => m.role === r && m.status !== 'off')?.key as PersonKey | undefined
  const site = holder('site')
  const bills = new Set(s.money.filter((m) => m.jobId === job.id).map((m) => m.id))
  const ownerOfItem = (key: string): PersonKey | undefined => {
    const k = key === 'daily' || key === 'punch' || key.startsWith('held:') ? site : key.startsWith('sh:') ? matBy(s) : key === 'ret' ? holder('owner') : bills.has(key) ? holder('accounting') || holder('owner') : undefined
    return k ? realOwner(s, k) : undefined
  }
  lines.forEach((l) => {
    if (l.it) {
      const it = l.it
      const who = l.owner ? realOwner(s, l.owner.owner) : ownerOfItem(it.key)
      rows.push({ key: 'i:' + it.key, group: turn(who, it.status === 'bad', it.status === 'wait'), mark: { kind: 'item', status: it.status }, title: it.title, note: it.note, noteTone: it.status === 'bad' ? 'bad' : undefined, who, when: '—', run: it.action?.run })
    } else if (l.task) {
      const t = l.task
      if (stepTasks.has(t.id) || (ready && t.step)) return
      const waiting = t.state === 'waiting'
      const iso = isoFromLabel(waiting ? t.followUp : t.due)
      const w = waiting ? { when: t.followUp ? (iso ? labelFromIso(iso) : t.followUp) : '—', late: false } : iso ? dueWords(iso) : { when: t.due || '—', late: false }
      const who = realOwner(s, t.owner)
      rows.push({ key: 't:' + t.id, group: turn(who, false, waiting), mark: { kind: 'task', waiting }, title: t.title, note: waiting ? `Waiting on ${t.waitingOn}` : t.where || undefined, noteTone: waiting ? 'warn' : undefined, who, when: w.when, late: w.late, run: () => s.open({ t: 'task', id: t.id }) })
    } else if (l.ev) {
      const e = l.ev
      if (ready && stepMeeting(e)) return
      rows.push({ key: 'e:' + e.id, group: 'coming', mark: { kind: 'meet' }, title: e.title, note: e.with ? `With ${e.with}` : undefined, who: e.people[0], when: `${labelFromIso(e.date)} · ${timeLabel(e.start)}`, run: () => s.open({ t: 'event', id: e.id }) })
    }
  })
  const rank = (r: TodoRow) => (r.mark.kind === 'step' && r.mark.state === 'bad') || (r.mark.kind === 'item' && r.mark.status === 'bad') ? 0 : r.late ? 1 : 2
  return rows.sort((a, b) => rank(a) - rank(b))
}

function RowMark({ m, size = 24 }: { m: Mark; size?: number }) {
  if (m.kind === 'step') return <StepIcon state={m.state} size={size} />
  if (m.kind === 'meet') return <span style={{ width: size, height: size }} className="inline-flex items-center justify-center rounded-full bg-[#eceef1] text-ink-2"><CalendarDays className="h-3 w-3" /></span>
  if (m.kind === 'task') return <StepIcon state={m.waiting ? 'wait' : 'now'} size={size} />
  const st = m.status
  return <StepIcon state={st === 'bad' ? 'bad' : st === 'wait' ? 'wait' : st === 'done' ? 'done' : 'now'} size={size} />
}
function TodoLine({ r }: { r: TodoRow }) {
  const me = meOf(useStore((s) => s.role))
  const mine = r.group === 'mine'
  return (
    <div className={ROW}>
      <span className="flex justify-center"><RowMark m={r.mark} /></span>
      <button onClick={r.run} disabled={!r.run} className="min-w-0 text-left disabled:cursor-default">
        <span className="block truncate text-[0.90625rem] font-semibold text-ink">{r.title}</span>
        <span className={cn('block truncate text-[0.78125rem]', r.noteTone === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>
          <span className="md:hidden">{[r.who ? (r.who === me ? 'You' : firstName(r.who)) : '', r.when !== '—' ? r.when : ''].filter(Boolean).join(' · ')}{r.note ? ' · ' : ''}</span>{r.note || <span className="max-md:hidden">&nbsp;</span>}
        </span>
      </button>
      <Who who={r.who} className="max-md:hidden" />
      <span className={cn('truncate text-right text-[0.8125rem] tnum max-md:hidden', r.late ? 'font-semibold text-bad-600' : 'text-ink-2')}>{r.when === '—' ? '' : r.when}</span>
      <span>{r.run && <Button size="sm" variant={mine ? 'primary' : 'secondary'} className="w-full" onClick={r.run}>{mine ? 'Start' : 'Open'}</Button>}</span>
    </div>
  )
}

/* ================= the overview: Next up, then who's on what ================= */
const isProblem = (r: TodoRow) => (r.mark.kind === 'step' && r.mark.state === 'bad') || (r.mark.kind === 'item' && r.mark.status === 'bad')
/** what needs you, or is stuck — the first thing on the project, with its one button */
export function NextUp({ job, setTab }: { job: Job; setTab: SetTab }) {
  const s = useStore()
  const rows = todoRows(s, job, setTab)
  const top = rows.filter((r) => isProblem(r) || r.group === 'mine')
  const stuck = top.filter(isProblem).length
  const mine = top.filter((r) => r.group === 'mine').length
  const nextOther = rows.find((r) => r.group === 'others')
  return (
    <Section
      title="Next up"
      right={top.length ? [mine ? `${mine} for you` : '', stuck ? `${stuck} stuck` : ''].filter(Boolean).join(' · ') : undefined}
    >
      {top.map((r) => <TodoLine key={r.key} r={r} />)}
      {!top.length && (
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 max-sm:px-4">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2c4a3e] text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.90625rem] font-semibold text-ink">Nothing needs you here right now</span>
            <span className="block truncate text-[0.78125rem] text-muted">{nextOther ? <>Next: {firstName(nextOther.who) || 'someone'} — {nextOther.title.charAt(0).toLowerCase() + nextOther.title.slice(1)}</> : 'Nothing stuck, nothing late.'}</span>
          </span>
        </div>
      )}
    </Section>
  )
}

/** everyone else's part, person by person — what each one has open here, and when it's due */
export function WhosOnWhat({ job, setTab }: { job: Job; setTab: SetTab }) {
  const s = useStore()
  const rows = todoRows(s, job, setTab).filter((r) => !isProblem(r) && r.group !== 'mine')
  const me = meOf(s.role)
  const [adding, setAdding] = React.useState(false)
  const steps = isGettingReady(job) ? stepsFor(s, job) : []
  const work = rows.filter((r) => r.group !== 'coming')
  const coming = rows.filter((r) => r.group === 'coming')
  const people = Array.from(new Set(work.map((r) => r.who || ''))).map((who) => ({ who: (who || undefined) as PersonKey | undefined, items: work.filter((r) => (r.who || '') === who) }))
  people.sort((a, b) => Number(b.items.some((r) => r.late)) - Number(a.items.some((r) => r.late)) || b.items.length - a.items.length)
  return (
    <Section title="Who’s on what" count={work.length} right={work.length ? 'By person' : undefined}>
      {people.map((p) => (
        <div key={p.who || 'nobody'}>
          <div className="flex items-center gap-2.5 bg-[#eef0ee] px-5 py-1.5 max-sm:px-4">
            {p.who && PEOPLE[p.who] ? <Avatar who={p.who} size={22} plain className="bg-white" /> : <span className="inline-flex h-[1.375rem] w-[1.375rem] rounded-full border border-dashed border-[#c6ccd4]" />}
            <span className="min-w-0 flex-1 truncate text-[0.84375rem] font-bold text-ink">{!p.who ? 'Nobody yet' : p.who === me ? 'You' : firstName(p.who) || PEOPLE[p.who]?.name}{p.who && p.who !== me && PEOPLE[p.who]?.roleLabel ? <span className="ml-2 text-[0.75rem] font-medium text-muted">{PEOPLE[p.who]?.roleLabel}</span> : null}</span>
            <span className="shrink-0 text-[0.75rem] font-bold tnum text-ink">{p.items.length} open</span>
          </div>
          <div className="py-1">{p.items.map((r) => <PersonLine key={r.key} r={r} />)}</div>
        </div>
      ))}
      {coming.length > 0 && (
        <div>
          <Group label="Coming up" count={coming.length} />
          <div className="py-1">{coming.map((r) => <PersonLine key={r.key} r={r} />)}</div>
        </div>
      )}
      {!work.length && !coming.length && <Empty className="py-5">Nobody else has anything open here.</Empty>}
      {adding && steps.length ? <AddStep job={job} steps={steps} onDone={() => setAdding(false)} compact /> : (
        <div className="flex flex-wrap items-center gap-1 border-t border-line-2 px-3 py-1.5">
          <FootLink icon={<Plus />} onClick={() => s.open({ t: 'newtask', jobId: job.id })}>Add a task</FootLink>
          <FootLink icon={<CalendarDays />} onClick={() => s.open({ t: 'record', jobId: job.id, type: 'meeting' })}>Add a meeting</FootLink>
          {steps.length > 0 && <FootLink icon={<ListPlus />} onClick={() => setAdding(true)}>Add a step for this project</FootLink>}
        </div>
      )}
    </Section>
  )
}
const FootLink = ({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[0.8125rem] font-semibold text-muted transition hover:bg-wash hover:text-ink [&_svg]:h-4 [&_svg]:w-4">{icon}{children}</button>
)
/** one line under a person: the mark, what it is (and a word on where it stands), when */
function PersonLine({ r }: { r: TodoRow }) {
  return (
    <button onClick={r.run} disabled={!r.run} className="group grid w-full grid-cols-[1.125rem_minmax(0,1fr)_6.5rem] items-center gap-2.5 py-1.5 pl-[3.5rem] pr-5 text-left transition hover:bg-[#f8f9fb] disabled:cursor-default max-sm:pl-12 max-sm:pr-4">
      <span className="flex justify-center"><RowMark m={r.mark} size={18} /></span>
      <span className="min-w-0 truncate text-[0.875rem] text-ink"><span className="font-medium group-hover:underline">{r.title}</span>{r.note ? <span className="ml-1.5 text-muted">· {r.note}</span> : null}</span>
      <span className={cn('truncate text-right text-[0.8125rem] tnum', r.late ? 'font-semibold text-bad-600' : 'text-ink-2')}>{r.when === '—' ? '' : r.when}</span>
    </button>
  )
}
/* ================= the facts ================= */
/* No colored dots to decode: every fact is a plain line. Only a problem turns red — and then it says what, in words.
 * Something someone has to do is said in plain darker words. */
type Flag = { text: string; tone: 'bad' | 'warn' }
type Fact = { icon: React.ReactNode; label: string; value: string; sub?: string; flag?: Flag; tab: string }
export function AtAGlance({ job, setTab }: { job: Job; setTab: SetTab }) {
  const s = useStore()
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id && p.status !== 'Rejected') || [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const b = s.bookings.find((x) => x.jobId === job.id)
  const start = job.dates?.start ? `${job.dates.start} – ${job.dates.finish}` : b ? `${md(b.start)} – ${md(b.end)}` : s.prep[job.id]?.targetISO ? `Starts ${labelFromIso(s.prep[job.id]!.targetISO!)}` : 'No dates yet'
  const tiles = tilesOf(job.id)
  const sts = tiles.map((t) => ({ t, st: tileStatus(s, job.id, t.tag) })).filter((x) => x.st.label !== 'Not on a wall or floor yet')
  const worst = sts.find((x) => x.st.tone === 'bad') || sts.find((x) => x.st.tone === 'warn')
  const here = sts.filter((x) => x.st.tone === 'ok').length
  const ms = materialStatus(s, job.id)
  const m = billingOf(job)
  const r = ipo && ipo.status !== 'Rejected' ? poRatio(s, ipo) : undefined
  const dep = s.money.find((x) => x.jobId === job.id && x.kind === 'deposit')
  const lower = (x: string) => x.charAt(0).toLowerCase() + x.slice(1)
  const facts: Fact[] = [
    {
      icon: <HardHat />, label: 'Installer', tab: 'installer',
      value: crew ? PEOPLE[crew]?.name || firstName(crew) : 'Not picked yet',
      sub: crew ? `${start} · ${!ipo ? 'no PO yet' : ipo.status === 'Accepted' ? 'took his PO' : ipo.status === 'Sent' ? 'PO sent, waiting for his yes' : 'PO not sent yet'}` : undefined,
      flag: !crew ? { text: 'Pick who installs it', tone: 'warn' } : ipo?.status === 'Rejected' ? { text: `He turned the PO down${ipo.reason ? ` — ${lower(ipo.reason)}` : ''}`, tone: 'bad' } : ipo?.status === 'Draft' ? { text: `${start} · PO not sent yet`, tone: 'warn' } : undefined,
    },
    (() => {
      const bud = budgetOf(s, job)
      if (!r) return { icon: <FileText />, label: 'His PO', tab: 'orders', value: 'No PO yet', sub: bud.sold ? `Keep it under ${fmtMoney(bud.cap)} — ${bud.line}% of our ${fmtMoney(bud.sold)}` : undefined }
      if (!r.total) return { icon: <FileText />, label: 'His PO', tab: 'orders', value: 'No prices on it yet', flag: { text: 'Put his prices on the PO to compare it with our estimate', tone: 'warn' as const } }
      return {
        icon: <FileText />, label: 'His PO', tab: 'orders',
        value: r.sold ? `${r.pct}% of our estimate` : fmtMoney(r.total),
        sub: r.sold ? `${fmtMoney(r.total)} of ${fmtMoney(r.sold)} · keep it under ${r.line}%` : 'No estimate to compare with',
        flag: r.sold && r.over ? { text: `Over the ${r.line}% line — ${fmtMoney(r.total)} of ${fmtMoney(r.sold)}`, tone: 'bad' as const } : undefined,
      }
    })(),
    roomsFact(s, job),
    {
      icon: <Grid2x2 />, label: 'Tile', tab: 'scope',
      value: tiles.length ? `${tiles.length} tile${tiles.length === 1 ? '' : 's'}` : 'No tiles yet',
      sub: !tiles.length ? 'They come in with the paperwork' : sts.length && here === sts.length ? 'All on site' : `${here} of ${tiles.length} on site`,
      flag: worst ? { text: `${worst.t.tag}: ${lower(worst.st.label)}`, tone: worst.st.tone === 'bad' ? 'bad' : 'warn' } : undefined,
    },
    {
      icon: <Package />, label: 'Materials', tab: 'orders',
      value: ms.state === 'yes' ? 'On site' : ms.state === 'wait' ? 'Ordered' : ms.label === 'Add SF' || ms.label === 'No scope' ? 'Not worked out yet' : ms.label,
      sub: ms.label === 'Add SF' ? 'Needs the square feet first' : ms.label === 'No scope' ? 'Needs the rooms first' : ms.go === 'order' ? undefined : ms.hint,
      flag: ms.go === 'order' ? { text: ms.hint.split(' — ')[0], tone: 'warn' } : undefined,
    },
    ...(s.role !== 'site' ? [{
      icon: <Wallet />, label: 'Billing', tab: 'money',
      value: m.contract ? fmtMoney(m.contract + m.changes) : 'No contract yet',
      sub: `${m.billedPct}% billed · ${m.paidPct}% paid`,
      flag: m.toBill > 0 ? { text: `${fmtMoney(m.toBill)} ready to bill · ${m.billedPct}% billed so far`, tone: 'warn' as const } : dep && dep.state !== 'paid' && isGettingReady(job) ? { text: dep.step >= 1 ? `Deposit invoiced${dep.ref ? ` (${dep.ref})` : ''} — not paid yet` : 'Deposit not invoiced yet', tone: 'warn' as const } : undefined,
    }] : []),
  ]
  return (
    <Section title="At a glance">
      {facts.map((x) => (
        <button key={x.label} onClick={() => setTab(x.tab)} className="group grid w-full grid-cols-[1rem_5.25rem_minmax(0,1fr)] items-start gap-x-3 border-t border-line-2 px-5 py-2.5 text-left first:border-t-0 hover:bg-[#f8f9fb] max-sm:px-4">
          <span className="mt-0.5 inline-flex text-faint transition group-hover:text-ink-2 [&_svg]:h-4 [&_svg]:w-4">{x.icon}</span>
          <span className="pt-px text-[0.8125rem] font-medium text-muted">{x.label}</span>
          <span className="min-w-0">
            <span className="block truncate text-[0.875rem] font-semibold text-ink">{x.value}</span>
            {x.flag
              ? <span className={cn('block text-[0.78125rem] leading-snug', x.flag.tone === 'bad' ? 'font-semibold text-bad-600' : 'font-medium text-ink-2')}>{x.flag.text}</span>
              : x.sub && <span className="block text-[0.78125rem] leading-snug text-muted">{x.sub}</span>}
          </span>
        </button>
      ))}
    </Section>
  )
}

/** the rooms, as one fact: how much there is to tile — or, once the crew is on it, how far it is */
function roomsFact(s: Store, job: Job): Fact {
  const rooms = s.rooms[job.id] || []
  const flat = rooms.flatMap((r) => r.surfaces).filter((x) => takesTile(x.name))
  const sf = flat.reduce((n, x) => n + (x.sf || 0), 0)
  if (!rooms.length) return { icon: <Ruler />, label: 'Rooms', value: 'No rooms yet', flag: { text: 'They come from the estimate — or build them on What we’re tiling', tone: 'warn' }, tab: 'scope' }
  if (IN_FIELD.includes(job.stage)) {
    const done = rooms.filter((r) => (r.pct ?? roomPct(r)) >= 100).length
    return { icon: <Ruler />, label: 'Installed', value: `${job.pct ?? 0}%`, sub: `${done} of ${rooms.length} rooms done`, tab: 'scope' }
  }
  const noTile = flat.filter((x) => !x.tile).length
  const noSF = flat.filter((x) => !x.sf).length
  return {
    icon: <Ruler />, label: 'Rooms', tab: 'scope',
    value: `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}`,
    sub: `${flat.length} walls and floors`,
    flag: noTile ? { text: `${noTile} wall${noTile === 1 ? '' : 's'} or floor${noTile === 1 ? '' : 's'} without a tile`, tone: 'warn' } : noSF ? { text: `${noSF} without square feet`, tone: 'warn' } : undefined,
  }
}

/* ================= what we're tiling, room by room ================= */
export function TilingCard({ job, setTab }: { job: Job; setTab: SetTab }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const inField = IN_FIELD.includes(job.stage)
  const sf = rooms.reduce((n, r) => n + r.surfaces.reduce((m, x) => m + (takesTile(x.name) ? x.sf || 0 : 0), 0), 0)
  const groups = floorsOf(rooms)
  return (
    <Section title="What we’re tiling" sub={inField ? `${job.pct ?? 0}% installed` : `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}`} action={<Button size="sm" variant="ghost" onClick={() => setTab('scope')}>Every wall and floor</Button>}>
      {groups.map((g) => (
        <div key={g.floor}>
          {(groups.length > 1 || g.floor !== 'Rooms') && <Group label={g.floor} />}
          {g.rooms.map((r) => {
            const tags = Array.from(new Set(r.surfaces.map((x) => x.tile).filter(Boolean))) as string[]
            const rsf = r.surfaces.reduce((n, x) => n + (takesTile(x.name) ? x.sf || 0 : 0), 0)
            const pct = r.pct ?? roomPct(r)
            return (
              <button key={r.name} onClick={() => s.open({ t: 'room', jobId: job.id, room: r.name })} className="grid w-full grid-cols-[minmax(0,1fr)_3.5rem_4rem] items-center gap-2.5 border-t border-line-2 px-5 py-2.5 text-left first:border-t-0 hover:bg-[#f8f9fb] max-sm:px-4">
                <span className="min-w-0">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink">{r.name}</span>
                  <span className="block truncate text-[0.78125rem] text-muted">{r.surfaces.filter((x) => takesTile(x.name)).map((x) => x.name.toLowerCase()).join(', ') || 'No walls or floors yet'}</span>
                </span>
                <span className="flex justify-end -space-x-1.5">{tags.slice(0, 3).map((t) => { const tt = tileOf(job.id, t); return tt ? <TileImg key={t} tile={tt} size={20} radius={10} className="ring-2 ring-white" /> : null })}</span>
                {inField
                  ? <span className="flex items-center justify-end gap-1.5"><span className="h-1.5 w-7 overflow-hidden rounded-full bg-wash-2"><span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-ok-500' : 'bg-brand-500')} style={{ width: `${Math.max(4, pct)}%` }} /></span><span className="w-8 text-right text-[0.78125rem] font-semibold tnum text-ink-2">{pct}%</span></span>
                  : <span className={cn('text-right text-[0.8125rem] font-semibold tnum', rsf ? 'text-ink-2' : 'text-faint')}>{rsf ? `${rsf.toLocaleString('en-US')} SF` : '—'}</span>}
              </button>
            )
          })}
        </div>
      ))}
      {!rooms.length && <Empty>No rooms yet — they come from the estimate.</Empty>}
    </Section>
  )
}

/* ================= the project's estimate ================= */
export function EstimateTab({ job }: { job: Job }) {
  const s = useStore()
  const ests = s.estimates.filter((e) => e.jobId === job.id)
  const cos = s.money.filter((m) => m.jobId === job.id && m.kind === 'change')
  const main = ests.find((e) => e.status === 'approved') || ests[0]
  const total = main ? revTotal(curRev(main)) : 0
  /* the same numbers as Billing: changes approved before Tile OS count too */
  const pic = billingOf(job)
  const yes = cos.filter((m) => m.step >= 0 && m.amount)
  const waiting = cos.filter((m) => m.step < 0)
  const before = job.before?.changes || 0
  return (
    <div className="flex flex-col gap-4">
      <Strip stats={[
        { label: 'Estimate', value: total ? fmtMoney(total) : '—', sub: main ? `${main.id}${main.approvedOn ? ` · approved ${main.approvedOn}` : ''}` : 'Priced before Tile OS' },
        { label: 'Approved changes', value: `+${fmtMoney(pic.changes)}`, sub: `${yes.length + (before ? 1 : 0)} change${yes.length + (before ? 1 : 0) === 1 ? '' : 's'}` },
        { label: 'Waiting for a yes', value: fmtMoney(pic.pending), sub: waiting.length ? `${waiting.length} change order${waiting.length === 1 ? '' : 's'}` : 'None waiting' },
        { label: 'Contract now', value: fmtMoney((pic.contract || total) + pic.changes), sub: 'The contract and approved changes' },
      ]} />
      <Section title="The estimate" count={ests.length}>
        {ests.map((e) => <EstRow key={e.id} e={e} />)}
        {!ests.length && <Empty>No estimate in the system for this project — it was priced before Tile OS. The contract is on Billing.</Empty>}
      </Section>
      <Section title="Change orders" count={cos.length + (before ? 1 : 0)} action={<Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'sitechange', jobId: job.id })}>Client wants a change</Button>}>
        {cos.map((m) => (
          <button key={m.id} onClick={() => s.open({ t: 'money', id: m.id })} className="grid min-h-[3rem] w-full grid-cols-[minmax(0,1fr)_7rem_9rem] items-center gap-3 border-t border-line-2 px-5 py-2 text-left first:border-t-0 hover:bg-[#f8f9fb] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:px-4">
            <span className="min-w-0"><span className="block truncate text-[0.875rem] font-semibold text-ink">{m.title}</span><span className="block truncate text-[0.78125rem] text-muted">{[m.ref, m.due].filter(Boolean).join(' · ') || '—'}</span></span>
            <span className="text-right text-[0.875rem] font-semibold tnum text-ink max-sm:hidden">{fmtMoney(m.amount || m.meta?.estimate || 0)}</span>
            <span className="flex justify-end"><Word tone={m.state === 'paid' ? 'ok' : m.step < 0 ? undefined : 'ok'}>{m.state === 'paid' ? 'Paid' : m.step < 0 ? 'Waiting for a yes' : m.state === 'waiting' ? 'Billed' : 'Approved'}</Word></span>
          </button>
        ))}
        {before > 0 && (
          <div className="grid min-h-[3rem] grid-cols-[minmax(0,1fr)_7rem_9rem] items-center gap-3 border-t border-line-2 px-5 py-2 first:border-t-0 max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:px-4">
            <span className="min-w-0"><span className="block truncate text-[0.875rem] font-semibold text-ink">Approved before Tile OS</span><span className="block truncate text-[0.78125rem] text-muted">Put in with what was already billed</span></span>
            <span className="text-right text-[0.875rem] font-semibold tnum text-ink max-sm:hidden">{fmtMoney(before)}</span>
            <span className="flex justify-end"><Word tone="ok">Approved</Word></span>
          </div>
        )}
        {!cos.length && !before && <Empty>No changes from the estimate.</Empty>}
      </Section>
    </div>
  )
}
function EstRow({ e }: { e: Estimate }) {
  const s = useStore()
  const r = curRev(e)
  const c = CAT[catOf(e)]
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_7.5rem_7rem_auto] items-center gap-3 border-t border-line-2 px-5 py-3 first:border-t-0 max-md:grid-cols-[2.25rem_minmax(0,1fr)_auto] max-sm:px-4">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-wash-2 text-ink-2"><FileText className="h-[1.125rem] w-[1.125rem]" /></span>
      <span className="min-w-0">
        <span className="block truncate text-[0.90625rem] font-semibold text-ink">{e.id}{e.revs.length > 1 ? ` · Revision ${r?.n}` : ''}</span>
        <span className="block truncate text-[0.78125rem] text-muted">{r?.lines.length || 0} lines{e.approvedOn ? ` · approved ${e.approvedOn}` : ''}</span>
      </span>
      <span className="flex justify-end max-md:hidden"><Word tone={c.tone}>{c.label}</Word></span>
      <span className="text-right text-[0.9375rem] font-semibold tnum text-ink max-md:hidden">{fmtMoney(revTotal(r))}</span>
      <span className="flex justify-end gap-1.5">
        <Button size="sm" onClick={() => s.open({ t: 'sow', jobId: e.jobId, estId: e.id })}>Scope of work</Button>
        <Button size="sm" variant="primary" onClick={() => s.open({ t: 'estimate', id: e.id })}>Open</Button>
      </span>
    </div>
  )
}

/* ================= the project's own details ================= */
export function EditProjectModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const j = s.jobs[id]
  const [name, setName] = React.useState(j?.name || '')
  const [address, setAddress] = React.useState(j?.address || '')
  const [clientId, setClientId] = React.useState(j?.clientId || '')
  const [po, setPo] = React.useState(j?.clientPO || '')
  const [contract, setContract] = React.useState(j?.contract ? String(j.contract) : '')
  if (!j) return null
  const clients = Object.values(s.clients)
  const ok = !!name.trim() && !!clientId
  const save = () => {
    const c = s.clients[clientId] || CUSTOMERS[clientId]
    s.commit((st) => {
      const x = st.jobs[id]
      if (!x) return
      const was = x.name
      x.name = name.trim()
      x.address = address.trim()
      x.clientId = clientId
      x.client = c?.name || x.client
      x.clientPO = po.trim() || undefined
      const n = Math.round(Number(contract.replace(/[^\d.]/g, '')))
      if (n > 0) x.contract = n
      ;(st.hist[id] ||= []).unshift({ date: md(TODAY), who: meOf(st.role), kind: 'setup', title: 'Project details changed', detail: was !== x.name ? `Was “${was}”` : undefined } as any)
    }, 'Saved', { close: true })
  }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Project details"
      sub={j.name}
      footer={<><Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button><Button variant="primary" icon={<Check />} disabled={!ok} onClick={save}>Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Field label="Project name"><TextInput data-autofocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Address"><TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" /></Field>
        <Field label="Client">
          <SearchSelect label="Client" value={clientId} onChange={setClientId} options={clients.map((c) => ({ key: c.id, label: c.name, hint: c.kind }))} placeholder="Pick the client" icon={<Building2 />} width={380} search />
        </Field>
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Their PO or contract number"><TextInput value={po} onChange={(e) => setPo(e.target.value)} placeholder="Optional" /></Field>
          <Field label="Contract amount"><TextInput inputMode="decimal" value={contract} onChange={(e) => setContract(e.target.value)} placeholder="From the estimate" /></Field>
        </div>
      </div>
    </Modal>
  )
}
export const EditButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button onClick={onClick} aria-label={label} title={label} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-wash hover:text-ink"><Pencil className="h-4 w-4" /></button>
)
