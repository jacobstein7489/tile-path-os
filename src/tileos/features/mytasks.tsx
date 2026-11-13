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
  const open = () => s.open({ t: 'dailies', who: x.who })
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
      project={vs.map((y) => y.job.name).join(', ')}
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

/** the admin's: what's late on the team past the company's line — and what you asked for or follow that's due today or
 *  late — its own part of Today, by person: each one's circle and name once, then their things, one line each: the
 *  project, what, how late. A late line opens the check-in with them; a followed one opens the task. */
/* The team, on Today — what each of ours has today and what's late, across every project, so nobody has to open
 * project after project to see what's going on. The admin sees everyone; anyone else sees what's theirs to care about:
 * what they asked for or follow, and the steps someone else has to do before their own. Each person once (their circle
 * and name), then their things: what, the project, when — late in red. Tap one: its own window. Late past the company's
 * line: Check in, beside their name. */
const TEAM_KINDS = new Set(['task', 'step', 'steps', 'trips'])
function TeamSection({ rows }: { rows: PlateItem[] }) {
  const s = useStore()
  if (!rows.length) return null
  const toCheck = new Set(checkIns(s).map((g) => g.who))
  const order = [...insidePeople(s), ...ASSIGNABLE]
  const rank = (p: string) => { const i = order.indexOf(p as PersonKey); return i < 0 ? 999 : i }
  const people = Array.from(new Set(rows.map((x) => x.who || ''))).filter(Boolean).sort((a, b) => rank(a) - rank(b))
  const first = (a: PlateItem, b: PlateItem) => Number(b.b === 'overdue') - Number(a.b === 'overdue') || (a.iso || '9999').localeCompare(b.iso || '9999')
  return (
    <section data-day="checkin" data-checkins data-team>
      <Group label="The team" count={rows.length} tone="neutral" strong />
      {people.map((who) => (
        <div key={who} data-checkin-person={who} data-contents>
          <div className={cn('flex min-w-0 items-center gap-2 pb-0.5 pt-3', PX)} data-checkin-who>
            <Avatar who={who as PersonKey} size={22} />
            <span className="truncate text-[0.875rem] font-semibold text-ink">{PEOPLE[who as PersonKey]?.short || 'Someone'}</span>
            {toCheck.has(who as PersonKey) && <button type="button" onClick={() => s.open({ t: 'checkin', who: who as PersonKey })} className="ml-auto shrink-0 text-[0.8125rem] font-medium text-brand-700 hover:underline" data-checkin-open>Check in</button>}
          </div>
          {rows.filter((x) => x.who === who).sort(first).map((x) => <TeamRow key={x.key} x={x} />)}
        </div>
      ))}
    </section>
  )
}
/** one of someone else's things: how late (in work days), or today — reminded lately, it says so quietly */
function TeamRow({ x }: { x: PlateItem }) {
  const s = useStore()
  if (x.kind === 'steps') return <div data-checkin-row={x.who} data-contents><StepsRow x={x} /></div>
  if (x.kind === 'trips') return <div data-checkin-row={x.who} data-contents><TripsRow x={x} /></div>
  const n = x.b === 'overdue' && x.iso ? workdaysBetween(x.iso, TODAY) : 0
  const ci = x.kind === 'task' ? x.t?.checkIn : x.job && x.v ? s.stepRecs[x.job.id]?.[x.v.key]?.checkIn : undefined
  const handled = ci && workdaysBetween(ci.day, TODAY) < checkInDays(s) ? `${x.kind === 'task' && x.t?.nudge?.day !== ci.day ? 'Checked in' : 'Reminded'} ${ci.day === TODAY ? 'today' : md(ci.day)}` : undefined
  const when: { text: string; tone?: 'bad' | 'warn' | 'strong' | 'quiet' } = x.kind === 'step' && x.v?.state === 'bad' ? { text: 'Problem', tone: 'bad' }
    : x.t?.urgent ? { text: 'Urgent', tone: 'bad' }
      : handled ? { text: handled, tone: 'quiet' }
        : x.b === 'overdue' ? { text: n > 0 ? `${n} ${n === 1 ? 'day' : 'days'} late` : 'Late', tone: 'bad' }
          : { text: 'Anytime', tone: 'quiet' }
  return (
    <div data-checkin-row={x.who} data-contents>
      {x.kind === 'step' ? <StepRowToday job={x.job!} v={x.v!} when={when} /> : <TaskRow t={x.t!} when={when} />}
    </div>
  )
}
/* Waiting on the GC, on the admin's Today — every open one on every project, one line each: what (and who has it, and
 * what the GC said last), the project, where it stands: the days left, quiet — red only when something's wrong (the GC
 * wasn't told the same day, a reminder was skipped, the GC missed his day, a week out and not done). Tap one: its
 * window — Remind its person from there. */
function GcSection({ list }: { list: Task[] }) {
  return (
    <section data-gc-waits>
      <Group label="Waiting on the GC" count={list.length} tone="neutral" strong />
      {list.map((t) => <GcRow key={t.id} t={t} />)}
    </section>
  )
}
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
  if (role === 'owner' && (!me || me === meOf('owner')) && roundsOn(s) && ![0, 6].includes(dow(TODAY)) && roundsToday(s, me || meOf('owner')).left > 0) out.push({ key: 'rounds', b: 'today', iso: TODAY, time: null, kind: 'rounds', who: me || meOf('owner') })
  /* each project's daily update is its own site manager's — the real person, never the built-in "Yakov" spot */
  dailyDue(s, role).forEach((d) => { const who = siteOf(s, s.jobs[d.jobId]); out.push(d.missed ? { key: 'dm' + d.jobId, b: 'overdue', iso: d.missed, time: null, kind: 'daily', d, who } : { key: 'd' + d.jobId, b: 'today', iso: TODAY, time: 17 * 60, kind: 'daily', d, who }) })
  if ((!me || me === meOf('owner')) && (role === 'owner' || role === 'pm') && payDue(s)) out.push({ key: 'pay', b: 'today', iso: TODAY, time: null, kind: 'pay', who: meOf('owner') })
  if ((!me || me === meOf('accounting')) && role === 'accounting' && billingOn(s) && billsToMake(s).length) out.push({ key: 'bill', b: 'today', iso: TODAY, time: null, kind: 'bill', who: meOf('accounting') })
  /* the admin's: who on the team to check in on — late past the company's line (its own part of Today) */
  if (person === undefined && reportOn(s)) checkIns(s).forEach((g) => g.items.forEach((c) => out.push({ key: 'ci:' + c.key, b: 'today', iso: TODAY, time: null, kind: 'checkin', ci: { who: g.who, items: [c] }, who: meOf(role) })))
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
/* One line for each thing, with its project: tap it and that one opens — nothing to open a list first (each daily
 * update, each Receive the tile, each Order our materials is its own line, and it's gone the moment it's done). Only
 * what's to be brought to the jobs rides together: one trip, every pickup in it. */
const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'aside']
export function collapse(items: PlateItem[]): PlateItem[] {
  const out: PlateItem[] = []
  const trips = new Map<string, PlateItem[]>()
  const add = (m: Map<string, PlateItem[]>, k: string, x: PlateItem) => m.set(k, [...(m.get(k) || []), x])
  items.forEach((x) => {
    /* what's to be brought — today's (and late) together; a day ahead stays with that day */
    if (x.kind === 'task' && x.t && isRequest(x.t) && x.t.state === 'now' && !x.t.urgent) return add(trips, `${x.who || x.t.owner}|${isNow(x.b) ? 'now' : x.b}`, x)
    out.push(x)
  })
  const first = (xs: PlateItem[]) => xs.reduce((a, x) => (BUCKET_ORDER.indexOf(x.b) < BUCKET_ORDER.indexOf(a.b) || (x.b === a.b && (x.iso || '9') < (a.iso || '9')) ? x : a))
  trips.forEach((xs, k) => {
    if (xs.length < 2) return out.push(...xs)
    const f = first(xs)
    out.push({ key: 'trips:' + k, b: f.b, iso: f.iso, time: null, kind: 'trips', who: f.who, ts: xs.map((x) => x.t!) })
  })
  return sortPlate(out)
}
/** the number on Today in the menu: what's due today or late — the same number the page shows */
export const todayCount = (s: Store, role: Role) => collapse(plateOf(s, role)).filter((x) => isNow(x.b)).length

function PlateRow({ x, showOwner, followed, overdue }: { x: PlateItem; showOwner?: boolean; followed?: boolean; overdue?: boolean }) {
  if (x.kind === 'meet') return <MeetingRow e={x.e!} showOwner={showOwner} />
  if (x.kind === 'daily') return <DailyRow d={x.d!} showOwner={showOwner} />
  if (x.kind === 'dailies') return <DailiesRow x={x} showOwner={showOwner} />
  if (x.kind === 'trips') return <TripsRow x={x} showOwner={showOwner} />
  if (x.kind === 'steps') return <StepsRow x={x} showOwner={showOwner} />
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

/* ================= the page: today, tomorrow, later — each day in the order it happens ================= */
type View = 'today' | 'tomorrow' | 'later' | 'waiting' | 'done'
const dayHead = (iso: string) => (iso === TODAY ? 'Today' : iso === TOMORROW ? 'Tomorrow' : dayShort(iso))
export function MyTasksPage() {
  const s = useStore()
  const role = s.role
  const t0 = (s.route.tab as string) || 'today'
  /* the site manager's Today is just today and tomorrow */
  const simple = role === 'site'
  const [view, setView] = React.useState<View>(t0 === 'tomorrow' ? 'tomorrow' : t0 === 'waiting' ? 'waiting' : simple ? 'today' : t0 === 'done' ? 'done' : t0 === 'later' || t0 === 'coming' ? 'later' : 'today')
  const inside = role !== 'crew' && role !== 'client'
  /* everyone's tasks are for the admin — every other login sees its own */
  const seesTeam = role === 'owner'
  const [scope, setScope] = React.useState<'mine' | 'all'>(t0 === 'team' && seesTeam ? 'all' : 'mine')
  const [who, setWho] = React.useState<string>('all')
  const [job, setJob] = React.useState<string>('all')
  const me = meOf(role)
  const all = scope === 'all'
  const boss = role === 'owner' || role === 'pm' || role === 'office'
  const followsIt = (t?: Task) => !!t && t.owner !== me && followersOf(t).includes(me)
  /* one project at a time: everything for a job together (the site manager starts here) — remembered on this computer */
  const prefKey = `tileos-today-byjob:${role}`
  /* the site manager: by time, always — Overdue, then Today: the address and the task on each line */
  const [byJob, setByJob] = React.useState<boolean>(() => { if (role === 'site') return false; try { return localStorage.getItem(prefKey) === '1' } catch { return false } })
  const groupBy = (on: boolean) => { setByJob(on); try { localStorage.setItem(prefKey, on ? '1' : '0') } catch { /* private window */ } }
  /* everyone's list is each person's things together (late first) — that's what Everyone means: no other way to
     group it (the Person filter picks one person) */
  const grouping: 'person' | 'job' | 'time' = all ? 'person' : byJob ? 'job' : 'time'
  const setGrouping = (g: 'person' | 'job' | 'time') => groupBy(g === 'job')

  /* the counts never change with the filters — they're the facts */
  /* the same kind of thing many times is one row — unless one project is picked: then each is its own */
  const plate0 = all ? teamPlate(s) : plateOf(s, role)
  const plate = job === 'all' ? collapse(plate0) : plate0
  const pick = (x: PlateItem) => (job === 'all' || (x.t?.jobId || x.d?.jobId || x.job?.id || x.e?.jobId) === job) && (!all || who === 'all' || (who === 'follow' ? followsIt(x.t) : x.who === who || (x.kind === 'meet' && x.e!.people.includes(who as PersonKey))))
  const today = plate.filter((x) => isNow(x.b))
  const late = plate.filter((x) => x.b === 'overdue')
  const tomorrow = plate.filter((x) => x.b === 'tomorrow')
  const later = plate.filter((x) => x.b === 'week' || x.b === 'later' || x.b === 'aside')
  /* waiting on others: what's out with the GC or a supplier — and what someone else is doing that you care about: what
     you asked for or handed over, and what you follow. Each with whose it is and its day; it leaves when it's done */
  const theirsIFollow = (t: Task) => t.owner !== me && t.state !== 'done' && (t.by === me || followersOf(t).includes(me))
  const waiting = s.tasks.filter((t) => !staleFollowUp(s, t) && ((t.state === 'waiting' && (all ? true : isMine(t, role))) || (!all && theirsIFollow(t))))
    .sort((a, b) => (taskIso(a) || '9999').localeCompare(taskIso(b) || '9999'))
  /* what someone else is doing for you that's due today or late: on your Today too, under Check in on the team */
  const othersToday = all ? [] : waiting.filter((t) => theirsIFollow(t) && !t.everyone && t.state === 'now' && isNow(taskBucket(t)) && (job === 'all' || t.jobId === job))
  const othersIds = new Set(othersToday.map((t) => t.id))
  /* the team, under your own list: the admin sees what everyone has today and what's late, on every project; anyone
     else what they asked for or follow, and the steps someone else does before their own */
  const admin = role === 'owner' || role === 'pm'
  const teamRows: PlateItem[] = all || view !== 'today' ? [] : (() => {
    /* one line for each thing, with its project — not "3 projects" — and each opens the same window: a task's or a step's */
    const base: PlateItem[] = admin
      ? sortPlate(teamPlateNow(s)).filter((x) => !!x.who && x.who !== me && isNow(x.b) && TEAM_KINDS.has(x.kind) && !x.t?.everyone && !(x.t && isGcWait(x.t)))
      : sortPlate([...othersToday.map((t): PlateItem => ({ key: t.id, b: taskBucket(t), iso: taskIso(t), kind: 'task', t, who: t.owner })), ...waitsOnOthers(s, me)])
    const seen = new Set<string>()
    const jobOf = (x: PlateItem) => x.t?.jobId || x.job?.id || x.vs?.[0]?.job.id || x.ts?.[0]?.jobId
    return base.filter((x) => (job === 'all' || jobOf(x) === job) && !seen.has(x.key) && (seen.add(x.key), true))
  })()
  /* someone else's: its day — red once it's late */
  const theirWhen = (t: Task): { text: string; tone?: 'bad' | 'warn' | 'strong' | 'quiet' } | undefined => {
    if (t.owner === me || t.state !== 'now') return undefined
    const b = taskBucket(t)
    return b === 'overdue' ? { text: /late/i.test(t.due || '') ? t.due! : `Was due ${t.due}`, tone: 'bad' } : b === 'today' ? { text: 'Today', tone: 'warn' } : t.due ? { text: t.due, tone: 'strong' } : { text: 'Anytime', tone: 'quiet' }
  }
  /* steps waiting on someone outside — the store's tile, the installer's yes: they wait here with the day they're back */
  const waitSteps = Object.values(s.jobs).filter(isGettingReady).flatMap((j) => stepsFor(s, j).filter((v) => v.state === 'wait' && (all || v.owner === me)).map((v) => ({ job: j, v })))
  const done = s.tasks.filter((t) => t.state === 'done' && (all ? true : isMine(t, role)))
  const doneToday = done.filter((t) => t.doneAt === 'Just now' || t.doneAt === 'Today' || isoFromLabel(t.doneAt) === TODAY).length
  const meetingsToday = today.filter((x) => x.kind === 'meet').length
  const pinned = s.tasks.filter((t) => t.everyone && t.state !== 'done' && (job === 'all' || t.jobId === job) && (all || !quietForMe(t, me)))
  /* what I reminded someone about: off my Today, back tomorrow if it isn't done — it waits on Tomorrow, never lost */
  const backTomorrow = all ? [] : s.tasks.filter((t) => t.state !== 'done' && t.owner !== me && t.quiet?.[me] === TOMORROW && (job === 'all' || t.jobId === job))
  const jobsWithTasks = Object.values(s.jobs).filter((j) => s.tasks.some((t) => t.jobId === j.id) || s.events.some((e) => e.jobId === j.id))
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  /* one day: what's late (today only), then the day in time order — timed things first, then anytime */
  const dayBlock = (iso: string, items: PlateItem[], withLate = false, lead?: React.ReactNode) => {
    /* urgent: first of all, in red — then what's late, then the day */
    const urgentRows = withLate ? items.filter((x) => x.t?.urgent && x.t.state === 'now') : []
    items = items.filter((x) => !urgentRows.includes(x))
    const lateRows = withLate ? items.filter((x) => x.b === 'overdue') : []
    const rows = items.filter((x) => x.b !== 'overdue')
    const timed = rows.filter((x) => x.time != null)
    const any = rows.filter((x) => x.time == null)
    const nowAt = iso === TODAY ? timed.findIndex((x) => (x.time ?? 0) > nowMin) : -1
    return (
      <React.Fragment key={iso}>
        {urgentRows.length > 0 && (
          <section data-day="urgent">
            <Group label="Urgent" count={urgentRows.length} tone="bad" strong />
            {urgentRows.map((x) => <PlateRow key={x.key} x={x} showOwner={all} followed={followsIt(x.t)} />)}
          </section>
        )}
        {lateRows.length > 0 && (
          <section data-day="overdue">
            <Group label="Overdue" count={lateRows.length} tone="bad" strong right={<button onClick={() => s.open({ t: 'late' })} data-late-open className="text-[0.8125rem] font-medium text-muted hover:text-brand-700">Move or remind<ChevronRight className="ml-0.5 inline h-3.5 w-3.5 align-[-0.15em]" /></button>} />
            {lateRows.map((x) => <PlateRow key={x.key} x={x} showOwner={all} overdue followed={followsIt(x.t)} />)}
          </section>
        )}
        {(rows.length > 0 || !lateRows.length || !!lead) && (
          <section data-day={iso}>
            <Group label={dayHead(iso)} count={rows.length + (lead ? 1 : 0)} tone="info" strong />
            {lead}
            {/* what's set for a time: before now, the line, after now */}
            {timed.slice(0, nowAt === -1 ? timed.length : nowAt).map((x) => <PlateRow key={x.key} x={x} showOwner={all} followed={followsIt(x.t)} />)}
            {iso === TODAY && timed.length > 0 && <NowLine min={nowMin} />}
            {(nowAt === -1 ? [] : timed.slice(nowAt)).map((x) => <PlateRow key={x.key} x={x} showOwner={all} followed={followsIt(x.t)} />)}
            {any.map((x) => <PlateRow key={x.key} x={x} showOwner={all} followed={followsIt(x.t)} />)}
            {!rows.length && !lead && <div className={cn('border-t border-line-2 py-6 text-[0.84375rem] text-muted', PX)}>Nothing on {dayHead(iso).toLowerCase() === 'today' ? 'today' : dayHead(iso)}.</div>}
          </section>
        )}
      </React.Fragment>
    )
  }

  /* by project: one section per job — what to check, do, hand over or record there, whatever day it's on */
  const manyJob = (ids: string[]) => { const u = Array.from(new Set(ids)); return u.length === 1 ? u[0] : '*' }
  const jobOfItem = (x: PlateItem) => (x.ds ? manyJob(x.ds.map((d) => d.jobId)) : x.ts ? manyJob(x.ts.map((t) => t.jobId)) : x.vs ? manyJob(x.vs.map((y) => y.job.id)) : x.t?.jobId || x.d?.jobId || x.job?.id || x.e?.jobId || '')
  const byProject = (items0: PlateItem[], tasksOnly?: Task[]) => {
    /* a trip to more than one job: each pickup under its own project */
    const items = items0.flatMap((x): PlateItem[] => (x.kind === 'trips' && x.ts && manyJob(x.ts.map((t) => t.jobId)) === '*' ? x.ts.map((t) => ({ key: t.id, b: x.b, iso: x.iso, time: null, kind: 'task', t, who: x.who })) : [x]))
    const keyOf = (id: string) => (id && s.jobs[id] ? s.jobs[id].name : '\uffff')
    const ids = Array.from(new Set(tasksOnly ? tasksOnly.map((t) => t.jobId || '') : items.map(jobOfItem))).sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
    return ids.map((id) => {
      const j = id && id !== '*' ? s.jobs[id] : undefined
      const rows = items.filter((x) => jobOfItem(x) === id)
      const ts = (tasksOnly || []).filter((t) => (t.jobId || '') === id)
      return (
        <InJob.Provider key={id || 'none'} value><Loose.Provider value={false}><section aria-label={j ? j.name : 'Company'} data-project-band={id || 'company'}>
          <div className={cn(BAND_STRONG, PX)} style={bandStyle('neutral')} data-band>
            {j ? (
              <button onClick={() => s.open({ t: 'job', id })} className={cn(bandLabel('neutral'), 'min-w-0 text-left hover:text-brand-700')}>{j.name}</button>
            ) : <span className={bandLabel('neutral')}>Company</span>}
            <BandCount n={rows.length + ts.length} />
          </div>
          {rows.map((x) => <PlateRow key={x.key} x={x} showOwner={all} overdue={x.b === 'overdue'} followed={followsIt(x.t)} />)}
          {ts.map((t) => <TaskRow key={t.id} t={t} showOwner when={theirWhen(t)} />)}
        </section></Loose.Provider></InJob.Provider>
      )
    })
  }

  /* by person: one section per person — what's late first, then the rest in the order it happens; tap the name for
     just their list */
  const order = [...insidePeople(s), ...ASSIGNABLE]
  const rank = (p: string) => { const i = order.indexOf(p as PersonKey); return i < 0 ? 999 : i }
  const ownerOf = (x: PlateItem) => (x.kind === 'meet' ? x.e!.people[0] : x.who) || ''
  const late1st = (a: PlateItem, b: PlateItem) => Number(b.b === 'overdue') - Number(a.b === 'overdue') || (a.iso || '9999').localeCompare(b.iso || '9999') || (a.time ?? 9999) - (b.time ?? 9999)
  const byPerson = (items: PlateItem[], tasksOnly?: Task[]) => {
    const ids = Array.from(new Set(tasksOnly ? tasksOnly.map((t) => t.owner || '') : items.map(ownerOf))).sort((a, b) => rank(a) - rank(b) || (PEOPLE[a as PersonKey]?.name || '').localeCompare(PEOPLE[b as PersonKey]?.name || ''))
    return ids.map((p) => {
      const rows = items.filter((x) => ownerOf(x) === p).sort(late1st)
      const ts = (tasksOnly || []).filter((t) => (t.owner || '') === p)
      const lateN = rows.filter((x) => x.b === 'overdue').length
      const person = PEOPLE[p as PersonKey]
      return (
        <section key={p || 'none'} aria-label={person?.name || 'Nobody yet'} data-person-group={p || 'none'}>
          <div className={cn(BAND_STRONG, PX)} style={bandStyle('neutral')} data-band>
            {person && <Avatar who={p as PersonKey} size={20} />}
            {person ? (
              <button onClick={() => setWho(p)} className={cn(bandLabel('neutral'), 'min-w-0 text-left hover:text-brand-700')} title={p === me ? 'Only your list' : `Only ${person.short}’s list`}>{p === me ? 'Yours' : person.name}</button>
            ) : <span className={bandLabel('neutral')}>Nobody yet</span>}
            <BandCount n={rows.length + ts.length} />
            {lateN > 0 && <span className="shrink-0 text-[0.75rem] font-semibold text-bad-600">{lateN} late</span>}
          </div>
          {rows.map((x) => <PlateRow key={x.key} x={x} overdue={x.b === 'overdue'} followed={followsIt(x.t)} />)}
          {ts.map((t) => <TaskRow key={t.id} t={t} />)}
        </section>
      )
    })
  }

  /* the admin's check-ins are their own part of Today — under the day, not mixed into it */
  const shownToday = today.filter(pick).filter((x) => x.kind !== 'checkin')
  /* the admin's: everything waiting on the GC, on every project — where each stands, red only when something's wrong
     (features/gcwait). What's on his own list today isn't here again */
  const gcRows = admin && !all && view === 'today' ? gcWaits(s).filter((t) => (job === 'all' || t.jobId === job) && !shownToday.some((x) => x.t?.id === t.id)) : []
  /* urgent first, in its own red part — the rest grouped as asked */
  const urgentToday = shownToday.filter((x) => x.t?.urgent && x.t.state === 'now')
  const restToday = shownToday.filter((x) => !urgentToday.includes(x) && x.kind !== 'crew')
  /* the team's late things — not again what's already there because you follow it */
  const shownCheckins = all ? [] : today.filter((x) => x.kind === 'checkin' && !x.ci?.items.some((c) => c.x.kind === 'task' && !!c.x.t && othersIds.has(c.x.t.id)))
  /* a task with no day on it still shows up — under today's, as "No day set" — so nothing gets lost */
  const undated = plate.filter((x) => x.kind === 'task' && x.t && x.t.state === 'now' && !taskIso(x.t) && !/this week/i.test(x.t.due || '')).filter(pick)
  const shownTomorrow = tomorrow.filter(pick)
  const shownLater = later.filter(pick)
  /* due "this week" with no day of its own: its own group on top — not under a day it isn't on */
  const anyDay = shownLater.filter((x) => x.b === 'week' && x.iso && x.iso <= TOMORROW)
  const laterDays = Array.from(new Set(shownLater.filter((x) => x.b !== 'aside' && x.iso && !anyDay.includes(x)).map((x) => x.iso!))).sort()
  const nextLater = later.filter((x) => x.b !== 'aside' && x.iso && x.iso > TOMORROW).map((x) => x.iso!).sort()[0]
  const noDate = shownLater.filter((x) => x.b !== 'aside' && !x.iso)
  const aside = shownLater.filter((x) => x.b === 'aside')
  const shownWaiting = waiting.filter((t) => (job === 'all' || t.jobId === job) && (!all || who === 'all' || (who === 'follow' ? followsIt(t) : t.owner === who)))
  const shownWaitSteps = waitSteps.filter((x) => (job === 'all' || x.job.id === job) && (!all || who === 'all' || (who !== 'follow' && x.v.owner === who)))
  const waitWhen = (v: StepView) => ({ text: v.due ? `${['delivered', 'matin'].includes(v.key) ? 'Coming' : ['design', 'walk'].includes(v.key) ? 'Set for' : 'Back'} ${md(v.due)}` : 'Waiting', tone: 'warn' as const })
  /* newest first, a page at a time — done work piles up for the record */
  const doneDay = (t: Task) => t.doneOn || (t.doneAt === 'Just now' || t.doneAt === 'Today' ? TODAY : isoFromLabel(t.doneAt) || '')
  const shownDone = done.filter((t) => (job === 'all' || t.jobId === job) && (!all || who === 'all' || (who === 'follow' ? followsIt(t) : t.owner === who))).sort((a, b) => doneDay(b).localeCompare(doneDay(a)))
  const [doneN, setDoneN] = React.useState(40)
  /* for everyone — once, on top (not again in the day's list) */
  const pinnedRows = pinned.filter((t) => !shownToday.some((x) => x.t?.id === t.id))
  /* whose each row is: on everyone's list — unless it's grouped by person already — and on Waiting on others */
  const whoCol = all ? !(grouping === 'person' && view !== 'done') : view === 'waiting'
  /* the column names show over a list that has rows */
  const hasRows = view === 'today' ? pinnedRows.length + shownToday.length + teamRows.length + gcRows.length + undated.length > 0 : view === 'tomorrow' ? shownTomorrow.length + backTomorrow.length > 0 : view === 'later' ? shownLater.length > 0 : view === 'waiting' ? shownWaiting.length + shownWaitSteps.length > 0 : shownDone.length > 0

  return (
    <Page
      title={`${greeting()}, ${PEOPLE[me].short}`}
      phoneTitle
      sub={TODAY_LABEL}
      top={<>
        <Bubbles
          /* a phone: the five on one row — the list starts right under them */
          row
          /* each number is what its list shows — with a project picked, its */
          items={[
            { key: 'today', label: 'Today', count: shownToday.length + shownCheckins.length + othersToday.length, icon: <ListTodo />, color: 'blue', on: view === 'today', onClick: () => setView('today') },
            { key: 'tomorrow', label: 'Tomorrow', count: shownTomorrow.length + backTomorrow.length, icon: <CalendarDays />, color: 'violet', on: view === 'tomorrow', onClick: () => setView('tomorrow') },
            /* the site manager: today, tomorrow and what he's waiting on — that's all he needs on the go */
            ...(simple ? [] : [{ key: 'later', label: 'Later', count: shownLater.length, icon: <CalendarRange />, color: 'slate', on: view === 'later', onClick: () => setView('later') }] as any[]),
            { key: 'waiting', label: 'Waiting on others', short: 'Waiting', count: shownWaiting.length + shownWaitSteps.length, icon: <Hourglass />, color: 'amber', on: view === 'waiting', onClick: () => setView('waiting'), gapBefore: true },
            ...(simple ? [] : [{ key: 'done', label: 'Done', count: shownDone.length, icon: <CircleCheckBig />, color: 'green', on: view === 'done', onClick: () => setView('done') }] as any[]),
          ]}
        />
      </>}
      toolbar={
        /* a phone with nothing to pick here (the site manager's list): no empty box over the list */
        <div className="flex w-full flex-wrap items-center gap-2" data-bar-phone-empty={!seesTeam && !all && (simple || view === 'done') ? '' : undefined}>
          {seesTeam && <ViewSwitch label="Whose list" value={scope} onChange={(k) => { setScope(k); setWho('all') }} items={[{ key: 'mine', label: 'Mine', icon: <UserRound /> }, { key: 'all', label: 'Everyone', icon: <Users /> }]} />}
          {/* Everyone's is by person — pick one person to see just theirs (no switch for how it's grouped: it's by person) */}
          {all && <Filter icon={<UserRound />} label="Person" value={who} allLabel="Everyone" options={(insidePeople(s).length ? insidePeople(s) : ASSIGNABLE).filter((p) => p !== me).map((p) => ({ key: p, label: PEOPLE[p]?.name || p, hint: PEOPLE[p]?.roleLabel }))} onChange={(v) => { setWho(v as string); if (v !== 'all') setScope('all') }} />}
          {/* your own list: in the order it happens, or a project at a time */}
          {!all && view !== 'done' && !simple && <ViewSwitch label="How it's grouped" value={grouping} onChange={setGrouping} items={[{ key: 'time', label: 'By time', icon: <Clock3 /> }, { key: 'job', label: 'By project', icon: <Building2 /> }]} />}
          <span className="flex-1 max-md:hidden" />
          {/* one project's things — on a computer; a phone keeps to one line (By project does it there) */}
          <span className="contents max-sm:hidden">
            <Filter icon={<Building2 />} label="Project" value={job} options={jobsWithTasks.map((j) => ({ key: j.id, label: j.name, hint: j.client }))} onChange={setJob} width={280} />
            <ClearFilters show={job !== 'all' || who !== 'all'} onClear={() => { setJob('all'); setWho('all') }} />
          </span>
        </div>
      }
    >
      {/* whose each row is: on everyone's list — unless it's grouped by person already */}
      <WhoCol.Provider value={whoCol}>
      {/* grouped by project: every row has the same two columns as the names on top — the ones under no project's
          band too (For everyone, the check-ins, No day set) */}
      <InJob.Provider value={grouping === 'job' && view !== 'done'}>
      <Loose.Provider value={grouping === 'job' && view !== 'done'}>
      {/* the columns: What · Whose (everyone's list) · Project (not when grouped by project) · When — each as wide as its
          widest line, the same space between them */}
      {/* the columns spread evenly across the list, the same space between each two — What on the left, Next on the
          right, Project and When evenly between (not What taking the room and the rest pushed right) */}
      <div data-even-list style={{ '--list': todoList(whoCol, grouping === 'job' && view !== 'done') } as React.CSSProperties}>
        {/* urgent: before anything else, in red — whichever way the list is grouped (by time it's the day's first part) */}
        {view === 'today' && grouping !== 'time' && urgentToday.length > 0 && (
          <section data-day="urgent">
            <Group label="Urgent" count={urgentToday.length} tone="bad" strong />
            {urgentToday.map((x) => <PlateRow key={x.key} x={x} showOwner={all} followed={followsIt(x.t)} />)}
          </section>
        )}
        {/* the site manager's crew list — something to do today, until it's sent (first thing in the morning; tomorrow's
            before he leaves): by time it's the first row of Today; by project or person, on top under Today */}
        {view === 'today' && grouping !== 'time' && shownToday.some((x) => x.kind === 'crew') && (
          <section data-first-thing>
            <Group label="Today" count={1} tone="info" strong />
            <CrewRow />
          </section>
        )}
        {/* for everyone: an ordinary row, on top — whose it is and the project like any other */}
        {pinnedRows.length > 0 && view === 'today' && (
          <section data-pinned>
            <Group label="For everyone" count={pinnedRows.length} tone="warn" strong />
            {pinnedRows.map((t) => <TaskRow key={t.id} t={t} showOwner={all} when={{ text: 'Anytime', tone: 'quiet' }} />)}
          </section>
        )}

        {view === 'today' && (shownToday.length ? (grouping === 'job' ? byProject(restToday) : grouping === 'person' ? byPerson(restToday) : dayBlock(TODAY, shownToday.filter((x) => x.kind !== 'crew'), true, shownToday.some((x) => x.kind === 'crew') ? <CrewRow key="crew" /> : undefined)) : (!teamRows.length || simple) && !gcRows.length && <EmptyState icon={<Check />} title="Nothing due today" sub={tomorrow.length ? `${tomorrow.length} for tomorrow — see Tomorrow.` : 'New work lands here the moment it’s yours.'} />)}
        {view === 'today' && gcRows.length > 0 && <GcSection list={gcRows} />}
        {view === 'today' && teamRows.length > 0 && !simple && <TeamSection rows={teamRows} />}
        {view === 'today' && undated.length > 0 && (
          <section>
            <Group label="No day set" count={undated.length} tone="neutral" strong />
            {undated.map((x) => <PlateRow key={x.key} x={x} showOwner={all} followed={followsIt(x.t)} />)}
          </section>
        )}

        {view === 'tomorrow' && backTomorrow.length > 0 && (
          <section data-back-tomorrow>
            <Group label="Back to you tomorrow" count={backTomorrow.length} tone="neutral" strong />
            {backTomorrow.map((t) => <TaskRow key={t.id} t={t} when={{ text: 'Reminded', tone: 'quiet' }} />)}
          </section>
        )}
        {view === 'tomorrow' && (shownTomorrow.length ? (grouping === 'job' ? byProject(shownTomorrow) : grouping === 'person' ? byPerson(shownTomorrow) : dayBlock(TOMORROW, shownTomorrow)) : !backTomorrow.length && <EmptyState icon={<Check />} title="Nothing for tomorrow yet" sub="Anything due tomorrow, and tomorrow’s meetings, show here." />)}

        {view === 'later' && grouping === 'job' && byProject(shownLater)}
        {view === 'later' && grouping === 'person' && byPerson(shownLater)}
        {view === 'later' && grouping === 'time' && anyDay.length > 0 && (
          <section>
            <Group label="This week" count={anyDay.length} tone="info" strong />
            {anyDay.map((x) => <PlateRow key={x.key} x={x} showOwner={all} followed={followsIt(x.t)} />)}
          </section>
        )}
        {view === 'later' && grouping === 'time' && laterDays.map((d) => dayBlock(d, shownLater.filter((x) => x.iso === d && x.b !== 'aside' && !anyDay.includes(x))))}
        {view === 'later' && grouping === 'time' && noDate.length > 0 && (
          <section>
            <Group label="No date" count={noDate.length} tone="neutral" strong />
            {noDate.map((x) => <PlateRow key={x.key} x={x} showOwner={all} />)}
          </section>
        )}
        {view === 'later' && grouping === 'time' && aside.length > 0 && (
          <section>
            <Group label="Set aside" count={aside.length} tone="neutral" strong />
            {aside.map((x) => <PlateRow key={x.key} x={x} showOwner={all} />)}
          </section>
        )}
        {view === 'later' && !shownLater.length && <EmptyState icon={<Check />} title="Nothing later" sub="Anything with a date after tomorrow shows here, day by day." />}

        {view === 'waiting' && (shownWaiting.length > 0 || shownWaitSteps.length > 0) && (
          <>
            {grouping === 'job' ? byProject([], shownWaiting) : grouping === 'person' ? byPerson([], shownWaiting) : shownWaiting.map((t) => <TaskRow key={t.id} t={t} showOwner when={theirWhen(t)} />)}
            {shownWaitSteps.map(({ job: j, v }) => <StepRowToday key={`w:${j.id}:${v.key}`} job={j} v={v} showOwner when={waitWhen(v)} />)}
          </>
        )}
        {view === 'waiting' && !shownWaiting.length && !shownWaitSteps.length && <EmptyState icon={<Check />} title="Nothing waiting on others" sub="What you asked someone for, what you follow, and what’s out with the GC or a supplier waits here until it’s done." />}

        {view === 'done' && shownDone.slice(0, doneN).map((t) => <TaskRow key={t.id} t={t} showOwner={all} />)}
        {view === 'done' && shownDone.length > doneN && <button onClick={() => setDoneN(doneN + 40)} className={cn('w-full border-t border-line-2 py-3 text-left text-[0.84375rem] font-semibold text-brand-700 hover:bg-brand-50/40', PX)}>Show older — {shownDone.length - doneN} more</button>}
        {view === 'done' && !shownDone.length && <EmptyState icon={<Check />} title="Nothing done yet" sub="Finished tasks stay here for the record." />}
      </div>
      </Loose.Provider>
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
