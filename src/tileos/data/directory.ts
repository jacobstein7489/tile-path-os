import { CREWS, crewInfo } from './model'
/* The people and companies we work with besides clients: designers, subs (our installers) and suppliers.
 * Designers here are sample firms. Subs are the crews Cobblestone actually uses. */
export interface Designer { id: string; name: string; contact: string; phone: string; email: string; clients: string[]; notes: string }
export const DESIGNERS0: Designer[] = [
  { id: 'ivy', name: 'Ivy Lane Interiors', contact: 'Lead designer', phone: '(516) 555-0141', email: 'studio@ivylane.design', clients: ['wilkinson', 'forest'], notes: 'Layout answers take about a week. Send questions by email with photos.' },
  { id: 'north', name: 'Studio North Design', contact: 'Project designer', phone: '(732) 555-0172', email: 'hello@studionorth.design', clients: ['greentree'], notes: 'Phase 2 tile selection is theirs.' },
  { id: 'hudson', name: 'Hudson Row Design', contact: 'Designer', phone: '(718) 555-0122', email: 'office@hudsonrow.design', clients: ['parkave'], notes: '' },
]
export const SAMPLE_DESIGNERS = true

export interface SubInfo { crew: string; trade: string; region?: string }
export const SUBS0: SubInfo[] = [
  { crew: 'walter', trade: 'Tile installation' },
  { crew: 'leo', trade: 'Tile installation' },
  { crew: 'alex', trade: 'Tile installation' },
  { crew: 'philip', trade: 'Tile installation' },
  { crew: 'caesar', trade: 'Tile installation' },
  { crew: 'giovanni', trade: 'Tile installation' },
  { crew: 'jose', trade: 'Tile installation', region: 'New Jersey' },
]

/** every installer: the standing crews and the ones added on the Installers page */
export function allSubs(): SubInfo[] {
  return [...SUBS0, ...CREWS.filter((c) => !SUBS0.some((x) => x.crew === c)).map((c) => ({ crew: c, trade: crewInfo[c]?.trade || 'Tile installation', region: crewInfo[c]?.region }))]
}

export interface SupplierInfo { name: string; supplies: string; contact?: string; phone?: string; email?: string; note?: string }
export const SUPPLIERS0: SupplierInfo[] = [
  { name: 'Infinity', supplies: 'Setting materials — thinset, membranes, grout, waterproofing, floor prep' },
  { name: 'Metal Works Inc.', supplies: 'Metal edges and trim' },
  { name: 'Best Tile', supplies: 'Tile — ordered by the GC on most projects' },
]
