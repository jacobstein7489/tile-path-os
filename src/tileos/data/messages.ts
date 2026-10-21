/* One conversation per project — our team, the crew and the GC in one place, with photos.
 * "Team only" messages never show in the GC's login. Sample messages. */
import type { PersonKey, SwatchKey } from './model'

export interface Msg {
  id: string
  /** someone on our side (or the GC's login) */
  who: PersonKey
  text: string
  date: string
  time: string
  photos?: { sw: SwatchKey; cap: string }[]
  /** team only — the GC doesn't see it */
  internal?: boolean
  /** turned into a task, a change or a question */
  became?: string
  /** came in from WhatsApp */
  wa?: boolean
  /** a voice note: the recording (a data URL in the preview, a path in the company's storage in the real app), how
   *  long it runs in seconds, and its shape for the bars */
  audio?: string
  audioPath?: string
  dur?: number
  wave?: number[]
  /** photos sent in the conversation — kept with the project's files; a small picture rides along */
  media?: { id: string; thumb?: string }[]
  /** reactions: the emoji → who gave it */
  reacts?: Record<string, PersonKey[]>
}
export const MESSAGES0: Record<string, Msg[]> = {
  '119': [
    { id: 'm1', who: 'gcpp', text: 'Plumber is confirmed for Thursday on the master shower drain. Can your guys stay off that floor until then?', date: 'Sep 26', time: '7:45 AM', wa: true },
    { id: 'm2', who: 'yakov', text: 'Yes — Philip holds the master shower floor and keeps going on the guest bath walls. I’ll be there Thursday.', date: 'Sep 26', time: '8:02 AM' },
    { id: 'm3', who: 'philip', text: 'Guest bath walls at 70%, niche started.', date: 'Sep 26', time: '4:30 PM', photos: [{ sw: 'subway', cap: 'Guest bath walls' }, { sw: 'toscana', cap: 'Niche' }] },
    { id: 'm4', who: 'ys', text: 'Keep the CO-004 walls at 3 ft until the GC approves — I’ll chase it Wednesday.', date: 'Sep 26', time: '5:10 PM', internal: true },
    { id: 'm5', who: 'gcpp', text: 'CO-004 is with the owner. Answer by Wednesday.', date: 'Sep 28', time: '9:10 AM' },
  ],
  '114': [
    { id: 'm6', who: 'gcpp', text: 'Walkthrough Wednesday 8 AM works. Bring the tile counts — the store says 500 SF of T-04.', date: 'Sep 28', time: '8:20 AM', wa: true },
  ],
}

/** the sample's read marks: how far each person has read each conversation ("119|yakov" → 5 messages) */
export const SEEN0: Record<string, { n: number }> = { '119|yakov': { n: 5 }, '119|philip': { n: 4 }, '119|ys': { n: 4 }, '114|yakov': { n: 1 } }
