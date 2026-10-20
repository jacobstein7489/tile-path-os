/* Scope of work — two cards, the same as every other tab:
 *   Tiles           — the project's tiles, one chip each (picture, tag, name, is it here)
 *   Walls and floors — every wall and floor, room by room (or tile by tile), one row each on the same columns:
 *                      the wall or floor · the tile · the grout · how it's set · SF · where it's at
 * Whose scope it is (and that it's locked) is said once, in the card's header. Tap a wall or floor to change it
 * (one window of dropdowns); tap a tile to change the tile. */
import * as React from 'react'
import { Plus, FileText, Ruler, Sparkles, Camera, Trash2, ChevronRight, Layers3, Building2, ImagePlus, AlertTriangle, PauseCircle, Clock3, Ban, ArrowLeftRight, Lock, Unlock, LayoutGrid, ChevronDown } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Button, Segmented, TextInput, TextArea, SearchField } from '@/tileos/components/ui/core'
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
import { Section, Empty, Group, Strip, GREEN, SHEET } from './kit'
import { AddSurfaceButton, AddRoomButton } from '../roomedit'
import { LayoutArt } from './rooms'
import {
  saveTile, removeTile, saveSurface, addGrout, readPhoto, nextTag, refKey, splitLayout, joinLayout, isMetal,
  TILE_SIZES, FINISHES, WHO_ORDERS, PATTERNS, STARTS, EDGES, HEIGHTS,
} from '../tiles'

const SURF_STATUS: Record<string, string> = { done: 'Done', working: 'Working', ready: 'Ready', blocked: 'Blocked', waitmat: 'Waiting on material', hold: 'On hold', notstarted: 'Not started', unknown: 'To check' }
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

/* ---------------- the search on top: every word has to be somewhere on the line ---------------- */
const wordsOf = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean)
const hasAll = (hay: string, ws: string[]) => ws.every((w) => hay.includes(w))
const tileHay = (t?: Tile) => (t ? [t.tag, t.name, t.size, t.finish, t.maker, t.sku, t.supplier, t.grout && GROUTS[t.grout]?.name].filter(Boolean).join(' ') : '')
function lineHay(jobId: string, r: Room, x: Surface) {
  const m = methodOf(r.name, x)
  return [r.floor, r.name, r.note, x.name, tileHay(tileOf(jobId, x.tile)), x.grout && GROUTS[x.grout]?.name, x.layout, METHODS[m.key]?.short, METHODS[m.key]?.label, x.height, x.edge, x.notes, x.reason, x.pending?.co].filter(Boolean).join(' ').toLowerCase()
}
/** what the search keeps: the walls and floors (a room's name keeps all of it), and the tiles on them or named */
export function scopeMatches(jobId: string, rooms: Room[], q: string) {
  const ws = wordsOf(q)
  if (!ws.length) return null
  const lines = new Set<string>()
  rooms.forEach((r) => r.surfaces.forEach((x) => { if (hasAll(lineHay(jobId, r, x), ws)) lines.add(`${r.name}|${x.name}`) }))
  const tiles = new Set(tilesOf(jobId).filter((t) => hasAll(tileHay(t).toLowerCase(), ws)).map((t) => t.tag))
  rooms.forEach((r) => r.surfaces.forEach((x) => { if (x.tile && lines.has(`${r.name}|${x.name}`)) tiles.add(x.tile) }))
  return { lines, tiles }
}
type Hits = ReturnType<typeof scopeMatches>

/* ================= the tab ================= */
/* It reads like our printed Scope of Work: the numbers on top, then the tile schedule, then every floor with its rooms
 * and every wall and floor in them — one line each, what goes on it, and the square feet on the right. Once the crew
 * is on it, each line shows how far it is. Tap a line to change it; tap a tile for the tile. */
const IN_FIELD_ = ['installation', 'punch', 'closeout', 'complete']
export function ScopeTab({ job }: { job: Job }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  if (!rooms.length)
    return (
      <Section title="Scope of work">
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Building2 className="h-6 w-6" /></span>
          <div className="text-[1rem] font-semibold text-ink">No rooms yet</div>
          <div className="mt-1 max-w-sm text-[0.875rem] text-muted">When an estimate is approved its rooms come over by themselves. For this one, build them from the paperwork.</div>
          <Button className="mt-4" variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'buildrooms', jobId: job.id })}>Build rooms</Button>
        </div>
      </Section>
    )
  return <ScopeBody job={job} rooms={rooms} />
}
function ScopeBody({ job, rooms }: { job: Job; rooms: Room[] }) {
  const s = useStore()
  const [q, setQ] = React.useState('')
  const hits = scopeMatches(job.id, rooms, q)
  const lock = scopeLock(s, job.id)
  const me = meOf(s.role)
  const total = rooms.reduce((n, r) => n + r.surfaces.length, 0)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <SearchField value={q} onChange={setQ} placeholder="Search a room, a wall, a tile, a grout…" className="w-[24rem] bg-white max-md:w-full" />
        {hits
          ? <span className="text-[0.8125rem] text-muted"><b className="font-semibold text-ink">{hits.lines.size}</b> of {total} walls and floors{hits.tiles.size ? <> · <b className="font-semibold text-ink">{hits.tiles.size}</b> tile{hits.tiles.size === 1 ? '' : 's'}</> : null}</span>
          : <ScopeNumbers job={job} />}
        <span className="ml-auto flex shrink-0 items-center gap-2 max-md:ml-0">
          {lock.canEdit && <AddRoomButton jobId={job.id} have={rooms.map((r) => r.name)} />}
          {rooms.some((r) => r.surfaces.some((x) => x.tile)) && <Button size="sm" icon={<LayoutGrid />} onClick={() => s.open({ t: 'layouts', jobId: job.id })}>Layouts</Button>}
          <Button size="sm" icon={<FileText />} onClick={() => s.open({ t: 'sow', jobId: job.id })}>Print the scope of work</Button>
        </span>
      </div>
      {hits && !hits.lines.size && !hits.tiles.size
        ? <Section title="Search"><Empty>Nothing on {job.name} matches “{q.trim()}”. Try a room (“master”), a tile tag (“T-04”) or a grout color.</Empty></Section>
        : <>
            {(!hits || hits.tiles.size > 0) && <TileSchedule job={job} hits={hits} />}
            {(!hits || hits.lines.size > 0) && <ScopeSheet job={job} hits={hits} />}
          </>}
    </div>
  )
}

/* ---------------- the numbers, and whose scope it is ---------------- */
export function ScopeNumbers({ job }: { job: Job }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const flat = rooms.flatMap((r) => r.surfaces)
  const tiled = flat.filter((x) => takesTile(x.name))
  const sf = flat.reduce((n, x) => n + (x.sf || 0), 0)
  const noTile = tiled.filter((x) => !x.tile).length
  const noSF = flat.filter((x) => !x.sf).length
  const inField = IN_FIELD_.includes(job.stage)
  const lock = scopeLock(s, job.id)
  const me = meOf(s.role)
  const whose = lock.owner === me ? 'yours' : `${PEOPLE[lock.owner]?.short || 'its owner'}’s`
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.8125rem] text-ink-2 max-md:order-last max-md:basis-full">
      <b className="font-semibold tnum text-ink">{rooms.length}</b> {rooms.length === 1 ? 'room' : 'rooms'} ·
      <b className="font-semibold tnum text-ink">{flat.length}</b> walls and floors ·
      <b className="font-semibold tnum text-ink">{sf ? sf.toLocaleString('en-US') : '—'}</b> SF
      {inField && <> · <b className="font-semibold tnum text-ink">{job.pct ?? 0}%</b> installed</>}
      {noTile > 0 && <span className="font-semibold text-warn-700">· {noTile} without a tile</span>}
      {noSF > 0 && <span className="font-semibold text-warn-700">· {noSF} without square feet</span>}
      <span className="inline-flex items-center gap-1 text-muted" title={lock.done ? `Only ${whose === 'yours' ? 'you' : PEOPLE[lock.owner]?.short || 'its owner'} can change it` : 'It locks once the tile paperwork is entered'}>
        · {lock.done ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Unlock className="h-3.5 w-3.5 shrink-0" />}{lock.done ? (whose === 'yours' ? 'Locked · yours' : 'Locked') : 'Not locked yet'}
      </span>
    </span>
  )
}
export function ScopeLockBar({ job }: { job: Job }) {
  const s = useStore()
  const lock = scopeLock(s, job.id)
  if (!lock.done) return null
  return <div className="flex items-center gap-2.5 rounded-[0.75rem] bg-wash px-4 py-2.5 text-[0.84375rem] text-ink-2"><Lock className="h-4 w-4 shrink-0" />{lock.canEdit ? 'Locked — it’s your scope, so only you change it.' : `Locked — it’s ${PEOPLE[lock.owner]?.short}’s scope. Only ${PEOPLE[lock.owner]?.short} changes it.`}</div>
}

/* ---------------- the tile schedule ---------------- */
const BAND = 'flex items-center justify-between gap-3 px-5 py-1.5 text-[0.8125rem] font-semibold text-white max-sm:px-4'
export function TileSchedule({ job, hits }: { job: Job; hits?: Hits }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const tiles = tilesOf(job.id).filter((t) => !hits || hits.tiles.has(t.tag))
  const lock = scopeLock(s, job.id)
  return (
    <section className={SHEET}>
      <div className={BAND} style={{ background: GREEN }}><span>Tile schedule</span><span>Square feet</span></div>
      {tiles.map((t) => {
        const uses = usesOf(rooms, t.tag)
        const sf = uses.reduce((n, u) => n + (u.x.sf || 0), 0)
        const st = tileStatus(s, job.id, t.tag)
        const grout = t.grout || uses.find((u) => u.x.grout)?.x.grout
        return (
          <button key={t.tag} onClick={() => s.open({ t: 'tile', jobId: job.id, tag: t.tag })} aria-label={`Tile ${t.tag} ${t.name}`} className="grid min-h-[2.75rem] w-full grid-cols-[2rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-3.5 border-t border-line-2 px-5 py-1 text-left transition first:border-t-0 hover:bg-[#f8f6f2] max-md:grid-cols-[2rem_minmax(0,1fr)_4rem] max-sm:px-4">
            <TileImg tile={t} size={30} radius={7} />
            <span className="min-w-0">
              <span className="block truncate text-[0.90625rem] font-semibold text-ink"><span className="tnum">{t.tag}</span> · {t.name}</span>
              <span className="block truncate text-[0.78125rem] text-muted">{[t.size, t.finish, t.maker].filter(Boolean).join(' · ') || 'Size not set'}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-ink-2 max-md:hidden"><GroutDot grout={grout} size={13} /><span className="truncate">{grout ? `${GROUTS[grout]?.name} grout${t.joint ? ` · ${t.joint}` : ''}` : <span className="text-faint">Grout not picked</span>}</span></span>
            <span className="min-w-0 max-md:hidden">
              <span className="block truncate text-[0.8125rem] text-ink-2">{uses.length ? `${uses.length} wall${uses.length === 1 ? '' : 's'} and floor${uses.length === 1 ? '' : 's'}` : 'Not on a wall or floor yet'}</span>
              <span className={cn('block truncate text-[0.75rem]', st.tone === 'bad' ? 'font-semibold text-bad-600' : st.tone === 'ok' ? 'font-medium text-[#2c4a3e]' : st.tone === 'warn' ? 'font-medium text-ink-2' : 'text-muted')}>{st.label}</span>
            </span>
            <span className="text-right text-[0.90625rem] font-semibold tnum text-ink">{sf ? sf.toLocaleString('en-US') : '—'}</span>
          </button>
        )
      })}
      {!tiles.length && <Empty>No tiles yet — they come in when the tile paperwork is entered.</Empty>}
      {lock.canEdit && !hits && <div className="border-t border-line-2 px-5 py-2 max-sm:px-4"><Button size="xs" icon={<Plus />} onClick={() => s.open({ t: 'tile', jobId: job.id })}>Add a tile</Button></div>}
    </section>
  )
}

/* ---------------- the scope: every floor, its rooms, every wall and floor ---------------- */
export function ScopeSheet({ job, hits, compact }: { job: Job; hits?: Hits; compact?: boolean }) {
  const s = useStore()
  const all = s.rooms[job.id] || []
  const rooms = hits ? all.map((r) => ({ ...r, surfaces: r.surfaces.filter((x) => hits.lines.has(`${r.name}|${x.name}`)) })).filter((r) => r.surfaces.length) : all
  const inField = IN_FIELD_.includes(job.stage)
  const groups = floorsOf(rooms)
  /* compact: every room is one line — tap it for its walls and floors */
  const [openRooms, setOpenRooms] = React.useState<Record<string, boolean>>({})
  return (
    <section className={SHEET}>
      {groups.map((g) => (
        <div key={g.floor}>
          <div className={BAND} style={{ background: GREEN }}><span>{g.floor === 'Rooms' ? 'Scope of work' : g.floor}</span><span>{inField ? 'Done' : 'SF'}</span></div>
          {g.rooms.map((r) => {
            const pct = roomPct(r)
            const rsf = r.surfaces.reduce((n, x) => n + (x.sf || 0), 0)
            const shown = !compact || !!openRooms[r.name]
            const problems = r.surfaces.filter((x) => ['blocked', 'waitmat', 'hold'].includes(x.state)).length
            return (
              <div key={r.name}>
                {compact ? (
                  <button onClick={() => setOpenRooms((o) => ({ ...o, [r.name]: !o[r.name] }))} aria-expanded={shown} aria-label={`Room ${r.name}`} className={cn('flex min-h-[3rem] w-full items-center gap-3 px-5 text-left transition hover:bg-[#f8f6f2] max-sm:px-4', shown ? 'bg-[#f4f1eb]' : 'border-t border-line-2')}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-semibold text-ink">{r.name}</span>
                      <span className={cn('block truncate text-[0.78125rem]', problems ? 'font-medium text-bad-600' : 'text-muted')}>{problems ? `${problems} ${problems === 1 ? 'wall or floor is' : 'walls or floors are'} waiting` : `${r.surfaces.length} ${r.surfaces.length === 1 ? 'wall or floor' : 'walls and floors'}${r.note ? ` · ${r.note}` : ''}`}</span>
                    </span>
                    {inField && <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-[#ece8e1] max-sm:w-12"><span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-[#2c4a3e]' : 'bg-brand-600')} style={{ width: `${pct}%` }} /></span>}
                    <span className={cn('w-[3.5rem] shrink-0 text-right text-[0.9375rem] font-semibold tnum', inField && pct >= 100 ? 'text-[#2c4a3e]' : 'text-ink')}>{inField ? `${pct}%` : rsf ? `${rsf.toLocaleString('en-US')}` : '—'}</span>
                    {shown ? <ChevronDown className="h-4 w-4 shrink-0 text-faint" /> : <ChevronRight className="h-4 w-4 shrink-0 text-faint" />}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 bg-[#efece5] px-5 py-1 max-sm:px-4">
                    <span className="min-w-0 truncate text-[0.8125rem] font-semibold text-ink">{r.name}{r.note && <span className="font-normal text-muted"> · {r.note}</span>}</span>
                    {!hits && <AddSurfaceButton jobId={job.id} room={r.name} have={r.surfaces.map((x) => x.name)} className="h-6 bg-white" />}
                    <span className="ml-auto shrink-0 text-[0.75rem] font-bold tnum text-ink">{inField ? `${pct}%` : rsf ? `${rsf.toLocaleString('en-US')} SF` : ''}</span>
                  </div>
                )}
                {shown && r.surfaces.map((x) => <ScopeLine key={x.name} job={job} room={r} x={x} inField={inField} />)}
                {shown && compact && !hits && <div className="border-t border-line-2 bg-[#faf8f5] px-5 py-1.5 max-sm:px-4"><AddSurfaceButton jobId={job.id} room={r.name} have={r.surfaces.map((x) => x.name)} className="h-6 bg-white" /></div>}
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}
/** one wall or floor, the way the scope of work says it — what it is, what goes on it, the square feet */
function ScopeLine({ job, room, x, inField }: { job: Job; room: Room; x: Surface; inField: boolean }) {
  const s = useStore()
  const t = tileOf(job.id, x.tile)
  const m = methodOf(room.name, x)
  const lay = splitLayout(x.layout)
  const problem = ['blocked', 'waitmat', 'hold', 'unknown'].includes(x.state) && (x.reason || x.pending)
  const tone = SURF_TONE[x.state]
  const pct = surfacePct(x)
  const details = [x.grout ? `${GROUTS[x.grout]?.name} grout` : '', lay.pattern, METHODS[m.key]?.short ? `${METHODS[m.key].short}${m.auto ? ' (suggested)' : ''}` : '', x.height || ''].filter(Boolean)
  return (
    <button onClick={() => s.open({ t: 'surface', jobId: job.id, room: room.name, surface: x.name })} aria-label={`${room.name} · ${x.name}`} className="grid min-h-[2.5rem] w-full grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)_5.5rem] items-center gap-4 border-t border-line-2 px-5 py-1 text-left transition first:border-t-0 hover:bg-[#f8f6f2] max-sm:grid-cols-[minmax(0,1fr)_4.5rem] max-sm:gap-x-3 max-sm:px-4">
      <span className="min-w-0 text-[0.875rem] font-semibold text-ink max-sm:col-span-1">{x.name}</span>
      <span className="flex min-w-0 items-center gap-2.5 max-sm:col-span-2 max-sm:row-start-2">
        {t ? <TileImg tile={t} size={22} radius={5} /> : <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 rounded-md border border-dashed border-[#d1cbc0]" />}
        <span className="min-w-0">
          <span className="block truncate text-[0.84375rem] text-ink-2">{t ? <><b className="font-semibold tnum text-ink">{t.tag}</b> {t.name}{t.size ? <span className="text-muted"> · {t.size}</span> : null}</> : takesTile(x.name) ? <span className="text-muted">No tile yet</span> : <span className="text-muted">Not tiled — goes under the tile</span>}</span>
          {problem
            ? <span className={cn('block truncate text-[0.75rem] font-semibold', tone === 'bad' ? 'text-bad-600' : 'text-ink-2')}>{x.pending ? `${x.pending.co} · waiting on approval` : x.reason}</span>
            : details.length > 0 && <span className="block truncate text-[0.75rem] text-muted">{details.join(' · ')}</span>}
        </span>
      </span>
      <span className="text-right max-sm:row-start-1 max-sm:col-start-2">
        {inField
          ? <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-8 overflow-hidden rounded-full bg-wash-2"><span className={cn('block h-full rounded-full', problem && tone === 'bad' ? 'bg-bad-500' : 'bg-[#2c4a3e]')} style={{ width: `${Math.max(4, pct)}%` }} /></span><span className="w-9 text-right text-[0.8125rem] font-semibold tnum text-ink">{pct}%</span></span>
          : <span className={cn('text-[0.875rem] font-semibold tnum', x.sf ? 'text-ink' : 'text-faint')}>{x.sf ? `${x.sf.toLocaleString('en-US')} SF` : '—'}</span>}
      </span>
    </button>
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
              <span className="flex h-[10.5rem] w-[10.5rem] flex-col items-center justify-center gap-2 rounded-[1rem] border border-dashed border-[#d1cbc0] bg-wash text-center transition group-hover:border-brand-300 group-hover:bg-brand-50/40">
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
