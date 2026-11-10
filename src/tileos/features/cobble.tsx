/* Cobble — the little cobblestone who listens. Tile OS's own helper (Cobblestone's stone with a face): it blinks and
 * bobs while it waits, perks up while you talk, looks up while it thinks, and smiles when the list is ready.
 * Drawn here, in a few shapes — no pictures to load. */
import * as React from 'react'
import { cn } from '@/tileos/lib/utils'

export type CobbleMood = 'idle' | 'listening' | 'thinking' | 'happy'

export function Cobble({ size = 48, mood = 'idle', className }: { size?: number; mood?: CobbleMood; className?: string }) {
  const id = React.useId().replace(/:/g, '')
  const ink = '#2b2a28'
  /* where the eyes look: up and to the side while it thinks */
  const look = mood === 'thinking' ? { x: 1.6, y: -1.8 } : { x: 0, y: 0 }
  const eyeRy = mood === 'listening' ? 4.1 : 3.5
  return (
    <span className={cn('inline-flex shrink-0', mood === 'listening' ? 'cobble-bob-fast' : 'cobble-bob', className)} style={{ width: size, height: size }} aria-hidden data-cobble={mood}>
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id={`${id}-stone`} x1="0.2" y1="0.05" x2="0.75" y2="1">
            <stop offset="0" stopColor="#efe8dc" />
            <stop offset="0.55" stopColor="#d9cfbf" />
            <stop offset="1" stopColor="#bfb3a0" />
          </linearGradient>
        </defs>
        {/* its shadow on the ground */}
        <ellipse cx="32" cy="58.5" rx="17" ry="2.6" fill="#1b1a17" opacity="0.1" />
        {/* the stone — a little uneven, like a real cobblestone */}
        <path d="M13.5 23.5C14.5 13.5 25 8.6 34.2 9.2c10.6.7 19.4 6.6 20.6 18.2 1.2 12-4.8 24.2-19.6 26.1C21.7 55.3 10.2 48.1 9.4 36.4c-.4-5.4 1.6-9.6 4.1-12.9z" fill={`url(#${id}-stone)`} stroke="#ab9f8b" strokeWidth="1.2" />
        {/* light on its top, and a few specks */}
        <path d="M19 17.5c3.4-4 9.4-5.6 14.6-4.9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.55" />
        <circle cx="45.5" cy="19.5" r="1" fill="#a99d89" opacity="0.7" />
        <circle cx="17.5" cy="42" r="0.9" fill="#a99d89" opacity="0.6" />
        <circle cx="47" cy="44.5" r="1.2" fill="#a99d89" opacity="0.55" />
        {/* cheeks */}
        <ellipse cx="20.5" cy="38.5" rx="3.6" ry="2.2" fill="#f2a59a" opacity="0.38" />
        <ellipse cx="43.5" cy="38.5" rx="3.6" ry="2.2" fill="#f2a59a" opacity="0.38" />
        {/* eyes: happy ^ ^, or round (they blink) */}
        {mood === 'happy' ? (
          <g fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round">
            <path d="M22 33.2q3.1-3.6 6.2 0" />
            <path d="M35.8 33.2q3.1-3.6 6.2 0" />
          </g>
        ) : (
          <g className="cobble-blink">
            <ellipse cx={25 + look.x} cy={31 + look.y} rx="3.1" ry={eyeRy} fill={ink} />
            <ellipse cx={39 + look.x} cy={31 + look.y} rx="3.1" ry={eyeRy} fill={ink} />
            <circle cx={26 + look.x} cy={29.4 + look.y} r="1" fill="#fff" />
            <circle cx={40 + look.x} cy={29.4 + look.y} r="1" fill="#fff" />
          </g>
        )}
        {/* mouth: a smile; an "oh" while it listens; a small line while it thinks */}
        {mood === 'listening' ? <ellipse cx="32" cy="40.6" rx="2.2" ry="2.6" fill={ink} />
          : mood === 'thinking' ? <path d="M29.2 40.5h5.6" stroke={ink} strokeWidth="2" strokeLinecap="round" />
            : <path d={mood === 'happy' ? 'M26.8 38.6q5.2 5.6 10.4 0' : 'M28.2 39.2q3.8 3.4 7.6 0'} fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />}
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
