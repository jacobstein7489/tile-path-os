import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DM from '@radix-ui/react-dropdown-menu'
import * as CM from '@radix-ui/react-context-menu'
import * as PO from '@radix-ui/react-popover'
import * as TT from '@radix-ui/react-tooltip'
import { Check, ChevronLeft } from 'lucide-react'
import { cn } from '@/tileos/lib/utils'
import { CloseButton, Chip, Button } from './core'
import { TODAY, addDays, dow } from '@/tileos/lib/today'

/* ---------------- Center popup ---------------- */
const WIDTHS = {
  sm: 'w-[min(33.75rem,94vw)]',
  md: 'w-[min(43.75rem,94vw)]',
  lg: 'w-[min(56.25rem,95vw)]',
  xl: 'w-[min(75rem,96vw)]',
  /* a project, an estimate: big, in the middle — on a wide screen, even margins on both sides like the pages */
  full: 'w-[min(80rem,calc(100vw-2.5rem))]',
}
/** pinned list headers inside a window sit at the top of its scrolling area */
const INSIDE = { '--app-top': '0px', '--bar': '0px', '--head': '0px' } as React.CSSProperties

/* One window at a time: a small window opened from another small one takes its place — the one under it hides until
 * Back. A big one (a project, an estimate) stays behind, dimmed, like a page. Every open window says its level here. */
type Win = { level: number; size: keyof typeof WIDTHS }
const wins = new Map<string, Win>()
const winSubs = new Set<() => void>()
let winVer = 0
const winsChanged = () => { winVer++; winSubs.forEach((f) => f()) }
const smallWin = (w?: Win) => !!w && (w.size === 'sm' || w.size === 'md')
function useWinStack(level: number, size: keyof typeof WIDTHS) {
  const id = React.useId()
  React.useLayoutEffect(() => {
    wins.set(id, { level, size })
    winsChanged()
    return () => { wins.delete(id); winsChanged() }
  }, [id, level, size])
  React.useSyncExternalStore((f) => { winSubs.add(f); return () => { winSubs.delete(f) } }, () => winVer, () => winVer)
  const all = Array.from(wins.entries()).filter(([k]) => k !== id).map(([, w]) => w)
  const above = all.some((w) => w.level > level)
  const below = all.filter((w) => w.level < level).sort((a, b) => b.level - a.level)[0]
  return {
    /* covered by another window: hidden until that one closes */
    hidden: above && smallWin({ level, size }),
    /* the window under this one is hidden — its shade is already there; no second, darker one */
    noShade: !!below && smallWin(below),
  }
}
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
  /* a window opened from another window: Back takes you to that one — never closed and opened again */
  const stacked = level > 0
  const { hidden, noShade } = useWinStack(level, size)
  /* a phone: pull the window down by its top to close it — like any app */
  const sheet = React.useRef<HTMLDivElement | null>(null)
  const drag = React.useRef<{ y0: number; dy: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const el = sheet.current
    if (!el || !window.matchMedia('(max-width: 639.98px)').matches) return
    const top = el.getBoundingClientRect().top
    if (e.touches[0].clientY - top > 72) return
    drag.current = { y0: e.touches[0].clientY, dy: 0 }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current
    const el = sheet.current
    if (!d || !el) return
    d.dy = Math.max(0, e.touches[0].clientY - d.y0)
    el.style.transition = 'none'
    el.style.transform = d.dy ? `translateY(${d.dy}px)` : ''
  }
  const onTouchEnd = () => {
    const d = drag.current
    const el = sheet.current
    drag.current = null
    if (!d || !el) return
    if (d.dy > 90) { onClose(); return }
    el.style.transition = 'transform 180ms ease-out'
    el.style.transform = ''
  }
  const back = <button type="button" onClick={onClose} aria-label="Back" data-back className="-ml-1.5 inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full pl-1 pr-3 text-[0.875rem] font-semibold text-ink-2 transition hover:bg-wash-2 hover:text-ink"><ChevronLeft className="h-[1.125rem] w-[1.125rem]" />Back</button>
  /* a phone shows the window's name on its top bar only once the window's own header has scrolled away — never the
     name twice on the screen */
  const headRef = React.useRef<HTMLDivElement>(null)
  const [past, setPast] = React.useState(false)
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => { const p = e.currentTarget.scrollTop > Math.max(32, (headRef.current?.offsetHeight || 0) - 24); if (p !== past) setPast(p) }
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn('fixed inset-0 animate-overlay-in', !noShade && 'backdrop-blur-[0.125rem]')} style={{ zIndex: z, background: noShade ? 'transparent' : level ? 'rgba(17,19,24,.18)' : 'rgba(17,19,24,.38)' }} />
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-5 max-sm:items-end max-sm:p-0" style={{ zIndex: z + 1 }} data-modal-frame>
          <Dialog.Content
            aria-describedby={undefined}
            data-stacked={stacked ? '' : undefined}
            data-covered={hidden ? '' : undefined}
            aria-hidden={hidden || undefined}
            ref={sheet}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
            /* the pop-up in the middle (Done! · Undo · OK) isn't outside the window — tapping it keeps the window open */
            onPointerDownOutside={(e) => { if ((e.target as Element | null)?.closest?.('[data-center-pop]')) e.preventDefault() }}
            onInteractOutside={(e) => { if ((e.target as Element | null)?.closest?.('[data-center-pop]')) e.preventDefault() }}
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              const el = (e.currentTarget as HTMLElement)?.querySelector?.('[data-autofocus]') as HTMLElement | null
              /* on a phone a box doesn't take the cursor by itself — the keyboard would cover the window before
                 anything's picked; you tap the box you want to type in */
              const phone = window.matchMedia('(max-width: 639.98px)').matches && window.matchMedia('(pointer: coarse)').matches
              if (el && !(phone && /^(INPUT|TEXTAREA)$/.test(el.tagName))) el.focus()
            }}
            className={cn(
              'pointer-events-auto relative flex max-h-[92vh] flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-modal outline-none animate-modal-in max-sm:max-h-[94dvh] max-sm:rounded-b-none',
              hidden && 'invisible pointer-events-none',
              WIDTHS[size],
              'max-sm:w-full',
              tall && (size === 'full' ? 'h-[calc(100dvh-2.5rem)] max-h-[calc(100dvh-2.5rem)] max-sm:h-[100dvh] max-sm:max-h-[100dvh]' : 'h-[92vh] max-sm:h-[94dvh]'),
              className,
            )}
          >
            {/* a phone: the handle on top says it slides down to close */}
            <span className="pointer-events-none absolute left-1/2 top-1.5 z-30 h-1 w-9 -translate-x-1/2 rounded-full bg-[#d9d4cb] sm:hidden" aria-hidden data-grabber />
            {header ? (
              <>
                {/* big headers scroll away with the content on phones; the way out stays put — on a computer the × in the
                    corner, on a phone a bar on top with a real Close button (and the window's name, on the big ones) */}
                {stacked ? <div className="shrink-0 px-6 pt-3.5 max-sm:hidden">{back}</div> : (
                  <div className="absolute right-4 top-4 z-20 max-sm:hidden">
                    <CloseButton onClick={onClose} />
                  </div>
                )}
                <div className={cn('hidden shrink-0 items-center gap-3 bg-white pb-1 pl-4 pr-3 pt-2.5 max-sm:flex', tall && size === 'full' && 'pt-[max(0.5rem,env(safe-area-inset-top,0px))]')} data-phone-bar>
                  {stacked && back}
                  <span className={cn('min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink transition-opacity duration-150', !past && 'opacity-0')} aria-hidden={!past} data-phone-bar-title>{tall && typeof title === 'string' ? title : ''}</span>
                  {!stacked && <CloseButton onClick={onClose} />}
                </div>
                <Dialog.Title className="sr-only">{typeof title === 'string' ? title : 'Details'}</Dialog.Title>
                <div className="scroll-soft flex min-h-0 flex-1 flex-col max-sm:overflow-y-auto" style={INSIDE} onScroll={tall ? onScroll : undefined}>
                  <div className="shrink-0" ref={headRef}>{header}</div>
                  <div className={cn('scroll-soft min-h-0 flex-1 overflow-y-auto max-sm:flex-none max-sm:overflow-visible', bodyClass ?? 'px-6 py-5 max-sm:px-4 max-sm:py-5', !footer && 'max-sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0))]')}>{children}</div>
                </div>
              </>
            ) : (
              <>
                {stacked && <div className="shrink-0 px-6 pt-3.5 max-sm:px-4 max-sm:pt-2.5">{back}</div>}
                <div className={cn('flex shrink-0 items-start justify-between gap-4 px-6 pb-1 pt-5 max-sm:px-4 max-sm:pb-0 max-sm:pt-4', stacked && 'pt-1.5 max-sm:pt-1.5')}>
                  <div className="min-w-0 pt-0.5">
                    <Dialog.Title className="font-display text-[1.25rem] font-semibold leading-tight tracking-[-0.01em] text-ink max-sm:text-[1.125rem]">{title}</Dialog.Title>
                    {sub && <div className="mt-0.5 text-[0.875rem] text-muted max-sm:text-[0.84375rem]">{sub}</div>}
                  </div>
                  {!stacked && <CloseButton onClick={onClose} />}
                </div>
                <div className={cn('scroll-soft min-h-0 flex-1 overflow-y-auto', bodyClass ?? 'px-6 pb-5 pt-4 max-sm:px-4 max-sm:pb-5 max-sm:pt-4', !footer && 'max-sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0))]')} style={INSIDE}>{children}</div>
              </>
            )}
            {footer && <div className="flex shrink-0 items-center gap-2.5 bg-white px-6 pb-5 pt-2.5 max-sm:flex-wrap max-sm:items-stretch max-sm:gap-2 max-sm:px-4 max-sm:pb-[calc(0.875rem+env(safe-area-inset-bottom,0))] max-sm:pt-3 max-sm:[&>span]:w-full max-sm:[&>span]:text-[0.78125rem] max-sm:[&>button]:ml-0 max-sm:[&>button]:h-auto max-sm:[&>button]:min-h-11 max-sm:[&>button]:flex-1 max-sm:[&>button]:basis-0 max-sm:[&>button]:whitespace-normal max-sm:[&>button]:py-2 max-sm:[&>button]:text-center max-sm:[&:has(>button:nth-of-type(3))]:flex-col max-sm:[&:has(>button:nth-of-type(3))>button]:basis-auto" data-modal-footer>{footer}</div>}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** a dropdown sits outside the window it opens from (on top of everything), and the window keeps the page behind it
 *  from scrolling — which also stopped a long list in the dropdown from scrolling with the wheel or a finger. These
 *  keep the scroll inside the dropdown, so its list scrolls like any other. */
export const scrollHere = {
  onWheel: (e: React.WheelEvent) => e.stopPropagation(),
  onTouchMove: (e: React.TouchEvent) => e.stopPropagation(),
}

/* ---------------- Menus ---------------- */
export function Menu({ trigger, children, align = 'end', width = 248 }: { trigger: React.ReactNode; children: React.ReactNode; align?: 'start' | 'end' | 'center'; width?: number }) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content {...scrollHere} align={align} sideOffset={6} collisionPadding={12} className="scroll-soft z-[300] max-h-[min(28.75rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto overscroll-contain rounded-[0.625rem] border border-line bg-white p-1 shadow-pop animate-pop-in" style={{ width: typeof width === 'number' ? `${width / 16}rem` : width, maxWidth: 'calc(100vw - 24px)' }}>
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}
export function MenuItem({ icon, children, onSelect, hint, danger, checked, ...rest }: { icon?: React.ReactNode; children: React.ReactNode; onSelect?: () => void; hint?: React.ReactNode; danger?: boolean; checked?: boolean } & { [k: `data-${string}`]: string | boolean | undefined }) {
  return (
    <DM.Item
      {...rest}
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
        <PO.Content {...scrollHere} align={align} side={side} sideOffset={6} collisionPadding={16} className="z-[300] rounded-xl border border-line bg-white p-4 shadow-pop outline-none animate-pop-in" style={{ width: typeof width === 'number' ? `${width / 16}rem` : width, maxWidth: 'calc(100vw - 24px)' }}>
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

export const WAIT_WHO = ['GC', 'Installer', 'Client', 'Designer', 'Supplier', 'Tile store', 'Plumber', 'Someone inside']

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

/** a right-click menu (a long press on a phone) around anything — the same few things its ··· menu has */
export type RightItem = { icon?: React.ReactNode; label: string; hint?: string; onSelect: () => void; danger?: boolean }
export function RightMenu({ children, items }: { children: React.ReactNode; items: (RightItem | null | false | undefined)[] }) {
  const list = items.filter(Boolean) as RightItem[]
  return (
    <CM.Root modal={false}>
      <CM.Trigger asChild>{children}</CM.Trigger>
      <CM.Portal>
        <CM.Content collisionPadding={12} className="z-[300] min-w-[13.5rem] rounded-[0.625rem] border border-line bg-white p-1 shadow-pop animate-pop-in" data-right-menu>
          {list.map((it) => (
            <CM.Item key={it.label} onSelect={it.onSelect} className={cn('flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[0.875rem] outline-none data-[highlighted]:bg-wash-2', it.danger ? 'text-bad-600' : 'text-ink-2 data-[highlighted]:text-ink')}>
              {it.icon && <span className="inline-flex w-5 justify-center text-muted">{it.icon}</span>}
              <span className="min-w-0 flex-1"><span className="block truncate">{it.label}</span>{it.hint && <span className="block truncate text-[0.78125rem] text-muted">{it.hint}</span>}</span>
            </CM.Item>
          ))}
        </CM.Content>
      </CM.Portal>
    </CM.Root>
  )
}
