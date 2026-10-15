/* One look for every tab of the project window — the look of our printed Scope of Work:
 *   Strip   — the few numbers on top, big and plain (with an optional line of buttons under them)
 *   Section — a sheet: a dark-green band with its name in small capitals (and its buttons), then its lines
 *   Group   — a grey band inside a sheet ("Kitchen", "Yakov", "Setting")
 *   ROW     — the to-do grid: mark · what · who · when · button, every column the same width on every row
 *   Who     — a person, the same everywhere: plain initials and their first name ("You" for you)
 * Colour is kept for what needs it: red for a problem; everything else is ink and grey. */
import * as React from 'react'
import { useStore, meOf } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'

/** Cobblestone's green — the bands on the scope of work */
export const GREEN = '#2c4a3e'
export const SHEET = 'overflow-hidden rounded-2xl border border-line bg-white shadow-[0_0.0625rem_0.125rem_rgba(16,24,40,.04)]'
/** a person's first name — "Mordcha", not "Mordcha Shapiro" */
export const firstName = (p?: PersonKey) => (p ? PEOPLE[p]?.short || PEOPLE[p]?.name || '' : '')

/* buttons on the green band: light, so they read on it — the main one solid white */
const BAND_ACTIONS = [
  '[&_button]:h-7 [&_button]:rounded-lg [&_button]:border [&_button]:border-white/25 [&_button]:bg-white/10 [&_button]:px-2.5 [&_button]:text-[0.78125rem] [&_button]:text-white [&_button]:shadow-none',
  '[&_button:hover]:bg-white/20 [&_button_svg]:text-white',
  '[&_button[data-variant=primary]]:border-white [&_button[data-variant=primary]]:bg-white [&_button[data-variant=primary]]:text-[#2c4a3e] [&_button[data-variant=primary]_svg]:text-[#2c4a3e] [&_button[data-variant=primary]:hover]:bg-white/90',
].join(' ')
export function Section({ title, count, sub, right, action, children, className, id }: { title?: React.ReactNode; count?: number; sub?: React.ReactNode; right?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn(SHEET, className)}>
      {title && (
        <>
          <header className="flex min-h-[2.25rem] items-center gap-3 px-5 py-1 text-white max-sm:px-4" style={{ background: GREEN }}>
            <h3 className="min-w-0 flex-1 truncate text-[0.6875rem] font-bold uppercase tracking-[0.08em]">{title}{count != null && <span className="ml-2 font-semibold text-white/55">{count}</span>}</h3>
            {right && <span className="shrink-0 truncate text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-white/80">{right}</span>}
            {action && <div className={cn('flex shrink-0 items-center gap-1.5', BAND_ACTIONS)}>{action}</div>}
          </header>
          {sub && <div className="border-b border-line-2 bg-[#fafbfa] px-5 py-1.5 text-[0.78125rem] text-muted max-sm:px-4">{sub}</div>}
        </>
      )}
      {children}
    </section>
  )
}
export const Empty = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn('px-5 py-4 text-[0.84375rem] text-muted max-sm:px-4', className)}>{children}</div>
/** a grey band inside a sheet — a room, a person, a group */
export const Group = ({ label, count, right, tone }: { label: React.ReactNode; count?: number; right?: React.ReactNode; tone?: 'bad' }) => (
  <div className={cn('flex items-center gap-2 bg-[#eef0ee] px-5 py-1.5 text-[0.71875rem] font-bold uppercase tracking-[0.05em] max-sm:px-4', tone === 'bad' ? 'text-bad-700' : 'text-ink')}>
    <span className="min-w-0 truncate">{label}</span>{count != null && <span className="font-semibold text-muted">{count}</span>}
    {right != null && <span className="ml-auto shrink-0 tnum">{right}</span>}
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
            <div className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted">{x.label}</div>
            <div className={cn('mt-0.5 truncate text-[1.375rem] font-semibold leading-tight tnum max-sm:text-[1.1875rem]', x.tone === 'bad' ? 'text-bad-700' : 'text-ink')}>{x.value}</div>
            {x.sub && <div className={cn('truncate text-[0.78125rem]', x.tone === 'bad' ? 'font-semibold text-bad-600' : x.tone === 'warn' ? 'font-semibold text-ink-2' : 'text-muted')}>{x.sub}</div>}
          </div>
        ))}
      </div>
      {footer && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-2 bg-[#fafbfa] px-5 py-2.5 max-sm:px-4">{footer}</div>}
    </section>
  )
}
/** where something stands, in a word — no pill: red only for a problem, Cobblestone green when it's done */
export const Word = ({ tone, children, className }: { tone?: string; children: React.ReactNode; className?: string }) => (
  <span className={cn('whitespace-nowrap text-[0.8125rem] font-semibold', tone === 'bad' ? 'text-bad-600' : tone === 'ok' ? 'text-[#2c4a3e]' : 'text-ink-2', className)}>{children}</span>
)
/** the to-do grid: mark · what (and a line under it) · who · when · one button */
export const ROW = 'grid grid-cols-[1.75rem_minmax(0,1fr)_8.75rem_7.25rem_5.75rem] items-center gap-3 border-t border-line-2 px-5 py-2.5 first:border-t-0 max-md:grid-cols-[1.75rem_minmax(0,1fr)_5.75rem] max-sm:px-4'
/** a person: plain initials and their first name, the same everywhere */
export function Who({ who, className, size = 24 }: { who?: PersonKey; className?: string; size?: number }) {
  const role = useStore((s) => s.role)
  const me = meOf(role)
  if (!who || !PEOPLE[who]) return <span className={cn('flex min-w-0 items-center gap-2 text-[0.84375rem] text-faint', className)}>—</span>
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <Avatar who={who} size={size} plain />
      <span className={cn('truncate text-[0.84375rem]', who === me ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>{who === me ? 'You' : firstName(who)}</span>
    </span>
  )
}
