/* The top of every window that opens from a list — a step, a task — the same every time:
 *   the project · the part (small)
 *   the thing to do (big)
 *   whose it is — their circle and name — and when (or where it stands: waiting on…, done…, not yet…)
 *   a problem, in red, when there is one
 * Whose it is and when are what you tap to change them (where you may): "Yaakov has it ▾" gives it to someone else
 * (you, to take it over); "Due today ▾" moves it. No menus to dig through, no sentences explaining how the app works. */
import * as React from 'react'
import { Check, ChevronDown, CircleAlert } from 'lucide-react'
import { Avatar } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel, Pop, DatePresets } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'

export type WinTone = 'late' | 'warn' | 'ok' | 'quiet'

/** who it can be given to: you first ("Me"), then the rest */
export type WhoPick = { people: PersonKey[]; me: PersonKey; current?: PersonKey; onPick: (p: PersonKey) => void }
/** the day it's on: tap it, pick another */
export type WhenPick = { value?: string; onPick: (label: string) => void; presets?: string[]; /** over the days: "Move it to" unless it says */ title?: string }

const CHIP = '-mx-1.5 inline-flex min-w-0 items-center gap-1.5 rounded-full px-1.5 py-0.5 transition hover:bg-wash-2 focus-visible:bg-wash-2 focus-visible:outline-none'

export function WinHead({ place, title, who, whoText, state, tone, problem, more, extra, attrs, whoPick, whenPick }: {
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
  /** whose it is can be changed here */
  whoPick?: WhoPick
  /** its day can be changed here */
  whenPick?: WhenPick
}) {
  const [dayOpen, setDayOpen] = React.useState(false)
  const whoBody = (
    <>
      {who && <Avatar who={who} size={20} />}
      {whoText && <span className="min-w-0 truncate font-medium text-ink-2" data-win-owner>{whoText}</span>}
    </>
  )
  const stateCls = cn(tone === 'late' ? 'font-medium text-bad-600' : tone === 'warn' ? 'font-medium text-warn-700' : tone === 'ok' ? 'font-medium text-[#2c8a5b]' : tone === 'quiet' ? 'text-muted' : 'text-ink-2')
  return (
    <div className="px-6 pb-1 pt-5 pr-16 max-sm:px-4 max-sm:pr-4 max-sm:pt-1 [[data-stacked]_&]:pt-1.5 [[data-stacked]_&]:pr-6" data-win-head {...attrs}>
      <div className="flex min-h-5 min-w-0 items-center gap-2 text-[0.8125rem] text-muted">
        <span className="min-w-0 truncate" data-win-place>{place}</span>
        {more && <span className="-my-1.5 ml-auto shrink-0 pl-2">{more}</span>}
      </div>
      <h2 className="font-display mt-1 text-[1.3125rem] font-semibold leading-snug tracking-[-0.01em] text-ink max-sm:text-[1.1875rem]" data-win-title>{title}</h2>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem]" data-win-who>
        {whoPick ? (
          <Menu align="start" width={260} trigger={<button type="button" className={CHIP} aria-label="Whose it is — change it" data-who-pick>{whoBody}<ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" /></button>}>
            <MenuLabel>Who has it</MenuLabel>
            {[whoPick.me, ...whoPick.people.filter((p) => p !== whoPick.me)].map((p) => (
              <MenuItem key={p} icon={<Avatar who={p} size={20} plain />} hint={p === whoPick.me ? undefined : PEOPLE[p]?.roleLabel} onSelect={() => { if (p !== whoPick.current) whoPick.onPick(p) }} data-who-option={p}>
                <span className="flex min-w-0 items-center gap-2"><span className="min-w-0 truncate">{p === whoPick.me ? 'Me' : PEOPLE[p]?.name || p}</span>{p === whoPick.current && <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}</span>
              </MenuItem>
            ))}
          </Menu>
        ) : whoBody}
        {(whoText || whoPick) && state && <span className="text-faint" aria-hidden>·</span>}
        {state && (whenPick ? (
          <Pop open={dayOpen} onOpenChange={setDayOpen} align="start" width={330} trigger={<button type="button" className={cn(CHIP, stateCls)} aria-label="When — change it" data-when-pick><span className="min-w-0 truncate" data-win-state>{state}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" /></button>}>
            <div className="mb-2.5 text-[0.875rem] font-semibold text-ink">{whenPick.title || 'Move it to'}</div>
            <DatePresets value={whenPick.value} presets={whenPick.presets} onPick={(d) => { setDayOpen(false); whenPick.onPick(d) }} />
          </Pop>
        ) : <span className={stateCls} data-win-state>{state}</span>)}
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
