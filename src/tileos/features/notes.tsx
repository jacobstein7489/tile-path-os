/* The notes on a task or a step — the same on both: only what people wrote (never what the app did), newest first,
 * and one quiet box to add one. A note is always the writer's own. */
import * as React from 'react'
import { Avatar, Button, TextInput } from '@/tileos/components/ui/core'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import { cn } from '@/tileos/lib/utils'

export type NoteLine = { date: string; who: string; text: string }

export function Notes({ notes, onAdd, me, kind, className }: {
  notes: NoteLine[]
  /** no box to add one when it's done */
  onAdd?: (text: string) => void
  me: PersonKey
  /** the marks the checks look for: data-task-notes / data-step-notes … */
  kind: 'task' | 'step'
  className?: string
}) {
  const [text, setText] = React.useState('')
  const add = () => { const v = text.trim(); if (!v || !onAdd) return; onAdd(v); setText('') }
  const name = (w: string) => (w === 'system' ? 'Tile OS' : w === me ? 'You' : PEOPLE[w as PersonKey]?.short || w)
  if (!notes.length && !onAdd) return null
  return (
    <div className={className} {...{ [`data-${kind}-notes`]: '' }}>
      {notes.length > 0 && (
        <ul className="scroll-soft -mx-1 mb-1 max-h-[14rem] overflow-y-auto px-1" {...{ [`data-${kind}-log`]: '' }}>
          {[...notes].reverse().map((l, i) => (
            <li key={i} className="flex min-w-0 items-start gap-2.5 py-1.5">
              {PEOPLE[l.who as PersonKey] ? <Avatar who={l.who as PersonKey} size={22} /> : <span className="mt-0.5 inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-wash-2 text-[0.625rem] font-semibold text-muted">OS</span>}
              <span className="min-w-0 flex-1 pt-px text-[0.875rem] leading-snug text-ink-2">{l.text}</span>
              <span className="shrink-0 pt-0.5 text-[0.75rem] tnum text-faint">{name(l.who)} · {l.date}</span>
            </li>
          ))}
        </ul>
      )}
      {onAdd && (
        <div className={cn('flex items-center gap-2', notes.length > 0 && 'mt-1')}>
          <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note…" onKeyDown={(e) => { if (e.key === 'Enter') add() }} aria-label="Add a note" {...{ [`data-${kind}-note`]: '' }} />
          {text.trim() && <Button onClick={add}>Add</Button>}
        </div>
      )}
    </div>
  )
}
