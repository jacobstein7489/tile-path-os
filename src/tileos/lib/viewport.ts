/* The phone's keyboard. When it comes up, what's left of the screen is smaller — and iOS doesn't shrink the page, it
 * slides it up under the keyboard, taking the bar on top with it. This keeps what's on screen where it belongs: the
 * visible height and where it starts (--vvh, --vvt), and a class on the page while the keyboard is up (kb-open) — the
 * bar on top stays on top, a window sits right above the keyboard, the tabs at the bottom step aside. */
let on = false
export function watchKeyboard() {
  if (on || typeof window === 'undefined' || !window.visualViewport) return
  on = true
  const vv = window.visualViewport
  const root = document.documentElement
  const touch = window.matchMedia?.('(pointer: coarse)')
  /* the full height, before any keyboard (Android shrinks the page itself; iOS doesn't) */
  let full = window.innerHeight
  let raf = 0
  const set = () => {
    raf = 0
    full = Math.max(full, window.innerHeight)
    const h = vv.height
    root.style.setProperty('--vvh', `${Math.round(h)}px`)
    root.style.setProperty('--vvt', `${Math.max(0, Math.round(vv.offsetTop))}px`)
    /* the keyboard is up: much less screen than before, on a phone or a tablet, with a box being typed in */
    const typing = !!document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')
    root.classList.toggle('kb-open', !!touch?.matches && typing && full - h > 140)
  }
  const later = () => { if (!raf) raf = requestAnimationFrame(set) }
  vv.addEventListener('resize', later)
  vv.addEventListener('scroll', later)
  window.addEventListener('resize', later)
  window.addEventListener('orientationchange', () => { full = 0; setTimeout(set, 350) })
  document.addEventListener('focusin', () => setTimeout(set, 60))
  document.addEventListener('focusout', () => setTimeout(set, 120))
  /* a box that gets focus inside a window: once the keyboard is up, scroll it into view inside the window */
  document.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement | null
    if (!touch?.matches || !el?.matches?.('input, textarea, select') || !el.closest('[role="dialog"]')) return
    setTimeout(() => { try { el.scrollIntoView({ block: 'nearest' }) } catch { /* old browsers */ } }, 320)
  })
  set()
}
