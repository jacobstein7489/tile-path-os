/* Talk instead of typing: a small mic in every note box (and in the boxes where you name a task). Tap it, talk, tap
 * again — what you said goes into the box. It works where the browser can listen (Chrome, Edge, Safari, phones);
 * where it can't, the mic doesn't show. */
import * as React from 'react'
import { Mic as MicIcon, Square } from 'lucide-react'
import { cn } from '@/tileos/lib/utils'

const SR = (): any => (typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined)
/** the browser can listen */
export const canListen = () => { try { return !!SR() } catch { return false } }
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function Mic({ onText, className, size = 'md', label = 'Talk instead of typing' }: { onText: (t: string) => void; className?: string; size?: 'sm' | 'md'; label?: string }) {
  const [on, setOn] = React.useState(false)
  const [msg, setMsg] = React.useState('')
  const rec = React.useRef<any>(null)
  const said = React.useRef(onText)
  said.current = onText
  React.useEffect(() => () => { try { rec.current?.abort?.() } catch { /* gone */ } }, [])
  React.useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 3500); return () => clearTimeout(t) }, [msg])
  if (!canListen()) return null
  const start = () => {
    const R = SR()
    if (!R) return
    const r = new R()
    r.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
    r.interimResults = false
    r.continuous = true
    r.maxAlternatives = 1
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue
        const t = String(e.results[i][0]?.transcript || '').trim()
        if (t) said.current(cap(t))
      }
    }
    r.onerror = (e: any) => {
      setOn(false)
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') setMsg('Allow the microphone for this page')
      else if (e?.error && e.error !== 'aborted' && e.error !== 'no-speech') setMsg('Couldn’t hear that — try again')
    }
    r.onend = () => setOn(false)
    try { r.start(); rec.current = r; setOn(true) } catch { setOn(false) }
  }
  const stop = () => { try { rec.current?.stop?.() } catch { /* already stopped */ } setOn(false) }
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <button
        type="button"
        aria-label={on ? 'Stop listening' : label}
        aria-pressed={on}
        title={on ? 'Listening — tap to stop' : label}
        onClick={on ? stop : start}
        className={cn('inline-flex items-center justify-center rounded-full border transition', size === 'sm' ? 'h-8 w-8' : 'h-10 w-10', on ? 'animate-pulse border-bad-500 bg-bad-500 text-white' : 'border-line bg-white text-muted hover:border-brand-300 hover:text-brand-600')}
      >
        {on ? <Square className="h-3 w-3 fill-current" /> : <MicIcon className="h-4 w-4" />}
      </button>
      {(on || msg) && <span role="status" className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[0.71875rem] font-medium text-white shadow-pop">{msg || 'Listening… tap to stop'}</span>}
    </span>
  )
}

/** add what was said to what's already in the box */
export const addSaid = (was: string | undefined, t: string) => (was && was.trim() ? `${was.replace(/\s+$/, '')} ${t}` : t)
