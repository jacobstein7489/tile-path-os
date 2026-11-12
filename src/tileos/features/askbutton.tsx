/* The helper, on every page: bottom right, always there. Tap it and talk (or type) — it makes the tasks, and it
 * answers what you ask ("where does the drain at 114 stand?", "what's Yaakov late on?"). On a phone it sits just
 * above the bottom bar. Never in the way: while a window is open it steps aside, and the Messages page (where you type
 * at the bottom) doesn't have it. */
import * as React from 'react'
import { useStore } from '@/tileos/store'
import { Helper } from './helper'

export function AskButton() {
  const open = useStore((s) => s.open)
  const busy = useStore((s) => s.modals.length > 0)
  const page = useStore((s) => s.route.page)
  if (busy || page === 'inbox') return null
  return (
    <button
      type="button"
      onClick={() => open({ t: 'capture', listen: true })}
      aria-label="Talk to Tile OS — ask, or say what’s going on"
      title="Ask me, or tell me what’s going on"
      data-ask-button
      className="fixed bottom-6 right-6 z-30 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_0.75rem_1.75rem_-0.625rem_rgba(38,80,207,.55),0_0_0_0.0625rem_rgba(38,80,207,.14)] transition hover:-translate-y-0.5 hover:shadow-[0_1rem_2rem_-0.625rem_rgba(38,80,207,.6),0_0_0_0.0625rem_rgba(38,80,207,.2)] active:scale-95 max-lg:bottom-[calc(4.375rem+env(safe-area-inset-bottom,0px)+0.75rem)] max-lg:right-4 max-lg:h-14 max-lg:w-14"
    >
      <Helper size={46} mood="idle" />
    </button>
  )
}
