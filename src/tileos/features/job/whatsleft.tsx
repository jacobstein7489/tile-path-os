/* Where it stands — what's left on the project, by person: yours first, then whoever has the most urgent thing.
 *   Under each person, one line each — what · when — the most urgent first: a problem (red), what's late (red), then
 *   by the day, then in the order the work goes. What waits on someone outside is quiet.
 *   Each part of getting ready is one line — where it is now, in words (made → sent → accepted is one line that
 *   changes as it goes; its steps are inside its window). The project's tasks are lines the same way.
 *   What can't start yet, and what's done, aren't on it — just what's left.
 * Tap a line: that one thing in its own window — done there, it closes by itself; it never jumps to another step. */
import * as React from 'react'
import { Check, ChevronRight, Plus } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { Filter } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { labelFromIso, isoFromLabel, TODAY } from '@/tileos/lib/today'
import { stepsFor, markStep, type StepView } from '../steps'
import { TITLE, todoOf } from '../stepwin'
import { tracksFor, issuesOf, problemsOf, leadWords, type TrackView } from '../tracks'
import { firstName } from './kit'
import { installerOf } from '../upcoming'

export type LeftRow = {
  key: string
  what: string
  who?: PersonKey
  when?: string
  /** the day, to sort by */
  iso?: string
  late?: boolean
  tone: 'bad' | 'now' | 'wait'
  open: () => void
  /** checked off right on the list — the step or the task it is */
  done: () => void
}

/** whose it is: their little circle and their name ("You" for yours) — the same as on Estimates */
export function Whose({ who, size = 20, className }: { who?: PersonKey; size?: number; className?: string }) {
  const s = useStore()
  if (!who || !PEOPLE[who]) return <span className={className} />
  const me = meOf(s.role)
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)} data-whose={who}>
      <Avatar who={who} size={size} />
      <span className={cn('min-w-0 truncate text-[0.875rem]', who === me ? 'font-medium text-ink' : 'text-ink-2')} data-who-name>{who === me ? 'You' : PEOPLE[who].short || firstName(who)}</span>
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
    rows.push({ key: p.key, what: cap(p.text), who: (t?.owner || v?.owner) as PersonKey | undefined, iso: due, when: due ? (late ? `Was due ${labelFromIso(due)}` : labelFromIso(due)) : sinceWords(t ? sinceTask(t.log) : v ? sinceStep(v, steps, job) : undefined), late, tone: 'bad', open: t ? openTask(t.id) : openStep(v!.key), done: t ? doneTask(t.id) : doneStep(v!.key) })
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
      rows.push({ key: 's:' + v.key, what, who: v.owner, iso: v.due, when: v.due ? labelFromIso(v.due) : sinceWords(sinceStep(v, steps, job)), tone: 'wait', open: openStep(v.key), done: doneStep(v.key) })
      return
    }
    const late = !!v.due && v.due < TODAY
    rows.push({ key: 's:' + v.key, what: stepWords(s, job, v), who: v.owner, iso: v.due, when: v.due ? (late ? `Was due ${labelFromIso(v.due)}` : labelFromIso(v.due)) : sinceWords(sinceStep(v, steps, job)), late, tone: 'now', open: openStep(v.key), done: doneStep(v.key) })
  })
  /* the project's own tasks */
  issuesOf(s, job).forEach((t) => {
    if (used.has(t.id)) return
    const waiting = t.state === 'waiting'
    const day = waiting ? t.followUp || t.due : t.due
    const iso = taskIso(day)
    const late = !waiting && (iso ? iso < TODAY : /late/i.test(day || ''))
    rows.push({ key: t.id, what: t.title, who: t.owner as PersonKey, iso: iso || (late ? TODAY : undefined), when: iso ? (late ? `Was due ${labelFromIso(iso)}` : labelFromIso(iso)) : day || sinceWords(sinceTask(t.log)), late, tone: t.tone === 'bad' ? 'bad' : waiting ? 'wait' : 'now', open: openTask(t.id), done: doneTask(t.id) })
  })
  const mine = (r: LeftRow) => (who === 'all' ? true : r.who === who)
  /* a problem first; then by the day (what has none after); what waits on someone outside sorts by its day too */
  const order = (r: LeftRow) => (r.tone === 'bad' ? 0 : 1)
  return rows.filter(mine).sort((a, b) => order(a) - order(b) || (a.iso || '9999').localeCompare(b.iso || '9999'))
}

const ROW = 'grid min-h-[3rem] w-full cursor-pointer grid-cols-[1.375rem_minmax(0,1fr)_auto_1rem] items-center gap-x-3.5 border-t border-line-2 py-2 pl-4 pr-5 text-left transition row-hover focus-visible:outline-none max-sm:grid-cols-[1.375rem_minmax(0,1fr)_1rem] max-sm:gap-x-3 max-sm:gap-y-0.5 max-sm:py-2.5 max-sm:pl-3.5 max-sm:pr-4'

/* Where it stands' To do: by person (you first), one line each. The round check on the left checks it off right there
 * (yours — or anything, for the admin); tap the line for its window. + Add a step at the bottom puts one more on the
 * project — the same New task window, already for this project. To take one off: its window, ··· */
export function WhatsLeft({ job }: { job: Job }) {
  const s = useStore()
  const me = meOf(s.role)
  const admin = s.role === 'owner' || s.role === 'pm'
  const rows = leftRows(s, job)
  /* checked: it slides away before the list closes up */
  const [going, setGoing] = React.useState<string[]>([])
  const check = (r: LeftRow) => { setGoing((g) => [...g, r.key]); window.setTimeout(() => { r.done(); setGoing((g) => g.filter((k) => k !== r.key)) }, 260) }
  /* by person: you first, then whoever has the most urgent thing (the list is in order of urgency already) */
  const people = Array.from(new Set(rows.map((r) => r.who || ''))).sort((a, b) => Number(b === me) - Number(a === me))
  const canAdd = !['crew', 'client', 'accounting'].includes(s.role)
  return (
    <section data-whats-left className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex min-h-[3.25rem] min-w-0 items-center gap-3 px-5 py-2 max-sm:px-4">
        <h3 className="text-[1.0625rem] font-semibold text-ink">To do</h3>
        <span className="text-[0.9375rem] font-medium tnum text-faint" data-left-count>{rows.length}</span>
      </header>
      <div data-left-rows>
        {people.map((p) => {
          const mine = rows.filter((r) => (r.who || '') === p)
          const person = p ? PEOPLE[p as PersonKey] : undefined
          return (
            <div key={p || 'nobody'} className="border-t border-line" data-left-person={p || 'nobody'}>
              <div className="flex min-w-0 items-center gap-2 bg-[#fafaf9] px-5 py-2.5 max-sm:px-4" data-left-who>
                {person && <Avatar who={p as PersonKey} size={22} />}
                <span className="truncate text-[0.875rem] font-semibold text-ink" data-who-name>{p === me ? 'You' : person ? person.short || firstName(p as PersonKey) : 'Nobody yet'}</span>
                <span className="text-[0.8125rem] tnum text-faint">{mine.length}</span>
              </div>
              {mine.map((r) => {
                const can = admin || r.who === me
                const off = going.includes(r.key)
                return (
                  <div key={r.key} role="button" tabIndex={0} onClick={r.open} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) r.open() }} className={cn(ROW, off && 'row-out')} data-left-row={r.key} data-tone={r.tone} data-who={r.who}>
                    {can ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); if (!off) check(r) }} aria-label={`Done: ${r.what}`} title="Done" data-left-check
                        className={cn('group/check inline-flex h-[1.375rem] w-[1.375rem] items-center justify-center rounded-full border-[1.5px] transition max-sm:row-span-2', off ? 'border-[#2c8a5b] bg-[#2c8a5b] text-white' : 'border-[#c9c3b8] text-transparent hover:border-[#2c8a5b] hover:text-[#2c8a5b]')}>
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </button>
                    ) : <span aria-hidden className="max-sm:row-span-2" />}
                    <span className={cn('min-w-0 truncate text-[0.9375rem] max-sm:line-clamp-2 max-sm:whitespace-normal max-sm:leading-snug', off ? 'text-muted line-through decoration-faint' : r.tone === 'bad' ? 'text-bad-600' : r.tone === 'wait' ? 'text-muted' : 'text-ink')} title={r.what} data-left-what>{r.what}</span>
                    <span className={cn('min-w-0 truncate text-right text-[0.875rem] tnum max-sm:col-start-2 max-sm:row-start-2 max-sm:text-left max-sm:text-[0.8125rem]', r.late ? 'font-medium text-bad-600' : 'text-muted', !r.when && 'max-sm:hidden')} data-left-when>{r.when || ''}</span>
                    <ChevronRight className="h-4 w-4 text-faint max-sm:col-start-3 max-sm:row-span-2 max-sm:row-start-1" aria-hidden />
                  </div>
                )
              })}
            </div>
          )
        })}
        {!rows.length && <div className="border-t border-line-2 px-5 py-6 text-center text-[0.9375rem] text-muted max-sm:px-4" data-left-none>Nothing left to do right now.</div>}
        {canAdd && (
          <button type="button" onClick={() => s.open({ t: 'newtask', jobId: job.id })} className="flex min-h-[3rem] w-full items-center gap-3.5 border-t border-line px-4 text-left text-[0.9375rem] font-medium text-brand-700 transition hover:bg-brand-50/50 max-sm:px-3.5" data-left-add>
            <span className="inline-flex h-[1.375rem] w-[1.375rem] items-center justify-center"><Plus className="h-4 w-4" /></span>Add a step
          </button>
        )}
      </div>
    </section>
  )
}
