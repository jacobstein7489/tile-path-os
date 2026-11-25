/* A star on a to-do — the ones that matter to you go on top of your list (Today, Coming up, Waiting on others), in
 * Starred. Yours only: nobody else's list changes. Tap it again and it goes back where it was.
 * On a computer the star is right on the line, at its left edge: it shows when you point at a line, and stays on a
 * starred one. A phone shows it on a starred line; you star one from its window (the star at its top). */
import * as React from 'react'
import { Star } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { cn } from '@/tileos/lib/utils'
import type { PersonKey } from '@/tileos/data/model'

const S = () => useStore.getState()
export const starredBy = (stars: PersonKey[] | undefined, me: PersonKey | null | undefined) => !!me && !!stars?.includes(me)
const flip = (cur: PersonKey[] | undefined, me: PersonKey) => {
  const next = cur?.includes(me) ? cur.filter((p) => p !== me) : [...(cur || []), me]
  return next.length ? next : undefined
}

/** star a task, or take the star off — just for you; nothing pops up */
export function toggleTaskStar(id: string) {
  const me = meOf(S().role)
  S().commit((st) => {
    const t = st.tasks.find((x) => x.id === id)
    if (!t) return
    const next = flip(t.stars, me)
    if (next) t.stars = next
    else delete t.stars
  }, undefined, { undo: false })
}
/** the same for a project's step */
export function toggleStepStar(jobId: string, key: string) {
  const me = meOf(S().role)
  S().commit((st) => {
    const r = ((st.stepRecs[jobId] ||= {})[key] ||= {})
    const next = flip(r.stars, me)
    if (next) r.stars = next
    else delete r.stars
  }, undefined, { undo: false })
}

export type StarPick = { on: boolean; toggle: () => void }
export const STAR_GOLD = 'text-[#e2a21b]'

/** the star at the left edge of a line — in the margin, so nothing on the line moves. A computer: it shows when you
 *  point at the line; gold when it's starred. A phone: only on a starred line */
export function RowStar({ star }: { star: StarPick }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); star.toggle() }}
      onKeyDown={(e) => e.stopPropagation()}
      aria-pressed={star.on}
      aria-label={star.on ? 'Starred. Take the star off' : 'Star it. It goes on top'}
      title={star.on ? 'Starred. Tap to take it off' : 'Star it. It goes on top'}
      data-row-star={star.on ? '1' : '0'}
      className={cn(
        'absolute left-0 top-1/2 z-[1] inline-flex h-8 w-4 -translate-y-1/2 items-center justify-center transition md:w-5',
        star.on ? STAR_GOLD : 'text-[#c4bcae] opacity-0 hover:text-[#8f8679] focus-visible:opacity-100 max-md:pointer-events-none md:group-hover/row:opacity-100',
      )}
    >
      <Star className="h-4 w-4 md:h-3.5 md:w-3.5" fill={star.on ? 'currentColor' : 'none'} strokeWidth={star.on ? 1.5 : 2} />
    </button>
  )
}

/** the star at the top of a to-do's window — star it from here too (a phone stars it here) */
export function WinStar({ star }: { star: StarPick }) {
  return (
    <button
      type="button"
      onClick={star.toggle}
      aria-pressed={star.on}
      aria-label={star.on ? 'Starred. Take the star off' : 'Star it. It goes on top of your list'}
      title={star.on ? 'Starred. On top of your list. Tap to take it off' : 'Star it. It goes on top of your list'}
      data-win-star={star.on ? '1' : '0'}
      className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] font-medium transition hover:bg-wash-2 max-sm:w-8 max-sm:justify-center max-sm:px-0', star.on ? cn(STAR_GOLD, 'bg-[#fdf5e3]') : 'text-muted hover:text-ink-2')}
    >
      <Star className="h-4 w-4" fill={star.on ? 'currentColor' : 'none'} strokeWidth={star.on ? 1.5 : 1.75} />
      {/* a phone: the star alone (the top line stays one line) */}
      <span className="max-sm:hidden">{star.on ? 'Starred' : 'Star'}</span>
    </button>
  )
}
