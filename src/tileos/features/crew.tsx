import * as React from 'react'
import { Ban, CheckCircle2, ChevronRight, PackageX, HelpCircle, ArrowLeftRight, Camera, ClipboardList, MapPin, Repeat, Signal, Wifi, BatteryFull, Sparkles, Hammer, Check, Wrench, CalendarClock } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore, meOf, type Store } from '@/tileos/store'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { TileImg } from '@/tileos/components/ui/swatch'
import { Logo } from '@/tileos/components/shell/shell'
import { cn } from '@/tileos/lib/utils'
import { GROUTS, tileOf } from '@/tileos/data/jobs'
import { shiftText, TODAY, dayShort, labelFromIso } from '@/tileos/lib/today'
import { setPunch } from './flows'
import { answerIPO } from './flows2'
import { tracksFor } from './tracks'

/* ---------------- coming up: his next jobs, before they're on his Today ---------------- */
/** where one of his next jobs is, in one line — so nobody has to call him to say "we're waiting for the tile":
 *  his start day once he's booked; else waiting for the tile (and the day it comes); else ready, the office books
 *  his days; else how far getting ready is */
export function comingWords(s: Store, job: Job, me: PersonKey): { text: string; tone: 'ok' | 'warn' | 'info' | 'muted' } {
  const b = s.bookings.find((x) => x.jobId === job.id && x.crew === me && x.start > TODAY && x.label !== 'Return visit')
  if (b) return { text: `You start ${dayShort(b.start)}`, tone: 'ok' }
  if (job.hold?.shortage) return { text: 'On hold — waiting for the tile', tone: 'warn' }
  const tracks = tracksFor(s, job)
  /* the tile isn't all here: the day it comes (or was due), or that some of it is still missing */
  const d = tracks.find((t) => t.key === 'tile')?.steps.find((v) => v.key === 'delivered')
  if (d && d.state !== 'done' && d.state !== 'na') {
    if (d.state === 'bad') return { text: 'Waiting for the rest of the tile', tone: 'warn' }
    if (d.due) return { text: d.due >= TODAY ? `Waiting for the tile — it comes ${labelFromIso(d.due).replace(/^(Today|Tomorrow)$/, (w) => w.toLowerCase())}` : `Waiting for the tile — it was due ${labelFromIso(d.due)}`, tone: 'warn' }
    return { text: 'Waiting for the tile — no delivery date yet', tone: 'warn' }
  }
  const open = tracks.filter((t) => t.state !== 'done').length
  if (!open) return { text: 'Ready — the office books your days', tone: 'info' }
  return { text: `Getting ready · ${tracks.length - open} of ${tracks.length} parts done`, tone: 'muted' }
}
const COMING_TONE = { ok: 'text-ok-700', warn: 'text-warn-700', info: 'text-brand-700', muted: 'text-muted' }
const COMING_DOT = { ok: 'bg-ok-500', warn: 'bg-warn-500', info: 'bg-brand-500', muted: 'bg-[#c9c2b6]' }
/** his next jobs: every one he has a PO on that isn't on today and isn't finished — a PO still waiting for his yes
 *  has the button for it */
function ComingUp({ me, today }: { me: PersonKey; today: string[] }) {
  const s = useStore()
  const latest = new Map<string, (typeof s.ipos)[number]>()
  s.ipos.forEach((p) => { if (p.crew === me) latest.set(p.jobId, p) })
  const list = [...latest.values()]
    .filter((p) => (p.status === 'Sent' || p.status === 'Accepted') && s.jobs[p.jobId] && !today.includes(p.jobId) && !['installation', 'punch', 'closeout', 'complete'].includes(s.jobs[p.jobId].stage))
    .map((p) => ({ p, job: s.jobs[p.jobId], w: comingWords(s, s.jobs[p.jobId], me) }))
  if (!list.length) return null
  return (
    <>
      <div className="mb-2 mt-5 flex items-center gap-2 px-1 text-[0.9375rem] font-bold text-ink"><CalendarClock className="h-4 w-4 text-brand-600" />Coming up<span className="text-[0.8125rem] font-semibold text-muted">{list.length}</span></div>
      <div className="flex flex-col gap-2" data-coming-up>
        {list.map(({ p, job, w }) => {
          const total = p.lines.reduce((a, l) => a + (l.amount || 0), 0)
          return (
            <div key={p.id} className="rounded-2xl bg-white p-3.5 shadow-card" data-coming={job.id} data-coming-tone={w.tone}>
              <div className="text-[0.90625rem] font-semibold text-ink">{job.name}</div>
              <div className="truncate text-[0.78125rem] text-muted">{p.id}{total ? ` · ${fmtMoney(total)}` : ''} · {p.status === 'Accepted' ? 'you said yes' : 'waiting for your yes'}</div>
              <div className={cn('mt-2 flex items-center gap-2 text-[0.84375rem] font-semibold', COMING_TONE[w.tone])} data-coming-words><span className={cn('h-2 w-2 shrink-0 rounded-full', COMING_DOT[w.tone])} />{w.text}</div>
              {p.status === 'Sent' && <Button full size="sm" variant="primary" className="mt-3" icon={<Check />} onClick={() => answerIPO(p.id, true, undefined, { fromCrew: true })} data-coming-yes>Yes, I’ll do it</Button>}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function CrewView() {
  const s = useStore()
  const me = meOf('crew')
  /* where he works today comes from the schedule — the job he's booked on */
  const booked = s.bookings.filter((b) => b.crew === me && b.status !== 'hold' && b.start <= TODAY && TODAY <= b.end && s.jobs[b.jobId])
  const nextUp = s.bookings.filter((b) => b.crew === me && b.start > TODAY && s.jobs[b.jobId]).sort((a, b) => a.start.localeCompare(b.start))[0]
  const [at, setAt] = React.useState(0)
  const booking = booked[Math.min(at, booked.length - 1)]
  const jobId = booking?.jobId || ''
  const job = jobId ? s.jobs[jobId] : undefined
  const rooms = (jobId && s.rooms[jobId]) || []
  const flat = rooms.flatMap((r) => r.surfaces.map((sf) => ({ room: r.name, sf })))
  const work = flat.filter((x) => x.sf.state === 'working').concat(flat.filter((x) => x.sf.state === 'ready').slice(0, 3))
  const stop = flat.filter((x) => ['blocked', 'hold', 'waitmat'].includes(x.sf.state))
  const changed = jobId === '119' ? [
    ...(rooms.find((r) => r.name === 'Boys Bath')?.surfaces.find((x) => x.name === 'Main walls')?.state === 'ready' ? [{ t: 'Boys bath walls → full height', d: 'CO-004 approved — go above 3 ft' }] : []),
    ...(rooms.find((r) => r.name === 'Master Bath')?.surfaces.find((x) => x.name === 'Shower floor')?.state === 'ready' ? [{ t: 'Master shower floor released', d: 'Tile first; the plumber sets the trim after' }] : []),
    { t: 'Powder accent wall: 48″', d: shiftText('CO-003 approved Sep 12') },
  ] : (s.hist[jobId] || []).filter((h) => h.kind === 'change' || h.kind === 'field').slice(0, 3).map((h) => ({ t: h.title, d: `${h.date}${h.detail ? ' · ' + h.detail : ''}` }))
  /* touch-ups on his name, on any project — done goes to the site manager to check */
  const touch = s.punch.filter((p) => p.owner === me && p.status !== 'verified')
  const touchJobs = Array.from(new Set(touch.map((p) => p.jobId)))
  return (
    <div className="flex min-h-screen items-center justify-center gap-14 bg-canvas px-10 py-10 max-lg:gap-6 max-lg:px-6 max-md:block max-md:p-0">
      {/* on a real phone the phone is the frame — the drawn bezel only shows on bigger screens */}
      <div className="w-[25rem] shrink-0 rounded-[3.25rem] bg-[#0D1628] p-3 shadow-modal max-md:w-full max-md:rounded-none max-md:bg-transparent max-md:p-0 max-md:shadow-none">
        <div className="relative h-[51.25rem] overflow-hidden rounded-[2.625rem] bg-canvas max-md:h-auto max-md:min-h-screen max-md:overflow-visible max-md:rounded-none">
          <div className="flex items-center justify-between px-7 pb-2 pt-4 text-[0.8125rem] font-semibold text-ink max-md:hidden">
            <span>7:12</span>
            <span className="absolute left-1/2 top-3 h-6 w-28 -translate-x-1/2 rounded-full bg-[#0D1628]" />
            <span className="flex items-center gap-1"><Signal className="h-3.5 w-3.5" /><Wifi className="h-3.5 w-3.5" /><BatteryFull className="h-4 w-4" /></span>
          </div>
          <div className="scroll-soft h-[calc(100%-2.25rem)] overflow-y-auto px-4 pb-40 max-md:h-auto max-md:overflow-visible max-md:pb-[calc(11rem+env(safe-area-inset-bottom,0))] max-md:pt-3">
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-3.5 py-2.5 md:hidden">
              <span className="min-w-0 flex-1 text-[0.8125rem] font-medium text-brand-800">Demo · what {PEOPLE[me].short} sees on his phone</span>
              <Button size="xs" variant="secondary" icon={<Repeat className="h-3.5 w-3.5" />} onClick={() => s.open({ t: 'roles' })}>Switch login</Button>
            </div>
            <div className="mt-2 flex items-center gap-2.5 px-1">
              <Logo size={26} />
              <span className="text-[0.9375rem] font-bold text-ink">Today</span>
              <span className="ml-auto text-[0.8125rem] text-muted">{dayShort(TODAY)}</span>
            </div>
            {job ? (
              <div className="mt-3 rounded-3xl bg-white p-4 shadow-card">
                {booked.length > 1 && (
                  <div className="mb-3 flex gap-1.5">
                    {booked.map((b, i) => <button key={b.id} onClick={() => setAt(i)} className={cn('h-8 rounded-full px-3 text-[0.78125rem] font-semibold', i === at ? 'bg-ink text-white' : 'bg-wash text-ink-2')}>{s.jobs[b.jobId]?.name}</button>)}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <div className="text-[1.125rem] font-bold text-ink">{job.name}</div>
                    <div className="flex items-center gap-1 text-[0.8125rem] text-muted"><MapPin className="h-3.5 w-3.5" />{job.address}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-wash px-3 py-2.5 text-[0.8125rem] text-ink-2">
                  <Avatar who={me} size={24} /> {PEOPLE[me].short}{(booking?.workers || 1) > 1 ? ` + ${(booking?.workers || 1) - 1}` : ''}{booking?.label ? ` · ${booking.label}` : ''} · site manager {PEOPLE[(job.site as any) || 'yakov']?.short || 'Yakov'}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-3xl bg-white p-5 shadow-card">
                <div className="text-[1rem] font-bold text-ink">No job booked for you today</div>
                <div className="mt-1 text-[0.84375rem] text-muted">{nextUp ? `Next: ${s.jobs[nextUp.jobId]?.name} · from ${dayShort(nextUp.start)}` : 'When the office books you on a job, it shows here with the rooms, tiles and layouts.'}</div>
              </div>
            )}

            {job && <>
            <div className="mb-2 mt-5 flex items-center gap-2 px-1 text-[0.9375rem] font-bold text-bad-700"><Ban className="h-4 w-4" />Do not start</div>
            <div className="flex flex-col gap-2">
              {stop.map((x, i) => (
                <div key={i} className="rounded-2xl border border-bad-100 bg-bad-50 p-3.5">
                  <div className="text-[0.90625rem] font-semibold text-ink">{x.room} · {x.sf.name}</div>
                  <div className="mt-0.5 text-[0.8125rem] text-bad-700">{x.sf.reason}</div>
                </div>
              ))}
              {!stop.length && <div className="rounded-2xl bg-white p-3.5 text-[0.84375rem] text-muted">Nothing is held — every area is open.</div>}
            </div>

            <div className="mb-2 mt-5 flex items-center gap-2 px-1 text-[0.9375rem] font-bold text-ink"><Hammer className="h-4 w-4 text-brand-600" />Work on today</div>
            <div className="flex flex-col gap-2.5">
              {work.map((x, i) => {
                const t = tileOf(job?.id, x.sf.tile)
                const g = x.sf.grout ? GROUTS[x.sf.grout] : undefined
                return (
                  <button key={i} onClick={() => toast(`${x.room} · ${x.sf.name} — the installer sheet with layout and elevations`)} className="rounded-2xl bg-white p-3.5 text-left shadow-card">
                    <div className="flex items-center gap-3">
                      <TileImg tile={t} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.90625rem] font-semibold text-ink">{x.room} · {x.sf.name}</div>
                        <div className="text-[0.78125rem] text-muted">{t?.tag} {t?.name} · {t?.size}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-faint" />
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[0.75rem]">
                      {x.sf.layout && <span className="rounded-lg bg-wash px-2 py-1.5 text-ink-2">{x.sf.layout}</span>}
                      {g && <span className="flex items-center gap-1.5 rounded-lg bg-wash px-2 py-1.5 text-ink-2"><span className="h-3 w-3 rounded-full border border-line" style={{ background: g.color }} />{g.name} {x.sf.joint}</span>}
                      {x.sf.edge && <span className="rounded-lg bg-wash px-2 py-1.5 text-ink-2">{x.sf.edge}</span>}
                      {x.sf.height && <span className="rounded-lg bg-wash px-2 py-1.5 text-ink-2">{x.sf.height}</span>}
                    </div>
                  </button>
                )
              })}
              {!work.length && <div className="rounded-2xl bg-white p-3.5 text-[0.84375rem] text-muted">The rooms for this job aren’t set up yet — the office adds them from the estimate.</div>}
            </div>
            </>}

            {touch.length > 0 && (
              <>
                <div className="mb-2 mt-5 flex items-center gap-2 px-1 text-[0.9375rem] font-bold text-ink"><Wrench className="h-4 w-4 text-warn-600" />Touch-ups for you<span className="text-[0.8125rem] font-semibold text-muted">{touch.length}</span></div>
                <div className="flex flex-col gap-2.5">
                  {touchJobs.map((jid) => (
                    <div key={jid} className="overflow-hidden rounded-2xl bg-white shadow-card">
                      <div className="flex items-center gap-1.5 border-b border-line-2 px-3.5 py-2 text-[0.8125rem] font-semibold text-ink-2"><MapPin className="h-3.5 w-3.5 text-muted" />{s.jobs[jid]?.name || jid}</div>
                      {touch.filter((p) => p.jobId === jid).map((p) => (
                        <div key={p.id} className="flex items-center gap-3 border-t border-line-2 px-3.5 py-2.5 first:border-t-0">
                          <div className="min-w-0 flex-1">
                            <div className="text-[0.875rem] font-semibold text-ink">{p.text}</div>
                            <div className="truncate text-[0.78125rem] text-muted">{p.where}{p.status === 'verify' ? ' · done — waiting for the check' : p.note ? ` · ${p.note}` : ''}</div>
                          </div>
                          {p.status === 'verify'
                            ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok-50 px-2 py-1 text-[0.75rem] font-semibold text-ok-700"><Check className="h-3.5 w-3.5" />Done</span>
                            : <Button size="sm" icon={<Check />} onClick={() => setPunch(p.id, 'verify')}>Done</Button>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}

            {changed.length > 0 && <>
            <div className="mb-2 mt-5 flex items-center gap-2 px-1 text-[0.9375rem] font-bold text-ink"><Sparkles className="h-4 w-4 text-vio-600" />Changed since yesterday</div>
            <div className="flex flex-col gap-2">
              {changed.map((c) => (
                <div key={c.t} className="rounded-2xl bg-white p-3.5 shadow-card">
                  <div className="text-[0.875rem] font-semibold text-ink">{c.t}</div>
                  <div className="text-[0.78125rem] text-muted">{c.d}</div>
                </div>
              ))}
            </div>
            </>}

            <ComingUp me={me} today={booked.map((b) => b.jobId)} />
          </div>
          <div className="absolute inset-x-0 bottom-0 border-t border-line bg-white/95 px-4 pb-6 pt-3 backdrop-blur max-md:fixed max-md:z-30 max-md:pb-[calc(0.875rem+env(safe-area-inset-bottom,0))]">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { i: PackageX, l: 'Short', run: () => s.open({ t: 'record', jobId: jobId || undefined, type: 'shortage' }) },
                { i: HelpCircle, l: 'Problem', run: () => s.open({ t: 'record', jobId: jobId || undefined, type: 'question' }) },
                { i: ArrowLeftRight, l: 'Extra work', run: () => (jobId ? s.open({ t: 'sitechange', jobId }) : s.open({ t: 'record', type: 'change' })) },
                { i: Camera, l: 'Photos', run: () => (jobId ? s.open({ t: 'daily', jobId }) : toast('Photos go on the job you’re booked on')) },
              ].map((b) => (
                <button key={b.l} onClick={b.run} className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[0.71875rem] font-semibold text-ink-2 hover:bg-wash">
                  <b.i className="h-5 w-5" />
                  {b.l}
                </button>
              ))}
            </div>
            <Button full size="lg" variant="primary" className="mt-2" icon={<ClipboardList className="h-[1.125rem] w-[1.125rem]" />} disabled={!jobId} onClick={() => jobId && s.open({ t: 'daily', jobId })}>Send today’s update</Button>
          </div>
        </div>
      </div>
      <div className="max-w-[26.25rem] max-lg:max-w-[17.5rem] max-md:hidden">
        <div className="text-[0.8125rem] font-semibold text-brand-600">Crew phone view</div>
        <h1 className="h-display mt-2 text-[2.125rem] font-bold leading-tight text-ink">What {PEOPLE[me].short} sees{job ? ` at ${job.name}` : ' today'}</h1>
        <p className="mt-3 text-[1rem] leading-relaxed text-ink-2">No office workflow — just where to work, the approved details, what not to start, and what changed. Reporting a shortage, a problem or extra work takes a few taps, and it goes straight to the right person.</p>
        <div className="mt-6 flex flex-col gap-3">
          {['Do-not-start comes from the project — blocked surfaces and unapproved changes', 'Approved answers show up here as installation details', 'The daily update fills each room’s diary — what was tiled, with photos and videos'].map((t) => (
            <div key={t} className="flex gap-3 text-[0.90625rem] text-ink-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok-500" />{t}</div>
          ))}
        </div>
        <Button className="mt-8" size="lg" icon={<Repeat className="h-[1.125rem] w-[1.125rem]" />} onClick={() => s.open({ t: 'roles' })}>Switch login</Button>
      </div>
    </div>
  )
}
