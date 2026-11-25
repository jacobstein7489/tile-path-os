/* What we pay each installer, read from QuickBooks: his bills and checks there. Each line that says how much of what
 * (450 SF of floor tile at $6) gives his price for that work; his regular price is the middle one of all of them (one
 * odd bill doesn't move it). His lines for a customer, against what that customer was charged (the invoices), give his
 * share of that job — the middle one is his usual share (a job still going counts too: both sides are part way). A line
 * with no customer, but a project of ours in its words, is measured against that project's price. Nothing is saved
 * until the admin looks at it and says so. */
import { PEOPLE, CREWS, type PersonKey } from '@/tileos/data/model'
import type { QbPaid, QbPaidLine, QbBilled } from '@/lib/quickbooks'
import type { Store } from '@/tileos/store'
import { soldOf } from './poratio'

export type QbVendor = { id: string; name: string }
type Item = { id: string; name: string; type?: string; unit: string; cost: number; qb?: string }
/** an installer, as QuickBooks has him: what we paid, his price for each piece of work, his usual share of a job */
export type CrewFromQb = {
  crew: PersonKey
  vendors: QbVendor[]
  bills: number
  /** his POs read (their prices count too) */
  pos: number
  paid: number
  last?: string
  /** each piece of work with a price on his lines: the middle price, from how many lines; what he gets now (his own
   *  price, or the standard one) */
  rates: { itemId: string; rate: number; n: number; now: number; own: boolean }[]
  /** the jobs his lines were for (a QuickBooks customer, or one of our projects): what he got, what the customer was
   *  charged, the share */
  jobs: { name: string; jobId?: string; paid: number; sold: number; pct: number }[]
  /** his usual share of a job (the middle one), when there are projects to tell */
  pct?: number
}
export type QbRead = { crews: CrewFromQb[]; others: { vendor: QbVendor; bills: number; paid: number }[]; since: string; count: number }

const words = (t: string) => ` ${(t || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()} `
const mid = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); const n = a.length; return !n ? 0 : n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2 }
const cents = (n: number) => Math.round(n * 100) / 100

/** the installer a QuickBooks vendor is — his whole name in it, or his first name when only he has it ("Leo" ↔
 *  "Leo Tile LLC", "Jose (Jersey)" ↔ "Jose Martinez") */
export function crewOfVendor(name: string, crews: PersonKey[] = CREWS): PersonKey | undefined {
  const v = words(name)
  const full = crews.find((c) => { const n = words(PEOPLE[c]?.name || '').trim(); return n.length >= 3 && v.includes(` ${n} `) })
  if (full) return full
  const first = crews.filter((c) => { const f = words(PEOPLE[c]?.name || '').trim().split(' ')[0]; return f.length >= 3 && v.includes(` ${f} `) })
  return first.length === 1 ? first[0] : undefined
}

/** the piece of work a line is for — the QuickBooks product it's on ("Install:Floor tile"), else its words */
const KEYS: [RegExp, string][] = [
  [/linear drain/, 'i-drain'], [/\bniche/, 'i-niche'], [/window/, 'i-window'], [/saddle|threshold/, 'i-saddle'],
  [/waterproof/, 'i-wp'], [/underlay|backer|ditra|uncoupl/, 'i-under'], [/skim/, 'i-skim'], [/\bprep\b|mortar bed|mud bed|\bfloat/, 'i-prep'],
  [/metal (edge|corner)|schluter|\btrim\b/, 'i-edge'], [/border|coping/, 'i-border'], [/mosaic|shower (floor|pan)/, 'i-mosaic'],
  [/backsplash|\bsplash/, 'i-splash'], [/large format|24 ?x ?48|48 ?x ?48|32 ?x ?64|48 ?x ?96|slab/, 'i-large'], [/floor/, 'i-floor'], [/wall|\btub\b|shower/, 'i-wall'],
]
export function itemOfLine(items: Item[], l: Pick<QbPaidLine, 'item' | 'desc'>): string | undefined {
  const labor = items.filter((i) => !i.type || i.type === 'labor')
  const named = (l.item || '').trim().toLowerCase()
  if (named) {
    const hit = labor.find((i) => (i.qb || '').toLowerCase() === named || i.name.toLowerCase() === named)
    if (hit) return hit.id
  }
  const text = `${l.item || ''} ${l.desc || ''}`.toLowerCase()
  const k = KEYS.find(([re]) => re.test(text))?.[1]
  return k && labor.some((i) => i.id === k) ? k : undefined
}
/** how many, at what price: QuickBooks' own quantity and price, else "450 SF" in the words */
const UNIT = /(\d[\d,]*(?:\.\d+)?)\s*(sf|sq\.?\s?ft\.?|square\s+f(?:ee|oo)t|lf|lin\.?\s?ft\.?|linear\s+f(?:ee|oo)t|ea|each|pcs?|pieces?)\b/i
export function rateOfLine(l: QbPaidLine): { qty: number; rate: number } | undefined {
  if (l.qty && l.qty > 0 && l.rate && l.rate > 0) return { qty: l.qty, rate: l.rate }
  const m = UNIT.exec(l.desc || '')
  const qty = m ? Number(m[1].replace(/,/g, '')) : 0
  if (qty > 0 && l.amount > 0) return { qty, rate: l.amount / qty }
  return undefined
}

/** the project a line is for: its QuickBooks customer ("Park Place Development:114 Park Place"), else the project's name in
 *  its words or the bill's memo */
export function jobOfLine(s: Pick<Store, 'jobs'>, l: Pick<QbPaidLine, 'customer' | 'desc'>, memo?: string) {
  const jobs = Object.values(s.jobs)
  const keys = (j: { name: string; address?: string }) => [j.name, (j.address || '').split(',')[0]].map((k) => words(k).trim()).filter((k) => k.length >= 4)
  const find = (text?: string) => {
    if (!text) return undefined
    const t = words(text)
    let best: { id: string; n: number } | undefined
    jobs.forEach((j) => keys(j).forEach((k) => { if (t.includes(` ${k} `) && (!best || k.length > best.n)) best = { id: j.id, n: k.length } }))
    return best?.id
  }
  const parts = (l.customer || '').split(':')
  return find(parts[parts.length - 1]) || find(l.customer) || find(l.desc) || find(memo)
}

/** what QuickBooks says about each installer. `map`: vendors already matched by hand (vendor → installer; '' = none) */
export function readInstallerBills(s: Store, vendors: QbVendor[], bills: QbPaid[], since: string, map: Record<string, string> = {}, crews: PersonKey[] = CREWS, invoices: QbBilled[] = []): QbRead {
  const items = s.items as Item[]
  /* what each customer was charged in the same months */
  const charged = new Map<string, number>()
  invoices.forEach((i) => charged.set(i.customerId, (charged.get(i.customerId) || 0) + i.total))
  const nameOf = new Map(vendors.map((v) => [v.id, v.name]))
  const crewOf = (vendorId: string, name: string): PersonKey | undefined => {
    if (vendorId in map) return (map[vendorId] || undefined) as PersonKey | undefined
    return crewOfVendor(nameOf.get(vendorId) || name, crews)
  }
  const by = new Map<PersonKey, QbPaid[]>()
  const other = new Map<string, QbPaid[]>()
  bills.forEach((b) => {
    const c = crewOf(b.vendorId, b.vendor)
    if (c) by.set(c, [...(by.get(c) || []), b])
    else other.set(b.vendorId, [...(other.get(b.vendorId) || []), b])
  })
  const crewsOut: CrewFromQb[] = Array.from(by.entries()).map(([crew, bs]) => {
    const vs = Array.from(new Set(bs.map((b) => b.vendorId))).map((id) => ({ id, name: nameOf.get(id) || bs.find((b) => b.vendorId === id)?.vendor || id }))
    /* each piece of work: every line's price for it */
    const per = new Map<string, number[]>()
    const perCust = new Map<string, { name: string; paid: number }>()
    const perJob = new Map<string, number>()
    bs.forEach((b) => b.lines.forEach((l) => {
      const it = itemOfLine(items, l)
      const r = rateOfLine(l)
      const item = it ? items.find((i) => i.id === it) : undefined
      /* a price that's off by ten (a total typed as a price) doesn't count */
      if (item && r && r.rate >= item.cost / 10 && r.rate <= item.cost * 10) per.set(item.id, [...(per.get(item.id) || []), r.rate])
      /* a PO is what was agreed, not what was paid: its prices count, its amounts don't */
      if (b.kind === 'PO') return
      /* whose job: the QuickBooks customer (charged on its invoices), else one of our projects named in the words */
      if (l.customerId && charged.get(l.customerId)) { const c = perCust.get(l.customerId) || { name: (l.customer || '').split(':').pop()!.trim(), paid: 0 }; c.paid += l.amount; perCust.set(l.customerId, c); return }
      const j = jobOfLine(s, l, b.memo)
      if (j) perJob.set(j, (perJob.get(j) || 0) + l.amount)
    }))
    const his = s.rules.crewRates?.[crew] || {}
    const rates = Array.from(per.entries()).map(([itemId, rs]) => {
      const cost = items.find((i) => i.id === itemId)?.cost || 0
      return { itemId, rate: cents(mid(rs)), n: rs.length, now: his[itemId] ?? cost, own: his[itemId] != null }
    }).sort((a, b) => items.findIndex((i) => i.id === a.itemId) - items.findIndex((i) => i.id === b.itemId))
    const jobs = [
      ...Array.from(perCust.entries()).map(([id, c]) => { const sold = Math.round(charged.get(id) || 0); return { name: c.name, paid: Math.round(c.paid), sold, pct: sold ? Math.round((c.paid / sold) * 100) : 0 } }),
      ...Array.from(perJob.entries()).map(([jobId, paid]) => { const sold = soldOf(s, jobId).sold; return { name: s.jobs[jobId]?.name || jobId, jobId, paid: Math.round(paid), sold, pct: sold ? Math.round((paid / sold) * 100) : 0 } }),
    ]
      /* a share under 10% or over 95% is a bill and a charge that don't belong together (a first payment, another year) */
      .filter((j) => j.sold > 0 && j.paid > 0 && j.pct >= 10 && j.pct <= 95).sort((a, b) => b.paid - a.paid)
    const paidBs = bs.filter((b) => b.kind !== 'PO')
    const dates = paidBs.map((b) => b.date).filter(Boolean).sort()
    return { crew, vendors: vs, bills: paidBs.length, pos: bs.length - paidBs.length, paid: Math.round(paidBs.reduce((n, b) => n + b.total, 0)), last: dates[dates.length - 1], rates, jobs, pct: jobs.length ? Math.round(mid(jobs.map((j) => j.pct))) : undefined }
  }).sort((a, b) => b.paid - a.paid)
  const others = Array.from(other.entries()).map(([id, bs]) => ({ vendor: { id, name: nameOf.get(id) || bs[0]?.vendor || id }, bills: bs.filter((b) => b.kind !== 'PO').length, paid: Math.round(bs.filter((b) => b.kind !== 'PO').reduce((n, b) => n + b.total, 0)) })).sort((a, b) => b.paid - a.paid)
  return { crews: crewsOut, others, since, count: bills.length }
}
