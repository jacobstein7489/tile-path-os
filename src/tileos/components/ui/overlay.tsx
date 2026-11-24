import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DM from '@radix-ui/react-dropdown-menu'
import * as CM from '@radix-ui/react-context-menu'
import * as PO from '@radix-ui/react-popover'
import * as TT from '@radix-ui/react-tooltip'
import { Check, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/tileos/lib/utils'
import { CloseButton, Chip, Button } from './core'
import { TODAY, addDays, dow, isoFromLabel, labelFromIso, pickedLabel, dayShort } from '@/tileos/lib/today'
import { useSmall } from '@/tileos/lib/phone'

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
  level = 0, size = 'md', onClose, title, sub, header, children, footer, footerClass, bodyClass, tall, className, inlineClose,
}: {
  /** a phone: the ✕ sits on the header's own first line (top right) — no bar of its own above it; once the header has
   *  scrolled away it becomes a bar with the window's name */
  inlineClose?: boolean
  level?: number
  size?: keyof typeof WIDTHS
  onClose: () => void
  title?: React.ReactNode
  sub?: React.ReactNode
  header?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  /** more for the bottom bar — e.g. hide it while nothing's in it */
  footerClass?: string
  bodyClass?: string
  tall?: boolean
  className?: string
}) {
  const z = 60 + level * 4
  /* a window opened from another window: Back takes you to that one — never closed and opened again */
  const stacked = level > 0
  const inline = !!inlineClose && !stacked
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
        {/* a phone: every window the same — from just under the top of the screen to the bottom, its content at the top.
            The keyboard coming up, a list opening inside it, a box growing: nothing moves — the keyboard only covers the
            bottom of the window (the buttons at its bottom ride on top of the keyboard) */}
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-5 max-sm:items-start max-sm:p-0" style={{ zIndex: z + 1 }} data-modal-frame>
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
            /* Esc while changing words in place puts the words back — it doesn't close the window */
            onEscapeKeyDown={(e) => { if ((document.activeElement as Element | null)?.closest?.('[data-editing]')) e.preventDefault() }}
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              const el = (e.currentTarget as HTMLElement)?.querySelector?.('[data-autofocus]') as HTMLElement | null
              /* on a phone a box doesn't take the cursor by itself — the keyboard would cover the window before
                 anything's picked; you tap the box you want to type in */
              const phone = window.matchMedia('(max-width: 639.98px)').matches && window.matchMedia('(pointer: coarse)').matches
              if (el && !(phone && /^(INPUT|TEXTAREA)$/.test(el.tagName))) el.focus()
            }}
            className={cn(
              'pointer-events-auto relative flex max-h-[92vh] flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-modal outline-none animate-modal-in max-sm:mt-[calc(env(safe-area-inset-top,0px)+0.625rem)] max-sm:h-[calc(100%-env(safe-area-inset-top,0px)-0.625rem)] max-sm:max-h-none max-sm:rounded-b-none',
              hidden && 'invisible pointer-events-none',
              WIDTHS[size],
              'max-sm:w-full',
              tall && (size === 'full' ? 'h-[calc(100dvh-2.5rem)] max-h-[calc(100dvh-2.5rem)] max-sm:mt-0 max-sm:h-full max-sm:rounded-none' : 'h-[92vh]'),
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
                <div className={cn('hidden shrink-0 items-center gap-3 bg-white pb-1 pl-4 pr-3 pt-2.5 max-sm:flex', tall && size === 'full' && 'pt-[max(0.5rem,env(safe-area-inset-top,0px))]', inline && 'max-sm:absolute max-sm:inset-x-0 max-sm:top-0 max-sm:z-20 max-sm:transition-colors', inline && !past && 'max-sm:pointer-events-none max-sm:bg-transparent', inline && past && 'max-sm:shadow-[0_1px_0_rgba(20,26,36,.08)]')} data-phone-bar>
                  {stacked && back}
                  <span className={cn('min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink transition-opacity duration-150', !past && 'opacity-0')} aria-hidden={!past} data-phone-bar-title>{(tall || inline) && typeof title === 'string' ? title : ''}</span>
                  {!stacked && <CloseButton onClick={onClose} className={inline ? 'pointer-events-auto' : undefined} />}
                </div>
                <Dialog.Title className="sr-only">{typeof title === 'string' ? title : 'Details'}</Dialog.Title>
                <div className="scroll-soft flex min-h-0 flex-1 flex-col max-sm:overflow-y-auto" style={INSIDE} onScroll={tall || inline ? onScroll : undefined}>
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
            {/* the bottom bar — the same on every window: a hairline over it, and every button a real button (the main
                one blue, the others white with a thin edge — never gray words) */}
            {footer && <div className={cn("flex shrink-0 items-center gap-2.5 border-t border-line-2 bg-white px-6 py-4 max-sm:flex-wrap [&_button[data-variant=ghost]]:border [&_button[data-variant=ghost]]:border-[#d9d3c9] [&_button[data-variant=ghost]]:bg-white [&_button[data-variant=ghost]]:shadow-xs [&_button[data-variant=ghost]:hover]:border-[#c9c2b7] [&_button[data-variant=ghost]:hover]:bg-wash max-sm:items-stretch max-sm:gap-2 max-sm:px-4 max-sm:pb-[calc(0.875rem+env(safe-area-inset-bottom,0))] max-sm:pt-3 max-sm:[&>span]:w-full max-sm:[&>span]:text-[0.78125rem] max-sm:[&>button]:ml-0 max-sm:[&>button]:h-auto max-sm:[&>button]:min-h-11 max-sm:[&>button]:flex-1 max-sm:[&>button]:basis-0 max-sm:[&>button]:min-w-fit max-sm:[&>div[aria-hidden]:empty]:hidden max-sm:[&>button]:whitespace-normal max-sm:[&>button]:py-2 max-sm:[&>button]:text-center max-sm:[&:has(>button:nth-of-type(3))]:flex-col max-sm:[&:has(>button:nth-of-type(3))>button]:basis-auto", footerClass)} data-modal-footer>{footer}</div>}
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
      {/* the words whole — a long one takes a second line, never cut off */}
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block break-words">{children}</span>
        {hint && <span className="block break-words text-[0.78125rem] font-normal text-muted">{hint}</span>}
      </span>
      {checked && <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
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
export function Pop({ trigger, children, align = 'start', side = 'bottom', width = 340, open, onOpenChange, onEscape, className, sheet }: { trigger: React.ReactNode; children: React.ReactNode; align?: 'start' | 'end' | 'center'; side?: 'top' | 'bottom' | 'left' | 'right'; width?: number; open?: boolean; onOpenChange?: (v: boolean) => void; /** Esc: before it closes (to leave what was picked) */ onEscape?: () => void; className?: string; /** a phone: it comes up from the bottom, the whole width (a calendar — too tall to hang off a line) */ sheet?: boolean }) {
  const small = useSmall()
  if (sheet && small) return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[300] animate-overlay-in bg-[rgba(17,19,24,.3)]" />
        <Dialog.Content aria-describedby={undefined} onEscapeKeyDown={onEscape ? () => onEscape() : undefined} onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn('fixed inset-x-0 bottom-0 z-[301] max-h-[90dvh] overflow-y-auto rounded-t-[1.25rem] bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-modal outline-none animate-modal-in', className)} data-pop-sheet>
          <Dialog.Title className="sr-only">Pick</Dialog.Title>
          <span className="mx-auto mt-1.5 block h-1 w-9 rounded-full bg-[#d9d4cb]" aria-hidden />
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
  return (
    <PO.Root open={open} onOpenChange={onOpenChange}>
      <PO.Trigger asChild>{trigger}</PO.Trigger>
      <PO.Portal>
        <PO.Content {...scrollHere} align={align} side={side} sideOffset={6} collisionPadding={16} onEscapeKeyDown={onEscape ? () => onEscape() : undefined} className={cn('z-[300] rounded-xl border border-line bg-white p-4 shadow-pop outline-none animate-pop-in', className)} style={{ width: typeof width === 'number' ? `${width / 16}rem` : width, maxWidth: 'calc(100vw - 24px)' }}>
          {children}
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  )
}

/* ---------------- a calendar and the times of a day ---------------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const ym = (iso: string) => iso.slice(0, 7)
/** a month to pick a day from, like any calendar: Sunday first (like a wall calendar), today ringed, the day picked
 *  filled, days gone by faded and not picked */
export function MonthCal({ value, onPick, min = TODAY, className, big }: { value?: string; onPick: (iso: string) => void; min?: string; className?: string; /** roomy: big days to tap (a start or a finish) */ big?: boolean }) {
  const [at, setAt] = React.useState(ym(value || TODAY))
  React.useEffect(() => { if (value) setAt(ym(value)) }, [value])
  const y = +at.slice(0, 4)
  const m = +at.slice(5, 7)
  const lead = dow(`${at}-01`)
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: n }, (_, i) => `${at}-${String(i + 1).padStart(2, '0')}`)]
  while (cells.length % 7) cells.push(null)
  const go = (k: number) => { const d = new Date(Date.UTC(y, m - 1 + k, 1)); setAt(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`) }
  const arrow = cn('inline-flex items-center justify-center rounded-full text-ink-2 transition hover:bg-wash-2 disabled:opacity-30 disabled:hover:bg-transparent', big ? 'h-10 w-10' : 'h-8 w-8')
  return (
    <div className={cn('select-none', className)} data-month-cal={at} {...(big ? { 'data-cal-big': '' } : {})}>
      <div className={cn('flex items-center justify-between pl-1', big ? 'mb-2' : 'mb-1')}>
        <span className={cn('font-semibold text-ink', big ? 'text-[1.125rem]' : 'text-[0.9375rem]')} data-cal-month>{MONTHS[m - 1]} {y}</span>
        <span className="flex items-center">
          <button type="button" onClick={() => go(-1)} disabled={at <= ym(min)} aria-label="The month before" className={arrow} data-cal-prev><ChevronLeft className={big ? 'h-5 w-5' : 'h-4 w-4'} /></button>
          <button type="button" onClick={() => go(1)} aria-label="The next month" className={arrow} data-cal-next><ChevronRight className={big ? 'h-5 w-5' : 'h-4 w-4'} /></button>
        </span>
      </div>
      <div className={cn('grid grid-cols-7 text-center font-semibold uppercase tracking-[0.06em] text-faint', big ? 'text-[0.75rem]' : 'text-[0.6875rem]')} aria-hidden>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className={big ? 'py-1.5' : 'py-1'}>{d}</span>)}
      </div>
      <div className={cn('grid grid-cols-7', big ? 'gap-y-1' : 'gap-y-0.5')}>
        {cells.map((iso, i) => {
          if (!iso) return <span key={'x' + i} />
          const on = iso === value
          const past = iso < min
          return (
            <button key={iso} type="button" disabled={past && !on} onClick={() => onPick(iso)} aria-pressed={on} aria-label={iso} data-cal-day={iso}
              className={cn('mx-auto inline-flex items-center justify-center rounded-full tnum transition', big ? 'aspect-square w-full max-w-12 text-[1.0625rem]' : 'h-9 w-9 text-[0.875rem] max-sm:text-[0.9375rem]',
                on ? 'bg-brand-600 font-semibold text-white shadow-[0_0.375rem_0.875rem_-0.5rem_rgba(38,80,207,.9)]'
                  : past ? 'text-[#cbc6bd]'
                    : iso === TODAY ? 'font-semibold text-brand-700 ring-1 ring-inset ring-brand-300 hover:bg-brand-50'
                      : 'text-ink hover:bg-wash-2')}>
              {+iso.slice(8)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
/** a day to pick (a start, a finish): the day in words on a field, and a big calendar under it — a phone: it comes up
 *  from the bottom. min: the first day it can be (none: any day, one gone by too, for a job that's already going) */
export function DateField({ value, onChange, onClear, min, label, placeholder = 'Pick a day', className, ...rest }: { value?: string; onChange: (iso: string) => void; /** no day at all — "No day" under the calendar */ onClear?: () => void; min?: string; label: string; placeholder?: string; className?: string } & { [k: `data-${string}`]: string | undefined }) {
  const [open, setOpen] = React.useState(false)
  /* "Mon, Nov 30" (and its year when it isn't this one) */
  const words = value ? `${dayShort(value)}${value.slice(0, 4) !== TODAY.slice(0, 4) ? `, ${value.slice(0, 4)}` : ''}` : ''
  return (
    <Pop open={open} onOpenChange={setOpen} sheet width={392} align="start" trigger={
      <button type="button" aria-label={label} data-value={value || ''} {...rest}
        className={cn('flex h-11 w-full min-w-0 items-center gap-2.5 rounded-[0.625rem] border border-line bg-white px-3 text-left text-[0.9375rem] text-ink transition hover:border-[#cdc7bc] focus-visible:border-brand-300 focus-visible:outline-none', open && 'border-brand-300 ring-[0.1875rem] ring-brand-50', className)}>
        <CalendarDays className="h-[1.125rem] w-[1.125rem] shrink-0 text-faint" />
        <span className={cn('min-w-0 flex-1 truncate', !value && 'text-faint')}>{words || placeholder}</span>
      </button>
    }>
      <div className="p-1 max-sm:px-5 max-sm:pb-6 max-sm:pt-3" data-date-cal>
        <div className="mb-2 text-[0.9375rem] font-semibold text-muted">{label}</div>
        <MonthCal big value={value} min={min || '1900-01-01'} onPick={(iso) => { onChange(iso); setOpen(false) }} />
        {onClear && value && <div className="mt-1 flex justify-end"><button type="button" onClick={() => { onClear(); setOpen(false) }} className="rounded-full px-3 py-1.5 text-[0.875rem] font-semibold text-muted transition hover:bg-wash hover:text-ink" data-date-clear>No day</button></div>}
      </div>
    </Pop>
  )
}

/** the times of a day: the one picked filled; it opens on that one (or 9 in the morning). A column beside the calendar
 *  on a computer, a row under it on a phone */
export function TimeList({ value, times, anyTime, onPick }: { value?: string; times: string[]; anyTime?: boolean; onPick: (t?: string) => void }) {
  const box = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    const el = box.current
    const on = (el?.querySelector('[data-time-on]') || el?.querySelector('[data-time="9:00 AM"]')) as HTMLElement | null
    if (!el || !on) return
    if (el.scrollHeight > el.clientHeight + 2) el.scrollTop = on.offsetTop - el.clientHeight / 2 + on.offsetHeight / 2
    if (el.scrollWidth > el.clientWidth + 2) el.scrollLeft = on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2
  }, [])
  const btn = (on: boolean) => cn('shrink-0 rounded-lg px-3 text-left text-[0.875rem] tnum transition sm:h-9 max-sm:inline-flex max-sm:h-10 max-sm:items-center max-sm:rounded-full max-sm:border',
    on ? 'bg-brand-600 font-semibold text-white max-sm:border-brand-600' : 'text-ink hover:bg-wash-2 max-sm:border-line')
  return (
    <div ref={box} className="no-scrollbar relative flex gap-0.5 sm:max-h-[17.75rem] sm:flex-col sm:overflow-y-auto max-sm:gap-1.5 max-sm:overflow-x-auto" role="listbox" aria-label="The time" data-time-list>
      {anyTime && <button type="button" role="option" aria-selected={!value} onClick={() => onPick(undefined)} className={cn(btn(!value), !value ? '' : 'text-muted')} data-time="" {...(!value ? { 'data-time-on': '' } : {})}>Any time</button>}
      {times.map((t) => <button key={t} type="button" role="option" aria-selected={t === value} onClick={() => onPick(t)} className={btn(t === value)} data-time={t} {...(t === value ? { 'data-time-on': '' } : {})}>{t}</button>)}
    </div>
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
  /* the usual days as one tap each; any other day from the calendar, right here (no second window) */
  const [cal, setCal] = React.useState(false)
  const iso = isoFromLabel(value)
  const other = !!value && !presets.includes(value)
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Chip key={p} on={value === p} onClick={() => onPick(p)} className="h-9 px-3 text-[0.84375rem]">
            {p}
          </Chip>
        ))}
        <Chip on={other} onClick={() => setCal(!cal)} icon={<CalendarDays className="h-4 w-4" />} className="h-9 px-3 text-[0.84375rem]">{other && iso ? labelFromIso(iso) : 'Pick a date'}</Chip>
      </div>
      {cal && <MonthCal value={iso} onPick={(d) => { setCal(false); onPick(pickedLabel(d)) }} className="mt-3 max-w-[18.5rem]" />}
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
      <div className="text-[0.90625rem] font-semibold text-ink">Not today. Bring it back</div>
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
