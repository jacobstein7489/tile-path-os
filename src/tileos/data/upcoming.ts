/* The game plan for every upcoming project — the same columns as Cobblestone's own sheet:
 * start / timing, next meeting, installer, installer confirmed, latest tile paperwork, PO made,
 * material ordered, deposit request, next step, notes. When a project starts it moves down to "In progress". */
import type { PersonKey } from './model'

export type YN = 'yes' | 'no' | 'na'
export interface Prep {
  /** when the client wants us to start (ISO), if they told us */
  targetISO?: string
  /** "Start / timing", the way it's said in the office */
  target?: string
  /** the next meeting on this project */
  meeting?: { text: string; day?: string; time?: string }
  /** who's installing it — 'tbd' until someone is picked */
  installer?: PersonKey | 'tbd'
  confirmed?: YN
  /** latest tile paperwork in hand? 'qty' = sent back to update the quantity */
  paperwork?: YN | 'qty'
  /** the installer PO */
  po?: YN
  material?: YN
  deposit?: YN
  nextStep?: string
  notes?: string
  /** set when the project starts and moves down to In progress */
  started?: string
  /** the finish tile on site (when there's no tile check to read it from) */
  tile?: 'yes' | 'part' | 'no'
  /** the walkthrough with the crew before the start */
  walk?: { state: 'todo' | 'set' | 'done'; when?: string; with?: string }
  /** our materials changed by hand: added, a different amount, taken off the list */
  mats?: MatEdits
  /** where the laser line was set for the floor heights — "40 inches up, on the hallway wall" */
  /** where the laser line was set for the floor levels, and how high off the floor (inches) */
  laser?: { where: string; date?: string; by?: string; at?: number }
}
export interface MatEdits { add?: { itemId: string; qty: number; note?: string }[]; qty?: Record<string, number>; off?: string[] }

export const PREP0: Record<string, Prep> = {
  green: { targetISO: '2026-09-28', target: 'Ready now', meeting: { text: 'TBD' }, tile: 'yes', installer: 'tbd', confirmed: 'no', paperwork: 'yes', po: 'no', material: 'yes', deposit: 'yes', nextStep: 'Pick the installer and send the PO', notes: 'Tile and setting materials on site' },
  mdrive: { targetISO: '2026-09-28', target: 'Ready now — floors', meeting: { text: 'Check heights on site', day: 'Wed', time: '9 AM' }, tile: 'part', installer: 'tbd', confirmed: 'no', paperwork: 'no', po: 'no', material: 'yes', deposit: 'yes', nextStep: 'Check the wall heights, then order the wall tile', notes: 'Floors can start; walls wait on the heights' },
  wilk: { targetISO: '2026-09-28', target: 'Ready now — hall bath', meeting: { text: 'Design meeting — to set up' }, tile: 'yes', installer: 'tbd', confirmed: 'no', paperwork: 'yes', po: 'no', material: 'yes', deposit: 'yes', nextStep: 'Set up the meeting with the designer', notes: 'Master bath waits on the designer; $6,380 of the deposit still open' },
  '530': { targetISO: '2026-10-05', target: 'Next week — Oct 5', meeting: { text: 'Job review', day: 'Today', time: '3 PM' }, tile: 'yes', installer: 'tbd', confirmed: 'no', paperwork: 'yes', po: 'no', material: 'no', deposit: 'yes', nextStep: 'Order Portland cement and sand', notes: 'Floors wait on the floor prep; deposit invoiced, not paid' },
  '114': { targetISO: '2026-10-19', target: 'Approx. 3 weeks — Oct 19', meeting: { text: 'Walkthrough with the GC super', day: 'Wed', time: '8 AM' }, installer: 'tbd', confirmed: 'no', paperwork: 'qty', po: 'no', material: 'yes', deposit: 'no', nextStep: 'Settle the tile quantity with the store', notes: 'GC’s date is Oct 19; their PO isn’t in yet' },
  '115': { target: 'TBD', meeting: { text: 'Kickoff with the owner’s rep', day: 'Tomorrow', time: '10 AM' }, tile: 'no', installer: 'tbd', confirmed: 'no', paperwork: 'no', po: 'no', material: 'no', deposit: 'no', nextStep: 'Build the rooms and surfaces from the paperwork', notes: '' },
  /* out for approval — the same rows, the way the sheet keeps them */
  b5: { target: 'Sent', meeting: { text: 'TBD' }, installer: 'tbd', confirmed: 'no', paperwork: 'na', po: 'na', material: 'no', deposit: 'no', nextStep: 'Verify whether the job is approved', notes: 'Revision 4 sent Sep 18 — may or may not move forward' },
  b7: { target: 'Sent', meeting: { text: 'TBD' }, installer: 'tbd', confirmed: 'no', paperwork: 'na', po: 'na', material: 'no', deposit: 'no', nextStep: 'Verify whether the job is approved', notes: 'Client still reviewing Revision 1' },
  /* already started */
  '119': { target: 'Started Sep 14', meeting: { text: 'TBD' }, installer: 'philip', confirmed: 'yes', paperwork: 'yes', po: 'yes', material: 'yes', deposit: 'yes', started: 'Sep 14', nextStep: 'Record the plumber’s answer on the drain', notes: 'Finish Oct 9' },
  '118': { target: 'Started Sep 8', meeting: { text: 'TBD' }, installer: 'leo', confirmed: 'yes', paperwork: 'yes', po: 'yes', material: 'yes', deposit: 'yes', started: 'Sep 8', nextStep: 'Get a firm ETA on the metal trim', notes: 'Finish Oct 16' },
}

/* notes on a project — like comments in Asana: who, when, what */
export interface Note { id: string; who: PersonKey; date: string; text: string }
export const NOTES0: Record<string, Note[]> = {
  '119': [
    { id: 'n119b', who: 'ys', date: 'Sep 25', text: 'The GC super asked us to keep the hallway clear on Thursdays — the plumber is in that day.' },
    { id: 'n119a', who: 'office', date: 'Sep 14', text: 'Park on the side street. The front is reserved for deliveries this month.' },
  ],
  '114': [{ id: 'n114a', who: 'ys', date: 'Sep 24', text: 'The super wants us to start in the master bath — the guest bath is still being used for storage.' }],
}
