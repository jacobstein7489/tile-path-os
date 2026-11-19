/* A room's details — the lines on Cobblestone's own Scope of Work, next to the room's tiles: how it's tiled ("Walls:
 * half tiled, to 4 ft"), the layout ("Floor: basketweave"), the edges ("Metals: JOLLY · brushed nickel"), the extras
 * ("1 niche", "Saddle — white quartz"). Until someone writes them, they come from what the project already knows — each
 * wall's height, the layouts, the edges and notes, the estimate's other lines in that room; once one is changed, the
 * room keeps its own list. The short note after the room's name ("Floor only") stays the room's note. */
import { useStore, addHist, meOf, type Store } from '@/tileos/store'
import type { Room, Surface } from '@/tileos/data/jobs'
import { edgeKind, parseMetal, profileOf, finishOf } from '@/tileos/data/catalog'
import type { EstLine } from '@/tileos/data/estimates'
import { isWall } from './heights'
import { takesTile } from './steps'

const cap = (t: string) => t.replace(/^./, (c) => c.toUpperCase())
const low = (t: string) => t.replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase())
/** a wall's edge in a few words: "JOLLY · brushed nickel", "Mitered" */
export function edgeShort(edge?: string): string {
  const k = edgeKind(edge)
  if (!edge || !k) return ''
  if (k === 'metal') { const m = parseMetal(edge); const p = profileOf(m?.profile), f = finishOf(m?.finish); return [p?.short || 'Metal', f?.name.toLowerCase()].filter(Boolean).join(' · ') }
  if (k === 'mitered') return 'Mitered'
  return edge
}
/** "Half tiled — to 4 ft" → "half tiled, to 4 ft" */
const heightWords = (h: string) => low(h.replace(/\s+—\s+/g, ', '))

/** what each wall and floor says by itself — how high, the layout, the edges, its note: the part of a room's details
 *  its walls and floors already show (the scope of work shows them on their own lines) */
export function surfaceDetailLines(room: Room): string[] {
  const out: string[] = []
  const add = (t: string) => { const v = t.trim(); if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(cap(v)) }
  const tiled = room.surfaces.filter((x) => takesTile(x.name) || x.tile)
  /* how high each wall goes */
  tiled.forEach((x) => { if (x.height && isWall(x.name)) add(`${x.name}: ${heightWords(x.height)}`) })
  /* the layout — once when every wall and floor has the same, else each one's */
  const lay = tiled.filter((x) => x.layout)
  const same = lay.length > 1 && lay.every((x) => x.layout === lay[0].layout)
  if (same) add(`Layout: ${low(lay[0].layout!)}`)
  else lay.forEach((x) => add(`${x.name}: ${low(x.layout!)}`))
  /* the edges, on the walls */
  const edges = Array.from(new Set(tiled.filter((x) => isWall(x.name)).map((x) => edgeShort(x.edge)).filter(Boolean)))
  edges.forEach((e) => add(e === 'Mitered' ? 'Mitered edges' : `Metals: ${e}`))
  /* what's written on a wall or floor */
  room.surfaces.forEach((x) => { if (x.notes) add(`${x.name}: ${low(x.notes)}`) })
  return out
}
/** the estimate's other lines in this room — a niche, a saddle, a window wrap */
export function estimateExtras(s: Pick<Store, 'estimates' | 'items'>, jobId: string, room: Room): string[] {
  const out: string[] = []
  const add = (t: string) => { const v = t.trim(); if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(cap(v)) }
  const e = s.estimates.find((x) => x.jobId === jobId)
  const rev = e && (e.revs.find((r) => r.status === 'approved') || [...e.revs].reverse().find((r) => r.status !== 'superseded') || e.revs[e.revs.length - 1])
  ;(rev?.lines || []).filter((l: EstLine) => l.area === room.name && !l.surface && !s.items.find((i) => i.id === l.itemId)?.surface).forEach((l: EstLine) => {
    const it = s.items.find((i) => i.id === l.itemId)
    const what = l.desc || it?.name || ''
    /* the room's own installation line ("Master Bath — tile installation per plans") is the room itself, not a detail */
    if (!what || /per plans|installation|labor/i.test(what)) return
    const each = !it?.unit || /^(ea|ls)$/i.test(it.unit)
    add(each && l.qty && l.qty >= 1 && Number.isInteger(l.qty) ? `${l.qty} ${low(what)}` : what)
  })
  return out
}
/** what the project knows about a room, as its detail lines */
export function autoDetails(s: Pick<Store, 'estimates' | 'items'>, jobId: string, room: Room): string[] {
  const out: string[] = []
  ;[...surfaceDetailLines(room), ...estimateExtras(s, jobId, room)].forEach((v) => { if (!out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v) })
  return out
}
/** the room's detail lines: its own, or what the project knows */
export function detailsOf(s: Pick<Store, 'estimates' | 'items'>, jobId: string, room: Room): { lines: string[]; own: boolean } {
  if (Array.isArray(room.details)) return { lines: room.details, own: true }
  return { lines: autoDetails(s, jobId, room), own: false }
}
/** the room's detail lines, written — from now on the room keeps its own */
export function setRoomDetails(jobId: string, roomName: string, lines: string[]) {
  const clean = lines.map((l) => l.trim()).filter(Boolean)
  useStore.getState().commit((st) => {
    const r = st.rooms[jobId]?.find((x) => x.name === roomName)
    if (!r) return
    r.details = clean
    addHist(st, jobId, { who: meOf(st.role), kind: 'setup', title: `${roomName} · the details`, detail: clean.join(' · ').slice(0, 220) })
  })
}
/** is a detail line one the eye should catch first — how it's tiled, the layout */
export const strongLine = (t: string) => /layout|tiled|no (wall )?tile|checkerboard|herringbone|basket|brick|chevron|diagonal|pattern|floor only|walls? only|to the ceiling|\bft\b|″|"/i.test(t)
/** the walls and floors a tile is on in a room, in a few words: "Floor + walls", "Walls — trim" */
export function whereIn(room: Room, tag: string, trim?: boolean): string {
  const on = room.surfaces.filter((x) => x.tile === tag || x.also?.includes(tag)).map((x) => x.name)
  if (!on.length) return ''
  const words = on.map((n, i) => (i ? low(n) : n)).join(' + ')
  return trim ? `${words} · trim` : words
}
export type { Surface }
