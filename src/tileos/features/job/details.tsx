/* Job details — the right side of the project, there at any time: what goes on this job.
 *   Tile & grout  — every tile with its picture, where it goes, its grout and joint
 *   Rooms         — each room's square feet, its tile, what it's set on (decided or not) and its layout
 *   People        — the client and their contact, the designer, the installer, our site manager; the dates
 *   Documents     — the latest tile paperwork, the plans, the spec book, photos — open right here */
import * as React from 'react'
import { Camera, ChevronDown, ChevronRight, FileText, Upload, Paperclip, Package, History, Phone, CalendarDays, Grid2x2, Image as ImageIcon } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar, Segmented } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { toast } from '@/tileos/lib/pop'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { GROUTS, JOINTS, byTag, filesFor, type Tile, type Room } from '@/tileos/data/jobs'
import { METHODS } from '@/tileos/data/takeoff'
import { TODAY, labelFromIso } from '@/tileos/lib/today'
import { timeLabel } from '@/tileos/data/calendar'
import { keepFiles } from '@/tileos/lib/files'
import { useSaveStatus } from '@/tileos/lib/save'
import { methodOf } from '../takeoff'
import { takesTile } from '../steps'
import { patchTile, readPhoto } from '../tiles'
import { installerOf } from '../upcoming'
import type { BoardView } from './board'

/** a part of the details: a small title, a count, and one link on the right */
function Part({ title, count, right, children, id }: { title: string; count?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <section data-detail={id} className="px-5 py-3.5 max-sm:px-4">
      {/* the tab above says what it is — here only how many, and the one link */}
      <h4 className="sr-only">{title}</h4>
      {(count != null || right) && (
        <header className="mb-2.5 flex min-h-7 items-center gap-2">
          {count != null && <span className="text-[0.8125rem] text-muted">{count}</span>}
          {right && <span className="ml-auto flex items-center gap-1">{right}</span>}
        </header>
      )}
      {children}
    </section>
  )
}
const LINK = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50'

export type JobTab = 'tiles' | 'rooms' | 'people' | 'files'
/** the job, one section at a time — no long scroll: Tile & grout · Rooms · People · Files */
export function JobPanel({ job, open, tab, setTab }: { job: Job; open: (v: BoardView) => void; tab: JobTab; setTab: (t: JobTab) => void }) {
  const s = useStore()
  const tiles = Object.keys(s.tiles[job.id] || {}).length
  const rooms = (s.rooms[job.id] || []).length
  const files = s.files.filter((f) => f.jobId === job.id).length
  return (
    <div data-details className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-line-2 px-5 pb-3 pt-3.5 max-sm:px-4">
        <Segmented value={tab} onChange={setTab} className="w-full [&>button]:flex-1" items={[
          { key: 'tiles', label: `Tile & grout${tiles ? ` · ${tiles}` : ''}` },
          { key: 'rooms', label: `Rooms${rooms ? ` · ${rooms}` : ''}` },
          { key: 'people', label: 'People' },
          { key: 'files', label: `Files${files ? ` · ${files}` : ''}` },
        ]} />
      </div>
      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto" data-job-tab={tab}>
        {tab === 'tiles' ? <TilesPart job={job} /> : tab === 'rooms' ? <RoomsPart job={job} open={open} /> : tab === 'people' ? <PeoplePart job={job} /> : <DocsPart job={job} open={open} />}
      </div>
    </div>
  )
}

/* ---------------- Tile & grout ---------------- */
const editsTile = (s: Store) => ['owner', 'pm', 'office', 'estimator', 'takeoff'].includes(s.role)
function TilesPart({ job }: { job: Job }) {
  const s = useStore()
  const tiles = Object.values(s.tiles[job.id] || {}).sort(byTag)
  const flat = (s.rooms[job.id] || []).flatMap((r) => r.surfaces.map((x) => ({ room: r.name, x })))
  const used = tiles.filter((t) => flat.some((f) => f.x.tile === t.tag))
  const list = used.length ? [...used, ...tiles.filter((t) => !used.includes(t))] : tiles
  return (
    <Part id="tiles" title="Tile & grout" count={tiles.length ? `${tiles.length} ${tiles.length === 1 ? 'tile' : 'tiles'}` : undefined}>
      {!tiles.length && <div className="rounded-xl border border-dashed border-[#d6cfc3] px-4 py-3 text-[0.84375rem] text-muted">No tile yet — it comes in with the tile paperwork.</div>}
      <div className="flex flex-col gap-1.5">
        {list.map((t) => <TileRow key={t.tag} job={job} t={t} where={flat.filter((f) => f.x.tile === t.tag).map((f) => `${f.room} ${f.x.name.toLowerCase()}`)} />)}
      </div>
    </Part>
  )
}
function TileRow({ job, t, where }: { job: Job; t: Tile; where: string[] }) {
  const s = useStore()
  const can = editsTile(s)
  const ref = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try { patchTile(job.id, t.tag, await readPhoto(f), `${t.tag} picture saved`) } catch (e: any) { toast(e?.message || 'Couldn’t read that picture') }
    setBusy(false)
  }
  const g = t.grout ? GROUTS[t.grout] : undefined
  const pic = !!(t.photo || t.swatch)
  const btn = 'inline-flex h-8 items-center gap-1.5 rounded-[0.5625rem] border border-line bg-white px-2 text-[0.78125rem] font-medium text-ink-2 enabled:hover:bg-wash disabled:cursor-default'
  return (
    <div data-tile={t.tag} className="flex items-center gap-3 rounded-xl border border-[#ece7de] bg-white px-2.5 py-2 max-sm:flex-wrap">
      <button onClick={() => can && ref.current?.click()} disabled={!can && pic} className="group shrink-0" aria-label={`Picture of ${t.tag}`}>
        {pic ? <TileImg tile={t} size={46} radius={9} /> : <span className="inline-flex h-[2.875rem] w-[2.875rem] items-center justify-center rounded-[0.5625rem] border border-dashed border-[#c9ced6] text-faint transition group-hover:border-brand-300 group-hover:text-brand-600"><Camera className="h-5 w-5" /></span>}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.875rem] font-semibold text-ink">{t.tag} {t.name}<span className="font-normal text-muted">{t.size ? ` · ${t.size}` : ''}</span></div>
        <div className="truncate text-[0.75rem] text-muted">{[t.finish, t.maker, t.supplier].filter(Boolean).join(' · ') || 'No details yet'}</div>
        <div className={cn('truncate text-[0.75rem]', where.length ? 'text-ink-2' : 'text-warn-700')}>{where.length ? where.join(', ') : 'Not on a wall or floor yet'}{busy ? ' · saving the picture…' : ''}</div>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 max-sm:ml-[3.625rem]">
        <Menu align="end" width={240} trigger={<button disabled={!can} className={btn} aria-label={`Grout for ${t.tag}`}>{g ? <><GroutDot grout={t.grout} />{g.name}</> : <span className="font-semibold text-warn-700">No grout yet</span>}{can && <ChevronDown className="h-3.5 w-3.5 text-faint" />}</button>}>
          <MenuLabel>Grout for {t.tag}</MenuLabel>
          {Object.entries(GROUTS).map(([k, gg]) => <MenuItem key={k} icon={<GroutDot grout={k} />} checked={t.grout === k} onSelect={() => patchTile(job.id, t.tag, { grout: k }, `${t.tag} · ${gg.name} grout`)}>{gg.name}</MenuItem>)}
        </Menu>
        <Menu align="end" width={170} trigger={<button disabled={!can} className={btn} aria-label={`Joint for ${t.tag}`}>{t.joint || <span className="text-faint">Joint</span>}{can && <ChevronDown className="h-3.5 w-3.5 text-faint" />}</button>}>
          <MenuLabel>Grout joint</MenuLabel>
          {JOINTS.map((j) => <MenuItem key={j} checked={t.joint === j} onSelect={() => patchTile(job.id, t.tag, { joint: j })}>{j}</MenuItem>)}
        </Menu>
      </span>
    </div>
  )
}

/* ---------------- Rooms: square feet, tile, underlayment, layout ---------------- */
function roomFacts(r: Room) {
  const tiled = r.surfaces.filter((x) => x.sf)
  const sf = tiled.reduce((n, x) => n + (x.sf || 0), 0)
  const tags = Array.from(new Set(r.surfaces.map((x) => x.tile).filter(Boolean)))
  const m = tiled.map((x) => methodOf(r.name, x))
  const set = Array.from(new Set(m.filter((y) => !y.auto).map((y) => METHODS[y.key]?.short).filter(Boolean)))
  const open = m.filter((y) => y.auto).length
  const lay = r.surfaces.filter((x) => x.tile && takesTile(x.name))
  const layouts = Array.from(new Set(lay.map((x) => x.layout?.replace(/\s*·.*$/, '')).filter(Boolean))) as string[]
  const noLayout = lay.filter((x) => !x.layout).length
  return { sf, tags, set, open, layouts, noLayout }
}
function RoomsPart({ job, open }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const sf = rooms.flatMap((r) => r.surfaces).reduce((n, x) => n + (x.sf || 0), 0)
  return (
    <Part id="rooms" title="Rooms" count={rooms.length ? `${rooms.length} · ${sf.toLocaleString('en-US')} SF` : undefined} right={rooms.length ? <button onClick={() => open({ t: 'scope' })} className={LINK}><Grid2x2 className="h-3.5 w-3.5" />Scope of work</button> : undefined}>
      {!rooms.length && <div className="rounded-xl border border-dashed border-[#d6cfc3] px-4 py-3 text-[0.84375rem] text-muted">No rooms yet — they come from the estimate.</div>}
      <div className="overflow-hidden rounded-xl border border-[#ece7de] bg-white">
        {rooms.map((r) => {
          const f = roomFacts(r)
          return (
            <button key={r.name} data-room-detail={r.name} onClick={() => open({ t: 'room', name: r.name })} className="flex w-full items-start gap-3 border-t border-line-2 px-3 py-2 text-left transition first:border-t-0 hover:bg-[#f9f7f3]">
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-[0.875rem] font-semibold text-ink">{r.name}</span>
                  <span className="shrink-0 text-[0.75rem] tnum text-muted">{f.sf ? `${f.sf.toLocaleString('en-US')} SF` : ''}{f.tags.length ? ` · ${f.tags.join(', ')}` : ''}</span>
                </span>
                <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.75rem]">
                  <span className="text-ink-2"><span className="text-muted">Underlayment: </span>{f.set.length ? f.set.join(', ') : !f.open ? '—' : ''}{f.open ? <span className="text-warn-700">{f.set.length ? ' · ' : ''}{f.open} to decide</span> : null}</span>
                  <span className="text-ink-2"><span className="text-muted">Layout: </span>{f.layouts.length ? f.layouts.join(', ') : !f.noLayout ? '—' : ''}{f.noLayout ? <span className="text-warn-700">{f.layouts.length ? ' · ' : ''}{f.noLayout} to set</span> : null}</span>
                </span>
              </span>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-faint" />
            </button>
          )
        })}
      </div>
    </Part>
  )
}

/* ---------------- People and dates ---------------- */
function PeoplePart({ job }: { job: Job }) {
  const s = useStore()
  const me = meOf(s.role)
  const client = s.clients[job.clientId]
  const contact = client?.contacts?.[0]
  const designer = s.designers.find((d) => d.clients.includes(job.clientId))
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const site = (job.site || s.team.find((m) => m.role === 'site' && m.status !== 'off')?.key) as PersonKey | undefined
  const b = s.bookings.find((x) => x.jobId === job.id)
  const start = job.dates?.start || (b ? labelFromIso(b.start) : s.prep[job.id]?.targetISO ? labelFromIso(s.prep[job.id]!.targetISO!) : undefined)
  const finish = job.dates?.finish || (b ? labelFromIso(b.end) : undefined)
  const next = s.events.filter((e) => e.jobId === job.id && e.date >= TODAY).sort((a, b2) => (a.date + a.start).localeCompare(b2.date + b2.start))[0]
  const line = (label: string, value: React.ReactNode, sub?: React.ReactNode, who?: PersonKey, phone?: string) => (
    <div className="flex min-h-9 items-center gap-2.5 py-1">
      {who ? <Avatar who={who} size={26} /> : <span className="inline-flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-full bg-wash-2 text-[0.6875rem] font-bold text-muted">{label.charAt(0)}</span>}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[0.71875rem] font-semibold uppercase tracking-[0.04em] text-faint">{label}</span>
        <span className="block truncate text-[0.84375rem] font-medium text-ink">{value}{sub ? <span className="font-normal text-muted"> · {sub}</span> : null}</span>
      </span>
      {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} aria-label={`Call ${label.toLowerCase()}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-white text-muted hover:border-brand-300 hover:text-brand-700"><Phone className="h-3.5 w-3.5" /></a>}
    </div>
  )
  return (
    <Part id="people" title="People & dates">
      <div className="grid grid-cols-2 gap-x-4 max-sm:grid-cols-1">
        {line('Client', <button onClick={() => s.open({ t: 'customer', id: job.clientId })} className="hover:text-brand-700 hover:underline">{job.client}</button>, contact?.name, undefined, contact?.phone || client?.phone)}
        {line('Designer', designer ? designer.name : <span className="text-muted">None on file</span>, undefined, undefined, designer?.phone)}
        {line('Installer', crew ? PEOPLE[crew]?.name : <span className="text-warn-700">Not picked yet</span>, crew && ipo ? `${ipo.id} ${ipo.status === 'Accepted' ? 'accepted' : ipo.status.toLowerCase()}` : undefined, crew)}
        {line('Site manager', site ? (site === me ? 'You' : PEOPLE[site]?.name) : <span className="text-muted">—</span>, undefined, site)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[0.8125rem]">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f6f3ee] px-2.5 py-1.5 text-ink-2"><CalendarDays className="h-3.5 w-3.5 text-faint" />{start ? <>Start <b className="font-semibold text-ink">{start}</b>{finish ? <> · finish <b className="font-semibold text-ink">{finish}</b></> : null}</> : 'No start date yet'}</span>
        {next && <button onClick={() => s.open({ t: 'event', id: next.id })} className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-[#f6f3ee] px-2.5 py-1.5 text-left text-ink-2 hover:bg-[#efebe4]"><span className="text-muted">Next:</span><b className="truncate font-semibold text-ink">{next.title}</b><span className="shrink-0">· {labelFromIso(next.date)} {timeLabel(next.start)}</span></button>}
      </div>
    </Part>
  )
}

/* ---------------- Documents ---------------- */
function DocsPart({ job, open }: { job: Job; open: (v: BoardView) => void }) {
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
  const kindWord = (f: (typeof files)[number]) => (f.kind === 'paperwork' ? 'Tile paperwork' : f.doc || (f.kind === 'plans' ? 'Plans' : 'File'))
  return (
    <Part
      id="docs"
      title="Documents"
      count={n ? `${n}` : undefined}
      right={<>{n > 0 && <button onClick={() => open({ t: 'files' })} className={LINK}>All {n}</button>}<button onClick={() => add.current?.click()} disabled={busy} className={LINK}><Upload className="h-3.5 w-3.5" />{busy ? 'Adding…' : 'Add'}</button></>}
    >
      <input ref={add} type="file" multiple className="hidden" aria-label="Add files — Documents" onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; void upload(f) }} />
      {n === 0 && <button onClick={() => add.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d6cfc3] py-3 text-[0.8125rem] font-medium text-muted hover:border-brand-300 hover:text-brand-700"><Paperclip className="h-4 w-4" />Tile paperwork, plans, photos</button>}
      <div className="-mx-2">
        {[...top, ...rest].map((f) => (
          <button key={f.id} onClick={() => open({ t: 'file', id: f.id })} title={f.name} className={row}>
            {f.thumb ? <img src={f.thumb} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" /> : <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wash text-[0.5625rem] font-bold uppercase text-muted">{(f.name.split('.').pop() || f.kind).slice(0, 4)}</span>}
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.8125rem] font-medium text-ink">{f.name}</span>
              <span className="block truncate text-[0.71875rem] text-muted">{kindWord(f)} · {f.at}</span>
            </span>
          </button>
        ))}
        {files.length < 3 && sample.slice(0, 4 - files.length).map((d) => (
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
