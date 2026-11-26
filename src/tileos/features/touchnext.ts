/* A project's touch-ups are one thing, on one line — and the line says its next step. Worked out here, once, for every
 * list that shows it (a project's To do, Today, the windows):
 *   nothing listed yet (the project is at its touch-ups)   → Add the touch-ups
 *   someone still to pick                                  → Pick who does them
 *   an installer has them but no day (he has to come back) → Book the return visit
 *   to fix                                                 → the installer's: "3 to fix · Leo · Fri"
 *   fixed, to be checked                                   → Check the touch-ups (whoever checks them)
 * Each step done, the next one shows by itself. Who does them and their day ARE the return visit — never a second line. */
import type { Store } from '@/tileos/store'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import type { PunchItem, Task } from '@/tileos/data/work'
import { TODAY, isoFromLabel, labelFromIso } from '@/tileos/lib/today'
import { siteOf, realOwner } from './steps'
import { touchupsWords } from './todokinds'

export type TouchStep = 'add' | 'who' | 'book' | 'fix' | 'check'
export interface TouchNext {
  step: TouchStep
  /** every touch-up on the project, and the ones not checked yet */
  all: PunchItem[]
  open: PunchItem[]
  /** the to-dos that carry them, still open — one, when one covers everything that's open */
  tasks: Task[]
  task?: Task
  /** the line's words: the next step first — "Book the return visit · 3 touch-ups" (to fix: "3 to fix") */
  what: string
  /** the step, as a button — and short enough for a line's button */
  button: string
  short: string
  /** whose turn it is */
  who?: PersonKey
  /** the installer who has them (the most of them) */
  crew?: PersonKey
  /** their day */
  iso?: string
  when?: string
  late?: boolean
  /** who logged them, and when ("Nov 23") */
  by?: PersonKey
  on?: string
}

const most = (list: PersonKey[]) => [...list].sort((a, b) => list.filter((x) => x === b).length - list.filter((x) => x === a).length)[0] as PersonKey | undefined
const n = (k: number) => `${k} ${k === 1 ? 'touch-up' : 'touch-ups'}`
const dayOf = (p: PunchItem) => { const d = p.due || p.note?.match(/^Due (.+)$/)?.[1]; return d ? isoFromLabel(d) : undefined }

/** the return visit on the calendar, if it's still to come (or today) */
export const returnOf = (s: Pick<Store, 'bookings'>, jobId: string) =>
  s.bookings.filter((b) => b.jobId === jobId && b.label === 'Return visit' && b.end >= TODAY).sort((a, b) => a.start.localeCompare(b.start))[0]

export function touchNext(s: Pick<Store, 'punch' | 'tasks' | 'bookings' | 'team' | 'rules'>, job: Job): TouchNext | null {
  const all = s.punch.filter((p) => p.jobId === job.id)
  const open = all.filter((p) => p.status !== 'verified')
  const site = siteOf(s, job)
  /* whoever schedules the crews (the admin) books a return visit — the same person as Schedule the crew */
  const scheduler = realOwner(s, 'ys' as PersonKey)
  const atTouchups = job.stage === 'punch'
  if (!open.length) {
    /* at its touch-ups with nothing listed: the list is the next step */
    if (atTouchups && !all.length) return { step: 'add', all, open, tasks: [], what: 'Add the touch-ups', button: 'Add touch-ups', short: 'Add them', who: site }
    return null
  }
  const ids = new Set(open.map((p) => p.taskId).filter(Boolean) as string[])
  const tasks = s.tasks.filter((t) => ids.has(t.id) && t.state !== 'done')
  const task = tasks.length === 1 && open.every((p) => p.taskId === tasks[0].id) ? tasks[0] : undefined
  /* who logged them: the first list's to-do says */
  const first = [...tasks].sort((a, b) => (isoFromLabel(a.log?.[0]?.date) || '9999').localeCompare(isoFromLabel(b.log?.[0]?.date) || '9999'))[0]
  const by = (first?.by && PEOPLE[first.by] ? first.by : first?.log?.[0]?.who) as PersonKey | undefined
  const on = first?.log?.[0]?.date
  const base = { all, open, tasks, task, by: by && PEOPLE[by] ? by : undefined, on }
  const toFix = open.filter((p) => p.status === 'open' || p.status === 'working')
  const owners = toFix.map((p) => p.owner).filter(Boolean) as PersonKey[]
  const crew = most(owners.filter((o) => !!PEOPLE[o]?.crew))
  /* whoever checks them: the one their to-do is on (when it isn't the installer's own), else the site manager */
  const checker = (first && !PEOPLE[first.owner]?.crew ? first.owner : site) as PersonKey
  const noOne = toFix.filter((p) => !p.owner).length
  if (noOne) return { ...base, step: 'who', what: `Pick who does ${noOne === 1 ? 'it' : 'them'} · ${n(noOne)}`, button: `Pick who does ${noOne === 1 ? 'it' : 'them'}`, short: 'Pick who', who: checker }
  /* on hold ("Waiting on the thinset"): can't be done yet — nothing to book or check for those until they can */
  const held = toFix.filter((p) => /^waiting/i.test(p.note || ''))
  const ready = toFix.filter((p) => !held.includes(p))
  const days = ready.map(dayOf).filter(Boolean).sort() as string[]
  const back = returnOf(s, job.id)
  /* a return visit that's been and gone since they were logged: he was there — they're to be checked */
  const logged = isoFromLabel(on)
  const visited = s.bookings.some((x) => x.jobId === job.id && x.label === 'Return visit' && x.end < TODAY && (!logged || x.end >= logged))
  /* the installer has left (the project is at its touch-ups) and has to come back for them: booking that visit is the
     next step — whoever schedules the crews books it; its day becomes theirs */
  if (ready.length && crew && atTouchups && !back && !visited)
    return { ...base, step: 'book', crew, what: `Book the return visit · ${n(ready.length)}`, button: 'Book the return visit', short: 'Book return', who: scheduler, iso: days[0] && days[0] >= TODAY ? days[0] : undefined }
  const iso = back ? back.start : days[0]
  const late = !!iso && iso < TODAY
  const when = iso ? (late ? `Was due ${labelFromIso(iso)}` : labelFromIso(iso)) : undefined
  /* every one left is on hold: it says what they wait on — nobody's move until that comes */
  if (toFix.length && !ready.length) return { ...base, step: 'fix', crew, what: `${touchupsWords(all)} · ${held[0].note}`, button: 'All checked', short: 'Open list', who: most(owners) }
  /* still to fix: whoever fixes them has it — an installer until their day is over (then whoever checks goes and
     looks); someone of ours who does them himself until they're done (late in red, like any to-do) */
  if (toFix.length && (!crew || (!late && !visited))) return { ...base, step: 'fix', crew, what: touchupsWords(all), button: 'All checked', short: 'Open list', who: most(owners), iso, when, late }
  /* fixed (or their day has gone by): whoever checks them goes and looks */
  const words = touchupsWords(all).replace(/^All fixed · /, '')
  return { ...base, step: 'check', crew, what: `Check the touch-ups · ${words}`, button: 'All checked', short: 'Check them', who: checker, iso, when, late }
}

/** the window a project's touch-ups open in: their to-do's own (the same window as every to-do) when one to-do carries
 *  all of them — else the project's list of them */
export const touchWindow = (nx: TouchNext, jobId: string): { t: string; [k: string]: any } =>
  nx.step === 'add' ? { t: 'punchnew', jobId } : nx.task ? { t: 'task', id: nx.task.id } : { t: 'touchups', jobId }
