/* Sort any list by its columns: tap a column's name — A to Z (soonest first for a date); again — the other way; a third
 * time — back to the list's own order. A small arrow says which way. On a phone (no column names) the same from one
 * Sort button. What you picked is kept for next time, on this computer or phone. Groups stay groups: it sorts inside
 * each one. */
import * as React from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/tileos/lib/utils'
import { Menu, MenuItem, MenuLabel, MenuSep } from './overlay'

export type Sort = { k: string; dir: 1 | -1 } | null
/** a column a list can be sorted by: its name, and what kind of thing it holds (says "A to Z", "Soonest first"…) */
export type SortCol = { k: string; label: string; kind?: 'text' | 'date' | 'num' }

const read = (key: string): Sort => {
  try { const v = localStorage.getItem(key); const o = v ? JSON.parse(v) : null; return o && typeof o.k === 'string' && (o.dir === 1 || o.dir === -1) ? o : null } catch { return null }
}
/** one list's sort, kept (per list) for next time */
export function useSort(list: string): { sort: Sort; toggle: (k: string) => void; set: (v: Sort) => void } {
  const key = 'tileos-sort:' + list
  const [sort, setSort] = React.useState<Sort>(() => read(key))
  const set = React.useCallback((v: Sort) => {
    setSort(v)
    try { if (v) localStorage.setItem(key, JSON.stringify(v)); else localStorage.removeItem(key) } catch { /* not kept */ }
  }, [key])
  const toggle = React.useCallback((k: string) => set(!sort || sort.k !== k ? { k, dir: 1 } : sort.dir === 1 ? { k, dir: -1 } : null), [sort, set])
  return { sort, toggle, set }
}

type Val = string | number | null | undefined
const COLL = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
/** the rows in the picked order (nothing picked: as they came). Empty ones go last either way; equal ones keep their
 *  own order */
export function sortRows<T>(rows: T[], sort: Sort, get: Record<string, (r: T) => Val>): T[] {
  const g = sort ? get[sort.k] : undefined
  if (!sort || !g) return rows
  return rows
    .map((r, i) => ({ r, i, v: g(r) }))
    .sort((a, b) => {
      const ea = a.v == null || a.v === '', eb = b.v == null || b.v === ''
      if (ea || eb) return ea && eb ? a.i - b.i : ea ? 1 : -1
      const c = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : COLL.compare(String(a.v), String(b.v))
      return c * sort.dir || a.i - b.i
    })
    .map((x) => x.r)
}

const WAYS = { text: ['A to Z', 'Z to A'], date: ['Soonest first', 'Latest first'], num: ['Least first', 'Most first'] } as const

/** a column's name that sorts its list — the arrow shows when it's the one sorting (and which way); otherwise a faint
 *  up-down mark, so you know you can */
export function SortHead({ k, sort, onSort, children, right, kind = 'text' }: { k: string; sort: Sort; onSort: (k: string) => void; children: React.ReactNode; right?: boolean; kind?: SortCol['kind'] }) {
  const on = sort?.k === k
  const way = on ? WAYS[kind][sort!.dir === 1 ? 0 : 1] : ''
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onSort(k) }}
      title={on ? `Sorted ${way.toLowerCase()} · tap to change` : 'Sort by this'}
      /* the words sit exactly where the column starts (or ends) — the soft hover spot reaches a little past them */
      className={cn('group/sort relative isolate inline-flex max-w-full items-center gap-1 py-0.5 transition before:absolute before:inset-y-0 before:-inset-x-1.5 before:-z-10 before:rounded-md before:transition hover:text-ink hover:before:bg-wash-2 focus-visible:outline-none focus-visible:before:bg-wash-2', right && 'flex-row-reverse', on && 'text-ink')}
      data-sort-head={k}
      data-sort-on={on ? (sort!.dir === 1 ? 'up' : 'down') : undefined}
    >
      <span>{children}</span>
      {on
        ? sort!.dir === 1 ? <ArrowUp className="h-3.5 w-3.5 shrink-0 text-brand-600" strokeWidth={2.5} /> : <ArrowDown className="h-3.5 w-3.5 shrink-0 text-brand-600" strokeWidth={2.5} />
        : <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-faint opacity-70 transition group-hover/sort:opacity-100" />}
    </button>
  )
}

/** one Sort button (a phone and a computer the same, Nov 27) — each column both ways, and the list's own order */
export function SortMenu({ sort, set, cols, className, usual = 'The usual order' }: { sort: Sort; set: (v: Sort) => void; cols: SortCol[]; className?: string; usual?: string }) {
  const cur = sort ? cols.find((c) => c.k === sort.k) : undefined
  return (
    <Menu
      align="end"
      width={250}
      trigger={
        /* one small square (a phone's bar has room for little more): blue when the list is sorted */
        <button type="button" aria-label={cur ? `Sorted by ${cur.label}` : 'Sort'} title={cur ? `Sorted by ${cur.label}` : 'Sort'} className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] border bg-white transition hover:bg-wash', cur ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line text-muted', className)} data-sort-menu={cur ? cur.k : ''}>
          <ArrowUpDown className="h-[1.125rem] w-[1.125rem]" />
        </button>
      }
    >
      <MenuLabel>Sort by</MenuLabel>
      {cols.map((c) => {
        const w = WAYS[c.kind || 'text']
        return (
          <React.Fragment key={c.k}>
            <MenuItem checked={sort?.k === c.k && sort.dir === 1} onSelect={() => set({ k: c.k, dir: 1 })} hint={w[0]} data-sort-pick={`${c.k}:up`}>{c.label}</MenuItem>
            <MenuItem checked={sort?.k === c.k && sort.dir === -1} onSelect={() => set({ k: c.k, dir: -1 })} hint={w[1]} data-sort-pick={`${c.k}:down`}>{c.label}</MenuItem>
          </React.Fragment>
        )
      })}
      <MenuSep />
      <MenuItem checked={!sort} onSelect={() => set(null)} data-sort-pick="usual">{usual}</MenuItem>
    </Menu>
  )
}
