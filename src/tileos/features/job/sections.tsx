/* The four sections of a project — the four steps on top are the only navigation:
 *   Getting ready   — the whole flow, in order, on one page: tile paperwork, design meeting, site, installer,
 *                     deliveries, deposit. Every step opens right there in the list, not in another window.
 *   Installing      — the rooms and how far each is, the crew's daily updates, the installer's PO and days.
 *   Touch-ups       — one list per project, line by line, each with its photos.
 *   Billed and paid — the money.
 * The same pieces (job/kit) everywhere: sheets, rows, people, dates. */
import * as React from 'react'
import { ChevronDown, ChevronRight, Check, Plus, Play, Package, ClipboardList } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { tilesOf, roomPct, type Room } from '@/tileos/data/jobs'
import { TODAY, labelFromIso } from '@/tileos/lib/today'
import { isGettingReady, stepsFor, stepCounts, PHASES, scopeLock, type StepView } from '../steps'
import { AddRoomButton } from '../roomedit'
import { StepIcon } from '../steps-ui'
import { StepInline, todoOf } from '../stepwin'
import { TouchupsList } from '../touchups'
import { TileSchedule } from './scope-tab'
import { MoneyTab } from './money-tab'
import { POsTab } from './pos-tab'
import { SHEET, firstName } from './kit'
import { startProject } from '../flows'

const isDone = (v: StepView) => v.state === 'done' || v.state === 'na'

/* ================= Getting ready ================= */
/** the six parts as a row of chips; the page shows one part at a time — its steps, and the open step's form. */
export function ReadySection({ job, onInstall }: { job: Job; onInstall?: () => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const ready = isGettingReady(job)
  const pricing = ['request', 'estimating', 'proposal', 'followup'].includes(job.stage)
  const steps = ready ? stepsFor(s, job) : []
  const c = stepCounts(steps)
  const parts = PHASES.map((ph) => {
    const items = steps.filter((v) => v.phase === ph.key && v.state !== 'na')
    const done = items.filter(isDone).length
    const bad = items.find((v) => v.state === 'bad')
    const next = bad || items.find((v) => v.state === 'now') || items.find((v) => !isDone(v))
    return { ph, items, done, all: items.length > 0 && done === items.length, bad: !!bad, next }
  }).filter((p) => p.items.length)
  /* the part you're on — to begin with, the first one with something left (a problem first) */
  const firstPart = (parts.find((p) => p.bad) || parts.find((p) => !p.all) || parts[0])?.ph.key || null
  const [partKey, setPartKey] = React.useState<string | null>(firstPart)
  const part = parts.find((p) => p.ph.key === partKey) || parts[0]
  /* the step that's open — to begin with, the part's next one */
  const [open, setOpen] = React.useState<string | null>(part?.next?.key || null)
  const pick = (k: string) => { setPartKey(k); const p = parts.find((x) => x.ph.key === k); setOpen(p?.next?.key || null) }
  if (!ready) {
    return (
      <div className={cn(SHEET, 'px-6 py-10 text-center')}>
        <div className="text-[1rem] font-semibold text-ink">{pricing ? 'It starts once the estimate is won' : 'Done — the crew started'}</div>
        <div className="mt-1 text-[0.875rem] text-muted">{pricing ? 'Paperwork, the design meeting, the site, the installer, deliveries and the deposit — all of it, in order, once there’s a project.' : `Everything was ready before ${job.name} started. Tap Installing on top.`}</div>
      </div>
    )
  }
  if (!part) return null
  const tiles = tilesOf(job.id)
  const rooms = s.rooms[job.id] || []
  return (
    <div className="flex flex-col gap-3">
      {/* the six parts, one row — the one you're on is filled; red means a problem; a check means done */}
      <div role="tablist" aria-label="The parts of getting ready" className="no-scrollbar flex gap-1.5 overflow-x-auto px-0.5 pb-0.5">
        {parts.map(({ ph, items, done, all, bad }) => {
          const on = ph.key === part.ph.key
          return (
            <button
              key={ph.key}
              role="tab"
              aria-selected={on}
              data-part={ph.key}
              onClick={() => pick(ph.key)}
              className={cn('inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[0.84375rem] font-semibold transition',
                on ? (bad ? 'border-bad-600 bg-bad-600 text-white' : all ? 'border-[#22372b] bg-[#22372b] text-white' : 'border-brand-600 bg-brand-600 text-white')
                  : bad ? 'border-bad-200 bg-bad-50 text-bad-700 hover:bg-bad-100' : all ? 'border-line bg-white text-[#2c4a3e] hover:bg-wash' : 'border-line bg-white text-ink-2 hover:bg-wash')}
            >
              {all ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : bad ? <span className="text-[0.75rem] font-bold">!</span> : <span className={cn('text-[0.75rem] tnum', on ? 'text-white/80' : 'text-muted')}>{done}/{items.length}</span>}
              <span className="whitespace-nowrap">{ph.label}</span>
            </button>
          )
        })}
        {c.done === c.total && ['ready', 'scheduled'].includes(job.stage) && <Button size="sm" variant="primary" className="ml-auto shrink-0" icon={<Play />} onClick={() => startProject(job.id)}>Start the job</Button>}
      </div>
      {/* this part: its steps; the open one shows its form right there */}
      <section data-part-body={part.ph.key} className={cn(SHEET, part.bad && 'border-bad-200')}>
        {part.items.map((v) => {
          const on = open === v.key
          const late = v.due && v.due < TODAY && (v.state === 'now' || v.state === 'bad')
          const who = v.owner === me ? 'You' : firstName(v.owner) || PEOPLE[v.owner]?.short
          return (
            <div key={v.key} data-step={v.key} className={cn('border-t border-line-2 first:border-t-0', on && 'bg-[#fcfbf8]')}>
              <button onClick={() => setOpen(v.key)} aria-expanded={on} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[#f8f6f2] max-sm:px-4">
                <StepIcon state={v.state} size={24} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[0.9375rem] font-semibold', isDone(v) ? 'text-ink-2' : 'text-ink')}>{isDone(v) ? v.label : todoOf(v)}</span>
                  {v.note && <span className={cn('block truncate text-[0.78125rem]', v.state === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>{v.note}</span>}
                </span>
                {!isDone(v) && <span className={cn('shrink-0 text-[0.8125rem]', v.owner === me ? 'font-semibold text-ink' : 'text-ink-2')}>{who}</span>}
                {v.due && !isDone(v) && <span className={cn('w-[4.5rem] shrink-0 text-right text-[0.8125rem] tnum max-sm:hidden', late ? 'font-semibold text-bad-600' : 'text-muted')}>{labelFromIso(v.due)}</span>}
                {isDone(v) && <span className="shrink-0 text-[0.8125rem] font-semibold text-[#2c4a3e]">Done</span>}
                {on ? <ChevronDown className="h-4 w-4 shrink-0 text-faint" /> : <ChevronRight className="h-4 w-4 shrink-0 text-faint" />}
              </button>
              {on && (
                <div className="border-t border-line-2 px-5 pb-5 pt-4 max-sm:px-4">
                  <StepInline job={job} v={v} onClose={() => setOpen(null)} />
                </div>
              )}
            </div>
          )
        })}
      </section>
      {/* the tiles and grouts, with the paperwork — what we're putting in */}
      {part.ph.key === 'paper' && (tiles.length > 0 || rooms.length > 0) && <TileSchedule job={job} />}
      {/* the orders, with the deliveries */}
      {part.ph.key === 'deliver' && s.role !== 'site' && (
        <details className="group px-1">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
            <Package className="h-4 w-4" />All the orders<ChevronRight className="h-4 w-4 transition group-open:rotate-90" />
          </summary>
          <div className="mt-3"><POsTab job={job} onScope={() => onInstall?.()} /></div>
        </details>
      )}
    </div>
  )
}

/* ================= Installing ================= */
/** one short list: each room and how far it is. Tap a room for its walls and floors. The daily update is the button. */
export function InstallSection({ job }: { job: Job }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const inField = ['installation', 'punch', 'closeout', 'complete'].includes(job.stage)
  const b = s.bookings.find((x) => x.jobId === job.id)
  const crew = (job.crew || b?.crew) as PersonKey | undefined
  const start = job.dates?.start || (b ? labelFromIso(b.start) : s.prep[job.id]?.targetISO ? labelFromIso(s.prep[job.id]!.targetISO!) : undefined)
  const lock = scopeLock(s, job.id)
  const last = (s.diary[job.id] || [])[0]
  const pct = (r: Room) => roomPct(r)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[0.8125rem] text-ink-2">
        {inField
          ? <><span><b className="font-semibold tnum text-ink">{job.pct ?? 0}%</b> installed</span>{crew && <span>{PEOPLE[crew]?.short}’s crew{b ? ` · ${labelFromIso(b.start)} – ${labelFromIso(b.end)}` : ''}</span>}{last && <span className="text-muted">Last update {last.date}</span>}</>
          : <span>{start ? <>Starts <b className="font-semibold text-ink">{start}</b></> : 'No start date yet — it’s set when the installer is booked.'}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2 max-md:ml-0">
          {lock.canEdit && rooms.length > 0 && <AddRoomButton jobId={job.id} have={rooms.map((r) => r.name)} />}
        </span>
      </div>
      {rooms.length ? (
        <section className={cn(SHEET, 'grid md:grid-cols-2')}>
          {rooms.map((r, i) => {
            const p = pct(r)
            const waiting = r.surfaces.filter((x) => ['blocked', 'waitmat', 'hold'].includes(x.state)).length
            return (
              <button key={r.name} onClick={() => s.open({ t: 'room', jobId: job.id, room: r.name })} aria-label={`${r.name} — ${p}% installed`} className={cn('flex w-full items-center gap-4 border-t border-line-2 px-5 py-3 text-left transition hover:bg-[#f8f6f2] max-sm:px-4', i === 0 && 'border-t-0', i === 1 && 'md:border-t-0', i % 2 === 1 && 'md:border-l md:border-l-line-2')}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold text-ink">{r.name}</span>
                  <span className={cn('block truncate text-[0.78125rem]', waiting ? 'font-medium text-warn-700' : 'text-muted')}>{waiting ? `${waiting} waiting` : `${r.surfaces.length} ${r.surfaces.length === 1 ? 'wall or floor' : 'walls and floors'}`}</span>
                </span>
                <span className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-[#ece8e1] max-sm:w-16" aria-hidden>
                  <span className={cn('block h-full rounded-full', p >= 100 ? 'bg-[#2c4a3e]' : 'bg-brand-600')} style={{ width: `${Math.max(p ? 3 : 0, Math.min(100, p))}%` }} />
                </span>
                <span className={cn('w-10 shrink-0 text-right text-[0.9375rem] font-semibold tnum', p >= 100 ? 'text-[#2c4a3e]' : 'text-ink')}>{p}%</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
              </button>
            )
          })}
        </section>
      ) : (
        <div className={cn(SHEET, 'px-6 py-10 text-center')}>
          <div className="text-[1rem] font-semibold text-ink">No rooms yet</div>
          <div className="mt-1 text-[0.875rem] text-muted">They come over from the approved estimate, or get built from the tile paperwork.</div>
          <Button className="mt-4" variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'buildrooms', jobId: job.id })}>Build rooms</Button>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[0.8125rem]">
        {rooms.some((r) => r.surfaces.some((x) => x.tile)) && <button onClick={() => s.open({ t: 'layouts', jobId: job.id })} className="font-semibold text-brand-700 hover:underline">Layouts</button>}
        <button onClick={() => s.open({ t: 'scopewin', jobId: job.id })} className="font-semibold text-brand-700 hover:underline">Every wall and floor</button>
        {(inField || s.ipos.some((p) => p.jobId === job.id)) && s.role !== 'site' && <button onClick={() => s.open({ t: 'installerwin', jobId: job.id })} className="font-semibold text-brand-700 hover:underline">The installer — his PO and updates</button>}
      </div>
    </div>
  )
}

/* ================= Touch-ups ================= */
export function PunchSection({ job }: { job: Job }) {
  const s = useStore()
  const items = s.punch.filter((p) => p.jobId === job.id)
  const canAdd = !['accounting', 'client'].includes(s.role)
  return (
    <div className={cn(SHEET, 'p-4 max-sm:p-3')}>
      {items.length > 0 && canAdd && <div className="mb-3 flex justify-end"><Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'punchnew', jobId: job.id })}>Add touch-ups</Button></div>}
      <TouchupsList job={job} />
    </div>
  )
}

/* ================= Billed and paid ================= */
export function MoneySection({ job }: { job: Job }) {
  return <MoneyTab job={job} />
}

/** a small green check-list word for done things — used where a plain "done" wasn't clear enough */
export const DoneWord = () => <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-[#2c4a3e]"><Check className="h-3.5 w-3.5" strokeWidth={3} />Done</span>
