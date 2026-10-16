/* A selector you type into: tap it, start typing a project or a name, pick it. For long lists (projects,
 * clients, items) instead of a wall of options. */
import * as React from 'react'
import * as PO from '@radix-ui/react-popover'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/tileos/lib/utils'

export type SelectOption = { key: string; label: string; hint?: string; group?: string; lead?: React.ReactNode }

export function SearchSelect({
  value, options, onChange, placeholder = 'Pick one', searchPlaceholder = 'Type to search…', className, width = 360, autoOpen, emptyLabel, icon, search, label, onCreate, createLabel, footer,
}: {
  value: string
  options: SelectOption[]
  onChange: (key: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  width?: number
  autoOpen?: boolean
  /** an extra first option, like "None — company task" */
  emptyLabel?: string
  icon?: React.ReactNode
  /** show the search box — on by default for long lists, off for short ones */
  search?: boolean
  /** the field's name, read by screen readers */
  label?: string
  /** typed something that isn't on the list: add it ("Add “Acme GC” as a new client") */
  onCreate?: (text: string) => void
  createLabel?: (text: string) => string
  /** one more thing at the bottom of the list, always there — "Add a new tile" */
  footer?: { label: string; onClick: () => void }
}) {
  const searchable = search ?? options.length > 8
  const [open, setOpen] = React.useState(!!autoOpen)
  const [q, setQ] = React.useState('')
  const [hi, setHi] = React.useState(0)
  const cur = options.find((o) => o.key === value)
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const shown = (emptyLabel ? [{ key: '', label: emptyLabel }, ...options] : options).filter((o) => !words.length || words.every((w) => `${o.label} ${o.hint || ''}`.toLowerCase().includes(w)))
  const pick = (k: string) => { onChange(k); setOpen(false); setQ('') }
  const canCreate = !!onCreate && q.trim().length > 1 && !options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase())
  React.useEffect(() => setHi(0), [q])
  const listRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const i = shown.findIndex((o) => o.key === value)
    if (i >= 0) setHi(i)
    const t = window.setTimeout(() => listRef.current?.querySelector<HTMLElement>('[data-on="true"]')?.scrollIntoView({ block: 'center' }), 10)
    return () => window.clearTimeout(t)
  }, [open])
  return (
    <PO.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ('') }}>
      <PO.Trigger asChild>
        <button type="button" aria-label={label} className={cn('flex h-10 w-full items-center gap-2 rounded-[0.625rem] border border-line bg-white px-3 text-left text-[0.875rem] transition hover:border-[#cdc7bc]', open && 'border-brand-300 ring-[0.1875rem] ring-brand-50', className)}>
          {icon && <span className="inline-flex shrink-0 text-faint [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
          {cur?.lead && <span className="inline-flex shrink-0">{cur.lead}</span>}
          <span className={cn('min-w-0 flex-1 truncate', !cur && !(emptyLabel && value === '') && 'text-faint')}>
            {cur ? <>{cur.label}{cur.hint && <span className="ml-2 text-[0.78125rem] text-muted">{cur.hint}</span>}</> : emptyLabel && value === '' ? emptyLabel : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
        </button>
      </PO.Trigger>
      <PO.Portal>
        <PO.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-[320] overflow-hidden rounded-[0.75rem] border border-line bg-white shadow-pop outline-none animate-pop-in"
          style={{ width: typeof width === 'number' ? `${width / 16}rem` : width, maxWidth: 'calc(100vw - 24px)' }}
          onOpenAutoFocus={(e) => { e.preventDefault(); const el = e.currentTarget as HTMLElement; (el.querySelector('input') || el.querySelector<HTMLElement>('[data-on="true"]') || el.querySelector<HTMLElement>('button'))?.focus() }}
          onKeyDown={searchable ? undefined : (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(shown.length - 1, h + 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)) }
            if (e.key === 'Enter' && shown[hi]) { e.preventDefault(); pick(shown[hi].key) }
          }}
        >
          {searchable && <label className="flex h-11 items-center gap-2.5 border-b border-line-2 px-3">
            <Search className="h-4 w-4 shrink-0 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(shown.length - 1, h + 1)) }
                if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)) }
                if (e.key === 'Enter' && shown[hi]) { e.preventDefault(); pick(shown[hi].key) }
              }}
              placeholder={searchPlaceholder}
              className="h-full flex-1 bg-transparent text-[0.875rem] text-ink placeholder:text-faint focus:outline-none"
            />
          </label>}
          <div ref={listRef} role="listbox" aria-label={label} className="scroll-soft max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain p-1">
            {shown.map((o, i) => (
              <button
                key={o.key || '_none'}
                type="button"
                role="option"
                aria-selected={o.key === value}
                data-on={o.key === value}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(o.key)}
                className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[0.875rem]', i === hi ? 'bg-wash-2 text-ink' : 'text-ink-2')}
              >
                {o.lead && <span className="inline-flex shrink-0">{o.lead}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-[0.78125rem] text-muted">{o.hint}</span>}
                </span>
                {o.key === value && <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
              </button>
            ))}
            {canCreate && (
              <button type="button" onClick={() => { onCreate!(q.trim()); setOpen(false); setQ('') }} className="flex w-full items-center gap-2.5 rounded-md border-t border-line-2 px-2.5 py-2.5 text-left text-[0.875rem] font-semibold text-brand-700 hover:bg-brand-50">
                <span className="text-[1rem] leading-none">+</span>{createLabel ? createLabel(q.trim()) : `Add “${q.trim()}”`}
              </button>
            )}
            {!shown.length && !canCreate && <div className="px-3 py-6 text-center text-[0.84375rem] text-muted">{q ? <>Nothing matches “{q}”.</> : 'Nothing here yet.'}</div>}
            {footer && (
              <button type="button" onClick={() => { setOpen(false); setQ(''); footer.onClick() }} className="mt-1 flex w-full items-center gap-2.5 rounded-md border-t border-line-2 px-2.5 py-2.5 text-left text-[0.875rem] font-semibold text-brand-700 hover:bg-brand-50">
                <span className="text-[1rem] leading-none">+</span>{footer.label}
              </button>
            )}
          </div>
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  )
}

/* Pick several: people for a meeting, who else is coming. The chosen ones show in the field; tap to change. */
export type MultiOption = SelectOption & { lead?: React.ReactNode }
export function MultiSelect({ values, options, onChange, placeholder = 'Pick', className, width = 340, icon, label, summary }: {
  values: string[]
  options: MultiOption[]
  onChange: (keys: string[]) => void
  placeholder?: string
  className?: string
  width?: number
  icon?: React.ReactNode
  label?: string
  /** what the closed field says, e.g. "You and Yakov" */
  summary?: (picked: MultiOption[]) => React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const searchable = options.length > 8
  const picked = options.filter((o) => values.includes(o.key))
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const shown = options.filter((o) => !words.length || words.every((w) => `${o.label} ${o.hint || ''}`.toLowerCase().includes(w)))
  const toggle = (k: string) => onChange(values.includes(k) ? values.filter((x) => x !== k) : [...values, k])
  return (
    <PO.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ('') }}>
      <PO.Trigger asChild>
        <button type="button" aria-label={label} className={cn('flex min-h-10 w-full items-center gap-2 rounded-[0.625rem] border border-line bg-white px-3 py-1.5 text-left text-[0.875rem] transition hover:border-[#cdc7bc]', open && 'border-brand-300 ring-[0.1875rem] ring-brand-50', className)}>
          {icon && <span className="inline-flex shrink-0 text-faint [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
          <span className={cn('min-w-0 flex-1 truncate', !picked.length && 'text-faint')}>{picked.length ? (summary ? summary(picked) : picked.map((o) => o.label).join(', ')) : placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
        </button>
      </PO.Trigger>
      <PO.Portal>
        <PO.Content align="start" sideOffset={6} collisionPadding={12} className="z-[320] overflow-hidden rounded-[0.75rem] border border-line bg-white shadow-pop outline-none animate-pop-in" style={{ width: typeof width === 'number' ? `${width / 16}rem` : width, maxWidth: 'calc(100vw - 24px)' }} onOpenAutoFocus={(e) => { e.preventDefault(); const el = e.currentTarget as HTMLElement; (el.querySelector('input') || el.querySelector<HTMLElement>('button'))?.focus() }}>
          {searchable && (
            <label className="flex h-11 items-center gap-2.5 border-b border-line-2 px-3">
              <Search className="h-4 w-4 shrink-0 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name…" className="h-full flex-1 bg-transparent text-[0.875rem] text-ink placeholder:text-faint focus:outline-none" />
            </label>
          )}
          <div role="listbox" aria-multiselectable aria-label={label} className="scroll-soft max-h-[min(21.25rem,52vh)] overflow-y-auto overscroll-contain p-1">
            {shown.map((o) => {
              const on = values.includes(o.key)
              return (
                <button key={o.key} type="button" role="option" aria-selected={on} onClick={() => toggle(o.key)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[0.875rem] text-ink-2 hover:bg-wash-2">
                  <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c9ced6] bg-white')}>{on && <Check className="h-3 w-3" strokeWidth={3.2} />}</span>
                  {o.lead}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate', on && 'font-semibold text-ink')}>{o.label}</span>
                    {o.hint && <span className="block truncate text-[0.78125rem] text-muted">{o.hint}</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between border-t border-line-2 px-3 py-2">
            <span className="text-[0.78125rem] text-muted">{values.length ? `${values.length} picked` : 'None picked'}</span>
            <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-lg bg-ink px-3 text-[0.8125rem] font-semibold text-white">Done</button>
          </div>
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  )
}
