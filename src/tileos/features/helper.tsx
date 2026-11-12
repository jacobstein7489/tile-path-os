/* Say it's helper — a little robot whose head is one of our blue tiles. Drawn here, in a few shapes — no pictures
 * to load. It floats and blinks while it waits; while you talk its eyes open wide and the light on top pulses; it
 * looks up while it thinks; and when the list is ready it smiles, hops and opens its arms. */
import * as React from 'react'
import { cn } from '@/tileos/lib/utils'

export type HelperMood = 'idle' | 'listening' | 'thinking' | 'happy'

export function Helper({ size = 48, mood = 'idle', className }: { size?: number; mood?: HelperMood; className?: string }) {
  const id = React.useId().replace(/:/g, '')
  const lit = '#8ff0ff'
  /* arms hang a little out; open wide when it's happy */
  const arm = mood === 'happy' ? 100 : 16
  return (
    <span className={cn('inline-flex shrink-0', mood === 'listening' ? 'helper-bob-fast' : mood === 'happy' ? 'helper-hop' : 'helper-bob', className)} style={{ width: size, height: size }} aria-hidden data-helper={mood}>
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id={`${id}-head`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#7aa5ff" />
            <stop offset="1" stopColor="#2f5fe0" />
          </linearGradient>
          <linearGradient id={`${id}-screen`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1c2541" />
            <stop offset="1" stopColor="#121830" />
          </linearGradient>
          <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e3e8f5" />
          </linearGradient>
          <radialGradient id={`${id}-light`}>
            <stop offset="0" stopColor="#ffe27a" />
            <stop offset="1" stopColor="#ffb81f" />
          </radialGradient>
        </defs>
        {/* its shadow, a little below — it floats */}
        <ellipse cx="32" cy="61" rx="13" ry="2" fill="#2b2a33" opacity="0.1" />
        {/* the light on top — it pulses while it listens */}
        <path d="M32 13.5V8.6" stroke="#8aa3d8" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="32" cy="7.2" r="2.7" fill={`url(#${id}-light)`} stroke="#d99a0e" strokeWidth="0.9" className={mood === 'listening' ? 'helper-glow' : undefined} />
        {/* arms, then the body */}
        <rect x="19.5" y="47.5" width="5" height="8.5" rx="2.5" fill={`url(#${id}-body)`} stroke="#b9c3dc" strokeWidth="1" transform={`rotate(${arm} 22 48.5)`} />
        <rect x="39.5" y="47.5" width="5" height="8.5" rx="2.5" fill={`url(#${id}-body)`} stroke="#b9c3dc" strokeWidth="1" transform={`rotate(${-arm} 42 48.5)`} />
        <rect x="23" y="45" width="18" height="13" rx="5.5" fill={`url(#${id}-body)`} stroke="#b9c3dc" strokeWidth="1.1" />
        <circle cx="32" cy="51.5" r="2.1" fill="#4f82ff" />
        {/* ears */}
        <rect x="10.4" y="25.5" width="4.4" height="9" rx="2" fill="#c7d4f6" stroke="#8aa3d8" strokeWidth="1" />
        <rect x="49.2" y="25.5" width="4.4" height="9" rx="2" fill="#c7d4f6" stroke="#8aa3d8" strokeWidth="1" />
        {/* the head: one of our tiles, with a shine — and its screen */}
        <rect x="13.5" y="13" width="37" height="33" rx="10" fill={`url(#${id}-head)`} stroke="#2448b8" strokeWidth="1.1" />
        <path d="M18.5 17.6c2-1.6 4.4-2.4 7.4-2.4" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
        <rect x="18.5" y="20" width="27" height="20" rx="7" fill={`url(#${id}-screen)`} />
        {/* eyes: happy ^ ^, wide while it listens, up and over while it thinks, otherwise two that blink */}
        {mood === 'happy' ? (
          <g fill="none" stroke={lit} strokeWidth="2" strokeLinecap="round">
            <path d="M23.6 30q2.7-3.6 5.4 0" />
            <path d="M35 30q2.7-3.6 5.4 0" />
          </g>
        ) : mood === 'listening' ? (
          <g className="helper-blink">
            <circle cx="26.3" cy="28.2" r="3.3" fill={lit} />
            <circle cx="37.7" cy="28.2" r="3.3" fill={lit} />
          </g>
        ) : mood === 'thinking' ? (
          <g>
            <rect x="26" y="23.4" width="4.6" height="5.6" rx="2.3" fill={lit} />
            <rect x="37.4" y="23.4" width="4.6" height="5.6" rx="2.3" fill={lit} />
          </g>
        ) : (
          <g className="helper-blink">
            <rect x="24" y="24.4" width="4.6" height="7.6" rx="2.3" fill={lit} />
            <rect x="35.4" y="24.4" width="4.6" height="7.6" rx="2.3" fill={lit} />
          </g>
        )}
        {/* mouth: a smile; an "oh" while it listens; a small line while it thinks */}
        {mood === 'listening' ? <ellipse cx="32" cy="35.3" rx="1.8" ry="1.6" fill={lit} />
          : mood === 'thinking' ? <path d="M30 35.2h4" stroke={lit} strokeWidth="1.6" strokeLinecap="round" />
            : <path d={mood === 'happy' ? 'M28.4 33.8q3.6 3.6 7.2 0' : 'M29.4 34.6q2.6 2.4 5.2 0'} fill="none" stroke={lit} strokeWidth="1.6" strokeLinecap="round" />}
        {/* cheeks */}
        <ellipse cx="22.2" cy="35.2" rx="2.2" ry="1.3" fill="#ff8fb0" opacity="0.5" />
        <ellipse cx="41.8" cy="35.2" rx="2.2" ry="1.3" fill="#ff8fb0" opacity="0.5" />
      </svg>
    </span>
  )
}

/** "Listening…" with the sound moving */
export function Listening({ className }: { className?: string }) {
  const bars = [0.55, 0.2, 0.75, 0.35, 0.6, 0.1, 0.45]
  return (
    <span className={cn('flex items-center gap-2.5 text-[0.875rem] font-semibold text-bad-600', className)} role="status" data-listening>
      <span className="say-wave flex h-6 items-center gap-[3px]" aria-hidden>
        {bars.map((d, i) => <span key={i} className="block h-6 w-[3px] rounded-full bg-bad-500" style={{ animationDelay: `-${d}s`, animationDuration: `${0.75 + (i % 3) * 0.18}s` }} />)}
      </span>
      Listening…
    </span>
  )
}
