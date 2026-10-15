import * as React from 'react'
import { cn, TONE } from '@/tileos/lib/utils'
import { Mic, canListen, addSaid } from './mic'
import type { Tone, PersonKey } from '@/tileos/data/model'
import { PEOPLE } from '@/tileos/data/model'
import { Check, ChevronRight, Search, X } from 'lucide-react'

/* ---------------- Button ---------------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'soft' | 'link' | 'outline'
type BtnSize = 'lg' | 'md' | 'sm' | 'xs'
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  full?: boolean
}
const BTN_V: Record<BtnVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-btn hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-200 disabled:shadow-none',
  secondary: 'bg-white text-ink-2 border border-[#d6dae0] shadow-xs hover:border-[#c6ccd4] hover:bg-wash hover:text-ink disabled:text-faint disabled:hover:bg-white',
  ghost: 'text-ink-2 hover:bg-wash-2 disabled:text-faint',
  danger: 'bg-white text-bad-600 border border-bad-100 hover:bg-bad-50',
  success: 'bg-ok-600 text-white shadow-btn hover:bg-ok-700',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  outline: 'bg-white text-ink border border-[#d6dae0] shadow-xs hover:border-brand-300 hover:text-brand-700 disabled:text-faint disabled:border-line',
  link: 'text-brand-600 hover:text-brand-700 px-0 h-auto',
}
const BTN_S: Record<BtnSize, string> = {
  lg: 'h-10 px-4 text-[0.875rem] rounded-[0.625rem] gap-2',
  md: 'h-9 px-3.5 text-[0.84375rem] rounded-[0.5625rem] gap-2',
  sm: 'h-8 px-3 text-[0.8125rem] rounded-[0.5rem] gap-1.5',
  xs: 'h-7 px-2.5 text-[0.78125rem] rounded-[0.4375rem] gap-1.5',
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, full, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      data-variant={variant}
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-colors duration-150 select-none [&_svg]:h-4 [&_svg]:w-4',
        BTN_S[size],
        BTN_V[variant],
        variant === 'link' && 'h-auto px-0',
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  )
})

export function IconButton({ className, label, children, size = 'md', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'md' | 'sm' }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[0.625rem] border border-line bg-white text-ink-2 shadow-[0_0.0625rem_0.125rem_rgba(17,19,24,.06)] transition-colors hover:bg-wash hover:text-ink',
        size === 'md' ? 'h-9 w-9' : 'h-8 w-8',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function CloseButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label="Close"
      title="Close (Esc)"
      className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-wash-2 hover:text-ink', className)}
    >
      <X className="h-5 w-5" strokeWidth={1.75} />
    </button>
  )
}

/* ---------------- Pill / dot ---------------- */
export function Pill({ tone = 'neutral', children, className, size = 'md', dot }: { tone?: Tone; children: React.ReactNode; className?: string; size?: 'md' | 'sm' | 'lg'; dot?: boolean }) {
  const t = TONE[tone]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-wash-2 font-medium',
        size === 'lg' ? 'h-7 px-3 text-[0.8125rem]' : size === 'md' ? 'h-6 px-2.5 text-[0.78125rem]' : 'h-5 px-2 text-[0.75rem]',
        tone === 'bad' || tone === 'warn' ? t.strong : 'text-ink-2',
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />}
      {children}
    </span>
  )
}

export function Dot({ tone = 'neutral', className }: { tone?: Tone; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', TONE[tone].dot, className)} />
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-white px-1 font-sans text-[0.6875rem] font-medium text-muted">{children}</kbd>
}

/* ---------------- Avatar ---------------- */
export function Avatar({ who, size = 32, className, ring, plain }: { who: PersonKey; size?: number; className?: string; ring?: boolean; plain?: boolean }) {
  const p = PEOPLE[who] || PEOPLE.system
  return (
    <span
      title={p.name}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none', plain ? 'bg-[#eceef1] text-[#4a5361]' : [p.bg, p.fg], ring && 'ring-2 ring-white', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * (p.initials.length > 1 ? 0.36 : 0.42))) }}
    >
      {p.initials}
    </span>
  )
}
export function PersonLine({ who, sub, size = 32 }: { who: PersonKey; sub?: React.ReactNode; size?: number }) {
  const p = PEOPLE[who]
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <Avatar who={who} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[0.875rem] font-medium text-ink">{p.name}</span>
        {sub && <span className="block truncate text-[0.78125rem] text-muted">{sub}</span>}
      </span>
    </span>
  )
}

/* ---------------- Card ---------------- */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-[0.875rem] border border-line bg-white shadow-card', className)} {...rest}>
      {children}
    </div>
  )
}
export function CardHeader({ title, count, tone, icon, action, sub, className }: { title: React.ReactNode; count?: number | string; tone?: Tone; icon?: React.ReactNode; action?: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-x-4 gap-y-3 px-5 pt-4 pb-3 max-sm:flex-wrap max-sm:px-4', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          {icon}
          <h3 className="text-[0.9375rem] font-semibold text-ink">{title}</h3>
          {count !== undefined && <Count tone={tone}>{count}</Count>}
        </div>
        {sub && <p className="mt-0.5 text-[0.8125rem] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}
export function Count({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-wash-2 px-1.5 text-[0.75rem] font-semibold tnum', tone === 'bad' ? 'bg-bad-50 text-bad-700' : 'text-muted', className)}>{children}</span>
}

export function IconCircle({ tone = 'info', size = 48, children, className }: { tone?: Tone; size?: number; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-wash-2 text-ink-2 [&_svg]:h-[45%] [&_svg]:w-[45%]', className)} style={{ width: size, height: size }}>
      {children}
    </span>
  )
}

export function PageHeader({ title, sub, actions, className }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-6 max-md:mb-5 max-md:flex-col max-md:items-start max-md:gap-4', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.012em] text-ink max-md:text-[1.5rem]">{title}</h1>
        {sub && <p className="mt-1 text-[0.875rem] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 max-md:w-full">{actions}</div>}
    </div>
  )
}

export function LinkButton({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={cn('inline-flex items-center gap-1 text-[0.875rem] font-semibold text-brand-600 hover:text-brand-700', className)}>
      {children}
      <ChevronRight className="h-4 w-4" />
    </button>
  )
}

/* ---------------- Tabs ---------------- */
export function UnderlineTabs<T extends string>({ value, onChange, items, className, size = 'md' }: { value: T; onChange: (v: NoInfer<T>) => void; items: { key: NoInfer<T>; label: string; count?: number; tone?: Tone }[]; className?: string; size?: 'md' | 'sm' }) {
  return (
    <div className={cn('no-scrollbar flex items-center overflow-x-auto', !className?.includes('border-b-0') && 'shadow-[inset_0_-0.0625rem_0_var(--color-line)]', className)} role="tablist">
      {items.map((it) => {
        const on = it.key === value
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-0.5 font-semibold transition-colors [&+&]:ml-6 max-sm:[&+&]:ml-5',
              size === 'md' ? 'h-11 text-[0.875rem]' : 'h-10 text-[0.84375rem]',
              on ? 'text-ink' : 'text-muted hover:text-ink-2',
            )}
          >
            {it.label}
            {it.count !== undefined && <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.71875rem] font-semibold tnum', on ? (it.tone === 'bad' ? 'bg-bad-50 text-bad-700' : 'bg-brand-50 text-brand-700') : 'bg-wash-2 text-muted')}>{it.count}</span>}
            <span className={cn('absolute inset-x-0 bottom-0 h-[0.125rem] rounded-full transition-colors', on ? 'bg-brand-600' : 'bg-transparent')} />
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: NoInfer<T>) => void; items: { key: NoInfer<T>; label: string; icon?: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cn('inline-flex h-9 items-center rounded-[0.5625rem] border border-line bg-wash-2 p-[0.1875rem]', className)}>
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={cn(
            'inline-flex h-full items-center gap-1.5 rounded-[0.375rem] px-2.5 text-[0.8125rem] font-semibold transition-all',
            it.key === value ? 'bg-white text-ink shadow-[0_0.0625rem_0.125rem_rgba(17,19,24,.12)]' : 'text-muted hover:text-ink-2',
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Search field ---------------- */
export function SearchField({ value, onChange, placeholder, className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string; autoFocus?: boolean }) {
  return (
    <label className={cn('relative flex h-9 items-center rounded-[0.5625rem] border border-[#d6dae0] bg-white transition focus-within:border-brand-300 focus-within:ring-[0.1875rem] focus-within:ring-brand-100', className)}>
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-faint" />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full w-full rounded-lg bg-transparent pl-9 pr-8 text-[0.84375rem] text-ink placeholder:text-faint focus:outline-none"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-faint hover:bg-wash-2 hover:text-ink" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      )}
    </label>
  )
}

/* ---------------- Choice chips ---------------- */
export function Chip({ on, onClick, children, className, tone, icon }: { on?: boolean; onClick?: () => void; children: React.ReactNode; className?: string; tone?: Tone; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-[0.5rem] border px-2.5 text-[0.84375rem] font-medium transition',
        on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:border-[#cfd4db] hover:bg-wash',
        tone && !on && TONE[tone].text,
        className,
      )}
    >
      {icon}
      {children}
      {on && <Check className="h-4 w-4" strokeWidth={2.5} />}
    </button>
  )
}

export function OptionCard({ on, onClick, title, sub, icon, tone = 'info', className, children }: { on?: boolean; onClick?: () => void; title: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: Tone; className?: string; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition',
        on ? 'border-brand-500 bg-brand-50/60' : 'border-line bg-white hover:border-[#d5d9e0] hover:bg-wash',
        className,
      )}
    >
      {icon && <IconCircle tone={on ? 'info' : tone} size={40}>{icon}</IconCircle>}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-medium text-ink">{title}</span>
        {sub && <span className="mt-0.5 block text-[0.84375rem] leading-snug text-muted">{sub}</span>}
        {children}
      </span>
      <span className={cn('mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white')}>
        {on && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
    </button>
  )
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 text-[0.8125rem] font-medium text-ink-2">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-[0.78125rem] text-muted">{hint}</div>}
    </div>
  )
}

/** what was said into a box, handed to its onChange as if it were typed */
const sayInto = (onChange: ((e: any) => void) | undefined, was: unknown, t: string) => {
  const next = addSaid(typeof was === 'string' ? was : was == null ? '' : String(was), t)
  onChange?.({ target: { value: next }, currentTarget: { value: next } })
}
/** a one-line box; `mic` puts a mic in it to talk instead of typing */
export function TextInput({ mic, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { mic?: boolean }) {
  const box = <input {...props} className={cn('h-9 w-full rounded-[0.5625rem] border border-line bg-white px-3 text-[0.875rem] text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50', mic && canListen() && 'pr-11', props.className)} />
  if (!mic || !canListen() || props.disabled || props.readOnly) return box
  return <span className="relative block w-full">{box}<Mic size="sm" onText={(t) => sayInto(props.onChange, props.value, t)} className="absolute right-1 top-1/2 -translate-y-1/2 [&_button]:h-7 [&_button]:w-7 [&_button]:border-transparent" /></span>
}
/** a note box — with a mic in the corner to talk instead of typing (mic={false} for none) */
export function TextArea({ mic = true, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mic?: boolean }) {
  const on = mic && canListen() && !props.disabled && !props.readOnly
  const box = <textarea {...props} className={cn('min-h-[5.25rem] w-full resize-none rounded-lg border border-line bg-white px-3 py-2.5 text-[0.875rem] text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50', on && 'pr-12', props.className)} />
  if (!on) return box
  return <span className="relative block w-full">{box}<Mic size="sm" onText={(t) => sayInto(props.onChange, props.value, t)} className="absolute bottom-2.5 right-2" /></span>
}

export function Stepper({ value, onChange, min = 0, max = 99, suffix }: { value: number; onChange: (n: number) => void; min?: number; max?: number; suffix?: string }) {
  return (
    <div className="inline-flex h-10 items-center rounded-lg border border-line bg-white">
      <button className="h-full w-10 rounded-l-lg text-[1.0625rem] text-ink-2 hover:bg-wash" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="min-w-[4.25rem] text-center text-[0.90625rem] font-medium tnum text-ink">{value}{suffix ? ' ' + suffix : ''}</span>
      <button className="h-full w-10 rounded-r-lg text-[1.0625rem] text-ink-2 hover:bg-wash" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  )
}

export function Empty({ icon, title, sub, action, className }: { icon?: React.ReactNode; title: string; sub?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && <IconCircle tone="neutral" size={52}>{icon}</IconCircle>}
      <div className="mt-3 text-[0.9375rem] font-semibold text-ink">{title}</div>
      {sub && <div className="mt-1 max-w-sm text-[0.875rem] text-muted">{sub}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ---------------- KPI tile ---------------- */
export function KpiTile({ icon, tone, label, value, sub, onClick, valueTone }: { icon: React.ReactNode; tone: Tone; label: string; value: React.ReactNode; sub?: React.ReactNode; onClick?: () => void; valueTone?: Tone }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex w-full items-start gap-4 rounded-[0.875rem] border border-line bg-white p-5 text-left transition hover:border-[#cfd4db] max-sm:gap-3 max-sm:p-4"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[0.875rem] font-medium text-ink-2 max-sm:text-[0.8125rem]">{label}</span>
        <span className={cn('display-num mt-0.5 block text-[1.6875rem] font-semibold leading-[1.15] max-sm:text-[1.5rem]', valueTone ? TONE[valueTone].strong : 'text-ink')}>{value}</span>
        {sub && <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] leading-snug text-muted">{sub}</span>}
      </span>
      <ChevronRight className="absolute right-3.5 top-5 h-5 w-5 text-faint opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
    </button>
  )
}

/* a quiet row of numbers in one box — calmer than a row of cards */
export function StatStrip({ items, className }: { items: { label: string; value: React.ReactNode; sub?: React.ReactNode; bad?: boolean; active?: boolean; onClick?: () => void }[]; className?: string }) {
  const n = items.length
  return (
    <div className={cn('grid overflow-hidden rounded-[0.875rem] border border-line bg-white max-md:grid-cols-2', n === 4 ? 'grid-cols-4' : n === 3 ? 'grid-cols-3' : n === 5 ? 'grid-cols-5' : 'grid-cols-2', className)}>
      {items.map((x, i) => (
        <button
          key={x.label}
          onClick={x.onClick}
          className={cn(
            'group min-w-0 border-line-2 px-5 py-4 text-left transition-colors hover:bg-wash max-md:px-4 max-md:py-3.5',
            i > 0 && 'border-l max-md:border-l-0',
            'max-md:[&:nth-child(even)]:border-l max-md:[&:nth-child(n+3)]:border-t',
            x.active && 'bg-brand-50/60 hover:bg-brand-50',
          )}
        >
          <div className={cn('text-[0.8125rem] font-medium', x.active ? 'text-brand-700' : 'text-muted')}>{x.label}</div>
          <div className={cn('display-num mt-0.5 text-[1.4375rem] font-semibold leading-tight', x.bad ? 'text-bad-700' : 'text-ink')}>{x.value}</div>
          {x.sub && <div className="truncate text-[0.78125rem] text-muted group-hover:text-ink-2">{x.sub}</div>}
        </button>
      ))}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-line-2', className)} />
}

export function SectionLabel({ children, className, right }: { children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between', className)}>
      <div className="text-[0.84375rem] font-semibold text-muted">{children}</div>
      {right}
    </div>
  )
}

export function NumberBadge({ n, className }: { n: number; className?: string }) {
  return <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[0.75rem] font-semibold text-white', className)}>{n}</span>
}
