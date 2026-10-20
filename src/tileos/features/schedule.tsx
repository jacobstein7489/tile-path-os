import * as React from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, AlertTriangle, Ban, Users, Clock3, ArrowRight, Trash2, CalendarPlus, Smartphone, CheckCircle2, Info } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { PageHeader, Card, CardHeader, Button, Pill, Avatar, Segmented, Chip, Field, Stepper as NumStepper, Count, IconCircle } from '@/tileos/components/ui/core'
import { Modal, Tip, Pop } from '@/tileos/components/ui/overlay'
import { Page } from '@/tileos/components/ui/page'
import { Swatch } from '@/tileos/components/ui/swatch'
import { Bar } from '@/tileos/components/ui/progress'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, CREW_BLOCK, type PersonKey } from '@/tileos/data/model'
import { assignCrew, addBusinessDays, isoLabel } from './flows'
import { TODAY, TOMORROW, MONDAY, addDays as addDaysT, dayShort, workday } from '@/tileos/lib/today'

export function mondayOf(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return d.toISOString().slice(0, 10)
}
export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function businessDays(startMon: string, weeks: number) {
  const out: string[] = []
  for (let w = 0; w < weeks; w++) for (let i = 0; i < 5; i++) out.push(addDays(startMon, w * 7 + i))
  return out
}
const dayHead = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return { dow: d.toLocaleDateString('en-US', { weekday: 'short' }), num: d.getDate(), mon: d.toLocaleDateString('en-US', { month: 'short' }) }
}

export function SchedulePage() {
  const s = useStore()
  const [mon, setMon] = React.useState(mondayOf(TODAY))
  const [weeks, setWeeks] = React.useState<'1' | '2'>('1')
  const days = businessDays(mon, Number(weeks))
  const first = days[0]
  const last = days[days.length - 1]
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', o)
  const range = `${fmt(first, { month: 'short', day: 'numeric' })} – ${fmt(last, { month: first.slice(5, 7) === last.slice(5, 7) ? undefined : 'short', day: 'numeric' })}, ${fmt(last, { year: 'numeric' })}`
  const cols = days.length
  const step = Number(weeks) * 7

  return (
    <Page
      title="Schedule"
      actions={
          <>
            <div className="flex items-center rounded-lg border border-line bg-white">
              <button aria-label="Back" onClick={() => setMon(addDays(mon, -step))} className="inline-flex h-9 w-9 items-center justify-center rounded-l-lg text-ink-2 hover:bg-wash"><ChevronLeft className="h-4 w-4" /></button>
              <DatePicker value={mon} weeks={Number(weeks)} onPick={(iso) => setMon(mondayOf(iso))}>
                <button className="inline-flex h-9 items-center gap-2 border-x border-line px-3 text-[0.875rem] font-medium text-ink hover:bg-wash">
                  <CalendarDays className="h-4 w-4 text-muted" />
                  {range}
                </button>
              </DatePicker>
              <button aria-label="Forward" onClick={() => setMon(addDays(mon, step))} className="inline-flex h-9 w-9 items-center justify-center rounded-r-lg text-ink-2 hover:bg-wash"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <Button onClick={() => setMon(mondayOf(TODAY))}>Today</Button>
            <Segmented value={weeks} onChange={setWeeks} items={[{ key: '1', label: 'Week' }, { key: '2', label: '2 weeks' }]} />
            <ReadyPop />
          </>
      }
    >
      <div className="border-t border-line">
        {/* the days scroll sideways when the screen is narrow; crew names stay pinned */}
        <div className="scroll-soft overflow-x-auto [--crew:14.5rem] max-xl:[--crew:13.5rem] max-sm:[--crew:7.25rem]">
          <div style={{ minWidth: `calc(var(--crew) + ${cols * (cols > 5 ? 86 : 112)}px)` }}>
            <div className="grid border-b border-line" style={{ gridTemplateColumns: `var(--crew) repeat(${cols}, minmax(0,1fr))` }}>
              <div className="sticky left-0 z-[3] flex items-end bg-white pb-3 pl-10 pr-3 pt-3 text-[0.78125rem] font-medium text-muted max-xl:pl-8 max-lg:pl-6 max-sm:pl-4">Crew</div>
              {days.map((d, i) => {
                const today = d === TODAY
                const weekStart = i > 0 && i % 5 === 0
                return (
                  <div key={d} className={cn('min-w-0 border-l px-2.5 py-2.5', weekStart ? 'border-l-line' : 'border-l-line-2')}>
                    <div className="truncate text-[0.75rem] font-medium text-muted">{fmt(d, { weekday: 'short' })}{i % 5 === 0 ? ` · ${fmt(d, { month: 'short' })}` : ''}</div>
                    <div className={cn('mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-[1rem] font-semibold tnum', today ? 'bg-brand-600 text-white' : 'text-ink')}>{fmt(d, { day: 'numeric' })}</div>
                  </div>
                )
              })}
            </div>
            {CREWS.map((crew) => {
              const bks = s.bookings.filter((b) => b.crew === crew && b.end >= first && b.start <= last)
              const busyDays = new Set<string>()
              bks.forEach((b) => days.forEach((d) => d >= b.start && d <= b.end && busyDays.add(d)))
              const free = days.filter((d) => !busyDays.has(d))
              return (
                <div key={crew} className="grid border-b border-line-2 last:border-0" style={{ gridTemplateColumns: `var(--crew) repeat(${cols}, minmax(0,1fr))` }}>
                  <div className="sticky left-0 z-[3] flex items-center gap-3 bg-white py-3 pl-10 pr-3 max-xl:pl-8 max-lg:pl-6 max-sm:gap-2 max-sm:pl-4 max-sm:shadow-[0.0625rem_0_0_var(--color-line-2)]">
                    <Avatar who={crew} size={28} className="max-sm:hidden" />
                    <div className="min-w-0">
                      <div className="truncate text-[0.875rem] font-medium text-ink" title={PEOPLE[crew].name}>{PEOPLE[crew].name}</div>
                      <div className={cn('text-[0.78125rem]', free.length === days.length ? 'font-semibold text-ok-700' : 'text-muted')}>{free.length === days.length ? 'Free' : `${bks[0]?.workers || 2} workers`}</div>
                    </div>
                  </div>
                  <div className="relative min-w-0" style={{ gridColumn: `2 / span ${cols}` }}>
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
                      {days.map((d, i) => (
                        <div key={d} className={cn('group relative border-l', i > 0 && i % 5 === 0 ? 'border-l-line' : 'border-l-line-2', d === TODAY && 'bg-brand-50/40')}>
                          {!busyDays.has(d) && (
                            <button onClick={() => s.open({ t: 'assign', crew, start: d })} className="absolute inset-1.5 flex items-center justify-center gap-1 rounded-lg border border-dashed border-transparent text-[0.78125rem] font-semibold text-faint opacity-0 transition group-hover:border-[#CDD4DE] group-hover:opacity-100 hover:bg-wash hover:text-brand-600">
                              <Plus className="h-3.5 w-3.5" /> Assign
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="pointer-events-none relative h-[4.5rem]">
                      {bks.map((b) => {
                        const si = days.findIndex((d) => d >= b.start)
                        let ei = -1
                        days.forEach((d, i) => d <= b.end && (ei = i))
                        if (si < 0 || ei < si) return null
                        const job = s.jobs[b.jobId]
                        const blocked = (s.rooms[b.jobId] || []).some((r) => r.surfaces.some((x) => x.state === 'blocked'))
                        const cont = b.end > last
                        const span = ei - si + 1
                        return (
                          <button
                            key={b.id}
                            onClick={() => s.open({ t: 'booking', id: b.id })}
                            title={`${job?.name} · ${b.label}`}
                            className={cn('pointer-events-auto absolute bottom-2 top-2 flex min-w-0 flex-col justify-center overflow-hidden rounded-lg border bg-[#F3F6FA] px-3 text-left transition hover:border-[#C9D3E0] hover:bg-[#EDF1F7]', b.status === 'pending' ? 'border-dashed border-[#AEB9C9]' : 'border-[#E1E7EF]')}
                            style={{ left: `calc(${(si / cols) * 100}% + 5px)`, width: `calc(${(span / cols) * 100}% - 10px)` }}
                          >
                            <div className="flex min-w-0 items-center gap-1.5 leading-tight">
                              {blocked && <span className="h-2 w-2 shrink-0 rounded-full bg-bad-500" title="One surface blocked — the crew works elsewhere" />}
                              <span className="truncate text-[0.84375rem] font-semibold text-ink">{job?.name}</span>
                              {cont && <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-faint" />}
                            </div>
                            <div className="mt-0.5 truncate text-[0.75rem] leading-tight text-muted">{b.status === 'pending' ? `Waiting for ${PEOPLE[crew].name} to confirm` : b.label}</div>
                            {job?.pct !== undefined && span >= 2 && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="h-[0.25rem] flex-1 overflow-hidden rounded-full bg-[#DDE4EE]"><div className="h-full rounded-full bg-brand-500" style={{ width: `${job.pct}%` }} /></div>
                                <span className="text-[0.71875rem] font-semibold leading-none tnum text-ink-2">{job.pct}%</span>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Page>
  )
}

/* a month calendar to jump to any week */
export function DatePicker({ value, weeks, onPick, children }: { value: string; weeks: number; onPick: (iso: string) => void; children: React.ReactElement }) {
  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState(value.slice(0, 7))
  React.useEffect(() => {
    if (open) setMonth(value.slice(0, 7))
  }, [open])
  const firstOfMonth = month + '-01'
  const gridStart = mondayOf(firstOfMonth)
  const cells = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i))
  const selEnd = addDays(value, weeks * 7 - 3)
  const label = new Date(firstOfMonth + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const shift = (n: number) => {
    const d = new Date(firstOfMonth + 'T12:00:00')
    d.setMonth(d.getMonth() + n)
    setMonth(d.toISOString().slice(0, 7))
  }
  return (
    <Pop open={open} onOpenChange={setOpen} align="center" width={320} trigger={children}>
      <div className="flex items-center justify-between">
        <button aria-label="Previous month" onClick={() => shift(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-wash"><ChevronLeft className="h-4 w-4" /></button>
        <div className="text-[0.9375rem] font-semibold text-ink">{label}</div>
        <button aria-label="Next month" onClick={() => shift(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-wash"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[0.75rem] font-medium text-muted">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <div key={d} className="py-1.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === month
          const inSel = d >= value && d <= selEnd
          const today = d === TODAY
          return (
            <button
              key={d}
              onClick={() => {
                onPick(d)
                setOpen(false)
              }}
              className={cn('mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-[0.84375rem] tnum transition', inSel ? 'bg-brand-50 font-semibold text-brand-700' : inMonth ? 'text-ink hover:bg-wash' : 'text-faint hover:bg-wash', today && 'ring-2 ring-brand-500')}
            >
              {Number(d.slice(8, 10))}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex justify-between border-t border-line-2 pt-3">
        <button onClick={() => { onPick(TODAY); setOpen(false) }} className="text-[0.84375rem] font-semibold text-brand-600 hover:text-brand-700">Go to today</button>
        <span className="text-[0.78125rem] text-muted">Pick any day to jump to its week</span>
      </div>
    </Pop>
  )
}

function ReadyPop() {
  const s = useStore()
  const [open, setOpen] = React.useState(false)
  const STATUS = { ready: 'Ready', partial: 'Can start in part', return: 'Return visit', hold: 'On hold' } as const
  const act = (fn: () => void) => {
    setOpen(false)
    fn()
  }
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      align="end"
      width={560}
      trigger={
        <Button variant="secondary" aria-label={`Ready for a crew ${s.ready.length}`}>
          Ready for a crew <Count tone={s.ready.length ? 'info' : 'neutral'}>{s.ready.length}</Count>
        </Button>
      }
    >
      <div className="-mx-4 -mt-4">
        <div className="flex items-center justify-between gap-3 border-b border-line-2 px-5 py-3.5">
          <div>
            <div className="text-[0.96875rem] font-semibold text-ink">Ready for a crew</div>
            <div className="text-[0.78125rem] text-muted">Can start, or needs a return visit — the best fit first.</div>
          </div>
          <button onClick={() => act(() => s.go({ page: 'upcoming' }))} className="shrink-0 text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700">Coming up</button>
        </div>
        <div className="scroll-soft max-h-[min(28.75rem,60vh)] overflow-y-auto">
          {s.ready.map((r) => {
            const j = s.jobs[r.jobId]
            if (!j) return null
            return (
              <div key={r.jobId} className="flex min-w-0 items-center gap-3 border-b border-line-2 px-5 py-2.5 last:border-0">
                <button onClick={() => act(() => s.open({ t: 'job', id: j.id }))} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink hover:text-brand-700">{j.name}</span>
                  <span className={cn('block truncate text-[0.78125rem]', r.kind === 'hold' ? 'font-semibold text-bad-700' : r.warn ? 'text-warn-700' : 'text-ok-700')}>
                    {STATUS[r.kind]}{r.warn ? ` — ${r.warn}` : ''}
                  </span>
                </button>
                <span className="w-[7.875rem] shrink-0 whitespace-nowrap text-right text-[0.78125rem] text-muted max-sm:hidden">{r.days} {r.days === 1 ? 'day' : 'days'} · {r.workers} {r.workers === 1 ? 'worker' : 'workers'}</span>
                {r.kind === 'hold' ? (
                  <span className="w-[4.5rem] shrink-0 text-right text-[0.8125rem] text-muted">Waiting</span>
                ) : (
                  <Button size="xs" variant="secondary" className="w-[4.5rem] shrink-0" onClick={() => act(() => s.open({ t: 'assign', jobId: j.id }))}>{r.kind === 'return' ? 'Book' : 'Assign'}</Button>
                )}
              </div>
            )
          })}
          {!s.ready.length && <div className="px-5 py-6 text-center text-[0.84375rem] text-muted">Nothing is waiting for a crew.</div>}
        </div>
      </div>
    </Pop>
  )
}

const START_OPTS = [
  { iso: workday(TOMORROW), label: workday(TOMORROW) === TOMORROW ? 'Tomorrow' : dayShort(workday(TOMORROW)).replace(',', '') },
  { iso: workday(addDaysT(TODAY, 3)), label: dayShort(workday(addDaysT(TODAY, 3))).replace(',', '') },
  { iso: addDaysT(MONDAY, 7), label: dayShort(addDaysT(MONDAY, 7)).replace(',', '') },
  { iso: addDaysT(MONDAY, 14), label: dayShort(addDaysT(MONDAY, 14)).replace(',', '') },
]

export function AssignModal({ jobId: initialJob, crew: initialCrew, start: initialStart, level }: { jobId?: string; crew?: PersonKey; start?: string; level: number }) {
  const s = useStore()
  const close = s.close
  const [jobId, setJobId] = React.useState(initialJob || '')
  const r = s.ready.find((x) => x.jobId === jobId)
  const job = s.jobs[jobId]
  const [crew, setCrew] = React.useState<PersonKey | ''>(initialCrew || '')
  const [start, setStart] = React.useState(initialStart || workday(addDaysT(TODAY, 3)))
  const [days, setDays] = React.useState(r?.days || 3)
  const [workers, setWorkers] = React.useState(r?.workers || 2)
  const [areas, setAreas] = React.useState<string[]>(r?.areas || [])
  const [confirm, setConfirm] = React.useState(true)
  React.useEffect(() => {
    const rr = s.ready.find((x) => x.jobId === jobId)
    if (rr) {
      setDays(rr.days)
      setWorkers(rr.workers)
      setAreas(rr.areas)
    }
  }, [jobId])
  const end = addBusinessDays(start, days)
  const busyUntil = (c: PersonKey) => {
    const b = s.bookings.filter((x) => x.crew === c && x.end >= start).sort((a, b2) => (a.end > b2.end ? -1 : 1))[0]
    return b
  }
  const dep = job ? s.money.find((m) => m.jobId === jobId && m.kind === 'deposit' && m.state !== 'paid') : undefined
  const toOrder = job ? s.mats.filter((m) => m.jobId === jobId && m.status === 'to-order') : []
  const warns = [
    ...(r?.warn ? [r.warn] : []),
    ...(dep ? [`Deposit ${dep.step === 0 ? 'not invoiced' : 'invoiced ' + (dep.ref || '') + ', not paid'} — company rule: warning only`] : []),
    ...(toOrder.length ? [`${toOrder.map((m) => m.name).join(' and ')} not ordered yet`] : []),
    ...(crew && busyUntil(crew as PersonKey) && busyUntil(crew as PersonKey)!.start <= end ? [`${PEOPLE[crew as PersonKey].name} is booked on ${s.jobs[busyUntil(crew as PersonKey)!.jobId]?.name} until ${isoLabel(busyUntil(crew as PersonKey)!.end)}`] : []),
  ]

  if (!jobId) {
    return (
      <Modal level={level} size="md" onClose={close} title={initialCrew ? `Give ${PEOPLE[initialCrew].name} work` : 'Assign a crew'} sub="Pick a project that the rules say can start.">
        <div className="flex flex-col gap-2.5">
          {s.ready.filter((x) => x.kind !== 'hold').map((x) => {
            const j = s.jobs[x.jobId]
            return (
              <button key={x.jobId} onClick={() => setJobId(x.jobId)} className="flex items-center gap-3.5 rounded-2xl border border-line p-4 text-left hover:bg-wash">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.9375rem] font-semibold text-ink">{j.name}</div>
                  <div className="text-[0.8125rem] text-muted">{x.label} · {x.days} {x.days === 1 ? 'day' : 'days'} · {x.workers} {x.workers === 1 ? 'worker' : 'workers'}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-faint" />
              </button>
            )
          })}
        </div>
      </Modal>
    )
  }
  return (
    <Modal
      level={level}
      size="lg"
      onClose={close}
      header={
        <div className="flex items-center gap-4 border-b border-line-2 px-7 pb-5 pt-6 pr-20 max-sm:flex-wrap max-sm:gap-x-3 max-sm:gap-y-2 max-sm:px-4 max-sm:pb-4 max-sm:pr-14 max-sm:pt-4">
          <div>
            <div className="text-[0.84375rem] font-medium text-muted">{['punch', 'closeout'].includes(job.stage) ? 'Book a return visit' : 'Assign a crew'}</div>
            <h2 className="h-tight text-[1.4375rem] font-bold text-ink max-sm:text-[1.1875rem]">{job.name}</h2>
          </div>
          {r && <Pill tone={r.kind === 'ready' ? 'ok' : r.kind === 'partial' ? 'warn' : 'info'} className="ml-2 max-sm:ml-0">{r.label}</Pill>}
        </div>
      }
      title="Assign crew"
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{crew ? `${PEOPLE[crew as PersonKey].name} · ${isoLabel(start)} – ${isoLabel(end)}` : 'Pick a crew'}</span>
          <Button className="ml-auto" variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!crew} icon={<CalendarPlus className="h-[1.125rem] w-[1.125rem]" />} onClick={() => assignCrew(jobId, { crew: crew as PersonKey, start, days, workers, areas, confirm })}>
            Book {crew ? PEOPLE[crew as PersonKey].name : 'crew'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Field label="Crew">
          <div className="grid grid-cols-3 gap-2.5 max-sm:grid-cols-1">
            {CREWS.map((c) => {
              const b = busyUntil(c)
              const busy = b && b.start <= end
              return (
                <button key={c} onClick={() => setCrew(c)} className={cn('flex items-center gap-3 rounded-2xl border p-3 text-left transition', crew === c ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-line hover:bg-wash')}>
                  <Avatar who={c} size={36} />
                  <div className="min-w-0">
                    <div className="text-[0.90625rem] font-semibold text-ink">{PEOPLE[c].name}</div>
                    <div className={cn('truncate text-[0.78125rem]', busy ? 'text-warn-700' : 'font-semibold text-ok-600')}>{busy ? `Busy until ${isoLabel(b!.end)}` : 'Free'}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </Field>
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-5 max-sm:grid-cols-1 max-sm:items-start max-sm:gap-4">
          <Field label="Start">
            <div className="flex flex-wrap gap-2">
              {START_OPTS.map((o) => (
                <Chip key={o.iso} on={start === o.iso} onClick={() => setStart(o.iso)} className="h-10 px-3 text-[0.84375rem]">{o.label}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Days"><NumStepper value={days} onChange={setDays} min={1} max={40} /></Field>
          <Field label="Workers"><NumStepper value={workers} onChange={setWorkers} min={1} max={8} /></Field>
        </div>
        {r && (
          <Field label="Starting areas" hint="Only areas the rules released. Held areas stay off the crew’s list.">
            <div className="flex flex-wrap gap-2">
              {r.areas.map((a) => (
                <Chip key={a} on={areas.includes(a)} onClick={() => setAreas((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]))} className="h-9 px-3 text-[0.84375rem]">{a}</Chip>
              ))}
            </div>
          </Field>
        )}
        {warns.length > 0 && (
          <div className="rounded-2xl border border-warn-100 bg-warn-50/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-[0.875rem] font-semibold text-ink"><AlertTriangle className="h-4 w-4 text-warn-600" />Before you book</div>
            <div className="flex flex-col gap-1.5">
              {warns.map((w) => (
                <div key={w} className="text-[0.84375rem] text-ink-2">• {w}</div>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => setConfirm((v) => !v)} className={cn('flex items-center gap-3.5 rounded-2xl border p-4 text-left transition', confirm ? 'border-brand-200 bg-brand-50/50' : 'border-line')}>
          <IconCircle tone={confirm ? 'info' : 'neutral'} size={40}><Smartphone className="h-5 w-5" /></IconCircle>
          <div className="min-w-0 flex-1">
            <div className="text-[0.90625rem] font-semibold text-ink">Ask {crew ? PEOPLE[crew as PersonKey].name : 'the crew'} to confirm on his phone</div>
            <div className="text-[0.8125rem] text-muted">Shows as “waiting to confirm” on the schedule until he accepts.</div>
          </div>
          <span className={cn('relative h-6 w-11 rounded-full transition', confirm ? 'bg-brand-600' : 'bg-[#D5DBE4]')}>
            <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', confirm ? 'left-[1.375rem]' : 'left-0.5')} />
          </span>
        </button>
      </div>
    </Modal>
  )
}

export function BookingModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const b = s.bookings.find((x) => x.id === id)
  if (!b) return null
  const job = s.jobs[b.jobId]
  const col = CREW_BLOCK[b.crew]
  return (
    <Modal
      level={level}
      size="sm"
      onClose={s.close}
      header={
        <div className="flex items-center gap-4 border-b border-line-2 px-7 pb-5 pt-6 pr-20 max-sm:px-4 max-sm:pb-4 max-sm:pr-14 max-sm:pt-4">
          <Avatar who={b.crew as PersonKey} size={46} />
          <div>
            <div className="text-[0.84375rem] font-medium text-muted">{PEOPLE[b.crew as PersonKey].name} · {b.workers} workers</div>
            <h2 className="h-tight text-[1.375rem] font-bold text-ink">{job?.name}</h2>
          </div>
        </div>
      }
      title="Booking"
      footer={
        <>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => { s.commit((st) => { st.bookings = st.bookings.filter((x) => x.id !== id) }, 'Booking removed'); s.close() }}>Remove</Button>
          <Button className="ml-auto" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => s.commit((st) => { const x = st.bookings.find((y) => y.id === id); if (x) x.end = addBusinessDays(x.end, 2) }, 'Extended one day')}>Extend a day</Button>
          <Button variant="primary" iconRight={<ArrowRight className="h-4 w-4" />} onClick={() => { s.close(); s.open({ t: 'job', id: b.jobId }) }}>Open project</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl p-4" style={{ background: col.bg, boxShadow: `inset 4px 0 0 ${col.bar}` }}>
          <div className="text-[0.9375rem] font-semibold" style={{ color: col.text }}>{b.label}</div>
          <div className="text-[0.84375rem]" style={{ color: col.text }}>{isoLabel(b.start)} – {isoLabel(b.end)}</div>
        </div>
        {b.status === 'pending' && (
          <div className="flex items-center gap-2.5 rounded-xl bg-warn-50 px-3.5 py-3 text-[0.875rem] text-ink-2"><Clock3 className="h-4 w-4 text-warn-600" />Waiting for {PEOPLE[b.crew as PersonKey].name} to confirm on his phone.</div>
        )}
        {job?.pct !== undefined && (
          <div>
            <div className="flex justify-between text-[0.84375rem]"><span className="text-muted">Project progress</span><span className="font-semibold tnum text-ink">{job.pct}%</span></div>
            <Bar pct={job.pct} className="mt-1.5" h={7} />
          </div>
        )}
        <div className="flex items-start gap-2 text-[0.8125rem] text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" />If another trade needs the site, record it on the project — the booking moves without losing its history.</div>
      </div>
    </Modal>
  )
}
