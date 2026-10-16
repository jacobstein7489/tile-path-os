/* The paper the client gets — laid out like Cobblestone's scope of work: COBBLESTONE across the top, the project line,
 * each floor in a green band, each room in gray with its note ("9.25′ ceiling; fully tiled"), every surface with its
 * quantity. The estimate adds the price of each line, the total, the terms and a place to sign. */
import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { useStore } from '@/tileos/store'
import { tileOf } from '@/tileos/data/jobs'
import { fmtMoney } from '@/tileos/data/model'
import { revTotal, type Estimate, type EstRev, type EstLine } from '@/tileos/data/estimates'
import { floorRank, sortAreas } from '@/tileos/data/areas'
import { TODAY } from '@/tileos/lib/today'

const GREEN = '#2c4a3e'
const GRAY = '#efece5'

/** "Floor tile 24X48 (T-03 Porcelain)", "Tile niche", or the item's own name */
export function paperText(l: EstLine, itemName?: string, jobId?: string) {
  if (l.desc) return l.desc
  const t = tileOf(jobId, l.tile)
  const size = t ? ` ${t.size.replace(/\s/g, '').replace(/x/gi, 'X')}` : ''
  if (l.surface) {
    const what = /^floor$/i.test(l.surface) ? 'Floor tile' : /^walls?$/i.test(l.surface) ? 'Wall tile' : l.surface
    return `${what}${size}${t ? ` (${t.tag} ${t.name})` : ''}`
  }
  return itemName || l.itemId
}

type Group = { floor: string; areas: { name: string; note?: string; lines: EstLine[] }[] }
/** floors in the paper's order (1st, 2nd, attic, basement, then any other), rooms in the order they were added */
export function paperGroups(rev: EstRev): Group[] {
  const meta = rev.areas || []
  const names = [...meta.map((a) => a.name), ...Array.from(new Set(rev.lines.map((l) => l.area))).filter((n) => !meta.some((a) => a.name === n))]
  const floorOf = (n: string) => meta.find((a) => a.name === n)?.floor || ''
  const floors = Array.from(new Set(names.map(floorOf)))
  const anyFloor = floors.some(Boolean)
  const rank = (f: string) => floorRank(f || undefined)
  return floors
    .sort((a, b) => rank(a) - rank(b))
    .map((f) => ({
      floor: f || (anyFloor ? 'Other areas' : 'Scope'),
      areas: sortAreas(names.filter((n) => floorOf(n) === f).map((n) => ({ name: n, floor: f }))).map(({ name: n }) => ({ name: n, note: meta.find((a) => a.name === n)?.note, lines: rev.lines.filter((l) => l.area === n) })),
    }))
}

export function EstimatePaper({ e, rev, prices = true, innerRef }: { e: Estimate; rev: EstRev; prices?: boolean; innerRef?: React.Ref<HTMLDivElement> }) {
  const s = useStore()
  const j = s.jobs[e.jobId]
  if (!j) return null
  const groups = paperGroups(rev)
  const total = revTotal(rev)
  const unitOf = (l: EstLine) => { const u = s.items.find((i) => i.id === l.itemId)?.unit || 'EA'; return u === 'LS' ? 'EA' : u }
  const qty = (l: EstLine) => (l.qty ? `${l.qty.toLocaleString('en-US')} ${unitOf(l)}` : '—')
  const date = `${rev.sentOn || rev.date}, ${TODAY.slice(0, 4)}`
  const toMeasure = rev.lines.filter((l) => !l.qty).length
  return (
    <div ref={innerRef} className="mx-auto w-full max-w-[48.75rem] bg-white px-10 py-9 font-[Helvetica,Arial,sans-serif] text-[#222] shadow-card max-sm:px-4 max-sm:py-6">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-[1.75rem] font-bold tracking-[0.01em] max-sm:text-[1.375rem]" style={{ color: GREEN }}>COBBLESTONE</div>
        <div className="text-[0.8125rem] font-bold tracking-[0.04em]" style={{ color: GREEN }}>{prices ? 'ESTIMATE' : 'SCOPE OF WORK'}</div>
      </div>
      <div className="mt-4 text-[0.875rem] font-bold">{j.name} | {j.address}</div>
      <div className="mt-0.5 flex flex-wrap justify-between gap-x-4 text-[0.75rem] text-[#444]">
        <span>{j.client}</span>
        <span>Estimate {e.id}{rev.n > 1 ? ` · Revision ${rev.n}` : ''} | {date}</span>
      </div>

      <div className="mt-6">
        {groups.map((g) => (
          <section key={g.floor} className="mb-5">
            <div className="flex items-center justify-between gap-3 px-2 py-2 text-[0.75rem] font-bold uppercase text-white" style={{ background: GREEN }}>
              <span>{g.floor}</span>
              <span className="flex gap-3"><span className="w-[5.25rem] text-right">Quantity</span>{prices && <span className="w-[5.75rem] text-right">Amount</span>}</span>
            </div>
            {g.areas.map((a) => (
              <div key={a.name} className="break-inside-avoid">
                <div className="mt-1 px-2 py-1.5 text-[0.71875rem] font-bold uppercase" style={{ background: GRAY }}>
                  {a.name}{a.note ? <span className="normal-case"> | {a.note}</span> : null}
                </div>
                {!a.lines.length && <div className="px-2 py-[0.1875rem] text-[0.71875rem]">No tile installation</div>}
                {a.lines.map((l) => (
                  <div key={l.id} className="flex items-baseline justify-between gap-3 px-2 py-[0.1875rem] text-[0.71875rem]">
                    <span className="min-w-0">{paperText(l, s.items.find((i) => i.id === l.itemId)?.name, e.jobId)}</span>
                    <span className="flex shrink-0 gap-3 tnum">
                      <span className="w-[5.25rem] text-right">{qty(l)}</span>
                      {prices && <span className="w-[5.75rem] text-right">{l.qty ? fmtMoney(l.qty * l.rate) : '—'}</span>}
                    </span>
                  </div>
                ))}
                {prices && a.lines.length > 1 && (
                  <div className="flex justify-end px-2 pb-1 pt-0.5 text-[0.71875rem] font-bold">
                    <span className="mr-3 font-normal text-[#666]">{a.name}</span>
                    <span className="w-[5.75rem] text-right tnum">{fmtMoney(a.lines.reduce((n, l) => n + l.qty * l.rate, 0))}</span>
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}
        {!groups.length && <div className="py-10 text-center text-[0.75rem] text-[#666]">No areas yet.</div>}
      </div>

      {prices && (
        <div className="mt-2 break-inside-avoid">
          <div className="ml-auto flex w-full max-w-[20rem] items-center justify-between px-2 py-2 text-[0.8125rem] font-bold uppercase text-white" style={{ background: GREEN }}>
            <span>Total</span><span className="tnum">{fmtMoney(total)}</span>
          </div>
          {toMeasure > 0 && <div className="mt-1 text-right text-[0.6875rem] font-semibold text-[#b06a0c]">{toMeasure} {toMeasure === 1 ? 'line' : 'lines'} still to measure — not in the total yet</div>}
          <div className="mt-6 text-[0.71875rem] leading-relaxed text-[#444]">
            <div className="mb-1 text-[0.71875rem] font-bold uppercase" style={{ color: GREEN }}>Terms</div>
            Labor and setting materials included; finish tile supplied by others unless listed above.
            {s.rules.depositPct ? ` ${s.rules.depositPct}% deposit to schedule the work.` : ''} Progress billing monthly{s.rules.retainage ? `, ${s.rules.retainage}% retainage released at completion` : ''}. Prices good for 30 days.
          </div>
          <div className="mt-8 grid grid-cols-2 gap-8 text-[0.71875rem] max-sm:grid-cols-1">
            {[`Accepted by — ${j.client}`, 'Cobblestone'].map((who) => (
              <div key={who}>
                <div className="h-8 border-b border-[#999]" />
                <div className="mt-1 flex justify-between text-[#666]"><span>{who}</span><span>Date</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between border-t border-[#ddd] pt-2 text-[0.625rem] text-[#666]">
        <span>{prices ? `Estimate ${e.id}${rev.n > 1 ? ` · revision ${rev.n}` : ''}${smp(' — sample amounts')}` : `Scope reference - based on estimate ${e.id}`}</span>
        <span>1</span>
      </div>
    </div>
  )
}
