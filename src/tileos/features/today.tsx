/* Today = my day. One list of what the person signed in has to do, in order,
 * with the button to do it on the row. The site manager's daily updates show up here every morning. */
import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { Check, CheckCircle2, ClipboardList } from 'lucide-react'
import { useStore, meOf, NOW, type Store } from '@/tileos/store'
import { Card, Count, Avatar, Button } from '@/tileos/components/ui/core'
import { Tip } from '@/tileos/components/ui/overlay'
import { Bar } from '@/tileos/components/ui/progress'
import { cn, dueBucket, greeting } from '@/tileos/lib/utils'
import { roleDef, PEOPLE, CREWS, fmtMoney, STAGE_LABEL, seesUpcoming, type Role, type PersonKey } from '@/tileos/data/model'
import { TODAY_LABEL } from '@/tileos/data/jobs'
import type { Task } from '@/tileos/data/work'
import { runTaskAction } from './flows'
import { shiftText, TODAY, TOMORROW, dayShort } from '@/tileos/lib/today'

const TODAY_ISO = TODAY
const sev = (t: Task) => ({ bad: 0, warn: 1, info: 2, ok: 3, vio: 3, neutral: 4 }[t.tone] ?? 5)

/** a daily update that's due today: one per project a crew is working on */
type DailyItem = { kind: 'daily'; jobId: string; crew: PersonKey; workers?: number }
type Item = { kind: 'task'; t: Task } | DailyItem

export function dailyDue(s: Store, role: Role): DailyItem[] {
  if (role !== 'site') return []
  return s.bookings
    .filter((b) => b.start <= TODAY_ISO && b.end >= TODAY_ISO && s.jobs[b.jobId] && ['installation', 'punch'].includes(s.jobs[b.jobId].stage))
    .filter((b) => s.diary[b.jobId]?.[0]?.date !== NOW)
    .map((b) => ({ kind: 'daily' as const, jobId: b.jobId, crew: b.crew as PersonKey, workers: b.workers }))
}

export function TodayPage() {
  const s = useStore()
  const role = s.role
  const def = roleDef(role)
  const me = meOf(role)
  const [tab, setTab] = React.useState<'todo' | 'waiting' | 'risk'>('todo')

  const mine = (t: Task) => t.for.includes(role) || (t.owner === me && !['owner', 'pm', 'site'].includes(role))
  const needs = s.tasks.filter((t) => t.state === 'now' && mine(t)).sort((a, b) => sev(a) - sev(b))
  const waiting = s.tasks.filter((t) => t.state === 'waiting' && mine(t))
  const risks = s.tasks.filter((t) => t.state !== 'done' && (t.watch || []).includes(role) && !mine(t) && (t.tone === 'bad' || /late/i.test(t.due || ''))).sort((a, b) => sev(a) - sev(b))
  const doneToday = s.tasks.filter((t) => t.state === 'done' && (t.for.includes(role) || role === 'owner'))
  const daily = dailyDue(s, role)

  const groups: { key: string; label: string; items: Item[] }[] = [
    { key: 'overdue', label: 'Overdue', items: needs.filter((t) => dueBucket(t.due, t.dueTone) === 'overdue').map((t) => ({ kind: 'task' as const, t })) },
    { key: 'today', label: 'Today', items: [...daily, ...needs.filter((t) => dueBucket(t.due, t.dueTone) === 'today').map((t) => ({ kind: 'task' as const, t }))] },
    { key: 'week', label: 'Later this week', items: needs.filter((t) => ['week', 'later'].includes(dueBucket(t.due, t.dueTone))).map((t) => ({ kind: 'task' as const, t })) },
  ].filter((g) => g.items.length)
  const todayCount = groups.filter((g) => g.key !== 'week').reduce((n, g) => n + g.items.length, 0)
  const todoCount = groups.reduce((n, g) => n + g.items.length, 0)
  const tabs = [
    { key: 'todo' as const, label: 'To do', n: todoCount },
    { key: 'waiting' as const, label: 'Waiting', n: waiting.length },
    ...(risks.length ? [{ key: 'risk' as const, label: 'At risk', n: risks.length }] : []),
  ]
  const field = ['owner', 'pm', 'site'].includes(role)

  return (
    <div className="flex animate-fade-up flex-col xl:h-[calc(100dvh-8.25rem)]">
      <div className="mb-5 flex shrink-0 items-end justify-between gap-6 max-xl:flex-col max-xl:items-start max-md:mb-4 max-md:items-stretch max-md:gap-4">
        <div className="min-w-0">
          <h1 className="h-display text-[2.125rem] font-bold leading-[1.15] text-ink max-md:text-[1.6875rem]">
            {greeting()}, {def.greetName === 'team' ? PEOPLE[me].short : def.greetName}
          </h1>
          <p className="mt-1.5 text-[0.96875rem] text-muted max-md:text-[0.90625rem]">
            {TODAY_LABEL} — <span className="font-semibold text-ink-2">{todayCount} {todayCount === 1 ? 'thing' : 'things'} to do today</span>
            {waiting.length ? `, ${waiting.length} waiting on others` : ''}
          </p>
        </div>
        <Numbers role={role} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.92fr)] items-stretch gap-5 max-xl:grid-cols-2 max-xl:items-start max-lg:grid-cols-1">
        {/* my priorities */}
        <Card className="flex min-h-0 flex-col overflow-hidden max-xl:col-span-2 max-lg:col-span-1">
          <PanelHead
            title="My priorities"
            stack
            right={
              <div className="flex items-center gap-1" role="tablist">
                {tabs.map((x) => (
                  <button key={x.key} role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)} className={cn('inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[0.84375rem] font-semibold transition-colors', tab === x.key ? 'bg-wash-2 text-ink' : 'text-muted hover:text-ink-2')}>
                    {x.label}
                    <span className={cn('tnum text-[0.78125rem]', tab === x.key ? 'text-ink-2' : 'text-faint', x.key === 'risk' && 'text-bad-700')}>{x.n}</span>
                  </button>
                ))}
              </div>
            }
          />
          <div className="scroll-soft min-h-0 flex-1 overflow-y-auto">
            {tab === 'todo' && (
              <>
                {groups.map((g) => (
                  <section key={g.key}>
                    <div className="flex items-center gap-2 px-5 pb-1 pt-3 max-sm:px-4">
                      <span className={cn('text-[0.84375rem] font-semibold', g.key === 'overdue' ? 'text-bad-700' : 'text-ink-2')}>{g.label}</span>
                      <Count tone={g.key === 'overdue' ? 'bad' : 'neutral'}>{g.items.length}</Count>
                    </div>
                    <div>{g.items.map((it) => (it.kind === 'daily' ? <DailyRow key={'d' + it.jobId} it={it} /> : <DayRow key={it.t.id} t={it.t} />))}</div>
                  </section>
                ))}
                {!groups.length && <Empty title="Nothing needs you right now" sub="New things land here the moment they’re yours." />}
              </>
            )}
            {tab === 'waiting' && (
              <div className="pt-1">
                {waiting.map((t) => <DayRow key={t.id} t={t} />)}
                {!waiting.length && <Empty title="Nothing waiting on others" sub="When you ask someone, it waits here until the day you set." />}
              </div>
            )}
            {tab === 'risk' && <div className="pt-1">{risks.map((t) => <DayRow key={t.id} t={t} showOwner />)}</div>}
          </div>
        </Card>

        {/* the agenda: today and tomorrow */}
        <Agenda />

        {/* who's on site, and what got done */}
        <div className="flex min-h-0 flex-col gap-5">
          {field && <OnSite />}
          {['office', 'estimator'].includes(role) && <PricingSoon />}
          {role === 'materials' && <Deliveries />}
          <DoneToday tasks={doneToday} />
        </div>
      </div>
    </div>
  )
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <CheckCircle2 className="h-8 w-8 text-ok-500" />
      <div className="mt-2 text-[0.96875rem] font-semibold text-ink">{title}</div>
      <div className="text-[0.84375rem] text-muted">{sub}</div>
    </div>
  )
}

function PanelHead({ title, sub, right, stack }: { title: string; sub?: string; right?: React.ReactNode; stack?: boolean }) {
  return (
    <div className={cn('flex h-[3.625rem] shrink-0 items-center justify-between gap-3 border-b border-line-2 px-5 max-sm:px-4', stack && 'max-sm:h-auto max-sm:flex-col max-sm:items-start max-sm:gap-2 max-sm:py-3')}>
      <div className={cn('min-w-0', stack && 'shrink-0')}>
        <h2 className="truncate text-[1.03125rem] font-semibold text-ink">{title}</h2>
        {sub && <p className="truncate text-[0.78125rem] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

/* ---------------- the agenda: what's happening today and tomorrow ---------------- */
type Ev = { time?: string; title: string; sub?: string; kind: 'meeting' | 'crew' | 'delivery' | 'back' | 'due' | 'update'; run: () => void }
const DAY_OF: Record<string, 'today' | 'tomorrow'> = { Today: 'today', Mon: 'today', Tomorrow: 'tomorrow', Tue: 'tomorrow' }
const minutes = (t?: string) => {
  const m = t?.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)
  if (!m) return 24 * 60
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2] || 0)
}
function agendaFor(s: Store, role: Role, day: 'today' | 'tomorrow'): Ev[] {
  const ev: Ev[] = []
  const me = meOf(role)
  const mine = (t: Task) => t.for.includes(role) || (t.owner === me && !['owner', 'pm', 'site'].includes(role))
  const field = ['owner', 'pm', 'site'].includes(role)
  const iso = day === 'today' ? TODAY_ISO : TOMORROW
  /* meetings on the game plan */
  Object.entries(s.prep).forEach(([id, p]) => {
    const j = s.jobs[id]
    if (!j || !p.meeting?.day || DAY_OF[p.meeting.day] !== day) return
    ev.push({ time: p.meeting.time, title: p.meeting.text, sub: j.name, kind: 'meeting', run: () => s.open({ t: 'job', id }) })
  })
  /* crews */
  const on = s.bookings.filter((b) => b.start <= iso && b.end >= iso)
  const starting = s.bookings.filter((b) => b.start === iso)
  if (field && day === 'today' && on.length) ev.push({ time: 'All day', title: `${on.length} crews on site`, sub: on.map((b) => PEOPLE[b.crew as PersonKey].short).join(', '), kind: 'crew', run: () => s.go({ page: 'schedule' }) })
  if (field && day === 'tomorrow') starting.forEach((b) => ev.push({ time: '7 AM', title: `${PEOPLE[b.crew as PersonKey].short} starts`, sub: s.jobs[b.jobId]?.name, kind: 'crew', run: () => s.open({ t: 'job', id: b.jobId }) }))
  if (field) s.bookings.filter((b) => b.end === iso).forEach((b) => ev.push({ title: `${PEOPLE[b.crew as PersonKey].short} finishes`, sub: s.jobs[b.jobId]?.name, kind: 'crew', run: () => s.go({ page: 'schedule' }) }))
  /* daily updates — the site manager sends them */
  if (day === 'today' && role === 'site') {
    const due = dailyDue(s, role)
    if (due.length) ev.push({ time: 'By 5 PM', title: `Send ${due.length} daily update${due.length > 1 ? 's' : ''}`, sub: due.map((d) => s.jobs[d.jobId]?.name).join(', '), kind: 'update', run: () => s.open({ t: 'daily', jobId: due[0].jobId }) })
  }
  /* deliveries */
  if (field || role === 'materials') s.mats.filter((m) => m.eta && DAY_OF[m.eta] === day).forEach((m) => ev.push({ title: `${m.name.split(' · ')[0]} delivery`, sub: `${s.jobs[m.jobId]?.name}${m.po ? ' · ' + m.po : ''}`, kind: 'delivery', run: () => s.open({ t: 'job', id: m.jobId, tab: 'materials' }) }))
  /* things that come back to us */
  s.tasks
    .filter((t) => t.state === 'waiting' && mine(t) && t.followUp && DAY_OF[t.followUp] === day)
    .forEach((t) => ev.push({ title: t.title, sub: `${s.jobs[t.jobId]?.name || ''} · follow up with ${t.waitingOn}`, kind: 'back', run: () => s.open({ t: 'task', id: t.id }) }))
  if (day === 'tomorrow')
    s.tasks
      .filter((t) => t.state === 'now' && mine(t) && t.due && DAY_OF[t.due] === 'tomorrow' && !/^Receive/.test(t.title))
      .forEach((t) => ev.push({ title: t.title, sub: `${s.jobs[t.jobId]?.name || ''} · due`, kind: 'due', run: () => s.open({ t: 'task', id: t.id }) }))
  return ev.sort((a, b) => (a.time === 'All day' ? -1 : b.time === 'All day' ? 1 : minutes(a.time) - minutes(b.time)))
}
const EV_DOT: Record<Ev['kind'], string> = { meeting: 'bg-brand-500', crew: 'bg-ok-500', delivery: 'bg-warn-500', back: 'bg-vio-500', due: 'bg-ink-2', update: 'bg-brand-300' }

function Agenda() {
  const s = useStore()
  const days: { key: 'today' | 'tomorrow'; label: string; date: string }[] = [
    { key: 'today', label: 'Today', date: dayShort(TODAY) },
    { key: 'tomorrow', label: 'Tomorrow', date: dayShort(TOMORROW) },
  ]
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden">
      <PanelHead title="Agenda" />
      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto pb-2">
        {days.map((d) => {
          const ev = agendaFor(s, s.role, d.key)
          return (
            <section key={d.key}>
              <div className="sticky top-0 z-[1] flex items-baseline gap-2 bg-white/95 px-5 pb-1.5 pt-3 backdrop-blur max-sm:px-4">
                <span className="text-[0.84375rem] font-semibold text-ink">{d.label}</span>
                <span className="text-[0.78125rem] text-muted">{d.date}</span>
              </div>
              {ev.map((e, i) => (
                <button key={i} onClick={e.run} className="flex w-full items-start gap-3 px-5 py-2 text-left transition hover:bg-wash max-sm:px-4">
                  <span className="w-[3.375rem] shrink-0 pt-px text-right text-[0.78125rem] font-semibold tnum text-ink-2">{e.time}</span>
                  <span className={cn('mt-[0.4375rem] h-2 w-2 shrink-0 rounded-full', EV_DOT[e.kind])} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.875rem] leading-snug text-ink">{e.title}</span>
                    {e.sub && <span className="line-clamp-2 block text-[0.78125rem] text-muted">{e.sub}</span>}
                  </span>
                </button>
              ))}
              {!ev.length && <div className="px-5 py-2 text-[0.84375rem] text-faint max-sm:px-4">Nothing scheduled.</div>}
            </section>
          )
        })}
      </div>
    </Card>
  )
}

function DoneToday({ tasks }: { tasks: Task[] }) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden max-xl:min-h-[12.5rem]">
      <PanelHead title="Done today" right={<Count tone="ok">{tasks.length}</Count>} />
      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto py-1">
        {tasks.map((t) => <DayRow key={t.id} t={t} compact />)}
        {!tasks.length && <div className="px-5 py-3 text-[0.84375rem] text-muted">Nothing checked off yet.</div>}
      </div>
    </Card>
  )
}

/* ---------------- one row of my day ---------------- */
function DayRow({ t, showOwner, compact }: { t: Task; showOwner?: boolean; compact?: boolean }) {
  const s = useStore()
  const job = s.jobs[t.jobId]
  const [leaving, setLeaving] = React.useState(false)
  const done = t.state === 'done'
  const late = !done && dueBucket(t.due, t.dueTone) === 'overdue'
  /* the when goes in front of the second line, only when it adds something */
  const when = done ? t.doneAt : t.state === 'waiting' ? `Back ${t.followUp} · ${t.waitingOn}` : t.due && t.due !== 'Today' ? t.due : ''
  return (
    <div onClick={() => s.open({ t: 'task', id: t.id })} className={cn('group flex cursor-pointer items-center gap-3 border-t border-line-2 px-5 py-2.5 transition-colors first:border-t-0 hover:bg-wash max-sm:px-4', compact && 'border-t-0 py-2', leaving && 'row-out')}>
      <button
        aria-label={done ? 'Reopen' : 'Mark done'}
        onClick={(e) => {
          e.stopPropagation()
          if (done) return s.reopenTask(t.id)
          setLeaving(true)
          setTimeout(() => s.completeTask(t.id), 240)
        }}
        className={cn('inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full border-2 transition', done || leaving ? 'border-ok-500 bg-ok-500 text-white' : 'border-[#CBD3DE] text-transparent hover:border-ok-500 hover:text-ok-600')}
      >
        <Check className="h-3 w-3" strokeWidth={3.2} />
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn('line-clamp-2 font-medium leading-snug', compact ? 'text-[0.84375rem]' : 'text-[0.90625rem]', done ? 'text-ink-2' : 'text-ink')}>{t.title}</div>
        <div className="mt-0.5 truncate text-[0.78125rem] text-muted">
          {when && <span className={cn(late ? 'font-semibold text-bad-700' : t.state === 'waiting' ? 'text-warn-700' : 'text-ink-2')}>{when} · </span>}
          {job?.name}
          {t.where && !compact ? ` · ${t.where}` : ''}
          {showOwner ? ` · ${PEOPLE[t.owner].name}` : ''}
        </div>
      </div>
      {t.action && !done && t.state !== 'waiting' && !compact && (
        <Button
          size="xs"
          variant="secondary"
          className="shrink-0 max-md:hidden"
          onClick={(e) => {
            e.stopPropagation()
            runTaskAction(t)
          }}
        >
          {t.action.label}
        </Button>
      )}
    </div>
  )
}

function DailyRow({ it }: { it: DailyItem }) {
  const s = useStore()
  const job = s.jobs[it.jobId]
  const last = s.diary[it.jobId]?.[0]
  return (
    <div onClick={() => s.open({ t: 'daily', jobId: it.jobId })} className="group flex cursor-pointer items-center gap-3 border-t border-line-2 px-5 py-2.5 transition-colors first:border-t-0 hover:bg-wash max-sm:px-4">
      <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full border-2 border-[#CBD3DE]" />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[0.90625rem] font-medium leading-snug text-ink">Send today’s update · {job.name}</div>
        <div className="mt-0.5 truncate text-[0.78125rem] text-muted">
          {PEOPLE[it.crew].name}’s crew{it.workers ? `, ${it.workers} workers` : ''} · {job.pct ?? 0}% installed{last ? ` · last ${last.day.split(',')[0]}` : ''}
        </div>
      </div>
      <Button
        size="xs"
        variant="secondary"
        className="shrink-0"
        icon={<ClipboardList className="h-3.5 w-3.5" />}
        onClick={(e) => {
          e.stopPropagation()
          s.open({ t: 'daily', jobId: it.jobId })
        }}
      >
        Send update
      </Button>
    </div>
  )
}

/* ---------------- a quiet line of numbers that matter for this login ---------------- */
function Numbers({ role }: { role: Role }) {
  const s = useStore()
  const onToday = s.bookings.filter((b) => b.start <= TODAY_ISO && b.end >= TODAY_ISO)
  const busy = new Set(onToday.map((b) => b.crew))
  const free = CREWS.filter((c) => !busy.has(c))
  const stopped = Object.values(s.jobs).filter((j) => j.status === 'bad' && !['request', 'estimating', 'proposal', 'followup'].includes(j.stage))
  const upcoming = Object.values(s.jobs).filter((j) => ['awarded', 'setup', 'verification', 'ready', 'scheduled'].includes(j.stage))
  const noInstaller = upcoming.filter((j) => !s.bookings.some((b) => b.jobId === j.id) && (!s.prep[j.id]?.installer || s.prep[j.id]?.installer === 'tbd'))
  const waitingMoney = s.money.filter((m) => m.state === 'waiting' && m.amount).reduce((n, m) => n + (m.amount! - (m.paid || 0)), 0)
  const toSend = s.money.filter((m) => m.state === 'todo').length
  const pricing = Object.values(s.jobs).filter((j) => ['request', 'estimating', 'proposal', 'followup'].includes(j.stage))
  const toOrder = new Set(s.mats.filter((m) => m.status === 'to-order').map((m) => m.jobId)).size
  const waitingSup = s.pos.filter((p) => p.step === 1 || p.late).length
  const updatesDue = dailyDue(s, role).length

  type Stat = { label: string; value: React.ReactNode; sub: string; bad?: boolean; go: () => void }
  const crews: Stat = { label: 'Crews on site', value: `${busy.size} of ${CREWS.length}`, sub: free.length ? `${free.map((c) => PEOPLE[c].name).join(', ')} free` : 'Everyone is working', go: () => s.go({ page: 'schedule' }) }
  const risk: Stat = { label: 'Need attention', value: stopped.length, sub: stopped.slice(0, 3).map((j) => j.name).join(', ') || 'Nothing stopped', bad: stopped.length > 0, go: () => s.go({ page: 'projects', q: { attention: '1' } }) }
  const coming: Stat = { label: 'Coming up', value: upcoming.length, sub: `${noInstaller.length} still need an installer`, go: () => s.go({ page: 'upcoming' }) }
  const money: Stat = { label: 'To collect', value: fmtMoney(waitingMoney, { compact: true }), sub: `${smp('Sample amounts · ')}${toSend} bills to send`, go: () => s.go({ page: 'money' }) }
  const updates: Stat = { label: 'Daily updates due', value: updatesDue, sub: updatesDue ? 'One per project on site' : 'All sent today', go: () => s.go({ page: 'today' }) }
  const bids: Stat = { label: 'In pricing', value: pricing.length, sub: `${pricing.filter((j) => j.stage === 'followup').length} waiting on an answer`, go: () => s.go({ page: 'projects', q: { phase: 'pricing' } }) }
  const order: Stat = { label: 'To order', value: toOrder, sub: 'Projects missing our materials', bad: toOrder > 0, go: () => s.go({ page: 'upcoming' }) }
  const suppliers: Stat = { label: 'Waiting on suppliers', value: waitingSup, sub: 'To confirm or late', go: () => s.go({ page: 'tasks', tab: 'waiting' }) }
  const byRole: Record<string, Stat[]> = {
    owner: [crews, risk, coming, money],
    pm: [crews, updates, risk, coming],
    site: [crews, updates, risk, coming],
    office: [bids, coming, risk, suppliers],
    estimator: [bids, coming],
    materials: [order, suppliers, coming],
  }
  const list = byRole[role] || byRole.owner
  return (
    <div className="flex shrink-0 overflow-hidden rounded-2xl border border-line bg-white max-md:grid max-md:grid-cols-2">
      {list.map((x, i) => (
        <Tip key={x.label} label={x.sub} side="bottom">
          <button onClick={x.go} className={cn('min-w-[7.375rem] px-4 py-2.5 text-left transition-colors hover:bg-wash max-md:min-w-0', i > 0 && 'border-l border-line-2', 'max-md:[&:nth-child(odd)]:border-l-0 max-md:[&:nth-child(n+3)]:border-t')}>
            <div className={cn('text-[1.3125rem] font-bold leading-tight tnum h-tight', x.bad ? 'text-bad-700' : 'text-ink')}>{x.value}</div>
            <div className="text-[0.78125rem] text-muted">{x.label}</div>
          </button>
        </Tip>
      ))}
    </div>
  )
}

/* ---------------- side panels ---------------- */
function OnSite() {
  const s = useStore()
  const onToday = s.bookings.filter((b) => b.start <= TODAY_ISO && b.end >= TODAY_ISO)
  const busy = new Set(onToday.map((b) => b.crew))
  const free = CREWS.filter((c) => !busy.has(c))
  return (
    <Card className="shrink-0 overflow-hidden">
      <PanelHead title="On site today" right={<button onClick={() => s.go({ page: 'schedule' })} className="text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700">Schedule</button>} />
      {onToday.map((b) => {
        const job = s.jobs[b.jobId]
        const sent = s.diary[b.jobId]?.[0]?.date === NOW
        return (
          <button key={b.id} onClick={() => s.open({ t: 'job', id: job.id })} className="flex w-full items-center gap-3 border-t border-line-2 px-5 py-2.5 text-left first-of-type:border-t-0 hover:bg-wash">
            <Avatar who={b.crew as PersonKey} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.875rem] font-semibold text-ink">{job.name}</span>
              <span className="block truncate text-[0.78125rem] text-muted">
                {PEOPLE[b.crew as PersonKey].name} · {sent ? <span className="font-medium text-ok-700">Update sent</span> : 'No update yet'}
              </span>
            </span>
            <span className="w-[3.25rem] shrink-0">
              <span className="block text-right text-[0.78125rem] font-semibold tnum text-ink-2">{job.pct ?? 0}%</span>
              <Bar pct={job.pct || 0} h={4} className="mt-1" />
            </span>
          </button>
        )
      })}
      {free.length > 0 && <div className="border-t border-line-2 px-5 py-3 text-[0.8125rem] text-muted">Free: <span className="font-semibold text-ink-2">{free.map((c) => PEOPLE[c].short).join(', ')}</span></div>}
    </Card>
  )
}

function PricingSoon() {
  const s = useStore()
  const list = ['b3', 'b6', 'b5', 'b1', 'b2', 'b7', 'b4'].map((id) => s.jobs[id]).filter((j) => j && ['request', 'estimating', 'proposal', 'followup'].includes(j.stage))
  return (
    <Card className="shrink-0 overflow-hidden">
      <PanelHead title="Pricing this week" right={<button onClick={() => s.go({ page: 'projects', q: { phase: 'pricing' } })} className="text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700">See all</button>} />
      {list.slice(0, 4).map((j) => (
        <button key={j.id} onClick={() => s.open({ t: 'job', id: j.id })} className="flex w-full items-center gap-3 border-t border-line-2 px-5 py-2.5 text-left first-of-type:border-t-0 hover:bg-wash">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.875rem] font-semibold text-ink">{j.name}</span>
            <span className="block truncate text-[0.78125rem] text-muted">{STAGE_LABEL[j.stage]} · {j.next.text}</span>
          </span>
          <span className="shrink-0 text-right text-[0.78125rem] text-muted">{j.keyDate.value}</span>
        </button>
      ))}
    </Card>
  )
}

function Deliveries() {
  const s = useStore()
  const rows = [
    { job: '119', what: '2 brass JOLLY profiles', when: 'Tomorrow', from: 'Metal Works Inc.', task: 't-jolly' },
    { job: '119', what: '6 boxes of T-03 Toscana Ivory', when: shiftText('Fri Oct 2'), from: 'Best Tile · GC order', task: '' },
    { job: '24c', what: '12 boxes of T-06 Pearl', when: 'Fri', from: 'Best Tile · GC order', task: 't-tile24c' },
    { job: '114', what: 'Setting materials · PO-1045', when: 'Not confirmed', from: 'Infinity', task: 't-po1045' },
  ]
  return (
    <Card className="shrink-0 overflow-hidden">
      <PanelHead title="Deliveries this week" />
      {rows.map((r, i) => (
        <button key={i} onClick={() => (r.task ? s.open({ t: 'task', id: r.task }) : s.open({ t: 'job', id: r.job, tab: 'materials' }))} className="flex w-full items-center gap-3 border-t border-line-2 px-5 py-2.5 text-left first-of-type:border-t-0 hover:bg-wash">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.875rem] font-semibold text-ink">{r.what}</span>
            <span className="block truncate text-[0.78125rem] text-muted">{s.jobs[r.job].name} · {r.from}</span>
          </span>
          <span className={cn('shrink-0 text-[0.78125rem]', r.when === 'Not confirmed' ? 'font-semibold text-warn-700' : 'text-muted')}>{r.when}</span>
        </button>
      ))}
    </Card>
  )
}
