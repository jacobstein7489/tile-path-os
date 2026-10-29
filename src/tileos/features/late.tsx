/* Your day, in the middle of the screen: every time someone signs in, and the first time each day they open Tile OS,
 * a window lists what's late on their plate (open it, or move it to tomorrow) and what's due today. The admin also
 * sees who on the team to check in on — late past the company's line (2 work days unless he changes it) — and
 * "Remind" sends it to them: it pops up on their screen the next time they look, it's written on the task, and the
 * person is off the admin's list until it's that many more work days late. "Remind me later" snoozes the whole
 * window — in 15 minutes, half an hour, an hour, or tomorrow morning — and it comes back by itself then (each late
 * thing of your own has its own "Tomorrow"). The "N overdue" on Today opens the same window any time. */
import * as React from 'react'
import { AlarmClock, ArrowRight, BellRing, Check, CalendarClock, Clock3, ChevronDown, CalendarDays } from 'lucide-react'
import { useStore, meOf, NOW, type Store } from '@/tileos/store'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { REAL, awayFromMe } from '@/tileos/lib/save'
import { TODAY, TOMORROW, md, labelFromIso, isoFromLabel } from '@/tileos/lib/today'
import { timeLabel } from '@/tileos/data/calendar'
import { plateOf, type PlateItem } from './mytasks'
import { openStep } from './stepwin'
import { checkIns, checkInDays, type CheckItem } from './teamreport'

const S = () => useStore.getState()
/** the admin on his own view (not looking through someone else's eyes) */
export const bossView = (s: Store) => REAL.admin && !awayFromMe(s) && (s.role === 'owner' || s.role === 'pm')
/** what's late on one person's plate: tasks and getting-ready steps past their date */
export const lateOf = (s: Store, role: Role, who?: PersonKey): PlateItem[] => plateOf(s, role, who).filter((x) => x.b === 'overdue' && (x.kind === 'task' || x.kind === 'step'))
const titleOf = (x: PlateItem) => (x.kind === 'step' ? x.v!.short || x.v!.label : x.t!.title)
const jobOf = (s: Store, x: PlateItem) => (x.kind === 'step' ? x.job : s.jobs[x.t!.jobId])

/** "Tomorrow": the date moves; it comes back on Today tomorrow */
export function moveToTomorrow(x: PlateItem) {
  const me = meOf(S().role)
  S().commit((st) => {
    if (x.kind === 'task') {
      const t = st.tasks.find((y) => y.id === x.t!.id)
      if (!t) return
      t.lateFrom ||= isoFromLabel(t.due) || x.iso
      t.due = md(TOMORROW)
      t.dueTone = 'neutral'
      t.rolls = (t.rolls || 0) + 1
      t.log.push({ date: NOW, who: me, text: `Moved to ${md(TOMORROW)} — it was late` })
    } else if (x.job && x.v) {
      const recs = (st.stepRecs[x.job.id] ||= {})
      const r = (recs[x.v.key] ||= {})
      r.lateFrom ||= x.iso
      r.moved = TOMORROW
      r.rolls = (r.rolls || 0) + 1
      ;(st.hist[x.job.id] ||= []).unshift({ date: NOW, who: me, kind: 'field', title: `${x.v.short}: moved to ${md(TOMORROW)}`, detail: 'It was late' } as any)
    }
  }, `${titleOf(x)} — moved to tomorrow`, { undo: true })
}

/** "Remind": it pops up on that person's screen, it's written on the task — and it counts as checking in: off the
 *  admin's list until it's late that many more work days */
export function remind(who: PersonKey, items: PlateItem[], note?: string) {
  const me = meOf(S().role)
  const nudge = { by: me, at: Date.now().toString(36), day: TODAY }
  const checkIn = { by: me, day: TODAY, ...(note ? { note } : {}) }
  S().commit((st) => {
    items.forEach((x) => {
      if (x.kind === 'task') {
        const t = st.tasks.find((y) => y.id === x.t!.id)
        if (!t) return
        t.nudge = nudge
        t.checkIn = checkIn
        t.log.push({ date: NOW, who: me, text: `Reminded ${PEOPLE[t.owner]?.short || ''} — it was due ${x.iso ? md(x.iso) : 'before today'}${note ? ` · ${note}` : ''}` })
      } else if (x.job && x.v) {
        const recs = (st.stepRecs[x.job.id] ||= {})
        const r = (recs[x.v.key] ||= {})
        r.nudge = nudge
        r.checkIn = checkIn
      }
    })
  }, `Reminder sent to ${PEOPLE[who]?.short || 'them'}`, { sub: 'It pops up on their screen with what’s late, and it’s on their Today.', undo: false })
}

/* ---------------- by itself: every sign-in, the first look each day, whatever goes late — unless snoozed ---------------- */
const dayKey = (s: Store) => `tileos-late:${REAL.email || 'preview'}:${meOf(s.role)}`
const seenKey = (s: Store) => `tileos-late-seen:${REAL.email || 'preview'}:${meOf(s.role)}`
const snoozeKey = (s: Store) => `tileos-late-snooze:${REAL.email || 'preview'}:${meOf(s.role)}`
/** the sign-in screen leaves this for the first look after signing in */
export const SIGNED_IN_KEY = 'tileos-signed-in'
const readSeen = (k: string): string[] => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
/* the automated tests drive the app themselves — no pop-ups in their way (a test that checks this one says so) */
const quiet = () => { try { return navigator.webdriver && !localStorage.getItem('tileos-late-test') } catch { return false } }
/** what's due today on one person's plate — tasks, steps and meetings */
export const dueTodayOf = (s: Store, role: Role): PlateItem[] => plateOf(s, role).filter((x) => x.b === 'today' && (x.kind === 'task' || x.kind === 'step' || x.kind === 'meet'))

/** "Remind me": the window comes back by itself at that time */
export function snoozeDay(mins: number | 'tomorrow') {
  const s = S()
  const until = mins === 'tomorrow' ? (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(7, 30, 0, 0); return d.getTime() })() : Date.now() + mins * 60 * 1000
  try { localStorage.setItem(snoozeKey(s), String(until)) } catch { /* private window */ }
  s.close()
}

export function LateWatcher() {
  React.useEffect(() => {
    if (quiet()) return
    const check = () => {
      const s = S()
      if (s.role === 'crew' || s.role === 'client' || s.modals.length) return
      if ((s.rules.autoOff || []).includes('late')) return
      let snoozed = 0
      try { snoozed = Number(localStorage.getItem(snoozeKey(s)) || 0) } catch { /* fine */ }
      const woke = snoozed > 0 && snoozed <= Date.now()
      if (snoozed > Date.now()) return
      const mine = lateOf(s, s.role)
      const today = dueTodayOf(s, s.role)
      const team = bossView(s) ? checkIns(s) : []
      let signedIn = false
      try { signedIn = sessionStorage.getItem(SIGNED_IN_KEY) === '1'; if (signedIn) sessionStorage.removeItem(SIGNED_IN_KEY) } catch { /* fine */ }
      if (!mine.length && !team.length && !(signedIn && today.length)) return
      /* each late thing pops up once — the first look of the day (and every sign-in) shows them all again */
      const keys = mine.map((x) => `${x.key}@${x.iso || ''}`)
      let first = false
      try { first = localStorage.getItem(dayKey(s)) !== TODAY } catch { return }
      const seen = readSeen(seenKey(s))
      const fresh = keys.filter((k) => !seen.includes(k))
      if (!signedIn && !woke && !first && !fresh.length) return
      try {
        localStorage.setItem(dayKey(s), TODAY)
        localStorage.setItem(seenKey(s), JSON.stringify(Array.from(new Set([...seen, ...keys])).slice(-400)))
        if (woke) localStorage.removeItem(snoozeKey(s))
      } catch { /* private window */ }
      if (!signedIn && !woke && !first && !mine.length) return
      s.open({ t: 'late', auto: true })
    }
    /* give the screen a moment (what's new pops first), then look; again whenever the person or the screen changes,
       and every minute — a snooze that's up, or something that goes late while the app is open, pops up too */
    const t = setTimeout(check, 2500)
    const every = setInterval(check, 60 * 1000)
    const off = useStore.subscribe((s, prev) => { if (s.role !== prev.role || (prev.modals.length && !s.modals.length) || s.tasks !== prev.tasks) setTimeout(check, 1200) })
    return () => { clearTimeout(t); clearInterval(every); off() }
  }, [])
  return null
}

/* ---------------- the window ---------------- */
function Row({ x, me }: { x: PlateItem; me?: boolean }) {
  const s = useStore()
  const job = jobOf(s, x)
  const open = () => { s.close(); x.kind === 'step' ? openStep(x.job!.id, x.v!.key) : s.open({ t: 'task', id: x.t!.id }) }
  return (
    <div className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0 max-sm:flex-wrap" data-late-key={x.key}>
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bad-50 text-bad-600"><AlarmClock className="h-4 w-4" /></span>
      <button onClick={open} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[0.90625rem] font-semibold text-ink hover:text-brand-700">{titleOf(x)}</span>
        <span className="block truncate text-[0.78125rem] text-muted">
          {[job?.name || 'Company', <span key="d" className="font-semibold text-bad-600">was due {x.iso ? labelFromIso(x.iso) : 'before today'}</span>].reduce<React.ReactNode[]>((a, b, i) => (i ? [...a, ' · ', b] : [b]), [])}
        </span>
      </button>
      {me && (
        <span className="flex shrink-0 items-center gap-1.5 max-sm:ml-11">
          <Button size="sm" variant="ghost" icon={<CalendarClock />} onClick={() => moveToTomorrow(x)}>Tomorrow</Button>
          <Button size="sm" onClick={open}>Open</Button>
        </span>
      )}
    </div>
  )
}

/** one thing due today: what, where, when — tap it and it opens */
function TodayRow({ x }: { x: PlateItem }) {
  const s = useStore()
  const job = x.kind === 'meet' ? (x.e!.jobId ? s.jobs[x.e!.jobId] : undefined) : jobOf(s, x)
  const title = x.kind === 'meet' ? x.e!.title : titleOf(x)
  const open = () => { s.close(); x.kind === 'step' ? openStep(x.job!.id, x.v!.key) : x.kind === 'meet' ? s.open({ t: 'event', id: x.e!.id }) : s.open({ t: 'task', id: x.t!.id }) }
  return (
    <button onClick={open} className="flex w-full min-w-0 items-center gap-3 border-t border-line-2 px-4 py-2 text-left transition first:border-t-0 row-hover">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">{x.kind === 'meet' ? <CalendarDays className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[0.875rem] font-semibold text-ink">{title}</span>
        <span className="block truncate text-[0.75rem] text-muted">{[job?.name, x.time != null ? timeLabel(x.time) : ''].filter(Boolean).join(' · ') || 'Today'}</span>
      </span>
    </button>
  )
}

export function LateModal({ level }: { level: number }) {
  const s = useStore()
  const mine = lateOf(s, s.role)
  const today = dueTodayOf(s, s.role)
  const team = bossView(s) ? checkIns(s) : []
  const n = mine.length
  const others = team.reduce((a, g) => a + g.items.length, 0)
  const goToday = () => { s.close(); s.go({ page: 'today' }) }
  const title = n ? `${n === 1 ? '1 thing is late' : `${n} things are late`}${today.length ? ` · ${today.length} due today` : ''}` : today.length ? `${today.length} due today` : others ? 'Check in on the team' : 'Nothing is late'
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={<span className="inline-flex items-center gap-2.5">{(n > 0 || others > 0) && <span className="bell-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bad-50 text-bad-600 ring-1 ring-bad-100"><BellRing className="h-[1.125rem] w-[1.125rem]" /></span>}{title}</span>}
      sub={n ? 'Past its date — open it, or move it to tomorrow.' : today.length ? 'What’s on your plate today.' : others ? 'Remind them — it pops up on their screen.' : 'Everything on your Today is on time.'}
      footer={
        <>
          <Menu align="start" width={240} trigger={<button className="inline-flex h-9 items-center gap-1.5 rounded-[0.5625rem] px-3 text-[0.84375rem] font-semibold text-ink-2 hover:bg-wash" data-snooze><AlarmClock className="h-4 w-4 text-faint" />Remind me later<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
            <MenuLabel>Show this whole window again</MenuLabel>
            <MenuItem onSelect={() => snoozeDay(15)}>In 15 minutes</MenuItem>
            <MenuItem onSelect={() => snoozeDay(30)}>In half an hour</MenuItem>
            <MenuItem onSelect={() => snoozeDay(60)}>In an hour</MenuItem>
            <MenuItem onSelect={() => snoozeDay('tomorrow')}>Tomorrow morning</MenuItem>
          </Menu>
          <Button className="ml-auto" variant="primary" icon={<ArrowRight />} onClick={goToday}>Go to Today</Button>
        </>
      }
    >
      {n > 0 && (
        <section className="overflow-hidden rounded-xl border border-line" data-late-mine>
          {mine.map((x) => <Row key={x.key} x={x} me />)}
        </section>
      )}
      {today.length > 0 && (
        <section className={cn('overflow-hidden rounded-xl border border-line', n > 0 && 'mt-4')} data-due-today>
          <header className="flex items-center gap-2 border-b border-line-2 bg-[#faf8f5] px-4 py-2 text-[0.8125rem] font-bold text-ink">Due today<span className="font-medium text-muted">· {today.length}</span></header>
          {today.slice(0, 5).map((x) => <TodayRow key={x.key} x={x} />)}
          {today.length > 5 && <button onClick={goToday} className="w-full border-t border-line-2 px-4 py-2 text-left text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50/40">and {today.length - 5} more — on Today</button>}
        </section>
      )}
      {team.length > 0 && (
        <section className={cn('overflow-hidden rounded-xl border border-line', (n > 0 || today.length > 0) && 'mt-4')} data-late-team>
          <header className="flex items-center gap-2 border-b border-line-2 bg-[#faf8f5] px-4 py-2 text-[0.8125rem] font-bold text-ink">Check in on the team<span className="font-medium text-muted">· not done {checkInDays(s)}+ work days after its day</span></header>
          {team.map((g) => (
            <div key={g.who} data-person={g.who} className="border-t border-line-2 px-4 py-3 first:border-t-0">
              <div className="flex items-center gap-2.5">
                <Avatar who={g.who} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink">{PEOPLE[g.who]?.name}</span>
                  <span className="block truncate text-[0.75rem] text-muted">{g.items.length} late · {PEOPLE[g.who]?.roleLabel || ''}</span>
                </span>
                <Button size="sm" icon={<BellRing />} onClick={() => remind(g.who, g.items.map((c: CheckItem) => c.x))}>Remind</Button>
              </div>
              <ul className="mt-1.5 flex flex-col gap-0.5 pl-[2.6rem]">
                {g.items.slice(0, 4).map((c: CheckItem) => (
                  <li key={c.key} className="truncate text-[0.8125rem] text-ink-2">{c.title}<span className="text-muted"> · {c.jobName} · </span><span className="font-semibold text-bad-600">{md(c.setFor)} · {c.late} work day{c.late === 1 ? '' : 's'} late</span></li>
                ))}
                {g.items.length > 4 && <li className="text-[0.8125rem] text-muted">and {g.items.length - 4} more</li>}
              </ul>
            </div>
          ))}
        </section>
      )}
      {!n && !today.length && !team.length && <div className="flex items-center gap-2 rounded-xl bg-ok-50 px-4 py-3 text-[0.875rem] font-medium text-ok-700"><Check className="h-4 w-4" />All caught up.</div>}
    </Modal>
  )
}
