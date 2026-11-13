/* The app kept on the device (a service worker, /sw.js), so it opens with no signal — the data comes from the copy the
 * app keeps itself (lib/cloud). Only on the published app (or the company's own address) — never inside the Lovable
 * editor's preview, where the code changes all the time. */
import { PUBLISHED } from './save'

declare const __BUILT__: string
/* each new version gets its own copy on the device (the old one is cleared), so it never fills up */
const VERSION = typeof __BUILT__ !== 'undefined' ? __BUILT__.replace(/[^0-9]/g, '').slice(0, 14) : 'dev'

/** the app doesn't zoom: an iPhone's Safari ignores the page's "no zoom" setting, so its pinch is stopped here (the
 *  double tap is stopped by the page's touch setting, in styles.css) */
export function lockZoom() {
  if (typeof document === 'undefined') return
  const stop = (e: Event) => e.preventDefault()
  for (const k of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(k, stop, { passive: false })
}

/** the published app (or the company's own address) — not the editor's preview, not this computer's test server */
function onDevice(): boolean {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || import.meta.env.DEV) return false
  if (window.self !== window.top) return false
  const host = location.hostname
  const published = (() => { try { return new URL(PUBLISHED).hostname } catch { return '' } })()
  const lovable = /(^|\.)lovable(project)?\.(app|com|dev)$/.test(host)
  if (lovable && host !== published) return false
  return host !== 'localhost' && host !== '127.0.0.1'
}

export function keepAppOnDevice() {
  if (!onDevice()) return
  navigator.serviceWorker.register(`/sw.js?v=${VERSION}`).then(async () => {
    const reg = await navigator.serviceWorker.ready
    /* what this page already loaded (before the service worker was there) is kept too */
    const files = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin) && /\.(js|mjs|css|svg|png|webp|woff2?)(\?|$)/i.test(u))
    reg.active?.postMessage({ keep: files, page: true })
  }).catch(() => { /* the app still works online */ })
}

/* ---------------- a new version published: the app moves to it by itself ----------------
 * The app opens from the copy on the device (right away). Meanwhile it asks the server for its page: that page names
 * the app's files — a name this copy never loaded means a newer version is out. Then the device keeps the new page,
 * and the app moves to it: right away when it was only just opened and nothing's been touched yet, or when it comes
 * back on screen after a while with no window open — otherwise simply the next time it's opened. Once per version. */
const ASSET = /\/assets\/([\w.-]+\.(?:js|css))/g
/** the app's file names a page names */
export const assetsIn = (text: string): Set<string> => new Set(Array.from(text.matchAll(ASSET), (m) => m[1]))
/** the server's page names a file this one never loaded */
export const isNewer = (html: string, loaded: Set<string>): boolean => {
  const theirs = Array.from(assetsIn(html))
  return theirs.length > 0 && loaded.size > 0 && theirs.some((n) => !loaded.has(n))
}
function loadedFiles(): Set<string> {
  const out = new Set<string>()
  try { performance.getEntriesByType('resource').forEach((e) => { const m = e.name.match(/\/assets\/([\w.-]+\.(?:js|css))(?:[?#]|$)/); if (m) out.add(m[1]) }) } catch { /* fine */ }
  try { assetsIn(document.documentElement.outerHTML).forEach((x) => out.add(x)) } catch { /* fine */ }
  return out
}
/* moved for a version once: never again for the same one for a day — if it still looks newer after moving, it's this
   check that's wrong, and the app must not go round opening twice */
const MOVED = 'tileos-moved-to'
const DAY_MS = 24 * 60 * 60 * 1000
/** keep the new page on the device, and say when it's kept (or give up after a few seconds) */
function keepNewPage(): Promise<void> {
  return new Promise((done) => {
    const sw = navigator.serviceWorker?.controller
    if (!sw) return done()
    const ch = new MessageChannel()
    const t = setTimeout(done, 4000)
    ch.port1.onmessage = () => { clearTimeout(t); done() }
    try { sw.postMessage({ page: true }, [ch.port2]) } catch { clearTimeout(t); done() }
  })
}
/** look once: true when it moved (or is about to) */
export async function checkForNewVersion(o: { idle: () => boolean; now: boolean; get?: () => Promise<string>; loaded?: Set<string>; reload?: () => void }): Promise<'same' | 'moved' | 'later' | 'error'> {
  let html = ''
  try { html = o.get ? await o.get() : await (await fetch('/', { cache: 'no-store', credentials: 'same-origin' })).text() } catch { return 'error' }
  if (!isNewer(html, o.loaded || loadedFiles())) return 'same'
  const sig = Array.from(assetsIn(html)).sort().join(',')
  let was: { sig?: string; at?: number } | null = null
  try { was = JSON.parse(localStorage.getItem(MOVED) || 'null') } catch { /* private window */ }
  if (was?.sig === sig && Date.now() - (was.at || 0) < DAY_MS) return 'later'
  if (!o.now || !o.idle()) return 'later'
  try { localStorage.setItem(MOVED, JSON.stringify({ sig, at: Date.now() })) } catch { /* private window */ }
  await keepNewPage()
  ;(o.reload || (() => location.reload()))()
  return 'moved'
}
/** watch for a new version: a few seconds after it opens, and when it comes back on screen after a while */
export function watchForNewVersion(idle: () => boolean) {
  if (!onDevice()) return
  const opened = Date.now()
  let touched = false
  const touch = () => { touched = true }
  window.addEventListener('pointerdown', touch, { capture: true, once: true })
  window.addEventListener('keydown', touch, { capture: true, once: true })
  setTimeout(() => { void checkForNewVersion({ idle, now: !touched && Date.now() - opened < 15000 }) }, 2500)
  let hiddenAt = 0
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
    if (hiddenAt && Date.now() - hiddenAt > 2 * 60 * 1000) void checkForNewVersion({ idle, now: true })
  })
}
