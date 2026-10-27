/* Job details — the right side of the project, there at any time: what goes on this job. Read only — it's what was
 * approved; a change goes through a change order, and what's still open is picked on its track on the left.
 *   Scope of work — every room from the approved estimate and where it really is: ready, not ready (and why),
 *                   installing (how far), stopped, done
 *   Tiles         — every tile with its picture, where it goes, its grout and joint
 *   People        — the client and their contact, the designer, the installer, our site manager; the dates
 *   Documents     — the latest tile paperwork, the plans, the spec book, photos — open right here */
import * as React from 'react'
import { Camera, Check, ChevronDown, ChevronRight, FileText, Upload, Paperclip, Package, History, Phone, Mail, CalendarDays, Grid2x2, Lock, Image as ImageIcon } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar, Segmented } from '@/tileos/components/ui/core'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { GROUTS, byTag, filesFor, tilesOf, surfacePct, SURF_LABEL, type Tile } from '@/tileos/data/jobs'
import { METHODS } from '@/tileos/data/takeoff'
import { methodOf } from '../takeoff'
import { TODAY, labelFromIso } from '@/tileos/lib/today'
import { timeLabel } from '@/tileos/data/calendar'
import { keepFiles, filesOfDoc } from '@/tileos/lib/files'
import { useSaveStatus } from '@/tileos/lib/save'
import { stepsFor, paperQty, takesTile, IN_FIELD_STAGES } from '../steps'
import { installerOf } from '../upcoming'
import { Circle } from '@/tileos/components/ui/page'
import { roomsOf, ROOM_WORD, STEP_SHORT, type RoomView, type RoomCheck, type ChipTone } from '../tracks'
import { roomMedia } from '../field'
import { TODO, todoOf } from '../stepwin'
import type { BoardView } from './board'

/** a part of the details: its title and what it is in one line, one link on the right */
function Part({ title, sub, right, children, id }: { title: string; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <section data-detail={id} className="px-5 py-3.5 max-sm:px-4">
      <header className="mb-2.5 flex min-w-0 items-start gap-2">
        <span className="min-w-0 flex-1 leading-tight">
          <h4 className="text-[0.96875rem] font-semibold text-ink">{title}</h4>
          {sub && <span className="mt-0.5 block text-[0.78125rem] text-muted">{sub}</span>}
        </span>
        {right && <span className="flex shrink-0 items-center gap-1">{right}</span>}
      </header>
      {children}
    </section>
  )
}
const LINK = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50'

export type JobTab = 'scope' | 'tiles' | 'people' | 'files'
/** the job, one section at a time — no long scroll: Scope of work · Tiles · People · Documents */
export function JobPanel({ job, open, tab, setTab, onStep }: { job: Job; open: (v: BoardView) => void; tab: JobTab; setTab: (t: JobTab) => void; /** something still open: the step on its track that gets it */ onStep?: (k: string) => void }) {
  const s = useStore()
  const tiles = Object.keys(s.tiles[job.id] || {}).length
  const rooms = (s.rooms[job.id] || []).length
  const files = s.files.filter((f) => f.jobId === job.id).length
  const n = (x: number) => (x ? <span className="ml-1 font-medium text-muted">{x}</span> : null)
  return (
    <div data-details className="@container flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-line-2 px-5 pb-3 pt-3.5 max-sm:px-4">
        <Segmented value={tab} onChange={setTab} className="w-full [&>button]:min-w-0 [&>button]:flex-1 [&>button]:justify-center [&>button]:whitespace-nowrap [&>button]:px-1.5" items={[
          { key: 'scope', label: <><span className="hidden @[30rem]:inline">Scope of work</span><span className="@[30rem]:hidden">Scope</span>{n(rooms)}</> },
          { key: 'tiles', label: <>Tiles{n(tiles)}</> },
          { key: 'people', label: 'People' },
          { key: 'files', label: <><span className="hidden @[30rem]:inline">Documents</span><span className="@[30rem]:hidden">Docs</span>{n(files)}</> },
        ]} />
      </div>
      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto" data-job-tab={tab}>
        {tab === 'scope' ? <ScopePart job={job} open={open} /> : tab === 'tiles' ? <TilesPart job={job} onStep={onStep} /> : tab === 'people' ? <PeoplePart job={job} onStep={onStep} /> : <DocsPart job={job} open={open} onStep={onStep} />}
      </div>
    </div>
  )
}

/* ---------------- Scope of work: every room, where it really is — tap one for its walls and floors ---------------- */
const CHIP: Record<ChipTone, string> = { bad: 'bg-bad-50 text-bad-700', warn: 'bg-[#fbf2e1] text-warn-700', todo: 'bg-wash-2 text-muted', ok: 'bg-ok-50 text-ok-700' }
function RoomRing({ r, inField }: { r: RoomView; inField: boolean }) {
  const st = r.state === 'done' ? 'done' : r.state === 'stopped' ? 'bad' : r.state === 'installing' ? 'now' : r.state === 'ready' ? 'done' : 'later'
  return <Circle st={{ key: r.room.name, label: r.room.name, state: st, pct: r.state === 'installing' ? Math.max(r.pct, 6) : 0, center: inField ? `${r.pct}%` : '—' }} size={38} />
}
const CHECK_MARK: Record<RoomCheck['state'], React.ReactNode> = {
  ok: <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2c8a5b] text-white"><Check className="h-2.5 w-2.5" strokeWidth={3.6} /></span>,
  todo: <span className="inline-flex h-4 w-4 shrink-0 rounded-full border-[0.09375rem] border-dashed border-[#bfb8ad] bg-white" />,
  bad: <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d7342a] text-[0.625rem] font-black text-white">!</span>,
}
function ScopePart({ job, open }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const steps = stepsFor(s, job)
  const rooms = roomsOf(s, job, steps)
  const inField = IN_FIELD_STAGES.includes(job.stage)
  const est = s.estimates.find((e) => e.jobId === job.id && e.status === 'approved')
  const sf = rooms.reduce((n, r) => n + r.sf, 0)
  const ready = rooms.filter((r) => r.state === 'ready').length
  const done = rooms.filter((r) => r.state === 'done').length
  const confirmed = ['done', 'na'].includes(steps.find((v) => v.key === 'change')?.state || '') || inField
  const [openRoom, setOpenRoom] = React.useState<string | null>(null)
  return (
    <Part
      id="scope"
      title="Scope of work"
      sub={rooms.length ? <><b className="font-semibold text-ink-2">{inField ? `${done} of ${rooms.length} rooms done` : `${ready} of ${rooms.length} rooms ready`}</b>{sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}{est ? ` · from estimate ${est.id}` : ''} · tap a room for its walls and floors</> : 'Every room from the approved estimate'}
      right={rooms.length ? <button onClick={() => open({ t: 'scope' })} className={LINK}><Grid2x2 className="h-3.5 w-3.5" />Every wall & floor</button> : undefined}
    >
      {!rooms.length && <div className="rounded-xl border border-dashed border-[#d6cfc3] px-4 py-3 text-[0.84375rem] text-muted">No rooms yet — they come from the approved estimate.</div>}
      <div className="flex flex-col gap-1.5">
        {rooms.map((r) => {
          const chips = r.state === 'ready' ? [{ tone: 'ok' as ChipTone, text: 'Ready' }] : r.chips
          const on = openRoom === r.room.name
          return (
            <div key={r.room.name} data-room={r.room.name} data-room-state={r.state} className={cn('overflow-hidden rounded-xl border bg-white', on ? 'border-[#d8d1c5] shadow-card' : 'border-[#ece7de]')}>
              <button onClick={() => setOpenRoom(on ? null : r.room.name)} aria-expanded={on} className="flex w-full min-w-0 items-center gap-3 px-2.5 py-2 text-left transition hover:bg-[#fbfaf7] max-sm:flex-wrap max-sm:gap-2" data-room-head>
                <RoomRing r={r} inField={inField} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[0.90625rem] font-semibold text-ink">{r.room.name}</span>
                  <span className={cn('block truncate text-[0.75rem]', r.state === 'installing' ? 'text-brand-700' : r.state === 'done' ? 'text-[#2c8a5b]' : 'text-muted')}>{ROOM_WORD[r.state] ? `${ROOM_WORD[r.state]} · ` : ''}{r.sub}</span>
                </span>
                {chips.length > 0 && (
                  <span className="flex min-w-0 max-w-[52%] shrink items-center justify-end gap-1 max-sm:ml-[3.125rem] max-sm:max-w-none max-sm:basis-full max-sm:justify-start" data-chips>
                    {chips.slice(0, 2).map((c) => <span key={c.text} data-chip={c.tone} title={c.text} className={cn('min-w-0 truncate rounded-full px-2 py-0.5 text-[0.71875rem] font-semibold', CHIP[c.tone])}>{c.text}</span>)}
                    {chips.length > 2 && <span title={chips.slice(2).map((c) => c.text).join(' · ')} className="shrink-0 rounded-full bg-wash-2 px-1.5 py-0.5 text-[0.71875rem] font-semibold text-muted">+{chips.length - 2}</span>}
                  </span>
                )}
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-faint transition max-sm:hidden', on && 'rotate-180')} />
              </button>
              {on && <RoomBody job={job} r={r} inField={inField} onOpen={(tab) => open({ t: 'room', name: r.room.name, tab })} />}
            </div>
          )
        })}
      </div>
      {rooms.length > 0 && confirmed && <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#f6f3ee] px-3 py-2 text-[0.78125rem] text-muted" data-scope-locked><Lock className="h-3.5 w-3.5 shrink-0 text-faint" />The scope is set — a change goes through a change order.</div>}
    </Part>
  )
}
/** a room, open: what it still needs before the crew (or how far it is), and every wall and floor — its tile, square
 *  feet, layout and what it's set on */
function RoomBody({ job, r, inField, onOpen }: { job: Job; r: RoomView; inField: boolean; onOpen: (tab: 'log' | 'photos') => void }) {
  const s = useStore()
  const entries = (s.diary[job.id] || []).filter((e) => e.rooms.some((x) => x.room === r.room.name)).length
  const photos = roomMedia(s.diary[job.id], r.room.name).length
  return (
    <div className="border-t border-line-2 bg-[#fcfbf9] px-3 pb-3 pt-2.5" data-room-body>
      {r.checks.length > 0 && (
        <div className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1 max-sm:grid-cols-1" data-room-checks>
          {r.checks.map((c) => (
            <span key={c.label} data-check={c.state} className="flex min-w-0 items-center gap-1.5 text-[0.78125rem]">
              {CHECK_MARK[c.state]}
              <span className={cn('truncate', c.state === 'bad' ? 'font-semibold text-bad-700' : c.state === 'ok' ? 'text-ink-2' : 'text-muted')}>{c.label}{c.note && c.state !== 'ok' ? ` — ${c.note}` : ''}</span>
            </span>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-[#ece7de] bg-white">
        {r.room.surfaces.map((x) => {
          const t = tilesOf(job.id).find((y) => y.tag === x.tile)
          const m = methodOf(r.room.name, x)
          const set = x.sf ? `${METHODS[m.key]?.short || m.key}${m.auto ? ' (suggested)' : ''}` : ''
          return (
            <div key={x.name} data-surface-row={x.name} className="flex min-w-0 items-center gap-2.5 border-t border-line-2 px-2.5 py-1.5 first:border-t-0">
              <TileImg tile={t} size={26} radius={6} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[0.8125rem] font-semibold text-ink">{x.name}<span className="font-normal text-muted"> · {t ? `${t.tag} ${t.name}` : x.tile || 'no tile yet'}{x.sf ? ` · ${x.sf} SF` : ''}</span></span>
                <span className="block truncate text-[0.71875rem] text-muted">{[x.layout ? `Layout: ${x.layout.replace(/\s*·.*$/, '')}` : takesTile(x.name) ? 'Layout: not set' : '', set ? `On: ${set}` : '', inField ? (x.state === 'working' ? `${surfacePct(x)}% in` : SURF_LABEL[x.state]) : ''].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
          )
        })}
      </div>
      {(entries > 0 || photos > 0)
        ? (
          <div className="mt-2 flex justify-end gap-1" data-room-links>
            {entries > 0 && <button onClick={() => onOpen('log')} className={LINK}><History className="h-3.5 w-3.5" />Daily log · {entries}</button>}
            {photos > 0 && <button onClick={() => onOpen('photos')} className={LINK}><ImageIcon className="h-3.5 w-3.5" />Photos · {photos}</button>}
          </div>
        )
        : inField ? <div className="mt-2 text-right text-[0.75rem] text-faint">No daily log or photos for this room yet</div> : null}
    </div>
  )
}

/* ---------------- Tiles: read only — what's missing opens its step ---------------- */
function TilesPart({ job, onStep }: { job: Job; onStep?: (k: string) => void }) {
  const s = useStore()
  const tiles = Object.values(s.tiles[job.id] || {}).sort(byTag)
  const flat = (s.rooms[job.id] || []).flatMap((r) => r.surfaces.map((x) => ({ room: r.name, x })))
  const used = tiles.filter((t) => flat.some((f) => f.x.tile === t.tag))
  const list = used.length ? [...used, ...tiles.filter((t) => !used.includes(t))] : tiles
  return (
    <Part id="tiles" title="Tiles" sub={tiles.length ? `${tiles.length} ${tiles.length === 1 ? 'tile' : 'tiles'} — where each goes, its grout, how much, and whether it’s here` : 'Every tile on the job'}>
      {!tiles.length && <div className="rounded-xl border border-dashed border-[#d6cfc3] px-4 py-3 text-[0.84375rem] text-muted">No tile yet — it comes in with the tile paperwork.</div>}
      <div className="flex flex-col gap-1.5">
        {list.map((t) => <TileRow key={t.tag} job={job} t={t} where={flat.filter((f) => f.x.tile === t.tag).map((f) => `${f.room} ${f.x.name.toLowerCase()}`)} onStep={onStep} />)}
      </div>
    </Part>
  )
}
function TileRow({ job, t, where, onStep }: { job: Job; t: Tile; where: string[]; onStep?: (k: string) => void }) {
  const s = useStore()
  const g = t.grout ? GROUTS[t.grout] : undefined
  const pic = !!(t.photo || t.swatch)
  const pick = () => onStep?.('tile')
  const q = paperQty(s, job.id, t)
  const c = s.checks.find((x) => x.jobId === job.id && x.tag === t.tag)
  const unit = q.unit === 'boxes' ? 'boxes' : 'SF'
  const qty = q.have != null ? <>{q.have.toLocaleString('en-US')} {unit} on the paperwork{q.need != null ? <> · we need {q.need.toLocaleString('en-US')}{q.short > 0 ? <b className="font-semibold text-bad-600"> — {q.short.toLocaleString('en-US')} short</b> : ''}</> : null}</> : q.need != null ? <>We need {q.need.toLocaleString('en-US')} {unit} · <span className="text-warn-700">not on the paperwork yet</span></> : null
  const here = c ? (c.received >= c.ordered ? { t: `On site — ${c.received} ${c.unit}`, c: 'text-[#2c8a5b]' } : c.received > 0 ? { t: `Short — ${c.received} of ${c.ordered} ${c.unit} here`, c: 'font-semibold text-bad-600' } : { t: c.eta ? `Coming ${c.eta.replace(/^\w+,\s*/, '')}` : 'Ordered — no date yet', c: 'text-warn-700' }) : null
  return (
    <div data-tile={t.tag} className="flex items-start gap-3 rounded-xl border border-[#ece7de] bg-white px-2.5 py-2">
      {pic ? <TileImg tile={t} size={46} radius={9} /> : <button onClick={pick} aria-label={`Picture of ${t.tag}`} className="inline-flex h-[2.875rem] w-[2.875rem] shrink-0 items-center justify-center rounded-[0.5625rem] border border-dashed border-[#c9ced6] text-faint hover:border-brand-300 hover:text-brand-600"><Camera className="h-5 w-5" /></button>}
      <div className="min-w-0 flex-1 leading-snug">
        <div className="truncate text-[0.875rem] font-semibold text-ink">{t.tag} {t.name}<span className="font-normal text-muted">{t.size ? ` · ${t.size}` : ''}</span></div>
        <div className={cn('truncate text-[0.75rem]', where.length ? 'text-ink-2' : 'text-warn-700')}>{where.length ? where.join(', ') : 'Not on a wall or floor yet'}</div>
        {qty && <div className="truncate text-[0.75rem] text-muted" data-tile-qty>{qty}</div>}
        {here && <div className={cn('truncate text-[0.75rem]', here.c)} data-tile-here>{here.t}</div>}
      </div>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-[0.78125rem]">
        {g ? <span className="inline-flex items-center gap-1.5 font-medium text-ink-2"><GroutDot grout={t.grout} />{g.name}</span> : <button onClick={pick} className="font-semibold text-warn-700 hover:underline">No grout yet</button>}
        {t.joint && <span className="text-muted">{t.joint} joint</span>}
      </span>
    </div>
  )
}

/* ---------------- People: who's on the job, how to reach them, and what each one has on it now ---------------- */
type Has = { key: string; what: string; state: 'now' | 'wait' | 'bad'; when: string; late?: boolean; go: () => void }
function PeoplePart({ job, onStep }: { job: Job; onStep?: (k: string) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const client = s.clients[job.clientId]
  const contact = client?.contacts?.[0]
  const designer = s.designers.find((d) => d.clients.includes(job.clientId))
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const b = s.bookings.find((x) => x.jobId === job.id)
  const start = job.dates?.start || (b ? labelFromIso(b.start) : s.prep[job.id]?.targetISO ? labelFromIso(s.prep[job.id]!.targetISO!) : undefined)
  const finish = job.dates?.finish || (b ? labelFromIso(b.end) : undefined)
  const next = s.events.filter((e) => e.jobId === job.id && e.date >= TODAY).sort((a, b2) => (a.date + a.start).localeCompare(b2.date + b2.start))[0]
  /* our people, each with what they have open on this job now */
  const steps = stepsFor(s, job).filter((v) => v.state === 'now' || v.state === 'bad' || v.state === 'wait')
  const tasks = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done' && !t.step)
  const ours = Array.from(new Set([...steps.map((v) => v.owner), ...tasks.map((t) => t.owner)])).filter((p) => p && PEOPLE[p])
  /* each of ours, what they have on this job: what it is, where it stands, when — tap one and it opens */
  const has = (p: PersonKey): Has[] => [
    ...steps.filter((v) => v.owner === p).map((v): Has => ({ key: 's:' + v.key, what: todoOf(v), state: v.state === 'bad' ? 'bad' : v.state === 'wait' ? 'wait' : 'now', when: v.state === 'wait' ? (v.due ? `waiting · back ${labelFromIso(v.due)}` : 'waiting') : v.due ? (v.due < TODAY ? `was due ${labelFromIso(v.due)}` : `due ${labelFromIso(v.due)}`) : '', late: !!v.due && v.due < TODAY && v.state !== 'wait', go: () => onStep?.(v.key) })),
    ...tasks.filter((t) => t.owner === p).map((t): Has => ({ key: 't:' + t.id, what: t.title, state: t.tone === 'bad' ? 'bad' : t.state === 'waiting' ? 'wait' : 'now', when: t.state === 'waiting' ? `waiting${t.followUp ? ` · back ${t.followUp}` : ''}` : t.due ? `due ${t.due}` : '', go: () => s.open({ t: 'task', id: t.id }) })),
  ]
  const [openP, setOpenP] = React.useState<PersonKey | null>(null)
  const call = (phone?: string, label = '') => phone ? <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} aria-label={`Call ${label}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-white text-muted hover:border-brand-300 hover:text-brand-700"><Phone className="h-3.5 w-3.5" /></a> : null
  const mail = (email?: string, label = '') => email ? <a href={`mailto:${email}`} aria-label={`Email ${label}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-white text-muted hover:border-brand-300 hover:text-brand-700"><Mail className="h-3.5 w-3.5" /></a> : null
  const row = (label: string, value: React.ReactNode, sub?: React.ReactNode, who?: PersonKey, end?: React.ReactNode) => (
    <div className="flex min-h-10 items-center gap-2.5 border-t border-line-2 px-3 py-1.5 first:border-t-0" data-person={label}>
      {who ? <Avatar who={who} size={28} /> : <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wash-2 text-[0.6875rem] font-bold text-muted">{label.charAt(0)}</span>}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-faint">{label}</span>
        <span className="block truncate text-[0.84375rem] font-medium text-ink">{value}{sub ? <span className="font-normal text-muted"> · {sub}</span> : null}</span>
      </span>
      {end}
    </div>
  )
  return (
    <Part id="people" title="People" sub="Who’s on this job, how to reach them — and what each of ours has on it now">
      <div className="overflow-hidden rounded-xl border border-[#ece7de] bg-white">
        {row('Client', <button onClick={() => s.open({ t: 'customer', id: job.clientId })} className="hover:text-brand-700 hover:underline">{job.client}</button>, contact ? `${contact.name}${contact.role ? `, ${contact.role.toLowerCase()}` : ''}` : undefined, undefined, <span className="flex gap-1">{mail(contact?.email || client?.email, 'the client')}{call(contact?.phone || client?.phone, 'the client')}</span>)}
        {row('Designer', designer ? designer.name : <span className="text-muted">None on file</span>, undefined, undefined, call(designer?.phone, 'the designer'))}
        {row('Installer', crew ? PEOPLE[crew]?.name : <span className="text-warn-700">Not picked yet</span>, crew && ipo ? `${ipo.id} ${ipo.status === 'Accepted' ? 'accepted' : ipo.status.toLowerCase()}` : undefined, crew)}
      </div>
      <div className="mb-1.5 mt-3.5 text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-faint">Ours — what each has now</div>
      <div className="overflow-hidden rounded-xl border border-[#ece7de] bg-white" data-ours>
        {!ours.length && <div className="px-3 py-2.5 text-[0.8125rem] text-muted">Nothing open on this job.</div>}
        {ours.map((p) => {
          const list = has(p)
          const on = openP === p
          return (
            <div key={p} data-our={p} className="border-t border-line-2 first:border-t-0">
              <button onClick={() => setOpenP(on ? null : p)} aria-expanded={on} className="flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#fbfaf7]">
                <Avatar who={p} size={28} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[0.84375rem] font-semibold text-ink">{p === me ? 'You' : PEOPLE[p]?.name}<span className="font-normal text-muted">{PEOPLE[p]?.roleLabel ? ` · ${PEOPLE[p]?.roleLabel}` : ''}</span></span>
                  {!on && <span className="block truncate text-[0.75rem] text-muted">{list.slice(0, 2).map((x) => x.what).join(' · ')}{list.length > 2 ? ` · +${list.length - 2}` : ''}</span>}
                </span>
                <span className={cn('shrink-0 rounded-full px-1.5 text-[0.71875rem] font-bold tnum', list.some((x) => x.state === 'bad' || x.late) ? 'bg-bad-50 text-bad-700' : 'bg-wash-2 text-ink-2')}>{list.length}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-faint transition', on && 'rotate-180')} />
              </button>
              {on && (
                <div className="border-t border-line-2 bg-[#fcfbf9] py-1" data-our-list>
                  {list.map((x) => (
                    <button key={x.key} onClick={x.go} data-has={x.key} className="flex w-full min-w-0 items-center gap-2.5 py-1.5 pl-[3.25rem] pr-3 text-left transition hover:bg-[#f4f1ec]">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', x.state === 'bad' ? 'bg-[#d7342a]' : x.state === 'wait' ? 'bg-[#d98c0b]' : p === me ? 'bg-[#2650cf]' : 'bg-[#3f4654]')} />
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink">{x.what}</span>
                      {x.when && <span className={cn('shrink-0 text-[0.75rem]', x.late || x.state === 'bad' ? 'font-semibold text-bad-600' : x.state === 'wait' ? 'text-warn-700' : 'text-muted')}>{x.when}</span>}
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[0.8125rem]">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f6f3ee] px-2.5 py-1.5 text-ink-2"><CalendarDays className="h-3.5 w-3.5 text-faint" />{start ? <>Start <b className="font-semibold text-ink">{start}</b>{finish ? <> · finish <b className="font-semibold text-ink">{finish}</b></> : null}</> : 'No start date yet'}</span>
        {next && <button onClick={() => s.open({ t: 'event', id: next.id })} className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-[#f6f3ee] px-2.5 py-1.5 text-left text-ink-2 hover:bg-[#efebe4]"><span className="text-muted">Next:</span><b className="truncate font-semibold text-ink">{next.title}</b><span className="shrink-0">· {labelFromIso(next.date)} {timeLabel(next.start)}</span></button>}
      </div>
    </Part>
  )
}

/* ---------------- Documents ---------------- */
function DocsPart({ job, open, onStep }: { job: Job; open: (v: BoardView) => void; onStep?: (k: string) => void }) {
  const s = useStore()
  const save = useSaveStatus()
  const money = !['site', 'crew'].includes(s.role)
  const files = s.files.filter((f) => f.jobId === job.id)
  const sample = save.mode === 'sample' && save.where !== 'cloud' ? filesFor(job.id).filter((d) => d.current) : []
  const add = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const upload = async (list: File[]) => {
    if (!list.length) return
    setBusy(true)
    const photos = list.filter((f) => f.type.startsWith('image/'))
    const other = list.filter((f) => !f.type.startsWith('image/'))
    if (photos.length) await keepFiles(job.id, photos, 'photo')
    if (other.length) await keepFiles(job.id, other, /paperwork|selection|tile/i.test(other[0].name) ? 'paperwork' : /plan|drawing|arch/i.test(other[0].name) ? 'plans' : 'other')
    setBusy(false)
  }
  /* the latest of each kind first: the tile paperwork, the plans, the spec book — then the rest */
  const last = <T,>(l: T[]) => l[l.length - 1]
  const paper = last(files.filter((f) => f.kind === 'paperwork'))
  const plans = last(files.filter((f) => f.kind === 'plans' || f.doc === 'Plans'))
  const spec = last(files.filter((f) => f.doc === 'Spec book'))
  const photos = files.filter((f) => f.kind === 'photo')
  const top = [paper, plans, spec].filter(Boolean) as typeof files
  const rest = files.filter((f) => !top.includes(f) && f.kind !== 'photo').slice(-3).reverse()
  const n = files.length + sample.length
  const row = 'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#f6f3ee]'
  /* the papers the job has by name — each one here (tap to open it) or missing; never a step */
  const rooms = s.rooms[job.id] || []
  const sf = rooms.reduce((a, r) => a + r.surfaces.reduce((b, x) => b + (x.sf || 0), 0), 0)
  const asked = s.pricing[job.id]?.docs || []
  const tiles = Object.keys(s.tiles[job.id] || {}).length
  const sampleOf = (k: string) => sample.find((d) => d.kind === k)
  const sp = sampleOf('paperwork')
  type Paper = { name: string; here: boolean; sub: string; go: () => void }
  const NAMED: [string, string][] = [['Plans', 'plans'], ['Spec book', 'spec'], ['Finish schedule', 'finish']]
  const papers: Paper[] = [
    { name: 'Tile paperwork', here: !!paper || !!sp, sub: paper ? `${paper.name} · ${paper.at}` : sp ? `${sp.name} · ${sp.date}` : tiles ? `${tiles} ${tiles === 1 ? 'tile' : 'tiles'} entered — no file kept · tap to add it` : 'missing — tap to add it', go: () => (paper ? open({ t: 'doc', doc: 'Tile paperwork' }) : sp ? open({ t: 'files' }) : open({ t: 'doc', doc: 'Tile paperwork' })) },
    ...(rooms.length ? [{ name: 'Scope of work', here: true, sub: `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}`, go: () => open({ t: 'scope' }) }] : []),
    ...NAMED.flatMap(([doc, kind]): Paper[] => {
      const a = asked.find((d) => d.name === doc)
      const f = last(filesOfDoc(files, job.id, doc))
      const smp = sampleOf(kind)
      if (!a && !f && !smp) return []
      const here = !!f || !!smp || (!!a && a.status !== 'missing')
      return [{ name: doc, here: !!f || !!smp, sub: f ? `${f.name} · ${f.at}` : smp ? `${smp.rev} · ${smp.date}` : a && a.status !== 'missing' ? `${a.note || 'Came in'} — no file kept · tap to add it` : 'missing — tap to add it', go: () => (!f && smp ? open({ t: 'files' }) : open({ t: 'doc', doc })) }]
    }),
    ...asked.filter((d) => !NAMED.some(([x]) => x === d.name)).map((d) => { const f = last(filesOfDoc(files, job.id, d.name)); return { name: d.name, here: !!f, sub: f ? `${f.name} · ${f.at}` : d.status === 'missing' ? 'missing — tap to add it' : `${d.note || 'Came in'} — no file kept · tap to add it`, go: () => open({ t: 'doc', doc: d.name }) } }),
  ]
  const namedKinds = ['paperwork', 'plans', 'spec', 'finish']
  const named = new Set([...files.filter((f) => f.kind === 'paperwork').map((f) => f.id), ...NAMED.flatMap(([d]) => filesOfDoc(files, job.id, d).map((f) => f.id)), ...asked.flatMap((d) => filesOfDoc(files, job.id, d.name).map((f) => f.id))])
  const kindWord = (f: (typeof files)[number]) => (f.kind === 'paperwork' ? 'Tile paperwork' : f.doc || (f.kind === 'plans' ? 'Plans' : 'File'))
  return (
    <Part
      id="docs"
      title="Documents"
      right={<>{n > 0 && <button onClick={() => open({ t: 'files' })} className={LINK}>All {n}</button>}<button onClick={() => add.current?.click()} disabled={busy} className={LINK}><Upload className="h-3.5 w-3.5" />{busy ? 'Adding…' : 'Add'}</button></>}
    >
      <input ref={add} type="file" multiple className="hidden" aria-label="Add files — Documents" onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; void upload(f) }} />
      <div className="-mx-2 mb-1.5 border-b border-line-2 pb-1.5" data-papers>
        {papers.map((d) => (
          <button key={d.name} onClick={d.go} data-paper={d.name} data-here={d.here || undefined} className={row}>
            <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md', d.here ? 'bg-brand-50 text-brand-600' : 'border border-dashed border-warn-300 bg-[#fffaf0] text-warn-700')}>{d.here ? <FileText className="h-4 w-4" /> : <Upload className="h-3.5 w-3.5" />}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] font-semibold text-ink"><span className="truncate">{d.name}</span>{d.here && <Check className="h-3.5 w-3.5 shrink-0 text-ok-600" strokeWidth={3} />}</span>
              <span className={cn('block truncate text-[0.71875rem]', d.here ? 'text-muted' : 'font-medium text-warn-700')}>{d.sub}</span>
            </span>
            {d.here && <ChevronRight className="h-4 w-4 shrink-0 text-faint" />}
          </button>
        ))}
      </div>
      {n === 0 && <button onClick={() => add.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d6cfc3] py-3 text-[0.8125rem] font-medium text-muted hover:border-brand-300 hover:text-brand-700"><Paperclip className="h-4 w-4" />Photos and other files</button>}
      <div className="-mx-2">
        {[...top, ...rest].filter((f) => !named.has(f.id)).map((f) => (
          <button key={f.id} onClick={() => open({ t: 'file', id: f.id })} title={f.name} className={row}>
            {f.thumb ? <img src={f.thumb} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" /> : <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wash text-[0.5625rem] font-bold uppercase text-muted">{(f.name.split('.').pop() || f.kind).slice(0, 4)}</span>}
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.8125rem] font-medium text-ink">{f.name}</span>
              <span className="block truncate text-[0.71875rem] text-muted">{kindWord(f)} · {f.at}</span>
            </span>
          </button>
        ))}
        {files.length < 3 && sample.filter((d) => !namedKinds.includes(d.kind)).slice(0, 4 - files.length).map((d) => (
          <button key={d.name} onClick={() => open({ t: 'files' })} title={d.name} className={row}>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wash text-muted"><FileText className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.8125rem] font-medium text-ink">{d.name}</span>
              <span className="block truncate text-[0.71875rem] text-muted">{d.rev} · {d.date}</span>
            </span>
          </button>
        ))}
        {photos.length > 0 && (
          <button onClick={() => open({ t: 'files' })} className={row}>
            <span className="flex shrink-0 -space-x-2">{photos.slice(-3).map((p) => p.thumb ? <img key={p.id} src={p.thumb} alt="" className="h-8 w-8 rounded-md object-cover ring-2 ring-white" /> : <span key={p.id} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-wash ring-2 ring-white"><ImageIcon className="h-3.5 w-3.5 text-faint" /></span>)}</span>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink">{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1 border-t border-line-2 pt-2">
        {money && <button onClick={() => open({ t: 'orders' })} className={LINK}><Package className="h-3.5 w-3.5" />All the orders</button>}
        <button onClick={() => open({ t: 'log' })} className={LINK}><History className="h-3.5 w-3.5" />What happened</button>
      </div>
    </Part>
  )
}
