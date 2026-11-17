/* Today — your day, in the order it happens. What's late first, then the day hour by hour (meetings at their time),
 * then what can be done any time. Tomorrow and Later are the same, a day at a time. Every row: when · what ·
 * project · the one button. Checklist steps that are your turn show up by themselves — that's the hand-off.
 * Mine / Everyone switches between your list and the whole team's. */
import * as React from 'react'
import { Send, MessageSquareReply, CalendarRange, Check, Flag, Plus, Repeat, Clock3, MoonStar, RotateCcw, Ban, Building2, CalendarDays, UserRound, HardHat, ListTodo, Hourglass, CircleCheckBig, Eye, Users, Megaphone, UserPlus, FileText, ClipboardList, Package, ArrowLeftRight, Receipt, ListChecks, HandCoins, ChevronRight, ChevronDown, ChevronLeft, ListPlus, Truck, UserRoundCheck, Gauge, BellRing, MoreHorizontal, ArrowRight, MessageSquare, MapPinned, Trash2 } from 'lucide-react'
import { useStore, meOf, NOW, isRequest, DATA_KEYS, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Field, Chip, Stepper } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, MenuSep, Pop, DatePresets, WaitPicker, LaterPicker } from '@/tileos/components/ui/overlay'
import { Page, Filter, ClearFilters, Group, EmptyState, Status, Bubbles, PX, ViewSwitch, HEAD_ROW, BAND, BAND_LABEL, BAND_STRONG, bandStyle, bandLabel, BandCount, STICKY_HEAD, ROW_H } from '@/tileos/components/ui/page'
import { SearchSelect, MultiSelect } from '@/tileos/components/ui/select'
import { cn, greeting } from '@/tileos/lib/utils'
import { PRICING_STAGES, PEOPLE, CREWS, fmtMoney, loginOf, type Role, type PersonKey, type Job } from '@/tileos/data/model'
import { TODAY_LABEL } from '@/tileos/data/jobs'
import { REPEAT_LABEL, type Task, type TaskType } from '@/tileos/data/work'
import { runTaskAction } from './flows'
import { sendCrewReport } from './flows2'
import { ActivityRow } from './activity'
import { agendaFor } from './agenda'
import { timeLabel, rangeLabel, parseTime, type CalEvent } from '@/tileos/data/calendar'
import { payDue } from './pay-page'
import { payOpen, PAY_WEEKS } from './pay'
import { billsToMake, billTotal, billingOn, LAST_WEEK } from './progressbill'
import { followersOf, toggleFollow, toggleAlso, setEveryone, removeTask } from './taskshare'
import { Notes } from './notes'
import { stepTodos, stepsFor, isGettingReady, realOwner, siteOf, emptySpot, type StepView } from './steps'
import { StepButton } from './steps-ui'
import { todoOf } from './stepwin'
import { TODAY, TOMORROW, dayShort, dayLongFull, isoFromLabel, labelFromIso, addDays, md, workday, dow } from '@/tileos/lib/today'
import { REAL, awayFromMe } from '@/tileos/lib/save'
import { checkIns, checkInDays, reportOn, handledOf, workdaysBetween, type CheckItem } from './teamreport'
import { SuggestInput } from '@/tileos/components/ui/suggest'
import { insidePeople } from './steps-ui'
import { TripButtons, ROW_BTN } from './requests'
import { markMessageTask } from './messages'
import { FormHead, FormRow, ProjectField, ProjectChip, PICK_CHIP } from './formkit'
import { WinHead } from './winhead'
import { useSmall } from '@/tileos/lib/phone'
import { roundsToday, roundsOn } from './rounds'
import { OpenAllLink } from './job/areas'
/** a phone: a switch takes its share of the width, its buttons split it evenly — one line; a very narrow phone (or big
 *  text) gives each switch its own line rather than cut a word */
const PHONE_SHARE = 'max-sm:min-w-0 max-sm:flex-1 max-sm:[&>button]:min-w-0 max-sm:[&>button]:flex-1 max-sm:[&>button]:justify-center max-sm:[&>button]:px-1.5 [@media(max-width:22rem)]:basis-full'
import { isGcWait, isQuestion, toldGc, gcState, gcSoFar, gcWaits, gcWords, gcMessage, askLabel, askedGc, setNeedBy, openWhatsApp, startOf, GcMessageBox, GcAnswer } from './gcwait'

const TODAY_ISO = TODAY
const TYPES: TaskType[] = ['Pricing', 'Setup', 'Materials', 'Field', 'Changes', 'Schedule', 'Money']
const ASSIGNABLE: PersonKey[] = ['ys', 'yakov', 'office', 'estimator', 'takeoff', 'materials', 'accounting']
const ROLE_OF: Partial<Record<PersonKey, Role[]>> = { ys: ['owner', 'pm'], yakov: ['site'], office: ['office'], estimator: ['estimator'], takeoff: ['takeoff'], materials: ['materials'], accounting: ['accounting'] }
const TYPE_ICON: Record<TaskType, React.ElementType> = { Pricing: FileText, Setup: ClipboardList, Materials: Package, Field: HardHat, Changes: ArrowLeftRight, Schedule: CalendarDays, Money: Receipt }

/** a daily update that's due today: one per project a crew is working on (the site manager sends them) — every work
 *  day, no skipping: the one for the last work day that wasn't sent is still there the next morning, late */
export type DailyItem = { kind: 'daily'; jobId: string; crew: PersonKey; workers?: number; missed?: string }
/** where the crews work on a day: every project with a crew on the calendar that day — and a project that's
 *  installing with its installer on it but no days on the calendar (brought in, or gone through by hand), every work
 *  day from its start date to its finish, when they're set */
export function workingOn(s: Store, iso: string): { jobId: string; crew: string; start: string; workers?: number; booked: boolean }[] {
  const booked = s.bookings.filter((b) => b.start <= iso && b.end >= iso && s.jobs[b.jobId] && ['installation', 'punch'].includes(s.jobs[b.jobId].stage)).map((b) => ({ jobId: b.jobId, crew: b.crew as string, start: b.start, workers: b.workers, booked: true }))
  const workDay = ![0, 6].includes(new Date(iso + 'T12:00:00').getDay())
  /* (no start date: no "yesterday's is late" — it isn't known when they started) */
  const installing = !workDay ? [] : Object.values(s.jobs).filter((j) => {
    if (j.stage !== 'installation' || j.hold || s.bookings.some((b) => b.jobId === j.id)) return false
    const crew = j.crew || (s.prep[j.id]?.installer !== 'tbd' ? s.prep[j.id]?.installer : undefined)
    if (!crew) return false
    const start = j.dates?.start ? isoFromLabel(j.dates.start) : undefined
    const finish = j.dates?.finish ? isoFromLabel(j.dates.finish) : undefined
    return (!start || start <= iso) && (!finish || finish >= iso)
  }).map((j) => ({ jobId: j.id, crew: (j.crew || s.prep[j.id]?.installer) as string, start: (j.dates?.start && isoFromLabel(j.dates.start)) || '9999-12-31', workers: j.onSite?.workers, booked: false }))
  return [...booked, ...installing]
}
/** the crew list: where the crews are and how many people. Until 3 in the afternoon it's today's; after, it's the
 *  next work day's (Friday: Monday's) — planned the night before, while there's still time to sort a problem out */
export const CREW_EVENING = 15
export const crewEvening = () => {
  let h = new Date().getHours()
  try { const t = localStorage.getItem('tileos-test-hour'); if (t != null && t !== '') h = Number(t) } catch { /* fine */ }
  return h >= CREW_EVENING
}
export const nextWorkDay = (iso: string) => workday(addDays(iso, 1))
/** the day the crew list is for right now */
export const crewDay = () => (crewEvening() ? nextWorkDay(TODAY_ISO) : TODAY_ISO)
export const crewsOn = (s: Store, day: string) => workingOn(s, day)
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
  /* someone else with the same login has it — a built-in spot nobody took ("Yakov" from the clean start) isn't anyone,
     so what's still on it is the login's own */
  const st = useStore.getState()
  return !st.team.some((m) => m.key === t.owner && m.status !== 'off' && loginOf(m.role) === loginOf(role) && !(REAL.cloud && emptySpot(st, m.key)))
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
/** grouped by project, but a row that isn't under a project's band (For everyone, No day set, the check-ins): the
 *  same two columns as the rest of the list — its project goes quietly after its name instead of in a column */
const Loose = React.createContext(false)
/** the one button on a row (requests.tsx keeps it, for the On my way / Dropped off pair too) */
const TBTN = ROW_BTN
/** a Today list's columns on a computer: the project first (where — not when grouped by project, its band says it),
 *  what to do, whose (on everyone's list), and the row's button on the right with its time or date beside it. The
 *  project is as wide as the longest project name (up to a point — a longer one is cut short), so what to do starts
 *  right after it — no gap; whose as wide as its names; what to do takes the rest; the button column as wide as its
 *  button. */
/* what first — it's the thing to do; then where (quiet), whose, and its day */
export const todoList = (who: boolean, inJob: boolean) => ['minmax(0,1fr)', inJob ? '' : 'minmax(0,15rem)', who ? 'fit-content(12rem)' : '', 'max-content'].filter(Boolean).join(' ')
/** the column names over a Today list */
function TodoHead({ who, inJob }: { who: boolean; inJob: boolean }) {
  return (
    <div className={cn(HEAD_ROW, 'gap-x-6 max-md:hidden md:grid', PX)} data-todo-head data-subrow>
      {!inJob && <span>Project</span>}
      <span>What</span>
      {who && <span>Whose</span>}
      {/* the end of the row: its day or time — no buttons, so no name over it */}
      <span aria-hidden />
    </div>
  )
}
/** the row's one button, in its own column on a computer — what happens next, always in sight. Every row's is the same
 *  button, the same size (a long label is cut short), no icons — one even column down the list; its time or date (a
 *  meeting's hour, the day it was due) sits just before it */
const NEXT_CELL = 'flex min-w-0 items-center justify-end gap-4 max-md:hidden [&_button]:h-8 [&_button]:w-[10.5rem] [&_button]:max-w-none [&_button]:justify-center [&_button]:px-3 [&_button_svg]:hidden'

function TodoRow({ when, whenTone, title, detail, project, action, onClick, done, leaving, owner, phoneWhen = true }: {
  when?: React.ReactNode; whenTone?: 'bad' | 'warn' | 'strong' | 'quiet'; icon?: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; project?: string; action?: React.ReactNode; onClick?: () => void; done?: boolean; leaving?: boolean; owner?: PersonKey
  /** a phone shows the when too (false: only a computer — a phone's line is short) */
  phoneWhen?: boolean
}) {
  const who = React.useContext(WhoCol)
  const inJob = React.useContext(InJob)
  const loose = React.useContext(Loose) && inJob
  const me = meOf(useStore((x) => x.role))
  const w = when === 'Anytime' ? '' : when
  /* grouped by project, the group's name says it — it's still on the row for a screen reader. A row under no
     project's band says its project after its name (and over it on a phone). */
  const inline = loose ? project : undefined
  const quiet = inJob && !loose ? project : undefined
  if (inJob && !loose) project = undefined
  const whenCls = whenTone === 'bad' ? 'font-medium text-bad-600' : whenTone === 'warn' ? 'font-medium text-warn-700' : whenTone === 'strong' ? 'text-ink-2' : 'text-muted'
  const ownerName = owner ? (owner === me ? 'You' : PEOPLE[owner]?.short) : ''
  /* a phone: where (and whose) after what — "Company" (no project) says nothing there */
  const wherePhone = [project && project !== 'Company' ? project : '', who && owner ? ownerName : ''].filter(Boolean).join(' · ')
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onClick() } : undefined}
      title={typeof detail === 'string' && detail ? detail : undefined}
      data-todo
      data-subrow
      className={cn('group/row relative items-center gap-x-6 border-t border-line-2 py-1.5 transition-colors focus-visible:outline-none max-md:flex max-md:gap-3 max-md:py-2.5 md:grid', ROW_H, PX, onClick && 'cursor-pointer row-hover', leaving && 'row-out', 'max-md:min-h-[calc(3.875rem+1px)]')}
    >
      <div className="flex min-w-0 items-center gap-2.5 max-md:flex-1">
        {done && <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok-50 text-ok-600 [&_svg]:h-3 [&_svg]:w-3"><Check strokeWidth={3} /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-3">
            {/* a phone: every row the same — what to do on one line, the job under it in gray; the same weight, nothing
                wrapping (a very long one ends in "…" — its window has all of it) */}
            <span className={cn('min-w-0 flex-1 truncate text-[0.875rem] font-medium leading-5 md:font-normal max-md:text-[0.9375rem] max-md:font-normal max-md:leading-[1.375rem]', done ? 'text-muted line-through decoration-faint' : 'text-ink')}>{title}{inline && <span className="text-[0.8125rem] font-normal text-muted max-md:hidden" data-row-project> · {inline}</span>}</span>
            {/* on a phone the time sits at the end of the task's line */}
            {w && phoneWhen && <span className={cn('shrink-0 text-[0.8125rem] tnum md:hidden', whenCls)} data-todo-when-phone>{w}</span>}
          </div>
          {wherePhone && <div className="truncate text-[0.875rem] leading-5 text-muted md:hidden" data-row-where-phone>{wherePhone}</div>}
        </div>
      </div>
      {/* a computer: where, quiet, after what */}
      {!inJob && <span className="min-w-0 truncate text-[0.8125rem] text-muted max-md:hidden" data-row-where>{project}</span>}
      {who && <span className="flex min-w-0 items-center gap-2 max-md:hidden">{owner && PEOPLE[owner] ? <><Avatar who={owner} size={20} /><span className={cn('truncate text-[0.8125rem]', owner === me ? 'font-medium text-ink' : 'text-ink-2')}>{ownerName}</span></> : null}</span>}
      {quiet && <span className="sr-only">{quiet}</span>}
      {/* a computer: no button — the row itself does what's next (one less thing on the screen); its day or time, and a
          quiet arrow. A row that doesn't open anything keeps its button */}
      <div className={NEXT_CELL} onClick={onClick ? undefined : (e) => e.stopPropagation()} data-todo-next>
        {w && <span className={cn('truncate text-right text-[0.8125rem] tnum', whenCls)} data-todo-when>{w}</span>}
        {onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-faint" aria-hidden data-todo-go /> : action}
      </div>
    </div>
  )
}

/** "4 PM", "10:30 AM" — the hour a thing happens */
const hourLabel = (min: number) => timeLabel(min).replace(/^(\d+) /, '$1:00 ')
function taskTime(t: Task): number | null { return t.repeatAt ? parseTime(t.repeatAt) : null }

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
  /* shared — two can do it, whoever gets to it first: the row says who else has it */
  const me0 = meOf(s.role)
  const sharers = [t.owner, ...(t.also || [])]
  const withWho = t.also?.length && !done ? (sharers.includes(me0) ? sharers.filter((p) => p !== me0) : t.also).map((p) => PEOPLE[p]?.short || p).join(' and ') : ''
  const gcw = isGcWait(t) ? gcState(t) : undefined
  const w = (t.urgent && t.state === 'now' ? { text: 'Urgent', tone: 'bad' as const } : undefined) || when || (gcw ? (follow && gcw.tone !== 'bad' ? { text: askLabel(t), tone: 'warn' as const } : { text: gcw.text, tone: gcw.tone === 'bad' ? 'bad' as const : gcw.tone === 'warn' ? 'warn' as const : undefined }) : undefined) || (t.state === 'waiting' ? (follow ? { text: 'Follow up', tone: 'warn' as const } : { text: /^tomorrow$/i.test(t.followUp || '') ? 'Tomorrow' : `Back ${t.followUp}`, tone: undefined }) : t.state === 'done' ? { text: t.doneAt ? (t.doneAt === 'Just now' ? 'Today' : t.doneAt) : 'Done', tone: 'quiet' as const } : t.state === 'later' ? { text: `Back ${t.laterUntil}` } : { text: 'Anytime', tone: 'quiet' as const })
  return (
    <TodoRow
      leaving={leaving}
      done={done || leaving}
      /* the line does what its button does — the one thing that happens next, wherever you tap */
      onClick={() => (act ? runTaskAction(t) : s.open({ t: 'task', id: t.id }))}
      icon={t.everyone ? <Megaphone /> : t.repeat ? <Repeat /> : <Ic />}
      title={withWho ? <>{cleanTitle(t.title, job)}<span className="font-normal text-muted" data-row-shared> · with {withWho}</span></> : cleanTitle(t.title, job)}
      detail={detail}
      owner={showOwner ? t.owner : undefined}
      project={job ? (PRICING_STAGES.includes(job.stage) ? `${job.name} · estimate` : job.name) : 'Company'}
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

function StepRowToday({ job, v, showOwner, when }: { job: Job; v: StepView; showOwner?: boolean; when?: { text: string; tone?: 'bad' | 'warn' | 'strong' | 'quiet' } }) {
  const s = useStore()
  const start = s.prep[job.id]?.targetISO
  return (
    <TodoRow
      onClick={() => s.open({ t: 'step', jobId: job.id, k: v.key })}
      icon={<ListChecks />}
      title={todoOf(v)}
      detail={[v.state === 'bad' ? 'Problem' : '', v.note, start ? `Checklist step · starts ${md(start)}` : 'Checklist step'].filter(Boolean).join(' · ')}
      owner={showOwner ? v.owner : undefined}
      project={job.name}
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
      onClick={() => s.open({ t: 'daily', jobId: d.jobId })}
      icon={<ClipboardList />}
      /* yesterday's not sent: its day is on the right, in red — not twice on one line */
      title={d.missed ? 'Daily update — not sent' : 'Daily update'}
      detail={`${PEOPLE[d.crew].short}’s crew · ${job.pct ?? 0}% installed`}
      owner={showOwner ? siteOf(s, job) : undefined}
      project={job.name}
      when={d.missed ? md(d.missed) : undefined}
      whenTone={d.missed ? 'bad' : undefined}
      action={<Button size="sm" className={TBTN} onClick={() => s.open({ t: 'daily', jobId: d.jobId })}>Send update</Button>}
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
      onClick={open}
      title="Daily updates"
      detail={jobs.map((id) => s.jobs[id]?.name).filter(Boolean).join(' · ')}
      owner={showOwner ? x.who : undefined}
      project={`${jobs.length} jobs`}
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
      onClick={open}
      title={vs[0] ? todoOf(vs[0].v) : ''}
      detail={vs.map((y) => y.job.name).join(' · ')}
      owner={showOwner ? x.who : undefined}
      /* how many — which ones are in its window */
      project={`${vs.length} projects`}
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
      onClick={open}
      title={`Bring to the ${jobs.length > 1 ? 'jobs' : 'job'}: ${ts.map((t) => t.req?.what || t.title.replace(/^Bring to [^:]+:\s*/i, '')).join(', ')}`}
      detail={ts.map((t) => t.req?.what || t.title).join(' · ')}
      owner={showOwner ? x.who : undefined}
      project={one ? one.name : jobs.map((id) => s.jobs[id]?.name).filter(Boolean).join(', ')}
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
      onClick={open}
      title={`Check in with ${PEOPLE[g.who]?.short || 'them'}`}
      detail={g.items.map((c) => c.title).join(' · ')}
      project={`${n} ${n === 1 ? 'thing' : 'things'} late`}
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
      onClick={go}
      icon={<HardHat />}
      title={`Send ${whose} crew list`}
      detail={`${n} ${n === 1 ? 'project' : 'projects'} — how many people on each`}
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
      onClick={go}
      icon={<MapPinned />}
      title="Visit the jobs"
      detail="Google Maps through all of them, a video from each"
      project={r.done ? `${r.done} of ${r.left + r.done} done` : `${r.left} job ${r.left === 1 ? 'site' : 'sites'}`}
      when="Anytime"
      action={<Button size="sm" className={TBTN} onClick={go} data-rounds-row>{r.done ? 'Keep going' : 'Start'}</Button>}
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
      onClick={go}
      icon={<HandCoins />}
      title={`Installer pay · week of ${PAY_WEEKS[0].label}`}
      detail={`${off.length ? `${off.length} bill doesn’t match · ` : ''}${open.length} installers · ${fmtMoney(total)} · from the daily updates`}
      project="Company"
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
  const who = t.owner === me ? 'You' : PEOPLE[t.owner]?.short || 'Someone'
  return (
    <div data-gc-row={t.id} data-gc-flag={st.flag ? '' : undefined} data-contents>
      <TodoRow
        onClick={() => s.open({ t: 'task', id: t.id })}
        title={<>{gcWords(t.title)}<span className="font-normal text-muted"> · {who}{t.said ? <> · GC: “{t.said.text}”</> : null}</span></>}
        detail={gcSoFar(t)}
        project={job?.name || 'Company'}
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
const APP_DID = /^(Created|Reminded |Told |Needed by |No date it’s needed by|Moved to |Checked in with |Done\b|Reopened|Back to needs action|Back on |Handed (from|to) |Waiting on |Not here yet|Pinned to|Unpinned from|Repeats|Set up to repeat|Due |Emailed to |Sent (to|back to) |Asked for |Brought in from|Accepted|Logged as a problem|Set aside|Taken over|Took it over|Followed up$|Shared with|Now for )|(follows it( now)?|stopped following)$/
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
      onClick={go}
      icon={<Receipt />}
      title={`Progress billing · week of ${LAST_WEEK.label}`}
      detail={`${rows.length} ${rows.length === 1 ? 'project' : 'projects'} · ${fmtMoney(total)} to bill · from the daily updates`}
      project="Company"
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
  return (
    <TodoRow
      onClick={open}
      icon={<CalendarDays />}
      title={e.title}
      detail={[e.kind === 'walkthrough' ? 'Walkthrough' : 'Meeting', rangeLabel(e.start, e.dur), e.with ? `with ${e.with}` : '', showOwner ? e.people.map((p) => PEOPLE[p]?.short).join(', ') : ''].filter(Boolean).join(' · ')}
      project={job?.name || 'Company'}
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
export type PlateItem = { key: string; b: Bucket; iso?: string; time?: number | null; kind: 'task' | 'daily' | 'crew' | 'rounds' | 'pay' | 'bill' | 'meet' | 'step' | 'checkin' | 'dailies' | 'trips' | 'steps'; t?: Task; d?: DailyItem; /** one row for many: the day's daily updates */ ds?: DailyItem[]; /** one row for many: what to bring to the jobs */ ts?: Task[]; /** one row for many: the same step on many projects */ vs?: { job: Job; v: StepView }[]; e?: CalEvent; job?: Job; v?: StepView; who?: PersonKey; ci?: { who: PersonKey; items: CheckItem[] } }
const AHEAD = 21
/** everything that's mine: tasks, the daily updates I send, the pay week, my meetings, checklist steps that are my turn */
export function plateOf(s: Store, role: Role, person?: PersonKey | null): PlateItem[] {
  const me = person === undefined ? meOf(role) : person
  const out: PlateItem[] = []
  const last = addDays(TODAY, AHEAD)
  s.events.filter((e) => e.date >= TODAY && e.date <= last && (!me || e.people.includes(me))).forEach((e) => out.push({ key: 'e' + e.id, b: bucketOfIso(e.date), iso: e.date, time: e.start, kind: 'meet', e, who: e.people[0] }))
  /* the site manager's crew list, until it's sent: tomorrow's after 3 in the afternoon, today's first thing */
  if (role === 'site' && crewReportOn(s)) { const day = crewDay(); if (crewsOn(s, day).length && !crewSentFor(s, day)) out.push({ key: 'crew', b: 'today', iso: TODAY, time: day === TODAY ? 7 * 60 : 15 * 60, kind: 'crew', who: me || realOwner(s, meOf('site')) }) }
  /* the admin's rounds: the job sites with work going on, on a work day, until a video has gone out from each */
  if (role === 'owner' && roundsOn(s) && ![0, 6].includes(dow(TODAY)) && roundsToday(s, me || meOf('owner')).left > 0) out.push({ key: 'rounds', b: 'today', iso: TODAY, time: null, kind: 'rounds', who: me || meOf('owner') })
  /* each project's daily update is its own site manager's — the real person, never the built-in "Yakov" spot */
  dailyDue(s, role).forEach((d) => { const who = siteOf(s, s.jobs[d.jobId]); out.push(d.missed ? { key: 'dm' + d.jobId, b: 'overdue', iso: d.missed, time: null, kind: 'daily', d, who } : { key: 'd' + d.jobId, b: 'today', iso: TODAY, time: 17 * 60, kind: 'daily', d, who }) })
  /* (whoever's list it is — the same line on the admin's Everyone as on their own phone) */
  if ((role === 'owner' || (role === 'pm' && (!me || me === meOf('owner')))) && payDue(s)) out.push({ key: 'pay', b: 'today', iso: TODAY, time: null, kind: 'pay', who: me || meOf('owner') })
  if (role === 'accounting' && billingOn(s) && billsToMake(s).length) out.push({ key: 'bill', b: 'today', iso: TODAY, time: null, kind: 'bill', who: me || meOf('accounting') })
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
    out.push({ key: t.id, b, iso: taskIso(t), time: taskTime(t), kind: 'task', t, who: realOwner(s, t.owner) })
  })
  s.tasks.filter((t) => isMine(t, role, me) && t.state === 'later').forEach((t) => out.push({ key: t.id, b: 'aside', iso: taskIso(t), kind: 'task', t, who: realOwner(s, t.owner) }))
  /* waiting on someone outside: locked to its follow-up day — that day it's back on the list (late after it) */
  s.tasks.filter((t) => isMine(t, role, me) && t.state === 'waiting' && !staleFollowUp(s, t)).forEach((t) => {
    const iso = isoFromLabel(t.followUp)
    if (!iso || iso > TODAY) return
    /* the same: an untaken login spot is whoever has that job — never a second "Yakov" */
    out.push({ key: t.id, b: bucketOfIso(iso), iso, kind: 'task', t, who: realOwner(s, t.owner) })
  })
  stepTodos(s, me || 'all').forEach(({ job, step: v }) => {
    /* a step with no date of its own is due a week before the start (everything left has to be done by then) — no start yet, it's due now */
    const start = s.prep[job.id]?.targetISO
    const lead = start ? (addDays(start, -7) < TODAY ? TODAY : addDays(start, -7)) : undefined
    const iso = v.due || lead || TODAY
    out.push({ key: `s:${job.id}:${v.key}`, b: v.state === 'bad' && (!iso || iso > TODAY) ? 'today' : bucketOfIso(iso), iso, kind: 'step', job, v, who: v.owner })
  })
  return sortPlate(out)
}
const sortPlate = (xs: PlateItem[]) => xs.sort((x, y) => (x.iso || '9999').localeCompare(y.iso || '9999') || (x.time ?? 9999) - (y.time ?? 9999))
/** everyone's plate: each inside login's list, one row per thing */
const TEAM_ROLES: Role[] = ['owner', 'site', 'office', 'takeoff', 'estimator', 'materials', 'accounting']
function teamPlate(s: Store): PlateItem[] {
  const seen = new Map<string, PlateItem>()
  TEAM_ROLES.forEach((r) => plateOf(s, r, null).forEach((x) => { if (!seen.has(x.key)) seen.set(x.key, x) }))
  s.events.filter((e) => e.date >= TODAY && e.date <= addDays(TODAY, AHEAD)).forEach((e) => { if (!seen.has('e' + e.id)) seen.set('e' + e.id, { key: 'e' + e.id, b: bucketOfIso(e.date), iso: e.date, time: e.start, kind: 'meet', e, who: e.people[0] }) })
  return sortPlate(Array.from(seen.values()))
}
/* The same kind of thing many times is one line — tap it and its window has them all, each done right there:
 *   the daily updates (one line: "Daily updates · 6 jobs"), the same step on many projects ("Pick the installer and
 *   send his PO · 3 projects"), and what's to be brought to the jobs (one trip, every pickup in it).
 * Anything else is its own line, with its project. */
const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'aside']
export function collapse(items: PlateItem[]): PlateItem[] {
  const out: PlateItem[] = []
  const dailies = new Map<string, PlateItem[]>()
  const trips = new Map<string, PlateItem[]>()
  const steps = new Map<string, PlateItem[]>()
  const add = (m: Map<string, PlateItem[]>, k: string, x: PlateItem) => m.set(k, [...(m.get(k) || []), x])
  items.forEach((x) => {
    /* every daily update on this list together — yesterday's not sent too */
    if (x.kind === 'daily') return add(dailies, '', x)
    /* what's to be brought — today's (and late) together; a day ahead stays with that day */
    if (x.kind === 'task' && x.t && isRequest(x.t) && x.t.state === 'now' && !x.t.urgent) return add(trips, `${x.who || x.t.owner}|${isNow(x.b) ? 'now' : x.b}`, x)
    /* the same step on many projects — a problem stays its own line */
    if (x.kind === 'step' && x.v && x.job && x.v.state !== 'bad') return add(steps, `${x.who || x.v.owner}|${x.v.key}|${isNow(x.b) ? 'now' : x.b}`, x)
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

/* ================= a person's lists — one place decides what's on each ================= */
/* The page, its five numbers, the number on Today in the menu and the admin's Everyone all come from here: what's
 * counted is what's shown, and someone's list on the admin's Everyone is the list on their own phone. */
export type View = 'today' | 'tomorrow' | 'later' | 'waiting' | 'done'
type Tone = 'bad' | 'info' | 'warn' | 'neutral'
/** one line: something on the plate, a task shown its own way (for everyone, back tomorrow, waiting, done), the GC's,
 *  or a step waiting on someone outside */
export type Line =
  | { k: 'plate'; key: string; x: PlateItem }
  | { k: 'task'; key: string; t: Task; as: 'pinned' | 'back' | 'waiting' | 'done' }
  | { k: 'gc'; key: string; t: Task }
  | { k: 'wait'; key: string; job: Job; v: StepView }
/** a part of a list, with its name — Overdue, Today, For everyone… (a day's part has its day: the now line goes in it) */
export type Part = { key: string; label: string; tone: Tone; lines: Line[]; day?: string; lateLink?: boolean }
export const countOf = (parts: Part[]) => parts.reduce((n, p) => n + p.lines.length, 0)
const jobOfItem = (x: PlateItem) => x.t?.jobId || x.d?.jobId || x.job?.id || x.e?.jobId || x.ds?.[0]?.jobId || x.vs?.[0]?.job.id || x.ts?.[0]?.jobId
const asLine = (x: PlateItem): Line => ({ k: 'plate', key: x.key, x })
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
    add('overdue', 'Overdue', 'bad', rest.filter((x) => x.b === 'overdue').map(asLine), { lateLink: true })
    /* the day: the crew list first (until it's sent), then what's set for a time, then any time */
    add('today', 'Today', 'info', [...day.filter((x) => x.kind === 'crew'), ...day.filter((x) => x.kind !== 'crew')].map(asLine), { day: TODAY })
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

/** someone's list as they see it on their own Today — person left out: whoever is signed in; job: one project's */
export const partsOf = perData((s: Store, role: Role, person: PersonKey | null, view: View, job: string): Part[] => {
  const me = person ?? meOf(role)
  const inJob = (id?: string) => job === 'all' || id === job
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
    const waiting = s.tasks.filter((t) => !staleFollowUp(s, t) && inJob(t.jobId) && ((t.state === 'waiting' && isMine(t, role, me)) || follows(t)))
      .sort((a, b) => (taskIso(a) || '9999').localeCompare(taskIso(b) || '9999'))
    /* the GC's on their own: the admin sees every one, on every project; anyone else their own */
    const gc = role === 'owner' || role === 'pm' ? gcWaits(s).filter((t) => inJob(t.jobId)) : waiting.filter(isGcWait)
    const steps = Object.values(s.jobs).filter((j) => isGettingReady(j) && inJob(j.id)).flatMap((j) => stepsFor(s, j).filter((v) => v.state === 'wait' && v.owner === me).map((v): Line => ({ k: 'wait', key: `w:${j.id}:${v.key}`, job: j, v })))
    const ahead = waitsOnOthers(s, me).filter((x) => inJob(x.job?.id)).map((x): Line => ({ k: 'plate', key: 'a:' + x.key, x }))
    const rest: Line[] = [...waiting.filter((t) => !gc.includes(t)).map((t): Line => ({ k: 'task', key: t.id, t, as: 'waiting' })), ...steps, ...ahead]
    const out: Part[] = []
    if (gc.length) out.push({ key: 'gc', label: 'Waiting on the GC', tone: 'neutral', lines: gc.map((t): Line => ({ k: 'gc', key: 'g:' + t.id, t })) })
    if (rest.length) out.push({ key: 'others', label: 'Waiting on others', tone: 'neutral', lines: rest })
    return out
  }
  /* done: newest first */
  const done = s.tasks.filter((t) => t.state === 'done' && isMine(t, role, me) && inJob(t.jobId)).sort((a, b) => doneDay(b).localeCompare(doneDay(a)))
  return done.length ? [{ key: 'done', label: '', tone: 'neutral', lines: done.map((t): Line => ({ k: 'task', key: t.id, t, as: 'done' })) }] : []
})

/** the admin's Everyone: each person's list as on their own phone (you first) — and anything that's on nobody's */
export type Everyone = { people: { p: PersonKey; parts: Part[] }[]; nobody: Part[] }
export const everyoneOf = perData((s: Store, view: View, job: string): Everyone => {
  const me = meOf(s.role)
  const ppl = insidePeople(s)
  const roleOf = (p: PersonKey) => (s.team.find((m) => m.key === p)?.role as Role) || 'office'
  /* yours is your own list (with your check-ins); anyone else's, theirs */
  const who = (p: PersonKey): [Role, PersonKey | null] => (p === me ? [s.role, null] : [roleOf(p), p])
  const people = [...ppl.filter((p) => p === me), ...ppl.filter((p) => p !== me)].map((p) => ({ p, parts: partsOf(s, ...who(p), view, job) }))
  if (view !== 'today' && view !== 'tomorrow' && view !== 'later') return { people, nobody: [] }
  /* on nobody's list: a login nobody has, a spot left empty — said, so it isn't lost */
  const keys = new Set(ppl.flatMap((p) => plateNow(s, ...who(p)).map((x) => x.key)))
  const lost = teamPlateNow(s).filter((x) => !keys.has(x.key) && x.kind !== 'meet' && (job === 'all' || jobOfItem(x) === job))
  return { people, nobody: plateParts(collapse(lost), view) }
})
/** the number on Today in the menu — the same number the page shows on top, and the same things in the list */
export const todayCount = (s: Store, role: Role) => countOf(partsOf(s, role, null, 'today', 'all'))

function PlateRow({ x, showOwner, followed, overdue }: { x: PlateItem; showOwner?: boolean; followed?: boolean; overdue?: boolean }) {
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
  const late = overdue ? { text: x.iso ? md(x.iso) : 'Late', tone: 'bad' as const } : undefined
  if (x.kind === 'step') return <StepRowToday job={x.job!} v={x.v!} showOwner={showOwner} when={late || (x.v?.state === 'bad' ? { text: 'Problem', tone: 'bad' } : undefined)} />
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
function TeamToday({ who, pick }: { who: string; pick: (p: string) => void }) {
  const s = useStore()
  const rows = teamToday(s)
  if (!rows.length) return null
  return (
    <div className={cn('border-b border-line bg-[#fbfaf7] py-3', PX)} data-team-today>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[0.84375rem] font-semibold text-ink">The team today</span>
        <span className="min-w-0 truncate text-[0.75rem] text-muted">set for today · done · late (not done on its day) — tap a person for their list</span>
        {reportOn(s) && <button onClick={() => s.go({ page: 'team' })} className="ml-auto inline-flex shrink-0 items-center gap-1 text-[0.8125rem] font-semibold text-brand-700 hover:underline" data-report-link><Gauge className="h-3.5 w-3.5" />Team report</button>}
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => {
          const on = who === r.who
          const load = r.today + r.late
          return (
            <button key={r.who} onClick={() => pick(on ? 'all' : r.who)} aria-pressed={on} data-team-person={r.who} className={cn('flex min-w-[12.5rem] items-center gap-2.5 rounded-xl border bg-white px-3 py-2 text-left transition', on ? 'border-brand-400 ring-2 ring-brand-100' : 'border-line hover:border-[#d1cbc0]')}>
              <Avatar who={r.who} size={28} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[0.84375rem] font-semibold text-ink">{PEOPLE[r.who]?.short}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[0.75rem] tnum">
                  <span className="text-ink-2" title="Set for today">{r.today} today</span>
                  <span className="text-[#2c8a5b]" title="Done today">{r.done} done</span>
                  {r.late > 0 && <span className="font-semibold text-bad-600" title="Late — not done on its day">{r.late} late</span>}
                </span>
              </span>
              {load > 0 && <span className="h-6 w-1.5 shrink-0 overflow-hidden rounded-full bg-wash-2" aria-hidden><span className={cn('block w-full rounded-full', r.late ? 'bg-bad-500' : 'bg-brand-500')} style={{ height: `${Math.min(100, (r.done / Math.max(1, r.done + load)) * 100)}%` }} /></span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ================= the page ================= */
/* Mine: your own list, in the order it happens — what's late, then today hour by hour, then any time. The address under
 * each thing (on a computer, its own column). Nothing of anyone else's under it.
 * Everyone (the admin): one line a person — their number (the same number on their own phone) and how many are late.
 * Tap a person: their list opens under them, as they see it. */
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
  if (l.k === 'wait') return <StepRowToday job={l.job} v={l.v} showOwner when={waitWhen(l.v)} />
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
/** a list's lines — today's with the line for now between what's before it and what's after */
function Lines({ lines, me, day, showOwner }: { lines: Line[]; me: PersonKey; day?: string; showOwner?: boolean }) {
  const d = new Date()
  const nowMin = d.getHours() * 60 + d.getMinutes()
  let at = -1
  if (day === TODAY && lines.some(timedLine)) {
    const after = lines.findIndex((l) => timedLine(l) && (l.x.time ?? 0) > nowMin)
    at = after >= 0 ? after : lines.reduce((n, l, i) => (timedLine(l) ? i + 1 : n), 0)
  }
  return (
    <>
      {lines.map((l, i) => <React.Fragment key={l.key}>{i === at && <NowLine min={nowMin} />}<LineRow l={l} me={me} showOwner={showOwner} /></React.Fragment>)}
      {at === lines.length && <NowLine min={nowMin} />}
    </>
  )
}
/** a part of your list: its name and how many, then its lines */
function PartBlock({ p, me, showOwner }: { p: Part; me: PersonKey; showOwner?: boolean }) {
  const s = useStore()
  return (
    <section data-day={p.day || p.key} data-part={p.key}>
      {p.label && <Group label={p.label} count={p.lines.length} tone={p.tone} strong right={p.lateLink ? <button onClick={() => s.open({ t: 'late' })} data-late-open className="text-[0.8125rem] font-medium text-muted hover:text-brand-700">Move or remind<ChevronRight className="ml-0.5 inline h-3.5 w-3.5 align-[-0.15em]" /></button> : undefined} />}
      <Lines lines={p.lines} me={me} day={p.day} showOwner={showOwner} />
    </section>
  )
}
/** Everyone: a person — their number and how many are late; tap: their list, as they see it */
function PersonPart({ p, parts, open, onToggle, you }: { p: PersonKey | ''; parts: Part[]; open: boolean; onToggle: () => void; you: boolean }) {
  const n = countOf(parts)
  const late = parts.reduce((k, x) => k + x.lines.filter((l) => l.k === 'plate' && l.x.b === 'overdue').length, 0)
  const person = p ? PEOPLE[p] : undefined
  const name = you ? 'You' : person?.name || 'Nobody yet'
  return (
    <section data-person-group={p || 'none'} data-open={(open && n > 0) || undefined}>
      <button type="button" onClick={n ? onToggle : undefined} aria-expanded={n ? open : undefined} aria-label={`${name} — ${n}${late ? `, ${late} late` : ''}`}
        className={cn('flex min-h-12 w-full min-w-0 items-center gap-2.5 border-t border-line text-left transition', PX, n ? 'hover:brightness-[.985]' : 'cursor-default')}
        style={bandStyle('neutral')} data-band data-person-band={p || 'none'}>
        <span className="inline-flex w-4 shrink-0 justify-center text-[#6b6f78]">{n ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}</span>
        {person ? <Avatar who={p as PersonKey} size={26} /> : <span className="inline-flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-full bg-wash-2 text-faint"><UserRound className="h-3.5 w-3.5" /></span>}
        <span className={cn('min-w-0 flex-1 truncate text-[0.9375rem] font-semibold', n ? 'text-ink' : 'text-muted')} data-person-name>{name}</span>
        {late > 0 && <span className="shrink-0 text-[0.8125rem] font-semibold text-bad-600" data-person-late>{late} late</span>}
        <span className={cn('min-w-6 shrink-0 text-right text-[0.9375rem] font-semibold tnum', n ? 'text-ink-2' : 'text-faint')} data-person-count>{n}</span>
      </button>
      {open && n > 0 && <Lines lines={parts.flatMap((x) => x.lines)} me={(p || meOf(useStore.getState().role)) as PersonKey} />}
    </section>
  )
}

/* The jobs on a list — a chip each, with how many there. Tap one: just that job's things (on the site, everything for
 * the job you're at, in one tap); tap it again, or All: everything. One line: a phone swipes it sideways, a computer has
 * an arrow at the end when there are more than fit. */
const CHIP = 'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[0.8125rem] font-medium transition active:scale-[.98]'
const EDGE = 'absolute inset-y-0 hidden w-14 items-center text-ink-2 md:flex'
function JobChips({ jobs, value, total, onChange }: { jobs: { id: string; name: string; n: number }[]; value: string; total: number; onChange: (id: string) => void }) {
  const row = React.useRef<HTMLDivElement>(null)
  /* more than fit: an arrow at that end (a computer — a phone swipes) */
  const [edge, setEdge] = React.useState({ l: false, r: false })
  const measure = () => {
    const el = row.current
    if (!el) return
    const l = el.scrollLeft > 4
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdge((e) => (e.l === l && e.r === r ? e : { l, r }))
  }
  React.useEffect(() => {
    measure()
    const el = row.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [jobs.length])
  /* the one picked, in sight */
  React.useEffect(() => {
    const el = row.current
    const b = el?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!el || !b || el.scrollWidth <= el.clientWidth) return
    const l = b.offsetLeft - el.offsetLeft
    if (l < el.scrollLeft || l + b.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollTo({ left: Math.max(0, l - 48), behavior: 'smooth' })
  }, [value, jobs.length])
  const by = (d: number) => { const el = row.current; if (el) el.scrollBy({ left: d * Math.max(160, el.clientWidth * 0.7), behavior: 'smooth' }) }
  const chip = (id: string, label: string, n: number) => {
    const on = value === id
    return (
      <button key={id} type="button" aria-pressed={on} onClick={() => onChange(on && id !== 'all' ? 'all' : id)}
        className={cn(CHIP, on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-2 hover:bg-wash')} data-job-chip={id}>
        <span className="max-w-[13rem] truncate">{label}</span>
        <span className={cn('text-[0.75rem] font-semibold tnum', on ? 'text-white/80' : 'text-faint')}>{n}</span>
      </button>
    )
  }
  return (
    <div className="relative min-w-0 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] sm:max-md:w-full md:flex-1" data-job-chips-box>
      <div ref={row} onScroll={measure} role="group" aria-label="Jobs" className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] max-sm:px-4 [&::-webkit-scrollbar]:hidden" data-job-chips>
        {chip('all', 'All', total)}
        {jobs.map((j) => chip(j.id, j.name, j.n))}
      </div>
      {edge.l && <button type="button" aria-label="Earlier jobs" onClick={() => by(-1)} className={cn(EDGE, 'left-0 justify-start bg-gradient-to-r from-white from-40% to-transparent')} data-chips-back><ChevronLeft className="h-5 w-5" /></button>}
      {edge.r && <button type="button" aria-label="More jobs" onClick={() => by(1)} className={cn(EDGE, 'right-0 justify-end bg-gradient-to-l from-white from-40% to-transparent')} data-chips-more><ChevronRight className="h-5 w-5" /></button>}
    </div>
  )
}

export function MyTasksPage() {
  const s = useStore()
  const role = s.role
  const t0 = (s.route.tab as string) || 'today'
  /* the site manager's Today is just today, tomorrow and what he's waiting on */
  const simple = role === 'site'
  const [view, setView] = React.useState<View>(t0 === 'tomorrow' ? 'tomorrow' : t0 === 'waiting' ? 'waiting' : simple ? 'today' : t0 === 'done' ? 'done' : t0 === 'later' || t0 === 'coming' ? 'later' : 'today')
  /* everyone's lists are for the admin — every other login sees its own */
  const seesTeam = role === 'owner'
  const [scope, setScope] = React.useState<'mine' | 'all'>(t0 === 'team' && seesTeam ? 'all' : 'mine')
  const all = scope === 'all' && seesTeam
  const [job, setJob] = React.useState<string>('all')
  /* Everyone: who's open — none at first, kept while you're on the page */
  const [openP, setOpenP] = React.useState<string[]>([])
  const me = meOf(role)
  const views: View[] = simple ? ['today', 'tomorrow', 'waiting'] : ['today', 'tomorrow', 'later', 'waiting', 'done']
  /* each number is what its list shows — with a project picked, its */
  const mine = (v: View) => partsOf(s, role, null, v, job)
  const team = (v: View) => everyoneOf(s, v, job)
  const allDone = all ? s.tasks.filter((t) => t.state === 'done' && (job === 'all' || t.jobId === job)).sort((a, b) => doneDay(b).localeCompare(doneDay(a))) : []
  /* how many on a list — for one job, or all of them: what it shows when it's picked */
  const nFor = (v: View, j: string) => (!all ? countOf(partsOf(s, role, null, v, j)) : v === 'done' ? s.tasks.filter((t) => t.state === 'done' && (j === 'all' || t.jobId === j)).length : (() => { const e = everyoneOf(s, v, j); return e.people.reduce((k, x) => k + countOf(x.parts), 0) + countOf(e.nobody) })())
  const n = (v: View) => nFor(v, job)
  /* the jobs on this list, a chip each with how many there — by name; the one picked stays, even with nothing left */
  const byName = (a: Job, b: Job) => a.name.localeCompare(b.name, undefined, { numeric: true })
  const chips = Object.values(s.jobs).sort(byName).map((j) => ({ id: j.id, name: j.name, n: nFor(view, j.id) })).filter((x) => x.n > 0 || x.id === job)
  const picked = job !== 'all' ? s.jobs[job] : undefined
  const [doneN, setDoneN] = React.useState(40)
  const parts = all ? [] : mine(view)
  const ev = all && view !== 'done' ? team(view) : null
  const peopleShown = ev ? [...ev.people.map((x) => ({ p: x.p as PersonKey | '', parts: x.parts })).filter((x) => job === 'all' || countOf(x.parts) > 0), ...(countOf(ev.nobody) ? [{ p: '' as const, parts: ev.nobody }] : [])] : []
  const withN: string[] = peopleShown.filter((x) => countOf(x.parts) > 0).map((x) => x.p || 'none')
  const toggle = (k: string) => setOpenP((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]))
  /* a job picked on Everyone: whoever has something there, open — it's a few lines; back to All: closed again */
  const withNNow = React.useRef(withN)
  withNNow.current = withN
  React.useEffect(() => { setOpenP(job === 'all' ? [] : withNNow.current) }, [job, scope])
  /* whose each line is: on Waiting on others (who has it now), and everyone's Done */
  const whoCol = view === 'waiting' || (all && view === 'done')
  const empty: Record<View, { title: string; sub: string }> = {
    today: { title: 'Nothing due today', sub: n('tomorrow') ? `${n('tomorrow')} for tomorrow — see Tomorrow.` : 'New work lands here the moment it’s yours.' },
    tomorrow: { title: 'Nothing for tomorrow yet', sub: 'Anything due tomorrow, and tomorrow’s meetings, show here.' },
    later: { title: 'Nothing later', sub: 'Anything with a date after tomorrow shows here, day by day.' },
    waiting: { title: 'Nothing waiting on others', sub: 'What you asked someone for, what you follow, and what’s out with the GC or a supplier waits here until it’s done.' },
    done: { title: 'Nothing done yet', sub: 'Finished tasks stay here for the record.' },
  }
  const doneLines = all ? allDone : view === 'done' ? (parts[0]?.lines || []).map((l) => (l.k === 'task' ? l.t : null)).filter((t): t is Task => !!t) : []

  return (
    <Page
      title={`${greeting()}, ${PEOPLE[me].short}`}
      phoneTitle
      sub={TODAY_LABEL}
      top={<>
        <Bubbles
          /* a phone: the five on one row — the list starts right under them */
          row
          items={[
            { key: 'today', label: 'Today', count: n('today'), icon: <ListTodo />, color: 'blue', on: view === 'today', onClick: () => setView('today') },
            { key: 'tomorrow', label: 'Tomorrow', count: n('tomorrow'), icon: <CalendarDays />, color: 'violet', on: view === 'tomorrow', onClick: () => setView('tomorrow') },
            /* the site manager: today, tomorrow and what he's waiting on — that's all he needs on the go */
            ...(simple ? [] : [{ key: 'later', label: 'Later', count: n('later'), icon: <CalendarRange />, color: 'slate', on: view === 'later', onClick: () => setView('later') }] as any[]),
            { key: 'waiting', label: 'Waiting on others', short: 'Waiting', count: n('waiting'), icon: <Hourglass />, color: 'amber', on: view === 'waiting', onClick: () => setView('waiting'), gapBefore: true },
            ...(simple ? [] : [{ key: 'done', label: 'Done', count: n('done'), icon: <CircleCheckBig />, color: 'green', on: view === 'done', onClick: () => setView('done') }] as any[]),
          ]}
        />
      </>}
      toolbar={
        /* Mine / Everyone (the admin's), then the jobs on the list: on a computer one line, on a phone the jobs on a line
           of their own that swipes sideways. Nothing to pick: no empty box */
        <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2" data-bar-phone-empty={!seesTeam && chips.length === 0 ? '' : undefined} data-today-bar>
          {seesTeam && (
            <div className="flex min-w-0 items-center gap-2 max-sm:w-full [@media(max-width:22rem)]:flex-wrap">
              <ViewSwitch label="Whose list" value={scope} onChange={(k) => setScope(k)} items={[{ key: 'mine', label: 'Mine', icon: <UserRound /> }, { key: 'all', label: 'Everyone', icon: <Users /> }]} className={PHONE_SHARE} />
              {ev && withN.length > 0 && <span className="shrink-0 px-1"><OpenAllLink any={openP.some((k) => withN.includes(k))} onOpen={() => setOpenP(withN)} onClose={() => setOpenP([])} /></span>}
            </div>
          )}
          {chips.length > 0 && <JobChips jobs={chips} value={job} total={nFor(view, 'all')} onChange={setJob} />}
        </div>
      }
    >
      <WhoCol.Provider value={whoCol}>
      {/* one job picked: its name on top — everything else about it is one tap away, on the project */}
      {picked && (
        <div className={cn('flex min-h-12 min-w-0 items-center gap-3', PX)} data-job-line={picked.id}>
          <Building2 className="h-[1.125rem] w-[1.125rem] shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate text-[0.9375rem]"><b className="font-semibold text-ink">{picked.name}</b>{picked.client && <span className="text-muted max-sm:hidden"> · {picked.client}</span>}</span>
          <button type="button" onClick={() => s.open({ t: 'job', id: picked.id })} className="inline-flex shrink-0 items-center text-[0.875rem] font-semibold text-brand-700 hover:underline" data-job-open>Open the project<ChevronRight className="ml-0.5 h-4 w-4" /></button>
        </div>
      )}
      {/* the columns: What · Project · Whose (Waiting on others, everyone's Done) · When — the same space between them */}
      <InJob.Provider value={!!picked}>
      <div data-even-list data-list-scope={all ? 'everyone' : 'mine'} style={{ '--list': todoList(whoCol, !!picked) } as React.CSSProperties}>
        {/* Mine: your list, part by part */}
        {!all && view !== 'done' && parts.map((p) => <PartBlock key={p.key} p={p} me={me} showOwner={view === 'waiting'} />)}
        {/* Everyone: a line a person — tap one for their list */}
        {ev && peopleShown.map((x) => <PersonPart key={x.p || 'none'} p={x.p} parts={x.parts} you={x.p === me} open={openP.includes(x.p || 'none')} onToggle={() => toggle(x.p || 'none')} />)}
        {/* done: newest first, a page at a time — done work piles up for the record */}
        {view === 'done' && doneLines.slice(0, doneN).map((t) => <TaskRow key={t.id} t={t} showOwner={all} />)}
        {view === 'done' && doneLines.length > doneN && <button onClick={() => setDoneN(doneN + 40)} className={cn('w-full border-t border-line-2 py-3 text-left text-[0.84375rem] font-semibold text-brand-700 hover:bg-brand-50/40', PX)}>Show older — {doneLines.length - doneN} more</button>}
        {n(view) === 0 && <EmptyState icon={<Check />} title={empty[view].title} sub={empty[view].sub} />}
      </div>
      </InJob.Provider>
      </WhoCol.Provider>
    </Page>
  )
}

/** followed up — still waiting: what they said, and the day it's back. It's off the list until then; it isn't done. */
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
      ;(x.log ||= []).push({ date: NOW, who: meOf(st.role), text: `Followed up${note.trim() ? ` — ${note.trim()}` : ''} · back ${day}` })
    }, `Followed up — back ${day}`, { tone: 'wait', sub: 'Off the list until then — it isn’t done until it comes.' })
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
  const said = first?.text ? ` — ${first.text.charAt(0).toLowerCase()}${first.text.slice(1)}` : ''
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
  }, `Reminder sent to ${PEOPLE[t.owner]?.short || 'them'}`, { sub: mine ? 'It pops up on their screen, and it’s on their Today.' : 'It pops up on their screen. It’s off your Today — back tomorrow if it isn’t done.', undo: false })
}
/** off my Today for now: I reminded its person — it's back tomorrow if it isn't done */
export const quietForMe = (t: Task, me: PersonKey | null) => !!me && (t.quiet?.[me] || '') > TODAY

/* ================= one task: the same window as a step — what it is, whose it is, when =================
 * On top (the same as every window): the project, the task, whose it is and when. Under it what it's about and the
 * newest note — every note one tap away. No sentences explaining how it works. At the bottom: yours — Done (or its own
 * button), Not today, Waiting on someone; someone else's — Remind them, Follow it (you hear when it moves, and it waits
 * under Waiting on others until it's done), and the admin can take it over. Changing the task itself is in ··· : its
 * person moves its day; the admin also hands it to someone else, sets who follows it and puts it on everyone's Today. */
export function TaskModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const t = s.tasks.find((x) => x.id === id)
  const [waitOpen, setWaitOpen] = React.useState(false)
  /* a change from ··· opens in place of the task, with Back to it */
  const [panel, setPanel] = React.useState<null | 'follow' | 'share' | 'later' | 'wait' | 'answer'>(null)
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
    t.state === 'now' ? { text: b === 'overdue' ? (/late/i.test(t.due || '') ? t.due! : `Was due ${t.due}`) : b === 'today' ? 'Due today' : t.due ? `Due ${t.due}` : 'No date', cls: b === 'overdue' ? 'text-bad-700' : b === 'today' ? 'text-warn-700' : 'text-ink-2' }
      : t.state === 'waiting' ? { text: `Waiting on ${t.waitingOn || 'someone'} · back ${t.followUp}`, cls: 'text-warn-700' }
        : t.state === 'later' ? { text: `Set aside · back ${t.laterUntil}`, cls: 'text-ink-2' }
          : { text: `Done${t.doneAt ? ` ${t.doneAt}` : ''}`, cls: 'text-[#2c8a5b]' }
  /* one button at the bottom — whose it is and its day are tapped right on top; the rest is here */
  const following = followersOf(t).includes(me)
  const items: React.ReactNode[] = [
    !theirs && t.state === 'now' && <MenuItem key="later" icon={<MoonStar className="h-4 w-4" />} onSelect={() => setPanel('later')} data-task-later>Not today</MenuItem>,
    !theirs && t.state === 'now' && <MenuItem key="wait" icon={<Clock3 className="h-4 w-4" />} onSelect={() => setPanel('wait')} data-task-wait>Waiting on someone</MenuItem>,
    t.owner !== me && t.state !== 'done' && <MenuItem key="me" icon={<Eye className="h-4 w-4" />} checked={following} onSelect={() => toggleFollow(t.id, me)} data-follow-task>Follow it</MenuItem>,
    admin && <MenuItem key="follow" icon={<Eye className="h-4 w-4" />} onSelect={() => setPanel('follow')}>Who follows it</MenuItem>,
    /* two can have it — whoever gets to it first */
    (admin || t.owner === me || !!t.also?.includes(me)) && t.state !== 'done' && <MenuItem key="share" icon={<Users className="h-4 w-4" />} onSelect={() => setPanel('share')}>Share it — whoever gets to it first</MenuItem>,
    admin && t.state !== 'done' && <MenuItem key="all" icon={<Megaphone className="h-4 w-4" />} checked={!!t.everyone} onSelect={() => setEveryone(t.id, !t.everyone)}>On everyone’s Today</MenuItem>,
    job && <MenuItem key="job" icon={<Building2 className="h-4 w-4" />} onSelect={() => s.open({ t: 'job', id: job.id })}>Open {job.name}</MenuItem>,
    /* a task someone added by hand can go — the app's own come and go by themselves */
    admin && !t.step && !t.action && <MenuItem key="del" danger icon={<Trash2 className="h-4 w-4" />} onSelect={() => { removeTask(t.id); s.closeLevel(level) }} data-task-remove>Remove it</MenuItem>,
  ].filter(Boolean)
  const people = insidePeople(s).length ? insidePeople(s) : ASSIGNABLE
  const more = items.length > 0 && (
    <Menu align="end" width={250} trigger={<button aria-label="More" title="More" data-task-more className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-wash hover:text-ink"><MoreHorizontal className="h-[1.125rem] w-[1.125rem]" /></button>}>
      {items}
    </Menu>
  )

  /* waiting on the GC: the day it's needed by, tapped to change; what's wrong in red */
  const gcw = isGcWait(t) ? gcState(t) : undefined
  const start = gcw ? startOf(s, job) : undefined
  const header = (
    <WinHead
      place={<>{job ? job.name : 'Company'}{t.where && t.where.trim() !== job?.name ? ` · ${t.where}` : ''}</>}
      title={cleanTitle(t.title, job)}
      who={t.owner}
      whoText={<span data-task-owner>{t.also?.length ? `${[t.owner, ...t.also].map((p) => (p === me ? 'You' : PEOPLE[p]?.short || p)).join(' and ')} — whoever gets to it first` : t.owner === me ? 'Yours' : `${owner} has it`}</span>}
      state={gcw ? <span data-task-when data-gc-needby={t.needBy || ''}>{t.needBy ? `Needed by ${dayShort(t.needBy)}` : 'No day it’s needed by'}</span> : <span data-task-when>{when.text}</span>}
      tone={gcw ? 'warn' : b === 'overdue' && t.state === 'now' ? 'late' : t.state === 'waiting' || (b === 'today' && t.state === 'now') ? 'warn' : t.state === 'done' ? 'ok' : undefined}
      extra={!gcw && t.repeat ? `${REPEAT_LABEL[t.repeat]}${t.repeatAt ? ` at ${t.repeatAt}` : ''}` : undefined}
      problem={gcw?.flag ? <span data-gc-flag>{gcw.text}</span> : t.blocks && t.state !== 'done' ? `Holds up ${t.blocks.charAt(0).toLowerCase() + t.blocks.slice(1)}` : undefined}
      more={more || undefined}
      attrs={theirs && t.state !== 'done' ? { 'data-theirs-task': '' } : undefined}
      /* the admin gives it to someone else — or takes it over — right here; its day moves the same way */
      whoPick={admin && t.state !== 'done' ? { people, me, current: t.owner, onPick: (p) => s.reassignTask(t.id, p) } : undefined}
      whenPick={gcw && (!theirs || admin) ? { title: 'Needed by', value: t.needBy ? labelFromIso(t.needBy) : undefined, presets: Array.from(new Set([...(start && start >= TODAY ? [labelFromIso(start)] : []), 'Next Mon', 'In 2 weeks'])), onPick: (d) => setNeedBy(t.id, isoFromLabel(d)) } : canDate ? { value: t.due, onPick: (d) => s.setTaskDue(t.id, d) } : undefined}
    />
  )

  const footer = panel === 'answer' ? undefined : panel ? (
    <Button variant="ghost" icon={<ChevronLeft />} onClick={() => setPanel(null)} data-task-back>Back</Button>
  ) : t.state === 'done' ? (
    (!theirs || admin) ? <Button className="ml-auto" icon={<RotateCcw />} onClick={() => s.reopenTask(t.id)} data-reopen-task>Reopen</Button> : undefined
  ) : theirs ? (
    <Button variant="primary" className="ml-auto max-sm:flex-1" icon={<BellRing />} onClick={() => { remindTask(t); s.close() }} data-remind-task>Remind {owner}</Button>
  ) : gcw ? (
    <>
      <Button variant="ghost" icon={<MessageSquareReply />} onClick={() => setPanel('answer')} data-gc-answered>They answered</Button>
      <Button variant="primary" className="ml-auto max-sm:flex-1" icon={<Send />} onClick={() => { openWhatsApp(gcMessage(s, t)); askedGc(t.id); s.close() }} data-gc-send>{askLabel(t)}</Button>
    </>
  ) : (
    <>
      {t.state === 'waiting' ? (
        <Pop open={waitOpen} onOpenChange={setWaitOpen} side="top" width={380} trigger={<Button variant="ghost" icon={<Hourglass />} data-followed-up>Followed up — still waiting</Button>}>
          <FollowedUp t={t} onDone={() => { setWaitOpen(false); s.close() }} />
        </Pop>
      ) : t.state !== 'now' ? (
        <Button variant="ghost" icon={<RotateCcw />} onClick={() => s.reopenTask(t.id)}>Back on my list</Button>
      ) : null}
      {hasAction ? (
        <Button variant="primary" className="ml-auto max-sm:flex-1" onClick={() => runTaskAction(t)}>{t.action!.label}</Button>
      ) : (
        isRequest(t) && t.owner === meOf(s.role) ? <span className="ml-auto max-sm:flex-1"><TripButtons t={t} size="md" onDone={() => s.close()} /></span> : <Button variant="primary" className="ml-auto max-sm:flex-1" icon={isRequest(t) ? <Truck /> : <Check />} onClick={() => { s.completeTask(t.id); s.close() }}>{isRequest(t) ? 'Dropped off' : 'Done'}</Button>
      )}
    </>
  )

  const body = panel === 'answer' ? (
    <GcAnswer t={t} onDone={() => s.close()} onBack={() => setPanel(null)} />
  ) : panel === 'later' ? (
    <div data-task-panel="later"><LaterPicker onSave={(u) => { s.laterTask(t.id, u); s.close() }} /></div>
  ) : panel === 'wait' ? (
    <div data-task-panel="wait"><WaitPicker defaultWho={t.waitingOn} onSave={(w, bk) => { s.waitTask(t.id, w, bk); s.close() }} /></div>
  ) : panel === 'share' ? (
    <div data-task-panel="share">
      <div className="text-[0.9375rem] font-semibold text-ink">Who else can do it</div>
      <div className="mb-3 mt-0.5 text-[0.8125rem] text-muted">It’s on their Today too — whoever does it first closes it for both.</div>
      <div className="flex flex-wrap gap-1.5">
        {people.filter((p) => p !== t.owner).sort((a, b) => Number(b === me) - Number(a === me)).map((p) => <Chip key={p} on={(t.also || []).includes(p)} onClick={() => toggleAlso(t.id, p)} className="h-9 px-3" icon={<Avatar who={p} size={20} />}>{p === me ? 'Me' : PEOPLE[p]?.short || p}</Chip>)}
      </div>
    </div>
  ) : panel === 'follow' ? (
    <div data-task-panel="follow">
      <div className="text-[0.9375rem] font-semibold text-ink">Who follows it</div>
      <div className="mb-3 mt-0.5 text-[0.8125rem] text-muted">They see it and hear when it moves — {t.owner === me ? 'you' : owner} still {t.owner === me ? 'do' : 'does'} it.</div>
      <div className="flex flex-wrap gap-1.5">
        {/* you first, as "Me" — two people can share a first name */}
        {people.filter((p) => p !== t.owner).sort((a, b) => Number(b === me) - Number(a === me)).map((p) => <Chip key={p} on={followersOf(t).includes(p)} onClick={() => toggleFollow(t.id, p)} className="h-9 px-3" icon={<Avatar who={p} size={20} />}>{p === me ? 'Me' : PEOPLE[p]?.short || p}</Chip>)}
      </div>
    </div>
  ) : (
    <>
      {t.state === 'done' && t.result && <p className="flex items-start gap-2 text-[0.875rem] leading-relaxed text-ink" data-task-result><Check className="mt-1 h-4 w-4 shrink-0 text-[#2c8a5b]" />{t.result}</p>}
      {gcw && <p className="flex items-center gap-1.5 text-[0.8125rem] text-muted" data-gc-sofar><Hourglass className="h-3.5 w-3.5 shrink-0 text-warn-600" /><span><b className="font-medium text-warn-700">Waiting on the GC</b> · {gcSoFar(t, false)}</span></p>}
      {gcw && !theirs && <div className="mt-3"><GcMessageBox t={t} /></div>}
      {t.detail && <p className={cn('text-[0.875rem] leading-relaxed text-ink-2', t.state === 'done' && t.result && 'mt-3', gcw && 'mt-3')} data-task-detail>{t.detail}</p>}
      {/* only what people wrote — what the app did (Created, Reminded, Moved…) isn't a note — newest first, right here;
          one quiet box to add one. The same on a step */}
      <Notes kind="task" me={me} notes={notesOnly} onAdd={t.state !== 'done' ? (x) => s.noteTask(t.id, x) : undefined} className={cn((t.detail || gcw || (t.state === 'done' && t.result)) && 'mt-4')} />
    </>
  )

  return (
    <Modal level={level} size="sm" onClose={s.close} header={header} footer={footer} title={t.title} bodyClass="px-6 pb-4 pt-3 max-sm:px-4">
      {body}
    </Modal>
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
  { t: 'Order the setting materials', for: ['owner', 'pm', 'office', 'materials'] },
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
    s.addTask({ jobId: job, title: clean, type: guessType(title), owner, also: shared ? owners.slice(1) : undefined, due: repeat ? 'Today' : due, for: fors, state: 'now', tone: urgent ? 'bad' : 'info', urgent: urgent || undefined, repeat: repeat || undefined, repeatAt: repeat ? at : undefined, where: repeat ? `${REPEAT_LABEL[repeat]} at ${at}` : msg ? 'From a message' : undefined, detail: msg ? `From ${PEOPLE[msg.who]?.name || 'someone'} in the project messages, ${msg.date} ${msg.time}: “${msg.text}”` : undefined, followers: !owners.includes(me) ? [me] : undefined })
    if (msg && jobId) markMessageTask(jobId, msg.id)
    s.close()
  }
  /* who: you first, as "Me"; everyone else by their whole name (two can share a first name) */
  const whoOptions = [me, ...team.filter((p) => p !== me)].map((p) => ({ key: p as string, label: p === me ? 'Me' : PEOPLE[p]?.name || p, hint: p === me ? undefined : PEOPLE[p]?.roleLabel, lead: <Avatar who={p} size={20} /> }))
  /* the whole name, as on the list — two people can share a first name (two Yaakovs) */
  const nameOf = (p: PersonKey) => (p === me ? 'Me' : PEOPLE[p]?.name || p)
  const whoWord = owners.map(nameOf).join(' and ')
  /* when: a day, or every day / week / month (then the time beside it) */
  const days: [string, string][] = [...WHEN, ...(WHEN.some(([k]) => k === due) ? [] : [[due, DAY_NAME[due] || due] as [string, string]])]
  const whenOptions = [...days.map(([k, l]) => ({ key: k, label: l })), ...(Object.keys(REPEAT_LABEL) as NonNullable<Task['repeat']>[]).map((r) => ({ key: 'r:' + r, label: REPEAT_LABEL[r], hint: 'Comes back by itself' }))]
  const whenValue = repeat ? 'r:' + repeat : due
  const whenWord = repeat ? REPEAT_LABEL[repeat] : WHEN.find(([k]) => k === due)?.[1] || DAY_NAME[due] || due
  const pickWhen = (k: string) => { if (k.startsWith('r:')) setRepeat(k.slice(2) as NonNullable<Task['repeat']>); else { setRepeat(''); setDue(k); setPicked(true) } }
  const whoChip = (
    <button type="button" aria-label="Who does it" className={cn(PICK_CHIP, 'pl-1.5', owner !== me && 'text-ink')}>
      <span className="flex -space-x-1.5">{owners.slice(0, 3).map((p) => <Avatar key={p} who={p} size={22} ring />)}</span>
      <span className="min-w-0 truncate">{whoWord}</span><ChevronDown className="!h-3.5 !w-3.5 !text-faint" />
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
      <SuggestInput value={title} onChange={onTitle} onEnter={add} suggestions={common} label="What needs to be done?" placeholder="What needs to be done?" listLabel="The usual ones — tap to pick" className="[&_input]:h-12 [&_input]:text-[1rem]" />
      {/* the usual answers, as chips — change one only when it's wrong */}
      <div className="mt-3 flex flex-wrap items-center gap-2" data-task-chips>
        <ProjectChip value={job} onChange={(k) => { setJob(k); setJobPicked(true); setHeard('') }} keep={(j) => projects.includes(j)} />
        <span className="contents" data-task-who={owners.join(',')}>
          {several
            ? <MultiSelect label="Who does it" values={owners} options={whoOptions} onChange={(ks) => { setWhoPicked(true); setOwners((ks.length ? ks : [me]) as PersonKey[]) }} autoOpen width={340} trigger={whoChip} />
            : <SearchSelect label="Who does it" value={owner} options={whoOptions} onChange={(p) => { setWhoPicked(true); setOwners([p as PersonKey]) }} search={whoOptions.length > 8} width={340} trigger={whoChip} footer={{ label: 'More than one person — whoever gets to it first', onClick: () => setSeveral(true) }} />}
        </span>
        <span className="contents" data-task-when={whenValue}>
          <SearchSelect label="When" value={whenValue} options={whenOptions} onChange={pickWhen} search={false} width={280} trigger={<button type="button" aria-label="When" className={cn(PICK_CHIP, (due !== 'Today' || repeat) && 'text-ink')}><CalendarDays /><span className="min-w-0 truncate">{whenWord}</span><ChevronDown className="!h-3.5 !w-3.5 !text-faint" /></button>} />
          {repeat && <SearchSelect label="At" value={at} options={['8 AM', 'Noon', '4 PM', '6 PM'].map((x) => ({ key: x, label: `at ${x}` }))} onChange={setAt} search={false} width={160} trigger={<button type="button" aria-label="At" className={PICK_CHIP}><Clock3 /><span>at {at}</span><ChevronDown className="!h-3.5 !w-3.5 !text-faint" /></button>} />}
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
  const boss = PEOPLE[meOf('owner')]?.short || 'the office'
  /* the day it's for: the one it was opened for, else today's until 3 and the next work day's after */
  const [day] = React.useState(() => day0 || crewDay())
  const today = day === TODAY_ISO
  /* filled in: that day's booking, else what was planned for it, else the last report — 2 when nothing's known */
  const [rows, setRows] = React.useState(() => crewsOn(s, day).map((c) => { const j = s.jobs[c.jobId]; return { jobId: c.jobId, crew: c.crew as PersonKey, workers: c.workers ?? (j?.crewPlan?.day === day ? j.crewPlan.workers : undefined) ?? j?.onSite?.workers ?? 2, note: '' } }))
  const [adding, setAdding] = React.useState(false)
  const [addJob, setAddJob] = React.useState('')
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
      sub={`${dayShort(day)} · how many people on each project — it goes to ${boss}`}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted max-sm:hidden">{on} {on === 1 ? 'project' : 'projects'} · {people} {people === 1 ? 'person' : 'people'}</span>
          <Button className="ml-auto max-sm:hidden" variant="ghost" onClick={s.close}>Later</Button>
          <Button variant="primary" className={cn(small && 'h-12 flex-1 text-[1rem]')} disabled={!rows.length} onClick={() => { sendCrewReport(taskId, rows, day); s.close() }} data-crew-send>{small ? `Send · ${people} ${people === 1 ? 'person' : 'people'}` : 'Send'}</Button>
        </>
      }
    >
      <div className="-mx-6 -my-5 max-sm:-mx-4" data-crew-report>
        {rows.map((r, i) => {
          const j = s.jobs[r.jobId]
          return (
            <div key={r.jobId} className={cn('flex items-center gap-3 border-b border-line-2 px-6 py-3.5 max-sm:flex-wrap max-sm:px-4', r.workers === 0 && 'bg-wash/60')} data-crew-job={r.jobId}>
              <Avatar who={r.crew} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.9375rem] font-semibold text-ink">{j?.name}</div>
                <div className={cn('text-[0.8125rem]', r.workers === 0 ? 'font-medium text-warn-700' : 'text-muted')}>{r.workers === 0 ? (today ? 'Nobody there today' : 'Nobody there') : `${PEOPLE[r.crew]?.name || 'The crew'}`}</div>
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
    </Modal>
  )
}
