/* "How we got that number" — every calculated material shows its math, surface by surface. */
import * as React from 'react'
import { ChevronDown, ChevronRight, Calculator } from 'lucide-react'
import { cn } from '@/tileos/lib/utils'
import { qtyLabel, type TakeLine } from './takeoff'

const n1 = (x: number) => (x < 10 ? Math.round(x * 10) / 10 : Math.round(x)).toLocaleString('en-US')
export function CalcHow({ line, unit, waste, className, defaultOpen }: { line: TakeLine; unit: string; waste: number; className?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(!!defaultOpen)
  const withWaste = Math.abs(line.need - Math.ceil(line.raw - 1e-9)) > 0
  return (
    <span className={cn('block', className)}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(!open) }} className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-600 hover:text-brand-700">
        <Calculator className="h-3 w-3" />How we got {qtyLabel(line.need, unit)}{open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <span className="mt-1.5 block rounded-lg bg-wash px-3 py-2 text-[0.75rem] leading-relaxed text-ink-2">
          {line.uses.map((u, i) => (
            <span key={i} className="flex gap-2">
              <span className="min-w-0 flex-1 truncate"><b className="font-semibold text-ink">{u.room} · {u.surface}</b> — {u.note}</span>
              <span className="shrink-0 tnum text-muted">{n1(u.raw)}</span>
            </span>
          ))}
          <span className="mt-1 flex gap-2 border-t border-line pt-1 font-semibold text-ink">
            <span className="min-w-0 flex-1">{n1(line.raw)}{withWaste ? ` + ${waste}% extra` : ''} → {qtyLabel(line.need, unit)}{line.have ? ` − ${line.have} already ordered` : ''}</span>
            <span className="shrink-0 tnum">{line.toOrder ? `${line.toOrder} to order` : 'covered'}</span>
          </span>
        </span>
      )}
    </span>
  )
}
