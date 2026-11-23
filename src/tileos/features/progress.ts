/* Ticking off a wall or floor right on the scope: the tile is in, then the grout — done. A niche (or anything) can be
 * left for later. Each tick is quiet (no pop-up): tap again to take it back. The room and the project's % follow. */
import { useStore, addHist, meOf, recalc, NOW } from '@/tileos/store'
import type { Surface } from '@/tileos/data/jobs'

/** the share of a wall or floor once its tile is in — the grout is the rest */
export const TILED_PCT = 85
export const isTiled = (x: Surface) => x.state === 'done' || !!x.tiledOn || (x.pct || 0) >= TILED_PCT
export const isGrouted = (x: Surface) => x.state === 'done' || !!x.groutedOn
/** part of the tile in, from the daily updates (not ticked yet): 40 → "40%" */
export const partPct = (x: Surface) => (!isTiled(x) && (x.pct || 0) > 0 ? x.pct || 0 : 0)

export function tickSurface(jobId: string, room: string, surface: string, part: 'tile' | 'grout' | 'later') {
  const S = useStore.getState()
  S.commit((s) => {
    const x = s.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
    if (!x) return
    const who = meOf(s.role)
    let said = ''
    if (part === 'later') {
      if (x.later) { delete x.later; said = 'Not for later any more' } else { x.later = true; said = 'Left for later' }
    } else if (part === 'tile') {
      if (isTiled(x)) {
        /* taken back: no tile, so no grout either */
        delete x.tiledOn; delete x.groutedOn
        x.pct = x.pctBefore || 0
        delete x.pctBefore
        if (x.state === 'done' || (x.state === 'working' && !x.pct)) x.state = 'ready'
        said = 'Tile not in after all'
      } else {
        x.tiledOn = NOW
        if (x.pct) x.pctBefore = x.pct
        x.pct = Math.max(x.pct || 0, TILED_PCT)
        if (x.state !== 'done') x.state = 'working'
        delete x.later
        said = 'Tile in'
      }
    } else {
      if (isGrouted(x)) {
        delete x.groutedOn
        x.tiledOn ||= NOW
        x.pct = TILED_PCT
        x.state = 'working'
        said = 'Grout not done after all'
      } else {
        x.tiledOn ||= NOW
        x.groutedOn = NOW
        x.pct = 100
        x.state = 'done'
        delete x.later
        said = 'Grouted · done'
      }
    }
    recalc(s, jobId, [room])
    addHist(s, jobId, { who, kind: 'field', title: `${room} · ${surface} · ${said}` })
  }, undefined, { undo: false })
}
