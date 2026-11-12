/* Say it — one box for everything: talk (or type) about what's going on, and Tile OS makes the list. Each thing comes
 * out as the right kind — something to do, a problem, a question, the GC's, a touch-up, something to bring to the job,
 * a change, a job to measure — on the right project, for the right person, with a day. What's someone else's, you
 * follow. Nobody picks a form or a category: you check the list, fix what's off, and tap Add.
 * The AI is the company's own (Lovable AI, on the server). Where it isn't on, the words are split into lines by
 * themselves — the same list to check, just less clever. */
import * as React from 'react'
import { ArrowLeftRight, Building2, CalendarDays, Check, ChevronDown, ChevronLeft, HardHat, HelpCircle, ListTodo, Mic, Ruler, Sparkles, Square, TriangleAlert, Truck, X, type LucideIcon } from 'lucide-react'
import { useStore, meOf, NOW, newTask, addHist, type Store } from '@/tileos/store'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, STAGE_LABEL, type Job, type PersonKey, type Role } from '@/tileos/data/model'
import type { Task, TaskType } from '@/tileos/data/work'
import { REAL } from '@/tileos/lib/save'
import { TODAY, addDays, dow, isoFromLabel, labelFromIso, dayLongFull, md } from '@/tileos/lib/today'
import { insidePeople } from './steps-ui'
import { siteOf } from './steps'
import { projectIn, personIn, guessType, DAY_WORDS } from './mytasks'
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
  const open = s.tasks.filter((t) => t.state !== 'done' && (admin || t.owner === me || t.followers?.includes(me) || on.has(t.jobId))).slice(0, 300)
  const todos = open.map((t) => `- ${t.title} · ${s.jobs[t.jobId]?.name || 'the company'} · ${who(t.owner)} · ${t.state === 'waiting' ? `waiting on ${t.waitingOn || 'someone'}${t.followUp ? `, next follow-up ${t.followUp}` : ''}` : t.due ? `due ${t.due}` : 'no day set'}${t.said ? ` · the GC said “${t.said.text}” on ${md(t.said.day)}` : ''}${t.needBy ? ` · needed by ${md(t.needBy)}` : ''}${t.urgent ? ' · urgent' : ''}`)
  return `Projects (name — client — where it is — start — next steps):\n${projects.join('\n') || '(none)'}\n\nOpen to-dos (what · project · whose · when):\n${todos.join('\n') || '(none)'}`
}

function promptFor(s: Store, text: string): string {
  const me = meOf(s.role)
  const team = insidePeople(s)
  const people = team.map((p) => `- ${p}: ${PEOPLE[p]?.name || p}${PEOPLE[p]?.roleLabel ? ` — ${PEOPLE[p].roleLabel}` : ''}${p === me ? ' (the one talking)' : ''}`).join('\n')
  const jobs = projectsFor(s).map((j) => `- ${j.id}: ${j.name}${j.address ? ` — ${j.address}` : ''}${j.client ? ` — client ${j.client}` : ''}`).join('\n')
  const crews = crewsOf(s).map((p) => `- ${p}: ${PEOPLE[p]?.name || p}`).join('\n')
  return `You help a tile installation company keep track of its work. ${PEOPLE[me]?.name || 'The boss'} talked or typed. They may tell you what's going on — turn it into things to do in the company's app — or ask you something about the work — answer it — or both.
Today is ${dayLongFull(TODAY)} (${TODAY}).

The team (key: name — job):
${people}

The projects (key: name — address — client):
${jobs}

Our installers (key: name) — outside crews; they never talk to the GC, we pass things on:
${crews}

The kinds of things:
- "task": something one of us has to do (call, send, check, set up, find out, pick up paperwork)
- "problem": something wrong on a job — not good, broken, missing, wrong, leaking, not ready — that has to be fixed
- "question": a question for us to answer, or to ask the client or the designer — say it as the question
- "gc": something the GC (the contractor) has to do, provide, fix or answer — a question for the GC too ("what's the lockbox code at 114?", said as the question). We tell him today and remind him until it's done
- "touchup": fixing or finishing our own tile work that's already in (grout, a crack, a loose or pitched tile)
- "bring": material or a tool to pick up and bring to a job
- "change": the designer or the client changed what we're doing — it needs a price and an OK
- "measure": go measure a job (a new one is fine)

What's going on now, in the app (use it to answer questions):
${nowFor(s)}

Rules:
- A question ("where does the drain at 114 stand?", "what's Yaakov late on?", "what did the GC say?", "what's next at 110?"): answer it in "answer" — short and plain, two or three sentences or a few short lines, with names and dates, only from what's above. If it isn't there, say you don't see it in the app. A question isn't a to-do: no item for it. Nothing asked: "answer" is "".
- One item for each separate thing to do. Never add anything that wasn't said. Skip greetings, talk to other people, filler, repeats, and thinking out loud.
- "title": short and plain, like a line on a to-do list (at most 70 characters), in their words. Keep numbers and measurements exactly as said.
- "project": the project key it's about, or "" if you can't tell. A number said alone ("110", "114") is the project whose name or address starts with it. A place that isn't on the list (a new job): "" and put the place in the title.
- "who": the team key of whoever does it. A name said: that person. Site work, site problems, touch-ups, measuring, bringing things and following up with the GC: the site manager. Calls, paperwork and orders: the office. Not sure: the one talking.
- "when": "Today", "Tomorrow", a weekday like "Wed", a date like "Nov 18" — only if a day was said, or it's clearly for today. Otherwise "".
- "urgent": true only if they said it's urgent or for right now.
- "note": anything else said about it that matters, short. Otherwise "".
- "for": the key of whoever is waiting for it, when it's someone else — an installer who asked ("Walter needs the code" → walter) or one of the team. Otherwise "".

Answer with JSON only, nothing before or after it:
{"answer":"","items":[{"kind":"task","title":"…","project":"…","who":"…","when":"…","urgent":false,"note":"…","for":""}]}

What was said:
"""
${text.trim()}
"""`
}
let seq = 0
const newId = () => 'cap' + Date.now().toString(36) + (seq++)
/** the AI's reply: its answer and the list — or just the list */
function replyOf(raw: string): { answer: string; items: any[] } {
  const o = raw.indexOf('{')
  const a = raw.indexOf('[')
  if (o >= 0 && (a < 0 || o < a)) {
    const obj = JSON.parse(raw.slice(o, raw.lastIndexOf('}') + 1))
    return { answer: typeof obj?.answer === 'string' ? obj.answer.trim() : '', items: Array.isArray(obj?.items) ? obj.items : [] }
  }
  const b = raw.lastIndexOf(']')
  if (a < 0 || b < a) throw new Error('no list')
  const arr = JSON.parse(raw.slice(a, b + 1))
  if (!Array.isArray(arr)) throw new Error('no list')
  return { answer: '', items: arr }
}
/** what the AI answered, if it was asked something */
export const answerIn = (raw: string) => { try { return replyOf(raw).answer } catch { return '' } }
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

/* ---------------- the window ---------------- */
type Phase = 'say' | 'think' | 'check'
export function CaptureModal({ level, jobId, listen }: { level: number; jobId?: string; /** opened from the mic: listening right away */ listen?: boolean }) {
  const s = useStore()
  const me = meOf(s.role)
  const [text, setText] = React.useState('')
  const [phase, setPhase] = React.useState<Phase>('say')
  const [items, setItems] = React.useState<CapItem[]>([])
  const [plain, setPlain] = React.useState(false)
  const [why, setWhy] = React.useState('')
  /* what it answered, when it was asked something */
  const [answer, setAnswer] = React.useState('')
  const abort = React.useRef<AbortController | null>(null)
  /* the names that may come up — so a recording written down spells them right */
  const hint = React.useMemo(() => [...insidePeople(s).map((p) => PEOPLE[p]?.name), ...crewsOf(s).map((p) => PEOPLE[p]?.name), ...projectsFor(s).slice(0, 40).map((j) => j.name)].filter(Boolean).join(', ').slice(0, 780), [])
  const mic = useVoice((t) => setText((x) => (x.trim() ? `${x.replace(/\s+$/, '')} ${t}` : t)), hint)
  React.useEffect(() => { if (listen && mic.can) mic.start() }, [])
  React.useEffect(() => () => abort.current?.abort(), [])
  const team = insidePeople(s)
  const make = async () => {
    if (mic.on) mic.stop()
    if (mic.busy) return
    const said = `${text} ${mic.hearing}`.trim()
    if (!said) return
    setPhase('think')
    const st = useStore.getState()
    let list: CapItem[] | null = null
    let said2 = ''
    if (REAL.ai) {
      abort.current = new AbortController()
      try { const raw = await REAL.ai(promptFor(st, said), [], abort.current.signal); said2 = answerIn(raw); list = parseItems(st, raw) } catch (e: any) { list = null; setWhy(e?.code && e.code !== 'cancelled' && e?.message ? String(e.message) : '') }
    }
    if (abort.current?.signal.aborted) return
    setAnswer(said2)
    if (!said2 && (!list || !list.length)) { list = splitLocally(st, said, jobId); setPlain(true) } else setPlain(false)
    list ||= []
    /* opened on a project: what doesn't name another one is for this one */
    if (jobId) list = list.map((x) => (x.jobId ? x : { ...x, jobId, who: x.who }))
    setItems(list)
    setPhase('check')
  }
  const set = (id: string, p: Partial<CapItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const add = () => { addCaptured(items); s.closeAll() }
  const needsJob = items.filter((x) => !x.jobId && ['problem', 'touchup', 'bring', 'gc'].includes(x.kind)).length
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Say it"
      header={
        <div className="flex items-center gap-3 px-6 pb-1 pt-5 pr-16 max-sm:px-4 max-sm:pt-1 [[data-stacked]_&]:pt-1.5 [[data-stacked]_&]:pr-6" data-capture-head>
          <Helper size={phase === 'check' ? 44 : 60} mood={phase === 'think' || mic.busy ? 'thinking' : mic.on ? 'listening' : phase === 'check' ? 'happy' : 'idle'} />
          <div className="min-w-0">
            <h2 className="font-display text-[1.25rem] font-semibold leading-tight tracking-[-0.01em] text-ink max-sm:text-[1.125rem]">{phase === 'check' ? (items.length ? `${items.length === 1 ? '1 thing' : `${items.length} things`} — check them` : answer ? 'Here’s what I see' : 'Nothing to add') : 'What’s going on?'}</h2>
            <div className="mt-0.5 text-[0.875rem] text-muted">{phase === 'check' ? (items.length ? (plain ? (why ? `Split from your words. ${why}` : 'Split from your words — fix what’s off, then Add.') : 'Fix what’s off, then Add.') : answer ? 'From what’s in the app right now.' : '') : phase === 'think' ? 'Sorting it out…' : 'Ask me, or tell me what’s going on — I’ll make the list.'}</div>
          </div>
        </div>
      }
      footer={phase === 'check' ? (
        <>
          <Button variant="ghost" icon={<ChevronLeft />} onClick={() => { setText(''); setAnswer(''); setPhase('say') }} data-capture-back>{answer && !items.length ? 'Ask something else' : 'What I said'}</Button>
          {answer && !items.length
            ? <Button variant="primary" className="ml-auto max-sm:flex-1" onClick={s.close} data-capture-done>Done</Button>
            : <Button variant="primary" className="ml-auto max-sm:flex-1" disabled={!items.length || needsJob > 0} onClick={add} data-capture-add>{needsJob ? `Pick ${needsJob === 1 ? 'the project' : `${needsJob} projects`}` : `Add ${items.length}`}</Button>}
        </>
      ) : phase === 'say' ? (
        <Button variant="primary" className="ml-auto max-sm:flex-1" disabled={mic.busy || !`${text}${mic.hearing}`.trim()} onClick={make} data-capture-make>Make the list</Button>
      ) : undefined}
      bodyClass="px-6 pb-5 pt-3 max-sm:px-4"
    >
      {phase === 'say' && (
        <div data-capture-say>
          <div className="relative">
            <textarea
              value={mic.hearing ? `${text}${text ? ' ' : ''}${mic.hearing}` : text}
              onChange={(e) => { if (!mic.on) setText(e.target.value) }}
              readOnly={mic.on}
              placeholder={'“The drain in the laundry room at 110 isn’t good. Yaakov — measure 15 Basewood Drive tomorrow…”'}
              aria-label="What’s going on"
              data-autofocus
              rows={6}
              className="w-full resize-none rounded-xl border border-line bg-white px-4 py-3 text-[1rem] leading-relaxed text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50"
              data-capture-text
            />
          </div>
          {/* the mic, big — while it listens, the sound moves */}
          {mic.can && (
            <div className="mt-4 flex flex-col items-center gap-2.5">
              <button type="button" disabled={mic.busy} onClick={mic.on ? mic.stop : () => mic.start()} aria-pressed={mic.on} aria-label={mic.on ? 'Stop listening' : 'Talk'} data-capture-mic
                className={cn('relative inline-flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_10px_24px_-12px_rgba(38,80,207,.8)] transition active:scale-95', mic.on ? 'bg-bad-500' : 'bg-brand-600 hover:bg-brand-700')}>
                {mic.on && <span className="absolute inset-0 animate-ping rounded-full bg-bad-400/40" aria-hidden />}
                {mic.on ? <Square className="relative h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
              </button>
              {mic.busy ? <span className="flex items-center gap-2 text-[0.875rem] font-semibold text-brand-700" role="status" data-capture-writing><span className="flex gap-1" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${i * 140}ms` }} />)}</span>Writing it down…</span>
                : mic.on ? <Listening level={mic.metering ? mic.level : undefined} /> : <span className="text-[0.8125rem] text-muted">{text ? 'Tap to say more' : 'Tap to talk'}</span>}
              {mic.on && mic.quiet && <span className="text-[0.8125rem] text-warn-700" data-capture-quiet>I don’t hear anything — is the right microphone on?</span>}
            </div>
          )}
          {mic.err && <div className="mx-auto mt-3 max-w-[28rem] rounded-xl bg-warn-50 px-3.5 py-2.5 text-center text-[0.84375rem] leading-snug text-warn-800" role="alert" data-capture-err>{mic.err}</div>}
        </div>
      )}
      {phase === 'think' && (
        <div className="flex flex-col items-center gap-3 py-10" data-capture-think>
          <div className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${i * 140}ms` }} />)}</div>
          <button type="button" onClick={() => { abort.current?.abort(); setPhase('say') }} className="text-[0.8125rem] font-medium text-muted hover:text-ink">Stop</button>
        </div>
      )}
      {phase === 'check' && answer && (
        <p className={cn('whitespace-pre-line rounded-2xl rounded-tl-md bg-[#f1f4fd] px-4 py-3 text-[0.9375rem] leading-relaxed text-ink', items.length > 0 && 'mb-3')} data-capture-answer>{answer}</p>
      )}
      {phase === 'check' && (items.length > 0 || !answer) && (
        <ul className="-mx-2" data-capture-list>
          {items.map((it) => <CapRow key={it.id} it={it} me={me} team={team} onChange={(p) => set(it.id, p)} onRemove={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} />)}
          {!items.length && <li className="px-2 py-8 text-center text-[0.9375rem] text-muted">Nothing in it to add — go back and say a bit more.</li>}
        </ul>
      )}
    </Modal>
  )
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
    <li className="rounded-xl px-2 py-3 transition hover:bg-[#faf9f7]" data-capture-item={it.kind}>
      <div className="flex min-w-0 items-start gap-2.5">
        <Menu align="start" width={300} trigger={<button type="button" aria-label={`Kind: ${k.label} — change it`} className="mt-0.5 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.78125rem] font-semibold transition hover:brightness-95" style={{ background: k.bg, color: k.fg }} data-capture-kind={it.kind}><I className="h-3.5 w-3.5" />{k.label}<ChevronDown className="h-3 w-3 opacity-70" /></button>}>
          <MenuLabel>What it is</MenuLabel>
          {CAP_KINDS.map((x) => { const XI = x.icon; return <MenuItem key={x.k} icon={<XI className="h-4 w-4" style={{ color: x.fg }} />} hint={x.hint} onSelect={() => onChange({ kind: x.k })}><span className="flex items-center gap-2">{x.label}{x.k === it.kind && <Check className="h-4 w-4 text-brand-600" strokeWidth={2.5} />}</span></MenuItem> })}
        </Menu>
        <input value={it.title} onChange={(e) => onChange({ title: e.target.value })} aria-label="What" className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-[0.9375rem] font-medium leading-snug text-ink outline-none focus:bg-white focus:ring-2 focus:ring-brand-100" data-capture-title />
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

/** the way into Say it, on top of + New: the little robot, the question, and the mic */
export function SayItBar({ jobId, onOpen }: { jobId?: string; onOpen?: () => void }) {
  const s = useStore()
  const open = (listen?: boolean) => { onOpen?.(); s.open({ t: 'capture', jobId, listen }) }
  return (
    <div role="button" tabIndex={0} onClick={() => open()} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open() }}
      className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-brand-100 bg-gradient-to-r from-[#f3f6fe] to-white px-3.5 py-3 transition hover:border-brand-200" data-say-it>
      <Helper size={40} mood="idle" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[0.9375rem] font-semibold text-ink">What’s going on?</span>
        <span className="block truncate text-[0.8125rem] text-muted">Say it or type it — it makes the tasks, each the right kind</span>
      </span>
      <button type="button" onClick={(e) => { e.stopPropagation(); open(true) }} aria-label="Talk" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_-10px_rgba(38,80,207,.9)] transition hover:bg-brand-700 active:scale-95" data-say-mic><Mic className="h-5 w-5" /></button>
    </div>
  )
}
