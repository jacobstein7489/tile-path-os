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
import { Avatar } from '@/tileos/components/ui/core'
import { Pop, DatePresets } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'

export type WinTone = 'late' | 'warn' | 'ok' | 'quiet'

/** who it can be given to: you first ("Me"), then the rest */
export type WhoPick = { people: PersonKey[]; me: PersonKey; current?: PersonKey; onPick: (p: PersonKey) => void; /** more than one can do it — whoever gets to it first (a task; a step has one) */ also?: PersonKey[]; onAlso?: (p: PersonKey) => void }
/** the day it's on: tap it, pick another */
export type WhenPick = { value?: string; onPick: (label: string) => void; presets?: string[]; /** over the days: "Move it to" unless it says */ title?: string }
/** who's watching it: their circles; + to add someone or take them off (you only yourself, unless it's yours to say) */
export type WatchPick = { people: PersonKey[]; me: PersonKey; current: PersonKey[]; onToggle: (p: PersonKey) => void; /** anyone can be added (its person, the admin) — else only you */ anyone: boolean; /** whoever does it — not on the list: they do it, they don't watch it */ doers?: PersonKey[] }
/** what kind of thing it is — its icon and its name */
export type WinKind = { icon?: React.ReactNode; label: string }

export const CHIP = '-mx-2 inline-flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-wash-2 focus-visible:bg-wash-2 focus-visible:outline-none'
export const toneCls = (tone?: WinTone) => cn(tone === 'late' ? 'font-medium text-bad-600' : tone === 'warn' ? 'font-medium text-warn-700' : tone === 'ok' ? 'font-medium text-[#2c8a5b]' : tone === 'quiet' ? 'text-muted' : 'text-ink')

/** each line's small mark — the same on every window */
const LINE_ICON: Record<string, React.ReactNode> = { who: <UserRound />, people: <Users />, crew: <HardHat />, when: <CalendarDays />, status: <CircleDot />, where: <MapPin />, watch: <Eye />, money: <Receipt />, ref: <Hash />, mail: <Mail />, client: <Building2 /> }
/** one line of the box: its mark and name on the left, what it says on the right */
export function WinLine({ k, label, top, children }: { k: string; label: string; top?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('grid min-h-[2.875rem] grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 border-t border-line-2 px-4 py-1.5 first:border-t-0 max-sm:grid-cols-[7.25rem_minmax(0,1fr)] max-sm:px-3', top ? 'items-start' : 'items-center')} data-win-line={k}>
      <span className={cn('flex min-w-0 items-center gap-2.5 text-[0.875rem] text-muted [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-[#a39d93]', top && 'pt-[0.3125rem]')} data-win-label={k}>{LINE_ICON[k]}<span className="min-w-0">{label}</span></span>
      <div className="flex min-w-0 items-center">{children}</div>
    </div>
  )
}

/** one person in a list of people — the same row in Who does it and in Who's watching: the mark (round: one; square:
 *  any), their circle, their name */
function PersonOption({ p, me, on, round, lock, onClick, attrs }: { p: PersonKey; me: PersonKey; on: boolean; round?: boolean; lock?: boolean; onClick: () => void; attrs: Record<string, string> }) {
  return (
    <button type="button" role={round ? 'radio' : 'checkbox'} aria-checked={on} aria-disabled={lock || undefined} title={lock ? 'It’s theirs — to give it to someone else, turn off “More than one”' : undefined} onClick={lock ? undefined : onClick} className={cn('flex min-h-10 w-full items-center gap-3 rounded-lg px-2 text-left text-[0.9375rem] text-ink transition', lock ? 'cursor-default' : 'hover:bg-wash', on && round && 'bg-brand-50/60 hover:bg-brand-50')} {...attrs}>
      {round
        ? <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full border', on ? 'border-brand-600 bg-brand-600' : 'border-[#c9ced6] bg-white')}>{on && <span className="h-[0.4375rem] w-[0.4375rem] rounded-full bg-white" />}</span>
        : <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c9ced6] bg-white')}>{on && <Check className="h-3 w-3" strokeWidth={3.2} />}</span>}
      <Avatar who={p} size={22} /><span className={cn('min-w-0 flex-1 truncate', on && round && 'font-medium')}>{p === me ? 'Me' : PEOPLE[p]?.name || p}</span>
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
    <Pop open={open} onOpenChange={setOpen} align="start" width={300} trigger={trigger}>
      <PeopleHead title="Who does it" sub={many ? 'Each one ticked has it — whoever gets to it first.' : 'One person — it’s on their Today.'} />
      <div className="-mx-1 flex flex-col" role={many ? 'group' : 'radiogroup'} data-who-options>
        {[pick.me, ...pick.people.filter((p) => p !== pick.me)].map((p) => (
          <PersonOption key={p} p={p} me={pick.me} on={p === pick.current || (many && also.includes(p))} round={!many} lock={many && p === pick.current} onClick={() => tap(p)} attrs={{ 'data-who-option': p }} />
        ))}
      </div>
      {pick.onAlso && (
        <button type="button" role="switch" aria-checked={many} onClick={flip} className="-mx-1 mt-1.5 flex min-h-10 w-[calc(100%+0.5rem)] items-center gap-3 rounded-lg border-t border-line-2 px-2 pt-1.5 text-left text-[0.875rem] text-ink-2 transition hover:bg-wash" data-who-many>
          <span className={cn('relative inline-flex h-[1.125rem] w-8 shrink-0 rounded-full transition-colors', many ? 'bg-brand-600' : 'bg-[#d5d0c7]')}><span className={cn('absolute top-0.5 h-[0.875rem] w-[0.875rem] rounded-full bg-white shadow-sm transition-all', many ? 'left-[0.9375rem]' : 'left-0.5')} /></span>
          <span className="min-w-0 flex-1">More than one can do it</span>
        </button>
      )}
    </Pop>
  )
}
/** its day: tap, pick another — the same in a window and on a list */
export function WhenPop({ pick, trigger }: { pick: WhenPick; trigger: React.ReactElement }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Pop open={open} onOpenChange={setOpen} align="start" width={330} trigger={trigger}>
      <div className="mb-2.5 text-[0.875rem] font-semibold text-ink">{pick.title || 'Move it to'}</div>
      <DatePresets value={pick.value} presets={pick.presets} onPick={(d) => { setOpen(false); pick.onPick(d) }} />
    </Pop>
  )
}
/** who's watching: tick people on or off (you only yourself, unless it's yours to say) — the same in a window and on a
 *  list */
export function WatchPop({ pick, trigger, align = 'start', title = 'Who’s watching', sub = 'They don’t do it — they hear when it moves.' }: { pick: WatchPick; trigger: React.ReactElement; align?: 'start' | 'end' | 'center'; title?: string; sub?: string }) {
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
  const box = '-mx-2 -my-1 block w-[calc(100%+1rem)] rounded-lg border border-brand-300 bg-white px-2 py-1 text-ink outline-none ring-[0.1875rem] ring-brand-50 [font:inherit] [letter-spacing:inherit]'
  if (on) return area
    ? <textarea autoFocus value={v} rows={Math.min(6, Math.max(2, Math.ceil((v.length || 1) / 64)))} onChange={(e) => setV(e.target.value)} onBlur={keep} onKeyDown={keys} placeholder={placeholder} aria-label={label} className={cn(box, 'resize-none')} data-editing />
    : <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={keep} onKeyDown={keys} aria-label={label} className={box} data-editing />
  return (
    <button type="button" onClick={() => setOn(true)} title="Tap to change it" aria-label={`${label} — change it`} className="-mx-2 -my-1 block w-[calc(100%+1rem)] cursor-text rounded-lg border border-transparent px-2 py-1 text-left transition hover:bg-wash focus-visible:bg-wash focus-visible:outline-none" {...attrs}>
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
        {(star || more || remove) && (
          <span className="-my-0.5 flex shrink-0 items-center gap-0.5 pl-1">
            {star && <WinStar star={star} />}
            {remove && <button type="button" onClick={remove} aria-label="Delete it" title="Delete it" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-bad-50 hover:text-bad-600" data-win-remove><Trash2 className="h-[1.0625rem] w-[1.0625rem]" /></button>}
            {more}
          </span>
        )}
      </div>
      <h2 className="font-display mt-2.5 text-[1.375rem] font-semibold leading-snug tracking-[-0.01em] text-ink max-sm:text-[1.25rem]" data-win-title>
        {edit ? <EditText value={edit.title} onSave={edit.onTitle} label="What to do" attrs={{ 'data-win-title-edit': '' }} /> : title}
      </h2>
      {edit ? (
        <div className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-2" data-win-sub>
          <EditText value={edit.sub || ''} onSave={edit.onSub} area label="Details" placeholder="Add details" attrs={{ 'data-win-sub-edit': '', ...(edit.sub ? { 'data-task-detail': '' } : {}) }} />
        </div>
      ) : sub && <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-2" data-win-sub>{sub}</p>}
      {/* one box of short lines, each with its name on the left */}
      <div className="mt-4 rounded-xl border border-line bg-white" data-win-who>
        {lines}
        {(whoText || whoPick) && (
          <WinLine k="who" label={whoLabel}>
            {whoPick ? (
              <WhoMenu pick={whoPick} trigger={<button type="button" className={CHIP} aria-label="Who does it — change it" data-who-pick>{whoBody}<ChevronDown className="h-4 w-4 shrink-0 text-faint" /></button>} />
            ) : <span className="inline-flex min-w-0 items-center gap-2">{whoBody}</span>}
          </WinLine>
        )}
        {state && (
          <WinLine k="when" label="When">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              {whenPick ? (
                <WhenPop pick={whenPick} trigger={<button type="button" className={cn(CHIP, 'text-[0.9375rem]', stateCls)} aria-label="When — change it" data-when-pick><span className="min-w-0" data-win-state>{state}</span><ChevronDown className="h-4 w-4 shrink-0 text-faint" /></button>} />
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
                <button type="button" className={cn(CHIP, 'flex-wrap gap-x-3.5 gap-y-1.5')} aria-label="Who’s watching — add or take off" data-watch-add>
                  {watch.current.length > 0
                    ? watch.current.map((p) => <span key={p} className="inline-flex items-center gap-2 text-[0.9375rem] text-ink" data-win-watcher={p}><Avatar who={p} size={24} />{p === watch.me ? 'You' : PEOPLE[p]?.short || p}</span>)
                    : <span className="inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-brand-700"><Plus className="h-4 w-4" />Add someone</span>}
                  {watch.current.length > 0 && <ChevronDown className="h-4 w-4 shrink-0 text-faint" />}
                </button>
              } />
            </span>
          </WinLine>
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
