/* One look for every tab of the project window — plain white sheets, the Estimates page's calm:
 *   Strip   — the few numbers on top, big and plain (with an optional line of buttons under them)
 *   Section — a sheet: its name (and a count) on a plain header with its buttons, then its lines
 *   Group   — a light grey band inside a sheet ("Kitchen", "Yakov", "Setting")
 * (Only the Scope of work keeps Cobblestone's green bands — it reads like the printed document.)
 *   ROW     — the to-do grid: mark · what · who · when · button, every column the same width on every row
 *   Who     — a person, the same everywhere: plain initials and their first name ("You" for you)
 * Colour is kept for what needs it: red for a problem; everything else is ink and grey. */
import * as React from 'react'
import { useStore, meOf } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { BAND_LABEL, BandCount } from '@/tileos/components/ui/page'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'

/** Cobblestone's green — the bands on the scope of work */
export const GREEN = '#2c4a3e'
export const SHEET = 'overflow-hidden rounded-[0.875rem] border border-line bg-white'

/* The two paper lists — the Scope of work and Tile & materials — are one design, the same sizes to the pixel: a slim bar
 * on top (what it is on the left, its buttons on the right — it scrolls away), then the paper: the column names (they
 * stay on top), each floor in Cobblestone's dark green band, each room in its gray band (it stays under the column names
 * while its lines go by), each line 40px with a 24px picture (a phone: two lines, a 44px picture). */
/** the paper: rounded, and its column names and bands still stay on top as you scroll (clip, not hidden) */
export const PAPER = 'overflow-clip rounded-[0.875rem] border border-line bg-white'
/** a line on the paper — a computer: 40px; a phone: two lines with the big picture */
export const PAPER_ROW = 'min-h-[3.5rem] border-t border-line-2 px-5 py-2.5 max-sm:px-3 lg:min-h-[2.5rem] lg:py-1'
/** a room's gray band (the scope's and the tile's) */
export const ROOM_BAND = 'flex min-h-9 min-w-0 items-center gap-2.5 text-[0.8125rem] text-[#222]'
export const ROOM_NAME = 'font-bold uppercase tracking-[0.02em]'
/** the picture on a line: small on a computer, big on a phone */
export const PIC_LG = 24
export const PIC_SM = 44

/** the slim bar over a paper list: what it is (or the switch) on the left, its buttons on the right — a phone: the
 *  buttons two by two under it, each as wide as its half */
export function PaperBar({ lead, children, className, mark, buttonsMark }: { lead?: React.ReactNode; children?: React.ReactNode; className?: string; /** its mark for the checks */ mark?: string; buttonsMark?: string }) {
  return (
    <div className={cn('mb-3 flex min-h-9 min-w-0 flex-wrap items-center gap-x-3 gap-y-2', className)} {...(mark ? { [mark]: '' } : {})}>
      {lead}
      {children && (
        <span className="ml-auto flex shrink-0 items-center gap-2 max-sm:ml-0 max-sm:grid max-sm:w-full max-sm:grid-cols-2 max-sm:[&>*]:w-full max-sm:[&>*:last-child:nth-child(odd)]:col-span-2" {...(buttonsMark ? { [buttonsMark]: '' } : {})}>
          {children}
        </span>
      )}
    </div>
  )
}

/** a floor in Cobblestone's dark green band — a heading, nothing to open — and how many rooms on it */
export function FloorBand({ floor, rooms }: { floor: string; rooms: number }) {
  return (
    <div className="flex h-9 w-full items-center gap-2.5 px-5 text-[0.78125rem] font-bold uppercase tracking-[0.06em] text-white max-sm:px-3" style={{ background: GREEN }} data-floor-band>
      <span className="min-w-0 flex-1 truncate">{floor}</span>
      <span className="shrink-0 font-semibold normal-case tracking-normal text-white/80">{rooms} {rooms === 1 ? 'room' : 'rooms'}</span>
    </div>
  )
}
/** a person's first name — "Mordcha", not "Mordcha Shapiro" */
export const firstName = (p?: PersonKey) => (p ? PEOPLE[p]?.short || PEOPLE[p]?.name || '' : '')

export function Section({ title, count, sub, right, action, children, className, id, sticky }: { title?: React.ReactNode; count?: number; sub?: React.ReactNode; right?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string; /** its header stays on top as you scroll (under the switch on top of the tab) */ sticky?: boolean }) {
  return (
    <section id={id} className={cn(SHEET, sticky && 'overflow-visible', className)}>
      {title && (
        <>
          <header className={cn('flex min-h-[3.25rem] flex-wrap items-center gap-2 px-5 py-2 max-sm:px-4', sticky && 'sticky top-[4.5rem] z-[6] rounded-t-[0.875rem] border-b border-line-2 bg-white max-sm:top-[5.25rem]')} data-section-head>
            <h3 className="min-w-0 shrink-0 text-[0.9375rem] font-semibold text-ink">{title}</h3>
            {count != null && <span className="shrink-0 text-[0.8125rem] font-medium tnum text-faint">{count}</span>}
            <span className="flex-1" />
            {right && <span className="min-w-0 shrink truncate text-[0.8125rem] text-muted">{right}</span>}
            {action && <div className="flex min-w-0 shrink-0 items-center gap-1.5 max-sm:max-w-full max-sm:flex-wrap">{action}</div>}
          </header>
          {sub && <div className="border-b border-line-2 px-5 py-1.5 text-[0.78125rem] text-muted max-sm:px-4">{sub}</div>}
        </>
      )}
      {children}
    </section>
  )
}
export const Empty = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn('px-5 py-4 text-[0.84375rem] text-muted max-sm:px-4', className)}>{children}</div>
/** a group inside a sheet — a floor, a kind of tile, the orders: the same soft gray band as every list's (its name in
 *  small capitals, how many in a white pill), with the same line above it as every row, so the lines never change */
export const Group = ({ label, count, right, tone }: { label: React.ReactNode; count?: number; right?: React.ReactNode; tone?: 'bad' }) => (
  <div className="flex h-8 items-center gap-2 border-t border-line bg-[#f6f6f4] px-5 max-sm:px-4" data-band>
    <span className={cn(BAND_LABEL, 'min-w-0', tone === 'bad' && 'text-bad-700')}>{label}</span>{count != null && <BandCount n={count} />}
    {right != null && <span className="ml-auto shrink-0 text-[0.8125rem] font-semibold tnum text-ink-2">{right}</span>}
  </div>
)
/** the few numbers on top of a tab — big, plain, the same everywhere */
export type Stat = { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'bad' | 'warn' }
export function Strip({ stats, footer }: { stats: Stat[]; footer?: React.ReactNode }) {
  const four = stats.length >= 4
  return (
    <section className={SHEET}>
      <div className={cn('grid', four ? 'grid-cols-4 max-md:grid-cols-2' : 'grid-cols-3 max-sm:grid-cols-1')}>
        {stats.map((x, i) => (
          <div key={x.label} className={cn('min-w-0 border-line-2 px-5 py-3 max-sm:px-4', i > 0 && 'border-l', four && 'max-md:[&:nth-child(3)]:border-l-0 max-md:[&:nth-child(n+3)]:border-t', !four && 'max-sm:border-l-0 max-sm:[&:nth-child(n+2)]:border-t')}>
            <div className="text-[0.78125rem] font-medium text-muted">{x.label}</div>
            <div className={cn('mt-0.5 truncate text-[1.375rem] font-semibold leading-tight tnum max-sm:text-[1.1875rem]', x.tone === 'bad' ? 'text-bad-700' : 'text-ink')}>{x.value}</div>
            {x.sub && <div className={cn('text-[0.78125rem] sm:truncate', x.tone === 'bad' ? 'font-semibold text-bad-600' : x.tone === 'warn' ? 'font-semibold text-ink-2' : 'text-muted')}>{x.sub}</div>}
          </div>
        ))}
      </div>
      {footer && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-2 bg-[#faf8f5] px-5 py-2.5 max-sm:px-4">{footer}</div>}
    </section>
  )
}
/** where something stands, in a word — no pill: red only for a problem, Cobblestone green when it's done */
export const Word = ({ tone, children, className }: { tone?: string; children: React.ReactNode; className?: string }) => (
  <span className={cn('whitespace-nowrap text-[0.8125rem] font-medium', tone === 'bad' ? 'text-bad-600' : tone === 'ok' ? 'text-[#2c8a5b]' : 'text-ink-2', className)}>{children}</span>
)
/** the to-do grid: mark · what (and a line under it) · who · when · one button */
export const ROW = 'grid grid-cols-[1.75rem_minmax(0,1fr)_8.75rem_7.25rem_5.75rem] items-center gap-3 border-t border-line-2 px-5 py-2.5 first:border-t-0 max-md:grid-cols-[1.75rem_minmax(0,1fr)_5.75rem] max-sm:px-4'
/** a person: plain initials and their first name, the same everywhere */
export function Who({ who, className, size = 24 }: { who?: PersonKey; className?: string; size?: number }) {
  const role = useStore((s) => s.role)
  const me = meOf(role)
  if (!who || !PEOPLE[who]) return <span className={cn('flex min-w-0 items-center gap-2 text-[0.84375rem] text-faint', className)}></span>
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <Avatar who={who} size={size} plain />
      <span className={cn('truncate text-[0.84375rem]', who === me ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>{who === me ? 'You' : firstName(who)}</span>
    </span>
  )
}

/** a computer-sized window (the project's two sides side by side) */
export function useWide() {
  const [wide, setWide] = React.useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true))
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const f = () => setWide(mq.matches)
    f()
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return wide
}
