/* The app kept on the device (a service worker, /sw.js), so it opens with no signal — the data comes from the copy the
 * app keeps itself (lib/cloud). Only on the published app (or the company's own address) — never inside the Lovable
 * editor's preview, where the code changes all the time. */
import { PUBLISHED } from './save'

declare const __BUILT__: string
/* each new version gets its own copy on the device (the old one is cleared), so it never fills up */
const VERSION = typeof __BUILT__ !== 'undefined' ? __BUILT__.replace(/[^0-9]/g, '').slice(0, 14) : 'dev'

export function keepAppOnDevice() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || import.meta.env.DEV) return
  if (window.self !== window.top) return
  const host = location.hostname
  const published = (() => { try { return new URL(PUBLISHED).hostname } catch { return '' } })()
  const lovable = /(^|\.)lovable(project)?\.(app|com|dev)$/.test(host)
  if (lovable && host !== published) return
  if (host === 'localhost' || host === '127.0.0.1') return
  navigator.serviceWorker.register(`/sw.js?v=${VERSION}`).then(async () => {
    const reg = await navigator.serviceWorker.ready
    /* what this page already loaded (before the service worker was there) is kept too */
    const files = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin) && /\.(js|mjs|css|svg|png|webp|woff2?)(\?|$)/i.test(u))
    reg.active?.postMessage({ keep: files, page: true })
  }).catch(() => { /* the app still works online */ })
}
