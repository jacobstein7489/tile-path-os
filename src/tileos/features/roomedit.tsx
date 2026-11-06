/* Fixing what we're tiling, right where you see it: a room's square feet, one more wall or floor, one more room.
 * The materials, the installer's PO and the bills all follow the square feet. Once the scope is locked, only the
 * person it belongs to sees these as buttons — everyone else just reads it.
 *
 * A room is added the same way as on an estimate: pick the floor, then the room from the company's list (or type
 * one) — it comes with its usual walls and floors. */
import * as React from 'react'
import { Plus, Check, Layers, MoreHorizontal, Trash2 } from 'lucide-react'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { useStore } from '@/tileos/store'
import { scopeLock } from './steps'
import { Pop } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { toast } from '@/tileos/lib/pop'
import type { Room, Surface } from '@/tileos/data/jobs'
import { FLOORS, isOutside, guessSurfaces } from '@/tileos/data/areas'
import { addSurface } from './flows'
import { setSurfaceSF } from './flows2'
import { companyAreas, surfaceOf, addCompanyArea } from './estflow'
import { SurfaceAdd } from './estnew'
import { addArea, setRoom, removeRoom, addLine, removeLine, keyOfLine, isWallOrFloor, wallFloorKeys, scopeNameOf, roomStarted, lineStarted } from './scopebuild'

/** a wall or floor as a small chip — tap it to put in or fix its square feet */
export function SFChip({ jobId, room, x }: { jobId: string; room: string; x: Surface }) {
  const [open, setOpen] = React.useState(false)
  const [v, setV] = React.useState(x.sf ? String(x.sf) : '')
  const canEdit = useStore((s) => scopeLock(s, jobId).canEdit)
  React.useEffect(() => { if (open) setV(x.sf ? String(x.sf) : '') }, [open, x.sf])
  const save = () => { const n = Math.round(Number(v)); if (n > 0 && n !== x.sf) setSurfaceSF(jobId, room, x.name, n); setOpen(false) }
  if (!canEdit) return <span className="inline-flex h-7 items-center gap-1 rounded-full border border-line-2 bg-wash px-2.5 text-[0.78125rem] font-medium text-ink-2">{x.name.toLowerCase()}<span className="tnum font-semibold">{x.sf ? x.sf.toLocaleString('en-US') : '—'}</span></span>
  return (
    <Pop open={open} onOpenChange={setOpen} align="start" width={240} trigger={
      <button className={cn('inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[0.78125rem] font-medium transition', x.sf ? 'border-line bg-white text-ink-2 hover:border-brand-200 hover:text-brand-700' : 'border-dashed border-warn-300 bg-warn-50/50 text-warn-800 hover:border-warn-400')} aria-label={`${room} ${x.name} square feet`}>
        {x.name.toLowerCase()}<span className="tnum font-semibold">{x.sf ? x.sf.toLocaleString('en-US') : 'SF?'}</span>
      </button>
    }>
      <div className="text-[0.84375rem] font-semibold text-ink">{room} · {x.name}</div>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="mt-2 flex items-center gap-2">
        <TextInput autoFocus inputMode="decimal" aria-label="Square feet" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" className="h-9 w-24 text-right tnum" />
        <span className="text-[0.8125rem] text-muted">SF</span>
        <Button size="sm" variant="primary" type="submit" className="ml-auto" icon={<Check />}>Save</Button>
      </form>
    </Pop>
  )
}

/** one more wall or floor in this room — the company's walls and floors, or typed */
export function AddSurfaceButton({ jobId, room, have, className }: { jobId: string; room: string; have: string[]; className?: string }) {
  const s = useStore()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [sf, setSf] = React.useState('')
  const left = wallFloorKeys(s).map((k) => scopeNameOf(s, k)).filter((n) => !have.some((h) => h.toLowerCase() === n.toLowerCase()))
  const canEdit = scopeLock(s, jobId).canEdit
  const save = () => { if (!name.trim()) return; addSurface(jobId, room, name, Math.round(Number(sf)) || undefined); setName(''); setSf(''); setOpen(false) }
  if (!canEdit) return null
  return (
    <Pop open={open} onOpenChange={setOpen} align="start" width={340} trigger={
      <button className={cn('inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-[#cbd2db] px-2.5 text-[0.78125rem] font-semibold text-muted transition hover:border-brand-300 hover:text-brand-700', className)} aria-label={`Add a wall or floor to ${room}`}><Plus className="h-3.5 w-3.5" />Add</button>
    }>
      <div className="text-[0.84375rem] font-semibold text-ink">Add to {room}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {left.map((n) => <button key={n} onClick={() => setName(n)} className={cn('h-8 rounded-full border px-2.5 text-[0.78125rem] font-medium transition', name === n ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-2 hover:bg-wash')}>{n}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="mt-3 flex items-center gap-2">
        <TextInput aria-label="Wall or floor" value={name} onChange={(e) => setName(e.target.value)} placeholder="Or type it" className="h-9 min-w-0 flex-1" />
        <TextInput inputMode="decimal" aria-label="Square feet" value={sf} onChange={(e) => setSf(e.target.value.replace(/[^\d.]/g, ''))} placeholder="SF" className="h-9 w-[4.5rem] text-right tnum" />
        <Button size="sm" variant="primary" type="submit" disabled={!name.trim()}>Add</Button>
      </form>
    </Pop>
  )
}

/** pick the floor, then a room from the company's list (or type one) — it goes on right away with its usual walls and
 *  floors; the next one goes on the same floor unless you pick another */
export function AreaPicker({ jobId, onAdded }: { jobId: string; onAdded?: (room: string) => void }) {
  const s = useStore()
  const presets = companyAreas(s)
  const rooms = s.rooms[jobId] || []
  const [floor, setFloor] = React.useState<string>(() => rooms[rooms.length - 1]?.floor || '1st floor')
  const fl = (name: string) => (isOutside(name) ? 'Outside' : floor || undefined)
  const go = (name: string, keys: string[]) => { addArea(jobId, name, keys, fl(name)); onAdded?.(name) }
  return (
    <div className="grid grid-cols-[11rem_minmax(0,22rem)] gap-2 max-sm:grid-cols-1" data-area-picker>
      <SearchSelect label="Floor" value={floor} onChange={setFloor} emptyLabel="No floor" options={FLOORS.map((f) => ({ key: f, label: f }))} search={false} width={220} plain />
      <SearchSelect
        label="Room"
        value=""
        onChange={(n) => { const p = presets.find((x) => x.name === n); if (p) go(p.name, [...p.surfaces]) }}
        placeholder="Pick or type a room…"
        options={presets.map((p) => ({ key: p.name, label: p.name, hint: `Comes with: ${p.surfaces.filter((k) => isWallOrFloor(surfaceOf(s, k))).map((k) => scopeNameOf(s, k).toLowerCase()).join(', ')}` }))}
        search
        searchPlaceholder="Type a room — Kitchen, Mikvah…"
        width={400}
        onCreate={(n) => { const keys = guessSurfaces(n, presets); addCompanyArea(n, keys); go(n, keys) }}
        createLabel={(t) => `Add “${t}” — kept for next time`}
      />
    </div>
  )
}

/** the same box as on an estimate, under the scope: add a room — it comes with its usual walls and floors */
export function ScopeAreaAdder({ jobId, onAdded }: { jobId: string; onAdded?: (room: string) => void }) {
  const canEdit = useStore((s) => scopeLock(s, jobId).canEdit)
  if (!canEdit) return null
  return (
    <div className="rounded-[0.875rem] border border-dashed border-[#d6cfc3] bg-white/70 px-4 py-3" data-area-adder>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 text-[0.8125rem] font-semibold text-ink"><Layers className="h-4 w-4 text-muted" />Add a room<span className="font-normal text-muted">— it comes with its usual walls and floors</span></div>
      <AreaPicker jobId={jobId} onAdded={onAdded} />
    </div>
  )
}

/** one more room, from a button (the rooms page): the same floor and room picker in a small window */
export function AddRoomButton({ jobId, label = 'Add a room', className, size = 'xs' }: { jobId: string; have?: string[]; label?: string; className?: string; size?: 'xs' | 'sm' | 'md' }) {
  const [open, setOpen] = React.useState(false)
  const canEdit = useStore((s) => scopeLock(s, jobId).canEdit)
  if (!canEdit) return null
  return (
    <Pop open={open} onOpenChange={setOpen} align="end" width={420} trigger={<Button size={size} icon={<Plus />} className={className} data-add-room>{label}</Button>}>
      <div className="mb-2 text-[0.84375rem] font-semibold text-ink">A room — it comes with its usual walls and floors</div>
      <AreaPicker jobId={jobId} onAdded={() => setOpen(false)} />
    </Pop>
  )
}

/** a room's ···: which floor it's on, the note next to it on the paper, take it off */
export function RoomMenu({ jobId, room }: { jobId: string; room: Room }) {
  const [open, setOpen] = React.useState(false)
  const [note, setNote] = React.useState(room.note || '')
  React.useEffect(() => { if (open) setNote(room.note || '') }, [open])
  const started = roomStarted(room)
  return (
    <Pop open={open} onOpenChange={setOpen} align="end" width={320} trigger={<button type="button" aria-label={`${room.name} — floor and details`} data-room-menu={room.name} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint transition hover:bg-white hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>}>
      <div className="text-[0.78125rem] font-semibold text-muted">Floor</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {['', ...FLOORS].map((f) => <button key={f || 'none'} type="button" onClick={() => setRoom(jobId, room.name, { floor: f || null })} data-floor-pick={f || 'none'} className={cn('inline-flex h-7 items-center rounded-full border px-2.5 text-[0.78125rem] font-semibold', (room.floor || '') === f ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-[#c6bfb4]')}>{f || 'No floor'}</button>)}
      </div>
      <div className="mt-3 text-[0.78125rem] font-semibold text-muted">Next to the room on the paper</div>
      <form className="mt-1.5 flex gap-2" onSubmit={(x) => { x.preventDefault(); setRoom(jobId, room.name, { note }); setOpen(false) }}>
        <TextInput value={note} onChange={(x) => setNote(x.target.value)} placeholder="e.g. 9 ft ceiling; tiled to 4 ft" className="h-8 text-[0.8125rem]" />
        <Button size="sm" type="submit">Save</Button>
      </form>
      {started
        ? <div className="mt-3 text-[0.78125rem] text-muted">The crew started here — it stays on the scope.</div>
        : <button type="button" onClick={() => { setOpen(false); removeRoom(jobId, room.name) }} data-room-remove className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-bad-600 hover:text-bad-700"><Trash2 className="h-3.5 w-3.5" />Take {room.name} off</button>}
    </Pop>
  )
}

/** under a room: tick every wall and floor it has — the company's list, the same as on an estimate */
export function RoomLines({ jobId, room }: { jobId: string; room: Room }) {
  const s = useStore()
  const have = room.surfaces.map((x) => keyOfLine(s, x.name) || x.name)
  return (
    <SurfaceAdd
      label="Walls and floors"
      title="Tick every wall and floor it has"
      only={isWallOrFloor}
      nameOf={(k) => scopeNameOf(s, k)}
      have={have}
      onAdd={(k) => addLine(jobId, room.name, k)}
      onRemove={(k) => {
        const x = room.surfaces.find((y) => (keyOfLine(s, y.name) || y.name) === k)
        if (!x) return
        if (lineStarted(x)) { toast(`${room.name} · ${x.name} was started — it stays`); return }
        removeLine(jobId, room.name, x.name)
      }}
    />
  )
}
