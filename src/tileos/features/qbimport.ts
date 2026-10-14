/* Reading QuickBooks' "Products and Services" export (CSV). The same rules made the starting list from Cobblestone's
 * own export: accounting entries, dates, test and one-job lines are left out; the unit is read from the description
 * ("per LF", "50 lb") and the price; each item gets a group for the item list and the estimate's picker. */
import type { Item } from '@/tileos/data/items'

/** a small CSV reader — quoted fields, commas and line breaks inside quotes */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let f = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false }
      else f += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(f); rows.push(row); row = []; f = ''
    } else f += c
  }
  if (f || row.length) { row.push(f); rows.push(row) }
  return rows.filter((r) => r.some((x) => x.trim()))
}

const MONTH = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}$/
const ACCOUNTING = new Set(['deposit', 'payment', 'discount', 'discount account', 'retainage', 'retainage recievable', 'retainage receivable', 'note', 'pcs', 'credit card processing fee', 'custom amount', 'cc fee', 'late fee'])
export function whyLeftOut(name: string, account: string): string {
  const low = name.toLowerCase().trim()
  if (!low) return 'blank'
  if (ACCOUNTING.has(low) || (account && !account.startsWith('Sales'))) return 'accounting'
  if (MONTH.test(low)) return 'a date, not an item'
  if (/\btest\b/.test(low)) return 'test item'
  return ''
}
export function unitOf(name: string, desc: string, price: number): string {
  const t = `${name} ${desc}`.toLowerCase()
  if (/per ?l\.?f|per ln ft|\bborder\b|\bbase\b|coping|mitered/.test(t)) return 'LF'
  if (/by the hour/.test(t)) return 'HR'
  if (/\b(50 ?lb|8 ?lb)\b/.test(t)) return 'bag'
  if (/glue supply/.test(name.toLowerCase())) return 'pail'
  if (name.toLowerCase() === 'caulk') return 'tube'
  if (/epoxy grout/.test(name.toLowerCase())) return 'unit'
  if (price > 0 && price <= 30 && /install|supply|underlayment|mud|leval|level|coat|membrane|mats|mesh|demo|cover floors|upcharge|concrete|flooring|lvt/.test(t) && !/riser|saddle|stairs/.test(t)) return 'SF'
  return 'EA'
}
export function typeOf(name: string, desc: string): Item['type'] {
  const t = `${name} ${desc}`.toLowerCase()
  const low = name.toLowerCase()
  if (/\bsupply\b/.test(t) || ['254 ts 50lb', 'grout 8lb', 'epoxy grout', 'caulk', 'setting material', 'material', 'tiles', 'natural stone'].includes(low)) return 'material'
  if (['shipping', 'mobilization', 'design', 'services', 'cover holes', 'repair guys by the hour'].includes(low)) return 'other'
  return 'labor'
}
const GROUPS: [string, RegExp][] = [
  ['Whole jobs', /^(bathroom tile installation|bohr mikva|dole)$/],
  ['Showers & wet areas', /waterproof|shower|drain|niche|bench|curb|tub|side box|knee wall/],
  ['Floor prep', /mud|leval|level|skim|membrane|strata|foil|wire mesh|demo|cover floors|cover holes|polished concrete/],
  ['Edges & trim', /saddle|metal|mitered|border|base tile|coping|riser|steps/],
  ['Upcharges', /upcharge|pizza/],
  ['Other flooring', /carpet|vinyl|vct|rubber|lvt|glue/],
  ['Materials', /^(254 ts 50lb|grout 8lb|epoxy grout|caulk|setting material|material|tiles|natural stone)$/],
  ['Repairs & extras', /repair|replace|redo|shipping|mobilization|design|services|installation|elevator$|fire place/],
]
export const ITEM_GROUPS = ['Tile install', 'Showers & wet areas', 'Floor prep', 'Edges & trim', 'Upcharges', 'Other flooring', 'Materials', 'Repairs & extras', 'Whole jobs']
export const groupOf = (name: string) => GROUPS.find(([, rx]) => rx.test(name.toLowerCase()))?.[0] || 'Tile install'
export const qbId = (name: string) => 'qb-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export type QBRow = { item: Item; status: 'new' | 'changed' | 'same'; was?: Item }
export type QBRead = { rows: QBRow[]; left: { name: string; why: string }[]; problem?: string }
/** read the export against what's on the list now: new items, price changes, the same */
export function readQB(text: string, have: Item[]): QBRead {
  const grid = parseCSV(text.replace(/^﻿/, ''))
  if (!grid.length) return { rows: [], left: [], problem: 'The file is empty.' }
  const head = grid[0].map((h) => h.trim().toLowerCase())
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h === n || h.startsWith(n)))
  const cName = col('product/service name', 'product/service', 'name', 'item')
  const cDesc = col('sales description', 'description')
  const cPrice = col('price', 'sales price', 'rate')
  const cCost = col('cost', 'purchase cost')
  const cAcct = col('income account')
  if (cName < 0) return { rows: [], left: [], problem: 'This doesn’t look like the QuickBooks Products and Services export — there’s no “Product/Service Name” column.' }
  const rows: QBRow[] = []
  const left: { name: string; why: string }[] = []
  const seen = new Set<string>()
  grid.slice(1).forEach((r) => {
    const name = (r[cName] || '').trim()
    const why = whyLeftOut(name, cAcct >= 0 ? (r[cAcct] || '').trim() : 'Sales')
    if (why) { if (name) left.push({ name, why }); return }
    const desc = cDesc >= 0 ? (r[cDesc] || '').replace(/\s+/g, ' ').trim() : ''
    const price = Number((cPrice >= 0 ? r[cPrice] : '').replace(/[^0-9.]/g, '')) || 0
    const cost = Number((cCost >= 0 ? r[cCost] : '').replace(/[^0-9.]/g, '')) || 0
    let id = qbId(name)
    while (seen.has(id)) id += '-2'
    seen.add(id)
    const was = have.find((i) => i.id === id || (i.qb || '').toLowerCase() === name.toLowerCase())
    const item: Item = {
      id: was?.id || id, name, desc: desc || undefined, type: was?.type || typeOf(name, desc), unit: was?.unit || unitOf(name, desc, price),
      price, cost: cost || was?.cost || 0, qb: name, group: was?.group || groupOf(name),
    }
    const status = !was ? 'new' : was.price !== price || (!!cost && was.cost !== cost) || (was.desc || '') !== (desc || '') ? 'changed' : 'same'
    rows.push({ item, status, was })
  })
  return { rows, left }
}
