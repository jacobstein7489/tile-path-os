/* The project's tabs by area, the same way everywhere (Scope of work, Layouts, Tile & materials): each floor in a dark
 * green band, each area (room) in a light gray band with what it has in a few words — closed. Tap an area to open it
 * (its walls and floors, its tiles); tap again to close it. "Open all" opens every one. */
import * as React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/tileos/lib/utils'
import { DOC_GREEN, DOC_GRAY } from '../docpaper'

/** which areas are open — none at first; kept while the project is open (each tab its own) */
export function useOpenAreas() {
  const [open, setOpen] = React.useState<string[]>([])
  return {
    isOpen: (name: string) => open.includes(name),
    toggle: (name: string) => setOpen((x) => (x.includes(name) ? x.filter((y) => y !== name) : [...x, name])),
    openOne: (name: string) => setOpen((x) => (x.includes(name) ? x : [...x, name])),
    setAll: (names: string[]) => setOpen(names),
    any: open.length > 0,
  }
}

/** "Open all" / "Close all" — a quiet link in the tab's header */
export function OpenAllLink({ any, onOpen, onClose }: { any: boolean; onOpen: () => void; onClose: () => void }) {
  return (
    <button type="button" onClick={any ? onClose : onOpen} className="text-[0.8125rem] font-semibold text-brand-700 hover:underline" data-areas-all={any ? 'close' : 'open'}>
      {any ? 'Close all' : 'Open all'}
    </button>
  )
}

/** a floor's band — dark green, its name in capitals and how many areas */
export function FloorBand({ floor, count }: { floor: string; count: number }) {
  return (
    <div className="flex h-9 items-center gap-3 px-5 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-white max-sm:px-3" style={{ background: DOC_GREEN }} data-area-floor-band={floor}>
      <span className="min-w-0 flex-1 truncate">{floor}</span>
      <span className="shrink-0 text-white/80">{count} {count === 1 ? 'area' : 'areas'}</span>
    </div>
  )
}

/** an area's band — tap it to open or close what's in it; on the right, what it has in a few words */
export function AreaBand({ name, note, open, onToggle, right, className }: { name: string; note?: string; open: boolean; onToggle: () => void; right?: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className={cn('flex min-h-10 w-full min-w-0 items-center gap-2.5 border-t border-line px-5 py-1.5 text-left transition hover:brightness-[.98] max-sm:px-3', className)} style={{ background: DOC_GRAY }} data-area-band={name} data-open={open || undefined}>
      {open ? <ChevronDown className="h-4 w-4 shrink-0 text-[#6b6f78]" /> : <ChevronRight className="h-4 w-4 shrink-0 text-[#6b6f78]" />}
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-[#222]"><b className="font-bold uppercase tracking-[0.02em]">{name}</b>{note ? <span className="text-[#555]"> | {note}</span> : null}</span>
      {right && <span className="flex min-w-0 shrink-0 items-center gap-2 text-[0.8125rem] text-[#555]">{right}</span>}
    </button>
  )
}
