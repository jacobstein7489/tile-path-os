/* The day's rounds on the map: each job site found once (OpenStreetMap — no key, nothing to set up) and kept on this
 * phone, the stops put in driving order from where you are (the nearest next, then straightened out), and Google Maps
 * opened through all of them — nobody types an address. */

export type Pt = { lat: number; lng: number }
/* (2: found again near where you are — an address without its town lands on the right street) */
const KEY = 'tileos-geo2'
const norm = (a: string) => a.trim().toLowerCase().replace(/\s+/g, ' ')

/* found places, kept on this phone: a point, or 0 for "the map doesn't know it" (not asked again for a week) */
type Hit = Pt | { miss: number }
function load(): Record<string, Hit> { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { return {} } }
function save(c: Record<string, Hit>) { try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* private window: found again next time */ } }

/** where an address is, if it's been found — undefined: not looked up yet; null: the map doesn't know it */
export function placeOf(address: string): Pt | null | undefined {
  const h = load()[norm(address)]
  if (!h) return undefined
  if ('miss' in h) return Date.now() - h.miss > 7 * 86_400_000 ? undefined : null
  return h
}

/** find the addresses not found yet, one a second (the map's own rule); each one found is said right away. Near where
 *  you are first (about 60 miles around) — "14 Cannon" is the one on your side of town — then anywhere */
export async function findPlaces(addresses: string[], onFound: () => void, signal?: AbortSignal, near?: Pt | null): Promise<void> {
  const todo = Array.from(new Set(addresses.filter((a) => a.trim() && placeOf(a) === undefined)))
  const ask = async (a: string, box: boolean) => {
    const q = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'us', q: a })
    if (box && near) { q.set('viewbox', `${near.lng - 0.9},${near.lat + 0.8},${near.lng + 0.9},${near.lat - 0.8}`); q.set('bounded', '1') }
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${q.toString()}`, { signal, headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error('map')
    return ((await r.json()) as { lat: string; lon: string }[])[0]
  }
  for (let i = 0; i < todo.length; i++) {
    if (signal?.aborted) return
    if (i) await new Promise((r) => setTimeout(r, 1100))
    const a = todo[i]
    try {
      let hit = near ? await ask(a, true) : undefined
      if (!hit) { if (near) await new Promise((r) => setTimeout(r, 1100)); hit = await ask(a, false) }
      const c = load()
      c[norm(a)] = hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : { miss: Date.now() }
      save(c)
      onFound()
    } catch { if (signal?.aborted) return /* no signal: the order stays as it is */ }
  }
}

/** the drive between every two points — seconds and meters, by road (OSRM's public router, no key). null: it couldn't
 *  be reached (then the miles as the crow flies stand in) */
export async function driveTable(pts: Pt[], signal?: AbortSignal): Promise<{ sec: number[][]; m: number[][] } | null> {
  if (pts.length < 2) return null
  try {
    const at = pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
    const r = await fetch(`https://router.project-osrm.org/table/v1/driving/${at}?annotations=duration,distance`, { signal })
    if (!r.ok) return null
    const j = await r.json()
    if (j?.code !== 'Ok' || !Array.isArray(j.durations) || !Array.isArray(j.distances)) return null
    const ok = (g: unknown[][]) => g.every((row) => row.every((v) => typeof v === 'number'))
    return ok(j.durations) && ok(j.distances) ? { sec: j.durations, m: j.distances } : null
  } catch { return null }
}
/** a guess when the router can't be reached: the miles as the crow flies, a third more for the streets, at city speed */
export function guessTable(pts: Pt[]): { sec: number[][]; m: number[][] } {
  const m = pts.map((a) => pts.map((b) => miles(a, b) * 1.3 * 1609.34))
  return { m, sec: m.map((row) => row.map((v) => (v / 1609.34 / 18) * 3600)) }
}
/** the quickest way through every stop: from point 0 when `fromFirst` (where you are), else from whichever stop makes
 *  the shortest day; ends wherever it's shortest. Exact (every way tried, the smart way) up to 15 points */
export function bestPath(cost: number[][], fromFirst: boolean): number[] {
  const n = cost.length
  if (n <= 2) return Array.from({ length: n }, (_, i) => i)
  if (n > 15) {
    /* many stops: the nearest next */
    const out = [0]; const left = new Set(Array.from({ length: n - 1 }, (_, i) => i + 1))
    while (left.size) { const at = out[out.length - 1]; let k = -1; left.forEach((j) => { if (k < 0 || cost[at][j] < cost[at][k]) k = j }); out.push(k); left.delete(k) }
    return out
  }
  /* the stops to visit, and where it may start */
  const nodes = fromFirst ? Array.from({ length: n - 1 }, (_, i) => i + 1) : Array.from({ length: n }, (_, i) => i)
  const k = nodes.length
  const FULL = (1 << k) - 1
  const dp: Float64Array[] = Array.from({ length: 1 << k }, () => new Float64Array(k).fill(Infinity))
  const par: Int8Array[] = Array.from({ length: 1 << k }, () => new Int8Array(k).fill(-1))
  for (let i = 0; i < k; i++) dp[1 << i][i] = fromFirst ? cost[0][nodes[i]] : 0
  for (let mask = 1; mask <= FULL; mask++) {
    for (let i = 0; i < k; i++) {
      const here = dp[mask][i]
      if (!(mask & (1 << i)) || here === Infinity) continue
      for (let j = 0; j < k; j++) {
        if (mask & (1 << j)) continue
        const nm = mask | (1 << j)
        const v = here + cost[nodes[i]][nodes[j]]
        if (v < dp[nm][j]) { dp[nm][j] = v; par[nm][j] = i }
      }
    }
  }
  let end = 0
  for (let i = 1; i < k; i++) if (dp[FULL][i] < dp[FULL][end]) end = i
  const path: number[] = []
  let mask = FULL; let at = end
  while (at >= 0) { path.push(nodes[at]); const p = par[mask][at]; mask &= ~(1 << at); at = p }
  path.reverse()
  return fromFirst ? [0, ...path] : path
}
/** "1 h 40 min", "35 min" */
export const driveWords = (sec: number) => { const m = Math.max(1, Math.round(sec / 60)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` }
/** "32 mi", "4.5 mi" */
export const mileWords = (meters: number) => { const mi = meters / 1609.34; return `${mi < 10 ? mi.toFixed(1).replace(/\.0$/, '') : Math.round(mi)} mi` }

/** miles between two points, as the crow flies */
export function miles(a: Pt, b: Pt): number {
  const R = 3958.8
  const r = (d: number) => (d * Math.PI) / 180
  const dLat = r(b.lat - a.lat)
  const dLng = r(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** the stops in driving order: from where you are (or, not knowing, from whichever stop makes the shortest day) —
 *  the nearest next, then any two legs that cross put straight. Stops the map doesn't know go last, as they were. */
export function inOrder<T extends { id: string; pt?: Pt | null }>(stops: T[], from?: Pt | null): T[] {
  const known = stops.filter((x) => x.pt) as (T & { pt: Pt })[]
  const rest = stops.filter((x) => !x.pt)
  if (known.length < 2) return [...known, ...rest]
  const len = (p: (T & { pt: Pt })[]) => p.reduce((n, x, i) => n + (i ? miles(p[i - 1].pt, x.pt) : from ? miles(from, x.pt) : 0), 0)
  const nearest = (start: number | null) => {
    const left = known.slice()
    const out: (T & { pt: Pt })[] = []
    let at: Pt | undefined = from || undefined
    if (start != null) { out.push(left.splice(start, 1)[0]); at = out[0].pt }
    while (left.length) {
      let k = 0
      left.forEach((x, i) => { if (at && miles(at, x.pt) < miles(at, left[k].pt)) k = i })
      if (!at) k = 0
      out.push(left.splice(k, 1)[0]); at = out[out.length - 1].pt
    }
    /* two legs that cross: turn the stretch between them around (the start stays put) */
    let better = true
    while (better) {
      better = false
      for (let i = from ? 0 : 1; i < out.length - 1; i++) {
        for (let j = i + 1; j < out.length; j++) {
          const next = [...out.slice(0, i), ...out.slice(i, j + 1).reverse(), ...out.slice(j + 1)]
          if (len(next) + 1e-9 < len(out)) { out.splice(0, out.length, ...next); better = true }
        }
      }
    }
    return out
  }
  let best = from ? nearest(null) : nearest(0)
  if (!from) known.forEach((_, i) => { if (i) { const p = nearest(i); if (len(p) < len(best)) best = p } })
  return [...best, ...rest]
}

/** Google Maps, driving from where you are through these stops in this order (it takes ten at a time) */
export function mapsRoute(addresses: string[]): string {
  const a = addresses.filter((x) => x.trim()).slice(0, 10)
  const q = new URLSearchParams({ api: '1', travelmode: 'driving', dir_action: 'navigate', destination: a[a.length - 1] || '' })
  if (a.length > 1) q.set('waypoints', a.slice(0, -1).join('|'))
  return `https://www.google.com/maps/dir/?${q.toString()}`
}
/** Google Maps, driving from where you are to one address */
export const mapsTo = (address: string) => mapsRoute([address])

/** where you are right now — asked once (the phone asks to allow it), not waiting more than a few seconds */
export function whereAmI(): Promise<Pt | null> {
  return new Promise((resolve) => {
    try {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60_000 })
    } catch { resolve(null) }
  })
}
