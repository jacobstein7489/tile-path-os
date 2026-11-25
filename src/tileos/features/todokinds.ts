/* What kind of thing a to-do is, on a list — and which to-dos are plain (nothing of their own to press), so several of
 * them on one project fold into one line ("To-dos · 2 of 5 done"). Used by Today and by a project's To do. */
import type { Store } from '@/tileos/store'
import { isRequest } from '@/tileos/store'
import type { PersonKey } from '@/tileos/data/model'
import type { Task } from '@/tileos/data/work'
import { TODAY, isoFromLabel } from '@/tileos/lib/today'
import { isGc } from './gcwait'

/** the kind, in words — the same as a to-do's window says on top */
const TYPE_TAG: Record<string, string> = { Pricing: 'Estimate', Setup: 'To do', Materials: 'Materials', Field: 'To do', Changes: 'Change order', Schedule: 'Schedule', Money: 'Billing' }
/** a to-do's kind on a list — its tag: Touch-ups (a checklist), Problem, Materials, Meeting… a plain one: To do */
export function tagOfTask(s: Pick<Store, 'punch'>, t: Task): string {
  /* what it is: touch-ups (its checklist, or said so in its words), a problem, the GC, something to bring, waiting on
     someone, for everyone — else its kind of work (a plain one: To do) */
  if (s.punch.some((p) => p.taskId === t.id) || /\btouch-?\s?ups?\b/i.test(t.title)) return 'Touch-ups'
  if (t.tone === 'bad' && t.state !== 'done') return 'Problem'
  if (t.state === 'waiting' && isGc(t)) return 'GC'
  if (isRequest(t)) return 'To bring'
  if (t.everyone) return 'For everyone'
  if (t.state === 'waiting' || /^waiting (for|on)\b/i.test(t.title)) return 'Waiting'
  return TYPE_TAG[t.type] || 'To do'
}
/** the day it was done (the day it says, or today for "Just now") */
export const doneDayOf = (t: Task) => t.doneOn || (t.doneAt === 'Just now' || t.doneAt === 'Today' ? TODAY : isoFromLabel(t.doneAt) || '')
const dayOf = (t: Task) => (t.state === 'waiting' ? isoFromLabel(t.followUp) : t.state === 'later' ? isoFromLabel(t.laterUntil) : isoFromLabel(t.due))
/** a call, a text, a question (call the GC, ask the client, find out…): its button says it was done and asks what they said */
export const CALL_RE = /^\s*(call|phone|ring|text|ask|check with|find out|follow up with|reach out to|speak (to|with)|talk to)\b/i
/** something to order: its button says it's ordered and asks who brings it and when */
export const ORDER_RE = /^\s*(order|re-?order|buy)\b/i
/** a plain to-do: its tag is To do — one with nothing of its own to press (not a call or an order — those have their own
 *  next step — not a problem, not a pickup, not the GC, not touch-ups, not waiting, not materials or billing, not a step,
 *  not for everyone, not repeating) — several of them on one project are a checklist: one line */
export const plainKind = (t: Task, touchIds: Set<string>) => (t.type === 'Setup' || t.type === 'Field') && !CALL_RE.test(t.title) && !ORDER_RE.test(t.title) && !/\btouch-?\s?ups?\b/i.test(t.title) && !/^waiting (for|on)\b/i.test(t.title) && !isRequest(t) && !isGc(t) && t.tone !== 'bad' && !t.everyone && !t.repeat && !(t.step && !t.step.startsWith('*:')) && (!t.action || t.action.kind === 'open-job') && !touchIds.has(t.id)
export const plainTodo = (t: Task, touchIds: Set<string>) => t.state === 'now' && !t.urgent && plainKind(t, touchIds)
/** one person's plain to-dos on a project: still to do (soonest first), and done today — "2 of 5 done" */
export function todosOf(s: Pick<Store, 'tasks' | 'punch'>, jobId: string, who: PersonKey) {
  const touchIds = new Set(s.punch.map((p) => p.taskId).filter(Boolean) as string[])
  const mine = (t: Task) => t.jobId === jobId && (t.owner === who || (t.also || []).includes(who))
  const open = s.tasks.filter((t) => mine(t) && plainTodo(t, touchIds)).sort((a, b) => (dayOf(a) || '9999').localeCompare(dayOf(b) || '9999'))
  const done = s.tasks.filter((t) => mine(t) && t.state === 'done' && doneDayOf(t) === TODAY && plainKind(t, touchIds))
  return { open, done }
}

/** touch-ups, counted the same everywhere: none fixed yet "5 to fix"; some "1 of 4 fixed"; every one fixed but some still
 *  to be checked "All fixed · 2 to check"; all checked "All done". (Fixed: the crew says it's done. Checked: the site
 *  manager or the office saw it.) With the word (the Projects list): "5 touch-ups to fix", "1 of 4 touch-ups fixed" */
export function touchupsWords(items: { status: string }[], noun?: boolean): string {
  const n = items.length
  const fixed = items.filter((p) => p.status === 'verify' || p.status === 'verified').length
  const toCheck = items.filter((p) => p.status === 'verify').length
  const word = noun ? ` ${n === 1 ? 'touch-up' : 'touch-ups'}` : ''
  if (!fixed) return `${n}${word} to fix`
  if (fixed < n) return `${fixed} of ${n}${word} fixed`
  return toCheck ? `All fixed · ${toCheck} to check` : n === 1 ? `Done` : `All ${n}${word} done`
}
/** a touch-ups to-do said in words ("Touch-ups at 114 — check them when Leo is done") — no list of its own */
export const TOUCH_WORDS = /\btouch-?\s?ups?\b/i
/** on a project that has its list of touch-ups, the to-dos about them in words (still open, the same person's) go
 *  inside that one line — and show at the top of its window */
export function strayTouchups(s: Pick<Store, 'tasks' | 'punch'>, main: Task): Task[] {
  const linked = new Set(s.punch.map((p) => p.taskId).filter(Boolean) as string[])
  if (!linked.has(main.id)) return []
  const mine = (t: Task) => t.owner === main.owner || (t.also || []).includes(main.owner)
  return s.tasks.filter((t) => t.id !== main.id && t.jobId === main.jobId && t.state === 'now' && !linked.has(t.id) && TOUCH_WORDS.test(t.title) && mine(t))
}
