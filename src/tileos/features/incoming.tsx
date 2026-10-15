/* When something new lands on your plate — a hand-off, a task someone gave you, a meeting someone put you in (or
 * moved) — a card pops up in the middle of the screen, so it's never just a little number in a corner. It waits until
 * you're out of whatever window you're in, lists what's new, and each one opens in a click. "Got it" puts it away
 * (it stays on Today and the calendar, of course). */
import * as React from 'react'
import { Inbox, ArrowRight, CalendarDays } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { PEOPLE } from '@/tileos/data/model'
import { REAL } from '@/tileos/lib/save'
import type { Task } from '@/tileos/data/work'
import { TODAY, labelFromIso } from '@/tileos/lib/today'
import { timeLabel, type CalEvent } from '@/tileos/data/calendar'

const keyOf = (s: Store) => `tileos-seen:${REAL.email || 'preview'}:${meOf(s.role)}`
const read = (k: string): string[] | null => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const write = (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v.slice(-600))) } catch { /* private window */ } }
const tag = (t: Task, me?: string) => (me && t.owner !== me ? `${t.id}:f:${me}` : `${t.id}:${t.owner}`)
const evTag = (e: CalEvent) => `ev:${e.id}:${e.date}:${e.start}`
/** what's on my plate right now that someone (or a hand-off) put there */
const mineNow = (s: Store) => { const me = meOf(s.role); return s.tasks.filter((t) => (t.owner === me || t.followers?.includes(me)) && t.state === 'now' && t.log?.[0]?.who !== me) }
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
      const now = [...mineNow(s).map((t) => tag(t, me)), ...meetingsNow(s).map(evTag)]
      /* the first time on this computer: what's already there isn't "new" */
      if (!seen) { write(k, now); return }
      const fresh = now.filter((x) => !seen.includes(x))
      if (!fresh.length || s.modals.length) return
      s.open({ t: 'incoming', keys: fresh })
    }
    check()
    return useStore.subscribe((s, prev) => { if (s.tasks !== prev.tasks || s.events !== prev.events || s.role !== prev.role || (prev.modals.length && !s.modals.length)) check() })
  }, [])
  return null
}

function markSeen(keys: string[]) {
  const s = useStore.getState()
  const k = keyOf(s)
  write(k, Array.from(new Set([...(read(k) || []), ...keys])))
}

export function IncomingModal({ keys, level }: { keys: string[]; level: number }) {
  const s = useStore()
  const me = meOf(s.role)
  const list = keys.map((k) => s.tasks.find((t) => tag(t, me) === k)).filter((t): t is Task => !!t)
  const meets = keys.map((k) => s.events.find((e) => evTag(e) === k)).filter((e): e is CalEvent => !!e)
  const done = () => { markSeen(keys); s.close() }
  if (!list.length && !meets.length) return null
  const n = list.length + meets.length
  return (
    <Modal
      level={level}
      size="sm"
      onClose={done}
      title={n === 1 ? 'New for you' : `${n} new for you`}
      sub={meets.length && !list.length ? 'It’s on your calendar and your Today' : 'It’s on your Today too'}
      footer={<Button className="ml-auto" variant="primary" onClick={done}>Got it</Button>}
    >
      <div className="flex flex-col gap-2">
        {list.slice(0, 5).map((t) => {
          const from = t.log?.[0]?.who && t.log[0].who !== 'system' ? t.log[0].who : undefined
          const job = s.jobs[t.jobId]
          return (
            <button
              key={t.id}
              onClick={() => { markSeen(keys); s.close(); s.open({ t: 'task', id: t.id }) }}
              className="group flex items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
            >
              {from ? <Avatar who={from} size={34} /> : <span className="inline-flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Inbox className="h-4 w-4" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.90625rem] font-semibold text-ink">{t.title}</span>
                <span className="block truncate text-[0.78125rem] text-muted">{[t.owner !== me ? `${PEOPLE[t.owner]?.short} has it — you follow it` : '', job?.name, from && t.owner === me ? `from ${PEOPLE[from]?.short}` : t.owner === me ? t.where : '', t.due ? `due ${t.due}` : ''].filter(Boolean).join(' · ')}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-faint transition group-hover:text-brand-600" />
            </button>
          )
        })}
        {meets.map((e) => {
          const job = e.jobId ? s.jobs[e.jobId] : undefined
          return (
            <button
              key={e.id}
              onClick={() => { markSeen(keys); s.close(); s.open({ t: 'event', id: e.id }) }}
              className="group flex items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
            >
              {e.by ? <Avatar who={e.by} size={34} /> : <span className="inline-flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"><CalendarDays className="h-4 w-4" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.90625rem] font-semibold text-ink">{e.title}{job ? ` · ${job.name}` : ''}</span>
                <span className="block truncate text-[0.78125rem] text-muted">{labelFromIso(e.date)} · {timeLabel(e.start)}{e.by ? ` · set by ${PEOPLE[e.by]?.short}` : ''}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-faint transition group-hover:text-brand-600" />
            </button>
          )
        })}
        {list.length > 5 && <div className="px-1 text-[0.8125rem] text-muted">and {list.length - 5} more on your Today</div>}
      </div>
    </Modal>
  )
}
