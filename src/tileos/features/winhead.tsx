/* The top of every window that opens from a list — a step, a task — the same every time:
 *   the project · the part (small)
 *   the thing to do (big)
 *   whose it is — their circle and name — and when (or where it stands: waiting on…, done…, not yet…)
 *   a problem, in red, when there is one
 * Under it the work, nothing else. At the bottom: yours — the button that does it; someone else's — Remind them
 * (the admin can take it over; anyone can follow it). No sentences explaining how the app works. */
import * as React from 'react'
import { CircleAlert } from 'lucide-react'
import { Avatar } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import type { PersonKey } from '@/tileos/data/model'

export type WinTone = 'late' | 'warn' | 'ok' | 'quiet'

export function WinHead({ place, title, who, whoText, state, tone, problem, more, extra, attrs }: {
  /** the project · the part */
  place: React.ReactNode
  title: React.ReactNode
  /** whose it is: their circle */
  who?: PersonKey
  /** "Yours", "Yakov has it", "You and Yaakov — whoever gets to it first" */
  whoText?: React.ReactNode
  /** when, or where it stands: "Due Nov 17", "Was due Nov 5", "Waiting on the store · back Nov 10", "Done Nov 3" */
  state?: React.ReactNode
  tone?: WinTone
  /** what's wrong, in a few words */
  problem?: React.ReactNode
  /** the ··· menu */
  more?: React.ReactNode
  /** one more short thing on the same line (it repeats every week) */
  extra?: React.ReactNode
  /** marks the checks look for */
  attrs?: Record<string, string | undefined>
}) {
  return (
    <div className="border-b border-line px-6 pb-4 pt-5 pr-16 max-sm:px-4 max-sm:pr-14" data-win-head {...attrs}>
      <div className="flex min-h-5 min-w-0 items-center gap-2 text-[0.8125rem] text-muted">
        <span className="min-w-0 truncate" data-win-place>{place}</span>
        {more && <span className="-my-1.5 ml-auto shrink-0 pl-2">{more}</span>}
      </div>
      <h2 className="font-display mt-1 text-[1.3125rem] font-semibold leading-snug tracking-[-0.01em] text-ink max-sm:text-[1.1875rem]" data-win-title>{title}</h2>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem]" data-win-who>
        {who && <Avatar who={who} size={20} />}
        {whoText && <span className="font-medium text-ink-2" data-win-owner>{whoText}</span>}
        {whoText && state && <span className="text-faint" aria-hidden>·</span>}
        {state && <span className={cn(tone === 'late' ? 'font-medium text-bad-600' : tone === 'warn' ? 'font-medium text-warn-700' : tone === 'ok' ? 'font-medium text-[#2c8a5b]' : tone === 'quiet' ? 'text-muted' : 'text-ink-2')} data-win-state>{state}</span>}
        {extra && <><span className="text-faint" aria-hidden>·</span><span className="text-ink-2">{extra}</span></>}
      </div>
      {problem && (
        <div className="mt-2 flex min-w-0 items-start gap-2 text-[0.875rem] font-medium leading-snug text-bad-700" data-win-problem>
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0">{problem}</span>
        </div>
      )}
    </div>
  )
}
