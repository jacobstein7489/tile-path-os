import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DM from '@radix-ui/react-dropdown-menu'
import * as PO from '@radix-ui/react-popover'
import * as TT from '@radix-ui/react-tooltip'
import { Check } from 'lucide-react'
import { cn } from '@/tileos/lib/utils'
import { CloseButton, Chip, Button } from './core'
import { TODAY, addDays, dow } from '@/tileos/lib/today'

/* ---------------- Center popup ---------------- */
const WIDTHS = {
  sm: 'w-[min(33.75rem,94vw)]',
  md: 'w-[min(43.75rem,94vw)]',
  lg: 'w-[min(56.25rem,95vw)]',
  xl: 'w-[min(75rem,96vw)]',
  full: 'w-[min(93.75rem,calc(100vw-2.5rem))]',
}
/** pinned list headers inside a window sit at the top of its scrolling area */
const INSIDE = { '--app-top': '0px', '--bar': '0px' } as React.CSSProperties
export function Modal({
  level = 0, size = 'md', onClose, title, sub, header, children, footer, bodyClass, tall, className,
}: {
  level?: number
  size?: keyof typeof WIDTHS
  onClose: () => void
  title?: React.ReactNode
  sub?: React.ReactNode
  header?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  bodyClass?: string
  tall?: boolean
  className?: string
}) {
  const z = 60 + level * 4
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 animate-overlay-in backdrop-blur-[0.125rem]" style={{ zIndex: z, background: level ? 'rgba(17,19,24,.18)' : 'rgba(17,19,24,.38)' }} />
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-5 max-sm:items-end max-sm:p-0" style={{ zIndex: z + 1 }}>
          <Dialog.Content
            aria-describedby={undefined}
            /* the pop-up in the middle (Done! · Undo · OK) isn't outside the window — tapping it keeps the window open */
            onPointerDownOutside={(e) => { if ((e.target as Element | null)?.closest?.('[data-center-pop]')) e.preventDefault() }}
            onInteractOutside={(e) => { if ((e.target as Element | null)?.closest?.('[data-center-pop]')) e.preventDefault() }}
            onOpenAutoFocus={(e) => {
              const el = (e.currentTarget as HTMLElement)?.querySelector?.('[data-autofocus]') as HTMLElement | null
              if (el) {
                e.preventDefault()
                el.focus()
              } else {
                e.preventDefault()
              }
            }}
            className={cn(
              'pointer-events-auto relative flex max-h-[92vh] flex-col overflow-hidden rounded-[1rem] bg-white shadow-modal outline-none animate-modal-in max-sm:max-h-[94dvh] max-sm:rounded-b-none',
              WIDTHS[size],
              'max-sm:w-full',
              tall && (size === 'full' ? 'h-[calc(100dvh-2.5rem)] max-h-[calc(100dvh-2.5rem)] max-sm:h-[100dvh] max-sm:max-h-[100dvh]' : 'h-[92vh] max-sm:h-[94dvh]'),
              className,
            )}
          >
            {header ? (
              <>
                {/* big headers scroll away with the content on phones; the close button stays put */}
                <div className="absolute right-4 top-4 z-20 max-sm:right-3 max-sm:top-3">
                  <CloseButton onClick={onClose} className="max-sm:shadow-pop" />
                </div>
                <Dialog.Title className="sr-only">{typeof title === 'string' ? title : 'Details'}</Dialog.Title>
                <div className="scroll-soft flex min-h-0 flex-1 flex-col max-sm:overflow-y-auto" style={INSIDE}>
                  <div className="shrink-0">{header}</div>
                  <div className={cn('scroll-soft min-h-0 flex-1 overflow-y-auto max-sm:flex-none max-sm:overflow-visible', bodyClass ?? 'px-6 py-5 max-sm:px-4 max-sm:py-5', !footer && 'max-sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0))]')}>{children}</div>
                </div>
              </>
            ) : (
              <>
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5 max-sm:px-4 max-sm:pb-3.5 max-sm:pt-4">
                  <div className="min-w-0 pt-0.5">
                    <Dialog.Title className="font-display text-[1.25rem] font-semibold leading-tight tracking-[-0.01em] text-ink max-sm:text-[1.125rem]">{title}</Dialog.Title>
                    {sub && <div className="mt-0.5 text-[0.875rem] text-muted max-sm:text-[0.84375rem]">{sub}</div>}
                  </div>
                  <CloseButton onClick={onClose} />
                </div>
                <div className={cn('scroll-soft min-h-0 flex-1 overflow-y-auto', bodyClass ?? 'px-6 py-5 max-sm:px-4 max-sm:py-5', !footer && 'max-sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0))]')} style={INSIDE}>{children}</div>
              </>
            )}
            {footer && <div className="flex shrink-0 items-center gap-2.5 border-t border-line bg-white px-6 py-3.5 max-sm:flex-wrap max-sm:gap-2 max-sm:px-4 max-sm:pb-[calc(0.875rem+env(safe-area-inset-bottom,0))] max-sm:pt-3 max-sm:[&>span]:w-full max-sm:[&>span]:text-[0.78125rem]">{footer}</div>}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ---------------- Menus ---------------- */
export function Menu({ trigger, children, align = 'end', width = 248 }: { trigger: React.ReactNode; children: React.ReactNode; align?: 'start' | 'end' | 'center'; width?: number }) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content align={align} sideOffset={6} collisionPadding={12} className="scroll-soft z-[300] max-h-[min(28.75rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto overscroll-contain rounded-[0.625rem] border border-line bg-white p-1 shadow-pop animate-pop-in" style={{ width: typeof width === 'number' ? `${width / 16}rem` : width, maxWidth: 'calc(100vw - 24px)' }}>
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}
export function MenuItem({ icon, children, onSelect, hint, danger, checked }: { icon?: React.ReactNode; children: React.ReactNode; onSelect?: () => void; hint?: React.ReactNode; danger?: boolean; checked?: boolean }) {
  return (
    <DM.Item
      onSelect={(e) => {
        onSelect?.()
      }}
      className={cn(
        'flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[0.875rem] outline-none data-[highlighted]:bg-wash-2',
        danger ? 'text-bad-600' : 'text-ink-2 data-[highlighted]:text-ink',
      )}
    >
      {icon && <span className="inline-flex w-5 justify-center text-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {hint && <span className="block truncate text-[0.78125rem] font-normal text-muted">{hint}</span>}
      </span>
      {checked && <Check className="h-4 w-4 text-brand-600" strokeWidth={2.5} />}
    </DM.Item>
  )
}
export function MenuCheck({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <DM.CheckboxItem
      checked={checked}
      onCheckedChange={(v) => onChange(!!v)}
      onSelect={(e) => e.preventDefault()}
      className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[0.875rem] text-ink-2 outline-none data-[highlighted]:bg-wash-2"
    >
      <span className={cn('inline-flex h-4 w-4 items-center justify-center rounded-[0.25rem] border-[0.09375rem]', checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#C9CFC7] bg-white')}>
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {children}
    </DM.CheckboxItem>
  )
}
export const MenuLabel = ({ children }: { children: React.ReactNode }) => <DM.Label className="px-2.5 pb-1 pt-1.5 text-[0.75rem] font-medium text-muted">{children}</DM.Label>
export const MenuSep = () => <DM.Separator className="my-1 h-px bg-line-2" />

/* ---------------- Popover ---------------- */
export function Pop({ trigger, children, align = 'start', side = 'bottom', width = 340, open, onOpenChange }: { trigger: React.ReactNode; children: React.ReactNode; align?: 'start' | 'end' | 'center'; side?: 'top' | 'bottom' | 'left' | 'right'; width?: number; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  return (
    <PO.Root open={open} onOpenChange={onOpenChange}>
      <PO.Trigger asChild>{trigger}</PO.Trigger>
      <PO.Portal>
        <PO.Content align={align} side={side} sideOffset={6} collisionPadding={16} className="z-[300] rounded-xl border border-line bg-white p-4 shadow-pop outline-none animate-pop-in" style={{ width: typeof width === 'number' ? `${width / 16}rem` : width, maxWidth: 'calc(100vw - 24px)' }}>
          {children}
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  )
}

/* ---------------- Tooltip ---------------- */
export function Tip({ label, children, side = 'top' }: { label: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TT.Root delayDuration={250}>
      <TT.Trigger asChild>{children}</TT.Trigger>
      <TT.Portal>
        <TT.Content side={side} sideOffset={6} className="z-[400] max-w-[16.25rem] rounded-md bg-ink px-2 py-1 text-[0.78125rem] text-white shadow-pop animate-pop-in">
          {label}
        </TT.Content>
      </TT.Portal>
    </TT.Root>
  )
}
export const TipProvider = TT.Provider

/* ---------------- Date + waiting pickers (the three task moves) ---------------- */
const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DATE_PRESETS = (() => {
  const out = ['Today', 'Tomorrow']
  for (let i = 2; out.length < 5 && i < 9; i++) { const d = addDays(TODAY, i); const w = dow(d); if (w > 0 && w < 6 && w !== 1) out.push(NAMES[w]) }
  return [...out, 'Next Mon', 'In 2 weeks']
})()

export function DatePresets({ value, onPick, presets = DATE_PRESETS }: { value?: string; onPick: (v: string) => void; presets?: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => (
        <Chip key={p} on={value === p} onClick={() => onPick(p)} className="h-9 px-3 text-[0.84375rem]">
          {p}
        </Chip>
      ))}
      <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[0.5625rem] border border-dashed border-[#CDD4DE] px-3 text-[0.84375rem] font-semibold text-muted hover:bg-wash">
        Pick a date
        <input
          type="date"
          className="w-0 opacity-0"
          onChange={(e) => {
            if (!e.target.value) return
            const d = new Date(e.target.value + 'T12:00:00')
            onPick(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
          }}
        />
      </label>
    </div>
  )
}

export const WAIT_WHO = ['GC', 'Client', 'Designer', 'Supplier', 'Tile store', 'Plumber', 'Someone inside']

export function WaitPicker({ onSave, defaultWho, onCancel }: { onSave: (who: string, back: string) => void; defaultWho?: string; onCancel?: () => void }) {
  const [who, setWho] = React.useState(defaultWho || '')
  const [back, setBack] = React.useState('Tomorrow')
  return (
    <div>
      <div className="text-[0.90625rem] font-semibold text-ink">Who are we waiting on?</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {WAIT_WHO.map((w) => (
          <Chip key={w} on={who === w} onClick={() => setWho(w)} className="h-9 px-3 text-[0.84375rem]">
            {w}
          </Chip>
        ))}
      </div>
      <div className="mt-4 text-[0.90625rem] font-semibold text-ink">Bring it back</div>
      <div className="mt-3">
        <DatePresets value={back} onPick={setBack} presets={['Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon']} />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button size="sm" variant="primary" disabled={!who} onClick={() => onSave(who, back)}>
          Save
        </Button>
      </div>
    </div>
  )
}

export function LaterPicker({ onSave, onCancel }: { onSave: (until: string) => void; onCancel?: () => void }) {
  const [when, setWhen] = React.useState('Next Mon')
  return (
    <div>
      <div className="text-[0.90625rem] font-semibold text-ink">Not today — bring it back</div>
      <div className="mt-1 text-[0.8125rem] text-muted">It leaves your list and returns on that day.</div>
      <div className="mt-3">
        <DatePresets value={when} onPick={setWhen} presets={['Tomorrow', 'Thu', 'Fri', 'Next Mon', 'In 2 weeks']} />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button size="sm" variant="primary" onClick={() => onSave(when)}>
          Save
        </Button>
      </div>
    </div>
  )
}
