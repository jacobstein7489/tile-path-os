/* Today — your day, in the order it happens. What's late first, then the day hour by hour (meetings at their time),
 * then what can be done any time. Tomorrow and Later are the same, a day at a time. Every row: when · what ·
 * project · the one button. Checklist steps that are your turn show up by themselves — that's the hand-off.
 * Mine / Everyone switches between your list and the whole team's. */
import { InboxStrip } from './inbox'
import * as React from 'react'
import { CalendarRange, Check, Plus, Repeat, Clock3, MoonStar, RotateCcw, Ban, Building2, CalendarDays, UserRound, HardHat, ListTodo, Hourglass, CircleCheckBig, Eye, Users, Megaphone, UserPlus, FileText, ClipboardList, Package, ArrowLeftRight, Receipt, ListChecks, HandCoins, ChevronRight, ChevronDown, ListPlus } from 'lucide-react'
import { useStore, meOf, NOW, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Field, Chip, Stepper } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, MenuSep, Pop, DatePresets, WaitPicker, LaterPicker } from '@/tileos/components/ui/overlay'
import { Page, Filter, ClearFilters, Group, EmptyState, Status, Bubbles, PX, ViewSwitch } from '@/tileos/components/ui/page'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn, greeting } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, loginOf, type Role, type PersonKey, type Job } from '@/tileos/data/model'
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
import { stepTodos, type StepView } from './steps'
import { StepButton } from './steps-ui'
import { todoOf } from './stepwin'
import { TODAY, TOMORROW, dayShort, dayLongFull, isoFromLabel, labelFromIso, addDays, md } from '@/tileos/lib/today'
import { REAL } from '@/tileos/lib/save'
import { SuggestInput } from '@/tileos/components/ui/suggest'
import { insidePeople } from './steps-ui'

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
  if (me && t.owner === me) return true
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

/* ---------------- one row, the same for everything: when · what · project · the one button ---------------- */
const GRID = 'grid grid-cols-[6rem_minmax(0,1fr)_minmax(9.375rem,13.75rem)_11.5rem] items-center gap-6 max-xl:grid-cols-[5.5rem_minmax(0,1fr)_10.625rem] max-md:grid-cols-[4.125rem_minmax(0,1fr)_auto] max-md:gap-3'
function TodoRow({ when, whenTone, icon, title, detail, project, action, onClick, done, leaving, owner }: {
  when?: React.ReactNode; whenTone?: 'bad' | 'warn' | 'strong' | 'quiet'; icon?: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; project?: string; action?: React.ReactNode; onClick?: () => void; done?: boolean; leaving?: boolean; owner?: PersonKey
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onClick() } : undefined}
      className={cn('group/row min-h-[3.5rem] border-t border-line-2 py-2.5 transition-colors', GRID, PX, onClick && 'cursor-pointer hover:bg-[#f7f5f0]', leaving && 'row-out')}
    >
      <span className={cn('truncate text-[0.84375rem] tnum', whenTone === 'bad' ? 'font-semibold text-bad-600' : whenTone === 'warn' ? 'font-semibold text-warn-700' : whenTone === 'strong' ? 'font-semibold text-ink' : 'text-faint')}>{when}</span>
      <span className="flex min-w-0 items-center gap-3">
        {icon && <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5625rem] [&_svg]:h-4 [&_svg]:w-4 max-md:hidden', done ? 'bg-ok-50 text-ok-600' : 'bg-wash-2 text-ink-2')}>{done ? <Check strokeWidth={2.6} /> : icon}</span>}
        <span className="min-w-0">
          <span className={cn('block truncate text-[0.875rem] font-semibold leading-5', done ? 'text-muted line-through decoration-faint' : 'text-ink')}>{title}</span>
          <span className="flex min-w-0 items-center gap-2 text-[0.78125rem] leading-[1.125rem] text-muted">
            {owner && <span className="inline-flex shrink-0 items-center gap-1 font-medium text-ink-2"><Avatar who={owner} size={16} />{PEOPLE[owner]?.short}</span>}
            {project && <span className="truncate xl:hidden">{project}</span>}
            {detail && <span className={cn('truncate', project && 'max-xl:hidden')}>{detail}</span>}
          </span>
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 truncate text-[0.8125rem] text-ink-2 max-xl:hidden">{project && <><Building2 className="h-3.5 w-3.5 shrink-0 text-faint" /><span className="truncate">{project}</span></>}</span>
      <span className="flex justify-end max-md:hidden" onClick={(e) => e.stopPropagation()}>{action}</span>
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
  /* a getting-ready step's task opens the step's own window */
  const stepTask = !!t.step && !t.step.startsWith('*:') && !!s.jobs[t.step.split(':')[0]]
  const act = !stepTask && !!t.action && t.action.kind !== 'open-job' && t.state === 'now'
  const Ic = TYPE_ICON[t.type] || ListTodo
  const last = t.log[t.log.length - 1]
  const detail0 = t.state === 'waiting' ? `Waiting on ${t.waitingOn}` : t.blocks && !done ? `Holds up ${t.blocks.charAt(0).toLowerCase() + t.blocks.slice(1)}` : last?.text || t.where || t.detail
  const detail = followed ? <><Eye className="mr-1 inline h-3.5 w-3.5 align-[-0.125rem] text-brand-600" />{detail0 ? `You follow · ${detail0}` : 'You follow'}</> : detail0
  const w = when || (t.state === 'waiting' ? { text: `Back ${t.followUp}`, tone: (isoFromLabel(t.followUp) || '9') <= TODAY ? 'warn' as const : undefined } : t.state === 'done' ? { text: t.doneAt ? (t.doneAt === 'Just now' ? 'Today' : t.doneAt) : 'Done', tone: 'quiet' as const } : t.state === 'later' ? { text: `Back ${t.laterUntil}` } : { text: 'Anytime', tone: 'quiet' as const })
  return (
    <TodoRow
      leaving={leaving}
      done={done || leaving}
      onClick={() => s.open({ t: 'task', id: t.id })}
      icon={t.everyone ? <Megaphone /> : t.repeat ? <Repeat /> : <Ic />}
      title={cleanTitle(t.title, job)}
      detail={detail}
      owner={showOwner ? t.owner : undefined}
      project={job ? job.name : 'Company'}
      when={w.text}
      whenTone={w.tone}
      action={
        done ? <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => s.reopenTask(t.id)}>Reopen</Button>
          : stepTask ? <Button size="sm" onClick={() => s.open({ t: 'task', id: t.id })}>Open</Button>
          : act ? <Button size="sm" className="max-w-full" onClick={() => runTaskAction(t)}><span className="truncate">{t.action!.label}</span></Button>
            : t.state === 'now' ? <Button size="sm" icon={<Check />} onClick={() => { setLeaving(true); setTimeout(() => s.completeTask(t.id), 220) }}>Done</Button>
              : <Button size="sm" variant="ghost" onClick={() => s.open({ t: 'task', id: t.id })}>Open</Button>
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
      action={<StepButton job={job} v={v} />}
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
      action={<Button size="sm" onClick={() => s.open({ t: 'daily', jobId: d.jobId })}>Send update</Button>}
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
      action={<Button size="sm" onClick={go}>Review the week</Button>}
    />
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
      action={<Button size="sm" onClick={go}>Bill the week</Button>}
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
      action={<Button size="sm" variant="ghost" onClick={open}>Open</Button>}
    />
  )
}

/* ================= what's on someone's plate: one list, used for the page and the sidebar count ================= */
export type PlateItem = { key: string; b: Bucket; iso?: string; time?: number | null; kind: 'task' | 'daily' | 'pay' | 'bill' | 'meet' | 'step'; t?: Task; d?: DailyItem; e?: CalEvent; job?: Job; v?: StepView; who?: PersonKey }
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
  s.tasks.filter((t) => isMine(t, role, me) && t.state === 'now' && !t.paused && (!t.everyone || !me || t.owner === me)).forEach((t) => {
    /* a hand-off (a takeoff, a review) is yours the moment it lands — it's on Today, with its due date */
    const b0 = taskBucket(t)
    const b = t.action?.kind?.startsWith('estimate:') && (b0 === 'tomorrow' || b0 === 'week' || b0 === 'later') ? 'today' : b0
    out.push({ key: t.id, b, iso: taskIso(t), time: taskTime(t), kind: 'task', t, who: t.owner })
  })
  s.tasks.filter((t) => isMine(t, role, me) && t.state === 'later').forEach((t) => out.push({ key: t.id, b: 'aside', iso: taskIso(t), kind: 'task', t, who: t.owner }))
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
  const followsIt = (t?: Task) => !!t && t.owner !== me && followersOf(t).includes(me)
  /* one project at a time: everything for a job together (the site manager starts here) — remembered on this computer */
  const prefKey = `tileos-today-byjob:${role}`
  const [byJob, setByJob] = React.useState<boolean>(() => { try { const v = localStorage.getItem(prefKey); return v ? v === '1' : role === 'site' } catch { return role === 'site' } })
  const groupBy = (on: boolean) => { setByJob(on); try { localStorage.setItem(prefKey, on ? '1' : '0') } catch { /* private window */ } }

  /* the counts never change with the filters — they're the facts */
  const plate = all ? teamPlate(s) : plateOf(s, role)
  const pick = (x: PlateItem) => (job === 'all' || (x.t?.jobId || x.d?.jobId || x.job?.id || x.e?.jobId) === job) && (!all || who === 'all' || (who === 'follow' ? followsIt(x.t) : x.who === who || (x.kind === 'meet' && x.e!.people.includes(who as PersonKey))))
  const today = plate.filter((x) => isNow(x.b))
  const late = plate.filter((x) => x.b === 'overdue')
  const tomorrow = plate.filter((x) => x.b === 'tomorrow')
  const later = plate.filter((x) => x.b === 'week' || x.b === 'later' || x.b === 'aside')
  const waiting = s.tasks.filter((t) => t.state === 'waiting' && (all ? true : isMine(t, role)))
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
          <section>
            <Group label="Overdue" count={lateRows.length} tone="bad" />
            {lateRows.map((x) => <PlateRow key={x.key} x={x} showOwner={all} overdue followed={followsIt(x.t)} />)}
          </section>
        )}
        {(rows.length > 0 || !lateRows.length) && (
          <section>
            <Group label={dayHead(iso)} count={rows.length} tone="info" hint={iso === TOMORROW ? dayLongFull(iso) : undefined} />
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
        <section key={id || 'none'} aria-label={j ? j.name : 'Not on a project'}>
          <div className={cn('flex items-center gap-3 border-t border-line bg-[#f7f5f0] py-2 first:border-t-0', PX)}>
            {j ? (
              <button onClick={() => s.open({ t: 'job', id })} className="group min-w-0 flex-1 text-left">
                <span className="block truncate text-[0.90625rem] font-bold text-ink group-hover:text-brand-700">{j.name}</span>
                <span className="block truncate text-[0.75rem] text-muted">{[j.address, j.client].filter(Boolean).join(' · ')}</span>
              </button>
            ) : <span className="min-w-0 flex-1 text-[0.90625rem] font-bold text-ink">Not on a project</span>}
            <span className="shrink-0 text-[0.78125rem] font-semibold tnum text-muted">{rows.length + ts.length}</span>
            {j && <Button size="xs" icon={<ListPlus />} onClick={() => s.open({ t: 'new', jobId: id })}>Log</Button>}
          </div>
          {rows.map((x) => <PlateRow key={x.key} x={x} showOwner={all} overdue={x.b === 'overdue'} followed={followsIt(x.t)} />)}
          {ts.map((t) => <TaskRow key={t.id} t={t} showOwner={all} />)}
        </section>
      )
    })
  }

  const shownToday = today.filter(pick)
  const shownTomorrow = tomorrow.filter(pick)
  const shownLater = later.filter(pick)
  /* due "this week" with no day of its own: its own group on top — not under a day it isn't on */
  const anyDay = shownLater.filter((x) => x.b === 'week' && x.iso && x.iso <= TOMORROW)
  const laterDays = Array.from(new Set(shownLater.filter((x) => x.b !== 'aside' && x.iso && !anyDay.includes(x)).map((x) => x.iso!))).sort()
  const nextLater = later.filter((x) => x.b !== 'aside' && x.iso && x.iso > TOMORROW).map((x) => x.iso!).sort()[0]
  const noDate = shownLater.filter((x) => x.b !== 'aside' && !x.iso)
  const aside = shownLater.filter((x) => x.b === 'aside')
  const shownWaiting = waiting.filter((t) => (job === 'all' || t.jobId === job) && (!all || who === 'all' || (who === 'follow' ? followsIt(t) : t.owner === who)))
  const shownDone = done.filter((t) => (job === 'all' || t.jobId === job) && (!all || who === 'all' || (who === 'follow' ? followsIt(t) : t.owner === who)))

  return (
    <Page
      title={`${greeting()}, ${PEOPLE[me].short}`}
      sub={<>{TODAY_LABEL}<span className="mx-2 text-faint">·</span>{today.length ? `${today.length} to do today` : 'Nothing due today'}{late.length ? <><span className="mx-2 text-faint">·</span><button onClick={() => s.open({ t: 'late' })} className="font-semibold text-bad-600 underline decoration-bad-200 underline-offset-2 hover:decoration-bad-500">{late.length} overdue</button></> : null}{meetingsToday ? <><span className="mx-2 text-faint">·</span>{meetingsToday} {meetingsToday === 1 ? 'meeting' : 'meetings'}</> : null}</>}
      actions={<Button icon={<Plus />} onClick={() => s.open({ t: 'newtask' })}>New task</Button>}
      top={<>
        <InboxStrip />
        <Bubbles
          items={[
            { key: 'today', label: 'Today', count: today.length, sub: late.length ? `${late.length} overdue` : meetingsToday ? `${meetingsToday} ${meetingsToday === 1 ? 'meeting' : 'meetings'}` : undefined, subBad: late.length > 0, icon: <ListTodo />, color: 'blue', on: view === 'today', onClick: () => setView('today') },
            { key: 'tomorrow', label: 'Tomorrow', count: tomorrow.length, sub: dayShort(TOMORROW).split(', ')[0], icon: <CalendarDays />, color: 'violet', on: view === 'tomorrow', onClick: () => setView('tomorrow') },
            { key: 'later', label: 'Later', count: later.length, sub: nextLater ? `next ${dayShort(nextLater).split(', ')[0]}` : undefined, icon: <CalendarRange />, color: 'slate', on: view === 'later', onClick: () => setView('later') },
            { key: 'waiting', label: 'Waiting on others', count: waiting.length, icon: <Hourglass />, color: 'amber', on: view === 'waiting', onClick: () => setView('waiting'), gapBefore: true },
            { key: 'done', label: 'Done', count: done.length, sub: doneToday ? `${doneToday} today` : undefined, icon: <CircleCheckBig />, color: 'green', on: view === 'done', onClick: () => setView('done') },
          ]}
        />
      </>}
      toolbar={
        <div className="flex w-full flex-wrap items-center gap-2">
          {inside && <ViewSwitch label="Whose list" value={scope} onChange={(k) => { setScope(k); setWho('all') }} items={[{ key: 'mine', label: 'Mine', icon: <UserRound /> }, { key: 'all', label: 'Everyone', icon: <Users /> }]} />}
          {view !== 'done' && <ViewSwitch label="How it's grouped" value={byJob} onChange={groupBy} items={[{ key: false, label: 'By time', icon: <Clock3 /> }, { key: true, label: 'By project', icon: <Building2 /> }]} />}
          <span className="flex-1 max-md:hidden" />
          {all && <Filter icon={<UserRound />} label="Person" value={who} allLabel="Everyone" options={[{ key: 'follow', label: 'What I follow', hint: 'Things you watch' }, ...(insidePeople(s).length ? insidePeople(s) : ASSIGNABLE).map((p) => ({ key: p, label: PEOPLE[p]?.name || p, hint: PEOPLE[p]?.roleLabel }))]} onChange={(v) => setWho(v as string)} />}
          <Filter icon={<Building2 />} label="Project" value={job} options={jobsWithTasks.map((j) => ({ key: j.id, label: j.name, hint: j.client }))} onChange={setJob} width={280} />
          <ClearFilters show={job !== 'all' || who !== 'all'} onClear={() => { setJob('all'); setWho('all') }} />
        </div>
      }
    >
      <div>
        {pinned.length > 0 && view === 'today' && (
          <div className={cn('border-b border-line bg-[#fdf9f1] py-1.5', PX)}>
            {pinned.map((t) => (
              <button key={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full items-center gap-3 rounded-lg py-1.5 text-left">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5625rem] bg-warn-100 text-warn-700"><Megaphone className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink">{cleanTitle(t.title, s.jobs[t.jobId])}</span>
                  <span className="block truncate text-[0.78125rem] text-muted">For everyone · {PEOPLE[t.owner].short} has it · {s.jobs[t.jobId]?.name}{t.log.length ? ` · ${t.log[t.log.length - 1].text}` : ''}</span>
                </span>
                <span className="flex shrink-0 -space-x-1.5 max-sm:hidden"><Avatar who={t.owner} size={24} ring />{followersOf(t).slice(0, 3).map((p) => <Avatar key={p} who={p} size={24} ring />)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
              </button>
            ))}
          </div>
        )}

        {view === 'today' && !Object.keys(s.jobs).length && !s.tasks.length && role === 'owner' && <CleanSlate />}
        {view === 'today' && (Object.keys(s.jobs).length > 0 || s.tasks.length > 0 || role !== 'owner') && (shownToday.length ? (byJob ? byProject(shownToday) : dayBlock(TODAY, shownToday, true)) : <EmptyState icon={<Check />} title="Nothing due today" sub={tomorrow.length ? `${tomorrow.length} for tomorrow — see Tomorrow.` : 'New work lands here the moment it’s yours.'} />)}
        {view === 'today' && shownToday.length > 0 && tomorrow.length > 0 && (
          <button onClick={() => setView('tomorrow')} className={cn('flex w-full items-center gap-2 border-t border-line-2 py-3 text-left text-[0.84375rem] font-semibold text-muted hover:bg-wash hover:text-ink', PX)}>
            <CalendarDays className="h-4 w-4" />{tomorrow.length} for tomorrow<ChevronRight className="h-4 w-4" />
          </button>
        )}

        {view === 'tomorrow' && (shownTomorrow.length ? (byJob ? byProject(shownTomorrow) : dayBlock(TOMORROW, shownTomorrow)) : <EmptyState icon={<Check />} title="Nothing for tomorrow yet" sub="Anything due tomorrow, and tomorrow’s meetings, show here." />)}

        {view === 'later' && byJob && byProject(shownLater)}
        {view === 'later' && !byJob && anyDay.length > 0 && (
          <section>
            <Group label="This week" count={anyDay.length} tone="info" hint="any day this week" />
            {anyDay.map((x) => <PlateRow key={x.key} x={x} showOwner={all} followed={followsIt(x.t)} />)}
          </section>
        )}
        {view === 'later' && !byJob && laterDays.map((d) => dayBlock(d, shownLater.filter((x) => x.iso === d && x.b !== 'aside' && !anyDay.includes(x))))}
        {view === 'later' && !byJob && noDate.length > 0 && (
          <section>
            <Group label="No date" count={noDate.length} tone="neutral" />
            {noDate.map((x) => <PlateRow key={x.key} x={x} showOwner={all} />)}
          </section>
        )}
        {view === 'later' && !byJob && aside.length > 0 && (
          <section>
            <Group label="Set aside" count={aside.length} tone="neutral" hint="you put these off — they come back on their date" />
            {aside.map((x) => <PlateRow key={x.key} x={x} showOwner={all} />)}
          </section>
        )}
        {view === 'later' && !shownLater.length && <EmptyState icon={<Check />} title="Nothing later" sub="Anything with a date after tomorrow shows here, day by day." />}

        {view === 'waiting' && shownWaiting.length > 0 && (
          <>
            <div className={cn('border-b border-line-2 bg-wash py-2.5 text-[0.8125rem] text-muted', PX)}>Things someone else owes {all ? 'the team' : 'you'} — the GC, a supplier, a client. Each one comes back to {all ? 'its owner’s' : 'your'} Today on its date.</div>
            {byJob ? byProject([], shownWaiting) : shownWaiting.map((t) => <TaskRow key={t.id} t={t} showOwner={all} />)}
          </>
        )}
        {view === 'waiting' && !shownWaiting.length && <EmptyState icon={<Check />} title="Nothing waiting on others" sub="When you’re waiting on the GC, a supplier or a client, it waits here with the day it comes back to you." />}

        {view === 'done' && shownDone.map((t) => <TaskRow key={t.id} t={t} showOwner={all} />)}
        {view === 'done' && !shownDone.length && <EmptyState icon={<Check />} title="Nothing done yet" sub="Finished tasks stay here for the record." />}
      </div>
    </Page>
  )
}

/** the first screen of a clean slate: where to start */
function CleanSlate() {
  const s = useStore()
  const ours = s.items.filter((i) => i.id.startsWith('qb-')).length
  const steps: { n: number; title: string; sub: string; btn: React.ReactNode }[] = [
    { n: 1, title: 'Price a new project', sub: 'Upload the plans — it goes straight to the takeoff, and the estimate is built from there.', btn: <Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'newreq' })}>Price a new project</Button> },
    { n: 2, title: ours ? `Your ${ours} QuickBooks items are in` : 'Bring in your QuickBooks items', sub: ours ? 'Check the units and add what you pay the installer — his PO and weekly pay come from it.' : 'Export Products and Services from QuickBooks and import the file.', btn: <Button onClick={() => s.go({ page: 'items' })}>Open Items</Button> },
    REAL.cloud
      ? { n: 3, title: 'Let your team in', sub: 'Everyone signs up with their own email. You let them in from Settings → Team and pick what they do.', btn: <Button onClick={() => s.go({ page: 'settings', tab: 'team' } as any)}>Open Team</Button> }
      : { n: 3, title: 'Run it to the end', sub: 'Send it, mark it won, get it ready, book the crew, send daily updates, approve pay, bill it. Everything you do is saved.', btn: <Button variant="ghost" onClick={() => s.go({ page: 'settings', tab: 'testdata' } as any)}>See the sample instead</Button> },
  ]
  return (
    <div className={cn('py-8', PX)}>
      <div className="text-[1.125rem] font-bold text-ink">{REAL.cloud ? 'Nothing here yet' : 'A clean slate'}</div>
      <div className="mt-1 max-w-2xl text-[0.875rem] text-muted">{REAL.cloud ? 'No projects, estimates or tasks yet — the first estimate starts it. Your team, items and settings are in.' : 'No projects, estimates or tasks yet — this is where your own test starts. Your team, logins and settings are here.'}</div>
      <div className="mt-6 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        {steps.map((x) => (
          <div key={x.n} className="flex flex-col rounded-2xl border border-line p-5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-[0.875rem] font-bold text-brand-700">{x.n}</span>
            <div className="mt-3 text-[0.9375rem] font-semibold text-ink">{x.title}</div>
            <div className="mt-1 flex-1 text-[0.84375rem] leading-snug text-muted">{x.sub}</div>
            <div className="mt-4">{x.btn}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** a thin line where "now" falls among today's times */
function NowLine({ min }: { min: number }) {
  return (
    <div className={cn('relative flex items-center gap-2 border-t border-line-2 py-1', PX)} aria-label="Now">
      <span className="text-[0.71875rem] font-semibold text-bad-600 tnum">Now · {timeLabel(min - (min % 5))}</span>
      <span className="h-px flex-1 bg-bad-300" />
    </div>
  )
}

/* ================= one task: what it is, who has it, the one thing to do ================= */
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
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pill}
        <Menu align="start" width={250} trigger={<button className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-white pl-0.5 pr-2.5 text-[0.78125rem] font-semibold text-ink-2 hover:bg-wash"><Avatar who={t.owner} size={22} />{PEOPLE[t.owner].short} has it</button>}>
          <MenuLabel>Hand it to</MenuLabel>
          {ASSIGNABLE.map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={t.owner === p} onSelect={() => s.reassignTask(t.id, p)} hint={PEOPLE[p].roleLabel}>{PEOPLE[p].name}</MenuItem>)}
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
        <Button className="ml-auto" icon={<RotateCcw />} onClick={() => s.reopenTask(t.id)}>Reopen</Button>
      </>
    ) : (
      <>
        {t.state !== 'now' ? (
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
          <Button variant="primary" className="ml-auto max-sm:flex-1" icon={<Check />} onClick={() => { s.completeTask(t.id); s.close() }}>Done</Button>
        )}
      </>
    )

  return (
    <Modal level={level} size="md" onClose={s.close} header={header} footer={footer} title={t.title} bodyClass="px-6 py-5 max-sm:px-4">
      {(t.detail || !t.log.length) && <p className="text-[0.9375rem] leading-relaxed text-ink">{t.detail || t.title}</p>}
      {/* who else sees it */}
      <div className={cn('flex flex-wrap items-center gap-2 rounded-[0.75rem] border border-line px-3 py-2', (t.detail || !t.log.length) && 'mt-4')}>
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
        {[...t.log].reverse().map((l, i) => <ActivityRow key={i} jobId={t.jobId || undefined} e={{ date: l.date, who: l.who, kind: 'system', title: l.text }} compact />)}
        {!t.log.length && <div className="px-2 text-[0.84375rem] text-muted">Nothing yet.</div>}
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
  { t: 'Check the wall heights on site', for: ['owner', 'pm', 'office', 'site'] },
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
export function NewTaskModal({ level, jobId }: { level: number; jobId?: string }) {
  const s = useStore()
  const me = meOf(s.role)
  const [title, setTitle] = React.useState('')
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
    s.addTask({ jobId: job, title: clean, type: guessType(title), owner, due: repeat ? 'Today' : due, for: role ? [role] : ROLE_OF[owner] || ['owner'], state: 'now', tone: 'info', repeat: repeat || undefined, repeatAt: repeat ? at : undefined, where: repeat ? `${REPEAT_LABEL[repeat]} at ${at}` : undefined, followers: fol.filter((p) => p !== owner), everyone: all || undefined })
    s.close()
  }
  const chip = 'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-[#d9d3c9] bg-white pl-1.5 pr-2.5 text-[0.8125rem] font-medium text-ink-2 transition hover:border-[#c6bfb4] hover:text-ink data-[state=open]:border-brand-300 data-[state=open]:ring-[0.1875rem] data-[state=open]:ring-brand-50'
  const whenLabel = repeat ? `${REPEAT_LABEL[repeat]} · ${at}` : WHEN.find(([k]) => k === due)?.[1] || due
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="New task"
      footer={
        <>
          <span className="truncate text-[0.8125rem] text-muted max-sm:hidden">{owner === me ? 'On your Today' : `On ${PEOPLE[owner].short}’s Today`} {repeat ? `· ${REPEAT_LABEL[repeat].toLowerCase()}` : `· ${whenLabel.toLowerCase()}`}</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!title.trim()} onClick={add}>{repeat ? 'Add repeating task' : 'Add task'}</Button>
        </>
      }
    >
      <SuggestInput value={title} onChange={onTitle} onEnter={add} suggestions={common} label="What needs to be done?" placeholder="What needs to be done?" listLabel="Common tasks" />
      {heard && !jobPicked && <div className="mt-1.5 text-[0.78125rem] font-medium text-brand-700">Project: {heard} — from what you wrote</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Menu align="start" width={260} trigger={<button type="button" aria-label="Who does it" className={chip}><Avatar who={owner} size={20} /><span className="truncate">{owner === me ? 'Me' : PEOPLE[owner].short}</span><ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
          <MenuLabel>Who does it</MenuLabel>
          {(people.length ? people : ASSIGNABLE).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={owner === p} onSelect={() => setOwner(p)} hint={PEOPLE[p]?.roleLabel}>{p === me ? `${PEOPLE[p]?.name} (me)` : PEOPLE[p]?.name}</MenuItem>)}
        </Menu>
        <Menu align="start" width={240} trigger={<button type="button" aria-label="When" className={chip}><span className="inline-flex h-5 w-5 items-center justify-center text-muted">{repeat ? <Repeat className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}</span><span className="truncate">{whenLabel}</span><ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
          <MenuLabel>Due</MenuLabel>
          {WHEN.map(([k, l]) => <MenuItem key={k} checked={!repeat && due === k} onSelect={() => { setRepeat(''); setDue(k); setPicked(true) }}>{l}</MenuItem>)}
          <MenuSep />
          <MenuLabel>Repeats</MenuLabel>
          {(Object.keys(REPEAT_LABEL) as NonNullable<Task['repeat']>[]).map((r) => <MenuItem key={r} icon={<Repeat className="h-4 w-4" />} checked={repeat === r} onSelect={() => setRepeat(r)}>{REPEAT_LABEL[r]}</MenuItem>)}
        </Menu>
        {repeat && (
          <Menu align="start" width={180} trigger={<button type="button" aria-label="At" className={chip}><span className="inline-flex h-5 w-5 items-center justify-center text-muted"><Clock3 className="h-4 w-4" /></span>at {at}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
            {['8 AM', 'Noon', '4 PM', '6 PM'].map((x) => <MenuItem key={x} checked={at === x} onSelect={() => setAt(x)}>{x}</MenuItem>)}
          </Menu>
        )}
        {!jobId && (
          <SearchSelect value={job} onChange={(k) => { setJob(k); setJobPicked(true); setHeard('') }} emptyLabel="No project" placeholder="Project" icon={<Building2 />} width={340} className="h-8 w-auto max-w-[16.25rem] gap-1.5 rounded-full border-[#d9d3c9] pl-2.5 pr-2.5 text-[0.8125rem] font-medium text-ink-2 [&>span:nth-child(2)]:flex-initial" options={projects.map((j) => ({ key: j.id, label: j.name, hint: j.client }))} plain />
        )}
        {jobId && s.jobs[jobId] && <span className={cn(chip, 'cursor-default pl-2.5 hover:border-[#d9d3c9] hover:text-ink-2')}><Building2 className="h-4 w-4 text-muted" /><span className="truncate">{s.jobs[jobId].name}</span></span>}
      </div>
      {!more ? (
        <button type="button" onClick={() => setMore(true)} className="mt-4 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-700 hover:text-brand-800">
          <Plus className="h-3.5 w-3.5" />Someone follows it, or show it to everyone
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3 border-t border-line-2 pt-4">
          <div>
            <div className="mb-1.5 text-[0.78125rem] font-semibold text-muted">Who follows it — they see every note and when it’s done</div>
            <div className="flex flex-wrap gap-1.5">
              {ASSIGNABLE.filter((p) => p !== owner).map((p) => <Chip key={p} on={fol.includes(p)} onClick={() => setFol(fol.includes(p) ? fol.filter((x) => x !== p) : [...fol, p])} className="h-8 px-2.5 text-[0.8125rem]" icon={<Avatar who={p} size={18} />}>{PEOPLE[p].short}</Chip>)}
            </div>
          </div>
          <button type="button" onClick={() => setAll(!all)} className={cn('flex items-center gap-3 rounded-[0.6875rem] border px-3 py-2 text-left transition', all ? 'border-warn-300 bg-warn-50' : 'border-line hover:bg-wash')}>
            <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full', all ? 'bg-warn-500 text-white' : 'bg-wash-2 text-muted')}><Megaphone className="h-3.5 w-3.5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[0.84375rem] font-semibold text-ink">Show it on everyone’s Today</span><span className="block text-[0.75rem] text-muted">For the big ones — pinned for the whole team until it’s done</span></span>
            <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition', all ? 'bg-warn-500' : 'bg-[#d9d3c9]')}><span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', all ? 'left-[1.125rem]' : 'left-0.5')} /></span>
          </button>
        </div>
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
