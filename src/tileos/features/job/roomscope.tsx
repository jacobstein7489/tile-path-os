/* The scope of work to hang up on the job — the way Cobblestone made it by hand: the logo, the address, who installs
 * it; then room by room, each in a light band (its name, and its short note — FLOOR ONLY, FULLY TILED), its details on
 * the left ("Wet walls: fully tiled", "Remaining walls: half tiled, 4 ft", "1 niche", "Metals — white"), and its tiles
 * on the right, each with its picture, its name, its size and where it goes in that room (Floor, Walls, Floor + walls).
 * A tile in two rooms shows in both. Made from the project as it is now — change a detail or a tile, print again. */
import * as React from 'react'
import { useStore } from '@/tileos/store'
import { cn } from '@/tileos/lib/utils'
import { floorsOf, tileOf, tilesOn, type Room } from '@/tileos/data/jobs'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import { TileImg } from '@/tileos/components/ui/swatch'
import { DocHead, DocFoot, docLine, DOC_GREEN, DOC_FONT } from '../docpaper'
import { detailsOf, strongLine, whereIn } from '../roomdetails'
import { isWall } from '../heights'
import { takesTile } from '../steps'
import { installerOf } from '../upcoming'

/** what a room says when nothing's written for it yet: each wall and floor, and how high the walls go */
export function plainLines(room: Room): string[] {
  return room.surfaces.filter((x) => takesTile(x.name) || x.tile).map((x) => `${x.name}${x.height && isWall(x.name) ? ` — ${x.height.replace(/\s+—\s+/g, ', ').toLowerCase()}` : ''}`)
}

export function RoomScope({ jobId, innerRef }: { jobId: string; innerRef: React.RefObject<HTMLDivElement | null> }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  const rooms = s.rooms[jobId] || []
  const groups = floorsOf(rooms)
  const several = groups.length > 1 || (groups[0] && groups[0].floor !== 'Rooms')
  const crew = installerOf(s, job) as PersonKey | undefined
  return (
    <div ref={innerRef} className={cn('mx-auto w-full max-w-[51rem] bg-white px-12 py-10 text-[#222] max-sm:px-4 max-sm:py-6 print:p-0', DOC_FONT)} style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} data-room-scope>
      <DocHead kind="Scope of work" line={docLine(job)} sub={crew && PEOPLE[crew] ? <>Installer: <b className="font-bold text-[#222]">{PEOPLE[crew].name}</b></> : undefined} />
      <div className="mt-5 flex flex-col gap-4">
        {groups.map((g) => (
          <React.Fragment key={g.floor}>
            {several && <div className="mt-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em]" style={{ color: DOC_GREEN }} data-room-scope-floor>{g.floor}</div>}
            {g.rooms.map((room) => {
              const { lines: written } = detailsOf(s, jobId, room)
              const lines = written.length ? written : plainLines(room)
              const tags = Array.from(new Set(room.surfaces.flatMap((x) => tilesOn(x))))
              return (
                <section key={room.name} style={{ breakInside: 'avoid' }} data-room-scope-room={room.name}>
                  <div className="rounded-[0.375rem] px-3 py-[0.4375rem] text-[0.875rem] font-bold" style={{ background: '#eef1ee', color: DOC_GREEN, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                    {room.name}{room.note ? <span className="uppercase"> — {room.note}</span> : null}
                  </div>
                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-x-6 px-3 max-sm:grid-cols-1 max-sm:gap-y-3">
                    <ul className="m-0 list-none p-0" data-room-scope-lines>
                      {lines.map((l, i) => <li key={i} className={cn('py-[0.0625rem] text-[0.75rem] leading-[1.45]', strongLine(l) && 'font-bold')}>• {l}</li>)}
                      {!lines.length && <li className="text-[0.75rem] text-[#666]">• No tile installation</li>}
                    </ul>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-3" data-room-scope-tiles>
                      {tags.map((tag) => {
                        const t = tileOf(jobId, tag)
                        const where = whereIn(room, tag, t?.trim)
                        return (
                          <div key={tag} className="min-w-0" data-room-scope-tile={tag}>
                            {t?.photo || t?.swatch ? <TileImg tile={t} size={52} radius={2} /> : <div className="flex h-[3.25rem] w-[3.25rem] items-center justify-center bg-[#f3f3f1] text-[0.5625rem] font-bold text-[#888]">Photo pending</div>}
                            <div className="mt-1.5 text-[0.6875rem] font-bold leading-tight">{t?.name || tag}</div>
                            {t?.size && <div className="text-[0.6875rem] leading-tight text-[#333]">{t.size}</div>}
                            {where && <div className="mt-0.5 text-[0.625rem] leading-tight" style={{ color: DOC_GREEN }}>{where}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </section>
              )
            })}
          </React.Fragment>
        ))}
        {!rooms.length && <div className="py-12 text-center text-[0.75rem] text-[#666]">No rooms yet.</div>}
      </div>
      <DocFoot left={job.name} page={1} />
    </div>
  )
}
