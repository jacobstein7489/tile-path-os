/* Tile layout — any wall or floor drawn to scale with its real tile, joint and pattern.
 * Where the numbers come from: the size of the wall or floor is what was measured (typed in here — on site, or off the
 * plans); until then it's worked out from the takeoff's square feet and says so. The tile is the project's tile at its
 * real size — a "24 × 48" is often 23½ × 47¼, so its real size is typed in once and every layout uses it. Windows,
 * doors, niches, the tub or a vanity are put on the wall or floor where they are: no tile there, and the tiles around
 * them are cut to fit. It finds the start that leaves no slivers (at the edges and around what's on the wall), shows
 * every cut, counts the tiles, and goes to the designer for a yes. Saved, it's the surface's layout on the scope and
 * the installer's sheet. */
import * as React from 'react'
import { Sparkles, Send, Check, Ruler, TriangleAlert, Printer, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useStore, addHist, newTask, meOf, NOW } from '@/tileos/store'
import { Button, Chip } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { GROUTS, type Surface, type Tile, tileOf } from '@/tileos/data/jobs'
import { kindOf } from './takeoff'
import { takesTile } from './steps'
import { TileImg } from '@/tileos/components/ui/swatch'
import type { Job } from '@/tileos/data/model'
import { printNode } from '@/tileos/lib/print'

export type Pattern = 'stack' | 'half' | 'third' | 'vertical'
export const PATTERNS: { key: Pattern; label: string }[] = [
  { key: 'stack', label: 'Straight' },
  { key: 'half', label: '½ offset' },
  { key: 'third', label: '⅓ offset' },
  { key: 'vertical', label: 'Vertical stack' },
]
/** where the first tile goes: the best start, centered on the wall, a full tile at the floor (or door) — or centered on
 *  one of the things on the wall (a niche, a window): "on:<its id>" */
type Start = 'best' | 'center' | 'edge' | `on:${string}`
export type Cutout = NonNullable<Surface['cutouts']>[number]
export type CutoutKind = Cutout['kind']
const CUT_LABEL: Record<CutoutKind, string> = { window: 'Window', door: 'Door', niche: 'Niche', tub: 'Tub', vanity: 'Vanity', other: 'Something else' }
/** a typical size for each, to start from (inches) */
const CUT_SIZE: Record<CutoutKind, { w: number; h: number; y: number }> = { window: { w: 36, h: 48, y: 36 }, door: { w: 32, h: 80, y: 0 }, niche: { w: 12, h: 24, y: 48 }, tub: { w: 60, h: 18, y: 0 }, vanity: { w: 48, h: 34, y: 0 }, other: { w: 24, h: 24, y: 0 } }
const TILE_COLOR: Record<string, string> = { grigio: '#d2cdc6', hex: '#ecebe7', toscana: '#eadfcb', subway: '#f7f7f4', bianco: '#f2f0eb', pearl: '#efebe3', calacatta: '#f5f3ef', blueprint: '#e8edf5' }

/* ---------------- numbers ---------------- */
const parseJoint = (j?: string) => {
  const m = (j || '1/16').match(/(\d+)\s*\/\s*(\d+)/)
  return m ? Number(m[1]) / Number(m[2]) : 0.0625
}
const UNI: Record<string, string> = { '⅛': ' 1/8', '¼': ' 1/4', '⅜': ' 3/8', '½': ' 1/2', '⅝': ' 5/8', '¾': ' 3/4', '⅞': ' 7/8' }
/** inches the way people write them: 23.5 · 23 1/2 · 23-1/2 · 23½ · 3/4 */
export function parseInch(t: string): number | null {
  const v = String(t || '').replace(/[⅛¼⅜½⅝¾⅞]/g, (c) => UNI[c]).replace(/["″]|in(ches)?/gi, '').trim()
  let m = v.match(/^(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\s*\/\s*(\d+))?$/)
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0)
  m = v.match(/^(\d+)\s*\/\s*(\d+)$/)
  return m ? Number(m[1]) / Number(m[2]) : null
}
/** the tile's size as on its box ("24 × 48") */
export function tileDims(size: string): { a: number; b: number; mosaic?: boolean } {
  if (/hex|mosaic/i.test(size)) return { a: 12, b: 12, mosaic: true }
  const n = (size.match(/\d+(\.\d+)?/g) || ['12', '12']).map(Number)
  return { a: n[0], b: n[1] ?? n[0] }
}
/** the tile's real size when it's been measured ("23 1/2 × 47 1/4"), else the size on the box */
export function realDims(tile?: Tile): { a: number; b: number; mosaic?: boolean; real: boolean } {
  const nominal = tileDims(tile?.size || '12 × 12')
  if (!tile?.actual || nominal.mosaic) return { ...nominal, real: false }
  const [x, y] = tile.actual.split(/\s*(?:×|x|X|by)\s*/).map(parseInch)
  return x && y ? { a: x, b: y, real: true } : { ...nominal, real: false }
}
/** the surface's size in inches: what was measured, else worked out from its square feet and height */
export function surfaceDims(x: Surface): { w: number; h: number } {
  if (x.dims) return x.dims
  const area = (x.sf || 40) * 144
  /* a niche, a bench, a curb: small and squarish — not a wall to the ceiling */
  if (/niche|bench|curb|shelf|ledge|sill/i.test(x.name)) { const w = Math.max(12, Math.round(Math.sqrt(area * 1.2))); return { w, h: Math.max(6, Math.round(area / w)) } }
  const k = kindOf(x)
  if (k === 'wall') {
    const hm = (x.height || '').match(/(\d+)\s*(″|"|in)/)
    const h = /ceiling/i.test(x.height || '') ? 96 : hm ? Number(hm[1]) : /wainscot/i.test(x.name) ? 42 : 96
    return { w: Math.max(12, Math.round(area / h)), h }
  }
  const w = Math.round(Math.sqrt(area * 1.25))
  return { w, h: Math.max(12, Math.round(area / w)) }
}
/** feet and inches to the nearest ⅛″: 2′ 3⅜″ */
export const ftIn = (inch: number) => {
  const q = Math.round(inch * 8) / 8
  const ft = Math.floor(q / 12)
  const i = q - ft * 12
  const F: Record<number, string> = { 0.125: '⅛', 0.25: '¼', 0.375: '⅜', 0.5: '½', 0.625: '⅝', 0.75: '¾', 0.875: '⅞' }
  const frac = (v: number) => { const w = Math.floor(v); const f = F[Math.round((v - w) * 1000) / 1000] || ''; return `${w || (f ? '' : '0')}${f}` }
  return ft ? `${ft}′ ${frac(i)}″` : `${frac(i)}″`
}
/** inches to the nearest ⅛, without feet: 23½″ — for a tile's size and what's on the wall */
export const inches = (v: number) => {
  const q = Math.round(v * 8) / 8
  const w = Math.floor(q)
  const F: Record<number, string> = { 0.125: '⅛', 0.25: '¼', 0.375: '⅜', 0.5: '½', 0.625: '⅝', 0.75: '¾', 0.875: '⅞' }
  const f = F[Math.round((q - w) * 1000) / 1000] || ''
  return `${w || (f ? '' : '0')}${f}″`
}
/** inches with eighths, for typing back in a box: 23 1/2 */
const inchText = (v: number) => { const q = Math.round(v * 8) / 8; const w = Math.floor(q); const r = Math.round((q - w) * 8); if (!r) return String(w); const g = r % 4 === 0 ? 4 : r % 2 === 0 ? 2 : 1; return `${w ? w + ' ' : ''}${r / g}/${8 / g}` }

type Piece = { x: number; y: number; w: number; h: number; cutW: boolean; cutH: boolean; sliver: boolean; /** cut around something on the wall */ around?: boolean }
function lay(W: number, H: number, tw: number, th: number, j: number, pattern: Pattern, ox: number, oy: number, holes: Cutout[] = []) {
  const cw = tw + j
  const ch = th + j
  const minW = Math.max(1.5, Math.min(tw / 4, 6))
  const minH = Math.max(1, Math.min(th / 4, 6))
  /* around a window or a niche: a strip thinner than this breaks or looks wrong */
  const minAround = Math.max(1.5, Math.min(tw, th) / 6)
  const out: Piece[] = []
  for (let r = Math.floor(-oy / ch) - 1; oy + r * ch < H; r++) {
    const y = oy + r * ch
    const k = pattern === 'half' ? ((r % 2) + 2) % 2 : pattern === 'third' ? ((r % 3) + 3) % 3 : 0
    const shift = pattern === 'half' ? (k * cw) / 2 : pattern === 'third' ? (k * cw) / 3 : 0
    for (let c = Math.floor(-(ox + shift) / cw) - 1; ox + shift + c * cw < W; c++) {
      const x = ox + shift + c * cw
      const x0 = Math.max(0, x), x1 = Math.min(W, x + tw), y0 = Math.max(0, y), y1 = Math.min(H, y + th)
      if (x1 - x0 < 0.05 || y1 - y0 < 0.05) continue
      const w = x1 - x0, h = y1 - y0
      /* a hair off is taken up in the joints, not cut */
      const cutW = w < tw - 0.25, cutH = h < th - 0.25
      let sliver = (cutW && w < minW) || (cutH && h < minH)
      let gone = false, around = false
      for (const o of holes) {
        const ix0 = Math.max(x0, o.x), ix1 = Math.min(x1, o.x + o.w), iy0 = Math.max(y0, o.y), iy1 = Math.min(y1, o.y + o.h)
        if (ix1 - ix0 <= 0.05 || iy1 - iy0 <= 0.05) continue
        if (ix0 <= x0 + 0.05 && ix1 >= x1 - 0.05 && iy0 <= y0 + 0.05 && iy1 >= y1 - 0.05) { gone = true; break }
        around = true
        /* what's left of the tile beside, under or over it — a thin strip is a sliver */
        if ([ix0 - x0, x1 - ix1, iy0 - y0, y1 - iy1].some((v) => v > 0.05 && v < minAround)) sliver = true
      }
      if (gone) continue
      out.push({ x: x0, y: y0, w, h, cutW: cutW || around, cutH, sliver, around })
    }
  }
  const cuts = out.filter((p) => p.cutW || p.cutH)
  const edgeCuts = out.filter((p) => (p.cutW || p.cutH) && !p.around)
  const smallest = edgeCuts.length ? Math.min(...edgeCuts.map((p) => Math.min(p.cutW ? p.w : Infinity, p.cutH ? p.h : Infinity))) : null
  return { pieces: out, full: out.length - cuts.length, cut: cuts.length, slivers: out.filter((p) => p.sliver).length, smallest }
}
/** the start that leaves the biggest smallest cut — no slivers (at the edges or around what's on the wall) if there's
 *  any way to avoid them */
function bestStart(W: number, H: number, tw: number, th: number, j: number, pattern: Pattern, holes: Cutout[] = []) {
  const cw = tw + j, ch = th + j
  const score = (ox: number, oy: number) => {
    const r = lay(W, H, tw, th, j, pattern, ox, oy, holes)
    return (r.slivers ? -1000 * r.slivers : 0) + (r.smallest ?? 999)
  }
  let bx = 0, by = 0, best = -Infinity
  for (let ox = 0; ox < cw; ox += Math.max(0.25, cw / 96)) {
    const v = score(ox, 0)
    const sym = -Math.abs(((W - ox) % cw) - ox) * 0.001
    if (v + sym > best) { best = v + sym; bx = ox }
  }
  best = -Infinity
  for (let oy = 0; oy < ch; oy += Math.max(0.25, ch / 96)) {
    const v = score(bx, oy) - Math.abs(((H - oy) % ch) - oy) * 0.001
    if (v > best) { best = v; by = oy }
  }
  return { ox: bx, oy: by }
}
/** where the first tile goes for a start */
function originOf(start: Start, W: number, H: number, tw: number, th: number, j: number, pattern: Pattern, holes: Cutout[]) {
  const cw = tw + j, ch = th + j
  if (start === 'center') return { ox: ((W / 2 - tw / 2) % cw + cw) % cw, oy: ((H / 2 - th / 2) % ch + ch) % ch }
  if (start === 'edge') return { ox: 0, oy: 0 }
  if (start.startsWith('on:')) {
    /* a tile centered on it, side to side; up and down, the best start */
    const o = holes.find((h) => h.id === start.slice(3))
    const b = bestStart(W, H, tw, th, j, pattern, holes)
    if (!o) return b
    return { ox: ((o.x + o.w / 2 - tw / 2) % cw + cw) % cw, oy: b.oy }
  }
  return bestStart(W, H, tw, th, j, pattern, holes)
}

/** a wall or floor laid out the way it's set: its pattern and start (from its layout — or what the system suggests),
 *  its size, every piece and the smallest cut. The same math as the drawing in the layout window. */
export function layoutOf(jobId: string, x: Surface) {
  const tile = tileOf(jobId, x.tile)
  const td = realDims(tile)
  const had = x.layout || ''
  const pattern: Pattern = /vertical/i.test(had) ? 'vertical' : /1\/3|⅓|third/i.test(had) ? 'third' : /1\/2|½|half|offset|brick|running/i.test(had) ? 'half' : /straight|stack/i.test(had) ? 'stack' : suggestPattern(tile?.size).pattern
  const long = Math.max(td.a, td.b), short = Math.min(td.a, td.b)
  const tw = pattern === 'vertical' ? short : long
  const th = pattern === 'vertical' ? long : short
  const j = parseJoint(x.joint)
  const { w: W, h: H } = surfaceDims(x)
  const holes = x.cutouts || []
  const onIt = holes.find((h) => new RegExp(`centered on the ${CUT_LABEL[h.kind]}`, 'i').test(had))
  const start: Start = onIt ? `on:${onIt.id}` : /centered/i.test(had) ? 'center' : /full tile/i.test(had) ? 'edge' : 'best'
  const o = originOf(start, W, H, tw, th, j, pattern, holes)
  const r = lay(W, H, tw, th, j, pattern, o.ox, o.oy, holes)
  return { tile, W, H, j, pattern, mosaic: !!td.mosaic, pieces: r.pieces, smallest: r.smallest, slivers: r.slivers, full: r.full, cut: r.cut, measured: !!x.dims, holes, real: td.real }
}
/** the drawing, small — for the room sheet that hangs in the room */
export function LayoutThumb({ jobId, x, max = 190 }: { jobId: string; x: Surface; max?: number }) {
  const L = layoutOf(jobId, x)
  const k = Math.min(max / L.W, (max * 0.78) / L.H)
  const color = L.tile?.color || TILE_COLOR[L.tile?.swatch || ''] || '#efece6'
  const g = GROUTS[x.grout || L.tile?.grout || '']?.color || '#b8b0a3'
  return (
    <svg width={Math.round(L.W * k)} height={Math.round(L.H * k)} viewBox={`0 0 ${L.W} ${L.H}`} role="img" aria-label={`${x.name} layout`} className="block rounded-[2px] shadow-[0_0_0_1px_rgba(16,24,40,.2)]" data-layout-thumb>
      <rect x={0} y={0} width={L.W} height={L.H} fill={g} />
      {L.pieces.map((p, i) => (
        <rect key={i} x={p.x} y={L.H - p.y - p.h} width={p.w} height={p.h} fill={p.sliver ? '#fdd8d4' : p.cutW || p.cutH ? shade(color, -0.08) : color} stroke={g} strokeWidth={Math.max(L.j, 0.9 / k)} />
      ))}
      {L.holes.map((o) => <rect key={o.id} x={o.x} y={L.H - o.y - o.h} width={o.w} height={o.h} fill="#ffffff" stroke="#8a8f98" strokeWidth={1.2 / k} />)}
    </svg>
  )
}

/* ---------------- saving it ---------------- */
function saveLayout(jobId: string, room: string, surface: string, o: { text: string; dims: { w: number; h: number }; grout?: string; cutouts: Cutout[] }) {
  useStore.getState().commit((s) => {
    const x = s.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
    if (!x) return
    x.layout = o.text
    x.dims = o.dims
    x.cutouts = o.cutouts.length ? o.cutouts : undefined
    if (o.grout) x.grout = o.grout
    x.decided = [...(x.decided || []).filter((d) => !/^Layout drawn/.test(d)), `Layout drawn — ${NOW}`]
    addHist(s, jobId, { who: meOf(s.role), kind: 'setup', title: `Layout set · ${room} ${surface.toLowerCase()}`, detail: o.text })
  }, `Saved — the layout is on the scope and the installer’s sheet`, { close: true })
}
function sendLayout(jobId: string, room: string, surface: string, text: string) {
  useStore.getState().commit((s) => {
    addHist(s, jobId, { who: meOf(s.role), kind: 'setup', title: `Layout sent to the designer · ${room} ${surface.toLowerCase()}`, detail: text })
    newTask(s, { jobId, title: `Designer to OK the layout · ${room} ${surface.toLowerCase()}`, type: 'Setup', owner: meOf(s.role), for: [s.role], state: 'waiting', waitingOn: 'Designer', followUp: 'Thu', tone: 'neutral', where: text })
  }, 'Sent to the designer — it comes back Thursday if they haven’t answered')
}

/* ================= what the system suggests ================= */
/** the pattern from the tile: mosaics and squares go straight; a small rectangle (subway) gets a ½ offset; anything
 *  longer than 18″ gets no more than a ⅓ offset — past that, the bow every long tile has shows as lippage */
export function suggestPattern(size?: string): { pattern: Pattern; why: string } {
  const td = tileDims(size || '12 × 12')
  const long = Math.max(td.a, td.b), short = Math.min(td.a, td.b)
  if (td.mosaic) return { pattern: 'stack', why: 'Mosaic sheets go straight' }
  if (long === short) return { pattern: 'stack', why: 'Square tile' }
  if (long > 18) return { pattern: 'third', why: 'Longer than 18″ — at most a ⅓ offset, or the edges won’t sit flat' }
  return { pattern: 'half', why: 'Small rectangle — a ½ offset' }
}
/** the whole suggestion for a wall or floor: that pattern, started where there are no thin cuts, in the same words a
 *  drawn layout uses */
export function suggestLayout(jobId: string, x: Surface): { pattern: Pattern; text: string; why: string; smallest: number | null; slivers: number } {
  const tile = tileOf(jobId, x.tile)
  const { pattern, why } = suggestPattern(tile?.size)
  const td = realDims(tile)
  const tw = Math.max(td.a, td.b), th = Math.min(td.a, td.b)
  const { w: W, h: H } = surfaceDims(x)
  const j = parseJoint(x.joint)
  const holes = x.cutouts || []
  const o = bestStart(W, H, tw, th, j, pattern, holes)
  const r = lay(W, H, tw, th, j, pattern, o.ox, o.oy, holes)
  const row = r.pieces.filter((p) => p.y === 0).sort((a, b) => a.x - b.x)
  const left = row[0]?.cutW ? row[0].w : null
  const right = row[row.length - 1]?.cutW ? row[row.length - 1].w : null
  const label = PATTERNS.find((p) => p.key === pattern)!.label
  /* a shower floor slopes to the drain — that's its layout whatever the tile */
  const drain = /shower floor|shower pan/i.test(x.name) ? ' · pitched to the drain' : ''
  const text = td.mosaic ? `${label} · sheets${drain}` : `${label} · best start${left && right ? ` · ${ftIn(left)} cuts both sides` : ''}${drain}`
  return { pattern, text, why, smallest: r.smallest, slivers: r.slivers }
}
/** fill in the suggestion on every wall and floor that has a tile and no layout yet */
export function fillSuggestions(jobId: string) {
  const s = useStore.getState()
  const todo = (s.rooms[jobId] || []).flatMap((r) => r.surfaces.filter((x) => x.tile && takesTile(x.name) && !x.layout).map((x) => ({ room: r.name, name: x.name })))
  if (!todo.length) return
  s.commit((st) => {
    todo.forEach(({ room, name }) => {
      const x = st.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === name)
      if (!x) return
      x.layout = suggestLayout(jobId, x).text
      x.decided = [...(x.decided || []).filter((d) => !/^Layout /.test(d)), `Layout suggested — ${NOW}`]
    })
    addHist(st, jobId, { who: meOf(st.role), kind: 'setup', title: `Layouts filled in · ${todo.length} wall${todo.length === 1 ? '' : 's'} and floors`, detail: 'From the tile sizes — no thin cuts' })
  }, `${todo.length} layout${todo.length === 1 ? '' : 's'} filled in`, { sub: 'Tap any one to see it drawn to scale, change it, or send it to the designer.' })
}

/** every wall and floor with a tile, room by room: its layout — or what the system suggests — and whether it's been
 *  drawn. Tap one to see it drawn to scale. */
export function LayoutsList({ job, action }: { job: Job; action?: React.ReactNode }) {
  const s = useStore()
  const rooms = (s.rooms[job.id] || []).map((r) => ({ name: r.name, rows: r.surfaces.filter((x) => x.tile && takesTile(x.name)) })).filter((r) => r.rows.length)
  const all = rooms.flatMap((r) => r.rows)
  const set = all.filter((x) => x.layout).length
  if (!all.length) return <div className="rounded-[0.75rem] bg-wash px-4 py-6 text-center text-[0.875rem] text-muted">No walls or floors with a tile yet — they come from the tile paperwork.</div>
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#ece8e1]"><span className="block h-full rounded-full bg-[#2c4a3e]" style={{ width: `${Math.round((set / all.length) * 100)}%` }} /></span>
        <span className="text-[0.8125rem] tnum text-ink-2"><b className="font-semibold text-ink">{set} of {all.length}</b> set</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {rooms.map((r) => (
        <section key={r.name}>
          <h4 className="mb-1.5 text-[0.8125rem] font-semibold text-ink-2">{r.name}</h4>
          <div className="overflow-hidden rounded-[0.75rem] border border-line bg-white">
            {r.rows.map((x) => {
              const tile = tileOf(job.id, x.tile)
              const sg = x.layout ? null : suggestLayout(job.id, x)
              const drawn = (x.decided || []).some((d) => /^Layout drawn/.test(d))
              return (
                <button key={x.name} onClick={() => s.open({ t: 'layout', jobId: job.id, room: r.name, surface: x.name })} className="flex w-full items-center gap-3 border-t border-line-2 px-3.5 py-2.5 text-left transition first:border-t-0 row-hover" aria-label={`Layout — ${r.name} ${x.name}`}>
                  {tile ? <TileImg tile={tile} size={30} /> : <span className="h-[30px] w-[30px] shrink-0 rounded-md bg-wash-2" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.875rem] font-semibold text-ink">{x.name} <span className="font-normal text-muted">· {tile ? `${tile.tag} ${tile.size}` : x.tile}</span></span>
                    {x.layout
                      ? <span className="block text-[0.78125rem] text-ink-2 max-sm:line-clamp-2 sm:truncate">{x.layout}</span>
                      : <span className="block text-[0.78125rem] text-muted max-sm:line-clamp-2 sm:truncate"><Sparkles className="mr-1 inline h-3 w-3 -translate-y-px text-vio-600" />Suggested: {sg!.text}</span>}
                  </span>
                  <span className={cn('shrink-0 text-[0.78125rem] font-semibold', x.layout ? 'text-[#2c4a3e]' : 'text-muted')}>{drawn ? 'Drawn' : x.layout ? 'Set' : 'To set'}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

/** every layout on a project in one window — from the scope of work */
export function LayoutsModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  const missing = (s.rooms[jobId] || []).flatMap((r) => r.surfaces).filter((x) => x.tile && takesTile(x.name) && !x.layout).length
  return (
    <Modal level={level} size="lg" tall onClose={s.close} title="Layouts" sub={`${job.name} · the pattern, where to start, the cuts`}>
      <LayoutsList job={job} action={missing > 0 ? <Button size="sm" variant="primary" icon={<Sparkles />} onClick={() => fillSuggestions(jobId)}>Use the suggestions ({missing})</Button> : undefined} />
    </Modal>
  )
}

/* ================= the window ================= */
export function LayoutModal({ jobId, room, surface, tile: tileTag, level }: { jobId: string; room: string; surface: string; tile?: string; level: number }) {
  const s = useStore()
  const x = s.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
  const d0 = x ? surfaceDims(x) : { w: 60, h: 96 }
  const [W, setW] = React.useState(d0.w)
  const [H, setH] = React.useState(d0.h)
  /* the surface window can pass the tile just picked there, before it's saved */
  const tile = x ? tileOf(jobId, tileTag || x.tile) : undefined
  const nominal = tileDims(tile?.size || '12 × 24')
  /* the tile's real size — kept with the project's tile, so every wall and floor with it uses it */
  const real0 = realDims(tile)
  const [ra, setRa] = React.useState(real0.real ? inchText(real0.a) : '')
  const [rb, setRb] = React.useState(real0.real ? inchText(real0.b) : '')
  const rA = parseInch(ra), rB = parseInch(rb)
  const td = !nominal.mosaic && rA && rB ? { a: rA, b: rB, mosaic: false } : nominal
  /* the pattern it has — or, with none yet, what the system suggests for this tile */
  const had = x?.layout || ''
  const initial: Pattern = /vertical/i.test(had) ? 'vertical' : /1\/3|⅓|third/i.test(had) ? 'third' : /1\/2|½|half|offset|brick|running/i.test(had) ? 'half' : /straight|stack/i.test(had) ? 'stack' : suggestPattern(tile?.size).pattern
  const [pattern, setPattern] = React.useState<Pattern>(initial)
  const [holes, setHoles] = React.useState<Cutout[]>(x?.cutouts || [])
  const onIt0 = (x?.cutouts || []).find((h) => new RegExp(`centered on the ${CUT_LABEL[h.kind]}`, 'i').test(had))
  const [start, setStart] = React.useState<Start>(onIt0 ? `on:${onIt0.id}` : /centered/i.test(had) ? 'center' : /full tile/i.test(had) ? 'edge' : 'best')
  const [grout, setGrout] = React.useState(x?.grout || tile?.grout || 'warmgray')
  /* the drawing, for printing the crew's sheet */
  const drawRef = React.useRef<HTMLDivElement>(null)
  const j = parseJoint(x?.joint)
  if (!x) return null
  const job = s.jobs[jobId]
  const long = Math.max(td.a, td.b), short = Math.min(td.a, td.b)
  const tw = pattern === 'vertical' ? short : long
  const th = pattern === 'vertical' ? long : short
  /* what's on the wall, kept inside it */
  const inside = holes.map((h) => ({ ...h, w: Math.min(h.w, W), h: Math.min(h.h, H), x: Math.max(0, Math.min(h.x, W - Math.min(h.w, W))), y: Math.max(0, Math.min(h.y, H - Math.min(h.h, H))) }))
  const useStart: Start = start.startsWith('on:') && !inside.some((h) => `on:${h.id}` === start) ? 'best' : start
  const origin = originOf(useStart, W, H, tw, th, j, pattern, inside)
  const r = lay(W, H, tw, th, j, pattern, origin.ox, origin.oy, inside)
  const isWall = kindOf(x) === 'wall'
  const centerable = inside.filter((h) => h.kind === 'niche' || h.kind === 'window' || h.kind === 'tub' || h.kind === 'vanity')
  const startKeys: Start[] = ['best', 'center', 'edge', ...centerable.map((h) => `on:${h.id}` as Start)]
  const startLabel = (k: Start) => (k === 'best' ? 'Best start — fewest slivers' : k === 'center' ? 'Centered on the wall' : k === 'edge' ? (isWall ? 'Full tile at the floor' : 'Full tile at the door') : `Centered on the ${CUT_LABEL[inside.find((h) => `on:${h.id}` === k)?.kind || 'other'].toLowerCase()}`)
  const options = startKeys.map((key) => { const o = originOf(key, W, H, tw, th, j, pattern, inside); return { k: key, r: lay(W, H, tw, th, j, pattern, o.ox, o.oy, inside) } })
  const firstCut = r.pieces.filter((p) => p.y === 0 && !p.around).sort((a, b) => a.x - b.x)
  const leftCut = firstCut[0]?.cutW ? firstCut[0].w : null
  const rightCut = firstCut[firstCut.length - 1]?.cutW ? firstCut[firstCut.length - 1].w : null
  const text = `${PATTERNS.find((p) => p.key === pattern)!.label} · ${useStart === 'best' ? 'best start' : startLabel(useStart).toLowerCase()}${leftCut && rightCut ? ` · ${ftIn(leftCut)} cuts both sides` : ''}${inside.length ? ` · around the ${Array.from(new Set(inside.map((h) => CUT_LABEL[h.kind].toLowerCase()))).join(', ')}` : ''}`
  const color = tile?.color || TILE_COLOR[tile?.swatch || ''] || '#efece6'
  const g = GROUTS[grout]?.color || '#b8b0a3'
  /* draw: fit the surface in the canvas, floor at the bottom */
  const box = { w: 780, h: 520 }
  const k = Math.min(box.w / W, box.h / H)
  const pw = W * k, ph = H * k
  const pieces = r.pieces.length
  const buy = Math.ceil(pieces * 1.1)
  /* the tile's real size: saved with the project's tile when both numbers are in */
  const saveReal = (a: string, b: string) => {
    if (!tile) return
    const A = parseInch(a), B = parseInch(b)
    const next = A && B ? `${inchText(A)} × ${inchText(B)}` : undefined
    if ((next || undefined) === (tile.actual || undefined)) return
    if ((a.trim() || b.trim()) && !next) return
    s.commit((st) => { const t = st.tiles[jobId]?.[tile.tag]; if (t) t.actual = next }, next ? `${tile.tag} is really ${next}` : `${tile.tag}: back to ${tile.size}`, { sub: next ? 'Every layout with this tile uses it.' : undefined, undo: false })
  }
  const add = (kind: CutoutKind) => {
    const d = CUT_SIZE[kind]
    const w = Math.min(d.w, W), h = Math.min(d.h, H)
    setHoles((hs) => [...hs, { id: 'c' + Date.now().toString(36), kind, w, h, x: Math.round((W - w) / 2), y: isWall ? Math.min(d.y, Math.max(0, H - h)) : 0 }])
  }
  const setHole = (id: string, patch: Partial<Cutout>) => setHoles((hs) => hs.map((h) => (h.id === id ? { ...h, ...patch } : h)))
  return (
    <Modal
      level={level}
      size="full"
      tall
      onClose={s.close}
      title={`${room} · ${surface}`}
      sub={`${job?.name} · ${tile ? `${tile.tag} ${tile.name} ${tile.size}${rA && rB && !nominal.mosaic ? ` (really ${inches(rA).replace(/″$/, '')} × ${inches(rB)})` : ''}` : 'No tile picked'} · joint ${x.joint || '1/16″'} · drawn to scale`}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{text}</span>
          <Button className="ml-auto" icon={<Printer />} onClick={() => printNode(drawRef.current)}>Print</Button>
          <Button icon={<Send />} onClick={() => sendLayout(jobId, room, surface, text)}>Send to the designer</Button>
          <Button variant="primary" icon={<Check />} onClick={() => saveLayout(jobId, room, surface, { text, dims: { w: W, h: H }, grout, cutouts: inside })}>Use this layout</Button>
        </>
      }
      bodyClass="p-0"
    >
      {/* a computer: the drawing stays put while the settings beside it scroll */}
      <div className="grid min-h-full grid-cols-[minmax(0,1fr)_21rem] max-lg:grid-cols-1 lg:h-full">
        <div ref={drawRef} className="flex min-w-0 flex-col items-center justify-center gap-3 bg-[#f4f1eb] px-6 py-6 lg:min-h-0 lg:overflow-hidden">
          <div className="flex max-w-full items-end gap-3">
            {/* height label */}
            <div className="flex flex-col items-center justify-center text-[0.75rem] font-semibold tnum text-muted max-sm:hidden" style={{ height: ph }}>
              <span className="w-px flex-1 bg-[#c8ced8]" />
              <span className="my-1 -rotate-90 whitespace-nowrap">{ftIn(H)}</span>
              <span className="w-px flex-1 bg-[#c8ced8]" />
            </div>
            <div className="min-w-0 max-w-full">
              <svg width={pw} height={ph} viewBox={`0 0 ${W} ${H}`} className="block h-auto max-w-full rounded-[0.1875rem] shadow-[0_0_0_0.0625rem_rgba(16,24,40,.18),0_0.625rem_1.875rem_-0.75rem_rgba(16,24,40,.35)]" role="img" aria-label={`${surface} layout`} data-layout-svg>
                <rect x={0} y={0} width={W} height={H} fill={g} />
                {r.pieces.map((p, i) => (
                  <rect
                    key={i}
                    x={p.x}
                    y={H - p.y - p.h}
                    width={p.w}
                    height={p.h}
                    fill={p.sliver ? '#fdd8d4' : p.cutW || p.cutH ? shade(color, -0.07) : color}
                    stroke={p.sliver ? '#d92d20' : g}
                    strokeWidth={p.sliver ? Math.max(0.25, 1.6 / k) : Math.max(j, 1.3 / k)}
                  />
                ))}
                {/* cut sizes on the edge pieces, where they fit */}
                {r.pieces.filter((p) => !p.around && ((p.cutW && (p.x === 0 || p.x + p.w >= W - 0.01)) || (p.cutH && (p.y === 0 || p.y + p.h >= H - 0.01)))).filter((p) => p.w * k > 30 && p.h * k > 16).map((p, i) => (
                  <text key={'t' + i} x={p.x + p.w / 2} y={H - p.y - p.h / 2} fontSize={10.5 / k} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill={p.sliver ? '#b42318' : '#6b6255'} style={{ fontFamily: 'Inter, sans-serif' }}>
                    {p.cutW && p.cutH ? `${ftIn(p.w)} × ${ftIn(p.h)}` : ftIn(p.cutW ? p.w : p.h)}
                  </text>
                ))}
                {td.mosaic && r.pieces.map((p, i) => <rect key={'m' + i} x={p.x} y={H - p.y - p.h} width={p.w} height={p.h} fill="url(#hexdots)" />)}
                {/* what's on the wall: no tile there */}
                {inside.map((o) => (
                  <g key={o.id} data-cutout={o.kind}>
                    <rect x={o.x} y={H - o.y - o.h} width={o.w} height={o.h} fill="#ffffff" stroke="#6b7280" strokeWidth={1.4 / k} strokeDasharray={`${4 / k} ${3 / k}`} />
                    {o.w * k > 44 && o.h * k > 26 && (
                      <text x={o.x + o.w / 2} y={H - o.y - o.h / 2} fontSize={11 / k} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill="#4b5563" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {CUT_LABEL[o.kind]} {inches(o.w)} × {inches(o.h)}
                      </text>
                    )}
                  </g>
                ))}
                <defs>
                  <pattern id="hexdots" width="2" height="2" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="none" stroke={g} strokeWidth="0.12" /></pattern>
                </defs>
              </svg>
              {/* width label */}
              <div className="mt-2 flex max-w-full items-center gap-2 text-[0.75rem] font-semibold tnum text-muted" style={{ width: pw }}>
                <span className="h-px flex-1 bg-[#c8ced8]" />{ftIn(W)}<span className="sm:hidden"> × {ftIn(H)}</span><span className="h-px flex-1 bg-[#c8ced8]" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[0.78125rem] text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />Full tile</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: shade(color, -0.06), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />Cut</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-bad-600 bg-[#fdd8d4]" />Sliver — too thin</span>
            <span>{isWall ? 'Floor at the bottom' : 'Door at the bottom'}</span>
          </div>
        </div>

        <aside className="scroll-soft flex flex-col gap-4 border-l border-line px-5 py-4 max-lg:border-l-0 max-lg:border-t lg:min-h-0 lg:overflow-y-auto">
          <div>
            <div className="mb-2 text-[0.8125rem] font-semibold text-ink">{isWall ? 'The wall' : 'The floor'}</div>
            <div className="grid grid-cols-2 gap-2">
              <Inch label="Width" value={W} onChange={setW} />
              <Inch label={isWall ? 'Height' : 'Length'} value={H} onChange={setH} />
            </div>
            <div className={cn('mt-1 text-[0.75rem]', x.dims ? 'text-muted' : 'font-medium text-warn-700')} data-size-source>{x.dims ? 'Measured' : `Not measured yet — worked out from the takeoff (${x.sf} SF). Type in what you measure on site or off the plans.`}</div>
          </div>
          {tile && !nominal.mosaic && (
            <div data-real-size>
              <div className="mb-2 flex items-baseline justify-between gap-2"><span className="text-[0.8125rem] font-semibold text-ink">The tile’s real size</span><span className="text-[0.75rem] text-muted">box says {tile.size}</span></div>
              <div className="grid grid-cols-2 gap-2">
                <InchText label={`${nominal.a}″ side`} value={ra} placeholder={String(nominal.a)} onChange={setRa} onDone={(v) => saveReal(v, rb)} />
                <InchText label={`${nominal.b}″ side`} value={rb} placeholder={String(nominal.b)} onChange={setRb} onDone={(v) => saveReal(ra, v)} />
              </div>
              <div className="mt-1 text-[0.75rem] text-muted">{rA && rB ? 'Measured off the tile — every layout with it uses this.' : 'Measure one tile (23 1/2, 47 1/4…) — until then it’s drawn at the box size.'}</div>
            </div>
          )}
          <div data-cutouts>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[0.8125rem] font-semibold text-ink">{isWall ? 'On this wall' : 'On this floor'}</span>
              <Menu align="end" width={220} trigger={<Button size="xs" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />}>Add</Button>}>
                {((isWall ? ['window', 'door', 'niche', 'tub', 'vanity', 'other'] : ['tub', 'vanity', 'other']) as CutoutKind[]).map((kk) => <MenuItem key={kk} onSelect={() => add(kk)}>{CUT_LABEL[kk]}</MenuItem>)}
              </Menu>
            </div>
            {!inside.length && <div className="text-[0.78125rem] leading-snug text-muted">{isWall ? 'A window, a door, a niche, the tub — put it where it is, and the tile is cut around it.' : 'The tub or a vanity — no tile under it.'}</div>}
            <div className="flex flex-col gap-2">
              {holes.map((h) => (
                <div key={h.id} className="rounded-xl border border-line px-3 py-2" data-cutout-row={h.kind}>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.8125rem] font-semibold text-ink">{CUT_LABEL[h.kind]}</span>
                    <button aria-label={`Take the ${CUT_LABEL[h.kind].toLowerCase()} off`} onClick={() => { setHoles((hs) => hs.filter((y) => y.id !== h.id)); if (start === `on:${h.id}`) setStart('best') }} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-wash-2 hover:text-bad-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1.5">
                    <Inch label="Wide" value={h.w} onChange={(n) => setHole(h.id, { w: n })} min={1} />
                    <Inch label="High" value={h.h} onChange={(n) => setHole(h.id, { h: n })} min={1} />
                    <Inch label="From the left" value={h.x} onChange={(n) => setHole(h.id, { x: n })} min={0} />
                    <Inch label={isWall ? 'Up from the floor' : 'From the door side'} value={h.y} onChange={(n) => setHole(h.id, { y: n })} min={0} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[0.8125rem] font-semibold text-ink">Pattern</div>
            <div className="flex flex-wrap gap-1.5">{PATTERNS.map((p) => <Chip key={p.key} on={pattern === p.key} onClick={() => setPattern(p.key)} className="h-8 px-2.5 text-[0.8125rem]">{p.label}</Chip>)}</div>
          </div>
          <div>
            <div className="mb-2 text-[0.8125rem] font-semibold text-ink">Where to start</div>
            <div className="flex flex-col gap-1.5">
              {options.map(({ k: key, r: rr }) => (
                <button key={key} onClick={() => setStart(key)} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition', useStart === key ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-line hover:border-brand-200')} data-start={key.startsWith('on:') ? 'on' : key}>
                  {key === 'best' ? <Sparkles className="h-4 w-4 shrink-0 text-vio-600" /> : <Ruler className="h-4 w-4 shrink-0 text-muted" />}
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[0.84375rem] font-semibold text-ink">{startLabel(key)}</span>
                    <span className={cn('block text-[0.75rem]', rr.slivers ? 'font-semibold text-bad-600' : 'text-muted')}>{rr.slivers ? `${rr.slivers} slivers` : `Smallest cut ${rr.smallest ? ftIn(rr.smallest) : '—'}`}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[0.8125rem] font-semibold text-ink">Grout</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(GROUTS).map(([key, gg]) => (
                <button key={key} onClick={() => setGrout(key)} aria-label={gg.name} title={gg.name} className={cn('h-8 w-8 rounded-full shadow-[inset_0_0_0_0.0625rem_rgba(16,24,40,.15)] transition', grout === key && 'ring-2 ring-brand-600 ring-offset-2')} style={{ background: gg.color }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-wash p-3.5">
            <dl className="flex flex-col gap-1.5 text-[0.84375rem]">
              <div className="flex justify-between"><dt className="text-muted">Full tiles</dt><dd className="font-semibold tnum text-ink">{r.full}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Cut tiles</dt><dd className="font-semibold tnum text-ink">{r.cut}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Smallest edge cut</dt><dd className="font-semibold tnum text-ink">{r.smallest ? ftIn(r.smallest) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Slivers</dt><dd className={cn('font-semibold tnum', r.slivers ? 'text-bad-600' : 'text-ok-700')}>{r.slivers ? r.slivers : 'None'}</dd></div>
              <div className="mt-1 flex justify-between border-t border-line-2 pt-1.5"><dt className="text-muted">{td.mosaic ? 'Sheets' : 'Tiles'} with 10% waste</dt><dd className="font-bold tnum text-ink">{buy}</dd></div>
            </dl>
          </div>
          {r.slivers > 0 && useStart !== 'best' && (
            <button onClick={() => setStart('best')} className="flex items-start gap-2 rounded-xl border border-bad-100 bg-bad-50 px-3 py-2.5 text-left text-[0.8125rem] text-ink-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" /><span><b className="font-semibold text-bad-700">Slivers on this start.</b> The best start avoids them — tap to use it.</span>
            </button>
          )}
        </aside>
      </div>
    </Modal>
  )
}
/** a size typed with fractions (23 1/2) — saved when you leave the box */
function InchText({ label, value, placeholder, onChange, onDone }: { label: string; value: string; placeholder: string; onChange: (v: string) => void; onDone: (v: string) => void }) {
  const bad = !!value.trim() && parseInch(value) == null
  return (
    <label className="block">
      <span className="text-[0.75rem] font-medium text-muted">{label}</span>
      <span className="relative mt-1 flex items-center">
        <input inputMode="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onDone(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className={cn('h-9 w-full rounded-lg border bg-white pl-2.5 pr-8 text-[0.875rem] tnum text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50', bad ? 'border-bad-300' : 'border-line')} />
        <span className="pointer-events-none absolute right-2.5 text-[0.75rem] text-muted">in</span>
      </span>
    </label>
  )
}
function Inch({ label, value, onChange, min = 6 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  const [v, setV] = React.useState(inchText(value))
  React.useEffect(() => setV(inchText(value)), [value])
  return (
    <label className="block">
      <span className="text-[0.75rem] font-medium text-muted">{label}</span>
      <span className="relative mt-1 flex items-center">
        <input
          inputMode="decimal"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => { const n = parseInch(v); if (n != null && n >= min && n <= 1200) onChange(Math.round(n * 8) / 8); else setV(inchText(value)) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="h-9 w-full rounded-lg border border-line bg-white pl-2.5 pr-14 text-[0.875rem] tnum text-ink focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50"
        />
        <span className="pointer-events-none absolute right-2.5 text-[0.75rem] text-muted">in{value >= 12 ? ` · ${ftIn(value)}` : ''}</span>
      </span>
    </label>
  )
}
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + 255 * amt)))
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('')
}
