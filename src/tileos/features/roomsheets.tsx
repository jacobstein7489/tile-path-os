/* Room sheets — one page for each room, to hang in the room on the job: the room's tiles (a picture, the size, the
 * finish, who makes it), the grout and the joint, every wall and floor with what it's set on and how it's laid out,
 * and the layouts drawn to scale. Made from what's already in the project — the tile paperwork, the picks from the
 * design meeting, the underlayment, the layouts — nothing to type. The same as Scope of work on the project. */
import * as React from 'react'
import { Printer } from 'lucide-react'
import { useStore, addHist, meOf, NOW } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { GROUTS, tileOf, type Room, type Surface, type Tile } from '@/tileos/data/jobs'
import { METHODS } from '@/tileos/data/takeoff'
import type { Job } from '@/tileos/data/model'
import { printNode } from '@/tileos/lib/print'
import { takesTile } from './steps'
import { methodOf } from './takeoff'
import { LayoutThumb, layoutOf, ftIn, suggestLayout } from './layout'

/** what a room sheet says about one wall or floor */
export type SheetRow = { x: Surface; tile?: Tile; grout?: string; groutKey?: string; joint?: string; setOn: string; setAuto: boolean; layout: string; layoutSuggested: boolean }
export function sheetRows(jobId: string, room: Room): SheetRow[] {
  return room.surfaces.filter((x) => x.tile && takesTile(x.name)).map((x) => {
    const tile = tileOf(jobId, x.tile)
    const groutKey = x.grout || tile?.grout
    const m = methodOf(room.name, x)
    return {
      x, tile, groutKey, grout: groutKey ? GROUTS[groutKey]?.name || groutKey : undefined, joint: x.joint || tile?.joint,
      setOn: METHODS[m.key]?.short || m.key, setAuto: m.auto,
      layout: x.layout || suggestLayout(jobId, x).text, layoutSuggested: !x.layout,
    }
  })
}
/** the rooms that get a sheet: the ones with tile on a wall or floor */
export const sheetRooms = (s: { rooms: Record<string, Room[]> }, jobId: string) => (s.rooms[jobId] || []).filter((r) => r.surfaces.some((x) => x.tile && takesTile(x.name)))

/** one room, one page */
export function RoomSheet({ job, room, last }: { job: Job; room: Room; last?: boolean }) {
  const rows = sheetRows(job.id, room)
  const tiles = Array.from(new Map(rows.filter((r) => r.tile).map((r) => [r.tile!.tag, r])).values())
  const sf = rows.reduce((n, r) => n + (r.x.sf || 0), 0)
  const notes = [room.note, ...rows.map((r) => (r.x.notes ? `${r.x.name}: ${r.x.notes}` : '')), ...rows.map((r) => (r.x.edge ? `${r.x.name} edge: ${r.x.edge}` : ''))].filter(Boolean) as string[]
  return (
    <section data-room-sheet={room.name} className="bg-white px-1 text-[#1d2129]" style={{ breakAfter: last ? 'auto' : 'page', pageBreakAfter: last ? 'auto' : 'always' }}>
      <header className="flex items-end justify-between gap-4 border-b-2 border-[#22372b] pb-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#22372b]">Cobblestone Tile Installation</div>
          <div className="mt-0.5 truncate text-[13px] text-[#5f6672]">{job.name}{job.address ? ` · ${job.address}` : ''}</div>
        </div>
        <div className="shrink-0 text-right text-[11px] text-[#7a8190]">Room sheet · {NOW}</div>
      </header>
      <h1 className="mt-3 text-[30px] font-bold leading-none tracking-[-0.01em]">{room.name}</h1>
      <div className="mt-1.5 text-[14px] text-[#5f6672]">{[room.floor, sf ? `${sf.toLocaleString('en-US')} SF` : '', `${rows.length} ${rows.length === 1 ? 'wall or floor' : 'walls and floors'}`].filter(Boolean).join(' · ')}</div>

      <h2 className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8190]">The tile</h2>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {tiles.map((r) => (
          <div key={r.tile!.tag} className="flex items-center gap-2.5 rounded-[10px] border border-[#e3ded5] p-2" style={{ breakInside: 'avoid' }} data-sheet-tile={r.tile!.tag}>
            <TileImg tile={r.tile} size={44} radius={7} />
            <div className="min-w-0 leading-snug">
              <div className="text-[15px] font-bold">{r.tile!.tag} <span className="font-semibold">{r.tile!.name}</span></div>
              <div className="text-[11.5px] text-[#3d434d]">{[r.tile!.size, r.tile!.finish, r.tile!.maker].filter(Boolean).join(' · ')}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px]"><GroutDot grout={r.groutKey} size={11} />{r.grout ? `${r.grout} grout` : 'Grout not picked yet'}{r.joint ? ` · ${r.joint.replace(/″?$/, '″')} joint` : ''}</div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8190]">Wall by wall, floor by floor</h2>
      <table className="mt-1.5 w-full border-collapse text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-[#d9d3c9] text-[10.5px] uppercase tracking-[0.08em] text-[#7a8190]">
            <th className="py-1.5 pr-2 font-semibold">Where</th><th className="py-1.5 pr-2 font-semibold">Tile</th><th className="py-1.5 pr-2 font-semibold">Grout</th><th className="py-1.5 pr-2 font-semibold">Set on</th><th className="py-1.5 font-semibold">Layout</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.x.name} className="border-b border-[#ece7de] align-top" data-sheet-row={r.x.name}>
              <td className="py-1.5 pr-2"><div className="font-bold">{r.x.name}</div><div className="text-[11px] text-[#7a8190]">{[r.x.sf ? `${r.x.sf} SF` : '', r.x.height || ''].filter(Boolean).join(' · ')}</div></td>
              <td className="py-1.5 pr-2"><b>{r.tile?.tag || r.x.tile}</b> {r.tile?.name}</td>
              <td className="py-1.5 pr-2">{r.grout || '—'}{r.joint ? <div className="text-[11px] text-[#7a8190]">{r.joint.replace(/″?$/, '″')} joint</div> : null}</td>
              <td className="py-1.5 pr-2">{r.setOn.replace(/^on (\w)/i, (_, c: string) => c.toUpperCase())}</td>
              <td className="py-1.5">{r.layout}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8190]">The layouts, to scale</h2>
      <div className="mt-2 grid grid-cols-4 gap-x-4 gap-y-3">
        {rows.map((r) => {
          const L = layoutOf(job.id, r.x)
          return (
            <figure key={r.x.name} className="m-0 min-w-0" style={{ breakInside: 'avoid' }} data-sheet-layout={r.x.name}>
              <LayoutThumb jobId={job.id} x={r.x} max={150} />
              <figcaption className="mt-1 text-[11.5px] leading-snug"><b>{r.x.name}</b> · {ftIn(L.W)} × {ftIn(L.H)}{L.measured ? '' : ' (from the SF)'}<br /><span className="text-[#5f6672]">{L.mosaic ? 'Sheets' : L.smallest ? `Smallest cut ${ftIn(L.smallest)}` : 'No cuts'}{L.slivers ? ` · ${L.slivers} slivers` : ''}</span></figcaption>
            </figure>
          )
        })}
      </div>

      {notes.length > 0 && (
        <>
          <h2 className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a8190]">Notes</h2>
          <ul className="mt-1 list-disc pl-5 text-[12.5px]">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </>
      )}
    </section>
  )
}

/** every room's sheet, one after the other (one page each when printed) */
export function RoomSheets({ job, only }: { job: Job; only?: string }) {
  const s = useStore()
  const rooms = sheetRooms(s, job.id).filter((r) => !only || r.name === only)
  return <div data-room-sheets>{rooms.map((r, i) => <RoomSheet key={r.name} job={job} room={r} last={i === rooms.length - 1} />)}</div>
}

/** print them: the sheets are put together right then, and go to the printer — no window in between */
export function PrintSheetsButton({ job, room, children, variant, size, className }: { job: Job; room?: string; children?: React.ReactNode; variant?: 'primary' | 'ghost'; size?: 'sm'; className?: string }) {
  const s = useStore()
  const [on, setOn] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const n = sheetRooms(s, job.id).filter((r) => !room || r.name === room).length
  React.useEffect(() => {
    if (!on) return
    const t = setTimeout(() => {
      printNode(ref.current?.firstElementChild as HTMLElement | null)
      s.commit((st) => { addHist(st, job.id, { who: meOf(st.role), kind: 'setup', title: `Hang room sheets: printed${room ? ` — ${room}` : ` — ${n} room${n === 1 ? '' : 's'}`}` }) }, undefined, { undo: false })
      setOn(false)
    }, 60)
    return () => clearTimeout(t)
  }, [on])
  return (
    <>
      <Button variant={variant} size={size} className={className} icon={<Printer />} disabled={!n} onClick={() => setOn(true)} data-print-sheets={room || 'all'}>{children || (room ? 'Print this room’s sheet' : `Print the room sheets${n ? ` (${n})` : ''}`)}</Button>
      {on && <div className="hidden" ref={ref}><RoomSheets job={job} only={room} /></div>}
    </>
  )
}
