/* A small drawing of how the tile is laid — stacked, brick, herringbone, basketweave… — so the pattern is seen, not
 * read: on the scope's lines and in the wall-or-floor window where it's picked. */
import * as React from 'react'
import { cn } from '@/tileos/lib/utils'
import { patternOf, PATTERNS } from './tiles'
/** one of the patterns (not a note like “Centered on the tub”) */
export const isPattern = (p: string) => PATTERNS.includes(patternOf(p))

const W = 36, H = 24
type R = [number, number, number, number]
function rects(p: string): { r?: R[]; poly?: string[]; rot?: boolean; drain?: boolean } {
  const out: R[] = []
  switch (p) {
    case 'Brick':
      for (let y = 0; y < 4; y++) for (let c = -1; c < 4; c++) out.push([c * 12 + (y % 2 ? 6 : 0), y * 6, 12, 6])
      return { r: out }
    case '⅓ offset':
      for (let y = 0; y < 4; y++) for (let c = -1; c < 4; c++) out.push([c * 12 + (y % 3) * 4, y * 6, 12, 6])
      return { r: out }
    case 'Vertical stack':
      for (let c = 0; c < 6; c++) for (let y = 0; y < 2; y++) out.push([c * 6, y * 12, 6, 12])
      return { r: out }
    case 'Herringbone': {
      /* L-shaped pairs on a diagonal; each band four cells tall, the next one four cells down */
      const u = 4
      for (let b = -6; b < 5; b++) for (let k = -2; k < 11; k++) {
        out.push([k * u, (k + 4 * b) * u, 2 * u, u])
        out.push([k * u, (k + 1 + 4 * b) * u, u, 2 * u])
      }
      return { r: out }
    }
    case 'Chevron': {
      const poly: string[] = []
      for (let c = 0; c < 6; c++) for (let y = -2; y < 8; y++) {
        const x0 = c * 6, y0 = y * 4
        poly.push(c % 2 === 0 ? `${x0},${y0 + 3} ${x0 + 6},${y0} ${x0 + 6},${y0 + 4} ${x0},${y0 + 7}` : `${x0},${y0} ${x0 + 6},${y0 + 3} ${x0 + 6},${y0 + 7} ${x0},${y0 + 4}`)
      }
      return { poly }
    }
    case 'Basketweave':
      for (let bx = 0; bx < 3; bx++) for (let by = 0; by < 2; by++) {
        const x = bx * 12, y = by * 12
        if ((bx + by) % 2 === 0) out.push([x, y, 12, 6], [x, y + 6, 12, 6])
        else out.push([x, y, 6, 12], [x + 6, y, 6, 12])
      }
      return { r: out }
    case 'Diagonal':
      for (let c = -3; c < 8; c++) for (let y = -4; y < 6; y++) out.push([c * 8, y * 8, 8, 8])
      return { r: out, rot: true }
    case 'Pitched to the drain':
      for (let c = 0; c < 9; c++) for (let y = 0; y < 6; y++) out.push([c * 4, y * 4, 4, 4])
      return { r: out, drain: true }
    default: /* stacked */
      for (let c = 0; c < 3; c++) for (let y = 0; y < 4; y++) out.push([c * 12, y * 6, 12, 6])
      return { r: out }
  }
}

export function PatternPic({ pattern, w = 30, className, on }: { pattern: string; w?: number; className?: string; /** picked: drawn in the brand color */ on?: boolean }) {
  const id = React.useId().replace(/:/g, '')
  const p = patternOf(pattern)
  if (!isPattern(p)) return null
  const d = rects(p)
  const stroke = on ? '#2650cf' : '#9d9588'
  const fill = on ? '#eef2fc' : '#fff'
  const sw = 0.9
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={w} height={(w * H) / W} className={cn('shrink-0 rounded-[3px]', className)} aria-hidden data-pattern-pic={p}>
      <defs><clipPath id={`pc${id}`}><rect x="0" y="0" width={W} height={H} rx="2.5" /></clipPath></defs>
      <g clipPath={`url(#pc${id})`}>
        <rect x="0" y="0" width={W} height={H} fill={fill} />
        <g transform={d.rot ? `rotate(45 ${W / 2} ${H / 2})` : undefined}>
          {d.r?.map(([x, y, a, b], i) => <rect key={i} x={x} y={y} width={a} height={b} fill={fill} stroke={stroke} strokeWidth={sw} />)}
          {d.poly?.map((pts, i) => <polygon key={i} points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />)}
        </g>
        {d.drain && <><path d={`M3 3 L${W / 2 - 2} ${H / 2 - 1.5} M${W - 3} 3 L${W / 2 + 2} ${H / 2 - 1.5} M3 ${H - 3} L${W / 2 - 2} ${H / 2 + 1.5} M${W - 3} ${H - 3} L${W / 2 + 2} ${H / 2 + 1.5}`} stroke="#2650cf" strokeWidth="1.1" /><circle cx={W / 2} cy={H / 2} r="2.2" fill="#2650cf" /></>}
      </g>
      <rect x="0.45" y="0.45" width={W - 0.9} height={H - 0.9} rx="2.5" fill="none" stroke={on ? '#2650cf' : '#cfc8bc'} strokeWidth="0.9" />
    </svg>
  )
}

/** the patterns to pick from, as pictures with their names — tap one; tap it again to take it off */
export function PatternPick({ value, onChange, drain }: { value: string; onChange: (v: string) => void; /** a shower floor: pitched to the drain too */ drain?: boolean }) {
  const list = ['Stacked', 'Brick', '⅓ offset', 'Vertical stack', 'Herringbone', 'Chevron', 'Basketweave', 'Diagonal', ...(drain ? ['Pitched to the drain'] : [])]
  const cur = patternOf(value)
  const extra = cur && !list.includes(cur) ? [cur] : []
  return (
    <div className="grid grid-cols-4 gap-1.5 max-sm:grid-cols-3" role="radiogroup" aria-label="Pattern" data-pattern-pick>
      {[...list, ...extra].map((p) => {
        const on = cur === p
        return (
          <button key={p} type="button" role="radio" aria-checked={on} onClick={() => onChange(on ? '' : p)} data-pattern={p} className={cn('flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 pb-1.5 pt-2 transition', on ? 'border-brand-500 bg-brand-50' : 'border-line bg-white hover:border-[#c9c1b4]')}>
            <PatternPic pattern={p} w={40} on={on} />
            <span className={cn('max-w-full truncate text-[0.75rem] leading-tight', on ? 'font-semibold text-brand-700' : 'font-medium text-ink-2')}>{p === 'Vertical stack' ? 'Vertical' : p === 'Pitched to the drain' ? 'To the drain' : p}</span>
          </button>
        )
      })}
    </div>
  )
}
