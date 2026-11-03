/* On the phone: pull down to refresh, and a bar that says when there's no signal (everything still works — it's kept
 * on the phone and goes up by itself when the signal is back). */
import * as React from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { REAL, useSaveStatus, OFFLINE_WORDS } from '@/tileos/lib/save'
import { showPop } from '@/tileos/lib/pop'
import { cn } from '@/tileos/lib/utils'

/** is the device online — as the browser says, kept up to date */
function useOnline() {
  return React.useSyncExternalStore(
    (f) => { window.addEventListener('online', f); window.addEventListener('offline', f); return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f) } },
    () => navigator.onLine,
    () => true,
  )
}

/** no signal: one quiet bar on top — everything still works */
export function OfflineBar() {
  const online = useOnline()
  const st = useSaveStatus()
  const off = !online || st.problem === OFFLINE_WORDS
  if (!off) return null
  return (
    <div className="flex items-center justify-center gap-2 bg-[#fdf3dc] px-4 py-2 text-center text-[0.8125rem] font-medium text-[#7a4b06]" data-offline-bar role="status">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>No signal — what you do is kept on this phone and goes up by itself when you’re back online.</span>
    </div>
  )
}

/** no suggestions over what you type, anywhere: every text box on the page — the ones that come and go too — gets the
 *  browser's autofill list and the phone's predictions turned off (a box that says what it wants, like the sign-in
 *  email or password, keeps it) */
export function QuietTyping() {
  React.useEffect(() => {
    const SKIP = /^(password|email|checkbox|radio|range|file|color|button|submit|reset|hidden|image)$/
    const quiet = (el: Element) => {
      if (el instanceof HTMLInputElement) { if (SKIP.test(el.type)) return }
      else if (!(el instanceof HTMLTextAreaElement)) return
      if (!el.hasAttribute('autocomplete')) el.setAttribute('autocomplete', 'off')
      if (!el.hasAttribute('autocorrect')) el.setAttribute('autocorrect', 'off')
      if (!el.hasAttribute('spellcheck')) el.setAttribute('spellcheck', 'false')
    }
    const all = (root: ParentNode) => root.querySelectorAll?.('input,textarea').forEach(quiet)
    all(document)
    const mo = new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => { if (n instanceof Element) { quiet(n); all(n) } })))
    mo.observe(document.body, { childList: true, subtree: true })
    const focus = (e: FocusEvent) => { if (e.target instanceof Element) quiet(e.target) }
    document.addEventListener('focusin', focus, true)
    return () => { mo.disconnect(); document.removeEventListener('focusin', focus, true) }
  }, [])
  return null
}

/* after a pull-to-refresh the app opens again fresh — this says so when it's back */
const REFRESHED = 'tileos-refreshed'

/* how far to pull before letting go refreshes */
const PULL = 64
const MAX = 110
/** pull down from the top of the page, let go, and it brings the newest — sending what's waiting first */
export function PullToRefresh() {
  const [y, setY] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const start = React.useRef<number | null>(null)
  const pull = React.useRef(0)
  /* back from a refresh: say it worked */
  React.useEffect(() => {
    let back = false
    try { back = sessionStorage.getItem(REFRESHED) === '1'; sessionStorage.removeItem(REFRESHED) } catch { /* private window — nothing to say */ }
    if (back) setTimeout(() => showPop({ title: 'Up to date', sub: 'Refreshed — you’re seeing the newest.', tone: 'ok' }), 400)
  }, [])
  React.useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return
    const scrolledParent = (t: EventTarget | null) => {
      for (let el = t instanceof Element ? t : null; el && el !== document.body; el = el.parentElement) {
        if (el.closest('[role="dialog"],[data-no-pull]')) return true
        if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) return true
      }
      return false
    }
    const down = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1 || window.scrollY > 0 || useStore.getState().modals.length || scrolledParent(e.target)) { start.current = null; return }
      start.current = e.touches[0].clientY
    }
    const move = (e: TouchEvent) => {
      if (start.current == null) return
      const dy = e.touches[0].clientY - start.current
      if (dy <= 0 || window.scrollY > 0) { if (pull.current) { pull.current = 0; setY(0) } return }
      pull.current = Math.min(MAX, dy * 0.5)
      setY(pull.current)
    }
    const up = () => {
      if (start.current == null) return
      start.current = null
      const far = pull.current
      pull.current = 0
      if (far < PULL) { setY(0); return }
      setBusy(true)
      setY(56)
      const t0 = Date.now()
      /* with signal: what's waiting goes up first, then the app opens again fresh — the newest version and the newest
         data. With no signal: nothing to reload — it keeps working from the phone */
      void (REAL.cloud && REAL.refresh ? REAL.refresh() : Promise.resolve('none' as const)).then((r) => {
        if (r === 'ok' && navigator.onLine) {
          try { sessionStorage.setItem(REFRESHED, '1') } catch { /* it still refreshes */ }
          location.reload()
          return
        }
        const wait = Math.max(0, 700 - (Date.now() - t0))
        setTimeout(() => {
          setBusy(false)
          setY(0)
          if (r === 'offline') showPop({ title: 'No signal', sub: OFFLINE_WORDS, tone: 'warn' })
          else showPop({ title: 'Up to date', sub: 'Refreshed — you’re seeing the newest.', tone: 'ok' })
        }, wait)
      })
    }
    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', up)
    window.addEventListener('touchcancel', up)
    return () => {
      window.removeEventListener('touchstart', down)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
      window.removeEventListener('touchcancel', up)
    }
  }, [busy])
  if (!y && !busy) return null
  const ready = y >= PULL || busy
  return (
    <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center lg:hidden" style={{ top: `calc(env(safe-area-inset-top, 0px) + ${Math.round(y)}px)` }} data-pull-refresh>
      <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_0.25rem_1rem_rgba(16,24,40,.16)] ring-1 ring-black/5', ready ? 'text-brand-600' : 'text-muted')}>
        <RefreshCw className={cn('h-5 w-5', busy && 'animate-spin')} style={busy ? undefined : { transform: `rotate(${Math.round(y * 3)}deg)` }} />
      </span>
    </div>
  )
}
