/* Picking the tile for a wall or floor: every tile of the project, big enough to tell apart — its picture, its number
 * and name, its size, and where it goes already (the walls and floors it's on). The ones already in this room first.
 * A search when there are many; "Add a new tile" at the bottom. A phone: it comes up from the bottom. */
import * as React from 'react'
import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Pop } from '@/tileos/components/ui/overlay'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { tilesOf, tileOf, hasTile } from '@/tileos/data/jobs'

/** a room's walls and floors in few words: "shower walls A, B, C, niche, tub walls" (the first letter small, the rest as
 *  it's named — "wall A", never "wall a") */
function namesShort(names: string[]): string {
  const low = (n: string) => n.charAt(0).toLowerCase() + n.slice(1)
  const out: string[] = []
  const done = new Set<number>()
  names.forEach((n, i) => {
    if (done.has(i)) return
    const m = n.match(/^(.+) ([A-Z0-9]{1,2})$/)
    if (m) {
      const same = names.map((x, j) => ({ j, m: x.match(/^(.+) ([A-Z0-9]{1,2})$/) })).filter((x) => x.m && x.m[1] === m[1])
      if (same.length > 1) {
        same.forEach((x) => done.add(x.j))
        out.push(`${low(m[1])}${/s$/.test(m[1]) ? '' : 's'} ${same.map((x) => x.m![2]).join(', ')}`)
        return
      }
    }
    done.add(i)
    out.push(low(n))
  })
  return out.join(', ')
}
/** where a tile goes on the job, room by room: [["Master Bath", "main floor, curb"], ["Foyer", "floor, base"]] */
function placesOf(rooms: { name: string; surfaces: { name: string; tile: string; also?: string[] }[] }[], tag: string): [string, string][] {
  return rooms.map((r) => [r.name, r.surfaces.filter((x) => hasTile(x as any, tag)).map((x) => x.name)] as [string, string[]]).filter(([, l]) => l.length).map(([r, l]) => [r, namesShort(l)])
}

export function TilePicker({ jobId, room, value, onPick, onAdd, disabled }: { jobId: string; room: string; value: string; onPick: (tag: string) => void; onAdd?: () => void; disabled?: boolean }) {
  const s = useStore()
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const rooms = s.rooms[jobId] || []
  const all = tilesOf(jobId)
  const cur = value ? tileOf(jobId, value) : undefined
  const here = new Set(rooms.find((r) => r.name === room)?.surfaces.flatMap((x) => [x.tile, ...(x.also || [])]).filter(Boolean))
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = all
    .filter((t) => !words.length || words.every((w) => `${t.tag} ${t.name} ${t.size || ''} ${t.finish || ''} ${placesOf(rooms, t.tag).flat().join(' ')}`.toLowerCase().includes(w)))
    .sort((a, b) => Number(here.has(b.tag)) - Number(here.has(a.tag)) || a.tag.localeCompare(b.tag, undefined, { numeric: true }))
  const pick = (tag: string) => { onPick(tag); setOpen(false); setQ('') }
  const face = (
    <button type="button" disabled={disabled} aria-label="The tile · pick it" className={cn('flex min-h-12 w-full min-w-0 items-center gap-3 rounded-[0.625rem] border border-line bg-white px-2.5 py-1.5 text-left transition enabled:hover:border-[#cdc7bc]', open && 'border-brand-300 ring-[0.1875rem] ring-brand-50')} data-tile-pick={value || 'none'}>
      {cur ? <TileImg tile={cur} size={36} radius={6} /> : <span className="h-9 w-9 shrink-0 rounded-md border border-dashed border-[#cfc8bc] bg-wash" />}
      <span className="min-w-0 flex-1 leading-snug">
        {cur ? <><span className="block text-[0.9375rem] text-ink"><b className="font-semibold">{cur.tag}</b> {cur.name}</span><span className="block text-[0.8125rem] text-muted">{[cur.size, cur.finish].filter(Boolean).join(' · ')}</span></>
          : <span className="text-[0.9375rem] text-faint">Pick the tile</span>}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
    </button>
  )
  return (
    <Pop open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ('') }} sheet width={460} className="p-0" trigger={face}>
      <div className="flex max-h-[min(34rem,75dvh)] flex-col" data-tile-picker>
        <div className="flex items-center gap-2 border-b border-line-2 px-4 py-3 max-sm:pt-2">
          <span className="text-[0.9375rem] font-semibold text-ink">The tile</span>
          <span className="text-[0.8125rem] text-muted">{all.length} on this project</span>
        </div>
        {all.length > 5 && (
          <label className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line-2 px-4">
            <Search className="h-4 w-4 shrink-0 text-faint" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type its number, name or where it goes" className="h-full flex-1 bg-transparent text-[0.9375rem] text-ink placeholder:text-faint focus:outline-none" data-tile-pick-search />
          </label>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5" role="listbox" aria-label="The tile">
          {shown.map((t) => {
            const on = t.tag === value
            const places = placesOf(rooms, t.tag)
            return (
              <button key={t.tag} type="button" role="option" aria-selected={on} onClick={() => pick(t.tag)} className={cn('flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition', on ? 'bg-brand-50' : 'hover:bg-wash')} data-tile-option={t.tag}>
                <TileImg tile={t} size={48} radius={8} />
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="block text-[0.9375rem] text-ink"><b className="font-semibold">{t.tag}</b> {t.name}</span>
                  <span className="block text-[0.8125rem] text-muted">{[t.size, t.finish, here.has(t.tag) ? 'in this room' : ''].filter(Boolean).join(' · ')}</span>
                  <span className={cn('mt-0.5 block text-[0.8125rem]', places.length ? 'text-ink-2' : 'text-faint')} data-tile-option-where>{places.length ? <>Goes on: {places.map(([r, l], i) => <React.Fragment key={r}>{i > 0 && ' · '}<span className="font-medium text-ink">{r}</span> {l}</React.Fragment>)}</> : 'Not on a wall or floor yet'}</span>
                </span>
                {on && <Check className="mt-1 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
              </button>
            )
          })}
          {!shown.length && <div className="px-3 py-6 text-center text-[0.875rem] text-muted">{q ? <>No tile matches “{q}”.</> : 'No tiles on this project yet.'}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t border-line-2 px-2 py-2">
          {value && <button type="button" onClick={() => pick('')} className="rounded-lg px-3 py-2 text-[0.875rem] font-semibold text-muted hover:bg-wash hover:text-ink" data-tile-pick-none>No tile</button>}
          {onAdd && <button type="button" onClick={() => { setOpen(false); onAdd() }} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.875rem] font-semibold text-brand-700 hover:bg-brand-50" data-tile-pick-add><Plus className="h-4 w-4" />Add a new tile</button>}
        </div>
      </div>
    </Pop>
  )
}
