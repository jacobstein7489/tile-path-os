/* Tile OS on the device — so the app opens with no signal (a basement, a new building).
 *   the page: always the newest from the network when there's signal (a refresh always gets a new version); with no
 *   signal or a very slow one, the copy kept from last time. The app also checks for a new version and moves to it by
 *   itself (lib/device)
 *   the app's files (scripts, styles, pictures, fonts): kept the first time they load, then served from here — their
 *   names change with every new version, so nothing goes stale
 * The company's data never goes through here: the app keeps its own copy and sends what was done once the signal is
 * back. Sign-in, the database and the server's functions always go straight to the network. */
/* one copy per version of the app (the page registers /sw.js?v=<version>) — a new version clears the old copy */
const CACHE = 'tileos-app-' + (new URL(self.location.href).searchParams.get('v') || '1')
const PAGE = '/__tileos_page'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
    await self.clients.claim()
  })())
})

/* the page tells it what it loaded before this was running */
self.addEventListener('message', (e) => {
  const d = e.data || {}
  e.waitUntil((async () => {
    const c = await caches.open(CACHE)
    if (d.page) {
      try { const r = await fetch('/', { credentials: 'same-origin', cache: 'no-cache' }); if (r.ok) await c.put(PAGE, r) } catch { /* no signal */ }
      /* the page asked to know when it's kept (it's about to move to the new version) */
      if (e.ports && e.ports[0]) e.ports[0].postMessage({ kept: true })
    }
    const urls = Array.isArray(d.keep) ? d.keep.slice(0, 400) : []
    await Promise.all(urls.map(async (u) => {
      try {
        if (await c.match(u)) return
        const r = await fetch(u, { credentials: 'same-origin' })
        if (r.ok) await c.put(u, r)
      } catch { /* fine */ }
    }))
  })())
})

const isFile = (url) => url.pathname.startsWith('/assets/') || /\.(js|mjs|css|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|webmanifest)$/i.test(url.pathname)

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (url.origin !== self.location.origin && !fonts) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_serverFn') || url.pathname.startsWith('/_server')) return
  if (req.mode === 'navigate') {
    /* only the app's own page ("/") comes from the kept copy — any other page (privacy, terms, fresh) is the network's */
    if (url.pathname !== '/') return
    e.respondWith((async () => {
      const c = await caches.open(CACHE)
      /* the newest page, past every cache on the way — a new version shows the moment it's published (a refresh always
         gets it) — and kept for next time */
      const net = fetch(url.href, { credentials: 'same-origin', cache: 'no-store' }).then(async (res) => {
        if (res.ok) await c.put(PAGE, res.clone())
        return res
      })
      const kept = await c.match(PAGE)
      if (!kept) {
        try { return await net } catch { return (await c.match(req)) || Response.error() }
      }
      /* opened here before: the newest page when it comes within a moment; with no signal (a basement, a new building)
         or a very slow one, the kept copy — the newest still comes in and is kept for the next open */
      const slow = new Promise((r) => setTimeout(() => r(null), 2500))
      const first = await Promise.race([net.catch(() => null), slow])
      if (first && first.ok) return first
      e.waitUntil(net.catch(() => null))
      return kept
    })())
    return
  }
  if (fonts || isFile(url)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE)
      const hit = await c.match(req)
      if (hit) return hit
      try {
        const res = await fetch(req)
        if (res.ok || res.type === 'opaque') await c.put(req, res.clone())
        return res
      } catch {
        return Response.error()
      }
    })())
  }
})
