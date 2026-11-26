/* The notes on a task or a step — the same on both, at the same place in every window (under what it's about, over the
 * buttons): its name, what people wrote (never what the app did), newest first — who and when over each one — and one
 * box to write one, with the mic to say it and the arrow to add it, both inside the box. A note is always the writer's
 * own. */
import * as React from 'react'
import { ArrowUp } from 'lucide-react'
import { Avatar, NO_SUGGEST } from '@/tileos/components/ui/core'
import { Mic, addSaid } from '@/tileos/components/ui/mic'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import { cn } from '@/tileos/lib/utils'

export type NoteLine = { date: string; who: string; text: string; time?: string }

export function Notes({ notes, onAdd, me, kind, className, focus }: {
  notes: NoteLine[]
  /** no box to add one when it's done */
  onAdd?: (text: string) => void
  /** opened to write one (a meeting's Add notes): the box ready to type in */
  focus?: boolean
  me: PersonKey
  /** the marks the checks look for: data-task-notes / data-step-notes … */
  kind: 'task' | 'step' | 'event'
  className?: string
}) {
  const [text, setText] = React.useState('')
  const add = () => { const v = text.trim(); if (!v || !onAdd) return; onAdd(v); setText('') }
  const name = (w: string) => (w === 'system' ? 'Tile OS' : w === me ? 'You' : PEOPLE[w as PersonKey]?.short || w)
  const ready = !!text.trim()
  if (!notes.length && !onAdd) return null
  return (
    <div className={cn('pt-1', className)} {...{ [`data-${kind}-notes`]: '' }}>
      {/* its name, like a heading — so the box reads as the notes, not as the one thing to do */}
      <div className={cn('mb-2.5 flex items-baseline gap-2', !notes.length && 'hidden')} data-notes-head>
        <span className="text-[0.9375rem] font-semibold text-ink">Notes</span>
        {notes.length > 0 && <span className="text-[0.8125rem] font-semibold text-faint tnum">{notes.length}</span>}
      </div>
      {notes.length > 0 && (
        <ul className="scroll-soft -mx-1 mb-3 flex max-h-[15rem] flex-col gap-3 overflow-y-auto px-1 py-0.5" {...{ [`data-${kind}-log`]: '' }}>
          {[...notes].reverse().map((l, i) => (
            <li key={i} className="flex min-w-0 items-start gap-3">
              {PEOPLE[l.who as PersonKey] ? <Avatar who={l.who as PersonKey} size={26} /> : <span className="inline-flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-full bg-wash-2 text-[0.625rem] font-semibold text-muted">OS</span>}
              {/* who and when over it, what they wrote in a soft bubble — like a message */}
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8125rem] leading-tight text-muted"><b className="font-semibold text-ink-2">{name(l.who)}</b><span className="tnum"> · {l.date}{l.time ? `, ${l.time}` : ''}</span></span>
                <span className="mt-1 inline-block max-w-full rounded-2xl rounded-tl-md bg-wash-2 px-3.5 py-2 text-[0.9375rem] leading-snug text-ink">{l.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {onAdd && (
        /* one box: type it (or the mic, to say it) — the arrow adds it */
        <div className="flex min-h-11 items-center gap-1 rounded-full border border-line bg-pure py-1 pl-4 pr-1.5 shadow-[0_1px_2px_rgba(20,26,36,.04)] transition focus-within:border-brand-300 focus-within:ring-[0.1875rem] focus-within:ring-brand-50" data-note-box>
          <input
            {...NO_SUGGEST}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            autoFocus={focus}
            placeholder="Add a note…"
            aria-label="Add a note"
            className="h-9 min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-faint"
            {...{ [`data-${kind}-note`]: '' }}
          />
          <Mic size="sm" onText={(t) => setText((v) => addSaid(v, t))} className="[&_button]:h-8 [&_button]:w-8 [&_button]:border-transparent" />
          <button type="button" onClick={add} disabled={!ready} aria-label="Add the note" title="Add the note" className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition', ready ? 'bg-brand-600 text-white shadow-btn hover:bg-brand-700' : 'bg-wash-2 text-faint')} data-note-add>
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  )
}
