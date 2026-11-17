/* The notes on a task or a step — the same on both, at the same place in every window (under what it's about, over the
 * buttons): its name, what people wrote (never what the app did), newest first, and a box to write one — with the mic
 * to say it, and Add right there. A note is always the writer's own. */
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
    <div className={cn('border-t border-line-2 pt-4', className)} {...{ [`data-${kind}-notes`]: '' }}>
      {/* its name, like a heading — so the box reads as the notes, not as the one thing to do */}
      <div className="mb-2 flex items-baseline gap-2" data-notes-head>
        <span className="text-[0.9375rem] font-semibold text-ink">Notes</span>
        {notes.length > 0 && <span className="text-[0.8125rem] font-semibold text-faint tnum">{notes.length}</span>}
      </div>
      {notes.length > 0 && (
        <ul className="scroll-soft -mx-1 mb-2 max-h-[14rem] overflow-y-auto px-1" {...{ [`data-${kind}-log`]: '' }}>
          {[...notes].reverse().map((l, i) => (
            <li key={i} className="flex min-w-0 items-start gap-2.5 py-1.5">
              {PEOPLE[l.who as PersonKey] ? <Avatar who={l.who as PersonKey} size={24} /> : <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wash-2 text-[0.625rem] font-semibold text-muted">OS</span>}
              <span className="min-w-0 flex-1 pt-0.5 text-[0.9375rem] leading-snug text-ink">{l.text}</span>
              <span className="shrink-0 pt-1 text-[0.75rem] tnum text-faint">{name(l.who)} · {l.date}</span>
            </li>
          ))}
        </ul>
      )}
      {onAdd && (
        <div className="flex items-center gap-2">
          {/* the mic in the box: say it instead of typing */}
          <TextInput mic className="h-10 text-[0.9375rem]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a note for the team…" onKeyDown={(e) => { if (e.key === 'Enter') add() }} aria-label="Add a note" {...{ [`data-${kind}-note`]: '' }} />
          <Button className="h-10" onClick={add} disabled={!text.trim()} data-note-add>Add</Button>
        </div>
      )}
    </div>
  )
}
