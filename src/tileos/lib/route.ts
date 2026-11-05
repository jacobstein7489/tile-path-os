/* The day's rounds on the map: each job site found once (OpenStreetMap — no key, nothing to set up) and kept on this
 * phone, the stops put in driving order from where you are (the nearest next, then straightened out), and Google Maps
 * opened through all of them — nobody types an address. */

export type Pt = { lat: number; lng: number }
const KEY = 'tileos-geo'
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

/** find the addresses not found yet, one a second (the map's own rule); each one found is said right away */
export async function findPlaces(addresses: string[], onFound: () => void, signal?: AbortSignal): Promise<void> {
  const todo = Array.from(new Set(addresses.filter((a) => a.trim() && placeOf(a) === undefined)))
  for (let i = 0; i < todo.length; i++) {
    if (signal?.aborted) return
    if (i) await new Promise((r) => setTimeout(r, 1100))
    const a = todo[i]
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(a)}`, { signal, headers: { Accept: 'application/json' } })
      if (!r.ok) continue
      const j = (await r.json()) as { lat: string; lon: string }[]
      const c = load()
      c[norm(a)] = j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : { miss: Date.now() }
      save(c)
      onFound()
    } catch { if (signal?.aborted) return /* no signal: the order stays as it is */ }
  }
}

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
