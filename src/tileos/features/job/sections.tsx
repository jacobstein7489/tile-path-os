/* The four sections of a project — the four steps on top are the only navigation:
 *   Getting ready   — the whole flow, in order, on one page: tile paperwork, design meeting, site, installer,
 *                     deliveries, deposit. Every step opens right there in the list, not in another window.
 *   Installing      — the rooms and how far each is, the crew's daily updates, the installer's PO and days.
 *   Touch-ups       — one list per project, line by line, each with its photos.
 *   Billed and paid — the money.
 * The same pieces (job/kit) everywhere: sheets, rows, people, dates. */
import * as React from 'react'
import { ChevronDown, ChevronRight, Check, Plus, LayoutGrid, FileText, Play, Package } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job } from '@/tileos/data/model'
import { tilesOf } from '@/tileos/data/jobs'
import { TODAY, labelFromIso } from '@/tileos/lib/today'
import { isGettingReady, stepsFor, stepCounts, PHASES, scopeLock, type StepView } from '../steps'
import { AddRoomButton } from '../roomedit'
import { StepIcon } from '../steps-ui'
import { StepInline, todoOf } from '../stepwin'
import { TouchupsList } from '../touchups'
import { TileSchedule, ScopeSheet, ScopeNumbers } from './scope-tab'
import { InstallerTab } from './crew-tab'
import { MoneyTab } from './money-tab'
import { POsTab } from './pos-tab'
import { SHEET, firstName } from './kit'
import { startProject } from '../flows'

const isDone = (v: StepView) => v.state === 'done' || v.state === 'na'

/* ================= Getting ready ================= */
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
  /* what's open on the page: the step you tapped — to begin with, the one that's up now */
  const first = parts.find((p) => !p.all)?.next?.key || null
  const [open, setOpen] = React.useState<string | null>(first)
  /* parts that are all done fold to one line; tap to see their steps */
  const [unfolded, setUnfolded] = React.useState<Record<string, boolean>>({})
  if (!ready) {
    return (
      <div className={cn(SHEET, 'px-6 py-10 text-center')}>
        <div className="text-[1rem] font-semibold text-ink">{pricing ? 'It starts once the estimate is won' : 'Done — the crew started'}</div>
        <div className="mt-1 text-[0.875rem] text-muted">{pricing ? 'Paperwork, the design meeting, the site, the installer, deliveries and the deposit — all of it, in order, once there’s a project.' : `Everything was ready before ${job.name} started. Tap Installing on top.`}</div>
      </div>
    )
  }
  const tiles = tilesOf(job.id)
  return (
    <div className="flex flex-col gap-3">
      {/* one line: how far, and what's wrong */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[0.8125rem] text-ink-2">
        <span><b className="font-semibold tnum text-ink">{c.done} of {c.total}</b> done</span>
        {c.bad > 0 && <span className="font-semibold text-bad-600">{c.bad} {c.bad === 1 ? 'problem' : 'problems'}</span>}
        {c.done === c.total && <span className="font-semibold text-[#2c4a3e]">Ready to start</span>}
        {c.done === c.total && ['ready', 'scheduled'].includes(job.stage) && <Button size="sm" variant="primary" className="ml-auto" icon={<Play />} onClick={() => startProject(job.id)}>Start the job</Button>}
      </div>
      {parts.map(({ ph, items, done, all, bad, next }) => {
        const folded = all && !unfolded[ph.key]
        return (
          <section key={ph.key} data-part={ph.key} className={cn(SHEET, bad && 'border-bad-200')}>
            <h3>
              <button
                onClick={() => { if (all) setUnfolded((u) => ({ ...u, [ph.key]: !u[ph.key] })) }}
                aria-label={`${ph.label} — ${all ? 'done' : bad ? 'problem' : `${done} of ${items.length} done`}`}
                className={cn('flex min-h-[3rem] w-full items-center gap-3 px-5 text-left max-sm:px-4', all && 'transition hover:bg-[#f8f6f2]', !all && 'cursor-default')}
              >
                <span className="min-w-0 flex-1 truncate text-[1rem] font-semibold text-ink">{ph.label}</span>
                <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-[#ece8e1] max-sm:w-12" aria-hidden>
                  <span className={cn('block h-full rounded-full', all ? 'bg-[#2c4a3e]' : bad ? 'bg-bad-500' : 'bg-brand-600')} style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
                </span>
                <span className={cn('shrink-0 text-[0.8125rem] tnum', all ? 'font-semibold text-[#2c4a3e]' : bad ? 'font-semibold text-bad-600' : 'text-ink-2')}>{all ? 'Done' : bad ? 'Problem' : `${done} of ${items.length}`}</span>
                {all && (folded ? <ChevronRight className="h-4 w-4 shrink-0 text-faint" /> : <ChevronDown className="h-4 w-4 shrink-0 text-faint" />)}
              </button>
            </h3>
            {!folded && items.map((v) => {
              const on = open === v.key
              const late = v.due && v.due < TODAY && (v.state === 'now' || v.state === 'bad')
              const who = v.owner === me ? 'You' : firstName(v.owner) || PEOPLE[v.owner]?.short
              return (
                <div key={v.key} data-step={v.key} className={cn('border-t border-line-2', on && 'bg-[#fcfbf8]')}>
                  <button onClick={() => setOpen(on ? null : v.key)} aria-expanded={on} className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-[#f8f6f2] max-sm:px-4">
                    <StepIcon state={v.state} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[0.90625rem] font-semibold', isDone(v) ? 'text-ink-2' : 'text-ink')}>{isDone(v) ? v.label : todoOf(v)}</span>
                      {!on && v.note && <span className={cn('block truncate text-[0.78125rem]', v.state === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>{v.note}</span>}
                    </span>
                    {!isDone(v) && <span className={cn('shrink-0 text-[0.8125rem]', v.owner === me ? 'font-semibold text-ink' : 'text-ink-2')}>{who}</span>}
                    {v.due && !isDone(v) && <span className={cn('w-[4.5rem] shrink-0 text-right text-[0.8125rem] tnum max-sm:hidden', late ? 'font-semibold text-bad-600' : 'text-muted')}>{labelFromIso(v.due)}</span>}
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
            {/* the tiles and grouts, right under the paperwork — what we're putting in, at a glance */}
            {ph.key === 'paper' && (tiles.length > 0 || (s.rooms[job.id] || []).length > 0) && (
              <div className="border-t border-line-2 p-3 max-sm:p-2">
                <TileSchedule job={job} />
              </div>
            )}
          </section>
        )
      })}
      {/* every order in one place — the installer's PO, the tile, the materials — for whoever wants the full picture */}
      <details className="group px-1">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
          <Package className="h-4 w-4" />All the orders<ChevronRight className="h-4 w-4 transition group-open:rotate-90" />
        </summary>
        <div className="mt-3"><POsTab job={job} onScope={() => onInstall?.()} /></div>
      </details>
    </div>
  )
}

/* ================= Installing ================= */
export function InstallSection({ job }: { job: Job }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const inField = ['installation', 'punch', 'closeout', 'complete'].includes(job.stage)
  const b = s.bookings.find((x) => x.jobId === job.id)
  const start = job.dates?.start || (b ? labelFromIso(b.start) : s.prep[job.id]?.targetISO ? labelFromIso(s.prep[job.id]!.targetISO!) : undefined)
  const lock = scopeLock(s, job.id)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        {inField
          ? <ScopeNumbers job={job} />
          : <span className="text-[0.8125rem] text-ink-2">{start ? <>Starts <b className="font-semibold text-ink">{start}</b> — the rooms and what goes in each, as they’ll be installed.</> : 'No start date yet — it’s set when the installer is booked.'}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2 max-md:ml-0">
          {lock.canEdit && rooms.length > 0 && <AddRoomButton jobId={job.id} have={rooms.map((r) => r.name)} />}
          {rooms.some((r) => r.surfaces.some((x) => x.tile)) && <Button size="sm" icon={<LayoutGrid />} onClick={() => s.open({ t: 'layouts', jobId: job.id })}>Layouts</Button>}
          <Button size="sm" icon={<FileText />} onClick={() => s.open({ t: 'sow', jobId: job.id })}>Print the scope of work</Button>
        </span>
      </div>
      {rooms.length ? <ScopeSheet job={job} /> : (
        <div className={cn(SHEET, 'px-6 py-10 text-center')}>
          <div className="text-[1rem] font-semibold text-ink">No rooms yet</div>
          <div className="mt-1 text-[0.875rem] text-muted">They come over from the approved estimate, or get built from the tile paperwork.</div>
          <Button className="mt-4" variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'buildrooms', jobId: job.id })}>Build rooms</Button>
        </div>
      )}
      {(inField || s.ipos.some((p) => p.jobId === job.id) || s.bookings.some((x) => x.jobId === job.id)) && <InstallerTab job={job} />}
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
