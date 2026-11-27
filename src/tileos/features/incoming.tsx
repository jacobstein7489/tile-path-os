/* When something new lands on your plate — a hand-off, a task someone gave you, a meeting someone put you in (or
 * moved), a reminder that something of yours is late — a card pops up in the middle of the screen, so it's never just
 * a little number in a corner. The same card when a to-do of yours set for a time gets to that time (and still isn't
 * done), and 15 minutes before a meeting of yours. It waits until you're out of whatever window you're in, lists what's
 * new, and each one opens in a click. "Got it" puts it away (it stays on Today and the calendar, of course); a to-do
 * whose time came can be put off a little ("Remind me in 10 minutes"). With the app closed the phone's notifications
 * say the same (lib/remind.server). */
import * as React from 'react'
import { ChevronRight, CalendarDays, BellRing, AlarmClock, ChevronDown, HardHat, ClipboardList, Megaphone, Repeat } from 'lucide-react'
import { useStore, meOf, NOW, type Store } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import { REAL } from '@/tileos/lib/save'
import { cn } from '@/tileos/lib/utils'
import type { Task } from '@/tileos/data/work'
import { TODAY, TOMORROW, labelFromIso, isoFromLabel, dow, md } from '@/tileos/lib/today'
import { isGcWait, toldGc, askLabel } from './gcwait'
import { timeLabel, parseTime, type CalEvent } from '@/tileos/data/calendar'
import { taskIso, crewsOn, crewSentFor, crewDay, crewHour, crewEvening, crewReportOn, crewWhen, dailyDue, lineIcon } from './mytasks'
import { tagOfTask } from './todokinds'
import { autoWho } from './autowho'
import { useNotifyState } from '@/tileos/lib/notify'
import { markTaskSeen } from './latest'
import { stepTodos, type StepView } from './steps'
import { openStep } from './stepwin'
import type { Job } from '@/tileos/data/model'

const keyOf = (s: Store) => `tileos-seen:${REAL.email || 'preview'}:${meOf(s.role)}`
const read = (k: string): string[] | null => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const write = (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v.slice(-600))) } catch { /* private window */ } }
const tag = (t: Task, me?: string) => (me && t.owner !== me ? `${t.id}:f:${me}` : `${t.id}:${t.owner}`) + (t.nudge && t.nudge.by !== me && t.owner === me ? `:n${t.nudge.at}` : '')
const evTag = (e: CalEvent) => `ev:${e.id}:${e.date}:${e.start}`
/** what's on my plate right now that someone (or a hand-off) put there */
/* something for the GC someone gave you — tell him today — or reminded you about, pops up too */
const gcNow = (t: Task, me: string) => isGcWait(t) && t.owner === me && ((!toldGc(t) && (isoFromLabel(t.followUp) || '9') <= TODAY) || (!!t.nudge && t.nudge.by !== me))
const mineNow = (s: Store) => { const me = meOf(s.role); return s.tasks.filter((t) => (t.owner === me || t.also?.includes(me) || t.followers?.includes(me)) && (t.state === 'now' || gcNow(t, me)) && (t.log?.[0]?.who !== me || (t.owner === me && !!t.nudge && t.nudge.by !== me))) }
/** my steps someone reminded me about */
const stepTag = (j: Job, v: StepView, at: string) => `st:${j.id}:${v.key}:${at}`
const nudgedSteps = (s: Store) => { const me = meOf(s.role); return stepTodos(s, me).map(({ job, step }) => ({ job, step, n: s.stepRecs[job.id]?.[step.key]?.nudge })).filter((x) => x.n && x.n.by !== me) }
/** meetings someone else put me in, or moved */
const meetingsNow = (s: Store) => { const me = meOf(s.role); return s.events.filter((e) => e.people.includes(me) && e.by && e.by !== me && e.date >= TODAY) }
/* ---- a to-do's time has come, a meeting is about to start ---- */
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }
const dueTag = (id: string, iso: string, min: number) => `due:${id}:${iso}:${min}`
const soonTag = (e: CalEvent) => `soon:${e.id}:${e.date}:${e.start}`
/* the daily updates: at 5 PM (their time on Today), one line for the jobs still without today's — once a day (the same
   tag the phone notification marks seen) */
const DAILY_AT = 17 * 60
const dailyTag = (day: string) => `daily:${day}`
export function dailyNow(s: Store): { jobs: string[]; min: number } | null {
  const d = new Date()
  if (d.getHours() * 60 + d.getMinutes() < DAILY_AT) return null
  const to = autoWho(s, 'daily-update')
  const items = to ? (meOf(s.role) === to ? dailyDue(s, 'site') : []) : dailyDue(s, s.role)
  const jobs = Array.from(new Set(items.filter((x) => !x.missed).map((x) => x.jobId)))
  return jobs.length ? { jobs, min: DAILY_AT } : null
}
/* the crew list: one a day (the same tag its phone notification marks seen) */
const crewTag = (day: string) => `crew:${day}`
/** the next work day's crew list, once its time has come (the evening, Settings → Automations) and while it isn't sent —
 *  when it's mine to send (the one it's set for, else the site manager). Not on a Saturday (Friday's was Monday's) */
export function crewNow(s: Store): { day: string; min: number } | null {
  const to = autoWho(s, 'crew-morning')
  if (!(to ? meOf(s.role) === to : s.role === 'site') || !crewReportOn(s) || !crewEvening() || dow(TODAY) === 6) return null
  const day = crewDay()
  if (!crewsOn(s, day).length || crewSentFor(s, day)) return null
  return { day, min: crewHour(s) * 60 }
}
/* given its time after that time had already passed ("call him at 5", typed at 5:40): nothing to remind */
const setAfter = (t: Task, min: number) => {
  const l = [...(t.log || [])].reverse().find((x) => x.date === NOW && (/^Created/.test(x.text) || /^Time: /.test(x.text)))
  const at = l?.time ? parseTime(l.time) : null
  return at != null && at > min
}
/** my open to-dos set for a time today whose time has come, and my meetings starting within 15 minutes */
export function dueNow(s: Store, now = nowMin()) {
  const me = meOf(s.role)
  const tasks = s.tasks
    .filter((t) => (t.owner === me || !!t.also?.includes(me)) && t.state === 'now' && !t.hold && !t.paused)
    .map((t) => ({ t, iso: taskIso(t), min: parseTime(t.at || t.repeatAt) }))
    .filter((x): x is { t: Task; iso: string; min: number } => x.iso === TODAY && x.min != null && x.min <= now && !setAfter(x.t, x.min))
  const meets = s.events.filter((e) => e.people.includes(me) && !e.done && e.date === TODAY && now >= e.start - 15 && now <= e.start)
  const crew = crewNow(s)
  const daily = dailyNow(s)
  return { tasks, meets, crew, daily, keys: [...tasks.map((x) => dueTag(x.t.id, x.iso, x.min)), ...meets.map(soonTag), ...(crew ? [crewTag(crew.day)] : []), ...(daily ? [dailyTag(TODAY)] : [])] }
}
/* "Remind me later": put off until then (by tag) */
const laterKey = (s: Store) => `tileos-due-later:${REAL.email || 'preview'}:${meOf(s.role)}`
const readLater = (s: Store): Record<string, number> => { try { return JSON.parse(localStorage.getItem(laterKey(s)) || '{}') || {} } catch { return {} } }
function putOff(keys: string[], mins: number) {
  const s = useStore.getState()
  const until = Date.now() + mins * 60 * 1000
  const was = readLater(s)
  const keep = Object.fromEntries(Object.entries(was).filter(([, t]) => t > Date.now() - 864e5))
  keys.forEach((k) => { keep[k] = until })
  try { localStorage.setItem(laterKey(s), JSON.stringify(keep)) } catch { /* private window */ }
}

/* the automated tests drive the app themselves — no pop-ups in their way */
const quiet = () => { try { return navigator.webdriver && !localStorage.getItem('tileos-pop-test') } catch { return false } }

export function IncomingWatcher() {
  React.useEffect(() => {
    if (quiet()) return
    const check = () => {
      const s = useStore.getState()
      if (s.role === 'crew' || s.role === 'client') return
      const k = keyOf(s)
      let seen = read(k)
      const me = meOf(s.role)
      const now = [...mineNow(s).map((t) => tag(t, me)), ...meetingsNow(s).map(evTag), ...nudgedSteps(s).map((x) => stepTag(x.job, x.step, x.n!.at))]
      /* the first time on this computer: what's already there isn't "new" (a to-do whose time came still is) */
      if (!seen) { write(k, now); seen = now }
      const later = readLater(s)
      const due = dueNow(s).keys.filter((x) => !((later[x] || 0) > Date.now()))
      const fresh = [...now, ...due].filter((x) => !seen!.includes(x))
      if (!fresh.length || s.modals.length) return
      s.open({ t: 'incoming', keys: fresh })
    }
    check()
    /* the clock: a to-do's time comes, a meeting is 15 minutes away, a "later" is up */
    const every = setInterval(check, 30 * 1000)
    const back = () => { if (document.visibilityState === 'visible') setTimeout(check, 600) }
    document.addEventListener('visibilitychange', back)
    const off = useStore.subscribe((s, prev) => { if (s.tasks !== prev.tasks || s.events !== prev.events || s.stepRecs !== prev.stepRecs || s.role !== prev.role || (prev.modals.length && !s.modals.length)) check() })
    return () => { clearInterval(every); document.removeEventListener('visibilitychange', back); off() }
  }, [])
  return null
}

/** these were seen (a tap on the phone's notification counts) — they don't pop up again */
export function markSeen(keys: string[]) {
  const s = useStore.getState()
  const k = keyOf(s)
  write(k, Array.from(new Set([...(read(k) || []), ...keys])))
}

/** (Nov 27) one line, the same as on Today: its icon, what it is (its short name) and on the right its day or time — red
 *  only when it's late; under it, small and gray, why it's here and its project ("Yaakov reminded you · 10 Blinky") */
type Row = { key: string; who?: PersonKey; icon?: React.ReactNode; title: string; why: string; tone?: 'bad' | 'warn' | 'now'; job?: string; urgent?: boolean; open: () => void; /** its time came (a to-do, a meeting) */ timed?: boolean; /** on the right: its day or time */ right?: { text: string; late?: boolean }; /** a problem: its icon red, like on Today */ problem?: boolean }
/** a to-do's day, as Today says it: its time today, Today, a day — or, late, the day it was due (red) */
function dayOf(t: Task, now: number): { text: string; late?: boolean } | undefined {
  const iso = taskIso(t)
  if (!iso) return undefined
  if (iso < TODAY) return { text: md(iso), late: true }
  const tm = parseTime(t.at)
  if (iso === TODAY) return tm != null ? { text: timeLabel(tm), late: now - tm > 10 } : { text: 'Today' }
  return { text: labelFromIso(iso) }
}
export function IncomingModal({ keys, level }: { keys: string[]; level: number }) {
  const s = useStore()
  const me = meOf(s.role)
  const short = (p?: string) => (p ? PEOPLE[p as PersonKey]?.short || 'Someone' : 'Someone')
  /* urgent ones first */
  const list = keys.map((k) => s.tasks.find((t) => tag(t, me) === k)).filter((t): t is Task => !!t).sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent))
  const meets = keys.map((k) => s.events.find((e) => evTag(e) === k)).filter((e): e is CalEvent => !!e)
  const steps = nudgedSteps(s).filter((x) => keys.includes(stepTag(x.job, x.step, x.n!.at)))
  /* read here: seen (the list stops saying New / Not seen yet) */
  const done = () => { markSeen(keys); markTaskSeen(list.map((t) => t.id)); s.close() }
  const go = (f: () => void) => () => { markSeen(keys); markTaskSeen(list.map((t) => t.id)); f() }
  /* a to-do whose time came, a meeting about to start */
  const tnow = nowMin()
  const dn = dueNow(s, tnow)
  const iconOf = (t: Task) => t.everyone ? <Megaphone /> : t.repeat ? <Repeat /> : React.createElement(lineIcon(t, tagOfTask(s, t)))
  const dueRows = dn.tasks.filter((x) => keys.includes(dueTag(x.t.id, x.iso, x.min))).map((x): Row => ({
    key: dueTag(x.t.id, x.iso, x.min), icon: iconOf(x.t), problem: tagOfTask(s, x.t) === 'Problem', title: x.t.short || x.t.title, timed: true,
    why: tnow - x.min <= 10 ? 'Due now' : 'Its time came', right: { text: timeLabel(x.min), late: tnow - x.min > 10 },
    job: s.jobs[x.t.jobId]?.name, open: go(() => s.open({ t: 'task', id: x.t.id })),
  }))
  const soonRows = dn.meets.filter((e) => keys.includes(soonTag(e))).map((e): Row => ({
    key: soonTag(e), icon: <CalendarDays />, title: e.title, timed: true,
    why: e.start > tnow ? `In ${e.start - tnow} min` : 'Starting now', right: { text: timeLabel(e.start) },
    job: e.jobId ? s.jobs[e.jobId]?.name : undefined, open: go(() => s.open({ t: 'event', id: e.id })),
  }))
  /* the crew list's time came */
  const cw = dn.crew
  const crewRows: Row[] = cw && keys.includes(crewTag(cw.day)) ? [{
    key: crewTag(cw.day), icon: <HardHat />, title: `Send ${cw.day === TOMORROW ? 'tomorrow’s' : `${crewWhen(cw.day)}’s`} crew list`, timed: true,
    why: tnow - cw.min <= 10 ? 'Due now' : 'Its time came', right: { text: timeLabel(cw.min), late: tnow - cw.min > 10 },
    job: `${crewsOn(s, cw.day).length} ${crewsOn(s, cw.day).length === 1 ? 'project' : 'projects'}`, open: go(() => s.open({ t: 'crewreport', day: cw.day })),
  }] : []
  /* the daily updates still not sent */
  const dl = dn.daily
  const dailyRows: Row[] = dl && keys.includes(dailyTag(TODAY)) ? [{
    key: dailyTag(TODAY), icon: <ClipboardList />, title: dl.jobs.length === 1 ? 'Send today’s daily update' : 'Send today’s daily updates', timed: true,
    why: tnow - dl.min <= 10 ? 'Due now' : 'Its time came', right: { text: timeLabel(dl.min), late: tnow - dl.min > 10 },
    job: dl.jobs.length === 1 ? s.jobs[dl.jobs[0]]?.name : `${dl.jobs.length} projects`,
    open: go(() => s.open(dl.jobs.length === 1 ? { t: 'daily', jobId: dl.jobs[0] } : { t: 'dailies', who: meOf(s.role), jobs: dl.jobs })),
  }] : []
  const rows: Row[] = [
    ...crewRows,
    ...dailyRows,
    ...dueRows,
    ...soonRows,
    ...list.map((t): Row => {
      const nudged = !!t.nudge && t.owner === me && t.nudge.by !== me && tag(t, me).includes(':n')
      const from = nudged ? t.nudge!.by : t.log?.[0]?.who && t.log[0].who !== 'system' ? (t.log[0].who as PersonKey) : undefined
      const gc = isGcWait(t) && t.owner === me
      /* (Nov 27) a reminder doesn't make it late: late is the red day on the right, only when it is */
      const why = t.urgent && t.owner === me ? `Urgent · ${from ? `${short(from)} gave it to you` : 'for you'}`
        : nudged ? `${short(from)} reminded you`
          : gc ? `${askLabel(t)} today`
            : t.owner !== me && t.also?.includes(me) ? `${short(from || t.owner)} shared it with you`
              : t.owner !== me ? `${short(t.owner)} has it · you’re watching`
                : from && from !== me ? `${short(from)} gave it to you` : 'New on your list'
      return { key: t.id, who: from || (t.owner !== me ? t.owner : undefined), icon: iconOf(t), problem: tagOfTask(s, t) === 'Problem', title: t.short || t.title, why, tone: t.urgent && t.owner === me ? 'bad' : undefined, right: dayOf(t, tnow), job: s.jobs[t.jobId]?.name, urgent: !!t.urgent && t.owner === me, open: go(() => s.open({ t: 'task', id: t.id })) }
    }),
    ...meets.map((e): Row => ({ key: e.id, who: e.by, icon: <CalendarDays />, title: e.title, why: `${e.kind === 'walkthrough' ? 'Walkthrough' : 'Meeting'}${e.by && e.by !== me ? ` · set by ${short(e.by)}` : ''}`, right: { text: e.date === TODAY ? timeLabel(e.start) : `${labelFromIso(e.date)} ${timeLabel(e.start)}` }, job: e.jobId ? s.jobs[e.jobId]?.name : undefined, open: go(() => s.open({ t: 'event', id: e.id })) })),
    ...steps.map(({ job, step, n: nu }): Row => ({ key: `${job.id}:${step.key}`, who: nu?.by, icon: <BellRing />, title: step.short || step.label, why: `${short(nu?.by)} reminded you`, right: step.due ? (step.due < TODAY ? { text: md(step.due), late: true } : { text: labelFromIso(step.due) }) : undefined, job: job.name, open: go(() => openStep(job.id, step.key)) })),
  ]
  const notify = useNotifyState()
  if (!rows.length) return null
  const n = rows.length
  const urgent = rows.filter((r) => r.urgent).length
  const timed = rows.filter((r) => r.timed)
  const allTimed = timed.length === n
  /* "later": the ones whose time came wait that long; the rest are seen */
  const later = (mins: number) => { putOff(timed.map((r) => r.key), mins); markSeen(keys.filter((k) => !timed.some((r) => r.key === k))); s.close() }
  const SHOW = 6
  return (
    <Modal
      level={level}
      size="sm"
      /* a phone: a short card at the bottom, as tall as what's in it (not a whole screen for one line) */
      className="max-sm:mt-auto max-sm:h-auto max-sm:max-h-[85dvh]"
      onClose={done}
      title={allTimed ? (n === 1 ? (soonRows.length ? 'Starting soon' : 'Due now') : `${n} due now`) : urgent ? (n === 1 ? 'Urgent for you' : `${n} new for you · ${urgent} urgent`) : n === 1 ? 'New for you' : `${n} new for you`}
      footer={<>
        {timed.length > 0 && (
          <Menu align="start" width={240} trigger={<button className="inline-flex h-9 items-center gap-1.5 rounded-[0.5625rem] px-3 text-[0.84375rem] font-semibold text-ink-2 hover:bg-wash max-sm:h-11" data-due-later><AlarmClock className="h-4 w-4 text-faint" />Remind me later<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
            <MenuLabel>Show {timed.length === 1 ? 'it' : 'them'} again</MenuLabel>
            <MenuItem onSelect={() => later(10)} data-due-later-10>In 10 minutes</MenuItem>
            <MenuItem onSelect={() => later(30)}>In half an hour</MenuItem>
            <MenuItem onSelect={() => later(60)}>In an hour</MenuItem>
          </Menu>
        )}
        <Button className="ml-auto max-sm:flex-1" variant="primary" onClick={done} data-incoming-ok>Got it</Button>
      </>}
      bodyClass="px-0 pb-1 pt-0"
    >
      <ul className="flex flex-col" data-incoming-list>
        {rows.slice(0, SHOW).map((r) => (
          <li key={r.key} className="border-t border-line-2 first:border-t-0">
            <button type="button" onClick={r.open} className="group flex min-h-14 w-full items-start gap-3 px-6 py-3 text-left transition hover:bg-wash/70 max-sm:px-4" data-incoming-row {...(r.urgent ? { 'data-incoming-urgent': '' } : {})}>
              <span className={cn('mt-[0.1875rem] inline-flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4', r.tone === 'bad' || r.problem ? 'text-bad-600' : 'text-[#8a8478]')} aria-hidden>{r.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-start gap-3">
                  <span className="min-w-0 flex-1 break-words text-[0.9375rem] font-medium leading-[1.375rem] text-ink max-sm:text-[1rem]" data-incoming-title>{r.title}</span>
                  {r.right && <span className={cn('shrink-0 text-[0.8125rem] leading-[1.375rem] tnum', r.right.late ? 'font-medium text-bad-600' : 'text-muted')} data-incoming-when={r.right.late ? 'late' : ''}>{r.right.text}</span>}
                </span>
                <span className="mt-0.5 block break-words text-[0.8125rem] leading-5 text-muted"><span className={r.tone === 'bad' ? 'font-medium text-bad-600' : undefined} {...(r.timed ? { 'data-due-why': '' } : {})}>{r.why}</span>{r.job && <span> · {r.job}</span>}</span>
              </span>
            </button>
          </li>
        ))}
        {n > SHOW && <li className="border-t border-line-2 px-6 py-2.5 text-[0.8125rem] text-muted max-sm:px-4">And {n - SHOW} more on your Today</li>}
      </ul>
      {/* a time came and nothing reached the phone: the way to get it there next time, one tap */}
      {timed.length > 0 && (notify === 'off' || notify === 'homescreen') && (
        <button type="button" onClick={() => s.open({ t: 'notify' })} className="flex w-full items-center gap-2 border-t border-line-2 px-6 py-3 text-left text-[0.84375rem] text-muted transition hover:text-ink max-sm:px-4" data-due-notify>
          <BellRing className="h-4 w-4 shrink-0 text-faint" /><span className="min-w-0 flex-1">Get these on your phone, even with the app closed</span><span className="shrink-0 font-semibold text-brand-700">Turn on</span>
        </button>
      )}
    </Modal>
  )
}
