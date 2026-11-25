/* What's happened with a to-do lately, in a few words on its line — so nobody has to open it to know:
 *   yours, given to you and not opened yet:        New from Jacob        (blue)
 *   someone else's, given to them and not opened:  Not seen yet          (amber)
 *   someone else's, they did something on it:       Updated 3:42 PM
 *   someone else's, they opened it:                 Seen Yesterday
 *   yours, someone else did something on it:        Note from Jacob · Nov 23
 *   otherwise:                                      Created Nov 20, 9:14 AM  (when, and so how old it is)
 * The whole story (created, given, seen, the last change) is on the line when you point at it. "Seen" is when its person
 * opened it after it was given to them (its window, the "New for you" card, a tapped notification). */
import { useStore, meOf, NOW } from '@/tileos/store'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import type { Task, LogLine } from '@/tileos/data/work'
import { TODAY, addDays, md, isoFromLabel } from '@/tileos/lib/today'
import { awayFromMe } from '@/tileos/lib/save'

export type Latest = { text: string; tone?: 'new' | 'warn'; tip: string }

const short = (p?: string) => (p && p !== 'system' ? PEOPLE[p as PersonKey]?.short || 'Someone' : 'Tile OS')
const YESTERDAY = md(addDays(TODAY, -1))
/** a day and a time, the way the list says it: the time today, Yesterday, else the day ("Nov 20") */
const whenOf = (date?: string, time?: string) => (!date ? '' : date === NOW ? time || 'Today' : date === YESTERDAY ? 'Yesterday' : date)
/** when it was created: "Created 9:14 AM" (today), "Created yesterday, 3:42 PM", "Created Nov 20, 9:14 AM" */
const createdOf = (date?: string, time?: string) => (!date ? '' : date === NOW ? `Created ${time || 'today'}` : date === YESTERDAY ? `Created yesterday${time ? `, ${time}` : ''}` : `Created ${date}${time ? `, ${time}` : ''}`)
/** the same from a moment (ISO) */
const whenAt = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  const day = md(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  return whenOf(day, d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
}
const fullAt = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return isNaN(+d) ? '' : `${md(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` }
/** a line's moment, to put lines in order ("Nov 24" "3:42 PM" → sortable) */
const keyOf = (l: LogLine) => `${isoFromLabel(l.date) || '0000'} ${String(minOf(l.time)).padStart(4, '0')}`
const minOf = (t?: string) => { const m = (t || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i); if (!m) return 0; let h = Number(m[1]) % 12; if (/pm/i.test(m[3])) h += 12; return h * 60 + Number(m[2]) }
/* what the app writes by itself on a to-do (not something a person did on it) */
const AUTO = /^(Created|Repeats|Handed to|Moved to .+\. It was late)/

/** it was given to its person and they haven't opened it since */
export const notSeen = (t: Task) => !!t.given && !!t.givenBy && t.givenBy !== t.owner && t.state !== 'done' && !((t.seen?.[t.owner] || '') >= t.given)

export function latestOf(t: Task, me: PersonKey): Latest | null {
  const log = t.log || []
  const first = log[0]
  const made = first ? `${createdOf(first.date, first.time)}${first.who && first.who !== 'system' ? ` by ${short(first.who)}` : ''}` : ''
  const given = t.given && t.givenBy ? `${short(t.givenBy)} gave it to ${t.owner === me ? 'you' : short(t.owner)} ${fullAt(t.given)}` : ''
  const seenAt = t.seen?.[t.owner]
  const seen = seenAt ? `${t.owner === me ? 'You' : short(t.owner)} opened it ${fullAt(seenAt)}` : t.given ? `${t.owner === me ? 'You haven’t' : `${short(t.owner)} hasn’t`} opened it yet` : ''
  const lastLine = [...log].reverse().find((l, i) => i < log.length - 1 && !AUTO.test(l.text))
  const last = lastLine ? `Last: ${lastLine.text.replace(/\.$/, '')} · ${short(lastLine.who)}, ${[lastLine.date, lastLine.time].filter(Boolean).join(' ')}` : ''
  const tip = [made, given, seen, last].filter(Boolean).join('\n')
  const mine = t.owner === me || !!t.also?.includes(me)
  /* given to its person, not opened yet */
  if (notSeen(t)) return t.owner === me ? { text: `New from ${short(t.givenBy)}`, tone: 'new', tip } : { text: 'Not seen yet', tone: 'warn', tip }
  /* the newest thing a person did on it (not what the app wrote by itself) */
  const did = (who: (p: string) => boolean) => [...log].filter((l, i) => i > 0 && !AUTO.test(l.text) && who(l.who)).sort((a, b) => keyOf(a).localeCompare(keyOf(b))).pop()
  if (mine) {
    /* yours: someone else did something on it (a note, a change) */
    const other = did((p) => p !== me && p !== 'system')
    if (other) return { text: /^Reminded/.test(other.text) ? `Reminded by ${short(other.who)}` : other.note ? `Note from ${short(other.who)}` : `Changed ${whenOf(other.date, other.time)}`, tip }
  } else {
    /* someone else's: what they did on it, else when they opened it */
    const theirs = did((p) => p === t.owner)
    if (theirs) return { text: `Updated ${whenOf(theirs.date, theirs.time)}`, tip }
    if (seenAt) return { text: `Seen ${whenAt(seenAt)}`, tip }
  }
  return first ? { text: createdOf(first.date, first.time), tip } : null
}

/** its person opened it (or read it on the "New for you" card, or tapped its notification): seen — once each time it's
 *  given to them */
export function markTaskSeen(ids: string[]) {
  const s = useStore.getState()
  /* the admin looking through someone else's eyes doesn't open it for them */
  if (awayFromMe(s)) return
  const me = meOf(s.role)
  const now = new Date().toISOString()
  const need = s.tasks.filter((t) => ids.includes(t.id) && (t.owner === me || t.also?.includes(me)) && t.given && !((t.seen?.[me] || '') >= t.given))
  if (!need.length) return
  s.commit((st) => {
    need.forEach((n) => { const t = st.tasks.find((x) => x.id === n.id); if (t) t.seen = { ...(t.seen || {}), [me]: now } })
  }, undefined, { undo: false })
}
