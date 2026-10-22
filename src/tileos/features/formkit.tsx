/* One frame for everything you add from + New — the same as "Site issue or question":
 *   on top, the kind's icon in its color, the project (or "New") and what it is;
 *   then the questions as rows — the question on the left, the answer on the right (stacked on a phone), each answer a
 *   box you type in or a dropdown; the project is typed, never a wall of every project;
 *   at the bottom, a photo button where it fits, and the one button that saves it. */
import * as React from 'react'
import * as PO from '@radix-ui/react-popover'
import { Building2, Camera, Check, Search, UserPlus, X } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, STAGE_LABEL, type Job, type PersonKey } from '@/tileos/data/model'
import { addDays, dayShort, dow, TODAY, labelFromIso } from '@/tileos/lib/today'
import { KIND, TILE_COLORS } from './newpicker'
import { insidePeople } from './steps-ui'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { isOff } from './active'

/** the top of the form: the kind's icon in its color, the project, and what it is */
export function FormHead({ k, kicker, title, right }: { k: string; kicker?: React.ReactNode; title?: React.ReactNode; right?: React.ReactNode }) {
  const kind = KIND[k]
  const c = TILE_COLORS[kind?.c || 'slate']
  const I = kind?.i
  return (
    <div className="border-b border-line px-6 pb-4 pt-5 pr-16 max-sm:px-4 max-sm:pr-14" data-form-head={k}>
      <div className="flex items-center gap-3">
        {I && <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.6875rem] text-white" style={{ background: c.solid }}><I className="h-5 w-5" /></span>}
        <div className="min-w-0">
          <div className="truncate text-[0.8125rem] font-medium text-muted">{kicker || 'New'}</div>
          <h2 className="truncate text-[1.25rem] font-bold tracking-[-0.01em] text-ink max-sm:text-[1.125rem]">{title || kind?.l}</h2>
        </div>
        {right && <span className="ml-auto shrink-0">{right}</span>}
      </div>
    </div>
  )
}

/** one question of the form: the question on the left, the answer on the right (stacked on a phone) */
export function FormRow({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-x-5 gap-y-1.5 border-t border-line-2 py-3.5 first:border-t-0 first:pt-0 max-sm:grid-cols-1', className)}>
      <div className="pt-2.5 text-[0.84375rem] font-semibold text-ink-2 max-sm:pt-0">{label}</div>
      <div className="min-w-0">
        {children}
        {hint && <div className="mt-1.5 text-[0.78125rem] text-muted">{hint}</div>}
      </div>
    </div>
  )
}

const ORDER = ['installation', 'punch', 'ready', 'scheduled', 'verification', 'setup', 'awarded', 'closeout', 'request', 'estimating', 'proposal', 'followup', 'complete']
/** the projects worth picking — the ones on the go first */
export function projectsFor(s: Pick<Store, 'jobs'>, keep?: (j: Job) => boolean) {
  return Object.values(s.jobs).filter((j) => j.stage !== 'complete' && (!keep || keep(j))).sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage) || a.name.localeCompare(b.name))
}

/** the project, typed: start typing a name, an address or a client and pick it — no list of every project; the few on
 *  the go show only when you click into it */
export function ProjectField({ value, onChange, keep, placeholder = 'Type the project — its name, address or client', autoFocus, invalid }: {
  value: string
  onChange: (id: string) => void
  keep?: (j: Job) => boolean
  placeholder?: string
  autoFocus?: boolean
  invalid?: boolean
}) {
  const s = useStore()
  const [q, setQ] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [hi, setHi] = React.useState(0)
  const input = React.useRef<HTMLInputElement>(null)
  const cur = value ? s.jobs[value] : undefined
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const all = projectsFor(s, keep)
  /* nothing typed yet: the few on the go; typed: whatever matches */
  const shown = (words.length ? all.filter((j) => words.every((w) => `${j.name} ${j.address} ${j.client}`.toLowerCase().includes(w))) : all).slice(0, words.length ? 8 : 5)
  React.useEffect(() => setHi(0), [q])
  const pick = (id: string) => { onChange(id); setQ(''); setOpen(false) }
  if (cur && !open) {
    return (
      <div className={cn('flex h-10 min-w-0 items-center gap-2.5 rounded-[0.625rem] border border-line bg-white pl-3 pr-1.5', invalid && 'border-bad-300')} data-project-field={cur.id}>
        <Building2 className="h-4 w-4 shrink-0 text-faint" />
        <span className="min-w-0 flex-1 truncate text-[0.875rem]"><b className="font-semibold text-ink">{cur.name}</b><span className="ml-2 text-[0.78125rem] text-muted">{cur.client}</span></span>
        <button type="button" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 10) }} className="shrink-0 rounded-md px-2 py-1 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50">Change</button>
      </div>
    )
  }
  return (
    <PO.Root open={open && (shown.length > 0 || words.length > 0)} onOpenChange={(o) => { if (!o) setOpen(false) }}>
      <PO.Anchor asChild>
        <label className={cn('flex h-10 min-w-0 items-center gap-2.5 rounded-[0.625rem] border bg-white px-3 transition focus-within:border-brand-300 focus-within:ring-[0.1875rem] focus-within:ring-brand-50', invalid ? 'border-bad-300' : 'border-line')}>
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={input}
            aria-label="Project"
            autoFocus={autoFocus}
            value={q}
            onClick={() => setOpen(true)}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { setOpen(true); return } setHi((h) => Math.min(shown.length - 1, h + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)) }
              if (e.key === 'Enter' && shown[hi]) { e.preventDefault(); pick(shown[hi].id) }
              if (e.key === 'Escape' && cur) { e.preventDefault(); setOpen(false); setQ('') }
            }}
            placeholder={placeholder}
            className="h-full min-w-0 flex-1 bg-transparent text-[0.875rem] text-ink placeholder:text-faint focus:outline-none"
          />
          {cur && <button type="button" aria-label="Keep the project" onClick={() => { setOpen(false); setQ('') }} className="text-faint hover:text-ink"><X className="h-4 w-4" /></button>}
        </label>
      </PO.Anchor>
      <PO.Portal>
        <PO.Content align="start" sideOffset={6} collisionPadding={12} onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => { if (input.current?.contains(e.target as Node)) e.preventDefault() }}
          className="z-[320] w-[var(--radix-popover-trigger-width)] min-w-[18rem] overflow-hidden rounded-[0.75rem] border border-line bg-white p-1 shadow-pop outline-none animate-pop-in" role="listbox" aria-label="Projects">
          {!words.length && <div className="px-2.5 pb-1 pt-1.5 text-[0.71875rem] font-semibold uppercase tracking-[0.05em] text-faint">On the go — or type to find another</div>}
          {shown.map((j, i) => (
            <button key={j.id} type="button" role="option" aria-selected={j.id === value} onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(j.id)} className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left', i === hi ? 'bg-wash-2' : '')}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.875rem] font-semibold text-ink">{j.name}</span>
                <span className="block truncate text-[0.75rem] text-muted">{[j.client, j.address, STAGE_LABEL[j.stage]].filter(Boolean).join(' · ')}</span>
              </span>
              {j.id === value && <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
            </button>
          ))}
          {words.length > 0 && !shown.length && <div className="px-3 py-5 text-center text-[0.84375rem] text-muted">No project like “{q}”.</div>}
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  )
}

/** the client, typed: the ones that match show as you type — or add the name as a new client */
export function ClientField({ value, onChange, placeholder = 'Type the client or GC — or a new name', autoFocus }: {
  value: { id: string; name: string } | null
  onChange: (c: { id: string; name: string } | null) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const s = useStore()
  const [q, setQ] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [hi, setHi] = React.useState(0)
  const input = React.useRef<HTMLInputElement>(null)
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const all = Object.values(CUSTOMERS).filter((c) => !isOff(s, 'client', c.id))
  const shown = words.length ? all.filter((c) => words.every((w) => `${c.name} ${c.kind || ''}`.toLowerCase().includes(w))).slice(0, 6) : []
  const canAdd = q.trim().length > 1 && !all.some((c) => c.name.toLowerCase() === q.trim().toLowerCase())
  const opts = [...shown.map((c) => ({ id: c.id, name: c.name, hint: c.kind })), ...(canAdd ? [{ id: 'new', name: q.trim(), hint: 'new' }] : [])]
  React.useEffect(() => setHi(0), [q])
  const pick = (c: { id: string; name: string }) => { onChange({ id: c.id, name: c.name }); setQ(''); setOpen(false) }
  if (value && !open) {
    return (
      <div className="flex h-10 min-w-0 items-center gap-2.5 rounded-[0.625rem] border border-line bg-white pl-3 pr-1.5" data-client-field={value.id}>
        <Building2 className="h-4 w-4 shrink-0 text-faint" />
        <span className="min-w-0 flex-1 truncate text-[0.875rem]"><b className="font-semibold text-ink">{value.name}</b>{value.id === 'new' && <span className="ml-2 text-[0.78125rem] text-muted">new client</span>}</span>
        <button type="button" onClick={() => { onChange(null); setOpen(true); setTimeout(() => input.current?.focus(), 10) }} className="shrink-0 rounded-md px-2 py-1 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50">Change</button>
      </div>
    )
  }
  return (
    <PO.Root open={open && opts.length > 0} onOpenChange={(o) => { if (!o) setOpen(false) }}>
      <PO.Anchor asChild>
        <label className="flex h-10 min-w-0 items-center gap-2.5 rounded-[0.625rem] border border-line bg-white px-3 transition focus-within:border-brand-300 focus-within:ring-[0.1875rem] focus-within:ring-brand-50">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={input}
            aria-label="Client"
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(opts.length - 1, h + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)) }
              if (e.key === 'Enter' && opts[hi]) { e.preventDefault(); pick(opts[hi]) }
            }}
            placeholder={placeholder}
            className="h-full min-w-0 flex-1 bg-transparent text-[0.875rem] text-ink placeholder:text-faint focus:outline-none"
          />
        </label>
      </PO.Anchor>
      <PO.Portal>
        <PO.Content align="start" sideOffset={6} collisionPadding={12} onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => { if (input.current?.contains(e.target as Node)) e.preventDefault() }}
          className="z-[320] w-[var(--radix-popover-trigger-width)] min-w-[16rem] overflow-hidden rounded-[0.75rem] border border-line bg-white p-1 shadow-pop outline-none animate-pop-in" role="listbox" aria-label="Clients">
          {opts.map((c, i) => (
            <button key={c.id + c.name} type="button" role="option" aria-selected={i === hi} onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)} className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left', i === hi ? 'bg-wash-2' : '')}>
              {c.id === 'new' ? <UserPlus className="h-4 w-4 shrink-0 text-brand-600" /> : <Building2 className="h-4 w-4 shrink-0 text-faint" />}
              <span className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-ink">{c.id === 'new' ? `Add “${c.name}”` : c.name}</span>
              <span className="shrink-0 text-[0.75rem] text-muted">{c.id === 'new' ? 'as a new client' : c.hint}</span>
            </button>
          ))}
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  )
}

/** who, and when — two dropdowns side by side (the same as "Waiting on: who · back when") */
const workDaysAhead = (n: number) => Array.from({ length: 14 }, (_, i) => addDays(TODAY, i)).filter((d) => dow(d) !== 6 && dow(d) !== 0).slice(0, n)
/** "By Mon, Oct 19" — today and tomorrow say just that */
export const byDay = (label: string, prefix = 'By') => (/^(Today|Tomorrow)/.test(label) ? label : `${prefix} ${label}`)
export const DAY_OPTIONS = () => workDaysAhead(10).map((d) => ({ key: labelFromIso(d), label: d === TODAY ? `Today · ${dayShort(d)}` : labelFromIso(d) === 'Tomorrow' ? `Tomorrow · ${dayShort(d)}` : dayShort(d) }))
export function WhoWhen({ who, onWho, when, onWhen, whoLabel = 'Who', whenLabel = 'When', whenPrefix = 'By', people }: {
  who: PersonKey
  onWho: (p: PersonKey) => void
  when: string
  onWhen: (d: string) => void
  whoLabel?: string
  whenLabel?: string
  whenPrefix?: string
  people?: PersonKey[]
}) {
  const s = useStore()
  const list = people || insidePeople(s)
  const days = DAY_OPTIONS()
  if (!days.some((d) => d.key === when)) days.unshift({ key: when, label: when })
  return (
    <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
      <SearchSelect label={whoLabel} value={who} onChange={(k) => onWho(k as PersonKey)} search={list.length > 8} width={300} options={list.map((p) => ({ key: p, label: PEOPLE[p]?.name || p, hint: PEOPLE[p]?.roleLabel, lead: <Avatar who={p} size={22} /> }))} plain />
      <SearchSelect label={whenLabel} value={when} onChange={onWhen} search={false} width={260} options={days.map((d) => ({ ...d, label: byDay(d.label, whenPrefix) }))} plain />
    </div>
  )
}

/** a photo or two with it — the same button on every form */
export function PhotoButton({ photos, onAdd, label = 'Add photo' }: { photos: File[]; onAdd: (f: File[]) => void; label?: string }) {
  const ref = React.useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" aria-label="Photos" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; if (l.length) onAdd(l) }} />
      <button type="button" onClick={() => ref.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-[0.5625rem] border border-[#d9d3c9] bg-white px-3.5 text-[0.84375rem] font-semibold text-ink-2 shadow-xs transition hover:border-[#c9c2b7] hover:bg-wash hover:text-ink">
        <Camera className="h-4 w-4" />{photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : label}
      </button>
    </>
  )
}
