/* One look for every tab of the project window, so nothing jumps around:
 *   Section — a card with the same header everywhere (title, count, a line under it, buttons on the right)
 *   Group   — a small heading inside a list ("Your turn", "Waiting")
 *   ROW     — the to-do grid: mark · what · who · when · button, every column the same width on every row
 *   Who     — a person shown the same way everywhere: their face and first name ("You" for you)
 * Sizes: titles 15px, row titles 14.5px, the line under them 12.5px, people and dates 13.5px. */
import * as React from 'react'
import { useStore, meOf } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'

/** a person's first name — "Mordcha", not "Mordcha Shapiro" */
export const firstName = (p?: PersonKey) => (p ? PEOPLE[p]?.short || PEOPLE[p]?.name || '' : '')

export function Section({ title, count, sub, action, children, className, id }: { title?: React.ReactNode; count?: number; sub?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('overflow-hidden rounded-[0.875rem] border border-line bg-white', className)}>
      {title && (
        <header className="flex min-h-[3.25rem] items-center gap-3 border-b border-line px-5 py-2.5 max-sm:px-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[0.9375rem] font-semibold text-ink">{title}{count != null && <span className="ml-1.5 text-[0.8125rem] font-semibold text-faint">{count}</span>}</h3>
            {sub && <p className="truncate text-[0.78125rem] text-muted">{sub}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
export const Empty = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn('px-5 py-4 text-[0.84375rem] text-muted max-sm:px-4', className)}>{children}</div>
export const Group = ({ label, count, tone }: { label: string; count?: number; tone?: 'bad' }) => (
  <div className={cn('flex items-center gap-2 border-t border-line-2 bg-[#f8f9fb] px-5 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.06em] first:border-t-0 max-sm:px-4', tone === 'bad' ? 'text-bad-700' : 'text-muted')}>
    {label}{count != null && <span className="font-semibold text-faint">{count}</span>}
  </div>
)
/** the to-do grid: mark · what (and a line under it) · who · when · one button */
export const ROW = 'grid grid-cols-[1.75rem_minmax(0,1fr)_8.75rem_7.25rem_5.75rem] items-center gap-3 border-t border-line-2 px-5 py-3 first:border-t-0 max-md:grid-cols-[1.75rem_minmax(0,1fr)_5.75rem] max-sm:px-4'
/** a person: their face and first name, the same everywhere */
export function Who({ who, className, size = 24 }: { who?: PersonKey; className?: string; size?: number }) {
  const role = useStore((s) => s.role)
  const me = meOf(role)
  if (!who || !PEOPLE[who]) return <span className={cn('flex min-w-0 items-center gap-2 text-[0.84375rem] text-faint', className)}>—</span>
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <Avatar who={who} size={size} />
      <span className={cn('truncate text-[0.84375rem]', who === me ? 'font-semibold text-brand-700' : 'font-medium text-ink-2')}>{who === me ? 'You' : firstName(who)}</span>
    </span>
  )
}
