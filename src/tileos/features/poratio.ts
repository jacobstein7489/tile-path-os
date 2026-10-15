/* The installer's PO against what we sold the work for. What we pay the installer should stay under a share of the
 * estimate (half, unless Settings says otherwise) — the line on the meter. Each line of the PO shows its own share
 * too, so the one that's off stands out. */
import type { Store } from '@/tileos/store'
import type { IPO } from '@/tileos/data/field'
import { curRev, revTotal, type EstRev } from '@/tileos/data/estimates'
import { worthOf, worthKey } from './progressbill'
import { surfaceItem } from './flows2'

export const ipoTotal = (p: IPO) => p.lines.reduce((n, l) => n + l.amount, 0) + p.changes.filter((c) => c.status !== 'pending').reduce((n, c) => n + c.amount, 0)
export const LABOR_LINE = 50

/** the estimate the client said yes to (or the latest one, before that) */
export function soldRev(s: Pick<Store, 'estimates'>, jobId: string): EstRev | undefined {
  const est = s.estimates.find((e) => e.jobId === jobId && e.status === 'approved') || s.estimates.find((e) => e.jobId === jobId)
  return est ? [...est.revs].reverse().find((r) => r.status === 'approved') || curRev(est) : undefined
}

export type Ratio = { total: number; sold: number; pct: number; line: number; over: boolean; lines: { sold: number; pct?: number }[] }
/** the PO's share of the estimate, overall and line by line. A line is worth what the estimate gets for the walls and
 *  floors it pays for — the estimate spread over the surfaces, the same way progress billing spreads it. */
export function poRatio(s: Store, p: Pick<IPO, 'jobId' | 'lines' | 'changes'>): Ratio {
  const rev = soldRev(s, p.jobId)
  const sold = revTotal(rev) || s.jobs[p.jobId]?.contract || 0
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
  return { total, sold, pct, line, over: !!sold && pct > line, lines }
}
