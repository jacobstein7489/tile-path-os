/* Room sheets — one page a room, to hang in the room on the job, in Cobblestone's own layout (the logo, ROOM SHEET,
 * the address, the room's name big and green). Then each tile, its picture on the left and on the right: where it goes
 * (Floor, Shower walls…), its name and size, the grout — and how it's laid out, how the edges are finished (mitered, or
 * the metal: which one, the finish, the size), how high the walls go, what it's set on, and anything to know.
 * A wall or floor still waiting for its tile says NOT SPECIFIED, so nobody guesses. Made from what's already in the
 * project — the tile paperwork, the picks, the layouts — nothing to type. */
import * as React from 'react'
import { Printer } from 'lucide-react'
import { useStore, addHist, meOf } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Swatch } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { edgeWords } from '@/tileos/data/catalog'
import { DocHead, DocFoot, docLine, DOC_GREEN, DOC_FONT } from './docpaper'
import { isWall } from './heights'
import { GROUTS, tileOf, type Room, type Surface, type Tile } from '@/tileos/data/jobs'
import { METHODS } from '@/tileos/data/takeoff'
import type { Job } from '@/tileos/data/model'
import { printNode } from '@/tileos/lib/print'
import { takesTile } from './steps'
import { methodOf } from './takeoff'
import { LayoutThumb, layoutOf, ftIn, suggestLayout } from './layout'

/** what a room sheet says about one wall or floor */
export type SheetRow = { x: Surface; tile?: Tile; grout?: string; groutKey?: string; joint?: string; setOn: string; setAuto: boolean; layout: string; layoutSuggested: boolean }
export function sheetRows(jobId: string, room: Room): SheetRow[] {
  return room.surfaces.filter((x) => x.tile && takesTile(x.name)).map((x) => {
    const tile = tileOf(jobId, x.tile)
    const groutKey = x.grout || tile?.grout
    const m = methodOf(room.name, x)
    return {
      x, tile, groutKey, grout: groutKey ? GROUTS[groutKey]?.name || groutKey : undefined, joint: x.joint || tile?.joint,
      setOn: METHODS[m.key]?.short || m.key, setAuto: m.auto,
      layout: x.layout || suggestLayout(jobId, x).text, layoutSuggested: !x.layout,
    }
  })
}
/** the rooms that get a sheet: the ones with tile on a wall or floor */
export const sheetRooms = (s: { rooms: Record<string, Room[]> }, jobId: string) => (s.rooms[jobId] || []).filter((r) => r.surfaces.some((x) => x.tile && takesTile(x.name)))

/** one tile on a room sheet: the walls and floors it goes on, and what the installer needs to know about it */
export type SheetEntry = { key: string; label: string; tile?: Tile; tag?: string; grout?: string; joint?: string; lines: { k: string; v: string }[]; xs: Surface[] }
export function sheetEntries(jobId: string, room: Room): SheetEntry[] {
  const groups = new Map<string, Surface[]>()
  room.surfaces.filter((x) => takesTile(x.name)).forEach((x) => {
    const k = x.tile ? `${x.tile}|${x.grout || tileOf(jobId, x.tile)?.grout || ''}` : `none|${x.name}`
    groups.set(k, [...(groups.get(k) || []), x])
  })
  return [...groups.entries()].map(([key, xs]) => {
    const t = tileOf(jobId, xs[0].tile)
    const gk = xs[0].grout || t?.grout
    /* the same for all of them: said once · different: each one by name */
    const per = (f: (x: Surface) => string | undefined) => {
      const vals = xs.map((x) => ({ n: x.name, v: (f(x) || '').trim() })).filter((y) => y.v)
      if (!vals.length) return ''
      const uniq = Array.from(new Set(vals.map((y) => y.v)))
      return uniq.length === 1 && (vals.length === xs.length || xs.length === 1) ? uniq[0] : vals.map((y) => `${y.n} — ${y.v}`).join('; ')
    }
    const lines = [
      { k: 'Layout', v: per((x) => x.layout || (t ? `${suggestLayout(jobId, x).text} (suggested)` : '')) },
      { k: 'Edges', v: per((x) => edgeWords(x.edge)) },
      { k: 'How high', v: per((x) => (isWall(x.name) ? x.height : '')) },
      { k: 'Set on', v: per((x) => (x.method ? METHODS[x.method as keyof typeof METHODS]?.label || x.method : '')) },
      { k: 'Note', v: per((x) => x.notes) },
    ].filter((l) => l.v)
    return { key, label: xs.map((x) => x.name).join(' + '), tile: t, tag: xs[0].tile || undefined, grout: gk ? GROUTS[gk]?.name || gk : undefined, joint: xs[0].joint || t?.joint, lines, xs }
  })
}
/** the tile's shape from its size — "24 × 48" lies long, "32 × 32" is square */
function shapeOf(size?: string): number {
  const n = (size || '').match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/)
  if (!n) return 1
  const a = Number(n[1]), b = Number(n[2])
  return a && b ? Math.max(0.25, Math.min(a, b) / Math.max(a, b)) : 1
}
/** the tile's picture, the tile's shape, as big as the page allows — or a box that says there's no picture */
function SheetPhoto({ tile, max }: { tile?: Tile; max: number }) {
  const k = shapeOf(tile?.size)
  const W = 264
  const w = k < 1 ? Math.min(W, Math.round(max / k)) : max
  const h = k < 1 ? Math.round(w * k) : max
  if (!tile || (!tile.photo && !tile.swatch))
    return <div className="flex items-center justify-center border border-[#c4c9c6] text-[0.6875rem] font-bold uppercase tracking-[0.02em] text-[#777]" style={{ width: W, height: Math.min(max, 170) }} data-no-photo>Photo not provided</div>
  return (
    <div className="flex justify-center" style={{ width: W }}>
      <div className="overflow-hidden" style={{ width: w, height: h }}>
        {tile.photo ? <img src={tile.photo} alt={tile.name} className="block h-full w-full object-cover" /> : <div style={{ marginTop: Math.round((h - w) / 2) }}><Swatch kind={tile.swatch!} size={w} radius={0} /></div>}
      </div>
    </div>
  )
}

/** one room, one page */
export function RoomSheet({ job, room, last, page }: { job: Job; room: Room; last?: boolean; page?: number }) {
  const list = sheetEntries(job.id, room)
  const big = list.length <= 2 ? 264 : list.length === 3 ? 200 : 160
  return (
    <section data-room-sheet={room.name} className={cn('bg-white text-[#222]', DOC_FONT)} style={{ breakAfter: last ? 'auto' : 'page', pageBreakAfter: last ? 'auto' : 'always' }}>
      <DocHead kind="Room sheet" line={docLine(job)} />
      <h1 className="mt-6 text-[1.5rem] font-bold uppercase leading-tight" style={{ color: DOC_GREEN }}>{room.name}</h1>
      {(room.floor || room.note) && <div className="mt-1 text-[0.78125rem] text-[#666]">{[room.floor, room.note].filter(Boolean).join(' · ')}</div>}
      <div className="mt-6 flex flex-col gap-7">
        {list.map((e) => (
          <div key={e.key} className="grid grid-cols-[16.5rem_minmax(0,1fr)] gap-x-[1.375rem]" style={{ breakInside: 'avoid' }} data-sheet-entry={e.label}>
            <SheetPhoto tile={e.tile} max={big} />
            <div className="min-w-0 pt-0.5">
              <div className="text-[0.78125rem] font-bold" style={{ color: DOC_GREEN }}>{e.label}</div>
              <div className="mt-1 text-[1.09375rem] font-bold leading-tight">{e.tile ? e.tile.name : 'NOT SPECIFIED'}{e.tile && <span className="ml-2 align-[0.0625rem] text-[0.6875rem] font-semibold text-[#8a8a8a]">{e.tile.tag}</span>}</div>
              <div className="mt-1 text-[0.8125rem] text-[#333]">{e.tile ? [e.tile.size.replace(/\s*×\s*/g, ' x '), e.tile.finish].filter(Boolean).join(' · ') || 'Size NOT SPECIFIED' : 'NOT SPECIFIED'}</div>
              <div className="mt-2 text-[0.78125rem] leading-snug text-[#333]" data-sheet-grout><b className="font-bold text-[#222]">GROUT:</b> {e.grout || 'NOT SPECIFIED'}{e.grout && e.joint ? ` · ${e.joint.replace(/″?$/, '″')} joint` : ''}</div>
              {e.lines.map((l) => <div key={l.k} className="mt-1 text-[0.78125rem] leading-snug text-[#333]" data-sheet-line={l.k}><b className="font-bold text-[#222]">{l.k.toUpperCase()}:</b> {l.v}</div>)}
              {e.xs.some((x) => x.dims) && (
                <div className="mt-2.5 flex flex-wrap gap-3">
                  {e.xs.filter((x) => x.dims).map((x) => {
                    const L = layoutOf(job.id, x)
                    return (
                      <figure key={x.name} className="m-0" data-sheet-layout={x.name}>
                        <LayoutThumb jobId={job.id} x={x} max={120} />
                        <figcaption className="mt-0.5 text-[0.6875rem] text-[#555]">{x.name} · {ftIn(L.W)} × {ftIn(L.H)}{L.smallest ? ` · smallest cut ${ftIn(L.smallest)}` : ''}</figcaption>
                      </figure>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <DocFoot left={job.name} page={page} />
    </section>
  )
}

/** every room's sheet, one after the other (one page each when printed) */
export function RoomSheets({ job, only }: { job: Job; only?: string }) {
  const s = useStore()
  const rooms = sheetRooms(s, job.id).filter((r) => !only || r.name === only)
  return <div data-room-sheets>{rooms.map((r, i) => <RoomSheet key={r.name} job={job} room={r} last={i === rooms.length - 1} page={i + 1} />)}</div>
}

/** print them: the sheets are put together right then, and go to the printer — no window in between */
export function PrintSheetsButton({ job, room, children, variant, size, className }: { job: Job; room?: string; children?: React.ReactNode; variant?: 'primary' | 'ghost'; size?: 'sm'; className?: string }) {
  const s = useStore()
  const [on, setOn] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const n = sheetRooms(s, job.id).filter((r) => !room || r.name === room).length
  React.useEffect(() => {
    if (!on) return
    const t = setTimeout(() => {
      printNode(ref.current?.firstElementChild as HTMLElement | null)
      s.commit((st) => { addHist(st, job.id, { who: meOf(st.role), kind: 'setup', title: `Hang room sheets: printed${room ? ` — ${room}` : ` — ${n} room${n === 1 ? '' : 's'}`}` }) }, undefined, { undo: false })
      setOn(false)
    }, 60)
    return () => clearTimeout(t)
  }, [on])
  return (
    <>
      <Button variant={variant} size={size} className={className} icon={<Printer />} disabled={!n} onClick={() => setOn(true)} data-print-sheets={room || 'all'}>{children || (room ? 'Print this room’s sheet' : `Print the room sheets${n ? ` (${n})` : ''}`)}</Button>
      {on && <div className="hidden" ref={ref}><RoomSheets job={job} only={room} /></div>}
    </>
  )
}
