/* The Scope tab — everything about what we install, read at a glance:
 *   the tiles on the project (a card each: picture, size, grout, where it goes, is it here)
 *   then every wall and floor, by room (or by tile): tile · grout · layout · what goes under it · edge or metal · SF · status
 * Tap a wall or floor to change it (one window of dropdowns); tap a tile to change the tile. */
import * as React from 'react'
import { Plus, FileText, Ruler, Sparkles, Camera, Trash2, ChevronRight, Layers3, Building2, ImagePlus, AlertTriangle, PauseCircle, Clock3, Ban, ArrowLeftRight, Lock, Unlock } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Button, Segmented, TextInput, TextArea } from '@/tileos/components/ui/core'
import { Modal, Pop, Tip } from '@/tileos/components/ui/overlay'
import { Status } from '@/tileos/components/ui/page'
import { SearchSelect, MultiSelect } from '@/tileos/components/ui/select'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { toast } from '@/tileos/lib/pop'
import { PEOPLE, type Job, type Tone } from '@/tileos/data/model'
import { GROUTS, JOINTS, SURF_TONE, surfacePct, roomPct, tilesOf, tileOf, floorsOf, type Room, type Surface, type Tile } from '@/tileos/data/jobs'
import { needWithWaste } from '@/tileos/data/work'
import { METHODS, type MethodKey } from '@/tileos/data/takeoff'
import { methodOf, suggestMethod, methodsFor, kindOf } from '../takeoff'
import { settingStatus } from '../setting'
import { scopeLock, takesTile } from '../steps'
import { surfaceFix } from './overview'
import { LayoutArt } from './rooms'
import {
  saveTile, removeTile, saveSurface, addGrout, readPhoto, nextTag, refKey, splitLayout, joinLayout, isMetal,
  TILE_SIZES, FINISHES, WHO_ORDERS, PATTERNS, STARTS, EDGES, HEIGHTS,
} from '../tiles'

const SURF_STATUS: Record<string, string> = { done: 'Done', working: 'Working', ready: 'Ready', blocked: 'Blocked', waitmat: 'Waiting material', hold: 'On hold', notstarted: 'Later', unknown: 'To verify' }
const IN_FIELD = ['scheduled', 'installation', 'punch', 'closeout', 'complete']

/* ---------------- where a tile stands: ordered? here? short? ---------------- */
export function tileStatus(s: Pick<Store, 'checks' | 'shortages' | 'rooms'>, jobId: string, tag: string): { tone: Tone; label: string } {
  const sh = s.shortages.find((x) => x.jobId === jobId && x.tag === tag && x.step !== 'received')
  if (sh) return { tone: 'bad', label: sh.step === 'short' ? `${sh.qty} ${sh.unit} short` : `Reordered · ${sh.eta || 'coming'}` }
  const c = s.checks.find((y) => y.jobId === jobId && y.tag === tag)
  const sf = (s.rooms[jobId] || []).flatMap((r) => r.surfaces).filter((x) => x.tile === tag).reduce((n, x) => n + (x.sf || 0), 0)
  if (!c) return sf ? { tone: 'warn', label: 'Not ordered yet' } : { tone: 'neutral', label: 'Not on a wall or floor yet' }
  const need = needWithWaste(c)
  if (c.ordered < need) return { tone: 'bad', label: `Order is ${need - c.ordered} ${c.unit} short` }
  if (c.received >= c.ordered) return { tone: 'ok', label: 'On site' }
  if (c.received > 0) return { tone: 'warn', label: `${c.received} of ${c.ordered} ${c.unit} here` }
  return { tone: 'info', label: c.eta && c.eta !== 'TBD' ? `Ordered · due ${c.eta}` : 'Ordered' }
}
const usesOf = (rooms: Room[], tag: string) => rooms.flatMap((r) => r.surfaces.filter((x) => x.tile === tag).map((x) => ({ room: r, x })))

/* ================= the tab ================= */
export function ScopeTab({ job }: { job: Job }) {
  const s = useStore()
  const [view, setView] = React.useState<'room' | 'tile'>('room')
  const rooms = s.rooms[job.id] || []
  const flat = rooms.flatMap((r) => r.surfaces)
  const sfTotal = flat.reduce((n, x) => n + (x.sf || 0), 0)
  const set = settingStatus(s, job.id)
  const unset = set.total - set.set
  if (!rooms.length)
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Building2 className="h-6 w-6" /></span>
        <div className="text-[1rem] font-semibold text-ink">No rooms yet</div>
        <div className="mt-1 max-w-sm text-[0.875rem] text-muted">When an estimate is approved its rooms come over by themselves. For this one, build them from the paperwork.</div>
        <Button className="mt-4" variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'buildrooms', jobId: job.id })}>Build rooms</Button>
      </div>
    )
  return (
    <div className="flex flex-col gap-5">
      <ScopeLockBar job={job} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <Segmented value={view} onChange={setView} items={[{ key: 'room', label: 'By room' }, { key: 'tile', label: 'By tile' }]} />
        <span className="text-[0.84375rem] text-muted">
          <b className="font-semibold text-ink">{rooms.length}</b> rooms · <b className="font-semibold text-ink">{flat.length}</b> walls and floors{sfTotal ? <> · <b className="font-semibold text-ink">{sfTotal.toLocaleString('en-US')}</b> SF</> : null}
        </span>
        <div className="ml-auto flex gap-2 max-sm:ml-0">
          <Button size="sm" icon={<FileText />} onClick={() => s.open({ t: 'sow', jobId: job.id })}>Scope of work</Button>
        </div>
      </div>
      {unset > 0 && !IN_FIELD.includes(job.stage) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[0.75rem] border border-warn-100 bg-warn-50/70 px-4 py-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-warn-600" />
          <span className="min-w-0 flex-1 text-[0.84375rem] text-ink-2"><b className="font-semibold text-ink">What goes under the tile</b> is suggested on {unset} of {set.total} walls and floors — confirm it and the materials are worked out from it.</span>
          <Button size="sm" variant="outline" icon={<Layers3 />} onClick={() => s.open({ t: 'setting', jobId: job.id })}>Confirm it</Button>
        </div>
      )}
      {view === 'room' ? (
        <>
          <TileStrip job={job} />
          <ByRoom job={job} />
        </>
      ) : (
        <ByTile job={job} />
      )}
    </div>
  )
}

/* ---------------- whose scope it is, and whether you can change it ---------------- */
export function ScopeLockBar({ job }: { job: Job }) {
  const s = useStore()
  const lock = scopeLock(s, job.id)
  const me = meOf(s.role)
  const who = PEOPLE[lock.owner]?.short || 'its owner'
  if (!lock.done) return <div className="flex items-center gap-2.5 rounded-[0.75rem] bg-wash px-4 py-2.5 text-[0.84375rem] text-ink-2"><Unlock className="h-4 w-4 shrink-0 text-faint" /><span>The scope is <b className="font-semibold text-ink">{lock.owner === me ? 'yours' : `${who}’s`}</b> — it locks when the tile paperwork is entered. Until then it can be filled in.</span></div>
  return (
    <div className={cn('flex items-center gap-2.5 rounded-[0.75rem] px-4 py-2.5 text-[0.84375rem]', lock.canEdit ? 'bg-brand-50/70 text-brand-800' : 'bg-wash text-ink-2')}>
      <Lock className="h-4 w-4 shrink-0" />
      <span>{lock.canEdit ? <>Locked — it’s <b className="font-semibold">your</b> scope, so only you can change it.</> : <>Locked — it’s <b className="font-semibold text-ink">{who}’s</b> scope. Only {who} changes it.</>}</span>
    </div>
  )
}
/** the tiles on the project, one small chip each — tap one for the tile */
function TileStrip({ job }: { job: Job }) {
  const s = useStore()
  const tiles = tilesOf(job.id)
  const open = (s.rooms[job.id] || []).flatMap((r) => r.surfaces).filter((x) => takesTile(x.name) && !x.tile).length
  const lock = scopeLock(s, job.id)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[0.8125rem] font-semibold text-ink">Tiles<span className="ml-1 text-faint">{tiles.length}</span></span>
      {tiles.map((t) => {
        const st = tileStatus(s, job.id, t.tag)
        return (
          <button key={t.tag} onClick={() => s.open({ t: 'tile', jobId: job.id, tag: t.tag })} className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-left text-[0.8125rem] transition hover:border-[#cbd1d9]">
            <TileImg tile={t} size={26} radius={13} />
            <span className="truncate"><b className="font-semibold tnum text-ink">{t.tag}</b> <span className="text-ink-2">{t.name}</span></span>
            <span className={cn('h-2 w-2 shrink-0 rounded-full', st.tone === 'ok' ? 'bg-ok-500' : st.tone === 'bad' ? 'bg-bad-500' : st.tone === 'warn' ? 'bg-warn-500' : st.tone === 'info' ? 'bg-brand-500' : 'bg-[#c6ccd4]')} title={st.label} />
          </button>
        )
      })}
      {lock.canEdit && <button onClick={() => s.open({ t: 'tile', jobId: job.id })} className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-[#cfd4db] px-3 text-[0.8125rem] font-semibold text-muted hover:border-brand-300 hover:text-brand-700"><Plus className="h-3.5 w-3.5" />Add a tile</button>}
      {open > 0 && <span className="text-[0.8125rem] font-medium text-warn-700">{open} wall{open === 1 ? '' : 's'} or floor{open === 1 ? '' : 's'} without a tile</span>}
    </div>
  )
}

/* ---------------- the tiles on the project: one card each ---------------- */
function TileBoard({ job }: { job: Job }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const tiles = tilesOf(job.id)
  const open = rooms.flatMap((r) => r.surfaces).filter((x) => !x.tile).length
  return (
    <section>
      <div className="mb-2.5 flex items-baseline gap-3">
        <h3 className="text-[0.9375rem] font-semibold text-ink">Tiles<span className="ml-1.5 text-[0.8125rem] font-semibold text-faint">{tiles.length}</span></h3>
        <span className="truncate text-[0.8125rem] text-muted">{open ? `${open} wall${open === 1 ? '' : 's'} or floor${open === 1 ? '' : 's'} still need${open === 1 ? 's' : ''} a tile` : tiles.length ? 'Every wall and floor has its tile' : 'From the finish schedule — one card per tile'}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3 max-sm:grid-cols-2 max-sm:gap-2.5">
        {tiles.map((t) => <TileCard key={t.tag} job={job} t={t} />)}
        <button onClick={() => s.open({ t: 'tile', jobId: job.id })} className="flex min-h-[11.75rem] flex-col items-center justify-center gap-2 rounded-[0.875rem] border border-dashed border-[#cfd4db] bg-white px-2 text-center transition hover:border-brand-300 hover:bg-brand-50/40 max-sm:min-h-[9.375rem]">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Plus className="h-5 w-5" /></span>
          <span className="text-[0.875rem] font-semibold text-ink">Add a tile</span>
          <span className="max-w-[9.375rem] text-[0.78125rem] leading-snug text-muted">Picture, size, grout — and where it goes</span>
        </button>
      </div>
    </section>
  )
}
function TileCard({ job, t }: { job: Job; t: Tile }) {
  const s = useStore()
  const uses = usesOf(s.rooms[job.id] || [], t.tag)
  const sf = uses.reduce((n, u) => n + (u.x.sf || 0), 0)
  const st = tileStatus(s, job.id, t.tag)
  const grout = t.grout || uses.find((u) => u.x.grout)?.x.grout
  return (
    <button onClick={() => s.open({ t: 'tile', jobId: job.id, tag: t.tag })} aria-label={`Tile ${t.tag} ${t.name}`} className="group flex flex-col overflow-hidden rounded-[0.875rem] border border-line bg-white text-left transition hover:border-[#cfd4db] hover:shadow-card">
      <TileImg tile={t} size={72} radius={0} className="!w-full" />
      <span className="flex min-w-0 flex-1 flex-col gap-1 px-3 pb-3 pt-2.5 max-sm:px-2.5">
        <span className="truncate text-[0.875rem] font-semibold text-ink"><span className="tnum">{t.tag}</span> · {t.name}</span>
        <span className="truncate text-[0.78125rem] text-muted">{[t.size, t.finish].filter(Boolean).join(' · ') || 'Size not set'}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[0.78125rem] text-ink-2"><GroutDot grout={grout} size={12} /><span className="truncate">{grout ? `${GROUTS[grout]?.name}${t.joint ? ` · ${t.joint}` : ''}` : 'Grout not set'}</span></span>
        <span className="truncate text-[0.78125rem] text-muted">{uses.length ? `${uses.length} wall${uses.length === 1 ? '' : 's'} and floors${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}` : 'Not on a wall or floor yet'}</span>
        <span className="mt-1"><Status tone={st.tone}>{st.label}</Status></span>
      </span>
    </button>
  )
}

/* ---------------- every wall and floor, room by room ---------------- */
const COLS = 'grid grid-cols-[minmax(10rem,1.1fr)_minmax(12rem,1.3fr)_minmax(10rem,1fr)_3.75rem_8.5rem] items-center gap-4 max-lg:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_3.5rem_7.5rem]'
function ByRoom({ job }: { job: Job }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const inField = IN_FIELD.includes(job.stage)
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <div className={cn(COLS, 'border-b border-line bg-wash px-5 py-2 text-[0.75rem] font-semibold text-muted max-md:hidden')}>
        <span>Wall or floor</span>
        <span>Tile and grout</span>
        <span className="max-lg:hidden">How it’s set</span>
        <span className="text-right">SF</span>
        <span>Where it’s at</span>
      </div>
      {floorsOf(rooms).map((g) => (
        <div key={g.floor}>
          {(floorsOf(rooms).length > 1 || g.floor !== 'Rooms') && <div className="border-b border-line-2 bg-[#f7f8fa] px-5 py-1.5 text-[0.71875rem] font-bold uppercase tracking-[0.06em] text-muted max-sm:px-4">{g.floor}</div>}
          {g.rooms.map((r) => {
            const pct = roomPct(r)
            return (
              <div key={r.name}>
                <div className="flex items-center gap-3 border-b border-line-2 px-5 pb-1.5 pt-3 max-sm:px-4">
                  <span className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-ink">{r.name}{r.note && <span className="font-normal text-muted"> · {r.note}</span>}</span>
                  {inField && <span className="flex w-[7.75rem] shrink-0 items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-wash-2"><span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-ok-500' : 'bg-brand-500')} style={{ width: Math.max(3, pct) + '%' }} /></span><span className="w-9 text-right text-[0.75rem] font-semibold tnum text-muted">{pct}%</span></span>}
                </div>
                {r.surfaces.map((x) => <SurfaceRow key={x.name} job={job} room={r} x={x} inField={inField} />)}
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}
function SurfaceRow({ job, room, x, inField }: { job: Job; room: Room; x: Surface; inField: boolean }) {
  const s = useStore()
  const t = tileOf(job.id, x.tile)
  const m = methodOf(room.name, x)
  const lay = splitLayout(x.layout)
  const problem = ['blocked', 'waitmat', 'hold', 'unknown'].includes(x.state) && (x.reason || x.pending)
  const tone = SURF_TONE[x.state]
  const open = () => s.open({ t: 'surface', jobId: job.id, room: room.name, surface: x.name })
  return (
    <button onClick={open} aria-label={`${room.name} · ${x.name}`} className={cn(COLS, 'w-full border-b border-line-2 px-5 py-2.5 text-left transition-colors last:border-0 hover:bg-[#f7f8fa] max-md:flex max-md:items-center max-md:gap-3 max-sm:px-4')}>
      <span className="min-w-0 max-md:flex-1">
        <span className="block truncate text-[0.875rem] font-medium text-ink">{x.name}</span>
        {problem ? <span className={cn('block truncate text-[0.78125rem] font-medium', tone === 'bad' ? 'text-bad-600' : 'text-warn-700')}>{x.pending ? `${x.pending.co} · waiting on approval` : x.reason}</span> : (
          <span className="hidden truncate text-[0.78125rem] text-muted max-md:block">{[t ? `${t.tag} ${t.name}` : 'No tile yet', x.grout ? GROUTS[x.grout]?.name : '', lay.pattern].filter(Boolean).join(' · ')}</span>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-2 max-md:hidden">
        {t ? <><TileImg tile={t} size={30} radius={6} /><span className="min-w-0 leading-tight"><span className="block truncate text-[0.84375rem]"><span className="font-semibold tnum text-ink">{t.tag}</span> <span className="text-ink-2">{t.name}</span></span><span className="flex min-w-0 items-center gap-1 text-[0.75rem] text-muted">{x.grout ? <><GroutDot grout={x.grout} size={10} /><span className="truncate">{GROUTS[x.grout]?.name}{x.joint ? ` · ${x.joint}` : ''}</span></> : <span className="text-faint">No grout yet</span>}</span></span></> : takesTile(x.name) ? <span className="inline-flex h-7 items-center rounded-full border border-dashed border-warn-300 bg-warn-50 px-2.5 text-[0.78125rem] font-semibold text-warn-700">No tile yet</span> : <span className="text-[0.8125rem] text-faint">—</span>}
      </span>
      <span className="min-w-0 truncate text-[0.8125rem] text-ink-2 max-lg:hidden">{[lay.pattern, METHODS[m.key]?.short, x.edge ? shortEdge(x.edge) : ''].filter(Boolean).join(' · ') || <span className="text-faint">—</span>}{m.auto && <Sparkles className="ml-1 inline h-3 w-3 text-warn-500" />}</span>
      <span className={cn('text-right text-[0.84375rem] font-semibold tnum max-md:hidden', x.sf ? 'text-ink-2' : 'text-warn-700')}>{x.sf || 'Add'}</span>
      <span className="min-w-0 max-md:shrink-0">
        {inField && x.state === 'working' ? (
          <span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-wash-2"><span className="block h-full rounded-full bg-brand-600" style={{ width: surfacePct(x) + '%' }} /></span><span className="w-9 text-right text-[0.75rem] font-bold tnum text-brand-600">{surfacePct(x)}%</span></span>
        ) : <Status tone={tone}>{SURF_STATUS[x.state]}</Status>}
      </span>
    </button>
  )
}
const shortEdge = (e: string) => e.replace(/^Schluter /, '').replace(/ · 10 mm$/, '')

/* ---------------- the same thing, tile by tile ---------------- */
function ByTile({ job }: { job: Job }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const tiles = tilesOf(job.id)
  const none = rooms.flatMap((r) => r.surfaces.filter((x) => !x.tile).map((x) => ({ room: r, x })))
  return (
    <div className="flex flex-col gap-4">
      {tiles.map((t) => {
        const uses = usesOf(rooms, t.tag)
        const sf = uses.reduce((n, u) => n + (u.x.sf || 0), 0)
        const st = tileStatus(s, job.id, t.tag)
        const c = s.checks.find((y) => y.jobId === job.id && y.tag === t.tag)
        return (
          <section key={t.tag} className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
            <button onClick={() => s.open({ t: 'tile', jobId: job.id, tag: t.tag })} className="flex w-full items-center gap-4 border-b border-line-2 px-5 py-4 text-left transition hover:bg-[#f7f8fa] max-sm:flex-wrap max-sm:px-4">
              <TileImg tile={t} size={72} radius={12} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[1rem] font-semibold text-ink"><span className="tnum">{t.tag}</span> · {t.name}</span>
                <span className="block truncate text-[0.8125rem] text-muted">{[t.size, t.finish, t.maker, t.sku].filter(Boolean).join(' · ')}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-ink-2">
                  <span className="inline-flex items-center gap-1.5"><GroutDot grout={t.grout} size={13} />{t.grout ? `${GROUTS[t.grout]?.name}${t.joint ? ` · ${t.joint}` : ''}` : 'Grout not set'}</span>
                  <span>{t.suppliedBy === 'Us' ? 'We order it' : `The ${t.suppliedBy === 'Owner' ? 'owner' : 'GC'} orders it`}{t.supplier ? ` · ${t.supplier}` : ''}</span>
                  {c && <span className="tnum">{c.ordered.toLocaleString('en-US')} {c.unit} ordered · {c.received.toLocaleString('en-US')} here</span>}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5 max-sm:items-start">
                <Status tone={st.tone}>{st.label}</Status>
                <span className="text-[0.78125rem] font-semibold tnum text-muted">{sf.toLocaleString('en-US')} SF</span>
              </span>
            </button>
            {uses.map((u) => (
              <button key={u.room.name + u.x.name} onClick={() => s.open({ t: 'surface', jobId: job.id, room: u.room.name, surface: u.x.name })} className="flex w-full items-center gap-3 border-b border-line-2 px-5 py-2.5 text-left transition last:border-0 hover:bg-[#f7f8fa] max-sm:px-4">
                <span className="min-w-0 flex-1 truncate text-[0.875rem] text-ink"><span className="font-medium">{u.room.name}</span> · {u.x.name}</span>
                <span className="w-[11.25rem] truncate text-[0.8125rem] text-muted max-md:hidden">{splitLayout(u.x.layout).pattern || 'Layout not set'}</span>
                <span className="w-[3.5rem] text-right text-[0.84375rem] font-semibold tnum text-ink-2">{u.x.sf ? `${u.x.sf}` : '—'}</span>
                <span className="w-[7rem] max-sm:hidden"><Status tone={SURF_TONE[u.x.state]}>{SURF_STATUS[u.x.state]}</Status></span>
              </button>
            ))}
            {!uses.length && <div className="px-5 py-3 text-[0.84375rem] text-muted">Not on a wall or floor yet — open the tile to pick where it goes.</div>}
          </section>
        )
      })}
      {none.length > 0 && (
        <section className="overflow-hidden rounded-[0.875rem] border border-dashed border-warn-300 bg-white">
          <div className="flex items-center gap-3 border-b border-line-2 px-5 py-3 max-sm:px-4">
            <span className="min-w-0 flex-1 text-[0.90625rem] font-semibold text-ink">No tile yet<span className="ml-1.5 text-[0.8125rem] font-semibold text-faint">{none.length}</span></span>
            <Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'tile', jobId: job.id })}>Add a tile</Button>
          </div>
          {none.map((u) => (
            <button key={u.room.name + u.x.name} onClick={() => s.open({ t: 'surface', jobId: job.id, room: u.room.name, surface: u.x.name })} className="flex w-full items-center gap-3 border-b border-line-2 px-5 py-2.5 text-left transition last:border-0 hover:bg-[#f7f8fa] max-sm:px-4">
              <span className="min-w-0 flex-1 truncate text-[0.875rem] text-ink"><span className="font-medium">{u.room.name}</span> · {u.x.name}</span>
              <span className="text-[0.8125rem] font-semibold text-brand-600">Pick the tile</span>
              <ChevronRight className="h-4 w-4 text-faint" />
            </button>
          ))}
        </section>
      )}
      {!tiles.length && !none.length && <div className="rounded-[0.875rem] border border-dashed border-line px-5 py-10 text-center text-[0.875rem] text-muted">No tiles yet.</div>}
    </div>
  )
}

/* ================= one wall or floor: everything about it, in dropdowns ================= */
function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.25rem_minmax(0,1fr)] items-start gap-x-5 gap-y-1.5 border-t border-line-2 py-3.5 first:border-t-0 first:pt-1 max-sm:grid-cols-1">
      <div className="pt-2.5 text-[0.84375rem] font-semibold text-ink-2 max-sm:pt-0">{label}</div>
      <div className="min-w-0">
        {children}
        {hint && <div className="mt-1.5 text-[0.78125rem] text-muted">{hint}</div>}
      </div>
    </div>
  )
}
const opts = (list: string[], cur?: string) => [...(cur && !list.some((x) => x.toLowerCase() === cur.toLowerCase()) ? [cur] : []), ...list].map((x) => ({ key: x, label: x }))
const findOpt = (list: string[], v: string) => list.find((x) => x.toLowerCase() === v.toLowerCase()) || v

export function SurfaceModal({ jobId, room, surface, level }: { jobId: string; room: string; surface: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const r = s.rooms[jobId]?.find((y) => y.name === room)
  const x = r?.surfaces.find((y) => y.name === surface)
  const [tile, setTile] = React.useState(x?.tile || '')
  const [grout, setGrout] = React.useState(x?.grout || '')
  const [joint, setJoint] = React.useState(x?.joint || '')
  const [pattern, setPattern0] = React.useState(() => splitLayout(x?.layout).pattern)
  const [start, setStart0] = React.useState(() => findOpt(STARTS, splitLayout(x?.layout).start))
  const [touched, setTouched] = React.useState(false)
  const setPattern = (v: string) => { setPattern0(v); setTouched(true) }
  const setStart = (v: string) => { setStart0(v); setTouched(true) }
  const [method, setMethod] = React.useState(x?.method || '')
  const [edge, setEdge] = React.useState(x?.edge || '')
  const [height, setHeight] = React.useState(x?.height || '')
  const [sf, setSf] = React.useState(x?.sf ? String(x.sf) : '')
  const [notes, setNotes] = React.useState(x?.notes || '')
  /* what the windows on top save (a new tile, a drawn layout) comes into this one */
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) { first.current = false; return }
    if (!x) return
    setTile(x.tile || '')
    if (x.grout) setGrout(x.grout)
    if (x.joint) setJoint(x.joint)
  }, [x?.tile, x?.grout])
  const firstL = React.useRef(true)
  React.useEffect(() => {
    if (firstL.current) { firstL.current = false; return }
    const l = splitLayout(x?.layout)
    setPattern0(l.pattern)
    setStart0(findOpt(STARTS, l.start))
    setTouched(false)
  }, [x?.layout])
  if (!job || !r || !x) return null
  const t = tileOf(jobId, tile)
  const kind = kindOf(x)
  const sug = suggestMethod(room, x)
  const cur = methodOf(room, x)
  const tone = SURF_TONE[x.state]
  const fix = surfaceFix(job, room, x)
  const layout = joinLayout(pattern, start)
  const pickTile = (tag: string) => {
    setTile(tag)
    const nt = tileOf(jobId, tag)
    if (nt?.grout) setGrout(nt.grout)
    if (nt?.joint) setJoint(nt.joint)
  }
  const save = () =>
    saveSurface(jobId, room, surface, {
      tile, grout, joint, layout: touched ? layout || undefined : x.layout, method: method || x.method || undefined, edge, height: kind === 'wall' ? height : x.height, sf: Math.round(Number(sf.replace(/[^0-9.]/g, ''))) || undefined, notes,
    })
  const tiles = tilesOf(jobId)
  const lock = scopeLock(s, jobId)
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={`${room} · ${surface}`}
      sub={`${job.name}${r.floor ? ` · ${r.floor}` : ''}${x.sf ? ` · ${x.sf} SF` : ''}`}
      footer={
        <>
          {x.state !== 'done' && (
            <button onClick={() => s.swap({ t: 'sitechange', jobId, room, surface })} className="inline-flex items-center gap-1.5 text-[0.84375rem] font-semibold text-muted hover:text-ink max-sm:hidden"><ArrowLeftRight className="h-4 w-4" />Client wants a change</button>
          )}
          {lock.canEdit ? (
            <>
              <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
              <Button variant="primary" onClick={save}>Save</Button>
            </>
          ) : <Button className="ml-auto" onClick={s.close}>Close</Button>}
        </>
      }
    >
      {!lock.canEdit && <div className="mb-4 flex items-center gap-2.5 rounded-[0.75rem] bg-wash px-4 py-2.5 text-[0.84375rem] text-ink-2"><Lock className="h-4 w-4 shrink-0" />Locked — it’s {PEOPLE[lock.owner]?.short || 'its owner'}’s scope. Only {PEOPLE[lock.owner]?.short || 'they'} can change it.</div>}
      {(x.reason || x.pending) && ['blocked', 'hold', 'waitmat', 'unknown'].includes(x.state) && (
        <div className={cn('mb-4 flex items-center gap-3 rounded-[0.75rem] border px-4 py-3 max-sm:flex-wrap', tone === 'bad' ? 'border-bad-100 bg-bad-50' : 'border-warn-100 bg-warn-50')}>
          {x.state === 'blocked' ? <Ban className="h-5 w-5 shrink-0 text-bad-500" /> : x.state === 'hold' ? <PauseCircle className="h-5 w-5 shrink-0 text-warn-600" /> : x.state === 'unknown' ? <AlertTriangle className="h-5 w-5 shrink-0 text-warn-600" /> : <Clock3 className="h-5 w-5 shrink-0 text-warn-600" />}
          <div className="min-w-0 flex-1">
            <div className="text-[0.875rem] font-semibold text-ink">{x.state === 'blocked' ? 'Don’t start this one' : x.state === 'hold' ? 'On hold — change not approved' : x.state === 'unknown' ? 'To check on site' : 'Waiting on material'}</div>
            <div className="text-[0.84375rem] text-ink-2">{x.pending ? `${x.pending.co}: ${x.pending.label} ${x.pending.from} → ${x.pending.to}` : x.reason}</div>
          </div>
          {fix && <Button size="sm" variant="primary" onClick={fix.run}>{fix.label}</Button>}
        </div>
      )}
      {IN_FIELD.includes(job.stage) && x.sf ? (
        <div className="mb-4 flex items-center gap-3 rounded-[0.75rem] bg-wash px-4 py-2.5">
          <span className="text-[0.8125rem] font-semibold text-ink-2">Done</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white"><span className={cn('block h-full rounded-full', surfacePct(x) >= 100 ? 'bg-ok-500' : 'bg-brand-500')} style={{ width: Math.max(3, surfacePct(x)) + '%' }} /></span>
          <span className="text-[0.8125rem] font-semibold tnum text-ink">{surfacePct(x)}% · {Math.round(((x.sf || 0) * surfacePct(x)) / 100)} of {x.sf} SF</span>
        </div>
      ) : null}
      <fieldset disabled={!lock.canEdit} className="m-0 min-w-0 border-0 p-0">
      <Row label="Tile">
        <SearchSelect
          label="Tile"
          value={tile}
          onChange={pickTile}
          emptyLabel="No tile yet"
          placeholder="Pick the tile"
          search={tiles.length > 8}
          options={tiles.map((tt) => ({ key: tt.tag, label: `${tt.tag} · ${tt.name}`, hint: [tt.size, tt.finish].filter(Boolean).join(' · '), lead: <TileImg tile={tt} size={28} radius={6} /> }))}
          footer={{ label: 'Add a new tile', onClick: () => s.open({ t: 'tile', jobId, room, surface }) }}
          width={380}
          className={cn(t && 'h-12')}
        />
      </Row>
      <Row label="Grout">
        <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
          <SearchSelect
            label="Grout color"
            value={grout}
            onChange={setGrout}
            emptyLabel="Not picked yet"
            options={Object.entries(GROUTS).map(([k, g]) => ({ key: k, label: g.name, hint: g.product, lead: <GroutDot grout={k} size={16} /> }))}
            onCreate={(name) => setGrout(addGrout(name))}
            createLabel={(q) => `Add “${q}” as a grout color`}
            search
            searchPlaceholder="Type a color…"
            width={320}
          />
          <SearchSelect label="Joint" value={joint} onChange={setJoint} options={JOINTS.map((j) => ({ key: j, label: j }))} placeholder="Joint" search={false} width={160} />
        </div>
      </Row>
      <Row label="Layout" hint={x.dims ? 'Drawn to scale — the crew’s sheet shows every cut' : t ? 'Draw it to scale to see the cuts and the best place to start' : undefined}>
        <div className="flex items-start gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 max-sm:grid-cols-1">
            <SearchSelect label="Pattern" value={pattern} onChange={setPattern} options={opts(PATTERNS, pattern)} placeholder="Pattern" emptyLabel="Not set" onCreate={setPattern} createLabel={(q) => `Use “${q}”`} search={false} width={280} />
            <SearchSelect label="Where it starts" value={start} onChange={setStart} options={opts(STARTS, start)} placeholder="Where it starts" emptyLabel="Not set" onCreate={setStart} createLabel={(q) => `Use “${q}”`} search={false} width={300} />
          </div>
          <Tip label={t ? 'Draw it to scale — every cut, no slivers' : 'Pick the tile first'}>
            <button
              disabled={!t}
              aria-label="Draw it to scale"
              onClick={() => s.open({ t: 'layout', jobId, room, surface, tile })}
              className="group relative shrink-0 rounded-lg disabled:opacity-50"
            >
              <LayoutArt layout={layout || 'straight'} />
              <span className="absolute inset-0 flex items-end justify-center rounded-lg bg-gradient-to-t from-white/90 via-white/10 to-transparent pb-1 text-[0.6875rem] font-bold text-brand-700 opacity-90 group-hover:opacity-100"><Ruler className="mr-1 h-3 w-3" />Draw</span>
            </button>
          </Tip>
        </div>
      </Row>
      <Row label="Under it" hint={!method && !x.method && cur.auto ? <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-warn-500" />Suggested from the {kind === 'wall' ? 'wall' : 'floor'} — pick it to confirm</span> : undefined}>
        <SearchSelect
          label="What goes under the tile"
          value={method || cur.key}
          onChange={setMethod}
          options={methodsFor(x).map((k) => ({ key: k, label: METHODS[k].label + (k === sug ? ' · suggested' : ''), hint: METHODS[k].layers }))}
          search={false}
          width={380}
        />
      </Row>
      <Row label="Edge or metal" hint={isMetal(edge) ? 'Metal goes on the materials order by the length' : undefined}>
        <SearchSelect label="Edge or metal" value={edge} onChange={setEdge} emptyLabel="None — no open edge" options={opts(EDGES, edge)} onCreate={setEdge} createLabel={(q) => `Use “${q}”`} search searchPlaceholder="Type or pick…" width={360} />
      </Row>
      {kind === 'wall' && (
        <Row label="Height">
          <SearchSelect label="Height" value={height} onChange={setHeight} emptyLabel="Not set" options={opts(HEIGHTS, height)} onCreate={setHeight} createLabel={(q) => `Use “${q}”`} search={false} width={280} />
        </Row>
      )}
      <Row label="Square feet" hint={x.measured ? `Measured on site ${x.measured.date}` : undefined}>
        <div className="flex items-center gap-2">
          <TextInput aria-label="Square feet" inputMode="numeric" value={sf} onChange={(e) => setSf(e.target.value)} className="h-10 w-[7.5rem] text-right tnum" placeholder="0" />
          <span className="text-[0.84375rem] text-muted">SF</span>
        </div>
      </Row>
      <Row label="Note">
        <TextArea aria-label="Note" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the crew should know — e.g. niche centered on the wall, 12 × 24" className="min-h-[4rem]" />
      </Row>
      </fieldset>
    </Modal>
  )
}

/* ================= one tile: picture, what it is, the grout, where it goes ================= */
export function TileModal({ jobId, tag, room, surface, level }: { jobId: string; tag?: string; room?: string; surface?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const cur = tag ? s.tiles[jobId]?.[tag] : undefined
  const [t, setT] = React.useState<Tile>(() => (cur ? { ...cur } : { tag: nextTag(jobId), name: '', size: '', finish: 'Matte', maker: '', supplier: '', suppliedBy: 'GC', sku: '', grout: '', joint: '1/16″' }))
  const flat = (s.rooms[jobId] || []).flatMap((r) => r.surfaces.map((x) => ({ room: r.name, surface: x.name, x })))
  const [on, setOn] = React.useState<string[]>(() => (cur ? flat.filter((f) => f.x.tile === cur.tag).map(refKey) : room && surface ? [refKey({ room, surface })] : []))
  const [busy, setBusy] = React.useState(false)
  const [confirmDel, setConfirmDel] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)
  if (!job) return null
  const set = (p: Partial<Tile>) => setT((v) => ({ ...v, ...p }))
  const tagT = t.tag.trim()
  const clash = !!tagT && tagT !== tag && !!s.tiles[jobId]?.[tagT]
  const ok = !!tagT && !!t.name.trim() && !clash
  const ordered = !!tag && s.checks.some((c) => c.jobId === jobId && c.tag === tag)
  const pickPhoto = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try { set(await readPhoto(f)) } catch (e: any) { toast(e?.message || 'Couldn’t read that picture') }
    setBusy(false)
  }
  const save = () => saveTile(jobId, { ...t, tag: tagT, name: t.name.trim(), maker: t.maker.trim(), sku: t.sku.trim(), supplier: t.supplier.trim() }, { was: tag, on: on.map((k) => { const [r, sfc] = k.split('|'); return { room: r, surface: sfc } }) })
  const suppliers = Array.from(new Set([...s.suppliers.map((x) => x.name), ...Object.values(s.tiles).flatMap((m) => Object.values(m).map((x) => x.supplier)).filter(Boolean)]))
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title={cur ? `${cur.tag} · ${cur.name}` : 'Add a tile'}
      sub={`${job.name} · from the finish schedule — one tag everywhere: the scope, the orders, the crew’s sheet`}
      footer={
        <>
          {cur && (
            ordered ? <span className="text-[0.78125rem] text-muted">Its order is logged — it can’t be removed</span> : (
              <Pop open={confirmDel} onOpenChange={setConfirmDel} side="top" align="start" width={300} trigger={<Button variant="ghost" className="text-bad-600 hover:bg-bad-50" icon={<Trash2 />}>Remove</Button>}>
                <div className="text-[0.875rem] font-semibold text-ink">Remove {cur.tag} from {job.name}?</div>
                <div className="mt-1 text-[0.8125rem] text-muted">The walls and floors with it go back to “no tile”.</div>
                <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>Keep it</Button><Button size="sm" variant="primary" className="bg-bad-600 hover:bg-bad-700" onClick={() => removeTile(jobId, cur.tag)}>Remove</Button></div>
              </Pop>
            )
          )}
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!ok || busy} onClick={save}>{cur ? 'Save' : 'Add the tile'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-[10.5rem_minmax(0,1fr)] gap-6 max-sm:grid-cols-1">
        <div className="flex flex-col items-center gap-2">
          <button onClick={() => fileRef.current?.click()} aria-label="Add a photo" className="group relative overflow-hidden rounded-[1rem]">
            {t.photo || t.swatch ? <TileImg tile={t} size={168} radius={16} /> : (
              <span className="flex h-[10.5rem] w-[10.5rem] flex-col items-center justify-center gap-2 rounded-[1rem] border border-dashed border-[#cfd4db] bg-wash text-center transition group-hover:border-brand-300 group-hover:bg-brand-50/40">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-600 shadow-card"><ImagePlus className="h-5 w-5" /></span>
                <span className="text-[0.84375rem] font-semibold text-ink">{busy ? 'Reading…' : 'Add a photo'}</span>
                <span className="px-3 text-[0.75rem] leading-snug text-muted">The sample, the box or the store’s picture</span>
              </span>
            )}
            {(t.photo || t.swatch) && <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/45 py-1.5 text-[0.75rem] font-semibold text-white opacity-0 transition group-hover:opacity-100"><Camera className="h-3.5 w-3.5" />Change the photo</span>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
          {t.photo && <button onClick={() => set({ photo: undefined, color: undefined })} className="text-[0.78125rem] font-semibold text-muted hover:text-bad-600">Remove the photo</button>}
        </div>
        <div className="min-w-0">
          <div className="grid grid-cols-[6.875rem_minmax(0,1fr)] gap-3 max-sm:grid-cols-[6rem_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink-2">Tag</span>
              <TextInput aria-label="Tag" value={t.tag} onChange={(e) => set({ tag: e.target.value.toUpperCase() })} className={cn('h-10 font-semibold tnum', clash && 'border-bad-300 ring-[0.1875rem] ring-bad-50')} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink-2">Name</span>
              <TextInput data-autofocus aria-label="Tile name" value={t.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Toscana Ivory" className="h-10" />
            </label>
          </div>
          {clash && <div className="mt-1.5 text-[0.78125rem] font-medium text-bad-600">{tagT} is already on this project — use the next tag.</div>}
          <div className="mt-3 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <Field2 label="Size"><SearchSelect label="Size" value={t.size} onChange={(v) => set({ size: v })} options={opts(TILE_SIZES, t.size)} placeholder="Pick or type" onCreate={(v) => set({ size: v })} createLabel={(q) => `Use “${q}”`} search searchPlaceholder="e.g. 12 × 24" width={260} /></Field2>
            <Field2 label="Finish"><SearchSelect label="Finish" value={t.finish} onChange={(v) => set({ finish: v })} options={opts(FINISHES, t.finish)} search={false} width={220} /></Field2>
            <Field2 label="Maker"><TextInput aria-label="Maker" value={t.maker} onChange={(e) => set({ maker: e.target.value })} placeholder="e.g. Marca Corona" className="h-10" /></Field2>
            <Field2 label="Color or SKU"><TextInput aria-label="Color or SKU" value={t.sku} onChange={(e) => set({ sku: e.target.value })} placeholder="As on the finish schedule" className="h-10" /></Field2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line-2 pt-4 max-sm:grid-cols-1">
            <Field2 label="Who orders it">
              <Segmented value={t.suppliedBy || 'GC'} onChange={(v) => set({ suppliedBy: v })} items={WHO_ORDERS} className="h-10 w-full [&>button]:flex-1 [&>button]:justify-center" />
            </Field2>
            <Field2 label="From which store"><SearchSelect label="Store" value={t.supplier} onChange={(v) => set({ supplier: v })} options={suppliers.map((x) => ({ key: x, label: x }))} placeholder="Pick or type" onCreate={(v) => set({ supplier: v })} createLabel={(q) => `Add “${q}”`} search width={280} /></Field2>
            <Field2 label="Grout it goes with">
              <SearchSelect label="Grout" value={t.grout || ''} onChange={(v) => set({ grout: v })} emptyLabel="Not picked yet" options={Object.entries(GROUTS).map(([k, g]) => ({ key: k, label: g.name, hint: g.product, lead: <GroutDot grout={k} size={16} /> }))} onCreate={(name) => set({ grout: addGrout(name) })} createLabel={(q) => `Add “${q}” as a grout color`} search searchPlaceholder="Type a color…" width={300} />
            </Field2>
            <div className="grid grid-cols-2 gap-3">
              <Field2 label="Joint"><SearchSelect label="Joint" value={t.joint || ''} onChange={(v) => set({ joint: v })} options={JOINTS.map((j) => ({ key: j, label: j }))} placeholder="Joint" search={false} width={160} /></Field2>
              <Field2 label="SF in a box"><TextInput aria-label="Square feet in a box" inputMode="decimal" value={t.boxSF ? String(t.boxSF) : ''} onChange={(e) => set({ boxSF: Number(e.target.value.replace(/[^0-9.]/g, '')) || undefined })} placeholder="—" className="h-10 tnum" /></Field2>
            </div>
          </div>
          <div className="mt-4 border-t border-line-2 pt-4">
            <Field2 label="Where it goes" hint={on.length ? `${on.length} wall${on.length === 1 ? '' : 's'} and floors — they take this tile${t.grout ? ' and its grout' : ''}` : 'Pick the walls and floors now, or later from each one'}>
              <MultiSelect
                label="Where it goes"
                values={on}
                onChange={setOn}
                placeholder="Pick walls and floors"
                options={flat.map((f) => ({ key: refKey(f), label: `${f.room} · ${f.surface}`, hint: f.x.tile && f.x.tile !== tag ? `Now ${f.x.tile} ${tileOf(jobId, f.x.tile)?.name || ''}` : f.x.sf ? `${f.x.sf} SF` : undefined }))}
                summary={(p) => (p.length <= 2 ? p.map((o) => o.label).join(', ') : `${p.length} walls and floors`)}
                width={420}
              />
            </Field2>
          </div>
        </div>
      </div>
    </Modal>
  )
}
function Field2({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-[0.8125rem] font-medium text-ink-2">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-[0.78125rem] text-muted">{hint}</div>}
    </div>
  )
}
