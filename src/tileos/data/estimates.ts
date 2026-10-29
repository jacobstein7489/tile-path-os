/* Estimates: everything starts here. A request is estimated from our QuickBooks items, sent,
 * revised, and approved — and an approved estimate becomes a project, rooms and quantities included.
 * Sample amounts. */
import type { PersonKey, Tone } from './model'
import type { LogLine } from './work'
import type { Room } from './jobs'

export type EstStatus = 'request' | 'estimating' | 'sent' | 'revision' | 'approved' | 'lost'
export const EST_STATUS: Record<EstStatus, { label: string; tone: Tone }> = {
  request: { label: 'New request', tone: 'neutral' },
  estimating: { label: 'Estimating', tone: 'info' },
  sent: { label: 'Pending approval', tone: 'info' },
  revision: { label: 'Revision needed', tone: 'warn' },
  approved: { label: 'Approved', tone: 'ok' },
  lost: { label: 'Lost', tone: 'neutral' },
}
export const EST_FLOW: EstStatus[] = ['request', 'estimating', 'sent', 'approved']

export interface EstLine { id: string; area: string; itemId: string; desc?: string; qty: number; rate: number; /** the surface it tiles and its tile, when the takeoff knows them */ surface?: string; tile?: string }

/* Inside the company an estimate goes Takeoff → Office review → Final review, then to the client.
 * Whose turn it is lives on the estimate — nobody's tasks change hands. */
/** a step inside the company: the three standard ones, or one the company added (Settings → Who does what) */
export type BuiltStep = 'takeoff' | 'review' | 'final'
export type EstStep = BuiltStep | (string & {})
export const EST_STEP: Record<BuiltStep, { label: string; short: string; tone: Tone }> = {
  takeoff: { label: 'Takeoff', short: 'Takeoff', tone: 'info' },
  review: { label: 'Office review', short: 'Office review', tone: 'vio' },
  final: { label: 'Final review', short: 'Final review', tone: 'warn' },
}
export const STEP_ORDER: BuiltStep[] = ['takeoff', 'review', 'final']
/** a review note, pinned to a room or a line; it goes back with "Send back" and gets checked off */
export interface EstNote { id: string; rev: number; by: PersonKey; step: EstStep | 'ai'; area?: string; lineId?: string; text: string; done?: boolean; date: string }
/** who does each step — and, once it's sent, who follows up with the client */
export interface EstTeam { takeoff: PersonKey; review: PersonKey; final: PersonKey; follow: PersonKey }
export const EST_TEAM0: EstTeam = { takeoff: 'takeoff', review: 'estimator', final: 'ys', follow: 'office' }
export const teamOf = (e: Estimate): EstTeam => ({ takeoff: e.team?.takeoff || (e.estimator && e.estimator !== 'estimator' ? e.estimator : 'takeoff'), review: e.team?.review || 'estimator', final: e.team?.final || 'ys', follow: e.team?.follow || 'office' })
/** where an estimate is: a request, one of the three inside steps, with the client, or done */
export type EstBucket = 'request' | EstStep | 'sent' | 'approved' | 'lost'
export const bucketOf = (e: Estimate): EstBucket => (e.status === 'estimating' || e.status === 'revision' ? e.step || 'takeoff' : e.status)
/** whose turn it is right now */
export const turnOf = (e: Estimate): PersonKey | null => {
  const b = bucketOf(e)
  return b === 'takeoff' || b === 'review' || b === 'final' ? teamOf(e)[b] : null
}
/** it's on a step inside the company (a standard one or the company's own) */
export const insideOf = (e: Estimate) => e.status === 'estimating' || e.status === 'revision'
/** who has it now: the person on the step — or, once it's with the client, the one who follows up */
export const holderOf = (e: Estimate): PersonKey | null => turnOf(e) || (bucketOf(e) === 'sent' ? teamOf(e).follow : bucketOf(e) === 'request' ? 'office' : null)
/** a room on the estimate: which floor, and the note the scope paper prints next to it ("9.25′ ceiling; fully tiled") */
export interface EstArea { name: string; floor?: string; note?: string }
export const openNotes = (e: Estimate) => (e.notes || []).filter((n) => n.rev === curRev(e).n && !n.done)
export interface EstRev { n: number; date: string; sentOn?: string; status: 'draft' | 'sent' | 'superseded' | 'approved'; what: string; lines: EstLine[]; /** who asked for it, and how */ asked?: string; /** who priced it */ by?: PersonKey; /** floors and notes for the rooms, in order */ areas?: EstArea[] }
export interface Estimate {
  id: string
  jobId: string
  status: EstStatus
  estimator: PersonKey | null
  due?: string
  followUp?: string
  approvedOn?: string
  revs: EstRev[]
  log: LogLine[]
  /** while it's being priced: whose step it's on, since when, and where "ready" goes after a send-back */
  step?: EstStep
  since?: string
  backTo?: EstStep
  team?: Partial<EstTeam>
  /** who does each step on this estimate when it isn't the company's (Settings → Who does what) — one or more people,
   *  the first leads; also the company's own steps */
  people?: Record<string, PersonKey[]>
  notes?: EstNote[]
}

export const curRev = (e: Estimate) => e.revs[e.revs.length - 1]
export const revTotal = (r?: EstRev) => (r ? r.lines.reduce((n, l) => n + l.qty * l.rate, 0) : 0)
export const estAmount = (e: Estimate) => {
  const r = curRev(e)
  /* while a revision is being priced, the number that counts is the last one sent */
  if (r?.status === 'draft' && e.status === 'revision') return revTotal([...e.revs].reverse().find((x) => x.status !== 'draft'))
  return revTotal(r)
}

let n = 0
const ln = (area: string, itemId: string, qty: number, rate: number, desc?: string): EstLine => ({ id: 'el' + ++n, area, itemId, qty, rate, desc })
const L = (date: string, who: PersonKey, text: string): LogLine => ({ date, who, text })

const MARK_R1 = [
  ln('3 baths', 'i-floor', 420, 24), ln('3 baths', 'i-wall', 820, 28), ln('3 baths', 'i-mosaic', 90, 45), ln('3 baths', 'i-wp', 360, 6),
  ln('Kitchen', 'i-splash', 160, 30),
  ln('Basement bath', 'i-floor', 110, 24), ln('Basement bath', 'i-wall', 200, 28), ln('Basement bath', 'i-wp', 90, 6),
  ln('All floors', 'i-prep', 530, 9), ln('All rooms', 'i-edge', 180, 12),
  ln('Setting materials', 'm-thinset', 90, 52), ln('Setting materials', 'm-membrane', 6, 410), ln('Setting materials', 'm-grout', 30, 48), ln('Setting materials', 'm-wp', 8, 240),
  ln('General', 'o-mob', 1, 2640),
]
/* Clyde St went back and forth four times — every revision kept, with why */
const CLYDE_R1 = [ln('Sales floor', 'i-large', 3400, 21), ln('Restrooms', 'i-floor', 260, 24), ln('Restrooms', 'i-wall', 360, 28), ln('Restrooms', 'i-wp', 260, 6), ln('Storefront entry', 'i-floor', 180, 24), ln('General', 'o-mob', 1, 2400)]
const CLYDE_R2 = [ln('Sales floor', 'i-large', 3400, 21), ln('Restrooms', 'i-floor', 260, 24), ln('Restrooms', 'i-wall', 360, 28), ln('General', 'o-mob', 1, 2400)]
const CLYDE_R3 = [ln('Sales floor', 'i-large', 3400, 19, 'Large format 24×48 porcelain'), ln('Restrooms', 'i-floor', 260, 24), ln('Restrooms', 'i-wall', 360, 28), ln('Storefront entry', 'i-floor', 180, 24), ln('General', 'o-mob', 1, 2400)]
const CLYDE_R4 = [ln('Sales floor', 'i-large', 3400, 19, 'Large format 24×48 porcelain'), ln('Restrooms', 'i-floor', 260, 24), ln('Restrooms', 'i-wall', 360, 28), ln('Storefront entry', 'i-floor', 180, 24), ln('General', 'o-mob', 1, 1160)]
const MARK_R2 = MARK_R1.filter((l) => l.area !== 'Basement bath').map((l) => (l.itemId === 'i-prep' ? { ...l, id: 'el' + ++n, qty: 420 } : { ...l, id: 'el' + ++n }))

export const PRICING_ESTIMATES: Estimate[] = [
  {
    id: 'E-1046', jobId: 'b1', status: 'request', estimator: null, due: 'Oct 7',
    revs: [{ n: 1, date: 'Sep 25', status: 'draft', what: 'Original scope', lines: [] }],
    log: [L('Sep 25', 'office', 'Price request received — plans in, spec book and finish schedule missing')],
  },
  {
    id: 'E-1047', jobId: 'b2', status: 'request', estimator: null, due: 'Oct 9',
    revs: [{ n: 1, date: 'Sep 28', status: 'draft', what: 'Original scope', lines: [] }],
    log: [L('Sep 28', 'office', 'Price request received — all documents in')],
  },
  {
    id: 'E-1044', jobId: 'b3', status: 'estimating', estimator: 'takeoff', due: 'Thu Oct 1', step: 'takeoff', since: 'Sep 16',
    revs: [{ n: 1, date: 'Sep 16', status: 'draft', what: 'Original scope', lines: [ln('Unit baths 1–8', 'i-floor', 960, 22), ln('Unit baths 1–8', 'i-wall', 1920, 26), ln('Lobby', 'i-large', 1150, 30)] }],
    log: [L('Sep 14', 'office', 'Price request received'), L('Sep 16', 'office', 'Takeoff started · Takeoff estimator'), L('Sep 24', 'takeoff', 'Asked the designer: same tile as Phase 1?')],
  },
  {
    id: 'E-1045', jobId: 'b4', status: 'estimating', estimator: 'takeoff', due: 'Oct 5', step: 'takeoff', since: 'Sep 24',
    revs: [{ n: 1, date: 'Sep 24', status: 'draft', what: 'Original scope', lines: [] }],
    log: [L('Sep 21', 'office', 'Price request received — finish schedule missing'), L('Sep 24', 'office', 'Takeoff started · Takeoff estimator')],
  },
  {
    id: 'E-1042', jobId: 'b5', status: 'sent', estimator: 'takeoff', followUp: 'Today',
    revs: [
      { n: 1, date: 'Aug 20', sentOn: 'Aug 21', status: 'superseded', what: 'Original scope', by: 'takeoff', lines: CLYDE_R1 },
      { n: 2, date: 'Aug 28', sentOn: 'Aug 31', status: 'superseded', what: 'Dropped the storefront entry and the restroom waterproofing', asked: 'The GC, by email', by: 'takeoff', lines: CLYDE_R2 },
      { n: 3, date: 'Sep 8', sentOn: 'Sep 9', status: 'superseded', what: 'Storefront entry back in; sales floor switched to 24×48', asked: 'The GC, on a call', by: 'takeoff', lines: CLYDE_R3 },
      { n: 4, date: 'Sep 17', sentOn: 'Sep 18', status: 'sent', what: 'Sharpened the number — one trip to mobilize instead of two', asked: 'The GC asked for a better price', by: 'ys', lines: CLYDE_R4 },
    ],
    log: [
      L('Aug 14', 'office', 'Price request received'), L('Aug 21', 'office', 'Revision 1 sent — $96,000'), L('Aug 27', 'office', 'GC: drop the storefront entry and the waterproofing'), L('Aug 31', 'office', 'Revision 2 sent — $90,120'),
      L('Sep 5', 'office', 'GC: entry back in, 24×48 on the sales floor'), L('Sep 9', 'office', 'Revision 3 sent — $87,640'), L('Sep 16', 'ys', 'GC asked for a better number'), L('Sep 18', 'office', 'Revision 4 sent — $86,400'),
      L('Sep 21', 'office', 'Called — still reviewing'), L('Sep 25', 'office', 'Emailed — no answer'),
    ],
  },
  {
    id: 'E-1040', jobId: 'b6', status: 'revision', estimator: 'takeoff', due: 'Sep 30', step: 'final', since: 'Sep 28',
    revs: [
      { n: 1, date: 'Sep 13', sentOn: 'Sep 14', status: 'superseded', what: 'Original scope', by: 'takeoff', lines: MARK_R1 },
      { n: 2, date: 'Sep 22', status: 'draft', what: 'Remove the basement bath', asked: 'The client, on a call with Yaakov', by: 'takeoff', lines: MARK_R2 },
    ],
    notes: [{ id: 'nt-b6-1', rev: 2, by: 'estimator', step: 'review', area: 'All floors', text: 'Floor prep still counts the basement — should be 420 SF', done: true, date: 'Sep 25' }],
    log: [
      L('Sep 5', 'office', 'Price request received'), L('Sep 14', 'office', 'Revision 1 sent — $72,900'), L('Sep 22', 'ys', 'Client asked for a revision: remove the basement bath'),
      L('Sep 24', 'takeoff', 'Revision 2 ready for review'), L('Sep 25', 'estimator', 'Sent back to Takeoff · 1 note'), L('Sep 25', 'takeoff', 'Fixed 1 note — ready for review'), L('Sep 28', 'estimator', 'Office review done — to Yaakov'),
    ],
  },
  {
    id: 'E-1039', jobId: 'b7', status: 'sent', estimator: 'takeoff', followUp: 'Fri Oct 2',
    revs: [{ n: 1, date: 'Sep 10', sentOn: 'Sep 11', status: 'sent', what: 'Original scope', lines: [ln('Two baths', 'i-floor', 240, 24), ln('Two baths', 'i-wall', 450, 28), ln('Two baths', 'i-mosaic', 60, 45), ln('Two baths', 'i-wp', 180, 6), ln('Pool deck', 'i-border', 240, 65), ln('General', 'o-mob', 1, 3460)] }],
    log: [L('Sep 1', 'office', 'Price request received'), L('Sep 11', 'ys', 'Revision 1 sent — $41,200'), L('Sep 16', 'ys', 'Emailed — no answer'), L('Sep 23', 'ys', 'Called — still reviewing')],
  },
]

const ln8 = (area: string, itemId: string, qty: number, rate: number, surface: string, tile?: string): EstLine => ({ ...ln(area, itemId, qty, rate), surface, tile })
PRICING_ESTIMATES.push({
  id: 'E-1048', jobId: 'b8', status: 'estimating', estimator: 'takeoff', due: 'Fri Oct 2', step: 'review', since: 'Sep 28',
  revs: [{
    n: 1, date: 'Sep 23', status: 'draft', what: 'Original scope',
    lines: [
      ln8('Primary bath', 'i-floor', 64, 24, 'Floor', 'T-07'), ln8('Primary bath', 'i-wall', 210, 28, 'Walls', 'T-06'), ln8('Primary bath', 'i-mosaic', 16, 45, 'Shower floor', 'T-02'), ln8('Primary bath', 'i-wp', 120, 6, 'Waterproofing'),
      ln8('Hall bath', 'i-floor', 42, 24, 'Floor', 'T-05'), ln8('Hall bath', 'i-wall', 180, 28, 'Tub walls', 'T-04'), ln8('Hall bath', 'i-wp', 90, 6, 'Waterproofing'),
      ln8('Powder room', 'i-floor', 24, 24, 'Floor', 'T-07'), ln8('Powder room', 'i-wall', 60, 28, 'Wainscot', 'T-06'),
      ln('All rooms', 'i-edge', 48, 12),
      ln('Setting materials', 'm-thinset', 14, 52), ln('Setting materials', 'm-grout', 6, 48), ln('Setting materials', 'm-wp', 3, 240),
      ln('General', 'o-mob', 1, 1500),
    ],
  }],
  log: [L('Sep 22', 'office', 'Price request received — all documents in'), L('Sep 23', 'office', 'Takeoff started · Takeoff estimator'), L('Sep 28', 'takeoff', 'Ready for review — to the Estimator')],
})

/* approved estimates behind the projects we already won: one line per room, sample amounts */
const APPROVED: Record<string, { id: string; on: string }> = {
  mill: { id: 'E-1001', on: 'May 5' }, '2385': { id: 'E-1004', on: 'May 20' }, '828': { id: 'E-1008', on: 'Jun 15' }, '830': { id: 'E-1011', on: 'Jun 30' },
  fire: { id: 'E-1013', on: 'Jul 8' }, '24c': { id: 'E-1016', on: 'Jul 22' }, '118': { id: 'E-1021', on: 'Aug 19' }, '119': { id: 'E-1023', on: 'Aug 31' },
  green: { id: 'E-1026', on: 'Sep 4' }, '530': { id: 'E-1028', on: 'Sep 8' }, mdrive: { id: 'E-1030', on: 'Sep 10' }, wilk: { id: 'E-1032', on: 'Sep 12' },
  '114': { id: 'E-1035', on: 'Sep 21' }, '115': { id: 'E-1037', on: 'Sep 23' },
}
export function approvedEstimates(contracts: Record<string, number>, rooms: Record<string, Room[]>): Estimate[] {
  return Object.entries(APPROVED).map(([jobId, a]) => {
    const total = contracts[jobId] || 0
    const rs = rooms[jobId] || []
    const weights = rs.length ? rs.map((r) => r.surfaces.reduce((m, x) => m + (x.sf || 40), 0)) : [1]
    const sum = weights.reduce((m, w) => m + w, 0)
    let left = total
    const lines = (rs.length ? rs.map((r) => r.name) : ['All areas']).map((area, i, arr) => {
      const amt = i === arr.length - 1 ? left : Math.round(((total * weights[i]) / sum) / 50) * 50
      left -= amt
      return ln(area, 'o-room', 1, amt, `${area} — tile installation per plans`)
    })
    return {
      id: a.id, jobId, status: 'approved' as EstStatus, estimator: 'estimator' as PersonKey, approvedOn: a.on,
      revs: [{ n: 1, date: a.on, sentOn: a.on, status: 'approved' as const, what: 'Original scope', lines }],
      log: [L(a.on, 'ys', 'Approved — became a project')],
    }
  })
}
