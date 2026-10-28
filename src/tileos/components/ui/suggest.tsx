/* A text box that knows the usual ones. Start typing and the common ones that match show under it; tap one and its
 * words go in the box — nothing else changes (not who does it, not when). The × empties the box and shows the common
 * ones again, so picking a different one is one tap. "Common" opens the list when the box is empty.
 * Arrow keys move, Enter picks, Esc closes the list (a second Esc closes the window). */
import * as React from 'react'
import * as PO from '@radix-ui/react-popover'
import { X, ChevronDown } from 'lucide-react'
import { cn } from '@/tileos/lib/utils'
import { Mic, canListen, addSaid } from './mic'
import { scrollHere } from './overlay'

export function SuggestInput({
  value, onChange, onPick, onEnter, suggestions, label, placeholder, listLabel = 'The usual ones', max = 6, className, autoFocus = true,
}: {
  value: string
  onChange: (v: string) => void
  /** a common one was picked — by default its words just go in the box */
  onPick?: (text: string) => void
  /** Enter with no list open — usually "add it" */
  onEnter?: () => void
  suggestions: string[]
  label: string
  placeholder?: string
  /** what the list is called — "Common tasks" */
  listLabel?: string
  max?: number
  className?: string
  autoFocus?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  /* opened on purpose (the Common button, or the box was just emptied): show the top ones even with nothing typed */
  const [all, setAll] = React.useState(false)
  const [hi, setHi] = React.useState(-1)
  const box = React.useRef<HTMLInputElement>(null)
  const wrap = React.useRef<HTMLSpanElement>(null)
  const typed = value.toLowerCase().trim()
  const words = typed.split(/\s+/).filter(Boolean)
  const shown = (typed.length >= 2 ? suggestions.filter((x) => { const l = x.toLowerCase(); return l !== typed && words.every((w) => l.includes(w)) }) : !typed && all ? suggestions : []).slice(0, max)
  const visible = open && shown.length > 0
  React.useEffect(() => setHi(-1), [value, all])
  const focusEnd = () => window.setTimeout(() => { const el = box.current; if (!el) return; el.focus(); const n = el.value.length; el.setSelectionRange(n, n) }, 0)
  const pick = (x: string) => { (onPick || onChange)(x); setOpen(false); setAll(false); focusEnd() }
  const clear = () => { onChange(''); setAll(true); setOpen(true); focusEnd() }
  const mic = canListen()
  return (
    <PO.Root open={visible} onOpenChange={(o) => { if (!o) { setOpen(false); setAll(false) } }}>
      <PO.Anchor asChild>
        <span ref={wrap} className={cn('relative block', className)}>
          <input
            ref={box}
            data-autofocus={autoFocus ? '' : undefined}
            aria-label={label}
            role="combobox"
            aria-expanded={visible}
            aria-autocomplete="list"
            value={value}
            autoComplete="off"
            onChange={(e) => { onChange(e.target.value); setOpen(true); if (!e.target.value) setAll(false) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (!visible) { if (!typed) setAll(true); setOpen(true); setHi(0); return }
                setHi((h) => Math.min(shown.length - 1, h + 1))
              } else if (e.key === 'ArrowUp' && visible) {
                e.preventDefault(); setHi((h) => Math.max(0, h - 1))
              } else if (e.key === 'Enter') {
                if (visible && hi >= 0 && shown[hi]) { e.preventDefault(); pick(shown[hi]) } else onEnter?.()
              }
            }}
            placeholder={placeholder}
            className={cn('h-12 w-full rounded-[0.6875rem] border border-[#d9d3c9] bg-white pl-3.5 text-[1rem] text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50', value ? (mic ? 'pr-[4.75rem]' : 'pr-11') : mic ? 'pr-[8.25rem]' : 'pr-[5.75rem]')}
          />
          <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {value ? (
              <button type="button" aria-label="Clear it — pick another" title="Clear it — pick another" onClick={clear} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-wash-2 hover:text-ink"><X className="h-4 w-4" /></button>
            ) : (
              <button type="button" aria-label={listLabel} aria-haspopup="listbox" onClick={() => { if (visible) { setOpen(false); setAll(false) } else { setAll(true); setOpen(true) } box.current?.focus() }} className={cn('inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[0.8125rem] font-semibold text-muted transition hover:bg-wash-2 hover:text-ink', visible && 'bg-wash-2 text-ink')}>
                Pick one<ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
            <Mic onText={(t) => onChange(addSaid(value, t))} size="sm" />
          </span>
        </span>
      </PO.Anchor>
      <PO.Portal>
        <PO.Content
          {...scrollHere}
          role="presentation"
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => { if (wrap.current?.contains(e.target as Node)) e.preventDefault() }}
          className="z-[320] overflow-hidden rounded-[0.75rem] border border-line bg-white p-1 shadow-pop outline-none animate-pop-in"
          style={{ width: 'var(--radix-popover-trigger-width)', maxWidth: 'calc(100vw - 24px)' }}
        >
          <div className="px-2.5 pb-1 pt-1.5 text-[0.71875rem] font-semibold text-muted">{listLabel}</div>
          <div role="listbox" aria-label={listLabel}>
            {shown.map((x, i) => (
              <button
                key={x}
                type="button"
                role="option"
                aria-selected={i === hi}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(x)}
                className={cn('flex w-full items-center rounded-md px-2.5 py-2 text-left text-[0.875rem]', i === hi ? 'bg-wash-2 text-ink' : 'text-ink-2')}
              >
                <span className="min-w-0 flex-1 truncate">{x}</span>
              </button>
            ))}
          </div>
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  )
}
