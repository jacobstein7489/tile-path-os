/* A project's progress, in one tab: the daily updates day by day — Today, Yesterday, the days before — and beside them
 * how far it is: the whole job, then each room (tap one: its walls and floors). Each update: who was there, what moved
 * in each room ("Floor 40% → 60%"), the note, anything flagged, the photos (tap one: big). The same look as every list:
 * white boxes, gray bands, a line between every two. On a computer side by side (nothing to scroll down to for how far
 * it is); on a phone how far first, then the days. */
import * as React from 'react'
import { ClipboardList, ChevronRight, TriangleAlert } from 'lucide-react'
import { useStore, NOW } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { BAND_GREEN as BAND, BAND_GREEN_LABEL as BAND_LABEL, BandCount, PX } from '@/tileos/components/ui/page'
import { Bar } from '@/tileos/components/ui/progress'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job } from '@/tileos/data/model'
import { roomPct } from '@/tileos/data/jobs'
import type { DiaryEntry } from '@/tileos/data/field'
import { TODAY, addDays, md } from '@/tileos/lib/today'
import { MediaTile } from '../field'
import { IN_FIELD_STAGES } from '../steps'
import type { BoardView } from './board'

const BOX = 'overflow-hidden rounded-[1rem] border border-[#ebe6dd] bg-white shadow-card'
/** the photos shown on an update's line before "+N" */
const PICS = 6

/** the Progress tab shows once a project is on site, or has an update */
export const hasProgress = (s: { diary: Record<string, DiaryEntry[] | undefined> }, job: Job) => IN_FIELD_STAGES.includes(job.stage) || !!s.diary[job.id]?.length

export function ProgressTab({ job, open }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const rooms = (s.rooms[job.id] || []).filter((r) => r.surfaces.length)
  const diary = s.diary[job.id] || []
  const all = rooms.flatMap((r) => r.surfaces)
  const done = all.filter((x) => x.state === 'done').length
  const pct = job.pct ?? 0
  const inField = IN_FIELD_STAGES.includes(job.stage)
  const sends = inField && ['owner', 'pm', 'office', 'site', 'crew'].includes(s.role)
  /* the days: Today, Yesterday, then "Mon, Nov 23" — newest first, two updates on one day under one band */
  const yest = md(addDays(TODAY, -1))
  const dayOf = (e: DiaryEntry) => (e.date === NOW || e.date === md(TODAY) ? 'Today' : e.date === yest ? 'Yesterday' : e.day || e.date)
  const days: { label: string; entries: DiaryEntry[] }[] = []
  diary.forEach((e) => { const l = dayOf(e); const g = days.find((x) => x.label === l); if (g) g.entries.push(e); else days.push({ label: l, entries: [e] }) })
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]" data-progress-tab>
      {/* how far: the whole job, then each room — beside the days on a computer, first on a phone */}
      <section className={cn(BOX, 'lg:sticky lg:top-0 lg:order-2')} data-progress-rooms>
        <div className={cn('py-4', PX)}>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.02em] tnum text-ink" data-progress-pct>{pct}%</span>
            <span className="text-[0.9375rem] font-medium text-ink-2">installed</span>
            {pct < 100 && <span className="ml-auto text-[0.8125rem] text-muted tnum">{100 - pct}% to go</span>}
          </div>
          <Bar pct={pct} h={8} tone={pct >= 100 ? 'ok' : 'info'} className="mt-3" />
          <div className="mt-2 text-[0.8125rem] text-muted tnum">{all.length ? `${done} of ${all.length} walls and floors done` : 'No rooms on this project yet. The updates say what got done.'}</div>
        </div>
        {rooms.length > 0 && (
          <>
            <div className={cn(BAND, PX)} data-band><span className={BAND_LABEL}>Rooms</span><BandCount n={rooms.length} green /></div>
            {rooms.map((r) => {
              const p = roomPct(r)
              const d = r.surfaces.filter((x) => x.state === 'done').length
              return (
                <button key={r.name} type="button" onClick={() => open({ t: 'room', name: r.name })} className={cn('block w-full border-t border-line-2 py-2.5 text-left transition row-hover', PX)} data-progress-room={r.name}>
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="min-w-0 flex-1 break-words text-[0.9375rem] text-ink">{r.name}</span>
                    <span className="shrink-0 text-[0.75rem] text-muted tnum">{d} of {r.surfaces.length}</span>
                    <span className={cn('w-[2.75rem] shrink-0 text-right text-[0.875rem] font-semibold tnum', p >= 100 ? 'text-ok-700' : 'text-ink-2')}>{p}%</span>
                    <ChevronRight className="h-4 w-4 shrink-0 self-center text-faint" />
                  </span>
                  <Bar pct={p} h={5} tone={p >= 100 ? 'ok' : 'info'} className="mt-1.5" />
                </button>
              )
            })}
          </>
        )}
      </section>

      {/* the daily updates, day by day */}
      <section className={cn(BOX, 'lg:order-1')} data-progress-days>
        <header className={cn('flex min-h-[3.25rem] items-center gap-3 py-2', PX)}>
          <h3 className="text-[1rem] font-semibold text-ink">Daily updates</h3>
          <span className="text-[0.875rem] font-medium tnum text-faint">{diary.length || ''}</span>
          {sends && <Button size="sm" icon={<ClipboardList />} onClick={() => s.open({ t: 'daily', jobId: job.id })} className="ml-auto" data-progress-send>Daily update</Button>}
        </header>
        {days.map((g) => (
          <div key={g.label} data-progress-day={g.label}>
            <div className={cn(BAND, PX)} data-band><span className={BAND_LABEL}>{g.label}</span>{g.entries.length > 1 && <BandCount n={g.entries.length} green />}</div>
            {g.entries.map((e) => <Update key={e.id} e={e} day={g.label} />)}
          </div>
        ))}
        {!diary.length && <div className={cn('border-t border-line-2 py-5 text-[0.875rem] text-muted', PX)}>{inField ? 'No daily update yet. Each one shows here, by day: what moved in each room, the note and the photos.' : 'They start the first day on site.'}</div>}
      </section>
    </div>
  )
}

/** one daily update: who was there, what moved in each room, the note, what was flagged, the photos */
function Update({ e, day }: { e: DiaryEntry; day: string }) {
  const s = useStore()
  const media = e.rooms.flatMap((r) => (r.media || []).map((m) => ({ ...m, room: r.room, day: e.day, who: e.who })))
  const moved = e.rooms.filter((r) => r.items.length || r.note)
  const who = PEOPLE[e.who]
  return (
    <div className={cn('border-t border-line-2 py-3', PX)} data-progress-update={e.id}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Avatar who={e.who} size={22} />
        <span className="text-[0.9375rem] font-semibold text-ink">{who?.name || 'The crew'}</span>
        {e.workers && e.workers > 1 ? <span className="text-[0.8125rem] text-muted">· {e.workers} people</span> : null}
        {e.gc && <span className="ml-auto text-[0.8125rem] text-muted">Sent to the GC</span>}
      </div>
      {/* each room: what moved ("Floor 40% → 60%, Walls → done") */}
      {moved.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {moved.map((r) => (
            <div key={r.room} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 text-[0.84375rem] leading-snug max-sm:grid-cols-1" data-progress-moved={r.room}>
              <span className="min-w-0 break-words font-medium text-ink-2">{r.room}</span>
              <span className="min-w-0 break-words text-ink-2">
                {r.items.map((it, i) => (
                  <span key={it.surface}>{i > 0 && <span className="text-faint"> · </span>}{it.surface} <span className={cn('tnum', it.to >= 100 ? 'font-medium text-ok-700' : 'text-brand-700')}>{it.to >= 100 ? (it.from > 0 ? `${it.from}% → done` : 'done') : `${it.from}% → ${it.to}%`}</span></span>
                ))}
                {r.note && <span className="block text-muted">{r.note}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {!moved.length && !media.length && !e.note && <div className="mt-1.5 text-[0.84375rem] text-muted">The crew was there. Nothing marked.</div>}
      {e.note && <p className="mt-2 text-[0.84375rem] leading-relaxed text-ink-2">{e.note}</p>}
      {(e.issues || []).length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5">
          {e.issues!.map((x) => <span key={x} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-bad-600"><TriangleAlert className="h-3.5 w-3.5 shrink-0" />{x}</span>)}
        </div>
      )}
      {(e.tomorrow || []).length > 0 && <div className="mt-1.5 text-[0.8125rem] text-muted">Next: {e.tomorrow!.join(', ')}</div>}
      {media.length > 0 && (
        <div className="mt-2.5 grid grid-cols-[repeat(6,minmax(0,5.5rem))] gap-2 max-sm:grid-cols-4" data-progress-photos>
          {media.slice(0, PICS).map((m, i) => (
            <span key={m.id} className="relative block">
              <MediaTile m={m} onClick={() => s.open({ t: 'media', items: media, index: i })} />
              {i === PICS - 1 && media.length > PICS && <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-[rgba(13,22,40,.55)] text-[0.9375rem] font-semibold text-white">+{media.length - PICS}</span>}
            </span>
          ))}
        </div>
      )}
      <span className="sr-only">{day}</span>
    </div>
  )
}
