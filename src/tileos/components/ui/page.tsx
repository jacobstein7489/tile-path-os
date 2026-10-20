/* The page template every module uses (v10 — the first version's look, polished):
 *   big bold title on the gray ground, one line under it ............ actions
 *   [optional: the flow strip — where everything stands, with counts]
 *   one white card: tab chips and filters on top, then the list
 *   [optional: a side card]
 * Rows have a visual anchor (icon tile, progress ring, date leaf or initials), a bold title,
 * one line of details, and a few aligned facts on the right. */
import * as React from 'react'
import { ChevronDown, ChevronRight, Check, X, CircleCheck, CircleDashed, CircleAlert, CircleDot, Minus } from 'lucide-react'
import * as DM from '@radix-ui/react-dropdown-menu'
import { cn } from '@/tileos/lib/utils'
import { SearchField, Avatar } from './core'
import type { Tone, PersonKey } from '@/tileos/data/model'

/** side padding inside a card; rows line up with it */
export const PX = 'px-5 max-sm:px-4'
/** a list's column-name row: it stays pinned under the toolbar while the rows scroll */
export const STICKY_HEAD = 'sticky top-[calc(var(--app-top,0px)+var(--bar,0px))] z-[5]'
/** side padding of the page itself */
export const PAGE_PX = 'px-7 max-xl:px-6 max-lg:px-5 max-sm:px-3'

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
  /* how tall the pinned toolbar is, so the column names pin right under it */
  const barRef = React.useRef<HTMLDivElement>(null)
  const [bar, setBar] = React.useState(0)
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
      <div className="mx-auto w-full max-w-[92.5rem]">
        <header className={cn('flex min-h-[4.75rem] items-end justify-between gap-6 pb-4 pt-5 max-lg:min-h-0 max-lg:pt-4 max-md:flex-col max-md:items-start max-md:gap-2.5', PAGE_PX)}>
          <div className="min-w-0">
            <h1 className="font-display text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.015em] text-ink max-sm:text-[1.375rem]">{title}</h1>
            {sub && <div className="mt-1 max-w-[51.25rem] text-[0.84375rem] leading-snug text-muted max-sm:text-[0.8125rem]">{sub}</div>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5 max-md:w-full">{actions}</div>}
        </header>
        <div className={cn('flex flex-col gap-3.5', PAGE_PX)}>
          {top}
          <div className={cn('flex items-start gap-4', aside && 'max-xl:flex-col max-xl:items-stretch')}>
            {bare ? (
              <div className="min-w-0 flex-1">{children}</div>
            ) : (
              <section className="min-w-0 flex-1 overflow-clip rounded-[0.875rem] border border-line bg-white shadow-sheet" style={{ '--bar': bar + 'px' } as React.CSSProperties}>
                {(tabs || toolbar) && (
                  <div ref={barRef} className={cn('md:sticky md:top-[var(--app-top,0px)] md:z-[15] flex min-h-[3.25rem] flex-wrap items-center gap-2 border-b border-line bg-white py-2', PX)}>
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

export function CountPill({ children, tone = 'info' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={cn('inline-flex h-[1.375rem] min-w-[1.375rem] items-center justify-center rounded-full px-1.5 text-[0.75rem] font-bold tnum', tone === 'bad' ? 'bg-bad-50 text-bad-600' : tone === 'neutral' ? 'bg-wash-2 text-muted' : 'bg-brand-50 text-brand-600')}>{children}</span>
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
        <DM.Content align="start" sideOffset={6} className="scroll-soft z-[300] max-h-[min(26.25rem,70vh)] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-pop animate-pop-in" style={{ width }}>
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
  return <SearchField value={value} onChange={onChange} placeholder={placeholder} className="ml-auto h-9 w-[15rem] rounded-[0.625rem] border-[#d9d3c9] shadow-xs max-md:ml-0 max-md:w-full [&_input]:text-[0.84375rem]" />
}

/* ================= the list inside a card ================= */
const DOT: Record<Tone, string> = { bad: 'bg-bad-500', warn: 'bg-warn-500', ok: 'bg-ok-500', info: 'bg-brand-600', vio: 'bg-vio-500', neutral: 'bg-faint' }
const HALO: Record<Tone, string> = { bad: 'bg-bad-50', warn: 'bg-warn-50', ok: 'bg-ok-50', info: 'bg-brand-50', vio: 'bg-vio-50', neutral: 'bg-wash-2' }

/** a group heading inside a card (Overdue, Today, Coming up…): a dot, the name and a count */
export function Group({ label, count, tone = 'info', open = true, onToggle, hint, right }: { label: string; count?: number; tone?: Tone; open?: boolean; onToggle?: () => void; hint?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className={cn('flex items-center gap-2.5 pb-1.5 pt-3', PX)}>
      <button onClick={onToggle} disabled={!onToggle} className="inline-flex min-w-0 items-center gap-2.5 text-left disabled:cursor-default">
        <span className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full', HALO[tone])}><span className={cn('h-2 w-2 rounded-full', DOT[tone])} /></span>
        <span className={cn('truncate text-[0.8125rem] font-semibold', tone === 'bad' ? 'text-bad-700' : 'text-ink')}>{label}</span>
        {count !== undefined && <CountPill tone={tone === 'bad' ? 'bad' : tone === 'neutral' ? 'neutral' : 'info'}>{count}</CountPill>}
        {hint && <span className="ml-1 truncate text-[0.78125rem] text-faint max-md:hidden">{hint}</span>}
        {onToggle && (open ? <ChevronDown className="h-4 w-4 text-faint" /> : <ChevronRight className="h-4 w-4 text-faint" />)}
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
        onClick && 'cursor-pointer hover:bg-[#f7f5f0] focus-visible:bg-[#f7f5f0] focus-visible:outline-none',
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
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={cn('display-num text-[1.125rem] font-semibold leading-5', !b.on && 'text-ink')}>{b.count}</span>
                  {b.sub && <span className={cn('truncate whitespace-nowrap text-[0.75rem] font-semibold', b.on ? 'text-white/80' : b.subBad ? 'text-bad-600' : 'text-muted')}>{b.sub}</span>}
                </span>
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
    <th title={title} style={w !== undefined ? { width: w } : undefined} className={cn('h-9 whitespace-nowrap border-b border-line-2 bg-wash px-3 text-[0.75rem] font-semibold text-muted xl:sticky xl:top-[calc(var(--app-top,0px)+var(--bar,0px))] xl:z-[5]', EDGE, right && 'text-right', className)}>
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
      className={cn('group transition-colors [&>td]:border-b [&>td]:border-line-2', onClick && 'cursor-pointer hover:bg-[#f7f5f0] focus-visible:bg-[#f7f5f0] focus-visible:outline-none', dim && 'text-muted', className)}
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
export function GroupRow({ label, count, colSpan, open = true, onToggle, tone = 'info', hint }: { label: string; count?: number; colSpan: number; open?: boolean; onToggle?: () => void; tone?: Tone; hint?: string }) {
  return (
    <tr>
      <td className={cn('whitespace-nowrap border-b border-line-2 pb-2.5 pt-5', FIRST)}>
        <button onClick={onToggle} disabled={!onToggle} className="inline-flex items-center gap-2.5 text-left disabled:cursor-default">
          <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full', HALO[tone])}><span className={cn('h-2 w-2 rounded-full', DOT[tone])} /></span>
          <span className={cn('text-[0.875rem] font-bold', tone === 'bad' ? 'text-bad-700' : 'text-ink')}>{label}</span>
          {count !== undefined && <CountPill tone={tone === 'bad' ? 'bad' : 'info'}>{count}</CountPill>}
          {hint && <span className="ml-1 text-[0.78125rem] font-normal text-faint">{hint}</span>}
          {onToggle && (open ? <ChevronDown className="h-4 w-4 text-faint" /> : <ChevronRight className="h-4 w-4 text-faint" />)}
        </button>
      </td>
      {colSpan > 1 && <td colSpan={colSpan - 1} className="border-b border-line-2 max-md:hidden" />}
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
export function Status({ tone = 'neutral', children, className, plain }: { tone?: Tone; children: React.ReactNode; className?: string; plain?: boolean }) {
  return (
    <span className={cn('inline-flex h-6 min-w-0 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[0.78125rem] font-semibold', plain ? CHIP.neutral : CHIP[tone], className)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[plain ? 'neutral' : tone])} />
      <span className="truncate">{children}</span>
    </span>
  )
}

/* ---------------- a switch between ways of seeing a list ----------------
 * Mine / Everyone, By time / By project: easy to see (the one you're on is dark), and it never moves — nothing next to
 * it appears or changes width when you switch. */
export function ViewSwitch<K extends string | boolean>({ value, onChange, items, label, className }: { value: K; onChange: (k: K) => void; items: { key: K; label: string; short?: string; icon?: React.ReactNode; count?: number }[]; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex h-9 shrink-0 items-center rounded-[0.625rem] border border-[#d6d0c6] bg-white p-[0.1875rem] shadow-xs', className)}>
      {items.map((it) => {
        const on = it.key === value
        return (
          <button
            key={String(it.key)}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            className={cn('inline-flex h-[1.875rem] items-center gap-1.5 whitespace-nowrap rounded-[0.4375rem] px-3 text-[0.8125rem] font-semibold transition-colors max-sm:px-2.5 [&_svg]:h-[0.9375rem] [&_svg]:w-[0.9375rem] [&_svg]:shrink-0 max-sm:[&_svg]:hidden', on ? 'bg-ink text-white shadow-[0_0.0625rem_0.125rem_rgba(16,24,40,.2)]' : 'text-ink-2 hover:bg-wash hover:text-ink')}
          >
            {it.icon}{it.short ? <><span className="max-sm:hidden">{it.label}</span><span className="sm:hidden">{it.short}</span></> : it.label}{it.count != null && <span className={cn('text-[0.75rem] tnum', on ? 'text-white/70' : 'text-muted')}>{it.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- where something stands: step circles joined by a line ---------------- */
export function Path({ steps, className, at, label }: { steps: { key: string; label: string; state: 'done' | 'current' | 'future' | 'blocked'; sub?: string; date?: string; dateTone?: 'bad'; onClick?: () => void; aria?: string }[]; className?: string; at?: string; label?: string }) {
  return (
    <ol aria-label={label} className={cn('no-scrollbar flex items-start overflow-x-auto px-1.5 pb-1 pt-3', className)}>
      {steps.map((st, i) => {
        const prevDone = i > 0 && (steps[i - 1].state === 'done')
        const n = i + 1
        const on = at === st.key
        return (
          <li key={st.key} className="relative flex min-w-[5.75rem] flex-1 flex-col items-center text-center">
            {i > 0 && <span className={cn('absolute top-[0.9375rem] h-[0.125rem] rounded-full', prevDone && st.state !== 'future' ? 'bg-ok-500' : prevDone ? 'bg-gradient-to-r from-ok-500 to-[#e5e0d7]' : 'bg-[#e5e0d7]')} style={{ left: 'calc(-50% + 22px)', right: 'calc(50% + 22px)' }} />}
            <button
              onClick={st.onClick}
              disabled={!st.onClick}
              aria-label={st.aria}
              aria-current={on ? 'step' : undefined}
              className={cn('group relative z-[1] flex max-w-full flex-col items-center rounded-xl px-2 pb-1 disabled:cursor-default', on && 'bg-white')}
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
              <span className={cn('mt-2 max-w-[min(7.5rem,100%)] truncate text-[0.8125rem] font-semibold', st.state === 'current' ? 'text-brand-600' : st.state === 'future' ? 'text-muted' : st.state === 'blocked' ? 'text-bad-700' : 'text-ink', on && 'underline decoration-2 underline-offset-[0.3125rem]')}>{st.label}</span>
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
