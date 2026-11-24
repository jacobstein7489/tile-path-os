/* The installer's PO against what we sold the work for. What we pay the installer should stay under a share of the
 * estimate (half, unless Settings says otherwise) — the line on the meter. Each line of the PO shows its own share
 * too, so the one that's off stands out. */
import type { Store } from '@/tileos/store'
import type { IPO } from '@/tileos/data/field'
import { curRev, revTotal, type EstRev } from '@/tileos/data/estimates'
import { worthOf, worthKey } from './progressbill'
import { surfaceItem, draftIPOLines } from './flows2'
import type { PersonKey } from '@/tileos/data/model'

export const ipoTotal = (p: IPO) => p.lines.reduce((n, l) => n + l.amount, 0) + p.changes.filter((c) => c.status !== 'pending').reduce((n, c) => n + c.amount, 0)
export const LABOR_LINE = 50

/** the estimate the client said yes to (or the latest one, before that) */
export function soldRev(s: Pick<Store, 'estimates'>, jobId: string): EstRev | undefined {
  const est = s.estimates.find((e) => e.jobId === jobId && e.status === 'approved') || s.estimates.find((e) => e.jobId === jobId)
  return est ? [...est.revs].reverse().find((r) => r.status === 'approved') || curRev(est) : undefined
}

export type Ratio = { total: number; sold: number; pct: number; line: number; over: boolean; lines: { sold: number; pct?: number }[]; /** the estimate alone, and the approved change orders on top of it */ estimate: number; changes: number }
/** the PO's share of the estimate, overall and line by line. A line is worth what the estimate gets for the walls and
 *  floors it pays for — the estimate spread over the surfaces, the same way progress billing spreads it. */
/** what the customer pays for the work: the estimate they said yes to (or the contract) and the change orders they said
 *  yes to (his PO grows with the same changes) */
export function soldOf(s: Store, jobId: string): { estimate: number; changes: number; sold: number } {
  const rev = soldRev(s, jobId)
  const estimate = revTotal(rev) || s.jobs[jobId]?.contract || 0
  const changes = (s.money || []).filter((m) => m.jobId === jobId && m.kind === 'change' && m.step >= 0).reduce((n, m) => n + (m.amount || m.meta?.estimate || 0), 0)
  return { estimate, changes, sold: estimate ? estimate + changes : 0 }
}
export function poRatio(s: Store, p: Pick<IPO, 'jobId' | 'lines' | 'changes'>): Ratio {
  const { estimate, changes, sold } = soldOf(s, p.jobId)
  const total = ipoTotal(p as IPO)
  const line = s.rules?.laborPct || LABOR_LINE
  const pct = sold ? Math.round((total / sold) * 100) : 0
  const worth = worthOf(s, p.jobId)
  const flat = (s.rooms[p.jobId] || []).flatMap((r) => r.surfaces.map((x) => ({ room: r.name, x })))
  const itemOf = (x: { itemId?: string; name: string }) => (x.itemId && s.items.some((i) => i.id === x.itemId) ? x.itemId : surfaceItem(x.name))
  const lines = p.lines.map((l) => {
    const est = l.itemId ? flat.filter((f) => itemOf(f.x) === l.itemId).reduce((n, f) => n + (worth.byKey[worthKey(f.room, f.x.name)] || 0), 0) : 0
    return { sold: Math.round(est), pct: est ? Math.round((l.amount / est) * 100) : undefined }
  })
  return { total, sold, pct, line, over: !!sold && pct > line, lines, estimate, changes }
}

/** one installer's price for a project: his PO drafted at his own prices from the project's square feet, and its share
 *  of what the customer pays. `own`: how many of his own prices he has (none: the standard prices — Items) */
export type CrewQuote = { crew: PersonKey; total: number; pct?: number; over: boolean; near: boolean; own: number; /** no prices of his own: his usual share of a job (QuickBooks) instead */ usual?: number }
/** every installer's price for a project, the lowest first — over the budget (Settings → Rules) marked */
export function crewQuotes(s: Store, jobId: string, crews: PersonKey[]): CrewQuote[] {
  const { sold } = soldOf(s, jobId)
  const line = s.rules?.laborPct || LABOR_LINE
  return crews.map((crew): CrewQuote => {
    const own = Object.keys(s.rules?.crewRates?.[crew] || {}).length
    /* no prices of his own, but QuickBooks knows his usual share of a job: that share of this one */
    const usual = !own && sold ? s.rules?.crewPct?.[crew] : undefined
    const total = usual ? Math.round((sold * usual) / 100) : Math.round(draftIPOLines(s, jobId, crew).reduce((n, l) => n + (l.amount || 0), 0))
    const pct = sold && total ? Math.round((total / sold) * 100) : undefined
    return { crew, total, pct, over: pct != null && pct > line, near: pct != null && pct > line - 5 && pct <= line, own, ...(usual ? { usual } : {}) }
  }).sort((a, b) => (a.total || Number.MAX_SAFE_INTEGER) - (b.total || Number.MAX_SAFE_INTEGER))
}
/** the one to suggest: the lowest price within the budget — only when it's his alone (two at the same price: no
 *  "Lowest", nobody picked for you) */
export const bestQuote = (qs: CrewQuote[]) => {
  const b = qs.find((q) => q.total > 0 && !q.over)
  return b && !qs.some((q) => q !== b && q.total === b.total) ? b : undefined
}
