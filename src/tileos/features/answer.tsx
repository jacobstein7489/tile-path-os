/* Yes · No · N/A — the one way every question on a project's checklist is answered, the same on the project, on the
 * site check and on Today. Tap the answer that's on to take it back. A No asks what's wrong (type it or say it). */
import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { TextInput } from '@/tileos/components/ui/core'
import { Menu, MenuItem } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import type { Answer } from './ready'

const OPTS: [Answer, string][] = [['yes', 'Yes'], ['no', 'No'], ['na', 'N/A']]
const ON: Record<Answer, string> = { yes: 'bg-[#2c8a5b] text-white shadow-[0_0.0625rem_0.125rem_rgba(16,24,40,.12)]', no: 'bg-bad-500 text-white shadow-[0_0.0625rem_0.125rem_rgba(16,24,40,.12)]', na: 'bg-[#8b867d] text-white' }

export function AnswerPick({ value, onPick, q, disabled, locked, className }: {
  value?: Answer
  onPick: (a: Answer | null) => void
  /** the question, for the screen reader and the tests */
  q: string
  disabled?: boolean
  /** answers that can't be given (it reads itself from what really happened) — with why */
  locked?: Partial<Record<Answer, string>>
  className?: string
}) {
  return (
    <span role="radiogroup" aria-label={q} className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-full border border-line bg-white p-0.5', disabled && 'opacity-70', className)}>
      {OPTS.map(([a, label]) => {
        const on = value === a
        const why = locked?.[a]
        return (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${label} — ${q}`}
            data-answer={a}
            title={why}
            disabled={disabled || !!why}
            onClick={(e) => { e.stopPropagation(); onPick(on ? null : a) }}
            className={cn(
              'inline-flex h-7 min-w-[2.625rem] items-center justify-center rounded-full px-2.5 text-[0.8125rem] font-semibold transition pointer-coarse:h-9 pointer-coarse:min-w-[3rem]',
              on ? ON[a] : 'text-ink-2 enabled:hover:bg-wash',
              !on && (disabled || why) && 'text-faint',
              on && 'answer-on',
            )}
          >
            {label}
          </button>
        )
      })}
    </span>
  )
}

/** under a No: what's wrong — saved when you leave the box or press Enter */
export function NoNote({ value, onSave, autoFocus, placeholder = 'What’s wrong? — e.g. the drains aren’t here yet', disabled }: { value?: string; onSave: (t: string) => void; autoFocus?: boolean; placeholder?: string; disabled?: boolean }) {
  const [t, setT] = React.useState(value || '')
  React.useEffect(() => setT(value || ''), [value])
  const save = () => { if (t.trim() !== (value || '')) onSave(t.trim()) }
  /* typed or said: kept a moment after the last word, without having to leave the box */
  const saveRef = React.useRef(save)
  saveRef.current = save
  React.useEffect(() => { if (t.trim() === (value || '')) return; const id = setTimeout(() => saveRef.current(), 900); return () => clearTimeout(id) }, [t, value])
  return (
    <TextInput
      mic
      autoFocus={autoFocus}
      disabled={disabled}
      aria-label="What’s wrong"
      className="h-9 border-bad-200 bg-bad-50/30 text-[0.875rem]"
      value={t}
      onChange={(e) => setT(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); (e.target as HTMLInputElement).blur() } }}
      placeholder={placeholder}
    />
  )
}

/** the site check's answers: Yes · Some (looked at room by room — pick the rooms that miss it) · No · N/A */
export type SiteVal = 'yes' | 'some' | 'no' | 'na'
const SITE_OPTS: [SiteVal, string][] = [['yes', 'Yes'], ['some', 'Some'], ['no', 'No'], ['na', 'N/A']]
const SITE_ON: Record<SiteVal, string> = { ...ON, some: 'bg-[#d98c0b] text-white shadow-[0_0.0625rem_0.125rem_rgba(16,24,40,.12)]' }
const SITE_DOT: Record<SiteVal, string> = { yes: 'bg-[#2c8a5b]', some: 'bg-[#d98c0b]', no: 'bg-bad-500', na: 'bg-[#8b867d]' }
/** the answer, picked from a drop-down: it shows the answer (or Pick), the choices open under it — every row the same */
export function SitePick({ value, onPick, q, byRoom, disabled, className }: { value?: SiteVal; onPick: (a: SiteVal | null) => void; q: string; /** "Some" only where it's looked at room by room */ byRoom?: boolean; disabled?: boolean; className?: string }) {
  const opts = SITE_OPTS.filter(([a]) => a !== 'some' || byRoom)
  const label = value ? SITE_OPTS.find(([a]) => a === value)?.[1] : 'Pick'
  const button = (
    <button type="button" disabled={disabled} aria-label={`${q} ${value ? label : 'not answered'}`} data-site-pick={value || ''}
      className={cn('inline-flex h-10 w-[7.25rem] shrink-0 items-center gap-2 rounded-[0.625rem] border bg-white px-3 text-left text-[0.9375rem] font-semibold transition disabled:opacity-60',
        value ? 'border-line text-ink' : 'border-[#cfc9be] text-muted', 'enabled:hover:border-[#bdb6aa]', className)}>
      {value && <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', SITE_DOT[value])} aria-hidden />}
      <span className="min-w-0 flex-1">{label}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-faint" aria-hidden />
    </button>
  )
  if (disabled) return button
  return (
    <Menu align="end" width={180} trigger={button}>
      {opts.map(([a, l]) => (
        <MenuItem key={a} onSelect={() => onPick(a)} checked={value === a} data-answer={a} icon={<span className={cn('h-2.5 w-2.5 rounded-full', SITE_DOT[a])} />}>{l}</MenuItem>
      ))}
    </Menu>
  )
}
