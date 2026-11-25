/* What has to come to the job, and where it's at — one line each, no number columns:
 *   Tile: every tile — its picture and name, the rooms it goes in, how much we need (with the extra for cuts), and where
 *     it's at in a few words (ordered · due Fri, 18 of 30 boxes here, on site, 6 boxes short) — and, when there's
 *     something to do about it, its one button (the GC ordered it, it came in, settle it).
 *   Our materials: what we buy for the job — thinset, grout, boards, membranes, metal edges — worked out from the square
 *     feet and what each wall and floor is set on. Tap one to see how it was worked out. */
import * as React from 'react'
import { ChevronDown, ShoppingCart, SlidersHorizontal, Calculator, Ruler, Plus, MoreHorizontal, Pencil, Trash2, RotateCcw, Search, Truck, Upload, PackagePlus } from 'lucide-react'
import { logTileOrder } from '../flows2'
import { useStore, addHist, meOf } from '@/tileos/store'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { Menu, MenuItem, Pop } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { ItemThumb } from '../items'
import { addMat, setMatQty, removeMat, restoreMat } from '../matedit'
import { Status, HEAD_ROW } from '@/tileos/components/ui/page'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { needNow, orderShort } from '@/tileos/data/work'
import { tilesOf, tileOf, hasTile, sfFor, GROUTS, floorsOf, type Room } from '@/tileos/data/jobs'
import { sellsTile } from '@/tileos/data/directory'
import type { Job } from '@/tileos/data/model'
import { takeoff, qtyLabel, GROUPS, type TakeLine } from '../takeoff'
import { tileStatus } from './scope-tab'
import { useSaveStatus } from '@/tileos/lib/save'
import { Word, PaperBar, FloorBand, PAPER, PAPER_ROW, ROOM_BAND, ROOM_NAME, PIC_LG, PIC_SM } from './kit'
import { openTilePOs } from '../tilepo'
import { tileStoreOf } from '../tiles'
import { scopeLock } from '../steps'
import { PaperPanel, usePaperPicker, usePaperReview } from '../paperread'
import { useReadingOf } from '@/tileos/lib/reading'
import { DOC_GRAY } from '../docpaper'

/** what · where it goes · how much we need · where it's at (and its button) */
const QGRID = 'grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_6.5rem_19rem_2rem] items-center gap-x-6 max-lg:grid-cols-[minmax(0,1fr)_6rem_15rem_2rem] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3'
const QFIRST = 'flex min-w-0 items-center gap-3'
/** the tile: what · how much we need · where it's at (and its button) */
/** Tile · Where it goes · We need · Where it's at (a smaller screen: where it goes under the tile's name) */
const TGRID = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_17rem_1rem] items-center gap-x-6 max-lg:grid-cols-[minmax(0,1fr)_6rem_15rem_1rem] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3'
/* one slim line a material — more of the list on one screen */
/* one slim line a material — the same 40px as the tile's and the scope's */
const ROWPAD = 'min-h-[2.5rem] border-t border-line-2 px-5 py-1 max-sm:min-h-12 max-sm:px-3 max-sm:py-2'
const num = (n?: number) => (n ? n.toLocaleString('en-US') : '')
const EXACT = new Set(['m-liner', 'm-jolly', 'm-trim', 'm-edge'])

/* ---------------- tile ---------------- */
/* The tile, room by room — the same rooms, in the same order, as the scope of work: each room's band, then each tile in
 * it: its picture and name, where in the room (the floor, the shower walls), how many square feet there, and where it's
 * at (here, coming, not ordered — tap it for what to do), and the other rooms it's used in (as the paperwork says it). A
 * tile on no wall or floor yet is said at the end. The rooms' bands the same as the scope's: the name in bold capitals.
 * On top, staying there as you scroll: the tile store (every tile PO goes there), Order more tile, and Tile came in. */
const TROW = 'grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_6rem_15rem] items-center gap-x-6 max-lg:grid-cols-[minmax(0,1fr)_auto] max-lg:gap-x-3'
export function TileOrders({ job, onScope, simple, lead }: { job: Job; onScope: () => void; simple?: boolean; /** what goes on the left of the bar on top (the switch) */ lead?: React.ReactNode }) {
  const s = useStore()
  const reading = useReadingOf('paperwork', job.id)
  const rooms = s.rooms[job.id] || []
  const checks = s.checks.filter((c) => c.jobId === job.id)
  const all = Array.from(new Set([...tilesOf(job.id).map((t) => t.tag), ...checks.map((c) => c.tag)]))
  const [q, setQ] = React.useState('')
  const ws = q.toLowerCase().split(/\s+/).filter(Boolean)
  const roomsOfTag = (tag: string) => rooms.filter((r) => r.surfaces.some((x) => hasTile(x, tag))).map((r) => r.name)
  const tags = ws.length ? all.filter((tag) => { const t = tileOf(job.id, tag); const hay = [tag, t?.name, t?.size, t?.supplier, t?.grout && GROUTS[t.grout]?.name, ...roomsOfTag(tag)].filter(Boolean).join(' ').toLowerCase(); return ws.every((w) => hay.includes(w)) }) : all
  /* each room, the tiles in it (the ones a search keeps) — floor by floor, in the scope's order */
  const usesOf = (r: Room) => tags.flatMap((tag) => { const xs = r.surfaces.filter((x) => hasTile(x, tag)); return xs.length ? [{ tag, xs }] : [] })
  const groups = floorsOf(rooms.filter((r) => usesOf(r).length))
  const floors = groups.length > 1 || (!!groups[0] && groups[0].floor !== 'Rooms')
  const unused = tags.filter((tag) => !rooms.some((r) => r.surfaces.some((x) => hasTile(x, tag))))
  return (
    <>
      {/* the bar on top — the same as the scope's: the switch on the left; a search, Order more tile and Tile came in on
          the right. (The tile store is one of the project's details: ··· → Change the project's details) */}
      <PaperBar lead={lead} mark="data-tile-bar">
        {(all.length > 0 || !simple) && <>
          {all.length > 6 && (
            <label className="relative block w-[12rem] max-sm:order-last max-sm:w-[11rem]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tiles" aria-label="Search tiles" data-tile-search className="h-9 w-full rounded-full border border-line bg-white pl-8 pr-3 text-[0.8125rem] text-ink outline-none transition placeholder:text-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-100 max-md:h-11" />
            </label>
          )}
          {/* more tile from the store — a tile PO for the extra, with a number to follow */}
          {all.length > 0 && <Button icon={<PackagePlus />} onClick={() => s.open({ t: 'moretile', jobId: job.id })} data-tile-more>Order more tile</Button>}
          {/* the tile came — count the boxes */}
          {all.length > 0 && <Button variant="primary" icon={<Truck />} onClick={() => s.open({ t: 'receivetile', jobId: job.id })} data-tile-in>Tile came in</Button>}
        </>}
      </PaperBar>
      <div className={PAPER} data-tile-list>
        {tags.length > 0 && <div className={cn(HEAD_ROW, TROW, 'sticky top-0 z-[6] px-5 max-lg:hidden')} data-tile-cols><span>Tile</span><span>Where in the room</span><span className="text-right">SF</span><span className="text-right">Where it’s at</span></div>}
        {groups.map((fg) => (
          <section key={fg.floor} data-floor={fg.floor} className="[&+&]:border-t [&+&]:border-line">
            {/* each floor in the scope's dark green band */}
            {floors && <FloorBand floor={fg.floor} rooms={fg.rooms.length} />}
            {fg.rooms.map((r, i) => {
              const uses = usesOf(r)
              return (
                <section key={r.name} data-tile-room-group={r.name}>
                  {/* the room's band — the same as on the scope of work: its name in bold capitals; it stays under the
                      column names while its tiles go by */}
                  <div className={cn(ROOM_BAND, 'px-5 max-sm:px-3 lg:sticky lg:top-10 lg:z-[4]', (i > 0 || !floors) && 'border-t border-line')} style={{ background: DOC_GRAY }} data-band data-tile-room-band>
                    <b className={cn(ROOM_NAME, 'min-w-0 truncate')}>{r.name}</b>
                    <span className="text-[#555] tnum">{uses.length}</span>
                  </div>
                  {uses.map((u) => <TileLine key={u.tag} job={job} tag={u.tag} xs={u.xs} room={r.name} simple={simple} />)}
                </section>
              )
            })}
          </section>
        ))}
        {unused.length > 0 && (
          <section data-tile-room-group="">
            <div className={cn(ROOM_BAND, 'border-t border-line px-5 max-sm:px-3')} style={{ background: DOC_GRAY }} data-band data-tile-room-band><b className={cn(ROOM_NAME, 'min-w-0 truncate text-warn-700')}>Not on a wall or floor yet</b><span className="text-[#555] tnum">{unused.length}</span></div>
            {unused.map((tag) => <TileLine key={tag} job={job} tag={tag} xs={[]} simple={simple} />)}
          </section>
        )}
        {!all.length && (
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-[0.84375rem] text-muted max-sm:px-3" data-tiles-empty>
            <span className="min-w-0 flex-1">{reading ? 'The tile paperwork is being read. On the Scope of work.' : 'No tiles yet. They come from the tile paperwork, on the Scope of work (or a wall’s “Add a new tile”).'}</span>
            <Button size="sm" icon={<Ruler />} onClick={onScope}>Scope of work</Button>
          </div>
        )}
        {all.length > 0 && !tags.length && <div className="border-t border-line-2 px-5 py-3 text-[0.84375rem] text-muted max-sm:px-3">No tile matches “{q}”.</div>}
      </div>
    </>
  )
}

/** a room's name the way it reads in a sentence — "POWDER ROOM #1" → "Powder Room #1" (a name already in mixed case stays) */
const roomWords = (n: string) => (/[a-z]/.test(n) ? n : n.toLowerCase().replace(/(^|[\s/(-])([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase()))
/** one tile in a room: its picture and name, where in the room, its square feet there, the other rooms it's used in —
 *  and where it's at (tap it for what to do: it came in, it was ordered, settle the count, order more of it) */
function TileLine({ job, tag, xs, room, simple }: { job: Job; tag: string; xs: import('@/tileos/data/jobs').Surface[]; room?: string; simple?: boolean }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const t = tileOf(job.id, tag)
  const c = s.checks.find((y) => y.jobId === job.id && y.tag === tag)
  const uses = rooms.flatMap((r) => r.surfaces.filter((x) => hasTile(x, tag)).map((x) => ({ room: r.name, x })))
  const sfAll = Math.round(uses.reduce((n, u) => n + sfFor(job.id, u.x, tag), 0))
  const sfHere = Math.round(xs.reduce((n, x) => n + sfFor(job.id, x, tag), 0))
  const need = c ? needNow(rooms, job.id, c) : Math.ceil(sfAll * 1.1)
  const st = tileStatus(s, job.id, tag)
  const short = c ? orderShort(c, need) : 0
  const who = t?.suppliedBy === 'Us' ? 'We' : `The ${t?.suppliedBy === 'Owner' ? 'owner' : 'GC'}`
  const po = openTilePOs(s, job.id, tag)[0]
  /* the other rooms it's used in — as the paperwork says it ("Also used in") */
  const others = room ? Array.from(new Set(uses.filter((u) => u.room !== room).map((u) => roomWords(u.room)))) : []
  const also = others.length ? `also used in ${others.join(', ')}` : ''
  /* what can be done with it — the office orders and settles; the site manager checks deliveries in */
  const acts: { label: string; run: () => void }[] = []
  /* how it adds up: every wall and floor with its square feet, the extra, their order (typed in there), the difference */
  if (uses.length && !simple) acts.push({ label: 'How it adds up · what was ordered', run: () => s.open({ t: 'qty', jobId: job.id, tag }) })
  if (!c && sfAll > 0 && !simple) acts.push({ label: `${who} ordered it`, run: () => logTileOrder(job.id, tag, { sf: sfAll, where: uses.map((u) => `${u.room} ${u.x.name.toLowerCase()}`).join(' · ') }) })
  if ((c && c.received < c.ordered) || (!c && simple)) acts.push({ label: 'It came in. Count the boxes', run: () => s.open({ t: 'receivetile', jobId: job.id, tag }) })
  if (c && short && !simple) acts.push({ label: 'Settle the count', run: () => s.open({ t: 'qty', jobId: job.id, tag }) })
  if (po) acts.push({ label: `Open ${po.id}`, run: () => s.open({ t: 'po', id: po.id }) })
  if (t) acts.push({ label: 'Order more of this tile', run: () => s.open({ t: 'moretile', jobId: job.id, tags: [tag] }) })
  const tone = st.tone === 'bad' ? 'text-bad-600 font-medium' : st.tone === 'ok' ? 'text-[#2c8a5b] font-medium' : 'text-ink-2'
  return (
    <div data-tile={tag} className={cn(TROW, PAPER_ROW)}>
      {/* the tile: its picture, name and size — tap it for everything about it. The picture the scope's size: small on
          a computer, big on a phone */}
      <button type="button" disabled={simple || !t} onClick={() => s.open({ t: 'tile', jobId: job.id, tag })} className="flex min-w-0 items-center gap-3 text-left enabled:hover:[&_b]:text-brand-700" data-tile-open={tag}>
        <TileImg tile={t} size={PIC_LG} radius={4} className="max-lg:hidden" />
        <TileImg tile={t} size={PIC_SM} radius={6} className="lg:hidden" />
        <span className="min-w-0 leading-snug">
          <span className="block truncate text-[0.9375rem] text-ink max-lg:whitespace-normal max-lg:break-words"><b className="font-semibold tnum">{tag}</b> {t?.name || 'Tile'}{t?.size && <span className="whitespace-nowrap text-muted"> · {t.size}</span>}</span>
          {/* a smaller screen: where in the room and its square feet, under it */}
          <span className="block truncate text-[0.8125rem] text-muted lg:hidden max-lg:whitespace-normal max-lg:break-words">{[xs.map((x) => x.name).join(' · '), sfHere ? `${sfHere.toLocaleString('en-US')} SF` : '', also].filter(Boolean).join(' · ') || (xs.length ? '' : 'Not on a wall or floor yet')}</span>
        </span>
      </button>
      <span className="min-w-0 line-clamp-2 break-words text-[0.875rem] leading-snug text-ink-2 max-lg:hidden" data-tile-where>{xs.length ? xs.map((x) => x.name).join(' · ') : <span className="text-faint"></span>}{also && <span className="text-muted" data-tile-also> · {also}</span>}</span>
      <span className="text-right text-[0.875rem] tnum text-ink-2 max-lg:hidden" data-tile-sf>{sfHere ? `${sfHere.toLocaleString('en-US')} SF` : <span className="text-faint"></span>}</span>
      {/* where it's at — tap it for what to do. On a tile PO that's still open: its number, one tap to it */}
      <span className="flex min-w-0 items-center justify-end gap-2">
        {po && <button type="button" onClick={() => s.open({ t: 'po', id: po.id })} className="shrink-0 text-[0.8125rem] tnum text-muted transition hover:text-brand-700 hover:underline max-sm:hidden" data-tile-po={po.id}>{po.id}</button>}
        {acts.length ? (
          <Menu align="end" width={260} trigger={<button type="button" className={cn('-mr-2 inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-[0.875rem] transition hover:bg-wash-2', tone)} data-tile-status={tag}><span className="truncate">{st.label}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" /></button>}>
            {acts.map((a) => <MenuItem key={a.label} onSelect={a.run}>{a.label}</MenuItem>)}
          </Menu>
        ) : <span className={cn('truncate text-[0.875rem]', tone)} data-tile-status={tag}>{st.label}</span>}
      </span>
    </div>
  )
}

/* ---------------- our materials ---------------- */
export function MaterialsNeed({ job, onScope, simple, orders, orderOnTop, lead }: { job: Job; onScope: () => void; simple?: boolean; orders?: React.ReactNode; /** the Materials tab: "Order what's missing" is on the line on top */ orderOnTop?: boolean; /** what goes on the left of the bar on top (the switch) */ lead?: React.ReactNode }) {
  const s = useStore()
  const save = useSaveStatus()
  const t = takeoff(s, job.id)
  const [open, setOpen] = React.useState<string | null>(null)
  const miss = t.lines.filter((l) => l.toOrder > 0)
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k))
  /* the office (and whoever orders) can change the list by hand; the site manager just sees it */
  const canEdit = !simple && ['owner', 'pm', 'office', 'estimator', 'materials'].includes(s.role)
  const shownCount = t.lines.length
  return (
    <>
      {/* the bar on top — the same as the tile's and the scope's: the switch on the left, its buttons on the right */}
      <PaperBar lead={<span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">{lead}<span className="text-[0.8125rem] text-muted max-sm:hidden" data-mat-says>What we order: floor prep, waterproofing, thinset and grout, metal edges</span></span>} mark="data-mat-bar">
        {!simple && canEdit && <AddMaterial jobId={job.id} />}
        {!simple && (miss.length > 0 && !orderOnTop
          ? <Button variant="primary" icon={<ShoppingCart />} onClick={() => s.open({ t: 'newpo', jobId: job.id, fromTakeoff: true })} data-mat-order>Order what’s missing · {miss.length}</Button>
          : canEdit && <Button icon={<ShoppingCart />} onClick={() => s.open({ t: 'newpo', jobId: job.id })} data-mat-newpo>New PO</Button>)}
      </PaperBar>
      <div className={PAPER} data-mat-list>
        {!t.counted && !shownCount ? (
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-[0.84375rem] text-muted max-sm:px-3">
            <span className="min-w-0 flex-1">{t.total ? 'They work themselves out once the walls and floors have their square feet.' : 'No rooms yet. They come over from the estimate.'}</span>
            <Button size="sm" icon={<Ruler />} onClick={onScope}>Scope of work</Button>
          </div>
        ) : (
          <div>
            <div className={cn(HEAD_ROW, QGRID, 'sticky top-0 z-[6] px-5 max-lg:hidden')} data-mat-cols><span>Material</span><span>Where it goes</span><span className="text-right">We need</span><span className="text-right">Where it’s at</span><span /></div>
            {GROUPS.map((g) => {
              const ls = t.lines.filter((l) => l.group === g)
              if (!ls.length) return null
              return (
                <section key={g}>
                  <MatBand label={g} n={ls.length} />
                  {ls.map((l) => <Line key={l.itemId} l={l} jobId={job.id} open={open === l.itemId} onToggle={() => toggle(l.itemId)} waste={t.rules.waste} canEdit={canEdit} />)}
                </section>
              )
            })}
          </div>
        )}
        {orders && <><MatBand label="Orders" /><div data-mat-orders>{orders}</div></>}
        {t.off.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line-2 px-5 py-2.5 text-[0.8125rem] text-muted max-sm:px-3">
            <span className="font-semibold text-ink-2">Taken off the list</span>
            {t.off.map((id) => {
              const nm = s.items.find((i) => i.id === id)?.name || id
              return canEdit
                ? <button key={id} onClick={() => restoreMat(job.id, id)} className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-white px-2.5 text-[0.78125rem] font-medium text-ink-2 hover:bg-wash" title="Put it back on the list"><RotateCcw className="h-3 w-3" />{nm}</button>
                : <span key={id} className="text-[0.78125rem]">{nm}</span>
            })}
          </div>
        )}
        {t.skipped.length > 0 && t.counted > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-2 bg-[#faf8f5] px-5 py-2.5 text-[0.8125rem] text-ink-2 max-sm:px-3">
            <span className="font-semibold text-ink">Not counted yet</span>
            <span className="min-w-0 flex-1">{t.skipped.slice(0, 4).map((k) => `${k.room} ${k.surface.toLowerCase()} · ${k.why.toLowerCase()}`).join(' · ')}{t.skipped.length > 4 ? ` and ${t.skipped.length - 4} more` : ''}</span>
            <button onClick={onScope} className="font-semibold text-ink underline-offset-2 hover:underline">Scope of work</button>
          </div>
        )}
      </div>
    </>
  )
}
/** a kind of material (Setting, Grout, Waterproofing…) in the same gray band as a room's on the tile and the scope —
 *  its name in bold capitals, how many next to it; it stays under the column names while its lines go by */
function MatBand({ label, n }: { label: string; n?: number }) {
  return (
    <div className={cn(ROOM_BAND, 'border-t border-line px-5 max-sm:px-3 lg:sticky lg:top-10 lg:z-[4]')} style={{ background: DOC_GRAY }} data-band data-mat-band={label}>
      <b className={cn(ROOM_NAME, 'min-w-0 truncate')}>{label}</b>
      {n != null && <span className="text-[#555] tnum">{n}</span>}
    </div>
  )
}


function Line({ l, jobId, open, onToggle, waste, canEdit }: { l: TakeLine; jobId: string; open: boolean; onToggle: () => void; waste: number; canEdit?: boolean }) {
  const s = useStore()
  const it = s.items.find((i) => i.id === l.itemId)
  const unit = it?.unit || ''
  const rooms = Array.from(new Set(l.uses.filter((u) => u.room !== 'Added by hand').map((u) => u.room)))
  const sf = Array.from(new Map(l.uses.filter((u) => u.sf).map((u) => [u.room + u.surface, u.sf])).values()).reduce((n, v) => n + v, 0)
  const where = l.manual ? 'Added by hand' : rooms.length > 3 ? `${rooms.length} rooms` : rooms.join(', ')
  const exact = EXACT.has(l.itemId)
  const [editing, setEditing] = React.useState(false)
  const [q, setQ] = React.useState(String(l.need))
  React.useEffect(() => setQ(String(l.need)), [l.need])
  const saveQty = () => { const n = Math.max(0, Math.round(Number(q.replace(/[^0-9.]/g, '')) || 0)); setEditing(false); if (n !== l.need) setMatQty(jobId, l.itemId, n) }
  /* grout: which colors, so the order says them */
  const colors = l.itemId === 'm-grout' ? Array.from(new Set(l.uses.map((u) => s.rooms[jobId]?.find((r) => r.name === u.room)?.surfaces.find((x) => x.name === u.surface)?.grout).filter(Boolean) as string[])).map((g) => GROUTS[g]?.name || g) : []
  return (
    <div className={cn(QGRID, ROWPAD, 'w-full transition-colors row-hover')} data-mat={l.itemId}>
        <Pop
          open={open}
          onOpenChange={(o) => { if (o !== open) onToggle() }}
          align="start"
          width={360}
          trigger={
            <button className={cn(QFIRST, 'text-left')} aria-expanded={open} title="How it’s worked out">
              <ItemThumb item={it} size={24} />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[0.875rem] text-ink">{it?.name || l.itemId}</span>
                {/* on a phone: how much and where, under the name */}
                <span className="hidden truncate text-[0.75rem] text-muted max-lg:block">{qtyLabel(l.need, unit)}{colors.length ? ` · ${colors.join(', ')}` : ''}<span className="max-sm:hidden"> · {where}</span></span>
              </span>
            </button>
          }
        >
          <div className="text-[0.75rem] font-semibold text-muted">How it’s worked out</div>
          {l.uses.map((u, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4 py-[0.1875rem] text-[0.78125rem]">
              <span className="min-w-0 text-ink-2">{u.room === 'Added by hand' ? <b className="font-semibold text-ink">Added by hand</b> : <b className="font-semibold text-ink">{u.room} · {u.surface.toLowerCase()}</b>}{u.room === 'Added by hand' ? (u.surface ? ` · ${u.surface}` : '') : ` · ${u.note}`}</span>
              <span className="shrink-0 tnum text-muted">{u.raw < 10 ? Math.round(u.raw * 10) / 10 : Math.round(u.raw)}</span>
            </div>
          ))}
          <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-line pt-1.5 text-[0.78125rem] font-semibold text-ink">
            <span>{l.edited != null ? `Changed by hand · worked out ${l.edited}` : l.manual ? 'Added by hand' : exact ? 'Counted as is' : `${Math.round(l.raw * 10) / 10} + ${waste}% extra, rounded up`}{l.itemId === 'm-sand' ? ` · about ${((l.need * 50) / 2000).toFixed(1)} tons` : ''}</span>
            <span className="tnum">{qtyLabel(l.need, unit)}</span>
          </div>
          {l.refs.length > 0 && <div className="mt-1 text-[0.75rem] text-muted">Covered by {l.refs.join(', ')}</div>}
          {(l.have > 0 || l.onSite > 0) && <div className="mt-1 text-[0.75rem] text-muted">Ordered {num(l.have)} · on site {num(l.onSite)}</div>}
        </Pop>
        <span className="min-w-0 truncate text-[0.8125rem] text-muted max-lg:hidden">{colors.length ? `${colors.join(', ')} · ` : ''}{where}</span>
        <span className={cn('text-right', editing ? 'max-sm:col-span-2 max-sm:row-start-2 max-sm:text-left' : 'max-lg:hidden')}>
          {editing ? (
            <input autoFocus aria-label={`How many ${it?.name || ''}`} inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveQty(); if (e.key === 'Escape') setEditing(false) }} onBlur={saveQty} className="h-8 w-[4.5rem] rounded-lg border border-brand-300 px-2 text-right text-[0.875rem] font-semibold tnum outline-none ring-2 ring-brand-100" />
          ) : (
            <span className="block leading-tight">
              <span className="block text-[0.8125rem] tnum text-ink-2">{qtyLabel(l.need, unit)}</span>
              {l.edited != null && <span className="block text-[0.6875rem] text-muted">changed · worked out {l.edited}</span>}
            </span>
          )}
        </span>
        <span className="flex min-w-0 items-center justify-end">
          {l.toOrder > 0 ? <Word className="text-ink">To order {l.toOrder.toLocaleString('en-US')}</Word> : l.onSite >= l.need ? <Word tone="ok">On site</Word> : <Word>Coming</Word>}
        </span>
        <span className="flex justify-end max-sm:hidden">
          {canEdit && (
            <Menu align="end" width={240} trigger={<button aria-label={`Change ${it?.name || 'this material'}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-wash hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>}>
              <MenuItem icon={<Pencil />} onSelect={() => { setQ(String(l.need)); setEditing(true) }}>Change how many</MenuItem>
              {l.edited != null && <MenuItem icon={<RotateCcw />} onSelect={() => setMatQty(jobId, l.itemId, null)}>Back to the worked-out {l.edited}</MenuItem>}
              <MenuItem icon={<Trash2 />} onSelect={() => removeMat(jobId, l.itemId)}>Take it off the list</MenuItem>
            </Menu>
          )}
        </span>
    </div>
  )
}

/** add a material by hand — from the Items catalog, or a new one */
function AddMaterial({ jobId }: { jobId: string }) {
  const s = useStore()
  const [open, setOpen] = React.useState(false)
  const [itemId, setItemId] = React.useState('')
  const [qty, setQty] = React.useState('')
  const [note, setNote] = React.useState('')
  const mats = s.items.filter((i) => i.type === 'material')
  const it = mats.find((i) => i.id === itemId)
  const n = Math.round(Number(qty.replace(/[^0-9.]/g, '')) || 0)
  const add = () => { if (!itemId || !n) return; addMat(jobId, itemId, n, note.trim() || undefined); setItemId(''); setQty(''); setNote(''); setOpen(false) }
  return (
    <Pop open={open} onOpenChange={setOpen} align="end" width={400} trigger={<Button size="sm" icon={<Plus />}>Add a material</Button>}>
      <div className="text-[0.875rem] font-semibold text-ink">Add a material</div>
      <div className="mt-0.5 text-[0.78125rem] text-muted">Something the takeoff didn’t work out. It goes on the list and on the next order.</div>
      <div className="mt-3">
        <SearchSelect
          label="Material"
          value={itemId}
          onChange={setItemId}
          options={mats.map((m) => ({ key: m.id, label: m.name, hint: [m.brand, m.pack || m.unit].filter(Boolean).join(' · '), lead: <ItemThumb item={m} size={28} /> }))}
          placeholder="Pick from your items"
          searchPlaceholder="Type a material…"
          search
          width={380}
          footer={{ label: 'A new one. Add it to Items', onClick: () => { setOpen(false); s.open({ t: 'newitem' }) } }}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <TextInput aria-label="How many" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="How many" className="h-10 w-[7rem] text-right tnum" />
        <span className="text-[0.84375rem] text-muted">{it ? qtyLabel(n || 2, it.unit).replace(/^\d[\d,]*\s/, '') : ''}</span>
      </div>
      <TextInput className="mt-2 h-10" aria-label="What it’s for" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it’s for (optional) · e.g. extra for the steps" />
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" variant="primary" disabled={!itemId || !n} onClick={add}>Add it</Button>
      </div>
    </Pop>
  )
}
