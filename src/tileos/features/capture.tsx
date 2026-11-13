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
import { ArrowLeftRight, ArrowUp, Building2, CalendarDays, Check, ChevronDown, HardHat, HelpCircle, ListTodo, Mic, Ruler, Sparkles, Square, StickyNote, TriangleAlert, Truck, UserRound, X, type LucideIcon } from 'lucide-react'
import { useStore, meOf, NOW, newTask, addHist, type Store } from '@/tileos/store'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, STAGE_LABEL, PRICING_STAGES, type Job, type PersonKey, type Role } from '@/tileos/data/model'
import type { Task, TaskType } from '@/tileos/data/work'
import { REAL } from '@/tileos/lib/save'
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

/* ---------------- the kinds of things ---------------- */
export type CapKind = 'task' | 'problem' | 'question' | 'gc' | 'touchup' | 'bring' | 'change' | 'measure'
export const CAP_KINDS: { k: CapKind; label: string; hint: string; icon: LucideIcon; fg: string; bg: string }[] = [
  { k: 'task', label: 'To do', hint: 'Something one of us does', icon: ListTodo, fg: '#2650cf', bg: '#eaf0fc' },
  { k: 'problem', label: 'Problem', hint: 'Something wrong — it holds the job up', icon: TriangleAlert, fg: '#c03a2d', bg: '#fbecea' },
  { k: 'question', label: 'Question', hint: 'To answer, or to ask the client or the designer', icon: HelpCircle, fg: '#6b55c9', bg: '#f1eefb' },
  { k: 'gc', label: 'The GC’s', hint: 'The GC does it or answers it — we remind him until it’s done', icon: HardHat, fg: '#b06a0c', bg: '#fbf2e2' },
  { k: 'touchup', label: 'Touch-up', hint: 'Fix or finish our own work', icon: Sparkles, fg: '#b83a5e', bg: '#fbecf1' },
  { k: 'bring', label: 'Bring to the job', hint: 'Material or a tool, picked up and brought', icon: Truck, fg: '#c25a1a', bg: '#fcefe6' },
  { k: 'change', label: 'Change', hint: 'The designer or the client changed it — price it, get the OK', icon: ArrowLeftRight, fg: '#4b4fc6', bg: '#eeeffc' },
  { k: 'measure', label: 'Measure', hint: 'Go measure a job', icon: Ruler, fg: '#23854f', bg: '#e9f5ee' },
]
const KIND = Object.fromEntries(CAP_KINDS.map((x) => [x.k, x])) as Record<CapKind, (typeof CAP_KINDS)[number]>

export type CapItem = { id: string; kind: CapKind; title: string; jobId: string; who: PersonKey; when: string; urgent?: boolean; note?: string; /** who is waiting for it — an installer asked (the lockbox code): the answer is written for him */ forWho?: PersonKey }

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
    return `- ${j.name}${j.client ? ` (client ${j.client})` : ''} — ${STAGE_LABEL[j.stage] || j.stage}${st ? ` — our crew starts ${md(st)}` : ''}${next.length ? ` — next: ${next.join('; ')}` : ''}`
  })
  const open = s.tasks.filter((t) => t.state !== 'done' && (admin || t.owner === me || t.followers?.includes(me) || on.has(t.jobId))).slice(0, 220)
  const todos = open.map((t) => `- [${t.id}] ${t.title} · ${s.jobs[t.jobId]?.name || 'the company'} · ${who(t.owner)} · ${t.state === 'waiting' ? `waiting on ${t.waitingOn || 'someone'}${t.followUp ? `, next follow-up ${t.followUp}` : ''}` : t.due ? `due ${t.due}` : 'no day set'}${t.said ? ` · the GC said “${t.said.text}” on ${md(t.said.day)}` : ''}${t.needBy ? ` · needed by ${md(t.needBy)}` : ''}${t.urgent ? ' · urgent' : ''}`)
  const c = dayCounts(s)
  return `In numbers: ${c.open} open jobs; on ${PEOPLE[me]?.name || 'their'}'s list today ${c.today}, late ${c.late}.\n\nProjects (name — client — where it is — start — next steps):\n${projects.join('\n') || '(none)'}\n\nOpen to-dos ([key] what · project · whose · when):\n${todos.join('\n') || '(none)'}`
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
/** hello — with the day in numbers; opened on a project: about that one */
export function greeting(s: Store, jobId?: string): string {
  const me = meOf(s.role)
  const first = String(PEOPLE[me]?.short || PEOPLE[me]?.name || '').split(' ')[0]
  const h = new Date().getHours()
  const hi = `${h < 12 ? 'Good morning' : h < 17 ? 'Hi' : 'Good evening'}${first ? `, ${first}` : ''}.`
  if (jobId && s.jobs[jobId]) return `${hi} What’s going on at ${s.jobs[jobId].name}?`
  const c = dayCounts(s)
  return `${hi} ${c.open} open ${c.open === 1 ? 'job' : 'jobs'} — ${c.today} on your list today${c.late ? `, ${c.late} late` : ''}. What’s going on?`
}

/** the conversation so far, the way the AI reads it */
type Said = { who: 'bot' | 'me'; text: string; items?: { title: string }[]; acts?: unknown[]; state?: string; thinking?: boolean }
function talkPrompt(s: Store, history: Said[], text: string, aboutJob: string): string {
  const me = meOf(s.role)
  const name = PEOPLE[me]?.name || 'The boss'
  const team = insidePeople(s)
  const people = team.map((p) => `- ${p}: ${PEOPLE[p]?.name || p}${PEOPLE[p]?.roleLabel ? ` — ${PEOPLE[p].roleLabel}` : ''}${p === me ? ' (the one talking)' : ''}`).join('\n')
  const jobs = projectsFor(s).map((j) => `- ${j.id}: ${j.name}${j.address ? ` — ${j.address}` : ''}${j.client ? ` — client ${j.client}` : ''}`).join('\n')
  const crews = crewsOf(s).map((p) => `- ${p}: ${PEOPLE[p]?.name || p}`).join('\n')
  const talk = history.filter((t) => !t.thinking && t.text).slice(-10).map((t) => `${t.who === 'me' ? name : 'You'}: ${t.text}${t.who === 'bot' && (t.items?.length || t.acts?.length) ? ` [you offered ${[...(t.items || []).map((i) => i.title), ...(t.acts?.length ? [`${t.acts.length} change(s)`] : [])].join('; ')} — ${t.state === 'done' ? 'they said yes, it’s done' : t.state === 'dropped' ? 'they said no' : 'not answered yet'}]` : ''}`).join('\n')
  const about = aboutJob && s.jobs[aboutJob] ? `${s.jobs[aboutJob].name} (${aboutJob})` : ''
  return `You are Tile OS, the assistant in a tile installation company's app. You're talking with ${name} — often by voice, on the go, from a job site. Be like a sharp, friendly office manager: short, plain, warm. They may ask you things, tell you what's going on, or tell you to do things.
Today is ${dayLongFull(TODAY)} (${TODAY}).

The team (key: name — job):
${people}

The projects (key: name — address — client):
${jobs}

Our installers (key: name) — outside crews; they never talk to the GC, we pass things on:
${crews}

The kinds of new things:
- "task": something one of us has to do (call, send, check, set up, find out, pick up paperwork)
- "problem": something wrong on a job — not good, broken, missing, wrong, leaking, not ready — that has to be fixed
- "question": a question for us to answer, or to ask the client or the designer — say it as the question
- "gc": something the GC (the contractor) has to do, provide, fix or answer — a question for the GC too. We tell him today and remind him until it's done
- "touchup": fixing or finishing our own tile work that's already in (grout, a crack, a loose or pitched tile)
- "bring": material or a tool to pick up and bring to a job
- "change": the designer or the client changed what we're doing — it needs a price and an OK
- "measure": go measure a job (a new one is fine)

What's going on now, in the app:
${nowFor(s)}

The conversation so far:
${talk || '(it just started — you said hello)'}
${about ? `\nThe project being talked about: ${about}.\n` : ''}
What ${name} just said:
"""
${text.trim()}
"""

Answer with JSON only, nothing before or after it:
{"reply":"","items":[{"kind":"task","title":"…","project":"…","who":"…","when":"…","urgent":false,"note":"…","for":""}],"actions":[{"do":"done","id":"…"}]}

Rules:
- "reply": what you say back — one to three short sentences, the way you'd say it out loud. Asked something: the answer, only from what's above (names, dates, numbers); if it isn't there, say you don't see it in the app. Told things to do: say plainly what you'll add or change ("I'll put the drain at 114 on Yakov's list for tomorrow — OK?"); nothing happens until they tap yes, so never say it's done. Just talking: a short friendly line, then ask what's going on. Never make anything up.
- "items": the new things to do from what they JUST said — not from earlier in the talk (those were handled). One for each separate thing. Never add anything that wasn't said. Skip greetings, filler, repeats and thinking out loud. No items for a question.
  - "title": short and plain, like a line on a to-do list (at most 70 characters), in their words. Keep numbers and measurements exactly as said.
  - "project": the project key. A number said alone ("110", "114") is the project whose name or address starts with it. None named: the project being talked about, if there is one and it fits; otherwise "". A place that isn't on the list (a new job): "" and put the place in the title.
  - "who": the team key of whoever does it. A name said: that person. Site work, site problems, touch-ups, measuring, bringing things and following up with the GC: the site manager. Calls, paperwork and orders: the office. Not sure: the one talking.
  - "when": "Today", "Tomorrow", a weekday like "Wed", a date like "Nov 18" — only if a day was said, or it's clearly for today. Otherwise "".
  - "urgent": true only if they said it's urgent or for right now. "note": anything else said about it that matters, short, or "". "for": the key of whoever is waiting for it when it's someone else (an installer who asked), or "".
- "actions": changes to to-dos already in the app — only when they ask for one, using a [key] from the list above: {"do":"done","id":"…"} it's done; {"do":"move","id":"…","when":"Fri"} a new day; {"do":"assign","id":"…","who":"<team key>"} someone else does it; {"do":"note","id":"…","note":"…"} a note on it. Not sure which to-do they mean: ask in "reply" and leave "actions" empty.`
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

/* ---------------- changes to what's already there ---------------- */
export type CapAction = { id: string; do: 'done' | 'move' | 'assign' | 'note'; taskId: string; when?: string; who?: PersonKey; note?: string }
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
    if (x.do === 'move') { const when = dayOf(x.when); return when ? { id: newId(), do: 'move', taskId: t.id, when } : null }
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
    else if (a.do === 'move' && a.when) s.setTaskDue(a.taskId, a.when)
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
    return { id: newId(), kind, title: title.charAt(0).toUpperCase() + title.slice(1), jobId, who: said || whoFor(s, kind, jobId), when: dayOf(x?.when), urgent: !!x?.urgent, note: String(x?.note || '').trim().slice(0, 240) || undefined, forWho }
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
    items.forEach((it, i) => {
      const j = it.jobId ? st.jobs[it.jobId] : undefined
      const owner = it.who
      const followers = owner !== me ? [me] : undefined
      const due = it.when || 'Today'
      const base: Partial<Task> & { jobId: string; title: string } = { jobId: j?.id || '', title: it.title, owner, for: rolesOf(st, owner), by: me, followers, detail: it.note, type: TYPE[it.kind] || guessType(it.title), state: 'now', due, tone: 'info', urgent: it.urgent || undefined, log: [{ date: NOW, who: me, text: 'Created' }] }
      if (it.kind === 'touchup' && j) {
        const crew = (j.crew as PersonKey | undefined) || owner
        st.punch.push({ id: 'pu' + Date.now().toString(36) + i, jobId: j.id, text: it.title, where: '', owner: crew, status: 'open', note: it.note })
        addHist(st, j.id, { who: me, kind: 'field', title: `Touch-up: ${it.title}` })
        return
      }
      if (it.kind === 'problem') { newTask(st, { ...base, tone: 'bad' }); if (j) addHist(st, j.id, { who: me, kind: 'field', title: `Problem: ${it.title}` }); return }
      /* the GC's: he hears about it today (the message is written), it's needed by the day we start, and someone waiting
         for it (an installer) gets the answer written too — features/gcwait */
      if (it.kind === 'gc') { newTask(st, { ...base, due: undefined, state: 'waiting', waitingOn: 'GC', followUp: it.when || 'Today', needBy: needByFor(st, j), forWho: it.forWho || personIn(it.title, crewsOf(st)), tone: 'warn' }); if (j) addHist(st, j.id, { who: me, kind: 'field', title: `For the GC: ${it.title}` }); return }
      if (it.kind === 'bring') { newTask(st, { ...base, title: j ? `Bring to ${j.name}: ${it.title.replace(/^(bring|pick up)\s+/i, '')}` : it.title, tone: 'warn', req: { what: it.title.replace(/^(bring|pick up)\s+/i, ''), trip: 'asked' } }); return }
      newTask(st, base)
    })
  }, `${items.length === 1 ? '1 thing' : `${items.length} things`} added`, { tone: 'done', sub: items.some((x) => x.who !== me) ? 'Each is on its person’s Today — you follow what’s someone else’s.' : 'They’re on your Today.' })
}

/* ---------------- the conversation ---------------- */
type Turn = { id: string; who: 'bot' | 'me'; text: string; items?: CapItem[]; acts?: CapAction[]; state?: 'ask' | 'done' | 'dropped'; thinking?: boolean; plain?: boolean }
const NEEDS_JOB: CapKind[] = ['problem', 'touchup', 'bring', 'gc']
export function CaptureModal({ level, jobId, listen, ask }: { level: number; jobId?: string; /** opened from the mic: listening right away */ listen?: boolean; /** asked from search: the question, answered right away */ ask?: string }) {
  const s = useStore()
  const me = meOf(s.role)
  const team = insidePeople(s)
  const [turns, setTurns] = React.useState<Turn[]>(() => [{ id: 'hi', who: 'bot', text: greeting(useStore.getState(), jobId) }])
  const [text, setText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  /* the project being talked about: the one it was opened on, then the last one named */
  const about = React.useRef(jobId || '')
  const abort = React.useRef<AbortController | null>(null)
  /* words from the mic go in the box — not the stragglers after it's sent */
  const take = React.useRef(true)
  /* the names that may come up — so what's said is written down right */
  const hint = React.useMemo(() => [...insidePeople(s).map((p) => PEOPLE[p]?.name), ...crewsOf(s).map((p) => PEOPLE[p]?.name), ...projectsFor(s).slice(0, 40).map((j) => j.name)].filter(Boolean).join(', ').slice(0, 780), [])
  const mic = useVoice((t) => { if (take.current) setText((x) => (x.trim() ? `${x.replace(/\s+$/, '')} ${t}` : t)) }, hint)
  const now = React.useRef({ text, hearing: mic.hearing, turns, busy })
  now.current = { text, hearing: mic.hearing, turns, busy }
  const end = React.useRef<HTMLDivElement>(null)
  const box = React.useRef<HTMLTextAreaElement>(null)
  const last = turns[turns.length - 1]
  React.useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [turns.length, last?.thinking, last?.state])
  /* the box grows with what's in it */
  const shown = mic.on || mic.busy ? `${text}${text && mic.hearing ? ' ' : ''}${mic.hearing}` : text
  React.useLayoutEffect(() => { const el = box.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px` } }, [shown])
  React.useEffect(() => { if (listen && mic.can) { take.current = true; mic.start() } }, [])
  React.useEffect(() => { if (ask?.trim()) void send(ask) }, [])
  React.useEffect(() => () => abort.current?.abort(), [])

  const send = async (said0?: string) => {
    const said = (said0 ?? `${now.current.text} ${now.current.hearing}`).trim()
    if (!said || now.current.busy) return
    take.current = false
    setText('')
    const history: Said[] = now.current.turns
    const mine: Turn = { id: newId(), who: 'me', text: said }
    const think: Turn = { id: newId(), who: 'bot', text: '', thinking: true }
    setTurns((ts) => [...ts, mine, think])
    setBusy(true)
    const st = useStore.getState()
    let reply = ''
    let items: CapItem[] = []
    let acts: CapAction[] = []
    let plain = false
    let why = ''
    if (REAL.ai) {
      abort.current = new AbortController()
      try {
        const raw = await REAL.ai(talkPrompt(st, history, said, about.current), [], abort.current.signal, { fast: true })
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
      reply = items.length ? `${why ? `I couldn’t reach the AI (${why}) — ` : ''}here’s what I got from your words:` : why ? `I couldn’t reach the AI — ${why}.` : 'I didn’t get that — say it another way?'
    }
    /* opened on a project: what doesn't name another is for this one */
    if (jobId) items = items.map((x) => (x.jobId ? x : { ...x, jobId }))
    const named = items.find((x) => x.jobId)?.jobId || (acts[0] && st.tasks.find((t) => t.id === acts[0].taskId)?.jobId)
    if (named) about.current = named
    const ask2 = items.length > 0 || acts.length > 0
    setTurns((ts) => ts.map((t) => (t.id === think.id ? { ...t, thinking: false, text: reply || (ask2 ? 'Here’s what I’ll do — OK?' : 'Got it.'), items, acts, plain, state: ask2 ? 'ask' : undefined } : t)))
    setBusy(false)
  }
  /* the mic: tap to talk, tap again when you're done — it goes as soon as the words are in */
  const [sendAt, setSendAt] = React.useState(0)
  const talk = () => {
    if (mic.on) { setSendAt(Date.now()); mic.stop(); return }
    take.current = true
    mic.start()
  }
  React.useEffect(() => {
    if (!sendAt || mic.on || mic.busy) return
    /* a browser's last words come a moment after it stops */
    const t = setTimeout(() => { setSendAt(0); void send() }, Math.max(0, 650 - (Date.now() - sendAt)))
    return () => clearTimeout(t)
  }, [sendAt, mic.on, mic.busy])

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
            <div className="text-[0.8125rem] text-muted">{mic.on ? 'Listening — tap the red button when you’re done' : busy || mic.busy ? 'One second…' : 'Ask me, or tell me what to do'}</div>
          </div>
        </div>
      }
      footer={
        <div className="w-full" data-capture-composer>
          {(mic.on || mic.busy) && (
            <div className="mb-2 flex items-center justify-center">
              {mic.busy
                ? <span className="flex items-center gap-2 text-[0.84375rem] font-semibold text-brand-700" role="status" data-capture-writing><span className="flex gap-1" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${i * 140}ms` }} />)}</span>Writing it down…</span>
                : <Listening level={mic.metering ? mic.level : undefined} />}
            </div>
          )}
          {mic.on && mic.quiet && <div className="mb-2 text-center text-[0.8125rem] text-warn-700" data-capture-quiet>I don’t hear anything — is the right microphone on?</div>}
          {mic.err && <div className="mb-2 rounded-xl bg-warn-50 px-3.5 py-2.5 text-center text-[0.84375rem] leading-snug text-warn-800" role="alert" data-capture-err>{mic.err}</div>}
          <div className="flex w-full items-end gap-2">
            <textarea
              ref={box}
              value={shown}
              onChange={(e) => { if (!mic.on && !mic.busy) { take.current = true; setText(e.target.value) } }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              readOnly={mic.on || mic.busy}
              placeholder={mic.on ? 'Listening…' : 'Type, or tap the mic'}
              aria-label="Ask Tile OS, or tell it what to do"
              rows={1}
              className="min-h-11 min-w-0 flex-1 resize-none rounded-[1.375rem] border border-line bg-white px-4 py-[0.5625rem] text-[1rem] leading-6 text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50"
              data-capture-text
            />
            {text.trim() && !mic.on && !mic.busy
              ? <button type="button" onClick={() => void send()} disabled={busy} aria-label="Send" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 active:scale-95 disabled:opacity-50" data-capture-send data-capture-make><ArrowUp className="h-5 w-5" /></button>
              : mic.can && (
                <button type="button" onClick={talk} disabled={mic.busy || busy} aria-pressed={mic.on} aria-label={mic.on ? 'Done talking' : 'Talk'} data-capture-mic
                  className={cn('relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-[0_8px_18px_-10px_rgba(38,80,207,.9)] transition active:scale-95 disabled:opacity-50', mic.on ? 'bg-bad-500' : 'bg-brand-600 hover:bg-brand-700')}>
                  {mic.on && <span className="absolute inset-0 animate-ping rounded-full bg-bad-400/40" aria-hidden />}
                  {mic.on ? <Square className="relative h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
                </button>
              )}
          </div>
        </div>
      }
      bodyClass="px-5 pb-3 pt-1 max-sm:px-4"
    >
      <div className="space-y-3" data-capture-chat>
        {turns.map((t) => t.who === 'me'
          ? <div key={t.id} className="flex justify-end" data-capture-mine><p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-tr-md bg-brand-600 px-4 py-2.5 text-[0.9375rem] leading-relaxed text-white">{t.text}</p></div>
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
function Offer({ t, me, team, onItem, onDropItem, onDropAct, onYes, onNo }: { t: Turn; me: PersonKey; team: PersonKey[]; onItem: (tid: string, id: string, p: Partial<CapItem>) => void; onDropItem: (tid: string, id: string) => void; onDropAct: (tid: string, id: string) => void; onYes: () => void; onNo: () => void }) {
  const s = useStore()
  const items = t.items || []
  const acts = t.acts || []
  const n = items.length + acts.length
  if (t.state !== 'ask') {
    const what = [...items.map((x) => x.title), ...acts.map((a) => `${ACT_WORDS[a.do](a)}: ${s.tasks.find((y) => y.id === a.taskId)?.title || ''}`)]
    return (
      <div className={cn('ml-9 rounded-2xl border px-4 py-2.5 text-[0.84375rem]', t.state === 'done' ? 'border-[#cfe8d9] bg-[#f3faf6] text-[#1f6b43]' : 'border-line bg-[#faf9f7] text-muted')} data-capture-offer={t.state}>
        <span className="flex items-center gap-1.5 font-semibold">{t.state === 'done' ? <><Check className="h-4 w-4" /> Done</> : 'Left out'}</span>
        <span className="mt-0.5 block leading-snug">{what.join(' · ')}</span>
      </div>
    )
  }
  const needsJob = items.filter((x) => !x.jobId && NEEDS_JOB.includes(x.kind)).length
  return (
    <div className="rounded-2xl border border-line bg-white" data-capture-offer="ask">
      <ul className="divide-y divide-line-2 px-1.5" data-capture-list>
        {items.map((it) => <CapRow key={it.id} it={it} me={me} team={team} onChange={(p) => onItem(t.id, it.id, p)} onRemove={() => onDropItem(t.id, it.id)} />)}
        {acts.map((a) => <ActRow key={a.id} a={a} onRemove={() => onDropAct(t.id, a.id)} />)}
        {!n && <li className="px-2 py-4 text-center text-[0.875rem] text-muted">Nothing left to do here.</li>}
      </ul>
      <div className="flex gap-2 border-t border-line-2 p-3">
        <Button variant="secondary" className="flex-1" onClick={onNo} data-capture-no>Not now</Button>
        <Button variant="primary" className="flex-1" disabled={!n || needsJob > 0} onClick={onYes} data-capture-add>{needsJob ? `Pick ${needsJob === 1 ? 'the project' : `${needsJob} projects`}` : acts.length ? 'Yes, do it' : `Add ${items.length}`}</Button>
      </div>
    </div>
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
  const missing = !it.jobId && ['problem', 'touchup', 'bring', 'gc'].includes(it.kind)
  const whoOptions = [me, ...team.filter((p) => p !== me)].map((p) => ({ key: p as string, label: p === me ? 'Me' : PEOPLE[p]?.name || p, hint: p === me ? undefined : PEOPLE[p]?.roleLabel, lead: <Avatar who={p} size={20} /> }))
  const whenOptions = ['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon', ...(it.when && !['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon'].includes(it.when) ? [it.when] : [])].map((d) => ({ key: d, label: d === 'Next Mon' ? 'Next Monday' : d }))
  return (
    <li className="px-2 py-3" data-capture-item={it.kind}>
      <div className="flex min-w-0 items-start gap-2.5">
        <Menu align="start" width={300} trigger={<button type="button" aria-label={`Kind: ${k.label} — change it`} className="mt-0.5 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.78125rem] font-semibold transition hover:brightness-95" style={{ background: k.bg, color: k.fg }} data-capture-kind={it.kind}><I className="h-3.5 w-3.5" />{k.label}<ChevronDown className="h-3 w-3 opacity-70" /></button>}>
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
        {forWho && it.kind === 'gc' && <span className="text-[0.75rem] text-muted" data-capture-for={forWho}>For {PEOPLE[forWho]?.short || forWho}</span>}
        {it.who !== me && <span className="text-[0.75rem] text-muted">You follow it</span>}
      </div>
      {it.note && <div className="mt-1.5 pl-1 text-[0.8125rem] leading-snug text-muted">{it.note}</div>}
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
