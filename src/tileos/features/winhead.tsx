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
import { WinStar, type StarPick } from './star'
import { Building2, CalendarDays, Check, ChevronDown, ChevronRight, CircleAlert, CircleDot, Eye, HardHat, Hash, Mail, MapPin, Plus, Receipt, Trash2, UserRound, Users } from 'lucide-react'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Pop, MonthCal, TimeList } from '@/tileos/components/ui/overlay'
import { isoFromLabel, pickedLabel, dayShort } from '@/tileos/lib/today'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'

export type WinTone = 'late' | 'warn' | 'ok' | 'quiet'

/** who it can be given to: you first ("Me"), then the rest */
export type WhoPick = { people: PersonKey[]; me: PersonKey; current?: PersonKey; onPick: (p: PersonKey) => void; /** more than one can do it — whoever gets to it first (a task; a step has one) */ also?: PersonKey[]; onAlso?: (p: PersonKey) => void
  /** nobody yet is a choice too ("Not decided yet" — a touch-up) */ onNone?: () => void; noneLabel?: string }
/** the day it's on: tap it, pick another */
export type WhenPick = {
  value?: string
  onPick: (label: string) => void
  presets?: string[]
  /** over the days: "Move it to" unless it says */
  title?: string
  /** its time of day ("9:00 AM"), and how to change it — none: any time */
  time?: string
  onTime?: (t?: string) => void
  /** the day and the time together, in one change (a meeting) — instead of onPick and onTime */
  onSet?: (label: string, time?: string) => void
  /** the times to pick from (every half hour unless it says) */
  times?: string[]
  /** a time is a must (a meeting): no "Any time" */
  needTime?: boolean
  /** its day and time taken off altogether ("No day") — a to-do; a meeting always has its day */
  onClear?: () => void
}
/** "9:00 AM" — minutes from midnight in the words a time is picked in */
export const clock = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`
/** the times a thing can be at — every half hour, 6 in the morning to 8 at night */
export const TIMES = Array.from({ length: 29 }, (_, i) => 6 * 60 + i * 30).map(clock)
/** who's watching it: their circles; + to add someone or take them off (you only yourself, unless it's yours to say) */
export type WatchPick = { people: PersonKey[]; me: PersonKey; current: PersonKey[]; onToggle: (p: PersonKey) => void; /** anyone can be added (its person, the admin) — else only you */ anyone: boolean; /** whoever does it — not on the list: they do it, they don't watch it */ doers?: PersonKey[] }
/** what kind of thing it is — its icon and its name */
export type WinKind = { icon?: React.ReactNode; label: string }

/** what kind of thing it is, in its own soft color — the same colors as + New: the job site warm, the paperwork blue,
 *  getting ready green, a meeting indigo, the money green, a problem red (red only for problems) */
const KIND_TONES: [RegExp, { background: string; color: string }][] = [
  [/problem/i, { background: '#fdecea', color: '#c4311f' }],
  [/waiting|^gc$/i, { background: '#fcf1de', color: '#9c5c0b' }],
  [/bring|on site|touch|site visit|daily update|crew/i, { background: '#fdf0e6', color: '#b0521b' }],
  [/getting ready/i, { background: '#e6f4f1', color: '#12766a' }],
  [/meeting|walkthrough|schedule/i, { background: '#eeeffc', color: '#3f46c2' }],
  [/material|tile|\bpo\b|order|delivery/i, { background: '#e7f4f8', color: '#13768f' }],
  [/change|everyone/i, { background: '#f3effd', color: '#6449cc' }],
  [/billing|pay|invoice|money|check-in|^team$/i, { background: '#e6f4ec', color: '#1b7443' }],
]
export const kindTone = (label: string) => KIND_TONES.find(([re]) => re.test(label))?.[1] || { background: '#ebf1fd', color: '#2c53c0' }
/** what kind of thing a line is — a small tag in its own soft color, the same as its window says on top (To do,
 *  Touch-ups, Materials, Problem, Meeting…): you know right away what it's about */
export function KindTag({ label, className }: { label: string; className?: string }) {
  /* quiet: one gray for every kind, the same width, so the words after it line up — only a problem is red */
  const c = /problem/i.test(label) ? { background: '#fdecea', color: '#c4311f' } : { background: '#f1efea', color: '#57534c' }
  return <span className={cn('inline-flex h-[1.25rem] w-[6rem] shrink-0 items-center justify-center whitespace-nowrap rounded-[0.3125rem] px-1 text-[0.71875rem] font-semibold leading-none', className)} style={{ background: c.background, color: c.color }} data-kind-tag={label}>{label}</span>
}

export const CHIP = 'inline-flex min-h-8 min-w-0 items-center gap-2 rounded-full border border-[#e9e5de] bg-white px-3 py-1 text-left shadow-[0_1px_2px_rgba(20,26,36,.05)] transition hover:border-[#d6cfc3] hover:shadow-[0_2px_6px_-2px_rgba(20,26,36,.15)] focus-visible:border-brand-300 focus-visible:outline-none'
export const toneCls = (tone?: WinTone) => cn(tone === 'late' ? 'font-medium text-bad-600' : tone === 'warn' ? 'font-medium text-warn-700' : tone === 'ok' ? 'font-medium text-[#2c8a5b]' : tone === 'quiet' ? 'text-muted' : 'text-ink')

/** each line's small mark — the same on every window */
const LINE_ICON: Record<string, React.ReactNode> = { who: <UserRound />, people: <Users />, crew: <HardHat />, when: <CalendarDays />, status: <CircleDot />, where: <MapPin />, watch: <Eye />, money: <Receipt />, ref: <Hash />, mail: <Mail />, client: <Building2 /> }
/** one line of the box: its mark and name on the left, what it says on the right */
export function WinLine({ k, label, top, children }: { k: string; label: string; top?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('grid min-h-11 grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 rounded-xl px-3 py-1 transition-colors hover:bg-white/70 max-sm:grid-cols-[7.25rem_minmax(0,1fr)] max-sm:px-2', top ? 'items-start' : 'items-center')} data-win-line={k}>
      <span className={cn('flex min-w-0 items-center gap-2.5 text-[0.875rem] text-muted [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-[#a39d93]', top && 'pt-[0.4375rem]')} data-win-label={k}>{LINE_ICON[k]}<span className="min-w-0">{label}</span></span>
      <div className="flex min-w-0 items-center">{children}</div>
    </div>
  )
}

/** one person in a list of people — the same row in Who does it and in Who's watching: the mark (round: one; square:
 *  any), their circle, their name */
function PersonOption({ p, me, on, round, lock, onClick, attrs }: { p: PersonKey; me: PersonKey; on: boolean; round?: boolean; lock?: boolean; onClick: () => void; attrs: Record<string, string> }) {
  return (
    <button type="button" role={round ? 'radio' : 'checkbox'} aria-checked={on} aria-disabled={lock || undefined} title={lock ? 'It’s theirs. To give it to someone else, turn off “More than one”' : undefined} onClick={lock ? undefined : onClick} className={cn('flex min-h-9 w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-[0.9375rem] text-ink transition', lock ? 'cursor-default' : 'hover:bg-wash', on && round && 'bg-brand-50/60 hover:bg-brand-50')} {...attrs}>
      {round
        ? <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full border', on ? 'border-brand-600 bg-brand-600' : 'border-[#c9ced6] bg-white')}>{on && <span className="h-[0.4375rem] w-[0.4375rem] rounded-full bg-white" />}</span>
        : <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c9ced6] bg-white')}>{on && <Check className="h-3 w-3" strokeWidth={3.2} />}</span>}
      <Avatar who={p} size={22} /><span className={cn('min-w-0 flex-1 break-words', on && round && 'font-medium')}>{p === me ? 'Me' : PEOPLE[p]?.name || p}</span>
    </button>
  )
}
/** the top of a list of people: what it is, and one quiet line on what it means */
const PeopleHead = ({ title, sub }: { title: string; sub: string }) => (
  <>
    <div className="text-[0.875rem] font-semibold text-ink">{title}</div>
    <div className="mb-2 mt-0.5 text-[0.8125rem] text-muted">{sub}</div>
  </>
)

/** who does it: you first ("Me"), then the rest — one person; the same in a window and on a list, and the same look as
 *  Who's watching */
export function WhoMenu({ pick, trigger }: { pick: WhoPick; trigger: React.ReactElement }) {
  const [open, setOpen] = React.useState(false)
  const also = (pick.also || []).filter((p) => p !== pick.current)
  /* one person (tap: they do it), or more than one — tick each: it's on each one's Today, whoever gets to it first */
  const [many, setMany] = React.useState(also.length > 0)
  React.useEffect(() => { if (open) setMany(also.length > 0) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (p: PersonKey) => {
    if (!many) { setOpen(false); if (p !== pick.current) pick.onPick(p); return }
    if (p !== pick.current) pick.onAlso?.(p)
  }
  const flip = () => {
    /* back to one: the others come off it */
    if (many) also.forEach((p) => pick.onAlso?.(p))
    setMany(!many)
  }
  return (
    /* the top and the switch always show; when the screen is short, just the names scroll between them */
    <Pop open={open} onOpenChange={setOpen} align="start" width={300} trigger={trigger} className="flex flex-col overflow-hidden">
      <div className="shrink-0"><PeopleHead title="Who does it" sub={many ? 'Each one ticked has it. Whoever gets to it first.' : 'One person. It’s on their Today.'} /></div>
      <div className="scroll-soft -mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain" role={many ? 'group' : 'radiogroup'} data-who-options>
        {/* nobody yet — when that's a choice */}
        {pick.onNone && !many && (
          <button type="button" role="radio" aria-checked={!pick.current} onClick={() => { setOpen(false); if (pick.current) pick.onNone!() }} className={cn('flex min-h-9 w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-[0.9375rem] text-ink transition hover:bg-wash', !pick.current && 'bg-brand-50/60 hover:bg-brand-50')} data-who-option="none">
            <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full border', !pick.current ? 'border-brand-600 bg-brand-600' : 'border-[#c9ced6] bg-white')}>{!pick.current && <span className="h-[0.4375rem] w-[0.4375rem] rounded-full bg-white" />}</span>
            <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 rounded-full border border-dashed border-[#bdb6aa]" aria-hidden />
            <span className={cn('min-w-0 flex-1 truncate', !pick.current && 'font-medium')}>{pick.noneLabel || 'Nobody yet'}</span>
          </button>
        )}
        {[pick.me, ...pick.people.filter((p) => p !== pick.me)].map((p) => (
          <PersonOption key={p} p={p} me={pick.me} on={p === pick.current || (many && also.includes(p))} round={!many} lock={many && p === pick.current} onClick={() => tap(p)} attrs={{ 'data-who-option': p }} />
        ))}
      </div>
      {pick.onAlso && (
        <button type="button" role="switch" aria-checked={many} onClick={flip} className="-mx-1 mt-1.5 flex min-h-10 w-[calc(100%+0.5rem)] shrink-0 items-center gap-3 rounded-lg border-t border-line-2 px-2 pt-1.5 text-left text-[0.875rem] text-ink-2 transition hover:bg-wash" data-who-many>
          <span className={cn('relative inline-flex h-[1.125rem] w-8 shrink-0 rounded-full transition-colors', many ? 'bg-brand-600' : 'bg-[#d5d0c7]')}><span className={cn('absolute top-0.5 h-[0.875rem] w-[0.875rem] rounded-full bg-white shadow-sm transition-all', many ? 'left-[0.9375rem]' : 'left-0.5')} /></span>
          <span className="min-w-0 flex-1">More than one can do it</span>
        </button>
      )}
    </Pop>
  )
}
/** the top of a window that's a list of things (Visit the jobs, Installer pay, a check-in, the daily updates, things to
 *  bring, one step on many projects): the same top as a to-do's — what it is and where, the thing to do, who and when */
export function ListHead({ kind, title, sub, who, me, when, whenTone, status, statusTone, place = 'Company', onPlace, attrs }: {
  kind: WinKind; title: React.ReactNode; sub?: React.ReactNode; who?: PersonKey; me?: PersonKey; when?: React.ReactNode; whenTone?: WinTone
  status?: React.ReactNode; statusTone?: WinTone; place?: React.ReactNode; onPlace?: () => void; attrs?: Record<string, string | undefined>
}) {
  return <WinHead kind={kind} place={place} onPlace={onPlace} title={title} sub={sub} who={who} whoText={who ? (who === me ? 'You' : PEOPLE[who]?.short || who) : undefined} state={when} tone={whenTone} status={status} statusTone={statusTone} attrs={attrs} />
}

/** its day (and its time): tap, pick — like any calendar. The usual days as one tap each on top, the month under them,
 *  the times beside it. Without times a day is one tap and it's set; with them, the day and then the time (the time
 *  sets both), or Done — tapping away keeps what's picked, Esc leaves it as it was. The same in a window and on a list */
export function WhenPop({ pick, trigger }: { pick: WhenPick; trigger: React.ReactElement }) {
  const [open, setOpen] = React.useState(false)
  const timed = !!(pick.onTime || pick.onSet)
  const day0 = isoFromLabel(pick.value)
  const [day, setDay] = React.useState(day0)
  const [time, setTime] = React.useState(pick.time)
  const esc = React.useRef(false)
  /* what's picked goes in: only what changed; a meeting's day and time in one go */
  const finish = (d = day, t = time) => {
    const dayMoved = !!d && d !== day0
    const timeMoved = timed && (t || '') !== (pick.time || '')
    if (!dayMoved && !timeMoved) return
    const label = d ? pickedLabel(d) : pick.value || 'Today'
    if (pick.onSet) { pick.onSet(label, t); return }
    if (dayMoved) pick.onPick(label)
    if (timeMoved) pick.onTime?.(t)
  }
  const change = (o: boolean) => {
    if (o) { setDay(isoFromLabel(pick.value)); setTime(pick.time); esc.current = false }
    else if (!esc.current) finish()
    setOpen(o)
  }
  const close = () => setOpen(false)
  const pickDay = (iso: string) => { if (timed) setDay(iso); else { close(); finish(iso) } }
  const presets = pick.presets || ['Today', 'Tomorrow', 'Next Mon', 'In 2 weeks']
  const said = [day ? dayShort(day) : '', time || (timed && !pick.needTime ? 'Any time' : '')].filter(Boolean).join(' · ')
  return (
    <Pop open={open} onOpenChange={change} onEscape={() => { esc.current = true }} align="start" width={timed ? 492 : 332} trigger={trigger} className="p-0" sheet>
      <div className="px-4 pb-1 pt-3.5 text-[0.875rem] font-semibold text-ink">{pick.title || (timed ? 'When' : 'Move it to')}</div>
      <div className="flex flex-wrap gap-1.5 px-4 pb-3 pt-1.5 no-scrollbar max-sm:flex-nowrap max-sm:overflow-x-auto" data-when-presets>
        {presets.map((p) => {
          const iso = isoFromLabel(p)
          const on = !!iso && iso === day
          return <button key={p} type="button" onClick={() => iso && pickDay(iso)} className={cn('inline-flex h-8 items-center rounded-full border px-3 text-[0.8125rem] font-medium transition max-sm:px-2.5', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-2 hover:border-[#d1cbc0] hover:bg-wash')} data-when-preset={p}>{p}</button>
        })}
      </div>
      <div className={cn('flex border-t border-line-2', timed ? 'max-sm:flex-col' : '')}>
        <MonthCal value={day} onPick={pickDay} className={cn('px-3 pb-3 pt-2.5', timed && 'sm:w-[18.75rem] sm:shrink-0')} />
        {timed && (
          <div className="min-w-0 flex-1 border-line-2 px-2 py-2.5 sm:border-l max-sm:border-t max-sm:px-3" data-when-times>
            <TimeList value={time} times={pick.times || TIMES} anyTime={!pick.needTime} onPick={(t) => { setTime(t); close(); finish(day, t) }} />
          </div>
        )}
      </div>
      {(timed || pick.onClear) && (
        <div className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5">
          {/* no day at all (and no time): it waits under No day set */}
          {pick.onClear && <button type="button" onClick={() => { esc.current = true; close(); pick.onClear?.() }} className="shrink-0 rounded-full px-2 py-1 text-[0.8125rem] font-semibold text-muted transition hover:bg-wash hover:text-bad-600" data-when-clear>No day</button>}
          <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-ink" data-when-said>{said}</span>
          {timed && <Button size="sm" variant="primary" onClick={() => { close(); finish() }} data-when-done>Done</Button>}
        </div>
      )}
    </Pop>
  )
}
/** who's watching: tick people on or off (you only yourself, unless it's yours to say) — the same in a window and on a
 *  list */
export function WatchPop({ pick, trigger, align = 'start', title = 'Who’s watching', sub = 'They don’t do it. They hear when it moves.' }: { pick: WatchPick; trigger: React.ReactElement; align?: 'start' | 'end' | 'center'; title?: string; sub?: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Pop open={open} onOpenChange={setOpen} align={align} width={300} trigger={trigger}>
      <PeopleHead title={title} sub={sub} />
      <div className="-mx-1 flex flex-col" data-watch-list>
        {[pick.me, ...pick.people.filter((p) => p !== pick.me)].filter((p) => (pick.anyone || p === pick.me) && !pick.doers?.includes(p)).map((p) => (
          <PersonOption key={p} p={p} me={pick.me} on={pick.current.includes(p)} onClick={() => pick.onToggle(p)} attrs={{ 'data-watch-person': p }} />
        ))}
      </div>
    </Pop>
  )
}

/** words you can change right where they are: tap them, type, Enter (or tap away) keeps it — Esc puts it back. The
 *  same letters as when it's not being changed: nothing jumps */
function EditText({ value, onSave, area, placeholder, label, attrs }: { value: string; onSave: (v: string) => void; area?: boolean; placeholder?: string; label: string; attrs?: Record<string, string> }) {
  const [on, setOn] = React.useState(false)
  const [v, setV] = React.useState(value)
  React.useEffect(() => { if (!on) setV(value) }, [value, on])
  const keep = () => { setOn(false); if (v.trim() !== value.trim() && (area || v.trim())) onSave(v) }
  const back = () => { setV(value); setOn(false) }
  const keys = (e: React.KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); back() } else if (e.key === 'Enter' && !(area && e.shiftKey)) { e.preventDefault(); keep() } }
  const box = '-mx-2 -my-1 block w-[calc(100%+1rem)] resize-none overflow-hidden rounded-lg border border-brand-300 bg-white px-2 py-1 text-ink outline-none ring-[0.1875rem] ring-brand-50 [font:inherit] [letter-spacing:inherit]'
  /* the whole sentence, always in sight: the box grows with what's in it (Enter saves; the details take a new line
     with Shift+Enter) */
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px` }, [v, on])
  if (on) return <textarea ref={ref} autoFocus value={v} rows={1} onChange={(e) => setV(area ? e.target.value : e.target.value.replace(/\n/g, ' '))} onBlur={keep} onKeyDown={keys} onFocus={(e) => { const n = e.target.value.length; e.target.setSelectionRange(n, n) }} placeholder={placeholder} aria-label={label} className={box} data-editing data-keep-size={area ? undefined : ''} />
  return (
    <button type="button" onClick={() => setOn(true)} title="Tap to change it" aria-label={`${label} · change it`} className="-mx-2 -my-1 block w-[calc(100%+1rem)] cursor-text rounded-lg border border-transparent px-2 py-1 text-left transition hover:bg-wash focus-visible:bg-wash focus-visible:outline-none" {...attrs}>
      {value || <span className="text-faint">{placeholder}</span>}
    </button>
  )
}

export function WinHead({ kind, place, onPlace, title, sub, edit, remove, lines, who, whoText, state, tone, status, statusTone, where, problem, more, extra, attrs, whoPick, whenPick, whoLabel = 'Who does it', watch, star }: {
  /** what it is: Task, Change order, Waiting on the GC, Getting ready · Installer */
  kind?: WinKind
  /** its project */
  place: React.ReactNode
  /** tap the project: open it */
  onPlace?: () => void
  title: React.ReactNode
  /** what it's about, in a line or two — right under the thing to do */
  sub?: React.ReactNode
  /** its words can be changed right here: tap the thing to do, or what it's about (nothing yet: "Add details") */
  edit?: { title: string; sub?: string; onTitle: (v: string) => void; onSub: (v: string) => void }
  /** take it off altogether — the bin on top, next to ··· (Undo in the pop-up) */
  remove?: () => void
  /** lines of its own, in the same box and the same look (a meeting: who's in it, when, where) */
  lines?: React.ReactNode
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
  /** its star — on top of your list */
  star?: StarPick
}) {
  const whoBody = (
    <>
      {who && <Avatar who={who} size={24} />}
      {whoText && <span className="min-w-0 text-[0.9375rem] font-medium text-ink" data-win-owner>{whoText}</span>}
    </>
  )
  const stateCls = toneCls(tone)
  return (
    <div className="relative isolate px-6 pb-2 pt-5 max-sm:px-4 max-sm:pt-3.5 [[data-stacked]_&]:pt-1.5" data-win-head {...attrs}>
      {/* a soft wash of what it is behind the top of the window — you know what you opened before you read a word */}
      {kind && <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40" style={{ background: `linear-gradient(180deg, ${kindTone(kind.label).background} 0%, rgba(255,255,255,0) 100%)` }} data-win-wash />}
      {/* what it is, and its project — clear of the window's ✕ (a phone too: the ✕ is on this line) */}
      <div className="relative flex min-h-7 min-w-0 items-start gap-2 pr-10 max-sm:min-h-10 max-sm:items-center max-sm:pr-12 [[data-stacked]_&]:pr-0">
        {/* the project goes on to the next line when there isn't room — never cut short */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          {kind && <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white/80 px-2.5 text-[0.8125rem] font-semibold shadow-[0_1px_2px_rgba(20,26,36,.06)] ring-1 ring-inset ring-black/[0.04] [&_svg]:h-3.5 [&_svg]:w-3.5" style={{ color: kindTone(kind.label).color }} data-win-kind>{kind.icon}{kind.label}</span>}
          {onPlace ? (
            <button type="button" onClick={onPlace} className="inline-flex min-h-7 min-w-0 max-w-full items-center gap-0.5 text-left text-[0.875rem] font-medium text-muted transition hover:text-brand-700" data-win-place aria-label="Open the project"><span className="min-w-0">{place}</span><ChevronRight className="h-3.5 w-3.5 shrink-0" /></button>
          ) : <span className="inline-flex min-h-7 min-w-0 items-center text-[0.875rem] font-medium text-muted" data-win-place>{place}</span>}
        </div>
        {(star || more || remove) && (
          <span className="-my-0.5 flex shrink-0 items-center gap-0.5 pl-1">
            {star && <WinStar star={star} />}
            {remove && <button type="button" onClick={remove} aria-label="Delete it" title="Delete it" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-bad-50 hover:text-bad-600" data-win-remove><Trash2 className="h-[1.0625rem] w-[1.0625rem]" /></button>}
            {more}
          </span>
        )}
      </div>
      <h2 className="font-display relative mt-3 text-[1.5rem] font-semibold leading-tight tracking-[-0.018em] text-ink max-sm:text-[1.3125rem]" data-win-title>
        {edit ? <EditText value={edit.title} onSave={edit.onTitle} label="What to do" attrs={{ 'data-win-title-edit': '' }} /> : title}
      </h2>
      {edit ? (
        <div className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-2" data-win-sub>
          <EditText value={edit.sub || ''} onSave={edit.onSub} area label="Details" placeholder="Add details" attrs={{ 'data-win-sub-edit': '', ...(edit.sub ? { 'data-task-detail': '' } : {}) }} />
        </div>
      ) : sub && <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-2" data-win-sub>{sub}</p>}
      {/* one box of short lines, each with its name on the left (nothing to say in it: no box) */}
      {(lines || whoText || whoPick || state || status || where || watch) && <div className="mt-4 rounded-2xl bg-[#f8f7f4] p-1.5 ring-1 ring-inset ring-[#efebe4]" data-win-who>
        {lines}
        {(whoText || whoPick) && (
          <WinLine k="who" label={whoLabel}>
            {whoPick ? (
              <WhoMenu pick={whoPick} trigger={<button type="button" className={CHIP} aria-label="Who does it · change it" data-who-pick>{whoBody}<ChevronDown className="h-4 w-4 shrink-0 text-faint" /></button>} />
            ) : <span className="inline-flex min-w-0 items-center gap-2">{whoBody}</span>}
          </WinLine>
        )}
        {state && (
          <WinLine k="when" label="When">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              {/* the day and its time in one: tap it — the calendar, and the times beside it */}
              {whenPick ? (
                <WhenPop pick={whenPick} trigger={
                  <button type="button" className={cn(CHIP, 'text-[0.9375rem]', stateCls)} aria-label="When · change it" data-when-pick>
                    <span className="min-w-0" data-win-state>{state}</span>
                    {(whenPick.onTime || whenPick.onSet) && whenPick.time && <span className="shrink-0 tnum text-ink" data-when-time>· {whenPick.time}</span>}
                    <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
                  </button>
                } />
              ) : <span className={cn('text-[0.9375rem]', stateCls)} data-win-state>{state}</span>}
              {extra && <span className="text-[0.875rem] text-muted">· {extra}</span>}
            </span>
          </WinLine>
        )}
        {status && <WinLine k="status" label="Status"><span className={cn('min-w-0 text-[0.9375rem] leading-snug', toneCls(statusTone))} data-win-status>{status}</span></WinLine>}
        {where && <WinLine k="where" label="Where"><span className="min-w-0 text-[0.9375rem] leading-snug text-ink" data-win-where>{where}</span></WinLine>}
        {watch && (
          <WinLine k="watch" label="Watching" top={watch.current.length > 1}>
            {/* tap what it says to change it — each one their circle and name; more than fit go on to the next line
                (nothing cut off); nobody yet: Add someone */}
            <span className="flex min-w-0 items-center" data-win-watch={watch.current.join(',')}>
              <WatchPop pick={watch} trigger={
                <button type="button" className={cn(CHIP, 'flex-wrap gap-x-3.5 gap-y-1.5')} aria-label="Who’s watching. Add or take off" data-watch-add>
                  {watch.current.length > 0
                    ? watch.current.map((p) => <span key={p} className="inline-flex items-center gap-2 text-[0.9375rem] text-ink" data-win-watcher={p}><Avatar who={p} size={24} />{p === watch.me ? 'You' : PEOPLE[p]?.short || p}</span>)
                    : <span className="inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-brand-700"><Plus className="h-4 w-4" />Add someone</span>}
                  {watch.current.length > 0 && <ChevronDown className="h-4 w-4 shrink-0 text-faint" />}
                </button>
              } />
            </span>
          </WinLine>
        )}
      </div>}
      {problem && (
        <div className="mt-3 flex min-w-0 items-start gap-2 rounded-xl bg-bad-50 px-4 py-2.5 text-[0.9375rem] font-medium leading-snug text-bad-700" data-win-problem>
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0">{problem}</span>
        </div>
      )}
    </div>
  )
}
