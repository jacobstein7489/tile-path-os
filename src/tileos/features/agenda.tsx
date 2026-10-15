/* The agenda — meetings, walkthroughs, deliveries and what comes back, with their times.
 * For me, for anyone in the company, or for everyone at once. One click adds a meeting; clashes are caught there. */
import * as React from 'react'
import { CalendarDays, Repeat, Truck, BellRing, Flag, Play, Footprints, Plus, ChevronRight, Trash2, Building2, Clock3, Users } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar, Segmented, Button, IconButton } from '@/tileos/components/ui/core'
import { Modal, Tip, Menu, MenuItem, DatePresets } from '@/tileos/components/ui/overlay'
import { Card, AvatarStack } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { CAL_TODAY, addDaysIso, dayLabel, dayLong, isoOfDay, rangeLabel, timeLabel, workDays } from '@/tileos/data/calendar'
import { busyFor, removeEvent, moveEvent } from './calendar'
import { insidePeople } from './steps-ui'
import { labelFromIso, isoFromLabel } from '@/tileos/lib/today'

type EvKind = 'meeting' | 'walkthrough' | 'report' | 'delivery' | 'follow' | 'due' | 'start'
type Ev = { id: string; when?: number; dur?: number; kind: EvKind; title: string; sub?: string; people?: PersonKey[]; run: () => void }
const EV: Record<EvKind, { card: string; icon: React.ElementType; label: string }> = {
  meeting: { card: 'border-brand-600 bg-brand-50 hover:bg-brand-100/70', icon: CalendarDays, label: 'Meeting' },
  walkthrough: { card: 'border-teal-500 bg-teal-50 hover:bg-teal-100/70', icon: Footprints, label: 'Walkthrough' },
  report: { card: 'border-vio-500 bg-vio-50 hover:bg-vio-100/70', icon: Repeat, label: 'Report' },
  delivery: { card: 'border-[#0e7490] bg-[#ecfeff] hover:bg-[#cffafe]', icon: Truck, label: 'Delivery' },
  follow: { card: 'border-warn-500 bg-warn-50 hover:bg-warn-100/70', icon: BellRing, label: 'Comes back' },
  due: { card: 'border-[#d6dae0] bg-wash hover:bg-wash-2', icon: Flag, label: 'Due' },
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
                {!single && <div className="mb-2 text-[0.78125rem] font-bold uppercase tracking-[0.05em] text-muted">{dayLabel(iso)} <span className="font-semibold normal-case tracking-normal text-faint">· {new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>}
                {onSite.length > 0 && (
                  <div className="mb-3 rounded-xl bg-wash px-3 pb-3 pt-2.5">
                    <div className="flex items-center justify-between text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-faint">
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

/* ================= one meeting or walkthrough: move it, cancel it, who's in it ================= */
const EV_TIMES = Array.from({ length: 25 }, (_, i) => 7 * 60 + i * 30)
export function EventModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const e = s.events.find((x) => x.id === id)
  const [moving, setMoving] = React.useState(false)
  const [canceling, setCanceling] = React.useState(false)
  const [day, setDay] = React.useState(e ? labelFromIso(e.date) : 'Tomorrow')
  const [time, setTime] = React.useState(e?.start ?? 10 * 60)
  const [who, setWho] = React.useState<PersonKey[]>(e?.people || [])
  if (!e) return null
  const job = e.jobId ? s.jobs[e.jobId] : undefined
  const ours = insidePeople(s)
  const what = e.kind === 'walkthrough' ? 'walkthrough' : 'meeting'
  const save = () => { moveEvent(e.id, { date: isoFromLabel(day) || e.date, start: time, people: who }); setMoving(false) }
  return (
    <Modal
      level={level}
      size="sm"
      onClose={s.close}
      title={e.title}
      sub={`${e.kind === 'walkthrough' ? 'Walkthrough' : 'Meeting'} · ${dayLong(e.date)}`}
      footer={
        canceling ? (
          <>
            <span className="text-[0.84375rem] font-medium text-bad-700">Cancel it? It comes off everyone’s calendar.</span>
            <Button className="ml-auto" variant="ghost" onClick={() => setCanceling(false)}>Keep it</Button>
            <Button variant="danger" onClick={() => { removeEvent(e.id); s.close() }}>Yes, cancel it</Button>
          </>
        ) : moving ? (
          <>
            <Button variant="ghost" onClick={() => setMoving(false)}>Cancel</Button>
            <Button className="ml-auto" variant="primary" disabled={!who.length} onClick={save}>Save</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" icon={<Trash2 />} onClick={() => setCanceling(true)}>Cancel the {what}</Button>
            <Button className="ml-auto" onClick={() => setMoving(true)}>Move it</Button>
            {job && <Button variant="primary" onClick={() => s.swap({ t: 'job', id: job.id })}>Open {job.name}</Button>}
          </>
        )
      }
    >
      {moving ? (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 text-[0.8125rem] font-semibold text-ink-2">What day</div>
            <DatePresets value={day} onPick={setDay} presets={['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon']} />
          </div>
          <div>
            <div className="mb-2 text-[0.8125rem] font-semibold text-ink-2">What time</div>
            <Menu align="start" width={180} trigger={<button className="inline-flex h-10 w-[11rem] items-center justify-between gap-2 rounded-[0.625rem] border border-line bg-white px-3 text-[0.875rem] font-medium text-ink hover:border-[#cbd1d9]"><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-faint" />{timeLabel(time)}</span></button>}>
              {EV_TIMES.map((m) => <MenuItem key={m} checked={m === time} onSelect={() => setTime(m)}>{timeLabel(m)}</MenuItem>)}
            </Menu>
          </div>
          <div>
            <div className="mb-2 text-[0.8125rem] font-semibold text-ink-2">Who from us — they’re told</div>
            <div className="flex flex-wrap gap-1.5">
              {ours.map((p) => {
                const on = who.includes(p)
                return <button key={p} type="button" aria-pressed={on} onClick={() => setWho(on ? who.filter((x) => x !== p) : [...who, p])} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border pl-1 pr-3 text-[0.8125rem] font-medium transition', on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:bg-wash')}><Avatar who={p} size={26} />{PEOPLE[p]?.short}</button>
              })}
            </div>
          </div>
        </div>
      ) : (
        <dl className="flex flex-col gap-4 text-[0.875rem]">
          <Row icon={<Clock3 />} label="When">{dayLabel(e.date)} · {rangeLabel(e.start, e.dur)}</Row>
          {job && <Row icon={<Building2 />} label="Project">{job.name} · <span className="text-muted">{job.address}</span></Row>}
          <Row icon={<Users />} label="Who">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {e.people.map((p) => <span key={p} className="inline-flex items-center gap-1.5"><Avatar who={p} size={22} />{PEOPLE[p]?.short}</span>)}
              {e.with && <span className="text-muted">with {e.with}</span>}
            </span>
          </Row>
          {e.by && <Row icon={<CalendarDays />} label="Set by">{PEOPLE[e.by]?.name || 'Someone'}</Row>}
          {e.note && <Row icon={<Flag />} label="About">{e.note}</Row>}
        </dl>
      )}
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
