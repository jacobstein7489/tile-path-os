/* A star on a project — tap it and the project goes on top of the list (Projects, Set up projects), in Starred. Each
 * person their own: your stars are yours. Tap it again and it goes back where it was. */
import * as React from 'react'
import { Star } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { cn } from '@/tileos/lib/utils'
import type { Job, PersonKey } from '@/tileos/data/model'

export const isStarred = (j: Pick<Job, 'stars'>, me: PersonKey) => !!j.stars?.includes(me)

/** star it, or take the star off — just for you; nothing to undo, nothing pops up */
export function toggleStar(jobId: string) {
  const s = useStore.getState()
  const me = meOf(s.role)
  s.commit((st) => {
    const j = st.jobs[jobId]
    if (!j) return
    const next = j.stars?.includes(me) ? j.stars.filter((p) => p !== me) : [...(j.stars || []), me]
    if (next.length) j.stars = next
    else delete j.stars
  }, undefined, { undo: false })
}

/** the star on a project's line — gray till it's starred, then gold. Tapping it doesn't open the project */
export function StarButton({ j, className }: { j: Job; className?: string }) {
  const s = useStore()
  const on = isStarred(j, meOf(s.role))
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Starred — take the star off ${j.name}` : `Star ${j.name} — it goes on top`}
      title={on ? 'Starred — tap to take it off' : 'Star it — it goes on top'}
      onClick={(e) => { e.stopPropagation(); toggleStar(j.id) }}
      onKeyDown={(e) => e.stopPropagation()}
      data-star={on ? '1' : '0'}
      className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-[#f1ece3]', on ? 'text-[#e2a21b]' : 'text-[#cfc8bc] hover:text-[#9a9184]', className)}
    >
      <Star className="h-[1.125rem] w-[1.125rem]" fill={on ? 'currentColor' : 'none'} strokeWidth={on ? 1.5 : 1.75} />
    </button>
  )
}
