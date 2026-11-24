/* Where it stands — what's left on the project, by person: yours first, then whoever has the most urgent thing.
 *   Under each person, one line each — what · when — the most urgent first: a problem (red), what's late (red), then
 *   by the day, then in the order the work goes. What waits on someone outside is quiet.
 *   Each part of getting ready is one line — where it is now, in words (made → sent → accepted is one line that
 *   changes as it goes; its steps are inside its window). The project's tasks are lines the same way.
 *   What can't start yet, and what's done, aren't on it — just what's left.
 * Tap a line: that one thing in its own window — done there, it closes by itself; it never jumps to another step. */
import * as React from 'react'
import { ChevronRight, Plus, Sparkles } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { Filter } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { labelFromIso, isoFromLabel, TODAY } from '@/tileos/lib/today'
import { stepsFor, markStep, type StepView } from '../steps'
import { TITLE, todoOf } from '../stepwin'
import { tracksFor, issuesOf, problemsOf, leadWords, phaseOf, bookingOf, type TrackView } from '../tracks'
import { readyForCrew, startProject } from '../flows'
import { firstName } from './kit'
import { installerOf } from '../upcoming'
import { KindTag } from '../winhead'
import { tagOfTask, plainTodo, todosOf, touchupsWords, TOUCH_WORDS } from '../todokinds'

export type LeftRow = {
  key: string
  what: string
  /** what kind of thing it is — its tag (To do, Problem, Getting ready, Touch-ups…) */
  kind?: string
  who?: PersonKey
  when?: string
  /** the day, to sort by */
  iso?: string
  late?: boolean
  tone: 'bad' | 'now' | 'wait'
  open: () => void
  /** checked off right on the list — the step or the task it is */
  done: () => void
  /** no check on it — it's done in its window (scheduling the crew, booking the return visit) */
  noCheck?: boolean
  /** the project's next big thing (schedule the crew, start the job…) — first on the list */
  next?: boolean
}
/** the project's next big thing once getting ready is done — the first line of To do, not a box of its own:
 *  schedule the crew, start the job (its check starts it), book the return visit, send the final invoice */
export function nextRow(s: Store, job: Job): LeftRow | null {
  if (['client', 'crew', 'site'].includes(s.role)) return null
  const tracks = tracksFor(s, job)
  const phase = phaseOf(s, job, tracks)
  const b = bookingOf(s, job)
  const booked = job.stage === 'scheduled' || !!b
  const pm = 'ys' as PersonKey
  const noop = () => {}
  if (phase === 'crew' && !booked) return { key: 'next:crew', kind: 'Schedule', what: 'Schedule the crew', who: pm, when: 'Getting ready is done', tone: 'now', next: true, noCheck: true, open: () => { readyForCrew(job.id); s.open({ t: 'assign', jobId: job.id }) }, done: noop }
  if ((phase === 'crew' || phase === 'ready') && booked && b) return { key: 'next:start', kind: 'Schedule', what: 'Start the job', who: pm, iso: b.start, when: `Crew from ${labelFromIso(b.start)}`, tone: 'now', next: true, open: () => s.open({ t: 'assign', jobId: job.id }), done: () => startProject(job.id) }
  if (phase === 'punch') return { key: 'next:return', kind: 'Touch-ups', what: 'Book the return visit', who: pm, when: 'For the touch-ups', tone: 'now', next: true, noCheck: true, open: () => s.open({ t: 'assign', jobId: job.id }), done: noop }
  const fin = s.money.find((m) => m.jobId === job.id && m.kind === 'final')
  if (job.stage === 'closeout' && fin) return { key: 'next:final', kind: 'Billing', what: 'Send the final invoice', who: pm, tone: 'now', next: true, noCheck: true, open: () => s.open({ t: 'money', id: fin.id }), done: noop }
  return null
}

/** whose it is: their little circle and their name ("You" for yours) — the same as on Estimates */
export function Whose({ who, size = 20, className }: { who?: PersonKey; size?: number; className?: string }) {
  const s = useStore()
  if (!who || !PEOPLE[who]) return <span className={className} />
  const me = meOf(s.role)
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)} data-whose={who}>
      <Avatar who={who} size={size} />
      <span className={cn('min-w-0 break-words text-[0.875rem] leading-tight', who === me ? 'font-medium text-ink' : 'text-ink-2')} data-who-name>{who === me ? 'You' : PEOPLE[who].short || firstName(who)}</span>
    </span>
  )
}

/** a step in words, the same everywhere (Today, Projects, a project's To do): what to do — or, with the installer
 *  already picked, "Send Leo his PO" */
export function stepWords(s: Store, job: Job, v: StepView): string {
  const crew = v.key === 'installer' ? installerOf(s, job) : undefined
  return crew ? `Send ${PEOPLE[crew]?.short || 'him'} his PO` : todoOf(v)
}

/** the steps a step keeps for itself ("Enter tile & grout" is part of "Enter the paperwork") */
const lead = (v: StepView, all: StepView[]) => (v.into ? all.find((x) => x.key === v.into) || v : v)
const cap = (t: string) => t.replace(/^./, (c) => c.toUpperCase())
/** a task's day ("Today", "Wed", "Nov 12", "3 days late") as a real day */
const taskIso = (d?: string) => (d ? isoFromLabel(d) : undefined)
/** since when it's been on them: the day the step before it was done (a task: the day it was made) */
const sinceStep = (v: StepView, all: StepView[], job: Job) => (v.after.map((k) => all.find((x) => x.key === k)?.doneOn).map((d) => (d ? isoFromLabel(d) : undefined)).filter(Boolean).sort().pop() as string | undefined) || (v.after.length && job.stageDates?.won ? isoFromLabel(job.stageDates.won) : undefined)
const sinceTask = (log?: { date: string }[]) => (log?.[0]?.date ? isoFromLabel(log[0].date) : undefined)
const sinceWords = (iso?: string) => (iso && iso <= TODAY ? (iso === TODAY ? 'Since today' : `Since ${labelFromIso(iso)}`) : undefined)

/** what's left on a project, one line each — for one person, or everyone */
export function leftRows(s: Store, job: Job, who: PersonKey | 'all' = 'all'): LeftRow[] {
  const steps = stepsFor(s, job)
  const tracks = tracksFor(s, job, steps)
  const rows: LeftRow[] = []
  const used = new Set<string>()
  const openStep = (k: string) => () => s.open({ t: 'step', jobId: job.id, k })
  const openTask = (id: string) => () => s.open({ t: 'task', id })
  const doneStep = (k: string) => () => markStep(job.id, k)
  const doneTask = (id: string) => () => useStore.getState().completeTask(id)
  /* the problems — a stuck step and what was reported about it are one line */
  problemsOf(s, job, steps).forEach((p) => {
    const t = p.task ? s.tasks.find((x) => x.id === p.task) : undefined
    const v = p.step ? steps.find((x) => x.key === p.step) : undefined
    if (t) used.add(t.id)
    if (v) used.add('s:' + v.key)
    const due = t ? taskIso(t.due) : v?.due
    const late = !!due && due < TODAY
    rows.push({ key: p.key, kind: 'Problem', what: cap(p.text), who: (t?.owner || v?.owner) as PersonKey | undefined, iso: due, when: due ? (late ? `Was due ${labelFromIso(due)}` : labelFromIso(due)) : sinceWords(t ? sinceTask(t.log) : v ? sinceStep(v, steps, job) : undefined), late, tone: 'bad', open: t ? openTask(t.id) : openStep(v!.key), done: t ? doneTask(t.id) : doneStep(v!.key) })
  })
  /* each part of getting ready that's going: where it is now. For one person: their step on it, if they have one */
  tracks.forEach((t) => {
    if (t.state === 'done' || t.state === 'na') return
    const going = t.steps.filter((v) => v.state === 'now' || v.state === 'wait' || v.state === 'bad')
    const v0 = who === 'all' ? (t.lead && going.includes(t.lead) ? t.lead : going[0]) : going.find((v) => v.owner === who)
    if (!v0 || used.has('s:' + v0.key) || v0.state === 'bad') return
    const v = lead(v0, steps)
    used.add('s:' + v.key)
    if (v.state === 'wait') {
      const w = leadWords(s, job, { ...t, lead: v0 })
      const what = ['delivered', 'matin', 'design', 'walk'].includes(v.key) ? (v.named ? v.label : TITLE[v.key] || todoOf(v)) : `${todoOf(v)} · ${w.top.replace(/^./, (c) => c.toLowerCase())}`
      rows.push({ key: 's:' + v.key, kind: 'Getting ready', what, who: v.owner, iso: v.due, when: v.due ? labelFromIso(v.due) : sinceWords(sinceStep(v, steps, job)), tone: 'wait', open: openStep(v.key), done: doneStep(v.key) })
      return
    }
    const late = !!v.due && v.due < TODAY
    rows.push({ key: 's:' + v.key, kind: 'Getting ready', what: stepWords(s, job, v), who: v.owner, iso: v.due, when: v.due ? (late ? `Was due ${labelFromIso(v.due)}` : labelFromIso(v.due)) : sinceWords(sinceStep(v, steps, job)), late, tone: 'now', open: openStep(v.key), done: doneStep(v.key) })
  })
  /* the project's own tasks */
  issuesOf(s, job).forEach((t) => {
    if (used.has(t.id)) return
    const waiting = t.state === 'waiting'
    const day = waiting ? t.followUp || t.due : t.due
    const iso = taskIso(day)
    const late = !waiting && (iso ? iso < TODAY : /late/i.test(day || ''))
    rows.push({ key: t.id, kind: tagOfTask(s, t), what: t.title, who: t.owner as PersonKey, iso: iso || (late ? TODAY : undefined), when: iso ? (late ? `Was due ${labelFromIso(iso)}` : labelFromIso(iso)) : day || sinceWords(sinceTask(t.log)), late, tone: t.tone === 'bad' ? 'bad' : waiting ? 'wait' : 'now', open: openTask(t.id), done: doneTask(t.id) })
  })
  const mine = (r: LeftRow) => (who === 'all' ? true : r.who === who)
  /* a problem first; then by the day (what has none after); what waits on someone outside sorts by its day too */
  const order = (r: LeftRow) => (r.tone === 'bad' ? 0 : 1)
  return rows.filter(mine).sort((a, b) => order(a) - order(b) || (a.iso || '9999').localeCompare(b.iso || '9999'))
}


/* Where it stands' To do: by person (you first), one line each — the same as Today: no tick boxes; tap the line and
 * its window has the exact button (Done, He said yes, Received…) — a tick can't say which. + Add at the bottom puts one more on the project —
 * the same choices as + New (a to do, a meeting, a problem, something for the GC…), already for this project. To take one off: its window, ··· */
export function WhatsLeft({ job }: { job: Job }) {
  const s = useStore()
  /* the next big thing first (schedule the crew, start the job, the return visit…), then everything else in order:
     a problem first, then by its day — one list, each line with its kind, who has it and when (the same as Today) */
  const nx = nextRow(s, job)
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const punchOpen = punch.filter((p) => p.status !== 'verified')
  const left = leftRows(s, job)
  /* the return visit: a to-do of its own that books it (Schedule the return) is that line — not a second one */
  const retTask = nx?.key === 'next:return' ? left.find((r) => s.tasks.find((t) => t.id === r.key)?.action?.kind === 'assign') : undefined
  const ret: LeftRow | null = nx?.key === 'next:return' ? { ...(retTask || nx), kind: 'Touch-ups', next: true } : null
  const touchIds = new Set(punch.map((p) => p.taskId).filter(Boolean) as string[])
  /* the touch-ups: one line — how far along ("1 of 4 done"), whose, when; tap it: the checklist */
  const touchRow: LeftRow | null = punchOpen.length ? (() => {
    const owners = punchOpen.map((p) => p.owner).filter(Boolean) as PersonKey[]
    const who = owners.sort((a, b) => owners.filter((x) => x === b).length - owners.filter((x) => x === a).length)[0]
    /* some with nobody yet: say so — whoever logged them picks */
    const noOne = punchOpen.filter((p) => !p.owner).length
    const days = punchOpen.map((p) => (p.due ? isoFromLabel(p.due) : undefined)).filter(Boolean).sort() as string[]
    const iso = days[0]
    const late = !!iso && iso < TODAY
    return { key: 'touchups', kind: 'Touch-ups', what: noOne ? `Pick who does ${noOne === 1 ? 'it' : 'them'} · ${noOne} not decided yet` : touchupsWords(punch), who, iso, when: iso ? (late ? `Was due ${labelFromIso(iso)}` : labelFromIso(iso)) : undefined, late, tone: 'now' as const, open: () => s.open({ t: 'touchups', jobId: job.id }), done: () => {}, noCheck: true }
  })() : null
  /* plain to-dos, one person's: one line — "To-dos · 2 of 5 done"; tap it: the checklist */
  const plain = new Set(s.tasks.filter((t) => t.jobId === job.id && plainTodo(t, touchIds)).map((t) => t.id))
  const byWho = new Map<string, LeftRow[]>()
  left.forEach((r) => { if (plain.has(r.key) && r.who) byWho.set(r.who, [...(byWho.get(r.who) || []), r]) })
  const folded = new Set<string>()
  const todoRows: LeftRow[] = []
  byWho.forEach((rs, who) => {
    if (rs.length < 2) return
    rs.forEach((r) => folded.add(r.key))
    const l = todosOf(s, job.id, who as PersonKey)
    const first = rs.reduce((a, r) => ((r.iso || '9999') < (a.iso || '9999') ? r : a))
    /* the to-dos themselves, so they're read right here — and how many are done, once some are */
    const words = l.open.map((t) => t.title.replace(/\.$/, '')).join(' · ')
    todoRows.push({ key: 'todos:' + who, kind: 'To do', what: `${words}${l.done.length ? ` · ${l.done.length} of ${l.open.length + l.done.length} done` : ''}`, who: who as PersonKey, iso: first.iso, when: first.when, late: rs.some((r) => r.late), tone: 'now', open: () => s.open({ t: 'todos', jobId: job.id, who }), done: () => {}, noCheck: true })
  })
  /* a touch-ups task, or (with the list there) a to-do about them said in words: inside the one touch-ups line */
  const touchTask = (k: string) => punch.some((p) => p.taskId === k) || (!!touchRow && TOUCH_WORDS.test(s.tasks.find((t) => t.id === k && t.state === 'now')?.title || ''))
  const rest = [...(touchRow && !ret ? [touchRow] : []), ...todoRows, ...left.filter((r) => !touchTask(r.key) && r !== retTask && !folded.has(r.key))]
    .sort((a, b) => Number(b.tone === 'bad') - Number(a.tone === 'bad') || (a.iso || '9999').localeCompare(b.iso || '9999'))
  /* at the touch-ups, they're the next big thing: the return visit, then the touch-ups, first */
  const rows = [...(nx && nx.key !== 'next:return' ? [nx] : []), ...(ret ? [ret] : []), ...(ret && touchRow ? [touchRow] : []), ...rest]
  const canAdd = !['crew', 'client', 'accounting'].includes(s.role)
  return (
    <section data-whats-left className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex min-h-[3.25rem] min-w-0 items-center gap-3 px-5 py-2 max-sm:px-4">
        <h3 className="text-[1.0625rem] font-semibold text-ink">To do</h3>
        <span className="text-[0.9375rem] font-medium tnum text-faint" data-left-count>{rows.length}</span>
        {canAdd && punch.length === 0 && job.stage === 'punch' && <button type="button" onClick={() => s.open({ t: 'punchnew', jobId: job.id })} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50" data-left-touchups-add><Plus className="h-3.5 w-3.5" />Add touch-ups</button>}
      </header>
      <div data-left-rows>
        {rows.map((r) => <LeftLine key={r.key} r={r} />)}
        {!rows.length && <div className="border-t border-line-2 px-5 py-6 text-center text-[0.9375rem] text-muted max-sm:px-4" data-left-none>Nothing left to do right now.</div>}
        {canAdd && (
          <button type="button" onClick={() => s.open({ t: 'new', jobId: job.id })} className="flex min-h-[3rem] w-full items-center gap-3.5 border-t border-line px-4 text-left text-[0.9375rem] font-medium text-brand-700 transition hover:bg-brand-50/50 max-sm:px-3.5" data-left-add>
            <span className="inline-flex h-[1.375rem] w-[1.375rem] items-center justify-center"><Plus className="h-4 w-4" /></span><span className="min-w-0">Add<span className="font-normal text-muted max-sm:hidden"> · a to do, touch-ups, a meeting, a problem, something for the GC</span></span>
          </button>
        )}
      </div>
    </section>
  )
}

/** one line of a project's To do: its kind, what it is, who has it (their circle and name), when — a computer in
 *  straight columns; a phone: what it is on top (whole), who and when under it */
const LINE = 'flex w-full min-w-0 cursor-pointer items-center gap-3 border-t border-line-2 py-2.5 pl-5 pr-4 text-left transition row-hover focus-visible:outline-none md:grid md:min-h-[3rem] md:grid-cols-[minmax(0,1fr)_9.5rem_8rem_1rem] md:gap-x-4 md:py-1.5 max-sm:pl-4 max-sm:pr-3'
function LeftLine({ r }: { r: LeftRow }) {
  const whenCls = r.late ? 'font-medium text-bad-600' : 'text-muted'
  return (
    <div role="button" tabIndex={0} onClick={r.open} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) r.open() }} className={LINE} data-left-row={r.key} data-tone={r.tone} data-who={r.who} data-kind={r.kind}>
      <div className="min-w-0 flex-1 md:contents">
        <span className="flex min-w-0 items-start gap-2">
          {r.kind && <KindTag label={r.kind} className="mt-px" />}
          <span className={cn('min-w-0 break-words text-[0.9375rem] leading-snug', r.tone === 'wait' ? 'text-muted' : 'text-ink', r.next && 'font-semibold')} title={r.what} data-left-what {...(r.next ? { 'data-left-next': r.key } : {})}>{r.what}</span>
        </span>
        {/* a phone: who has it, and when — under it */}
        {(r.who || r.when) && (
          <span className="mt-1 flex min-w-0 items-center gap-2 text-[0.8125rem] md:hidden">
            {r.who && <Whose who={r.who} size={18} />}
            {r.when && <span className={cn('min-w-0 tnum', whenCls)} data-left-when-phone>{r.who ? '· ' : ''}{r.when}</span>}
          </span>
        )}
      </div>
      <span className="min-w-0 max-md:hidden" data-left-who>{r.who ? <Whose who={r.who} /> : null}</span>
      <span className={cn('min-w-0 break-words text-right text-[0.875rem] tnum max-md:hidden', whenCls)} data-left-when>{r.when || ''}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint" aria-hidden />
    </div>
  )
}
