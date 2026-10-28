/* More ways to reach someone — a cell besides the office line, a billing email besides the main one. The same on every
 * client and each of its people, every designer, installer, supplier and team member: add as many as they have, say
 * what each one is for, and each shows on their page as a link to call or write. */
import * as React from 'react'
import { Phone, Mail, Plus, X, ChevronDown } from 'lucide-react'
import { TextInput } from '@/tileos/components/ui/core'
import { Menu, MenuItem } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import type { Reach } from '@/tileos/data/model'

export const PHONE_LABELS = ['Cell', 'Office', 'Home', 'Fax', 'Other']
export const EMAIL_LABELS = ['Work', 'Billing', 'Personal', 'Other']
export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())

/** the list as it's kept: empty rows out, spaces trimmed (nothing at all: no list) */
export function cleanReach(list: Reach[] | undefined): Reach[] | undefined {
  const out = (list || []).map((r) => ({ ...r, value: r.value.trim() })).filter((r) => r.value)
  return out.length ? out : undefined
}
/** every email typed in is an email address */
export const reachOk = (list: Reach[] | undefined) => (list || []).every((r) => r.kind !== 'email' || !r.value.trim() || isEmail(r.value))
const telOf = (v: string) => `tel:${v.replace(/ext.*$/i, '').replace(/[^\d+]/g, '')}`

/** the editor: one row for each extra phone or email — what it's for, the number or address, and × to take it off */
export function MoreReach({ value, onChange, className }: { value: Reach[] | undefined; onChange: (v: Reach[]) => void; className?: string }) {
  const list = value || []
  const [fresh, setFresh] = React.useState(-1)
  const set = (i: number, p: Partial<Reach>) => onChange(list.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const add = (kind: Reach['kind']) => { setFresh(list.length); onChange([...list, { kind, value: '', label: kind === 'phone' ? 'Cell' : 'Work' }]) }
  const drop = (i: number) => { setFresh(-1); onChange(list.filter((_, j) => j !== i)) }
  return (
    <div className={cn('flex flex-col gap-2', className)} data-more-reach>
      {list.map((r, i) => {
        const bad = r.kind === 'email' && !!r.value.trim() && !isEmail(r.value)
        const Icon = r.kind === 'phone' ? Phone : Mail
        return (
          <div key={i} data-reach-row={r.kind}>
            <div className="flex items-center gap-2">
              <Menu
                align="start"
                width={180}
                trigger={
                  <button type="button" aria-label={`What this ${r.kind} is for`} className="inline-flex h-10 w-[7.75rem] shrink-0 items-center gap-1.5 rounded-[0.625rem] border border-line bg-white px-2.5 text-[0.8125rem] font-semibold text-ink-2 transition hover:bg-wash">
                    <Icon className="h-4 w-4 shrink-0 text-faint" /><span className="min-w-0 flex-1 truncate text-left">{r.label || 'Other'}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
                  </button>
                }
              >
                {(r.kind === 'phone' ? PHONE_LABELS : EMAIL_LABELS).map((l) => <MenuItem key={l} checked={(r.label || 'Other') === l} onSelect={() => set(i, { label: l })}>{l}</MenuItem>)}
              </Menu>
              <TextInput
                autoFocus={i === fresh}
                aria-label={`${r.label || 'Other'} ${r.kind}`}
                type={r.kind === 'email' ? 'email' : 'text'}
                inputMode={r.kind === 'phone' ? 'tel' : 'email'}
                value={r.value}
                onChange={(e) => set(i, { value: e.target.value })}
                placeholder={r.kind === 'phone' ? '(718) 555-0100' : 'name@company.com'}
                className="h-10 min-w-0 flex-1"
              />
              <button type="button" aria-label={`Take this ${r.kind} off`} onClick={() => drop(i)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-wash hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            {bad && <div className="mt-1 pl-[8.25rem] text-[0.75rem] font-medium text-bad-600 max-sm:pl-0">That isn’t an email address</div>}
          </div>
        )
      })}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <button type="button" onClick={() => add('phone')} data-add-phone className="inline-flex h-8 items-center gap-1.5 text-[0.8125rem] font-semibold text-brand-700 hover:underline"><Plus className="h-4 w-4" />Another phone</button>
        <button type="button" onClick={() => add('email')} data-add-email className="inline-flex h-8 items-center gap-1.5 text-[0.8125rem] font-semibold text-brand-700 hover:underline"><Plus className="h-4 w-4" />Another email</button>
      </div>
    </div>
  )
}

/** on a page's header: each extra as a link — tap to call or write — with what it's for */
export function reachLines(list: Reach[] | undefined): { icon: React.ReactNode; text: string; href: string }[] {
  return (list || []).filter((r) => r.value).map((r) => ({ icon: r.kind === 'phone' ? <Phone /> : <Mail />, text: `${r.value}${r.label ? ` · ${r.label}` : ''}`, href: r.kind === 'phone' ? telOf(r.value) : `mailto:${r.value}` }))
}

/** a person's phones and emails, one under the other (a contact's card): the main ones, then the extras */
export function ReachRows({ phone, email, more, className }: { phone?: string; email?: string; more?: Reach[]; className?: string }) {
  const rows = [
    ...(phone ? [{ kind: 'phone' as const, value: phone, label: '' }] : []),
    ...(email ? [{ kind: 'email' as const, value: email, label: '' }] : []),
    ...(more || []).filter((r) => r.value),
  ]
  if (!rows.length) return <div className={cn('text-[0.8125rem] text-faint', className)}>No phone or email yet</div>
  return (
    <div className={cn('flex flex-col gap-1 text-[0.84375rem] text-ink-2', className)}>
      {rows.map((r, i) => {
        const Icon = r.kind === 'phone' ? Phone : Mail
        return (
          <a key={i} href={r.kind === 'phone' ? telOf(r.value) : `mailto:${r.value}`} className="inline-flex min-w-0 items-center gap-2 hover:text-brand-700">
            <Icon className="h-4 w-4 shrink-0 text-faint" /><span className="truncate">{r.value}</span>{r.label && <span className="shrink-0 text-[0.78125rem] text-muted">· {r.label}</span>}
          </a>
        )
      })}
    </div>
  )
}
