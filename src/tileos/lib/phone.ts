/* Screen-size checks for the few places a phone gets a different layout, not just smaller spacing. */
import * as React from 'react'

/** whether the screen matches a media query — kept up to date as it turns or resizes */
export function useMedia(q: string) {
  const [on, setOn] = React.useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false))
  React.useEffect(() => {
    const mq = window.matchMedia(q)
    const f = () => setOn(mq.matches)
    f()
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [q])
  return on
}
/** a phone, or a narrow window — the same width as the max-md: styles */
export const usePhone = () => useMedia('(max-width: 767.98px)')
/** a phone held upright — the same width as the max-sm: styles */
export const useSmall = () => useMedia('(max-width: 639.98px)')
