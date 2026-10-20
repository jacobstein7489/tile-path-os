/* The center pop-up: what just happened, and where the work went next.
 * Replaces the little corner toasts. Closes by itself; hover keeps it; Undo when it can be undone. */
import * as React from 'react'
import { create } from 'zustand'
import { Check, Undo2, ArrowRight, Building2 } from 'lucide-react'
import { Avatar } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'

export type FlowStep = { who?: PersonKey; label: string; state: 'done' | 'now' | 'next'; outside?: string }
export type PopData = { id: number; title: string; sub?: string; flow?: FlowStep[]; to?: { who: PersonKey; what: string }[]; undo?: () => void; tone?: 'ok' | 'warn' | 'done' }
type PopStore = { pop: PopData | null; show: (p: Omit<PopData, 'id'>) => void; hide: () => void }
let pid = 0
export const usePop = create<PopStore>((set) => ({
  pop: null,
  show: (p) => set({ pop: { ...p, id: ++pid } }),
  hide: () => set({ pop: null }),
}))
export const showPop = (p: Omit<PopData, 'id'>) => usePop.getState().show(p)

/** drop-in for the old toast calls */
type Opts = { action?: { label: string; onClick: () => void }; description?: string }
export const toast = Object.assign((msg: string, o?: Opts) => showPop({ title: msg, sub: o?.description }), {
  success: (msg: string, o?: Opts) => showPop({ title: msg, sub: o?.description, undo: o?.action?.onClick }),
  error: (msg: string) => showPop({ title: msg, tone: 'warn' }),
})

if (typeof window !== 'undefined') (window as any).__pop = usePop

export function CenterPop() {
  const { pop, hide } = usePop()
  const [hover, setHover] = React.useState(false)
  const card = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!pop || hover) return
    const t = setTimeout(hide, pop.flow || pop.to ? 4200 : 2600)
    return () => clearTimeout(t)
  }, [pop, hover])
  /* a click anywhere else closes it (and still does what it was meant to do underneath) */
  React.useEffect(() => {
    if (!pop) return
    const f = (e: PointerEvent) => { if (card.current && !card.current.contains(e.target as Node)) { setHover(false); hide() } }
    document.addEventListener('pointerdown', f, true)
    return () => document.removeEventListener('pointerdown', f, true)
  }, [pop])
  if (!pop) return null
  const long = pop.flow || pop.to
  return (
    <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center p-5">
      <div
        key={pop.id}
        ref={card}
        role="status"
        aria-live="polite"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cn('pointer-events-auto relative w-full overflow-hidden rounded-[1.375rem] bg-white text-center shadow-[0_1.5rem_4.375rem_-1.125rem_rgba(16,24,40,.45),0_0_0_0.0625rem_rgba(16,24,40,.06)] animate-modal-in', long ? 'max-w-[30rem]' : 'max-w-[23.75rem]')}
      >
        <div className="px-7 pb-5 pt-6">
          {pop.tone === 'done' ? (
            /* something got finished: the check lands with a bounce, a ring spreads, a few sparks fly */
            <span className="relative mx-auto block h-16 w-16">
              <span className="cheer-ring absolute inset-0 rounded-full bg-ok-500/30" />
              <span className="cheer-ring absolute inset-0 rounded-full bg-ok-500/20" style={{ animationDelay: '120ms' }} />
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className="cheer-spark absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full" style={{ ['--a' as any]: `${i * 45}deg`, background: ['#12b76a', '#2650cf', '#f0b429', '#e05d4b'][i % 4] }} />
              ))}
              <span className="cheer-check absolute inset-0 inline-flex items-center justify-center rounded-full bg-ok-500 text-white shadow-[0_0.5rem_1.25rem_-0.375rem_rgba(18,183,106,.6)]">
                <Check className="h-8 w-8" strokeWidth={3.5} />
              </span>
            </span>
          ) : (
            <span className={cn('mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full', pop.tone === 'warn' ? 'bg-warn-50 text-warn-600' : 'bg-ok-50 text-ok-600')}>
              <Check className="h-6 w-6" strokeWidth={3} />
            </span>
          )}
          <div className={cn('mt-3 font-bold leading-snug tracking-[-0.01em] text-ink', pop.tone === 'done' ? 'text-[1.375rem]' : 'text-[1.0625rem]')}>{pop.title}</div>
          {pop.sub && <div className="mx-auto mt-1 max-w-[23.75rem] text-[0.875rem] leading-snug text-muted">{pop.sub}</div>}
          {pop.flow && (
            <div className="mt-5 flex items-start justify-center">
              {pop.flow.map((f, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className={cn('mt-[1.0625rem] h-[0.125rem] min-w-[1.125rem] flex-1 rounded-full', pop.flow![i - 1].state === 'done' ? 'bg-ok-500' : 'bg-line')} />}
                  <span className="flex w-[4.875rem] shrink-0 flex-col items-center gap-1.5">
                    <span className={cn('relative rounded-full', f.state === 'now' && 'ring-[0.1875rem] ring-brand-500 ring-offset-2')}>
                      {f.who ? <Avatar who={f.who} size={36} /> : <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-wash-2 text-ink-2"><Building2 className="h-4 w-4" /></span>}
                      {f.state === 'done' && <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-ok-500 text-white ring-2 ring-white"><Check className="h-2.5 w-2.5" strokeWidth={3.4} /></span>}
                    </span>
                    <span className={cn('text-[0.75rem] font-semibold leading-tight', f.state === 'now' ? 'text-brand-700' : f.state === 'done' ? 'text-ink-2' : 'text-faint')}>{f.label}</span>
                    {f.state === 'now' && <span className="text-[0.71875rem] font-semibold text-brand-600">Now</span>}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
          {pop.to && (
            <div className="mt-4 flex flex-col gap-1.5 text-left">
              {pop.to.map((t, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-wash px-3 py-2">
                  <Avatar who={t.who} size={28} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[0.75rem] font-semibold text-muted">{PEOPLE[t.who]?.name}</span>
                    <span className="block truncate text-[0.84375rem] font-medium text-ink">{t.what}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-faint" />
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-center justify-center gap-2">
            {pop.undo && (
              <button onClick={() => { pop.undo!(); hide() }} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[0.84375rem] font-semibold text-muted hover:bg-wash-2 hover:text-ink"><Undo2 className="h-4 w-4" />Undo</button>
            )}
            <button onClick={hide} className="inline-flex h-9 min-w-[5.75rem] items-center justify-center rounded-xl bg-ink px-4 text-[0.84375rem] font-semibold text-white hover:bg-[#1d2433]">OK</button>
          </div>
        </div>
        {!hover && <span key={'bar' + pop.id} className="absolute bottom-0 left-0 h-[0.1875rem] bg-brand-500/70" style={{ animation: `popbar ${long ? 4.2 : 2.6}s linear forwards` }} />}
      </div>
    </div>
  )
}
