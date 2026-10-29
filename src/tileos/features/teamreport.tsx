/* The admin's check-ins, and the team report.
 * Everything set for a day — a task with a date, a checklist step with a date — either gets done by that day or it
 * doesn't. Still not done 2 work days after its day (the company's line, Settings → Company rules): it lands on the
 * admin's Today as "Check in with …", one row per person. Checking in — or Remind — takes it off his list; it comes
 * back if it's still not done that many work days later.
 * The team report: for each of ours, how often what was set for a day got done by that day, over the last week or
 * month, against the company's goal (85% unless the admin changes it). Waiting on someone outside doesn't count
 * against anyone; a missed follow-up does. Moving something after it's late doesn't reset it — it counts from the day
 * it was first set for. */
import * as React from 'react'
import { AlarmClock, BellRing, Check, ChevronDown, ChevronRight, SlidersHorizontal, UserRoundCheck } from 'lucide-react'
import { useStore, meOf, NOW, DATA_KEYS, type Store } from '@/tileos/store'
import { Avatar, Button, Field, TextInput } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { Page, Status, PX, ProgressRing, ViewSwitch } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey, type Role, type Tone } from '@/tileos/data/model'
import type { Task } from '@/tileos/data/work'
import { TODAY, addDays, dow, md, isoFromLabel, daysBetween } from '@/tileos/lib/today'
import { REAL, awayFromMe } from '@/tileos/lib/save'
import { lateOf, remind } from './late'
import { insidePeople } from './steps-ui'
import { stepsFor } from './steps'
import { openStep } from './stepwin'
import type { PlateItem } from './mytasks'

/* ---------------- days ---------------- */
const MD_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/
const ISO_RE = /^\d{4}-\d\d-\d\d$/
const shiftYear = (iso: string, n: number) => `${+iso.slice(0, 4) + n}${iso.slice(4)}`
/** a day said as "Oct 12" (or an ISO day) → the ISO day nearest today: Dec 30, said in January, is last year's */
export function dayOf(label?: string): string | undefined {
  const l = (label || '').trim()
  if (ISO_RE.test(l)) return l
  if (!MD_RE.test(l)) return undefined
  const iso = isoFromLabel(l)
  if (!iso) return undefined
  const n = daysBetween(TODAY, iso)
  return n > 183 ? shiftYear(iso, -1) : n < -183 ? shiftYear(iso, 1) : iso
}
/** a day something already happened ("Oct 12") — never a day ahead of today */
const pastDay = (label?: string) => { const d = dayOf(label); return d && d > TODAY ? shiftYear(d, -1) : d }
const isWorkday = (iso: string) => dow(iso) !== 0 && dow(iso) !== 6
/** work days (Mon–Fri) after one day, up to and including the other: Thu → Mon is 2 */
export function workdaysBetween(a: string, b: string): number {
  if (!a || !b || b <= a) return 0
  let n = 0
  for (let d = addDays(a, 1); d <= b; d = addDays(d, 1)) if (isWorkday(d)) n++
  return n
}
const workDays = (n: number) => `${n} work day${n === 1 ? '' : 's'}`
/** check in when something is this many work days late (Settings → Company rules) */
export const checkInDays = (s: Pick<Store, 'rules'>) => s.rules.checkInDays || 2
/** on time this share of the time, or the report says so */
export const onTimeGoal = (s: Pick<Store, 'rules'>) => s.rules.onTimeGoal || 85
/** the admin on his own view */
export const reportOn = (s: Store) => REAL.admin && !awayFromMe(s) && (s.role === 'owner' || s.role === 'pm')

/* ---------------- what's late right now ---------------- */
export type CheckIn = { by: PersonKey; day: string; note?: string }
/** one late thing on someone's plate: the day it was first set for, how many work days late, how often it was moved —
 *  and where it came from (who asked for it, or what in the flow made it) */
export type CheckItem = { x: PlateItem; key: string; who: PersonKey; title: string; jobName: string; setFor: string; late: number; rolls: number; checkIn?: CheckIn; from: string }
/** where a thing on someone's list came from: what made it (Tile OS, at award…) or who asked for it */
export function originOf(x: PlateItem): string {
  if (x.kind === 'step') return 'a getting-ready step'
  const t = x.t
  if (!t) return ''
  const first = (t.log || [])[0]
  const said = first?.text ? first.text.charAt(0).toLowerCase() + first.text.slice(1) : ''
  if (first && first.who === 'system') return `made by Tile OS${said ? ` — ${said}` : ''}`
  if (t.by && PEOPLE[t.by]) return `asked by ${PEOPLE[t.by].short}`
  if (first && PEOPLE[first.who as PersonKey]) return `from ${PEOPLE[first.who as PersonKey].short}${said && !/^created$/i.test(said) ? ` — ${said}` : ''}`
  return 'made by Tile OS'
}
const recOf = (s: Store, x: PlateItem) => (x.kind === 'step' && x.job && x.v ? s.stepRecs[x.job.id]?.[x.v.key] : undefined)
function itemOf(s: Store, x: PlateItem, who: PersonKey): CheckItem {
  const t = x.kind === 'task' ? x.t : undefined
  const r = recOf(s, x)
  const setFor = (t ? t.lateFrom : r?.lateFrom) || x.iso || TODAY
  return {
    x, key: x.key, who,
    title: x.kind === 'step' ? x.v!.short || x.v!.label : t!.title,
    jobName: (x.kind === 'step' ? x.job?.name : s.jobs[t!.jobId]?.name) || 'Company',
    setFor, late: workdaysBetween(setFor, TODAY), rolls: (t ? t.rolls : r?.rolls) || 0,
    checkIn: t ? t.checkIn : r?.checkIn,
    from: originOf(x),
  }
}
const roleOf = (s: Store, p: PersonKey): Role => (s.team.find((m) => m.key === p)?.role as Role) || 'office'
/** what's late on one person's plate right now, oldest first */
export function lateNow(s: Store, who: PersonKey): CheckItem[] {
  const seen = new Set<string>()
  return lateOf(s, roleOf(s, who), who)
    .filter((x) => x.who === who && !seen.has(x.key) && (seen.add(x.key), true))
    .map((x) => itemOf(s, x, who))
    .sort((a, b) => a.setFor.localeCompare(b.setFor))
}
/* every list and count on the screen asks this — worked out once for each change of the data */
const memo = <T,>(f: (s: Store) => T) => {
  let last: { k: unknown[]; v: T } | null = null
  return (s: Store): T => {
    const k = [...DATA_KEYS.map((d) => (s as any)[d]), s.role, TODAY]
    if (last && last.k.every((x, i) => x === k[i])) return last.v
    const v = f(s)
    last = { k, v }
    return v
  }
}
/** what the admin checks in on: late past the company's line, and not checked in on (or reminded) since — by person */
export const checkIns = memo((s: Store): { who: PersonKey; items: CheckItem[] }[] => {
  const n = checkInDays(s)
  const me = meOf(s.role)
  return insidePeople(s)
    .filter((p) => p !== me && PEOPLE[p])
    .map((p) => ({ who: p, items: lateNow(s, p).filter((c) => c.late >= n && !(c.checkIn && workdaysBetween(c.checkIn.day, TODAY) < n)) }))
    .filter((g) => g.items.length)
})

/** checked in: written on each thing, and off the admin's list until it's that many more work days late */
export function recordCheckIn(who: PersonKey, items: CheckItem[], note?: string) {
  const s = useStore.getState()
  const me = meOf(s.role)
  const n = checkInDays(s)
  const ci: CheckIn = { by: me, day: TODAY, ...(note ? { note } : {}) }
  s.commit((st) => {
    items.forEach((c) => {
      if (c.x.kind === 'task') {
        const t = st.tasks.find((y) => y.id === c.x.t!.id)
        if (!t) return
        t.checkIn = ci
        ;(t.log ||= []).push({ date: NOW, who: me, text: `Checked in with ${PEOPLE[who]?.short || ''} — ${workDays(c.late)} late${note ? ` · ${note}` : ''}` })
      } else if (c.x.job && c.x.v) {
        const r = ((st.stepRecs[c.x.job.id] ||= {})[c.x.v.key] ||= {})
        r.checkIn = ci
        ;(st.hist[c.x.job.id] ||= []).unshift({ date: NOW, who: me, kind: 'field', title: `${c.x.v.short}: checked in with ${PEOPLE[who]?.short || ''}`, detail: note || `${workDays(c.late)} late` } as any)
      }
    })
  }, `Checked in with ${PEOPLE[who]?.short || 'them'}`, { tone: 'done', sub: `Off your list — back in ${workDays(n)} if it’s still not done.`, undo: true })
}

/* ---------------- the check-in window ---------------- */
const openItem = (go: { kind: 'task'; id: string } | { kind: 'step'; jobId: string; k: string }) => {
  const s = useStore.getState()
  s.close()
  if (go.kind === 'step') openStep(go.jobId, go.k)
  else s.open({ t: 'task', id: go.id })
}
const goOf = (x: PlateItem) => (x.kind === 'step' ? { kind: 'step' as const, jobId: x.job!.id, k: x.v!.key } : { kind: 'task' as const, id: x.t!.id })

export function CheckInModal({ who, level }: { who: PersonKey; level: number }) {
  const s = useStore()
  const [note, setNote] = React.useState('')
  const [items] = React.useState(() => checkIns(s).find((g) => g.who === who)?.items || [])
  const n = checkInDays(s)
  const p = PEOPLE[who]
  const done = (how: 'remind' | 'checked') => {
    if (how === 'remind') remind(who, items.map((c) => c.x), note.trim() || undefined)
    else recordCheckIn(who, items, note.trim() || undefined)
    s.close()
  }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={<span className="inline-flex items-center gap-2.5"><Avatar who={who} size={34} />Check in with {p?.short || 'them'}</span>}
      sub={items.length ? `${items.length === 1 ? '1 thing' : `${items.length} things`} still not done ${n}+ work days after the day ${items.length === 1 ? 'it was' : 'they were'} set for.` : 'Nothing to check in on right now.'}
      footer={items.length ? (
        <>
          <Button variant="ghost" icon={<BellRing />} onClick={() => done('remind')} data-checkin-remind>Remind {p?.short}</Button>
          <Button className="ml-auto" variant="primary" icon={<Check />} onClick={() => done('checked')} data-checkin-done>Checked in</Button>
        </>
      ) : <Button className="ml-auto" variant="primary" onClick={s.close}>OK</Button>}
    >
      {items.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-line" data-checkin-items>
          {items.map((c) => (
            <button key={c.key} onClick={() => openItem(goOf(c.x))} className="flex w-full items-center gap-3 border-t border-line-2 px-4 py-2.5 text-left transition first:border-t-0 row-hover">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bad-50 text-bad-600"><AlarmClock className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.90625rem] font-semibold text-ink">{c.title}</span>
                <span className="block truncate text-[0.78125rem] text-muted">{c.jobName} · due {md(c.setFor)} · <b className="font-semibold text-bad-600">{workDays(c.late)} late</b>{c.rolls ? ` · moved ${c.rolls}×` : ''}</span>
                {c.from && <span className="block truncate text-[0.75rem] text-faint" data-from>{c.from.charAt(0).toUpperCase() + c.from.slice(1)}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
            </button>
          ))}
        </section>
      )}
      {items.length > 0 && (
        <Field label="What they said (optional)" className="mt-4">
          <TextInput mic value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. waiting on the GC — done Thursday" aria-label="What they said" />
        </Field>
      )}
    </Modal>
  )
}

/* ---------------- the team report ---------------- */
type Go = { kind: 'task'; id: string } | { kind: 'step'; jobId: string; k: string }
/** one thing that was set for a day, and how it went */
export type Judged = { key: string; title: string; jobName: string; setFor: string; doneOn?: string; late: number; open: boolean; early: boolean; rolls: number; go: Go }
export type PersonStats = { who: PersonKey; set: number; onTime: number; late: number; open: number; early: number; rolls: number; avgLate: number; pct: number | null; lateNow: number; items: Judged[] }

/** the day a task was done: kept with it, or the date it was marked done, or its last dated line */
const doneDayOf = (t: Task) => t.doneOn || (MD_RE.test(t.doneAt || '') ? pastDay(t.doneAt) : undefined) || [...(t.log || [])].reverse().map((l) => (MD_RE.test(l.date) ? pastDay(l.date) : undefined)).find(Boolean)

function judgedAll(s: Store, from: string, to: string, now: Map<PersonKey, CheckItem[]>): Map<PersonKey, Judged[]> {
  const out = new Map<PersonKey, Judged[]>()
  const add = (p: PersonKey | undefined, j: Judged) => { if (!p || !PEOPLE[p]) return; const a = out.get(p); if (a) a.push(j); else out.set(p, [j]) }
  const inWin = (d?: string): d is string => !!d && d >= from && d <= to
  const judge = (setFor: string, doneOn: string) => ({ late: doneOn > setFor ? Math.max(1, workdaysBetween(setFor, doneOn)) : 0, early: doneOn < setFor })
  const counted = new Set<string>()
  /* done tasks that were set for a day — not the ones that waited on someone outside (their timing isn't ours) */
  s.tasks.forEach((t) => {
    if (t.state !== 'done' || !t.owner || t.everyone || t.waitingOn) return
    const setFor = t.lateFrom || dayOf(t.due)
    if (!inWin(setFor)) return
    const doneOn = doneDayOf(t)
    if (!doneOn) return
    if (t.step) counted.add(t.step)
    add(t.owner, { key: t.id, title: t.title, jobName: s.jobs[t.jobId]?.name || 'Company', setFor, doneOn, ...judge(setFor, doneOn), open: false, rolls: t.rolls || 0, go: { kind: 'task', id: t.id } })
  })
  /* checklist steps done, with the day they were set for kept on them */
  Object.entries(s.stepRecs || {}).forEach(([jobId, recs]) => {
    const j = s.jobs[jobId]
    const dated = Object.entries(recs || {}).filter(([k, r]) => r?.done && inWin(r.lateFrom || r.dueWas) && !counted.has(`${jobId}:${k}`))
    if (!j || !dated.length) return
    const views = new Map(stepsFor(s, j).map((v) => [v.key, v]))
    dated.forEach(([k, r]) => {
      const setFor = (r.lateFrom || r.dueWas)!
      const doneOn = pastDay(r.done)
      if (!doneOn) return
      const v = views.get(k)
      add((v?.owner || r.by) as PersonKey, { key: `s:${jobId}:${k}`, title: v?.short || v?.label || k, jobName: j.name, setFor, doneOn, ...judge(setFor, doneOn), open: false, rolls: r.rolls || 0, go: { kind: 'step', jobId, k } })
    })
  })
  /* still not done, past its day */
  now.forEach((items, p) => items.forEach((c) => { if (inWin(c.setFor)) add(p, { key: c.key, title: c.title, jobName: c.jobName, setFor: c.setFor, late: Math.max(1, c.late), open: true, early: false, rolls: c.rolls, go: goOf(c.x) }) }))
  return out
}

function statsOf(who: PersonKey, items: Judged[], lateNowN: number): PersonStats {
  const late = items.filter((j) => j.late > 0)
  const onTime = items.length - late.length
  return {
    who, items, set: items.length, onTime, late: late.length, open: late.filter((j) => j.open).length,
    early: items.filter((j) => j.early).length, rolls: items.reduce((n, j) => n + j.rolls, 0),
    avgLate: late.length ? late.reduce((n, j) => n + j.late, 0) / late.length : 0,
    pct: items.length >= 3 ? Math.round((onTime / items.length) * 100) : null,
    lateNow: lateNowN,
  }
}
/** everyone on the team over the last few days: lowest share on time first ("not enough yet" last) */
export function teamStats(s: Store, days: number): PersonStats[] {
  const to = addDays(TODAY, -1)
  const from = addDays(TODAY, -days)
  const people = insidePeople(s).filter((p) => PEOPLE[p])
  const now = new Map(people.map((p) => [p, lateNow(s, p)]))
  const all = judgedAll(s, from, to, now)
  return people
    .map((p) => statsOf(p, all.get(p) || [], now.get(p)?.length || 0))
    .sort((a, b) => (a.pct == null ? 101 : a.pct) - (b.pct == null ? 101 : b.pct) || b.late - a.late || (PEOPLE[a.who]?.name || '').localeCompare(PEOPLE[b.who]?.name || ''))
}
export const personStats = (s: Store, who: PersonKey, days: number) => teamStats(s, days).find((r) => r.who === who) || statsOf(who, [], 0)

/** green at the goal or above, amber within 10 points, red below that */
export const verdict = (pct: number | null, goal: number): { tone: Tone; word: string } =>
  pct == null ? { tone: 'neutral', word: 'Not enough yet' } : pct >= goal ? { tone: 'ok', word: 'On track' } : pct >= goal - 10 ? { tone: 'warn', word: 'Slipping' } : { tone: 'bad', word: 'Often late' }
const one = (n: number) => (Math.round(n * 10) / 10).toString()

const DAYS_KEY = 'tileos-report-days'
export function TeamReportPage() {
  const s = useStore()
  const [days, setDays] = React.useState<'7' | '30'>(() => { try { return localStorage.getItem(DAYS_KEY) === '7' ? '7' : '30' } catch { return '30' } })
  const pick = (v: '7' | '30') => { setDays(v); try { localStorage.setItem(DAYS_KEY, v) } catch { /* private window */ } }
  const [open, setOpen] = React.useState<string | null>(null)
  const rows = teamStats(s, Number(days))
  const goal = onTimeGoal(s)
  const ci = checkIns(s)
  const set = rows.reduce((n, r) => n + r.set, 0)
  const on = rows.reduce((n, r) => n + r.onTime, 0)
  const teamPct = set ? Math.round((on / set) * 100) : null
  const lateNowN = rows.reduce((n, r) => n + r.lateNow, 0)
  const from = addDays(TODAY, -Number(days))
  const to = addDays(TODAY, -1)
  return (
    <Page
      title="Team report"
      sub={`How often each person gets done what was set for a day, by that day · ${md(from)} – ${md(to)}`}
      actions={<Button variant="ghost" icon={<SlidersHorizontal />} onClick={() => s.go({ page: 'settings', tab: 'rules' })}>Goal {goal}% · check in after {workDays(checkInDays(s))}</Button>}
      toolbar={
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
          <ViewSwitch label="How far back" value={days} onChange={pick} items={[{ key: '7', label: 'Last 7 days' }, { key: '30', label: 'Last 30 days' }]} />
          <span className="flex-1" />
          <span className="flex items-center gap-2 text-[0.8125rem] text-muted tnum" data-report-team>
            {teamPct != null && <ProgressRing pct={teamPct} size={28} tone={verdict(teamPct, goal).tone} label="" />}
            Team <b className="font-semibold text-ink">{teamPct != null ? `${teamPct}%` : '—'}</b> on time · {lateNowN} late now{ci.length ? ` · ${ci.length} to check in on` : ''}
          </span>
        </div>
      }
    >
      <div className={cn('grid grid-cols-[minmax(0,1fr)_9.5rem_6.5rem_7rem_8.5rem_1rem] items-center gap-4 border-b border-line-2 bg-[#fbfaf7] py-2 text-[0.75rem] font-semibold text-muted max-lg:hidden', PX)}>
        <span className="pl-[3.75rem]">Person · on time, of what was set for a day</span><span>Late by, on average</span><span>Moved after late</span><span>Late now</span><span>How it’s going</span><span />
      </div>
      <div data-report>
        {rows.map((r) => <ReportRow key={r.who} r={r} goal={goal} open={open === r.who} onToggle={() => setOpen(open === r.who ? null : r.who)} ci={ci.find((g) => g.who === r.who)?.items.length || 0} days={Number(days)} />)}
      </div>
      <p className={cn('border-t border-line-2 py-3 text-[0.78125rem] leading-relaxed text-muted', PX)}>
        On time = done by the day it was set for (work days). Waiting on someone outside doesn’t count against anyone.
      </p>
    </Page>
  )
}

function ReportRow({ r, goal, open, onToggle, ci, days }: { r: PersonStats; goal: number; open: boolean; onToggle: () => void; ci: number; days: number }) {
  const s = useStore()
  const v = verdict(r.pct, goal)
  const late = r.items.filter((j) => j.late > 0).sort((a, b) => Number(b.open) - Number(a.open) || b.setFor.localeCompare(a.setFor))
  const [more, setMore] = React.useState(false)
  const shown = more ? late : late.slice(0, 6)
  return (
    <div className="border-t border-line-2 first:border-t-0" data-report-person={r.who} data-pct={r.pct ?? ''}>
      <button onClick={onToggle} aria-expanded={open} className={cn('grid w-full grid-cols-[minmax(0,1fr)_9.5rem_6.5rem_7rem_8.5rem_1rem] items-center gap-4 py-3 text-left transition row-hover max-lg:flex max-lg:gap-3', PX)}>
        <span className="flex min-w-0 items-center gap-3.5 max-lg:flex-1">
          <ProgressRing pct={r.pct ?? 0} size={46} tone={v.tone} label={r.pct == null ? '–' : `${r.pct}%`} />
          <span className="min-w-0">
            <span className="flex items-baseline gap-2"><span className="truncate text-[0.9375rem] font-semibold text-ink">{PEOPLE[r.who]?.name}</span><span className="truncate text-[0.75rem] text-muted max-sm:hidden">{PEOPLE[r.who]?.roleLabel}</span></span>
            <span className="mt-0.5 block truncate text-[0.8125rem] text-muted tnum">
              {r.set ? <>{r.onTime} of {r.set} on time{r.late ? ` · ${r.late} late` : ''}{r.early ? ` · ${r.early} early` : ''}</> : 'Nothing set for a day in these days'}
              <span className="lg:hidden">{r.lateNow ? <> · <span className="font-semibold text-bad-600">{r.lateNow} late now</span></> : null}</span>
            </span>
          </span>
        </span>
        <span className="text-[0.84375rem] text-ink-2 tnum max-lg:hidden">{r.late ? `${one(r.avgLate)} work day${r.avgLate === 1 ? '' : 's'}` : <span className="text-faint">—</span>}</span>
        <span className="text-[0.84375rem] text-ink-2 tnum max-lg:hidden">{r.rolls ? `${r.rolls}×` : <span className="text-faint">—</span>}</span>
        <span className="text-[0.84375rem] tnum max-lg:hidden">{r.lateNow ? <span className="font-semibold text-bad-600">{r.lateNow} late</span> : <span className="text-faint">none</span>}</span>
        <span className="shrink-0"><Status tone={v.tone}>{v.word}</Status></span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-faint transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className={cn('border-t border-line-2 bg-[#fbfaf7] pb-3 pt-2', PX)} data-report-items>
          {ci > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-warn-100 bg-warn-50/60 px-3 py-2 text-[0.8125rem] text-ink-2">
              <UserRoundCheck className="h-4 w-4 text-warn-700" />{ci === 1 ? '1 thing' : `${ci} things`} to check in on
              <Button size="sm" className="ml-auto" onClick={() => s.open({ t: 'checkin', who: r.who })}>Check in</Button>
            </div>
          )}
          {!late.length ? (
            <div className="flex items-center gap-2 py-2 text-[0.84375rem] text-ok-700"><Check className="h-4 w-4" />{r.set ? `Everything set for a day in the last ${days} days was done by its day.` : 'Nothing was set for a day in these days.'}</div>
          ) : (
            <>
              <div className="py-1 text-[0.75rem] font-semibold text-muted">Late in the last {days} days</div>
              <ul className="overflow-hidden rounded-xl border border-line bg-white">
                {shown.map((j) => (
                  <li key={j.key} className="border-t border-line-2 first:border-t-0">
                    <button onClick={() => (j.go.kind === 'step' ? openStep(j.go.jobId, j.go.k) : s.open({ t: 'task', id: j.go.id }))} className="flex w-full items-center gap-3 px-3.5 py-2 text-left transition row-hover">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.875rem] font-semibold text-ink">{j.title}</span>
                        <span className="block truncate text-[0.78125rem] text-muted">{j.jobName} · set for {md(j.setFor)} · {j.open ? <b className="font-semibold text-bad-600">still not done — {workDays(j.late)} late</b> : <>done {md(j.doneOn!)} — <b className="font-semibold text-bad-600">{workDays(j.late)} late</b></>}{j.rolls ? ` · moved ${j.rolls}×` : ''}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                    </button>
                  </li>
                ))}
              </ul>
              {late.length > shown.length && <button onClick={() => setMore(true)} className="mt-1.5 text-[0.8125rem] font-semibold text-brand-700 hover:underline">Show all {late.length}</button>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
