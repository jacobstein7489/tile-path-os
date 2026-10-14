/* Today is today. The sample projects were written for Monday, Sep 28, 2026; they move forward in whole weeks,
 * so "Wed" or "Fri" in them stay true and the dates around today look the way they would in real life.
 * (?today=2026-10-12 in the address pins a day — the tests use it.) */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY = 86400000
const pad = (n: number) => String(n).padStart(2, '0')
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const isoUTC = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }

/** the day the sample data was written for (a Monday) */
export const BASE = '2026-09-28'
function realToday() {
  try {
    const p = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('today') : null
    if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p
  } catch { /* no location */ }
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const TODAY = realToday()
export const addDays = (iso: string, n: number) => isoUTC(utc(iso) + n * DAY)
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY)
/** whole weeks from the sample's Monday to this week */
export const SHIFT = 7 * Math.floor(daysBetween(BASE, TODAY) / 7)
export const TOMORROW = addDays(TODAY, 1)
/** Monday of this week */
export const MONDAY = addDays(BASE, SHIFT)
export const dow = (iso: string) => new Date(utc(iso)).getUTCDay()
/** "Oct 12" */
export const md = (iso: string) => `${MON[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`
/** "Mon, Oct 12" */
export const dayShort = (iso: string) => `${DOW[dow(iso)]}, ${md(iso)}`
/** "Monday, October 12" */
export const dayLongFull = (iso: string) => `${DOW_LONG[dow(iso)]}, ${MONTH[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`
export const NOW = md(TODAY)
/** the next work day on or after a date */
export const workday = (iso: string) => { let d = iso; while (dow(d) === 0 || dow(d) === 6) d = addDays(d, 1); return d }

/* ---------------- moving the sample data ---------------- */
export const shiftISO = (iso: string) => (SHIFT ? addDays(iso, SHIFT) : iso)
const isoOfMD = (m: number, d: number) => `2026-${pad(m + 1)}-${pad(d)}`
const MI = (s: string) => MON.indexOf(s.slice(0, 3))
const MON_RE = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'
const LONG_RE = '(?:January|February|March|April|May|June|July|August|September|October|November|December)'
/* one pass, so nothing gets moved twice: ISO · "Sat, Sep 26" · "Sep 21 – 26" · "September 4" · "Sep 28" */
const DATE_RE = new RegExp(
  `\\b(20\\d\\d-\\d\\d-\\d\\d)\\b` +
    `|\\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (${MON_RE}) (\\d{1,2})\\b` +
    `|\\b(${MON_RE}) (\\d{1,2}) – (\\d{1,2})\\b` +
    `|\\b(${LONG_RE}) (\\d{1,2})\\b` +
    `|\\b(${MON_RE}) (\\d{1,2})\\b`,
  'g',
)
export function shiftText(s: string): string {
  if (!SHIFT || !s) return s
  return s.replace(DATE_RE, (m, iso, w, wm, wd, rm, ra, rb, lm, ld, mm, mdd) => {
    if (iso) return shiftISO(iso)
    if (w) return `${w}, ${md(shiftISO(isoOfMD(MI(wm), +wd)))}`
    if (rm) {
      const x = shiftISO(isoOfMD(MI(rm), +ra))
      const y = shiftISO(isoOfMD(MI(rm), +rb))
      return `${md(x)} – ${x.slice(5, 7) === y.slice(5, 7) ? +y.slice(8, 10) : md(y)}`
    }
    if (lm) { const x = shiftISO(isoOfMD(MONTH.indexOf(lm), +ld)); return `${MONTH[+x.slice(5, 7) - 1]} ${+x.slice(8, 10)}` }
    if (mm) return md(shiftISO(isoOfMD(MI(mm), +mdd)))
    return m
  })
}
/** every date in a piece of sample data — strings, and keys that carry a date */
export function shiftDeep<T>(x: T): T {
  if (!SHIFT) return x
  if (typeof x === 'string') return shiftText(x) as unknown as T
  if (Array.isArray(x)) return x.map((v) => shiftDeep(v)) as unknown as T
  if (x && typeof x === 'object') {
    const out: Record<string, unknown> = {}
    Object.entries(x as Record<string, unknown>).forEach(([k, v]) => { out[/\d{4}-\d\d-\d\d/.test(k) ? shiftText(k) : k] = shiftDeep(v) })
    return out as T
  }
  return x
}
/** the coming weeks for "start window" choices: "Week of Oct 19", … */
export const weekOf = (n: number) => `Week of ${md(addDays(MONDAY, 7 * n))}`
export const monthName = (n: number) => { const d = new Date(utc(TODAY)); d.setUTCMonth(d.getUTCMonth() + n, 1); return MONTH[d.getUTCMonth()] }

/* ---------------- words people pick ↔ real days ---------------- */
const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
/** "Tomorrow", "Wed", "Next Mon", "In 2 weeks", "Oct 21", "3 days late" → 2026-10-14 */
export function isoFromLabel(label?: string): string | undefined {
  if (!label) return undefined
  const l = label.trim().toLowerCase()
  if (/^\d{4}-\d\d-\d\d$/.test(l)) return l
  if (l === 'today' || l === 'now') return TODAY
  if (l === 'tomorrow') return TOMORROW
  if (l === 'next mon' || l === 'next week') { let d = addDays(TODAY, 1); while (dow(d) !== 1) d = addDays(d, 1); return d }
  if (l === 'in 2 weeks') return addDays(TODAY, 14)
  if (l === 'this week') { let d = TODAY; while (dow(d) !== 5) d = addDays(d, 1); return d }
  const late = l.match(/^(\d+) days? late$/)
  if (late) return addDays(TODAY, -Number(late[1]))
  const wd = DOW_KEYS.findIndex((k) => l.startsWith(k))
  if (wd >= 0 && l.length <= 9) { let d = TODAY; while (dow(d) !== wd) d = addDays(d, 1); return d }
  const m = l.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})$/)
  if (m) return `${TODAY.slice(0, 4)}-${pad(MON.findIndex((x) => x.toLowerCase() === m[1]) + 1)}-${pad(Number(m[2]))}`
  return undefined
}
/** 2026-10-14 → "Wed" this week, "Today", "Tomorrow", or "Oct 21" */
export function labelFromIso(iso?: string): string {
  if (!iso) return ''
  if (iso === TODAY) return 'Today'
  if (iso === TOMORROW) return 'Tomorrow'
  const n = daysBetween(TODAY, iso)
  if (n > 1 && n < 7) return DOW[dow(iso)]
  return md(iso)
}
