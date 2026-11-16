/* Reading something you uploaded — an estimate, the tile paperwork — so you can see it's going:
 *   the card, where you uploaded it: what it's reading, the page it's on, a bar that keeps moving, and Stop. Leave and
 *     come back — it's still there (lib/reading keeps it outside the window).
 *   the bar on top of every screen while anything is being read: a thin line across the top, and on a page (no window
 *     open) a small pill that says what's being read — tap it to go to the project. */
import * as React from 'react'
import { Loader2, X, CircleAlert, RotateCw } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { useReading, pctOf, wordsOf, endReading, type Reading, type ReadKind } from '@/tileos/lib/reading'
import { updateReady, watchUpdateReady } from '@/tileos/lib/device'

const WHAT: Record<ReadKind, string> = { estimate: 'the estimate', paperwork: 'the tile paperwork' }

/** a re-render every half second while something's being read — the bar creeps on between steps */
function useTick(on: boolean) {
  const [, set] = React.useState(0)
  React.useEffect(() => {
    if (!on) return
    const t = setInterval(() => set((n) => n + 1), 500)
    return () => clearInterval(t)
  }, [on])
}

/** the card where it was uploaded: what it's reading, where it is, the bar — or why it couldn't */
export function ReadingCard({ r, onStop, onRetry, className }: { r: Reading; onStop?: () => void; /** it failed: try again */ onRetry?: () => void; className?: string }) {
  useTick(!r.failed)
  if (r.failed) return (
    <div className={cn('flex items-start gap-3 rounded-xl border border-bad-100 bg-bad-50 px-4 py-3.5', className)} role="alert" data-reading-failed={r.kind}>
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-bad-600" />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.90625rem] font-semibold text-ink">Couldn’t read {WHAT[r.kind]}</span>
        <span className="block text-[0.8125rem] text-ink-2">{r.failed}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {onRetry && <Button size="sm" icon={<RotateCw />} onClick={onRetry}>Try again</Button>}
        <Button size="sm" variant="ghost" icon={<X />} aria-label="Put it away" onClick={() => endReading(r.kind, r.jobId)} />
      </span>
    </div>
  )
  const pct = pctOf(r)
  return (
    <div className={cn('rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-3.5', className)} role="status" aria-live="polite" data-reading={r.kind} data-reading-pct={pct}>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-xs"><Loader2 className="h-5 w-5 animate-spin" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold text-ink">Reading {WHAT[r.kind]}…</span>
          <span className="block truncate text-[0.8125rem] text-ink-2" data-reading-words>{wordsOf(r)} · {r.file}</span>
        </span>
        {onStop && <Button size="sm" variant="ghost" icon={<X />} onClick={onStop} data-reading-stop>Stop</Button>}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white">
          <span className="block h-full rounded-full bg-brand-600 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </span>
        <span className="w-10 shrink-0 text-right text-[0.8125rem] font-semibold tnum text-brand-700">{pct}%</span>
      </div>
      <div className="mt-1.5 text-[0.78125rem] text-muted">You can leave — it keeps going, and it’s here when you come back.</div>
    </div>
  )
}

/** on top of every screen while something's being read: a thin line across the top — and, on a page, a pill saying
 *  what (tap it: the project, where it's being read) */
export function ReadingBar() {
  const s = useStore()
  const all = useReading((x) => x.by)
  const going = Object.values(all).filter((r) => !r.failed)
  useTick(going.length > 0)
  const update = React.useSyncExternalStore(watchUpdateReady, updateReady, () => false)
  if (!going.length) return null
  const r = going[0]
  const pct = Math.round(going.reduce((n, x) => n + pctOf(x), 0) / going.length)
  const job = s.jobs[r.jobId]
  const onPage = s.modals.length === 0
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-[250] h-[0.1875rem] bg-brand-100/70" aria-hidden data-reading-line>
        <div className="h-full bg-brand-600 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
      {onPage && (
        <button
          type="button"
          onClick={() => s.open({ t: 'job', id: r.jobId, tab: r.kind === 'estimate' ? 'scope' : 'tiles' })}
          data-reading-pill
          className={cn('fixed left-1/2 z-[45] inline-flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-brand-100 bg-white py-2 pl-3 pr-4 text-[0.875rem] font-semibold text-ink shadow-[0_0.5rem_1.5rem_-0.5rem_rgba(17,19,24,.35)]', update ? 'top-[calc(env(safe-area-inset-top,0px)+7.5rem)] lg:top-[4.25rem]' : 'top-[calc(env(safe-area-inset-top,0px)+4.25rem)] lg:top-4')}
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-600" />
          <span className="min-w-0 truncate">Reading {WHAT[r.kind]}{job ? ` · ${job.name}` : ''}{going.length > 1 ? ` and ${going.length - 1} more` : ''}</span>
          <span className="shrink-0 tnum text-brand-700">{pct}%</span>
        </button>
      )}
    </>
  )
}
