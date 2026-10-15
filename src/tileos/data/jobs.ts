import type { Job, Customer, PersonKey, SwatchKey, Tone } from './model'
import { TODAY, dayLongFull } from '@/tileos/lib/today'
import { floorRank } from './areas'

/* Demo "today" is Monday, September 28 (2026). */
export const TODAY_LABEL = dayLongFull(TODAY)

export const JOBS0: Record<string, Job> = {
  /* ---------------- pricing ---------------- */
  b1: {
    id: 'b1', name: '26 Cambridge St', client: 'Cambridge Holdings', clientId: 'cambridge', address: '26 Cambridge St, Brooklyn NY',
    stage: 'request', status: 'warn', headline: 'Spec book and finish schedule missing',
    issues: [{ tone: 'warn', text: 'Spec book missing' }, { tone: 'warn', text: 'Finish schedule missing' }],
    next: { text: 'Follow up with the GC for the spec book', owner: 'office', due: 'Thu', dueTone: 'neutral' },
    keyDate: { label: 'Bid due', value: 'Oct 7' }, swatch: 'blueprint', building: 'townhouse', estimator: null,
    scope: 'Two bathrooms and a kitchen backsplash in an occupied townhouse',
  },
  b2: {
    id: 'b2', name: '115 Park lobby', client: '115 Park Ave Owner', clientId: 'p115', address: '115 Park Ave, Brooklyn NY',
    stage: 'request', status: 'info', headline: 'New today · needs an estimator',
    issues: [{ tone: 'info', text: 'New today · needs an estimator' }],
    next: { text: 'Assign an estimator', owner: 'office', due: 'Today', dueTone: 'warn' },
    keyDate: { label: 'Bid due', value: 'Oct 9' }, swatch: 'blueprint', building: 'lobby', estimator: null,
    scope: 'Lobby floor and elevator walls, about 1,400 SF',
  },
  b3: {
    id: 'b3', name: 'Green Tree Phase 2', client: 'Green Tree Development', clientId: 'greentree', address: 'County Line Rd, Lakewood NJ',
    stage: 'estimating', status: 'warn', headline: 'Takeoff 60% · tile question with the designer',
    issues: [{ tone: 'warn', text: 'Tile question with the designer since Sep 24' }],
    next: { text: 'Finish the estimate', owner: 'estimator', due: 'Thu', dueTone: 'warn' },
    keyDate: { label: 'Due', value: 'Thu Oct 1', tone: 'warn' }, swatch: 'blueprint', building: 'midrise', estimator: 'estimator',
    scope: '12 unit bathrooms and the lobby',
  },
  b4: {
    id: 'b4', name: 'Fire Circle Lot 7', client: 'Fire Circle Homes', clientId: 'firecircle', address: 'Fire Circle, Lot 7',
    stage: 'estimating', status: 'ok', headline: 'Takeoff not started',
    issues: [{ tone: 'warn', text: 'Finish schedule missing' }],
    next: { text: 'Start the takeoff', owner: 'estimator', due: 'Oct 5' },
    keyDate: { label: 'Due', value: 'Oct 5' }, swatch: 'blueprint', building: 'house', estimator: 'estimator',
    scope: 'Single-family home: 3 baths and the mudroom floor',
  },
  b5: {
    id: 'b5', name: 'Clyde St retail', client: '8-28 Clyde Development', clientId: 'clyde', address: 'Clyde St, Brooklyn NY',
    stage: 'followup', status: 'warn', headline: 'No answer since Sep 25',
    issues: [{ tone: 'warn', text: 'No answer since Sep 25' }],
    next: { text: 'Follow up on Revision 4', owner: 'office', due: 'Today', dueTone: 'warn' },
    keyDate: { label: 'Sent', value: 'Sep 18' }, swatch: 'blueprint', building: 'retail', estimator: 'estimator',
    scope: 'Retail floor, restrooms and the storefront entry',
  },
  b6: {
    id: 'b6', name: 'Mark Drive model unit', client: 'Mark Drive LLC', clientId: 'markdrive', address: 'Mark Drive, Model unit',
    stage: 'proposal', status: 'info', headline: 'Revision requested · remove the basement bath',
    issues: [{ tone: 'info', text: 'Revision 2 being priced' }],
    next: { text: 'Price Revision 2', owner: 'estimator', due: 'Wed', dueTone: 'neutral' },
    keyDate: { label: 'R2 due', value: 'Sep 30' }, swatch: 'blueprint', building: 'house', estimator: 'estimator',
    scope: 'Model unit: 3 baths, kitchen and the basement bath',
  },
  b7: {
    id: 'b7', name: 'Forest Circle pool house', client: 'Forest Circle LLC', clientId: 'forest', address: '2385 Forest Cir, Pool house',
    stage: 'followup', status: 'warn', headline: 'Still reviewing · called Sep 23',
    issues: [{ tone: 'warn', text: 'Client still reviewing' }],
    next: { text: 'Follow up on Revision 1', owner: 'ys', due: 'Fri', dueTone: 'neutral' },
    keyDate: { label: 'Sent', value: 'Sep 11' }, swatch: 'blueprint', building: 'estate', estimator: 'estimator',
    scope: 'Pool house: 2 baths and the pool deck border',
  },
  b8: {
    id: 'b8', name: 'Park Ave Residences 7A', client: 'Park Ave Residences', clientId: 'parkave', address: 'Park Ave Residences, Unit 7A, Brooklyn NY',
    stage: 'estimating', status: 'info', headline: 'Takeoff done · with the office for review',
    issues: [],
    next: { text: 'Office review', owner: 'estimator', due: 'Tomorrow', dueTone: 'neutral' },
    keyDate: { label: 'Bid due', value: 'Oct 2' }, swatch: 'blueprint', building: 'townhouse', estimator: 'takeoff',
    scope: 'Two baths and a powder room in a finished apartment',
  },

  /* ---------------- getting ready ---------------- */
  '114': {
    id: '114', name: '114 Park Place', client: 'Park Place Development', clientId: 'parkplace', address: '114 Park Place, Brooklyn NY',
    stage: 'setup', status: 'bad', headline: 'Wall tile 60 SF short of our takeoff',
    issues: [
      { tone: 'bad', text: 'Wall tile 60 SF short of our takeoff' },
      { tone: 'warn', text: 'Deposit not invoiced · 7 days' },
      { tone: 'warn', text: 'Client PO not received' },
      { tone: 'warn', text: 'Supplier has not confirmed PO-1045' },
    ],
    next: { text: 'Settle the tile quantity with the store', owner: 'office', due: 'Today', dueTone: 'warn' },
    keyDate: { label: 'Awarded', value: 'Sep 21' }, dates: { awarded: 'Sep 21' },
    swatch: 'subway', building: 'brownstone', pm: 'ys', site: 'ys', contract: 126800,
    stageDates: { won: 'Sep 21' },
  },
  '115': {
    id: '115', name: '115 Park', client: '115 Park Ave Owner', clientId: 'p115', address: '115 Park Ave, Brooklyn NY',
    stage: 'setup', status: 'bad', headline: 'Awarded 5 days ago · setup not started',
    issues: [{ tone: 'bad', text: 'Setup not started · 5 days' }, { tone: 'warn', text: 'Deposit not invoiced' }],
    next: { text: 'Build the rooms and surfaces', owner: 'office', due: '2 days late', dueTone: 'bad' },
    keyDate: { label: 'Awarded', value: 'Sep 23' }, dates: { awarded: 'Sep 23' },
    swatch: 'terrazzo', building: 'lobby', pm: 'ys', contract: 88400, stageDates: { won: 'Sep 23' },
  },
  '530': {
    id: '530', clientPO: 'MP-530-01', name: '530 Mark', client: 'Mark Properties', clientId: 'markprops', address: '530 Mark St, Brooklyn NY',
    stage: 'ready', status: 'bad', headline: 'Floor prep not ordered · start Oct 5',
    issues: [
      { tone: 'bad', text: 'Floor prep not ordered' },
      { tone: 'warn', text: 'Deposit invoiced Sep 15 · not paid' },
    ],
    next: { text: 'Order Portland cement and sand', owner: 'materials', due: 'Today', dueTone: 'bad' },
    keyDate: { label: 'Start planned', value: 'Oct 5', tone: 'bad' }, readiness: 'partial',
    swatch: 'herringbone', building: 'walkup', pm: 'ys', site: 'ys', contract: 54300,
    stageDates: { won: 'Sep 8', setup: 'Sep 12', verification: 'Sep 17', ready: 'Sep 22' },
  },
  green: {
    id: 'green', clientPO: 'GT-P1-044', name: 'Green Tree', client: 'Green Tree Development', clientId: 'greentree', address: 'County Line Rd, Lakewood NJ',
    stage: 'ready', status: 'ok', headline: 'Ready · materials on site · no crew yet',
    issues: [],
    next: { text: 'Assign a crew', owner: 'ys', due: 'This week' },
    keyDate: { label: 'Ready since', value: 'Sep 24', tone: 'ok' }, readiness: 'ready',
    swatch: 'zellige', building: 'midrise', pm: 'ys', site: 'ys', contract: 118000,
    stageDates: { won: 'Aug 28', setup: 'Sep 2', verification: 'Sep 15', ready: 'Sep 24' },
  },
  mdrive: {
    id: 'mdrive', clientPO: 'MD-2026-09', name: 'Mark Drive', client: 'Mark Drive LLC', clientId: 'markdrive', address: 'Mark Drive, Main house',
    stage: 'ready', status: 'warn', headline: 'Wall heights to check on site · floors released',
    issues: [{ tone: 'warn', text: 'Wall heights to check on site · floors released' }, { tone: 'warn', text: 'Wall tile not confirmed' }],
    next: { text: 'Check the wall heights on site', owner: 'ys', due: 'Wed' },
    keyDate: { label: 'Ready', value: 'Sep 25', tone: 'warn' }, readiness: 'partial',
    swatch: 'travertine', building: 'house', pm: 'ys', site: 'ys', contract: 47500,
    stageDates: { won: 'Sep 1', setup: 'Sep 8', verification: 'Sep 18', ready: 'Sep 25' },
  },
  wilk: {
    id: 'wilk', clientPO: 'WH-0912', name: 'Wilkinson', client: 'Wilkinson Homes', clientId: 'wilkinson', address: 'Wilkinson Residence',
    stage: 'ready', status: 'warn', headline: 'Master bath waiting on the designer',
    issues: [{ tone: 'warn', text: 'Master bath layout waiting on the designer' }, { tone: 'warn', text: 'Deposit partly paid' }],
    next: { text: 'Set up a meeting with the designer', owner: 'ys', due: 'Today', dueTone: 'warn' },
    keyDate: { label: 'Ready', value: 'Sep 23', tone: 'warn' }, readiness: 'partial',
    swatch: 'cement', building: 'house', pm: 'ys', site: 'ys', contract: 61900,
    stageDates: { won: 'Aug 30', setup: 'Sep 4', verification: 'Sep 16', ready: 'Sep 23' },
  },

  /* ---------------- installing ---------------- */
  '119': {
    id: '119', clientPO: 'PP-2231', name: '119 Park Place', client: 'Park Place Development', clientId: 'parkplace', address: '119 Park Place, Brooklyn NY',
    stage: 'installation', status: 'bad', headline: 'Master shower floor blocked on the drain',
    issues: [
      { tone: 'bad', text: 'Master shower floor blocked · waiting on the plumber' },
      { tone: 'warn', text: 'CO-004 waiting on GC approval' },
      { tone: 'warn', text: '2 brass profiles arrive tomorrow' },
      { tone: 'warn', text: 'T-03: enough to start, not to finish' },
    ],
    next: { text: 'Record the plumber’s answer', owner: 'ys', due: 'Tue', dueTone: 'neutral' },
    pct: 47, crew: 'philip', workers: 4, keyDate: { label: 'Finish', value: 'Oct 9' },
    dates: { start: 'Sep 14', finish: 'Oct 9', awarded: 'Aug 31' },
    swatch: 'toscana', building: 'brownstone', pm: 'ys', site: 'ys', contract: 184600,
    stageDates: { won: 'Aug 31', setup: 'Sep 3', verification: 'Sep 8', ready: 'Sep 9', scheduled: 'Sep 10', installation: 'Sep 14' },
  },
  '118': {
    id: '118', clientPO: 'PAR-0418', name: '118 Park', client: 'Park Ave Residences', clientId: 'parkave', address: '118 Park Ave, Brooklyn NY',
    stage: 'installation', status: 'bad', headline: 'Metal trim late from the supplier',
    issues: [{ tone: 'bad', text: 'Metal trim 7 days late · PO-1042' }, { tone: 'info', text: 'CO-001 approved · ready to bill' }],
    next: { text: 'Get a firm ETA on the trim', owner: 'materials', due: 'Today', dueTone: 'bad' },
    pct: 30, crew: 'leo', workers: 2, keyDate: { label: 'Finish', value: 'Oct 16' },
    dates: { start: 'Sep 8', finish: 'Oct 16', awarded: 'Aug 19' },
    swatch: 'calacatta', building: 'tower', pm: 'ys', site: 'ys', contract: 96300,
    stageDates: { won: 'Aug 19', setup: 'Aug 24', verification: 'Aug 31', ready: 'Sep 2', scheduled: 'Sep 3', installation: 'Sep 8' },
  },

  /* ---------------- closing out ---------------- */
  '828': {
    id: '828', clientPO: 'CD-828-07', name: '828 Clyde', client: '8-28 Clyde Development', clientId: 'clyde', address: '828 Clyde St, Brooklyn NY',
    stage: 'punch', status: 'bad', headline: 'Thinset three weeks late · return on hold',
    issues: [{ tone: 'bad', text: 'Thinset 23 days late · PO-1039' }, { tone: 'warn', text: '3 punch items open' }],
    next: { text: 'Decide: chase the thinset or reorder', owner: 'ys', due: 'Today', dueTone: 'bad' },
    pct: 92, crew: 'philip', keyDate: { label: 'Return', value: 'On hold', tone: 'bad' },
    swatch: 'blackhex', building: 'midrise', pm: 'ys', site: 'ys', contract: 142000,
    stageDates: { won: 'Jul 14', setup: 'Jul 18', verification: 'Jul 24', ready: 'Jul 27', scheduled: 'Jul 28', installation: 'Aug 3', punch: 'Sep 11' },
  },
  '2385': {
    id: '2385', clientPO: 'FC-1102', name: '2385 Forest Circle', client: 'Forest Circle LLC', clientId: 'forest', address: '2385 Forest Cir',
    stage: 'punch', status: 'warn', headline: 'Epoxy grout left in the ballroom',
    issues: [{ tone: 'warn', text: 'Epoxy grout left in the ballroom' }, { tone: 'warn', text: '2 pallets of field tile outstanding' }],
    next: { text: 'Finish the ballroom epoxy grout', owner: 'alex', due: 'Wed' },
    pct: 88, crew: 'alex', workers: 3, keyDate: { label: 'Punch done', value: 'Sep 30' },
    swatch: 'grigio', building: 'estate', pm: 'ys', site: 'ys', contract: 212500,
    stageDates: { won: 'Jun 30', setup: 'Jul 6', verification: 'Jul 12', ready: 'Jul 15', scheduled: 'Jul 16', installation: 'Jul 20', punch: 'Sep 21' },
  },
  '24c': {
    id: '24c', clientPO: 'CH-24-061', name: '24 Cambridge', client: 'Cambridge Holdings', clientId: 'cambridge', address: '24 Cambridge St, Brooklyn NY',
    stage: 'punch', status: 'warn', headline: '12 boxes of wall tile outstanding',
    issues: [{ tone: 'warn', text: '12 boxes of basement wall tile from the store' }],
    next: { text: 'Follow up with the tile store', owner: 'materials', due: 'Fri' },
    pct: 84, crew: 'walter', workers: 3, keyDate: { label: 'Punch done', value: 'Oct 2' },
    swatch: 'pearl', building: 'townhouse', pm: 'ys', site: 'ys', contract: 58900,
    stageDates: { won: 'Jul 22', setup: 'Jul 27', verification: 'Aug 3', ready: 'Aug 6', scheduled: 'Aug 7', installation: 'Aug 17', punch: 'Sep 18' },
    hold: { reason: 'Waiting for 12 boxes of T-06 wall tile', since: 'Sep 26', by: 'walter', shortage: 'SH-1' },
  },
  '830': {
    id: '830', clientPO: 'NW-3390', name: '830 Northwood', client: 'Northwood Apartments', clientId: 'northwood', address: '830 Northwood Ave',
    stage: 'punch', status: 'ok', headline: 'Touch-up list captured · return to schedule',
    issues: [{ tone: 'info', text: 'Return visit not booked' }],
    next: { text: 'Schedule the return visit', owner: 'ys', due: 'This week' },
    pct: 96, keyDate: { label: 'Return', value: 'Not booked' },
    swatch: 'sage', building: 'midrise', pm: 'ys', site: 'ys', contract: 73400,
    stageDates: { won: 'Jun 12', setup: 'Jun 16', verification: 'Jun 22', ready: 'Jun 24', scheduled: 'Jun 25', installation: 'Jul 6', punch: 'Sep 15' },
  },
  fire: {
    id: 'fire', clientPO: 'FCH-215', name: 'Fire Circle', client: 'Fire Circle Homes', clientId: 'firecircle', address: 'Fire Circle, Lot 4',
    stage: 'punch', status: 'ok', headline: 'Return visit · touch-ups, about a day',
    issues: [{ tone: 'info', text: 'Return visit not booked' }],
    next: { text: 'Schedule the return', owner: 'ys', due: 'This week' },
    pct: 98, keyDate: { label: 'Return', value: 'Not booked' },
    swatch: 'travertine', building: 'house', pm: 'ys', site: 'ys', contract: 38750,
    stageDates: { won: 'May 30', setup: 'Jun 3', verification: 'Jun 9', ready: 'Jun 11', scheduled: 'Jun 12', installation: 'Jun 22', punch: 'Aug 28' },
  },
  mill: {
    id: 'mill', clientPO: 'MG-77812', name: 'Millennium', client: 'Millennium Group', clientId: 'millennium', address: 'Millennium, Building B',
    stage: 'closeout', status: 'warn', headline: 'Final billing ready · retainage to release',
    issues: [{ tone: 'warn', text: 'Final invoice not sent' }],
    next: { text: 'Send the final invoice', owner: 'accounting', due: 'Today', dueTone: 'warn' },
    pct: 100, keyDate: { label: 'Punch verified', value: 'Sep 25', tone: 'ok' },
    swatch: 'slate', building: 'tower', pm: 'ys', site: 'ys', contract: 64200,
    stageDates: { won: 'May 18', setup: 'May 22', verification: 'May 28', ready: 'Jun 1', scheduled: 'Jun 2', installation: 'Jun 8', punch: 'Sep 2', closeout: 'Sep 25' },
  },
}

export const LOST0 = [
  { name: 'Bay Ridge co-op lobby', client: 'Bay Ridge Co-op Board', reason: 'Went with another installer', date: 'Sep 17' },
  { name: 'Oak St duplex', client: 'Oak Street Partners', reason: 'Project cancelled', date: 'Sep 9' },
]

/* ---------------- customers ---------------- */
const c = (name: string, role: string, slug: string, n: number) => ({
  name, role, phone: `(718) 555-01${String(n).padStart(2, '0')}`, email: `${role.toLowerCase().replace(/[^a-z]+/g, '.')}@${slug}.com`,
})
export const CUSTOMERS: Record<string, Customer> = {
  parkplace: { id: 'parkplace', name: 'Park Place Development', kind: 'General contractor', address: 'Brooklyn NY', phone: '(718) 555-0110', email: 'office@parkplacedev.com', notes: 'Pays progress bills monthly · cutoff on the 25th · 10% retainage.', contacts: [c('GC project manager', 'Project manager', 'parkplacedev', 11), c('Site superintendent', 'Superintendent', 'parkplacedev', 12), c('Accounts payable', 'Accounts payable', 'parkplacedev', 13)] },
  parkave: { id: 'parkave', name: 'Park Ave Residences', kind: 'Developer', address: 'Brooklyn NY', phone: '(718) 555-0120', email: 'info@parkaveres.com', notes: 'Owner’s rep approves all change orders in writing.', contacts: [c('Owner’s rep', 'Owner rep', 'parkaveres', 21), c('Designer', 'Designer', 'parkaveres', 22)] },
  clyde: { id: 'clyde', name: '8-28 Clyde Development', kind: 'Developer', address: 'Brooklyn NY', phone: '(718) 555-0130', email: 'pm@828clyde.com', notes: '', contacts: [c('Construction manager', 'Construction manager', '828clyde', 31)] },
  forest: { id: 'forest', name: 'Forest Circle LLC', kind: 'Owner', address: '2385 Forest Cir', phone: '(516) 555-0140', email: 'owner@forestcircle.com', notes: 'Prefers phone calls. Decisions go through the designer.', contacts: [c('Owner', 'Owner', 'forestcircle', 41), c('Designer', 'Designer', 'forestcircle', 42)] },
  cambridge: { id: 'cambridge', name: 'Cambridge Holdings', kind: 'General contractor', address: 'Brooklyn NY', phone: '(718) 555-0150', email: 'bids@cambridgeholdings.com', notes: '', contacts: [c('Estimating', 'Estimating', 'cambridgeholdings', 51), c('Project manager', 'Project manager', 'cambridgeholdings', 52)] },
  markprops: { id: 'markprops', name: 'Mark Properties', kind: 'Owner', address: 'Brooklyn NY', phone: '(718) 555-0160', email: 'office@markprops.com', notes: '', contacts: [c('Owner', 'Owner', 'markprops', 61)] },
  greentree: { id: 'greentree', name: 'Green Tree Development', kind: 'Developer', address: 'Lakewood NJ', phone: '(732) 555-0170', email: 'pm@greentreedev.com', notes: 'Phase 2 bid uses the Phase 1 finish schedule unless told otherwise.', contacts: [c('Project manager', 'Project manager', 'greentreedev', 71), c('Designer', 'Designer', 'greentreedev', 72)] },
  firecircle: { id: 'firecircle', name: 'Fire Circle Homes', kind: 'Builder', address: 'Fire Circle', phone: '(732) 555-0180', email: 'office@firecirclehomes.com', notes: '', contacts: [c('Builder', 'Builder', 'firecirclehomes', 81)] },
  millennium: { id: 'millennium', name: 'Millennium Group', kind: 'General contractor', address: 'Brooklyn NY', phone: '(718) 555-0190', email: 'ap@millenniumgroup.com', notes: 'Retainage released 30 days after final invoice.', contacts: [c('Accounts payable', 'Accounts payable', 'millenniumgroup', 91)] },
  markdrive: { id: 'markdrive', name: 'Mark Drive LLC', kind: 'Builder', address: 'Mark Drive', phone: '(732) 555-0105', email: 'office@markdrive.com', notes: '', contacts: [c('Builder', 'Builder', 'markdrive', 5)] },
  wilkinson: { id: 'wilkinson', name: 'Wilkinson Homes', kind: 'Owner', address: 'Wilkinson Residence', phone: '(516) 555-0106', email: 'home@wilkinson.com', notes: 'Designer answers take about a week.', contacts: [c('Homeowner', 'Homeowner', 'wilkinson', 6), c('Designer', 'Designer', 'wilkinson', 7)] },
  p115: { id: 'p115', name: '115 Park Ave Owner', kind: 'Owner', address: '115 Park Ave, Brooklyn NY', phone: '(718) 555-0108', email: 'owner@115parkave.com', notes: '', contacts: [c('Owner’s rep', 'Owner rep', '115parkave', 8)] },
  northwood: { id: 'northwood', name: 'Northwood Apartments', kind: 'Property manager', address: '830 Northwood Ave', phone: '(718) 555-0109', email: 'super@northwoodapts.com', notes: '', contacts: [c('Building super', 'Super', 'northwoodapts', 9)] },
}
/** the sample clients as written — the store keeps the live list (new clients, start fresh) and CUSTOMERS follows it */
export const CUSTOMERS0: Record<string, Customer> = JSON.parse(JSON.stringify(CUSTOMERS))

/* ---------------- pricing ---------------- */
export interface Revision { r: string; date: string; amount: number | null; status: 'Draft' | 'Pricing' | 'Sent' | 'Superseded' | 'Approved'; what: string }
export interface FollowUp { date: string; how: string; outcome: string; by: PersonKey; note?: string }
export interface Pricing {
  docs: { name: string; status: 'in' | 'missing'; note: string }[]
  estimator: PersonKey | null
  due: string
  scope: string
  contact: string
  takeoff?: { pct: number; areas: { name: string; sf: string; done: boolean }[]; question?: { text: string; waitingOn: string; since: string } }
  revs: Revision[]
  fu: FollowUp[]
  nextFollowUp?: string
}

export const PRICING0: Record<string, Pricing> = {
  b1: {
    docs: [
      { name: 'Plans', status: 'in', note: 'Revision A2 · Sep 25' },
      { name: 'Spec book', status: 'missing', note: 'Requested Sep 26 · follow up Thu' },
      { name: 'Finish schedule', status: 'missing', note: 'Requested Sep 26' },
    ],
    estimator: null, due: 'Oct 7', scope: 'Two bathrooms and a kitchen backsplash, occupied townhouse', contact: 'Estimating · Cambridge Holdings', revs: [], fu: [],
  },
  b2: {
    docs: [
      { name: 'Plans', status: 'in', note: 'Sep 28' },
      { name: 'Spec book', status: 'in', note: 'Sep 28' },
      { name: 'Finish schedule', status: 'in', note: 'Sep 28' },
    ],
    estimator: null, due: 'Oct 9', scope: 'Lobby floor and elevator walls, about 1,400 SF', contact: 'Owner’s rep · 115 Park Ave', revs: [], fu: [],
  },
  b3: {
    docs: [
      { name: 'Plans', status: 'in', note: 'Revision B1 · Sep 14' },
      { name: 'Spec book', status: 'in', note: 'Sep 14' },
      { name: 'Finish schedule', status: 'in', note: 'Sep 16' },
    ],
    estimator: 'estimator', due: 'Thu Oct 1', scope: '12 unit bathrooms and the lobby', contact: 'Project manager · Green Tree',
    takeoff: {
      pct: 60,
      areas: [
        { name: 'Unit baths 1–8', sf: '2,880 SF', done: true },
        { name: 'Unit baths 9–12', sf: '—', done: false },
        { name: 'Lobby floor', sf: '1,150 SF', done: true },
        { name: 'Lobby feature wall', sf: '—', done: false },
      ],
      question: { text: 'Same tile as Phase 1? It changes the tile allowance.', waitingOn: 'Designer', since: 'Sep 24' },
    },
    revs: [], fu: [],
  },
  b4: {
    docs: [
      { name: 'Plans', status: 'in', note: 'Sep 21' },
      { name: 'Spec book', status: 'in', note: 'Sep 21' },
      { name: 'Finish schedule', status: 'missing', note: 'Requested Sep 24' },
    ],
    estimator: 'estimator', due: 'Oct 5', scope: 'Single-family home: 3 baths and the mudroom floor', contact: 'Builder · Fire Circle Homes',
    takeoff: { pct: 0, areas: [{ name: 'Primary bath', sf: '—', done: false }, { name: 'Two hall baths', sf: '—', done: false }, { name: 'Mudroom floor', sf: '—', done: false }] },
    revs: [], fu: [],
  },
  b5: {
    docs: [
      { name: 'Plans', status: 'in', note: 'Revision C · Sep 4' },
      { name: 'Spec book', status: 'in', note: 'Sep 4' },
      { name: 'Finish schedule', status: 'in', note: 'Sep 8' },
    ],
    estimator: 'estimator', due: 'Sent Sep 18', scope: 'Retail floor, restrooms and the storefront entry', contact: 'Construction manager · 8-28 Clyde',
    takeoff: { pct: 100, areas: [{ name: 'Sales floor', sf: '3,400 SF', done: true }, { name: 'Restrooms', sf: '620 SF', done: true }, { name: 'Storefront entry', sf: '180 SF', done: true }] },
    revs: [{ r: 'R1', date: 'Aug 21', amount: 96000, status: 'Superseded', what: 'Original scope' }, { r: 'R2', date: 'Aug 31', amount: 90120, status: 'Superseded', what: 'Dropped the storefront entry and the waterproofing' }, { r: 'R3', date: 'Sep 9', amount: 87640, status: 'Superseded', what: 'Entry back in; 24×48 on the sales floor' }, { r: 'R4', date: 'Sep 18', amount: 86400, status: 'Sent', what: 'One trip to mobilize' }],
    fu: [
      { date: 'Sep 21', how: 'Called', outcome: 'Still reviewing', by: 'office' },
      { date: 'Sep 25', how: 'Emailed', outcome: 'No answer', by: 'office' },
    ],
    nextFollowUp: 'Today',
  },
  b6: {
    docs: [
      { name: 'Plans', status: 'in', note: 'Sep 5' },
      { name: 'Spec book', status: 'in', note: 'Sep 5' },
      { name: 'Finish schedule', status: 'in', note: 'Sep 7' },
    ],
    estimator: 'estimator', due: 'R2 due Sep 30', scope: 'Model unit: 3 baths, kitchen and the basement bath', contact: 'Builder · Mark Drive LLC',
    takeoff: { pct: 100, areas: [{ name: '3 baths', sf: '1,240 SF', done: true }, { name: 'Kitchen', sf: '160 SF', done: true }, { name: 'Basement bath', sf: '310 SF', done: true }] },
    revs: [
      { r: 'R1', date: 'Sep 14', amount: 72900, status: 'Superseded', what: 'Original scope' },
      { r: 'R2', date: '—', amount: null, status: 'Pricing', what: 'Remove the basement bath' },
    ],
    fu: [{ date: 'Sep 22', how: 'Spoke', outcome: 'Revision requested', by: 'ys', note: 'Remove the basement bath' }],
  },
  b7: {
    docs: [
      { name: 'Plans', status: 'in', note: 'Sep 1' },
      { name: 'Spec book', status: 'in', note: 'Sep 1' },
      { name: 'Finish schedule', status: 'in', note: 'Sep 3' },
    ],
    estimator: 'estimator', due: 'Sent Sep 11', scope: 'Pool house: 2 baths and the pool deck border', contact: 'Owner · Forest Circle LLC',
    takeoff: { pct: 100, areas: [{ name: 'Two baths', sf: '690 SF', done: true }, { name: 'Pool deck border', sf: '240 LF', done: true }] },
    revs: [{ r: 'R1', date: 'Sep 11', amount: 41200, status: 'Sent', what: 'Original scope' }],
    fu: [
      { date: 'Sep 16', how: 'Emailed', outcome: 'No answer', by: 'ys' },
      { date: 'Sep 23', how: 'Called', outcome: 'Still reviewing', by: 'ys' },
    ],
    nextFollowUp: 'Fri Oct 2',
  },
  b8: {
    docs: [
      { name: 'Plans', status: 'in', note: 'Sep 22' },
      { name: 'Spec book', status: 'in', note: 'Sep 22' },
      { name: 'Finish schedule', status: 'in', note: 'Sep 22' },
    ],
    estimator: 'takeoff', due: 'Oct 2', scope: 'Two baths and a powder room in a finished apartment', contact: 'Owner’s rep · Park Ave Residences',
    takeoff: { pct: 100, areas: [{ name: 'Primary bath', sf: '410 SF', done: true }, { name: 'Hall bath', sf: '312 SF', done: true }, { name: 'Powder room', sf: '84 SF', done: true }] },
    revs: [], fu: [],
  },
}

/* ---------------- finish records (tile) ---------------- */
export interface Tile {
  /** the tag on the designer's finish schedule — T-1, FT-2 — the same tag on every page, order and drawing */
  tag: string
  name: string
  size: string
  finish: string
  maker: string
  /** the store it comes from, and who orders it: the GC, us, or the owner */
  supplier: string
  suppliedBy: string
  sku: string
  /** the sample's drawn swatch — a real tile has a photo instead */
  swatch?: SwatchKey
  /** a picture someone added: a small JPEG, and its average color for the layout drawing */
  photo?: string
  color?: string
  /** the grout and joint it goes with — every wall and floor it's on starts with these */
  grout?: string
  joint?: string
  /** square feet in a box, when known — so orders can be counted in boxes */
  boxSF?: number
  note?: string
  /** how much the tile paperwork (the client's or the store's) has of it — checked against what we need */
  paper?: { qty: number; unit: 'SF' | 'boxes' }
}
/** a file kept with a project — the tile paperwork, plans, a photo. In the real app it's in the company's storage
 *  (`path`); the preview keeps it only while the page is open. */
export interface FileRec { id: string; jobId: string; name: string; size: number; type: string; kind: 'paperwork' | 'plans' | 'photo' | 'other'; path?: string; by: PersonKey; at: string; /** a small picture of a photo, kept with the record so lists load fast */ thumb?: string; /** what AI found when it read it */ read?: string }

/** the sample projects' tiles. A real project's tiles live with the project (the store's tiles, by project) */
export const TILES: Record<string, Tile> = {
  'T-01': { tag: 'T-01', name: 'Grigio', size: '24 × 24', finish: 'Honed', maker: 'Florim', supplier: 'Best Tile', suppliedBy: 'GC', sku: 'FLO-GR-2424-H', swatch: 'grigio' },
  'T-02': { tag: 'T-02', name: 'Hex mosaic 2″', size: '2″ hex', finish: 'Matte', maker: 'Daltile', supplier: 'Best Tile', suppliedBy: 'GC', sku: 'DAL-HX2-M', swatch: 'hex' },
  'T-03': { tag: 'T-03', name: 'Toscana Ivory', size: '24 × 48', finish: 'Matte', maker: 'Marca Corona', supplier: 'Best Tile', suppliedBy: 'GC', sku: 'MC-TI-2448-M', swatch: 'toscana' },
  'T-04': { tag: 'T-04', name: 'White subway', size: '3 × 12', finish: 'Gloss', maker: 'Daltile', supplier: 'Best Tile', suppliedBy: 'GC', sku: 'DAL-W312-G', swatch: 'subway' },
  'T-05': { tag: 'T-05', name: 'Bianco', size: '12 × 24', finish: 'Matte', maker: 'Florim', supplier: 'Best Tile', suppliedBy: 'GC', sku: 'FLO-BI-1224-M', swatch: 'bianco' },
  'T-06': { tag: 'T-06', name: 'Pearl', size: '3 × 12', finish: 'Gloss', maker: 'Daltile', supplier: 'Best Tile', suppliedBy: 'GC', sku: 'DAL-PR312-G', swatch: 'pearl' },
  'T-07': { tag: 'T-07', name: 'Calacatta', size: '24 × 24', finish: 'Polished', maker: 'Marca Corona', supplier: 'Best Tile', suppliedBy: 'GC', sku: 'MC-CA-2424-P', swatch: 'calacatta' },
}

/* each project's own tiles, by tag — kept in step with the store (like the clients), so any page can look one up */
export const JOB_TILES: Record<string, Record<string, Tile>> = {}
export const tileOf = (jobId?: string, tag?: string): Tile | undefined => (jobId && tag ? JOB_TILES[jobId]?.[tag] : undefined)
export const byTag = (a: Tile, b: Tile) => a.tag.localeCompare(b.tag, undefined, { numeric: true })
export const tilesOf = (jobId?: string): Tile[] => Object.values((jobId && JOB_TILES[jobId]) || {}).sort(byTag)
/** a short line for a tile: "T-03 Toscana Ivory · 24 × 48" */
export const tileLine = (t?: Tile) => (t ? `${t.tag} ${t.name}${t.size ? ` · ${t.size}` : ''}` : '')

/* grout colors — the common ones; a project can add its own (Settings keeps them) */
export type Grout = { name: string; color: string; product?: string }
export const GROUTS: Record<string, Grout> = {
  white: { name: 'Bright White', color: '#F3F3F0' },
  frost: { name: 'Frost', color: '#ECEDEA' },
  antique: { name: 'Antique White', color: '#ECE5D5' },
  bone: { name: 'Bone', color: '#E2D9C8' },
  oyster: { name: 'Oyster Gray', color: '#D8D1C4' },
  sand: { name: 'Sand', color: '#D6C3A2' },
  silver: { name: 'Silverado', color: '#C6C9CC' },
  warmgray: { name: 'Warm Gray', color: '#B8B0A3' },
  platinum: { name: 'Platinum', color: '#B4B6B4' },
  pewter: { name: 'Pewter', color: '#8D8D88' },
  mocha: { name: 'Mocha', color: '#7A6654' },
  charcoal: { name: 'Charcoal', color: '#4A4C4F' },
  black: { name: 'Black', color: '#242526' },
}
export const JOINTS = ['1/32″', '1/16″', '1/8″', '3/16″', '1/4″', '3/8″']

/* ---------------- rooms & surfaces ---------------- */
export type SurfState = 'done' | 'working' | 'ready' | 'blocked' | 'waitmat' | 'hold' | 'notstarted' | 'unknown'
export interface Surface {
  name: string
  tile: string
  /** the estimate item it was sold as — what the installer's PO pays for it */
  itemId?: string
  state: SurfState
  reason?: string
  layout?: string
  /** measured size in inches, for the layout drawing */
  dims?: { w: number; h: number }
  grout?: string
  joint?: string
  edge?: string
  height?: string
  /** the height measured on site at the site check, in inches — and what the estimate had */
  measured?: { inches: number; date: string; was?: number }
  prep?: string
  /** how it's set — a key from METHODS; empty means the system suggests one */
  method?: string
  notes?: string
  decided?: string[]
  /** planned square feet — what the crew is measured against */
  sf?: number
  /** how far along, 0–100 (done = 100) */
  pct?: number
  /** a change asked on site that is waiting for approval */
  pending?: { co: string; label: string; from: string; to: string }
}
export interface Room { name: string; pct: number; surfaces: Surface[]; floor?: string; note?: string }
/** rooms grouped by floor, in the same order as the estimate: 1st, 2nd, 3rd, attic, basement */
const FLOOR_ORDER = (f: string) => (f === 'Rooms' ? 99 : floorRank(f))
export function floorsOf(rooms: Room[]) {
  const groups: { floor: string; rooms: Room[] }[] = []
  rooms.forEach((r) => {
    const f = r.floor || 'Rooms'
    const g = groups.find((x) => x.floor === f)
    if (g) g.rooms.push(r)
    else groups.push({ floor: f, rooms: [r] })
  })
  return groups.sort((a, b) => FLOOR_ORDER(a.floor) - FLOOR_ORDER(b.floor))
}

/* ---------- progress, always computed from the surfaces ---------- */
export const surfacePct = (x: Surface) => (x.state === 'done' ? 100 : Math.max(0, Math.min(100, x.pct || 0)))
export function roomPct(r: Room) {
  const w = r.surfaces.reduce((n, x) => n + (x.sf || 10), 0)
  if (!w) return 0
  return Math.round((r.surfaces.reduce((n, x) => n + ((x.sf || 10) * surfacePct(x)) / 100, 0) / w) * 100)
}
export function jobPct(rooms: Room[]) {
  const w = rooms.reduce((n, r) => n + r.surfaces.reduce((m, x) => m + (x.sf || 10), 0), 0)
  if (!w) return 0
  return Math.round((rooms.reduce((n, r) => n + r.surfaces.reduce((m, x) => m + ((x.sf || 10) * surfacePct(x)) / 100, 0), 0) / w) * 100)
}
export const hasSF = (rooms: Room[] = []) => rooms.some((r) => r.surfaces.some((x) => x.sf))

export const SURF_LABEL: Record<SurfState, string> = {
  done: 'Complete', working: 'Crew working', ready: 'Ready to start', blocked: 'Blocked', waitmat: 'Waiting material',
  hold: 'Hold · change pending', notstarted: 'Later in sequence', unknown: 'To verify on site',
}
export const SURF_TONE: Record<SurfState, Tone> = {
  done: 'ok', working: 'info', ready: 'ok', blocked: 'bad', waitmat: 'warn', hold: 'warn', notstarted: 'neutral', unknown: 'warn',
}

const S = (name: string, tile: string, state: SurfState, spec: Partial<Surface> = {}): Surface => ({ name, tile, state, ...spec })

export const ROOMS: Record<string, Room[]> = {
  '119': [
    {
      name: 'Master Bath', floor: '2nd floor', note: '9.25′ ceiling; fully tiled', pct: 20, surfaces: [
        S('Main floor', 'T-01', 'ready', { sf: 64, layout: 'Straight lay · full tile at the door', grout: 'warmgray', joint: '1/8″', edge: 'Flush to hallway wood', prep: 'Uncoupling membrane', decided: ['Full tile at the door — designer, Sep 8'] }),
        S('Shower floor', 'T-02', 'blocked', { sf: 16, reason: 'Drain sequence not confirmed · waiting on the plumber', layout: 'Pitched to the center drain', grout: 'warmgray', joint: '1/16″', prep: 'Mud bed', notes: 'Do not start until the plumber confirms whether this is the final drain.' }),
        S('Shower wall A', 'T-03', 'working', { sf: 48, pct: 80, layout: 'Vertical stack · full tile at the doorway', grout: 'oyster', joint: '1/16″', edge: 'Schluter JOLLY · satin brass · 10 mm', height: 'To the ceiling', prep: 'Waterproofing membrane', decided: ['Vertical stack — designer, Sep 8', 'Full tile at the doorway — designer, Sep 8'] }),
        S('Shower wall B', 'T-03', 'working', { sf: 48, pct: 40, layout: 'Niche centered on the wall', grout: 'oyster', joint: '1/16″', edge: 'Schluter JOLLY · satin brass · 10 mm', height: 'To the ceiling', prep: 'Waterproofing membrane' }),
        S('Shower wall C', 'T-03', 'ready', { sf: 40, layout: 'Vertical stack', grout: 'oyster', joint: '1/16″', edge: 'Schluter JOLLY · satin brass · 10 mm', height: 'To the ceiling', prep: 'Waterproofing membrane' }),
        S('Niche', 'T-03', 'ready', { sf: 6, layout: 'Field tile · mitered edges', grout: 'oyster', joint: '1/16″', edge: 'Mitered', notes: 'Opening 12 × 24, centered on wall B', decided: ['Mitered, field tile — designer, Sep 8'] }),
        S('Curb', 'T-01', 'ready', { sf: 4, layout: 'Slab-cut from field tile', edge: 'Eased edge', grout: 'warmgray', joint: '1/16″' }),
        S('Tub walls', 'T-03', 'ready', { sf: 60, layout: 'Centered on the tub', grout: 'oyster', joint: '1/16″', height: '84″ · metal edge on top', edge: 'Schluter JOLLY · satin brass · 10 mm', prep: 'Cement board, taped', notes: '6 boxes of T-03 still outstanding — enough to start, not to finish.' }),
      ],
    },
    {
      name: 'Guest Bath', floor: '2nd floor', note: '9.25′ ceiling; fully tiled', pct: 70, surfaces: [
        S('Floor', 'T-05', 'done', { sf: 40, layout: 'Offset 1/3 · long side to the door', grout: 'silver', joint: '1/8″', edge: 'Marble saddle at the door' }),
        S('Shower walls', 'T-04', 'working', { sf: 96, pct: 55, layout: 'Offset 1/2 · start from the top', grout: 'white', joint: '1/16″', edge: 'Schluter JOLLY · satin brass · 10 mm', height: 'To the ceiling', prep: 'Waterproofing membrane' }),
        S('Shower floor', 'T-02', 'done', { sf: 12, layout: 'Pitched to the drain', grout: 'warmgray', joint: '1/16″', prep: 'Mud bed' }),
        S('Niche', 'T-04', 'working', { sf: 6, pct: 50, layout: 'Mitered edges', edge: 'Mitered', notes: 'Opening 12 × 12, centered' }),
        S('Curb', 'T-05', 'done', { sf: 4, layout: 'Cut from field tile', edge: 'Eased edge' }),
      ],
    },
    {
      name: 'Powder Room', floor: '1st floor', note: '10.25′ ceiling', pct: 0, surfaces: [
        S('Floor', 'T-07', 'ready', { sf: 16, layout: 'Centered on the vanity', grout: 'white', joint: '1/16″', prep: 'Self-leveler where needed' }),
        S('Accent wall', 'T-07', 'ready', { sf: 24, layout: 'Centered on the mirror', height: '48″ · metal edge on top', edge: 'Schluter JOLLY · satin brass · 10 mm', grout: 'white', joint: '1/16″', decided: ['48″ height — CO-003 approved Sep 12'] }),
      ],
    },
    {
      name: 'Girls Bath', floor: '2nd floor', note: '9.25′ ceiling', pct: 80, surfaces: [
        S('Floor', 'T-05', 'done', { sf: 45, layout: 'Offset 1/3 · long side to the tub', grout: 'silver', joint: '1/8″' }),
        S('Main walls', 'T-06', 'done', { sf: 60, layout: 'Offset 1/2 horizontal', height: '3 ft · metal edge on top', grout: 'white', joint: '1/16″' }),
        S('Shower walls', 'T-06', 'working', { sf: 80, pct: 60, layout: 'Offset 1/2 · start from the top', height: 'To the ceiling', prep: 'Waterproofing membrane', grout: 'white', joint: '1/16″' }),
        S('Outside corners', 'T-06', 'waitmat', { sf: 6, reason: '2 of 6 brass profiles arrive tomorrow', edge: 'Schluter JOLLY · satin brass · 10 mm', notes: '6 corners, 8 ft pieces. 4 on site.' }),
      ],
    },
    {
      name: 'Boys Bath', floor: '2nd floor', note: '9.25′ ceiling', pct: 60, surfaces: [
        S('Floor', 'T-05', 'done', { sf: 40, layout: 'Offset 1/3 · long side to the door', grout: 'silver', joint: '1/8″' }),
        S('Main walls', 'T-06', 'hold', { sf: 54, pct: 100, pending: { co: 'CO-004', label: 'Height', from: '3 ft', to: 'Full height' }, reason: 'Done to 3 ft · hold above until CO-004 is approved', layout: 'Offset 1/2 horizontal', height: 'Approved: 3 ft · Requested: full height (CO-004)', edge: 'Schluter JOLLY · satin brass · 10 mm', grout: 'white', joint: '1/16″' }),
        S('Shower walls', 'T-06', 'working', { sf: 80, pct: 20, layout: 'Offset 1/2 · start from the top', height: 'To the ceiling', grout: 'white', joint: '1/16″' }),
      ],
    },
    {
      name: 'Kitchen', floor: '1st floor', pct: 100, surfaces: [
        S('Backsplash', 'T-07', 'done', { sf: 30, layout: 'Centered on the range', height: '18″ to the cabinets', grout: 'white', joint: '1/16″' }),
        S('Range wall', 'T-07', 'done', { sf: 24, layout: 'Full tile at the hood', grout: 'white', joint: '1/16″' }),
      ],
    },
    { name: 'Foyer', floor: '1st floor', pct: 0, surfaces: [S('Floor', 'T-01', 'notstarted', { sf: 40, layout: 'Centered on the front door', edge: 'Saddle at the door', grout: 'warmgray', joint: '1/8″' }), S('Base', 'T-01', 'notstarted', { sf: 10, layout: 'Cut from field tile', height: '4″ · bullnose top' })] },
    { name: 'Laundry', floor: '2nd floor', pct: 0, surfaces: [S('Floor', 'T-05', 'notstarted', { sf: 24, layout: 'Offset 1/3', prep: 'Self-leveler' }), S('Walls', 'T-04', 'notstarted', { sf: 12, layout: 'Offset 1/2', height: '18″ above the counter' })] },
    { name: 'Fireplace', floor: '1st floor', note: 'Added in Revision 2', pct: 0, surfaces: [S('Wall 1', 'T-07', 'notstarted', { sf: 20, layout: 'Centered on the firebox', height: 'To the mantel', notes: 'Added in Revision 2' }), S('Wall 2', 'T-07', 'notstarted', { sf: 20, layout: 'Centered on the firebox', height: 'To the mantel', notes: 'Added in Revision 2' }), S('Hearth', 'T-07', 'notstarted', { sf: 6, layout: 'Slab-cut', edge: 'Eased edge' })] },
  ],
  '118': [
    { name: 'Kitchen', pct: 60, surfaces: [S('Floor', 'T-07', 'done', { layout: 'Straight lay · grid 1/8″', grout: 'white', joint: '1/8″', edge: 'Flush · no transition' }), S('Wall A – Range', 'T-07', 'done', { layout: 'Centered on the range', grout: 'white' }), S('Wall B – Sink', 'T-07', 'working', { sf: 40, pct: 40, layout: 'Centered on the window', grout: 'white' }), S('Sink splash', 'T-07', 'notstarted', { notes: 'Layout pending final appliance specs.' }), S('Pantry floor', 'T-07', 'done', {})] },
    { name: 'Master Bath', pct: 80, surfaces: [S('Floor', 'T-07', 'done', {}), S('Shower floor', 'T-02', 'done', {}), S('Shower walls', 'T-07', 'done', {}), S('Vanity wall', 'T-07', 'done', { sf: 36 }), S('Outside corners', 'T-07', 'waitmat', { reason: 'Satin nickel trim 7 days late', edge: 'Metal trim · satin nickel · 1/4″' })] },
    { name: 'Hall Bath', pct: 50, surfaces: [S('Floor', 'T-05', 'done', {}), S('Tub walls', 'T-04', 'working', { sf: 90, pct: 50 }), S('Niche', 'T-04', 'waitmat', { reason: 'Satin nickel trim 7 days late' }), S('Edges', 'T-04', 'waitmat', { reason: 'Satin nickel trim 7 days late' })] },
    { name: 'Powder Room', pct: 33, surfaces: [S('Floor', 'T-07', 'done', {}), S('Wainscot', 'T-07', 'ready', {}), S('Cap', 'T-07', 'waitmat', { reason: 'Satin nickel trim 7 days late' })] },
    { name: 'Laundry', pct: 0, surfaces: [S('Floor', 'T-05', 'ready', {}), S('Walls', 'T-04', 'ready', {})] },
    { name: 'Entry', pct: 0, surfaces: [S('Floor', 'T-07', 'notstarted', {}), S('Base', 'T-07', 'notstarted', {})] },
  ],
  '114': [
    { name: 'Master Bath', pct: 0, surfaces: [S('Floor', 'T-05', 'ready', { sf: 95, layout: 'Offset 1/3', grout: 'silver', prep: 'Uncoupling membrane' }), S('Walls', 'T-04', 'unknown', { sf: 300, reason: 'Store ordered 500 SF · we need 560 SF with waste', layout: 'Offset 1/2 · to be confirmed on site' })] },
    { name: 'Guest Bath', pct: 0, surfaces: [S('Floor', 'T-05', 'ready', { sf: 80, layout: 'Offset 1/3', prep: 'Uncoupling membrane' }), S('Shower walls', 'T-04', 'unknown', { sf: 200, reason: 'Niche size to verify on site' })] },
  ],
  '530': [
    { name: 'Kitchen', pct: 0, surfaces: [S('Walls', 'T-04', 'ready', { sf: 90 }), S('Floor', 'T-05', 'blocked', { sf: 180, reason: 'Floor prep (Portland + sand) not ordered', prep: 'Mud bed' })] },
    { name: 'Bath', pct: 0, surfaces: [S('Walls', 'T-04', 'ready', { sf: 130, prep: 'Cement board + waterproofing' }), S('Floor', 'T-05', 'blocked', { sf: 60, reason: 'Floor prep not ordered', prep: 'Mud bed' })] },
    { name: 'Hallway', pct: 0, surfaces: [S('Floor', 'T-05', 'blocked', { sf: 170, reason: 'Floor prep not ordered', prep: 'Mud bed' })] },
  ],
  green: [
    { name: 'Lobby', pct: 0, surfaces: [S('Floor', 'T-05', 'ready', { sf: 820 }), S('Feature wall', 'T-07', 'ready', { sf: 60 })] },
    { name: 'Unit 1A bath', pct: 0, surfaces: [S('Floor', 'T-05', 'ready', { sf: 60 }), S('Tub walls', 'T-04', 'ready', { sf: 260 })] },
    { name: 'Unit 1B bath', pct: 0, surfaces: [S('Floor', 'T-05', 'ready', { sf: 60 }), S('Tub walls', 'T-04', 'ready', { sf: 260 })] },
  ],
  mdrive: [
    { name: 'Main floor', pct: 0, surfaces: [S('Floor', 'T-05', 'ready', { sf: 250 })] },
    { name: 'Kitchen', pct: 0, surfaces: [S('Backsplash', 'T-04', 'unknown', { sf: 35, reason: 'Wall tile not confirmed' })] },
    { name: 'Primary bath', pct: 0, surfaces: [S('Floor', 'T-05', 'ready', { sf: 60 }), S('Shower walls', 'T-04', 'unknown', { sf: 150, reason: 'Wall tile not confirmed' })] },
  ],
  wilk: [
    { name: 'Hall bath', pct: 0, surfaces: [S('Floor', 'T-05', 'ready', { sf: 45 }), S('Tub walls', 'T-04', 'ready', { sf: 110 })] },
    { name: 'Laundry', pct: 0, surfaces: [S('Floor', 'T-05', 'ready', { sf: 105 })] },
    { name: 'Master bath', pct: 0, surfaces: [S('Floor', 'T-07', 'blocked', { sf: 70, reason: 'Layout waiting on the designer' }), S('Shower walls', 'T-07', 'blocked', { sf: 180, reason: 'Layout waiting on the designer' })] },
  ],
  '828': [
    { name: 'Lobby', pct: 95, surfaces: [S('Floor', 'T-01', 'done', {}), S('Elevator walls', 'T-07', 'done', {}), S('Floor repairs', 'T-01', 'waitmat', { reason: 'Thinset 23 days late' })] },
    { name: 'Front entrance', pct: 85, surfaces: [S('Steps', 'T-01', 'done', {}), S('Landing', 'T-01', 'waitmat', { reason: 'Thinset 23 days late' })] },
  ],
  '2385': [
    { name: 'Ballroom', pct: 80, surfaces: [S('Field tile', 'T-01', 'done', {}), S('Border', 'T-07', 'done', { sf: 240 }), S('Epoxy grout', 'T-01', 'working', { reason: 'Epoxy grout left', pct: 70 })] },
    { name: 'Powder rooms', pct: 100, surfaces: [S('Floors', 'T-07', 'done', {}), S('Walls', 'T-07', 'done', {})] },
  ],
  '24c': [
    { name: 'Basement bath', pct: 60, surfaces: [S('Floor', 'T-05', 'done', { sf: 60 }), S('Walls', 'T-06', 'waitmat', { sf: 180, reason: '12 boxes outstanding from the store' })] },
    { name: 'Primary bath', pct: 100, surfaces: [S('Floor', 'T-05', 'done', { sf: 70 }), S('Shower', 'T-06', 'done', { sf: 220 })] },
  ],
  '830': [{ name: 'Lobby', pct: 100, surfaces: [S('Floor', 'T-05', 'done', {}), S('Touch-ups', 'T-05', 'ready', { notes: 'Captured on the punch walk' })] }],
  fire: [{ name: 'Primary bath', pct: 100, surfaces: [S('Floor', 'T-05', 'done', {}), S('Touch-ups', 'T-05', 'ready', {})] }],
  mill: [{ name: 'Corridors', pct: 100, surfaces: [S('Floor', 'T-05', 'done', {}), S('Grout repair', 'T-05', 'done', {})] }],
}

/* ---------------- history ---------------- */
export type HistKind = 'field' | 'change' | 'question' | 'material' | 'money' | 'schedule' | 'decision' | 'setup' | 'pricing' | 'system'
export interface HistEntry { date: string; who: PersonKey; kind: HistKind; title: string; detail?: string; from?: string; to?: string; ref?: { t: string; [k: string]: any } }

export const HISTORY0: Record<string, HistEntry[]> = {
  '119': [
    { date: 'Sep 26', who: 'philip', kind: 'field', title: 'Daily update · guest bath walls at 70%', detail: 'Niche started. Monday: guest bath walls and the powder floor. 3 photos.' },
    { date: 'Sep 25', who: 'materials', kind: 'material', title: 'Received 4 of 6 brass JOLLY profiles', detail: '2 outstanding · Metal Works Inc. says tomorrow', from: '0 of 6', to: '4 of 6' },
    { date: 'Sep 25', who: 'accounting', kind: 'money', title: 'Progress bill #1 sent to the GC', detail: 'Work through Sep 25 · 10% retainage held' },
    { date: 'Sep 24', who: 'ys', kind: 'change', title: 'CO-004 priced and sent to the GC', detail: 'Client asked for full-height walls in the boys bath. The crew holds at 3 ft.', from: '3 ft', to: 'Full height' },
    { date: 'Sep 22', who: 'ys', kind: 'question', title: 'Technical question · master shower drain', detail: 'Is this the final drain, and does the trim go before or after tile? Waiting on the plumber.' },
    { date: 'Sep 14', who: 'philip', kind: 'field', title: 'Installation started · guest bath first', detail: 'Philip and 4 workers' },
    { date: 'Sep 12', who: 'system', kind: 'system', title: 'Pre-start checks cleared by all four roles' },
    { date: 'Sep 12', who: 'materials', kind: 'material', title: 'Received 14 of 20 boxes of T-03', detail: 'Enough to start, not enough to finish', from: '0', to: '14 of 20' },
    { date: 'Sep 12', who: 'ys', kind: 'change', title: 'CO-003 approved · powder accent wall to 48″', from: '36″', to: '48″' },
    { date: 'Sep 10', who: 'ys', kind: 'schedule', title: 'Scheduled · Philip, 4 workers, Sep 14 – Oct 9' },
    { date: 'Sep 9', who: 'system', kind: 'system', title: 'Review for scheduling · can start with restrictions', detail: 'Hold: master shower floor' },
    { date: 'Sep 8', who: 'ys', kind: 'decision', title: 'Design meeting settled 12 details', detail: 'Saved to their surfaces: layouts, edges, niche, tub height' },
    { date: 'Sep 4', who: 'accounting', kind: 'money', title: 'Deposit received · 20% · invoice #1021' },
    { date: 'Sep 3', who: 'office', kind: 'setup', title: 'Setup approved · 9 rooms, 31 surfaces, 7 finish records' },
    { date: 'Aug 31', who: 'system', kind: 'pricing', title: 'Awarded on Revision 2', detail: 'Deposit, setup, materials and scheduling notified' },
    { date: 'Aug 26', who: 'office', kind: 'pricing', title: 'Revision 2 sent', detail: 'Basement bath removed, two fireplace walls added', from: 'R1', to: 'R2' },
    { date: 'Aug 20', who: 'office', kind: 'pricing', title: 'Revision 1 sent' },
    { date: 'Aug 11', who: 'office', kind: 'pricing', title: 'Price request received from the GC' },
  ],
  '114': [
    { date: 'Sep 26', who: 'materials', kind: 'material', title: 'PO-1045 sent to Infinity · setting materials', detail: 'Waiting for the supplier to confirm' },
    { date: 'Sep 25', who: 'office', kind: 'material', title: 'Tile store paperwork entered', detail: 'Best Tile order · wall tile 500 SF, floor 200 SF' },
    { date: 'Sep 25', who: 'system', kind: 'material', title: 'Quantity check: wall tile 60 SF short', detail: 'Our takeoff with waste: 560 SF · ordered 500 SF', from: '560 SF needed', to: '500 SF ordered' },
    { date: 'Sep 23', who: 'office', kind: 'setup', title: 'Rooms built · 2 rooms, 4 surfaces' },
    { date: 'Sep 21', who: 'office', kind: 'setup', title: 'Client PO requested from the GC' },
    { date: 'Sep 21', who: 'system', kind: 'pricing', title: 'Awarded on Revision 1', detail: 'Deposit, setup, materials and scheduling notified' },
  ],
}

export function historyFor(id: string, job: Job): HistEntry[] {
  if (HISTORY0[id]) return HISTORY0[id]
  const out: HistEntry[] = []
  const d = job.stageDates || {}
  if (d.punch) out.push({ date: d.punch, who: 'ys', kind: 'field', title: 'Punch walk done · list captured' })
  if (d.installation) out.push({ date: d.installation, who: job.crew || 'ys', kind: 'field', title: 'Installation started' })
  if (d.scheduled) out.push({ date: d.scheduled, who: 'ys', kind: 'schedule', title: 'Crew scheduled' })
  if (d.ready) out.push({ date: d.ready, who: 'system', kind: 'system', title: 'Review for scheduling passed' })
  if (d.setup) out.push({ date: d.setup, who: 'office', kind: 'setup', title: 'Setup approved · rooms and finish records built' })
  if (d.won) out.push({ date: d.won, who: 'system', kind: 'pricing', title: 'Awarded', detail: 'Deposit, setup, materials and scheduling notified' })
  if (!out.length) out.push({ date: 'Sep 25', who: 'office', kind: 'pricing', title: 'Price request received' })
  return out
}

/* ---------------- files ---------------- */
export interface FileDoc { name: string; kind: 'plans' | 'spec' | 'finish' | 'paperwork' | 'proposal' | 'contract' | 'package' | 'photo'; rev: string; date: string; current: boolean; note?: string }
export const FILES0: Record<string, FileDoc[]> = {
  '119': [
    { name: 'Architectural plans', kind: 'plans', rev: 'A4', date: 'Aug 18', current: true, note: 'A3 kept in history' },
    { name: 'Spec book', kind: 'spec', rev: 'v2', date: 'Aug 14', current: true },
    { name: 'Finish schedule', kind: 'finish', rev: 'Rev 3', date: 'Aug 22', current: true },
    { name: 'Best Tile order · #BT-22817', kind: 'paperwork', rev: '7 lines', date: 'Sep 2', current: true, note: 'Entered into finish records' },
    { name: 'Proposal · Revision 2', kind: 'proposal', rev: 'R2', date: 'Aug 26', current: true, note: 'Approved Aug 31' },
    { name: 'Subcontract / client PO', kind: 'contract', rev: 'Signed', date: 'Sep 2', current: true },
    { name: 'Installer package', kind: 'package', rev: 'Rev 3', date: 'Sep 24', current: true, note: 'Boys bath held at 3 ft' },
  ],
}
/** the sample projects' documents (only the sample has them — a real project's files are the ones people add) */
export function filesFor(id: string): FileDoc[] {
  return FILES0[id] || []
}

export const toneOrder: Record<Tone, number> = { bad: 0, warn: 1, info: 2, vio: 3, ok: 4, neutral: 5 }
