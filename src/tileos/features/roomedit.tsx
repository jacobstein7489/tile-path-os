/* Fixing what we're tiling, right where you see it: a room's square feet, one more wall or floor, one more room.
 * The materials, the installer's PO and the bills all follow the square feet. Once the scope is locked, only the
 * person it belongs to sees these as buttons — everyone else just reads it. */
import * as React from 'react'
import { Plus, Check } from 'lucide-react'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { useStore } from '@/tileos/store'
import { scopeLock } from './steps'
import { Pop } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import type { Surface } from '@/tileos/data/jobs'
import { addRoom, addSurface } from './flows'
import { setSurfaceSF } from './flows2'

export const SURFACE_NAMES = ['Floor', 'Walls', 'Shower walls', 'Shower floor', 'Tub walls', 'Backsplash', 'Niche', 'Curb', 'Bench', 'Accent wall', 'Base']

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

/** one more wall or floor in this room */
export function AddSurfaceButton({ jobId, room, have, className }: { jobId: string; room: string; have: string[]; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [sf, setSf] = React.useState('')
  const left = SURFACE_NAMES.filter((n) => !have.some((h) => h.toLowerCase() === n.toLowerCase()))
  const canEdit = useStore((s) => scopeLock(s, jobId).canEdit)
  const save = () => { if (!name.trim()) return; addSurface(jobId, room, name, Math.round(Number(sf)) || undefined); setName(''); setSf(''); setOpen(false) }
  if (!canEdit) return null
  return (
    <Pop open={open} onOpenChange={setOpen} align="start" width={320} trigger={
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

/** one more room on the project */
export function AddRoomButton({ jobId, have, label = 'Add a room', className }: { jobId: string; have: string[]; label?: string; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [picked, setPicked] = React.useState<string[]>(['Floor', 'Walls'])
  const clash = have.some((h) => h.toLowerCase() === name.trim().toLowerCase())
  const canEdit = useStore((s) => scopeLock(s, jobId).canEdit)
  const save = () => { if (!name.trim() || clash) return; addRoom(jobId, name, picked); setName(''); setPicked(['Floor', 'Walls']); setOpen(false) }
  if (!canEdit) return null
  return (
    <Pop open={open} onOpenChange={setOpen} align="end" width={340} trigger={<Button size="xs" icon={<Plus />} className={className}>{label}</Button>}>
      <div className="text-[0.84375rem] font-semibold text-ink">A room that isn’t on the list</div>
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <TextInput autoFocus aria-label="Room name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Powder room" className="mt-2 h-9 w-full" />
        {clash && <div className="mt-1 text-[0.75rem] font-medium text-bad-600">That room is already there.</div>}
        <div className="mt-3 text-[0.78125rem] font-medium text-muted">What gets tiled in it</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SURFACE_NAMES.map((n) => {
            const on = picked.includes(n)
            return <button type="button" key={n} onClick={() => setPicked(on ? picked.filter((x) => x !== n) : [...picked, n])} className={cn('h-8 rounded-full border px-2.5 text-[0.78125rem] font-medium transition', on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-2 hover:bg-wash')}>{n}</button>
          })}
        </div>
        <div className="mt-3 flex justify-end"><Button size="sm" variant="primary" type="submit" disabled={!name.trim() || clash || !picked.length}>Add the room</Button></div>
      </form>
    </Pop>
  )
}
