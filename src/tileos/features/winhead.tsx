/* The top of every window that opens from a list — a step, a task — the same every time:
 *   the project · the part (small)
 *   the thing to do (big)
 *   then a few short lines, each with its name on the left:
 *     Who does it  — their circle and name (You, Yakov)
 *     When         — its day (or Where it is: waiting on…, done…, not yet…)
 *     Watching     — a task: who's watching it, as circles; + to add someone
 *   a problem, in red, when there is one
 * Each line is what you tap to change it (where you may): who does it gives it to someone else (you, to take it over);
 * when moves it; watching adds or takes off people. No menus to dig through, no sentences explaining how it works. */
import * as React from 'react'
import { Check, ChevronDown, CircleAlert, Plus } from 'lucide-react'
import { Avatar } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel, Pop, DatePresets } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'

export type WinTone = 'late' | 'warn' | 'ok' | 'quiet'

/** who it can be given to: you first ("Me"), then the rest */
export type WhoPick = { people: PersonKey[]; me: PersonKey; current?: PersonKey; onPick: (p: PersonKey) => void }
/** the day it's on: tap it, pick another */
export type WhenPick = { value?: string; onPick: (label: string) => void; presets?: string[]; /** over the days: "Move it to" unless it says */ title?: string }
/** who's watching it: their circles; + to add someone or take them off (you only yourself, unless it's yours to say) */
export type WatchPick = { people: PersonKey[]; me: PersonKey; current: PersonKey[]; onToggle: (p: PersonKey) => void; /** anyone can be added (its person, the admin) — else only you */ anyone: boolean }

const CHIP = '-mx-1.5 inline-flex min-w-0 items-center gap-1.5 rounded-full px-1.5 py-0.5 transition hover:bg-wash-2 focus-visible:bg-wash-2 focus-visible:outline-none'

export function WinHead({ place, title, who, whoText, state, tone, problem, more, extra, attrs, whoPick, whenPick, whoLabel = 'Who does it', stateLabel = 'When', watch }: {
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
  /** the names on the left of the lines: "Who does it", "When" — "Done by", "Where it is" */
  whoLabel?: string
  stateLabel?: string
  /** who's watching (a task) */
  watch?: WatchPick
}) {
  const [dayOpen, setDayOpen] = React.useState(false)
  const [watchOpen, setWatchOpen] = React.useState(false)
  const whoBody = (
    <>
      {who && <Avatar who={who} size={20} />}
      {whoText && <span className="min-w-0 text-left font-medium text-ink-2" data-win-owner>{whoText}</span>}
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
      {/* a few short lines, each with its name on the left */}
      <div className="mt-3 grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-[0.875rem] max-sm:grid-cols-[6rem_minmax(0,1fr)]" data-win-who>
        {(whoText || whoPick) && <>
          <span className="text-muted" data-win-label="who">{whoLabel}</span>
          <span className="flex min-w-0 items-center">
            {whoPick ? (
              <Menu align="start" width={260} trigger={<button type="button" className={CHIP} aria-label="Who does it — change it" data-who-pick>{whoBody}<ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" /></button>}>
                <MenuLabel>Who does it</MenuLabel>
                {[whoPick.me, ...whoPick.people.filter((p) => p !== whoPick.me)].map((p) => (
                  <MenuItem key={p} icon={<Avatar who={p} size={20} plain />} hint={p === whoPick.me ? undefined : PEOPLE[p]?.roleLabel} onSelect={() => { if (p !== whoPick.current) whoPick.onPick(p) }} data-who-option={p}>
                    <span className="flex min-w-0 items-center gap-2"><span className="min-w-0 truncate">{p === whoPick.me ? 'Me' : PEOPLE[p]?.name || p}</span>{p === whoPick.current && <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}</span>
                  </MenuItem>
                ))}
              </Menu>
            ) : <span className="inline-flex min-w-0 items-center gap-1.5">{whoBody}</span>}
          </span>
        </>}
        {state && <>
          <span className="text-muted" data-win-label="when">{stateLabel}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2">
            {whenPick ? (
              <Pop open={dayOpen} onOpenChange={setDayOpen} align="start" width={330} trigger={<button type="button" className={cn(CHIP, stateCls)} aria-label="When — change it" data-when-pick><span className="min-w-0 truncate" data-win-state>{state}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" /></button>}>
                <div className="mb-2.5 text-[0.875rem] font-semibold text-ink">{whenPick.title || 'Move it to'}</div>
                <DatePresets value={whenPick.value} presets={whenPick.presets} onPick={(d) => { setDayOpen(false); whenPick.onPick(d) }} />
              </Pop>
            ) : <span className={stateCls} data-win-state>{state}</span>}
            {extra && <span className="text-muted">· {extra}</span>}
          </span>
        </>}
        {watch && <>
          <span className="self-start pt-0.5 text-muted" data-win-label="watch">Watching</span>
          {/* like the two lines above it: tap what it says to change it. Each one their circle and name — more than fit
              go on to the next line (nothing cut off); nobody yet: Add someone */}
          <span className="flex min-w-0 items-center" data-win-watch={watch.current.join(',')}>
            <Pop open={watchOpen} onOpenChange={setWatchOpen} align="start" width={300} trigger={
              <button type="button" className={cn(CHIP, 'flex-wrap gap-x-3 gap-y-1 rounded-lg text-left')} aria-label="Who’s watching — add or take off" data-watch-add>
                {watch.current.length > 0
                  ? watch.current.map((p) => <span key={p} className="inline-flex items-center gap-1.5 text-ink-2" data-win-watcher={p}><Avatar who={p} size={20} />{p === watch.me ? 'You' : PEOPLE[p]?.short || p}</span>)
                  : <span className="inline-flex items-center gap-1 font-medium text-muted"><Plus className="h-3.5 w-3.5" />Add someone</span>}
                {watch.current.length > 0 && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />}
              </button>
            }>
              <div className="text-[0.875rem] font-semibold text-ink">Who’s watching</div>
              <div className="mb-2 mt-0.5 text-[0.8125rem] text-muted">They see it and hear when it moves — they don’t do it.</div>
              <div className="-mx-1 flex flex-col" data-watch-list>
                {[watch.me, ...watch.people.filter((p) => p !== watch.me)].filter((p) => watch.anyone || p === watch.me).map((p) => {
                  const on = watch.current.includes(p)
                  return (
                    <button key={p} type="button" role="checkbox" aria-checked={on} onClick={() => watch.onToggle(p)} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2 text-left text-[0.9375rem] text-ink transition hover:bg-wash" data-watch-person={p}>
                      <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c9ced6] bg-white')}>{on && <Check className="h-3 w-3" strokeWidth={3.2} />}</span>
                      <Avatar who={p} size={22} /><span className="min-w-0 flex-1 truncate">{p === watch.me ? 'Me' : PEOPLE[p]?.name || p}</span>
                    </button>
                  )
                })}
              </div>
            </Pop>
          </span>
        </>}
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
