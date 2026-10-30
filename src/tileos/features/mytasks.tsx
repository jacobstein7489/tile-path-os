/* Today — your day, in the order it happens. What's late first, then the day hour by hour (meetings at their time),
 * then what can be done any time. Tomorrow and Later are the same, a day at a time. Every row: when · what ·
 * project · the one button. Checklist steps that are your turn show up by themselves — that's the hand-off.
 * Mine / Everyone switches between your list and the whole team's. */
import * as React from 'react'
import { CalendarRange, Check, Plus, Repeat, Clock3, MoonStar, RotateCcw, Ban, Building2, CalendarDays, UserRound, HardHat, ListTodo, Hourglass, CircleCheckBig, Eye, Users, Megaphone, UserPlus, FileText, ClipboardList, Package, ArrowLeftRight, Receipt, ListChecks, HandCoins, ChevronRight, ChevronDown, ListPlus, Truck, UserRoundCheck, Gauge, BellRing } from 'lucide-react'
import { useStore, meOf, NOW, isRequest, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Field, Chip, Stepper } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, MenuSep, Pop, DatePresets, WaitPicker, LaterPicker } from '@/tileos/components/ui/overlay'
import { Page, Filter, ClearFilters, Group, EmptyState, Status, Bubbles, PX, ViewSwitch, HEAD_ROW, BAND, STICKY_HEAD, EVEN, evenVars, ROW_H } from '@/tileos/components/ui/page'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn, greeting } from '@/tileos/lib/utils'
import { PRICING_STAGES, PEOPLE, fmtMoney, loginOf, type Role, type PersonKey, type Job } from '@/tileos/data/model'
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
import { followersOf, toggleFollow, setEveryone } from './taskshare'
import { stepTodos, stepsFor, isGettingReady, realOwner, type StepView } from './steps'
import { StepButton } from './steps-ui'
import { todoOf } from './stepwin'
import { TODAY, TOMORROW, dayShort, dayLongFull, isoFromLabel, labelFromIso, addDays, md } from '@/tileos/lib/today'
import { REAL, awayFromMe } from '@/tileos/lib/save'
import { checkIns, checkInDays, reportOn, type CheckItem } from './teamreport'
import { SuggestInput } from '@/tileos/components/ui/suggest'
import { insidePeople } from './steps-ui'
import { TripButtons, ROW_BTN } from './requests'
import { markMessageTask } from './messages'
import { FormHead, FormRow, ProjectField } from './formkit'

const TODAY_ISO = TODAY
const TYPES: TaskType[] = ['Pricing', 'Setup', 'Materials', 'Field', 'Changes', 'Schedule', 'Money']
const ASSIGNABLE: PersonKey[] = ['ys', 'yakov', 'office', 'estimator', 'takeoff', 'materials', 'accounting']
const ROLE_OF: Partial<Record<PersonKey, Role[]>> = { ys: ['owner', 'pm'], yakov: ['site'], office: ['office'], estimator: ['estimator'], takeoff: ['takeoff'], materials: ['materials'], accounting: ['accounting'] }
const TYPE_ICON: Record<TaskType, React.ElementType> = { Pricing: FileText, Setup: ClipboardList, Materials: Package, Field: HardHat, Changes: ArrowLeftRight, Schedule: CalendarDays, Money: Receipt }

/** a daily update that's due today: one per project a crew is working on (the site manager sends them) */
export type DailyItem = { kind: 'daily'; jobId: string; crew: PersonKey; workers?: number }
export function dailyDue(s: Store, role: Role): DailyItem[] {
  if (role !== 'site' || (s.rules.autoOff || []).includes('daily-update')) return []
  return s.bookings
    .filter((b) => b.start <= TODAY_ISO && b.end >= TODAY_ISO && s.jobs[b.jobId] && ['installation', 'punch'].includes(s.jobs[b.jobId].stage))
    .filter((b) => s.diary[b.jobId]?.[0]?.date !== NOW)
    .map((b) => ({ kind: 'daily' as const, jobId: b.jobId, crew: b.crew as PersonKey, workers: b.workers }))
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
  return best?.j
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
  return !useStore.getState().team.some((m) => m.key === t.owner && m.status !== 'off' && loginOf(m.role) === loginOf(role))
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
  if (/this week/i.test(t.due || '')) return 'week'
  return bucketOfIso(taskIso(t))
}
/** a task's title without the project tacked on the end — the project has its own column */
const cleanTitle = (title: string, job?: Job) => (job ? title.replace(new RegExp(`\\s*[—·-]\\s*${job.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '') : title)

/* ---------------- one row, the same for everything: what · project · when ----------------
 * Calm on purpose: no lines between columns, no icon on every row, no small print under the title (it's in the task's
 * window) and no button on every row — on a computer the row's one button shows when you point at it; on a phone you
 * tap the row and its window has the button. Red only for what's late or a problem. Everyone's list says whose it is. */
const WhoCol = React.createContext(false)
/** grouped by project: the project is the group's name — the rows don't say it again */
const InJob = React.createContext(false)
/** the one button on a row (requests.tsx keeps it, for the On my way / Dropped off pair too) */
const TBTN = ROW_BTN
/** the row's button floats in on the right when you point at the row (a mouse) — never on a phone or a tablet */
const HOVER_ACT = 'pointer-events-none absolute inset-y-0 right-0 hidden items-center pl-12 pr-5 opacity-0 transition-opacity duration-100 max-sm:pr-4 [@media(hover:hover)]:md:flex group-hover/row:opacity-100 group-focus-visible/row:opacity-100 group-has-[:focus-visible]/row:opacity-100'
const HOVER_BG = { background: 'linear-gradient(90deg, rgba(255,255,255,0), #fff 2.75rem)' }
/** the columns: what · (whose, on everyone's list) · project (not when grouped by project) · when — the same on the
 *  column names on top and on every row, so everything lines up, and they share the whole width */
export const todoCols = (who: boolean, inJob: boolean) =>
  cn(who
    ? inJob ? 'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,0.9fr)_7rem]' : 'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,1fr)_7rem]'
    : inJob ? 'md:grid md:grid-cols-[minmax(0,1fr)_7rem]' : 'md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_7rem]', EVEN)
/** on a wide screen: each column its room, the rest shared evenly — When stays pinned to the right */
export const todoWide = (who: boolean, inJob: boolean) =>
  evenVars(who ? (inJob ? [24, 8, 6] : [22, 8, 12, 6]) : inJob ? [30, 6] : [24, 12, 6], { fixedLast: true })
/** the column names over a Today list */
function TodoHead({ who, inJob }: { who: boolean; inJob: boolean }) {
  return (
    <div className={cn(HEAD_ROW, todoCols(who, inJob), 'gap-x-6 max-md:hidden', PX)} style={todoWide(who, inJob)} data-todo-head>
      <span>What</span>
      {who && <span>Whose</span>}
      {!inJob && <span>Project</span>}
      <span className="text-right">When</span>
    </div>
  )
}
function TodoRow({ when, whenTone, title, detail, project, action, onClick, done, leaving, owner }: {
  when?: React.ReactNode; whenTone?: 'bad' | 'warn' | 'strong' | 'quiet'; icon?: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; project?: string; action?: React.ReactNode; onClick?: () => void; done?: boolean; leaving?: boolean; owner?: PersonKey
}) {
  const who = React.useContext(WhoCol)
  const inJob = React.useContext(InJob)
  const me = meOf(useStore((x) => x.role))
  const w = when === 'Anytime' ? '' : when
  /* grouped by project, the group's name says it — it's still on the row for a screen reader */
  const quiet = inJob ? project : undefined
  if (inJob) project = undefined
  const whenCls = whenTone === 'bad' ? 'font-medium text-bad-600' : whenTone === 'warn' ? 'font-medium text-warn-700' : whenTone === 'strong' ? 'text-ink-2' : 'text-muted'
  const ownerName = owner ? (owner === me ? 'You' : PEOPLE[owner]?.short) : ''
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onClick() } : undefined}
      title={typeof detail === 'string' && detail ? detail : undefined}
      data-todo
      style={todoWide(who, inJob)}
      className={cn('group/row relative items-center gap-x-6 border-t border-line-2 py-1.5 transition-colors focus-visible:outline-none max-md:flex max-md:gap-3', ROW_H, todoCols(who, inJob), PX, onClick && 'cursor-pointer row-hover', leaving && 'row-out')}
    >
      <div className="flex min-w-0 items-center gap-2.5 max-md:flex-1">
        {done && <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok-50 text-ok-600 [&_svg]:h-3 [&_svg]:w-3"><Check strokeWidth={3} /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-3">
            <span className={cn('min-w-0 flex-1 truncate text-[0.875rem] font-medium leading-5', done ? 'text-muted line-through decoration-faint' : 'text-ink')}>{title}</span>
            {/* on a phone the time sits at the end of the title's line, and the project goes under it */}
            {w && <span className={cn('shrink-0 text-[0.75rem] tnum md:hidden', whenCls)}>{w}</span>}
          </div>
          {(project || (who && owner)) && <div className="mt-0.5 truncate text-[0.75rem] text-muted md:hidden">{[who && owner ? ownerName : '', project].filter(Boolean).join(' · ')}</div>}
        </div>
      </div>
      {who && <span className="flex min-w-0 items-center gap-2 max-md:hidden">{owner && PEOPLE[owner] ? <><Avatar who={owner} size={20} /><span className={cn('truncate text-[0.8125rem]', owner === me ? 'font-medium text-ink' : 'text-ink-2')}>{ownerName}</span></> : null}</span>}
      {!inJob && <span className="min-w-0 truncate text-[0.8125rem] text-muted max-md:hidden">{project}</span>}
      {quiet && <span className="sr-only">{quiet}</span>}
      <span className={cn('truncate text-right text-[0.8125rem] tnum max-md:hidden', whenCls)}>{w}</span>
      {action && <div className={HOVER_ACT} style={HOVER_BG} onClick={(e) => e.stopPropagation()}><span className="pointer-events-auto flex items-center gap-2">{action}</span></div>}
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
  /* a hand-off (a review, a PO, an invoice) opens the thing itself — the notes and history are one tap from there */
  const opensWork = act && /^(estimate|estchange|money|po|co|short|order|heights|pay):/.test(t.action!.kind)
  const follow = followDue(t)
  const Ic = TYPE_ICON[t.type] || ListTodo
  const log = t.log || []
  const last = log[log.length - 1]
  const detail0 = t.req && !done ? `${t.req.trip === 'onway' ? 'On the way' : 'Asked'}${t.by ? ` by ${PEOPLE[t.by]?.short || ''}` : ''}${t.owner !== meOf(s.role) ? ` · ${PEOPLE[t.owner]?.short || 'someone'} brings it` : ''}` : t.state === 'waiting' ? `Waiting on ${t.waitingOn}` : t.blocks && !done ? `Holds up ${t.blocks.charAt(0).toLowerCase() + t.blocks.slice(1)}` : last?.text || t.where || t.detail
  const detail = followed ? <><Eye className="mr-1 inline h-3.5 w-3.5 align-[-0.125rem] text-brand-600" />{detail0 ? `You follow · ${detail0}` : 'You follow'}</> : detail0
  const w = when || (t.state === 'waiting' ? (follow ? { text: 'Follow up', tone: 'warn' as const } : { text: /^tomorrow$/i.test(t.followUp || '') ? 'Tomorrow' : `Back ${t.followUp}`, tone: undefined }) : t.state === 'done' ? { text: t.doneAt ? (t.doneAt === 'Just now' ? 'Today' : t.doneAt) : 'Done', tone: 'quiet' as const } : t.state === 'later' ? { text: `Back ${t.laterUntil}` } : { text: 'Anytime', tone: 'quiet' as const })
  return (
    <TodoRow
      leaving={leaving}
      done={done || leaving}
      onClick={() => (opensWork ? runTaskAction(t) : s.open({ t: 'task', id: t.id }))}
      icon={t.everyone ? <Megaphone /> : t.repeat ? <Repeat /> : <Ic />}
      title={cleanTitle(t.title, job)}
      detail={detail}
      owner={showOwner ? t.owner : undefined}
      project={job ? (PRICING_STAGES.includes(job.stage) ? `${job.name} · estimate` : job.name) : 'Company'}
      when={w.text}
      whenTone={w.tone}
      action={
        theirs && !(done && (s.role === 'owner' || s.role === 'pm')) ? <Button size="sm" className={TBTN} onClick={() => s.open({ t: 'task', id: t.id })}>Open</Button>
        : done ? <Button size="sm" className={TBTN} icon={<RotateCcw />} onClick={() => s.reopenTask(t.id)}>Reopen</Button>
          : follow ? <Button size="sm" className={TBTN} icon={<Hourglass />} onClick={() => s.open({ t: 'task', id: t.id })}>Follow up</Button>
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
      title="Daily update"
      detail={`${PEOPLE[d.crew].short}’s crew · ${job.pct ?? 0}% installed`}
      owner={showOwner ? 'yakov' : undefined}
      project={job.name}
      when="End of day"
      whenTone="strong"
      action={<Button size="sm" className={TBTN} onClick={() => s.open({ t: 'daily', jobId: d.jobId })}>Send update</Button>}
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

/** the admin's: what's late on the team past the company's line — its own part of Today, one row for each late
 *  thing: what it is, whose, the day it was due, how late, and where it came from. "Check in" opens that person's
 *  window. */
function CheckInSection({ items }: { items: PlateItem[] }) {
  const s = useStore()
  const rows = items.flatMap((x) => (x.ci ? x.ci.items.map((c) => ({ who: x.ci!.who, c })) : []))
  if (!rows.length) return null
  const open = (who: PersonKey) => s.open({ t: 'checkin', who })
  return (
    <section data-day="checkin" data-checkins>
      <Group label="Check in on the team" count={rows.length} tone="neutral" />
      {rows.map(({ who, c }) => (
        <div key={c.key} data-checkin-row={who}>
          <TodoRow
            onClick={() => open(who)}
            icon={<UserRoundCheck />}
            title={c.title}
            detail={`${c.jobName} · due ${md(c.setFor)} · ${c.from}`}
            project={[PEOPLE[who]?.short, c.jobName].filter(Boolean).join(' · ')}
            owner={who}
            when={`${c.late} ${c.late === 1 ? 'day' : 'days'} late`}
            whenTone="bad"
            action={<Button size="sm" className={TBTN} onClick={() => open(who)}>Check in</Button>}
          />
        </div>
      ))}
    </section>
  )
}

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
export type PlateItem = { key: string; b: Bucket; iso?: string; time?: number | null; kind: 'task' | 'daily' | 'pay' | 'bill' | 'meet' | 'step' | 'checkin'; t?: Task; d?: DailyItem; e?: CalEvent; job?: Job; v?: StepView; who?: PersonKey; ci?: { who: PersonKey; items: CheckItem[] } }
const AHEAD = 21
/** everything that's mine: tasks, the daily updates I send, the pay week, my meetings, checklist steps that are my turn */
export function plateOf(s: Store, role: Role, person?: PersonKey | null): PlateItem[] {
  const me = person === undefined ? meOf(role) : person
  const out: PlateItem[] = []
  const last = addDays(TODAY, AHEAD)
  s.events.filter((e) => e.date >= TODAY && e.date <= last && (!me || e.people.includes(me))).forEach((e) => out.push({ key: 'e' + e.id, b: bucketOfIso(e.date), iso: e.date, time: e.start, kind: 'meet', e, who: e.people[0] }))
  dailyDue(s, role).forEach((d) => out.push({ key: 'd' + d.jobId, b: 'today', iso: TODAY, time: 17 * 60, kind: 'daily', d, who: 'yakov' }))
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
  s.tasks.filter((t) => isMine(t, role, me) && t.state === 'later').forEach((t) => out.push({ key: t.id, b: 'aside', iso: taskIso(t), kind: 'task', t, who: t.owner }))
  /* waiting on someone outside: locked to its follow-up day — that day it's back on the list (late after it) */
  s.tasks.filter((t) => isMine(t, role, me) && t.state === 'waiting' && !staleFollowUp(s, t)).forEach((t) => {
    const iso = isoFromLabel(t.followUp)
    if (!iso || iso > TODAY) return
    out.push({ key: t.id, b: bucketOfIso(iso), iso, kind: 'task', t, who: t.owner })
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
/** the number on Today in the menu: what's due today or late — the same number the page shows */
export const todayCount = (s: Store, role: Role) => plateOf(s, role).filter((x) => isNow(x.b)).length

function PlateRow({ x, showOwner, followed, overdue }: { x: PlateItem; showOwner?: boolean; followed?: boolean; overdue?: boolean }) {
  if (x.kind === 'meet') return <MeetingRow e={x.e!} showOwner={showOwner} />
  if (x.kind === 'daily') return <DailyRow d={x.d!} showOwner={showOwner} />
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
  const [view, setView] = React.useState<View>(t0 === 'waiting' ? 'waiting' : t0 === 'done' ? 'done' : t0 === 'tomorrow' ? 'tomorrow' : t0 === 'later' || t0 === 'coming' ? 'later' : 'today')
  const inside = role !== 'crew' && role !== 'client'
  const [scope, setScope] = React.useState<'mine' | 'all'>(t0 === 'team' && inside ? 'all' : 'mine')
  const [who, setWho] = React.useState<string>('all')
  const [job, setJob] = React.useState<string>('all')
  const me = meOf(role)
  const all = scope === 'all'
  const boss = role === 'owner' || role === 'pm' || role === 'office'
  const followsIt = (t?: Task) => !!t && t.owner !== me && followersOf(t).includes(me)
  /* one project at a time: everything for a job together (the site manager starts here) — remembered on this computer */
  const prefKey = `tileos-today-byjob:${role}`
  const [byJob, setByJob] = React.useState<boolean>(() => { try { const v = localStorage.getItem(prefKey); return v ? v === '1' : role === 'site' } catch { return role === 'site' } })
  const groupBy = (on: boolean) => { setByJob(on); try { localStorage.setItem(prefKey, on ? '1' : '0') } catch { /* private window */ } }
  /* everyone's list: each person's things together (late first) — or by project — never one mixed list unless asked */
  const teamKey = `tileos-today-teamgroup:${role}`
  const [teamGroup, setTeamGroup] = React.useState<'person' | 'job' | 'time'>(() => { try { const v = localStorage.getItem(teamKey); return v === 'job' || v === 'time' ? v : 'person' } catch { return 'person' } })
  const grouping: 'person' | 'job' | 'time' = all ? teamGroup : byJob ? 'job' : 'time'
  const setGrouping = (g: 'person' | 'job' | 'time') => {
    if (!all) { groupBy(g === 'job'); return }
    setTeamGroup(g)
    try { localStorage.setItem(teamKey, g) } catch { /* private window */ }
  }

  /* the counts never change with the filters — they're the facts */
  const plate = all ? teamPlate(s) : plateOf(s, role)
  const pick = (x: PlateItem) => (job === 'all' || (x.t?.jobId || x.d?.jobId || x.job?.id || x.e?.jobId) === job) && (!all || who === 'all' || (who === 'follow' ? followsIt(x.t) : x.who === who || (x.kind === 'meet' && x.e!.people.includes(who as PersonKey))))
  const today = plate.filter((x) => isNow(x.b))
  const late = plate.filter((x) => x.b === 'overdue')
  const tomorrow = plate.filter((x) => x.b === 'tomorrow')
  const later = plate.filter((x) => x.b === 'week' || x.b === 'later' || x.b === 'aside')
  /* waiting on others: what's out with the GC or a supplier — and what I asked for from the site, until it's delivered */
  const waiting = s.tasks.filter((t) => !staleFollowUp(s, t) && ((t.state === 'waiting' && (all ? true : isMine(t, role))) || (!all && t.by === me && t.owner !== me && t.state !== 'done')))
  /* steps waiting on someone outside — the store's tile, the installer's yes: they wait here with the day they're back */
  const waitSteps = Object.values(s.jobs).filter(isGettingReady).flatMap((j) => stepsFor(s, j).filter((v) => v.state === 'wait' && (all || v.owner === me)).map((v) => ({ job: j, v })))
  const done = s.tasks.filter((t) => t.state === 'done' && (all ? true : isMine(t, role)))
  const doneToday = done.filter((t) => t.doneAt === 'Just now' || t.doneAt === 'Today' || isoFromLabel(t.doneAt) === TODAY).length
  const meetingsToday = today.filter((x) => x.kind === 'meet').length
  const pinned = s.tasks.filter((t) => t.everyone && t.state !== 'done' && (job === 'all' || t.jobId === job))
  const jobsWithTasks = Object.values(s.jobs).filter((j) => s.tasks.some((t) => t.jobId === j.id) || s.events.some((e) => e.jobId === j.id))
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  /* one day: what's late (today only), then the day in time order — timed things first, then anytime */
  const dayBlock = (iso: string, items: PlateItem[], withLate = false) => {
    const lateRows = withLate ? items.filter((x) => x.b === 'overdue') : []
    const rows = items.filter((x) => x.b !== 'overdue')
    const timed = rows.filter((x) => x.time != null)
    const any = rows.filter((x) => x.time == null)
    const nowAt = iso === TODAY ? timed.findIndex((x) => (x.time ?? 0) > nowMin) : -1
    return (
      <React.Fragment key={iso}>
        {lateRows.length > 0 && (
          <section data-day="overdue">
            <Group label="Overdue" count={lateRows.length} tone="bad" right={<button onClick={() => s.open({ t: 'late' })} data-late-open className="text-[0.8125rem] font-medium text-muted hover:text-brand-700">Move or remind<ChevronRight className="ml-0.5 inline h-3.5 w-3.5 align-[-0.15em]" /></button>} />
            {lateRows.map((x) => <PlateRow key={x.key} x={x} showOwner={all} overdue followed={followsIt(x.t)} />)}
          </section>
        )}
        {(rows.length > 0 || !lateRows.length) && (
          <section data-day={iso}>
            <Group label={dayHead(iso)} count={rows.length} tone="info" />
            {timed.map((x, i) => (
              <React.Fragment key={x.key}>
                {i === nowAt && <NowLine min={nowMin} />}
                <PlateRow x={x} showOwner={all} followed={followsIt(x.t)} />
              </React.Fragment>
            ))}
            {iso === TODAY && timed.length > 0 && nowAt === -1 && <NowLine min={nowMin} />}
            {any.map((x) => <PlateRow key={x.key} x={x} showOwner={all} followed={followsIt(x.t)} />)}
            {!rows.length && <div className={cn('border-t border-line-2 py-6 text-[0.84375rem] text-muted', PX)}>Nothing on {dayHead(iso).toLowerCase() === 'today' ? 'today' : dayHead(iso)}.</div>}
          </section>
        )}
      </React.Fragment>
    )
  }

  /* by project: one section per job — what to check, do, hand over or record there, whatever day it's on */
  const jobOfItem = (x: PlateItem) => x.t?.jobId || x.d?.jobId || x.job?.id || x.e?.jobId || ''
  const byProject = (items: PlateItem[], tasksOnly?: Task[]) => {
    const keyOf = (id: string) => (id && s.jobs[id] ? s.jobs[id].name : '\uffff')
    const ids = Array.from(new Set(tasksOnly ? tasksOnly.map((t) => t.jobId || '') : items.map(jobOfItem))).sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
    return ids.map((id) => {
      const j = id ? s.jobs[id] : undefined
      const rows = items.filter((x) => jobOfItem(x) === id)
      const ts = (tasksOnly || []).filter((t) => (t.jobId || '') === id)
      return (
        <InJob.Provider key={id || 'none'} value><section aria-label={j ? j.name : 'Not on a project'}>
          <div className={cn(BAND, PX)} data-band>
            {j ? (
              <button onClick={() => s.open({ t: 'job', id })} className="min-w-0 truncate text-left text-[0.8125rem] font-semibold text-ink-2 hover:text-brand-700">{j.name}</button>
            ) : <span className="min-w-0 truncate text-[0.8125rem] font-semibold text-ink-2">Not on a project</span>}
            <span className="shrink-0 text-[0.8125rem] font-medium tnum text-faint">{rows.length + ts.length}</span>
          </div>
          {rows.map((x) => <PlateRow key={x.key} x={x} showOwner={all} overdue={x.b === 'overdue'} followed={followsIt(x.t)} />)}
          {ts.map((t) => <TaskRow key={t.id} t={t} showOwner={all} />)}
        </section></InJob.Provider>
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
          <div className={cn(BAND, PX)} data-band>
            {person && <Avatar who={p as PersonKey} size={20} />}
            {person ? (
              <button onClick={() => setWho(p)} className="min-w-0 truncate text-left text-[0.8125rem] font-semibold text-ink-2 hover:text-brand-700" title={`Only ${person.short}’s list`}>{person.name}</button>
            ) : <span className="min-w-0 truncate text-[0.8125rem] font-semibold text-ink-2">Nobody yet</span>}
            <span className="shrink-0 text-[0.8125rem] font-medium tnum text-faint">{rows.length + ts.length}</span>
            {lateN > 0 && <span className="shrink-0 text-[0.75rem] font-medium text-bad-600">{lateN} late</span>}
          </div>
          {rows.map((x) => <PlateRow key={x.key} x={x} overdue={x.b === 'overdue'} followed={followsIt(x.t)} />)}
          {ts.map((t) => <TaskRow key={t.id} t={t} />)}
        </section>
      )
    })
  }

  /* the admin's check-ins are their own part of Today — under the day, not mixed into it */
  const shownToday = today.filter(pick).filter((x) => x.kind !== 'checkin')
  const shownCheckins = all ? [] : today.filter((x) => x.kind === 'checkin')
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
  /* whose each row is: on everyone's list — unless it's grouped by person already */
  const whoCol = all && !(grouping === 'person' && view !== 'done')
  /* the column names show over a list that has rows */
  const hasRows = view === 'today' ? pinnedRows.length + shownToday.length + shownCheckins.length + undated.length > 0 : view === 'tomorrow' ? shownTomorrow.length > 0 : view === 'later' ? shownLater.length > 0 : view === 'waiting' ? shownWaiting.length + shownWaitSteps.length > 0 : shownDone.length > 0

  return (
    <Page
      title={`${greeting()}, ${PEOPLE[me].short}`}
      sub={TODAY_LABEL}
      top={<>
        <Bubbles
          items={[
            { key: 'today', label: 'Today', count: today.length, icon: <ListTodo />, color: 'blue', on: view === 'today', onClick: () => setView('today') },
            { key: 'tomorrow', label: 'Tomorrow', count: tomorrow.length, icon: <CalendarDays />, color: 'violet', on: view === 'tomorrow', onClick: () => setView('tomorrow') },
            { key: 'later', label: 'Later', count: later.length, icon: <CalendarRange />, color: 'slate', on: view === 'later', onClick: () => setView('later') },
            { key: 'waiting', label: 'Waiting on others', count: waiting.length + waitSteps.length, icon: <Hourglass />, color: 'amber', on: view === 'waiting', onClick: () => setView('waiting'), gapBefore: true },
            { key: 'done', label: 'Done', count: done.length, icon: <CircleCheckBig />, color: 'green', on: view === 'done', onClick: () => setView('done') },
          ]}
        />
      </>}
      toolbar={
        <div className="flex w-full flex-wrap items-center gap-2">
          {inside && <ViewSwitch label="Whose list" value={scope} onChange={(k) => { setScope(k); setWho('all') }} items={[{ key: 'mine', label: 'Mine', icon: <UserRound /> }, { key: 'all', label: 'Everyone', icon: <Users /> }]} />}
          {/* one person's list — the admin and the office see what's on anyone's plate */}
          {all && <Filter icon={<UserRound />} label="Person" value={who} allLabel="Everyone" options={[{ key: 'follow', label: 'What I follow', hint: 'Things you watch' }, ...(insidePeople(s).length ? insidePeople(s) : ASSIGNABLE).filter((p) => p !== me).map((p) => ({ key: p, label: PEOPLE[p]?.name || p, hint: PEOPLE[p]?.roleLabel }))]} onChange={(v) => { setWho(v as string); if (v !== 'all') setScope('all') }} />}
          {view !== 'done' && <ViewSwitch label="How it's grouped" value={grouping} onChange={setGrouping} items={all ? [{ key: 'person', label: 'By person', icon: <UserRound /> }, { key: 'job', label: 'By project', icon: <Building2 /> }, { key: 'time', label: 'By time', icon: <Clock3 /> }] : [{ key: 'time', label: 'By time', icon: <Clock3 /> }, { key: 'job', label: 'By project', icon: <Building2 /> }]} />}
          <span className="flex-1 max-md:hidden" />
          <Filter icon={<Building2 />} label="Project" value={job} options={jobsWithTasks.map((j) => ({ key: j.id, label: j.name, hint: j.client }))} onChange={setJob} width={280} />
          <ClearFilters show={job !== 'all' || who !== 'all'} onClear={() => { setJob('all'); setWho('all') }} />
        </div>
      }
    >
      {/* whose each row is: on everyone's list — unless it's grouped by person already */}
      <WhoCol.Provider value={whoCol}>
      <div>
        {hasRows && <div className={cn(STICKY_HEAD, 'max-md:hidden')}><TodoHead who={whoCol} inJob={grouping === 'job' && view !== 'done'} /></div>}
        {/* for everyone: an ordinary row, on top — whose it is and the project like any other */}
        {pinnedRows.length > 0 && view === 'today' && (
          <section data-pinned>
            <Group label="For everyone" count={pinnedRows.length} tone="warn" />
            {pinnedRows.map((t) => <TaskRow key={t.id} t={t} showOwner={all} when={{ text: 'Anytime', tone: 'quiet' }} />)}
          </section>
        )}

        {view === 'today' && (shownToday.length ? (grouping === 'job' ? byProject(shownToday) : grouping === 'person' ? byPerson(shownToday) : dayBlock(TODAY, shownToday, true)) : !shownCheckins.length && <EmptyState icon={<Check />} title="Nothing due today" sub={tomorrow.length ? `${tomorrow.length} for tomorrow — see Tomorrow.` : 'New work lands here the moment it’s yours.'} />)}
        {view === 'today' && shownCheckins.length > 0 && <CheckInSection items={shownCheckins} />}
        {view === 'today' && undated.length > 0 && (
          <section>
            <Group label="No day set" count={undated.length} tone="neutral" />
            {undated.map((x) => <PlateRow key={x.key} x={x} showOwner={all} followed={followsIt(x.t)} />)}
          </section>
        )}
        {view === 'today' && shownToday.length > 0 && tomorrow.length > 0 && (
          <button onClick={() => setView('tomorrow')} className={cn('flex w-full items-center gap-2 border-t border-line-2 py-3 text-left text-[0.84375rem] font-semibold text-muted row-hover hover:text-ink', PX)}>
            <CalendarDays className="h-4 w-4" />{tomorrow.length} for tomorrow<ChevronRight className="h-4 w-4" />
          </button>
        )}

        {view === 'tomorrow' && (shownTomorrow.length ? (grouping === 'job' ? byProject(shownTomorrow) : grouping === 'person' ? byPerson(shownTomorrow) : dayBlock(TOMORROW, shownTomorrow)) : <EmptyState icon={<Check />} title="Nothing for tomorrow yet" sub="Anything due tomorrow, and tomorrow’s meetings, show here." />)}

        {view === 'later' && grouping === 'job' && byProject(shownLater)}
        {view === 'later' && grouping === 'person' && byPerson(shownLater)}
        {view === 'later' && grouping === 'time' && anyDay.length > 0 && (
          <section>
            <Group label="This week" count={anyDay.length} tone="info" />
            {anyDay.map((x) => <PlateRow key={x.key} x={x} showOwner={all} followed={followsIt(x.t)} />)}
          </section>
        )}
        {view === 'later' && grouping === 'time' && laterDays.map((d) => dayBlock(d, shownLater.filter((x) => x.iso === d && x.b !== 'aside' && !anyDay.includes(x))))}
        {view === 'later' && grouping === 'time' && noDate.length > 0 && (
          <section>
            <Group label="No date" count={noDate.length} tone="neutral" />
            {noDate.map((x) => <PlateRow key={x.key} x={x} showOwner={all} />)}
          </section>
        )}
        {view === 'later' && grouping === 'time' && aside.length > 0 && (
          <section>
            <Group label="Set aside" count={aside.length} tone="neutral" />
            {aside.map((x) => <PlateRow key={x.key} x={x} showOwner={all} />)}
          </section>
        )}
        {view === 'later' && !shownLater.length && <EmptyState icon={<Check />} title="Nothing later" sub="Anything with a date after tomorrow shows here, day by day." />}

        {view === 'waiting' && (shownWaiting.length > 0 || shownWaitSteps.length > 0) && (
          <>
            {grouping === 'job' ? byProject([], shownWaiting) : grouping === 'person' ? byPerson([], shownWaiting) : shownWaiting.map((t) => <TaskRow key={t.id} t={t} showOwner={all} />)}
            {shownWaitSteps.map(({ job: j, v }) => <StepRowToday key={`w:${j.id}:${v.key}`} job={j} v={v} showOwner={all} when={waitWhen(v)} />)}
          </>
        )}
        {view === 'waiting' && !shownWaiting.length && !shownWaitSteps.length && <EmptyState icon={<Check />} title="Nothing waiting on others" sub="When you’re waiting on the store, the GC, a supplier or a client, it waits here with the day it comes back to you." />}

        {view === 'done' && shownDone.slice(0, doneN).map((t) => <TaskRow key={t.id} t={t} showOwner={all} />)}
        {view === 'done' && shownDone.length > doneN && <button onClick={() => setDoneN(doneN + 40)} className={cn('w-full border-t border-line-2 py-3 text-left text-[0.84375rem] font-semibold text-brand-700 hover:bg-brand-50/40', PX)}>Show older — {shownDone.length - doneN} more</button>}
        {view === 'done' && !shownDone.length && <EmptyState icon={<Check />} title="Nothing done yet" sub="Finished tasks stay here for the record." />}
      </div>
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
/** someone else's task: remind them — it pops up on their screen — and, when it's late, it counts as checking in */
function remindTask(t: Task) {
  const st = useStore.getState()
  const me = meOf(st.role)
  const late = taskBucket(t) === 'overdue' || (t.state === 'waiting' && (isoFromLabel(t.followUp) || '9') < TODAY)
  st.commit((x) => {
    const y = x.tasks.find((z) => z.id === t.id)
    if (!y) return
    y.nudge = { by: me, at: Date.now().toString(36), day: TODAY }
    if (late) y.checkIn = { by: me, day: TODAY }
    ;(y.log ||= []).push({ date: NOW, who: me, text: `Reminded ${PEOPLE[y.owner]?.short || ''}` })
  }, `Reminder sent to ${PEOPLE[t.owner]?.short || 'them'}`, { sub: 'It pops up on their screen, and it’s on their Today.', undo: false })
}

export function TaskModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const t = s.tasks.find((x) => x.id === id)
  const [note, setNote] = React.useState('')
  const [as, setAs] = React.useState<PersonKey | null>(null)
  const [waitOpen, setWaitOpen] = React.useState(false)
  const [laterOpen, setLaterOpen] = React.useState(false)
  const [dueOpen, setDueOpen] = React.useState(false)
  if (!t) return null
  const job = s.jobs[t.jobId]
  const me = meOf(s.role)
  /* someone else's: you see whose it is, what it's for and where it came from — you remind them or take it over; only
     its person finishes it (no "Done" for anyone else — nothing ends up nowhere) */
  const theirs = t.owner !== me && !isMine(t, s.role)
  const admin = s.role === 'owner' || s.role === 'pm'
  const from = taskOrigin(t)
  const hasAction = !!t.action && t.state !== 'done' && t.action.kind !== 'open-job'
  const b = taskBucket(t)
  const addNote = () => { if (!note.trim()) return; s.noteTask(t.id, note.trim(), as || undefined); setNote('') }
  /* one pill says where it stands — the date lives inside it, tap it to change the date */
  const pill =
    t.state === 'now' ? (
      <Pop open={dueOpen} onOpenChange={setDueOpen} align="start" width={360} trigger={
        <button className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[0.78125rem] font-semibold transition', b === 'overdue' ? 'bg-bad-50 text-bad-700 hover:bg-bad-100' : b === 'today' ? 'bg-warn-50 text-warn-700 hover:bg-warn-100' : 'border border-line bg-white text-ink-2 hover:bg-wash')}>
          <CalendarDays className="h-3.5 w-3.5" />{b === 'overdue' ? (/late/i.test(t.due || '') ? t.due : `Was due ${t.due}`) : b === 'today' ? 'Due today' : t.due ? `Due ${t.due}` : 'No date'}
        </button>
      }>
        <div className="mb-3 text-[0.875rem] font-medium text-ink">Change the date</div>
        <DatePresets value={t.due} onPick={(d) => { s.setTaskDue(t.id, d); setDueOpen(false) }} />
      </Pop>
    ) : t.state === 'waiting' ? <Status tone="warn">Waiting on {t.waitingOn} · back {t.followUp}</Status>
      : t.state === 'later' ? <Status tone="neutral">Set aside · back {t.laterUntil}</Status>
        : <Status tone="ok">Done{t.doneAt ? ` ${t.doneAt}` : ''}</Status>

  const header = (
    <div className="border-b border-line px-6 pb-4 pt-5 pr-16 max-sm:px-4">
      <div className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-faint" />
        {job ? <button onClick={() => s.open({ t: 'job', id: job.id })} className="truncate font-medium text-ink-2 hover:text-brand-700">{job.name}</button> : <span>Company</span>}
        {t.where && <span className="truncate">· {t.where}</span>}
      </div>
      <h2 className="font-display mt-1.5 text-[1.3125rem] font-semibold leading-snug tracking-[-0.01em] text-ink max-sm:text-[1.1875rem]">{cleanTitle(t.title, job)}</h2>
      {from && <div className="mt-1 text-[0.78125rem] text-muted" data-task-from>{from}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pill}
        <Menu align="start" width={250} trigger={<button className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-white pl-0.5 pr-2.5 text-[0.78125rem] font-semibold text-ink-2 hover:bg-wash"><Avatar who={t.owner} size={22} />{PEOPLE[t.owner].short} has it</button>}>
          <MenuLabel>Hand it to</MenuLabel>
          {(insidePeople(s).length ? insidePeople(s) : ASSIGNABLE).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={t.owner === p} onSelect={() => s.reassignTask(t.id, p)} hint={PEOPLE[p]?.roleLabel}>{PEOPLE[p]?.name || p}</MenuItem>)}
        </Menu>
        {t.repeat && <span className="inline-flex items-center gap-1.5 text-[0.78125rem] font-medium text-ink-2"><Repeat className="h-3.5 w-3.5 text-muted" />{REPEAT_LABEL[t.repeat]}{t.repeatAt ? ` at ${t.repeatAt}` : ''}</span>}
        {t.blocks && t.state !== 'done' && <span className="inline-flex items-center gap-1.5 text-[0.78125rem] font-medium text-bad-700"><Ban className="h-3.5 w-3.5" />Holds up {t.blocks.charAt(0).toLowerCase() + t.blocks.slice(1)}</span>}
      </div>
    </div>
  )

  const footer =
    t.state === 'done' ? (
      <>
        <span className="text-[0.84375rem] text-muted">{t.result ? `Result: ${t.result}` : 'Finished and logged.'}</span>
        {(!theirs || admin) && <Button className="ml-auto" icon={<RotateCcw />} onClick={() => s.reopenTask(t.id)}>Reopen</Button>}
      </>
    ) : theirs ? (
      <>
        <Button variant="ghost" icon={<BellRing />} onClick={() => { remindTask(t); s.close() }} data-remind-task>Remind {PEOPLE[t.owner]?.short || 'them'}</Button>
        {admin && <Button className="ml-auto" icon={<UserRound />} onClick={() => s.reassignTask(t.id, me)} data-take-task>Take it over</Button>}
      </>
    ) : (
      <>
        {t.state === 'waiting' ? (
          <Pop open={waitOpen} onOpenChange={setWaitOpen} side="top" width={380} trigger={<Button icon={<Hourglass />} data-followed-up>Followed up — still waiting</Button>}>
            <FollowedUp t={t} onDone={() => { setWaitOpen(false); s.close() }} />
          </Pop>
        ) : t.state !== 'now' ? (
          <Button variant="ghost" icon={<RotateCcw />} onClick={() => s.reopenTask(t.id)}>Back on my list</Button>
        ) : (
          <>
            <Pop open={laterOpen} onOpenChange={setLaterOpen} side="top" width={360} trigger={<Button variant="ghost" icon={<MoonStar />}>Not today</Button>}>
              <LaterPicker onCancel={() => setLaterOpen(false)} onSave={(u) => { setLaterOpen(false); s.laterTask(t.id, u); s.close() }} />
            </Pop>
            <Pop open={waitOpen} onOpenChange={setWaitOpen} side="top" width={420} trigger={<Button variant="ghost" icon={<Clock3 />}><span className="max-sm:hidden">Waiting on someone</span><span className="sm:hidden">Waiting</span></Button>}>
              <WaitPicker defaultWho={t.waitingOn} onCancel={() => setWaitOpen(false)} onSave={(w, bk) => { setWaitOpen(false); s.waitTask(t.id, w, bk); s.close() }} />
            </Pop>
          </>
        )}
        {hasAction ? (
          <Button variant="primary" className="ml-auto max-sm:flex-1" onClick={() => runTaskAction(t)}>{t.action!.label}</Button>
        ) : (
          isRequest(t) && t.owner === meOf(s.role) ? <span className="ml-auto max-sm:flex-1"><TripButtons t={t} size="md" onDone={() => s.close()} /></span> : <Button variant="primary" className="ml-auto max-sm:flex-1" icon={isRequest(t) ? <Truck /> : <Check />} onClick={() => { s.completeTask(t.id); s.close() }}>{isRequest(t) ? 'Dropped off' : 'Done'}</Button>
        )}
      </>
    )

  return (
    <Modal level={level} size="md" onClose={s.close} header={header} footer={footer} title={t.title} bodyClass="px-6 py-5 max-sm:px-4">
      {theirs && t.state !== 'done' && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-wash px-3.5 py-2.5 text-[0.875rem] text-ink-2" data-theirs-task>
          <Avatar who={t.owner} size={28} plain />
          <span className="min-w-0 flex-1">It’s <b className="font-semibold text-ink">{PEOPLE[t.owner]?.short}</b>’s{t.state === 'waiting' ? ` — waiting on ${t.waitingOn || 'someone'}, back ${t.followUp}` : t.due ? ` — due ${t.due}` : ''}. {PEOPLE[t.owner]?.short} finishes it; you can remind them{admin ? ' or take it over' : ''}.</span>
        </div>
      )}
      {(t.detail || !(t.log || []).length) && <p className="text-[0.9375rem] leading-relaxed text-ink">{t.detail || t.title}</p>}
      {/* who else sees it */}
      <div className={cn('flex flex-wrap items-center gap-2 rounded-[0.75rem] border border-line px-3 py-2', (t.detail || !(t.log || []).length) && 'mt-4')}>
        <span className="text-[0.78125rem] font-semibold text-muted">Following</span>
        <span className="flex -space-x-1.5">{followersOf(t).map((p) => <Avatar key={p} who={p} size={24} ring />)}</span>
        <Menu align="start" width={260} trigger={<button className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[0.78125rem] font-semibold text-brand-600 hover:bg-brand-50"><UserPlus className="h-3.5 w-3.5" />{followersOf(t).length ? 'Change' : 'Add people'}</button>}>
          <MenuLabel>They see it and hear when it moves</MenuLabel>
          {ASSIGNABLE.filter((p) => p !== t.owner).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={followersOf(t).includes(p)} hint={PEOPLE[p].roleLabel} onSelect={() => toggleFollow(t.id, p)}>{PEOPLE[p].name}</MenuItem>)}
        </Menu>
        {t.owner !== me && !followersOf(t).includes(me) && <button onClick={() => toggleFollow(t.id, me)} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[0.78125rem] font-semibold text-vio-600 hover:bg-vio-50"><Eye className="h-3.5 w-3.5" />Follow</button>}
        <button onClick={() => setEveryone(t.id, !t.everyone)} className="ml-auto inline-flex items-center gap-2 text-[0.78125rem] font-semibold text-ink-2" aria-pressed={!!t.everyone}>
          <Megaphone className={cn('h-3.5 w-3.5', t.everyone ? 'text-warn-600' : 'text-faint')} />On everyone’s Today
          <span className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition', t.everyone ? 'bg-warn-500' : 'bg-[#d9d3c9]')}><span className={cn('absolute h-4 w-4 rounded-full bg-white shadow transition', t.everyone ? 'left-[1.125rem]' : 'left-0.5')} /></span>
        </button>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-[0.8125rem] font-semibold text-ink">Notes and history</span>
        {job && <button onClick={() => s.open({ t: 'job', id: job.id })} className="text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700">Open {job.name}</button>}
      </div>
      <div className="mt-1.5 -mx-2">
        {[...(t.log || [])].reverse().map((l, i) => <ActivityRow key={i} jobId={t.jobId || undefined} e={{ date: l.date, who: l.who, kind: 'system', title: l.text }} compact />)}
        {!(t.log || []).length && <div className="px-2 text-[0.84375rem] text-muted">Nothing yet.</div>}
      </div>
      {t.state !== 'done' && (
        <div className="mt-3 flex items-center gap-2">
          {s.role === 'owner' && (
            <Menu align="start" width={260} trigger={<button aria-label="Write it as" title={as ? `Writing for ${PEOPLE[as].name}` : 'Writing as you'} className={cn('inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border px-1.5', as ? 'border-warn-300 bg-warn-50' : 'border-line bg-white hover:bg-wash')}><Avatar who={as || me} size={26} /></button>}>
              <MenuLabel>Write it as</MenuLabel>
              <MenuItem icon={<Avatar who={me} size={20} />} checked={!as} onSelect={() => setAs(null)}>Me</MenuItem>
              {s.team.filter((m) => m.key !== me && m.status !== 'off').map((m) => <MenuItem key={m.key} icon={<Avatar who={m.key} size={20} />} checked={as === m.key} hint="marked as written by you" onSelect={() => setAs(m.key)}>{PEOPLE[m.key].name}</MenuItem>)}
            </Menu>
          )}
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={as ? `A note for ${PEOPLE[as].short}…` : 'Add a note…'} onKeyDown={(e) => { if (e.key === 'Enter') addNote() }} />
          <Button disabled={!note.trim()} onClick={addNote}>Add</Button>
        </div>
      )}
    </Modal>
  )
}

/* ================= a new task: type it, pick who and when, done ================= */
const WHEN: [string, string][] = [['Today', 'Today'], ['Tomorrow', 'Tomorrow'], ['Fri', 'Friday'], ['Next Mon', 'Next Monday'], ['In 2 weeks', 'In 2 weeks']]
const DAY_WORDS: [RegExp, string][] = [[/\btoday\b|\btonight\b/, 'Today'], [/\btomorrow\b/, 'Tomorrow'], [/\bnext week\b/, 'Next Mon'], [/\bmon(day)?\b/, 'Mon'], [/\btue(s|sday)?\b/, 'Tue'], [/\bwed(nesday)?\b/, 'Wed'], [/\bthu(rs|rsday)?\b/, 'Thu'], [/\bfri(day)?\b/, 'Fri']]
/** what kind of task, from the words in it — nobody has to pick */
function guessType(title: string): TaskType {
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
export function NewTaskModal({ level, jobId, fromMsg }: { level: number; jobId?: string; /** made from this message on the project: it starts filled in */ fromMsg?: string }) {
  const s = useStore()
  const me = meOf(s.role)
  const msg = fromMsg && jobId ? s.messages[jobId]?.find((x) => x.id === fromMsg) : undefined
  const [title, setTitle] = React.useState(() => (msg ? (msg.text.length > 70 ? msg.text.slice(0, 68).trimEnd() + '…' : msg.text) : ''))
  const [job, setJob] = React.useState<string>(jobId || '')
  const [owner, setOwner] = React.useState<PersonKey>(me)
  const [due, setDue] = React.useState('Tomorrow')
  const [picked, setPicked] = React.useState(false)
  const [repeat, setRepeat] = React.useState<'' | NonNullable<Task['repeat']>>('')
  const [at, setAt] = React.useState('4 PM')
  const [fol, setFol] = React.useState<PersonKey[]>([])
  const [all, setAll] = React.useState(false)
  const [more, setMore] = React.useState(false)
  const projects = Object.values(s.jobs).filter((j) => !['request', 'estimating', 'proposal', 'followup'].includes(j.stage) || j.id === jobId)
  const [jobPicked, setJobPicked] = React.useState(!!jobId)
  const [heard, setHeard] = React.useState('')
  const people = insidePeople(s)
  const common = COMMON_TASKS.filter((x) => x.for.includes(s.role)).map((x) => x.t)
  /* "call the GC tomorrow" sets the day, and "828 Clyde — …" the project, by themselves — until you pick one */
  const onTitle = (v: string) => {
    setTitle(v)
    if (!jobPicked) {
      const p = projectIn(v, Object.values(s.jobs))
      if (p) { setJob(p.id); setHeard(p.name) } else if (heard) { setJob(''); setHeard('') }
    }
    if (picked || repeat) return
    const hit = DAY_WORDS.find(([re]) => re.test(v.toLowerCase()))
    if (hit) setDue(hit[1])
  }
  const add = () => {
    if (!title.trim()) return
    const j = s.jobs[job]
    const clean = (j && heard ? withoutProject(title.trim(), j) : title.trim()) || title.trim()
    const role = s.team.find((m) => m.key === owner)?.role
    s.addTask({ jobId: job, title: clean, type: guessType(title), owner, due: repeat ? 'Today' : due, for: role ? [role] : ROLE_OF[owner] || ['owner'], state: 'now', tone: 'info', repeat: repeat || undefined, repeatAt: repeat ? at : undefined, where: repeat ? `${REPEAT_LABEL[repeat]} at ${at}` : msg ? 'From a message' : undefined, detail: msg ? `From ${PEOPLE[msg.who]?.name || 'someone'} in the project messages, ${msg.date} ${msg.time}: “${msg.text}”` : undefined, followers: fol.filter((p) => p !== owner), everyone: all || undefined })
    if (msg && jobId) markMessageTask(jobId, msg.id)
    s.close()
  }
  /* the same frame as every + New: a box with a dropdown look */
  const chip = 'flex h-10 w-full min-w-0 items-center gap-2 rounded-[0.625rem] border border-line bg-white px-3 text-left text-[0.875rem] text-ink transition hover:border-[#cdc7bc] data-[state=open]:border-brand-300 data-[state=open]:ring-[0.1875rem] data-[state=open]:ring-brand-50'
  const whenLabel = repeat ? `${REPEAT_LABEL[repeat]} · ${at}` : WHEN.find(([k]) => k === due)?.[1] || due
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="New task"
      header={<FormHead k="task" kicker={jobId && s.jobs[jobId] ? s.jobs[jobId].name : undefined} title="Task" />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={
        <>
          <span className="truncate text-[0.8125rem] text-muted max-sm:hidden">{owner === me ? 'On your Today' : `On ${PEOPLE[owner].short}’s Today`} {repeat ? `· ${REPEAT_LABEL[repeat].toLowerCase()}` : `· ${whenLabel.toLowerCase()}`}</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!title.trim()} onClick={add}>{repeat ? 'Add repeating task' : 'Add task'}</Button>
        </>
      }
    >
      {msg && (
        <div className="mb-3 flex min-w-0 items-start gap-2.5 rounded-xl bg-[#f6f3ee] px-3 py-2.5 text-[0.8125rem]" data-from-msg>
          <Avatar who={msg.who} size={24} />
          <span className="min-w-0 leading-snug"><b className="font-semibold text-ink">{PEOPLE[msg.who]?.name || 'Someone'}</b> <span className="text-muted">· {msg.time}</span><span className="mt-0.5 block text-ink-2">{msg.text}</span></span>
        </div>
      )}
      <FormRow label="What needs to be done?">
        <SuggestInput value={title} onChange={onTitle} onEnter={add} suggestions={common} label="What needs to be done?" placeholder="Type it or say it" listLabel="The usual ones — tap to pick" />
        {heard && !jobPicked && <div className="mt-1.5 text-[0.78125rem] font-medium text-brand-700">Project: {heard} — from what you wrote</div>}
      </FormRow>
      {!jobId && (
        <FormRow label="Project" hint="Leave it empty for something for the whole company">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1"><ProjectField value={job} onChange={(k) => { setJob(k); setJobPicked(true); setHeard('') }} keep={(j) => projects.includes(j)} /></div>
            {job && <button type="button" onClick={() => { setJob(''); setJobPicked(true); setHeard('') }} className="shrink-0 rounded-md px-2 py-1 text-[0.8125rem] font-semibold text-muted hover:bg-wash hover:text-ink">Company-wide</button>}
          </div>
        </FormRow>
      )}
      <FormRow label="Who does it">
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <Menu align="start" width={260} trigger={<button type="button" aria-label="Who does it" className={chip}><Avatar who={owner} size={22} /><span className="min-w-0 flex-1 truncate">{owner === me ? 'Me' : PEOPLE[owner].name}</span><ChevronDown className="h-4 w-4 shrink-0 text-faint" /></button>}>
            <MenuLabel>Who does it</MenuLabel>
            {(people.length ? people : ASSIGNABLE).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={owner === p} onSelect={() => setOwner(p)} hint={PEOPLE[p]?.roleLabel}>{p === me ? `${PEOPLE[p]?.name} (me)` : PEOPLE[p]?.name}</MenuItem>)}
          </Menu>
          <span className="flex min-w-0 gap-2">
            <Menu align="start" width={240} trigger={<button type="button" aria-label="When" className={chip}><span className="inline-flex shrink-0 text-faint">{repeat ? <Repeat className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}</span><span className="min-w-0 flex-1 truncate">{whenLabel}</span><ChevronDown className="h-4 w-4 shrink-0 text-faint" /></button>}>
              <MenuLabel>Due</MenuLabel>
              {WHEN.map(([k, l]) => <MenuItem key={k} checked={!repeat && due === k} onSelect={() => { setRepeat(''); setDue(k); setPicked(true) }}>{l}</MenuItem>)}
              <MenuSep />
              <MenuLabel>Repeats</MenuLabel>
              {(Object.keys(REPEAT_LABEL) as NonNullable<Task['repeat']>[]).map((r) => <MenuItem key={r} icon={<Repeat className="h-4 w-4" />} checked={repeat === r} onSelect={() => setRepeat(r)}>{REPEAT_LABEL[r]}</MenuItem>)}
            </Menu>
            {repeat && (
              <Menu align="start" width={180} trigger={<button type="button" aria-label="At" className={cn(chip, 'w-auto shrink-0')}><Clock3 className="h-4 w-4 text-faint" />at {at}<ChevronDown className="h-4 w-4 text-faint" /></button>}>
                {['8 AM', 'Noon', '4 PM', '6 PM'].map((x) => <MenuItem key={x} checked={at === x} onSelect={() => setAt(x)}>{x}</MenuItem>)}
              </Menu>
            )}
          </span>
        </div>
      </FormRow>
      {!more ? (
        <button type="button" onClick={() => setMore(true)} className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-700 hover:text-brand-800">
          <Plus className="h-3.5 w-3.5" />Someone follows it, or show it to everyone
        </button>
      ) : (
        <FormRow label="Others">
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-1.5 text-[0.78125rem] font-semibold text-muted">Who follows it — they see every note and when it’s done</div>
              <div className="flex flex-wrap gap-1.5">
                {(people.length ? people : ASSIGNABLE).filter((p) => p !== owner).map((p) => <Chip key={p} on={fol.includes(p)} onClick={() => setFol(fol.includes(p) ? fol.filter((x) => x !== p) : [...fol, p])} className="h-8 px-2.5 text-[0.8125rem]" icon={<Avatar who={p} size={18} />}>{PEOPLE[p]?.short || p}</Chip>)}
                {people.length < 2 && <span className="self-center text-[0.8125rem] text-muted">Nobody else on the team yet — add people in Settings → Team.</span>}
              </div>
            </div>
            <button type="button" onClick={() => setAll(!all)} className={cn('flex items-center gap-3 rounded-[0.6875rem] border px-3 py-2 text-left transition', all ? 'border-warn-300 bg-warn-50' : 'border-line hover:bg-wash')}>
              <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full', all ? 'bg-warn-500 text-white' : 'bg-wash-2 text-muted')}><Megaphone className="h-3.5 w-3.5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[0.84375rem] font-semibold text-ink">Show it on everyone’s Today</span><span className="block text-[0.75rem] text-muted">For the big ones — pinned for the whole team until it’s done</span></span>
              <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition', all ? 'bg-warn-500' : 'bg-[#d9d3c9]')}><span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', all ? 'left-[1.125rem]' : 'left-0.5')} /></span>
            </button>
          </div>
        </FormRow>
      )}
    </Modal>
  )
}

/* ================= the daily crew report (site manager → owner) ================= */
export function CrewReportModal({ taskId, level }: { taskId?: string; level: number }) {
  const s = useStore()
  const on = s.bookings.filter((b) => b.start <= TODAY_ISO && b.end >= TODAY_ISO && s.jobs[b.jobId])
  const [rows, setRows] = React.useState(() => on.map((b) => ({ jobId: b.jobId, crew: b.crew as PersonKey, workers: b.workers || 2, note: '' })))
  const people = rows.reduce((n, r) => n + r.workers, 0)
  const set = (i: number, p: Partial<(typeof rows)[number]>) => setRows((x) => x.map((r, k) => (k === i ? { ...r, ...p } : r)))
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title="Daily crew report"
      sub={`${dayShort(TODAY)} · who is working where, and how far each job is — it goes to Yanky`}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{rows.length} jobs · {people} people</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" onClick={() => { sendCrewReport(taskId, rows); s.close() }}>Send report</Button>
        </>
      }
    >
      <div className="-mx-6 -my-5 max-sm:-mx-4">
        {rows.map((r, i) => {
          const j = s.jobs[r.jobId]
          return (
            <div key={r.jobId} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2.5 border-b border-line-2 px-6 py-4 last:border-0 max-sm:px-4">
              <div className="min-w-0">
                <div className="text-[0.9375rem] font-medium text-ink">{j.name}</div>
                <div className="text-[0.8125rem] text-muted">{PEOPLE[r.crew].name}’s crew · {j.pct ?? 0}% installed{s.diary[r.jobId]?.[0] ? ` · last update ${s.diary[r.jobId][0].day.split(',')[0]}` : ''}</div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[0.8125rem] text-muted">People</span>
                <Stepper value={r.workers} onChange={(n) => set(i, { workers: n })} min={0} max={20} />
              </div>
              <TextInput className="col-span-2" value={r.note} onChange={(e) => set(i, { note: e.target.value })} placeholder={`Where they’re up to — e.g. ${j.next?.text || 'guest bath walls done, starting the floor'}`} />
            </div>
          )
        })}
        {!rows.length && <div className="px-6 py-10 text-center text-[0.875rem] text-muted">No crews are booked today.</div>}
      </div>
    </Modal>
  )
}
