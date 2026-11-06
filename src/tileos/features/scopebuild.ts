/* Building a scope of work by hand, the same way an estimate is built: pick the floor, then a room from the company's
 * list (Kitchen, Master bathroom…) — it comes with its usual walls and floors; tick what else it has. What isn't tile
 * (waterproofing, metals, a saddle, a drain) isn't a line: it goes on the walls and floors as how they're set, their
 * edges, a note — exactly as when an approved estimate becomes the scope. */
import { useStore, addHist, meOf, type Store } from '@/tileos/store'
import { SCOPE_NAME, uniqueArea, floorName, type SurfaceDef } from '@/tileos/data/areas'
import type { Room, Surface } from '@/tileos/data/jobs'
import { companySurfaces, surfaceOf } from './estflow'
import { detailInto, isDetailKey } from './flows2'
import { takesTile } from './steps'

const S = () => useStore.getState()
const me = () => meOf(S().role)
type Rules = Pick<Store, 'rules'>

/** what a surface from the company's list is called on the scope — "Floor", "Walls", "Niche" */
export const scopeNameOf = (s: Rules, key: string) => SCOPE_NAME[key] || surfaceOf(s, key).label
/** the company's surfaces that are walls and floors of their own (tile goes on them) — the rest are details */
export const isWallOrFloor = (d: SurfaceDef) => !isDetailKey(d.key) && takesTile(d.label)
export const wallFloorKeys = (s: Rules) => companySurfaces(s).filter(isWallOrFloor).map((d) => d.key)
/** the surface on the company's list a line on the scope is — for ticking what a room already has */
export function keyOfLine(s: Rules, name: string): string | undefined {
  const n = name.trim().toLowerCase()
  return companySurfaces(s).filter(isWallOrFloor).find((d) => scopeNameOf(s, d.key).toLowerCase() === n || d.label.toLowerCase() === n)?.key
}
/** started on site — the crew has been on it, so it stays */
export const lineStarted = (x: Surface) => x.state === 'working' || x.state === 'done' || (x.pct || 0) > 0
export const roomStarted = (r: Room) => r.surfaces.some(lineStarted)

/** a room on its floor, with its walls and floors (the keys from the company's list) — "Kitchen #2" when there's one */
export function addArea(jobId: string, name: string, keys: string[], floor?: string) {
  const n = name.trim()
  if (!n) return
  const fl = floorName(floor)
  S().commit((s) => {
    const rooms = (s.rooms[jobId] ||= [])
    const room = uniqueArea(n, rooms.map((r) => r.name))
    const tiled = keys.filter((k) => !isDetailKey(k))
    const names = Array.from(new Set((tiled.length ? tiled : ['floor']).map((k) => scopeNameOf(s, k))))
    const r: Room = { name: room, pct: 0, ...(fl ? { floor: fl } : {}), surfaces: names.map((x) => ({ name: x, tile: '', state: 'notstarted' as const })) }
    keys.filter(isDetailKey).forEach((k) => detailInto(r, k))
    rooms.push(r)
    addHist(s, jobId, { who: me(), kind: 'setup', title: `Room added · ${room}${fl ? ` · ${fl}` : ''}`, detail: names.join(', ') })
  }, `${n} added${fl ? ` · ${fl}` : ''}`, { sub: 'Tap a wall or floor for its tile, pattern and square feet.' })
}
/** move a room to another floor, or change the note next to it on the paper */
export function setRoom(jobId: string, room: string, p: { floor?: string | null; note?: string | null }) {
  S().commit((s) => {
    const r = s.rooms[jobId]?.find((x) => x.name === room)
    if (!r) return
    if (p.floor !== undefined) { const f = floorName(p.floor || undefined); if (f) r.floor = f; else delete r.floor }
    if (p.note !== undefined) { const t = (p.note || '').trim(); if (t) r.note = t; else delete r.note }
  }, p.floor !== undefined ? `${room} · ${floorName(p.floor || undefined) || 'no floor'}` : undefined)
}
/** take a room off the scope — only while nothing on it has been started */
export function removeRoom(jobId: string, room: string) {
  const r0 = S().rooms[jobId]?.find((x) => x.name === room)
  if (!r0 || roomStarted(r0)) return
  S().commit((s) => {
    s.rooms[jobId] = (s.rooms[jobId] || []).filter((x) => x.name !== room)
    addHist(s, jobId, { who: me(), kind: 'setup', title: `Room taken off · ${room}` })
  }, `${room} taken off the scope`)
}
/** one more wall or floor from the company's list (the tick list under a room) */
export function addLine(jobId: string, room: string, key: string) {
  S().commit((s) => {
    const r = s.rooms[jobId]?.find((x) => x.name === room)
    if (!r) return
    const name = scopeNameOf(s, key)
    if (r.surfaces.some((x) => x.name.toLowerCase() === name.toLowerCase())) return
    r.surfaces.push({ name, tile: '', state: 'notstarted' })
    addHist(s, jobId, { who: me(), kind: 'setup', title: `${room} · ${name.toLowerCase()} added` })
  })
}
/** untick a wall or floor — only while it hasn't been started */
export function removeLine(jobId: string, room: string, name: string) {
  S().commit((s) => {
    const r = s.rooms[jobId]?.find((x) => x.name === room)
    const x = r?.surfaces.find((y) => y.name === name)
    if (!r || !x || lineStarted(x)) return
    r.surfaces = r.surfaces.filter((y) => y !== x)
    addHist(s, jobId, { who: me(), kind: 'setup', title: `${room} · ${name.toLowerCase()} taken off` })
  })
}
