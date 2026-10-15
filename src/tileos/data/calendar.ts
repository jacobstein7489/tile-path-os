/* Meetings and walkthroughs — everything with a day and a time, for everyone in the company.
 * One list feeds the agenda on Today, the project's next meeting on the Game plan, and the clash check. */
import type { PersonKey } from './model'
import { TODAY } from '@/tileos/lib/today'

export const CAL_TODAY = TODAY

export interface CalEvent {
  id: string
  jobId?: string
  kind: 'meeting' | 'walkthrough'
  title: string
  /** ISO day */
  date: string
  /** minutes from midnight */
  start: number
  /** minutes */
  dur: number
  /** our people who are in it */
  people: PersonKey[]
  /** who else — the installer, the designer, the GC super… */
  with?: string
  note?: string
  /** made from the project's "next meeting" on the Game plan */
  plan?: boolean
}

export const EVENTS0: CalEvent[] = [
  { id: 'ev-530', jobId: '530', kind: 'meeting', title: 'Job review', date: '2026-09-28', start: 15 * 60, dur: 60, people: ['ys'], plan: true },
  { id: 'ev-115', jobId: '115', kind: 'meeting', title: 'Kickoff with the owner’s rep', date: '2026-09-29', start: 10 * 60, dur: 60, people: ['ys'], with: 'Owner’s rep', plan: true },
  { id: 'ev-114', jobId: '114', kind: 'walkthrough', title: 'Walkthrough with the GC super', date: '2026-09-30', start: 8 * 60, dur: 60, people: ['ys', 'yakov'], with: 'GC super', plan: true },
  { id: 'ev-mdrive', jobId: 'mdrive', kind: 'walkthrough', title: 'Check heights on site', date: '2026-09-30', start: 9 * 60, dur: 60, people: ['ys'], plan: true },
]

/* ---------------- days and times ---------------- */
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function addDaysIso(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
/** "Today", "Tomorrow", "Wed", "Mon Oct 5" */
export function dayLabel(iso: string) {
  if (iso === CAL_TODAY) return 'Today'
  if (iso === addDaysIso(CAL_TODAY, 1)) return 'Tomorrow'
  const d = new Date(iso + 'T12:00:00')
  const diff = Math.round((d.getTime() - new Date(CAL_TODAY + 'T12:00:00').getTime()) / 86400000)
  if (diff > 1 && diff < 6) return DOW[d.getDay()]
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
export const dayLong = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
/** the next work days, starting today */
export function workDays(n: number) {
  const out: string[] = []
  let d = CAL_TODAY
  while (out.length < n) {
    const w = new Date(d + 'T12:00:00').getDay()
    if (w !== 0 && w !== 6) out.push(d)
    d = addDaysIso(d, 1)
  }
  return out
}
/** "9 AM", "10:30 AM" */
export function timeLabel(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`
}
/** "8–9 AM", "11 AM–12 PM" */
export function rangeLabel(start: number, dur: number) {
  const a = timeLabel(start)
  const b = timeLabel(start + dur)
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`
}
/** "9 AM", "10:30am", "1030", "3pm" → minutes */
export function parseTime(t?: string): number | null {
  if (!t) return null
  const m = t.match(/\b(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?\b/i)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] || 0)
  const ap = m[3]?.toLowerCase()
  if (h > 12 || min > 59) return null
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  if (!ap && h < 7) h += 12
  return h * 60 + min
}
/** "Today", "Tomorrow", "Wed" → the ISO day this week */
export function isoOfDay(day?: string): string | null {
  if (!day) return null
  if (/^today$/i.test(day)) return CAL_TODAY
  if (/^tomorrow$/i.test(day)) return addDaysIso(CAL_TODAY, 1)
  const next = /^next\s/i.test(day)
  const i = DOW.findIndex((x) => day.replace(/^next\s/i, '').toLowerCase().startsWith(x.toLowerCase()))
  if (i < 0) return null
  const today = new Date(CAL_TODAY + 'T12:00:00').getDay()
  let diff = (i - today + 7) % 7
  if (diff === 0 || next) diff += 7
  return addDaysIso(CAL_TODAY, diff)
}
export const overlaps = (a: { date: string; start: number; dur: number }, b: { date: string; start: number; dur: number }) => a.date === b.date && a.start < b.start + b.dur && b.start < a.start + a.dur
