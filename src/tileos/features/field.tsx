/* Field work: the daily update against the original plan, the room diary with photos and videos,
 * a change asked on site (one click starts the change order, the installer PO change and the tile),
 * the designer meeting and the height check. */
import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import {
  Play, ImagePlus, X, ChevronLeft, ChevronRight, Check, Send, ArrowLeftRight, PauseCircle, Package, Receipt, HardHat,
  CheckCircle2, Circle, Ban, Clock3, Plus, Eye, CalendarClock, Ruler, Sparkles, FileText, Images, AlertTriangle,
} from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore } from '@/tileos/store'
import { Button, Pill, Avatar, Chip, Field, TextInput, Card, CardHeader, Empty, IconCircle, Segmented, Count, Stepper as NumStepper } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { FlowSteps } from '@/tileos/components/ui/page'
import { Swatch, TileImg } from '@/tileos/components/ui/swatch'
import { Bar, MiniSteps } from '@/tileos/components/ui/progress'
import { cn, TONE } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { SURF_LABEL, SURF_TONE, surfacePct, jobPct, type Room, type Surface, tileOf, tilesOf, tileLine } from '@/tileos/data/jobs'
import type { Media } from '@/tileos/data/field'
import { sendDailyUpdate, siteChange, sendCO, approveChange, logMeeting, recordHeights, nextCO, setWalk } from './flows'
import { TODAY, dayShort, addDays, dow, labelFromIso, md } from '@/tileos/lib/today'
import { SearchSelect } from '@/tileos/components/ui/select'

type MediaX = Media & { room?: string; day?: string; who?: PersonKey }

/* ================= photos and videos ================= */
export function MediaTile({ m, className, onClick, showCap, onRemove }: { m: Media; className?: string; onClick?: () => void; showCap?: boolean; onRemove?: () => void }) {
  return (
    <span className={cn('group relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-wash-2', className)}>
      <button type="button" onClick={onClick} className="absolute inset-0 block text-left" aria-label={m.cap}>
        {m.url ? (
          m.kind === 'video' ? <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={m.url} alt={m.cap} className="h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0">
            <Swatch kind={m.sw || 'bianco'} size={160} radius={0} className="!h-full !w-full" />
          </span>
        )}
        {/* soft light so a tile pattern reads like a photo taken on site */}
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_28%_18%,rgba(255,255,255,.28),transparent_55%),linear-gradient(to_top,rgba(13,22,40,.42),transparent_48%)]" />
        {m.kind === 'video' && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[rgba(13,22,40,.62)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white">
            <Play className="h-3 w-3 fill-white" />
            {m.dur || 'Video'}
          </span>
        )}
        {showCap && <span className="absolute inset-x-2 bottom-1.5 truncate text-[0.71875rem] font-medium text-white">{m.cap}</span>}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-ink-2 shadow-pop hover:text-bad-600">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  )
}

export function MediaModal({ items, index: start, level }: { items: MediaX[]; index: number; level: number }) {
  const close = useStore((s) => s.close)
  const [i, setI] = React.useState(start || 0)
  const m = items[i]
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((v) => Math.min(items.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [items.length])
  if (!m) return null
  return (
    <Modal level={level} size="lg" onClose={close} title={m.cap} sub={[m.room, m.surface, m.day].filter(Boolean).join(' · ')}>
      <div className="relative overflow-hidden rounded-2xl bg-wash-2">
        {m.url ? (
          m.kind === 'video' ? <video src={m.url} controls playsInline className="max-h-[60vh] w-full bg-ink object-contain" /> : <img src={m.url} alt={m.cap} className="max-h-[60vh] w-full object-contain" />
        ) : (
          <div className="relative aspect-[4/3] max-h-[60vh] w-full">
            <Swatch kind={m.sw || 'bianco'} size={400} radius={0} className="!h-full !w-full" />
            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_28%_18%,rgba(255,255,255,.28),transparent_55%),linear-gradient(to_top,rgba(13,22,40,.3),transparent_45%)]" />
            {m.kind === 'video' && (
              <button onClick={() => toast('Sample video — real videos play right here')} className="absolute inset-0 m-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-ink shadow-pop" aria-label="Play">
                <Play className="ml-1 h-7 w-7 fill-ink" />
              </button>
            )}
          </div>
        )}
        {i > 0 && (
          <button onClick={() => setI(i - 1)} aria-label="Previous" className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow-pop">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {i < items.length - 1 && (
          <button onClick={() => setI(i + 1)} aria-label="Next" className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow-pop">
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[0.84375rem] text-muted">
        <span className="inline-flex items-center gap-2">{m.who && <Avatar who={m.who} size={22} />}{m.who ? PEOPLE[m.who].name : ''}{m.kind === 'video' ? ` · video ${m.dur || ''}` : ''}</span>
        <span className="tnum">{!m.url && <span className="mr-3 rounded-md bg-wash-2 px-2 py-0.5 text-[0.75rem] font-medium">Sample {m.kind}</span>}{i + 1} of {items.length}</span>
      </div>
      {items.length > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {items.map((x, k) => (
            <button key={x.id} onClick={() => setI(k)} className={cn('w-[5.25rem] shrink-0 rounded-xl ring-2 transition', k === i ? 'ring-brand-500' : 'ring-transparent opacity-80 hover:opacity-100')}>
              <MediaTile m={x} />
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

/* ================= progress bits ================= */
function Delta({ from, to }: { from: number; to: number }) {
  return (
    <span className="relative block h-2 w-full overflow-hidden rounded-full bg-[#E9EDF3]">
      <span className={cn('absolute inset-y-0 left-0 rounded-full', from >= 100 ? 'bg-ok-500/60' : 'bg-brand-200')} style={{ width: `${from}%` }} />
      <span className={cn('absolute inset-y-0 rounded-full', to >= 100 ? 'bg-ok-500' : 'bg-brand-600')} style={{ left: `${from}%`, width: `${Math.max(0, to - from)}%` }} />
    </span>
  )
}
const stateDot = (x: Surface) =>
  x.state === 'done' ? <CheckCircle2 className="h-[1.125rem] w-[1.125rem] shrink-0 fill-ok-500 text-white" /> :
  ['blocked'].includes(x.state) ? <Ban className="h-[1.125rem] w-[1.125rem] shrink-0 text-bad-500" /> :
  ['hold', 'waitmat', 'unknown'].includes(x.state) ? <PauseCircle className="h-[1.125rem] w-[1.125rem] shrink-0 text-warn-500" /> :
  surfacePct(x) > 0 ? <Clock3 className="h-[1.125rem] w-[1.125rem] shrink-0 text-brand-500" /> : <Circle className="h-[1.125rem] w-[1.125rem] shrink-0 text-[#CDD4DE]" />

/* ================= the room diary ================= */
export function roomMedia(diary: { day: string; who: PersonKey; rooms: { room: string; media: Media[] }[] }[] | undefined, room: string): MediaX[] {
  return (diary || []).flatMap((e) => (e.rooms.find((r) => r.room === room)?.media || []).map((m) => ({ ...m, room, day: e.day, who: e.who })))
}

export function RoomDiary({ job, room }: { job: Job; room: Room }) {
  const s = useStore()
  const entries = (s.diary[job.id] || []).map((e) => ({ e, r: e.rooms.find((x) => x.room === room.name) })).filter((x) => x.r)
  const all = roomMedia(s.diary[job.id], room.name)
  const done = room.surfaces.filter((x) => x.state === 'done')
  const going = room.surfaces.filter((x) => x.state !== 'done' && surfacePct(x) > 0)
  const todo = room.surfaces.filter((x) => x.state !== 'done' && surfacePct(x) === 0)
  const openMedia = (id: string) => s.open({ t: 'media', items: all, index: Math.max(0, all.findIndex((m) => m.id === id)) })
  return (
    <div className="flex flex-col gap-6 px-6 py-5 max-sm:px-4">
      <div className="rounded-2xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[0.9375rem] font-semibold text-ink">Done and not done</div>
          <div className="text-[0.84375rem] font-semibold tnum text-ink-2">{room.pct}% installed</div>
        </div>
        <Bar pct={room.pct} className="mt-2.5" h={8} tone={room.pct === 100 ? 'ok' : 'info'} />
        <div className="mt-4 grid grid-cols-3 gap-4 max-md:grid-cols-1 max-md:gap-3">
          {[
            { t: 'Finished', list: done, tone: 'text-ok-700' },
            { t: 'In progress', list: going, tone: 'text-brand-700' },
            { t: 'Not started', list: todo, tone: 'text-muted' },
          ].map((c) => (
            <div key={c.t} className="min-w-0">
              <div className={cn('mb-1.5 text-[0.78125rem] font-semibold', c.tone)}>{c.t} · {c.list.length}</div>
              <div className="flex flex-col gap-1.5">
                {c.list.map((x) => (
                  <div key={x.name} className="flex min-w-0 items-center gap-2 text-[0.84375rem] text-ink-2">
                    {stateDot(x)}
                    <span className="min-w-0 flex-1 truncate">{x.name}</span>
                    {c.t === 'In progress' && <span className="text-[0.78125rem] font-semibold tnum text-brand-700">{surfacePct(x)}%</span>}
                    {c.t === 'Not started' && ['blocked', 'hold', 'waitmat', 'unknown'].includes(x.state) && <span className="truncate text-[0.75rem] font-medium text-warn-700">{x.pending ? x.pending.co : SURF_LABEL[x.state]}</span>}
                  </div>
                ))}
                {!c.list.length && <div className="text-[0.8125rem] text-faint">—</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[1rem] font-semibold text-ink">Day by day</div>
          <div className="text-[0.8125rem] text-muted">{entries.length ? `${entries.length} updates · ${all.length} photos and videos` : 'Filled in by the crew’s daily update'}</div>
        </div>
      </div>

      {entries.length ? (
        <div className="flex flex-col">
          {entries.map(({ e, r }, k) => (
            <div key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center pt-1">
                <span className={cn('h-3 w-3 shrink-0 rounded-full ring-4', k === 0 ? 'bg-brand-600 ring-brand-50' : 'bg-[#C9D2DF] ring-wash')} />
                {k < entries.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[0.90625rem] font-semibold text-ink">{e.day}</span>
                  <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted"><Avatar who={e.who} size={18} />{PEOPLE[e.who].name}{e.workers && e.workers > 1 ? ` + ${e.workers - 1}` : ''}</span>
                  {e.gc && <Pill tone="info" size="sm">Sent to the GC</Pill>}
                </div>
                {r!.items.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-2">
                    {r!.items.map((it) => (
                      <div key={it.surface} className="grid grid-cols-[minmax(0,9.375rem)_minmax(0,1fr)_auto] items-center gap-3 max-sm:grid-cols-[minmax(0,1fr)_auto]">
                        <span className="truncate text-[0.84375rem] font-medium text-ink-2">{it.surface}</span>
                        <span className="max-sm:order-last max-sm:col-span-2"><Delta from={it.from} to={it.to} /></span>
                        <span className={cn('text-right text-[0.78125rem] font-semibold tnum', it.to >= 100 ? 'text-ok-700' : 'text-brand-700')}>{it.to >= 100 ? (it.from > 0 ? `${it.from}% → finished` : 'Finished') : `${it.from}% → ${it.to}%`}</span>
                      </div>
                    ))}
                  </div>
                )}
                {r!.note && <p className="mt-2 text-[0.84375rem] leading-relaxed text-ink-2">{r!.note}</p>}
                {r!.media.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2 max-sm:grid-cols-3">
                    {r!.media.map((m) => <MediaTile key={m.id} m={m} showCap onClick={() => openMedia(m.id)} />)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<Images className="h-6 w-6" />} title="No updates for this room yet" sub="The crew’s daily update fills this in — what was tiled each day, with photos and videos." className="py-8" />
      )}
    </div>
  )
}

export function RoomPhotos({ job, room }: { job: Job; room: Room }) {
  const s = useStore()
  const all = roomMedia(s.diary[job.id], room.name)
  if (!all.length) return <Empty icon={<Images className="h-6 w-6" />} title="No photos yet" sub="Photos and videos from the daily updates land here, by room." className="py-12" />
  const samples = all.some((m) => !m.url)
  return (
    <div className="px-6 py-5 max-sm:px-4">
    {samples && <div className="mb-4 flex items-center gap-2 rounded-xl bg-wash px-3.5 py-2.5 text-[0.8125rem] text-muted"><Images className="h-4 w-4 shrink-0" />Sample pictures for the demo — in the real app the crew’s photos and videos land here from their phones.</div>}
    <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2">
      {all.map((m, i) => (
        <div key={m.id} className="min-w-0">
          <MediaTile m={m} onClick={() => s.open({ t: 'media', items: all, index: i })} />
          <div className="mt-1.5 truncate text-[0.8125rem] font-medium text-ink">{m.cap}</div>
          <div className="truncate text-[0.75rem] text-muted">{m.day}{m.surface ? ` · ${m.surface}` : ''}</div>
        </div>
      ))}
    </div>
    </div>
  )
}

/* ================= the daily update ================= */
const STEPS = [25, 50, 75, 90]
const keyOf = (room: string, sf: string) => room + '::' + sf
const SAMPLE_SW = ['subway', 'toscana', 'pearl', 'bianco', 'calacatta', 'hex'] as const

export function DailyModal({ jobId, room: startRoom, level }: { jobId: string; room?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const rooms = s.rooms[jobId] || []
  const firstActive = rooms.find((r) => r.surfaces.some((x) => x.state === 'working'))?.name || rooms[0]?.name || ''
  const [room, setRoom] = React.useState(startRoom || firstActive)
  const [targets, setTargets] = React.useState<Record<string, number>>({})
  const [media, setMedia] = React.useState<Record<string, Media[]>>({})
  const [notes, setNotes] = React.useState<Record<string, string>>({})
  const [blocked, setBlocked] = React.useState(false)
  const [shortage, setShortage] = React.useState(false)
  const [change, setChange] = React.useState(false)
  const [tomorrow, setTomorrow] = React.useState<string[]>([])
  const [note, setNote] = React.useState('')
  const [gc, setGc] = React.useState(false)
  const [preview, setPreview] = React.useState(true)
  const [step, setStep] = React.useState(0)
  const fileRef = React.useRef<HTMLInputElement>(null)
  if (!job) return null
  /* the update is the crew's work, whoever types it — that's what their weekly pay is worked out from */
  const who: PersonKey = job.crew || (s.bookings.find((b) => b.jobId === jobId && b.start <= TODAY && b.end >= TODAY)?.crew as PersonKey) || (s.role === 'crew' ? 'philip' : 'ys')
  const r = rooms.find((x) => x.name === room)
  const moved = Object.keys(targets).length
  const mediaCount = Object.values(media).reduce((n, l) => n + l.length, 0)
  const roomHas = (name: string) => Object.keys(targets).some((k) => k.startsWith(name + '::')) || (media[name] || []).length > 0 || !!notes[name]

  /* what the project looks like after today */
  const after = rooms.map((rm) => ({ ...rm, surfaces: rm.surfaces.map((x) => (targets[keyOf(rm.name, x.name)] !== undefined ? { ...x, pct: targets[keyOf(rm.name, x.name)], state: targets[keyOf(rm.name, x.name)] >= 100 ? ('done' as const) : ('working' as const) } : x)) }))
  const before = job.pct ?? 0
  const projected = rooms.some((rm) => rm.surfaces.some((x) => x.sf)) ? jobPct(after) : before

  const setT = (sf: Surface, v: number | null) =>
    setTargets((p) => {
      const n = { ...p }
      if (v === null) delete n[keyOf(room, sf.name)]
      else n[keyOf(room, sf.name)] = v
      return n
    })
  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    const added: Media[] = Array.from(files).map((f, k) => ({ id: 'u' + Date.now() + k, kind: f.type.startsWith('video') ? 'video' : 'photo', url: URL.createObjectURL(f), cap: f.name.replace(/\.[^.]+$/, '') }))
    setMedia((p) => ({ ...p, [room]: [...(p[room] || []), ...added] }))
  }
  const addSample = () => {
    const cnt = (media[room] || []).length
    const sf = r?.surfaces.find((x) => targets[keyOf(room, x.name)] !== undefined) || r?.surfaces.find((x) => x.state === 'working') || r?.surfaces[0]
    const sw = (sf && tileOf(jobId, sf.tile)?.swatch) || SAMPLE_SW[cnt % SAMPLE_SW.length]
    setMedia((p) => ({ ...p, [room]: [...(p[room] || []), { id: 's' + Date.now(), kind: cnt % 3 === 2 ? 'video' : 'photo', sw, dur: '0:16', cap: `${room} — ${sf?.name.toLowerCase() || 'today'}`, surface: sf?.name }] }))
  }
  const send = () => {
    const names = Array.from(new Set([...Object.keys(targets).map((k) => k.split('::')[0]), ...Object.keys(media).filter((k) => media[k].length), ...Object.keys(notes).filter((k) => notes[k]?.trim())]))
    sendDailyUpdate(jobId, {
      who, workers: job.workers, gc, blocked, shortage, change, tomorrow, note: note.trim() || undefined,
      rooms: names.map((name) => ({
        room: name,
        items: Object.entries(targets).filter(([k]) => k.startsWith(name + '::')).map(([k, v]) => ({ surface: k.split('::')[1], to: v })),
        media: (media[name] || []).map((m) => ({ ...m, surface: m.surface || undefined })),
        note: notes[name]?.trim() || undefined,
      })),
    })
    s.close()
    if (change) setTimeout(() => useStore.getState().open({ t: 'sitechange', jobId, room }), 80)
  }
  const can = moved > 0 || mediaCount > 0 || !!note.trim() || blocked || shortage || change

  const header = (
    <div className="border-b border-line px-7 pb-5 pt-6 pr-20 max-sm:px-4 max-sm:pr-14 max-sm:pt-4">
      <div className="text-[0.8125rem] font-medium text-muted">{job.crew ? `${PEOPLE[job.crew].name}’s crew` : 'Site'} · {dayShort(TODAY)} · {before}% installed</div>
      <h2 className="mt-0.5 text-[1.375rem] font-bold tracking-[-0.02em] text-ink max-sm:text-[1.1875rem]">Daily update · {job.name}</h2>
      <FlowSteps className="mt-4" steps={['What got done', 'Anything to flag', 'Send']} at={step} onPick={(i) => setStep(i)} />
    </div>
  )
  const lines = Object.entries(targets).map(([k, v]) => {
    const [rn, sn] = k.split('::')
    const cur = surfacePct(rooms.find((x) => x.name === rn)?.surfaces.find((x) => x.name === sn) || ({ state: 'notstarted' } as Surface))
    return { k, room: rn, surface: sn, from: cur, to: v }
  })
  return (
    <Modal
      level={level}
      size="xl"
      tall
      onClose={s.close}
      header={header}
      title="Daily update"
      bodyClass={step === 0 ? 'p-0' : 'px-7 py-6 max-sm:px-4'}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted max-sm:hidden">
            {moved ? <><span className="font-semibold text-ink">{moved} surface{moved > 1 ? 's' : ''}</span> moved</> : 'Nothing marked yet'}
            {mediaCount ? ` · ${mediaCount} photo${mediaCount > 1 ? 's' : ''}` : ''}
            {moved && projected !== before ? <> · project <span className="font-semibold text-ink">{before}% → {projected}%</span></> : ''}
          </span>
          {step > 0 ? (
            <Button className="ml-auto" variant="ghost" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setStep(step - 1)}>Back</Button>
          ) : (
            <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          )}
          {step < 2 ? (
            <Button variant="primary" iconRight={<ChevronRight className="h-4 w-4" />} onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button variant="primary" disabled={!can} icon={<Send className="h-[1.125rem] w-[1.125rem]" />} onClick={send}>Send update</Button>
          )}
        </>
      }
    >
      {step === 0 && (
        <div className="grid h-full min-h-0 grid-cols-[16.5rem_minmax(0,1fr)] max-md:flex max-md:h-auto max-md:flex-col">
          {/* the rooms */}
          <nav aria-label="Rooms" className="scroll-soft min-h-0 overflow-y-auto border-r border-line-2 bg-wash p-3 max-md:no-scrollbar max-md:flex max-md:gap-2 max-md:overflow-x-auto max-md:border-b max-md:border-r-0">
            {rooms.map((rm) => {
              const on = rm.name === room
              const touched = roomHas(rm.name)
              return (
                <button
                  key={rm.name}
                  onClick={() => setRoom(rm.name)}
                  className={cn('mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition max-md:mb-0 max-md:w-auto max-md:shrink-0', on ? 'bg-white shadow-xs ring-1 ring-brand-200' : 'hover:bg-white/70')}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[0.875rem] font-semibold', on ? 'text-brand-700' : 'text-ink')}>{rm.name}</span>
                    <span className="mt-1 flex items-center gap-2 max-md:hidden">
                      <span className="h-1.5 w-[5.25rem] overflow-hidden rounded-full bg-[#e5e0d7]"><span className={cn('block h-full rounded-full', rm.pct >= 100 ? 'bg-ok-500' : 'bg-brand-500')} style={{ width: `${rm.pct}%` }} /></span>
                      <span className="text-[0.75rem] font-semibold tnum text-muted">{rm.pct}%</span>
                    </span>
                  </span>
                  {touched && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Marked today" />}
                </button>
              )
            })}
          </nav>
          {/* what got done in it */}
          {r && (
            <div className="scroll-soft flex min-h-0 flex-col overflow-y-auto px-7 py-6 max-sm:px-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[1.1875rem] font-bold tracking-[-0.015em] text-ink">{r.name}</h3>
                <span className="text-[0.8125rem] text-muted">{r.surfaces.length} surfaces · {r.pct}% done</span>
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                {r.surfaces.map((sf) => {
                  const cur = surfacePct(sf)
                  const t = targets[keyOf(room, sf.name)]
                  const tile = tileOf(jobId, sf.tile)
                  const stop = ['blocked', 'hold', 'waitmat', 'unknown'].includes(sf.state)
                  const opts = [...STEPS.filter((v) => v > cur), 100]
                  return (
                    <div key={sf.name} className={cn('rounded-2xl border px-4 py-3.5 transition', t !== undefined ? 'border-brand-300 bg-brand-50/50' : 'border-line bg-white')}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                        <div className="min-w-0 flex-1 basis-[15rem]">
                          <div className="text-[0.9375rem] font-semibold text-ink">{sf.name}</div>
                          <div className="mt-0.5 truncate text-[0.78125rem] text-muted">{tile ? `${tile.tag} ${tile.name} · ${tile.size}` : sf.tile || 'No tile yet'}{sf.sf ? ` · ${sf.sf} SF` : ''}</div>
                          <div className="mt-2 flex items-center gap-2.5">
                            <span className="w-[9.375rem] max-sm:w-[6.875rem]"><Delta from={cur} to={t ?? cur} /></span>
                            <span className={cn('text-[0.78125rem] font-semibold tnum', t !== undefined ? 'text-brand-700' : cur >= 100 ? 'text-ok-600' : 'text-muted')}>{t !== undefined ? `${cur}% → ${t >= 100 ? 'done' : t + '%'}` : cur >= 100 ? 'Done' : `${cur}%`}</span>
                          </div>
                        </div>
                        {sf.state === 'done' ? (
                          <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ok-600"><CheckCircle2 className="h-4 w-4" />Complete</span>
                        ) : stop ? (
                          <span className={cn('inline-flex max-w-[18.75rem] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.78125rem] font-semibold', sf.state === 'blocked' ? 'bg-bad-50 text-bad-700' : 'bg-warn-50 text-warn-700')}>
                            <Ban className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Don’t start · {sf.pending ? `${sf.pending.co} pending` : sf.reason || SURF_LABEL[sf.state]}</span>
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5 max-sm:w-full" role="group" aria-label={`How far is the ${sf.name.toLowerCase()} now?`}>
                            {opts.map((v) => {
                              const on = t === v
                              return (
                                <button
                                  key={v}
                                  onClick={() => setT(sf, on ? null : v)}
                                  className={cn(
                                    'inline-flex h-10 min-w-[3.625rem] items-center justify-center gap-1.5 rounded-xl border px-3 text-[0.875rem] font-semibold tnum transition max-sm:flex-1',
                                    on ? (v >= 100 ? 'border-ok-500 bg-ok-500 text-white shadow-xs' : 'border-brand-600 bg-brand-600 text-white shadow-xs') : 'border-line bg-white text-ink-2 hover:border-brand-300 hover:bg-brand-50',
                                  )}
                                >
                                  {v >= 100 ? <><Check className="h-4 w-4" strokeWidth={2.6} />Done</> : `${v}%`}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
                <Button size="sm" icon={<ImagePlus className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Photos</Button>
                <button onClick={addSample} className="text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700">Sample photo</button>
                <TextInput value={notes[room] || ''} onChange={(e) => setNotes((p) => ({ ...p, [room]: e.target.value }))} placeholder={`Note about the ${room.toLowerCase()} (optional)`} className="h-9 min-w-[12.5rem] flex-1" />
              </div>
              {(media[room] || []).length > 0 && (
                <div className="mt-3 grid grid-cols-6 gap-2 max-md:grid-cols-4 max-sm:grid-cols-3">
                  {(media[room] || []).map((m) => (
                    <MediaTile key={m.id} m={m} onRemove={() => setMedia((p) => ({ ...p, [room]: (p[room] || []).filter((x) => x.id !== m.id) }))} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div key="flags" className="mx-auto flex w-full max-w-[56.25rem] animate-fade-up flex-col gap-7">
          <section className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            {[
              { l: 'Anything blocking tomorrow?', icon: Ban, v: blocked, set: setBlocked, tone: 'bad' },
              { l: 'Short on material?', icon: Package, v: shortage, set: setShortage, tone: 'warn' },
              { l: 'Client asked for a change?', icon: ArrowLeftRight, v: change, set: setChange, tone: 'vio' },
            ].map((q) => (
              <div key={q.l} className={cn('rounded-2xl border p-4 transition', q.v ? 'border-warn-300 bg-warn-50/60' : 'border-line bg-white')}>
                <div className="flex items-center gap-2.5 text-[0.9375rem] font-semibold text-ink">
                  <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', q.tone === 'bad' ? 'bg-bad-50 text-bad-600' : q.tone === 'warn' ? 'bg-warn-50 text-warn-600' : 'bg-vio-50 text-vio-600')}><q.icon className="h-[1.125rem] w-[1.125rem]" /></span>
                  {q.l}
                </div>
                <div className="mt-3 flex gap-2">
                  <Chip on={!q.v} onClick={() => q.set(false)} className="h-10 flex-1 justify-center">No</Chip>
                  <Chip on={q.v} onClick={() => q.set(true)} className="h-10 flex-1 justify-center">Yes</Chip>
                </div>
              </div>
            ))}
          </section>
          {change && <div className="-mt-3 flex items-center gap-2 rounded-xl bg-warn-50 px-3.5 py-2.5 text-[0.84375rem] text-warn-700"><ArrowLeftRight className="h-4 w-4 shrink-0" />The change opens right after you send.</div>}
          <Field label="Tomorrow the crew works in">
            <div className="flex flex-wrap gap-2">
              {rooms.map((rm) => <Chip key={rm.name} on={tomorrow.includes(rm.name)} onClick={() => setTomorrow((p) => (p.includes(rm.name) ? p.filter((x) => x !== rm.name) : [...p, rm.name]))} className="h-9 px-3 text-[0.84375rem]">{rm.name}</Chip>)}
            </div>
          </Field>
          <Field label="Note for the office (optional)">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the office should know" />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div key="send" className="mx-auto flex w-full max-w-[56.25rem] animate-fade-up flex-col gap-5">
          <section className="overflow-hidden rounded-2xl border border-line">
            <div className="flex items-center gap-4 bg-wash px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-[0.78125rem] font-semibold uppercase tracking-[0.05em] text-muted">{job.name} · today</div>
                <div className="mt-1.5 flex items-center gap-3">
                  <Bar pct={projected} className="flex-1" h={8} />
                  <span className="shrink-0 text-[0.9375rem] font-bold tnum text-ink">{projected}%{projected !== before ? <span className="ml-1.5 text-[0.8125rem] font-medium text-muted">was {before}%</span> : null}</span>
                </div>
              </div>
            </div>
            {lines.length ? (
              lines.map((l) => (
                <div key={l.k} className="flex items-center gap-4 border-t border-line-2 px-5 py-3">
                  <span className="w-[9.375rem] shrink-0 truncate text-[0.8125rem] font-semibold uppercase tracking-[0.03em] text-muted max-sm:w-[6rem]">{l.room}</span>
                  <span className="min-w-0 flex-1 truncate text-[0.90625rem] font-medium text-ink">{l.surface}</span>
                  <span className={cn('inline-flex h-7 items-center rounded-full px-2.5 text-[0.78125rem] font-semibold tnum', l.to >= 100 ? 'bg-ok-50 text-ok-700' : 'bg-brand-50 text-brand-700')}>{l.from}% → {l.to >= 100 ? 'done' : `${l.to}%`}</span>
                </div>
              ))
            ) : (
              <div className="border-t border-line-2 px-5 py-4 text-[0.875rem] text-muted">Nothing marked — go back to add what got done.</div>
            )}
            {(mediaCount > 0 || blocked || shortage || change || tomorrow.length > 0) && (
              <div className="flex flex-wrap gap-2 border-t border-line-2 px-5 py-3">
                {mediaCount > 0 && <Pill tone="neutral">{mediaCount} photo{mediaCount > 1 ? 's' : ''}</Pill>}
                {blocked && <Pill tone="bad">Blocks tomorrow</Pill>}
                {shortage && <Pill tone="warn">Short on material</Pill>}
                {change && <Pill tone="vio">Client change</Pill>}
                {tomorrow.length > 0 && <Pill tone="info">Tomorrow: {tomorrow.join(', ')}</Pill>}
              </div>
            )}
          </section>

          {s.role !== 'crew' && (
            <section className={cn('rounded-2xl border p-4 transition', gc ? 'border-brand-200 bg-brand-50/50' : 'border-line')}>
              <div className="flex items-center gap-3">
                <button onClick={() => setGc((v) => !v)} className={cn('inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition', gc ? 'bg-brand-600' : 'bg-[#D5DBE4]')} role="switch" aria-checked={gc} aria-label="Also send the GC a progress report">
                  <span className={cn('h-5 w-5 rounded-full bg-white shadow transition', gc && 'translate-x-5')} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-[0.90625rem] font-semibold text-ink">Also send {job.client} a progress report</div>
                  <div className="text-[0.8125rem] text-muted">Today’s progress and photos, from Cobblestone</div>
                </div>
              </div>
              {gc && (
                <div className="mt-4 rounded-xl border border-line bg-white p-5">
                  <div className="text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-muted">Progress report · {dayShort(TODAY)}</div>
                  <div className="mt-1 text-[1.125rem] font-bold tracking-[-0.01em] text-ink">{job.name}</div>
                  <div className="mt-3 flex items-center gap-3">
                    <Bar pct={projected} className="flex-1" h={8} />
                    <span className="text-[0.84375rem] font-semibold tnum text-ink">{projected}% installed</span>
                  </div>
                  <div className="mt-3 flex flex-col gap-1 text-[0.84375rem] text-ink-2">
                    {lines.map((l) => <div key={l.k}>{l.room} — {l.surface.toLowerCase()} {l.to >= 100 ? 'finished' : `now ${l.to}%`}</div>)}
                  </div>
                  {mediaCount > 0 && (
                    <div className="mt-3 grid grid-cols-6 gap-2 max-sm:grid-cols-4">
                      {Object.values(media).flat().slice(0, 6).map((m) => <MediaTile key={m.id} m={m} />)}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}

/* ================= a change asked on site ================= */
const HEIGHTS = ['To the ceiling', '84″', '6 ft', '48″', '4 ft', '3 ft']
const LAYOUTS = ['Herringbone', 'Vertical stack', 'Offset 1/2', 'Offset 1/3', 'Straight lay', 'Chevron']
function feet(h?: string): number | null {
  if (!h) return null
  if (/ceiling|full height/i.test(h)) return 8
  const ft = h.match(/(\d+(?:\.\d+)?)\s*ft/)
  if (ft) return Number(ft[1])
  const inch = h.match(/(\d+)\s*″/)
  if (inch) return Math.round((Number(inch[1]) / 12) * 10) / 10
  return null
}
const isWall = (n: string) => /wall|backsplash|splash|wainscot|niche|tub|shower w/i.test(n)
type CType = 'Height' | 'Tile' | 'Layout' | 'Add area' | 'Leave it out'

export function SiteChangeModal({ jobId, room: r0, surface: s0, level }: { jobId: string; room?: string; surface?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const rooms = s.rooms[jobId] || []
  const [room, setRoom] = React.useState(r0 || rooms[0]?.name || '')
  const rm = rooms.find((x) => x.name === room)
  const firstSf = rm?.surfaces.find((x) => x.name === s0)?.name || rm?.surfaces.find((x) => x.state !== 'done')?.name || rm?.surfaces[0]?.name || ''
  const [surface, setSurface] = React.useState(firstSf)
  React.useEffect(() => {
    if (!rm?.surfaces.some((x) => x.name === surface)) setSurface(rm?.surfaces.find((x) => x.state !== 'done')?.name || rm?.surfaces[0]?.name || '')
  }, [room])
  const sf = rm?.surfaces.find((x) => x.name === surface)
  const [type, setType] = React.useState<CType>(sf && isWall(sf.name) ? 'Height' : 'Layout')
  React.useEffect(() => {
    if (sf && type === 'Height' && !isWall(sf.name)) setType('Layout')
  }, [surface])
  const [to, setTo] = React.useState('')
  const [area, setArea] = React.useState('')
  const [areaSF, setAreaSF] = React.useState(30)
  const [by, setBy] = React.useState('Homeowner')
  const [note, setNote] = React.useState('')
  const tilesUsed = Array.from(new Set(rooms.flatMap((x) => x.surfaces.map((y) => y.tile)))).filter((t) => tileOf(jobId, t))
  const [tileTo, setTileTo] = React.useState('')
  React.useEffect(() => setTo(''), [type, surface])
  const ipo = s.ipos.find((p) => p.jobId === jobId)
  const crew = ipo?.crew || job?.crew
  if (!job) return null
  const co = nextCO(s, jobId)
  const tile = tileOf(jobId, sf?.tile)
  const area0 = sf?.sf || 40

  /* what it means in square feet */
  let from = ''
  let toLabel = ''
  let sfDelta = 0
  let tileSF = 0
  let tileTag = sf?.tile || ''
  let ipoQty = ''
  let ipoAmount = 0
  if (type === 'Height') {
    from = sf?.height || 'As planned'
    toLabel = to
    const a = feet(sf?.height) ?? 8
    const b = feet(to)
    if (b !== null && a) {
      const length = area0 / a
      sfDelta = Math.round(length * (b - a))
    }
    tileSF = Math.max(0, sfDelta)
    ipoQty = `${sfDelta >= 0 ? '+' : '−'}${Math.abs(sfDelta)} SF ${tile?.tag || ''} install`
    ipoAmount = Math.round((sfDelta * 18) / 10) * 10
  } else if (type === 'Tile') {
    from = tile ? `${tile.tag} ${tile.name}` : sf?.tile || ''
    const nt = tileOf(jobId, tileTo)
    toLabel = nt ? `${nt.tag} ${nt.name}` : ''
    tileTag = tileTo || tileTag
    tileSF = area0
    ipoQty = nt && nt.size !== tile?.size ? `Same ${area0} SF · ${nt.size} instead of ${tile?.size}` : `Same ${area0} SF · new tile`
    ipoAmount = nt && /hex|mosaic/i.test(nt.name) ? Math.round(area0 * 6) : 0
  } else if (type === 'Layout') {
    from = sf?.layout || 'As planned'
    toLabel = to
    tileSF = to ? Math.round(area0 * (/herringbone|chevron/i.test(to) ? 0.12 : 0.05)) : 0
    ipoQty = to ? `${area0} SF · ${to.toLowerCase()} layout` : ''
    ipoAmount = to ? Math.round((area0 * (/herringbone|chevron/i.test(to) ? 4 : 1)) / 10) * 10 : 0
  } else if (type === 'Add area') {
    from = 'Not in the scope'
    toLabel = area.trim() ? `${area.trim()} · ${areaSF} SF` : ''
    sfDelta = areaSF
    tileSF = areaSF
    ipoQty = `+${areaSF} SF install`
    ipoAmount = Math.round((areaSF * 18) / 10) * 10
  } else {
    from = 'In the scope'
    toLabel = 'Leave it out'
    const left = Math.round((area0 * (100 - (sf ? surfacePct(sf) : 0))) / 100)
    sfDelta = -left
    ipoQty = `−${left} SF install`
    ipoAmount = -Math.round((left * 18) / 10) * 10
  }
  const [doIPO, setDoIPO] = React.useState(true)
  const [doTile, setDoTile] = React.useState(true)
  const ipoOn = doIPO && !!crew && ipoAmount !== 0
  const tileOn = doTile && tileSF > 0
  const waste = s.checks.find((c) => c.jobId === jobId && c.tag === tileTag)?.wastePct ?? 12
  const tileNeed = Math.ceil(tileSF * (1 + waste / 100))
  const supplier = tileOf(jobId, tileTag)?.suppliedBy === 'GC' || s.checks.find((c) => c.jobId === jobId && c.tag === tileTag)?.suppliedBy === 'GC' ? 'GC' : 'us'
  const ready = !!sf && !!toLabel && toLabel !== from
  const start = () => {
    const label = type === 'Add area' ? 'Extra area' : type === 'Leave it out' ? 'Scope' : type
    siteChange({ jobId, room, surface, label, from, to: toLabel, by, note: note.trim() || undefined, sfDelta, tileTag, tileSF: tileOn ? tileSF : 0, ipoQty, ipoAmount, doIPO: ipoOn, doTile: tileOn })
    s.close()
  }

  const header = (
    <div className="border-b border-line-2 px-7 pb-5 pt-6 pr-20 max-sm:px-4 max-sm:pb-4 max-sm:pr-14 max-sm:pt-4">
      <div className="flex flex-wrap items-center gap-2 text-[0.84375rem] text-muted">
        <span className="font-semibold text-ink-2">{job.name}</span>
        <span>·</span>
        <span>Asked on site · {co}</span>
      </div>
      <h2 className="h-tight mt-1 text-[1.4375rem] font-bold text-ink max-sm:text-[1.1875rem]">The client wants something different</h2>
    </div>
  )
  return (
    <Modal
      level={level}
      size="xl"
      onClose={s.close}
      header={header}
      title="Change on site"
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{ready ? `One click starts ${2 + (ipoOn ? 1 : 0) + (tileOn ? 1 : 0)} things — nobody has to remember the rest.` : 'Pick what they want now.'}</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!ready} icon={<ArrowLeftRight className="h-[1.125rem] w-[1.125rem]" />} onClick={start}>Start {co}</Button>
        </>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_23.75rem] gap-8 max-lg:grid-cols-1 max-lg:gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <Field label="Where?">
            <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
              <SearchSelect label="Room" value={room} onChange={setRoom} options={rooms.map((x) => ({ key: x.name, label: x.name }))} placeholder="Which room" width={300} />
              {rm && <SearchSelect label="Wall or floor" value={surface} onChange={setSurface} options={rm.surfaces.map((x) => ({ key: x.name, label: x.name, hint: tileOf(jobId, x.tile) ? tileLine(tileOf(jobId, x.tile)) : undefined }))} placeholder="Which wall or floor" width={320} search={false} />}
            </div>
          </Field>
          {sf && (
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-wash/60 p-4">
              <TileImg tile={tile} size={56} />
              <div className="min-w-0">
                <div className="text-[0.78125rem] font-semibold text-muted">What was planned</div>
                <div className="text-[0.9375rem] font-semibold text-ink">{room} · {sf.name}</div>
                <div className="text-[0.8125rem] text-ink-2">{[tile ? `${tile.tag} ${tile.name} ${tile.size}` : '', sf.layout, sf.height, sf.sf ? `${sf.sf} SF` : ''].filter(Boolean).join(' · ')}</div>
                <div className="mt-0.5 text-[0.78125rem] text-muted">{surfacePct(sf)}% installed{sf.pending ? ` · ${sf.pending.co} already pending` : ''}</div>
              </div>
            </div>
          )}
          <Field label="What do they want now?">
            <div className="flex flex-wrap gap-2">
              {(['Height', 'Tile', 'Layout', 'Add area', 'Leave it out'] as CType[]).map((x) => <Chip key={x} on={type === x} onClick={() => setType(x)}>{x === 'Height' ? 'Different height' : x === 'Tile' ? 'Different tile' : x === 'Layout' ? 'Different layout' : x}</Chip>)}
            </div>
            <div className="mt-3">
              {type === 'Height' && (
                <div className="flex flex-wrap gap-2">
                  {HEIGHTS.filter((h) => feet(h) !== feet(sf?.height)).map((h) => <Chip key={h} on={to === h} onClick={() => setTo(h)} className="h-9 px-3 text-[0.84375rem]">{h}</Chip>)}
                </div>
              )}
              {type === 'Tile' && (
                <div className="flex flex-wrap gap-2">
                  {tilesOf(jobId).filter((t) => t.tag !== sf?.tile).map((t) => (
                    <Chip key={t.tag} on={tileTo === t.tag} onClick={() => setTileTo(t.tag)} className="h-10 px-3 text-[0.84375rem]" icon={<TileImg tile={t} size={20} radius={5} />}>{t.tag} {t.name}{tilesUsed.includes(t.tag) ? '' : ' · new'}</Chip>
                  ))}
                </div>
              )}
              {type === 'Layout' && (
                <div className="flex flex-wrap gap-2">
                  {LAYOUTS.filter((l) => !sf?.layout?.toLowerCase().startsWith(l.toLowerCase())).map((l) => <Chip key={l} on={to === l} onClick={() => setTo(l)} className="h-9 px-3 text-[0.84375rem]">{l}</Chip>)}
                </div>
              )}
              {type === 'Add area' && (
                <div className="flex flex-wrap items-center gap-3">
                  <TextInput value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Tub deck, bench, window sill" className="max-w-[20rem] max-sm:max-w-none" />
                  <NumStepper value={areaSF} onChange={setAreaSF} min={1} max={500} suffix="SF" />
                </div>
              )}
              {type === 'Leave it out' && <div className="rounded-xl bg-wash px-3.5 py-2.5 text-[0.84375rem] text-ink-2">The {sf?.name.toLowerCase()} comes out of the scope. What’s already installed stays billed.</div>}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
            <Field label="Who asked?">
              <div className="flex flex-wrap gap-2">
                {['Homeowner', 'GC', 'Designer'].map((x) => <Chip key={x} on={by === x} onClick={() => setBy(x)} className="h-9 px-3 text-[0.84375rem]">{x}</Chip>)}
              </div>
            </Field>
            <Field label="Note (optional)">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was actually said" />
            </Field>
          </div>
        </div>

        <aside className="self-start rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50/70 to-white p-5">
          <div className="flex items-center gap-2.5">
            <IconCircle tone="info" size={34}><Sparkles className="h-4 w-4" /></IconCircle>
            <div className="text-[0.96875rem] font-semibold text-ink">One click starts all of this</div>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <Effect on icon={<Receipt className="h-4 w-4" />} title={`Change order ${co}`} sub={ready ? `${from} → ${toLabel}. The estimator prices it, it goes to the GC, and it becomes billable the moment it’s approved.` : 'Priced by the estimator, approved by the GC, then billed.'} />
            <Effect
              on={ipoOn}
              disabled={!crew || ipoAmount === 0}
              onToggle={() => setDoIPO((v) => !v)}
              icon={<HardHat className="h-4 w-4" />}
              title={crew ? `${PEOPLE[crew].name}’s installer PO` : 'Installer PO'}
              sub={!crew ? 'No crew booked yet — added when one is.' : ipoAmount === 0 ? 'No change to the installer’s work.' : s.role === 'crew' ? `Your PO gets a change line: ${ipoQty}. You’ll get it once it’s approved.` : `${ipo?.id || 'New PO'} gets a change line: ${ipoQty} (${ipoAmount > 0 ? '+' : '−'}${fmtMoney(Math.abs(ipoAmount))}). Sent to ${PEOPLE[crew].name} when approved.`}
            />
            <Effect
              on={tileOn}
              disabled={tileSF <= 0}
              onToggle={() => setDoTile((v) => !v)}
              icon={<Package className="h-4 w-4" />}
              title="Tile"
              sub={tileSF <= 0 ? 'No extra tile needed.' : `About ${tileNeed} SF of ${tileTag} ${tileOf(jobId, tileTag)?.name || ''} with ${waste}% waste. ${supplier === 'GC' ? 'The GC supplies it — they’re asked to order it once approved.' : 'We order it once approved.'}`}
            />
            <Effect on icon={<PauseCircle className="h-4 w-4" />} title="The crew holds" sub={sf ? `${crew ? PEOPLE[crew].name + '’s' : 'The crew’s'} phone shows “do not start” on the ${room.toLowerCase()} ${sf.name.toLowerCase()} until it’s approved. Everything else keeps moving.` : 'Only that surface waits.'} />
          </div>
        </aside>
      </div>
    </Modal>
  )
}
function Effect({ on, disabled, onToggle, icon, title, sub }: { on: boolean; disabled?: boolean; onToggle?: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border bg-white p-3', on ? 'border-line' : 'border-dashed border-line opacity-70')}>
      <span className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', on ? 'bg-brand-50 text-brand-600' : 'bg-wash-2 text-faint')}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[0.875rem] font-semibold text-ink">{title}</div>
        <div className="text-[0.78125rem] leading-snug text-muted">{sub}</div>
      </div>
      {onToggle && !disabled ? (
        <button onClick={onToggle} role="switch" aria-checked={on} aria-label={title} className={cn('mt-1 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition', on ? 'bg-brand-600' : 'bg-[#D5DBE4]')}>
          <span className={cn('h-4 w-4 rounded-full bg-white shadow transition', on && 'translate-x-4')} />
        </button>
      ) : (
        on && <Check className="mt-1.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.6} />
      )}
    </div>
  )
}

/* ================= pricing and approving a change ================= */
export function ChangeApproveModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const m = s.money.find((x) => x.id === id)
  const [amt, setAmt] = React.useState(() => String(m?.amount || m?.meta?.estimate || ''))
  const [by, setBy] = React.useState('GC project manager')
  const [how, setHow] = React.useState('Email')
  if (!m || !m.meta) return null
  const x = m.meta
  const job = s.jobs[m.jobId]
  const co = m.title.split(' · ')[0]
  const approved = m.step >= 0
  const at = approved ? 3 : x.sent ? 2 : 1
  const ipo = s.ipos.find((p) => p.jobId === m.jobId)
  const header = (
    <div className="border-b border-line-2 px-7 pb-5 pt-6 pr-20 max-sm:px-4 max-sm:pb-4 max-sm:pr-14 max-sm:pt-4">
      <div className="flex flex-wrap items-center gap-2 text-[0.84375rem] text-muted">
        <button onClick={() => s.open({ t: 'job', id: m.jobId })} className="font-semibold text-ink-2 hover:text-brand-700">{job?.name}</button>
        <span>·</span>
        <Pill tone="vio" size="sm">Change order</Pill>
      </div>
      <h2 className="h-tight mt-1 text-[1.4375rem] font-bold text-ink max-sm:text-[1.1875rem]">{co} · {x.room} {x.surface.toLowerCase()}</h2>
      <div className="mt-4"><MiniSteps steps={['Asked on site', 'Pricing', 'With the GC', 'Approved']} at={at} tone={approved ? 'ok' : 'info'} /></div>
    </div>
  )
  return (
    <Modal level={level} size="lg" onClose={s.close} header={header} title={co}>
      <div className="grid grid-cols-[1fr_19.375rem] gap-8 max-md:grid-cols-1 max-md:gap-6">
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-wash px-4 py-3">
              <div className="text-[0.78125rem] font-semibold text-muted">Planned</div>
              <div className="mt-0.5 text-[0.9375rem] font-semibold text-ink">{x.from}</div>
            </div>
            <div className="rounded-xl bg-brand-50 px-4 py-3">
              <div className="text-[0.78125rem] font-semibold text-brand-700">Asked by the {x.by.toLowerCase()}</div>
              <div className="mt-0.5 text-[0.9375rem] font-semibold text-ink">{x.to}</div>
            </div>
          </div>
          <div className="mt-6 text-[0.84375rem] font-semibold text-muted">{approved ? 'What the approval changed' : 'When it’s approved'}</div>
          <div className="mt-2.5 flex flex-col divide-y divide-line-2 rounded-2xl border border-line">
            {[
              { i: <Receipt className="h-4 w-4" />, t: 'Billing', d: `${co} becomes billable · ${fmtMoney(m.amount || x.estimate || 0)}` },
              { i: <HardHat className="h-4 w-4" />, t: 'Crew', d: `The do-not-start lifts; the instruction on their phone becomes “${x.to}”` },
              ...(x.doIPO && ipo ? [{ i: <FileText className="h-4 w-4" />, t: 'Installer PO', d: `${ipo.id} change sent to ${PEOPLE[ipo.crew].name}: ${x.ipoQty}` }] : []),
              ...(x.doTile && x.tileSF > 0 ? [{ i: <Package className="h-4 w-4" />, t: 'Tile', d: `About ${x.tileSF} SF more ${x.tileTag} plus waste — ${tileOf(m.jobId, x.tileTag)?.suppliedBy === 'GC' ? 'the GC is asked to order it' : 'we order it'}` }] : []),
            ].map((r) => (
              <div key={r.t} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{r.i}</span>
                <div className="min-w-0">
                  <div className="text-[0.875rem] font-semibold text-ink">{r.t}</div>
                  <div className="text-[0.8125rem] text-muted">{r.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-[0.84375rem] font-semibold text-muted">Log</div>
          <div className="mt-2 flex flex-col">
            {[...m.log].reverse().map((l, k) => (
              <div key={k} className="flex gap-3 border-b border-line-2 py-2.5 last:border-0">
                <Avatar who={l.who} size={24} />
                <div>
                  <div className="text-[0.875rem] text-ink">{l.text}</div>
                  <div className="text-[0.78125rem] text-muted">{PEOPLE[l.who].name} · {l.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 self-start rounded-2xl border border-line bg-wash/60 p-4 max-md:order-first max-md:self-stretch">
          <div className="text-[0.84375rem] font-semibold text-muted">Next step</div>
          {approved ? (
            <div className="flex items-center gap-2 text-[0.90625rem] font-semibold text-ok-600"><CheckCircle2 className="h-5 w-5" />Approved · billable</div>
          ) : !x.sent ? (
            <>
              <Field label="Price for the GC" hint={`Estimate: ${fmtMoney(x.estimate || 0)} — labor, tile handling and setting materials`}>
                <TextInput value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="$0" />
              </Field>
              <Button full variant="primary" icon={<Send className="h-[1.125rem] w-[1.125rem]" />} disabled={!Number(amt.replace(/[^0-9]/g, ''))} onClick={() => sendCO(id, Number(amt.replace(/[^0-9]/g, '')))}>Send {co} to the GC</Button>
            </>
          ) : (
            <>
              <div className="text-[0.875rem] text-ink-2">Waiting on the GC · {fmtMoney(m.amount || 0)}</div>
              <Field label="Approved by">
                <div className="flex flex-wrap gap-2">
                  {['GC project manager', 'Owner’s rep', 'Homeowner'].map((v) => <Chip key={v} on={by === v} onClick={() => setBy(v)} className="h-9 px-3 text-[0.8125rem]">{v}</Chip>)}
                </div>
              </Field>
              <Field label="How">
                <div className="flex flex-wrap gap-2">
                  {['Email', 'Signed CO', 'Verbal'].map((v) => <Chip key={v} on={how === v} onClick={() => setHow(v)} className="h-9 px-3 text-[0.8125rem]">{v}</Chip>)}
                </div>
              </Field>
              <Button full variant="primary" icon={<Check className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.6} />} onClick={() => approveChange(id, { by, how })}>Record approval</Button>
              {how === 'Verbal' && <div className="text-[0.78125rem] text-warn-700">A follow-up to get it in writing is created too.</div>}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ================= designer meeting ================= */
export function MeetingModal({ taskId, jobId: jid, kind, level }: { taskId?: string; jobId?: string; kind?: 'walk'; level: number }) {
  const s = useStore()
  const t = taskId ? s.tasks.find((x) => x.id === taskId) : undefined
  const jobId = t?.jobId || jid || ''
  const job = s.jobs[jobId]
  const walk = kind === 'walk'
  const crew = (job?.crew || s.bookings.find((b) => b.jobId === jobId)?.crew) as PersonKey | undefined
  const crewName = crew ? PEOPLE[crew].name : 'The crew'
  const withOptions = walk ? [crewName, 'Site super', 'GC'] : ['Designer', 'Homeowner', 'GC']
  const [when, setWhen] = React.useState(walk ? 'Wed' : 'Thu')
  const [time, setTime] = React.useState(walk ? '8 AM' : '10 AM')
  const [where, setWhere] = React.useState('On site')
  const [withWho, setWith] = React.useState(withOptions[0])
  if (!job || (!walk && !t)) return null
  const save = () => (walk ? setWalk(jobId, { when, time, where, with: withWho }) : logMeeting(taskId!, { when, time, where, with: withWho }))
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={walk ? `Walkthrough · ${job.name}` : `Meeting · ${job.name}`}
      sub={walk ? `Walk the rooms with ${crewName} before the start — heights, layouts, and what not to start.` : t?.where ? `${t.where} — the answers get saved to the surfaces, not to a comment` : undefined}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">It leaves your list and comes back on the day.</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<CalendarClock className="h-[1.125rem] w-[1.125rem]" />} onClick={save}>{walk ? 'Set the walkthrough' : 'Set the meeting'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="With">
          <SearchSelect label="With" value={withWho} onChange={setWith} options={withOptions.map((v) => ({ key: v, label: v }))} search={false} width={300} />
        </Field>
        <Field label="When">
          <div className="grid grid-cols-2 gap-2">
            <SearchSelect label="Day" value={when} onChange={setWhen} options={MEET_DAYS().map((v) => ({ key: v.key, label: v.label }))} search={false} width={260} />
            <SearchSelect label="Time" value={time} onChange={setTime} options={MEET_TIMES.map((v) => ({ key: v, label: v }))} search={false} width={200} />
          </div>
        </Field>
        <Field label="Where">
          <SearchSelect label="Where" value={where} onChange={setWhere} options={['On site', 'Showroom', 'Our office', 'Video call'].map((v) => ({ key: v, label: v }))} search={false} width={260} />
        </Field>
      </div>
    </Modal>
  )
}
/* the next two weeks of work days, as people say them — "Tomorrow", "Wed", "Oct 21" — and the times, every half hour */
const MEET_DAYS = () => { const out: { key: string; label: string }[] = []; let d = addDays(TODAY, 1); while (out.length < 10) { if (dow(d) !== 0 && dow(d) !== 6) out.push({ key: labelFromIso(d), label: ['Today', 'Tomorrow'].includes(labelFromIso(d)) ? `${labelFromIso(d)} · ${dayShort(d)}` : dayShort(d) }); d = addDays(d, 1) } return out }
const MEET_TIMES = Array.from({ length: 23 }, (_, i) => 6 * 60 + i * 30).map((m) => `${((Math.floor(m / 60) + 11) % 12) + 1}${m % 60 ? ':30' : ''} ${m >= 720 ? 'PM' : 'AM'}`)

/* ================= wall heights measured on site ================= */
const HEIGHT_OPTS = ['To the ceiling', '84″', '48″', '18″ to the cabinets', '3 ft']
export function HeightsModal({ jobId, taskId, level }: { jobId: string; taskId?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const walls = (s.rooms[jobId] || []).flatMap((r) => r.surfaces.filter((x) => isWall(x.name)).map((x) => ({ room: r.name, sf: x })))
  /* nothing is guessed — each height is what was measured on site */
  const [h, setH] = React.useState<Record<string, string>>({})
  if (!job) return null
  const filled = walls.filter((w) => h[w.room + '::' + w.sf.name])
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title={`Wall heights · ${job.name}`}
      sub="Measured on site. Each height is saved to its wall, and the walls are released to the crew."
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{filled.length} of {walls.length} walls</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!filled.length} icon={<Ruler className="h-[1.125rem] w-[1.125rem]" />} onClick={() => recordHeights(jobId, taskId, filled.map((w) => ({ room: w.room, surface: w.sf.name, height: h[w.room + '::' + w.sf.name] })))}>Save heights</Button>
        </>
      }
    >
      <div className="flex flex-col divide-y divide-line-2 rounded-2xl border border-line">
        {walls.map((w) => {
          const k = w.room + '::' + w.sf.name
          return (
            <div key={k} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3.5">
              <TileImg tile={tileOf(jobId, w.sf.tile)} size={36} />
              <div className="min-w-0 flex-1 basis-[11.25rem]">
                <div className="text-[0.90625rem] font-semibold text-ink">{w.room} · {w.sf.name}</div>
                <div className="text-[0.78125rem] text-muted">{w.sf.height ? `Now: ${w.sf.height}` : w.sf.reason || 'Height not set'}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HEIGHT_OPTS.map((o) => <Chip key={o} on={h[k] === o} onClick={() => setH((p) => ({ ...p, [k]: o }))} className="h-8 px-2.5 text-[0.8125rem]">{o}</Chip>)}
              </div>
            </div>
          )
        })}
        {!walls.length && <div className="px-4 py-6 text-[0.875rem] text-muted">No walls on this project.</div>}
      </div>
    </Modal>
  )
}

/* ================= the installer PO on the project's money tab ================= */
export function InstallerPOCard({ job }: { job: Job }) {
  const s = useStore()
  const ipo = s.ipos.find((p) => p.jobId === job.id)
  if (!ipo)
    return (
      <Card>
        <CardHeader title="Installer PO" sub="What we pay the crew for this project." />
        <div className="px-6 pb-6 max-sm:px-4">
          <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[0.875rem] text-muted">No crew yet — the installer PO goes out when a crew is booked.</div>
        </div>
      </Card>
    )
  const base = ipo.lines.reduce((n, l) => n + l.amount, 0)
  const extra = ipo.changes.filter((c) => c.status !== 'pending').reduce((n, c) => n + c.amount, 0)
  const ST = { pending: { l: 'Waiting on approval', tone: 'warn' as const }, sent: { l: `Sent to ${PEOPLE[ipo.crew].name}`, tone: 'info' as const }, accepted: { l: 'Accepted', tone: 'ok' as const } }
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={`Installer PO · ${ipo.id}`}
        sub={`What we pay ${PEOPLE[ipo.crew].name} for this project. Every change is its own line.`}
        action={<Pill tone="ok" size="md"><HardHat className="h-3.5 w-3.5" />{ipo.status} {ipo.date}</Pill>}
      />
      <div className="border-t border-line-2">
        {ipo.lines.map((l) => (
          <div key={l.item} className="grid grid-cols-[minmax(0,1fr)_auto_5.625rem] items-center gap-4 border-b border-line-2 px-6 py-3 text-[0.875rem] max-sm:px-4">
            <span className="min-w-0 truncate font-medium text-ink">{l.item}</span>
            <span className="text-[0.8125rem] text-muted">{l.qty}</span>
            <span className="text-right font-semibold tnum text-ink">{fmtMoney(l.amount)}</span>
          </div>
        ))}
        {ipo.changes.map((c) => (
          <div key={c.co} className="grid grid-cols-[minmax(0,1fr)_auto_5.625rem] items-center gap-4 border-b border-line-2 bg-vio-50/40 px-6 py-3 text-[0.875rem] max-sm:grid-cols-[minmax(0,1fr)_5.625rem] max-sm:px-4">
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{c.co} · {c.text}</span>
              <span className="block text-[0.78125rem] text-muted">{c.qty}</span>
            </span>
            <span className="max-sm:order-last max-sm:col-span-2"><Pill tone={ST[c.status].tone} size="sm">{ST[c.status].l}</Pill></span>
            <span className={cn('text-right font-semibold tnum', c.status === 'pending' ? 'text-muted' : 'text-ink')}>{c.amount >= 0 ? '+' : '−'}{fmtMoney(Math.abs(c.amount))}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-6 py-3.5 text-[0.875rem] max-sm:px-4">
          <span className="text-muted">Total with approved changes{smp(' · sample amounts')}</span>
          <span className="text-[1rem] font-bold tnum text-ink">{fmtMoney(base + extra)}</span>
        </div>
      </div>
    </Card>
  )
}

/* open a room on a project — reuses the open project window when there is one */
export function openRoom(jobId: string, room: string, view: 'surfaces' | 'log' | 'photos' = 'surfaces', surface?: string) {
  const s = useStore.getState()
  const top = s.modals[s.modals.length - 1]
  const m = { t: 'room', jobId, room, view, surface }
  if (top?.t === 'room' && top.jobId === jobId) s.swap(m)
  else s.open(m)
}

/* tiny helper used by rooms and the overview */
export function openChangeFor(jobId: string, co: string) {
  const s = useStore.getState()
  if (co === 'CO-004' && jobId === '119') return s.open({ t: 'co004' })
  const m = s.money.find((x) => x.jobId === jobId && x.kind === 'change' && x.title.startsWith(co))
  if (m) s.open({ t: 'coapprove', id: m.id })
}

