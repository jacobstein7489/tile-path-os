/* Yes · No · N/A — the one way every question on a project's checklist is answered, the same on the project, on the
 * site check and on Today. Tap the answer that's on to take it back. A No asks what's wrong (type it or say it). */
import * as React from 'react'
import { TextInput } from '@/tileos/components/ui/core'
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
