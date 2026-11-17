/* Scope of work — two cards, the same as every other tab:
 *   Tiles           — the project's tiles, one chip each (picture, tag, name, is it here)
 *   Walls and floors — every wall and floor, room by room (or tile by tile), one row each on the same columns:
 *                      the wall or floor · the tile · the grout · how it's set · SF · where it's at
 * Whose scope it is (and that it's locked) is said once, in the card's header. Tap a wall or floor to change it
 * (one window of dropdowns); tap a tile to change the tile. */
import * as React from 'react'
import { sellsTile } from '@/tileos/data/directory'
import { Upload, Plus, FileText, Ruler, Sparkles, Camera, Trash2, ChevronRight, Layers3, Building2, ImagePlus, AlertTriangle, PauseCircle, Clock3, Ban, ArrowLeftRight, Lock, Unlock, LayoutGrid, ChevronDown, Check } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Button, Segmented, TextInput, TextArea, SearchField } from '@/tileos/components/ui/core'
import { Modal, Pop, Tip } from '@/tileos/components/ui/overlay'
import { Status } from '@/tileos/components/ui/page'
import { SearchSelect, MultiSelect } from '@/tileos/components/ui/select'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { toast } from '@/tileos/lib/pop'
import { PEOPLE, type Job, type Tone } from '@/tileos/data/model'
import { GROUTS, JOINTS, SURF_TONE, surfacePct, roomPct, tilesOf, tileOf, floorsOf, hasTile, sfFor, type Room, type Surface, type Tile } from '@/tileos/data/jobs'
import { needWithWaste } from '@/tileos/data/work'
import { METHODS, type MethodKey } from '@/tileos/data/takeoff'
import { methodOf, suggestMethod, methodsFor, kindOf } from '../takeoff'
import { settingStatus } from '../setting'
import { scopeLock, takesTile } from '../steps'
import { surfaceFix } from './overview'
import { Section, Empty, Group, Strip, GREEN, SHEET } from './kit'
import { ScopeAreaAdder, AreaPicker, RoomMenu, RoomLines } from '../roomedit'
import { estimateInto, stopEstimate } from '../bringin'
import { ReadingCard } from '../readcard'
import { useReadingOf } from '@/tileos/lib/reading'
import { LayoutArt } from './rooms'
import {
  saveTile, removeTile, saveSurface, addGrout, readPhoto, nextTag, refKey, splitLayout, joinLayout, isMetal,
  TILE_SIZES, FINISHES, WHO_ORDERS, PATTERNS, STARTS, HEIGHTS,
} from '../tiles'
import { EdgePicker } from '../metalpick'
import { PatternPic, PatternPick } from '../patternpic'

const SURF_STATUS: Record<string, string> = { done: 'Done', working: 'Working', ready: 'Ready', blocked: 'Blocked', waitmat: 'Waiting on material', hold: 'On hold', notstarted: 'Not started', unknown: 'To check' }
const IN_FIELD = ['scheduled', 'installation', 'punch', 'closeout', 'complete']

/* ---------------- where a tile stands: ordered? here? short? ---------------- */
export function tileStatus(s: Pick<Store, 'checks' | 'shortages' | 'rooms'>, jobId: string, tag: string): { tone: Tone; label: string } {
  const sh = s.shortages.find((x) => x.jobId === jobId && x.tag === tag && x.step !== 'received')
  if (sh) return { tone: 'bad', label: sh.step === 'short' ? `${sh.qty} ${sh.unit} short` : `Reordered · ${sh.eta || 'coming'}` }
  const c = s.checks.find((y) => y.jobId === jobId && y.tag === tag)
  const on = (s.rooms[jobId] || []).flatMap((r) => r.surfaces).filter((x) => hasTile(x, tag))
  const sf = on.reduce((n, x) => n + sfFor(jobId, x, tag), 0)
  if (tileOf(jobId, tag)?.trim && on.length && !s.checks.some((y) => y.jobId === jobId && y.tag === tag)) return { tone: 'neutral', label: 'Trim — by the piece' }
  if (!c) return sf ? { tone: 'warn', label: 'Not ordered yet' } : on.length ? { tone: 'neutral', label: 'No square feet yet' } : { tone: 'neutral', label: 'Not on a wall or floor yet' }
  const need = needWithWaste(c)
  if (c.ordered < need) return { tone: 'bad', label: `Order is ${need - c.ordered} ${c.unit} short` }
  if (c.received >= c.ordered) return { tone: 'ok', label: 'On site' }
  if (c.received > 0) return { tone: 'warn', label: `${c.received} of ${c.ordered} ${c.unit} here` }
  return { tone: 'info', label: c.eta && c.eta !== 'TBD' ? `Ordered · due ${c.eta}` : 'Ordered' }
}
const usesOf = (rooms: Room[], tag: string) => rooms.flatMap((r) => r.surfaces.filter((x) => hasTile(x, tag)).map((x) => ({ room: r, x })))

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
/** no rooms yet (a project made here, not from an approved estimate): set the scope up right here — its estimate (the
 *  rooms, walls and floors read from it by themselves), or a room at a time by hand */
export function ScopeStart({ job, bare, onAdded }: { job: Job; /** just the buttons — where what it's for is said already (the estimate step) */ bare?: boolean; /** a room was added by hand — the scope opens to go on with it */ onAdded?: (room: string) => void }) {
  const s = useStore()
  const can = scopeLock(s, job.id).canEdit
  const file = React.useRef<HTMLInputElement>(null)
  /* the reading lives outside this window (lib/reading): leave and come back, it's still going — with how far it got */
  const reading = useReadingOf('estimate', job.id)
  const last = React.useRef<File | null>(null)
  const read = (f?: File | null) => {
    if (!f) return
    last.current = f
    void estimateInto(job.id, f).catch(() => undefined)
  }
  const card = reading ? <ReadingCard r={reading} onStop={() => stopEstimate(job.id)} onRetry={last.current ? () => read(last.current) : undefined} className="mb-3" /> : null
  const going = !!reading && !reading.failed
  if (bare) return (
    <div data-scope-start data-bare>
      {card}
      {can ? (
        !going && <div className="flex flex-wrap items-center gap-2 max-sm:grid max-sm:grid-cols-2 max-sm:[&_button]:w-full">
          <input ref={file} type="file" accept="application/pdf,image/*" className="hidden" aria-label="Its estimate" data-scope-estimate onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; read(f) }} />
          <Button variant="primary" icon={<Upload />} onClick={() => file.current?.click()} data-scope-estimate-btn>Upload the estimate</Button>
          {/* the whole scope is built in one place: this window gives way to the scope of work */}
          <Button icon={<Layers3 />} onClick={() => s.swap({ t: 'scopewin', jobId: job.id })} data-scope-by-hand>Build it by hand</Button>
        </div>
      ) : <div className="text-[0.84375rem] text-muted">{PEOPLE[scopeLock(s, job.id).owner]?.short || 'The office'} adds it.</div>}
    </div>
  )
  if (going) return <div data-scope-start>{card}</div>
  return (
    <div className="rounded-xl border border-dashed border-[#d6cfc3] bg-white px-5 py-4 max-sm:px-4" data-scope-start>
      {card}
      <div className="text-[0.9375rem] font-semibold text-ink">No rooms yet</div>
      <div className="mt-0.5 text-[0.84375rem] text-muted">{can ? 'Upload its estimate — the rooms, walls and floors fill in by themselves. Or build it here, floor by floor.' : 'They come from its estimate — the office adds it.'}</div>
      {can && (
        <>
          <div className="mt-3">
            <input ref={file} type="file" accept="application/pdf,image/*" className="hidden" aria-label="Its estimate" data-scope-estimate onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; read(f) }} />
            <Button variant="primary" size="sm" icon={<Upload />} onClick={() => file.current?.click()} data-scope-estimate-btn>Upload the estimate</Button>
          </div>
          <div className="mt-4 border-t border-line-2 pt-3.5" data-scope-build>
            <div className="mb-2 flex flex-wrap items-center gap-x-2 text-[0.8125rem] font-semibold text-ink"><Layers3 className="h-4 w-4 text-muted" />Or build it here<span className="font-normal text-muted">— pick the floor, then each room; it comes with its usual walls and floors</span></div>
            <AreaPicker jobId={job.id} onAdded={(room) => onAdded?.(room)} />
          </div>
        </>
      )}
    </div>
  )
}
export function ScopeTab({ job }: { job: Job }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  if (!rooms.length) return <ScopeStart job={job} />
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
      {lock.canEdit && !hits && <ScopeAreaAdder jobId={job.id} />}
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
  const mine = lock.owner === meOf(s.role)
  return <div className="flex items-center gap-2.5 rounded-[0.75rem] bg-wash px-4 py-2.5 text-[0.84375rem] text-ink-2"><Lock className="h-4 w-4 shrink-0" />{lock.canEdit ? (mine ? 'Locked — it’s your scope, so only you change it.' : `Locked — it’s ${PEOPLE[lock.owner]?.short}’s scope. You can change it as the admin.`) : `Locked — it’s ${PEOPLE[lock.owner]?.short}’s scope. Only ${PEOPLE[lock.owner]?.short} changes it.`}</div>
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
        const sf = Math.round(uses.reduce((n, u) => n + sfFor(job.id, u.x, t.tag), 0))
        const st = tileStatus(s, job.id, t.tag)
        const grout = t.grout || uses.find((u) => u.x.grout)?.x.grout
        return (
          <button key={t.tag} onClick={() => s.open({ t: 'tile', jobId: job.id, tag: t.tag })} aria-label={`Tile ${t.tag} ${t.name}`} className="grid min-h-[2.75rem] w-full grid-cols-[2rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-3.5 border-t border-line-2 px-5 py-1 text-left transition first:border-t-0 row-hover max-md:grid-cols-[2rem_minmax(0,1fr)_4rem] max-sm:px-4">
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
  const canEdit = scopeLock(s, job.id).canEdit
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
                  <button onClick={() => setOpenRooms((o) => ({ ...o, [r.name]: !o[r.name] }))} aria-expanded={shown} aria-label={`Room ${r.name}`} className={cn('flex min-h-[3rem] w-full items-center gap-3 px-5 text-left transition row-hover max-sm:px-4', shown ? 'bg-[#f4f1eb]' : 'border-t border-line-2')}>
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
                    <span className="ml-auto shrink-0 text-[0.75rem] font-bold tnum text-ink">{inField ? `${pct}%` : rsf ? `${rsf.toLocaleString('en-US')} SF` : ''}</span>
                    {canEdit && !hits && <RoomMenu jobId={job.id} room={r} />}
                  </div>
                )}
                {shown && r.surfaces.map((x) => <ScopeLine key={x.name} job={job} room={r} x={x} inField={inField} />)}
                {shown && canEdit && !hits && <div className="flex flex-wrap items-center gap-1.5 border-t border-line-2 px-5 py-1.5 max-sm:px-4" data-add-row>{!r.surfaces.length && <span className="mr-1 text-[0.8125rem] text-muted">No walls or floors yet</span>}<RoomLines jobId={job.id} room={r} /></div>}
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
  const details = [lay.pattern, x.grout ? `${GROUTS[x.grout]?.name} grout` : '', METHODS[m.key]?.short ? `${METHODS[m.key].short}${m.auto ? ' (suggested)' : ''}` : '', x.height || ''].filter(Boolean)
  return (
    <button onClick={() => s.open({ t: 'surface', jobId: job.id, room: room.name, surface: x.name })} aria-label={`${room.name} · ${x.name}`} className="grid min-h-[2.5rem] w-full grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)_5.5rem] items-center gap-4 border-t border-line-2 px-5 py-1 text-left transition first:border-t-0 row-hover max-sm:grid-cols-[minmax(0,1fr)_4.5rem] max-sm:gap-x-3 max-sm:px-4">
      <span className="min-w-0 text-[0.875rem] font-semibold text-ink max-sm:col-span-1">{x.name}</span>
      <span className="flex min-w-0 items-center gap-2.5 max-sm:col-span-2 max-sm:row-start-2">
        {t ? <TileImg tile={t} size={22} radius={5} /> : <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 rounded-md border border-dashed border-[#d1cbc0]" />}
        <span className="min-w-0">
          <span className="block truncate text-[0.84375rem] text-ink-2">{t ? <><b className="font-semibold tnum text-ink">{t.tag}</b> {t.name}{t.size ? <span className="text-muted"> · {t.size}</span> : null}</> : takesTile(x.name) ? <span className="text-muted">No tile yet</span> : <span className="text-muted">Not tiled — goes under the tile</span>}</span>
          {problem
            ? <span className={cn('block truncate text-[0.75rem] font-semibold', tone === 'bad' ? 'text-bad-600' : 'text-ink-2')}>{x.pending ? `${x.pending.co} · waiting on approval` : x.reason}</span>
            : details.length > 0 && <span className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-muted">{lay.pattern && <PatternPic pattern={lay.pattern} w={18} />}<span className="truncate">{details.join(' · ')}</span></span>}
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
  /* where it starts (and the drawing) and what goes under it: folded away — most of the time they're not what you came for */
  const [more, setMore] = React.useState(false)
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
      tile, grout, joint, layout: touched ? layout || undefined : x.layout, method: method || x.method || undefined, edge: kind === 'wall' ? edge : x.edge, height: kind === 'wall' ? height : x.height, sf: Math.round(Number(sf.replace(/[^0-9.]/g, ''))) || undefined, notes,
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
              <div className="ml-auto" aria-hidden />
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
      <Row label="Pattern">
        <PatternPick value={pattern} onChange={setPattern} drain={kind === 'shower-floor'} />
      </Row>
      {kind === 'wall' && (
        <Row label="How high">
          <SearchSelect label="How high" value={height} onChange={setHeight} emptyLabel="Not set" options={opts(HEIGHTS, height)} onCreate={setHeight} createLabel={(q) => `Use “${q}”`} search={false} width={300} />
        </Row>
      )}
      {/* the edges — metal or mitered — are a wall's (a floor has none) */}
      {kind === 'wall' && (
        <Row label="Edges" hint={isMetal(edge) ? 'The metal goes on the materials order by the piece — and on the room sheet' : edge ? 'On the room sheet' : undefined}>
          <EdgePicker value={edge} onChange={setEdge} />
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
      <button type="button" onClick={() => setMore(!more)} aria-expanded={more} data-surface-more className="mt-1 flex w-full items-center gap-2 border-t border-line-2 py-3 text-left text-[0.84375rem] font-semibold text-muted hover:text-ink">
        {more ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}More<span className="font-normal">— where it starts, what goes under it</span>
      </button>
      {more && <>
      <Row label="Where it starts" hint={x.dims ? 'Drawn to scale — the crew’s sheet shows every cut' : t ? 'Draw it to scale to see the cuts and the best place to start' : undefined}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
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
      </>}
      </fieldset>
    </Modal>
  )
}

/* ================= one tile: picture, what it is, the grout, where it goes ================= */
/* Few fields: the tag and its name, the size, the grout, who orders it and from which store (the job's own store —
 * its first tile PO — until it's another). The finish, the maker, the color and the box under "More about it".
 * Where it goes: room by room, its walls and floors as buttons — tap the ones this tile goes on; the usual ones a room
 * doesn't have yet (a niche, a backsplash) are there to add. A wall it's on: how high and which walls. A wall or floor
 * with another tile on it says so — it's changed from there, never swapped by accident here. */
const BASICS = ['Floor', 'Walls', 'Shower floor', 'Shower walls', 'Niche', 'Backsplash']
/** a wall that can stop part way up, on some of the walls */
const wallish = (n: string) => /wall|wainscot/i.test(n) && !/niche/i.test(n)
const HIGH: { label: string; v: string }[] = [
  { label: 'To the ceiling', v: 'Fully tiled — to the ceiling' },
  { label: '4 ft', v: 'Half tiled — to 4 ft' },
  { label: '8 ft', v: '96″' },
]
const WALLS = ['Back', 'Left', 'Right', 'Front']
const PICK = 'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[0.5rem] border px-2.5 text-[0.84375rem] font-medium transition max-md:h-10 max-md:px-3'
const pickCls = (on: boolean) => cn(PICK, on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:border-[#d1cbc0] hover:bg-wash')

export function TileModal({ jobId, tag, room, surface, level }: { jobId: string; tag?: string; room?: string; surface?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const cur = tag ? s.tiles[jobId]?.[tag] : undefined
  /* the store: the job's own (its first tile PO) when the tile doesn't say */
  const [t, setT] = React.useState<Tile>(() => (cur ? { ...cur, supplier: cur.supplier || job?.tileStore || '' } : { tag: nextTag(jobId), name: '', size: '', finish: 'Matte', maker: '', supplier: job?.tileStore || '', suppliedBy: 'GC', sku: '', grout: '', joint: '1/16″' }))
  const rooms = s.rooms[jobId] || []
  const flat = rooms.flatMap((r) => r.surfaces.map((x) => ({ room: r.name, surface: x.name, x })))
  const [on, setOn] = React.useState<string[]>(() => (cur ? flat.filter((f) => hasTile(f.x, cur.tag)).map(refKey) : room && surface ? [refKey({ room, surface })] : []))
  /* walls and floors to make (a niche the room didn't have), heights and walls changed here */
  const [adds, setAdds] = React.useState<{ room: string; surface: string }[]>([])
  const [heights, setHeights] = React.useState<Record<string, string>>({})
  const [walls, setWalls] = React.useState<Record<string, string[]>>({})
  /* the rooms shown: where it is now, and the room it was opened from */
  const [shown, setShown] = React.useState<string[]>(() => Array.from(new Set([...(cur ? flat.filter((f) => hasTile(f.x, cur.tag)).map((f) => f.room) : []), ...(room ? [room] : [])])))
  const [more, setMore] = React.useState(false)
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
  const save = () => saveTile(jobId, { ...t, tag: tagT, name: t.name.trim(), maker: t.maker.trim(), sku: t.sku.trim(), supplier: t.supplier.trim() }, {
    was: tag,
    on: on.map((k) => { const [r, sfc] = k.split('|'); return { room: r, surface: sfc } }),
    adds: adds.filter((a) => on.includes(refKey(a))),
    heights, walls,
  })
  /* the tile stores (Suppliers that sell tile) first, then any store a tile came from before */
  const suppliers = Array.from(new Set([...(job.tileStore ? [job.tileStore] : []), ...s.suppliers.filter((x) => sellsTile(x)).map((x) => x.name), ...Object.values(s.tiles).flatMap((m) => Object.values(m).map((x) => x.supplier)).filter(Boolean)]))
  const toggle = (k: string) => setOn((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]))
  const heightOf = (k: string, x?: Surface) => (k in heights ? heights[k] : x?.height || '')
  const wallsOf = (k: string, x?: Surface) => (k in walls ? walls[k] : x?.walls || [])
  const moreN = [t.finish && t.finish !== 'Matte' ? 1 : 0, t.maker ? 1 : 0, t.sku ? 1 : 0, t.boxSF ? 1 : 0].reduce((a, b) => a + b, 0)
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title={cur ? `${cur.tag} · ${cur.name}` : 'Add a tile'}
      sub={job.name}
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
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" disabled={!ok || busy} onClick={save}>{cur ? 'Save' : 'Add the tile'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-6 max-sm:grid-cols-1">
        <div className="flex flex-col items-center gap-2">
          <button onClick={() => fileRef.current?.click()} aria-label="Add a photo" className="group relative overflow-hidden rounded-[1rem]">
            {t.photo || t.swatch ? <TileImg tile={t} size={136} radius={16} /> : (
              <span className="flex h-[8.5rem] w-[8.5rem] flex-col items-center justify-center gap-2 rounded-[1rem] border border-dashed border-[#d1cbc0] bg-wash text-center transition group-hover:border-brand-300 group-hover:bg-brand-50/40">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 shadow-card"><ImagePlus className="h-5 w-5" /></span>
                <span className="text-[0.84375rem] font-semibold text-ink">{busy ? 'Reading…' : 'Add a photo'}</span>
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
            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
              <Field2 label="Grout"><SearchSelect label="Grout" value={t.grout || ''} onChange={(v) => set({ grout: v })} emptyLabel="Not picked yet" options={Object.entries(GROUTS).map(([k, g]) => ({ key: k, label: g.name, hint: g.product, lead: <GroutDot grout={k} size={16} /> }))} onCreate={(name) => set({ grout: addGrout(name) })} createLabel={(q) => `Add “${q}” as a grout color`} search searchPlaceholder="Type a color…" width={300} /></Field2>
              <Field2 label="Joint"><SearchSelect label="Joint" value={t.joint || ''} onChange={(v) => set({ joint: v })} options={JOINTS.map((j) => ({ key: j, label: j }))} placeholder="Joint" search={false} width={160} /></Field2>
            </div>
            <Field2 label="Who orders it">
              <Segmented value={t.suppliedBy || 'GC'} onChange={(v) => set({ suppliedBy: v })} items={WHO_ORDERS} className="h-10 w-full [&>button]:flex-1 [&>button]:justify-center" />
            </Field2>
            <Field2 label="From which store" hint={job.tileStore && t.supplier === job.tileStore ? `This job’s tile store` : undefined}><SearchSelect label="Store" value={t.supplier} onChange={(v) => set({ supplier: v })} options={suppliers.map((x) => ({ key: x, label: x }))} placeholder="Pick or type" onCreate={(v) => set({ supplier: v })} createLabel={(q) => `Add “${q}”`} search width={280} /></Field2>
          </div>
          {/* the rest of what's on the finish schedule — when it's needed */}
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="mt-3 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-700 hover:underline" data-tile-more>
            {more ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}More about it{!more && moreN ? <span className="font-normal text-muted"> · {[t.finish !== 'Matte' ? t.finish : '', t.maker, t.sku, t.boxSF ? `${t.boxSF} SF a box` : ''].filter(Boolean).join(' · ')}</span> : !more ? <span className="font-normal text-muted"> · finish, maker, color, box</span> : null}
          </button>
          {more && (
            <div className="mt-2 grid grid-cols-2 gap-3 max-sm:grid-cols-1" data-tile-more-fields>
              <Field2 label="Finish"><SearchSelect label="Finish" value={t.finish} onChange={(v) => set({ finish: v })} options={opts(FINISHES, t.finish)} search={false} width={220} /></Field2>
              <Field2 label="Maker"><TextInput aria-label="Maker" value={t.maker} onChange={(e) => set({ maker: e.target.value })} placeholder="e.g. Marca Corona" className="h-10" /></Field2>
              <Field2 label="Color or SKU"><TextInput aria-label="Color or SKU" value={t.sku} onChange={(e) => set({ sku: e.target.value })} placeholder="As on the finish schedule" className="h-10" /></Field2>
              <Field2 label="SF in a box"><TextInput aria-label="Square feet in a box" inputMode="decimal" value={t.boxSF ? String(t.boxSF) : ''} onChange={(e) => set({ boxSF: Number(e.target.value.replace(/[^0-9.]/g, '')) || undefined })} placeholder="—" className="h-10 tnum" /></Field2>
            </div>
          )}
          {/* where it goes: room by room, the walls and floors to tap */}
          <div className="mt-4 border-t border-line-2 pt-4" data-where-goes>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-[0.8125rem] font-medium text-ink-2">Where it goes</span>
              <span className="text-[0.78125rem] text-muted">{on.length ? `${on.length} ${on.length === 1 ? 'place' : 'places'}${t.grout ? ' — they take this tile and its grout' : ''}` : 'Tap the walls and floors it goes on'}</span>
            </div>
            {!rooms.length && <div className="rounded-xl border border-dashed border-line px-3 py-3 text-[0.8125rem] text-muted">No rooms on the scope of work yet — add them there, then pick where it goes.</div>}
            {shown.map((rn) => {
              const r = rooms.find((x) => x.name === rn)
              if (!r) return null
              const have = r.surfaces.filter((x) => takesTile(x.name) || x.tile)
              const added = adds.filter((a) => a.room === rn && !have.some((x) => x.name === a.surface)).map((a) => a.surface)
              const names = [...have.map((x) => x.name), ...added]
              const basics = BASICS.filter((b) => !names.some((n) => n.toLowerCase() === b.toLowerCase()))
              const key = (n: string) => refKey({ room: rn, surface: n })
              const wallsOn = names.filter((n) => wallish(n) && on.includes(key(n)))
              return (
                <div key={rn} className="mb-2.5 rounded-xl border border-line-2 p-3" data-where-room={rn}>
                  <div className="mb-2 flex items-baseline gap-2"><span className="min-w-0 truncate text-[0.875rem] font-semibold text-ink">{rn}</span>{r.floor && <span className="shrink-0 text-[0.78125rem] text-muted">{r.floor}</span>}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {have.map((x) => {
                      const k = key(x.name)
                      const isOn = on.includes(k)
                      const other = x.tile && x.tile !== tag && !isOn ? x.tile : ''
                      return other ? (
                        <span key={x.name} title={`${x.name} has ${other} — change it from that wall or floor`} className={cn(PICK, 'cursor-default border-dashed border-line bg-wash/60 text-muted')} data-where-taken={x.name}>{x.name}<span className="text-[0.75rem] font-semibold text-faint">{other}</span></span>
                      ) : (
                        <button key={x.name} type="button" aria-pressed={isOn} onClick={() => toggle(k)} className={pickCls(isOn)} data-where-chip={x.name}>{isOn && <Check className="h-3.5 w-3.5" />}{x.name}</button>
                      )
                    })}
                    {added.map((n) => <button key={n} type="button" aria-pressed={on.includes(key(n))} onClick={() => toggle(key(n))} className={pickCls(on.includes(key(n)))} data-where-chip={n}>{on.includes(key(n)) && <Check className="h-3.5 w-3.5" />}{n}</button>)}
                    {basics.map((b) => <button key={b} type="button" onClick={() => { setAdds((a) => [...a, { room: rn, surface: b }]); setOn((o) => [...o, key(b)]) }} className={cn(PICK, 'border-dashed border-line bg-white text-muted hover:border-brand-300 hover:text-brand-700')} data-where-add={b}><Plus className="h-3.5 w-3.5" />{b}</button>)}
                  </div>
                  {/* a wall it's on: how high, which walls */}
                  {wallsOn.map((n) => {
                    const k = key(n)
                    const x = have.find((y) => y.name === n)
                    const h = heightOf(k, x)
                    const custom = !!h && !HIGH.some((o) => o.v === h)
                    const ws = wallsOf(k, x)
                    return (
                      <div key={n} className="mt-2.5 flex flex-col gap-2 rounded-lg bg-wash/60 p-2.5" data-wall-how={n}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="w-[6.5rem] shrink-0 text-[0.8125rem] text-muted max-sm:w-full">{n} · how high</span>
                          {HIGH.map((o) => <button key={o.v} type="button" aria-pressed={h === o.v} onClick={() => setHeights((m) => ({ ...m, [k]: h === o.v ? '' : o.v }))} className={pickCls(h === o.v)} data-wall-high={o.label}>{o.label}</button>)}
                          <input aria-label={`${n} — how high, in your words`} value={custom ? h : ''} onChange={(e) => setHeights((m) => ({ ...m, [k]: e.target.value }))} placeholder="Other — 5 ft" className={cn('h-8 w-[7.5rem] rounded-[0.5rem] border bg-white px-2.5 text-[0.84375rem] text-ink outline-none focus:border-brand-300 max-md:h-10', custom ? 'border-brand-500' : 'border-line')} data-wall-high-other />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="w-[6.5rem] shrink-0 text-[0.8125rem] text-muted max-sm:w-full">Which walls</span>
                          <button type="button" aria-pressed={!ws.length} onClick={() => setWalls((m) => ({ ...m, [k]: [] }))} className={pickCls(!ws.length)} data-wall-which="All">All</button>
                          {WALLS.map((w) => { const isOn = ws.includes(w); return <button key={w} type="button" aria-pressed={isOn} onClick={() => setWalls((m) => ({ ...m, [k]: isOn ? ws.filter((y) => y !== w) : [...ws, w] }))} className={pickCls(isOn)} data-wall-which={w}>{w}</button> })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {rooms.length > shown.length && (
              <SearchSelect
                label="Another room"
                value=""
                onChange={(v) => v && setShown((x) => (x.includes(v) ? x : [...x, v]))}
                placeholder="+ Another room"
                options={rooms.filter((r) => !shown.includes(r.name)).map((r) => ({ key: r.name, label: r.name, hint: r.floor || undefined }))}
                search={rooms.length > 8}
                width={320}
              />
            )}
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
