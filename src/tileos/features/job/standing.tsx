/* Where the project stands — the first tab, one column, calm:
 *   once getting ready is done: what's next on top (start the job, schedule the crew, the return visit, the final
 *     invoice);
 *   To do: everything left on the project, one line each — what · whose · when (job/whatsleft). A problem first, in
 *     red. Tap a line: that one thing in its own window — done there, it closes by itself;
 *   then the stage, once getting ready is done — the crew, the installing room by room, the touch-ups.
 * Where it's up to in a word — the stage, the one date that matters — is on top of the project, on every tab. */
import * as React from 'react'
import { ChevronRight, Plus, HardHat, CalendarDays, Receipt } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { labelFromIso } from '@/tileos/lib/today'
import { StepModal } from '../stepwin'
import { NextUp } from './next'
import { installerOf } from '../upcoming'
import { TouchupsList } from '../touchups'
import { firstName } from './kit'
import { tracksFor, phaseOf, moneyLine, bookingOf, roomsOf, type TrackKey, type Phase } from '../tracks'
import { WhatsLeft } from './whatsleft'
import type { BoardView } from './board'

/** a step a link or "Your turn" asked for — its window opens */
export type OpenTrack = { track: TrackKey; step: string } | null

/* ================= where it stands ================= */
export function Stands({ job, open, setOpen, onStep, setView }: {
  job: Job
  /** a step a link or "Your turn" asked for — its window opens */
  open: OpenTrack
  setOpen: (o: OpenTrack) => void
  /** what's next's button: open its step */
  onStep: (k: string) => void
  /** a room, from the installing */
  setView: (v: BoardView) => void
}) {
  const s = useStore()
  const tracks = tracksFor(s, job)
  const phase = phaseOf(s, job, tracks)
  /* a step opens in its own window — never inside the list */
  const pick = (k: string) => s.open({ t: 'step', jobId: job.id, k })
  React.useEffect(() => {
    if (!open) return
    setOpen(null)
    pick(open.step)
  }, [open])
  const booked = job.stage === 'scheduled' || !!bookingOf(s, job)
  return (
    <div data-phase={phase} className="flex min-w-0 flex-col gap-4">
      {(phase !== 'ready' || booked) && <NextUp job={job} onStep={pick} />}
      <WhatsLeft job={job} />
      {phase !== 'ready' && <Stage job={job} phase={phase} setView={setView} />}
    </div>
  )
}

/** a part of getting ready, opened from a link: the one step it's on, in its own window — the same window as a step */
export function PartModal({ jobId, track, step, level }: { jobId: string; track: TrackKey; step?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const t = job ? tracksFor(s, job).find((x) => x.key === track) : undefined
  const k = step || t?.lead?.key || [...(t?.steps || [])].reverse().find((v) => v.state === 'done')?.key || t?.steps[0]?.key
  if (!job || !k) return null
  return <StepModal jobId={jobId} k={k} level={level} />
}

/** the stage the project is at: the crew, the installing, the touch-ups */
function Stage({ job, phase, setView }: { job: Job; phase: Phase; setView: (v: BoardView) => void }) {
  const s = useStore()
  const punch = s.punch.some((p) => p.jobId === job.id && p.status !== 'verified')
  return (
    <>
      {phase === 'crew' && <CrewCard job={job} />}
      {phase === 'install' && <Installing job={job} setView={setView} />}
      {(phase === 'punch' || punch) && <TouchupsCard job={job} />}
    </>
  )
}

/* ---------------- the crew: who, his PO, the days ---------------- */
function CrewCard({ job }: { job: Job }) {
  const s = useStore()
  const crew = (installerOf(s, job) || job.crew) as PersonKey | undefined
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const b = bookingOf(s, job)
  const booked = job.stage === 'scheduled' || !!b
  const dep = moneyLine(s, job).dep
  const money = !['site', 'crew', 'client'].includes(s.role)
  return (
    <section data-crew className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-center gap-2 border-b border-line-2 px-5 py-3">
        <h3 className="text-[1rem] font-semibold text-ink">Crew</h3>
        <span className={cn('text-[0.8125rem]', booked ? 'font-medium text-[#2c8a5b]' : 'text-muted')}>{booked ? 'Scheduled' : 'Getting ready is done — pick the days'}</span>
      </header>
      <div className="flex flex-col gap-2.5 px-5 py-3.5 text-[0.875rem]">
        <button onClick={() => (ipo ? s.open({ t: 'ipo', id: ipo.id }) : s.open({ t: 'installerwin', jobId: job.id }))} className="flex min-w-0 items-center gap-3 text-left">
          {crew ? <Avatar who={crew} size={32} /> : <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wash-2 text-faint"><HardHat className="h-4 w-4" /></span>}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-semibold text-ink">{crew ? PEOPLE[crew]?.name : 'No installer yet'}</span>
            <span className="block truncate text-[0.78125rem] text-muted">{ipo ? `${ipo.id} · ${ipo.status === 'Accepted' ? `accepted${ipo.date ? ` ${ipo.date}` : ''}` : ipo.status.toLowerCase()}` : 'No PO yet'}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
        </button>
        <div className="flex items-center gap-3 text-ink-2">
          <span className="inline-flex w-8 justify-center"><CalendarDays className="h-4 w-4 text-faint" /></span>
          {b ? <span><b className="font-semibold text-ink">{labelFromIso(b.start)} – {labelFromIso(b.end)}</b>{b.workers ? ` · ${b.workers} workers` : ''}{b.status === 'pending' ? <span className="text-warn-700"> · waiting for his OK</span> : null}</span> : <span className="text-muted">No days on the calendar yet</span>}
        </div>
        {money && dep && dep.tone === 'warn' && (
          <div className="flex items-center gap-3 text-warn-700">
            <span className="inline-flex w-8 justify-center"><Receipt className="h-4 w-4" /></span>
            <span className="font-medium">{dep.text.replace(/^./, (c) => c.toUpperCase())} — a warning, not a stop</span>
          </div>
        )}
      </div>
    </section>
  )
}

/* ---------------- installing: how far, who, the days — and each room ---------------- */
function Installing({ job }: { job: Job; setView?: (v: BoardView) => void }) {
  const s = useStore()
  const rooms = roomsOf(s, job)
  const crew = (installerOf(s, job) || job.crew) as PersonKey | undefined
  const b = bookingOf(s, job)
  const dates = job.dates?.start ? `${job.dates.start} – ${job.dates.finish || '…'}` : b ? `${labelFromIso(b.start)} – ${labelFromIso(b.end)}` : ''
  const last = (s.diary[job.id] || [])[0]
  const stopped = rooms.filter((r) => r.state === 'stopped').length
  return (
    <section data-installing className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex min-h-[3.25rem] min-w-0 items-center gap-3 px-5 py-2 max-sm:px-4">
        <h3 className="text-[1.0625rem] font-semibold text-ink">Rooms</h3>
        <span className="text-[0.9375rem] font-medium tnum text-faint">{rooms.length}</span>
        {stopped > 0 && <span className="text-[0.875rem] font-semibold text-bad-600">{stopped} stopped</span>}
        <span className="ml-auto min-w-0 truncate text-[0.875rem] text-muted">{[crew ? PEOPLE[crew]?.name : 'No installer', dates].filter(Boolean).join(' · ')}</span>
      </header>
      {rooms.map((r) => (
        /* a room opens in its own window — its walls and floors, the daily log, photos — on top; close it, you're here */
        <button key={r.room.name} type="button" data-install-room={r.room.name} onClick={() => s.open({ t: 'room', jobId: job.id, room: r.room.name })} className="grid min-h-[2.75rem] w-full min-w-0 grid-cols-[minmax(0,1fr)_8rem_4rem] items-center gap-4 border-t border-line-2 px-5 py-1.5 text-left transition row-hover max-sm:grid-cols-[minmax(0,1fr)_4.5rem_3.5rem] max-sm:gap-3 max-sm:px-4">
          <span className="min-w-0 truncate text-[0.9375rem] font-medium text-ink">{r.room.name}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-[#ece8e1]" aria-hidden><span className={cn('block h-full rounded-full', r.state === 'stopped' ? 'bg-bad-500' : r.state === 'done' ? 'bg-[#2c8a5b]' : 'bg-brand-600')} style={{ width: `${r.pct}%` }} /></span>
          <span className={cn('text-right text-[0.875rem] tnum', r.state === 'stopped' ? 'font-semibold text-bad-600' : r.state === 'done' ? 'font-medium text-[#2c8a5b]' : 'text-ink-2')}>{r.state === 'done' ? 'Done' : r.state === 'stopped' ? 'Stopped' : `${r.pct}%`}</span>
        </button>
      ))}
      {!rooms.length && <div className="border-t border-line-2 px-5 py-3 text-[0.875rem] text-muted">No rooms on this project.</div>}
      <footer className="border-t border-line-2 px-5 py-2.5 text-[0.84375rem] text-muted max-sm:px-4">
        {last ? <>Last daily update <b className="font-semibold text-ink-2">{last.date}</b> · {last.who === meOf(s.role) ? 'you' : firstName(last.who)}</> : 'No daily update yet — it’s on the site manager’s Today every day'}
      </footer>
    </section>
  )
}

function TouchupsCard({ job }: { job: Job }) {
  const s = useStore()
  const canAdd = !['accounting', 'client', 'crew'].includes(s.role)
  return (
    <section data-touchups className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex min-h-12 items-center gap-2 px-5 max-sm:px-4">
        <h3 className="text-[0.9375rem] font-semibold text-ink">Touch-ups</h3>
        {canAdd && <button onClick={() => s.open({ t: 'punchnew', jobId: job.id })} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50"><Plus className="h-3.5 w-3.5" />Add</button>}
      </header>
      <TouchupsList job={job} />
    </section>
  )
}
