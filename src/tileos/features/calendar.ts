/* The calendar: add a meeting or walkthrough, see who's busy, and catch a clash before it happens. */
import { useStore, addHist, meOf, type Store } from '@/tileos/store'
import { CAL_TODAY, dayLabel, timeLabel, overlaps, parseTime, type CalEvent } from '@/tileos/data/calendar'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'

const S = () => useStore.getState()

export type Busy = { id: string; title: string; sub?: string; start: number; dur: number; people: PersonKey[]; jobId?: string; kind: 'meeting' | 'walkthrough' | 'report' }

/** everything with a time for these people on a day: meetings, walkthroughs and fixed-time reports */
export function busyFor(s: Pick<Store, 'events' | 'tasks' | 'jobs'>, date: string, people: PersonKey[] | null): Busy[] {
  const hit = (ps: PersonKey[]) => !people || ps.some((p) => people.includes(p))
  const out: Busy[] = s.events
    .filter((e) => e.date === date && hit(e.people))
    .map((e) => ({ id: e.id, title: e.title, sub: [e.jobId ? s.jobs[e.jobId]?.name : '', e.with ? `with ${e.with}` : ''].filter(Boolean).join(' · ') || undefined, start: e.start, dur: e.dur, people: e.people, jobId: e.jobId, kind: e.kind }))
  const wd = new Date(date + 'T12:00:00').getDay()
  if (wd > 0 && wd < 6)
    s.tasks
      .filter((t) => t.repeat && t.repeatAt && t.state !== 'done' && hit([t.owner]))
      .forEach((t) => {
        const m = parseTime(t.repeatAt)
        if (m != null) out.push({ id: t.id, title: t.title.split(' — ')[0], start: m, dur: 30, people: [t.owner], kind: 'report' })
      })
  return out.sort((a, b) => a.start - b.start)
}

export function clashesWith(s: Pick<Store, 'events' | 'tasks' | 'jobs'>, slot: { date: string; start: number; dur: number }, people: PersonKey[]) {
  return busyFor(s, slot.date, people).filter((b) => overlaps(slot, { date: slot.date, start: b.start, dur: b.dur }))
}

/** the next time that works for everyone, between 7 AM and 6 PM */
export function nextFree(s: Pick<Store, 'events' | 'tasks' | 'jobs'>, date: string, from: number, dur: number, people: PersonKey[]) {
  for (let t = Math.max(7 * 60, from); t + dur <= 18 * 60; t += 30) if (!clashesWith(s, { date, start: t, dur }, people).length) return t
  return null
}

const upcomingFor = (events: CalEvent[], jobId: string) =>
  events.filter((e) => e.jobId === jobId && e.date >= CAL_TODAY).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)

export function addEvent(e: Omit<CalEvent, 'id'>) {
  const id = 'ev' + Date.now().toString(36)
  S().commit((s) => {
    s.events.push({ ...e, id, by: e.by || meOf(s.role) })
    if (e.jobId) {
      /* the project's next meeting on the Game plan follows the calendar */
      const next = upcomingFor(s.events, e.jobId)[0]
      if (next?.id === id) s.prep[e.jobId] = { ...(s.prep[e.jobId] || {}), meeting: { text: e.title, day: dayLabel(e.date), time: timeLabel(e.start) } }
      addHist(s, e.jobId, {
        who: meOf(s.role),
        kind: 'schedule',
        title: `${e.kind === 'walkthrough' ? 'Walkthrough' : 'Meeting'} set · ${dayLabel(e.date)} ${timeLabel(e.start)}`,
        detail: [e.title, e.people.map((p) => PEOPLE[p].short).join(', '), e.with ? `with ${e.with}` : ''].filter(Boolean).join(' · '),
      })
    }
  }, `${e.title} · ${dayLabel(e.date)} at ${timeLabel(e.start)} — on the agenda`)
  return id
}

export function removeEvent(id: string) {
  const e0 = S().events.find((x) => x.id === id)
  S().commit((s) => {
    const e = s.events.find((x) => x.id === id)
    s.events = s.events.filter((x) => x.id !== id)
    if (e?.jobId) {
      const next = upcomingFor(s.events, e.jobId)[0]
      s.prep[e.jobId] = { ...(s.prep[e.jobId] || {}), meeting: next ? { text: next.title, day: dayLabel(next.date), time: timeLabel(next.start) } : { text: 'TBD' } }
      addHist(s, e.jobId, { who: meOf(s.role), kind: 'schedule', title: `${e.kind === 'walkthrough' ? 'Walkthrough' : 'Meeting'} canceled · ${e.title}`, detail: `Was ${dayLabel(e.date)} ${timeLabel(e.start)}` })
    }
  }, `${e0?.kind === 'walkthrough' ? 'Walkthrough' : 'Meeting'} canceled`, { sub: e0 && /design/i.test(e0.title) ? 'It’s off everyone’s calendar — the design meeting step is back to “set the meeting”.' : 'It’s off everyone’s calendar.' })
}
/** a new day or time (and who's in it) — everyone in it is told again */
export function moveEvent(id: string, p: { date: string; start: number; people?: PersonKey[]; with?: string }) {
  S().commit((s) => {
    const e = s.events.find((x) => x.id === id)
    if (!e) return
    const was = `${dayLabel(e.date)} ${timeLabel(e.start)}`
    e.date = p.date
    e.start = p.start
    if (p.people?.length) e.people = p.people
    if (p.with !== undefined) e.with = p.with
    e.by = meOf(s.role)
    if (e.jobId) {
      const next = upcomingFor(s.events, e.jobId)[0]
      if (next) s.prep[e.jobId] = { ...(s.prep[e.jobId] || {}), meeting: { text: next.title, day: dayLabel(next.date), time: timeLabel(next.start) } }
      addHist(s, e.jobId, { who: meOf(s.role), kind: 'schedule', title: `${e.kind === 'walkthrough' ? 'Walkthrough' : 'Meeting'} moved · ${dayLabel(p.date)} ${timeLabel(p.start)}`, detail: `Was ${was}` })
    }
  }, `Moved to ${dayLabel(p.date)} ${timeLabel(p.start)}`, { sub: 'Everyone in it sees the new time.' })
}
