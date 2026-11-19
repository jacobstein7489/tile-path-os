/* When something new lands on your plate — a hand-off, a task someone gave you, a meeting someone put you in (or
 * moved), a reminder that something of yours is late — a card pops up in the middle of the screen, so it's never just
 * a little number in a corner. It waits until you're out of whatever window you're in, lists what's new, and each one
 * opens in a click. "Got it" puts it away (it stays on Today and the calendar, of course). */
import * as React from 'react'
import { Inbox, ChevronRight, CalendarDays, BellRing } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import { REAL } from '@/tileos/lib/save'
import { cn } from '@/tileos/lib/utils'
import type { Task } from '@/tileos/data/work'
import { TODAY, labelFromIso, isoFromLabel } from '@/tileos/lib/today'
import { isGcWait, toldGc, askLabel } from './gcwait'
import { timeLabel, type CalEvent } from '@/tileos/data/calendar'
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
/* the automated tests drive the app themselves — no pop-ups in their way */
const quiet = () => { try { return navigator.webdriver && !localStorage.getItem('tileos-pop-test') } catch { return false } }

export function IncomingWatcher() {
  React.useEffect(() => {
    if (quiet()) return
    const check = () => {
      const s = useStore.getState()
      if (s.role === 'crew' || s.role === 'client') return
      const k = keyOf(s)
      const seen = read(k)
      const me = meOf(s.role)
      const now = [...mineNow(s).map((t) => tag(t, me)), ...meetingsNow(s).map(evTag), ...nudgedSteps(s).map((x) => stepTag(x.job, x.step, x.n!.at))]
      /* the first time on this computer: what's already there isn't "new" */
      if (!seen) { write(k, now); return }
      const fresh = now.filter((x) => !seen.includes(x))
      if (!fresh.length || s.modals.length) return
      s.open({ t: 'incoming', keys: fresh })
    }
    check()
    return useStore.subscribe((s, prev) => { if (s.tasks !== prev.tasks || s.events !== prev.events || s.stepRecs !== prev.stepRecs || s.role !== prev.role || (prev.modals.length && !s.modals.length)) check() })
  }, [])
  return null
}

function markSeen(keys: string[]) {
  const s = useStore.getState()
  const k = keyOf(s)
  write(k, Array.from(new Set([...(read(k) || []), ...keys])))
}

/** one line, the same for everything new: who did it (their circle), what it is — and under it, in a few words, why it's
 *  here and its project. Red only for what's urgent or late */
type Row = { key: string; who?: PersonKey; icon?: React.ReactNode; title: string; why: string; tone?: 'bad' | 'warn'; job?: string; urgent?: boolean; open: () => void }
export function IncomingModal({ keys, level }: { keys: string[]; level: number }) {
  const s = useStore()
  const me = meOf(s.role)
  const short = (p?: string) => (p ? PEOPLE[p as PersonKey]?.short || 'Someone' : 'Someone')
  /* urgent ones first */
  const list = keys.map((k) => s.tasks.find((t) => tag(t, me) === k)).filter((t): t is Task => !!t).sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent))
  const meets = keys.map((k) => s.events.find((e) => evTag(e) === k)).filter((e): e is CalEvent => !!e)
  const steps = nudgedSteps(s).filter((x) => keys.includes(stepTag(x.job, x.step, x.n!.at)))
  const done = () => { markSeen(keys); s.close() }
  const go = (f: () => void) => () => { markSeen(keys); f() }
  const rows: Row[] = [
    ...list.map((t): Row => {
      const nudged = !!t.nudge && t.owner === me && t.nudge.by !== me && tag(t, me).includes(':n')
      const from = nudged ? t.nudge!.by : t.log?.[0]?.who && t.log[0].who !== 'system' ? (t.log[0].who as PersonKey) : undefined
      const gc = isGcWait(t) && t.owner === me
      const why = t.urgent && t.owner === me ? `Urgent · ${from ? `${short(from)} gave it to you` : 'for you'}`
        : nudged ? `${short(from)} reminded you${gc ? '' : ' · it’s late'}`
          : gc ? `${askLabel(t)} today`
            : t.owner !== me && t.also?.includes(me) ? `${short(from || t.owner)} shared it with you`
              : t.owner !== me ? `${short(t.owner)} has it · you’re watching`
                : from && from !== me ? `${short(from)} gave it to you` : 'New on your list'
      return { key: t.id, who: from || (t.owner !== me ? t.owner : undefined), icon: <Inbox className="h-4 w-4" />, title: t.title, why, tone: t.urgent && t.owner === me ? 'bad' : nudged ? 'bad' : gc ? 'warn' : undefined, job: s.jobs[t.jobId]?.name, urgent: !!t.urgent && t.owner === me, open: go(() => s.open({ t: 'task', id: t.id })) }
    }),
    ...meets.map((e): Row => ({ key: e.id, who: e.by, icon: <CalendarDays className="h-4 w-4" />, title: e.title, why: `${e.kind === 'walkthrough' ? 'Walkthrough' : 'Meeting'} · ${labelFromIso(e.date)} at ${timeLabel(e.start)}${e.by && e.by !== me ? ` · set by ${short(e.by)}` : ''}`, job: e.jobId ? s.jobs[e.jobId]?.name : undefined, open: go(() => s.open({ t: 'event', id: e.id })) })),
    ...steps.map(({ job, step, n: nu }): Row => ({ key: `${job.id}:${step.key}`, who: nu?.by, icon: <BellRing className="h-4 w-4" />, title: step.short || step.label, why: `${short(nu?.by)} reminded you · it’s late`, tone: 'bad', job: job.name, open: go(() => openStep(job.id, step.key)) })),
  ]
  if (!rows.length) return null
  const n = rows.length
  const urgent = rows.filter((r) => r.urgent).length
  const SHOW = 6
  return (
    <Modal
      level={level}
      size="sm"
      onClose={done}
      title={urgent ? (n === 1 ? 'Urgent for you' : `${n} new for you · ${urgent} urgent`) : n === 1 ? 'New for you' : `${n} new for you`}
      sub="Tap one to open it. They’re all on your Today."
      footer={<Button className="ml-auto max-sm:flex-1" variant="primary" onClick={done} data-incoming-ok>Got it</Button>}
      bodyClass="px-0 pb-1 pt-0"
    >
      <ul className="flex flex-col" data-incoming-list>
        {rows.slice(0, SHOW).map((r) => (
          <li key={r.key} className="border-t border-line-2 first:border-t-0">
            <button type="button" onClick={r.open} className="group flex min-h-[3.75rem] w-full items-center gap-3 px-6 py-2.5 text-left transition hover:bg-wash/70 max-sm:px-4" data-incoming-row {...(r.urgent ? { 'data-incoming-urgent': '' } : {})}>
              {r.who && PEOPLE[r.who] ? <Avatar who={r.who} size={32} /> : <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wash-2 text-muted">{r.icon}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold leading-snug text-ink">{r.title}</span>
                <span className="block truncate text-[0.8125rem] leading-snug"><span className={r.tone === 'bad' ? 'font-medium text-bad-600' : r.tone === 'warn' ? 'font-medium text-warn-700' : 'text-muted'}>{r.why}</span>{r.job && <span className="text-muted"> · {r.job}</span>}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint transition group-hover:text-brand-600" />
            </button>
          </li>
        ))}
        {n > SHOW && <li className="border-t border-line-2 px-6 py-2.5 text-[0.8125rem] text-muted max-sm:px-4">And {n - SHOW} more on your Today</li>}
      </ul>
    </Modal>
  )
}
