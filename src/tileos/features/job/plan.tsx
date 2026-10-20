/* The project at a glance, read the same way on every project:
 *   the path on top — every part of the project in order (the paperwork, the design meeting, the site, the installer,
 *     the deliveries, then installing, touch-ups, billed and closed), drawn like an estimate's: done, going on, a
 *     problem; who has it now and how many of its steps are done. Click a part and only that part's steps open.
 *   To do — everything open on the project, in four groups (your turn, others, waiting, coming up), every row on the
 *     same grid: what · who · when · one button.
 *   At a glance — the five facts, each in the same shape. Scope of work — the rooms.
 * Plus the project's estimate, and changing the project's own details. */
import * as React from 'react'
import { FileText, Pencil, Check, Building2, Plus, CalendarDays, HardHat, TriangleAlert, ListTodo, ClipboardList, Paperclip, MessageCircle, Wrench, StickyNote, Grid2x2, Package, Wallet, Ruler, UserRound, Users, ChevronRight } from 'lucide-react'
import { useStore, meOf, historyOf, type Store } from '@/tileos/store'
import { Button, TextInput, Field } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { Status, Path } from '@/tileos/components/ui/page'
import { SearchSelect } from '@/tileos/components/ui/select'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey, type Tone } from '@/tileos/data/model'
import { tilesOf, tileOf, floorsOf, roomPct, CUSTOMERS, filesFor } from '@/tileos/data/jobs'
import { curRev, revTotal, type Estimate } from '@/tileos/data/estimates'
import { timeLabel } from '@/tileos/data/calendar'
import { TODAY, NOW, labelFromIso, isoFromLabel, md } from '@/tileos/lib/today'
import { isGettingReady, stepsFor, stepCounts, takesTile, realOwner, SITE_CHECKS, type StepView } from '../steps'
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
import { ViewSwitch } from '@/tileos/components/ui/page'
import { useSaveStatus } from '@/tileos/lib/save'
import { unreadOf } from '../messages'
import { allowedFor } from '../newpicker'

const PRICING = ['request', 'estimating', 'proposal', 'followup']
const IN_FIELD = ['installation', 'punch', 'closeout', 'complete']
type SetTab = (t: any) => void

/* ================= the bar on top ================= */
export type PhaseState = 'done' | 'active' | 'wait' | 'bad' | 'todo'
export type PhaseCell = { key: string; label: string; short?: string; state: PhaseState; frac: number; who?: PersonKey; line: string; lineTone?: 'bad'; said?: string; onClick?: () => void }
export function projectPath(s: Store, job: Job, setTab?: SetTab): PhaseCell[] {
  /* four parts, left to right: getting it ready (the whole checklist behind it), installing, touch-ups, billed */
  const ready = isGettingReady(job)
  const past = !ready && !PRICING.includes(job.stage)
  const steps = ready ? stepsFor(s, job).filter((v) => v.state !== 'na') : []
  const done = steps.filter((v) => v.state === 'done').length
  const nBad = steps.filter((v) => v.state === 'bad').length
  const bad = nBad > 0
  const st = job.stage
  const b = s.bookings.find((x) => x.jobId === job.id)
  const start = job.dates?.start || (b ? md(b.start) : s.prep[job.id]?.targetISO ? labelFromIso(s.prep[job.id]!.targetISO!) : undefined)
  /* the day it was meant to start has gone by and nobody's tiling yet — say so, in red */
  const startIso = b?.start || s.prep[job.id]?.targetISO
  const lateStart = !!startIso && startIso < TODAY && !IN_FIELD.includes(st) && !PRICING.includes(st)
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const punchOpen = punch.filter((p) => p.status !== 'verified').length
  const money = s.role !== 'site'
  const billed = money ? billingOf(job).billedPct : 0
  const fieldDone = ['punch', 'closeout', 'complete'].includes(st)
  return [
    {
      key: 'ready', label: 'Getting ready', short: 'Ready',
      state: past ? 'done' : !ready ? 'todo' : bad ? 'bad' : 'active',
      frac: past ? 1 : steps.length ? done / steps.length : 0,
      line: past ? 'Done' : ready ? (bad ? `${nBad} problem${nBad === 1 ? '' : 's'}` : `${done} of ${steps.length} done`) : '',
      said: ready ? `${done} of ${steps.length} done${bad ? `, ${nBad} problem${nBad === 1 ? '' : 's'}` : ''}` : undefined,
      onClick: setTab ? () => setTab('ready') : () => s.open({ t: 'checklist', jobId: job.id }),
    },
    {
      key: 'install', label: 'Installing',
      state: st === 'installation' ? 'active' : fieldDone ? 'done' : 'todo',
      frac: st === 'installation' ? (job.pct ?? 0) / 100 : fieldDone ? 1 : 0,
      line: st === 'installation' ? `${job.pct ?? 0}% installed` : fieldDone ? 'Done' : start ? (lateStart ? `Late · ${start}` : `Starts ${start}`) : '',
      lineTone: lateStart && st !== 'installation' && !fieldDone ? 'bad' : undefined,
      onClick: setTab ? () => setTab('install') : undefined,
    },
    {
      key: 'punch', label: 'Touch-ups',
      state: punchOpen ? 'active' : st === 'punch' || ['closeout', 'complete'].includes(st) ? 'done' : 'todo',
      frac: punch.length ? (punch.length - punchOpen) / punch.length : ['closeout', 'complete'].includes(st) ? 1 : 0,
      line: punchOpen ? `${punchOpen} open` : st === 'punch' ? 'All fixed' : ['closeout', 'complete'].includes(st) ? 'Done' : '',
      onClick: setTab ? () => setTab('punch') : () => s.open({ t: 'touchups', jobId: job.id }),
    },
    {
      key: 'close', label: money ? 'Billed and paid' : 'Closed', short: money ? 'Billed' : 'Closed',
      state: st === 'complete' ? 'done' : st === 'closeout' ? 'active' : 'todo',
      frac: st === 'complete' ? 1 : billed / 100,
      line: st === 'complete' ? 'Done' : money && billed ? `${billed}% billed` : '',
      onClick: setTab && money ? () => setTab('money') : undefined,
    },
  ]
}

/** how much of the whole project is done — every part counts the same, so it's exactly how much of the bar is filled */
export const overallPct = (cells: PhaseCell[]) => Math.round((cells.reduce((n, c) => n + (c.state === 'done' ? 1 : Math.max(0, Math.min(1, c.frac))), 0) / Math.max(1, cells.length)) * 100)

/** every part of the project, left to right — the same path as an estimate: a check once a part is done, a blue ring
 *  where work is going on, red for a problem, the name of who has it, and how far it is. Click a part to open its steps. */
export function PhaseBar({ cells, at }: { cells: PhaseCell[]; at?: string }) {
  const me = meOf(useStore((s) => s.role))
  return (
    <Path
      label="Where the project is"
      at={at}
      className="pt-1"
      steps={cells.map((c) => {
        const who = c.state !== 'done' && c.who && PEOPLE[c.who] ? (c.who === me ? 'You' : firstName(c.who)) : undefined
        return {
          key: c.key,
          label: c.label,
          short: c.short,
          state: c.state === 'done' ? 'done' as const : c.state === 'bad' ? 'blocked' as const : c.state === 'active' || c.state === 'wait' ? 'current' as const : 'future' as const,
          date: c.line || undefined,
          dateTone: c.lineTone,
          onClick: c.onClick,
          aria: `${c.label} — ${c.state === 'done' ? 'done' : [c.said || c.line, who].filter(Boolean).join(', ') || 'not started'}`,
        }
      })}
    />
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
export type TodoRow = { key: string; group: GroupKey; mark: Mark; title: string; note?: string; noteTone?: 'bad' | 'warn' | 'ok'; who?: PersonKey; people?: PersonKey[]; when: string; late?: boolean; run?: () => void }
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
    /* the site check with something not ready on site: each thing is its own line — "Water on site · not on yet" */
    const notReady = v.key === 'heights' && v.state === 'bad' ? Object.entries(s.stepRecs[job.id]?.heights?.checks || {}).filter(([, c]) => !c.ok) : []
    if (notReady.length) {
      notReady.forEach(([k, c]) => rows.push({ key: 's:heights:' + k, group: turn(v.owner, true, false), mark: { kind: 'step', state: 'bad' }, title: SITE_CHECKS.find((x) => x.k === k)?.label || k, note: c.note ? `Not ready — ${c.note}` : 'Not ready yet', noteTone: 'bad', who: v.owner, when: w.when, late: w.late, run: () => openStep(job.id, v.key) }))
      return
    }
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
  /* the touch-ups: one line for the whole list (it opens the list — every touch-up its own line) */
  const pun = s.punch.filter((p) => p.jobId === job.id && p.status !== 'verified')
  if (pun.length) {
    const doing = pun.filter((p) => p.status !== 'verify')
    const listTask = s.tasks.find((t) => t.jobId === job.id && t.action?.kind === 'tab:touchups' && t.state !== 'done')
    const who = realOwner(s, (doing.length ? doing[0].owner : listTask?.owner || site || 'ys') as PersonKey)
    const waits = doing.filter((p) => /^waiting/i.test(p.note || '')).length
    const iso = isoFromLabel(listTask?.due)
    const w = iso ? dueWords(iso) : { when: '—', late: false }
    rows.push({
      key: 'touchups', group: turn(who, false, false), mark: { kind: 'task', waiting: false },
      title: `Touch-ups · ${doing.length ? `${doing.length} to do` : `${pun.length} to check`}`,
      note: [doing.slice(0, 2).map((p) => p.text).join(' · ') + (doing.length > 2 ? ' …' : ''), pun.length > doing.length && doing.length ? `${pun.length - doing.length} to check` : '', waits ? `${waits} waiting` : ''].filter(Boolean).join(' · '),
      who, when: w.when, late: w.late, run: () => s.open({ t: 'touchups', jobId: job.id }),
    })
  }
  lines.forEach((l) => {
    if (l.it?.key === 'punch' || l.task?.action?.kind === 'tab:touchups') return
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
      const problem = t.tone === 'bad'
      const note = waiting ? `Waiting on ${t.waitingOn}${t.followUp ? ` · back ${t.followUp}` : ''}` : problem ? t.detail || t.where || undefined : t.where || undefined
      rows.push({ key: 't:' + t.id, group: turn(who, problem, waiting), mark: problem ? { kind: 'item', status: 'bad' } : { kind: 'task', waiting }, title: t.title, note, noteTone: problem ? 'bad' : waiting ? 'warn' : undefined, who, when: w.when, late: w.late, run: () => s.open({ t: 'task', id: t.id }) })
    } else if (l.ev) {
      const e = l.ev
      if (ready && stepMeeting(e)) return
      rows.push({ key: 'e:' + e.id, group: 'coming', mark: { kind: 'meet' }, title: e.title, note: e.with ? `With ${e.with}` : undefined, who: e.people[0], people: e.people, when: `${labelFromIso(e.date)} · ${timeLabel(e.start)}`, run: () => s.open({ t: 'event', id: e.id }) })
    }
  })
  const rank = (r: TodoRow) => (r.mark.kind === 'step' && r.mark.state === 'bad') || (r.mark.kind === 'item' && r.mark.status === 'bad') ? 0 : r.late ? 1 : 2
  return rows.sort((a, b) => rank(a) - rank(b))
}

function RowMark({ m, size = 24 }: { m: Mark; size?: number }) {
  if (m.kind === 'step') return <StepIcon state={m.state} size={size} />
  if (m.kind === 'meet') return <span style={{ width: size, height: size }} className="inline-flex items-center justify-center rounded-full bg-[#ece8e1] text-ink-2"><CalendarDays className="h-3 w-3" /></span>
  if (m.kind === 'task') return <StepIcon state={m.waiting ? 'wait' : 'now'} size={size} />
  const st = m.status
  return <StepIcon state={st === 'bad' ? 'bad' : st === 'wait' ? 'wait' : st === 'done' ? 'done' : 'now'} size={size} />
}
/** one line of the to-do. The whole line opens it. Only the very first thing that's yours gets the blue "Start" —
 *  one obvious action, not a column of buttons. `noWho` when the list already says whose it is. */
function TodoLine({ r, primary, noWho }: { r: TodoRow; primary?: boolean; noWho?: boolean }) {
  const me = meOf(useStore((s) => s.role))
  /* on a phone the who and when move under the title */
  const lead = [!noWho && r.who ? (r.who === me ? 'You' : firstName(r.who)) : '', r.when !== '—' ? r.when : ''].filter(Boolean).join(' · ')
  return (
    <button onClick={r.run} disabled={!r.run} className={cn(ROW, noWho && 'grid-cols-[1.75rem_minmax(0,1fr)_7.25rem_5.75rem]', 'w-full text-left transition-colors hover:bg-[#f8f6f2] disabled:cursor-default disabled:hover:bg-transparent max-md:grid-cols-[1.75rem_minmax(0,1fr)_auto]')} data-todo={r.key}>
      <span className="flex justify-center"><RowMark m={r.mark} /></span>
      <span className="min-w-0">
        <span className="block text-[0.90625rem] font-semibold text-ink max-md:line-clamp-2 md:truncate">{r.title}</span>
        <span className={cn('block truncate text-[0.78125rem]', r.noteTone === 'bad' ? 'font-medium text-bad-600' : r.noteTone === 'ok' ? 'font-medium text-[#2c4a3e]' : 'text-muted')}>
          <span className="md:hidden">{lead}{lead && r.note ? ' · ' : ''}</span>{r.note || <span className="max-md:hidden">&nbsp;</span>}
        </span>
      </span>
      {!noWho && <Who who={r.who} className="max-md:hidden" />}
      <span className={cn('truncate text-right text-[0.8125rem] tnum max-md:hidden', r.late ? 'font-semibold text-bad-600' : 'text-ink-2')}>{r.when === '—' ? '' : r.when}</span>
      <span className="flex justify-end">{r.run && (primary
        ? <span className="inline-flex h-8 w-full items-center justify-center rounded-[0.5625rem] bg-brand-600 text-[0.8125rem] font-semibold text-white shadow-btn max-md:w-auto max-md:px-4">Start</span>
        : <ChevronRight className="h-4 w-4 text-faint" />)}</span>
    </button>
  )
}

/* ================= the overview: Next up, then who's on what ================= */
const isProblem = (r: TodoRow) => (r.mark.kind === 'step' && r.mark.state === 'bad') || (r.mark.kind === 'item' && r.mark.status === 'bad')
/* ================= what's happening on the job ================= */
/** What's open — everything open on the project, in one list, the way the office asks "what's going on there?":
 *  problems first (red), then what's late, what's someone's turn, what's waiting on someone outside, what's coming up.
 *  Every line says what it is, where it stands, whose desk it's on and when; tap it to act on it. Mine shows only
 *  yours (the site manager starts there); Everyone is the whole job. + Add puts something new on the list. */
export function WhatsOpen({ job, setTab }: { job: Job; setTab: SetTab }) {
  const s = useStore()
  const me = meOf(s.role)
  const rows = todoRows(s, job, setTab)
  const key = `tileos-project-todo:${s.role}`
  /* the owner looks after the whole project, so his starts on Everyone; everyone else starts on their own */
  const first: 'mine' | 'all' = s.role === 'owner' || s.role === 'pm' ? 'all' : 'mine'
  const [scope, setScope0] = React.useState<'mine' | 'all' | 'done'>(() => { try { const v = localStorage.getItem(key); return v === 'all' || v === 'mine' ? v : first } catch { return first } })
  /* Done isn't remembered — next time it opens on what's open */
  const setScope = (k: 'mine' | 'all' | 'done') => { setScope0(k); if (k !== 'done') try { localStorage.setItem(key, k) } catch { /* private window */ } }
  const done = doneRows(s, job)
  const isMine = (r: TodoRow) => r.who === me || !!r.people?.includes(me)
  const order = (r: TodoRow) => (isProblem(r) ? 0 : r.late ? 1 : r.group === 'mine' ? 2 : r.group === 'others' ? 3 : r.group === 'wait' ? 4 : 5)
  const mine = rows.filter(isMine)
  const list = scope === 'done' ? done : [...(scope === 'mine' ? mine : rows)].sort((a, b) => order(a) - order(b))
  const first1 = list.find((r) => r.group === 'mine' && r.run)?.key
  return (
    <Section
      title={scope === 'done' ? 'Done' : 'What’s open'}
      action={<>
        <ViewSwitch label="Whose to-do" value={scope} onChange={setScope} items={[{ key: 'mine', label: 'Mine', icon: <UserRound />, count: mine.length }, { key: 'all', label: 'Everyone', short: 'All', icon: <Users />, count: rows.length }, { key: 'done', label: 'Done', icon: <Check />, count: done.length }]} />
        <AddToProject job={job} />
      </>}
    >
      {list.map((r) => <TodoLine key={r.key} r={r} primary={r.key === first1} noWho={scope === 'mine'} />)}
      {!list.length && (
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 max-sm:px-4">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ok-500 text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.90625rem] font-semibold text-ink">{scope === 'done' ? 'Nothing finished yet' : scope === 'mine' ? 'Nothing for you on this project' : 'Nothing open on this project'}</span>
            <span className="block text-[0.78125rem] text-muted">{scope === 'done' ? 'Finished steps, tasks and touch-ups show up here.' : scope === 'mine' && rows.length ? `${rows.length} open for the others.` : 'All caught up.'}</span>
          </span>
          {scope === 'mine' && rows.length > 0 && <Button size="sm" onClick={() => setScope('all')}>See everyone’s</Button>}
        </div>
      )}
    </Section>
  )
}

/** what's done on the project — every finished step, task and touch-up, newest first, so nothing disappears */
export function doneRows(s: Store, job: Job): TodoRow[] {
  const rows: TodoRow[] = []
  const doneNote = (what: string, when?: string, who?: PersonKey) => ['Done', when, who && PEOPLE[who] ? `by ${PEOPLE[who].short}` : '', what].filter(Boolean).join(' · ')
  if (isGettingReady(job)) for (const v of stepsFor(s, job)) if (v.state === 'done') rows.push({ key: 'ds:' + v.key, group: 'coming', mark: { kind: 'step', state: 'done' }, title: v.label, note: doneNote(v.note || '', v.doneOn, v.doneBy), noteTone: 'ok', who: v.doneBy || v.owner, when: v.doneOn || '—', run: () => openStep(job.id, v.key) })
  for (const t of s.tasks) if (t.jobId === job.id && t.state === 'done') rows.push({ key: 'dt:' + t.id, group: 'coming', mark: { kind: 'step', state: 'done' }, title: t.title, note: doneNote(t.result || '', t.doneAt, t.owner), noteTone: 'ok', who: t.owner, when: t.doneAt || '—', run: () => s.open({ t: 'task', id: t.id }) })
  for (const p of s.punch) if (p.jobId === job.id && p.status === 'verified') rows.push({ key: 'dp:' + p.id, group: 'coming', mark: { kind: 'item', status: 'done' }, title: p.text, note: doneNote(`checked · ${p.where}`, undefined, p.owner), noteTone: 'ok', who: p.owner, when: '—', run: () => s.open({ t: 'touchups', jobId: job.id }) })
  return rows.reverse()
}

/** + Add — the few things you put on a project: a problem (tile came wrong, broken or short; the site isn't ready),
 *  a task, a meeting or walkthrough, a step just for this project */
export function AddToProject({ job }: { job: Job }) {
  const s = useStore()
  const [step, setStep] = React.useState(false)
  if (['accounting', 'client', 'crew'].includes(s.role)) return null
  const steps = isGettingReady(job) ? stepsFor(s, job) : []
  const canStep = steps.length > 0 && ['owner', 'pm', 'office', 'estimator'].includes(s.role)
  return (
    <>
      <Menu align="end" width={300} trigger={<Button size="sm" icon={<Plus />} aria-label="Add to this project"><span className="max-sm:hidden">Add</span></Button>}>
        <MenuLabel>Add to {job.name}</MenuLabel>
        <MenuItem icon={<TriangleAlert className="h-4 w-4" />} onSelect={() => s.open({ t: 'problem', jobId: job.id })} hint="Tile wrong, broken or short · site not ready">A problem</MenuItem>
        <MenuItem icon={<Wrench className="h-4 w-4" />} onSelect={() => s.open({ t: 'punchnew', jobId: job.id })} hint="The whole list at once — one per line">Touch-ups</MenuItem>
        <MenuItem icon={<StickyNote className="h-4 w-4" />} onSelect={() => s.open({ t: 'note', jobId: job.id })} hint="With photos or videos">A note</MenuItem>
        {allowedFor(s.role, 'task') && <MenuItem icon={<ListTodo className="h-4 w-4" />} onSelect={() => s.open({ t: 'newtask', jobId: job.id })}>A task</MenuItem>}
        {allowedFor(s.role, 'meeting') && <MenuItem icon={<CalendarDays className="h-4 w-4" />} onSelect={() => s.open({ t: 'record', jobId: job.id, type: 'meeting' })}>A meeting or walkthrough</MenuItem>}
        {canStep && <MenuItem icon={<ClipboardList className="h-4 w-4" />} onSelect={() => setStep(true)}>A step just for this project</MenuItem>}
      </Menu>
      {step && (
        <Modal level={8} size="sm" onClose={() => setStep(false)} title="A step just for this project" sub={job.name}>
          <AddStep job={job} steps={steps} onDone={() => setStep(false)} />
        </Modal>
      )}
    </>
  )
}

/** Latest — what happened on the job lately, newest first: deliveries, daily updates, meetings, decisions, problems.
 *  Everything that ever happened, the files and the messages are one tap away. */
export function Latest({ job }: { job: Job }) {
  const s = useStore()
  const save = useSaveStatus()
  const all = historyOf(s, job.id)
  const list = all.slice(0, 6)
  const files = s.files.filter((f) => f.jobId === job.id).length + (save.mode === 'sample' && save.where !== 'cloud' ? filesFor(job.id).length : 0)
  const unread = unreadOf(s, job.id)
  return (
    <Section title="Latest" action={all.length > list.length ? <button onClick={() => s.open({ t: 'history', jobId: job.id })} className="text-[0.8125rem] font-semibold text-brand-700 hover:underline">All {all.length}</button> : undefined}>
      {list.map((h, i) => (
        <button key={i} onClick={() => s.open({ t: 'activity', entry: h, jobId: job.id })} className="flex w-full items-start gap-3 border-t border-line-2 px-5 py-2.5 text-left transition-colors first:border-t-0 hover:bg-[#f8f6f2] max-sm:px-4">
          <span className="w-12 shrink-0 pt-px text-[0.75rem] font-medium tnum text-muted">{h.date === NOW ? 'Today' : h.date}</span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-[0.84375rem] leading-snug text-ink">{h.title}</span>
            <span className="block truncate text-[0.75rem] text-muted">{[PEOPLE[h.who]?.short, h.detail].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
      ))}
      {!list.length && <Empty className="py-6">Nothing yet — it fills in as things happen.</Empty>}
      <div className="flex flex-wrap items-center gap-1 border-t border-line-2 px-3 py-1.5">
        <FootLink icon={<Paperclip />} onClick={() => s.open({ t: 'files', jobId: job.id })}>Files and photos{files ? ` · ${files}` : ''}</FootLink>
        <FootLink icon={<MessageCircle />} onClick={() => s.open({ t: 'chat', jobId: job.id })}>Messages{unread ? ` · ${unread} new` : ''}</FootLink>
      </div>
    </Section>
  )
}
const FootLink = ({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[0.8125rem] font-semibold text-muted transition hover:bg-wash hover:text-ink [&_svg]:h-4 [&_svg]:w-4">{icon}{children}</button>
)

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
  const shownFacts = s.role === 'site' ? facts.filter((x) => x.label !== 'His PO') : facts
  return (
    <Section title="At a glance">
      {shownFacts.map((x) => (
        <button key={x.label} onClick={() => setTab(x.tab)} className="group grid w-full grid-cols-[1rem_5.25rem_minmax(0,1fr)] items-start gap-x-3 border-t border-line-2 px-5 py-2.5 text-left first:border-t-0 hover:bg-[#f8f6f2] max-sm:px-4">
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
  if (!rooms.length) return { icon: <Ruler />, label: 'Rooms', value: 'No rooms yet', flag: { text: 'They come from the estimate — or build them on Scope of work', tone: 'warn' }, tab: 'scope' }
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
    <Section title="Scope of work" sub={inField ? `${job.pct ?? 0}% installed` : `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}`} action={<Button size="sm" variant="ghost" onClick={() => setTab('scope')}>Every wall and floor</Button>}>
      {groups.map((g) => (
        <div key={g.floor}>
          {(groups.length > 1 || g.floor !== 'Rooms') && <Group label={g.floor} />}
          {g.rooms.map((r) => {
            const tags = Array.from(new Set(r.surfaces.map((x) => x.tile).filter(Boolean))) as string[]
            const rsf = r.surfaces.reduce((n, x) => n + (takesTile(x.name) ? x.sf || 0 : 0), 0)
            const pct = r.pct ?? roomPct(r)
            return (
              <button key={r.name} onClick={() => s.open({ t: 'room', jobId: job.id, room: r.name })} className="grid w-full grid-cols-[minmax(0,1fr)_3.5rem_4rem] items-center gap-2.5 border-t border-line-2 px-5 py-2.5 text-left first:border-t-0 hover:bg-[#f8f6f2] max-sm:px-4">
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

/* ================= the project's estimate and its changes (on the Money tab) ================= */
export function EstimateAndChanges({ job }: { job: Job }) {
  const s = useStore()
  const ests = s.estimates.filter((e) => e.jobId === job.id)
  const cos = s.money.filter((m) => m.jobId === job.id && m.kind === 'change')
  const before = job.before?.changes || 0
  const canChange = s.role !== 'accounting'
  return (
    <Section title="Estimate and changes" count={ests.length + cos.length + (before ? 1 : 0)} action={canChange ? <Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'sitechange', jobId: job.id })}>Client wants a change</Button> : undefined}>
      {ests.map((e) => <EstRow key={e.id} e={e} />)}
      {!ests.length && <Empty>No estimate in the system for this project — it was priced before Tile OS.</Empty>}
      {cos.map((m) => (
        <button key={m.id} onClick={() => s.open({ t: 'money', id: m.id })} className="grid min-h-[3rem] w-full grid-cols-[2.25rem_minmax(0,1fr)_7rem_9rem] items-center gap-3 border-t border-line-2 px-5 py-2 text-left hover:bg-[#f8f6f2] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:px-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-wash-2 text-ink-2 max-sm:hidden"><Pencil className="h-4 w-4" /></span>
          <span className="min-w-0"><span className="block truncate text-[0.875rem] font-semibold text-ink">{m.title}</span><span className="block truncate text-[0.78125rem] text-muted">{[m.ref, m.due].filter(Boolean).join(' · ') || '—'}</span></span>
          <span className="text-right text-[0.875rem] font-semibold tnum text-ink max-sm:hidden">{fmtMoney(m.amount || m.meta?.estimate || 0)}</span>
          <span className="flex justify-end"><Word tone={m.state === 'paid' ? 'ok' : m.step < 0 ? undefined : 'ok'}>{m.state === 'paid' ? 'Paid' : m.step < 0 ? 'Waiting for a yes' : m.state === 'waiting' ? 'Billed' : 'Approved'}</Word></span>
        </button>
      ))}
      {before > 0 && (
        <div className="grid min-h-[3rem] grid-cols-[2.25rem_minmax(0,1fr)_7rem_9rem] items-center gap-3 border-t border-line-2 px-5 py-2 max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:px-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-wash-2 text-ink-2 max-sm:hidden"><Check className="h-4 w-4" /></span>
          <span className="min-w-0"><span className="block truncate text-[0.875rem] font-semibold text-ink">Changes approved before Tile OS</span><span className="block truncate text-[0.78125rem] text-muted">Put in with what was already billed</span></span>
          <span className="text-right text-[0.875rem] font-semibold tnum text-ink max-sm:hidden">{fmtMoney(before)}</span>
          <span className="flex justify-end"><Word tone="ok">Approved</Word></span>
        </div>
      )}
    </Section>
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
      <span className="flex justify-end"><Button size="sm" onClick={() => s.open({ t: 'estimate', id: e.id })}>Open the estimate</Button></span>
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
