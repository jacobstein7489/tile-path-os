/* Today — your day, in the order it happens. What's late first, then the day hour by hour (meetings at their time),
 * then what can be done any time. Tomorrow and Later are the same, a day at a time. Every row: when · what ·
 * project · the one button. Checklist steps that are your turn show up by themselves — that's the hand-off.
 * Mine / Everyone switches between your list and the whole team's. */
import * as React from 'react'
import { create } from 'zustand'
import { Sparkles, History, Send, MessageSquareReply, CalendarRange, Check, Flag, Plus, Repeat, Clock3, MoonStar, RotateCcw, Ban, Building2, CalendarDays, UserRound, HardHat, ListTodo, Hourglass, CircleCheckBig, Eye, Users, Megaphone, UserPlus, FileText, ClipboardList, Package, ArrowLeftRight, Receipt, ListChecks, HandCoins, ChevronRight, ChevronDown, ChevronLeft, Search, X, ListPlus, Truck, UserRoundCheck, Gauge, BellRing, MoreHorizontal, ArrowRight, MessageSquare, MapPinned, Trash2, PackageCheck } from 'lucide-react'
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
import { todoOf, remindStep } from './stepwin'
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
import { WinHead, ListHead, WhoMenu, WhenPop, WatchPop, CHIP, KindTag, TIMES, clock, WIN_ROW, WIN_ROW_GRID, type WinKind, type WatchPick, type WhenPick, type WhoPick } from './winhead'
import { offerNotify } from '@/tileos/lib/notify'
import { latestOf, markTaskSeen, type Latest } from './latest'
import { namesOf } from './estpeople'
import { useSmall } from '@/tileos/lib/phone'
import { mapsTo } from '@/tileos/lib/route'
import { roundsToday, roundsOn, roundsSkipped, skipRounds } from './rounds'
/** a phone: a switch takes its share of the width, its buttons split it evenly — one line; a very narrow phone (or big
 *  text) gives each switch its own line rather than cut a word */
import { isGc, isGcWait, isQuestion, toldGc, gcState, gcSoFar, gcWaits, gcWords, gcMessage, askLabel, askedGc, setNeedBy, openWhatsApp, startOf, GcMessageBox, GcAnswer } from './gcwait'
import { TouchupLine, StrayLine } from './touchups'
import { holdWords } from './common'
import { tagOfTask, todosOf, touchupsWords, strayTouchups, TOUCH_WORDS } from './todokinds'
import { nextOf, doneWord, isCall, isOrder } from './nextstep'
import { OrderedPanel, NotYetPanel, cameIn } from './ordered'
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
/** in progress: the same projects Projects counts there (being installed, not on hold, not a repair) */
export const inProgressJob = (j: Job) => j.stage === 'installation' && !j.hold && j.kind !== 'repair'
/** the crew list: every project in progress, whatever its calendar says (working today, most likely working tomorrow).
 *  The touch-ups and what's on hold go along in the email, with nothing to fill in; another project can be added */
export const crewsOn = (s: Store, day: string): { jobId: string; crew: string; booked: boolean }[] =>
  Object.values(s.jobs).filter(inProgressJob).map((j) => {
    const bk = s.bookings.filter((b) => b.jobId === j.id && b.label !== 'Return visit')
    const that = bk.find((b) => b.start <= day && b.end >= day)
    const last = [...bk].sort((a, b) => b.start.localeCompare(a.start))[0]
    const crew = (that?.crew || j.crew || last?.crew || (s.prep[j.id]?.installer !== 'tbd' ? s.prep[j.id]?.installer : undefined) || '') as string
    return { jobId: j.id, crew, booked: !!that }
  })
/** how many people a job starts with on the crew list: what was sent for that day already (opened again), else the
 *  last number sent for that job (so only what's different gets changed) — never a made-up number: 0 when it isn't known */
export const crewStart = (s: Store, jobId: string, day: string): number => {
  const j = s.jobs[jobId]
  if (j?.crewPlan?.day === day) return j.crewPlan.workers
  if (j?.onSite?.day === day) return j.onSite.workers
  const last = [j?.onSite, j?.crewPlan].filter((x): x is NonNullable<typeof x> => !!x && x.day < day).sort((a, b) => b.day.localeCompare(a.day))[0]
  return last?.workers ?? 0
}
/** the crew list's lines, as the window and the email start them */
export const crewLines = (s: Store, day: string) => crewsOn(s, day).map((c) => ({ jobId: c.jobId, crew: c.crew as PersonKey, workers: crewStart(s, c.jobId, day), note: '' }))
export const crewsToday = (s: Store) => workingOn(s, TODAY_ISO)
/** in for that day: every project on it has its people — sent the night before, or that morning */
export const crewSentFor = (s: Store, day: string) => { const l = crewsOn(s, day); return l.length > 0 && l.every((c) => { const j = s.jobs[c.jobId]; return j?.onSite?.day === day || j?.crewPlan?.day === day }) }
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
 *  a name on top of each: Project · To do · Who · Latest · When · its button. Who only on lists that have it (and from
 *  1024 wide); Latest (new, seen, updated) from 1280 wide — a smaller screen has it in each one's window. Who's watching
 *  is in each one's window, not on the line. The button is the real next step (Called, Ordered, Send, Remind). */
const COLS_MD = 'minmax(0,0.8fr) minmax(0,1.7fr) 6rem 8.25rem'
export const todoList = (_who?: boolean, _inJob?: boolean) => COLS_MD
export const todoListLg = (who?: boolean) => (who ? 'minmax(0,0.75fr) minmax(0,1.7fr) 5.75rem 6rem 8.25rem' : COLS_MD)
export const todoListXl = (who?: boolean) => (who ? 'minmax(0,0.7fr) minmax(0,1.75fr) 5.75rem 8.25rem 6rem 8.25rem' : 'minmax(0,0.7fr) minmax(0,1.75fr) 8.25rem 6rem 8.25rem')
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
  /* names only — no circles next to them (saying it twice); two people on one line: "You, Yaakov" */
  const names = ks.length ? ks.map((p) => (p === me ? 'You' : PEOPLE[p]?.short || p)) : []
  return (
    <span className="flex min-w-0 items-center gap-2" {...(ks.length ? { 'data-row-doer': ks.join(',') } : { 'data-row-turn-name': turn.name || '' })} data-row-turn>
      {/* the list's own person's stays quiet; someone else's name stands out */}
      <span className={cn('min-w-0 break-words text-[0.8125rem] leading-tight', ks.length === 1 && ks[0] === viewer ? 'text-muted' : 'font-medium text-ink')} title={ks.length ? namesOf(ks, me, true) : undefined}>{ks.length ? (names.length <= 2 ? names.join(', ') : `${names[0]} +${names.length - 1}`) : turn.name}</span>
      {children}
    </span>
  )
}
/** who's watching: their circles, side by side (more than three: +N) */
function WatchDots({ who, eye, size = 20 }: { who: PersonKey[]; eye?: boolean; size?: number }) {
  if (!who.length) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1" title={`Watching: ${who.map((p) => PEOPLE[p]?.name || p).join(', ')}`} aria-label={`Watching: ${who.map((p) => PEOPLE[p]?.name || p).join(', ')}`} data-row-watch={who.join(',')}>
      {eye && <Eye className="h-3.5 w-3.5 text-faint" />}
      <span className="flex gap-0.5">{who.slice(0, 3).map((p) => <Avatar key={p} who={p} size={size} />)}</span>
      {who.length > 3 && <span className="text-[0.75rem] font-medium tnum text-muted">+{who.length - 3}</span>}
    </span>
  )
}
/** the names on top of Today's columns — the same row as Estimates' and Projects' (tap one to sort by it): To do ·
 *  When · Who · its button. The same widths as the cells on each line, so they line up */
export function TodayHead({ waiting, sort, onSort }: { /** Waiting on others: Who is who it's with */ waiting?: boolean; /** sorted by a column: tap its name */ sort?: Sort; onSort?: (k: string) => void }) {
  const who = React.useContext(WhoCol)
  const h = (k: string, label: string, right?: boolean, kind?: SortCol['kind']) => (onSort ? <SortHead k={k} sort={sort || null} onSort={onSort} right={right} kind={kind}>{label}</SortHead> : label)
  return (
    <div className={cn(HEAD_ROW, 'flex gap-3 px-5', STICKY_HEAD, 'max-md:hidden')} data-list-head data-subrow>
      <span className="min-w-0 flex-1">{h('todo', 'To do')}</span>
      <span className="flex w-[7.5rem] shrink-0 justify-end" data-head-when>{h('when', 'When', true, 'date')}</span>
      {who && <span className="flex w-[3.75rem] shrink-0 justify-center" data-head-turn>{h('who', waiting ? 'With' : 'Who')}</span>}
      <span className="w-[7.75rem] shrink-0" aria-hidden data-head-next />
    </div>
  )
}
/** Today sorted by a column — inside each part; the list's own order (and the line for now) when nothing's picked */
const TodaySort = React.createContext<Sort>(null)
export const TODAY_SORT: SortCol[] = [{ k: 'project', label: 'Project' }, { k: 'todo', label: 'To do' }, { k: 'who', label: 'Who' }, { k: 'when', label: 'When', kind: 'date' }]

/** a cell's own button on a computer: tap it to change it right there — the row itself still opens the thing */
const CELL_BTN = '-mx-2 inline-flex max-w-[calc(100%+1rem)] min-w-0 items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-wash-2 focus-visible:bg-wash-2 focus-visible:outline-none'
const stop = (e: React.SyntheticEvent) => e.stopPropagation()
/** the card a line is in — its address on top (a line in it doesn't say it again) and whether it's the card's first
 *  line. A sorted list is one card with no address on top: each line says its own */
const InCard = React.createContext<{ label: string; first: boolean } | null>(null)
/** a line on Today: a dot when it's new to you · what to do (a small gray line under it: when, seen, updated) · on a
 *  computer when, who (circles) and its next step, each the same width on every line so they line up down the page;
 *  a phone: when and who in the small line, its button at the end. Every button the same size: a soft pill */
function TodoRow({ when, whenTone, title, detail, project, projectId, action: own, onClick, done, leaving, owner, also, watch, flag, turn, phoneWhen = true, watchPick, whenPick, whoPick, star, kind, latest, forOthers, remind, rowId }: {
  /** the to-do it is (a to-do's line) */
  rowId?: string
  when?: React.ReactNode; whenTone?: 'bad' | 'warn' | 'strong' | 'quiet'; icon?: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; project?: string
  /** its next step, as a button: Called, Ordered, Send, Remind… (none: the line itself opens it) */
  action?: React.ReactNode; onClick?: () => void; done?: boolean; leaving?: boolean; owner?: PersonKey
  /** the one project it's about (its card's address opens it) */
  projectId?: string
  /** what kind of thing it is — only a problem and a meeting say so, before the words */
  kind?: string
  /** shared — whoever gets to it first: the others who can do it */
  also?: PersonKey[]
  /** a word in red before it — "Problem" */
  flag?: string
  /** who's watching it: their circles after an eye, in the small line under it */
  watch?: PersonKey[]
  /** whose turn it is, when it isn't whoever does it — waiting: the one it waits on (Alex, the GC) */
  turn?: Turn
  /** a computer: When and Who are tapped right on the line to change them */
  watchPick?: WatchPick
  whenPick?: WhenPick
  whoPick?: WhoPick
  /** a phone shows the when too (false: only a computer) */
  phoneWhen?: boolean
  /** its star — the ones that matter to you go on top of your list (only on your own list) */
  star?: StarPick
  /** what's happened with it lately: new to you, not seen yet, seen, updated, how old */
  latest?: Latest | null
  /** the admin looking at someone else's list: the button there is this (Remind them) — not their own next step */
  forOthers?: React.ReactNode
  /** a line with no reminder of its own (the crew list, the daily updates…): on someone else's list, Remind sends them
   *  this — to their phone and their Messages */
  remind?: { what: string; open?: { t: string; [k: string]: any }; jobId?: string }
}) {
  const who = React.useContext(WhoCol)
  const card = React.useContext(InCard)
  const me = meOf(useStore((x) => x.role))
  const w = when === 'Anytime' ? '' : when
  const whenCls = whenTone === 'bad' ? 'font-medium text-bad-600' : whenTone === 'warn' ? 'font-medium text-warn-700' : whenTone === 'strong' ? 'text-ink-2' : 'text-muted'
  /* whose turn: whoever does it (a line that doesn't say — a meeting, the crew list — is the list's own person's; on
     several lists, whose list it's on), or, waiting, the one it waits on */
  const viewer = React.useContext(Viewer) || me
  const multi = React.useContext(Multi)
  /* someone else's list (the admin looking): Remind them where it can — never their own button pressed for them */
  const remindBtn = remind && !forOthers && !done ? <Button size="sm" className={TBTN} onClick={() => remindLine(viewer, remind.what, remind.open, remind.jobId)} data-row-act="remind">Remind</Button> : undefined
  const action = !multi && viewer !== me ? forOthers || remindBtn : own
  const onLists = React.useContext(LineOn)
  const sharers = owner ? [owner, ...(also || []).filter((p) => p !== owner)] : multi && onLists ? onLists : []
  /* Who is who does it — the same as its window says. Only on Waiting on others is it who it's with (Alex, the GC) */
  const waitView = React.useContext(WaitView)
  const waitTurn = waitView ? turn : undefined
  const t0: Turn = waitTurn || { keys: sharers.length ? sharers : [viewer] }
  const turnKeys = t0.keys || []
  const watchers = (watch || []).filter((p) => !sharers.includes(p) && !turnKeys.includes(p))
  /* the line is just the list's own person's (yours, or the one whose list the admin is looking at): no circle — the
     list is theirs. Shared, someone else's, who it waits on: their circles */
  const justYou = !t0.name && turnKeys.length === 1 && turnKeys[0] === viewer && !multi
  const doers = turnKeys.includes(me) ? [me, ...turnKeys.filter((p) => p !== me)] : turnKeys
  const names = turnKeys.length ? namesOf(turnKeys, me, true) : t0.name || ''
  const circles = justYou ? null : (
    /* whole circles side by side, never one over another: two at most, a third and more as "+2" */
    <span className="flex shrink-0 items-center gap-0.5" title={names} aria-label={names} data-row-people {...(turnKeys.length ? { 'data-row-doer': turnKeys.join(',') } : { 'data-row-turn-name': t0.name || '' })} data-row-turn>
      {turnKeys.length
        ? <>
            {(doers.length > 2 ? doers.slice(0, 1) : doers).map((p) => <Avatar key={p} who={p} size={24} />)}
            {doers.length > 2 && <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-wash-2 px-1 text-[0.6875rem] font-semibold text-muted tnum" data-row-more>+{doers.length - 1}</span>}
          </>
        : t0.name ? <NameDot name={t0.name} /> : null}
    </span>
  )
  /* in a card its address is the card's; a line says its own only when it's another (in the Company card: "3 job
     sites"), and on a sorted list, where every line says its own */
  const company = project === 'Company'
  const where = project || ''
  const ownWhere = !!where && !company && where !== card?.label
  /* the star is yours: on your own list only — not on someone else's you're looking at */
  const ownList = viewer === me && !multi
  /* no tags: the words say what it is. Only a few get a word before them — a problem and something urgent (red: they
     come first), a meeting (its words don't always say it's one) and something for everyone */
  const part = React.useContext(PartOf)
  const problem = flag === 'Problem' || kind === 'Problem'
  const urgent = !problem && flag === 'Urgent' && part !== 'urgent'
  const before = problem ? 'Problem' : urgent ? 'Urgent' : kind === 'Meeting' || kind === 'Walkthrough' || (kind === 'For everyone' && part !== 'pinned') ? kind : ''
  const isNew = latest?.tone === 'new'
  /* on the line only what matters at a glance: new to you, or not seen yet (on someone else's list) */
  const seenOrNew = latest && (latest.tone === 'new' || latest.tone === 'warn') ? latest : null
  const tip = typeof detail === 'string' && detail ? detail : ''
  const whereLine = ownWhere ? (
    projectId && !done
      ? <button type="button" onClick={(e) => { e.stopPropagation(); useStore.getState().open({ t: 'job', id: projectId }) }} className="rounded-sm text-left font-semibold text-ink-2 hover:underline" data-row-project-link={projectId}>{where}</button>
      : <span className="font-semibold text-ink-2">{where}</span>
  ) : null
  const whenEl = w ? <span className={cn('text-right text-[0.8125rem] tnum', whenCls)} data-todo-when>{w}</span> : null
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      /* a click in a cell's little list (Who, When — it opens over the page) or on its button isn't a click on the line:
         only a click on the line itself opens it */
      onClick={onClick ? (e) => { if ((e.currentTarget as HTMLElement).contains(e.target as Node)) onClick() } : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onClick() } : undefined}
      /* pointing at it says what's happened with it (created, updated) — it isn't on the line */
      title={[tip, latest && !seenOrNew ? latest.text : ''].filter(Boolean).join(' · ') || undefined}
      data-todo
      data-todo-id={rowId}
      {...(card && !card.first ? { 'data-same-project': '' } : {})}
      /* a line between every two, the same as Estimates' and Projects' lists */
      /* one line, the height of an Estimates line (what's happened with it — created, updated — is in its window) */
      className={cn('group/row relative flex min-h-[3rem] items-center gap-3 border-t border-line-2 px-5 py-1 transition-colors focus-visible:outline-none max-sm:gap-2.5 max-sm:px-4 max-sm:py-3', onClick && 'cursor-pointer row-hover', leaving && 'row-out')}
      data-starred={star?.on && ownList ? '' : undefined}
    >
      {/* its star, in the margin at the left — nothing on the line moves */}
      {star && ownList && !done && <RowStar star={star} />}
      {/* new to you: a blue dot in the margin, like an unread email — the words stay lined up with the address */}
      {isNew && <span className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-brand-600 max-sm:left-1.5" aria-hidden data-row-dot="new" />}
      {done && <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok-50 text-ok-600 [&_svg]:h-3 [&_svg]:w-3"><Check strokeWidth={3} /></span>}
      <div className="min-w-0 flex-1">
        {whereLine && <div className="mb-0.5 min-w-0 break-words text-[0.8125rem] leading-5" data-row-where>{whereLine}</div>}
        {/* what to do — whole, never cut off (a long one takes a second line); on a computer who's watching sits at the
            end of the same line (tap the circles to add or take someone off), so the line stays one line */}
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn('min-w-0 flex-1 break-words text-[0.9375rem] leading-[1.375rem] max-sm:text-[1rem]', done ? 'text-muted line-through decoration-faint' : 'text-ink')} data-row-title>
            {before && <span className={problem || urgent ? 'font-medium text-bad-600' : 'text-muted'} data-row-before={before}>{before} · </span>}
            {title}
          </div>
          {watchers.length > 0 && <span className="shrink-0 max-md:hidden">{watchPick
            ? <WatchPop pick={watchPick} trigger={<button type="button" onClick={stop} className="-mx-1 inline-flex items-center rounded-md px-1 py-0.5 transition hover:bg-wash-2 focus-visible:bg-wash-2 focus-visible:outline-none" aria-label="Who’s watching. Add or take off" data-row-watch-pick><WatchDots who={watchers} eye size={18} /></button>} />
            : <WatchDots who={watchers} eye size={18} />}</span>}
        </div>
        {/* the small line under it, only when there's something to see: (a phone) when and who · what's new — "New from
            Yaakov" (blue), "Not seen yet" (amber). Created and updated are in its window */}
        {((w && phoneWhen) || seenOrNew || circles) && (
          <div className={cn('mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] leading-5', !seenOrNew && 'md:hidden', !(w && phoneWhen) && !seenOrNew && !circles && 'max-md:hidden')} data-row-meta>
            {w && phoneWhen && <span className={cn('tnum md:hidden', whenCls)} data-todo-when-phone>{w}</span>}
            {seenOrNew && <span title={seenOrNew.tip} className={cn('font-medium', seenOrNew.tone === 'new' ? 'text-brand-700' : 'text-warn-700')} data-row-latest={seenOrNew.tone || ''}>{w && phoneWhen ? <span className="font-normal text-faint md:hidden" aria-hidden>· </span> : null}{seenOrNew.text}</span>}
            {circles && <span className="md:hidden">{circles}</span>}
          </div>
        )}
      </div>
      {/* a computer: when · who · its next step — the same widths on every line */}
      <div className="flex w-[7.5rem] shrink-0 items-center justify-end max-md:hidden" onClick={whenPick ? stop : undefined} data-todo-when-cell>
        {whenPick ? (
          <WhenPop pick={whenPick} trigger={
            <button type="button" onClick={stop} className={cn(CELL_BTN, '-mr-2 justify-end', !w && 'text-faint opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100')} aria-label="When · move it" data-row-when-pick>
              {whenEl || <CalendarDays className="h-3.5 w-3.5" />}
            </button>
          } />
        ) : whenEl}
      </div>
      {who && (
        <div className="flex w-[3.75rem] shrink-0 items-center justify-center max-md:hidden" data-row-who>
          {/* the admin can still give it to someone: a faint person shows when the line is pointed at */}
          {whoPick && !waitTurn ? <WhoMenu pick={whoPick} trigger={<button type="button" onClick={stop} className={cn(CELL_BTN, 'justify-center px-1', justYou && 'opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100')} aria-label="Who does it · change it" data-row-who-pick>{circles || <UserRound className="h-4 w-4 text-faint" />}</button>} /> : circles}
        </div>
      )}
      {/* its next step — a soft pill, the same size on every line; none: the line opens it (a quiet arrow says so) */}
      <div className={cn('flex shrink-0 items-center justify-end [&_button]:h-8 max-md:[&_button]:h-9 [&_button]:w-full [&_button]:rounded-full [&_button]:border-0 [&_button]:bg-[#f1ede6] [&_button]:px-2 [&_button]:text-[0.8125rem] [&_button]:font-semibold [&_button]:text-ink [&_button]:shadow-none [&_button:hover]:bg-[#e7e1d6] max-sm:[&_button]:h-10 max-sm:[&_button]:text-[0.875rem]', action ? 'w-[7.75rem] max-sm:w-[7rem]' : 'w-[7.75rem] max-md:hidden')} onClick={action ? stop : undefined} data-todo-next data-reveal={action && !leaving ? '' : undefined}>
        {action || (onClick ? <ChevronRight className="h-4 w-4 text-faint opacity-0 transition group-hover/row:opacity-100" aria-hidden /> : null)}
      </div>
    </div>
  )
}

/** "4 PM", "10:30 AM" — the hour a thing happens */
const hourLabel = (min: number) => timeLabel(min).replace(/^(\d+) /, '$1:00 ')
function taskTime(t: Task): number | null { return t.at ? parseTime(t.at) : t.repeatAt ? parseTime(t.repeatAt) : null }

/* ---------------- a line's button: the real next step, in its own word ---------------- */
/* read from the to-do's words wherever the verb is (features/nextstep): "…tom order missing tiles" → Ordered */
/** something to order or buy, still to do: Ordered asks how it gets there and the day — then it's followed until it's there */
export const isOrderTask = (t: Pick<Task, 'title' | 'state' | 'coming'>) => (t.state === 'now' || (t.state === 'waiting' && !t.coming)) && isOrder(t.title)
/** any other to-do: the word for having done it (Sent, Fixed, Picked up…) — else Done */
export const doneWordOf = (title: string) => doneWord(title)
export const callWordOf = (title: string) => (isCall(title) ? doneWord(title) : 'Called')
/** a step's own button, short enough for the line's button (the whole words in its window) */
const SHORT_ACTION: Record<string, string> = { 'Set the meeting': 'Set meeting', 'Chase or reorder': 'Chase it', 'Send the report': 'Send report', 'Order materials': 'Order', 'Decide the setup': 'Decide', 'Send updates': 'Send updates', 'Enter heights': 'Enter heights', 'Send revised quantities': 'Send', 'Fixed. Check it again': 'Check again', 'The PO came · file it': 'File the PO', 'Print the room sheets': 'Print sheets', 'Enter the high and low': 'Enter heights', 'Report what’s short': 'Report short', 'Open the project': 'Open project', 'Start walkthrough': 'Walkthrough', 'Record follow-up': 'Followed up', 'Add the estimate': 'Add estimate', 'Add to next bill': 'Add to bill' }
/** a step's "open…" button that is really its next step, said as one */
const OPEN_AS: Record<string, string> = { 'Open it': 'Chase it', 'Open the first': 'Chase it', 'Open scope': 'Fill in scope' }
/** a step's own button for the line — none when it only opens something (the line itself does that) */
export const lineAction = (l?: string) => (l && OPEN_AS[l] ? OPEN_AS[l] : l && !/^open\b/i.test(l.trim()) ? shortAction(l) : undefined)
export const shortAction = (l: string) => SHORT_ACTION[l] || (l.length <= 13 ? l : l.split(' ')[0])

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
  const detail0 = t.req && !done ? `${t.req.trip === 'onway' ? 'On the way' : 'Asked'}${t.by ? ` by ${PEOPLE[t.by]?.short || ''}` : ''}${t.owner !== meOf(s.role) ? ` · ${PEOPLE[t.owner]?.short || 'someone'} brings it` : ''}` : t.state === 'waiting' ? (t.coming ? `Coming from ${t.waitingOn}` : `Waiting on ${t.waitingOn}`) : t.blocks && !done ? `Holds up ${t.blocks.charAt(0).toLowerCase() + t.blocks.slice(1)}` : last?.text || t.where || t.detail
  const detail = followed ? <><Eye className="mr-1 inline h-3.5 w-3.5 align-[-0.125rem] text-brand-600" />{detail0 ? `You follow · ${detail0}` : 'You follow'}</> : detail0
  /* shared — two can do it, whoever gets to it first: the row has both their circles (no names in words) */
  const gcw = isGcWait(t) ? gcState(t) : undefined
  const me0 = meOf(s.role)
  const admin = s.role === 'owner' || s.role === 'pm'
  const team = insidePeople(s).length ? insidePeople(s) : ASSIGNABLE
  /* time to follow up: When says since when (the button says what to do) */
  const fu = t.followUp ? isoFromLabel(t.followUp) : undefined
  const followWhen = fu && fu < TODAY ? { text: lateBy(fu), tone: 'bad' as const } : { text: 'Today', tone: 'warn' as const }
  const w = when || (gcw ? (follow && gcw.tone !== 'bad' ? followWhen : { text: gcw.text, tone: gcw.tone === 'bad' ? 'bad' as const : gcw.tone === 'warn' ? 'warn' as const : undefined }) : undefined) || (t.state === 'waiting' ? (follow ? followWhen : { text: /^tomorrow$/i.test(t.followUp || '') ? 'Tomorrow' : `${t.coming ? 'Coming' : 'Back'} ${t.followUp}`, tone: undefined }) : t.state === 'done' ? { text: t.doneAt ? (t.doneAt === 'Just now' ? 'Today' : t.doneAt) : 'Done', tone: 'quiet' as const } : t.state === 'later' ? (t.hold ? { text: holdWords(t.laterUntil), tone: holdUp(t) ? 'warn' as const : undefined } : { text: `Back ${t.laterUntil}` }) : { text: 'Anytime', tone: 'quiet' as const })
  /* touch-ups: the checklist, how far along — "1 of 4 done" (tap it: the four) */
  const touch = s.punch.filter((p) => p.taskId === t.id)
  const noOne = touch.filter((p) => !p.owner && p.status !== 'verified').length
  const touchWords = !touch.length ? '' : noOne ? `Pick who does ${noOne === 1 ? 'it' : 'them'} · ${noOne} ${noOne === 1 ? 'touch-up' : 'touch-ups'}` : touchupsWords(touch)
  /* its next step, in its own word: a call → Called (what did they say?), an order → Ordered (who brings it, when —
     then it waits for it), waiting → Follow up, someone else's → Remind them; anything else → the word for doing it */
  /* one tap is one: a quick second tap on the same spot never does it twice */
  const once = React.useRef(false)
  const rowAct =
        /* done: nothing to press (its window has Reopen) — so a second tap right after Done can't undo it */
        done ? undefined
        /* someone else's: remind them (pinned for everyone: only the admin reminds its person — for the rest it's to know) */
        : theirs ? (t.state === 'now' && !isRequest(t) && (!t.everyone || admin) ? <Button size="sm" className={TBTN} onClick={() => remindTask(t)} data-row-act="remind">Remind</Button> : undefined)
          /* its day came: ordered and on its way → Came in?; waiting on someone → Follow up */
          : follow ? <Button size="sm" className={TBTN} onClick={() => s.open({ t: 'task', id: t.id, follow: true })} data-row-act={t.coming ? 'came' : 'follow'}>{t.coming ? 'Came in?' : isGcWait(t) ? askLabel(t) : 'Follow up'}</Button>
          : stepTask ? undefined
          : act && lineAction(t.action!.label) ? <Button size="sm" className={TBTN} onClick={() => runTaskAction(t)} data-row-act="own">{lineAction(t.action!.label)}</Button>
            : isRequest(t) && t.state === 'now' ? (t.owner === me0 ? <TripButtons t={t} onDone={() => setLeaving(true)} /> : undefined)
            : t.state === 'now' && isCallTask(t) ? <Button size="sm" className={TBTN} onClick={() => s.open({ t: 'task', id: t.id, call: true })} data-row-act="call">{callWordOf(t.title)}</Button>
            : t.state === 'now' && isOrderTask(t) ? <Button size="sm" className={TBTN} onClick={() => s.open({ t: 'task', id: t.id, ordered: true })} data-row-act="ordered">{doneWordOf(t.title)}</Button>
            : t.state === 'now' && !touch.length ? <Button size="sm" className={TBTN} onClick={() => { if (once.current) return; once.current = true; setLeaving(true); setTimeout(() => s.completeTask(t.id), 220) }} data-row-act="done">{doneWordOf(t.title)}</Button>
              : touch.length ? <Button size="sm" className={TBTN} onClick={() => s.open({ t: 'task', id: t.id })} data-row-act="list">Open list</Button>
              : undefined
  return (
    <TodoRow
      rowId={t.id}
      kind={tagOfTask(s, t)}
      flag={t.urgent && !done ? 'Urgent' : undefined}
      leaving={leaving}
      done={done || leaving}
      /* every row opens its window — the same window every time; what happens next is its button at the bottom */
      onClick={() => s.open({ t: 'task', id: t.id })}
      icon={t.everyone ? <Megaphone /> : t.repeat ? <Repeat /> : <Ic />}
      title={touch.length ? <TouchWords lead={touchWords} items={touch} /> : cleanTitle(t.title, job)}
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
      when={w.text}
      whenTone={w.tone}
      latest={done ? null : latestOf(t, me0)}
      forOthers={rowAct}
      action={rowAct}
    />
  )
}

const stepWord = (v: StepView) => lineAction(v.action?.label) || (v.state === 'bad' ? 'Fix it' : v.state === 'now' ? 'Start' : undefined)
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
      /* its next step in its own word — a step with none: Start (a problem: Fix it); its window has the rest */
      action={stepWord(v) ? <Button size="sm" className={TBTN} onClick={() => s.open({ t: 'step', jobId: job.id, k: v.key })} data-row-act="step">{stepWord(v)}</Button> : undefined}
      forOthers={v.owner !== meOf(s.role) ? <Button size="sm" className={TBTN} onClick={() => remindStep(job, v)} data-row-act="remind">Remind</Button> : undefined}
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
      remind={{ what: `Send the daily update · ${job.name}`, open: { t: 'daily', jobId: d.jobId }, jobId: d.jobId }}
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
  const items = (l.open.length ? l.open : ts).map((t) => t.title.replace(/\.$/, ''))
  const open = () => s.open({ t: 'todos', jobId: job?.id, who })
  const late = overdue ? lateBy(x.iso) : ''
  return (
    <TodoRow
      kind="To do"
      onClick={open}
      /* one thing — a checklist: how many first, then what they are, lighter, so you read them right here (and how many
         are done, once some are) */
      title={<span data-todos-words><span className="font-medium text-ink" data-todos-count>{items.length} {items.length === 1 ? 'to-do' : 'to-dos'}</span><span className="ml-2 text-muted" data-todos-items>{items.join(', ')}</span>{done > 0 && <span className="text-faint"> · {done} done</span>}</span>}
      detail={ts.map((t) => t.title).join(' · ')}
      owner={who}
      project={job?.name || 'Company'}
      projectId={job?.id}
      /* like every other line for today: nothing in When unless it's late (another day: its date) */
      when={late || (x.b === 'today' ? undefined : x.iso ? md(x.iso) : 'Anytime')}
      whenTone={late ? 'bad' : 'quiet'}
      action={<Button size="sm" className={TBTN} onClick={open} data-todos-open>Open list</Button>}
      remind={{ what: `${ts.map((t) => t.title.replace(/\.$/, '')).join(' · ')}${job ? ` · ${job.name}` : ''}`, open: { t: 'todos', jobId: job?.id, who }, jobId: job?.id }}
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
      projectId={jobs.length === 1 ? jobs[0] : undefined}
      when={missed ? `${missed} late` : undefined}
      whenTone={missed ? 'bad' : undefined}
      action={<Button size="sm" className={TBTN} onClick={open} data-dailies-open>Send updates</Button>}
      remind={{ what: `Send the daily updates · ${jobs.length} ${jobs.length === 1 ? 'project' : 'projects'}`, open: { t: 'dailies', who: x.who, jobs } }}
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
      projectId={new Set(vs.map((y) => y.job.id)).size === 1 ? vs[0].job.id : undefined}
      when={x.b === 'overdue' && x.iso ? md(x.iso) : undefined}
      whenTone={x.b === 'overdue' ? 'bad' : undefined}
      action={<Button size="sm" className={TBTN} onClick={open}>Open list</Button>}
      remind={{ what: `${vs[0] ? todoOf(vs[0].v) : 'Getting ready'} · ${vs.length} ${vs.length === 1 ? 'project' : 'projects'}`, open: { t: 'stepbatch', k: vs[0]?.v.key, jobs: vs.map((y) => y.job.id) } }}
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
      projectId={one?.id}
      when={x.b === 'overdue' && x.iso ? md(x.iso) : undefined}
      whenTone={x.b === 'overdue' ? 'bad' : undefined}
      action={<Button size="sm" className={TBTN} onClick={open} data-trips-open>Pickup list</Button>}
      remind={{ what: `Bring to the ${jobs.length > 1 ? 'jobs' : 'job'}: ${ts.map((t) => t.req?.what || t.title.replace(/^Bring to [^:]+:\s*/i, '')).join(', ')}`, open: { t: 'trips', who: x.who, day: isNow(x.b) ? 'now' : x.b }, jobId: one?.id }}
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
      projectId={(() => { const ids = [...new Set(g.items.map((c) => c.x.t?.jobId || c.x.job?.id || ''))]; return ids.length === 1 && ids[0] ? ids[0] : undefined })()}
      when={`${n} late`}
      whenTone="bad"
      action={<Button size="sm" className={TBTN} onClick={open} data-checkin-open>Check in</Button>}
      remind={{ what: `Check in with ${PEOPLE[g.who]?.short || 'them'}`, open: { t: 'checkin', who: g.who } }}
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
  /* its time: the evening (Settings → Automations → Crew list), or first thing for today's */
  const at = day === TODAY_ISO ? 7 * 60 : crewHour(s) * 60
  return (
    <TodoRow
      kind="Crew list"
      onClick={go}
      icon={<HardHat />}
      when={timeLabel(at)}
      whenTone="strong"
      title={`Send ${whose} crew list`}
      detail={`${n} ${n === 1 ? 'project' : 'projects'}. How many people on each`}
      project={n ? projectsWord(s, crewsOn(s, day).map((c) => c.jobId)) : 'Company'}
      action={<Button size="sm" className={TBTN} onClick={go} data-crew-row>Send</Button>}
      remind={{ what: `Send ${whose} crew list`, open: { t: 'crewreport', day } }}
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
      action={<Button size="sm" className={TBTN} onClick={go} data-rounds-row>{r.done ? 'Keep going' : 'Start'}</Button>}
      remind={{ what: 'Visit the jobs', open: { t: 'rounds' } }}
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
      title={`Installer pay · week of ${PAY_WEEKS[0].label.replace(/ /g, '\u00a0')}`}
      detail={`${off.length ? `${off.length} bill doesn’t match · ` : ''}${open.length} installers · ${fmtMoney(total)} · from the daily updates`}
      project="All projects"
      when="Anytime"
      whenTone="quiet"
      action={<Button size="sm" className={TBTN} onClick={go}>Review</Button>}
      remind={{ what: `Installer pay · week of ${PAY_WEEKS[0].label}`, open: { t: 'payweek' } }}
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
        latest={latestOf(t, me)}
        /* its next step: ask the GC (the message, on WhatsApp) — someone else's: remind them */
        action={t.owner === me ? <Button size="sm" className={TBTN} onClick={() => { openWhatsApp(gcMessage(s, t)); askedGc(t.id) }} data-row-act="gc">{askLabel(t)}</Button> : <Button size="sm" className={TBTN} onClick={() => remindTask(t)} data-row-act="remind">Remind</Button>}
        forOthers={t.owner !== me ? <Button size="sm" className={TBTN} onClick={() => remindTask(t)} data-row-act="remind">Remind</Button> : undefined}
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
const APP_DID = /^(\d+ touch-ups? logged|Created|Marked done$|Ordered\b|Bought\b|Reminded |Told |Needed by |No date it’s needed by|Moved to |Checked in with |Done\b|Reopened|Back to needs action|Back on |Handed (from|to) |Waiting on |Not here yet|Pinned to|Unpinned from|Repeats|Set up to repeat|Due |Emailed to |Sent (to|back to) |Asked for |Brought in from|Accepted|Logged as a problem|Set aside|Taken over|Took it over|Followed up$|Shared with|Now for |Time: |No set time$)|(follows it( now)?|stopped following|is watching it( now)?|stopped watching| can do it too| taken off it)$/
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
      title={`Progress billing · week of ${LAST_WEEK.label.replace(/ /g, '\u00a0')}`}
      detail={`${rows.length} ${rows.length === 1 ? 'project' : 'projects'} · ${fmtMoney(total)} to bill · from the daily updates`}
      project={projectsWord(s, rows.map((r) => r.jobId))}
      when="Anytime"
      whenTone="quiet"
      action={<Button size="sm" className={TBTN} onClick={go}>Bill</Button>}
      remind={{ what: `Progress billing · week of ${LAST_WEEK.label}` }}
    />
  )
}

function MeetingRow({ e, showOwner }: { e: CalEvent; showOwner?: boolean }) {
  const s = useStore()
  const job = e.jobId ? s.jobs[e.jobId] : undefined
  const open = () => s.open({ t: 'event', id: e.id })
  const me = meOf(s.role)
  const admin = s.role === 'owner' || s.role === 'pm'
  /* its next step: the day of it, until it ends: the way there (its address); after it (or a day ahead): what was
     said or decided — its window, notes on top and Done at the bottom */
  const where = e.where || job?.address
  const d = new Date()
  const over = e.date < TODAY || (e.date === TODAY && d.getHours() * 60 + d.getMinutes() >= e.start + (e.dur || 60))
  const act = e.date === TODAY && !over && where
    ? <Button size="sm" className={TBTN} onClick={() => window.open(mapsTo(where), '_blank', 'noopener')} data-row-act="directions">Directions</Button>
    : <Button size="sm" className={TBTN} onClick={() => s.open({ t: 'event', id: e.id, notes: true })} data-row-act="notes">Add notes</Button>
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
      action={act}
      forOthers={act}
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
    /* plain to-dos: each its own line — the project's band keeps them together, and every to-do opens the same window
       (who, when, status, who's watching, notes); folded into one "5 to-dos" line they opened a different one */
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
  return sortPlate(out)
}

/** a touch-ups line: how far along first ("5 to fix"), then each one with its number (the same order and numbers as in
 *  its window) — what's still to fix (all fixed: what's to check), four of them and how many more — so it reads as a
 *  list, not one long sentence. Each one stays whole (it goes on to the next line as one). A phone: how far along only
 *  (the line's too narrow for a list — Open list has them) */
function TouchWords({ lead, items }: { lead: string; items: { id: string; text: string; status: string }[] }) {
  const small = useSmall()
  const shown = small ? 0 : 4
  const open = items.filter((p) => p.status === 'open')
  const list = open.length ? open : items.filter((p) => p.status === 'verify')
  return (
    <span data-touch-words>
      <span className="mr-1 font-medium text-ink" data-touch-lead>{lead}</span>
      {list.slice(0, shown).map((p, i) => (
        <span key={p.id} className="ml-3 inline-block max-w-full text-muted" data-touch-item>
          <span className="mr-1.5 inline-flex h-[1.0625rem] min-w-[1.0625rem] -translate-y-px items-center justify-center rounded-full bg-[#eeece7] px-1 align-middle text-[0.6875rem] font-semibold leading-none tnum text-ink-2" aria-hidden>{i + 1}</span>{p.text.replace(/\.$/, '')}
        </span>
      ))}
      {shown > 0 && list.length > shown && <span className="ml-3 whitespace-nowrap text-faint" data-touch-more>+{list.length - shown} more</span>}
    </span>
  )
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
/** the one project a line is about — none (several projects, or the company's own): the Company card */
function projectKeyOf(l: Line): string {
  if (l.k === 'wait') return l.job.id
  if (l.k === 'task' || l.k === 'gc') return l.t.jobId || 'company'
  const x = l.x
  /* a check-in about one project's things goes in that project's card too */
  const ci = x.ci?.items.map((c) => c.x.t?.jobId || c.x.job?.id || '') || []
  const one = x.t?.jobId || x.job?.id || x.d?.jobId || x.e?.jobId || (x.ts?.length && x.ts.every((t) => t.jobId === x.ts![0].jobId) ? x.ts[0].jobId : '') || (ci.length && ci.every((j) => j && j === ci[0]) ? ci[0] : '')
  return one || 'company'
}
/** each project's lines in one card — the address once, on top, everything for it inside; what isn't one job's (the crew
 *  list, visiting the jobs, installer pay) in the Company card. The card with something late first (each card where
 *  its most pressing line is); inside it, its lines in their order */
function cardsOf(lines: Line[]): { key: string; lines: Line[] }[] {
  const order: string[] = []
  const groups = new Map<string, Line[]>()
  lines.forEach((l) => { const k = projectKeyOf(l); if (!groups.has(k)) { groups.set(k, []); order.push(k) } groups.get(k)!.push(l) })
  return order.map((key) => ({ key, lines: groups.get(key)! }))
}
/** on the page, the groups' bands are the size of Projects' and Estimates' — but gray: an address (a day, a person) isn't
 *  a status, so it has no color (Projects' and Estimates' colors say the status). They scroll with the list — groups of
 *  one or two lines pinned on top only piled up. In a window they're small */
const BigBands = React.createContext(false)
/** the band itself: its classes, its name's classes — the page's or a window's */
function useBandLook() {
  const big = React.useContext(BigBands)
  return big
    ? { box: cn('flex min-h-10 items-center gap-2 border-t border-line bg-[#f6f6f4] py-1.5', PX), name: 'min-w-0 break-words text-left text-[0.875rem] font-bold uppercase leading-5 tracking-[0.06em] text-[#4c5361]' }
    : { box: cn('flex min-h-8 items-center gap-2 border-t border-line bg-[#f6f6f4] py-1', PX), name: 'min-w-0 break-words text-left text-[0.71875rem] font-semibold uppercase leading-4 tracking-[0.07em] text-[#4c5361]' }
}
/** one project's lines in the list: its address as the group's band — light gray, small capitals, how many (the same
 *  band as Estimates' and Projects' groups); tap it: the project — then its lines, a line between each */
function ProjectCard({ id, label, n, children }: { id?: string; label: string; n: number; children: React.ReactNode }) {
  const s = useStore()
  const look = useBandLook()
  /* the whole address, never cut off — a long one takes a second line in its band */
  return (
    <section data-project-card={id || 'company'}>
      <header className={look.box} data-card-head data-band>
        {id
          ? <button type="button" onClick={() => s.open({ t: 'job', id })} className={cn(look.name, 'rounded-sm underline-offset-[0.1875rem] hover:underline')} data-card-label data-card-open={id}>{label}</button>
          : <span className={look.name} data-card-label>{label}</span>}
        {n > 1 && <span className="shrink-0 text-[0.75rem] font-medium leading-none tnum text-faint" data-card-count>{n}</span>}
      </header>
      {children}
    </section>
  )
}
/** a list's lines: each project's under its address (Today) — or, under a day or a person (Coming up, Waiting, Done)
 *  and on a list sorted by a column, each line says its own project (once for a run of the same project's lines) */
function Lines({ lines: lines0, me, showOwner, on, byProject }: { lines: Line[]; me: PersonKey; day?: string; showOwner?: boolean; on?: Record<string, PersonKey[]>; byProject?: boolean }) {
  const sort = React.useContext(TodaySort)
  const s = useStore()
  const row = (l: Line, card: { label: string; first: boolean }) => (
    <InCard.Provider key={l.key} value={card}><LineOn.Provider value={on?.[l.key] || null}><Safe name={`Today line ${l.key}`}><LineRow l={l} me={me} showOwner={showOwner} /></Safe></LineOn.Provider></InCard.Provider>
  )
  if (sort || !byProject) {
    /* in the picked order — or each project's lines together — the project said on the first of each run */
    const lines = sort ? sortLines(s, lines0, sort) : cardsOf(lines0).flatMap((c) => c.lines)
    let prev = ''
    return (
      <section data-runs={sort ? 'sorted' : ''}>
        {lines.map((l) => {
          const k = projectKeyOf(l)
          const same = k === prev
          prev = k
          return row(l, { label: same ? s.jobs[k]?.name || 'Company' : '', first: !same })
        })}
      </section>
    )
  }
  return (
    <div data-cards>
      {cardsOf(lines0).map((c) => {
        const job = s.jobs[c.key]
        const label = job?.name || 'Company'
        return <ProjectCard key={c.key} id={job?.id} label={label} n={c.lines.length}>{c.lines.map((l, i) => row(l, { label, first: i === 0 }))}</ProjectCard>
      })}
    </div>
  )
}
/** which part of the list a line is in — a line in Urgent or For everyone doesn't say it again before its words */
const PartOf = React.createContext('')
/** a part of a list: its name and how many in its band (the same band as Estimates' groups), then its lines. Today's
 *  day has no band (the box on top says it): its projects' addresses are the bands — what's starred, for everyone or
 *  urgent in their own groups above them, what has no day below */
function PartBlock({ p, me, showOwner, lateLink = true, byProject }: { p: Part; me: PersonKey; showOwner?: boolean; lateLink?: boolean; byProject?: boolean }) {
  const s = useStore()
  const look = useBandLook()
  return (
    <PartOf.Provider value={p.key}>
    <section data-day={p.day || p.key} data-part={p.key}>
      {p.label && !byProject && (
        <div className={look.box} data-group-head data-band data-group-tone={p.tone || 'neutral'}>
          <h2 className={look.name}>{p.label}</h2>
          <BandCount n={p.lines.length} />
          {p.lateLink && lateLink && <button onClick={() => s.open({ t: 'late' })} data-late-open className="ml-auto inline-flex items-center text-[0.75rem] font-medium text-muted hover:text-ink">Move or remind<ChevronRight className="ml-0.5 h-3.5 w-3.5" /></button>}
        </div>
      )}
      <Lines lines={p.lines} me={me} day={p.day} showOwner={showOwner} on={p.on} byProject={byProject} />
    </section>
    </PartOf.Provider>
  )
}
/** a list inside a window (someone's list on Team report, what's on nobody's): the same bands and lines, in a box */
function ListBox({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-xl border border-line bg-white"><div className="-mt-px">{children}</div></div>
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
        <div className="px-6 pb-4 max-sm:px-4" data-their-cards>
          <ListBox>{parts.map((p) => <PartBlock key={p.key} p={p} me={who} lateLink={false} byProject={p.key === 'today'} />)}</ListBox>
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
      <div className="pb-2" data-nobody-cards>
        {countOf(parts) > 0 && <ListBox>{parts.map((p) => <PartBlock key={p.key} p={p} me={meOf(s.role)} lateLink={false} byProject={p.key === 'today'} />)}</ListBox>}
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
      <button type="button" aria-label="Whose list · pick" className={cn('inline-flex h-9 min-w-0 max-w-[18rem] items-center md:shrink-0 gap-2 rounded-[0.625rem] border px-3 text-[0.875rem] max-md:gap-1.5 max-md:px-2.5 transition-colors [&_svg]:h-4 [&_svg]:w-4', words !== 'Mine' ? 'border-brand-300 bg-brand-50 font-semibold text-brand-700' : 'border-[#d9d3c9] bg-white text-ink-2 shadow-xs hover:bg-wash')} data-today-who>
        {/* (a phone: the words alone, so All jobs, Mine, the search and Sort fit one line on a small phone) */}
        {one && one !== me ? <Avatar who={one} size={20} /> : !one ? <Users className="shrink-0 text-brand-600 max-md:hidden" /> : <UserRound className="shrink-0 text-faint max-md:hidden" />}
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
      {/* whose list: their circle and name, over their lines — a heading of its own, bigger than the bands under it */}
      <div className={cn('flex min-h-[3.25rem] items-center gap-2.5 border-t border-line bg-white py-2', PX)} data-person-band>
        <Avatar who={l.key} size={26} />
        <b className="min-w-0 truncate text-[1rem] font-semibold tracking-[-0.01em] text-ink">{l.key === me ? 'You' : PEOPLE[l.key]?.name || l.key}</b>
        <span className="text-[0.875rem] font-semibold text-faint tnum" data-person-count>{n}</span>
      </div>
      <Viewer.Provider value={l.key}>
        <Multi.Provider value={false}>
          <ShowNow.Provider value={false}>
            {parts.map((p) => <PartBlock key={p.key} p={p} me={l.key} showOwner={view === 'waiting'} lateLink={l.key === me} byProject={view === 'today' && p.key === 'today'} />)}
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
        className={cn('inline-flex h-9 min-w-0 max-w-[22rem] items-center md:shrink-0 gap-2 rounded-[0.625rem] border px-3 text-[0.875rem] max-md:gap-1.5 max-md:px-2.5 transition-colors [&_svg]:h-4 [&_svg]:w-4', picked ? 'border-brand-300 bg-brand-50 font-semibold text-brand-700' : 'border-[#d9d3c9] bg-white text-ink-2 shadow-xs hover:bg-wash')} data-job-pick>
        <Building2 className={cn('shrink-0 max-md:hidden', picked ? 'text-brand-600' : 'text-faint')} />
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
export const useTodayFind = create<{ q: string; set: (q: string) => void; /** a phone: the search open in the line */ open: boolean; setOpen: (v: boolean) => void }>((set) => ({ q: '', set: (q) => set({ q }), open: false, setOpen: (open) => set({ open }) }))
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
/** the search, in the same line as All jobs and Mine — a computer's a box at the end of the line; a phone's a button
 *  there that opens the box across the line (Cancel closes it). Nothing on the list matches: Search everything */
function FindBox() {
  const q = useTodayFind((x) => x.q)
  const set = useTodayFind((x) => x.set)
  const open = useTodayFind((x) => x.open)
  const setOpen = useTodayFind((x) => x.setOpen)
  const small = useSmall()
  if (small) {
    if (!open) return <button type="button" onClick={() => setOpen(true)} aria-label="Search to-dos" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] border border-[#d9d3c9] bg-white text-ink-2 shadow-xs" data-today-find-open><Search className="h-[1.125rem] w-[1.125rem]" /></button>
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2" data-today-find>
        <label className="relative block min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input {...NO_SUGGEST} autoFocus value={q} onChange={(e) => set(e.target.value)} placeholder="Search to-dos" aria-label="Search to-dos" className="h-10 w-full rounded-[0.625rem] border border-[#d9d3c9] bg-white pl-9 pr-3 text-ink outline-none placeholder:text-faint focus:border-brand-300 focus:ring-[0.1875rem] focus:ring-brand-50" data-today-find-input />
        </label>
        <button type="button" onClick={() => { set(''); setOpen(false) }} className="shrink-0 px-1 text-[0.9375rem] font-semibold text-brand-700" data-today-find-cancel>Cancel</button>
      </div>
    )
  }
  return (
    <label className="relative block w-[15.5rem] min-w-[10.5rem] max-[90rem]:w-[12rem]" data-today-find>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input {...NO_SUGGEST} value={q} onChange={(e) => set(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') set('') }} placeholder="Search to-dos" aria-label="Search to-dos" className="h-9 w-full rounded-[0.625rem] border border-[#d9d3c9] bg-white pl-9 pr-8 text-[0.875rem] text-ink outline-none transition placeholder:text-faint focus:border-brand-300 focus:ring-[0.1875rem] focus:ring-brand-50" data-today-find-input />
      {q && <button type="button" onClick={() => set('')} aria-label="Clear the search" className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-wash hover:text-ink" data-today-find-clear><X className="h-3.5 w-3.5" /></button>}
    </label>
  )
}

function JobBar({ picked, onClear, sort }: { picked?: Job; onClear: () => void; /** a phone: the Sort button */ sort?: React.ReactNode }) {
  const s = useStore()
  const small = useSmall()
  const finding = useTodayFind((x) => x.open)
  /* a phone searching: the box across the whole line */
  if (small && finding) return <div className="flex w-full min-w-0 items-center gap-2" data-today-bar><FindBox /></div>
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 md:flex-nowrap" data-today-bar>
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

/** Today / Coming up / Waiting / Done: one clean switch (the picked one a white pill on a soft track), each with its
 *  number — not four boxes */
/** sorting Today: the usual order is by project (a card each); picked here: one list in that order */
const TODAY_SORTS: SortCol[] = [{ k: 'when', label: 'When', kind: 'date' }, { k: 'project', label: 'Project' }, { k: 'todo', label: 'To do' }, { k: 'who', label: 'Who' }]

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
  const q = q0
  const n = (v: View) => (lists.length > 1 ? lists.reduce((k, l) => k + countOf(findIn(s, partsOf(s, l.role, l.person, v, job), q)), 0) : countOf(findIn(s, partsFor(s, lists, v, job), q)))
  const parts = findIn(s, partsFor(s, lists, view, job), q)
  const found = q ? n(view) : 0
  /* sorted by a column (tap its name; a phone: Sort) — inside each part */
  const sorter = useSort('today')
  /* All jobs, Mine, the search (and a phone's Sort): on a computer the list's own top line, as on Estimates; on a phone
     one line under the boxes on top, pinned with them — the width of the screen, so it's always one line */
  const small = useSmall()
  const filters = (
    <div className="flex w-full min-w-0 flex-1 items-center" data-today-filters>
      {/* (a computer sorts by tapping a column's name; a phone: Sort) */}
      <JobBar picked={picked} onClear={() => setJob('all')} sort={<SortMenu sort={sorter.sort} set={sorter.set} cols={TODAY_SORTS} usual="By project" className="md:hidden" />} />
    </div>
  )
  /* what you finished: its own tab — its number is today's */
  const doneN = lists.reduce((k, l) => k + doneTodayN(s, l.role, l.person, job), 0)
  const empty: Record<'today' | 'coming' | 'waiting' | 'done', { title: string; sub: string }> = {
    today: { title: picked ? `Nothing for ${picked.name} today` : 'Nothing due today', sub: n('coming') ? `${n('coming')} coming up. See Coming up.` : 'New work lands here the moment it’s yours.' },
    coming: { title: 'Nothing coming up', sub: 'Tomorrow’s things, and anything with a day after it, show here.' },
    waiting: { title: 'Nothing waiting', sub: 'What you asked someone for, what you follow, and what’s out with the GC or a supplier waits here until it’s done.' },
    done: { title: 'Nothing done yet', sub: 'What’s finished goes here, by the day it was done. Open one to reopen it.' },
  }

  /* on top: the name, the day, how much is on it (and how much is late — it opens what's late) */
  const lateN = view === 'today' && !multi ? parts.reduce((k, p) => k + p.lines.filter((l) => l.k === 'plate' ? l.x.b === 'overdue' : l.k === 'task' ? taskBucket(l.t) === 'overdue' : false).length, 0) : 0
  return (
    <Page
      title={multi ? (lists.length >= (insidePeople(s).length || 1) ? 'Everyone’s Today' : `Today · ${lists.map((l) => (l.key === meOf(role) ? 'You' : PEOPLE[l.key]?.short || '')).join(' and ')}`) : lists[0].person ? `${PEOPLE[lists[0].person]?.short || 'Their'}’s Today` : `${greeting()}, ${PEOPLE[meOf(role)].short}`}
      phoneTitle
      sub={<span data-today-sub>{TODAY_LABEL}{n('today') ? <> · {n('today')} to do</> : null}{lateN ? <> · <button type="button" onClick={() => s.open({ t: 'late' })} className="font-medium text-bad-600 hover:underline" data-today-late>{lateN} late</button></> : null}</span>}
      top={
        <div className="flex flex-col gap-3 max-md:gap-2.5" data-today-top>
          {/* the same boxes on top as every page (Projects, Estimates, POs…): the number, its name, the picked one soft */}
          <div data-today-switch>
            <Bubbles row soft items={[
              { key: 'today', label: 'Today', count: n('today'), icon: <CalendarDays />, color: 'blue', on: view === 'today', onClick: () => setView('today') },
              { key: 'coming', label: 'Coming up', short: 'Coming', count: n('coming'), icon: <CalendarRange />, color: 'indigo', on: view === 'coming', onClick: () => setView('coming') },
              /* what someone else is doing that you're waiting for — you asked them, you're watching it, it's with the GC */
              { key: 'waiting', label: 'Waiting on others', short: 'Waiting', count: n('waiting'), icon: <Hourglass />, color: 'amber', on: view === 'waiting', onClick: () => setView('waiting') },
              /* what's finished: today's, then the days before */
              { key: 'done', label: 'Done', count: doneN, icon: <CircleCheckBig />, color: 'green', on: view === 'done', onClick: () => setView('done') },
            ]} />
          </div>
          {small && filters}
        </div>
      }
      /* the list in one box, the same as Estimates and Projects: All jobs, Mine and the search on its top line, the
         column names under it, then each project under its address — a line between every two */
      toolbar={small ? undefined : filters}
    >
      <WhoCol.Provider value={true}>
      <InJob.Provider value={!!picked}>
      <Viewer.Provider value={multi ? null : me}>
      <Multi.Provider value={multi}>
      <WaitView.Provider value={view === 'waiting'}>
      <TodaySort.Provider value={sorter.sort}>
      <BigBands.Provider value={true}>
      <div className="flex flex-col" data-list-scope="mine" data-today-list>
        {/* the names of the columns (tap one to sort by it) */}
        {n(view) > 0 && <TodayHead waiting={view === 'waiting'} sort={sorter.sort} onSort={sorter.toggle} />}
        {/* Waiting on others, in one line: only what you're waiting for */}
        {view === 'waiting' && n(view) > 0 && !q && <div className={cn('py-2 text-[0.8125rem] leading-snug text-muted', PX)} data-waiting-says>Only what you’re waiting for: things you gave someone or asked for, and things you watch.</div>}
        {/* searching: how many match, on this list */}
        {q && <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[0.8125rem] text-muted', PX)} data-today-found={found}><span>{found ? `${found} ${found === 1 ? 'to-do matches' : 'to-dos match'} “${q}”` : `Nothing ${view === 'today' ? 'on Today' : view === 'coming' ? 'coming up' : view === 'done' ? 'done' : 'waiting'} matches “${q}”`}</span>{!found && <button type="button" onClick={() => s.setPalette(true)} className="font-semibold text-brand-700" data-today-find-all>Search everything</button>}</div>}
        {/* one person's list — or Everyone: each person's under their own name, never mixed. Today: each project under
            its address; Coming up, Waiting, Done: under the day or the person, each line saying its project */}
        {multi ? lists.map((l) => <PersonList key={l.key} l={l} view={view} job={job} me={meOf(role)} q={q} />) : parts.map((p) => <PartBlock key={p.key} p={p} me={me} showOwner={view === 'waiting'} byProject={view === 'today' && p.key === 'today'} />)}
        {n(view) === 0 && !q && <EmptyState icon={<Check />} title={view === 'today' && doneN ? 'All done for today' : empty[view].title} sub={view === 'today' && doneN ? 'New work lands here the moment it’s yours.' : empty[view].sub} />}
      </div>
      </BigBands.Provider>
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
    ;(x.log ||= []).push({ date: NOW, time: clockNow(), who: meOf(st.role), text: 'Changed to a to-do · ours, not the GC’s' })
  }, 'It’s a to-do now', { sub: 'On their Today, today.' })
}
/** a call (call the GC, ask the client, find out…): what came of it is the point — so Done asks what they said */
export const isCallTask = (t: Pick<Task, 'title' | 'state' | 'waitingOn'>) => t.state !== 'waiting' && isCall(t.title)
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
  if (first?.who === 'system') return `Created by Tile OS · ${first.date}${said}`
  if (t.by && PEOPLE[t.by]) return `Asked by ${PEOPLE[t.by].short}${first ? ` · ${first.date}` : ''}`
  if (first && PEOPLE[first.who as PersonKey]) return `Added by ${PEOPLE[first.who as PersonKey].short} · ${first.date}`
  return ''
}
/** someone else's task: remind them — it pops up on their screen — and, when it's late, it counts as checking in. For
 *  whoever reminded, it's off their Today now and back tomorrow if it still isn't done: nothing left to stare at, nothing
 *  lost */
/** a reminder for a line that has none of its own (the crew list, the daily updates, the pickup list…): to its person's
 *  phone (with notifications on) and their Messages; tapped, it opens that thing */
export function remindLine(person: PersonKey, what: string, open?: { t: string; [k: string]: any }, jobId?: string) {
  const st = useStore.getState()
  const me = meOf(st.role)
  st.commit((x) => {
    x.notices.unshift({ id: 'nm' + Date.now().toString(36), jobId, text: `${PEOPLE[me]?.short || 'Someone'} reminded you: ${what}`, when: 'Just now', kind: 'field', unread: true, open, for: [person] })
  }, `Reminder sent to ${PEOPLE[person]?.short || 'them'}`, { sub: 'It’s in their Messages, and on their phone when notifications are on.', undo: false })
}
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
export function TaskModal({ id, level, call, ordered, follow }: { id: string; level: number; /** opened from its line's button (Called): "What did they say?" open */ call?: boolean; /** opened from its line's button (Ordered): who brings it and when it should be there — then it waits for it */ ordered?: boolean; /** opened from its line's button (Follow up): what they said, and when it's back */ follow?: boolean }) {
  const s = useStore()
  const t = s.tasks.find((x) => x.id === id)
  const t0 = useStore.getState().tasks.find((x) => x.id === id)
  const [waitOpen, setWaitOpen] = React.useState(!!follow && !t0?.coming)
  const [callOpen, setCallOpen] = React.useState(!!call)
  /* Ordered: how it gets there, and the day (opened from its line's button: open already) */
  const [orderOpen, setOrderOpen] = React.useState(!!ordered)
  /* ordered and on its way, not here on its day: the new day */
  const [notYetOpen, setNotYetOpen] = React.useState(false)
  /* its person opened it: seen (the list stops saying New / Not seen yet) */
  React.useEffect(() => { markTaskSeen([id]) }, [id])
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
  const followDay = t.state !== 'waiting' ? ''
    /* ordered, on its way: the day it should be there */
    : t.coming ? `Should be there ${followDue(t) ? ((isoFromLabel(t.followUp) || TODAY) < TODAY ? t.followUp : 'today') : /^tomorrow$/i.test(t.followUp || '') ? 'tomorrow' : t.followUp || ''}`
      : followDue(t) ? 'Follow up today' : `Follow up ${/^tomorrow$/i.test(t.followUp || '') ? 'tomorrow' : t.followUp || ''}`
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
      where={t.where && t.where.trim() !== job?.name && !touch.length ? t.where : undefined}
      title={cleanTitle(t.title, job)}
      sub={about ? <span data-task-detail>{about}</span> : undefined}
      edit={editable ? { title: t.title, sub: touch.length ? undefined : t.detail, onTitle: (v) => editTask(t.id, { title: v }), onSub: (v) => editTask(t.id, { detail: v }) } : undefined}
      remove={removable ? () => { removeTask(t.id); s.closeLevel(level) } : undefined}
      who={t.owner}
      whoText={<span data-task-owner>{t.also?.length ? `${[t.owner, ...t.also].map((p, i) => (p === me ? (i ? 'you' : 'You') : PEOPLE[p]?.short || p)).join(' or ')}, whoever’s first` : t.owner === me ? 'You' : owner}</span>}
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
  ) : t.state === 'waiting' && t.coming ? (
    /* ordered, on its way: did it come? (on its day, Not yet gives it a new day) */
    <>
      {right}
      {followDue(t) && (
        <Pop open={notYetOpen} onOpenChange={setNotYetOpen} side="top" align="end" width={360} trigger={<Button icon={<Hourglass />} data-not-yet>Not yet</Button>}>
          <NotYetPanel t={t} onDone={() => { setNotYetOpen(false); s.close() }} />
        </Pop>
      )}
      <Button variant="primary" className="max-sm:flex-1" icon={<PackageCheck />} onClick={() => { cameIn(t.id); s.close() }} data-came-in>It came</Button>
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
          /* a call: Called (Asked, Texted…) asks what they said (it goes to whoever's following it) — or No answer, back
             tomorrow */
          : isCallTask(t) && t.state === 'now' ? (
            <Pop open={callOpen} onOpenChange={setCallOpen} side="top" align="end" width={380} sheet className="max-sm:px-4 max-sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] max-sm:pt-3" trigger={<Button variant="primary" className="max-sm:flex-1" icon={<Check />} data-task-done data-call-done>{callWordOf(t.title)}</Button>}>
              <CallDone t={t} onDone={() => { setCallOpen(false); s.close() }} />
            </Pop>
          )
          /* an order: Ordered asks how it gets there and the day — then it's followed until it's there */
          : isOrderTask(t) ? (
            <Pop open={orderOpen} onOpenChange={setOrderOpen} side="top" align="end" width={400} sheet className="max-sm:px-4 max-sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] max-sm:pt-3" trigger={<Button variant="primary" className="max-sm:flex-1" icon={<Check />} data-task-done data-order-done>{doneWordOf(t.title)}</Button>}>
              <OrderedPanel t={t} onDone={() => { setOrderOpen(false); s.close() }} />
            </Pop>
          )
          : <Button variant="primary" className="max-sm:flex-1" icon={isRequest(t) ? <Truck /> : <Check />} onClick={() => { s.completeTask(t.id); s.close() }} data-task-done>{isRequest(t) ? 'Dropped off' : t.state === 'now' ? doneWordOf(t.title) : 'Done'}</Button>
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
        <div className={cn('-mx-6 max-sm:-mx-4', !touch.length && 'mb-5 border-b border-line-2')} data-task-strays>
          {strays.map((x) => <StrayLine key={x.id} t={x} />)}
        </div>
      )}
      {/* touch-ups: the checklist itself, on the window's own lines (the same as a to-do's list) — tick them right here,
          change their words, add photos */}
      {touch.length > 0 && (
        <div className="-mx-6 mb-5 border-b border-line-2 max-sm:-mx-4" data-task-touchups>
          {/* not decided yet who does them: one tap for all of them (or each one on its own line) */}
          {touch.some((p) => !p.owner && p.status !== 'verified') && t.state !== 'done' && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line-2 bg-warn-50/60 px-6 py-2.5 max-sm:px-4" data-touchups-pick>
              <span className="min-w-0 flex-1 text-[0.875rem] text-ink-2">Who does them isn’t decided yet</span>
              <WhoMenu pick={{ people: Array.from(new Set([...CREWS.filter((c) => !isOff(s, 'crew', c)), ...fieldPeople(s, job)])), me, current: undefined, onPick: (k) => setPunchOwner(touch.filter((p) => !p.owner).map((p) => p.id), k) }}
                trigger={<Button size="sm" variant="primary" data-touchups-pick-who>Pick who does them</Button>} />
            </div>
          )}
          {touch.map((p) => <TouchupLine key={p.id} p={p} win />)}
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
  const word = t.state === 'waiting' ? (t.coming ? `Coming from ${t.waitingOn || 'the store'}` : `Waiting on ${t.waitingOn || 'someone'}`) : t.state === 'later' ? (t.hold ? 'On hold' : `Set aside · back ${t.laterUntil}`) : 'To do'
  const hold = (d?: string) => { setOpen(false); s.holdTask(t.id, d) }
  const item = (on: boolean, label: React.ReactNode, onClick: () => void, attrs: Record<string, string>) => (
    <button type="button" role="menuitemradio" aria-checked={on} onClick={onClick} className="flex h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[0.9375rem] text-ink transition hover:bg-wash" {...attrs}>
      <span className="min-w-0 flex-1">{label}</span>{on && <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
    </button>
  )
  return (
    <Pop open={open} onOpenChange={(o) => { setOpen(o); if (!o) setUntil(false) }} align="start" width={until ? 332 : 240} className="p-0" sheet={until}
      trigger={<button type="button" className={CHIP} data-task-status-pick={t.hold ? 'hold' : t.state}><span className={cn('text-[0.9375rem]', t.state === 'waiting' ? 'text-warn-700' : t.hold ? 'font-medium text-ink' : 'text-ink')}>{word}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" /></button>}>
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
  /* done: when, and by whom — beside when it was made */
  const doneL = t.state === 'done' ? [...log].reverse().find((l) => /^(done\b|marked done)/i.test(l.text)) : undefined
  const doneDay = doneL?.date || (t.state === 'done' && t.doneOn ? md(t.doneOn) : '')
  return (
    <div className="mt-5 text-[0.8125rem] text-faint" data-task-record>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="-mx-1 inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md px-1 py-0.5 text-left transition hover:text-ink-2" data-record-toggle>
        <History className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0" data-record-made>Created {first.date}{first.time ? `, ${first.time}` : ''} by {who(by)}</span>
        {doneDay && <><span aria-hidden>·</span><span className="min-w-0" data-record-done>Done {doneDay}{doneL?.time ? `, ${doneL.time}` : ''}{doneL ? ` by ${who(doneL.who)}` : ''}</span></>}
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
/* a time said in the words: "at 5", "at 4:30pm", "5pm", "by 3 PM" — "at 5" alone (or before today / tomorrow…) is the
   afternoon, as everywhere; a number that's part of an address ("at 119 Park") is not a time */
const TIME_SAID = /\b(?:at|@|by)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm|a\.m\.|p\.m\.)(?![a-z])|\b(\d{1,2}(?::\d{2})?)\s*(am|pm|a\.m\.|p\.m\.)(?![a-z])|\b(?:at|@)\s*(\d{1,2}(?::\d{2})?)(?=\s*$|\s*[,.;!?)]|\s+(?:today|tomorrow|tonight|this|on|in|for|and|o'?clock)\b)/i
export function timeSaid(v: string): string | undefined {
  const m = v.match(TIME_SAID)
  if (!m) return undefined
  const num = m[1] || m[3] || m[5]
  const ap = (m[2] || m[4] || '').replace(/\./g, '')
  const min = parseTime(`${num}${ap ? ' ' + ap : ''}`)
  return min == null ? undefined : clock(min)
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
  /* its time of day (a one-time to-do): any time, unless it's picked or said ("call the GC at 5") */
  const [time, setTime] = React.useState('')
  const [timePicked, setTimePicked] = React.useState(false)
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
    if (!timePicked) setTime(timeSaid(v) || '')
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
    s.addTask({ jobId: job, title: clean, type: guessType(title), owner, also: shared ? owners.slice(1) : undefined, due: repeat ? 'Today' : due, ...(!repeat && time ? { at: time } : {}), for: fors, state: 'now', tone: urgent ? 'bad' : 'info', urgent: urgent || undefined, repeat: repeat || undefined, repeatAt: repeat ? at : undefined, where: repeat ? `${REPEAT_LABEL[repeat]} at ${at}` : msg ? 'From a message' : undefined, detail: msg ? `From ${PEOPLE[msg.who]?.name || 'someone'} in the project messages, ${msg.date} ${msg.time}: “${msg.text}”` : undefined, followers: (() => { const f = Array.from(new Set([...(!owners.includes(me) ? [me] : []), ...watchers])).filter((p) => !owners.includes(p)); return f.length ? f : undefined })() })
    if (msg && jobId) markMessageTask(jobId, msg.id)
    s.close()
    /* set for a time, and it's mine: the phone can say so at that time (once in a while, when it's off) */
    if (!repeat && time && owners.includes(me)) void offerNotify(time)
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
          {!repeat && <SearchSelect label="Time" value={time} options={[{ key: '', label: 'Any time' }, ...TIMES.map((x) => ({ key: x, label: x }))]} onChange={(v) => { setTime(v); setTimePicked(true) }} search={false} width={200} trigger={<button type="button" aria-label="Time" className={cn(PICK_CHIP, time && 'text-ink')} data-task-time={time}><Clock3 /><span>{time ? `at ${time}` : 'Any time'}</span><ChevronDown className="!h-3.5 !w-3.5 !text-faint" /></button>} />}
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
  /* filled in: what was sent for that day already, else the last number sent for each job — 0 when it isn't known */
  const [rows, setRows] = React.useState(() => crewLines(s, day)
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
    setRows((x) => [...x, { jobId, crew: ((j.crew || crews[0]) as PersonKey), workers: crewStart(s, jobId, day), note: '' }])
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
            /* on the window's own lines: the crew's circle under the marks above, the project under their names */
            <div key={r.jobId} className={cn(WIN_ROW, 'py-2.5')} data-crew-job={r.jobId}>
              <div className={cn(WIN_ROW_GRID, small && 'grid-cols-[1rem_minmax(0,1fr)]')}>
              <span className="justify-self-center"><Avatar who={r.crew} size={22} /></span>
              <div className="min-w-0">
                <div className="break-words text-[0.9375rem] font-semibold leading-snug text-ink">{j?.name}</div>
                {/* 0: what it'll say (nobody there), quiet — it's where every job starts until a number is put in */}
                <div className="text-[0.8125rem] text-muted">{PEOPLE[r.crew]?.name || 'No installer yet'}{r.workers === 0 ? <span data-crew-nobody> · {today ? 'Nobody there today' : 'Nobody there'}</span> : null}</div>
                {r.note && <div className="break-words text-[0.78125rem] leading-snug text-muted" data-crew-note>{r.note}</div>}
              </div>
              <div className={cn(small && 'col-start-2 mt-2 w-full')}><Stepper big={small} value={r.workers} onChange={(n) => set(i, { workers: n })} min={0} max={30} suffix={small ? (r.workers === 1 ? 'person' : 'people') : undefined} /></div>
              </div>
            </div>
          )
        })}
        {!rows.length && !adding && <div className="px-6 py-8 text-center text-[0.875rem] text-muted max-sm:px-4">No project has a crew {today ? 'today' : crewWhen(day) === 'tomorrow' ? 'tomorrow' : `on ${crewWhen(day)}`}.</div>}
        {/* a crew on a project that isn't here */}
        <div className="border-t border-line-2 px-6 py-2 max-sm:px-4">
          {adding ? (
            <div className="flex flex-col gap-2">
              <ProjectField value={addJob} onChange={(id) => { if (id) add(id); else setAddJob('') }} keep={(x) => !['request', 'estimating', 'proposal', 'followup', 'complete'].includes(x.stage) && !rows.some((r) => r.jobId === x.id)} />
              <button type="button" onClick={() => setAdding(false)} className="self-start text-[0.84375rem] font-semibold text-muted">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="grid h-10 grid-cols-[1rem_auto] items-center gap-x-2.5 text-[0.875rem] font-semibold text-brand-700" data-crew-add><Plus className="h-4 w-4 justify-self-center" />Another project</button>
          )}
        </div>
      </div>
      )}
    </Modal>
  )
}
