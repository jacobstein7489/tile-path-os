/* The scope of work, in Cobblestone's own layout: the logo, SCOPE OF WORK, the address; each floor in a dark green band
 * (QUANTITY on the right), each room in a light gray band with its note ("POWDER ROOM | 11 ft ceiling; tile to 4 ft"),
 * every line under it with its quantity on the right (201 SF, 1 EA). The top of the page repeats on every printed page,
 * the project and the page number go at the bottom.
 *   a project: its rooms — every wall and floor as it is now (heights measured, change orders in) — with the estimate's
 *              other lines in each room (niche, saddle, metals, waterproofing) and its rooms without tile (protection)
 *   an estimate: its lines, as priced */
import * as React from 'react'
import { Printer } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { printNode } from '@/tileos/lib/print'
import { cn } from '@/tileos/lib/utils'
import { floorsOf, type Surface } from '@/tileos/data/jobs'
import type { Estimate, EstRev, EstLine } from '@/tileos/data/estimates'
import type { Item } from '@/tileos/data/items'
import { paperGroups } from '../estpaper'
import { DocHead, DocFoot, docLine, DOC_GREEN, DOC_GRAY, DOC_FONT } from '../docpaper'
import { coverageOf } from '../roomsheets'

type Line = { id: string; text: string; qty: string }
type Area = { name: string; note?: string; lines: Line[] }
type Floor = { floor: string; areas: Area[] }

/** a wall or floor, the way the scope says it: "Floor tile installation", "Wall tile installation" */
export function surfaceWords(name: string) {
  const n = name.trim()
  if (/^floor$/i.test(n)) return 'Floor tile installation'
  if (/^walls?$/i.test(n)) return 'Wall tile installation'
  if (/^niche/i.test(n)) return 'Tile niche'
  if (/^bench/i.test(n)) return 'Tiled shower bench'
  if (/^curb/i.test(n)) return 'Shower curb'
  if (/^base$/i.test(n)) return 'Tile base'
  return `${n} tile installation`
}
/** "Half tiled — to 4 ft" → "half tiled, to 4 ft" (it follows a dash on the line) */
const heightWords = (h: string) => { const t = h.replace(/\s+—\s+/g, ', '); return t.charAt(0).toLowerCase() + t.slice(1) }
const unitOf = (items: Item[], l: EstLine) => { const u = items.find((i) => i.id === l.itemId)?.unit || 'EA'; return u === 'LS' ? 'EA' : u.toUpperCase() }
const estText = (items: Item[], l: EstLine) => l.desc || (l.surface ? surfaceWords(l.surface) : items.find((i) => i.id === l.itemId)?.name || l.itemId)
const qtyText = (n: number | undefined, unit: string) => (n ? `${Math.round(n * 100) / 100} ${unit}` : '')
/** the estimate's revision the scope goes by: the approved one, else the newest */
export const scopeRev = (e: Estimate): EstRev => e.revs.find((r) => r.status === 'approved') || [...e.revs].reverse().find((r) => r.status !== 'superseded') || e.revs[e.revs.length - 1]

/** an estimate's lines, room by room */
function fromEstimate(items: Item[], rev: EstRev): Floor[] {
  return paperGroups(rev).map((g) => ({ floor: g.floor, areas: g.areas.map((a) => ({ name: a.name, note: a.note, lines: a.lines.map((l) => ({ id: l.id, text: estText(items, l), qty: qtyText(l.qty, unitOf(items, l)) })) })) }))
}
/** a project: its walls and floors as they are now, and the estimate's other lines in each room */
function fromProject(items: Item[], rooms: { name: string; floor?: string; note?: string; surfaces: Surface[] }[], rev?: EstRev): Floor[] {
  const isSurface = (l: EstLine) => !!l.surface || !!items.find((i) => i.id === l.itemId)?.surface
  const extra = (room: string) => (rev?.lines || []).filter((l) => l.area === room && !isSurface(l))
  const out: Floor[] = floorsOf(rooms as any).map((g) => ({
    floor: g.floor === 'Rooms' ? 'Scope of work' : g.floor,
    areas: g.rooms.map((r) => ({
      name: r.name, note: coverageOf(r as any).join('; ') || r.note,
      lines: [
        ...r.surfaces.map((x) => ({ id: x.name, text: `${surfaceWords(x.name)}${x.height ? ` — ${heightWords(x.height)}` : ''}`, qty: x.sf ? `${x.sf} SF` : '1 EA' })),
        ...extra(r.name).map((l) => ({ id: l.id, text: estText(items, l), qty: qtyText(l.qty, unitOf(items, l)) })),
      ],
    })),
  }))
  /* rooms on the estimate that aren't tiled rooms on the project (floor protection, mobilization…) */
  if (rev) {
    const have = new Set(rooms.map((r) => r.name))
    fromEstimate(items, { ...rev, lines: rev.lines.filter((l) => !have.has(l.area)) }).forEach((g) => {
      const areas = g.areas.filter((a) => a.lines.length)
      if (!areas.length) return
      const same = out.find((f) => f.floor.toLowerCase() === g.floor.toLowerCase())
      if (same) same.areas.push(...areas)
      else out.push({ floor: /^(scope|other areas)$/i.test(g.floor) ? 'All floors' : g.floor, areas })
    })
  }
  return out
}

/** the scope of work as the printed paper */
export function ScopeDoc({ jobId, estId, innerRef }: { jobId: string; estId?: string; innerRef: React.RefObject<HTMLDivElement | null> }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  const est = estId ? s.estimates.find((e) => e.id === estId) : s.estimates.find((e) => e.jobId === jobId && e.status === 'approved')
  const rev = est ? scopeRev(est) : undefined
  const rooms = estId ? [] : s.rooms[jobId] || []
  const floors = rooms.length ? fromProject(s.items, rooms, rev) : rev ? fromEstimate(s.items, rev) : []
  return (
    <div ref={innerRef} className={cn('mx-auto w-full max-w-[51rem] bg-white px-12 py-10 text-[#222] shadow-card max-sm:px-4 max-sm:py-6 print:p-0', DOC_FONT)} style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} data-scope-doc>
      <table className="w-full border-collapse">
        {/* the top of the page — printed again at the top of every page */}
        <thead><tr><td className="p-0"><DocHead kind="Scope of work" line={docLine(job)} /><div className="h-7" /></td></tr></thead>
        <tbody>
          {floors.map((g) => (
            <React.Fragment key={g.floor}>
              <tr style={{ breakAfter: 'avoid' }}><td className="p-0">
                <div className="mt-1 flex items-center justify-between px-2.5 py-[0.5625rem] text-[0.78125rem] font-bold uppercase text-white" style={{ background: DOC_GREEN, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} data-scope-floor={g.floor}>
                  <span>{g.floor}</span><span>Quantity</span>
                </div>
              </td></tr>
              {g.areas.map((a, i) => (
                <tr key={a.name} style={{ breakInside: 'avoid' }}><td className={cn('p-0', i === g.areas.length - 1 && 'pb-5')}>
                  <div className="mt-2 px-2.5 py-[0.4375rem] text-[0.75rem] font-bold" style={{ background: DOC_GRAY, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} data-scope-room={a.name}>
                    <span className="uppercase">{a.name}</span>{a.note ? <span> | {a.note}</span> : null}
                  </div>
                  {!a.lines.length && <div className="px-2.5 py-1 text-[0.75rem] text-[#555]">No tile installation</div>}
                  {a.lines.map((l) => (
                    <div key={l.id} className="flex items-baseline justify-between gap-4 px-2.5 py-[0.25rem] text-[0.75rem]" data-scope-line={l.text}>
                      <span className="min-w-0">{l.text}</span>
                      <span className="shrink-0 tnum">{l.qty}</span>
                    </div>
                  ))}
                </td></tr>
              ))}
            </React.Fragment>
          ))}
          {!floors.length && <tr><td className="py-12 text-center text-[0.75rem] text-[#666]">No rooms yet.</td></tr>}
        </tbody>
      </table>
      <DocFoot left={job.name} page={1} />
    </div>
  )
}

/** print the scope of work straight from the project — no window in between */
export function PrintScopeButton({ jobId, className }: { jobId: string; className?: string }) {
  const [on, setOn] = React.useState(false)
  const doc = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!on) return
    const t = setTimeout(() => { printNode(doc.current); setOn(false) }, 60)
    return () => clearTimeout(t)
  }, [on])
  return (
    <>
      <button onClick={() => setOn(true)} data-print-scope className={className}><Printer className="h-3.5 w-3.5" />Print</button>
      {on && <div className="hidden"><ScopeDoc jobId={jobId} innerRef={doc} /></div>}
    </>
  )
}
