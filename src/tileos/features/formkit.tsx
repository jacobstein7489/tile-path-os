/* One frame for everything you add from + New — the same as "Site issue or question":
 *   on top, the kind's icon in its color, the project (or "New") and what it is;
 *   then the questions as rows — the question on the left, the answer on the right (stacked on a phone), each answer a
 *   box you type in or a dropdown; the project is typed, never a wall of every project;
 *   at the bottom, a photo button where it fits, and the one button that saves it. */
import * as React from 'react'
import * as PO from '@radix-ui/react-popover'
import { flushSync } from 'react-dom'
import { Building2, Camera, Check, ChevronDown, ChevronRight, Search, UserPlus, X } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { useSmall } from '@/tileos/lib/phone'
import { PEOPLE, STAGE_LABEL, type Job, type PersonKey } from '@/tileos/data/model'
import { addDays, dayShort, dow, TODAY, labelFromIso } from '@/tileos/lib/today'
import { KIND, PART_TINT } from './newpicker'
import { insidePeople } from './steps-ui'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { isOff } from './active'
import { scrollHere, Modal } from '@/tileos/components/ui/overlay'

/** the top of the form: the kind's icon in its color, the project, and what it is */
export function FormHead({ k, kicker, title, right }: { k: string; kicker?: React.ReactNode; title?: React.ReactNode; right?: React.ReactNode }) {
  const kind = KIND[k]
  /* the same soft color as on + New: the job site warm, the paperwork blue, something new green, a problem red */
  const c = PART_TINT[k === 'problem' ? 'bad' : kind?.g || 'office']
  const I = kind?.i
  return (
    <div className="px-6 pb-1 pt-5 pr-16 max-sm:px-4 max-sm:pr-4 max-sm:pt-1 [[data-stacked]_&]:pt-1.5 [[data-stacked]_&]:pr-6" data-form-head={k}>
      <div className="flex items-center gap-3">
        {I && <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem]" style={{ background: c.bg, color: c.fg }}><I className="h-[1.125rem] w-[1.125rem]" /></span>}
        <div className="min-w-0">
          {/* "New" over the name — not when the name already says it (New project) */}
          {(kicker || !/^New\b/.test(String(title || kind?.l || ''))) && <div className="truncate text-[0.8125rem] font-medium text-muted">{kicker || 'New'}</div>}
          <h2 className="truncate text-[1.25rem] font-bold tracking-[-0.01em] text-ink max-sm:text-[1.125rem]">{title || kind?.l}</h2>
        </div>
        {right && <span className="ml-auto shrink-0">{right}</span>}
      </div>
    </div>
  )
}

/** one question of the form: the question over its answer — no lines between them, the same on a computer and a phone */
export function FormRow({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('py-2.5 first:pt-0', className)} data-form-row>
      <div className="mb-1.5 text-[0.84375rem] font-semibold text-ink-2">{label}</div>
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
 *  the go show only when you click into it. On a phone (picks): one box, like any other — tap it and one small window
 *  lists the projects on the go (yours first, nothing typed, no keyboard); tap one and the window closes by itself */
export function ProjectField({ value, onChange, keep, placeholder = 'Type the project', autoFocus, invalid, picks = true }: {
  value: string
  onChange: (id: string) => void
  keep?: (j: Job) => boolean
  placeholder?: string
  autoFocus?: boolean
  invalid?: boolean
  /** on a phone, one box that opens the list in its own small window — off where the project is only if you like */
  picks?: boolean
}) {
  const s = useStore()
  const [q, setQ] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [hi, setHi] = React.useState(0)
  const small = useSmall()
  const input = React.useRef<HTMLInputElement>(null)
  const cur = value ? s.jobs[value] : undefined
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const all = projectsFor(s, keep)
  /* nothing typed yet: the few on the go; typed: whatever matches */
  const shown = (words.length ? all.filter((j) => words.every((w) => `${j.name} ${j.address} ${j.client}`.toLowerCase().includes(w))) : all).slice(0, words.length ? 8 : 5)
  React.useEffect(() => setHi(0), [q])
  const pick = (id: string) => { onChange(id); setQ(''); setOpen(false) }
  const tap = small && picks
  const [sheet, setSheet] = React.useState(false)
  if (tap) {
    const me = meOf(s.role)
    const mine = (j: Job) => j.site === me || j.pm === me || j.crew === me || j.estimator === me
    return (
      <>
        <button type="button" onClick={() => setSheet(true)} data-project-open data-project-field={cur?.id || undefined}
          className={cn('flex h-14 w-full min-w-0 items-center gap-3 rounded-xl border bg-white pl-3.5 pr-3 text-left transition active:bg-wash', invalid ? 'border-bad-300' : 'border-line')}>
          <Building2 className="h-5 w-5 shrink-0 text-faint" />
          {cur ? (
            <span className="min-w-0 flex-1 truncate text-[1rem]"><b className="font-semibold text-ink">{cur.name}</b><span className="ml-2 text-[0.8125rem] text-muted">{cur.client}</span></span>
          ) : <span className="min-w-0 flex-1 truncate text-[1rem] text-faint">Pick the project</span>}
          <ChevronDown className="h-5 w-5 shrink-0 text-faint" />
        </button>
        {sheet && <ProjectSheet list={[...all.filter(mine), ...all.filter((j) => !mine(j))]} value={value} onPick={(id) => { setSheet(false); onChange(id) }} onClose={() => setSheet(false)} />}
      </>
    )
  }
  if (cur && !open) {
    return (
      <div className={cn('flex h-10 min-w-0 items-center gap-2.5 rounded-[0.625rem] border border-line bg-white pl-3 pr-1.5 max-sm:h-14 max-sm:rounded-xl max-sm:pl-3.5', invalid && 'border-bad-300')} data-project-field={cur.id}>
        <Building2 className="h-4 w-4 shrink-0 text-faint max-sm:h-5 max-sm:w-5" />
        <span className="min-w-0 flex-1 truncate text-[0.875rem] max-sm:text-[1rem]"><b className="font-semibold text-ink">{cur.name}</b><span className="ml-2 text-[0.78125rem] text-muted max-sm:text-[0.8125rem]">{cur.client}</span></span>
        <button type="button" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 10) }} className="shrink-0 rounded-md px-2 py-1 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50 max-sm:text-[0.9375rem]" data-project-change>Change</button>
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
        <PO.Content {...scrollHere} align="start" sideOffset={6} collisionPadding={12} onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => { if (input.current?.contains(e.target as Node)) e.preventDefault() }}
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

/** a phone: the projects on the go in one small window — a list, yours first; a box on top finds one by name, address
 *  or client (it takes the keyboard only when you tap it). Tap a project: it's picked and the window closes. */
/** a small pick, as a chip — the project, who, when on a new task: one tap opens its list */
export const PICK_CHIP = 'inline-flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[0.84375rem] font-medium text-ink-2 transition hover:border-[#cdc7bc] hover:bg-wash focus-visible:border-brand-300 focus-visible:outline-none [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:text-muted'

/** the project as one chip: tap it, pick one — on a computer a list you can type into, on a phone its own small window
 *  (yours first, no keyboard). "No project" is a company task */
export function ProjectChip({ value, onChange, keep, placeholder = 'Project', warn }: { value: string; onChange: (id: string) => void; keep?: (j: Job) => boolean; placeholder?: string; /** it needs one — said in amber */ warn?: boolean }) {
  const s = useStore()
  const small = useSmall()
  const [sheet, setSheet] = React.useState(false)
  const cur = value ? s.jobs[value] : undefined
  const me = meOf(s.role)
  const all = projectsFor(s, keep)
  const mine = (j: Job) => j.site === me || j.pm === me || j.crew === me || j.estimator === me
  const list = [...all.filter(mine), ...all.filter((j) => !mine(j))]
  if (cur && !list.includes(cur)) list.unshift(cur)
  const chip = (onClick?: () => void) => (
    <button type="button" onClick={onClick} aria-label="Project" className={cn(PICK_CHIP, cur && 'text-ink', !cur && warn && '!border-warn-300 !bg-warn-50 !text-warn-700')} data-project-chip={cur?.id || ''}>
      <Building2 /><span className="min-w-0 truncate">{cur ? cur.name : placeholder}</span><ChevronDown className="!h-3.5 !w-3.5 !text-faint" />
    </button>
  )
  if (small) return <>{chip(() => setSheet(true))}{sheet && <ProjectSheet list={list} value={value} onPick={(id) => { setSheet(false); onChange(id) }} onClose={() => setSheet(false)} />}</>
  return <SearchSelect label="Project" value={value} onChange={onChange} options={list.map((j) => ({ key: j.id, label: j.name, hint: j.client }))} emptyLabel="No project — for the company" search searchPlaceholder="Type a project" width={340} trigger={chip()} />
}

function ProjectSheet({ list, value, onPick, onClose }: { list: Job[]; value: string; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = React.useState('')
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const shown = words.length ? list.filter((j) => words.every((w) => `${j.name} ${j.address} ${j.client}`.toLowerCase().includes(w))) : list
  return (
    <Modal level={9} size="sm" onClose={onClose} title="Pick the project" bodyClass="p-0">
      <div data-project-sheet>
        {list.length > 6 && (
          <div className="px-4 pb-3 pt-1">
            <label className="flex h-11 min-w-0 items-center gap-2.5 rounded-xl border border-line bg-white px-3 focus-within:border-brand-300">
              <Search className="h-4 w-4 shrink-0 text-faint" />
              <input aria-label="Find a project" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a project" className="h-full min-w-0 flex-1 bg-transparent text-[1rem] text-ink placeholder:text-faint focus:outline-none" />
              {q && <button type="button" aria-label="Clear" onClick={() => setQ('')} className="text-faint"><X className="h-4 w-4" /></button>}
            </label>
          </div>
        )}
        {shown.map((j) => (
          <button key={j.id} type="button" onClick={() => onPick(j.id)} aria-pressed={j.id === value} data-project-pick={j.id}
            className="flex min-h-[3.5rem] w-full min-w-0 items-center gap-3 border-t border-line-2 px-4 py-2 text-left active:bg-wash">
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[1rem] font-semibold text-ink">{j.name}</span>
              {j.client && <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">{j.client}</span>}
            </span>
            {j.id === value && <Check className="h-5 w-5 shrink-0 text-brand-600" strokeWidth={2.5} />}
          </button>
        ))}
        {!shown.length && <div className="border-t border-line-2 px-4 py-6 text-center text-[0.9375rem] text-muted">No project like “{q}”.</div>}
      </div>
    </Modal>
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
        <PO.Content {...scrollHere} align="start" sideOffset={6} collisionPadding={12} onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => { if (input.current?.contains(e.target as Node)) e.preventDefault() }}
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
export function PhotoButton({ photos, onAdd, label = 'Add photo', big }: { photos: File[]; onAdd: (f: File[]) => void; label?: string; /** thumb-sized, for the phone */ big?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" aria-label="Photos" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; if (l.length) onAdd(l) }} />
      <button type="button" onClick={() => ref.current?.click()} data-photo-button className={cn('inline-flex items-center gap-2 border border-[#d9d3c9] bg-white font-semibold text-ink-2 shadow-xs transition hover:border-[#c9c2b7] hover:bg-wash hover:text-ink', big ? 'h-12 rounded-xl px-4 text-[1rem]' : 'h-9 rounded-[0.5625rem] px-3.5 text-[0.84375rem]')}>
        <Camera className={big ? 'h-5 w-5' : 'h-4 w-4'} />{photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : label}
      </button>
    </>
  )
}
