/* Talk instead of typing: a small mic in every note box (and in the boxes where you name a task). Tap it, talk, tap
 * again — what you said goes into the box. It works where the browser can listen (Chrome, Edge, Safari, phones);
 * where it can't, the mic doesn't show. */
import * as React from 'react'
import { Mic as MicIcon, Square } from 'lucide-react'
import { cn } from '@/tileos/lib/utils'
import { useVoice, canListen } from './voice'

/** the browser can listen (or record, for the AI to write down) */
export { canListen }
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function Mic({ onText, className, size = 'md', label = 'Talk instead of typing' }: { onText: (t: string) => void; className?: string; size?: 'sm' | 'md'; label?: string }) {
  const v = useVoice((t) => onText(cap(t)))
  const [msg, setMsg] = React.useState('')
  React.useEffect(() => { if (v.err) setMsg(v.err) }, [v.err])
  React.useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 7000); return () => clearTimeout(t) }, [msg])
  if (!v.can) return null
  const say = msg || (v.busy ? 'Writing it down…' : v.on ? (v.quiet ? 'I don’t hear anything — is the mic on?' : v.hearing || 'Listening… tap to stop') : '')
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <button
        type="button"
        aria-label={v.on ? 'Stop listening' : label}
        aria-pressed={v.on}
        title={v.on ? 'Listening — tap to stop' : label}
        disabled={v.busy}
        onClick={v.on ? v.stop : () => { setMsg(''); v.start() }}
        className={cn('inline-flex items-center justify-center rounded-full border transition', size === 'sm' ? 'h-8 w-8' : 'h-10 w-10', v.on ? 'border-bad-500 bg-bad-500 text-white' : v.busy ? 'animate-pulse border-brand-300 bg-brand-50 text-brand-600' : 'border-line bg-white text-muted hover:border-brand-300 hover:text-brand-600')}
        style={v.on ? { boxShadow: `0 0 0 ${Math.round(2 + v.level * 7)}px rgba(239, 68, 68, ${0.12 + v.level * 0.25})` } : undefined}
        data-mic={v.on ? 'on' : v.busy ? 'busy' : 'off'}
      >
        {v.on ? <Square className="h-3 w-3 fill-current" /> : <MicIcon className="h-4 w-4" />}
      </button>
      {say && <span role="status" className="pointer-events-none absolute bottom-full right-0 z-10 mb-1.5 w-max max-w-[18rem] rounded-md bg-ink px-2 py-1 text-[0.71875rem] font-medium leading-snug text-white shadow-pop">{say}</span>}
    </span>
  )
}

/** add what was said to what's already in the box */
export const addSaid = (was: string | undefined, t: string) => (was && was.trim() ? `${was.replace(/\s+$/, '')} ${t}` : t)
