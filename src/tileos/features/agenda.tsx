/* The agenda — meetings, walkthroughs, deliveries and what comes back, with their times.
 * For me, for anyone in the company, or for everyone at once. One click adds a meeting; clashes are caught there. */
import * as React from 'react'
import { CalendarDays, Repeat, Truck, BellRing, Flag, Play, Footprints, Plus, ChevronRight, ChevronDown, Trash2, Building2, Clock3, Users, MapPin, History, Check, ArrowRight } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar, Segmented, Button, IconButton } from '@/tileos/components/ui/core'
import { Modal, Tip } from '@/tileos/components/ui/overlay'
import { Card, AvatarStack } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { CAL_TODAY, addDaysIso, dayLabel, dayLong, isoOfDay, rangeLabel, timeLabel, workDays, parseTime, type CalEvent } from '@/tileos/data/calendar'
import { busyFor, removeEvent, moveEvent, setEventPeople, renameEvent, noteEvent, addEventNote, doneEvent } from './calendar'
import { Notes } from './notes'
import { WinHead, WinLine, WatchPop, WhenPop, CHIP, clock, type WhenPick } from './winhead'
import { insidePeople } from './steps-ui'
import { labelFromIso, isoFromLabel } from '@/tileos/lib/today'
import { realOwner } from './steps'

type EvKind = 'meeting' | 'walkthrough' | 'report' | 'delivery' | 'follow' | 'due' | 'start'
type Ev = { id: string; when?: number; dur?: number; kind: EvKind; title: string; sub?: string; people?: PersonKey[]; run: () => void }
const EV: Record<EvKind, { card: string; icon: React.ElementType; label: string }> = {
  meeting: { card: 'border-brand-600 bg-brand-50 hover:bg-brand-100/70', icon: CalendarDays, label: 'Meeting' },
  walkthrough: { card: 'border-teal-500 bg-teal-50 hover:bg-teal-100/70', icon: Footprints, label: 'Walkthrough' },
  report: { card: 'border-vio-500 bg-vio-50 hover:bg-vio-100/70', icon: Repeat, label: 'Report' },
  delivery: { card: 'border-[#0e7490] bg-[#ecfeff] hover:bg-[#cffafe]', icon: Truck, label: 'Delivery' },
  follow: { card: 'border-warn-500 bg-warn-50 hover:bg-warn-100/70', icon: BellRing, label: 'Comes back' },
  due: { card: 'border-[#d9d3c9] bg-wash hover:bg-wash-2', icon: Flag, label: 'Due' },
  start: { card: 'border-ok-500 bg-ok-50 hover:bg-ok-100/70', icon: Play, label: 'Starts' },
}
const isMineT = (t: Store['tasks'][number], person: PersonKey) => t.owner === person

export function agendaFor(s: Store, role: Role, iso: string, person: PersonKey | null, single: boolean) {
  const field = ['owner', 'pm', 'site'].includes(role)
  const onSite = single && field ? s.bookings.filter((b) => b.start <= iso && b.end >= iso && s.jobs[b.jobId]) : []
  const evs: Ev[] = busyFor(s, iso, person ? [person] : null)
    .filter((b) => b.kind !== 'report' || single)
    .map((b) => ({ id: b.id, when: b.start, dur: b.dur, kind: b.kind, title: b.title, sub: b.sub, people: b.people, run: () => (b.kind === 'report' ? s.open({ t: 'task', id: b.id }) : s.open({ t: 'event', id: b.id })) }))
  if (person) {
    if (field || role === 'materials')
      s.mats.filter((m) => isoOfDay(m.eta) === iso).forEach((m) => evs.push({ id: m.id, kind: 'delivery', title: m.name.split(' · ')[0], sub: s.jobs[m.jobId]?.name, run: () => s.open({ t: 'job', id: m.jobId, tab: 'orders' }) }))
    s.tasks
      .filter((t) => t.state === 'waiting' && isMineT(t, person) && isoOfDay(t.followUp) === iso)
      .forEach((t) => evs.push({ id: t.id, kind: 'follow', title: t.title, sub: `${s.jobs[t.jobId]?.name || 'Company'} · ${t.waitingOn}`, run: () => s.open({ t: 'task', id: t.id }) }))
    if (iso !== CAL_TODAY)
      s.tasks
        .filter((t) => t.state === 'now' && isMineT(t, person) && !t.repeat && isoOfDay(t.due) === iso)
        .forEach((t) => evs.push({ id: t.id, kind: 'due', title: t.title, sub: s.jobs[t.jobId]?.name, run: () => s.open({ t: 'task', id: t.id }) }))
  }
  if (field && iso > CAL_TODAY) s.bookings.filter((b) => b.start === iso).forEach((b) => evs.push({ id: b.id, kind: 'start', title: `${PEOPLE[b.crew as PersonKey].name} starts`, sub: s.jobs[b.jobId]?.name, run: () => s.open({ t: 'job', id: b.jobId }) }))
  evs.sort((a, b) => (a.when ?? 9999) - (b.when ?? 9999))
  return { onSite, events: evs }
}

export function Agenda({ who }: { who: 'me' | 'all' | PersonKey }) {
  const s = useStore()
  const [view, setView] = React.useState<'today' | 'tomorrow' | 'week'>('today')
  const person = who === 'me' ? meOf(s.role) : who === 'all' ? null : who
  const days = view === 'today' ? [CAL_TODAY] : view === 'tomorrow' ? [addDaysIso(CAL_TODAY, 1)] : workDays(5)
  const single = view !== 'week'
  const title = who === 'me' ? 'Agenda' : who === 'all' ? 'Team agenda' : `${PEOPLE[who].short}’s agenda`
  return (
    <aside className="w-[23.25rem] shrink-0 max-xl:w-full" aria-label="Agenda">
      <Card
        title={title}
        sub={single ? dayLong(days[0]) : 'This week'}
        right={
          <Tip label="Add a meeting or walkthrough">
            <IconButton label="Add a meeting" onClick={() => s.open({ t: 'record', type: 'meeting' })} className="h-9 w-9 rounded-[0.625rem] border border-brand-200 bg-white text-brand-600 hover:bg-brand-50"><Plus className="h-4 w-4" /></IconButton>
          </Tip>
        }
      >
        <div className="px-6 pb-3 max-sm:px-4">
          <Segmented value={view} onChange={setView} className="grid h-9 w-full grid-cols-3 [&>button]:justify-center" items={[{ key: 'today', label: 'Today' }, { key: 'tomorrow', label: 'Tomorrow' }, { key: 'week', label: 'This week' }]} />
        </div>
        <div className="flex flex-col border-t border-line-2 px-6 pb-5 pt-4 max-sm:px-4">
          {days.map((iso) => {
            const { onSite, events } = agendaFor(s, s.role, iso, person, single)
            const crewPeople = onSite.reduce((n, b) => n + (b.workers || 2), 0)
            return (
              <section key={iso} className={cn(!single && 'border-b border-line-2 pb-3 pt-3 first:pt-0 last:border-0 last:pb-0')}>
                {!single && <div className="mb-2 text-[0.78125rem] font-semibold text-muted">{dayLabel(iso)} <span className="font-semibold normal-case tracking-normal text-faint">· {new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>}
                {onSite.length > 0 && (
                  <div className="mb-3 rounded-xl bg-wash px-3 pb-3 pt-2.5">
                    <div className="flex items-center justify-between text-[0.75rem] font-semibold text-faint">
                      <span>On site</span>
                      <span className="tnum">{onSite.length} crews · {crewPeople} people</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {onSite.map((b) => (
                        <button key={b.id} onClick={() => s.open({ t: 'job', id: b.jobId })} className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-white hover:shadow-xs">
                          <Avatar who={b.crew as PersonKey} size={28} />
                          <span className="min-w-0 leading-tight">
                            <span className="block truncate text-[0.8125rem] font-semibold text-ink">{PEOPLE[b.crew as PersonKey].short}</span>
                            <span className="block truncate text-[0.75rem] text-muted">{s.jobs[b.jobId].name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {events.map((e) => {
                    const k = EV[e.kind]
                    return (
                      <button key={e.kind + e.id} onClick={e.run} className="flex items-stretch gap-3 text-left">
                        <span className="flex w-[3.25rem] shrink-0 items-start justify-end pt-[0.6875rem] text-[0.78125rem] font-semibold tnum text-muted">
                          {e.when != null ? timeLabel(e.when).replace(' ', ' ') : <k.icon className="mt-0.5 h-4 w-4 text-faint" aria-label={k.label} />}
                        </span>
                        <span className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-xl border-l-[0.1875rem] py-2.5 pl-3 pr-2.5 transition-colors', k.card)}>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.875rem] font-semibold leading-5 text-ink">{e.title}</span>
                            {e.sub && <span className="mt-0.5 block truncate text-[0.78125rem] leading-4 text-muted">{e.sub}</span>}
                          </span>
                          {e.people && (who === 'all' || e.people.length > 1) && <AvatarStack who={e.people} max={3} size={22} />}
                        </span>
                      </button>
                    )
                  })}
                  {!onSite.length && !events.length && <div className="py-1.5 text-[0.84375rem] text-faint">Nothing on the agenda.</div>}
                </div>
              </section>
            )
          })}
          <div className="mt-4 flex items-center gap-4">
            <button onClick={() => s.open({ t: 'record', type: 'meeting' })} className="inline-flex items-center gap-1.5 text-[0.84375rem] font-semibold text-brand-600 hover:text-brand-700"><Plus className="h-4 w-4" />Add a meeting</button>
            <button onClick={() => s.go({ page: 'upcoming' })} className="ml-auto inline-flex items-center gap-1 text-[0.84375rem] font-semibold text-muted hover:text-ink">Schedule<ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </Card>
    </aside>
  )
}

/* ================= one meeting or walkthrough: the same window as every to-do =================
 * On top: Meeting (or Walkthrough) and its project, its name (tap to change it) and what it's about. One box: who's in it
 * (tap: tick people on or off), when (tap the day, tap the time), where. The bin cancels it — after a "sure?" at the
 * bottom. Nothing else to go into: everything is changed right where it's shown. */
const EV_TIMES = Array.from({ length: 25 }, (_, i) => 7 * 60 + i * 30)
/** a meeting's When: its day and its time, picked together on a calendar — the same in its window and on Today */
export function eventWhen(e: CalEvent): WhenPick {
  return {
    title: 'When',
    value: labelFromIso(e.date),
    presets: ['Today', 'Tomorrow', 'Next Mon'],
    time: clock(e.start),
    times: EV_TIMES.map(clock),
    needTime: true,
    onPick: () => { /* the day and the time go together (onSet) */ },
    onSet: (label, t) => moveEvent(e.id, { date: isoFromLabel(label) || e.date, start: (t ? parseTime(t) : null) ?? e.start }),
  }
}

export function EventModal({ id, level, notes }: { id: string; level: number; /** opened from its Add notes: the notes box ready to type in */ notes?: boolean }) {
  const s = useStore()
  const e = s.events.find((x) => x.id === id)
  const [canceling, setCanceling] = React.useState(false)
  if (!e) return null
  const job = e.jobId ? s.jobs[e.jobId] : undefined
  const ours = insidePeople(s)
  const what = e.kind === 'walkthrough' ? 'Walkthrough' : 'Meeting'
  const me = meOf(s.role)
  /* who's in it, by their whole name — the site manager's untaken place is the company's own site manager */
  const people = Array.from(new Set(e.people.map((p) => realOwner(s, p))))
  const where = e.where || job?.address
  const toggle = (p: PersonKey) => setEventPeople(e.id, e.people.includes(p) ? e.people.filter((x) => x !== p) : [...e.people, p])
  const lines = (
    <>
      <WinLine k="people" label="Who’s in it" top={people.length > 1}>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2" data-event-people={e.people.join(',')}>
          <WatchPop title="Who’s in it" sub="From us. It’s on each one’s Today and calendar." pick={{ people: ours, me, current: e.people, onToggle: toggle, anyone: true }} trigger={
            <button type="button" className={cn(CHIP, 'flex-wrap gap-x-3.5 gap-y-1.5')} aria-label="Who’s in it. Add or take off" data-event-who>
              {people.map((p) => <span key={p} className="inline-flex items-center gap-2 text-[0.9375rem] text-ink"><Avatar who={p} size={24} />{p === me ? 'You' : PEOPLE[p]?.short || p}</span>)}
              <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
            </button>
          } />
          {e.with && <span className="text-[0.9375rem] text-muted" data-event-with>with {e.with}</span>}
        </span>
      </WinLine>
      <WinLine k="when" label="When">
        {/* the day and the time in one: tap it — the calendar, the times beside it */}
        <WhenPop pick={eventWhen(e)} trigger={
          <button type="button" className={cn(CHIP, 'text-[0.9375rem] text-ink')} aria-label="When · change it" data-event-day data-event-time>
            <span>{dayLabel(e.date)}</span><span className="tnum">· {rangeLabel(e.start, e.dur)}</span><ChevronDown className="h-4 w-4 shrink-0 text-faint" />
          </button>
        } />
      </WinLine>
      {where && <WinLine k="where" label="Where"><span className="min-w-0 text-[0.9375rem] leading-snug text-ink">{where}</span></WinLine>}
    </>
  )
  return (
    <Modal
      level={level}
      /* the same size as every window that opens from a list */
      size="md"
      onClose={s.close}
      title={e.title}
      inlineClose header={<WinHead kind={{ icon: <CalendarDays />, label: what }} place={job ? job.name : 'Company'} onPlace={job ? () => s.swap({ t: 'job', id: job.id }) : undefined} title={e.title}
        edit={{ title: e.title, sub: e.note, onTitle: (v) => renameEvent(e.id, v), onSub: (v) => noteEvent(e.id, v) }}
        remove={() => setCanceling(true)} lines={lines} attrs={{ 'data-event-win': e.id }} />}
      footer={canceling ? (
        <>
          <span className="text-[0.875rem] font-medium text-bad-700">Cancel it? It comes off everyone’s calendar.</span>
          <div className="ml-auto" aria-hidden />
          <Button onClick={() => setCanceling(false)}>Keep it</Button>
          <Button variant="danger" icon={<Trash2 />} onClick={() => { removeEvent(e.id); s.close() }} data-event-cancel>Yes, cancel it</Button>
        </>
      ) : e.done ? (
        <span className="text-[0.875rem] font-medium text-[#2c8a5b]" data-event-done-on>Done {e.done}</span>
      ) : (
        /* the same buttons as a to-do's: the main one on the right */
        <>
          <div className="ml-auto" aria-hidden />
          {job && <Button icon={<ArrowRight />} onClick={() => s.swap({ t: 'job', id: job.id })} data-event-project>Open the project</Button>}
          <Button variant="primary" className="max-sm:flex-1" icon={<Check />} onClick={() => { doneEvent(e.id); s.close() }} data-event-done>Done</Button>
        </>
      )}
      bodyClass="px-6 pb-4 pt-3 max-sm:px-4"
    >
      {/* what people wrote on it — the same box as every to-do's */}
      <Notes kind="event" me={me} notes={e.notes || []} onAdd={e.done ? undefined : (x) => addEventNote(e.id, x)} focus={notes} />
      {/* when it was set, and by whom — one quiet line, like every to-do's */}
      {e.by && <div className="mt-4 flex items-center gap-1.5 text-[0.8125rem] text-faint" data-event-by><History className="h-3.5 w-3.5" />Set {e.made ? `${e.made.date}${e.made.time ? `, ${e.made.time}` : ''} ` : ''}by {e.by === me ? 'you' : PEOPLE[e.by]?.short || 'someone'}</div>}
    </Modal>
  )
}
function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-2 text-ink-2 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[0.78125rem] font-medium text-muted">{label}</dt>
        <dd className="text-ink">{children}</dd>
      </div>
    </div>
  )
}
