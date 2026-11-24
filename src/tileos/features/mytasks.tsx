/* Today — your day, in the order it happens. What's late first, then the day hour by hour (meetings at their time),
 * then what can be done any time. Tomorrow and Later are the same, a day at a time. Every row: when · what ·
 * project · the one button. Checklist steps that are your turn show up by themselves — that's the hand-off.
 * Mine / Everyone switches between your list and the whole team's. */
import * as React from 'react'
import { create } from 'zustand'
import { Sparkles, History, Send, MessageSquareReply, CalendarRange, Check, Flag, Plus, Repeat, Clock3, MoonStar, RotateCcw, Ban, Building2, CalendarDays, UserRound, HardHat, ListTodo, Hourglass, CircleCheckBig, Eye, Users, Megaphone, UserPlus, FileText, ClipboardList, Package, ArrowLeftRight, Receipt, ListChecks, HandCoins, ChevronRight, ChevronDown, ChevronLeft, Search, X, ListPlus, Truck, UserRoundCheck, Gauge, BellRing, MoreHorizontal, ArrowRight, MessageSquare, MapPinned, Trash2 } from 'lucide-react'
import { useStore, meOf, NOW, isRequest, DATA_KEYS, clockNow, type Store } from '@/tileos/store'
import { RowStar, starredBy, toggleTaskStar, toggleStepStar, type StarPick } from './star'
import { Button, Avatar, TextInput, TextArea, Field, Chip, Stepper, NO_SUGGEST } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, MenuSep, Pop, DatePresets, WaitPicker, LaterPicker, MonthCal } from '@/tileos/components/ui/overlay'
import { Page, Group, EmptyState, Status, Bubbles, PX, HEAD_ROW, BAND, BAND_LABEL, BAND_STRONG, bandStyle, bandLabel, BandCount, STICKY_HEAD } from '@/tileos/components/ui/page'
import { SearchSelect, MultiSelect } from '@/tileos/components/ui/select'
import { cn, greeting } from '@/tileos/lib/utils'
import { PRICING_STAGES, PEOPLE, CREWS, fmtMoney, loginOf, crewWords, type Role, type PersonKey, type Job } from '@/tileos/data/model'
import { Safe } from '@/tileos/components/ui/safe'
import { TODAY_LABEL } from '@/tileos/data/jobs'
import { REPEAT_LABEL, type Task, type TaskType } from '@/tileos/data/work'
import { runTaskAction, setPunchOwner } from './flows'
import { sendCrewReport } from './flows2'
import { ActivityRow } from './activity'
import { agendaFor, eventWhen } from './agenda'
import { timeLabel, rangeLabel, parseTime, type CalEvent } from '@/tileos/data/calendar'
import { payDue } from './pay-page'
import { payOpen, PAY_WEEKS } from './pay'
import { billsToMake, billTotal, billingOn, LAST_WEEK } from './progressbill'
import { LinkedPO, poOfTask } from './linkedpo'
import { POFollowUp, canEmailFollow } from './pofollow'
import { followersOf, toggleFollow, toggleAlso, setEveryone, removeTask, editTask, canEditTask, canRemoveTask, setTaskTime, clearTaskWhen } from './taskshare'
import { Notes } from './notes'
import { stepTodos, stepsFor, isGettingReady, realOwner, siteOf, emptySpot, toggleStepFollow, setStepDue, setStepOwner, type StepView } from './steps'
import { StepButton } from './steps-ui'
import { todoOf } from './stepwin'
import { TODAY, TOMORROW, dayShort, dayLongFull, isoFromLabel, labelFromIso, addDays, md, workday, dow, daysBetween, pickedLabel } from '@/tileos/lib/today'
import { REAL, awayFromMe, PUBLISHED } from '@/tileos/lib/save'
import { crewMailPeople, crewMailWords, crewMailTo } from './mailout'
import { checkIns, checkInDays, reportOn, handledOf, workdaysBetween, type CheckItem } from './teamreport'
import { SuggestInput } from '@/tileos/components/ui/suggest'
import { insidePeople, fieldPeople } from './steps-ui'
import { isOff } from './active'
import { TripButtons, ROW_BTN } from './requests'
import { markMessageTask } from './messages'
import { FormHead, FormRow, ProjectField, ProjectChip, PICK_CHIP } from './formkit'
import { WinHead, ListHead, WhoMenu, WhenPop, WatchPop, CHIP, KindTag, type WinKind, type WatchPick, type WhenPick, type WhoPick } from './winhead'
import { namesOf } from './estpeople'
import { useSmall } from '@/tileos/lib/phone'
import { roundsToday, roundsOn, roundsSkipped, skipRounds } from './rounds'
/** a phone: a switch takes its share of the width, its buttons split it evenly — one line; a very narrow phone (or big
 *  text) gives each switch its own line rather than cut a word */
import { isGc, isGcWait, isQuestion, toldGc, gcState, gcSoFar, gcWaits, gcWords, gcMessage, askLabel, askedGc, setNeedBy, openWhatsApp, startOf, GcMessageBox, GcAnswer } from './gcwait'
import { TouchupLine, StrayLine } from './touchups'
import { holdWords } from './common'
import { tagOfTask, plainTodo, todosOf, touchupsWords, strayTouchups, TOUCH_WORDS } from './todokinds'
import { autoWho } from './autowho'
import { useSort, sortRows, SortHead, SortMenu, type Sort, type SortCol } from '@/tileos/components/ui/sort'

const TODAY_ISO = TODAY
const TYPES: TaskType[] = ['Pricing', 'Setup', 'Materials', 'Field', 'Changes', 'Schedule', 'Money']
const ASSIGNABLE: PersonKey[] = ['ys', 'yakov', 'office', 'estimator', 'takeoff', 'materials', 'accounting']
const ROLE_OF: Partial<Record<PersonKey, Role[]>> = { ys: ['owner', 'pm'], yakov: ['site'], office: ['office'], estimator: ['estimator'], takeoff: ['takeoff'], materials: ['materials'], accounting: ['accounting'] }
const TYPE_ICON: Record<TaskType, React.ElementType> = { Pricing: FileText, Setup: ClipboardList, Materials: Package, Field: HardHat, Changes: ArrowLeftRight, Schedule: CalendarDays, Money: Receipt }
/** what kind of thing a task is, in its window's top line — so you know what you opened */
const TYPE_KIND: Record<TaskType, string> = { Pricing: 'Estimate', Setup: 'Task', Materials: 'Materials', Field: 'Task', Changes: 'Change order', Schedule: 'Schedule', Money: 'Billing' }
export function taskKind(t: Task): WinKind {
  if (isGcWait(t)) return { icon: <Hourglass />, label: 'Waiting on the GC' }
  if (isRequest(t)) return { icon: <Truck />, label: 'Bring to the job' }
  if (t.everyone) return { icon: <Megaphone />, label: 'For everyone' }
  /* the touch-ups' to-do: said so, the same as its line on Today */
  if (useStore.getState().punch.some((p) => p.taskId === t.id)) return { icon: <Sparkles />, label: 'Touch-ups' }
  const Ic = t.type === 'Setup' || !TYPE_ICON[t.type] ? ListTodo : TYPE_ICON[t.type]
  return { icon: <Ic />, label: TYPE_KIND[t.type] || 'Task' }
}
/** waiting on someone: the day to follow up, moved */
function setFollowUp(id: string, label: string) {
  const iso = isoFromLabel(label) || TOMORROW
  useStore.getState().commit((st) => { const x = st.tasks.find((y) => y.id === id); if (x) x.followUp = md(iso) }, `Follow up ${labelFromIso(iso) === 'Tomorrow' ? 'tomorrow' : md(iso)}`, { tone: 'wait' })
}

/** a daily update that's due today: one per project a crew is working on (the site manager sends them) — every work
 *  day, no skipping: the one for the last work day that wasn't sent is still there the next morning, late */
export type DailyItem = { kind: 'daily'; jobId: string; crew: PersonKey; workers?: number; missed?: string }
/** where the crews work on a day: every project in progress (being installed, not on hold) — with the crew on the
 *  calendar that day, or, when its days on the calendar ran out (running late) or it never had any (brought in, gone
 *  through by hand), its last crew or its installer, every work day */
export function workingOn(s: Store, iso: string): { jobId: string; crew: string; start: string; workers?: number; booked: boolean }[] {
  const live = (j?: Job) => !!j && j.stage === 'installation' && !j.hold
  const booked = s.bookings.filter((b) => b.start <= iso && b.end >= iso && live(s.jobs[b.jobId]) && b.label !== 'Return visit').map((b) => ({ jobId: b.jobId, crew: b.crew as string, start: b.start, workers: b.workers, booked: true }))
  const have = new Set(booked.map((b) => b.jobId))
  const workDay = ![0, 6].includes(new Date(iso + 'T12:00:00').getDay())
  /* (no start date: no "yesterday's is late" — it isn't known when they started) */
  const installing = !workDay ? [] : Object.values(s.jobs).filter((j) => live(j) && !have.has(j.id)).flatMap((j) => {
    const last = s.bookings.filter((b) => b.jobId === j.id && b.label !== 'Return visit').sort((a, b) => b.start.localeCompare(a.start))[0]
    /* its days on the calendar haven't come yet: not there that day */
    if (last && last.start > iso) return []
    const start = last?.start || (j.dates?.start ? isoFromLabel(j.dates.start) : undefined)
    if (!last && start && start > iso) return []
    const crew = (last?.crew || j.crew || (s.prep[j.id]?.installer !== 'tbd' ? s.prep[j.id]?.installer : undefined) || '') as string
    return [{ jobId: j.id, crew, start: start || '9999-12-31', workers: last?.workers ?? j.onSite?.workers, booked: false }]
  })
  return [...booked, ...installing]
}
/** touch-ups on the crew list: a job with touch-ups still open whose crew goes back that day (a return visit), or that
 *  are due by then — with what needs fixing */
export function touchupsOn(s: Store, iso: string): { jobId: string; crew: string; start: string; workers?: number; booked: boolean; fix: string[] }[] {
  if ([0, 6].includes(new Date(iso + 'T12:00:00').getDay())) return []
  return Object.values(s.jobs).filter((j) => j.stage === 'punch' && !j.hold).flatMap((j) => {
    const open = s.punch.filter((p) => p.jobId === j.id && p.status === 'open')
    if (!open.length) return []
    const back = s.bookings.find((b) => b.jobId === j.id && b.start <= iso && b.end >= iso)
    const due = open.some((p) => { const d = p.due ? isoFromLabel(p.due) : undefined; return !d || d <= iso })
    if (!back && !due) return []
    const owners = open.map((p) => p.owner).filter(Boolean) as string[]
    const most = owners.sort((a, b) => owners.filter((x) => x === b).length - owners.filter((x) => x === a).length)[0]
    return [{ jobId: j.id, crew: (back?.crew || most || j.crew || '') as string, start: back?.start || iso, workers: back?.workers ?? 1, booked: !!back, fix: open.map((p) => p.text) }]
  })
}
/** the crew list: where the crews are and how many people. Until 3 in the afternoon it's today's; after, it's the
 *  next work day's (Friday: Monday's) — planned the night before, while there's still time to sort a problem out */
export const CREW_EVENING = 18
/** the hour the next work day's crew list comes up (Settings → Automations → Crew list; 6 PM unless it's changed) */
export const crewHour = (s: Pick<Store, 'rules'> = useStore.getState()) => s.rules.crewAt ?? CREW_EVENING
export const crewEvening = () => {
  let h = new Date().getHours()
  try { const t = localStorage.getItem('tileos-test-hour'); if (t != null && t !== '') h = Number(t) } catch { /* fine */ }
  return h >= crewHour()
}
export const nextWorkDay = (iso: string) => workday(addDays(iso, 1))
/** the day the crew list is for right now */
export const crewDay = () => (crewEvening() ? nextWorkDay(TODAY_ISO) : TODAY_ISO)
/** the crew list: every job in progress — and the touch-ups going on that day */
export const crewsOn = (s: Store, day: string) => { const w = workingOn(s, day); const have = new Set(w.map((c) => c.jobId)); return [...w, ...touchupsOn(s, day).filter((c) => !have.has(c.jobId))] }
export const crewsToday = (s: Store) => workingOn(s, TODAY_ISO)
/** in for that day: every project on it has its people — sent the night before, or that morning */
export const crewSentFor = (s: Store, day: string) => { const l = workingOn(s, day); return l.length > 0 && l.every((c) => { const j = s.jobs[c.jobId]; return j?.onSite?.day === day || j?.crewPlan?.day === day }) }
export const crewSentToday = (s: Store) => crewSentFor(s, TODAY_ISO)
export const crewReportOn = (s: Pick<Store, 'rules'>) => !(s.rules.autoOff || []).includes('crew-morning')
/** "today", "tomorrow", or the day's name (Friday night: "Monday") */
export const crewWhen = (day: string) => (day === TODAY_ISO ? 'today' : day === TOMORROW ? 'tomorrow' : dayLongFull(day).split(',')[0])

export function dailyDue(s: Store, role: Role): DailyItem[] {
  if (role !== 'site' || (s.rules.autoOff || []).includes('daily-update')) return []
  const working = (iso: string) => workingOn(s, iso)
  const sent = (jobId: string, iso: string) => (s.diary[jobId] || []).some((d) => d.date === md(iso) || (iso === TODAY_ISO && d.date === NOW))
  /* the last work day before today (Friday, on a Monday) */
  let prev = addDays(TODAY_ISO, -1)
  while ([0, 6].includes(new Date(prev + 'T12:00:00').getDay())) prev = addDays(prev, -1)
  /* yesterday's not sent is late — until today's goes out (it says where the job is now) */
  const late = working(prev).filter((b) => b.start <= prev && !sent(b.jobId, prev) && !sent(b.jobId, TODAY_ISO)).map((b) => ({ kind: 'daily' as const, jobId: b.jobId, crew: b.crew as PersonKey, workers: b.workers, missed: prev }))
  const today = working(TODAY_ISO).filter((b) => !sent(b.jobId, TODAY_ISO)).map((b) => ({ kind: 'daily' as const, jobId: b.jobId, crew: b.crew as PersonKey, workers: b.workers }))
  return [...late, ...today]
}
/** a project named in what was typed or said — "828 Clyde tiles…" → 828 Clyde (the longest name that fits wins) */
const words = (t: string) => ` ${t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
export function projectIn(text: string, jobs: Job[]): Job | undefined {
  const t = words(text)
  let best: { j: Job; n: number } | undefined
  jobs.forEach((j) => {
    const keys = [j.name, (j.address || '').split(',')[0]].map((k) => words(k).trim()).filter((k) => k.length >= 4)
    keys.forEach((k) => { if (t.includes(` ${k} `) && (!best || k.length > best.n)) best = { j, n: k.length } })
  })
  if (best) return best.j
  /* "114" said alone: the one project whose name starts with it. "Cambridge" alone: the one project with that name
     after its number ("24 Cambridge") — never a guess between two */
  const byNum = jobs.filter((j) => { const m = j.name.match(/^(\d{2,5})\b/); return !!m && t.includes(` ${m[1]} `) })
  if (byNum.length === 1) return byNum[0]
  const rest = (j: Job) => words(j.name.replace(/^\d+\s+/, '')).trim()
  const byName = jobs.filter((j) => { const r = rest(j); return /^\d/.test(j.name) && r.length >= 5 && t.includes(` ${r} `) })
  return byName.length === 1 ? byName[0] : undefined
}
/** the task's words without the project's name at the front — the project shows next to it anyway */
export function withoutProject(title: string, j: Job): string {
  const esc = (x: string) => x.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s,.-]+')
  const re = new RegExp(`^\\s*(${[j.name, (j.address || '').split(',')[0]].filter((x) => x.trim().length >= 4).map(esc).join('|')})[\\s,:;.-]*`, 'i')
  const out = title.replace(re, '').trim()
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : title
}

/** a task is mine when it has my name on it — or it's for my login type (or one folded into it) and nobody else
 * on my login has it by name. Two people on one login (the takeoff person and the office reviewer) each see their own.
 * No person (me = null): everything for the login — that's the Everyone list. */
export const isMine = (t: Task, role: Role, me: PersonKey | null = meOf(role)) => {
  if (me && (t.owner === me || t.also?.includes(me))) return true
  if (!t.for.some((r) => r === role || loginOf(r) === role)) return false
  if (!me || !t.owner) return true
  /* it has someone's name on it: it's theirs (and whoever shares it) — not everyone's on a login it's "for". Only a
     name that isn't anyone — a built-in spot nobody took ("Yakov" from the clean start), or someone who's off — leaves
     it to the login */
  const st = useStore.getState()
  return !st.team.some((m) => m.key === t.owner && m.status !== 'off' && !(REAL.cloud && emptySpot(st, m.key)))
}

/* ---------------- when: one word for each section ---------------- */
type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'aside'
const BUCKETS: { key: Bucket; label: string; tone: 'bad' | 'info' | 'neutral'; hint?: string }[] = [
  { key: 'overdue', label: 'Overdue', tone: 'bad' },
  { key: 'today', label: 'Today', tone: 'info' },
  { key: 'tomorrow', label: 'Tomorrow', tone: 'neutral' },
  { key: 'week', label: 'This week', tone: 'neutral' },
  { key: 'later', label: 'Later', tone: 'neutral' },
  { key: 'aside', label: 'Set aside', tone: 'neutral' },
]
const bucketOfIso = (iso?: string): Bucket => (!iso ? 'later' : iso < TODAY ? 'overdue' : iso === TODAY ? 'today' : iso === TOMORROW ? 'tomorrow' : iso <= addDays(TODAY, 6) ? 'week' : 'later')
const isNow = (b: Bucket) => b === 'overdue' || b === 'today'
/** on hold until a day that's come: back on Today, to check in */
export const holdUp = (t: Task) => t.state === 'later' && !!t.hold && !!t.laterUntil && (isoFromLabel(t.laterUntil) || '9999') <= TODAY
export function taskIso(t: Task): string | undefined {
  if (t.state === 'waiting') return isoFromLabel(t.followUp)
  if (t.state === 'later') return isoFromLabel(t.laterUntil)
  return isoFromLabel(t.due)
}
function taskBucket(t: Task): Bucket {
  /* urgent: on today's list whatever day it says, until it's done */
  if (t.urgent && t.state === 'now') return 'today'
  if (/this week/i.test(t.due || '')) return 'week'
  return bucketOfIso(taskIso(t))
}
/** a task's title without the project in it — the project has its own column: "Bring to 222 Acadamy: Tile" is
 *  "Bring Tile", "Call the GC — 222 Acadamy" is "Call the GC" */
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const cleanTitle = (title: string, jobName?: string | Job) => {
  const name = typeof jobName === 'string' ? jobName : jobName?.name
  if (!name) return title
  return title.replace(new RegExp(`^Bring to ${esc(name)}:\\s*`), 'Bring ').replace(new RegExp(`\\s*[—·-]\\s*${esc(name)}$`), '')
}

/* ---------------- one row, the same for everything: what · project · when ----------------
 * Calm on purpose: no lines between columns, no icon on every row, no small print under the title (it's in the task's
 * window) and no button on every row — on a computer the row's one button shows when you point at it; on a phone you
 * tap the row and its window has the button. Red only for what's late or a problem. Everyone's list says whose it is. */
const WhoCol = React.createContext(false)
/** grouped by project: the project is the group's name — the rows don't say it again */
const InJob = React.createContext(false)
/** whose list is on the page — yours, or the person the admin picked: what's theirs needs no circle */
const Viewer = React.createContext<PersonKey | null>(null)
/** several people's lists at once: every row has its person's circle */
const Multi = React.createContext(false)
/** several people's lists at once: whose list this line is on (for a row that doesn't say whose it is itself) */
const LineOn = React.createContext<PersonKey[] | null>(null)
/** the Waiting on others list: its third column is who it's with (Alex, the GC) — on every other list it's who does it */
const WaitView = React.createContext(false)
/** the one button on a row (requests.tsx keeps it, for the On my way / Dropped off pair too) */
const TBTN = ROW_BTN
/** Today's columns on a computer — the same kind of list as Estimates and Projects: one line a thing, straight columns,
 *  a name on top of each: To do · Project · Watching · When. Your own list doesn't say who does it — it's all yours;
 *  several people's lists add Who, and Waiting adds Waiting on (the one it waits on). What to do and the project share
 *  the width; the rest as wide as they need. Watching and When are tapped right there to change them. */
/* (a tablet or a small computer: no Watching column — who's watching is in each one's window — so the words have room) */
export const todoList = (who?: boolean, _inJob?: boolean) => (who ? 'minmax(0,0.8fr) minmax(0,1.6fr) 7rem 6.5rem' : 'minmax(0,0.8fr) minmax(0,1.6fr) 6.5rem')
export const todoListLg = (who?: boolean) => todoList(who)
export const todoListXl = (who?: boolean) => (who ? 'minmax(0,0.8fr) minmax(0,1.8fr) 8rem 5.5rem 7rem' : 'minmax(0,0.8fr) minmax(0,1.8fr) 5.5rem 7rem')
/** the Project column of a line about several projects: one or two → by name; more → how many */
export const projectsWord = (s: Store, ids: (string | undefined)[], names?: string[]) => {
  const u = Array.from(new Set(names || ids.filter((x): x is string => !!x).map((id) => s.jobs[id]?.name || id)))
  return u.length <= 2 ? u.join(', ') : `${u.length} projects`
}
export const todoColsOf = (who?: boolean) => ({ '--list': todoList(who), '--list-lg': todoListLg(who), '--list-xl': todoListXl(who) }) as React.CSSProperties
export const todoCols = todoColsOf(false)
/** how late something is — "1 day late", "4 days late" (no date to work out) */
export const lateBy = (iso?: string) => { if (!iso) return 'Late'; const d = Math.max(1, daysBetween(iso, TODAY)); return `${d} ${d === 1 ? 'day' : 'days'} late` }

/** whose turn it is: people inside — their circles and first names — or someone outside (Alex, the GC, the store), by
 *  name: a plain circle with their initials */
export type Turn = { keys?: PersonKey[]; name?: string }
/** someone outside, by name — their initials in a plain circle ("The GC" → GC, "Alex" → A) */
export function NameDot({ name, size = 20 }: { name: string; size?: number }) {
  const w = name.replace(/^the\s+/i, '').split(/\s+/).filter(Boolean)
  const ini = /^gc$/i.test(w[0] || '') ? 'GC' : (w.length > 1 && /^[A-Z]/.test(w[1]) ? w[0][0] + w[1][0] : (w[0] || '?')[0]).toUpperCase()
  return <span title={name} className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#ece8e1] font-semibold leading-none text-[#4a5361]" style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * (ini.length > 1 ? 0.36 : 0.42))) }}>{ini}</span>
}
/** a name someone typed ("Alex", "Yakov") that is one of the people in the app — their circle, not a plain one */
export function keyNamed(name?: string): PersonKey | undefined {
  const n = (name || '').trim().toLowerCase()
  if (!n) return undefined
  return (Object.keys(PEOPLE) as PersonKey[]).find((k) => k !== 'system' && (PEOPLE[k]?.short?.toLowerCase() === n || PEOPLE[k]?.name?.toLowerCase() === n))
}
/** someone outside — or one of ours, by name */
export const turnNamed = (name?: string): Turn => { const k = keyNamed(name); return k ? { keys: [k] } : { name: name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Someone' } }
/** the GC, by name when the project has one */
export const gcNameOf = (job?: Job) => job?.contacts?.find((c) => /\bgc\b|general contractor|contractor/i.test(c.role || ''))?.name || 'The GC'
/** who a step waits on: what was said when it was set to wait — or read from where it stands ("waiting for Alex to say
 *  yes", "Waiting on the store") */
export function stepWaitOn(on?: string, note?: string): string {
  if (on && on.trim()) return on.trim()
  const n = note || ''
  /* "waiting for Alex to say yes", "Waiting on Infinity" — or the store a delivery comes from ("PO-1041 from Metal Works
     Inc. · coming Tomorrow", "Delivery Nov 24 · Best Tile") */
  const m = n.match(/waiting (?:for|on) (the [a-z]+|[A-Z][a-zA-Z]+)/i) || n.match(/\bfrom ([A-Z][\w&'.-]*(?: [A-Z][\w&'.-]*)*)/) || n.match(/· ([A-Z][\w&'.-]*(?: [A-Z][\w&'.-]*)*)$/)
  return m ? m[1].replace(/\.$/, '') : 'Someone'
}
/** whose turn, in its column: the circle(s) and the name — "You" when it's yours (like Estimates' Whose turn) */
function TurnCell({ turn, viewer, children }: { turn: Turn; viewer: PersonKey; children?: React.ReactNode }) {
  /* "You" is always whoever is looking — on Yakov's list his own lines say Yakov (quiet: it's his list). You first,
     always: the circles in the same order as the names */
  const me = meOf(useStore((x) => x.role))
  const k0 = (turn.keys || []).filter(Boolean)
  const ks = k0.includes(me) ? [me, ...k0.filter((p) => p !== me)] : k0
  return (
    <span className="flex min-w-0 items-center gap-2" {...(ks.length ? { 'data-row-doer': ks.join(',') } : { 'data-row-turn-name': turn.name || '' })} data-row-turn>
      {ks.length ? <span className="flex shrink-0 gap-0.5">{ks.slice(0, 2).map((p) => <Avatar key={p} who={p} size={20} />)}</span> : turn.name ? <NameDot name={turn.name} /> : null}
      {/* on Today almost every line is yours — "You" stays quiet; someone else's name stands out */}
      <span className={cn('min-w-0 break-words text-[0.8125rem] leading-tight', ks.length === 1 && ks[0] === viewer ? 'text-muted' : 'font-medium text-ink')}>{ks.length ? namesOf(ks, me) : turn.name}</span>
      {children}
    </span>
  )
}
/** who's watching: their circles, side by side (more than three: +N) */
function WatchDots({ who, eye }: { who: PersonKey[]; eye?: boolean }) {
  if (!who.length) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1" title={`Watching: ${who.map((p) => PEOPLE[p]?.name || p).join(', ')}`} data-row-watch={who.join(',')}>
      {eye && <Eye className="h-3.5 w-3.5 text-faint" />}
      <span className="flex gap-0.5">{who.slice(0, 3).map((p) => <Avatar key={p} who={p} size={20} />)}</span>
      {who.length > 3 && <span className="text-[0.75rem] font-medium tnum text-muted">+{who.length - 3}</span>}
    </span>
  )
}
/** the names on top of Today's columns — the same as Estimates' and Projects' */
export function TodayHead({ waiting, who, sort, onSort }: { waiting?: boolean; /** several people's lists, or Waiting: who it's with */ who?: boolean; /** sorted by a column: tap its name */ sort?: Sort; onSort?: (k: string) => void }) {
  const h = (k: string, label: string, right?: boolean, kind?: SortCol['kind']) => (onSort ? <SortHead k={k} sort={sort || null} onSort={onSort} right={right} kind={kind}>{label}</SortHead> : label)
  return (
    <div className={cn(HEAD_ROW, 'px-5 md:grid md:gap-x-6', STICKY_HEAD, 'max-md:hidden')} data-list-head data-subrow>
      <span className="pl-[2.125rem]">{h('project', 'Project')}</span>
      <span>{h('todo', 'To do')}</span>
      {/* waiting: the one you're waiting on; several people's lists: whose it is */}
      {(who || waiting) && <span data-head-turn>{h('who', waiting ? 'Waiting on' : 'Who')}</span>}
      <span className="max-xl:hidden">Watching</span>
      <span className="text-right">{h('when', 'When', true, 'date')}</span>
    </div>
  )
}
/** Today sorted by a column — inside each part; the list's own order (and the line for now) when nothing's picked */
const TodaySort = React.createContext<Sort>(null)
export const TODAY_SORT: SortCol[] = [{ k: 'project', label: 'Project' }, { k: 'todo', label: 'To do' }, { k: 'who', label: 'Who' }, { k: 'when', label: 'When', kind: 'date' }]

/** a cell's own button on a computer: tap it to change it right there — the row itself still opens the thing */
const CELL_BTN = '-mx-2 inline-flex max-w-[calc(100%+1rem)] min-w-0 items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-wash-2 focus-visible:bg-wash-2 focus-visible:outline-none'
const stop = (e: React.SyntheticEvent) => e.stopPropagation()
function TodoRow({ when, whenTone, title, detail, project, projectId, action, onClick, done, leaving, owner, also, watch, flag, turn, phoneWhen = true, watchPick, whenPick, whoPick, star, kind, tick }: {
  when?: React.ReactNode; whenTone?: 'bad' | 'warn' | 'strong' | 'quiet'; icon?: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; project?: string; action?: React.ReactNode; onClick?: () => void; done?: boolean; leaving?: boolean; owner?: PersonKey
  /** the one project it's about: a computer shows its name as a link to it */
  projectId?: string
  /** a computer: the circle at the start of the line — one click and it's done (a done one: click to undo) */
  tick?: RowTick
  /** what kind of thing it is — its tag before the words (To do, Touch-ups, Materials, Problem, Meeting…) */
  kind?: string
  /** shared — whoever gets to it first: the others who can do it */
  also?: PersonKey[]
  /** a word in red before the job — "Problem" */
  flag?: string
  /** who's watching it — their circles */
  watch?: PersonKey[]
  /** whose turn it is, when it isn't whoever does it — waiting: the one it waits on (Alex, the GC) */
  turn?: Turn
  /** a computer: Watching, When and Who are tapped right on the row to change them */
  watchPick?: WatchPick
  whenPick?: WhenPick
  whoPick?: WhoPick
  /** a phone shows the when too (false: only a computer — a phone's line is short) */
  phoneWhen?: boolean
  /** its star — the ones that matter to you go on top of your list (only on your own list) */
  star?: StarPick
}) {
  const who = React.useContext(WhoCol)
  const me = meOf(useStore((x) => x.role))
  const w = when === 'Anytime' ? '' : when
  const whenCls = whenTone === 'bad' ? 'font-medium text-bad-600' : whenTone === 'warn' ? 'font-medium text-warn-700' : whenTone === 'strong' ? 'text-ink-2' : 'text-muted'
  /* whose turn: whoever does it (a row that doesn't say — a meeting, the crew list — is the list's own person's; on
     several lists, whose list it's on), or, waiting, the one it waits on. Who's watching: everyone watching it (you too —
     that's why it's on your Waiting) */
  const viewer = React.useContext(Viewer) || me
  const multi = React.useContext(Multi)
  const onLists = React.useContext(LineOn)
  const sharers = owner ? [owner, ...(also || []).filter((p) => p !== owner)] : multi && onLists ? onLists : []
  /* Who is who does it — the same as its window says. Only on Waiting on others is it who it's with (Alex, the GC) */
  const waitView = React.useContext(WaitView)
  const waitTurn = waitView ? turn : undefined
  const t0: Turn = waitTurn || { keys: sharers.length ? sharers : [viewer] }
  const turnKeys = t0.keys || []
  const watchers = (watch || []).filter((p) => !sharers.includes(p) && !turnKeys.includes(p))
  /* the line is just yours (on your own list): the Who column stays empty — the list is yours */
  const justYou = !t0.name && turnKeys.length === 1 && turnKeys[0] === viewer && viewer === me
  /* a phone: the same as a computer's columns, short — who does it (their circle, yours too), who's watching (the eye
     and their circles), and the time at the end of the line */
  /* (a phone: your own line doesn't show your own circle — the list is yours; someone else's, or a shared one, does) */
  const phoneDoers = turnKeys.length === 1 && turnKeys[0] === viewer && !multi ? [] : turnKeys.includes(me) ? [me, ...turnKeys.filter((p) => p !== me)] : turnKeys
  const phoneTurn = !!t0.name || phoneDoers.length > 0
  /* a phone: only who does it, when it isn't just you (a shared one, someone else's) — who's watching is in its
     window, not on the line */
  const phoneDots = phoneTurn ? (
    <span className="inline-flex h-5 shrink-0 items-center" data-row-people>
      {phoneDoers.length ? <span className="flex gap-0.5" data-row-doer={phoneDoers.join(',')}>{phoneDoers.slice(0, 3).map((p) => <Avatar key={p} who={p} size={18} />)}</span> : t0.name ? <span data-row-turn-name={t0.name}><NameDot name={t0.name} /></span> : null}
    </span>
  ) : null
  /* the job, first — its address; no project: "Company", quiet. A phone with one job picked doesn't say it again under
     each row (the bar on top says it) */
  const company = project === 'Company'
  const where = project || ''
  /* a phone: the project always says on the line — with one job picked too, so every line says what it's for */
  const wherePhone = where
  const phoneTop = !!wherePhone
  const flagged = flag ? <span className="font-medium text-bad-600" data-row-flag>{flag}{where ? ' · ' : ''}</span> : null
  /* the star is yours: on your own list only — not on someone else's you're looking at */
  const ownList = viewer === me && !multi
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      /* a click in a cell's little list (Who, Watching, When — it opens over the page) isn't a click on the line: only
         a click on the line itself opens it */
      onClick={onClick ? (e) => { if ((e.currentTarget as HTMLElement).contains(e.target as Node)) onClick() } : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onClick() } : undefined}
      title={typeof detail === 'string' && detail ? detail : undefined}
      data-todo
      data-subrow
      /* a computer: one line, the list's straight columns. A phone: two lines — what to do, the job under it — every row
         the same height */
      className={cn('group/row relative items-center border-t border-line-2 transition-colors focus-visible:outline-none max-md:flex max-md:gap-3 max-md:py-3 md:grid md:min-h-[3.25rem] md:gap-x-6 md:py-2', PX, onClick && 'cursor-pointer row-hover', leaving && 'row-out')}
      data-starred={star?.on && ownList ? '' : undefined}
    >
      {/* its star, in the margin at the left — nothing on the line moves */}
      {star && ownList && !done && <RowStar star={star} />}
      {/* a computer: the project first — its address — then what it is, (who), who's watching, when — each in its
          column; Who, Watching and When tapped right there to change them */}
      <div className="flex min-w-0 items-start gap-3 max-md:hidden">
        <RowTickCircle tick={tick || (onClick && !done ? { open: true, run: onClick, label: 'Open' } : undefined)} />
        <div className={cn('min-w-0 break-words text-[0.9375rem] leading-[1.375rem]', company ? 'text-muted' : 'text-ink')} data-row-where>
          {flagged}
          {projectId && !company && !done
            ? <button type="button" onClick={(e) => { e.stopPropagation(); useStore.getState().open({ t: 'job', id: projectId }) }} className="rounded-sm text-left font-medium text-brand-700 hover:underline focus-visible:underline focus-visible:outline-none" data-row-project-link={projectId}>{where}</button>
            : where}
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2.5 max-md:flex-1">
        {done && <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok-50 text-ok-600 md:hidden [&_svg]:h-3 [&_svg]:w-3"><Check strokeWidth={3} /></span>}
        <div className="min-w-0 flex-1">
          {/* a phone: one quiet line on top — the project and what kind of thing it is (words, not tags), who else
              has it, when — then what to do, bigger and darker: the one thing to read. Nothing boxed, few colors */}
          {(phoneTop || kind || flag || phoneTurn || (w && phoneWhen)) && (
            <div className="flex min-h-5 min-w-0 items-start gap-2 md:hidden" data-row-eyebrow>
              <span className={cn('min-w-0 flex-1 break-words text-[0.84375rem] font-medium leading-5', company ? 'text-faint' : 'text-muted')} data-row-where-phone>
                {flag ? <span className="text-bad-600" data-row-flag>{flag}{wherePhone || (kind && kind !== flag) ? ' · ' : ''}</span> : null}
                {wherePhone}
                {kind && kind !== flag ? <span className={kind === 'Problem' ? 'text-bad-600' : undefined} data-row-kind-phone={kind}>{wherePhone ? ' · ' : ''}{kind}</span> : null}
              </span>
              {phoneDots}
              {w && phoneWhen && <span className={cn('shrink-0 text-[0.84375rem] leading-5 tnum', whenCls)} data-todo-when-phone>{w}</span>}
            </div>
          )}
          {/* what it is: on a computer its kind, then the words — whole, never cut off (a long one takes a second line) */}
          <div className="flex min-w-0 items-start gap-3 max-md:mt-1">
            <span className={cn('min-w-0 flex-1 break-words text-[0.9375rem] leading-[1.375rem] max-md:text-[1rem] max-md:font-medium max-md:leading-[1.375rem]', done ? 'text-muted line-through decoration-faint max-md:font-normal' : 'text-ink')} data-row-title>{title}</span>
            {/* a computer: its kind at the end of the words — the tags make one straight column, the words start even */}
            {kind && <KindTag label={kind} className="mt-[0.0625rem] max-md:hidden" />}
          </div>
        </div>
      </div>
      {who && (
        <div className="min-w-0 max-md:hidden">
          {/* only when it isn't just yours — shared, someone else's, who it waits on. Yours: nothing (the admin can
              still give it to someone: it shows when the line is pointed at) */}
          {whoPick && !waitTurn ? <WhoMenu pick={whoPick} trigger={<button type="button" onClick={stop} className={cn(CELL_BTN, justYou && 'opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100')} aria-label="Who does it · change it" data-row-who-pick><TurnCell turn={t0} viewer={viewer} /></button>} /> : justYou ? null : <TurnCell turn={t0} viewer={viewer} />}
        </div>
      )}
      <div className="min-w-0 max-xl:hidden">
        {watchPick ? (
          <WatchPop pick={watchPick} trigger={
            <button type="button" onClick={stop} className={cn(CELL_BTN, !watchers.length && 'text-faint opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100')} aria-label="Who’s watching. Add or take off" data-row-watch-pick>
              {watchers.length > 0 ? <WatchDots who={watchers} /> : <><Plus className="h-3.5 w-3.5" /><Eye className="h-3.5 w-3.5" /></>}
            </button>
          } />
        ) : watchers.length > 0 && <WatchDots who={watchers} />}
      </div>
      <div className="flex min-w-0 items-center justify-end max-md:hidden" onClick={onClick ? undefined : stop} data-todo-next>
        {!onClick ? action : whenPick ? (
          <WhenPop pick={whenPick} trigger={
            <button type="button" onClick={stop} className={cn(CELL_BTN, '-mr-2 justify-end', !w && 'text-faint opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100')} aria-label="When · move it" data-row-when-pick>
              {w ? <span className={cn('truncate text-right text-[0.8125rem] tnum', whenCls)} data-todo-when>{w}</span> : <CalendarDays className="h-3.5 w-3.5" />}
            </button>
          } />
        ) : w ? <span className={cn('truncate text-right text-[0.8125rem] tnum', whenCls)} data-todo-when>{w}</span> : null}
      </div>
    </div>
  )
}

/** the circle at the start of every line (a computer): a to-do, one click and it's done (pointed at: a check); done, a
 *  green check (click: back on the list). A line that's finished in its window — a daily update, a step, a call (it
 *  asks what they said) — the same circle opens it (pointed at: an arrow) */
export type RowTick = { done?: boolean; open?: boolean; run: () => void; label: string }
function RowTickCircle({ tick }: { tick?: RowTick }) {
  if (!tick) return <span className="h-[1.375rem] w-[1.375rem] shrink-0" aria-hidden />
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); tick.run() }}
      aria-label={tick.label}
      title={tick.label}
      className={cn('relative inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full border-[1.5px] transition before:absolute before:-inset-2 before:content-[""] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200',
        tick.done ? 'border-ok-500 bg-ok-500 text-white hover:border-ok-600 hover:bg-ok-600' : 'border-[#c9c2b7] text-transparent hover:border-ok-500 hover:text-ok-500')}
      data-row-tick={tick.done ? 'done' : tick.open ? 'opens' : 'open'}
    >
      {tick.open && !tick.done ? <ArrowRight className="h-3 w-3" strokeWidth={2.75} /> : <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  )
}

/** "4 PM", "10:30 AM" — the hour a thing happens */
const hourLabel = (min: number) => timeLabel(min).replace(/^(\d+) /, '$1:00 ')
function taskTime(t: Task): number | null { return t.at ? parseTime(t.at) : t.repeatAt ? parseTime(t.repeatAt) : null }

function TaskRow({ t, showOwner, followed, when }: { t: Task; showOwner?: boolean; followed?: boolean; when?: { text: string; tone?: 'bad' | 'warn' | 'strong' | 'quiet' } }) {
  const s = useStore()
  const job = s.jobs[t.jobId]
  const [leaving, setLeaving] = React.useState(false)
  const done = t.state === 'done'
  /* someone else's (the admin's Everyone): it opens — they finish it; you remind them or take it over from there */
  const theirs = t.owner !== meOf(s.role) && !isMine(t, s.role)
  /* a getting-ready step's task opens the step's own window */
  const stepTask = !!t.step && !t.step.startsWith('*:') && !!s.jobs[t.step.split(':')[0]]
  const act = !theirs && !stepTask && !!t.action && t.action.kind !== 'open-job' && t.state === 'now'
  const follow = followDue(t)
  const Ic = TYPE_ICON[t.type] || ListTodo
  const log = t.log || []
  const last = log[log.length - 1]
  const detail0 = t.req && !done ? `${t.req.trip === 'onway' ? 'On the way' : 'Asked'}${t.by ? ` by ${PEOPLE[t.by]?.short || ''}` : ''}${t.owner !== meOf(s.role) ? ` · ${PEOPLE[t.owner]?.short || 'someone'} brings it` : ''}` : t.state === 'waiting' ? `Waiting on ${t.waitingOn}` : t.blocks && !done ? `Holds up ${t.blocks.charAt(0).toLowerCase() + t.blocks.slice(1)}` : last?.text || t.where || t.detail
  const detail = followed ? <><Eye className="mr-1 inline h-3.5 w-3.5 align-[-0.125rem] text-brand-600" />{detail0 ? `You follow · ${detail0}` : 'You follow'}</> : detail0
  /* shared — two can do it, whoever gets to it first: the row has both their circles (no names in words) */
  const gcw = isGcWait(t) ? gcState(t) : undefined
  const me0 = meOf(s.role)
  const admin = s.role === 'owner' || s.role === 'pm'
  const team = insidePeople(s).length ? insidePeople(s) : ASSIGNABLE
  const w = when || (gcw ? (follow && gcw.tone !== 'bad' ? { text: askLabel(t), tone: 'warn' as const } : { text: gcw.text, tone: gcw.tone === 'bad' ? 'bad' as const : gcw.tone === 'warn' ? 'warn' as const : undefined }) : undefined) || (t.state === 'waiting' ? (follow ? { text: 'Follow up', tone: 'warn' as const } : { text: /^tomorrow$/i.test(t.followUp || '') ? 'Tomorrow' : `Back ${t.followUp}`, tone: undefined }) : t.state === 'done' ? { text: t.doneAt ? (t.doneAt === 'Just now' ? 'Today' : t.doneAt) : 'Done', tone: 'quiet' as const } : t.state === 'later' ? (t.hold ? { text: holdWords(t.laterUntil), tone: holdUp(t) ? 'warn' as const : undefined } : { text: `Back ${t.laterUntil}` }) : { text: 'Anytime', tone: 'quiet' as const })
  /* touch-ups: the checklist, how far along — "1 of 4 done" (tap it: the four) */
  const touch = s.punch.filter((p) => p.taskId === t.id)
  const noOne = touch.filter((p) => !p.owner && p.status !== 'verified').length
  const touchWords = !touch.length ? '' : noOne ? `Pick who does ${noOne === 1 ? 'it' : 'them'} · ${noOne} ${noOne === 1 ? 'touch-up' : 'touch-ups'}` : touchupsWords(touch)
  return (
    <TodoRow
      kind={tagOfTask(s, t)}
      leaving={leaving}
      done={done || leaving}
      /* every row opens its window — the same window every time; what happens next is its button at the bottom */
      onClick={() => s.open({ t: 'task', id: t.id })}
      icon={t.everyone ? <Megaphone /> : t.repeat ? <Repeat /> : <Ic />}
      title={touchWords || cleanTitle(t.title, job)}
      detail={detail}
      owner={t.owner}
      also={done ? undefined : t.also}
      watch={followersOf(t)}
      /* waiting on someone: it's their turn — Alex, the plumber, the client */
      turn={t.state === 'waiting' ? turnNamed(t.waitingOn) : undefined}
      /* a computer: who's watching, its day and (the admin) who does it — tapped right on the row */
      watchPick={!done ? { people: team, me: me0, current: followersOf(t), onToggle: (p) => toggleFollow(t.id, p, true), anyone: !theirs || admin, doers: [t.owner, ...(t.also || [])] } : undefined}
      star={!done ? taskStarPick(s, t, me0) : undefined}
      whenPick={t.state === 'now' && !gcw && (!theirs || admin) ? { value: t.due, onPick: (d) => s.setTaskDue(t.id, d), time: t.at, onTime: (v) => setTaskTime(t.id, v), onClear: t.due || t.at ? () => clearTaskWhen(t.id) : undefined } : t.state === 'waiting' && !gcw && (!theirs || admin) ? { title: 'Follow up on', value: t.followUp, presets: ['Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon'], onPick: (d) => setFollowUp(t.id, d) } : undefined}
      whoPick={admin && !done ? { people: team, me: me0, current: t.owner, onPick: (p) => s.reassignTask(t.id, p), also: t.also, onAlso: (p) => toggleAlso(t.id, p, true) } : undefined}
      project={job ? job.name : 'Company'}
      projectId={job ? job.id : undefined}
      /* one click: done (a call opens with "What did they say?"); done: click to undo. Not when it's someone else's,
         a step, a delivery, or it has its own button (Mark confirmed, Follow up…) */
      tick={done ? (!theirs ? { done: true, run: () => s.reopenTask(t.id), label: 'Done · click to undo' } : undefined)
        : !theirs && !stepTask && !act && !follow && !gcw && t.state === 'now' && !isRequest(t) && !touch.length
          ? (isCallTask(t) ? { run: () => s.open({ t: 'task', id: t.id, call: true }), label: 'Done · what did they say?' } : { run: () => { setLeaving(true); setTimeout(() => s.completeTask(t.id), 220) }, label: 'Done' })
          : undefined}
      when={w.text}
      whenTone={w.tone}
      action={
        theirs && !(done && (s.role === 'owner' || s.role === 'pm')) ? <Button size="sm" className={TBTN} onClick={() => s.open({ t: 'task', id: t.id })}>Open</Button>
        : done ? <Button size="sm" className={TBTN} icon={<RotateCcw />} onClick={() => s.reopenTask(t.id)}>Reopen</Button>
          : follow ? <Button size="sm" className={TBTN} icon={<Hourglass />} onClick={() => s.open({ t: 'task', id: t.id })}>{isGcWait(t) ? askLabel(t) : 'Follow up'}</Button>
          : stepTask ? <Button size="sm" className={TBTN} onClick={() => s.open({ t: 'task', id: t.id })}>Open</Button>
          : act ? <Button size="sm" className={cn(TBTN, 'max-w-full')} onClick={() => runTaskAction(t)}><span className="truncate">{t.action!.label}</span></Button>
            : isRequest(t) && t.state === 'now' && t.owner !== meOf(s.role) ? <Button size="sm" className={TBTN} onClick={() => s.open({ t: 'task', id: t.id })}>{t.req?.trip === 'onway' ? 'On the way' : `${PEOPLE[t.owner]?.short || 'They'} has it`}</Button>
            : isRequest(t) && t.state === 'now' ? <TripButtons t={t} onDone={() => setLeaving(true)} />
            : t.state === 'now' ? <Button size="sm" className={TBTN} icon={<Check />} onClick={() => { setLeaving(true); setTimeout(() => s.completeTask(t.id), 220) }}>Done</Button>
              : <Button size="sm" className={TBTN} onClick={() => s.open({ t: 'task', id: t.id })}>Open</Button>
      }
    />
  )
}

function StepRowToday({ job, v, when, flag }: { job: Job; v: StepView; showOwner?: boolean; when?: { text: string; tone?: 'bad' | 'warn' | 'strong' | 'quiet' }; flag?: string }) {
  const s = useStore()
  const start = s.prep[job.id]?.targetISO
  const rec = s.stepRecs[job.id]?.[v.key]
  const me = meOf(s.role)
  const admin = s.role === 'owner' || s.role === 'pm'
  const open = v.state !== 'done' && v.state !== 'na'
  const team = insidePeople(s)
  return (
    <TodoRow
      kind={flag === 'Problem' || v.state === 'bad' ? 'Problem' : 'Getting ready'}
      onClick={() => s.open({ t: 'step', jobId: job.id, k: v.key })}
      icon={<ListChecks />}
      title={todoOf(v)}
      detail={[v.state === 'bad' ? 'Problem' : '', v.note, start ? `Checklist step · starts ${md(start)}` : 'Checklist step'].filter(Boolean).join(' · ')}
      owner={v.owner}
      watch={rec?.followers || []}
      /* waiting on someone outside (the store, the installer): it's their turn */
      turn={v.state === 'wait' ? turnNamed(stepWaitOn(rec?.wait?.on, v.note)) : undefined}
      watchPick={open ? { people: team, me, current: rec?.followers || [], onToggle: (p) => toggleStepFollow(job.id, v.key, p), anyone: v.owner === me || admin, doers: v.owner ? [v.owner] : [] } : undefined}
      star={open ? { on: starredBy(rec?.stars, me), toggle: () => toggleStepStar(job.id, v.key) } : undefined}
      whenPick={(v.owner === me || admin) && (v.state === 'now' || v.state === 'bad') && v.due ? { value: labelFromIso(v.due), onPick: (d) => setStepDue(job.id, v.key, d) } : undefined}
      whoPick={admin && open ? { people: team, me, current: v.owner, onPick: (p) => setStepOwner(job.id, v.key === 'fixes' && v.state === 'now' ? 'heights' : v.key, p) } : undefined}
      project={job.name}
      projectId={job.id}
      when={when?.text ?? 'Anytime'}
      whenTone={when?.tone ?? 'quiet'}
      action={<Button size="sm" className={cn(TBTN, 'max-w-full')} onClick={() => s.open({ t: 'step', jobId: job.id, k: v.key })}><span className="truncate">{v.action?.label || 'Open'}</span></Button>}
    />
  )
}

function DailyRow({ d, showOwner }: { d: DailyItem; showOwner?: boolean }) {
  const s = useStore()
  const job = s.jobs[d.jobId]
  return (
    <TodoRow
      kind="Daily update"
      onClick={() => s.open({ t: 'daily', jobId: d.jobId })}
      icon={<ClipboardList />}
      /* yesterday's not sent: its day is on the right, in red — not twice on one line */
      title={d.missed ? 'Daily update, not sent' : 'Daily update'}
      detail={`${crewWords(d.crew)} · ${job.pct ?? 0}% installed`}
      owner={showOwner ? siteOf(s, job) : undefined}
      project={job.name}
      projectId={job.id}
      when={d.missed ? md(d.missed) : undefined}
      whenTone={d.missed ? 'bad' : undefined}
      action={<Button size="sm" className={TBTN} onClick={() => s.open({ t: 'daily', jobId: d.jobId })}>Send update</Button>}
    />
  )
}

/** a project's plain to-dos, one person's, one row: how many are done (today) of all of them — "2 of 5 done"; tap it:
 *  the checklist (tick them there, open any one) */
function TodosRow({ x, showOwner, overdue }: { x: PlateItem; showOwner?: boolean; overdue?: boolean }) {
  const s = useStore()
  const ts = x.ts || []
  const job = s.jobs[ts[0]?.jobId || '']
  const who = (x.who || ts[0]?.owner) as PersonKey
  const l = todosOf(s, job?.id || '', who)
  const done = l.done.length
  const all = l.open.length + l.done.length
  const open = () => s.open({ t: 'todos', jobId: job?.id, who })
  const late = overdue ? lateBy(x.iso) : ''
  return (
    <TodoRow
      kind="To do"
      onClick={open}
      /* the to-dos themselves, so you read them right here — and how many are done, once some are */
      title={<span data-todos-words>{(l.open.length ? l.open : ts).map((t) => t.title.replace(/\.$/, '')).join(' · ')}{done > 0 && <span className="text-muted"> · {done} of {all} done</span>}</span>}
      detail={ts.map((t) => t.title).join(' · ')}
      owner={who}
      project={job?.name || 'Company'}
      projectId={job?.id}
      /* like every other line for today: nothing in When unless it's late (another day: its date) */
      when={late || (x.b === 'today' ? undefined : x.iso ? md(x.iso) : 'Anytime')}
      whenTone={late ? 'bad' : 'quiet'}
      action={<Button size="sm" className={TBTN} onClick={open} data-todos-open>Open</Button>}
    />
  )
}

/** the day's daily updates, one row: how many jobs, and how many are late — tap it: every job, each sent from there */
function DailiesRow({ x, showOwner }: { x: PlateItem; showOwner?: boolean }) {
  const s = useStore()
  const ds = x.ds || []
  const jobs = Array.from(new Set(ds.map((d) => d.jobId)))
  const missed = new Set(ds.filter((d) => d.missed).map((d) => d.jobId)).size
  /* the window lists exactly these jobs — the same number as the row */
  const open = () => s.open({ t: 'dailies', who: x.who, jobs })
  return (
    <TodoRow
      kind="Daily update"
      onClick={open}
      title="Daily updates"
      detail={jobs.map((id) => s.jobs[id]?.name).filter(Boolean).join(' · ')}
      owner={showOwner ? x.who : undefined}
      project={projectsWord(s, jobs)}
      when={missed ? `${missed} late` : undefined}
      whenTone={missed ? 'bad' : undefined}
      action={<Button size="sm" className={TBTN} onClick={open} data-dailies-open>Send updates</Button>}
    />
  )
}
/** the same step on many projects, one row: what it is, how many projects — tap it: every project in one window, the
 *  step done right there on each */
function StepsRow({ x, showOwner }: { x: PlateItem; showOwner?: boolean }) {
  const s = useStore()
  const vs = x.vs || []
  const open = () => s.open({ t: 'stepbatch', k: vs[0]?.v.key, jobs: vs.map((y) => y.job.id) })
  return (
    <TodoRow
      kind="Getting ready"
      onClick={open}
      title={vs[0] ? todoOf(vs[0].v) : ''}
      detail={vs.map((y) => y.job.name).join(' · ')}
      owner={showOwner ? x.who : undefined}
      /* how many — which ones are in its window */
      project={projectsWord(s, vs.map((y) => y.job.id))}
      when={x.b === 'overdue' && x.iso ? md(x.iso) : undefined}
      whenTone={x.b === 'overdue' ? 'bad' : undefined}
      action={<Button size="sm" className={TBTN} onClick={open}>Open</Button>}
    />
  )
}
/** what's to be brought to the jobs, one row: how many things, for which job (or how many jobs) — tap it: the whole
 *  pickup list, each one On my way / Dropped off right there */
function TripsRow({ x, showOwner }: { x: PlateItem; showOwner?: boolean }) {
  const s = useStore()
  const ts = x.ts || []
  const jobs = Array.from(new Set(ts.map((t) => t.jobId)))
  const one = jobs.length === 1 ? s.jobs[jobs[0]] : undefined
  const open = () => s.open({ t: 'trips', who: x.who, day: isNow(x.b) ? 'now' : x.b })
  return (
    <TodoRow
      kind="To bring"
      onClick={open}
      title={`Bring to the ${jobs.length > 1 ? 'jobs' : 'job'}: ${ts.map((t) => t.req?.what || t.title.replace(/^Bring to [^:]+:\s*/i, '')).join(', ')}`}
      detail={ts.map((t) => t.req?.what || t.title).join(' · ')}
      owner={showOwner ? x.who : undefined}
      project={one ? one.name : projectsWord(s, jobs)}
      when={x.b === 'overdue' && x.iso ? md(x.iso) : undefined}
      whenTone={x.b === 'overdue' ? 'bad' : undefined}
      action={<Button size="sm" className={TBTN} onClick={open} data-trips-open>Open</Button>}
    />
  )
}

/** the admin's: someone on the team is late past the company's line — check in with them (one line a person) */
function CheckinRow({ x }: { x: PlateItem }) {
  const s = useStore()
  const g = x.ci
  if (!g) return null
  const n = g.items.length
  const open = () => s.open({ t: 'checkin', who: g.who })
  return (
    <TodoRow
      kind="Check-in"
      onClick={open}
      title={`Check in with ${PEOPLE[g.who]?.short || 'them'}`}
      detail={g.items.map((c) => c.title).join(' · ')}
      project={projectsWord(s, [], g.items.map((c) => c.jobName || 'Company'))}
      when={`${n} late`}
      whenTone="bad"
      action={<Button size="sm" className={TBTN} onClick={open} data-checkin-open>Check in</Button>}
    />
  )
}

/** the crew list on Today until it's sent — something to do today: send tomorrow's (after 3 in the afternoon), or
 *  today's first thing — one tap */
function CrewRow() {
  const s = useStore()
  const day = crewDay()
  const n = crewsOn(s, day).length
  const go = () => s.open({ t: 'crewreport', day })
  const whose = day === TODAY_ISO ? 'today’s' : day === TOMORROW ? 'tomorrow’s' : `${crewWhen(day)}’s`
  return (
    <TodoRow
      kind="Crew list"
      onClick={go}
      icon={<HardHat />}
      title={`Send ${whose} crew list`}
      detail={`${n} ${n === 1 ? 'project' : 'projects'}. How many people on each`}
      project={n ? projectsWord(s, crewsOn(s, day).map((c) => c.jobId)) : 'Company'}
      action={<Button size="sm" className={TBTN} onClick={go} data-crew-row>Send it</Button>}
    />
  )
}
/** the admin's rounds on Today: every job site with work going on, until a video has gone out from each */
function RoundsRow() {
  const s = useStore()
  const r = roundsToday(s, meOf(s.role))
  const go = () => s.open({ t: 'rounds' })
  return (
    <TodoRow
      kind="Site visit"
      onClick={go}
      icon={<MapPinned />}
      title="Visit the jobs"
      detail="Google Maps through all of them, a video from each"
      project={`${r.left + r.done} job ${r.left + r.done === 1 ? 'site' : 'sites'}`}
      when={r.done ? `${r.done} of ${r.left + r.done} done` : 'Anytime'}
      action={<span className="flex items-center gap-1.5"><Button size="sm" variant="ghost" className={TBTN} onClick={() => skipRounds(meOf(s.role))} data-rounds-row-skip>Skip today</Button><Button size="sm" className={TBTN} onClick={go} data-rounds-row>{r.done ? 'Keep going' : 'Start'}</Button></span>}
    />
  )
}

function PayRow() {
  const s = useStore()
  const open = payOpen(s)
  if (!open.length) return null
  const off = open.filter((r) => r.state === 'check')
  const total = open.reduce((n, r) => n + r.owe, 0)
  const go = () => s.open({ t: 'payweek' })
  return (
    <TodoRow
      kind="Installer pay"
      onClick={go}
      icon={<HandCoins />}
      title={`Installer pay · week of ${PAY_WEEKS[0].label}`}
      detail={`${off.length ? `${off.length} bill doesn’t match · ` : ''}${open.length} installers · ${fmtMoney(total)} · from the daily updates`}
      project="All projects"
      when="Anytime"
      whenTone="quiet"
      action={<Button size="sm" className={TBTN} onClick={go}>Review the week</Button>}
    />
  )
}

/* Waiting on the GC, under Waiting on others — for the admin every open one on every project, one line each: what (and
 * who has it, and what the GC said last), the project, where it stands: the days left, quiet — red only when something's
 * wrong (the GC wasn't told the same day, a reminder was skipped, the GC missed his day, a week out and not done). Tap
 * one: its window — Remind its person from there. */
function GcRow({ t }: { t: Task }) {
  const s = useStore()
  const job = s.jobs[t.jobId]
  const st = gcState(t)
  const me = meOf(s.role)
  const admin = s.role === 'owner' || s.role === 'pm'
  const team = insidePeople(s).length ? insidePeople(s) : ASSIGNABLE
  return (
    <div data-gc-row={t.id} data-gc-flag={st.flag ? '' : undefined} data-contents>
      <TodoRow
      kind="GC"
        onClick={() => s.open({ t: 'task', id: t.id })}
        title={<>{gcWords(t.title)}{t.said ? <span className="font-normal text-muted"> · GC: “{t.said.text}”</span> : null}</>}
        owner={t.owner}
        watch={followersOf(t)}
        /* it's the GC's turn — by name when the project has one */
        turn={{ name: gcNameOf(job) }}
        star={taskStarPick(s, t, me)}
        watchPick={{ people: team, me, current: followersOf(t), onToggle: (p) => toggleFollow(t.id, p, true), anyone: true, doers: [t.owner, ...(t.also || [])] }}
        whoPick={admin ? { people: team, me, current: t.owner, onPick: (p) => s.reassignTask(t.id, p) } : undefined}
        detail={gcSoFar(t)}
        project={job?.name || 'Company'}
        projectId={job?.id}
        when={st.text}
        whenTone={st.tone === 'bad' ? 'bad' : st.tone === 'warn' ? 'warn' : 'quiet'}
        /* a phone: when the next reminder goes is for a computer — there it says so only when something's wrong */
        phoneWhen={st.tone === 'bad' || st.tone === 'warn'}
      />
    </div>
  )
}

/** someone else's open steps that one of yours waits for — on the projects you're on: what's relevant to you */
function waitsOnOthers(s: Store, me: PersonKey): PlateItem[] {
  const out: PlateItem[] = []
  Object.values(s.jobs).filter(isGettingReady).forEach((j) => {
    const steps = stepsFor(s, j)
    const before = new Set(steps.filter((v) => v.owner === me && v.state !== 'done' && v.state !== 'na').flatMap((v) => v.after))
    steps.filter((v) => before.has(v.key) && v.owner !== me && (v.state === 'now' || v.state === 'bad')).forEach((v) => {
      const start = s.prep[j.id]?.targetISO
      const lead = start ? (addDays(start, -7) < TODAY ? TODAY : addDays(start, -7)) : undefined
      const iso = v.due || lead || TODAY
      const b: Bucket = v.state === 'bad' && iso > TODAY ? 'today' : bucketOfIso(iso)
      if (isNow(b)) out.push({ key: `s:${j.id}:${v.key}`, b, iso, kind: 'step', job: j, v, who: v.owner })
    })
  })
  return out
}
/* everyone's plate is worked out once for each change of the data — Today asks for it on every screen */
const teamPlateNow = (() => {
  let last: { k: unknown[]; v: PlateItem[] } | null = null
  return (s: Store): PlateItem[] => {
    const k = [...DATA_KEYS.map((d) => (s as any)[d]), TODAY]
    if (last && last.k.every((x, i) => x === k[i])) return last.v
    const v = teamPlate(s)
    last = { k, v }
    return v
  }
})()

/** a note someone wrote — not a line the app wrote when something happened (Created, Reminded, Moved, Done…) */
const APP_DID = /^(\d+ touch-ups? logged|Created|Reminded |Told |Needed by |No date it’s needed by|Moved to |Checked in with |Done\b|Reopened|Back to needs action|Back on |Handed (from|to) |Waiting on |Not here yet|Pinned to|Unpinned from|Repeats|Set up to repeat|Due |Emailed to |Sent (to|back to) |Asked for |Brought in from|Accepted|Logged as a problem|Set aside|Taken over|Took it over|Followed up$|Shared with|Now for |Time: |No set time$)|(follows it( now)?|stopped following|is watching it( now)?|stopped watching| can do it too| taken off it)$/
export const isNote = (l: { who: string; text: string; note?: boolean }) => !!l.note || (l.who !== 'system' && !APP_DID.test(l.text))

/** the billing person's week: last week's progress, ready to bill (it works like installer pay) */
function BillRow() {
  const s = useStore()
  const rows = billsToMake(s)
  if (!rows.length) return null
  const total = rows.reduce((n, r) => n + billTotal(r), 0)
  const go = () => s.go({ page: 'money', tab: 'progress' })
  return (
    <TodoRow
      kind="Billing"
      onClick={go}
      icon={<Receipt />}
      title={`Progress billing · week of ${LAST_WEEK.label}`}
      detail={`${rows.length} ${rows.length === 1 ? 'project' : 'projects'} · ${fmtMoney(total)} to bill · from the daily updates`}
      project={projectsWord(s, rows.map((r) => r.jobId))}
      when="Anytime"
      whenTone="quiet"
      action={<Button size="sm" className={TBTN} onClick={go}>Bill the week</Button>}
    />
  )
}

function MeetingRow({ e, showOwner }: { e: CalEvent; showOwner?: boolean }) {
  const s = useStore()
  const job = e.jobId ? s.jobs[e.jobId] : undefined
  const open = () => s.open({ t: 'event', id: e.id })
  const me = meOf(s.role)
  const admin = s.role === 'owner' || s.role === 'pm'
  return (
    <TodoRow
      kind={e.kind === 'walkthrough' ? 'Walkthrough' : 'Meeting'}
      onClick={open}
      /* its day and time, right on the line: the calendar and the times — the meeting doesn't open */
      whenPick={admin || e.people.includes(me) || e.by === me ? eventWhen(e) : undefined}
      icon={<CalendarDays />}
      title={e.title}
      detail={[e.kind === 'walkthrough' ? 'Walkthrough' : 'Meeting', rangeLabel(e.start, e.dur), e.with ? `with ${e.with}` : '', showOwner ? e.people.map((p) => PEOPLE[p]?.short).join(', ') : ''].filter(Boolean).join(' · ')}
      project={job?.name || 'Company'}
      projectId={job?.id}
      /* Who: everyone from us who's in it — you and Yakov, not just you */
      owner={e.people[0]}
      also={e.people.slice(1)}
      when={hourLabel(e.start)}
      whenTone="strong"
      action={<Button size="sm" className={TBTN} onClick={open}>Open</Button>}
    />
  )
}

/** an estimate's follow-up with the client while the estimate isn't with the client any more (a new revision is being
 *  priced or reviewed, it was approved, or lost) — nobody follows up on it */
export function staleFollowUp(s: Pick<Store, 'estimates'>, t: Task) {
  const k = t.action?.kind || ''
  if (t.state !== 'waiting' || !k.startsWith('estimate:')) return false
  const e = s.estimates.find((x) => x.id === k.slice(9))
  return !!e && e.status !== 'sent'
}
/** a waiting task whose day has come: follow up */
const followDue = (t: Task) => t.state === 'waiting' && (isoFromLabel(t.followUp) || '9') <= TODAY

/* ================= what's on someone's plate: one list, used for the page and the sidebar count ================= */
export type PlateItem = { key: string; b: Bucket; iso?: string; time?: number | null; kind: 'task' | 'daily' | 'crew' | 'rounds' | 'pay' | 'bill' | 'meet' | 'step' | 'checkin' | 'dailies' | 'trips' | 'steps' | 'todos'; t?: Task; d?: DailyItem; /** one row for many: the day's daily updates */ ds?: DailyItem[]; /** one row for many: what to bring to the jobs */ ts?: Task[]; /** one row for many: the same step on many projects */ vs?: { job: Job; v: StepView }[]; e?: CalEvent; job?: Job; v?: StepView; who?: PersonKey; ci?: { who: PersonKey; items: CheckItem[] }; /** its person starred it — on top, its own line (never folded in with others) */ starred?: boolean }
const AHEAD = 21
/** everything that's mine: tasks, the daily updates I send, the pay week, my meetings, checklist steps that are my turn */
export function plateOf(s: Store, role: Role, person?: PersonKey | null): PlateItem[] {
  const me = person === undefined ? meOf(role) : person
  const out: PlateItem[] = []
  const last = addDays(TODAY, AHEAD)
  s.events.filter((e) => !e.done && e.date >= TODAY && e.date <= last && (!me || e.people.includes(me))).forEach((e) => out.push({ key: 'e' + e.id, b: bucketOfIso(e.date), iso: e.date, time: e.start, kind: 'meet', e, who: e.people[0] }))
  /* the site manager's crew list, until it's sent: tomorrow's after 3 in the afternoon, today's first thing */
  /* (or whoever the admin picked for it — Settings → Automations) */
  const crewTo = autoWho(s, 'crew-morning')
  if ((crewTo ? me === crewTo : role === 'site') && crewReportOn(s)) { const day = crewDay(); if (crewsOn(s, day).length && !crewSentFor(s, day)) out.push({ key: 'crew', b: 'today', iso: TODAY, time: day === TODAY ? 7 * 60 : crewHour(s) * 60, kind: 'crew', who: me || realOwner(s, meOf('site')) }) }
  /* the admin's rounds: the job sites with work going on, on a work day, until a video has gone out from each */
  const roundsTo = autoWho(s, 'rounds')
  if ((roundsTo ? me === roundsTo : role === 'owner') && roundsOn(s) && ![0, 6].includes(dow(TODAY)) && !roundsSkipped(s, me || meOf('owner')) && roundsToday(s, me || meOf('owner')).left > 0) out.push({ key: 'rounds', b: 'today', iso: TODAY, time: null, kind: 'rounds', who: me || meOf('owner') })
  /* each project's daily update is its own site manager's — the real person, never the built-in "Yakov" spot */
  const dailyTo = autoWho(s, 'daily-update')
  ;(dailyTo ? (me === dailyTo ? dailyDue(s, 'site') : []) : dailyDue(s, role)).forEach((d) => { const who = dailyTo || siteOf(s, s.jobs[d.jobId]); out.push(d.missed ? { key: 'dm' + d.jobId, b: 'overdue', iso: d.missed, time: null, kind: 'daily', d, who } : { key: 'd' + d.jobId, b: 'today', iso: TODAY, time: 17 * 60, kind: 'daily', d, who }) })
  /* (whoever's list it is — the same line on the admin's Everyone as on their own phone) */
  const payTo = autoWho(s, 'pay-review')
  if ((payTo ? me === payTo : role === 'owner' || (role === 'pm' && (!me || me === meOf('owner')))) && payDue(s)) out.push({ key: 'pay', b: 'today', iso: TODAY, time: null, kind: 'pay', who: me || meOf('owner') })
  const billTo = autoWho(s, 'billing-day')
  if ((billTo ? me === billTo : role === 'accounting') && billingOn(s) && billsToMake(s).length) out.push({ key: 'bill', b: 'today', iso: TODAY, time: null, kind: 'bill', who: me || meOf('accounting') })
  /* the admin's: who on the team to check in on — late past the company's line: one line a person */
  if (person === undefined && reportOn(s)) checkIns(s).forEach((g) => out.push({ key: 'ci:' + g.who, b: 'today', iso: TODAY, time: null, kind: 'checkin', ci: g, who: meOf(role) }))
  /* a step's task whose step already happened (the paperwork came in another way) isn't anyone's to do */
  const doneSteps = new Map<string, Set<string>>()
  const stepDone = (t: Task) => {
    if (!t.step || t.step.startsWith('*:')) return false
    const [jobId, key] = t.step.split(':')
    const j = s.jobs[jobId]
    if (!j) return false
    let set = doneSteps.get(jobId)
    if (!set) { set = new Set(stepsFor(s, j).filter((v) => v.state === 'done' || v.state === 'na').map((v) => v.key)); doneSteps.set(jobId, set) }
    return set.has(key)
  }
  s.tasks.filter((t) => isMine(t, role, me) && t.state === 'now' && !t.paused && (!t.everyone || !me || t.owner === me) && !stepDone(t)).forEach((t) => {
    /* a hand-off (a takeoff, a review) is yours the moment it lands — it's on Today, with its due date */
    const b0 = taskBucket(t)
    const b = t.action?.kind?.startsWith('estimate:') && (b0 === 'tomorrow' || b0 === 'week' || b0 === 'later') ? 'today' : b0
    /* a login spot nobody took ("Estimator") is never shown as a person — it's whoever has that login */
    out.push({ key: t.id, b, iso: taskIso(t), time: taskTime(t), kind: 'task', t, who: realOwner(s, t.owner), starred: taskStarred(s, t, me) })
  })
  s.tasks.filter((t) => isMine(t, role, me) && t.state === 'later').forEach((t) => out.push({ key: t.id, b: holdUp(t) ? 'today' : 'aside', iso: taskIso(t), kind: 'task', t, who: realOwner(s, t.owner), starred: taskStarred(s, t, me) }))
  /* waiting on someone outside: locked to its follow-up day — that day it's back on the list (late after it) */
  s.tasks.filter((t) => isMine(t, role, me) && t.state === 'waiting' && !staleFollowUp(s, t) && !dupOfStep(s, t)).forEach((t) => {
    const iso = isoFromLabel(t.followUp)
    if (!iso || iso > TODAY) return
    /* the same: an untaken login spot is whoever has that job — never a second "Yakov" */
    out.push({ key: t.id, b: bucketOfIso(iso), iso, kind: 'task', t, who: realOwner(s, t.owner), starred: taskStarred(s, t, me) })
  })
  stepTodos(s, me || 'all').forEach(({ job, step: v }) => {
    /* a step with no date of its own is due a week before the start (everything left has to be done by then) — no start yet, it's due now */
    const start = s.prep[job.id]?.targetISO
    const lead = start ? (addDays(start, -7) < TODAY ? TODAY : addDays(start, -7)) : undefined
    const iso = v.due || lead || TODAY
    out.push({ key: `s:${job.id}:${v.key}`, b: v.state === 'bad' && (!iso || iso > TODAY) ? 'today' : bucketOfIso(iso), iso, kind: 'step', job, v, who: v.owner, starred: starredBy(s.stepRecs[job.id]?.[v.key]?.stars, me) })
  })
  return sortPlate(out)
}
const sortPlate = (xs: PlateItem[]) => xs.sort((x, y) => (x.iso || '9999').localeCompare(y.iso || '9999') || (x.time ?? 9999) - (y.time ?? 9999))
/** everyone's plate: each inside login's list, one row per thing */
const TEAM_ROLES: Role[] = ['owner', 'site', 'office', 'takeoff', 'estimator', 'materials', 'accounting']
function teamPlate(s: Store): PlateItem[] {
  const seen = new Map<string, PlateItem>()
  TEAM_ROLES.forEach((r) => plateOf(s, r, null).forEach((x) => { if (!seen.has(x.key)) seen.set(x.key, x) }))
  s.events.filter((e) => !e.done && e.date >= TODAY && e.date <= addDays(TODAY, AHEAD)).forEach((e) => { if (!seen.has('e' + e.id)) seen.set('e' + e.id, { key: 'e' + e.id, b: bucketOfIso(e.date), iso: e.date, time: e.start, kind: 'meet', e, who: e.people[0] }) })
  return sortPlate(Array.from(seen.values()))
}
/* The same kind of thing many times is one line — tap it and its window has them all, each done right there:
 *   the daily updates (one line: "Daily updates · 6 jobs"), the same step on many projects ("Pick the installer and
 *   send his PO · 3 projects"), and what's to be brought to the jobs (one trip, every pickup in it).
 * Anything else is its own line, with its project. */
const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'aside']
export function collapse(items: PlateItem[]): PlateItem[] {
  const out: PlateItem[] = []
  const touchIds = new Set(useStore.getState().punch.map((p) => p.taskId).filter(Boolean) as string[])
  const todos = new Map<string, PlateItem[]>()
  const dailies = new Map<string, PlateItem[]>()
  const trips = new Map<string, PlateItem[]>()
  const steps = new Map<string, PlateItem[]>()
  const add = (m: Map<string, PlateItem[]>, k: string, x: PlateItem) => m.set(k, [...(m.get(k) || []), x])
  /* a project's list of touch-ups is one line; a to-do about them said in words, same person, goes inside it */
  const touchLines = new Set(items.filter((x) => x.kind === 'task' && x.t && x.t.state === 'now' && touchIds.has(x.t.id)).map((x) => `${x.who || x.t!.owner}|${x.t!.jobId}`))
  items.forEach((x) => {
    if (x.kind === 'task' && x.t && x.t.state === 'now' && !x.starred && !touchIds.has(x.t.id) && TOUCH_WORDS.test(x.t.title) && touchLines.has(`${x.who || x.t.owner}|${x.t.jobId}`)) return
    /* starred: its own line — it goes on top */
    if (x.starred) return out.push(x)
    /* every daily update on this list together — yesterday's not sent too */
    if (x.kind === 'daily') return add(dailies, '', x)
    /* what's to be brought — today's (and late) together; a day ahead stays with that day */
    if (x.kind === 'task' && x.t && isRequest(x.t) && x.t.state === 'now' && !x.t.urgent) return add(trips, `${x.who || x.t.owner}|${isNow(x.b) ? 'now' : x.b}`, x)
    /* the same step on many projects — a problem stays its own line */
    if (x.kind === 'step' && x.v && x.job && x.v.state !== 'bad') return add(steps, `${x.who || x.v.owner}|${x.v.key}|${isNow(x.b) ? 'now' : x.b}`, x)
    /* plain to-dos on one project, one person's — one line: "2 of 5 done"; tap it: the checklist */
    if (x.kind === 'task' && x.t && x.t.jobId && plainTodo(x.t, touchIds)) return add(todos, `${x.who || x.t.owner}|${x.t.jobId}`, x)
    out.push(x)
  })
  const first = (xs: PlateItem[]) => xs.reduce((a, x) => (BUCKET_ORDER.indexOf(x.b) < BUCKET_ORDER.indexOf(a.b) || (x.b === a.b && (x.iso || '9') < (a.iso || '9')) ? x : a))
  dailies.forEach((xs) => {
    if (xs.length < 2) return out.push(...xs)
    const f = first(xs)
    out.push({ key: 'dailies', b: f.b, iso: f.iso, time: 17 * 60, kind: 'dailies', who: f.who, ds: xs.map((x) => x.d!) })
  })
  trips.forEach((xs, k) => {
    if (xs.length < 2) return out.push(...xs)
    const f = first(xs)
    out.push({ key: 'trips:' + k, b: f.b, iso: f.iso, time: null, kind: 'trips', who: f.who, ts: xs.map((x) => x.t!) })
  })
  steps.forEach((xs, k) => {
    if (xs.length < 2) return out.push(...xs)
    const f = first(xs)
    out.push({ key: 'steps:' + k, b: f.b, iso: f.iso, time: null, kind: 'steps', who: f.who, vs: xs.map((x) => ({ job: x.job!, v: x.v! })) })
  })
  todos.forEach((xs, k) => {
    if (xs.length < 2) return out.push(...xs)
    const f = first(xs)
    out.push({ key: 'todos:' + k, b: f.b, iso: f.iso, time: null, kind: 'todos', who: f.who || f.t?.owner, ts: xs.map((x) => x.t!) })
  })
  return sortPlate(out)
}

/* ================= a person's lists — one place decides what's on each ================= */
/* The page, its five numbers, the number on Today in the menu and the admin's Everyone all come from here: what's
 * counted is what's shown, and someone's list on the admin's Everyone is the list on their own phone. */
export type View = 'today' | 'coming' | 'tomorrow' | 'later' | 'waiting' | 'done'
type Tone = 'bad' | 'info' | 'warn' | 'neutral'
/** one line: something on the plate, a task shown its own way (for everyone, back tomorrow, waiting, done), the GC's,
 *  or a step waiting on someone outside */
export type Line =
  | { k: 'plate'; key: string; x: PlateItem }
  | { k: 'task'; key: string; t: Task; as: 'pinned' | 'back' | 'waiting' | 'done' }
  | { k: 'gc'; key: string; t: Task }
  | { k: 'wait'; key: string; job: Job; v: StepView }
/** a part of a list, with its name — Overdue, Today, For everyone… (a day's part has its day: the now line goes in it) */
export type Part = { key: string; label: string; tone: Tone; lines: Line[]; day?: string; lateLink?: boolean; /** several people's lists as one: whose list(s) each line is on, by its key */ on?: Record<string, PersonKey[]> }
export const countOf = (parts: Part[]) => parts.reduce((n, p) => n + p.lines.length, 0)
const jobOfItem = (x: PlateItem) => x.t?.jobId || x.d?.jobId || x.job?.id || x.e?.jobId || x.ds?.[0]?.jobId || x.vs?.[0]?.job.id || x.ts?.[0]?.jobId
const asLine = (x: PlateItem): Line => ({ k: 'plate', key: x.key, x })
/** a line's project, words, person and day — what Today sorts by */
/** a line's Project words — the same as the line shows ("2 job sites", "All projects", "114 Park Place") */
function plateWhere(s: Store, x: PlateItem): string {
  const me = meOf(s.role)
  switch (x.kind) {
    case 'rounds': { const r = roundsToday(s, me); const n = r.left + r.done; return `${n} job ${n === 1 ? 'site' : 'sites'}` }
    case 'pay': return 'All projects'
    case 'bill': return projectsWord(s, billsToMake(s).map((r) => r.jobId))
    case 'checkin': return projectsWord(s, [], (x.ci?.items || []).map((c) => c.jobName || 'Company'))
    case 'crew': { const c = crewsOn(s, crewDay()); return c.length ? projectsWord(s, c.map((y) => y.jobId)) : 'Company' }
    case 'dailies': return projectsWord(s, (x.ds || []).map((d) => d.jobId))
    case 'trips': return projectsWord(s, (x.ts || []).map((t) => t.jobId))
    case 'steps': return projectsWord(s, (x.vs || []).map((y) => y.job.id))
    default: { const id = jobOfItem(x); return (id && s.jobs[id]?.name) || 'Company' }
  }
}
function sortLines(s: Store, lines: Line[], sort: Sort): Line[] {
  const proj = (l: Line) => (l.k === 'wait' ? l.job.name : l.k === 'plate' ? plateWhere(s, l.x) : s.jobs[l.t.jobId]?.name || 'Company')
  const words = (l: Line) => (l.k === 'wait' ? todoOf(l.v) : l.k === 'plate' ? l.x.t?.title || (l.x.v ? todoOf(l.x.v) : '') || l.x.e?.title || l.x.vs?.[0] && todoOf(l.x.vs[0].v) || l.x.kind : l.t.title)
  const whoOf = (l: Line) => { const k = l.k === 'wait' ? l.v.owner : l.k === 'plate' ? l.x.t?.owner || l.x.v?.owner || l.x.who : l.t.owner; return k ? PEOPLE[k]?.short : undefined }
  const day = (l: Line) => {
    if (l.k === 'wait') return l.v.due
    if (l.k === 'plate') return l.x.iso ? `${l.x.iso}${l.x.time != null ? ' ' + String(l.x.time).padStart(4, '0') : ''}` : undefined
    return isoFromLabel(l.t.due || l.t.followUp || '') || undefined
  }
  return sortRows(lines, sort, { project: proj, todo: words, who: whoOf, when: day })
}
/** a task with no day on it — on Today, under "No day set", so nothing gets lost */
const undatedTask = (x: PlateItem) => x.kind === 'task' && !!x.t && x.t.state === 'now' && !isNow(x.b) && !taskIso(x.t) && !/this week/i.test(x.t.due || '')
const dayHead = (iso: string) => (iso === TODAY ? 'Today' : iso === TOMORROW ? 'Tomorrow' : dayShort(iso))
const doneDay = (t: Task) => t.doneOn || (t.doneAt === 'Just now' || t.doneAt === 'Today' ? TODAY : isoFromLabel(t.doneAt) || '')

/** the parts made from what's on a plate: today's (for everyone, urgent, overdue, the day, no day set), tomorrow's,
 *  later's (this week, day by day, no date, set aside) */
function plateParts(plate: PlateItem[], view: View, extra: { pinned?: Task[]; back?: Task[] } = {}): Part[] {
  const out: Part[] = []
  const add = (key: string, label: string, tone: Tone, lines: Line[], more?: Partial<Part>) => { if (lines.length) out.push({ key, label, tone, lines, ...more }) }
  if (view === 'today') {
    const now = plate.filter((x) => isNow(x.b))
    const urgent = now.filter((x) => !!x.t?.urgent && x.t.state === 'now')
    const rest = now.filter((x) => !urgent.includes(x))
    const day = rest.filter((x) => x.b !== 'overdue')
    add('pinned', 'For everyone', 'warn', (extra.pinned || []).map((t): Line => ({ k: 'task', key: 'p:' + t.id, t, as: 'pinned' })))
    add('urgent', 'Urgent', 'bad', urgent.map(asLine))
    /* one list for the day: what's late first (each says how late, in red), then the crew list (until it's sent), then
       what's set for a time, then any time — no separate box for what's late */
    const late = rest.filter((x) => x.b === 'overdue')
    add('today', 'Today', 'info', [...late, ...day.filter((x) => x.kind === 'crew'), ...day.filter((x) => x.kind !== 'crew')].map(asLine), { day: TODAY, lateLink: late.length > 0 })
    add('undated', 'No day set', 'neutral', plate.filter(undatedTask).map(asLine))
  } else if (view === 'tomorrow') {
    add('back', 'Back to you tomorrow', 'neutral', (extra.back || []).map((t): Line => ({ k: 'task', key: 'b:' + t.id, t, as: 'back' })))
    add('tomorrow', 'Tomorrow', 'info', plate.filter((x) => x.b === 'tomorrow').map(asLine), { day: TOMORROW })
  } else if (view === 'later') {
    const later = plate.filter((x) => (x.b === 'week' || x.b === 'later' || x.b === 'aside') && !undatedTask(x))
    /* due "this week" with no day of its own: its own part on top — not under a day it isn't on */
    const anyDay = later.filter((x) => x.b === 'week' && !!x.iso && x.iso <= TOMORROW)
    const dated = later.filter((x) => x.b !== 'aside' && !!x.iso && !anyDay.includes(x))
    add('week', 'This week', 'info', anyDay.map(asLine))
    Array.from(new Set(dated.map((x) => x.iso!))).sort().forEach((d) => add(d, dayHead(d), 'info', dated.filter((x) => x.iso === d).map(asLine), { day: d }))
    add('nodate', 'No date', 'neutral', later.filter((x) => x.b !== 'aside' && !x.iso).map(asLine))
    add('aside', 'Set aside', 'neutral', later.filter((x) => x.b === 'aside').map(asLine))
  }
  return out
}

/* worked out once for each change of the data (and of the day, the login, 3 in the afternoon) — Today, the menu's
   number and Everyone ask on every screen */
function perData<A extends unknown[], T>(f: (s: Store, ...a: A) => T): (s: Store, ...a: A) => T {
  let snap: unknown[] = []
  const cache = new Map<string, T>()
  return (s: Store, ...a: A): T => {
    const k = [...DATA_KEYS.map((d) => (s as any)[d]), TODAY, s.role, meOf(s.role), crewEvening()]
    if (k.length !== snap.length || k.some((x, i) => x !== snap[i])) { snap = k; cache.clear() }
    const id = JSON.stringify(a)
    if (!cache.has(id)) cache.set(id, f(s, ...a))
    return cache.get(id)!
  }
}
const plateNow = perData((s: Store, role: Role, person: PersonKey | null) => plateOf(s, role, person ?? undefined))

/** "Alex to accept PO-1047" is the same thing as the project's own step "Did the installer say yes?" — while that step
 *  is open, the step is the one line (its window has his PO, "Called him — waiting" and "He said yes") */
export const dupOfStep = (s: Store, t: Task): boolean => {
  if (!(t.action?.kind || '').startsWith('ipo:') || t.state === 'done') return false
  const j = s.jobs[t.jobId]
  if (!j || !isGettingReady(j)) return false
  const v = stepsFor(s, j).find((x) => x.key === 'confirmed')
  return !!v && v.state !== 'done' && v.state !== 'na'
}
/** a getting-ready step's task is the step: its star is the step's (its window is the step's window) */
const stepOfTask = (s: Store, t: Task): { jobId: string; key: string } | null => {
  if (!t.step || t.step.startsWith('*:')) return null
  const [jobId, key] = t.step.split(':')
  return s.jobs[jobId] && key ? { jobId, key } : null
}
export const taskStarred = (s: Store, t: Task, me: PersonKey | null | undefined) => {
  const st = stepOfTask(s, t)
  return st ? starredBy(s.stepRecs[st.jobId]?.[st.key]?.stars, me) : starredBy(t.stars, me)
}
export const taskStarPick = (s: Store, t: Task, me: PersonKey): StarPick => {
  const st = stepOfTask(s, t)
  return { on: taskStarred(s, t, me), toggle: () => (st ? toggleStepStar(st.jobId, st.key) : toggleTaskStar(t.id)) }
}

/** what someone starred on a list: out of its part, on top, in Starred — everything else where it was. Their own stars:
 *  someone's list on the admin's Everyone has theirs on top, as on their own phone */
const lineStarred = (s: Store, l: Line, me: PersonKey) =>
  l.k === 'task' || l.k === 'gc' ? taskStarred(s, l.t, me)
    : l.k === 'wait' ? starredBy(s.stepRecs[l.job.id]?.[l.v.key]?.stars, me)
      : l.x.kind === 'task' ? !!l.x.t && taskStarred(s, l.x.t, me)
        : l.x.kind === 'step' && !!l.x.job && !!l.x.v && starredBy(s.stepRecs[l.x.job.id]?.[l.x.v.key]?.stars, me)
function starredOnTop(s: Store, parts: Part[], me: PersonKey): Part[] {
  const top: Line[] = []
  const rest = parts.map((p) => {
    const keep = p.lines.filter((l) => {
      if (!lineStarred(s, l, me)) return true
      if (!top.some((x) => x.key === l.key)) top.push(l)
      return false
    })
    return keep.length === p.lines.length ? p : { ...p, lines: keep }
  }).filter((p) => p.lines.length)
  return top.length ? [{ key: 'starred', label: 'Starred', tone: 'neutral', lines: top }, ...rest] : parts
}

/** someone's list as they see it on their own Today — person left out: whoever is signed in; job: one project's. What
 *  they starred goes on top, in Starred */
export const partsOf = perData((s: Store, role: Role, person: PersonKey | null, view: View, job: string): Part[] => {
  const parts = partsRaw(s, role, person, view, job)
  return view === 'today' || view === 'coming' || view === 'waiting' ? starredOnTop(s, parts, person ?? meOf(role)) : parts
})
const partsRaw = perData((s: Store, role: Role, person: PersonKey | null, view: View, job: string): Part[] => {
  const me = person ?? meOf(role)
  const inJob = (id?: string) => job === 'all' || id === job
  /* coming up: tomorrow, then day by day after it */
  if (view === 'coming') return [...partsRaw(s, role, person, 'tomorrow', job), ...partsRaw(s, role, person, 'later', job)]
  if (view === 'today' || view === 'tomorrow' || view === 'later') {
    const plate = collapse(plateNow(s, role, person).filter((x) => inJob(jobOfItem(x))))
    const now = view === 'today' ? plate.filter((x) => isNow(x.b)) : []
    /* for everyone: on everyone's list (once — not again if it's already on it) */
    const pinned = view === 'today' ? s.tasks.filter((t) => t.everyone && t.state !== 'done' && inJob(t.jobId) && !quietForMe(t, me) && !now.some((x) => x.t?.id === t.id)) : []
    /* what I reminded someone about: off my Today, back tomorrow if it isn't done */
    const back = view === 'tomorrow' ? s.tasks.filter((t) => t.state !== 'done' && t.owner !== me && t.quiet?.[me] === TOMORROW && inJob(t.jobId)) : []
    return plateParts(plate, view, { pinned, back })
  }
  if (view === 'waiting') {
    /* what's out with the GC or a supplier, what you asked someone for or handed over, what you follow — and the steps
       waiting on someone outside, or on someone else's step first. Each with whose it is and its day */
    const follows = (t: Task) => t.owner !== me && t.state !== 'done' && (t.by === me || followersOf(t).includes(me))
    const waiting = s.tasks.filter((t) => !staleFollowUp(s, t) && !dupOfStep(s, t) && inJob(t.jobId) && ((t.state === 'waiting' && isMine(t, role, me)) || follows(t)))
      .sort((a, b) => (taskIso(a) || '9999').localeCompare(taskIso(b) || '9999'))
    /* the GC's on their own: the admin sees every one, on every project; anyone else their own */
    const gc = role === 'owner' || role === 'pm' ? gcWaits(s).filter((t) => inJob(t.jobId)) : waiting.filter(isGcWait)
    const steps = Object.values(s.jobs).filter((j) => isGettingReady(j) && inJob(j.id)).flatMap((j) => stepsFor(s, j).filter((v) => v.state === 'wait' && v.owner === me).map((v): Line => ({ k: 'wait', key: `w:${j.id}:${v.key}`, job: j, v })))
    const ahead = waitsOnOthers(s, me).filter((x) => inJob(x.job?.id)).map((x): Line => ({ k: 'plate', key: 'a:' + x.key, x }))
    /* someone else's step you're watching — the same as a task you watch */
    const watched = Object.values(s.jobs).filter((j) => isGettingReady(j) && inJob(j.id)).flatMap((j) => stepsFor(s, j)
      .filter((v) => v.owner !== me && v.state !== 'done' && v.state !== 'na' && !!s.stepRecs[j.id]?.[v.key]?.followers?.includes(me) && !ahead.some((a) => a.k === 'plate' && a.x.job?.id === j.id && a.x.v?.key === v.key))
      .map((v): Line => ({ k: 'wait', key: `f:${j.id}:${v.key}`, job: j, v })))
    const rest: Line[] = [...waiting.filter((t) => !gc.includes(t)).map((t): Line => ({ k: 'task', key: t.id, t, as: 'waiting' })), ...steps, ...watched, ...ahead]
    /* grouped by whom it's waiting on — Yakov's, Alex's, Infinity's — the one with the most first */
    const viewer = meOf(s.role)
    const short = (p?: PersonKey) => (p ? (p === viewer ? 'you' : PEOPLE[p]?.short || PEOPLE[p]?.name || 'someone') : 'someone')
    const onWhom = (l: Line): string => l.k === 'task' ? (l.t.state === 'waiting' ? (l.t.waitingOn || 'someone') : l.t.owner === me ? 'someone' : short(l.t.owner))
      : l.k === 'wait' ? (l.v.owner !== me ? short(l.v.owner) : l.v.waitsOn && l.v.waitsOn !== me ? short(l.v.waitsOn) : 'someone outside')
        : l.k === 'plate' ? short(l.x.who) : 'someone'
    const by = new Map<string, Line[]>()
    rest.forEach((l) => { const k = onWhom(l); by.set(k, [...(by.get(k) || []), l]) })
    const out: Part[] = []
    if (gc.length) out.push({ key: 'gc', label: 'Waiting on the GC', tone: 'neutral', lines: gc.map((t): Line => ({ k: 'gc', key: 'g:' + t.id, t })) })
    Array.from(by.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).forEach(([who, lines]) => out.push({ key: 'w:' + who, label: `Waiting on ${who}`, tone: 'neutral', lines }))
    return out
  }
  /* done: the last two weeks, newest first — by the day it was done (Today, Yesterday, Fri, Nov 20…); open one to
     reopen it */
  const from = addDays(TODAY, -14)
  const done = s.tasks.filter((t) => t.state === 'done' && isMine(t, role, me) && inJob(t.jobId) && (!doneDay(t) || doneDay(t) >= from)).sort((a, b) => doneDay(b).localeCompare(doneDay(a)))
  const byDay = new Map<string, Task[]>()
  done.forEach((t) => { const d = doneDay(t) || 'earlier'; byDay.set(d, [...(byDay.get(d) || []), t]) })
  return Array.from(byDay.entries()).map(([d, ts]): Part => ({ key: 'done:' + d, label: d === 'earlier' ? 'Earlier' : d === TODAY ? 'Today' : d === addDays(TODAY, -1) ? 'Yesterday' : dayShort(d), tone: 'neutral', lines: ts.slice(0, 40).map((t): Line => ({ k: 'task', key: t.id, t, as: 'done' })) }))
})
/** how many you got done today (the Done tab's number) */
export const doneTodayN = (s: Store, role: Role, person: PersonKey | null, job: string) => {
  const me = person || meOf(role)
  return s.tasks.filter((t) => t.state === 'done' && doneDay(t) === TODAY && isMine(t, role, me) && (job === 'all' || t.jobId === job)).length
}

/** the admin's Everyone: each person's list as on their own phone (you first) — and anything that's on nobody's */
export type Everyone = { people: { p: PersonKey; parts: Part[] }[]; nobody: Part[] }
export const everyoneOf = perData((s: Store, view: View, job: string): Everyone => {
  const me = meOf(s.role)
  const ppl = insidePeople(s)
  const roleOf = (p: PersonKey) => (s.team.find((m) => m.key === p)?.role as Role) || 'office'
  /* yours is your own list (with your check-ins); anyone else's, theirs */
  const who = (p: PersonKey): [Role, PersonKey | null] => (p === me ? [s.role, null] : [roleOf(p), p])
  const people = [...ppl.filter((p) => p === me), ...ppl.filter((p) => p !== me)].map((p) => ({ p, parts: partsOf(s, ...who(p), view, job) }))
  if (view !== 'today' && view !== 'tomorrow' && view !== 'later' && view !== 'coming') return { people, nobody: [] }
  /* on nobody's list: a login nobody has, a spot left empty — said, so it isn't lost */
  const keys = new Set(ppl.flatMap((p) => plateNow(s, ...who(p)).map((x) => x.key)))
  const lost = teamPlateNow(s).filter((x) => !keys.has(x.key) && x.kind !== 'meet' && (job === 'all' || jobOfItem(x) === job))
  return { people, nobody: view === 'coming' ? [...plateParts(collapse(lost), 'tomorrow'), ...plateParts(collapse(lost), 'later')] : plateParts(collapse(lost), view) }
})
/** the number on Today in the menu — the same number the page shows on top, and the same things in the list */
export const todayCount = (s: Store, role: Role) => countOf(partsOf(s, role, null, 'today', 'all'))

function PlateRow({ x, showOwner, followed, overdue }: { x: PlateItem; showOwner?: boolean; followed?: boolean; overdue?: boolean }) {
  if (x.kind === 'todos') return <TodosRow x={x} showOwner={showOwner} overdue={overdue} />
  if (x.kind === 'meet') return <MeetingRow e={x.e!} showOwner={showOwner} />
  if (x.kind === 'daily') return <DailyRow d={x.d!} showOwner={showOwner} />
  if (x.kind === 'dailies') return <DailiesRow x={x} showOwner={showOwner} />
  if (x.kind === 'trips') return <TripsRow x={x} showOwner={showOwner} />
  if (x.kind === 'steps') return <StepsRow x={x} showOwner={showOwner} />
  if (x.kind === 'checkin') return <CheckinRow x={x} />
  if (x.kind === 'crew') return <CrewRow />
  if (x.kind === 'rounds') return <RoundsRow />
  if (x.kind === 'pay') return <PayRow />
  if (x.kind === 'bill') return <BillRow />
  const late = overdue ? { text: lateBy(x.iso), tone: 'bad' as const } : undefined
  if (x.kind === 'step') return <StepRowToday job={x.job!} v={x.v!} showOwner={showOwner} when={late} flag={x.v?.state === 'bad' ? 'Problem' : undefined} />
  const tm = x.time != null ? { text: hourLabel(x.time), tone: 'strong' as const } : undefined
  return <TaskRow t={x.t!} showOwner={showOwner} followed={followed} when={late || tm} />
}

/* ================= the team today: set for today, done, rolled over ================= */
const doneTodayTask = (t: Task) => t.doneAt === 'Just now' || t.doneAt === 'Today' || isoFromLabel(t.doneAt) === TODAY
/** for each of ours: what's set for today, what got done today, and what's late (set for a day before and not done
 *  that day) — so the admin sees who's overloaded and who isn't */
export function teamToday(s: Store): { who: PersonKey; today: number; done: number; late: number }[] {
  const doneSteps = new Map<string, number>()
  Object.values(s.stepRecs).forEach((recs) => Object.values(recs || {}).forEach((r) => { if (r?.done && r.by && isoFromLabel(r.done) === TODAY) doneSteps.set(r.by, (doneSteps.get(r.by) || 0) + 1) }))
  return insidePeople(s).map((p) => {
    const role = (s.team.find((m) => m.key === p)?.role as Role) || 'office'
    const plate = plateOf(s, role, p).filter((x) => x.kind !== 'meet' && (x.who === p || x.kind === 'daily'))
    return {
      who: p,
      today: plate.filter((x) => x.b === 'today').length,
      late: plate.filter((x) => x.b === 'overdue').length,
      done: s.tasks.filter((t) => t.owner === p && t.state === 'done' && doneTodayTask(t)).length + (doneSteps.get(p) || 0),
    }
  }).filter((r) => r.today || r.late || r.done)
}

/* ================= the page ================= */
/* Your Today — the same for everyone, the admin and the site manager: three lists on top (Today, Coming up, Waiting),
 * yours only. What's late, then today hour by hour, then any time; each thing with its job right under it.
 * One job: "All jobs" on top — your jobs first, then any other (search) — just that job's things, and the way into the
 * project for everything else on it. Someone else's list (the admin): "Mine" next to it → their name — the same list
 * they have on their own phone. */
/** someone else's waiting thing: its day — red once it's late */
const theirWhen = (t: Task, me: PersonKey): { text: string; tone?: 'bad' | 'warn' | 'strong' | 'quiet' } | undefined => {
  if (t.owner === me || t.state !== 'now') return undefined
  const b = taskBucket(t)
  return b === 'overdue' ? { text: /late/i.test(t.due || '') ? t.due! : `Was due ${t.due}`, tone: 'bad' } : b === 'today' ? { text: 'Today', tone: 'warn' } : t.due ? { text: t.due, tone: 'strong' } : { text: 'Anytime', tone: 'quiet' }
}
/** a step waiting on someone outside: the day it's back */
const waitWhen = (v: StepView) => ({ text: v.due ? `${['delivered', 'matin'].includes(v.key) ? 'Coming' : ['design', 'walk'].includes(v.key) ? 'Set for' : 'Back'} ${md(v.due)}` : 'Waiting', tone: 'warn' as const })

/** one line of a list, whatever it is */
function LineRow({ l, me, showOwner }: { l: Line; me: PersonKey; showOwner?: boolean }) {
  if (l.k === 'gc') return <GcRow t={l.t} />
  if (l.k === 'wait') return <StepRowToday job={l.job} v={l.v} showOwner when={l.v.state === 'wait' ? waitWhen(l.v) : l.v.due ? { text: l.v.due < TODAY ? lateBy(l.v.due) : md(l.v.due), tone: l.v.due < TODAY ? 'bad' : 'strong' } : undefined} />
  if (l.k === 'task') {
    if (l.as === 'pinned') return <TaskRow t={l.t} showOwner={showOwner} when={{ text: 'Anytime', tone: 'quiet' }} />
    if (l.as === 'back') return <TaskRow t={l.t} when={{ text: 'Reminded', tone: 'quiet' }} />
    if (l.as === 'waiting') return <TaskRow t={l.t} showOwner when={theirWhen(l.t, me)} />
    return <TaskRow t={l.t} showOwner={showOwner} />
  }
  const t = l.x.t
  return <PlateRow x={l.x} showOwner={showOwner} overdue={l.x.b === 'overdue'} followed={!!t && t.owner !== me && followersOf(t).includes(me)} />
}
const timedLine = (l: Line): l is Extract<Line, { k: 'plate' }> => l.k === 'plate' && l.x.kind !== 'crew' && l.x.time != null
/** Everyone: the line for now would show once for each person — it's left out there */
const ShowNow = React.createContext(true)
/** a list's lines — today's with the line for now between what's before it and what's after */
function Lines({ lines: lines0, me, day, showOwner, on }: { lines: Line[]; me: PersonKey; day?: string; showOwner?: boolean; on?: Record<string, PersonKey[]> }) {
  const d = new Date()
  const nowMin = d.getHours() * 60 + d.getMinutes()
  const showNow = React.useContext(ShowNow)
  const sort = React.useContext(TodaySort)
  const s = useStore()
  const lines = sort ? sortLines(s, lines0, sort) : lines0
  let at = -1
  if (showNow && !sort && day === TODAY && lines.some(timedLine)) {
    const after = lines.findIndex((l) => timedLine(l) && (l.x.time ?? 0) > nowMin)
    at = after >= 0 ? after : lines.reduce((n, l, i) => (timedLine(l) ? i + 1 : n), 0)
  }
  return (
    <>
      {lines.map((l, i) => <React.Fragment key={l.key}>{i === at && <NowLine min={nowMin} />}<LineOn.Provider value={on?.[l.key] || null}><Safe name={`Today line ${l.key}`}><LineRow l={l} me={me} showOwner={showOwner} /></Safe></LineOn.Provider></React.Fragment>)}
      {at === lines.length && <NowLine min={nowMin} />}
    </>
  )
}
/** a part of a list: its name and how many, then its lines */
function PartBlock({ p, me, showOwner, lateLink = true }: { p: Part; me: PersonKey; showOwner?: boolean; lateLink?: boolean }) {
  const s = useStore()
  return (
    <section data-day={p.day || p.key} data-part={p.key}>
      {p.label && <Group label={p.label} count={p.lines.length} tone={p.tone} strong={p.tone === 'bad'} right={p.lateLink && lateLink ? <button onClick={() => s.open({ t: 'late' })} data-late-open className="text-[0.8125rem] font-medium text-muted hover:text-brand-700">Move or remind<ChevronRight className="ml-0.5 inline h-3.5 w-3.5 align-[-0.15em]" /></button> : undefined} />}
      <Lines lines={p.lines} me={me} day={p.day} showOwner={showOwner} on={p.on} />
    </section>
  )
}

/** the end of your Today: what you finished today — crossed out, its circle green (click it: back on the list). The
 *  first five; all of them on Done */
function DoneToday({ role, person, job, me, onAll }: { role: Role; person: PersonKey | null; job: string; me: PersonKey; onAll: () => void }) {
  const s = useStore()
  const who = person || meOf(role)
  const ts = s.tasks.filter((t) => t.state === 'done' && doneDay(t) === TODAY && isMine(t, role, who) && (job === 'all' || t.jobId === job))
  if (!ts.length) return null
  const shown = ts.slice(0, 5)
  return (
    <section data-part="donetoday">
      <Group label="Done today" count={ts.length} right={ts.length > shown.length ? <button type="button" onClick={onAll} className="text-[0.8125rem] font-medium text-muted hover:text-brand-700" data-done-all>See all {ts.length}</button> : undefined} />
      <Lines lines={shown.map((t): Line => ({ k: 'task', key: 'dt:' + t.id, t, as: 'done' }))} me={me} />
    </section>
  )
}

/* ---------------- someone's list, for the admin (Team report → a person) ---------------- */
const roleOfPerson = (s: Store, p: PersonKey) => (s.team.find((m) => m.key === p)?.role as Role) || 'office'
/** what's on someone's Today — the number on their own phone */
export const theirToday = (s: Store, p: PersonKey) => (p === meOf(s.role) ? todayCount(s, s.role) : countOf(partsOf(s, roleOfPerson(s, p), p, 'today', 'all')))
/** someone's Today, as they see it on their own phone */
export function TheirList({ who }: { who: PersonKey }) {
  const s = useStore()
  const you = who === meOf(s.role)
  const parts = you ? partsOf(s, s.role, null, 'today', 'all') : partsOf(s, roleOfPerson(s, who), who, 'today', 'all')
  const n = countOf(parts)
  return (
    <section className="-mx-6 mb-5 border-b border-line-2 max-sm:-mx-4" data-their-list={who}>
      <div className={cn('flex items-baseline gap-2 pb-2', 'px-6 max-sm:px-4')}>
        <span className="text-[0.9375rem] font-semibold text-ink">{you ? 'Your Today' : `${PEOPLE[who]?.short || 'Their'}’s Today`}</span>
        <span className="text-[0.875rem] font-semibold text-faint tnum" data-their-count>{n}</span>
        <span className="min-w-0 truncate text-[0.8125rem] text-muted">· the same list as on {you ? 'your' : 'their'} phone</span>
      </div>
      {n ? (
        <div data-even-list style={todoCols}>
          <TodayHead />
          {parts.map((p) => <PartBlock key={p.key} p={p} me={who} lateLink={false} />)}
        </div>
      ) : <div className="px-6 pb-4 text-[0.875rem] text-muted max-sm:px-4">Nothing on it today.</div>}
    </section>
  )
}
/** on nobody's list — a login nobody has, a spot left empty: one line on Team report, so it isn't lost */
export function NobodyLine() {
  const s = useStore()
  const n = countOf(everyoneOf(s, 'today', 'all').nobody)
  if (!n) return null
  return (
    <button onClick={() => s.open({ t: 'nobodylist' })} className={cn('flex min-h-[3rem] w-full items-center gap-3 border-t border-line-2 py-2 text-left transition row-hover', PX)} data-nobody-line>
      <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-ink">On nobody’s list</span>
      <span className="text-[0.875rem] font-semibold text-warn-700 tnum">{n}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
    </button>
  )
}
export function NobodyModal({ level }: { level: number }) {
  const s = useStore()
  const parts = everyoneOf(s, 'today', 'all').nobody
  return (
    <Modal level={level} size="md" onClose={s.close} title="On nobody’s list" sub="For a login nobody has yet. Give each one to someone, or give the login to someone on Team.">
      <div className="-mx-6 max-sm:-mx-4" data-even-list style={todoCols}>
        {countOf(parts) > 0 && <TodayHead />}
        {parts.map((p) => <PartBlock key={p.key} p={p} me={meOf(s.role)} lateLink={false} />)}
        {!countOf(parts) && <div className="px-6 py-4 text-[0.875rem] text-muted">Nothing. Everything is on someone’s list.</div>}
      </div>
    </Modal>
  )
}

/* ---------------- whose list ---------------- */
/** the admin's pick on Today: whose list — his own, one person's (the same as on their phone), or Everyone (each one's
 *  list under their name, never mixed) — kept while the app is open, from page to page */
export const useTodayWho = create<{ who: PersonKey[]; set: (p: PersonKey[]) => void }>((set) => ({ who: [], set: (who) => set({ who }) }))
type ListOf = { role: Role; person: PersonKey | null; key: PersonKey }
/** whose lists Today shows: yours — or, for the admin, the one picked (or everyone's) */
function listsOf(s: Store, who: PersonKey[]): ListOf[] {
  const me = meOf(s.role)
  const ticked = reportOn(s) ? who.filter((p) => p === me || !!PEOPLE[p]) : []
  if (!ticked.length) return [{ role: s.role, person: null, key: me }]
  return ticked.map((p) => (p === me ? { role: s.role, person: null, key: me } : { role: roleOfPerson(s, p), person: p, key: p }))
}
/** the order a list's parts go in, whatever list they came from */
const partRank = (lists: Part[][], key: string) => Math.min(...lists.map((ps) => { const i = ps.findIndex((x) => x.key === key); return i < 0 ? 99 : i }))
/** a line's hour on today's list (the rest after, in the order they came) */
const lineHour = (l: Line) => (l.k === 'plate' && l.x.kind !== 'crew' && l.x.time != null ? l.x.time : 1e6)
/** several people's lists as one — only to count them (each thing once); the page shows each person's on its own */
function mergeParts(lists: Part[][], keys: PersonKey[] = []): Part[] {
  if (lists.length === 1) return lists[0]
  const out: Part[] = []
  lists.forEach((parts, li) => parts.forEach((p) => {
    let m = out.find((x) => x.key === p.key)
    if (!m) { m = { ...p, lines: [], on: {} }; out.push(m) }
    const into = m
    const on = into.on!
    p.lines.forEach((l) => {
      if (!into.lines.some((y) => y.key === l.key)) into.lines.push(l)
      if (keys[li] && !(on[l.key] ||= []).includes(keys[li])) on[l.key].push(keys[li])
    })
  }))
  out.forEach((p) => { p.lines = p.lines.map((l, i) => ({ l, i })).sort((a, b) => lineHour(a.l) - lineHour(b.l) || a.i - b.i).map((x) => x.l) })
  return out.sort((a, b) => partRank(lists, a.key) - partRank(lists, b.key))
}
/** the parts of the lists picked — one list, or everyone's counted as one */
const partsFor = (s: Store, lists: ListOf[], view: View, job: string) => mergeParts(lists.map((l) => partsOf(s, l.role, l.person, view, job)), lists.map((l) => l.key))
/** the pick in a word: Mine, Yakov's, Everyone */
function whoWords(s: Store, lists: ListOf[], total = 0): string {
  const me = meOf(s.role)
  const name = (k: PersonKey) => (k === me ? 'Mine' : `${PEOPLE[k]?.short || 'Their'}’s`)
  if (lists.length === 1) return name(lists[0].key)
  if (total > 1 && lists.length >= total) return 'Everyone'
  return lists.length <= 3 ? lists.map((l) => name(l.key)).join(' + ') : `${lists.length} people`
}
/** the admin: whose list — one person's (tap a name: only theirs), or more than one (the switch: tick each — each one
 *  shown apart, under its name), or Everyone. The same look as Who does it on a to-do */
function WhoPick() {
  const s = useStore()
  const who = useTodayWho((x) => x.who)
  const set = useTodayWho((x) => x.set)
  const me = meOf(s.role)
  const all = insidePeople(s).length ? [me, ...insidePeople(s).filter((p) => p !== me)] : [me]
  const lists = listsOf(s, who)
  const keys = lists.map((l) => l.key)
  const everyone = all.length > 1 && keys.length >= all.length
  const one = keys.length === 1 ? keys[0] : null
  const lost = countOf(everyoneOf(s, 'today', 'all').nobody)
  const [open, setOpen] = React.useState(false)
  const [many, setMany] = React.useState(keys.length > 1 && !everyone)
  React.useEffect(() => { if (open) setMany(keys.length > 1 && !everyone) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const words = whoWords(s, lists, all.length)
  /* me alone is the plain list (no one picked) */
  const put = (ks: PersonKey[]) => set(ks.length === 1 && ks[0] === me ? [] : all.filter((p) => ks.includes(p)))
  const tap = (p: PersonKey) => {
    if (!many) { put([p]); setOpen(false); return }
    const next = keys.includes(p) ? keys.filter((x) => x !== p) : [...keys, p]
    if (next.length) put(next)
  }
  const flip = () => { if (many) put([keys.includes(me) ? me : keys[0]]); setMany(!many) }
  const dot = (on: boolean) => <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full border', on ? 'border-brand-600 bg-brand-600' : 'border-[#c9ced6] bg-white')}>{on && <span className="h-[0.4375rem] w-[0.4375rem] rounded-full bg-white" />}</span>
  const box = (on: boolean) => <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c9ced6] bg-white')}>{on && <Check className="h-3 w-3" strokeWidth={3.2} />}</span>
  const row = (on: boolean) => cn('flex min-h-10 w-full items-center gap-3 rounded-lg px-2 text-left text-[0.9375rem] text-ink transition hover:bg-wash', on && !many && 'bg-brand-50/60 font-medium hover:bg-brand-50')
  return (
    <Pop open={open} onOpenChange={setOpen} align="start" width={300} trigger={
      <button type="button" aria-label="Whose list · pick" className={cn('inline-flex h-9 min-w-0 max-w-[18rem] items-center gap-2 rounded-[0.625rem] border px-3 text-[0.875rem] transition-colors [&_svg]:h-4 [&_svg]:w-4', words !== 'Mine' ? 'border-brand-300 bg-brand-50 font-semibold text-brand-700' : 'border-[#d9d3c9] bg-white text-ink-2 shadow-xs hover:bg-wash')} data-today-who>
        {one && one !== me ? <Avatar who={one} size={20} /> : !one ? <Users className="shrink-0 text-brand-600" /> : <UserRound className="shrink-0 text-faint" />}
        <span className="min-w-0 truncate" data-today-who-picked={keys.map((k) => (k === me ? 'me' : k)).join(',')}>{words}</span>
        <ChevronDown className="shrink-0 opacity-50" />
      </button>
    }>
      <div className="text-[0.875rem] font-semibold text-ink">Whose list</div>
      <div className="mb-2 mt-0.5 text-[0.8125rem] text-muted">{many ? 'Tick each one. Each list shows apart, under its name.' : 'One person’s, the same as on their phone.'}</div>
      <div className="-mx-1 flex flex-col" role={many ? 'group' : 'radiogroup'} data-who-list>
        {all.map((p) => {
          const on = many ? keys.includes(p) : one === p
          return (
            <button key={p} type="button" onClick={() => tap(p)} className={row(on)} role={many ? 'checkbox' : 'radio'} aria-checked={on} data-who-person={p}>
              {many ? box(on) : dot(on)}<Avatar who={p} size={22} /><span className="min-w-0 flex-1 truncate">{p === me ? 'Mine' : PEOPLE[p]?.name || p}</span>
              <span className="shrink-0 text-[0.8125rem] font-normal tnum text-muted">{p === me ? todayCount(s, s.role) : theirToday(s, p)}</span>
            </button>
          )
        })}
        {all.length > 1 && (
          <button type="button" onClick={() => { put(all); setOpen(false) }} className={cn(row(everyone), 'mt-1 border-t border-line-2 pt-1')} role="radio" aria-checked={everyone} data-who-all>
            {many ? box(everyone) : dot(everyone)}<span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-wash-2 text-muted"><Users className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1">Everyone <span className="font-normal text-muted">· each one apart</span></span>
          </button>
        )}
        {all.length > 2 && (
          <button type="button" role="switch" aria-checked={many} onClick={flip} className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-lg border-t border-line-2 px-2 pt-1 text-left text-[0.875rem] text-ink-2 transition hover:bg-wash" data-who-many>
            <span className={cn('relative inline-flex h-[1.125rem] w-8 shrink-0 rounded-full transition-colors', many ? 'bg-brand-600' : 'bg-[#d5d0c7]')}><span className={cn('absolute top-0.5 h-[0.875rem] w-[0.875rem] rounded-full bg-white shadow-sm transition-all', many ? 'left-[0.9375rem]' : 'left-0.5')} /></span>
            <span className="min-w-0 flex-1">More than one list</span>
          </button>
        )}
        {lost > 0 && <button type="button" onClick={() => { setOpen(false); s.open({ t: 'nobodylist' }) }} className={cn(row(false), 'mt-1 border-t border-line-2 pt-1 text-warn-800')}><UserRound className="h-4 w-4 text-warn-600" /><span className="min-w-0 flex-1">On nobody’s list</span><span className="text-[0.8125rem] tnum">{lost}</span></button>}
      </div>
    </Pop>
  )
}
/** Everyone: one person's list under their name — their circle, their name, how many — the same lines as on their own
 *  phone; the next person after it. Never mixed */
function PersonList({ l, view, job, me, q = '' }: { l: ListOf; view: View; job: string; me: PersonKey; q?: string }) {
  const s = useStore()
  const parts = findIn(s, partsOf(s, l.role, l.person, view, job), q)
  const n = countOf(parts)
  if (!n) return null
  return (
    <section data-person-list={l.key}>
      <div className={cn('flex min-h-[3.25rem] items-center gap-3 border-t-2 border-line bg-white py-2', PX)} data-person-band>
        <Avatar who={l.key} size={28} />
        <b className="min-w-0 truncate text-[1rem] font-semibold text-ink">{l.key === me ? 'You' : PEOPLE[l.key]?.name || l.key}</b>
        <span className="text-[0.875rem] font-semibold text-faint tnum" data-person-count>{n}</span>
      </div>
      <Viewer.Provider value={l.key}>
        <Multi.Provider value={false}>
          <ShowNow.Provider value={false}>
            {parts.map((p) => <PartBlock key={p.key} p={p} me={l.key} showOwner={view === 'waiting'} lateLink={l.key === me} />)}
          </ShowNow.Provider>
        </Multi.Provider>
      </Viewer.Provider>
    </section>
  )
}

/* ---------------- one job ---------------- */
/** the job picked on Today — kept while the app is open: you're at that job */
export const useTodayJob = create<{ job: string; set: (j: string) => void }>((set) => ({ job: 'all', set: (job) => set({ job }) }))
/** the jobs on your lists (Today, Coming up, Waiting), and how many things of yours on each */
function yourJobs(s: Store, role: Role, person: PersonKey | null = null): Map<string, number> {
  const ids = new Set<string>()
  const add = (id?: string) => { if (id && s.jobs[id]) ids.add(id) }
  ;(['today', 'coming', 'waiting'] as View[]).forEach((v) => partsOf(s, role, person, v, 'all').forEach((p) => p.lines.forEach((l) => {
    if (l.k === 'task' || l.k === 'gc') return add(l.t.jobId)
    if (l.k === 'wait') return add(l.job.id)
    const x = l.x
    add(jobOfItem(x)); x.ds?.forEach((d) => add(d.jobId)); x.vs?.forEach((v) => add(v.job.id)); x.ts?.forEach((t) => add(t.jobId))
  })))
  const out = new Map<string, number>()
  ids.forEach((id) => { const n = (['today', 'coming', 'waiting'] as View[]).reduce((k, v) => k + countOf(partsOf(s, role, person, v, id)), 0); if (n) out.set(id, n) })
  return out
}
const byJobName = (a: Job, b: Job) => a.name.localeCompare(b.name, undefined, { numeric: true })
/** pick a job: yours first (what's on your lists), then every other one — type to find any */
export function JobPickModal({ level }: { level: number }) {
  const s = useStore()
  const cur = useTodayJob((x) => x.job)
  const set = useTodayJob((x) => x.set)
  const [q, setQ] = React.useState('')
  const small = useSmall()
  /* the jobs on the lists ticked — each one's, counted together */
  const mine = new Map<string, number>()
  listsOf(s, useTodayWho((x) => x.who)).forEach((l) => yourJobs(s, l.role, l.person).forEach((n, id) => mine.set(id, (mine.get(id) || 0) + n)))
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const hit = (j: Job) => { const k = `${j.name} ${j.client} ${j.address}`.toLowerCase(); return words.every((w) => k.includes(w)) }
  const yours = Object.values(s.jobs).filter((j) => mine.has(j.id) && hit(j)).sort(byJobName)
  /* the rest: going projects when nothing's typed — anything at all (an estimate, a finished one) when it is */
  const rest = Object.values(s.jobs).filter((j) => !mine.has(j.id) && (words.length ? hit(j) : !PRICING_STAGES.includes(j.stage) && j.stage !== 'complete')).sort(byJobName)
  const MAX = 60
  const pick = (id: string) => { set(id); s.close() }
  const row = (j: Job, n?: number) => (
    <button key={j.id} type="button" onClick={() => pick(j.id)} aria-pressed={cur === j.id} className={cn('flex min-h-[3.25rem] w-full min-w-0 items-center gap-3 border-t border-line-2 px-6 py-2 text-left transition first:border-t-0 max-sm:px-4', cur === j.id ? 'bg-brand-50' : 'row-hover')} data-pick-job={j.id}>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[0.9375rem] font-semibold text-ink">{j.name}</span>
        <span className="block truncate text-[0.8125rem] text-muted">{[j.client, j.address && j.address !== j.name ? j.address : ''].filter(Boolean).join(' · ')}{PRICING_STAGES.includes(j.stage) ? ' · estimate' : ''}</span>
      </span>
      {n ? <span className="shrink-0 text-[0.875rem] font-semibold text-ink-2 tnum" data-pick-n>{n}</span> : null}
      {cur === j.id && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
    </button>
  )
  const head = (t: string, n?: number) => <div className="flex items-baseline gap-2 bg-wash/60 px-6 pb-1.5 pt-3 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-[#4c5361] max-sm:px-4">{t}{n != null && <span className="font-semibold text-faint">{n}</span>}</div>
  return (
    <Modal level={level} size="md" onClose={s.close} title="Pick a job" sub="See just its things. Your jobs first" bodyClass="px-0 pb-4 pt-0">
      <div className="sticky top-0 z-[1] bg-white px-6 pb-3 pt-1 max-sm:px-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input {...(small ? {} : { 'data-autofocus': true })} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a job. Name, address or client" aria-label="Find a job" className="h-11 w-full rounded-[0.625rem] border border-line bg-white pl-9 pr-3 text-[0.9375rem] text-ink outline-none focus:border-brand-300" data-pick-search />
        </label>
      </div>
      {cur !== 'all' && !words.length && (
        <button type="button" onClick={() => pick('all')} className="flex min-h-12 w-full items-center gap-3 border-y border-line-2 px-6 text-left text-[0.9375rem] font-semibold text-brand-700 row-hover max-sm:px-4" data-pick-job="all">
          <Building2 className="h-4 w-4" />All jobs. Everything on your list
        </button>
      )}
      {yours.length > 0 && <section data-pick-yours>{head('Yours', yours.length)}{yours.map((j) => row(j, mine.get(j.id)))}</section>}
      {rest.length > 0 && <section data-pick-rest>{head(words.length ? 'Other jobs' : 'Every other project', rest.length)}{rest.slice(0, MAX).map((j) => row(j))}{rest.length > MAX && <div className="px-6 py-3 text-[0.8125rem] text-muted max-sm:px-4">{rest.length - MAX} more. Type a name or an address to find one.</div>}</section>}
      {!yours.length && !rest.length && <div className="px-6 py-6 text-center text-[0.875rem] text-muted">No job matches “{q}”.</div>}
    </Modal>
  )
}
/** on top of the list: the job you're looking at — all of them, or one with the way into its project */
/** which job: a small list over the button, the same as Whose list — a box to type in on top, All jobs, then only the
 *  jobs with something on your list (how many on each). Typing finds any job at all. Never a long list */
function JobPickPop({ picked }: { picked?: Job }) {
  const s = useStore()
  const cur = useTodayJob((x) => x.job)
  const set = useTodayJob((x) => x.set)
  const who = useTodayWho((x) => x.who)
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const small = useSmall()
  const mine = new Map<string, number>()
  if (open) listsOf(s, who).forEach((l) => yourJobs(s, l.role, l.person).forEach((n, id) => mine.set(id, (mine.get(id) || 0) + n)))
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const hit = (j: Job) => { const k = `${j.name} ${j.client} ${j.address}`.toLowerCase(); return words.every((w) => k.includes(w)) }
  const yours = open ? Object.values(s.jobs).filter((j) => mine.has(j.id) && hit(j)).sort(byJobName) : []
  /* typed: any other job that matches — an estimate, a finished one — the first few */
  const others = open && words.length ? Object.values(s.jobs).filter((j) => !mine.has(j.id) && hit(j)).sort(byJobName) : []
  const SHOW = 8
  const pick = (id: string) => { set(id); setOpen(false); setQ('') }
  const dot = (on: boolean) => <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full border', on ? 'border-brand-600 bg-brand-600' : 'border-[#c9ced6] bg-white')}>{on && <span className="h-[0.4375rem] w-[0.4375rem] rounded-full bg-white" />}</span>
  const rowCls = (on: boolean) => cn('flex min-h-10 w-full min-w-0 items-center gap-3 rounded-lg px-2 text-left text-[0.9375rem] text-ink transition hover:bg-wash', on && 'bg-brand-50/60 font-medium hover:bg-brand-50')
  const row = (j: Job, n?: number) => (
    <button key={j.id} type="button" onClick={() => pick(j.id)} className={rowCls(cur === j.id)} role="radio" aria-checked={cur === j.id} data-pick-job={j.id} title={[j.client, j.address].filter(Boolean).join(' · ')}>
      {dot(cur === j.id)}
      <span className="min-w-0 flex-1 truncate">{j.name}{PRICING_STAGES.includes(j.stage) ? <span className="font-normal text-muted"> · estimate</span> : null}</span>
      {n ? <span className="shrink-0 text-[0.8125rem] font-normal tnum text-muted" data-pick-n>{n}</span> : null}
    </button>
  )
  const head = (t: string) => <div className="px-2 pb-1 pt-2.5 text-[0.75rem] font-semibold text-muted">{t}</div>
  return (
    <Pop open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ('') }} align="start" width={320} trigger={
      <button type="button" aria-label={picked ? `Job: ${picked.name} · pick another` : 'Pick a job'}
        className={cn('inline-flex h-9 min-w-0 max-w-[22rem] items-center gap-2 rounded-[0.625rem] border px-3 text-[0.875rem] transition-colors [&_svg]:h-4 [&_svg]:w-4', picked ? 'border-brand-300 bg-brand-50 font-semibold text-brand-700' : 'border-[#d9d3c9] bg-white text-ink-2 shadow-xs hover:bg-wash')} data-job-pick>
        <Building2 className={cn('shrink-0', picked ? 'text-brand-600' : 'text-faint')} />
        <span className="min-w-0 truncate" data-job-picked={picked?.id || 'all'}>{picked ? picked.name : 'All jobs'}</span>
        <ChevronDown className="shrink-0 opacity-50" />
      </button>
    }>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input {...NO_SUGGEST} autoFocus={!small} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { const first = yours[0] || others[0]; if (first) pick(first.id) } }} placeholder="Find a job" aria-label="Find a job" className="h-10 w-full rounded-[0.625rem] border border-line bg-white pl-9 pr-3 text-[0.9375rem] text-ink outline-none focus:border-brand-300 focus:ring-[0.1875rem] focus:ring-brand-50" data-pick-search />
      </label>
      <div className="-mx-1 mt-1.5 flex max-h-[min(22rem,55vh)] flex-col overflow-y-auto" role="radiogroup" aria-label="Which job" data-pick-list>
        {!words.length && (
          <button type="button" onClick={() => pick('all')} className={rowCls(cur === 'all')} role="radio" aria-checked={cur === 'all'} data-pick-job="all">
            {dot(cur === 'all')}<span className="min-w-0 flex-1">All jobs</span>
          </button>
        )}
        {yours.length > 0 && <section data-pick-yours>{head(words.length ? 'On your list' : 'With something on your list')}{yours.map((j) => row(j, mine.get(j.id)))}</section>}
        {others.length > 0 && <section data-pick-rest>{head('Other jobs')}{others.slice(0, SHOW).map((j) => row(j))}{others.length > SHOW && <div className="px-2 py-1.5 text-[0.8125rem] text-muted">{others.length - SHOW} more. Type more of the name</div>}</section>}
        {words.length > 0 && !yours.length && !others.length && <div className="px-2 py-3 text-[0.875rem] text-muted">No job matches “{q.trim()}”.</div>}
      </div>
    </Pop>
  )
}
/* ---------------- find a to-do: type, and the list is only what matches ---------------- */
/** what's typed in the list's search — kept while the app is open */
export const useTodayFind = create<{ q: string; set: (q: string) => void }>((set) => ({ q: '', set: (q) => set({ q }) }))
/** the words a line is found by: what it says, its project (name, address, client), whose it is */
function lineWords(s: Store, l: Line): string {
  const jn = (id?: string) => { const j = id ? s.jobs[id] : undefined; return j ? `${j.name} ${j.address || ''} ${j.client || ''}` : '' }
  const pn = (p?: string) => { const x = p ? PEOPLE[p as PersonKey] : undefined; return x ? `${x.name} ${x.short}` : '' }
  const task = (t: Task) => `${t.title} ${t.detail || ''} ${t.where || ''} ${t.waitingOn || ''} ${jn(t.jobId)} ${pn(t.owner)} ${(t.also || []).map(pn).join(' ')}`
  if (l.k === 'task' || l.k === 'gc') return task(l.t)
  if (l.k === 'wait') return `${todoOf(l.v)} ${jn(l.job.id)} ${pn(l.v.owner)}`
  const x = l.x
  return [
    x.t ? task(x.t) : '',
    x.e ? `${x.e.title} ${x.e.kind === 'walkthrough' ? 'walkthrough' : 'meeting'} ${x.e.with || ''} ${jn(x.e.jobId)} ${x.e.people.map(pn).join(' ')}` : '',
    x.v ? todoOf(x.v) : '',
    x.job ? jn(x.job.id) : '',
    x.d ? `daily update ${jn(x.d.jobId)}` : '',
    x.ds ? `daily updates ${x.ds.map((d) => jn(d.jobId)).join(' ')}` : '',
    x.ts ? `bring to the job ${x.ts.map(task).join(' ')}` : '',
    x.vs ? x.vs.map((y) => `${todoOf(y.v)} ${jn(y.job.id)}`).join(' ') : '',
    x.ci ? `check in with ${pn(x.ci.who)}` : '',
    ({ crew: 'crew report', rounds: 'visit the jobs', pay: 'installer pay', bill: 'progress billing bill the week' } as Record<string, string>)[x.kind] || '',
  ].join(' ')
}
/** only the lines that match every word typed — the parts with none go */
export function findIn(s: Store, parts: Part[], q: string): Part[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return parts
  return parts.map((p) => ({ ...p, lines: p.lines.filter((l) => { const k = lineWords(s, l).toLowerCase(); return words.every((w) => k.includes(w)) }) })).filter((p) => p.lines.length)
}
/** the search on top of the list — a computer's. A phone has Search on top of the screen, which finds to-dos (and
 *  everything else): one search there, not two */
function FindBox() {
  const q = useTodayFind((x) => x.q)
  const set = useTodayFind((x) => x.set)
  const small = useSmall()
  if (small) return null
  return (
    <label className="relative block w-[15.5rem] min-w-0" data-today-find>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input {...NO_SUGGEST} value={q} onChange={(e) => set(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') set('') }} placeholder="Search to-dos" aria-label="Search to-dos" className="h-9 w-full rounded-[0.625rem] border border-[#d9d3c9] bg-white pl-9 pr-8 text-[0.875rem] text-ink outline-none transition placeholder:text-faint focus:border-brand-300 focus:ring-[0.1875rem] focus:ring-brand-50" data-today-find-input />
      {q && <button type="button" onClick={() => set('')} aria-label="Clear the search" className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-wash hover:text-ink" data-today-find-clear><X className="h-3.5 w-3.5" /></button>}
    </label>
  )
}

function JobBar({ picked, onClear, sort }: { picked?: Job; onClear: () => void; /** a phone: the Sort button */ sort?: React.ReactNode }) {
  const s = useStore()
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2" data-today-bar>
      <JobPickPop picked={picked} />
      {picked && <button type="button" onClick={onClear} aria-label="All jobs" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] text-muted hover:bg-wash hover:text-ink" data-job-clear><X className="h-4 w-4" /></button>}
      {/* the admin: whose list — his own, or anyone's */}
      {reportOn(s) && <WhoPick />}
      <span className="flex-1" />
      {picked && <button type="button" onClick={() => s.open({ t: 'job', id: picked.id })} className="inline-flex shrink-0 items-center text-[0.875rem] font-semibold text-brand-700 hover:underline" data-job-open>Open the project<ChevronRight className="ml-0.5 h-4 w-4" /></button>}
      {/* a computer: search the to-dos — only what matches stays */}
      <FindBox />
      {sort}
    </div>
  )
}

export function MyTasksPage() {
  const s = useStore()
  const role = s.role
  const t0 = (s.route.tab as string) || 'today'
  const [view, setView] = React.useState<'today' | 'coming' | 'waiting' | 'done'>(t0 === 'tomorrow' || t0 === 'later' || t0 === 'coming' ? 'coming' : t0 === 'waiting' ? 'waiting' : t0 === 'done' ? 'done' : 'today')
  const job0 = useTodayJob((x) => x.job)
  const setJob = useTodayJob((x) => x.set)
  const picked = job0 !== 'all' ? s.jobs[job0] : undefined
  const job = picked ? picked.id : 'all'
  /* whose lists: yours — or, for the admin, the people ticked (each one's list, as on their own phone; several as one) */
  const lists = listsOf(s, useTodayWho((x) => x.who))
  const multi = lists.length > 1
  const me = lists[0].person || meOf(role)
  /* each number is what its list shows — with a job picked, its */
  /* the number on each tab is what you see under it — Everyone: each person's lines added up */
  /* typed in the search: only what matches — and each tab's number is how many match on it */
  const q0 = useTodayFind((x) => x.q).trim()
  /* (a phone has no list search — Search on top of the screen instead) */
  const q = useSmall() ? '' : q0
  const n = (v: View) => (lists.length > 1 ? lists.reduce((k, l) => k + countOf(findIn(s, partsOf(s, l.role, l.person, v, job), q)), 0) : countOf(findIn(s, partsFor(s, lists, v, job), q)))
  const parts = findIn(s, partsFor(s, lists, view, job), q)
  const found = q ? n(view) : 0
  /* sorted by a column (tap its name; a phone: Sort) — inside each part */
  const sorter = useSort('today')
  /* what you finished: its own tab — its number is today's */
  const doneN = lists.reduce((k, l) => k + doneTodayN(s, l.role, l.person, job), 0)
  const empty: Record<'today' | 'coming' | 'waiting' | 'done', { title: string; sub: string }> = {
    today: { title: picked ? `Nothing for ${picked.name} today` : 'Nothing due today', sub: n('coming') ? `${n('coming')} coming up. See Coming up.` : 'New work lands here the moment it’s yours.' },
    coming: { title: 'Nothing coming up', sub: 'Tomorrow’s things, and anything with a day after it, show here.' },
    waiting: { title: 'Nothing waiting', sub: 'What you asked someone for, what you follow, and what’s out with the GC or a supplier waits here until it’s done.' },
    done: { title: 'Nothing done yet', sub: 'What’s finished goes here, by the day it was done. Open one to reopen it.' },
  }

  return (
    <Page
      title={multi ? (lists.length >= (insidePeople(s).length || 1) ? 'Everyone’s Today' : `Today · ${lists.map((l) => (l.key === meOf(role) ? 'You' : PEOPLE[l.key]?.short || '')).join(' and ')}`) : lists[0].person ? `${PEOPLE[lists[0].person]?.short || 'Their'}’s Today` : `${greeting()}, ${PEOPLE[meOf(role)].short}`}
      phoneTitle
      sub={TODAY_LABEL}
      top={
        <Bubbles
          row
          soft
          items={[
            { key: 'today', label: 'Today', count: n('today'), icon: <ListTodo />, color: 'blue', on: view === 'today', onClick: () => setView('today') },
            { key: 'coming', label: 'Coming up', count: n('coming'), icon: <CalendarDays />, color: 'violet', on: view === 'coming', onClick: () => setView('coming') },
            /* what someone else is doing that you're waiting for — you asked them, you're watching it, it's with the GC */
            { key: 'waiting', label: 'Waiting on others', short: 'Waiting', count: n('waiting'), icon: <Hourglass />, color: 'amber', on: view === 'waiting', onClick: () => setView('waiting') },
            /* what's finished: today's, then the days before */
            { key: 'done', label: 'Done', count: doneN, icon: <CircleCheckBig />, color: 'teal', on: view === 'done', onClick: () => setView('done') },
          ]}
        />
      }
      /* (a phone keeps its one line over the list — Today there goes by time; the column names sort it on a computer) */
      toolbar={<JobBar picked={picked} onClear={() => setJob('all')} />}
    >
      {/* Who is a column on every list — tap it to give it to someone (the admin); waiting: who it's with */}
      <WhoCol.Provider value={true}>
      <InJob.Provider value={!!picked}>
      <Viewer.Provider value={multi ? null : me}>
      <Multi.Provider value={multi}>
      <WaitView.Provider value={view === 'waiting'}>
      <TodaySort.Provider value={sorter.sort}>
      <div data-even-list data-list-scope="mine" style={todoColsOf(true)}>
        {/* Waiting on others, in one line: only what you're waiting for */}
        {view === 'waiting' && n(view) > 0 && !q && <div className={cn('border-b border-line-2 py-2.5 text-[0.8125rem] leading-snug text-muted', PX)} data-waiting-says>Only what you’re waiting for: things you gave someone or asked for, and things you watch. By whom it’s with.</div>}
        {/* searching: how many match, on this list */}
        {q && <div className={cn('border-b border-line-2 py-2.5 text-[0.8125rem] text-muted', PX)} data-today-found={found}>{found ? `${found} ${found === 1 ? 'to-do matches' : 'to-dos match'} “${q}”` : `Nothing ${view === 'today' ? 'on Today' : view === 'coming' ? 'coming up' : view === 'done' ? 'done' : 'waiting'} matches “${q}”`}</div>}
        {n(view) > 0 && <TodayHead waiting={view === 'waiting'} who sort={sorter.sort} onSort={sorter.toggle} />}
        {/* one person's list — or Everyone: each person's under their own name, never mixed */}
        {multi ? lists.map((l) => <PersonList key={l.key} l={l} view={view} job={job} me={meOf(role)} q={q} />) : parts.map((p) => <PartBlock key={p.key} p={p} me={me} showOwner={view === 'waiting'} />)}
        {n(view) === 0 && !q && <EmptyState icon={<Check />} title={view === 'today' && doneN ? 'All done for today' : empty[view].title} sub={view === 'today' && doneN ? 'New work lands here the moment it’s yours.' : empty[view].sub} />}
        {/* what you finished today: at the end, crossed out */}
        {view === 'today' && !multi && !q && <DoneToday role={lists[0].role} person={lists[0].person} job={job} me={me} onAll={() => setView('done')} />}
      </div>
      </TodaySort.Provider>
      </WaitView.Provider>
      </Multi.Provider>
      </Viewer.Provider>
      </InJob.Provider>
      </WhoCol.Provider>
    </Page>
  )
}

/** a GC item that's really ours to do (a call to make): a plain to-do for its person, due today */
function gcToTodo(id: string) {
  useStore.getState().commit((st) => {
    const x = st.tasks.find((y) => y.id === id)
    if (!x) return
    x.state = 'now'
    x.due = 'Today'
    x.tone = 'info'
    delete x.waitingOn; delete x.needBy; delete x.followUp; delete x.promised
    ;(x.log ||= []).push({ date: NOW, time: clockNow(), who: meOf(st.role), text: 'Made a to-do · ours, not the GC’s' })
  }, 'It’s a to-do now', { sub: 'On their Today, today.' })
}
/** a call (call the GC, ask the client, find out…): what came of it is the point — so Done asks what they said */
export const isCallTask = (t: Pick<Task, 'title' | 'state' | 'waitingOn'>) => t.state !== 'waiting' && /^\s*(call|phone|ring|text|ask|check with|find out|follow up with|reach out to|speak (to|with)|talk to)\b/i.test(t.title)
function CallDone({ t, onDone }: { t: Task; onDone: () => void }) {
  const s = useStore()
  const [said, setSaid] = React.useState('')
  /* no answer: a line in its notes, and it's back on the list tomorrow */
  const noAnswer = () => {
    s.commit((st) => {
      const x = st.tasks.find((y) => y.id === t.id)
      if (!x) return
      x.due = 'Tomorrow'
      ;(x.log ||= []).push({ date: NOW, time: clockNow(), who: meOf(st.role), text: 'Called · no answer', note: true })
    }, 'No answer · back tomorrow', { sub: 'It’s on your list again tomorrow.' })
    onDone()
  }
  return (
    <div data-call-panel>
      <div className="text-[0.9375rem] font-semibold text-ink">What did they say?</div>
      <div className="mb-2 mt-0.5 text-[0.8125rem] text-muted">It goes with it, for {t.by && t.by !== meOf(s.role) ? PEOPLE[t.by]?.short || 'whoever asked' : 'the team'} to read.</div>
      <TextArea autoFocus rows={3} value={said} onChange={(e) => setSaid(e.target.value)} placeholder="e.g. Tile starts Monday. The drain is in." data-call-said />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button className="max-sm:h-12 max-sm:flex-1 max-sm:text-[1rem]" onClick={noAnswer} data-call-noanswer>No answer · tomorrow</Button>
        <Button variant="primary" className="ml-auto max-sm:h-12 max-sm:flex-1 max-sm:text-[1rem]" icon={<Check />} onClick={() => { s.completeTask(t.id, said.trim() || undefined); onDone() }} data-call-save>Done</Button>
      </div>
    </div>
  )
}

function FollowedUp({ t, onDone }: { t: Task; onDone: () => void }) {
  const s = useStore()
  const [note, setNote] = React.useState('')
  const [back, setBack] = React.useState('Tomorrow')
  const save = () => {
    const day = md(isoFromLabel(back) || TOMORROW)
    s.commit((st) => {
      const x = st.tasks.find((y) => y.id === t.id)
      if (!x) return
      x.followUp = day
      x.followUps = (x.followUps || 0) + 1
      ;(x.log ||= []).push({ date: NOW, who: meOf(st.role), text: `Followed up${note.trim() ? ` · ${note.trim()}` : ''} · back ${day}` })
    }, `Followed up · back ${day}`, { tone: 'wait', sub: 'Off the list until then. It isn’t done until it comes.' })
    onDone()
  }
  return (
    <div>
      <div className="text-[0.875rem] font-semibold text-ink">What {t.waitingOn || 'they'} said</div>
      <TextInput className="mt-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. they ship it Wednesday" autoFocus />
      <div className="mt-3 text-[0.875rem] font-semibold text-ink">Back on the list</div>
      <div className="mt-2"><DatePresets value={back} onPick={setBack} presets={['Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon']} /></div>
      <div className="mt-3 flex justify-end"><Button variant="primary" onClick={save}>Save</Button></div>
    </div>
  )
}

/** a thin line where "now" falls among today's times */
function NowLine({ min }: { min: number }) {
  return (
    <div className={cn('relative flex items-center gap-2 border-t border-line-2 py-1', PX)} aria-label="Now">
      <span className="text-[0.6875rem] font-semibold text-brand-600 tnum">Now {timeLabel(min - (min % 5))}</span>
      <span className="h-px flex-1 bg-brand-200" />
    </div>
  )
}

/* ================= one task: what it is, who has it, the one thing to do ================= */
/** where a task came from: what in the flow made it, or who asked for it — and when */
export function taskOrigin(t: Task): string {
  const first = (t.log || [])[0]
  const said = first?.text ? ` · ${first.text.charAt(0).toLowerCase()}${first.text.slice(1)}` : ''
  if (first?.who === 'system') return `Made by Tile OS · ${first.date}${said}`
  if (t.by && PEOPLE[t.by]) return `Asked by ${PEOPLE[t.by].short}${first ? ` · ${first.date}` : ''}`
  if (first && PEOPLE[first.who as PersonKey]) return `Added by ${PEOPLE[first.who as PersonKey].short} · ${first.date}`
  return ''
}
/** someone else's task: remind them — it pops up on their screen — and, when it's late, it counts as checking in. For
 *  whoever reminded, it's off their Today now and back tomorrow if it still isn't done: nothing left to stare at, nothing
 *  lost */
function remindTask(t: Task) {
  const st = useStore.getState()
  const me = meOf(st.role)
  const late = taskBucket(t) === 'overdue' || (t.state === 'waiting' && (isoFromLabel(t.followUp) || '9') < TODAY)
  const mine = t.owner === me
  st.commit((x) => {
    const y = x.tasks.find((z) => z.id === t.id)
    if (!y) return
    y.nudge = { by: me, at: Date.now().toString(36), day: TODAY }
    if (late) y.checkIn = { by: me, day: TODAY }
    if (!mine) y.quiet = { ...(y.quiet || {}), [me]: TOMORROW }
    ;(y.log ||= []).push({ date: NOW, who: me, text: `Reminded ${PEOPLE[y.owner]?.short || ''}` })
  }, `Reminder sent to ${PEOPLE[t.owner]?.short || 'them'}`, { sub: mine ? 'It pops up on their screen, and it’s on their Today.' : 'It pops up on their screen. It’s off your Today. Back tomorrow if it isn’t done.', undo: false })
}
/** off my Today for now: I reminded its person — it's back tomorrow if it isn't done */
export const quietForMe = (t: Task, me: PersonKey | null) => !!me && (t.quiet?.[me] || '') > TODAY

/* ================= one task: the same window as a step — what it is, whose it is, when =================
 * On top (the same as every window): the project, the task, whose it is and when. Under it what it's about and the
 * newest note — every note one tap away. No sentences explaining how it works. At the bottom: yours — Done (or its own
 * button), Not today, Waiting on someone; someone else's — Remind them, Follow it (you hear when it moves, and it waits
 * under Waiting on others until it's done), and the admin can take it over. Changing the task itself is in ··· : its
 * person moves its day; the admin also hands it to someone else, sets who follows it and puts it on everyone's Today. */
export function TaskModal({ id, level, call }: { id: string; level: number; /** a call's circle: "What did they say?" open */ call?: boolean }) {
  const s = useStore()
  const t = s.tasks.find((x) => x.id === id)
  const [waitOpen, setWaitOpen] = React.useState(false)
  const [callOpen, setCallOpen] = React.useState(!!call)
  /* a change from ··· opens in place of the task, with Back to it */
  const [panel, setPanel] = React.useState<null | 'share' | 'answer'>(null)
  /* once what it was opened for is done — finished, waiting on someone, set aside, moved to another day, handed to
     someone else — the window closes by itself (the pop-up says what happened). Taking it over keeps it open: it's
     yours to do now */
  const snap = (x?: Task) => (x ? { st: x.state, owner: x.owner, due: x.due || '' } : null)
  const first = React.useRef(snap(t))
  const top = s.modals.length - 1 === level
  React.useEffect(() => {
    const a = first.current
    const b2 = snap(t)
    if (!a || !top) return
    const handedOn = !!b2 && b2.owner !== a.owner && b2.owner !== meOf(s.role)
    if (b2 && b2.st === a.st && b2.due === a.due && !handedOn) { if (b2.owner !== a.owner) first.current = b2; return }
    const tm = setTimeout(() => useStore.getState().closeLevel(level), 400)
    return () => clearTimeout(tm)
  }, [t?.state, t?.owner, t?.due, top])
  if (!t) return null
  const job = s.jobs[t.jobId]
  const me = meOf(s.role)
  const theirs = t.owner !== me && !isMine(t, s.role)
  const admin = s.role === 'owner' || s.role === 'pm'
  const canDate = t.state === 'now' && (!theirs || admin)
  const from = taskOrigin(t)
  const hasAction = !!t.action && t.state !== 'done' && t.action.kind !== 'open-job'
  const b = taskBucket(t)
  const log = t.log || []
  const owner = PEOPLE[t.owner]?.short || 'They'
  /* what people wrote — not what the app did */
  const notesOnly = log.filter(isNote)
  const when =
    t.state === 'now' ? { text: b === 'overdue' ? (/late/i.test(t.due || '') ? t.due! : `Was due ${t.due}`) : b === 'today' ? 'Due today' : t.due ? `Due ${/^(Tomorrow|This week|Next week|Next Mon|In 2 weeks)$/.test(t.due) ? t.due.charAt(0).toLowerCase() + t.due.slice(1) : t.due}` : 'No date', cls: b === 'overdue' ? 'text-bad-700' : b === 'today' ? 'text-warn-700' : 'text-ink-2' }
      : t.state === 'waiting' ? { text: `Waiting on ${t.waitingOn || 'someone'} · back ${t.followUp}`, cls: 'text-warn-700' }
        : t.state === 'later' ? { text: t.hold ? holdWords(t.laterUntil) : `Set aside · back ${t.laterUntil}`, cls: holdUp(t) ? 'text-warn-700' : 'text-ink-2' }
          : { text: `Done${t.doneAt ? ` ${t.doneAt}` : ''}`, cls: 'text-[#2c8a5b]' }
  /* everything you can do is right there: who, when, watching on top; its words tapped to change them; the bin to
     delete it; the buttons at the bottom. ··· keeps only the two rare ones */
  const items: React.ReactNode[] = [
    /* two can have it — whoever gets to it first */
    /* the admin shares it right in Who ("More than one can do it"); whoever has it, here */
    !admin && (t.owner === me || !!t.also?.includes(me)) && t.state !== 'done' && <MenuItem key="share" icon={<Users className="h-4 w-4" />} onSelect={() => setPanel('share')}>Share it. Whoever gets to it first</MenuItem>,
    admin && t.state !== 'done' && <MenuItem key="all" icon={<Megaphone className="h-4 w-4" />} checked={!!t.everyone} onSelect={() => setEveryone(t.id, !t.everyone)}>On everyone’s Today</MenuItem>,
    /* made as the GC's, but it's ours to do (a call to make): a to-do for its person, today */
    isGcWait(t) && (!theirs || admin) && <MenuItem key="ours" icon={<ListTodo className="h-4 w-4" />} hint="A call or something we do. On their Today, today" onSelect={() => gcToTodo(t.id)} data-gc-to-todo>It’s ours to do, not the GC’s</MenuItem>,
  ].filter(Boolean)
  const people = insidePeople(s).length ? insidePeople(s) : ASSIGNABLE
  const more = items.length > 0 && (
    <Menu align="end" width={260} trigger={<button aria-label="More" title="More" data-task-more className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-wash hover:text-ink"><MoreHorizontal className="h-[1.125rem] w-[1.125rem]" /></button>}>
      {items}
    </Menu>
  )
  /* a task someone added by hand: its words change right here, and the bin takes it off (Undo in the pop-up) */
  const editable = canEditTask(t, me, admin)
  const removable = canRemoveTask(t, me, admin)

  const canMove = !theirs || admin
  /* waiting on the GC: the day it's needed by, tapped to change; what's wrong in red */
  const gcw = isGcWait(t) ? gcState(t) : undefined
  const start = gcw ? startOf(s, job) : undefined
  /* the same lines as every window: When (its day), Status (where it stands — waiting, set aside, done) */
  const followDay = t.state === 'waiting' ? (followDue(t) ? 'Follow up today' : `Follow up ${/^tomorrow$/i.test(t.followUp || '') ? 'tomorrow' : t.followUp || ''}`) : ''
  const whenWords = gcw ? (t.needBy ? `Needed by ${dayShort(t.needBy)}` : 'No day it’s needed by') : t.state === 'now' ? when.text : t.state === 'waiting' ? followDay : t.state === 'later' ? (t.hold ? (t.laterUntil ? holdWords(t.laterUntil).replace(/^On hold until/, 'Until') : 'No day') : `Back ${t.laterUntil}`) : ''
  /* something to bring: who asked for it (and when) is where it stands — On the way once it is */
  const asked = isRequest(t) && t.state === 'now' ? (t.req?.trip === 'onway' ? 'On the way' : t.by ? `Asked by ${t.by === me ? 'you' : PEOPLE[t.by]?.short || 'someone'}${log[0]?.date ? (log[0].date === NOW ? ' today' : ` ${log[0].date}`) : ''}` : undefined) : undefined
  const status = gcw ? <span data-gc-sofar><b className="font-medium">Waiting on the GC</b> · {gcSoFar(t, false)}</span>
    : asked ? <span data-task-asked>{asked}</span>
      /* where it stands, picked right here: To do · On hold · Done (waiting on someone: its button at the bottom) */
      : canMove && t.state !== 'done' ? <TaskStatusPick t={t} />
        : t.state === 'waiting' ? `Waiting on ${t.waitingOn || 'someone'}` : t.state === 'later' ? (t.hold ? 'On hold' : 'Set aside') : t.state === 'done' ? when.text : undefined
  /* what it's about — under its name; a request's "who asked" is its Status, not said twice. Touch-ups: their own
     checklist instead (the same as the project's), not a paragraph */
  const touch = s.punch.filter((p) => p.taskId === t.id)
  /* to-dos about these touch-ups said in words (same project, same person): here, on top — they're not lines of their own */
  const strays = touch.length ? strayTouchups(s, t) : []
  const about = touch.length ? '' : (isRequest(t) ? (t.detail || '').replace(/(^|\s*·\s*)[^·]*\basked for it\s*$/i, '') : t.detail || '').trim()
  const header = (
    <WinHead
      kind={taskKind(t)}
      place={job ? job.name : 'Company'}
      onPlace={job ? () => s.open({ t: 'job', id: job.id }) : undefined}
      where={t.where && t.where.trim() !== job?.name ? t.where : undefined}
      title={cleanTitle(t.title, job)}
      sub={about ? <span data-task-detail>{about}</span> : undefined}
      edit={editable ? { title: t.title, sub: touch.length ? undefined : t.detail, onTitle: (v) => editTask(t.id, { title: v }), onSub: (v) => editTask(t.id, { detail: v }) } : undefined}
      remove={removable ? () => { removeTask(t.id); s.closeLevel(level) } : undefined}
      who={t.owner}
      whoText={<span data-task-owner>{t.also?.length ? `${[t.owner, ...t.also].map((p) => (p === me ? 'You' : PEOPLE[p]?.short || p)).join(' or ')}. Whoever gets to it first` : t.owner === me ? 'You' : owner}</span>}
      whoLabel={t.state === 'done' ? 'Who did it' : 'Who does it'}
      /* who's watching: anyone can watch it; who does it (and the admin) adds others */
      watch={t.state !== 'done' ? { people, me, current: followersOf(t), onToggle: (p) => toggleFollow(t.id, p, true), anyone: !theirs || admin, doers: [t.owner, ...(t.also || [])] } : undefined}
      state={whenWords ? <span data-task-when {...(gcw ? { 'data-gc-needby': t.needBy || '' } : {})}>{whenWords}</span> : undefined}
      tone={gcw ? 'warn' : t.state === 'now' ? (b === 'overdue' ? 'late' : b === 'today' ? 'warn' : undefined) : (t.state === 'waiting' && followDue(t)) || holdUp(t) ? 'warn' : undefined}
      status={status}
      statusTone={gcw || t.state === 'waiting' ? 'warn' : t.state === 'done' ? 'ok' : asked && t.req?.trip === 'onway' ? 'ok' : 'quiet'}
      extra={!gcw && t.repeat ? `${REPEAT_LABEL[t.repeat]}${t.repeatAt ? ` at ${t.repeatAt}` : ''}` : undefined}
      problem={gcw?.flag ? <span data-gc-flag>{gcw.text}</span> : t.blocks && t.state !== 'done' ? `Holds up ${t.blocks.charAt(0).toLowerCase() + t.blocks.slice(1)}` : undefined}
      more={more || undefined}
      /* its star — on top of your list */
      star={t.state !== 'done' ? taskStarPick(s, t, me) : undefined}
      attrs={theirs && t.state !== 'done' ? { 'data-theirs-task': '' } : undefined}
      /* the admin gives it to someone else — or takes it over — right here; its day moves the same way */
      whoPick={admin && t.state !== 'done' ? { people, me, current: t.owner, onPick: (p) => s.reassignTask(t.id, p), also: t.also, onAlso: (p) => toggleAlso(t.id, p, true) } : undefined}
      whenPick={gcw && canMove ? { title: 'Needed by', value: t.needBy ? labelFromIso(t.needBy) : undefined, presets: Array.from(new Set([...(start && start >= TODAY ? [labelFromIso(start)] : []), 'Next Mon', 'In 2 weeks'])), onPick: (d) => setNeedBy(t.id, isoFromLabel(d)) }
        : canDate ? { value: t.due, onPick: (d) => s.setTaskDue(t.id, d), time: t.at, onTime: (v) => setTaskTime(t.id, v), onClear: t.due || t.at ? () => clearTaskWhen(t.id) : undefined }
          : t.state === 'waiting' && canMove ? { title: 'Follow up on', value: t.followUp, presets: ['Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon'], onPick: (d) => setFollowUp(t.id, d) }
            : t.state === 'later' && canMove && !t.hold ? { title: 'Back on', value: t.laterUntil, onPick: (d) => s.laterTask(t.id, d) }
              : t.state === 'later' && canMove && t.hold ? { title: 'On hold until', value: t.laterUntil, presets: HOLD_DAYS, onPick: (d) => s.holdTask(t.id, d), onClear: t.laterUntil ? () => s.holdTask(t.id) : undefined } : undefined}
    />
  )

  /* the buttons at the bottom — together on the right, the main one last (blue); every one a real button */
  const right = <div className="ml-auto" aria-hidden />
  const poRef = poOfTask(t)
  const linkedPo = poRef?.t === 'po' ? s.pos.find((x) => x.id === poRef.id && !/cancelled/i.test(x.note)) : undefined
  const footer = panel === 'answer' ? undefined : panel ? (
    <Button variant="ghost" icon={<ChevronLeft />} onClick={() => setPanel(null)} data-task-back>Back</Button>
  ) : t.state === 'done' ? (
    (!theirs || admin) ? <>{right}<Button icon={<RotateCcw />} onClick={() => s.reopenTask(t.id)} data-reopen-task>Reopen</Button></> : undefined
  ) : theirs ? (
    <>{right}<Button variant="primary" className="max-sm:flex-1" icon={<BellRing />} onClick={() => { remindTask(t); s.close() }} data-remind-task>Remind {owner}</Button></>
  ) : gcw ? (
    <>
      {right}
      <Button icon={<MessageSquareReply />} onClick={() => setPanel('answer')} data-gc-answered>They answered</Button>
      <Button variant="primary" className="max-sm:flex-1" icon={<Send />} onClick={() => { openWhatsApp(gcMessage(s, t)); askedGc(t.id); s.close() }} data-gc-send>{askLabel(t)}</Button>
    </>
  ) : (
    <>
      {right}
      {t.state === 'waiting' && linkedPo && canEmailFollow() ? (
        /* waiting on the store for a PO: follow up by email, right here — on the order's own email */
        <POFollowUp po={linkedPo} onSent={() => s.closeLevel(level)} />
      ) : t.state === 'waiting' ? (
        <Pop open={waitOpen} onOpenChange={setWaitOpen} side="top" width={380} trigger={<Button icon={<Hourglass />} data-followed-up>Followed up, still waiting</Button>}>
          <FollowedUp t={t} onDone={() => { setWaitOpen(false); s.close() }} />
        </Pop>
      ) : t.state !== 'now' ? (
        <Button icon={<RotateCcw />} onClick={() => s.reopenTask(t.id)}>Back on my list</Button>
      ) : !isRequest(t) ? (
        /* you did your part — now it's with someone else: who, and the day it comes back (a little window over the
           button — never another screen) */
        <Pop open={waitOpen} onOpenChange={setWaitOpen} side="top" align="end" width={380} trigger={<Button icon={<Hourglass />} data-task-wait>Waiting on someone</Button>}>
          <WaitPicker defaultWho={t.waitingOn} onSave={(w, bk) => { setWaitOpen(false); s.waitTask(t.id, w, bk); s.close() }} />
        </Pop>
      ) : null}
      {hasAction ? (
        <Button variant="primary" className="max-sm:flex-1" onClick={() => runTaskAction(t)}>{t.action!.label}</Button>
      ) : (
        isRequest(t) && t.owner === meOf(s.role) ? <TripButtons t={t} size="md" onDone={() => s.close()} />
          /* a call: Done asks what they said (it goes to whoever's following it) — or No answer, back tomorrow */
          : isCallTask(t) && t.state === 'now' ? (
            <Pop open={callOpen} onOpenChange={setCallOpen} side="top" align="end" width={380} sheet className="max-sm:px-4 max-sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] max-sm:pt-3" trigger={<Button variant="primary" className="max-sm:flex-1" icon={<Check />} data-task-done data-call-done>Done</Button>}>
              <CallDone t={t} onDone={() => { setCallOpen(false); s.close() }} />
            </Pop>
          )
          : <Button variant="primary" className="max-sm:flex-1" icon={isRequest(t) ? <Truck /> : <Check />} onClick={() => { s.completeTask(t.id); s.close() }} data-task-done>{isRequest(t) ? 'Dropped off' : 'Done'}</Button>
      )}
    </>
  )

  const body = panel === 'answer' ? (
    <GcAnswer t={t} onDone={() => s.close()} onBack={() => setPanel(null)} />
  ) : panel === 'share' ? (
    <div data-task-panel="share">
      <div className="text-[0.9375rem] font-semibold text-ink">Who else can do it</div>
      <div className="mb-3 mt-0.5 text-[0.8125rem] text-muted">It’s on their Today too. Whoever does it first closes it for both.</div>
      <div className="flex flex-wrap gap-1.5">
        {people.filter((p) => p !== t.owner).sort((a, b) => Number(b === me) - Number(a === me)).map((p) => <Chip key={p} on={(t.also || []).includes(p)} onClick={() => toggleAlso(t.id, p)} className="h-9 px-3" icon={<Avatar who={p} size={20} />}>{p === me ? 'Me' : PEOPLE[p]?.short || p}</Chip>)}
      </div>
    </div>
  ) : (
    <>
      {t.state === 'done' && t.result && <p className="flex items-start gap-2 text-[0.875rem] leading-relaxed text-ink" data-task-result><Check className="mt-1 h-4 w-4 shrink-0 text-[#2c8a5b]" />{t.result}</p>}
      {gcw && !theirs && <GcMessageBox t={t} />}
      {/* a to-do about a PO shows the PO itself: what was ordered, from whom — and Open the PO */}
      {poOfTask(t) && <div className="mb-5" data-task-po><LinkedPO t={t} /></div>}
      {/* a to-do about them, said in words: on top, ticked off right here */}
      {strays.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-2xl border border-line bg-white" data-task-strays>
          {strays.map((x) => <StrayLine key={x.id} t={x} />)}
        </div>
      )}
      {/* touch-ups: the checklist itself — tick them right here, change their words, add photos */}
      {touch.length > 0 && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-white [&>[data-touchup]:first-child]:border-t-0" data-task-touchups>
          {/* not decided yet who does them: one tap for all of them (or each one on its own line) */}
          {touch.some((p) => !p.owner && p.status !== 'verified') && t.state !== 'done' && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-2 bg-warn-50/60 px-5 py-2.5 max-sm:px-4" data-touchups-pick>
              <span className="min-w-0 flex-1 text-[0.875rem] text-ink-2">Who does them isn’t decided yet</span>
              <WhoMenu pick={{ people: Array.from(new Set([...CREWS.filter((c) => !isOff(s, 'crew', c)), ...fieldPeople(s, job)])), me, current: undefined, onPick: (k) => setPunchOwner(touch.filter((p) => !p.owner).map((p) => p.id), k) }}
                trigger={<Button size="sm" variant="primary" data-touchups-pick-who>Pick who does them</Button>} />
            </div>
          )}
          {touch.map((p) => <TouchupLine key={p.id} p={p} />)}
        </div>
      )}
      {/* only what people wrote — what the app did (Created, Reminded, Moved…) isn't a note — newest first, right here;
          one quiet box to add one. The same on a step */}
      <Notes kind="task" me={me} notes={notesOnly} onAdd={t.state !== 'done' ? (x) => s.noteTask(t.id, x) : undefined} className={cn(((gcw && !theirs) || (t.state === 'done' && t.result)) && 'mt-5')} />
      {/* when it was made, and by whom — one quiet line; tap it for everything that happened to it */}
      <TaskRecord t={t} me={me} />
    </>
  )

  return (
    /* the same size as every window that opens from a list — a task, a step, waiting on the GC */
    <Modal level={level} size="md" onClose={s.close} inlineClose header={header} footer={footer} title={t.title} bodyClass="px-6 pb-4 pt-3 max-sm:px-4">
      {body}
    </Modal>
  )
}

/** where a to-do stands, picked right on its Status line: To do, On hold, Done. On hold asks until when — that day it's
 *  back on Today, to check in (or no day: until it's taken off hold). Waiting on someone is its button at the bottom */
export const HOLD_DAYS = ['Tomorrow', 'Next Mon', 'In 2 weeks']
function TaskStatusPick({ t }: { t: Task }) {
  const s = useStore()
  const [open, setOpen] = React.useState(false)
  const [until, setUntil] = React.useState(false)
  const word = t.state === 'waiting' ? `Waiting on ${t.waitingOn || 'someone'}` : t.state === 'later' ? (t.hold ? 'On hold' : `Set aside · back ${t.laterUntil}`) : 'To do'
  const hold = (d?: string) => { setOpen(false); s.holdTask(t.id, d) }
  const item = (on: boolean, label: React.ReactNode, onClick: () => void, attrs: Record<string, string>) => (
    <button type="button" role="menuitemradio" aria-checked={on} onClick={onClick} className="flex h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[0.9375rem] text-ink transition hover:bg-wash" {...attrs}>
      <span className="min-w-0 flex-1">{label}</span>{on && <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
    </button>
  )
  return (
    <Pop open={open} onOpenChange={(o) => { setOpen(o); if (!o) setUntil(false) }} align="start" width={until ? 332 : 240} className="p-0" sheet={until}
      trigger={<button type="button" className={cn(CHIP, '-ml-1')} data-task-status-pick={t.hold ? 'hold' : t.state}><span className={cn('text-[0.9375rem]', t.state === 'waiting' ? 'text-warn-700' : t.hold ? 'font-medium text-ink' : 'text-ink')}>{word}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" /></button>}>
      {!until ? (
        <div className="flex flex-col p-1.5" role="menu">
          {item(t.state === 'now', 'To do', () => { setOpen(false); if (t.state !== 'now') s.reopenTask(t.id) }, { 'data-status-now': '' })}
          {item(t.state === 'later' && !!t.hold, <>On hold<span className="text-muted"> · until when?</span></>, () => setUntil(true), { 'data-status-hold': '' })}
          {item(false, 'Done', () => { setOpen(false); s.completeTask(t.id) }, { 'data-status-done': '' })}
        </div>
      ) : (
        /* until when: that day it's back on Today to check in */
        <div data-hold-until>
          <div className="px-4 pb-1 pt-3.5 text-[0.875rem] font-semibold text-ink">On hold until</div>
          <div className="flex flex-wrap gap-1.5 px-4 pb-3 pt-1.5" data-when-presets>
            {HOLD_DAYS.map((p) => <button key={p} type="button" onClick={() => hold(p)} className="inline-flex h-8 items-center rounded-full border border-line bg-white px-3 text-[0.8125rem] font-medium text-ink-2 transition hover:border-[#d1cbc0] hover:bg-wash" data-hold-preset={p}>{p}</button>)}
          </div>
          <div className="border-t border-line-2"><MonthCal value={isoFromLabel(t.laterUntil)} onPick={(iso) => hold(pickedLabel(iso))} className="px-3 pb-3 pt-2.5" /></div>
          <div className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5">
            <span className="min-w-0 flex-1 text-[0.8125rem] text-muted">That day it’s back on your Today.</span>
            <button type="button" onClick={() => hold()} className="shrink-0 rounded-full px-2 py-1 text-[0.8125rem] font-semibold text-muted transition hover:bg-wash hover:text-ink" data-hold-nodate>No day</button>
          </div>
        </div>
      )}
    </Pop>
  )
}

/** the record of a task: "Created Nov 14 by Yakov" — tap it, and everything that happened to it, newest first */
function TaskRecord({ t, me }: { t: Task; me: PersonKey }) {
  const [open, setOpen] = React.useState(false)
  const log = t.log || []
  const first = log[0]
  if (!first) return null
  const who = (w: string) => (w === 'system' ? 'Tile OS' : w === me ? 'you' : PEOPLE[w as PersonKey]?.short || w)
  const by = t.by && PEOPLE[t.by] ? t.by : first.who
  return (
    <div className="mt-5 text-[0.8125rem] text-faint" data-task-record>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="-mx-1 inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:text-ink-2" data-record-toggle>
        <History className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate" data-record-made>Created {first.date}{first.time ? `, ${first.time}` : ''} by {who(by)}</span>
        {log.length > 1 && <><span aria-hidden>·</span><span className="shrink-0 font-medium">{open ? 'Hide' : 'History'}</span></>}
      </button>
      {open && log.length > 1 && (
        <ol className="ml-[0.4375rem] mt-1.5 flex flex-col gap-1 border-l border-line-2 pl-3.5" data-record-list>
          {[...log].reverse().map((l, i) => (
            <li key={i} className="text-muted"><span className="tnum text-faint">{l.date}{l.time ? `, ${l.time}` : ''}</span> · <span className="font-medium text-ink-2">{who(l.who).replace(/^you$/, 'You')}</span> · {l.text}</li>
          ))}
        </ol>
      )}
    </div>
  )
}

/* ================= a new task: type it, pick who and when, done ================= */
const WHEN: [string, string][] = [['Today', 'Today'], ['Tomorrow', 'Tomorrow'], ['Fri', 'Friday'], ['Next Mon', 'Next Monday'], ['In 2 weeks', 'In 2 weeks']]
export const DAY_WORDS: [RegExp, string][] = [[/\btoday\b|\btonight\b/, 'Today'], [/\btomorrow\b/, 'Tomorrow'], [/\bnext week\b/, 'Next Mon'], [/\bmon(day)?\b/, 'Mon'], [/\btue(s|sday)?\b/, 'Tue'], [/\bwed(nesday)?\b/, 'Wed'], [/\bthu(rs|rsday)?\b/, 'Thu'], [/\bfri(day)?\b/, 'Fri']]
/** what kind of task, from the words in it — nobody has to pick */
export function guessType(title: string): TaskType {
  const w = title.toLowerCase()
  if (/\b(pay|paid|invoice|deposit|bill|check|retainage|money)\b/.test(w)) return 'Money'
  if (/\b(order|tile|thinset|grout|deliver|delivery|material|materials|po|mesh|membrane|boxes)\b/.test(w)) return 'Materials'
  if (/\b(estimate|price|pricing|quote|takeoff|bid|proposal)\b/.test(w)) return 'Pricing'
  if (/\b(schedule|book|start date|reschedule|calendar)\b/.test(w)) return 'Schedule'
  if (/\b(change|revision|extra)\b/.test(w)) return 'Changes'
  if (/\b(site|crew|install|punch|touch-?ups?|walkthrough|measure)\b/.test(w)) return 'Field'
  return 'Setup'
}
/** the tasks a tile company makes over and over — they show under the box as you type (or under "Common"). Picking one
 *  only fills in the words: who does it and when stay what you set. Each one shows only to the jobs it fits. */
const COMMON_TASKS: { t: string; for: Role[] }[] = [
  { t: 'Call the GC for the client PO', for: ['owner', 'pm', 'office'] },
  { t: 'Get the tile delivery date from the store', for: ['owner', 'pm', 'office', 'materials'] },
  { t: 'Confirm the installer for the start date', for: ['owner', 'pm', 'office'] },
  { t: 'Ask the designer for the grout color', for: ['owner', 'pm', 'office', 'estimator'] },
  { t: 'Follow up on the change order with the GC', for: ['owner', 'pm', 'office', 'estimator'] },
  { t: 'Order the materials', for: ['owner', 'pm', 'office', 'materials'] },
  { t: 'Check the floor levels on site', for: ['owner', 'pm', 'office', 'site'] },
  { t: 'Walk the job with the installer', for: ['owner', 'pm', 'site'] },
  { t: 'Count the tile boxes when they come', for: ['owner', 'pm', 'site', 'materials'] },
  { t: 'Check the drains are set before tile', for: ['owner', 'pm', 'site'] },
  { t: 'Take progress photos', for: ['owner', 'pm', 'site'] },
  { t: 'Punch walk with the GC', for: ['owner', 'pm', 'site'] },
  { t: 'Make sure the floors are protected', for: ['site'] },
  { t: 'Do the takeoff from the plans', for: ['owner', 'pm', 'office', 'takeoff', 'estimator'] },
  { t: 'Price the change order', for: ['owner', 'pm', 'office', 'estimator'] },
  { t: 'Ask the GC for the finish schedule', for: ['owner', 'pm', 'office', 'takeoff', 'estimator'] },
  { t: 'Send the deposit invoice', for: ['owner', 'office', 'accounting'] },
  { t: 'Call the client about the open invoice', for: ['owner', 'office', 'accounting'] },
]
/** a day typed in the words ("thursday") — its name in the When box */
const DAY_NAME: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', 'Next Mon': 'Next Monday' }
/* A new task, the quickest way there is: type what needs to be done — that's it. Under it, small chips that already
 * say the usual answers: the project (picked by itself when the words name one), who (you — or whoever the words
 * name: "Yaakov measure the backsplash"), when (today — or the day the words say: "tomorrow", "Fri"), and Urgent. Change
 * a chip only when it's wrong; Enter adds it. Whoever gives a task to someone else follows it by itself: it waits under
 * their Waiting on others until it's done. More than one person can have it (More than one person, under who):
 * whoever does it first closes it for all of them. */
/** a person named in what was typed — "Yaakov measure…" → Yaakov (a whole word, first name or full name) */
/* "Yaakov", "Yakov" — the same name spelled two ways: doubled letters count once */
const oneEach = (t: string) => words(t).replace(/([a-z])\1+/g, '$1')
export function personIn(text: string, people: PersonKey[]): PersonKey | undefined {
  const t = oneEach(text)
  return people.find((p) => {
    const n = PEOPLE[p]
    /* the name they go by, or their whole name — "Back office" is a name only as both words */
    const names = [n?.short, n?.name].filter((x): x is string => !!x && x.trim().length >= 3)
    return names.some((x) => t.includes(` ${oneEach(x).trim()} `))
  })
}
export function NewTaskModal({ level, jobId, fromMsg }: { level: number; jobId?: string; /** made from this message on the project: it starts filled in */ fromMsg?: string }) {
  const s = useStore()
  const me = meOf(s.role)
  const msg = fromMsg && jobId ? s.messages[jobId]?.find((x) => x.id === fromMsg) : undefined
  const [title, setTitle] = React.useState(() => (msg ? (msg.text.length > 70 ? msg.text.slice(0, 68).trimEnd() + '…' : msg.text) : ''))
  const [job, setJob] = React.useState<string>(jobId || '')
  /* who does it — one person, or more (whoever gets to it first): the first is the task's owner */
  const [owners, setOwners] = React.useState<PersonKey[]>([me])
  const [several, setSeveral] = React.useState(false)
  const owner = owners[0] || me
  const shared = owners.length > 1
  const [due, setDue] = React.useState('Today')
  /* who's watching — they see it and hear when it moves; given to someone else, you watch it too */
  const [watchers, setWatchers] = React.useState<PersonKey[]>([])
  const [urgent, setUrgent] = React.useState(false)
  const [picked, setPicked] = React.useState(false)
  const [repeat, setRepeat] = React.useState<'' | NonNullable<Task['repeat']>>('')
  const [at, setAt] = React.useState('4 PM')
  const projects = Object.values(s.jobs).filter((j) => !['request', 'estimating', 'proposal', 'followup'].includes(j.stage) || j.id === jobId)
  const [jobPicked, setJobPicked] = React.useState(!!jobId)
  const [heard, setHeard] = React.useState('')
  /* who, from the words — until someone's picked by hand */
  const [whoPicked, setWhoPicked] = React.useState(false)
  const [heardWho, setHeardWho] = React.useState(false)
  const people = insidePeople(s)
  const team = people.length ? people : ASSIGNABLE
  const common = COMMON_TASKS.filter((x) => x.for.includes(s.role)).map((x) => x.t)
  /* "call the GC tomorrow" sets the day, "828 Clyde — …" the project, "Yaakov …" who — by themselves, until you pick */
  const onTitle = (v: string) => {
    setTitle(v)
    if (!jobPicked) {
      const p = projectIn(v, Object.values(s.jobs))
      if (p) { setJob(p.id); setHeard(p.name) } else if (heard) { setJob(''); setHeard('') }
    }
    if (!whoPicked && !several) {
      const p = personIn(v, team.filter((x) => x !== me))
      if (p) { setOwners([p]); setHeardWho(true) } else if (heardWho) { setOwners([me]); setHeardWho(false) }
    }
    if (picked || repeat) return
    const hit = DAY_WORDS.find(([re]) => re.test(v.toLowerCase()))
    if (hit) setDue(hit[1])
  }
  const add = () => {
    if (!title.trim()) return
    const j = s.jobs[job]
    const clean = (j && heard ? withoutProject(title.trim(), j) : title.trim()) || title.trim()
    /* every login it's on — each person's own */
    const fors = Array.from(new Set(owners.flatMap((p) => { const r = s.team.find((m) => m.key === p)?.role; return r ? [r] : ROLE_OF[p] || ['owner'] }))) as Role[]
    /* given to someone else: you follow it — you hear when it's done */
    s.addTask({ jobId: job, title: clean, type: guessType(title), owner, also: shared ? owners.slice(1) : undefined, due: repeat ? 'Today' : due, for: fors, state: 'now', tone: urgent ? 'bad' : 'info', urgent: urgent || undefined, repeat: repeat || undefined, repeatAt: repeat ? at : undefined, where: repeat ? `${REPEAT_LABEL[repeat]} at ${at}` : msg ? 'From a message' : undefined, detail: msg ? `From ${PEOPLE[msg.who]?.name || 'someone'} in the project messages, ${msg.date} ${msg.time}: “${msg.text}”` : undefined, followers: (() => { const f = Array.from(new Set([...(!owners.includes(me) ? [me] : []), ...watchers])).filter((p) => !owners.includes(p)); return f.length ? f : undefined })() })
    if (msg && jobId) markMessageTask(jobId, msg.id)
    s.close()
  }
  /* who: you first, as "Me"; everyone else by their whole name (two can share a first name) */
  const whoOptions = [me, ...team.filter((p) => p !== me)].map((p) => ({ key: p as string, label: p === me ? 'Me' : PEOPLE[p]?.name || p, hint: p === me ? undefined : PEOPLE[p]?.roleLabel, lead: <Avatar who={p} size={20} /> }))
  /* the whole name, as on the list — two people can share a first name (two Yaakovs) */
  const nameOf = (p: PersonKey) => (p === me ? 'Me' : PEOPLE[p]?.name || p)
  /* you first, always — "Me and Yaakov", never "Yaakov and Me" */
  const shownOwners = owners.includes(me) ? [me, ...owners.filter((p) => p !== me)] : owners
  const whoWord = shownOwners.map(nameOf).join(' and ')
  /* when: a day, or every day / week / month (then the time beside it) */
  const days: [string, string][] = [...WHEN, ...(WHEN.some(([k]) => k === due) ? [] : [[due, DAY_NAME[due] || due] as [string, string]])]
  const whenOptions = [...days.map(([k, l]) => ({ key: k, label: l })), ...(Object.keys(REPEAT_LABEL) as NonNullable<Task['repeat']>[]).map((r) => ({ key: 'r:' + r, label: REPEAT_LABEL[r], hint: 'Comes back by itself' }))]
  const whenValue = repeat ? 'r:' + repeat : due
  const whenWord = repeat ? REPEAT_LABEL[repeat] : WHEN.find(([k]) => k === due)?.[1] || DAY_NAME[due] || due
  const pickWhen = (k: string) => { if (k.startsWith('r:')) setRepeat(k.slice(2) as NonNullable<Task['repeat']>); else { setRepeat(''); setDue(k); setPicked(true) } }
  const whoChip = (
    <button type="button" aria-label="Who does it" className={cn(PICK_CHIP, 'h-auto min-h-9 py-1 pl-1.5 text-left', owner !== me && 'text-ink')}>
      <span className="flex shrink-0 gap-0.5">{shownOwners.slice(0, 3).map((p) => <Avatar key={p} who={p} size={22} />)}</span>
      <span className="min-w-0 break-words">{whoWord}</span><ChevronDown className="!h-3.5 !w-3.5 !text-faint" />
    </button>
  )
  return (
    <Modal
      level={level}
      size="sm"
      onClose={s.close}
      title="New task"
      header={<FormHead k="task" title="New task" />}
      bodyClass="px-6 pb-4 pt-3 max-sm:px-4"
      footer={<>
        {/* urgent: on top of their Today, in red */}
        <button type="button" onClick={() => setUrgent(!urgent)} aria-pressed={urgent} data-task-urgent title="On top of their Today, in red, until it’s done" className={cn(PICK_CHIP, 'max-sm:h-11', urgent && '!border-bad-200 !bg-bad-50 !text-bad-700 [&>svg]:!text-bad-600')}>
          <Flag />Urgent
        </button>
        <Button variant="primary" className="ml-auto max-sm:flex-1" disabled={!title.trim()} onClick={add}>{repeat ? 'Add repeating task' : 'Add task'}</Button>
      </>}
    >
      {msg && (
        <div className="mb-3 flex min-w-0 items-start gap-2.5 rounded-xl bg-[#f6f3ee] px-3 py-2.5 text-[0.8125rem]" data-from-msg>
          <Avatar who={msg.who} size={24} />
          <span className="min-w-0 leading-snug"><b className="font-semibold text-ink">{PEOPLE[msg.who]?.name || 'Someone'}</b> <span className="text-muted">· {msg.time}</span><span className="mt-0.5 block text-ink-2">{msg.text}</span></span>
        </div>
      )}
      {/* one box: what needs to be done — the rest is already filled in */}
      <SuggestInput value={title} onChange={onTitle} onEnter={add} suggestions={common} label="What needs to be done?" placeholder="What needs to be done?" listLabel="The usual ones. Tap to pick" className="[&_input]:h-12 [&_input]:text-[1rem]" />
      {/* the usual answers, as chips — change one only when it's wrong */}
      <div className="mt-3 flex flex-wrap items-center gap-2" data-task-chips>
        <ProjectChip value={job} onChange={(k) => { setJob(k); setJobPicked(true); setHeard('') }} keep={(j) => projects.includes(j)} />
        <span className="contents" data-task-who={owners.join(',')}>
          {/* the same Who as on Today and in a task: one person, or the switch under it for more than one */}
          <WhoMenu
            pick={{
              people: team, me, current: owner, also: owners.slice(1),
              onPick: (p) => { setWhoPicked(true); setOwners((os) => [p, ...os.slice(1).filter((x) => x !== p)]) },
              onAlso: (p) => { setWhoPicked(true); setOwners((os) => (os.includes(p) ? os.filter((x) => x !== p) : [...os, p])) },
            }}
            trigger={whoChip}
          />
        </span>
        <span className="contents" data-task-when={whenValue}>
          <SearchSelect label="When" value={whenValue} options={whenOptions} onChange={pickWhen} search={false} width={280} trigger={<button type="button" aria-label="When" className={cn(PICK_CHIP, (due !== 'Today' || repeat) && 'text-ink')}><CalendarDays /><span className="min-w-0 truncate">{whenWord}</span><ChevronDown className="!h-3.5 !w-3.5 !text-faint" /></button>} />
          {repeat && <SearchSelect label="At" value={at} options={['8 AM', 'Noon', '4 PM', '6 PM'].map((x) => ({ key: x, label: `at ${x}` }))} onChange={setAt} search={false} width={160} trigger={<button type="button" aria-label="At" className={PICK_CHIP}><Clock3 /><span>at {at}</span><ChevronDown className="!h-3.5 !w-3.5 !text-faint" /></button>} />}
        </span>
        {/* who's watching — they don't do it, they see it and hear when it moves (the same order as in a task: who
            does it, when, who's watching) */}
        <span className="contents" data-task-watch={watchers.join(',')}>
          <MultiSelect label="Who’s watching" values={watchers} options={whoOptions.filter((o) => !owners.includes(o.key as PersonKey))} onChange={(ks) => setWatchers(ks as PersonKey[])} width={340} trigger={
            <button type="button" aria-label="Who’s watching" className={cn(PICK_CHIP, 'pl-1.5', watchers.length && 'text-ink')}>
              {watchers.length ? <span className="flex gap-0.5">{watchers.slice(0, 3).map((p) => <Avatar key={p} who={p} size={22} />)}</span> : <Eye />}
              <span className="min-w-0 truncate">{watchers.length ? `Watching: ${watchers.map((p) => (p === me ? 'Me' : PEOPLE[p]?.short || p)).join(', ')}` : 'Who’s watching'}</span><ChevronDown className="!h-3.5 !w-3.5 !text-faint" />
            </button>
          } />
        </span>
      </div>
    </Modal>
  )
}

/** the crew list pops up by itself for the site manager: after 3 in the afternoon, the next work day's (the first time
 *  he opens the app or comes back to it); in the morning, today's — only if last night's wasn't sent. Once each
 *  (Later: it waits at the top of his Today) — before the day's other pop-up */
export function CrewWatcher() {
  React.useEffect(() => {
    let quiet = false
    try { quiet = !!navigator.webdriver && !localStorage.getItem('tileos-crew-test') } catch { /* fine */ }
    if (quiet) return
    const check = () => {
      const s = useStore.getState()
      if (s.role !== 'site' || s.modals.length || !crewReportOn(s)) return
      const day = crewDay()
      if (crewSentFor(s, day) || !crewsOn(s, day).length) return
      const key = `tileos-crew-asked:${REAL.email || 'preview'}:${meOf('site')}`
      const slot = `${day}:${day === TODAY_ISO ? 'am' : 'pm'}`
      try { if (localStorage.getItem(key) === slot) return; localStorage.setItem(key, slot) } catch { return }
      s.open({ t: 'crewreport', auto: true, day })
    }
    const t = setTimeout(check, 1200)
    const off = useStore.subscribe((st, prev) => { if (st.role !== prev.role) setTimeout(check, 800) })
    /* back in the app (or left open past 3): the evening one comes up then too */
    const back = () => { if (document.visibilityState === 'visible') setTimeout(check, 800) }
    document.addEventListener('visibilitychange', back)
    const every = setInterval(check, 10 * 60 * 1000)
    return () => { clearTimeout(t); off(); document.removeEventListener('visibilitychange', back); clearInterval(every) }
  }, [])
  return null
}

/* ================= the morning crew report (site manager → the office) =================
 * First thing every work day it pops up on the site manager's phone: every project that should have a crew today,
 * with the installer and how many people were there last time filled in. He changes what's different — fewer people,
 * nobody there (0), a crew somewhere else (Another project) — and taps Send. It goes to the office. */
export function CrewReportModal({ taskId, level, day: day0 }: { taskId?: string; level: number; day?: string }) {
  const s = useStore()
  const small = useSmall()
  /* who gets it: the people it's emailed to (Settings → Automations → Crew list) — only those with an email, the same
     ones the email counts — else it stays in the app, for the office */
  const meK = meOf(s.role)
  const mailed = s.rules.crewMail?.off ? [] : crewMailPeople(s).filter((p) => !!s.team.find((m) => m.key === p)?.email).sort((a, b) => (a === meK ? -1 : b === meK ? 1 : 0))
  const nm = (p: PersonKey) => (p === meK ? 'you' : PEOPLE[p]?.short || p)
  const goesTo = mailed.length > 3 ? `It’s emailed to ${mailed.slice(0, 2).map(nm).join(', ')} and ${mailed.length - 2} more`
    : mailed.length ? `It’s emailed to ${mailed.length === 1 ? nm(mailed[0]) : `${mailed.slice(0, -1).map(nm).join(', ')} and ${nm(mailed[mailed.length - 1])}`}`
    : `It goes to ${PEOPLE[meOf('owner')]?.short || 'the office'}`
  /* the day it's for: the one it was opened for, else today's until 3 and the next work day's after */
  const [day] = React.useState(() => day0 || crewDay())
  const today = day === TODAY_ISO
  /* filled in: that day's booking, else what was planned for it, else the last report — 2 when nothing's known */
  const [rows, setRows] = React.useState(() => crewsOn(s, day).map((c) => { const j = s.jobs[c.jobId]; const fix = (c as { fix?: string[] }).fix; return { jobId: c.jobId, crew: c.crew as PersonKey, workers: c.workers ?? (j?.crewPlan?.day === day ? j.crewPlan.workers : undefined) ?? j?.onSite?.workers ?? 2, note: fix?.length ? `Touch-ups: ${fix.join('; ')}` : '' } })
    /* by crew, the same order as the email: each crew's jobs together */
    .sort((a, b) => (PEOPLE[a.crew]?.name || '~').localeCompare(PEOPLE[b.crew]?.name || '~') || (s.jobs[a.jobId]?.name || '').localeCompare(s.jobs[b.jobId]?.name || '')))
  const [adding, setAdding] = React.useState(false)
  const [addJob, setAddJob] = React.useState('')
  /* before it goes: the email itself, as everyone will get it — Back to change a number, Send */
  const [look, setLook] = React.useState(false)
  const mail = look ? crewMailWords(s, rows, day) : null
  const people = rows.reduce((n, r) => n + r.workers, 0)
  const on = rows.filter((r) => r.workers > 0).length
  const set = (i: number, p: Partial<(typeof rows)[number]>) => setRows((x) => x.map((r, k) => (k === i ? { ...r, ...p } : r)))
  const crews = CREWS.filter((c) => PEOPLE[c])
  const add = (jobId: string) => {
    const j = s.jobs[jobId]
    if (!j || rows.some((r) => r.jobId === jobId)) { setAdding(false); setAddJob(''); return }
    setRows((x) => [...x, { jobId, crew: ((j.crew || crews[0]) as PersonKey), workers: 2, note: '' }])
    setAdding(false); setAddJob('')
  }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={`Where the crews are ${crewWhen(day)}`}
      inlineClose
      header={<ListHead kind={{ icon: <HardHat />, label: 'Crew list' }} title={`Where the crews are ${crewWhen(day)}`} sub={`How many people on each project. ${goesTo}.`} who={meOf(s.role)} me={meOf(s.role)} when={dayShort(day)} attrs={{ 'data-crew-head': '' }} />}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted max-sm:hidden">{on} {on === 1 ? 'project' : 'projects'} · {people} {people === 1 ? 'person' : 'people'}</span>
          {look
            ? <Button className="ml-auto" variant="ghost" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setLook(false)} data-crew-back>Back</Button>
            : <Button className="ml-auto max-sm:hidden" variant="ghost" onClick={s.close}>Later</Button>}
          {look
            ? <Button variant="primary" className={cn(small && 'h-12 flex-1 text-[1rem]')} disabled={!rows.length} icon={<Send className="h-4 w-4" />} onClick={() => { sendCrewReport(taskId, rows, day); s.close() }} data-crew-send>Send it</Button>
            : <Button variant="primary" className={cn(small && 'h-12 flex-1 text-[1rem]')} disabled={!rows.length} onClick={() => setLook(true)} data-crew-preview>{small ? `See it · ${people} ${people === 1 ? 'person' : 'people'}` : 'See it before it goes'}</Button>}
        </>
      }
    >
      {look && mail ? (
        <div className="-mx-6 -my-5 max-sm:-mx-4" data-crew-look>
          <div className="border-b border-line-2 bg-wash px-6 py-2.5 text-[0.8125rem] text-muted max-sm:px-4">{crewMailTo(s).length ? <>Emailed to {crewMailTo(s).length} {crewMailTo(s).length === 1 ? 'person' : 'people'} · </> : null}<b className="font-semibold text-ink">{mail.subject}</b></div>
          <div className="px-6 py-4 max-sm:px-4 [&_img]:max-w-[110px]" dangerouslySetInnerHTML={{ __html: mail.html.split(`${PUBLISHED}/`).join('/') }} />
        </div>
      ) : (
      <div className="-mx-6 -my-5 max-sm:-mx-4" data-crew-report>
        {rows.map((r, i) => {
          const j = s.jobs[r.jobId]
          return (
            <div key={r.jobId} className={cn('flex items-center gap-3 border-b border-line-2 px-6 py-3.5 max-sm:flex-wrap max-sm:px-4', r.workers === 0 && 'bg-wash/60')} data-crew-job={r.jobId}>
              <Avatar who={r.crew} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.9375rem] font-semibold text-ink">{j?.name}</div>
                <div className={cn('text-[0.8125rem]', r.workers === 0 ? 'font-medium text-warn-700' : 'text-muted')}>{r.workers === 0 ? (today ? 'Nobody there today' : 'Nobody there') : `${PEOPLE[r.crew]?.name || 'No installer yet'}`}</div>
                {r.note && <div className="break-words text-[0.78125rem] leading-snug text-muted" data-crew-note>{r.note}</div>}
              </div>
              <div className={cn(small && 'w-full')}><Stepper big={small} value={r.workers} onChange={(n) => set(i, { workers: n })} min={0} max={30} suffix={small ? (r.workers === 1 ? 'person' : 'people') : undefined} /></div>
            </div>
          )
        })}
        {!rows.length && !adding && <div className="px-6 py-8 text-center text-[0.875rem] text-muted max-sm:px-4">No project has a crew {today ? 'today' : crewWhen(day) === 'tomorrow' ? 'tomorrow' : `on ${crewWhen(day)}`}.</div>}
        {/* a crew on a project that isn't here */}
        <div className="px-6 py-3 max-sm:px-4">
          {adding ? (
            <div className="flex flex-col gap-2">
              <ProjectField value={addJob} onChange={(id) => { if (id) add(id); else setAddJob('') }} keep={(x) => !['request', 'estimating', 'proposal', 'followup', 'complete'].includes(x.stage) && !rows.some((r) => r.jobId === x.id)} />
              <button type="button" onClick={() => setAdding(false)} className="self-start text-[0.84375rem] font-semibold text-muted">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex h-10 items-center gap-1.5 text-[0.875rem] font-semibold text-brand-700" data-crew-add><Plus className="h-4 w-4" />Another project</button>
          )}
        </div>
      </div>
      )}
    </Modal>
  )
}
