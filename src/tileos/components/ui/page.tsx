/* The page template every module uses (v10 — the first version's look, polished):
 *   big bold title on the gray ground, one line under it ............ actions
 *   [optional: the flow strip — where everything stands, with counts]
 *   one white card: tab chips and filters on top, then the list
 *   [optional: a side card]
 * Rows have a visual anchor (icon tile, progress ring, date leaf or initials), a bold title,
 * one line of details, and a few aligned facts on the right. */
import * as React from 'react'
import { ChevronDown, ChevronRight, Check, X, CircleCheck, CircleDashed, CircleAlert, CircleDot, Minus, Lock } from 'lucide-react'
import * as DM from '@radix-ui/react-dropdown-menu'
import { cn } from '@/tileos/lib/utils'
import { SearchField, Avatar } from './core'
import type { Tone, PersonKey } from '@/tileos/data/model'
import { scrollHere } from './overlay'

/** side padding inside a card; rows line up with it */
export const PX = 'px-5 max-sm:px-4'
/** a list's column-name row: it stays pinned under the toolbar while the rows scroll */
export const STICKY_HEAD = 'sticky top-[calc(var(--app-top,0px)+var(--bar,0px))] lg:top-[calc(var(--app-top,0px)+var(--head,0px)+var(--bar,0px))] z-[5]'
/** side padding of the page itself */
export const PAGE_PX = 'px-7 max-xl:px-6 max-lg:px-5 max-sm:px-3'
/** a list's toolbar on a phone: one row you swipe sideways (the filters, the search), instead of four rows stacked.
 *  Its name ("All open 13") goes — the colored bubble you picked already says it. */
const PHONE_BAR = 'no-scrollbar max-md:flex-nowrap max-md:overflow-x-auto max-md:[&>*]:shrink-0 max-md:[&>div]:ml-0 max-md:[&>div]:w-auto max-md:[&>div]:flex-nowrap max-md:[&>div>*]:shrink-0 max-md:[&_.bar-title]:hidden'

export function Page({
  title, sub, actions, tabs, tab, onTab, toolbar, children, className, aside, top, bare,
}: {
  title: React.ReactNode
  sub?: React.ReactNode
  actions?: React.ReactNode
  tabs?: { key: string; label: string; count?: number; tone?: Tone }[]
  tab?: string
  onTab?: (k: any) => void
  toolbar?: React.ReactNode
  children: React.ReactNode
  /** kept for older callers */
  fill?: boolean
  className?: string
  aside?: React.ReactNode
  /** something above the main card, e.g. the flow strip */
  top?: React.ReactNode
  /** render the children as they are, without the main card */
  bare?: boolean
}) {
  /* how tall the pinned parts are — the page's head (its name and its bubbles) and the toolbar — so each pins right
     under the one above it, and the column names under both */
  const headRef = React.useRef<HTMLDivElement>(null)
  const barRef = React.useRef<HTMLDivElement>(null)
  const [head, setHead] = React.useState(0)
  const [bar, setBar] = React.useState(0)
  React.useLayoutEffect(() => {
    const el = headRef.current
    if (!el) { setHead(0); return }
    const set = () => setHead(el.offsetHeight)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  React.useLayoutEffect(() => {
    const el = barRef.current
    if (!el) { setBar(0); return }
    const set = () => setBar(el.offsetHeight)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [!!(tabs || toolbar)])
  return (
    <div className={cn('min-h-full pb-10 max-lg:pb-6', className)}>
      {/* a big screen is used, not left empty on both sides — only a very wide one gets margins */}
      <div className="mx-auto w-full max-w-[160rem]" style={{ '--head': head + 'px' } as React.CSSProperties}>
        {/* the head stays where it is while the list scrolls under it (on a computer): the page's name, its button,
            the bubbles — and the toolbar right under them */}
        <div ref={headRef} className="bg-canvas lg:sticky lg:top-[var(--app-top,0px)] lg:z-[16]" data-page-head>
          {/* on a phone the bar on top already says which page this is — so no title here, only the line under it
              (when there is one: Today's "1 overdue" opens what's late) and the page's button */}
          <header className={cn('flex min-h-[4.75rem] items-end justify-between gap-6 pb-4 pt-5 max-lg:min-h-0 max-lg:pt-4 max-md:flex-col max-md:items-start max-md:gap-2.5 max-sm:pb-3 max-sm:pt-3', !actions && !sub && 'max-sm:hidden', PAGE_PX)}>
            <div className={cn('min-w-0', !sub && 'max-sm:hidden')}>
              <h1 className="font-display text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.015em] text-ink max-sm:hidden">{title}</h1>
              {sub && <div className="mt-1 max-w-[51.25rem] text-[0.84375rem] leading-snug text-muted max-sm:mt-0">{sub}</div>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5 max-md:w-full">{actions}</div>}
          </header>
          {top && <div className={cn('pb-3.5', PAGE_PX)}>{top}</div>}
        </div>
        <div className={cn('flex flex-col gap-3.5', PAGE_PX)}>
          <div className={cn('flex items-start gap-4', aside && 'max-xl:flex-col max-xl:items-stretch')}>
            {bare ? (
              <div className="min-w-0 flex-1">{children}</div>
            ) : (
              <section className="min-w-0 flex-1 overflow-clip rounded-[0.875rem] border border-line bg-white shadow-sheet" style={{ '--bar': bar + 'px' } as React.CSSProperties}>
                {(tabs || toolbar) && (
                  <div ref={barRef} className={cn('md:sticky md:top-[var(--app-top,0px)] lg:top-[calc(var(--app-top,0px)+var(--head,0px))] md:z-[15] flex min-h-[3.25rem] flex-wrap items-center gap-2 border-b border-line bg-white py-2', PX, PHONE_BAR)}>
                    {tabs && <ChipTabs value={tab as string} onChange={(k) => onTab?.(k)} items={tabs} />}
                    {toolbar}
                  </div>
                )}
                {children}
              </section>
            )}
            {aside}
          </div>
        </div>
      </div>
    </div>
  )
}

/** a panel that fills the window from where it starts down to the bottom, on a computer (it grows past it when what's
 *  in it needs more) — so a page with panels side by side fills the screen, evenly */
export function useFill<T extends HTMLElement>(pad = 28, from = 1280) {
  const ref = React.useRef<T>(null)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const set = () => {
      if (window.innerWidth < from) { el.style.minHeight = ''; return }
      const top = el.getBoundingClientRect().top + window.scrollY
      el.style.minHeight = Math.max(320, window.innerHeight - top - pad) + 'px'
    }
    set()
    const t = setTimeout(set, 120)
    window.addEventListener('resize', set)
    return () => { clearTimeout(t); window.removeEventListener('resize', set) }
  }, [pad, from])
  return ref
}

/** a white card with an optional bold title */
export function Card({ title, count, right, sub, children, className, pad = true, id }: { title?: React.ReactNode; count?: number | string; right?: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; className?: string; pad?: boolean; id?: string }) {
  return (
    <section id={id} className={cn('min-w-0 overflow-clip rounded-[1rem] border border-[#ebe6dd] bg-white shadow-card', className)}>
      {title && (
        <div className={cn('flex items-start justify-between gap-3 pb-3 pt-4', PX)}>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[1rem] font-semibold tracking-[-0.01em] text-ink">
              {title}
              {count !== undefined && <CountPill>{count}</CountPill>}
            </h2>
            {sub && <div className="mt-0.5 text-[0.8125rem] text-muted">{sub}</div>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </div>
      )}
      <div className={cn(pad && !title && 'pt-1')}>{children}</div>
    </section>
  )
}

/** a count next to a name: just the number, quiet (red only for problems) */
export function CountPill({ children, tone = 'info' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={cn('text-[0.8125rem] font-medium tnum', tone === 'bad' ? 'text-bad-600' : 'text-faint')}>{children}</span>
}

/** tabs as chips — the one you're on is blue */
export function ChipTabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; count?: number; tone?: Tone }[] }) {
  return (
    <div className="no-scrollbar flex max-w-full items-center gap-1.5 overflow-x-auto" role="tablist">
      {items.map((it) => {
        const on = it.key === value
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[0.5625rem] border px-3.5 text-[0.84375rem] font-semibold transition-colors',
              on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:border-[#d1cbc0] hover:text-ink',
            )}
          >
            {it.label}
            {it.count !== undefined && <span className={cn('text-[0.78125rem] font-semibold tnum', on ? 'text-brand-600' : it.tone === 'bad' ? 'text-bad-600' : 'text-faint')}>{it.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
/** kept for older callers */
export const Tabs = ChipTabs

/* ---------------- filters on top ---------------- */
export function Filter<T extends string>({
  label, value, options, onChange, allLabel = 'All', width = 240, dflt = 'all', icon,
}: {
  label: string
  value: T | 'all'
  options: { key: T; label: string; hint?: string }[]
  onChange: (v: T | 'all') => void
  allLabel?: string
  width?: number
  /** the value that counts as "no filter" */
  dflt?: string
  icon?: React.ReactNode
}) {
  const cur = options.find((o) => o.key === value)
  const set = value !== dflt
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>
        <button
          aria-label={`${label}: ${cur?.label || allLabel}`}
          className={cn(
            'inline-flex h-9 max-w-[17.5rem] items-center gap-1.5 rounded-[0.625rem] border px-3 text-[0.84375rem] transition-colors [&_svg]:h-4 [&_svg]:w-4',
            set ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-[#d9d3c9] bg-white text-ink-2 shadow-xs hover:bg-wash',
          )}
        >
          {icon && <span className={cn('shrink-0', set ? 'text-brand-600' : 'text-faint')}>{icon}</span>}
          <span className={cn(set ? 'text-brand-700/80' : 'text-muted')}>{label}</span>
          <span className="truncate font-semibold">{cur?.label || allLabel}</span>
          <ChevronDown className="shrink-0 opacity-50" />
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content {...scrollHere} align="start" sideOffset={6} className="scroll-soft z-[300] max-h-[min(26.25rem,70vh)] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-pop animate-pop-in" style={{ width }}>
          {[{ key: 'all' as const, label: allLabel }, ...options].map((o) => (
            <DM.Item
              key={o.key}
              onSelect={() => onChange(o.key as T | 'all')}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.875rem] text-ink-2 outline-none data-[highlighted]:bg-brand-50 data-[highlighted]:text-ink"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {'hint' in o && o.hint && <span className="block truncate text-[0.78125rem] text-muted">{o.hint}</span>}
              </span>
              {value === o.key && <Check className="h-4 w-4 text-brand-600" strokeWidth={2.4} />}
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}

export function ClearFilters({ show, onClear }: { show: boolean; onClear: () => void }) {
  if (!show) return null
  return (
    <button onClick={onClear} className="inline-flex h-9 items-center gap-1 rounded-[0.625rem] px-2.5 text-[0.84375rem] font-semibold text-brand-600 hover:bg-brand-50">
      <X className="h-4 w-4" /> Clear
    </button>
  )
}

export function ToolbarSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <SearchField value={value} onChange={onChange} placeholder={placeholder} className="ml-auto h-9 w-[15rem] rounded-[0.625rem] border-[#d9d3c9] shadow-xs max-md:ml-0 max-md:w-[12.5rem] [&_input]:text-[0.84375rem]" />
}

/* ================= the list inside a card ================= */
const DOT: Record<Tone, string> = { bad: 'bg-bad-500', warn: 'bg-warn-500', ok: 'bg-ok-500', info: 'bg-brand-600', vio: 'bg-vio-500', neutral: 'bg-faint' }
const HALO: Record<Tone, string> = { bad: 'bg-bad-50', warn: 'bg-warn-50', ok: 'bg-ok-50', info: 'bg-brand-50', vio: 'bg-vio-50', neutral: 'bg-wash-2' }

/** a list's column names, on top: small and quiet, pinned while the rows scroll. Its line under it is the first row's
 *  (or band's) line — every line in a list is the same one line. */
export const HEAD_ROW = 'h-9 items-center bg-white text-[0.75rem] font-medium text-faint shadow-[0_0.0625rem_0_var(--color-line-2)]'
/** a group inside a list (Overdue, Today, On hold, Getting ready…): a light gray band the full width — gray, never
 *  yellow — so it reads as a heading and never as one more line of the list. The same line above it as every row, so
 *  the lines never change. A dot in the group's own color (its bubble's color on top), the name and how many; a quiet
 *  link on the right if any. */
export const BAND = 'flex h-9 items-center gap-2 border-t border-line bg-[#f3f3f1]'
/** each group's dot — the colors of the bubbles on top */
export const BAND_DOT: Record<Tone, string> = { bad: '#d7342a', warn: '#d98c0b', ok: '#2c8a5b', info: '#2650cf', vio: '#6347c7', neutral: '#a09b92' }
export function BandDot({ tone }: { tone?: Tone }) {
  return tone ? <span aria-hidden data-band-dot={tone} className="h-2 w-2 shrink-0 self-center rounded-full" style={{ background: BAND_DOT[tone] }} /> : null
}
export function Group({ label, count, tone, open = true, onToggle, right }: { label: string; count?: number; tone?: Tone; open?: boolean; onToggle?: () => void; hint?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className={cn(BAND, PX)} data-group-tone={tone || 'neutral'} data-band>
      <button onClick={onToggle} disabled={!onToggle} className="inline-flex min-w-0 items-baseline gap-2 text-left disabled:cursor-default">
        <BandDot tone={tone} />
        <span className="truncate text-[0.8125rem] font-semibold text-ink">{label}</span>
        {count !== undefined && <span className="text-[0.8125rem] font-medium tnum text-faint">{count}</span>}
        {onToggle && (open ? <ChevronDown className="h-3.5 w-3.5 self-center text-faint" /> : <ChevronRight className="h-3.5 w-3.5 self-center text-faint" />)}
      </button>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  )
}

/** one row of a list. lead = the visual anchor; children = the aligned facts on the right */
export function Row({ lead, title, meta, children, onClick, className, dim, leaving }: {
  lead?: React.ReactNode
  title: React.ReactNode
  meta?: React.ReactNode
  children?: React.ReactNode
  onClick?: () => void
  className?: string
  dim?: boolean
  tall?: boolean
  leaving?: boolean
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onClick() } : undefined}
      className={cn(
        'group/row relative flex min-h-[3.25rem] items-center gap-3 border-t border-line-2 py-2 transition-colors',
        PX,
        onClick && 'cursor-pointer row-hover focus-visible:outline-none',
        dim && 'opacity-70',
        leaving && 'row-out',
        className,
      )}
    >
      {lead && <div className="shrink-0">{lead}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.875rem] font-semibold leading-5 text-ink">{title}</div>
        {meta && <div className="mt-0.5 flex min-w-0 items-center gap-x-3 gap-y-1 overflow-hidden text-[0.78125rem] leading-[1.125rem] text-muted">{meta}</div>}
      </div>
      {children}
    </div>
  )
}

/** a fixed-width slot on the right of a row, so facts line up from row to row */
export function Col({ w, children, className, right }: { w: number; children?: React.ReactNode; className?: string; right?: boolean }) {
  return (
    <div className={cn('shrink-0', right && 'text-right', className)} style={{ width: `${w / 16}rem` }}>
      {children}
    </div>
  )
}

/** a small fact in a meta line: an icon and a few words */
export function Meta({ icon, children, tone, className }: { icon?: React.ReactNode; children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 shrink items-center gap-1.5 [&_svg]:h-[0.9375rem] [&_svg]:w-[0.9375rem] [&_svg]:shrink-0', tone === 'bad' ? 'font-medium text-bad-600' : tone === 'warn' ? 'text-warn-700' : tone === 'ok' ? 'text-ok-700' : tone === 'info' ? 'text-brand-700' : '', className)}>
      {icon && <span className={cn('inline-flex', !tone && 'text-faint')}>{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  )
}

const TILE: Record<Tone, string> = {
  info: 'bg-brand-50 text-brand-600', ok: 'bg-ok-50 text-ok-600', warn: 'bg-warn-50 text-warn-600', bad: 'bg-bad-50 text-bad-600', vio: 'bg-vio-50 text-vio-600', neutral: 'bg-wash-2 text-muted',
}
/** a rounded square with a tinted icon — the anchor for things (estimates, bills, POs) */
export function IconTile({ icon, tone = 'info', size = 40, className }: { icon: React.ReactNode; tone?: Tone; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-[0.625rem]', TILE[tone], className)} style={{ width: size, height: size }}>
      <span className={cn('inline-flex', size >= 40 ? '[&_svg]:h-5 [&_svg]:w-5' : '[&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem]')}>{icon}</span>
    </span>
  )
}

/** progress as a ring with the number inside — the anchor for projects */
export function ProgressRing({ pct, size = 40, tone = 'info', label }: { pct: number; size?: number; tone?: Tone; label?: React.ReactNode }) {
  const sw = size >= 44 ? 4 : 3.5
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const color = { info: '#2650cf', ok: '#2e9e62', warn: '#dd8c16', bad: '#d9493b', vio: '#7462d8', neutral: '#9aa1ad' }[tone]
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8eaee" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, pct)) / 100)} />
      </svg>
      <span className={cn('absolute font-bold tnum text-ink', size >= 44 ? 'text-[0.71875rem]' : 'text-[0.65625rem]')}>{label ?? `${Math.round(pct)}%`}</span>
    </span>
  )
}

/** a little calendar leaf: month on top, day below — the anchor for things with a start date */
export function DateTile({ top, main, tone = 'neutral' }: { top: string; main: string; tone?: Tone }) {
  const head = { info: 'text-brand-700', ok: 'text-ok-700', warn: 'text-warn-700', bad: 'text-bad-600', vio: 'text-vio-600', neutral: 'text-muted' }[tone]
  return (
    <span className="inline-flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-[0.5625rem] border border-line bg-white text-center">
      <span className={cn('text-[0.65625rem] font-semibold leading-none', head)}>{top}</span>
      <span className={cn('display-num mt-[0.1875rem] font-semibold leading-none text-ink', main.length > 2 ? 'text-[0.75rem]' : 'text-[1rem]')}>{main}</span>
    </span>
  )
}

/** people, overlapping */
export function AvatarStack({ who, size = 26, max = 3 }: { who: PersonKey[]; size?: number; max?: number }) {
  const shown = who.slice(0, max)
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => <Avatar key={p + i} who={p} size={size} ring className={cn(i > 0 && '-ml-2')} />)}
      {who.length > max && <span className="-ml-2 inline-flex items-center justify-center rounded-full bg-wash-2 text-[0.6875rem] font-bold text-muted ring-2 ring-white" style={{ width: size, height: size }}>+{who.length - max}</span>}
    </span>
  )
}

/** one checklist step as a pill: done, partly, waiting, not yet, a problem, or not needed */
export type StepState = 'yes' | 'part' | 'wait' | 'no' | 'bad' | 'na'
const STEP: Record<StepState, { cls: string; icon: React.ReactNode }> = {
  yes: { cls: 'bg-ok-50 text-ok-700 border-ok-100', icon: <CircleCheck className="text-ok-600" /> },
  part: { cls: 'bg-warn-50 text-warn-700 border-warn-100', icon: <CircleDot className="text-warn-600" /> },
  wait: { cls: 'bg-brand-50 text-brand-700 border-brand-100', icon: <CircleDot className="text-brand-600" /> },
  no: { cls: 'bg-white text-muted border-line', icon: <CircleDashed className="text-faint" /> },
  bad: { cls: 'bg-bad-50 text-bad-700 border-bad-100', icon: <CircleAlert className="text-bad-600" /> },
  na: { cls: 'bg-transparent text-faint border-transparent', icon: <Minus className="text-faint" /> },
}
export function StepPill({ state, children, onClick, title, w }: { state: StepState; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void; title?: string; w?: number }) {
  const s = STEP[state]
  return (
    <button
      type="button"
      title={title}
      disabled={!onClick}
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
      style={w ? { width: w } : undefined}
      className={cn('inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-[0.78125rem] font-semibold transition [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 disabled:cursor-default', s.cls, onClick && 'hover:-translate-y-px hover:shadow-xs')}
    >
      {s.icon}
      <span className="truncate">{children}</span>
    </button>
  )
}

/** numbered steps for a window that walks you through something: done = green check, current = blue */
export function FlowSteps({ steps, at, onPick, className }: { steps: string[]; at: number; onPick?: (i: number) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-2', className)}>
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && <span className={cn('h-[0.125rem] w-8 rounded-full max-sm:w-4', at >= i ? 'bg-ok-500' : 'bg-line')} />}
          <button type="button" disabled={!onPick || i > at} onClick={() => onPick?.(i)} className="inline-flex items-center gap-2 text-[0.84375rem] font-semibold disabled:cursor-default">
            <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.78125rem] font-bold', at > i ? 'bg-ok-500 text-white' : at === i ? 'bg-brand-600 text-white shadow-[0_0_0_0.25rem_rgba(38,80,207,.12)]' : 'bg-wash-2 text-muted')}>
              {at > i ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn(at === i ? 'text-ink' : 'text-muted', at !== i && 'max-sm:hidden')}>{label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  )
}

export function EmptyState({ title, sub, action, icon }: { title: string; sub?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center border-t border-line-2 px-6 py-16 text-center">
      {icon && <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 [&_svg]:h-6 [&_svg]:w-6">{icon}</span>}
      <div className="text-[1rem] font-semibold text-ink">{title}</div>
      {sub && <div className="mt-1 max-w-sm text-[0.875rem] text-muted">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ================= the colored bubbles on top of a page: each status, its count, one click to filter =================
 * Calm white tiles; the color lives in the little icon square. The one you're on fills with its color. */
export type BubbleColor = 'blue' | 'violet' | 'green' | 'amber' | 'red' | 'rose' | 'teal' | 'slate' | 'orange' | 'cyan' | 'indigo'
const BC: Record<BubbleColor, { tint: string; solid: string }> = {
  blue: { tint: '#eaf0fc', solid: '#2650cf' },
  indigo: { tint: '#eeeffc', solid: '#4b4fc6' },
  violet: { tint: '#f1eefb', solid: '#6b55c9' },
  green: { tint: '#e9f5ee', solid: '#23854f' },
  amber: { tint: '#fbf2e2', solid: '#b06a0c' },
  red: { tint: '#fbecea', solid: '#c03a2d' },
  rose: { tint: '#fbecf1', solid: '#b83a5e' },
  teal: { tint: '#e7f4f2', solid: '#1a8073' },
  slate: { tint: '#eeeae3', solid: '#4a5464' },
  orange: { tint: '#fcefe6', solid: '#c25a1a' },
  cyan: { tint: '#e6f3f8', solid: '#1a7c9c' },
}
export type Bubble = { key: string; label: string; count: React.ReactNode; sub?: React.ReactNode; subBad?: boolean; icon: React.ReactNode; color: BubbleColor; on?: boolean; onClick?: () => void; gapBefore?: boolean; plainBefore?: boolean }
export function Bubbles({ items, arrows, wrap }: { items: Bubble[]; arrows?: boolean; wrap?: boolean }) {
  return (
    <div className={cn(wrap ? 'grid grid-cols-[repeat(auto-fill,minmax(9.375rem,1fr))] gap-2 pb-1 pt-0.5' : 'no-scrollbar -mx-2 -mb-3 flex items-stretch gap-2 overflow-x-auto px-2 pb-3 pt-0.5')} role="tablist">
      {items.map((b, i) => {
        const c = BC[b.color]
        /* every bubble always shows, even at 0 — they're the shape of the page, and the same every day */
        return (
          <React.Fragment key={b.key}>
            {i > 0 && !wrap && (b.gapBefore ? <span className="mx-1 w-px shrink-0 self-stretch bg-line" /> : arrows && !b.plainBefore ? <ChevronRight className="-mx-1.5 h-4 w-4 shrink-0 self-center text-[#c3c9d1]" /> : null)}
            <button
              role="tab"
              aria-selected={!!b.on}
              onClick={b.onClick}
              disabled={!b.onClick}
              className={cn(
                'group relative flex h-[3.25rem] min-w-[9.375rem] flex-1 basis-0 items-center gap-2.5 overflow-hidden rounded-[0.6875rem] border px-2.5 text-left transition-colors duration-150 disabled:cursor-default',
                b.on ? 'border-transparent text-white' : 'border-line bg-white enabled:hover:border-[#cdc7bc]',
              )}
              style={b.on ? { background: c.solid, boxShadow: `0 10px 22px -14px ${c.solid}` } : undefined}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5rem] [&_svg]:h-4 [&_svg]:w-4" style={b.on ? { background: 'rgba(255,255,255,.16)', color: '#fff' } : { background: c.tint, color: c.solid }}>
                {b.icon}
              </span>
              {/* just the number and the name — nothing else crowds the top of the page */}
              <span className="min-w-0 flex-1">
                <span className={cn('display-num block text-[1.125rem] font-semibold leading-5', !b.on && 'text-ink')}>{b.count}</span>
                <span className={cn('block truncate text-[0.75rem] font-medium leading-4', b.on ? 'text-white/90' : 'text-ink-2')}>{b.label}</span>
              </span>
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}

/* ================= the company's flow: every stage with its count ================= */
export type FlowStage = { key: string; label: string; count: number; sub?: string; tone?: Tone; onClick?: () => void; on?: boolean }
export function FlowStrip({ groups }: { groups: { label: string; color: string; stages: FlowStage[] }[] }) {
  return (
    <section className="rounded-[0.875rem] border border-line bg-white p-5 shadow-card max-sm:p-4">
      <div className="no-scrollbar flex items-stretch gap-2 overflow-x-auto">
        {groups.map((g, gi) => (
          <React.Fragment key={g.label}>
            {gi > 0 && <ChevronRight className="mt-[2.125rem] h-4 w-4 shrink-0 text-faint" />}
            <div className="min-w-0 flex-1" style={{ flexGrow: g.stages.length, minWidth: g.stages.length * 108 }}>
              <div className="mb-2.5 flex items-center gap-2 text-[0.78125rem] font-semibold text-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                {g.label}
                <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${g.color}55, transparent)` }} />
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${g.stages.length}, minmax(0, 1fr))` }}>
                {g.stages.map((st) => (
                  <button
                    key={st.key}
                    onClick={st.onClick}
                    disabled={!st.onClick}
                    className={cn(
                      'flex min-w-0 flex-col rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-default',
                      st.on ? 'border-brand-600 bg-brand-50 shadow-[0_0_0_0.1875rem_rgba(38,80,207,.12)]' : 'border-line bg-white enabled:hover:-translate-y-px enabled:hover:border-brand-300 enabled:hover:shadow-lift',
                    )}
                  >
                    <span className={cn('display-num text-[1.375rem] font-semibold leading-7', st.count ? (st.tone === 'bad' ? 'text-bad-600' : st.on ? 'text-brand-700' : 'text-ink') : 'text-[#d9d3c9]')}>{st.count || '–'}</span>
                    <span className={cn('truncate text-[0.78125rem] font-semibold', st.on ? 'text-brand-700' : 'text-muted')}>{st.label}</span>
                    {st.sub && <span className="truncate text-[0.71875rem] text-faint">{st.sub}</span>}
                  </button>
                ))}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}

/* ================= table (for the few views that compare numbers) ================= */
export function Table({ children, minWidth, className, auto }: { children: React.ReactNode; minWidth?: number; className?: string; auto?: boolean }) {
  return (
    <div className={cn('scroll-soft overflow-x-auto xl:overflow-visible', className)}>
      <table className={cn('w-full border-separate border-spacing-0 text-left', !auto && 'table-fixed', minWidth && 'md:[min-width:var(--tmin)]')} style={minWidth ? ({ '--tmin': minWidth + 'px' } as React.CSSProperties) : undefined}>
        {children}
      </table>
    </div>
  )
}
const EDGE = 'first:pl-6 last:pr-6 max-sm:first:pl-4 max-sm:last:pr-4'
export function Th({ children, className, w, right, title }: { children?: React.ReactNode; className?: string; w?: number | string; right?: boolean; title?: string }) {
  return (
    <th title={title} style={w !== undefined ? { width: w } : undefined} className={cn('h-9 whitespace-nowrap border-b border-line-2 bg-white px-3 text-[0.75rem] font-medium text-faint xl:sticky xl:top-[calc(var(--app-top,0px)+var(--head,0px)+var(--bar,0px))] xl:z-[5]', EDGE, right && 'text-right', className)}>
      {children}
    </th>
  )
}
export function Tr({ children, onClick, className, dim }: { children: React.ReactNode; onClick?: () => void; className?: string; dim?: boolean }) {
  return (
    <tr
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onClick() } : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn('group transition-colors [&>td]:border-b [&>td]:border-line-2', onClick && 'cursor-pointer row-hover focus-visible:outline-none', dim && 'text-muted', className)}
    >
      {children}
    </tr>
  )
}
export function Td({ children, className, right, colSpan }: { children?: React.ReactNode; className?: string; right?: boolean; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn('h-[3.25rem] px-3 py-2 align-middle text-[0.84375rem] text-ink-2', EDGE, right && 'text-right', className)}>
      {children}
    </td>
  )
}
/** a group heading inside a table.
 * It spans the columns with a second cell that phones hide, so hidden columns never come back as empty ones. */
const FIRST = 'pl-6 max-sm:pl-4'
export function GroupRow({ label, count, colSpan, open = true, onToggle, tone, hint }: { label: string; count?: number; colSpan: number; open?: boolean; onToggle?: () => void; tone?: Tone; hint?: string }) {
  return (
    <tr>
      <td className={cn('h-9 whitespace-nowrap border-b border-line-2 bg-[#f3f3f1] py-0', FIRST)} data-group-tone={tone || 'neutral'} data-band>
        <button onClick={onToggle} disabled={!onToggle} className="inline-flex items-baseline gap-2 text-left disabled:cursor-default">
          <BandDot tone={tone && tone !== 'neutral' ? tone : undefined} />
          <span className="text-[0.8125rem] font-semibold text-ink">{label}</span>
          {count !== undefined && <span className="text-[0.8125rem] font-medium tnum text-faint">{count}</span>}
          {onToggle && (open ? <ChevronDown className="h-3.5 w-3.5 self-center text-faint" /> : <ChevronRight className="h-3.5 w-3.5 self-center text-faint" />)}
        </button>
      </td>
      {colSpan > 1 && <td colSpan={colSpan - 1} className="border-b border-line-2 bg-[#f3f3f1] max-md:hidden" />}
    </tr>
  )
}
export function EmptyRow({ colSpan, title, sub, action }: { colSpan: number; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16 text-center max-md:hidden">
        <div className="text-[1rem] font-semibold text-ink">{title}</div>
        {sub && <div className="mx-auto mt-1 max-w-sm text-[0.875rem] text-muted">{sub}</div>}
        {action && <div className="mt-4">{action}</div>}
      </td>
      <td className="px-4 py-12 text-center md:hidden">
        <div className="text-[1rem] font-semibold text-ink">{title}</div>
        {sub && <div className="mx-auto mt-1 max-w-sm text-[0.875rem] text-muted">{sub}</div>}
        {action && <div className="mt-4">{action}</div>}
      </td>
    </tr>
  )
}

/* ---------------- status: a soft tinted pill ---------------- */
const CHIP: Record<Tone, string> = {
  bad: 'bg-bad-50 text-bad-700', warn: 'bg-warn-50 text-warn-700', ok: 'bg-ok-50 text-ok-700', info: 'bg-brand-50 text-brand-700', vio: 'bg-vio-50 text-vio-600', neutral: 'bg-wash-2 text-ink-2',
}
/** where something stands, in a word or two: a small dot and the words in its color — no pill behind it. Red only for a
 *  problem. */
const WORD: Record<Tone, string> = { bad: 'text-bad-600', warn: 'text-warn-700', ok: 'text-ok-700', info: 'text-brand-700', vio: 'text-vio-600', neutral: 'text-ink-2' }
export function Status({ tone = 'neutral', children, className, plain }: { tone?: Tone; children: React.ReactNode; className?: string; plain?: boolean }) {
  return (
    <span className={cn('inline-flex h-6 min-w-0 max-w-full items-center gap-1.5 whitespace-nowrap text-[0.8125rem] font-medium', plain ? WORD.neutral : WORD[tone], className)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[plain ? 'neutral' : tone])} />
      <span className="truncate">{children}</span>
    </span>
  )
}
/* the old soft pills — kept for the few things that are a tag, not a state */
export const PILL = CHIP

/* ---------------- a switch between ways of seeing a list ----------------
 * Mine / Everyone, By time / By project: easy to see (the one you're on is dark), and it never moves — nothing next to
 * it appears or changes width when you switch. */
export function ViewSwitch<K extends string | boolean>({ value, onChange, items, label, className }: { value: K; onChange: (k: K) => void; items: { key: K; label: string; short?: string; icon?: React.ReactNode; count?: number }[]; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex h-9 shrink-0 items-center rounded-[0.625rem] bg-[#efebe4] p-[0.1875rem]', className)}>
      {items.map((it) => {
        const on = it.key === value
        /* the one you're on is white, lifted a little — calm, like a light switch; no blue */
        return (
          <button
            key={String(it.key)}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            className={cn('inline-flex h-[1.875rem] items-center gap-1.5 whitespace-nowrap rounded-[0.4375rem] px-3 text-[0.8125rem] font-semibold transition-colors max-sm:px-2.5 [&_svg]:hidden', on ? 'bg-white text-ink shadow-[0_0.0625rem_0.1875rem_rgba(16,24,40,.12)]' : 'text-muted hover:text-ink')}
          >
            {it.short ? <><span className="max-sm:hidden">{it.label}</span><span className="sm:hidden">{it.short}</span></> : it.label}{it.count != null && <span className={cn('text-[0.75rem] tnum', on ? 'text-muted' : 'text-faint')}>{it.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- where something stands: step circles joined by a line ---------------- */
export function Path({ steps, className, at, label, compact }: { steps: { key: string; label: string; short?: string; state: 'done' | 'current' | 'future' | 'blocked'; sub?: string; date?: string; dateTone?: 'bad'; onClick?: () => void; aria?: string }[]; className?: string; at?: string; label?: string; compact?: boolean }) {
  /* one row: the circle with the words beside it — fits in a window's header without pushing the work down */
  if (compact) return (
    <ol aria-label={label} className={cn('no-scrollbar flex items-stretch gap-1 overflow-x-auto', className)}>
      {steps.map((st, i) => {
        const n = i + 1
        const on = at === st.key
        return (
          <li key={st.key} className="flex min-w-0 flex-1 items-center">
            <button onClick={st.onClick} disabled={!st.onClick} aria-label={st.aria} aria-current={on ? 'step' : undefined} className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left disabled:cursor-default', on ? 'bg-[#f6f3ee] ring-1 ring-[#e9e4db]' : st.onClick && 'hover:bg-[#f6f3ee]/70')}>
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-bold', st.state === 'done' && 'bg-ok-500 text-white', st.state === 'current' && 'bg-white text-brand-600 ring-[0.1875rem] ring-brand-600', st.state === 'blocked' && 'bg-bad-500 text-white', st.state === 'future' && 'bg-white text-faint ring-2 ring-[#e5e0d7]')}>
                {st.state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : st.state === 'current' ? <span className="h-2 w-2 rounded-full bg-brand-600" /> : st.state === 'blocked' ? '!' : n}
              </span>
              <span className="min-w-0 leading-tight">
                <span className={cn('block truncate text-[0.8125rem] font-semibold', st.state === 'current' ? 'text-brand-700' : st.state === 'future' ? 'text-muted' : st.state === 'blocked' ? 'text-bad-700' : 'text-ink')}>{st.short ? <><span className="max-sm:hidden">{st.label}</span><span className="sm:hidden">{st.short}</span></> : st.label}</span>
                {(st.sub || st.date) && <span title={[st.sub, st.date].filter(Boolean).join(' · ')} className={cn('block truncate text-[0.71875rem]', st.dateTone === 'bad' ? 'font-semibold text-bad-600' : st.state === 'done' ? 'text-ok-700' : st.state === 'current' ? 'text-brand-700' : st.state === 'blocked' ? 'text-bad-700' : 'text-faint')}>{st.state === 'done' ? (st.date ? `Done ${st.date.replace(/^Done\s*/, '')}` : st.sub) : st.sub || st.date}</span>}
              </span>
            </button>
            {i < steps.length - 1 && <span className={cn('mx-0.5 h-[0.125rem] w-3 shrink-0 rounded-full max-sm:hidden', st.state === 'done' ? 'bg-ok-500' : 'bg-[#e5e0d7]')} />}
          </li>
        )
      })}
    </ol>
  )
  return (
    <ol aria-label={label} className={cn('no-scrollbar flex items-start overflow-x-auto px-1.5 pb-1 pt-3', className)}>
      {steps.map((st, i) => {
        const prevDone = i > 0 && (steps[i - 1].state === 'done')
        const n = i + 1
        const on = at === st.key
        return (
          <li key={st.key} className="relative flex min-w-[5.75rem] flex-1 flex-col items-center text-center">
            {/* the line to it, like a parcel's tracking: full once it's reached, halfway while it's on its way */}
            {i > 0 && <Link pct={prevDone && st.state !== 'future' ? 100 : prevDone ? 50 : 0} className="absolute top-[0.90625rem] h-[0.1875rem]" style={{ left: 'calc(-50% + 22px)', right: 'calc(50% + 22px)' }} />}
            <button
              onClick={st.onClick}
              disabled={!st.onClick}
              aria-label={st.aria}
              aria-current={on ? 'step' : undefined}
              className={cn('group relative z-[1] flex max-w-full flex-col items-center rounded-xl px-2 pb-1 disabled:cursor-default')}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-[0.8125rem] font-bold transition',
                  st.state === 'done' && 'bg-ok-500 text-white shadow-[0_0.125rem_0.375rem_-0.0625rem_rgba(18,183,106,.45)]',
                  st.state === 'current' && 'bg-white text-brand-600 ring-[0.1875rem] ring-brand-600 shadow-[0_0_0_0.3125rem_rgba(38,80,207,.12)]',
                  st.state === 'blocked' && 'bg-bad-500 text-white shadow-[0_0.125rem_0.375rem_-0.0625rem_rgba(240,68,56,.45)]',
                  st.state === 'future' && 'bg-white text-faint ring-2 ring-[#e5e0d7]',
                  st.onClick && 'group-hover:scale-105',
                )}
              >
                {st.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : st.state === 'current' ? <span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> : st.state === 'blocked' ? '!' : n}
              </span>
              <span className={cn('mt-2 max-w-[min(7.5rem,100%)] truncate text-[0.8125rem] font-semibold', st.state === 'current' ? 'text-brand-600' : st.state === 'future' ? 'text-muted' : st.state === 'blocked' ? 'text-bad-700' : 'text-ink', on && 'underline decoration-2 underline-offset-[0.3125rem]')}>{st.short ? <><span className="max-sm:hidden">{st.label}</span><span className="sm:hidden">{st.short}</span></> : st.label}</span>
              {st.sub && (
                <span className={cn('mt-1 max-w-[min(7.5rem,100%)] truncate rounded-md px-1.5 py-px text-[0.71875rem] font-semibold', st.state === 'done' ? 'bg-ok-50 text-ok-700' : st.state === 'current' ? 'bg-brand-50 text-brand-700' : st.state === 'blocked' ? 'bg-bad-50 text-bad-700' : 'bg-wash-2 text-muted')}>{st.sub}</span>
              )}
              {st.date && <span className={cn('mt-0.5 text-[0.71875rem] font-medium tnum', st.dateTone === 'bad' ? 'font-semibold text-bad-600' : st.state === 'done' ? 'text-ok-700' : 'text-muted')}>{st.date}</span>}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/* ================= circles: every step a circle that fills — done is green with a check, a problem is red, waiting
 * is amber, whose turn it is is blue. "beside": the words next to each circle, in one line (the estimate); "below":
 * the words under each, in groups with a name over them (the project — every part of the job). ================= */
export type CircleState = 'done' | 'now' | 'wait' | 'bad' | 'later' | 'todo'
export type CircleStep = { key: string; label: string; sub?: string; state: CircleState; pct?: number; center?: React.ReactNode; mine?: boolean; attrs?: Record<string, string>
  /** whose step it is — their initials in a small circle before the line under the name */
  who?: PersonKey
  /** a gate: it can't start until what's before it is done — a dashed ring with a lock */
  lock?: boolean
  /** while it's the one going on: how far it's got (0–100) — the line after it fills that far, like a parcel's
   *  tracking line */
  link?: number }
export type CircleGroup = { key: string; label?: string; sub?: string; subTone?: 'bad'; onLabel?: () => void; steps: CircleStep[] }
/* blue is "your turn" (and where the project is) — someone else's open step is a dark ring: to do */
const C_ARC: Record<CircleState, string> = { done: '#2c8a5b', now: '#2650cf', wait: '#d98c0b', bad: '#d7342a', later: '#cfc8bd', todo: '#3f4654' }
const C_TRACK: Record<CircleState, string> = { done: '#2c8a5b', now: '#dfe6fb', wait: '#f6e6c8', bad: '#d7342a', later: '#e7e2d9', todo: '#e3e5e8' }
const C_SUB: Record<CircleState, string> = { done: 'text-muted', now: 'text-brand-700', wait: 'text-warn-700', bad: 'font-semibold text-bad-600', later: 'text-faint', todo: 'text-ink-2' }

/** the line between two circles — like a parcel's tracking line: green as far as the work has got, gray after it. It
 *  grows into place when it first shows, and moves along when the work does. */
export function Link({ pct, className, style }: { pct: number; className?: string; style?: React.CSSProperties }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <span aria-hidden data-link={p} className={cn('relative block overflow-hidden rounded-full bg-[#e5e0d7]', className)} style={style}>
      {p > 0 && <span className="line-grow absolute inset-y-0 left-0 rounded-full bg-[#2c8a5b] transition-[width] duration-700 ease-out" style={{ width: `${p}%` }} />}
    </span>
  )
}
const REACHED: CircleState[] = ['done', 'now', 'todo', 'wait', 'bad']
/** how far the line after a step has got: up to the next one once that's reached; while the step is the one going on,
 *  as far as it's got */
const linkAfter = (st: CircleStep, next?: CircleStep) =>
  st.state === 'done' ? (next && !next.lock && REACHED.includes(next.state) ? 100 : st.link ?? 0) : st.state !== 'later' && !st.lock ? st.link ?? 0 : 0

/** one circle: green and full with a check when done, red with ! for a problem, else a ring that fills */
export function Circle({ st, size = 36, on, solid }: { st: CircleStep; size?: number; on?: boolean; /** "where it's up to": filled blue, breathing */ solid?: boolean }) {
  const w = size >= 34 ? 3.5 : 3
  const r = (size - w) / 2
  const c = 2 * Math.PI * r
  if (st.lock) {
    return (
      <span className="relative inline-flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size }} data-lock>
        <svg width={size} height={size} aria-hidden><circle cx={size / 2} cy={size / 2} r={r} fill="#faf8f5" stroke="#bdb5a8" strokeWidth={1.6} strokeDasharray="3.2 3" /></svg>
        <Lock className="absolute h-3.5 w-3.5 text-[#8b8478]" strokeWidth={2.4} />
      </span>
    )
  }
  const filled = st.state === 'done' || st.state === 'bad' || (!!solid && st.state === 'now')
  const pct = filled ? 100 : st.state === 'later' ? (st.pct || 0) : Math.max(st.pct ?? 0, st.pct == null ? 100 : 6)
  const txt = size >= 34 ? 'text-[0.6875rem]' : 'text-[0.625rem]'
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center rounded-full transition-shadow', on && 'shadow-[0_0_0_0.25rem_rgba(38,80,207,.16)]', solid && st.state === 'now' && 'animate-pulse-ring')} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={filled ? size / 2 : r} fill={filled ? C_ARC[st.state] : '#fff'} stroke={filled ? 'none' : C_TRACK[st.state]} strokeWidth={w} />
        {!filled && pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C_ARC[st.state]} strokeWidth={w} strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} className="transition-[stroke-dasharray] duration-700" />}
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center font-bold tnum leading-none', txt, filled ? 'text-white' : st.state === 'now' ? 'text-brand-700' : st.state === 'wait' ? 'text-warn-700' : st.state === 'todo' ? 'text-ink-2' : 'text-faint')}>
        {st.state === 'done' ? <Check className={size >= 34 ? 'h-4 w-4' : 'h-3.5 w-3.5'} strokeWidth={3.2} /> : st.state === 'bad' ? '!' : st.center}
      </span>
      {st.mine && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-brand-600 ring-2 ring-white" aria-label="Your turn" />}
    </span>
  )
}

/** a part's steps each get the same room, as if it had five — so the circles are as far apart in every part, and a
 *  part with fewer steps sits in the middle */
const EVEN = 5
export function Circles({ groups, at, onPick, layout = 'below', size, label, className, markNow }: { groups: CircleGroup[]; at?: string; onPick?: (key: string) => void; layout?: 'below' | 'beside'; size?: number; label?: string; className?: string; /** where it's up to: the step going on now is filled blue, a little bigger, and says "Now" */ markNow?: boolean }) {
  const all = groups.flatMap((g) => g.steps)
  const rowRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const row = rowRef.current
    const on = row?.querySelector<HTMLElement>('[aria-current="step"]')
    if (!row || !on || row.scrollWidth <= row.clientWidth) return
    const r = on.getBoundingClientRect(), b = row.getBoundingClientRect()
    if (r.left < b.left || r.right > b.right) row.scrollLeft += r.left - b.left - b.width / 2 + r.width / 2
  }, [at])
  if (layout === 'beside') {
    const sz = size ?? 30
    return (
      <ol aria-label={label} className={cn('no-scrollbar flex items-center overflow-x-auto', onPick && 'pb-2.5', className)} data-circles>
        {all.map((st, i) => {
          const on = at === st.key
          const here = !!markNow && st.state === 'now'
          const Tag = onPick ? 'button' : 'span'
          return (
            <li key={st.key} className={cn('flex min-w-0 items-center', i < all.length - 1 && 'flex-[1_1_0]')} aria-current={st.state === 'now' || on ? 'step' : undefined} data-state={st.state} data-here={here || undefined}>
              <Tag {...(onPick ? { type: 'button', onClick: () => onPick(st.key), 'aria-pressed': on, 'aria-label': `${st.label}${st.sub ? ` — ${st.sub}` : ''}` } : {})} {...(st.attrs || {})} className={cn('group relative flex min-w-0 items-center gap-2 rounded-full py-0.5 pr-1 text-left', onPick && 'transition hover:opacity-90')}>
                <span className={cn('inline-flex rounded-full transition', onPick && 'group-hover:scale-105')}><Circle st={st} size={here ? sz + 6 : sz} on={on} solid={here} /></span>
                <span className="min-w-0 leading-tight max-sm:hidden">
                  <span className={cn('block truncate text-[0.8125rem] font-semibold', here ? 'text-[0.875rem] font-bold text-brand-700' : on && onPick ? 'text-brand-700' : st.state === 'later' ? 'text-muted' : 'text-ink')}>{st.label}</span>
                  {(st.sub || here || st.who) && (
                    <span className={cn('flex max-w-[12rem] items-center gap-1 text-[0.71875rem]', here ? 'font-semibold text-brand-700' : st.lock ? 'text-[#8b8478]' : C_SUB[st.state])} data-who={st.who}>
                      {st.who && <Avatar who={st.who} size={16} />}
                      <span className="truncate">{here ? ['Now', st.sub].filter(Boolean).join(' · ') : st.sub}</span>
                    </span>
                  )}
                </span>
                {/* the part that's open below — underlined, like a tab */}
                {on && onPick && <span aria-hidden data-picked className="absolute -bottom-[0.625rem] left-0 right-1 h-[0.1875rem] rounded-t-full bg-brand-600 max-sm:right-0" />}
              </Tag>
              {i < all.length - 1 && <Link pct={linkAfter(st, all[i + 1])} className="mx-2 h-[0.1875rem] min-w-3 flex-1 max-sm:mx-1" />}
            </li>
          )
        })}
      </ol>
    )
  }
  const sz = size ?? 36
  const named = groups.some((g) => g.label || g.sub)
  return (
    <div ref={rowRef} aria-label={label} className={cn('no-scrollbar flex items-stretch gap-0 overflow-x-auto', className)} data-circles>
      {groups.map((g, gi) => (
        <div key={g.key} className={cn('flex min-w-0 flex-col', gi > 0 && 'ml-3 border-l border-line pl-3', g.steps.length > 1 ? '' : 'flex-none')} style={g.steps.length > 1 ? { flex: `${g.steps.length} 1 0`, minWidth: `${g.steps.length * 4.75}rem` } : undefined}>
          {named && <div className="mb-1.5 flex h-5 items-center gap-2 px-1">
            {g.label && (g.onLabel
              ? <button type="button" onClick={g.onLabel} className="whitespace-nowrap text-[0.75rem] font-semibold text-ink-2 hover:text-ink">{g.label}</button>
              : <span className="whitespace-nowrap text-[0.75rem] font-semibold text-ink-2">{g.label}</span>)}
            {g.sub && <span className={cn('whitespace-nowrap text-[0.75rem]', g.subTone === 'bad' ? 'font-semibold text-bad-600' : 'text-muted')}>{g.sub}</span>}
            {g.label && g.steps.length > 1 && <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />}
          </div>}
          <ol className="flex items-start justify-center">
            {g.steps.map((st, i) => {
              const on = at === st.key
              return (
                <li key={st.key} className="relative flex min-w-[4.75rem] flex-col items-center" style={{ flex: `0 1 ${100 / Math.max(EVEN, g.steps.length)}%` }} data-state={st.state}>
                  {i > 0 && <Link pct={linkAfter(g.steps[i - 1], st)} className="absolute h-[0.1875rem]" style={{ top: sz / 2 - 1.5, left: `calc(-50% + ${sz / 2 + 6}px)`, right: `calc(50% + ${sz / 2 + 6}px)` }} />}
                  <button type="button" onClick={() => onPick?.(st.key)} disabled={!onPick} aria-current={on ? 'step' : undefined} aria-label={`${st.label}${st.sub ? ` — ${st.sub}` : ''}`} {...(st.attrs || {})} className="group relative z-[1] flex w-full flex-col items-center px-1 text-center disabled:cursor-default">
                    <span className="transition group-hover:scale-105"><Circle st={st} size={sz} on={on} /></span>
                    <span title={st.label.replace(/\u00AD/g, '')} className={cn('mt-1.5 line-clamp-2 max-w-full whitespace-normal text-[0.75rem] font-semibold leading-[1.15] max-sm:line-clamp-3', on ? 'text-ink' : st.state === 'later' ? 'text-muted' : 'text-ink-2')}>{st.label}</span>
                    {st.sub && <span title={st.sub} className={cn('mt-0.5 max-w-full truncate text-[0.6875rem] leading-tight', C_SUB[st.state])}>{st.sub}</span>}
                    <span className={cn('mt-1 h-[0.1875rem] w-6 rounded-full', on ? 'bg-brand-600' : 'bg-transparent')} />
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}
