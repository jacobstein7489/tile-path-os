/* The top of every window that opens from a list — a task, a step, waiting on the GC — the same every time:
 *   what it is (Task, Change order, Waiting on the GC, Getting ready · Installer) and its project (tap: the project)
 *   the thing to do (big)
 *   one box of short lines, each with its name on the left, always these names, always in this order:
 *     Who does it  — their circle and name
 *     When         — its day
 *     Status       — where it stands: waiting on someone, done, not yet (only when there's something to say)
 *     Where        — the room, the wall (when it's about one)
 *     Watching     — who else sees it: their circles and names; Add someone
 *   a problem, in red, when there is one
 * Each line is what you tap to change it (where you may): who does it gives it to someone else (you, to take it over);
 * when moves it; watching adds or takes off people. The buttons are at the bottom of the window — on every window. */
import * as React from 'react'
import { Check, ChevronDown, ChevronRight, CircleAlert, Plus } from 'lucide-react'
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
/** what kind of thing it is — its icon and its name */
export type WinKind = { icon?: React.ReactNode; label: string }

const CHIP = '-mx-2 inline-flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-wash-2 focus-visible:bg-wash-2 focus-visible:outline-none'
const toneCls = (tone?: WinTone) => cn(tone === 'late' ? 'font-medium text-bad-600' : tone === 'warn' ? 'font-medium text-warn-700' : tone === 'ok' ? 'font-medium text-[#2c8a5b]' : tone === 'quiet' ? 'text-muted' : 'text-ink')

/** one line of the box: its name on the left, what it says on the right */
function Line({ k, label, top, children }: { k: string; label: string; top?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('grid min-h-[2.75rem] grid-cols-[7rem_minmax(0,1fr)] gap-x-3 border-t border-line-2 px-4 py-1.5 first:border-t-0 max-sm:grid-cols-[6.25rem_minmax(0,1fr)] max-sm:px-3', top ? 'items-start' : 'items-center')} data-win-line={k}>
      <span className={cn('text-[0.875rem] text-muted', top && 'pt-[0.3125rem]')} data-win-label={k}>{label}</span>
      <div className="flex min-w-0 items-center">{children}</div>
    </div>
  )
}

export function WinHead({ kind, place, onPlace, title, who, whoText, state, tone, status, statusTone, where, problem, more, extra, attrs, whoPick, whenPick, whoLabel = 'Who does it', watch }: {
  /** what it is: Task, Change order, Waiting on the GC, Getting ready · Installer */
  kind?: WinKind
  /** its project */
  place: React.ReactNode
  /** tap the project: open it */
  onPlace?: () => void
  title: React.ReactNode
  /** whose it is: their circle */
  who?: PersonKey
  /** "You", "Yakov", "You or Yaakov — whoever gets to it first" */
  whoText?: React.ReactNode
  /** when: "Today", "Was due Nov 5", "Follow up Nov 18", "Needed by Nov 20" */
  state?: React.ReactNode
  tone?: WinTone
  /** where it stands: "Waiting on the plumber", "Done Nov 3", "Not yet — after the site check" */
  status?: React.ReactNode
  statusTone?: WinTone
  /** the room, the wall */
  where?: React.ReactNode
  /** what's wrong, in a few words */
  problem?: React.ReactNode
  /** the ··· menu */
  more?: React.ReactNode
  /** one more short thing on the When line (it repeats every week) */
  extra?: React.ReactNode
  /** marks the checks look for */
  attrs?: Record<string, string | undefined>
  /** whose it is can be changed here */
  whoPick?: WhoPick
  /** its day can be changed here */
  whenPick?: WhenPick
  /** "Who does it" — "Who did it" once it's done */
  whoLabel?: string
  /** a step that was never anyone's: none of the When names apply — still "When" */
  stateLabel?: string
  /** who's watching */
  watch?: WatchPick
}) {
  const [dayOpen, setDayOpen] = React.useState(false)
  const [watchOpen, setWatchOpen] = React.useState(false)
  const whoBody = (
    <>
      {who && <Avatar who={who} size={24} />}
      {whoText && <span className="min-w-0 text-[0.9375rem] font-medium text-ink" data-win-owner>{whoText}</span>}
    </>
  )
  const stateCls = toneCls(tone)
  return (
    <div className="px-6 pb-2 pt-5 max-sm:px-4 max-sm:pt-1 [[data-stacked]_&]:pt-1.5" data-win-head {...attrs}>
      {/* what it is, and its project — clear of the window's ✕ */}
      <div className="flex min-h-7 min-w-0 items-start gap-2 pr-10 max-sm:pr-0 [[data-stacked]_&]:pr-0">
        {/* the project goes on to the next line when there isn't room — never cut short */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          {kind && <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-wash-2 px-2.5 text-[0.8125rem] font-semibold text-ink-2 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-muted" data-win-kind>{kind.icon}{kind.label}</span>}
          {onPlace ? (
            <button type="button" onClick={onPlace} className="inline-flex min-h-7 min-w-0 max-w-full items-center gap-0.5 text-left text-[0.875rem] font-medium text-muted transition hover:text-brand-700" data-win-place aria-label="Open the project"><span className="min-w-0">{place}</span><ChevronRight className="h-3.5 w-3.5 shrink-0" /></button>
          ) : <span className="inline-flex min-h-7 min-w-0 items-center text-[0.875rem] font-medium text-muted" data-win-place>{place}</span>}
        </div>
        {more && <span className="-my-0.5 shrink-0 pl-1">{more}</span>}
      </div>
      <h2 className="font-display mt-2.5 text-[1.375rem] font-semibold leading-snug tracking-[-0.01em] text-ink max-sm:text-[1.25rem]" data-win-title>{title}</h2>
      {/* one box of short lines, each with its name on the left */}
      <div className="mt-4 rounded-xl border border-line bg-white" data-win-who>
        {(whoText || whoPick) && (
          <Line k="who" label={whoLabel}>
            {whoPick ? (
              <Menu align="start" width={260} trigger={<button type="button" className={CHIP} aria-label="Who does it — change it" data-who-pick>{whoBody}<ChevronDown className="h-4 w-4 shrink-0 text-faint" /></button>}>
                <MenuLabel>Who does it</MenuLabel>
                {[whoPick.me, ...whoPick.people.filter((p) => p !== whoPick.me)].map((p) => (
                  <MenuItem key={p} icon={<Avatar who={p} size={20} plain />} hint={p === whoPick.me ? undefined : PEOPLE[p]?.roleLabel} onSelect={() => { if (p !== whoPick.current) whoPick.onPick(p) }} data-who-option={p}>
                    <span className="flex min-w-0 items-center gap-2"><span className="min-w-0 truncate">{p === whoPick.me ? 'Me' : PEOPLE[p]?.name || p}</span>{p === whoPick.current && <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}</span>
                  </MenuItem>
                ))}
              </Menu>
            ) : <span className="inline-flex min-w-0 items-center gap-2">{whoBody}</span>}
          </Line>
        )}
        {state && (
          <Line k="when" label="When">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              {whenPick ? (
                <Pop open={dayOpen} onOpenChange={setDayOpen} align="start" width={330} trigger={<button type="button" className={cn(CHIP, 'text-[0.9375rem]', stateCls)} aria-label="When — change it" data-when-pick><span className="min-w-0" data-win-state>{state}</span><ChevronDown className="h-4 w-4 shrink-0 text-faint" /></button>}>
                  <div className="mb-2.5 text-[0.875rem] font-semibold text-ink">{whenPick.title || 'Move it to'}</div>
                  <DatePresets value={whenPick.value} presets={whenPick.presets} onPick={(d) => { setDayOpen(false); whenPick.onPick(d) }} />
                </Pop>
              ) : <span className={cn('text-[0.9375rem]', stateCls)} data-win-state>{state}</span>}
              {extra && <span className="text-[0.875rem] text-muted">· {extra}</span>}
            </span>
          </Line>
        )}
        {status && <Line k="status" label="Status"><span className={cn('min-w-0 text-[0.9375rem] leading-snug', toneCls(statusTone))} data-win-status>{status}</span></Line>}
        {where && <Line k="where" label="Where"><span className="min-w-0 text-[0.9375rem] leading-snug text-ink" data-win-where>{where}</span></Line>}
        {watch && (
          <Line k="watch" label="Watching" top={watch.current.length > 1}>
            {/* tap what it says to change it — each one their circle and name; more than fit go on to the next line
                (nothing cut off); nobody yet: Add someone */}
            <span className="flex min-w-0 items-center" data-win-watch={watch.current.join(',')}>
              <Pop open={watchOpen} onOpenChange={setWatchOpen} align="start" width={300} trigger={
                <button type="button" className={cn(CHIP, 'flex-wrap gap-x-3.5 gap-y-1.5')} aria-label="Who’s watching — add or take off" data-watch-add>
                  {watch.current.length > 0
                    ? watch.current.map((p) => <span key={p} className="inline-flex items-center gap-2 text-[0.9375rem] text-ink" data-win-watcher={p}><Avatar who={p} size={24} />{p === watch.me ? 'You' : PEOPLE[p]?.short || p}</span>)
                    : <span className="inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-brand-700"><Plus className="h-4 w-4" />Add someone</span>}
                  {watch.current.length > 0 && <ChevronDown className="h-4 w-4 shrink-0 text-faint" />}
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
          </Line>
        )}
      </div>
      {problem && (
        <div className="mt-3 flex min-w-0 items-start gap-2 rounded-xl bg-bad-50 px-4 py-2.5 text-[0.9375rem] font-medium leading-snug text-bad-700" data-win-problem>
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0">{problem}</span>
        </div>
      )}
    </div>
  )
}
