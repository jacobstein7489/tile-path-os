/* What's late. Once a day — the first time each person opens Tile OS — a window in the middle of the screen lists
 * what's past its date on their plate: open it, or move it to tomorrow. The admin also sees what's late on everyone
 * else's plate, and "Remind" sends it to them: it pops up on their screen the next time they look ("Jacob is asking
 * about this"), and it's written on the task. The "N overdue" on Today opens the same window any time. */
import * as React from 'react'
import { AlarmClock, ArrowRight, BellRing, Check, CalendarClock } from 'lucide-react'
import { useStore, meOf, NOW, type Store } from '@/tileos/store'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { REAL, awayFromMe } from '@/tileos/lib/save'
import { TODAY, TOMORROW, md, labelFromIso } from '@/tileos/lib/today'
import { plateOf, type PlateItem } from './mytasks'
import { insidePeople } from './steps-ui'
import { openStep } from './stepwin'

const S = () => useStore.getState()
/** the admin on his own view (not looking through someone else's eyes) */
export const bossView = (s: Store) => REAL.admin && !awayFromMe(s) && (s.role === 'owner' || s.role === 'pm')
/** what's late on one person's plate: tasks and getting-ready steps past their date */
export const lateOf = (s: Store, role: Role, who?: PersonKey): PlateItem[] => plateOf(s, role, who).filter((x) => x.b === 'overdue' && (x.kind === 'task' || x.kind === 'step'))
const roleOf = (s: Store, p: PersonKey): Role => (s.team.find((m) => m.key === p)?.role as Role) || 'owner'
/** everyone else's late things, person by person — what the admin sees */
export function teamLate(s: Store): { who: PersonKey; items: PlateItem[] }[] {
  const me = meOf(s.role)
  const seen = new Set<string>()
  return insidePeople(s)
    .filter((p) => p !== me && PEOPLE[p])
    .map((p) => ({ who: p, items: lateOf(s, roleOf(s, p), p).filter((x) => x.who === p && !seen.has(x.key) && (seen.add(x.key), true)) }))
    .filter((g) => g.items.length)
}

const titleOf = (x: PlateItem) => (x.kind === 'step' ? x.v!.short || x.v!.label : x.t!.title)
const jobOf = (s: Store, x: PlateItem) => (x.kind === 'step' ? x.job : s.jobs[x.t!.jobId])
const nudgeOf = (s: Store, x: PlateItem) => (x.kind === 'step' ? s.stepRecs[x.job!.id]?.[x.v!.key]?.nudge : x.t!.nudge)
/** reminded today already */
const remindedToday = (s: Store, x: PlateItem) => nudgeOf(s, x)?.day === TODAY

/** "Tomorrow": the date moves; it comes back on Today tomorrow */
export function moveToTomorrow(x: PlateItem) {
  const me = meOf(S().role)
  S().commit((st) => {
    if (x.kind === 'task') {
      const t = st.tasks.find((y) => y.id === x.t!.id)
      if (!t) return
      t.due = md(TOMORROW)
      t.dueTone = 'neutral'
      t.log.push({ date: NOW, who: me, text: `Moved to ${md(TOMORROW)} — it was late` })
    } else if (x.job && x.v) {
      const recs = (st.stepRecs[x.job.id] ||= {})
      const r = (recs[x.v.key] ||= {})
      r.moved = TOMORROW
      ;(st.hist[x.job.id] ||= []).unshift({ date: NOW, who: me, kind: 'field', title: `${x.v.short}: moved to ${md(TOMORROW)}`, detail: 'It was late' } as any)
    }
  }, `${titleOf(x)} — moved to tomorrow`, { undo: true })
}

/** "Remind": it pops up on that person's screen, and it's written on the task */
export function remind(who: PersonKey, items: PlateItem[]) {
  const me = meOf(S().role)
  const nudge = { by: me, at: Date.now().toString(36), day: TODAY }
  S().commit((st) => {
    items.forEach((x) => {
      if (x.kind === 'task') {
        const t = st.tasks.find((y) => y.id === x.t!.id)
        if (!t) return
        t.nudge = nudge
        t.log.push({ date: NOW, who: me, text: `Reminded ${PEOPLE[t.owner]?.short || ''} — it was due ${x.iso ? md(x.iso) : 'before today'}` })
      } else if (x.job && x.v) {
        const recs = (st.stepRecs[x.job.id] ||= {})
        const r = (recs[x.v.key] ||= {})
        r.nudge = nudge
      }
    })
  }, `Reminder sent to ${PEOPLE[who]?.short || 'them'}`, { sub: 'It pops up on their screen with what’s late, and it’s on their Today.', undo: false })
}

/* ---------------- once a day, by itself ---------------- */
const dayKey = (s: Store) => `tileos-late:${REAL.email || 'preview'}:${meOf(s.role)}`
/* the automated tests drive the app themselves — no pop-ups in their way (a test that checks this one says so) */
const quiet = () => { try { return navigator.webdriver && !localStorage.getItem('tileos-late-test') } catch { return false } }

export function LateWatcher() {
  React.useEffect(() => {
    if (quiet()) return
    const check = () => {
      const s = S()
      if (s.role === 'crew' || s.role === 'client' || s.modals.length) return
      if ((s.rules.autoOff || []).includes('late')) return
      const k = dayKey(s)
      try { if (localStorage.getItem(k) === TODAY) return } catch { return }
      const mine = lateOf(s, s.role)
      const team = bossView(s) ? teamLate(s) : []
      if (!mine.length && !team.length) return
      try { localStorage.setItem(k, TODAY) } catch { /* private window */ }
      s.open({ t: 'late', auto: true })
    }
    /* give the screen a moment (what's new pops first), then look; again whenever the person or the screen changes */
    const t = setTimeout(check, 2500)
    const off = useStore.subscribe((s, prev) => { if (s.role !== prev.role || (prev.modals.length && !s.modals.length)) setTimeout(check, 1200) })
    return () => { clearTimeout(t); off() }
  }, [])
  return null
}

/* ---------------- the window ---------------- */
function Row({ x, me }: { x: PlateItem; me?: boolean }) {
  const s = useStore()
  const job = jobOf(s, x)
  const open = () => { s.close(); x.kind === 'step' ? openStep(x.job!.id, x.v!.key) : s.open({ t: 'task', id: x.t!.id }) }
  return (
    <div className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0 max-sm:flex-wrap">
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

export function LateModal({ level }: { level: number }) {
  const s = useStore()
  const mine = lateOf(s, s.role)
  const team = bossView(s) ? teamLate(s) : []
  const n = mine.length
  const others = team.reduce((a, g) => a + g.items.length, 0)
  const goToday = () => { s.close(); s.go({ page: 'today' }) }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={n ? (n === 1 ? '1 thing is late' : `${n} things are late`) : others ? 'Late on the team' : 'Nothing is late'}
      sub={n ? 'Past its date on your Today — open it, or move it to tomorrow.' : others ? 'Send a reminder — it pops up on their screen.' : 'Everything on your Today is on time.'}
      footer={<><Button className="ml-auto" variant="ghost" onClick={s.close}>Later</Button><Button variant="primary" icon={<ArrowRight />} onClick={goToday}>Go to Today</Button></>}
    >
      {n > 0 && (
        <section className="overflow-hidden rounded-xl border border-line">
          {mine.map((x) => <Row key={x.key} x={x} me />)}
        </section>
      )}
      {team.length > 0 && (
        <section className={cn('overflow-hidden rounded-xl border border-line', n > 0 && 'mt-4')}>
          <header className="flex items-center gap-2 border-b border-line-2 bg-[#faf8f5] px-4 py-2 text-[0.8125rem] font-bold text-ink">Late on the team<span className="font-medium text-muted">· {others}</span></header>
          {team.map((g) => {
            const sent = g.items.every((x) => remindedToday(s, x))
            return (
              <div key={g.who} data-person={g.who} className="border-t border-line-2 px-4 py-3 first:border-t-0">
                <div className="flex items-center gap-2.5">
                  <Avatar who={g.who} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.875rem] font-semibold text-ink">{PEOPLE[g.who]?.name}</span>
                    <span className="block truncate text-[0.75rem] text-muted">{g.items.length} late · {PEOPLE[g.who]?.roleLabel || ''}</span>
                  </span>
                  {sent
                    ? <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ok-50 px-3 text-[0.8125rem] font-semibold text-ok-700"><Check className="h-3.5 w-3.5" />Reminded today</span>
                    : <Button size="sm" icon={<BellRing />} onClick={() => remind(g.who, g.items)}>Remind</Button>}
                </div>
                <ul className="mt-1.5 flex flex-col gap-0.5 pl-[2.6rem]">
                  {g.items.slice(0, 4).map((x) => (
                    <li key={x.key} className="truncate text-[0.8125rem] text-ink-2">{titleOf(x)}<span className="text-muted"> · {jobOf(s, x)?.name || 'Company'} · </span><span className="font-semibold text-bad-600">{x.iso ? labelFromIso(x.iso) : 'late'}</span></li>
                  ))}
                  {g.items.length > 4 && <li className="text-[0.8125rem] text-muted">and {g.items.length - 4} more</li>}
                </ul>
              </div>
            )
          })}
        </section>
      )}
      {!n && !team.length && <div className="flex items-center gap-2 rounded-xl bg-ok-50 px-4 py-3 text-[0.875rem] font-medium text-ok-700"><Check className="h-4 w-4" />All caught up.</div>}
    </Modal>
  )
}
