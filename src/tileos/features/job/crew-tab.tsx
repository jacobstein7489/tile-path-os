/* The Installer tab — who installs this project and everything about his part:
 *   who he is and his days on the calendar · his PO (lines, changes, where it stands)
 *   the daily updates from the site · the touch-ups, once there are any */
import * as React from 'react'
import { HardHat, CalendarDays, ClipboardList, ChevronRight, FileText, Camera, Users } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { Status } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey, type Tone } from '@/tileos/data/model'
import { md } from '@/tileos/lib/today'
import { installerOf } from '../upcoming'
import { CloseOverview } from './overview'
import { useSaveStatus } from '@/tileos/lib/save'
import { Section, Empty, Word, Strip } from './kit'
import { RatioBlock } from './ratio'
import { poRatio } from '../poratio'

const IPO_STATUS: Record<string, { tone: Tone; label: (who: string) => string }> = {
  Draft: { tone: 'vio', label: () => 'Draft — not sent' },
  Sent: { tone: 'warn', label: (who) => `Waiting for ${who} to accept` },
  Accepted: { tone: 'ok', label: () => 'Accepted' },
  Rejected: { tone: 'bad', label: () => 'Turned down' },
}

export function InstallerTab({ job }: { job: Job }) {
  const s = useStore()
  const save = useSaveStatus()
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const ipos = s.ipos.filter((p) => p.jobId === job.id)
  const ipo = [...ipos].reverse().find((p) => p.status !== 'Rejected') || ipos[ipos.length - 1]
  const bookings = s.bookings.filter((b) => b.jobId === job.id).sort((a, b) => a.start.localeCompare(b.start))
  const diary = s.diary[job.id] || []
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const showPunch = punch.length > 0 || ['installation', 'punch', 'closeout', 'complete'].includes(job.stage) || job.kind === 'repair'
  const inField = ['installation', 'punch', 'closeout', 'complete'].includes(job.stage)
  const total = ipo ? ipo.lines.reduce((n, l) => n + l.amount, 0) + ipo.changes.filter((c) => c.status !== 'pending').reduce((n, c) => n + c.amount, 0) : 0
  const sample = save.mode === 'sample' ? ' · sample amounts' : ''
  const r = ipo && ipo.status !== 'Rejected' ? poRatio(s, ipo) : undefined
  const days = bookings.length ? `${md(bookings[0].start)} – ${md(bookings[bookings.length - 1].end)}` : job.dates?.start ? `${job.dates.start} – ${job.dates.finish}` : '—'
  /* the site manager's version is simple: who, when, the daily updates, the touch-ups — no PO, no money, no booking */
  const simple = s.role === 'site'
  return (
    <div className="flex flex-col gap-4">
    <div className={cn('grid items-start gap-4 max-[68rem]:grid-cols-1', simple ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_21rem]')}>
      <div className="flex min-w-0 flex-col gap-4">
        {/* who */}
        <Section title={crew ? PEOPLE[crew].name : 'The installer'} right={crew && diary[0] ? `Last update ${diary[0].date}` : undefined}>
          {crew ? (
            <div className="flex flex-wrap items-center gap-4 px-5 py-3 max-sm:px-4">
              <Avatar who={crew} size={40} plain />
              <div className="min-w-0 flex-1">
                <div className="text-[1rem] font-semibold text-ink">{PEOPLE[crew].name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted">
                  {bookings.length ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{bookings.map((b) => `${md(b.start)} – ${md(b.end)}`).join(' · ')}</span> : job.dates?.start ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{job.dates.start} – {job.dates.finish}</span> : <span>No days on the calendar yet</span>}
                  {bookings[0]?.workers ? <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{bookings[0].workers} {bookings[0].workers === 1 ? 'person' : 'people'}</span> : null}
                </div>
              </div>
              {!simple && (
                <div className="flex shrink-0 gap-2 max-sm:w-full">
                  <Button size="sm" onClick={() => s.open({ t: 'sub', id: crew })}>His profile</Button>
                  <Button size="sm" icon={<CalendarDays />} onClick={() => s.open({ t: 'assign', jobId: job.id, crew })}>{bookings.length ? 'Change the days' : 'Put him on the calendar'}</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4 px-5 py-3.5 max-sm:px-4">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-wash-2 text-ink-2"><HardHat className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[1rem] font-semibold text-ink">No installer yet</div>
                <div className="text-[0.84375rem] text-muted">Pick who installs it — his PO goes out with his rates for every line on the scope.</div>
              </div>
              {!simple && <Button variant="primary" icon={<HardHat />} onClick={() => s.open({ t: 'book', jobId: job.id })}>Book an installer</Button>}
            </div>
          )}
        </Section>

        {/* daily updates */}
        <Section title="Daily updates" count={diary.length} action={inField ? <Button size="sm" icon={<ClipboardList />} onClick={() => s.open({ t: 'daily', jobId: job.id })}>Daily update</Button> : undefined}>
          {diary.slice(0, 8).map((e) => {
            const moved = e.rooms.flatMap((r) => r.items).filter((i) => i.to > i.from)
            const pics = e.rooms.reduce((n, r) => n + r.media.length, 0)
            const note = e.note || e.rooms.find((r) => r.note)?.note
            return (
              <button key={e.id} onClick={() => s.open({ t: 'room', jobId: job.id, room: e.rooms[0]?.room, view: 'log' })} className="flex min-h-[2.875rem] w-full items-center gap-3 border-t border-line-2 px-5 py-1.5 text-left transition first:border-t-0 row-hover max-sm:px-4">
                <span className="w-[3.5rem] shrink-0 text-[0.8125rem] font-semibold tnum text-ink-2">{e.date}</span>
                <Avatar who={e.who} size={22} plain />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.84375rem] font-medium text-ink">{moved.length ? `${moved.length} wall${moved.length === 1 ? '' : 's'} and floors moved` : 'No progress logged'} · {e.rooms.map((r) => r.room).join(', ')}</span>
                  {note && <span className="block truncate text-[0.78125rem] text-muted">{note}</span>}
                </span>
                {pics > 0 && <span className="inline-flex shrink-0 items-center gap-1 text-[0.78125rem] text-muted"><Camera className="h-3.5 w-3.5" />{pics}</span>}
                <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
              </button>
            )
          })}
          {!diary.length && <Empty>{inField ? 'No daily update yet today.' : 'They start the first day on site.'}</Empty>}
        </Section>

        {showPunch && <CloseOverview job={job} setTab={() => {}} simple={simple} />}
      </div>

      {/* his PO */}
      {!simple && <aside className="flex min-w-0 flex-col gap-4">
        <Section title="His PO" right={ipo ? IPO_STATUS[ipo.status].label(PEOPLE[ipo.crew].short) : undefined}>
          {ipo ? (
            <>
              <RatioBlock ipo={ipo} className="border-b border-line-2 px-5 py-3.5" />
              <div className="px-5 pb-1 pt-3 text-[0.78125rem] text-muted">{ipo.id} · {PEOPLE[ipo.crew].short} · {ipo.date}</div>
              {ipo.lines.map((l, i) => (
                <div key={i} className="flex items-baseline gap-3 px-5 py-1.5 text-[0.8125rem]">
                  <span className="min-w-0 flex-1 truncate text-ink-2">{l.item}</span>
                  <span className="shrink-0 tnum text-muted">{l.qty}</span>
                  <span className="w-[4.5rem] shrink-0 text-right font-semibold tnum text-ink">{fmtMoney(l.amount)}</span>
                </div>
              ))}
              {ipo.changes.map((c) => (
                <div key={c.co} className="flex items-baseline gap-3 px-5 py-1.5 text-[0.8125rem]">
                  <span className={cn('min-w-0 flex-1 truncate', c.status === 'pending' ? 'text-muted' : 'text-ink-2')}>{c.co} · {c.text}{c.status === 'pending' ? ' · waiting for a yes' : ''}</span>
                  <span className="w-[4.5rem] shrink-0 text-right font-semibold tnum text-ink">+{fmtMoney(c.amount)}</span>
                </div>
              ))}
              <div className="mt-1 flex items-baseline justify-between border-t border-line-2 px-5 py-2.5 text-[0.84375rem]">
                <span className="font-semibold text-ink">Total{sample}</span>
                <span className="font-bold tnum text-ink">{fmtMoney(total)}</span>
              </div>
              <button onClick={() => s.open({ t: 'ipo', id: ipo.id })} className="flex w-full items-center justify-between border-t border-line-2 px-5 py-2.5 text-[0.8125rem] font-semibold text-ink row-hover"><span className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4" />Open the PO</span><ChevronRight className="h-4 w-4" /></button>
            </>
          ) : (
            <Empty>{crew ? 'No PO yet — it’s made when you book him.' : 'Made when you book the installer — from the scope and his rates.'}</Empty>
          )}
        </Section>
      </aside>}
    </div>
    </div>
  )
}
