import { CREWS, crewInfo, type Reach } from './model'
/* The people and companies we work with besides clients: designers, subs (our installers) and suppliers.
 * Designers here are sample firms. Subs are the crews Cobblestone actually uses. */
export interface Designer { id: string; name: string; contact: string; phone: string; email: string; /** more phones and emails */ more?: Reach[]; clients: string[]; notes: string }
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
  return [...SUBS0.map((x) => (crewInfo[x.crew] ? { ...x, trade: crewInfo[x.crew].trade || x.trade, region: crewInfo[x.crew].region ?? x.region } : x)), ...CREWS.filter((c) => !SUBS0.some((x) => x.crew === c)).map((c) => ({ crew: c, trade: crewInfo[c]?.trade || 'Tile installation', region: crewInfo[c]?.region }))]
}

export interface SupplierInfo { name: string; supplies: string; /** what we buy from them — picked from the list, not typed */ kinds?: SupplyKind[]; contact?: string; phone?: string; email?: string; /** more phones and emails */ more?: Reach[]; note?: string }
/** what a supplier sells us — a tile PO goes to a tile store, a materials PO to the others */
export type SupplyKind = 'tile' | 'setting' | 'waterproofing' | 'boards' | 'trim' | 'tools' | 'other'
export const SUPPLY_KINDS: { key: SupplyKind; label: string }[] = [
  { key: 'tile', label: 'Tile' },
  { key: 'setting', label: 'Setting materials' },
  { key: 'waterproofing', label: 'Waterproofing' },
  { key: 'boards', label: 'Underlayment & boards' },
  { key: 'trim', label: 'Edges & trim' },
  { key: 'tools', label: 'Tools & supplies' },
  { key: 'other', label: 'Other' },
]
/** what a supplier sells: what was picked — or, for one saved before the list, read from what was typed */
export function kindsOf(x: Pick<SupplierInfo, 'kinds' | 'supplies'>): SupplyKind[] {
  if (x.kinds?.length) return x.kinds
  const t = (x.supplies || '').toLowerCase()
  const k: SupplyKind[] = []
  if (/\btile\b|showroom|porcelain|marble|mosaic/.test(t)) k.push('tile')
  if (/thinset|grout|mortar|setting|adhesive/.test(t)) k.push('setting')
  if (/waterproof|membrane/.test(t)) k.push('waterproofing')
  if (/board|underlay|prep|level/.test(t)) k.push('boards')
  if (/edge|trim|metal|schluter/.test(t)) k.push('trim')
  if (/tool|suppl/.test(t)) k.push('tools')
  return k
}
export const kindsText = (k: SupplyKind[]) => k.map((x) => SUPPLY_KINDS.find((y) => y.key === x)?.label || x).join(' · ')
/** a store we get tile from */
export const sellsTile = (x: Pick<SupplierInfo, 'kinds' | 'supplies'>) => kindsOf(x).includes('tile')
export const SUPPLIERS0: SupplierInfo[] = [
  { name: 'Infinity', supplies: 'Setting materials · Waterproofing · Underlayment & boards', kinds: ['setting', 'waterproofing', 'boards'] },
  { name: 'Metal Works Inc.', supplies: 'Edges & trim', kinds: ['trim'] },
  { name: 'Best Tile', supplies: 'Tile', kinds: ['tile'] },
]
