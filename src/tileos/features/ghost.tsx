/* The little ghost who listens — Tile OS's own helper on Say it. It floats and blinks while it waits, perks up while
 * you talk (an "oh" and big eyes), looks up while it thinks, and smiles when the list is ready.
 * Drawn here, in a few shapes — no pictures to load. */
import * as React from 'react'
import { cn } from '@/tileos/lib/utils'

export type GhostMood = 'idle' | 'listening' | 'thinking' | 'happy'

export function Ghost({ size = 48, mood = 'idle', className }: { size?: number; mood?: GhostMood; className?: string }) {
  const id = React.useId().replace(/:/g, '')
  const ink = '#2b2a33'
  /* where the eyes look: up and to the side while it thinks */
  const look = mood === 'thinking' ? { x: 1.6, y: -1.8 } : { x: 0, y: 0 }
  const eyeRy = mood === 'listening' ? 3.9 : 3.3
  return (
    <span className={cn('inline-flex shrink-0', mood === 'listening' ? 'helper-bob-fast' : 'helper-bob', className)} style={{ width: size, height: size }} aria-hidden data-helper={mood}>
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id={`${id}-body`} x1="0.25" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#f6f4fb" />
            <stop offset="1" stopColor="#e6e1f2" />
          </linearGradient>
        </defs>
        {/* its shadow, a little below — it floats */}
        <ellipse cx="32" cy="59.5" rx="13" ry="2.2" fill="#2b2a33" opacity="0.09" />
        {/* little arms */}
        <ellipse cx="13.6" cy="35.5" rx="3.4" ry="2.3" transform="rotate(-28 13.6 35.5)" fill={`url(#${id}-body)`} stroke="#c9c2dc" strokeWidth="1.2" />
        <ellipse cx="50.4" cy="35.5" rx="3.4" ry="2.3" transform={mood === 'happy' ? 'rotate(-38 50.4 33)' : 'rotate(28 50.4 35.5)'} fill={`url(#${id}-body)`} stroke="#c9c2dc" strokeWidth="1.2" />
        {/* the body: a round top and a wavy hem */}
        <path d="M15 31.5C15 19.6 22.6 10 32 10s17 9.6 17 21.5V48.5q-2.1 4.6-4.25 0t-4.25 0q-2.1 4.6-4.25 0t-4.25 0q-2.1 4.6-4.25 0t-4.25 0q-2.1 4.6-4.25 0t-4.25 0z" fill={`url(#${id}-body)`} stroke="#c9c2dc" strokeWidth="1.3" strokeLinejoin="round" />
        {/* a soft shine on its head */}
        <path d="M21.5 20.5c2.2-3.6 5.6-5.6 9.4-6" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
        {/* cheeks */}
        <ellipse cx="22" cy="36.2" rx="3.2" ry="2" fill="#f4a3b4" opacity="0.45" />
        <ellipse cx="42" cy="36.2" rx="3.2" ry="2" fill="#f4a3b4" opacity="0.45" />
        {/* eyes: happy ^ ^, or round (they blink) */}
        {mood === 'happy' ? (
          <g fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round">
            <path d="M23.4 30.6q2.9-3.4 5.8 0" />
            <path d="M34.8 30.6q2.9-3.4 5.8 0" />
          </g>
        ) : (
          <g className="helper-blink">
            <ellipse cx={26.3 + look.x} cy={29 + look.y} rx="2.8" ry={eyeRy} fill={ink} />
            <ellipse cx={37.7 + look.x} cy={29 + look.y} rx="2.8" ry={eyeRy} fill={ink} />
            <circle cx={27.2 + look.x} cy={27.6 + look.y} r="0.9" fill="#fff" />
            <circle cx={38.6 + look.x} cy={27.6 + look.y} r="0.9" fill="#fff" />
          </g>
        )}
        {/* mouth: a smile; an "oh" while it listens; a small line while it thinks */}
        {mood === 'listening' ? <ellipse cx="32" cy="38" rx="2" ry="2.4" fill={ink} />
          : mood === 'thinking' ? <path d="M29.4 37.6h5.2" stroke={ink} strokeWidth="1.9" strokeLinecap="round" />
            : <path d={mood === 'happy' ? 'M27.4 35.8q4.6 5 9.2 0' : 'M28.6 36.3q3.4 3 6.8 0'} fill="none" stroke={ink} strokeWidth="1.9" strokeLinecap="round" />}
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
