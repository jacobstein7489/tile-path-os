/* Tile OS, the assistant — talk to it like to a sharp office manager, on the go. It greets you with your day (open
 * jobs, what's on your list, what's late); you ask it things or tell it what's going on. Tap the mic, talk, tap again:
 * your words show as you talk and it answers right away. What you tell it to do comes back as one small box to check
 * — new things (each the right kind, on the right project, for the right person, with a day) and changes to what's
 * already there (done, a new day, someone else, a note) — and nothing happens until you tap the button. The project
 * you're talking about stays for the rest of the talk. The buttons everywhere else still work the same: this is the
 * quick way, for the field.
 * The AI is the company's own (Lovable AI, on the server). Where it isn't on, the words are split into lines by
 * themselves — the same box to check, just less clever. */
import * as React from 'react'
import { ArrowLeftRight, ArrowUp, AudioLines, Building2, CalendarDays, Check, ChevronDown, HardHat, HelpCircle, ListTodo, Mic, Plus, Ruler, Sparkles, StickyNote, TriangleAlert, Truck, UserRound, X, type LucideIcon } from 'lucide-react'
import { useStore, meOf, NOW, newTask, addHist, clockNow, type Store } from '@/tileos/store'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, STAGE_LABEL, PRICING_STAGES, type Job, type PersonKey, type Role } from '@/tileos/data/model'
import type { Task, TaskType } from '@/tileos/data/work'
import { REAL } from '@/tileos/lib/save'
import { noteAnswered } from '@/tileos/lib/robottime'
import { TODAY, addDays, dow, isoFromLabel, labelFromIso, dayLongFull, md } from '@/tileos/lib/today'
import { insidePeople } from './steps-ui'
import { siteOf } from './steps'
import { projectIn, personIn, guessType, DAY_WORDS, todayCount } from './mytasks'
import { lateOf } from './late'
import { typeOf } from './projectlist'
import { ProjectChip, PICK_CHIP, projectsFor } from './formkit'
import { Helper, Listening } from './helper'
import { useVoice } from '@/tileos/components/ui/voice'
import { needByFor, startOf } from './gcwait'
import { stepsFor } from './steps'
import { setTaskTime } from './taskshare'
import { pagesOf } from './reader'
import { parseTime, timeLabel } from '@/tileos/data/calendar'

/* ---------------- the kinds of things ---------------- */
export type CapKind = 'task' | 'problem' | 'question' | 'gc' | 'touchup' | 'bring' | 'change' | 'measure' | 'meeting'
export const CAP_KINDS: { k: CapKind; label: string; hint: string; icon: LucideIcon; fg: string; bg: string }[] = [
  { k: 'task', label: 'To do', hint: 'Something one of us does', icon: ListTodo, fg: '#2650cf', bg: '#eaf0fc' },
  { k: 'problem', label: 'Problem', hint: 'Something wrong. It holds the job up', icon: TriangleAlert, fg: '#c03a2d', bg: '#fbecea' },
  { k: 'question', label: 'Question', hint: 'To answer, or to ask the client or the designer', icon: HelpCircle, fg: '#6b55c9', bg: '#f1eefb' },
  { k: 'gc', label: 'The GC’s', hint: 'The GC does it or answers it. We remind him until it’s done', icon: HardHat, fg: '#b06a0c', bg: '#fbf2e2' },
  { k: 'touchup', label: 'Touch-up', hint: 'Fix or finish our own work', icon: Sparkles, fg: '#b83a5e', bg: '#fbecf1' },
  { k: 'bring', label: 'Bring to the job', hint: 'Material or a tool, picked up and brought', icon: Truck, fg: '#c25a1a', bg: '#fcefe6' },
  { k: 'change', label: 'Change', hint: 'The designer or the client changed it. Price it, get the OK', icon: ArrowLeftRight, fg: '#4b4fc6', bg: '#eeeffc' },
  { k: 'measure', label: 'Measure', hint: 'Go measure a job', icon: Ruler, fg: '#23854f', bg: '#e9f5ee' },
  { k: 'meeting', label: 'Meeting', hint: 'On the calendar of everyone in it', icon: CalendarDays, fg: '#0e7490', bg: '#e6f4f7' },
]
const KIND = Object.fromEntries(CAP_KINDS.map((x) => [x.k, x])) as Record<CapKind, (typeof CAP_KINDS)[number]>

export type CapItem = { id: string; kind: CapKind; title: string; jobId: string; who: PersonKey; /** the others in it: a meeting's people, a to-do two share (whoever gets to it first) */ also?: PersonKey[]; /** a place that isn't a project yet ("15 Blinky") — and whether to add it as one */ place?: string; makePlace?: boolean; when: string; /** the time of day said ("9:00 AM") */ at?: string; urgent?: boolean; note?: string; /** who is waiting for it — an installer asked (the lockbox code): the answer is written for him */ forWho?: PersonKey }

/* ---------------- who does what, when nobody said ---------------- */
/** our installers — the built-in crews and any added to the team */
const crewsOf = (s: Pick<Store, 'team'>): PersonKey[] => Array.from(new Set([...CREWS, ...s.team.filter((m) => m.role === 'crew' && m.status !== 'off').map((m) => m.key as PersonKey)])).filter((p) => !!PEOPLE[p])
const ROLE_OF: Partial<Record<string, Role[]>> = { ys: ['owner', 'pm'], yakov: ['site'], office: ['office'], estimator: ['estimator'], takeoff: ['takeoff'], materials: ['materials'], accounting: ['accounting'] }
const rolesOf = (s: Pick<Store, 'team'>, p: PersonKey): Role[] => { const m = s.team.find((x) => x.key === p); return m ? [m.role as Role] : ROLE_OF[p] || ['owner'] }
/** the site manager on a project — or the company's */
function fieldPerson(s: Store, jobId: string): PersonKey {
  const j = jobId ? s.jobs[jobId] : undefined
  const site = s.team.find((m) => m.role === 'site' && m.status !== 'off')?.key as PersonKey | undefined
  return (j ? siteOf(s, j) : site) || site || meOf(s.role)
}
/** whose it is when nobody was named: what's on site goes to the site manager; the rest is yours */
export function whoFor(s: Store, kind: CapKind, jobId: string): PersonKey {
  return ['problem', 'gc', 'touchup', 'bring', 'measure'].includes(kind) ? fieldPerson(s, jobId) : meOf(s.role)
}
/** a day as the app says it ("Today", "Tomorrow", "Wed", "Nov 18") — from what the AI or the words said */
function dayOf(w?: string): string {
  const t = (w || '').trim()
  if (!t) return ''
  const hit = DAY_WORDS.find(([re]) => re.test(t.toLowerCase()))
  if (hit) return hit[1]
  const iso = isoFromLabel(t) || (/^\d{4}-\d\d-\d\d$/.test(t) ? t : undefined)
  return iso ? labelFromIso(iso) : ''
}

/* ---------------- the AI ---------------- */
/** what's going on now, for answering questions — what this person can see: each project (where it is, when we
 *  start, its next steps and whose) and what's open (whose, when, waiting on whom, what the GC said) */
function nowFor(s: Store): string {
  const me = meOf(s.role)
  const admin = s.role === 'owner' || s.role === 'pm'
  const jobs = projectsFor(s)
  const on = new Set(jobs.map((j) => j.id))
  const who = (p?: string) => (p ? PEOPLE[p as PersonKey]?.name || p : '')
  const projects = jobs.slice(0, 80).map((j) => {
    const st = startOf(s, j)
    let next: string[] = []
    try { next = stepsFor(s, j).filter((v) => v.state === 'now' || v.state === 'bad' || v.state === 'wait').slice(0, 4).map((v) => `${v.short || v.label} (${who(v.owner)}${v.due ? `, due ${md(v.due)}` : ''}${v.state === 'bad' ? ', a problem' : v.state === 'wait' ? `, waiting${v.waitsFor ? ` for ${v.waitsFor}` : ''}` : ''})`) } catch { /* no steps */ }
    return `- ${j.name}${j.client ? ` (client ${j.client})` : ''} · ${STAGE_LABEL[j.stage] || j.stage}${st ? `. Our crew starts ${md(st)}` : ''}${next.length ? ` · next: ${next.join('; ')}` : ''}`
  })
  const open = s.tasks.filter((t) => t.state !== 'done' && (admin || t.owner === me || t.followers?.includes(me) || on.has(t.jobId))).slice(0, 220)
  const todos = open.map((t) => `- [${t.id}] ${t.title} · ${s.jobs[t.jobId]?.name || 'the company'} · ${who(t.owner)} · ${t.state === 'waiting' ? `waiting on ${t.waitingOn || 'someone'}${t.followUp ? `, next follow-up ${t.followUp}` : ''}` : t.due ? `due ${t.due}` : 'no day set'}${t.said ? ` · the GC said “${t.said.text}” on ${md(t.said.day)}` : ''}${t.needBy ? ` · needed by ${md(t.needBy)}` : ''}${t.urgent ? ' · urgent' : ''}`)
  const c = dayCounts(s)
  return `In numbers: ${c.open} open jobs; on ${PEOPLE[me]?.name || 'their'}'s list today ${c.today}, late ${c.late}.\n\nProjects (name · client · where it is · start · next steps):\n${projects.join('\n') || '(none)'}\n\nOpen to-dos ([key] what · project · whose · when):\n${todos.join('\n') || '(none)'}`
}

/** the day in numbers, for the hello and for questions: open jobs, what's on your list today, what's late */
export function dayCounts(s: Store): { open: number; today: number; late: number } {
  const open = projectsFor(s).filter((j) => !PRICING_STAGES.includes(j.stage) && typeOf(j) !== 'done').length
  let today = 0
  let late = 0
  try { today = todayCount(s, s.role) } catch { /* fine */ }
  try { late = lateOf(s, s.role).length } catch { /* fine */ }
  return { open, today, late }
}
/** hello, like a person — no numbers nobody asked for; opened on a project: about that one */
export function greeting(s: Store, jobId?: string): string {
  const me = meOf(s.role)
  const first = String(PEOPLE[me]?.short || PEOPLE[me]?.name || '').split(' ')[0]
  const h = new Date().getHours()
  const hi = `${h < 12 ? 'Good morning' : h < 17 ? 'Hi' : 'Good evening'}${first ? `, ${first}` : ''}`
  if (jobId && s.jobs[jobId]) return `${hi}. What’s going on at ${s.jobs[jobId].name}?`
  return `${hi}. What’s up?`
}

/** the conversation so far, the way the AI reads it */
type Said = { who: 'bot' | 'me'; text: string; items?: { title: string }[]; acts?: unknown[]; state?: string; thinking?: boolean }
function talkPrompt(s: Store, history: Said[], text: string, aboutJob: string, pics = 0): string {
  const me = meOf(s.role)
  const name = PEOPLE[me]?.name || 'The boss'
  const team = insidePeople(s)
  const people = team.map((p) => `- ${p}: ${PEOPLE[p]?.name || p}${PEOPLE[p]?.roleLabel ? ` · ${PEOPLE[p].roleLabel}` : ''}${p === me ? ' (the one talking)' : ''}`).join('\n')
  const jobs = projectsFor(s).map((j) => `- ${j.id}: ${j.name}${j.address ? ` · ${j.address}` : ''}${j.client ? ` · client ${j.client}` : ''}`).join('\n')
  const crews = crewsOf(s).map((p) => `- ${p}: ${PEOPLE[p]?.name || p}`).join('\n')
  const talk = history.filter((t) => !t.thinking && t.text).slice(-10).map((t) => `${t.who === 'me' ? name : 'You'}: ${t.text}${t.who === 'bot' && (t.items?.length || t.acts?.length) ? ` [you offered ${[...(t.items || []).map((i) => i.title), ...(t.acts?.length ? [`${t.acts.length} change(s)`] : [])].join('; ')} · ${t.state === 'done' ? 'they said yes, it’s done' : t.state === 'dropped' ? 'they said no' : 'not answered yet'}]` : ''}`).join('\n')
  const about = aboutJob && s.jobs[aboutJob] ? `${s.jobs[aboutJob].name} (${aboutJob})` : ''
  return `You are Tile OS, the assistant in a tile installation company's app. You're talking with ${name}. Often by voice, on the go, from a job site. Be like a sharp, friendly office manager: short, plain, warm. They may ask you things, tell you what's going on, or tell you to do things.
Today is ${dayLongFull(TODAY)} (${TODAY}).

The team (key: name · job):
${people}

The projects (key: name · address · client):
${jobs}

Our installers (key: name) · outside crews; they never talk to the GC, we pass things on:
${crews}

The kinds of new things:
- "task": something one of us has to do (call, send, check, set up, find out, pick up paperwork)
- "problem": something wrong on a job, not good, broken, missing, wrong, leaking, not ready · that has to be fixed
- "question": a question for us to answer, or to ask the client or the designer. Say it as the question
- "gc": something the GC (the contractor) has to do, provide, fix or answer. A question for the GC too. We tell him today and remind him until it's done
- "touchup": fixing or finishing our own tile work that's already in (grout, a crack, a loose or pitched tile). A punch list (they list what's left to fix on a job): every line is its own "touchup", all on that project. They all go on that project's one punch list. Never a "task" called punch list
- "bring": material or a tool to pick up and bring to a job
- "change": the designer or the client changed what we're doing. It needs a price and an OK
- "measure": go measure a job (a new one is fine)
- "meeting": a meeting or a walkthrough at a day and time. It goes on the calendar of everyone in it. "Set up a meeting with Yakov" (or "for me and Yakov") is ONE meeting with both of them, never a to-do for each

What's going on now, in the app:
${nowFor(s)}

The conversation so far:
${talk || '(it just started. You said hello)'}
${about ? `\nThe project being talked about: ${about}.\n` : ''}
What ${name} just said:
"""
${text.trim()}
"""
${pics ? `\nThey sent ${pics === 1 ? 'a picture' : `${pics} pictures`} with it (a photo, a screenshot or a page of paperwork). They come with this message. Look at ${pics === 1 ? 'it' : 'them'}: answer from what you see, and make to-dos from ${pics === 1 ? 'it' : 'them'} if that's what they ask.\n` : ''}

Answer with JSON only, nothing before or after it:
{"reply":"","items":[{"kind":"task","title":"…","project":"…","newProject":"","who":"…","also":[],"when":"…","time":"…","urgent":false,"note":"…","for":""}],"actions":[{"do":"done","id":"…"}]}

Rules:
- Never write a long dash (\u2014) in what you say. Use a period or a comma.
- Think like a sharp office manager: one thing said is one item, even when two people are in it ("also"). A place that isn't a project in the app: ask before adding it.
- "reply": what you say back. One to three short sentences, the way you'd say it out loud. Asked something: the answer, only from what's above (names, dates, numbers); if it isn't there, say you don't see it in the app. Told things to do: say plainly what you'll add or change ("I'll put the drain at 114 on Yakov's list for tomorrow. OK?"); nothing happens until they tap yes, so never say it's done. Just talking: a short friendly line, then ask what's going on. Never make anything up.
- "items": the new things to do from what they JUST said, not from earlier in the talk (those were handled). One for each separate thing. Never add anything that wasn't said. Skip greetings, filler, repeats and thinking out loud. No items for a question.
  - "title": short and plain, like a line on a to-do list (at most 70 characters), in their words. Keep numbers and measurements exactly as said.
  - "project": the project key. A number said alone ("110", "114") is the project whose name or address starts with it. None named: the project being talked about, if there is one and it fits; otherwise "". A place that isn't on the list (a new job): "project" is "" and "newProject" is the place as they said it ("15 Blinky"). Then ask in "reply" if you should add it as a new project ("15 Blinky isn't in the app yet. Should I add it as a new project?").
  - "also": the other team keys in it. A meeting: everyone else who's in it. A to-do two of them share (whoever gets to it first): the other one. Otherwise [].
  - "who": the team key of whoever does it (a meeting: the one talking, if they're in it). A name said: that person. Site work, site problems, touch-ups, measuring, bringing things and following up with the GC: the site manager. Calls, paperwork and orders: the office. Not sure: the one talking.
  - "when": "Today", "Tomorrow", a weekday like "Wed", a date like "Nov 18". Only if a day was said, or it's clearly for today. Otherwise "".
  - "time": the time of day, only if one was said, like "10:00 AM". "Morning" or "first thing": "9:00 AM". "Noon" or "lunch": "12:00 PM". "Afternoon": "2:00 PM". "End of the day": "4:00 PM". "Evening" or "tonight": "6:00 PM". None said: "". A time said with no day is for today.
  - "urgent": true only if they said it's urgent or for right now. "note": anything else said about it that matters, short, or "". "for": the key of whoever is waiting for it when it's someone else (an installer who asked), or "".
- "actions": changes to to-dos already in the app. Only when they ask for one, using a [key] from the list above: {"do":"done","id":"…"} it's done; {"do":"move","id":"…","when":"Fri","time":"9:00 AM"} a new day (and a time, if one was said); {"do":"assign","id":"…","who":"<team key>"} someone else does it; {"do":"note","id":"…","note":"…"} a note on it. Not sure which to-do they mean: ask in "reply" and leave "actions" empty.`
}
/** a time the AI said ("9:00 AM", "2:30 pm", "14:00") as the app writes it — or nothing */
function timeOf(v: unknown): string | undefined {
  const m = parseTime(typeof v === 'string' ? v : '')
  return m == null || m < 5 * 60 || m > 22 * 60 ? undefined : timeLabel(m).replace(/^(\d+) /, '$1:00 ')
}
/** the old way in (one message, no conversation) — the same assistant */
function promptFor(s: Store, text: string): string { return talkPrompt(s, [], text, '') }
let seq = 0
const newId = () => 'cap' + Date.now().toString(36) + (seq++)
/** the AI's reply: what it says, the new things and the changes — or just a list */
function replyOf(raw: string): { answer: string; items: any[]; actions: any[] } {
  const o = raw.indexOf('{')
  const a = raw.indexOf('[')
  if (o >= 0 && (a < 0 || o < a)) {
    const obj = JSON.parse(raw.slice(o, raw.lastIndexOf('}') + 1))
    const said = typeof obj?.reply === 'string' && obj.reply.trim() ? obj.reply : obj?.answer
    return { answer: typeof said === 'string' ? said.trim() : '', items: Array.isArray(obj?.items) ? obj.items : [], actions: Array.isArray(obj?.actions) ? obj.actions : [] }
  }
  const b = raw.lastIndexOf(']')
  if (a < 0 || b < a) throw new Error('no list')
  const arr = JSON.parse(raw.slice(a, b + 1))
  if (!Array.isArray(arr)) throw new Error('no list')
  return { answer: '', items: arr, actions: [] }
}
/** what the AI said back */
export const answerIn = (raw: string) => { try { return replyOf(raw).answer } catch { return '' } }
/** what it's saying, while it's still being written: as much of the "reply" as has come so far */
export function replySoFar(raw: string): string {
  const m = /"(?:reply|answer)"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(raw)
  if (!m) return ''
  const s = m[1].replace(/\\(u[0-9a-fA-F]{0,3})?$/, '')
  try { return JSON.parse(`"${s}"`) } catch { return s }
}

/* ---------------- changes to what's already there ---------------- */
export type CapAction = { id: string; do: 'done' | 'move' | 'assign' | 'note'; taskId: string; when?: string; at?: string; who?: PersonKey; note?: string }
/** the changes the AI offered, each checked: a real open to-do, a real day, a real person */
export function parseActions(s: Store, raw: string): CapAction[] {
  let arr: any[] = []
  try { arr = replyOf(raw).actions } catch { return [] }
  const team = insidePeople(s)
  const seen = new Set<string>()
  return arr.map((x: any): CapAction | null => {
    const t = s.tasks.find((y) => y.id === x?.id && y.state !== 'done')
    if (!t || !['done', 'move', 'assign', 'note'].includes(x?.do)) return null
    const k = `${x.do}:${t.id}`
    if (seen.has(k)) return null
    seen.add(k)
    if (x.do === 'move') { const when = dayOf(x.when); const at = timeOf(x.time); return when || at ? { id: newId(), do: 'move', taskId: t.id, when: when || t.due || 'Today', ...(at ? { at } : {}) } : null }
    if (x.do === 'assign') return typeof x.who === 'string' && team.includes(x.who as PersonKey) && x.who !== t.owner ? { id: newId(), do: 'assign', taskId: t.id, who: x.who as PersonKey } : null
    if (x.do === 'note') { const note = String(x.note || '').trim().slice(0, 400); return note ? { id: newId(), do: 'note', taskId: t.id, note } : null }
    return { id: newId(), do: 'done', taskId: t.id }
  }).filter((x): x is CapAction => !!x)
}
/** do them — only after the yes */
export function doActions(acts: CapAction[]) {
  const s = useStore.getState()
  acts.forEach((a) => {
    if (a.do === 'done') s.completeTask(a.taskId)
    else if (a.do === 'move' && a.when) { s.setTaskDue(a.taskId, a.when); if (a.at) setTaskTime(a.taskId, a.at) }
    else if (a.do === 'assign' && a.who) s.reassignTask(a.taskId, a.who)
    else if (a.do === 'note' && a.note) s.noteTask(a.taskId, a.note)
  })
}
/** the AI's reply → the list, every field checked against the real projects and people */
export function parseItems(s: Store, raw: string): CapItem[] {
  const arr = replyOf(raw).items
  const team = insidePeople(s)
  return arr.map((x: any): CapItem | null => {
    const title = String(x?.title || '').trim().slice(0, 120)
    if (!title) return null
    const kind: CapKind = CAP_KINDS.some((k) => k.k === x?.kind) ? x.kind : 'task'
    const jobId = typeof x?.project === 'string' && s.jobs[x.project] ? x.project : ''
    const said = typeof x?.who === 'string' && (team.includes(x.who) || PEOPLE[x.who as PersonKey]) ? (x.who as PersonKey) : undefined
    const forWho = typeof x?.for === 'string' && PEOPLE[x.for as PersonKey] && x.for !== (said || whoFor(s, kind, jobId)) && x.for !== meOf(s.role) ? (x.for as PersonKey) : undefined
    const at = timeOf(x?.time)
    const who0 = said || whoFor(s, kind, jobId)
    const also = Array.isArray(x?.also) ? Array.from(new Set(x.also.filter((p: unknown) => typeof p === 'string' && team.includes(p as PersonKey) && p !== who0))) as PersonKey[] : []
    const place = !jobId && typeof x?.newProject === 'string' && x.newProject.trim() ? x.newProject.trim().slice(0, 60) : ''
    return { id: newId(), kind, title: title.charAt(0).toUpperCase() + title.slice(1), jobId, ...(also.length ? { also } : {}), ...(place ? { place, makePlace: true } : {}), who: who0, when: dayOf(x?.when) || (at ? 'Today' : ''), ...(at ? { at } : {}), urgent: !!x?.urgent, note: String(x?.note || '').trim().slice(0, 240) || undefined, forWho }
  }).filter((x): x is CapItem => !!x)
}

/* ---------------- no AI: the words, split into lines ---------------- */
const SKIP = /^(good (morning|evening|afternoon)|hi|hello|hey|yes|yeah|no|ok(ay)?|so|well|thanks|thank you|let me|let's go|what else|anyway|you see|i give you|can you)\b/i
function kindOf(t: string): CapKind {
  const w = t.toLowerCase()
  if (/\bmeasure\b/.test(w)) return 'measure'
  if (/\b(designer|client) (decided|wants|changed)|\bchange order\b|\binstead of\b/.test(w)) return 'change'
  if (/\b(pick up|bring|deliver)\b/.test(w)) return 'bring'
  if (/\b(contractor|gc)\b.*\b(has to|needs to|take care|waiting)|\bwaiting (for|on)\b/.test(w)) return 'gc'
  if (/\b(contractor|gc)\b/.test(w) && /\?\s*$/.test(w)) return 'gc'
  if (/\b(ask|tell|remind) the (gc|contractor)\b/.test(w)) return 'gc'
  if (/\bgrout\b|\btouch.?up|\bpitched\b|\bloose\b|\bcrack/.test(w)) return 'touchup'
  if (/\bnot good\b|\bbroken\b|\bwrong\b|\bmissing\b|\bleak|\bnot ready\b|\bproblem\b/.test(w)) return 'problem'
  if (/\?\s*$|\b(confirm|would .* work|question)\b/.test(w)) return 'question'
  return 'task'
}
export function splitLocally(s: Store, text: string, jobId?: string): CapItem[] {
  const jobs = Object.values(s.jobs)
  const team = insidePeople(s).filter((p) => p !== meOf(s.role))
  const lines = text.replace(/([.!?])\s+/g, '$1\n').split(/\n+/).map((x) => x.trim().replace(/[.!]+$/, '')).filter((x) => x.split(/\s+/).length >= 3 && !SKIP.test(x))
  return lines.map((t) => {
    const kind = kindOf(t)
    const j = projectIn(t, jobs)
    const jid = j?.id || jobId || ''
    const who = personIn(t, team) || whoFor(s, kind, jid)
    const day = DAY_WORDS.find(([re]) => re.test(t.toLowerCase()))?.[1] || ''
    const forWho = kind === 'gc' ? personIn(t, crewsOf(s)) : undefined
    return { id: newId(), kind, title: (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 120), jobId: jid, who, when: day, forWho }
  })
}

/* ---------------- adding them ---------------- */
const TYPE: Partial<Record<CapKind, TaskType>> = { problem: 'Field', question: 'Setup', gc: 'Field', change: 'Changes', measure: 'Field', bring: 'Materials' }
/** each one the way its kind works: a problem is red on the project; the GC's waits on the GC, back on the list to
 *  follow up; a touch-up goes on the project's touch-ups; something to bring goes on whoever brings it — everything
 *  someone else does, you follow */
export function addCaptured(items: CapItem[]) {
  const s = useStore.getState()
  const me = meOf(s.role)
  if (!items.length) return
  s.commit((st) => {
    /* the touch-ups said together for a project: its punch list — one line in its history */
    const punchBy: Record<string, string[]> = {}
    /* a place that isn't a project yet, and they said yes to adding it: it's a project now (Getting ready — the
       office fills in the rest); everything said about it goes on it */
    const made: Record<string, string> = {}
    items.forEach((it) => { if (!it.jobId && it.place && it.makePlace !== false) { const k = it.place.toLowerCase(); made[k] ||= addPlace(st, it.place, me); it.jobId = made[k] } })
    items.forEach((it, i) => {
      const j = it.jobId ? st.jobs[it.jobId] : undefined
      const owner = it.who
      const followers = owner !== me ? [me] : undefined
      const due = it.when || 'Today'
      /* two of them share it: on both their Todays, whoever gets to it first */
      const also = (it.also || []).filter((p) => p !== owner)
      const base: Partial<Task> & { jobId: string; title: string } = { jobId: j?.id || '', title: it.title, owner, for: Array.from(new Set([...rolesOf(st, owner), ...also.flatMap((p) => rolesOf(st, p))])), by: me, followers: followers?.filter((p) => !also.includes(p)), ...(also.length ? { also } : {}), detail: it.note, type: TYPE[it.kind] || guessType(it.title), state: 'now', due, ...(it.at ? { at: it.at } : {}), tone: 'info', urgent: it.urgent || undefined, log: [{ date: NOW, time: clockNow(), who: me, text: 'Created' }] }
      /* a meeting: one, on the calendar of everyone in it — never a to-do for each */
      if (it.kind === 'meeting') {
        const date = isoFromLabel(due) || TODAY
        const start = (it.at ? parseTime(it.at) : null) ?? 9 * 60
        const people = Array.from(new Set([owner, ...also]))
        st.events.push({ id: 'ev' + Date.now().toString(36) + i, jobId: j?.id, kind: /walk/i.test(it.title) ? 'walkthrough' : 'meeting', title: it.title, date, start, dur: 60, people, ...(it.place && !j ? { where: it.place } : {}), ...(it.note ? { note: it.note } : {}), by: me, made: { date: NOW, time: clockNow() } })
        if (j) addHist(st, j.id, { who: me, kind: 'schedule', title: `Meeting set · ${labelFromIso(date)} ${timeLabel(start)}`, detail: [it.title, people.map((p) => PEOPLE[p]?.short).join(', ')].filter(Boolean).join(' · ') })
        return
      }
      if (it.kind === 'touchup' && j) {
        const crew = (j.crew as PersonKey | undefined) || owner
        st.punch.push({ id: 'pu' + Date.now().toString(36) + i, jobId: j.id, text: it.title, where: '', owner: crew, status: 'open', note: it.note })
        ;(punchBy[j.id] ||= []).push(it.title)
        return
      }
      if (it.kind === 'problem') { newTask(st, { ...base, tone: 'bad' }); if (j) addHist(st, j.id, { who: me, kind: 'field', title: `Problem: ${it.title}` }); return }
      /* the GC's: he hears about it today (the message is written), it's needed by the day we start, and someone waiting
         for it (an installer) gets the answer written too — features/gcwait */
      if (it.kind === 'gc') { newTask(st, { ...base, due: undefined, state: 'waiting', waitingOn: 'GC', followUp: it.when || 'Today', needBy: needByFor(st, j), forWho: it.forWho || personIn(it.title, crewsOf(st)), tone: 'warn' }); if (j) addHist(st, j.id, { who: me, kind: 'field', title: `For the GC: ${it.title}` }); return }
      if (it.kind === 'bring') { newTask(st, { ...base, title: j ? `Bring to ${j.name}: ${it.title.replace(/^(bring|pick up)\s+/i, '')}` : it.title, tone: 'warn', req: { what: it.title.replace(/^(bring|pick up)\s+/i, ''), trip: 'asked' } }); return }
      newTask(st, base)
    })
    Object.entries(punchBy).forEach(([jid, lines]) => addHist(st, jid, { who: me, kind: 'field', title: lines.length === 1 ? `Touch-up: ${lines[0]}` : `Punch list: ${lines.length} touch-ups · ${lines.join('; ')}`.slice(0, 220) }))
  }, `${items.length === 1 ? '1 thing' : `${items.length} things`} added`, { tone: 'done', sub: items.some((x) => x.who !== me) ? 'Each is on its person’s Today. You follow what’s someone else’s.' : 'They’re on your Today.' })
}

/** a place said that isn't a project yet ("15 Blinky"): made a project — Getting ready, its client to fill in */
function addPlace(st: Store, name: string, me: PersonKey): string {
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  let clientId = Object.values(st.clients).find((c) => /^private customer$/i.test(c.name))?.id
  if (!clientId) { clientId = 'c' + id; st.clients[clientId] = { id: clientId, name: 'Private customer', kind: 'Homeowner', address: '', phone: '', email: '', notes: '', contacts: [] } as Store['clients'][string] }
  st.jobs[id] = {
    id, name, client: st.clients[clientId].name, clientId, address: name, stage: 'setup', kind: 'install', status: 'info', headline: 'New · added from Tile OS', issues: [], pm: 'ys', site: 'yakov',
    next: { text: 'Get the tile paperwork', owner: 'estimator', due: 'This week' }, keyDate: { label: 'Added', value: NOW }, swatch: 'bianco', building: 'house', stageDates: { won: NOW },
  } as Store['jobs'][string]
  st.rooms[id] = []
  st.prep[id] = { target: 'TBD', meeting: { text: 'TBD' }, installer: 'tbd', confirmed: 'no', paperwork: 'no', po: 'no', material: 'no', deposit: 'na' } as any
  addHist(st, id, { who: me, kind: 'pricing', title: 'Added as a project · from Tile OS, the assistant' })
  return id
}

/* ---------------- the conversation ---------------- */
type Turn = { id: string; who: 'bot' | 'me'; text: string; /** pictures sent with it (shown small) */ pics?: string[]; items?: CapItem[]; acts?: CapAction[]; state?: 'ask' | 'done' | 'dropped'; thinking?: boolean; plain?: boolean }
const NEEDS_JOB: CapKind[] = ['problem', 'touchup', 'bring', 'gc']
export function CaptureModal({ level, jobId, listen, ask }: { level: number; jobId?: string; /** opened from the mic: listening right away */ listen?: boolean; /** asked from search: the question, answered right away */ ask?: string }) {
  const s = useStore()
  const me = meOf(s.role)
  const team = insidePeople(s)
  const [turns, setTurns] = React.useState<Turn[]>(() => [{ id: 'hi', who: 'bot', text: greeting(useStore.getState(), jobId) }])
  const [text, setText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  /* photos and files to send with the next message (+), like ChatGPT — each a picture the AI looks at */
  const [pics, setPics] = React.useState<{ id: string; url: string; blob: Blob }[]>([])
  const [adding, setAdding] = React.useState(false)
  const fileIn = React.useRef<HTMLInputElement>(null)
  /* the project being talked about: the one it was opened on, then the last one named */
  const about = React.useRef(jobId || '')
  const abort = React.useRef<AbortController | null>(null)
  /* words from the mic go in the box — not the stragglers after it's sent */
  const take = React.useRef(true)
  /* the names that may come up — so what's said is written down right */
  const hint = React.useMemo(() => [...insidePeople(s).map((p) => PEOPLE[p]?.name), ...crewsOf(s).map((p) => PEOPLE[p]?.name), ...projectsFor(s).slice(0, 40).map((j) => j.name)].filter(Boolean).join(', ').slice(0, 780), [])
  /* the mic, like ChatGPT's and Claude's: tap it and talk — your words show as you go; ✓ when you're done sends them
     right away. ✕ throws it away */
  const mic = useVoice((t) => { if (take.current) setText((x) => (x.trim() ? `${x.replace(/\s+$/, '')} ${t}` : t)) }, hint, { keep: true })
  const before = React.useRef('')
  /* ✓ was tapped: what's said goes as soon as it's written down — no extra tap */
  const sendAfter = React.useRef(false)
  const now = React.useRef({ text, hearing: mic.hearing, turns, busy, pics })
  now.current = { text, hearing: mic.hearing, turns, busy, pics }
  /* + : photos (the camera on a phone), screenshots, a PDF's pages — up to 6 */
  const addFiles = async (files: File[]) => {
    if (!files.length) return
    setAdding(true)
    try {
      const blobs = await pagesOf(files, Math.max(0, 6 - now.current.pics.length))
      setPics((ps) => [...ps, ...blobs.map((b) => ({ id: newId(), url: URL.createObjectURL(b), blob: b }))].slice(0, 6))
    } catch { /* a file it can't open: left out */ }
    setAdding(false)
    box.current?.focus()
  }
  const end = React.useRef<HTMLDivElement>(null)
  const box = React.useRef<HTMLTextAreaElement>(null)
  const last = turns[turns.length - 1]
  React.useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [turns.length, last?.thinking, last?.state])
  /* the box grows with what's in it */
  const shown = mic.on || mic.busy ? `${text}${text && mic.hearing ? ' ' : ''}${mic.hearing}` : text
  React.useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    const most = Math.max(160, Math.round(window.innerHeight * 0.42))
    el.style.height = `${Math.min(el.scrollHeight, most)}px`
    /* talking (or a long one): the newest words stay in view — never hidden under the bottom of the box */
    if (el.scrollHeight > most && (mic.on || mic.busy || document.activeElement !== el || el.selectionStart === el.value.length)) el.scrollTop = el.scrollHeight
  }, [shown])
  React.useEffect(() => { if (listen && mic.can) { take.current = true; mic.start() } }, [])
  React.useEffect(() => { if (ask?.trim()) void send(ask) }, [])
  React.useEffect(() => () => abort.current?.abort(), [])
  /* ✓: it goes once the last words are in — the browser's last ones, or the careful write-down — a moment of quiet after
     the mic stops, then off it goes (no tap on the arrow) */
  const micNow = React.useRef({ on: mic.on, busy: mic.busy })
  micNow.current = { on: mic.on, busy: mic.busy }
  React.useEffect(() => {
    if (!sendAfter.current || mic.on || mic.busy) return
    const t = setTimeout(() => {
      if (!sendAfter.current || micNow.current.on || micNow.current.busy) return
      sendAfter.current = false
      if (`${now.current.text} ${now.current.hearing}`.trim()) void send()
    }, 600)
    return () => clearTimeout(t)
  }, [mic.on, mic.busy, mic.hearing, text]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (said0?: string) => {
    const sent = now.current.pics
    const said = (said0 ?? `${now.current.text} ${now.current.hearing}`).trim() || (sent.length ? 'What do you see here?' : '')
    if (!said || now.current.busy) return
    take.current = false
    setText('')
    setPics([])
    const history: Said[] = now.current.turns
    const mine: Turn = { id: newId(), who: 'me', text: said, ...(sent.length ? { pics: sent.map((p) => p.url) } : {}) }
    const think: Turn = { id: newId(), who: 'bot', text: '', thinking: true }
    setTurns((ts) => [...ts, mine, think])
    setBusy(true)
    const st = useStore.getState()
    let reply = ''
    let items: CapItem[] = []
    let acts: CapAction[] = []
    let plain = false
    let why = ''
    if (REAL.talk || REAL.ai) {
      abort.current = new AbortController()
      const prompt = talkPrompt(st, history, said, about.current, sent.length)
      const t0 = performance.now()
      let first = 0
      /* the answer shows as it's written — the first words right away */
      const soFar = (raw: string) => {
        const r = replySoFar(raw)
        if (!r || abort.current?.signal.aborted) return
        if (!first) first = performance.now() - t0
        setTurns((ts) => ts.map((t) => (t.id === think.id ? { ...t, thinking: false, text: r } : t)))
      }
      try {
        /* with pictures: the AI that looks at them; words only: the one that answers as it writes */
        const raw = sent.length && REAL.ai ? await REAL.ai(prompt, sent.map((p) => p.blob), abort.current.signal, { fast: true }) : REAL.talk ? await REAL.talk(prompt, soFar, abort.current.signal) : await REAL.ai!(prompt, [], abort.current.signal, { fast: true })
        const done = performance.now() - t0
        noteAnswered(first || done, done)
        reply = answerIn(raw)
        items = parseItems(st, raw)
        acts = parseActions(st, raw)
      } catch (e: any) {
        if (e?.code === 'cancelled') return
        why = e?.message ? String(e.message).replace(/\.$/, '') : ''
      }
    }
    if (abort.current?.signal.aborted) return
    if (!reply && !items.length && !acts.length) {
      items = splitLocally(st, said, about.current || undefined)
      plain = true
      reply = items.length ? `${why ? `I couldn’t reach the AI (${why}) · ` : ''}here’s what I got from your words:` : why ? `I couldn’t reach the AI · ${why}.` : 'I didn’t get that. Say it another way?'
    }
    /* opened on a project: what doesn't name another is for this one */
    if (jobId) items = items.map((x) => (x.jobId ? x : { ...x, jobId }))
    const named = items.find((x) => x.jobId)?.jobId || (acts[0] && st.tasks.find((t) => t.id === acts[0].taskId)?.jobId)
    if (named) about.current = named
    const ask2 = items.length > 0 || acts.length > 0
    setTurns((ts) => ts.map((t) => (t.id === think.id ? { ...t, thinking: false, text: reply || (ask2 ? 'Here’s what I’ll do · OK?' : 'Got it.'), items, acts, plain, state: ask2 ? 'ask' : undefined } : t)))
    setBusy(false)
  }
  const talk = () => {
    before.current = text
    take.current = true
    mic.start()
  }
  /* ✓ — done talking: it goes right away (as soon as the last words are written down) */
  const doneTalking = () => { take.current = true; sendAfter.current = true; mic.stop() }
  /* ✕ — never mind: the box as it was */
  const dropTalking = () => { take.current = false; sendAfter.current = false; mic.cancel(); setText(before.current) }

  const setItem = (tid: string, id: string, p: Partial<CapItem>) => setTurns((ts) => ts.map((t) => (t.id === tid ? { ...t, items: t.items?.map((x) => (x.id === id ? { ...x, ...p } : x)) } : t)))
  const dropItem = (tid: string, id: string) => setTurns((ts) => ts.map((t) => (t.id === tid ? { ...t, items: t.items?.filter((x) => x.id !== id) } : t)))
  const dropAct = (tid: string, id: string) => setTurns((ts) => ts.map((t) => (t.id === tid ? { ...t, acts: t.acts?.filter((x) => x.id !== id) } : t)))
  const yes = (t: Turn) => {
    const items = t.items || []
    const acts = t.acts || []
    if (items.length) addCaptured(items)
    if (acts.length) doActions(acts)
    setTurns((ts) => [...ts.map((x) => (x.id === t.id ? { ...x, state: 'done' as const } : x)), { id: newId(), who: 'bot' as const, text: 'Done. Anything else?' }])
  }
  const no = (t: Turn) => setTurns((ts) => [...ts.map((x) => (x.id === t.id ? { ...x, state: 'dropped' as const } : x)), { id: newId(), who: 'bot' as const, text: 'OK, I left it. What else?' }])

  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Tile OS"
      header={
        <div className="flex items-center gap-3 px-6 pb-2 pt-5 pr-16 max-sm:px-4 max-sm:pt-1 [[data-stacked]_&]:pt-1.5 [[data-stacked]_&]:pr-6" data-capture-head>
          <Helper size={44} mood={busy || mic.busy ? 'thinking' : mic.on ? 'listening' : 'idle'} />
          <div className="min-w-0">
            <h2 className="font-display text-[1.125rem] font-semibold leading-tight text-ink">Tile OS</h2>
            <div className="text-[0.8125rem] text-muted">{mic.on ? 'Listening. Tap ✓ when you’re done' : busy || mic.busy ? 'One second…' : 'Ask me, or tell me what to do'}</div>
          </div>
        </div>
      }
      footer={
        <div className="w-full" data-capture-composer>
          {mic.on && mic.quiet && <div className="mb-2 text-center text-[0.8125rem] text-warn-700" data-capture-quiet>I don’t hear anything. Is the right microphone on?</div>}
          {mic.err && <div className="mb-2 rounded-xl bg-warn-50 px-3.5 py-2.5 text-center text-[0.84375rem] leading-snug text-warn-800" role="alert" data-capture-err>{mic.err}</div>}
          {/* the box, like ChatGPT's: the pictures going with it on top, what you write or say (it grows with it), and under
              it + on the left (a photo, a file), the mic and send on the right. Talking: ✕ on the left, the sound in the
              middle, ✓ on the right — ✓ sends it */}
          <div className={cn('flex w-full flex-col rounded-[1.5rem] border bg-white shadow-[0_0.125rem_0.5rem_rgba(16,24,40,.06)] transition focus-within:border-brand-300 focus-within:ring-[0.1875rem] focus-within:ring-brand-50', mic.on ? 'border-brand-300' : 'border-line')} data-capture-box>
            {(pics.length > 0 || adding) && (
              <div className="flex gap-2 overflow-x-auto px-3 pt-3" data-capture-pics>
                {pics.map((p) => (
                  <span key={p.id} className="relative shrink-0">
                    <img src={p.url} alt="" className="h-16 w-16 rounded-xl border border-line object-cover" />
                    <button type="button" onClick={() => setPics((ps) => ps.filter((x) => x.id !== p.id))} aria-label="Take it off" className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white ring-2 ring-white"><X className="h-3 w-3" strokeWidth={3} /></button>
                  </span>
                ))}
                {adding && <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-line text-[0.75rem] text-muted">Adding…</span>}
              </div>
            )}
            <textarea
              ref={box}
              value={shown}
              onChange={(e) => { if (!mic.on && !mic.busy) { take.current = true; setText(e.target.value) } }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              onPaste={(e) => { const fs = Array.from(e.clipboardData?.files || []).filter((f) => /^image\//.test(f.type)); if (fs.length) { e.preventDefault(); void addFiles(fs) } }}
              readOnly={mic.on || mic.busy}
              placeholder={mic.on ? 'Listening…' : 'Ask anything'}
              aria-label="Ask Tile OS, or tell it what to do"
              rows={1}
              className="min-h-11 w-full resize-none rounded-t-[1.5rem] bg-transparent px-4 pb-0.5 pt-[0.6875rem] text-[1rem] leading-6 text-ink placeholder:text-faint focus:outline-none"
              data-capture-text
            />
            <input ref={fileIn} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; void addFiles(fs) }} data-capture-file />
            <div className="flex min-h-[3.25rem] items-center gap-2 px-1.5 pb-1.5">
              {mic.on ? (
                <>
                  <button type="button" onClick={dropTalking} aria-label="Never mind" data-capture-cancel className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-wash active:scale-95"><X className="h-5 w-5" /></button>
                  <span className="flex min-w-0 flex-1 items-center justify-center" data-capture-listening><Listening level={mic.metering ? mic.level : undefined} /></span>
                  <button type="button" onClick={doneTalking} aria-label="Done talking, send it" data-capture-done
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_-10px_rgba(38,80,207,.9)] transition hover:bg-brand-700 active:scale-95"><Check className="h-5 w-5" strokeWidth={2.75} /></button>
                </>
              ) : mic.busy ? (
                <span className="flex flex-1 items-center justify-center gap-2 text-[0.84375rem] font-semibold text-brand-700" role="status" data-capture-writing><span className="flex gap-1" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${i * 140}ms` }} />)}</span>Writing it down…</span>
              ) : (
                <>
                  <button type="button" onClick={() => fileIn.current?.click()} disabled={busy || pics.length >= 6} aria-label="Add a photo or a file" title="Add a photo or a file" data-capture-attach className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-ink-2 transition hover:bg-wash active:scale-95 disabled:opacity-40"><Plus className="h-5 w-5" /></button>
                  {text.trim() && <button type="button" onClick={() => { setText(''); before.current = ''; box.current?.focus() }} aria-label="Clear it" data-capture-clear className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-wash active:scale-95"><X className="h-4 w-4" /></button>}
                  <span className="flex-1" />
                  {mic.can && (
                    <button type="button" onClick={talk} disabled={busy} aria-label="Talk" title="Talk" data-capture-mic
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-wash active:scale-95 disabled:opacity-50">
                      <Mic className="h-5 w-5" />
                    </button>
                  )}
                  <button type="button" onClick={() => (text.trim() || pics.length ? void send() : mic.can ? talk() : undefined)} disabled={busy} aria-label={text.trim() || pics.length ? 'Send' : 'Talk'} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 active:scale-95 disabled:opacity-50" data-capture-send data-capture-make>{text.trim() || pics.length ? <ArrowUp className="h-5 w-5" /> : <AudioLines className="h-5 w-5" />}</button>
                </>
              )}
            </div>
          </div>
        </div>
      }
      bodyClass="px-5 pb-3 pt-1 max-sm:px-4"
    >
      <div className="space-y-3 [&>div]:[contain:layout_paint]" data-capture-chat>
        {turns.map((t) => t.who === 'me'
          ? <Mine key={t.id} text={t.text} pics={t.pics} />
          : (
            <div key={t.id} className="space-y-2" data-capture-bot>
              <div className="flex items-start gap-2">
                <Helper size={28} still mood="idle" className="mt-0.5" />
                {t.thinking
                  ? <div className="rounded-2xl rounded-tl-md bg-[#f1f4fd] px-4 py-3.5" data-capture-thinking><span className="flex gap-1.5" aria-label="Thinking">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${i * 140}ms` }} />)}</span></div>
                  : <p className="min-w-0 max-w-[88%] whitespace-pre-line rounded-2xl rounded-tl-md bg-[#f1f4fd] px-4 py-2.5 text-[0.9375rem] leading-relaxed text-ink" data-capture-answer>{t.text}</p>}
              </div>
              {(t.items?.length || t.acts?.length || t.state === 'ask') ? <Offer t={t} me={me} team={team} onItem={setItem} onDropItem={dropItem} onDropAct={dropAct} onYes={() => yes(t)} onNo={() => no(t)} /> : null}
            </div>
          ))}
        <div ref={end} />
      </div>
    </Modal>
  )
}

/** what it offers to do: the new things and the changes, to check — nothing happens before the yes */
/** what you said, on the right — drawn once (a long talk scrolls lighter) */
const Mine = React.memo(function Mine({ text, pics }: { text: string; pics?: string[] }) {
  return (
    <div className="flex flex-col items-end gap-1.5" data-capture-mine>
      {pics && pics.length > 0 && <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">{pics.map((u, i) => <img key={i} src={u} alt="" className="h-24 w-24 rounded-xl border border-line object-cover" />)}</div>}
      <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-tr-md bg-brand-600 px-4 py-2.5 text-[0.9375rem] leading-relaxed text-white">{text}</p>
    </div>
  )
})

function Offer({ t, me, team, onItem, onDropItem, onDropAct, onYes, onNo }: { t: Turn; me: PersonKey; team: PersonKey[]; onItem: (tid: string, id: string, p: Partial<CapItem>) => void; onDropItem: (tid: string, id: string) => void; onDropAct: (tid: string, id: string) => void; onYes: () => void; onNo: () => void }) {
  const s = useStore()
  const items = t.items || []
  const acts = t.acts || []
  const n = items.length + acts.length
  /* the touch-ups for one project, said together: its punch list — one card, every line in it */
  const byJob = new Map<string, CapItem[]>()
  items.forEach((x) => { if (x.kind === 'touchup' && x.jobId) byJob.set(x.jobId, [...(byJob.get(x.jobId) || []), x]) })
  const punch = Array.from(byJob.entries()).filter(([, xs]) => xs.length >= 2)
  const inPunch = new Set(punch.flatMap(([, xs]) => xs.map((x) => x.id)))
  const rest = items.filter((x) => !inPunch.has(x.id))
  if (t.state !== 'ask') {
    const what = [...punch.map(([jid, xs]) => `Punch list for ${s.jobs[jid]?.name || 'the project'} (${xs.length})`), ...rest.map((x) => x.title), ...acts.map((a) => `${ACT_WORDS[a.do](a)}: ${s.tasks.find((y) => y.id === a.taskId)?.title || ''}`)]
    return (
      <div className={cn('ml-9 rounded-2xl border px-4 py-2.5 text-[0.84375rem]', t.state === 'done' ? 'border-[#cfe8d9] bg-[#f3faf6] text-[#1f6b43]' : 'border-line bg-[#faf9f7] text-muted')} data-capture-offer={t.state}>
        <span className="flex items-center gap-1.5 font-semibold">{t.state === 'done' ? <><Check className="h-4 w-4" /> Done</> : 'Left out'}</span>
        <span className="mt-0.5 block leading-snug">{what.join(' · ')}</span>
      </div>
    )
  }
  const needsJob = items.filter((x) => !x.jobId && !(x.place && x.makePlace !== false) && NEEDS_JOB.includes(x.kind)).length
  return (
    <div className="rounded-2xl border border-line bg-white" data-capture-offer="ask">
      <ul className="divide-y divide-line-2 px-1.5" data-capture-list>
        {punch.map(([jid, xs]) => <PunchCard key={jid} jobId={jid} items={xs} onChange={(id, p) => onItem(t.id, id, p)} onRemove={(id) => onDropItem(t.id, id)} />)}
        {rest.map((it) => <CapRow key={it.id} it={it} me={me} team={team} onChange={(p) => onItem(t.id, it.id, p)} onRemove={() => onDropItem(t.id, it.id)} />)}
        {acts.map((a) => <ActRow key={a.id} a={a} onRemove={() => onDropAct(t.id, a.id)} />)}
        {!n && <li className="px-2 py-4 text-center text-[0.875rem] text-muted">Nothing left to do here.</li>}
      </ul>
      <div className="flex gap-2 border-t border-line-2 p-3">
        <Button variant="secondary" className="flex-1" onClick={onNo} data-capture-no>Not now</Button>
        <Button variant="primary" className="flex-1" disabled={!n || needsJob > 0} onClick={onYes} data-capture-add>{needsJob ? `Pick ${needsJob === 1 ? 'the project' : `${needsJob} projects`}` : acts.length ? 'Yes, do it' : punch.length && !rest.length ? (punch.length === 1 ? 'Add the punch list' : 'Add the punch lists') : `Add ${items.length}`}</Button>
      </div>
    </div>
  )
}
/** a punch list said out loud: the project once, every touch-up a line under it (fix the words, × takes one off) — all
 *  of them go on that project's punch list */
function PunchCard({ jobId, items, onChange, onRemove }: { jobId: string; items: CapItem[]; onChange: (id: string, p: Partial<CapItem>) => void; onRemove: (id: string) => void }) {
  const s = useStore()
  const k = KIND.touchup
  const I = k.icon
  return (
    <li className="px-2 py-3" data-capture-punch={jobId}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.78125rem] font-semibold" style={{ background: k.bg, color: k.fg }}><I className="h-3.5 w-3.5" />Punch list</span>
        <span className="min-w-0 truncate text-[0.9375rem] font-medium text-ink">{s.jobs[jobId]?.name || 'The project'}</span>
        <span className="shrink-0 text-[0.8125rem] tnum text-muted">{items.length}</span>
      </div>
      <ul className="mt-1.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-start gap-2 border-t border-line-2 first:border-t-0" data-capture-punch-line>
            <Grow value={it.title} onChange={(v) => onChange(it.id, { title: v })} label="Touch-up" className="min-w-0 flex-1 bg-transparent py-2 text-[0.9375rem] leading-snug text-ink focus:outline-none" />
            <button type="button" onClick={() => onRemove(it.id)} aria-label="Leave this out" className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition hover:bg-wash-2 hover:text-ink" data-capture-remove><X className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
    </li>
  )
}
const ACT_WORDS: Record<CapAction['do'], (a: CapAction) => string> = {
  done: () => 'Mark done',
  move: (a) => `Move to ${a.when}`,
  assign: (a) => `Give to ${PEOPLE[a.who!]?.short || a.who}`,
  note: () => 'Add a note',
}
const ACT_ICON: Record<CapAction['do'], LucideIcon> = { done: Check, move: CalendarDays, assign: UserRound, note: StickyNote }
/** one change to something already there: what, to which to-do — × leaves it out */
function ActRow({ a, onRemove }: { a: CapAction; onRemove: () => void }) {
  const s = useStore()
  const t = s.tasks.find((x) => x.id === a.taskId)
  const I = ACT_ICON[a.do]
  return (
    <li className="flex items-start gap-2.5 px-2 py-3" data-capture-act={a.do}>
      <span className="mt-0.5 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-[#eef3fd] px-2.5 text-[0.78125rem] font-semibold text-brand-700"><I className="h-3.5 w-3.5" />{ACT_WORDS[a.do](a)}</span>
      <span className="min-w-0 flex-1 text-[0.9375rem] font-medium leading-snug text-ink">
        {t?.title || 'That to-do'}<span className="font-normal text-muted"> · {(t && s.jobs[t.jobId]?.name) || 'Company'}</span>
        {a.note && <span className="mt-0.5 block text-[0.8125rem] font-normal text-muted">“{a.note}”</span>}
      </span>
      <button type="button" onClick={onRemove} aria-label="Leave this out" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition hover:bg-wash-2 hover:text-ink" data-capture-remove><X className="h-4 w-4" /></button>
    </li>
  )
}

/** a line you can fix that wraps instead of being cut off — as tall as what's in it */
function Grow({ value, onChange, label, className, ...rest }: { value: string; onChange: (v: string) => void; label: string; className?: string } & Record<`data-${string}`, unknown>) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useLayoutEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }, [value])
  return <textarea ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))} aria-label={label} className={cn('resize-none overflow-hidden', className)} {...rest} />
}

/** one thing on the list: its kind (tap to change), what, and the project, who and when as chips — × takes it off */
function CapRow({ it, me, team, onChange, onRemove }: { it: CapItem; me: PersonKey; team: PersonKey[]; onChange: (p: Partial<CapItem>) => void; onRemove: () => void }) {
  const s = useStore()
  const forWho = it.forWho || (it.kind === 'gc' ? personIn(it.title, crewsOf(s)) : undefined)
  const k = KIND[it.kind]
  const I = k.icon
  const missing = !it.jobId && !(it.place && it.makePlace !== false) && ['problem', 'touchup', 'bring', 'gc'].includes(it.kind)
  const whoOptions = [me, ...team.filter((p) => p !== me)].map((p) => ({ key: p as string, label: p === me ? 'Me' : PEOPLE[p]?.name || p, hint: p === me ? undefined : PEOPLE[p]?.roleLabel, lead: <Avatar who={p} size={20} /> }))
  const whenOptions = ['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon', ...(it.when && !['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon'].includes(it.when) ? [it.when] : [])].map((d) => ({ key: d, label: d === 'Next Mon' ? 'Next Monday' : d }))
  return (
    <li className="px-2 py-3" data-capture-item={it.kind}>
      <div className="flex min-w-0 items-start gap-2.5">
        <Menu align="start" width={300} trigger={<button type="button" aria-label={`Kind: ${k.label} · change it`} className="mt-0.5 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.78125rem] font-semibold transition hover:brightness-95" style={{ background: k.bg, color: k.fg }} data-capture-kind={it.kind}><I className="h-3.5 w-3.5" />{k.label}<ChevronDown className="h-3 w-3 opacity-70" /></button>}>
          <MenuLabel>What it is</MenuLabel>
          {CAP_KINDS.map((x) => { const XI = x.icon; return <MenuItem key={x.k} icon={<XI className="h-4 w-4" style={{ color: x.fg }} />} hint={x.hint} onSelect={() => onChange({ kind: x.k })}><span className="flex items-center gap-2">{x.label}{x.k === it.kind && <Check className="h-4 w-4 text-brand-600" strokeWidth={2.5} />}</span></MenuItem> })}
        </Menu>
        <Grow value={it.title} onChange={(v) => onChange({ title: v })} label="What" className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-[0.9375rem] font-medium leading-snug text-ink outline-none focus:bg-white focus:ring-2 focus:ring-brand-100" data-capture-title />
        <button type="button" onClick={onRemove} aria-label="Take it off the list" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition hover:bg-wash-2 hover:text-ink" data-capture-remove><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[0.125rem]">
        <ProjectChip value={it.jobId} onChange={(id) => onChange({ jobId: id })} placeholder={missing ? 'Which project?' : 'No project'} warn={missing} />
        <SearchSelect label="Who" value={it.who} options={whoOptions} onChange={(p) => onChange({ who: p as PersonKey })} search={whoOptions.length > 8} width={300}
          trigger={<button type="button" aria-label="Who" className={cn(PICK_CHIP, 'pl-1.5')}><Avatar who={it.who} size={22} /><span className="min-w-0 truncate">{it.who === me ? 'Me' : PEOPLE[it.who]?.short || it.who}</span><ChevronDown className="!h-3.5 !w-3.5 !text-faint" /></button>} />
        <SearchSelect label="When" value={it.when || 'Today'} options={whenOptions} onChange={(d) => onChange({ when: d })} search={false} width={220}
          trigger={<button type="button" aria-label="When" className={PICK_CHIP}><CalendarDays /><span>{it.kind === 'gc' ? `Tell the GC ${(it.when || 'Today').replace(/^(Today|Tomorrow)$/, (m) => m.toLowerCase())}` : it.when || 'Today'}</span><ChevronDown className="!h-3.5 !w-3.5 !text-faint" /></button>} />
        {/* the others in it — a meeting's people, or who shares the to-do — each one off with its × */}
        {(it.also || []).map((p) => (
          <span key={p} className={cn(PICK_CHIP, 'pl-1.5 pr-1')} data-capture-also={p}>
            <Avatar who={p} size={22} /><span className="min-w-0 truncate">{p === me ? 'Me' : PEOPLE[p]?.short || p}</span>
            <button type="button" onClick={() => onChange({ also: (it.also || []).filter((x) => x !== p) })} aria-label={`Take ${PEOPLE[p]?.short || p} off`} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-wash-2 hover:text-ink"><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
        {it.at && <span className="text-[0.8125rem] font-medium text-ink-2" data-capture-at>{it.at}</span>}
        {forWho && it.kind === 'gc' && <span className="text-[0.75rem] text-muted" data-capture-for={forWho}>For {PEOPLE[forWho]?.short || forWho}</span>}
        {it.who !== me && <span className="text-[0.75rem] text-muted">You follow it</span>}
      </div>
      {it.note && <div className="mt-1.5 pl-1 text-[0.8125rem] leading-snug text-muted">{it.note}</div>}
      {/* a place that isn't a project yet: add it as one? (yes by default — it's said here, before anything happens) */}
      {!it.jobId && it.place && (
        <label className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-xl bg-[#f6f8fe] px-3 py-2 text-[0.875rem] text-ink" data-capture-place={it.place}>
          <input type="checkbox" checked={it.makePlace !== false} onChange={(e) => onChange({ makePlace: e.target.checked })} className="h-4 w-4 accent-[#2650cf]" />
          <span className="min-w-0 flex-1"><b className="font-semibold">{it.place}</b> isn’t in the app yet. Add it as a new project</span>
        </label>
      )}
    </li>
  )
}

/** the way in, on top of + New: the little robot, the question, and the mic */
export function SayItBar({ jobId, onOpen }: { jobId?: string; onOpen?: () => void }) {
  const s = useStore()
  const open = (listen?: boolean) => { onOpen?.(); s.open({ t: 'capture', jobId, listen }) }
  return (
    <div role="button" tabIndex={0} onClick={() => open()} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open() }}
      className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-brand-100 bg-gradient-to-r from-[#f3f6fe] to-white px-3.5 py-3 transition hover:border-brand-200" data-say-it>
      <Helper size={40} mood="idle" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[0.9375rem] font-semibold text-ink">What’s going on?</span>
        <span className="block truncate text-[0.8125rem] text-muted">Ask me, or tell me what to do</span>
      </span>
      <button type="button" onClick={(e) => { e.stopPropagation(); open(true) }} aria-label="Talk" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_-10px_rgba(38,80,207,.9)] transition hover:bg-brand-700 active:scale-95" data-say-mic><Mic className="h-5 w-5" /></button>
    </div>
  )
}
