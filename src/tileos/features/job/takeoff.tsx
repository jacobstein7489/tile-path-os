/* What a project needs, worked out from the scope — checked against what's ordered and on site. Both on the same
 * columns: what · we need · ordered · here · where it's at.
 *   Tile: each tile on the project — what our takeoff needs (with the extra for cuts), what the GC (or we) ordered
 *   Setting materials: what goes under and around the tile — from the square feet and how each wall and floor is set
 * Tap a material to see exactly how it was worked out. */
import * as React from 'react'
import { ChevronDown, ShoppingCart, SlidersHorizontal, Calculator, Ruler, Plus, MoreHorizontal, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { logTileOrder } from '../flows2'
import { useStore } from '@/tileos/store'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { Menu, MenuItem, Pop } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { ItemThumb } from '../items'
import { addMat, setMatQty, removeMat, restoreMat } from '../matedit'
import { Status } from '@/tileos/components/ui/page'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { needWithWaste } from '@/tileos/data/work'
import { tilesOf, tileOf, GROUTS } from '@/tileos/data/jobs'
import type { Job } from '@/tileos/data/model'
import { takeoff, qtyLabel, GROUPS, type TakeLine } from '../takeoff'
import { tileStatus } from './scope-tab'
import { useSaveStatus } from '@/tileos/lib/save'
import { Section, Empty, Group, Word } from './kit'

const HEAD = 'border-b border-line-2 px-5 py-1.5 text-[0.71875rem] font-semibold text-muted max-sm:px-4'
/** the same columns for the tile and the materials: what · we need · ordered · here · where it's at */
const QGRID = 'grid grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_5.5rem_15rem] items-center gap-4 max-lg:grid-cols-[minmax(0,1fr)_6rem_5.5rem_12rem] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-3'
const num = (n?: number) => (n ? n.toLocaleString('en-US') : '—')
function Heads({ first }: { first: string }) {
  return (
    <div className={cn(QGRID, HEAD)}>
      <span>{first}</span>
      <span className="text-right max-sm:hidden">We need</span>
      <span className="text-right max-sm:hidden">Ordered</span>
      <span className="text-right max-lg:hidden">Here</span>
      <span className="text-right">Where it’s at</span>
    </div>
  )
}
const EXACT = new Set(['m-liner', 'm-jolly', 'm-trim', 'm-edge'])

/* ---------------- tile ---------------- */
export function TileOrders({ job, onScope, simple }: { job: Job; onScope: () => void; simple?: boolean }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const checks = s.checks.filter((c) => c.jobId === job.id)
  const tags = Array.from(new Set([...tilesOf(job.id).map((t) => t.tag), ...checks.map((c) => c.tag)]))
  return (
    <Section title="Tile" count={tags.length} right={tags.length ? 'We need includes the extra for cuts' : undefined}>
      <div>
        {tags.length > 0 && <Heads first="Tile" />}
        {tags.map((tag) => {
          const t = tileOf(job.id, tag)
          const c = checks.find((y) => y.tag === tag)
          const uses = rooms.flatMap((r) => r.surfaces.filter((x) => x.tile === tag).map((x) => ({ room: r.name, x })))
          const sf = uses.reduce((n, u) => n + (u.x.sf || 0), 0)
          const need = c ? needWithWaste(c) : Math.ceil(sf * 1.1)
          const unit = c?.unit || 'SF'
          const st = tileStatus(s, job.id, tag)
          const short = c ? Math.max(0, need - c.ordered) : 0
          const who = t?.suppliedBy === 'Us' ? 'We' : `The ${t?.suppliedBy === 'Owner' ? 'owner' : 'GC'}`
          const boxes = t?.boxSF && unit === 'SF' ? Math.ceil(need / t.boxSF) : 0
          /* the site manager only checks deliveries in — ordering and settling quantities are the office's */
          const action = !c
            ? sf > 0 && !simple ? { label: `${who} ordered it`, run: () => logTileOrder(job.id, tag, { sf, where: uses.map((u) => `${u.room} ${u.x.name.toLowerCase()}`).join(' · ') }) } : null
            : short && !simple ? { label: 'Settle it', run: () => s.open({ t: 'qty', jobId: job.id, tag }) }
              : c.received < c.ordered ? { label: 'It came in', run: () => s.open({ t: 'receivetile', jobId: job.id, tag }) } : null
          return (
            <div key={tag} className={cn(QGRID, 'min-h-[3rem] border-t border-line-2 px-5 py-2 first:border-t-0 max-sm:px-4')}>
              <span className="flex min-w-0 items-center gap-3">
                <TileImg tile={t} size={32} radius={7} />
                <span className="min-w-0">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink"><span className="tnum">{tag}</span> · {t?.name || 'Tile'}{t?.size ? <span className="font-normal text-muted"> · {t.size}</span> : null}</span>
                  <span className="block truncate text-[0.78125rem] text-muted">{c ? `${c.where} · ${c.supplier} · ordered by the ${c.suppliedBy === 'Owner' ? 'owner' : c.suppliedBy === 'Us' ? 'us' : 'GC'}` : uses.length ? `${uses.length} wall${uses.length === 1 ? '' : 's'} and floors · ${who === 'We' ? 'we order it' : `the ${t?.suppliedBy === 'Owner' ? 'owner' : 'GC'} orders it`}${t?.supplier ? ` from ${t.supplier}` : ''}` : 'Not on a wall or floor yet'}</span>
                </span>
              </span>
              <span className="text-right max-sm:hidden">
                <span className="block text-[0.875rem] font-semibold tnum text-ink">{need ? `${need.toLocaleString('en-US')} ${unit}` : '—'}</span>
                {boxes > 0 && <span className="block text-[0.75rem] tnum text-muted">{boxes} boxes</span>}
              </span>
              <span className="text-right text-[0.84375rem] tnum text-ink-2 max-sm:hidden">{c ? num(c.ordered) : '—'}</span>
              <span className="text-right text-[0.84375rem] tnum text-ink-2 max-lg:hidden">{c ? num(c.received) : '—'}</span>
              <span className="flex min-w-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-1">
                <Word tone={st.tone === 'bad' ? 'bad' : st.tone === 'ok' ? 'ok' : undefined} className="truncate">{st.label}</Word>
                {action && <Button size="xs" variant={short ? 'primary' : 'outline'} onClick={action.run}>{action.label}</Button>}
              </span>
            </div>
          )
        })}
        {!tags.length && (
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-[0.84375rem] text-muted max-sm:px-4">
            <span className="min-w-0 flex-1">No tiles yet — they come in when the tile paperwork is entered.</span>
            <Button size="sm" icon={<Ruler />} onClick={onScope}>Scope of work</Button>
          </div>
        )}
      </div>
    </Section>
  )
}

/* ---------------- our materials ---------------- */
export function MaterialsNeed({ job, onScope, simple }: { job: Job; onScope: () => void; simple?: boolean }) {
  const s = useStore()
  const save = useSaveStatus()
  const t = takeoff(s, job.id)
  const [open, setOpen] = React.useState<string | null>(null)
  const miss = t.lines.filter((l) => l.toOrder > 0)
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k))
  /* the office (and whoever orders) can change the list by hand; the site manager just sees it */
  const canEdit = !simple && ['owner', 'pm', 'office', 'estimator', 'materials'].includes(s.role)
  const shownCount = t.lines.length
  return (
    <Section
      title="Setting materials"
      count={t.counted || shownCount ? shownCount : undefined}
      right={t.counted ? <span className="max-md:hidden">From {t.counted} walls and floors · {t.sf.toLocaleString('en-US')} SF{save.mode === 'sample' ? ' · sample' : ''}</span> : undefined}
      action={simple ? undefined : <>
        {s.role === 'owner' && <Button size="sm" variant="ghost" icon={<SlidersHorizontal />} onClick={() => { s.closeAll(); s.go({ page: 'settings' }) }}><span className="max-sm:hidden">The numbers</span></Button>}
        {canEdit && <AddMaterial jobId={job.id} />}
        {miss.length > 0 && <Button size="sm" variant="primary" icon={<ShoppingCart />} onClick={() => s.open({ t: 'newpo', jobId: job.id, fromTakeoff: true })}>Order what’s missing · {miss.length}</Button>}
      </>}
    >
      {!t.counted && !shownCount ? (
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-[0.84375rem] text-muted max-sm:px-4">
          <span className="min-w-0 flex-1">{t.total ? 'Each wall and floor needs its square feet and its tile — then the materials work themselves out.' : 'No rooms yet — they come over from the estimate.'}</span>
          <Button size="sm" icon={<Ruler />} onClick={onScope}>Scope of work</Button>
        </div>
      ) : (
        <div>
          <Heads first="Material" />
          {GROUPS.map((g) => {
            const ls = t.lines.filter((l) => l.group === g)
            if (!ls.length) return null
            return (
              <section key={g}>
                <Group label={g} />
                {ls.map((l) => <Line key={l.itemId} l={l} jobId={job.id} open={open === l.itemId} onToggle={() => toggle(l.itemId)} waste={t.rules.waste} canEdit={canEdit} />)}
              </section>
            )
          })}
        </div>
      )}
      {t.off.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line-2 px-5 py-2.5 text-[0.8125rem] text-muted max-sm:px-4">
          <span className="font-semibold text-ink-2">Taken off the list</span>
          {t.off.map((id) => {
            const nm = s.items.find((i) => i.id === id)?.name || id
            return canEdit
              ? <button key={id} onClick={() => restoreMat(job.id, id)} className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-white px-2.5 text-[0.78125rem] font-medium text-ink-2 hover:bg-wash" title="Put it back on the list"><RotateCcw className="h-3 w-3" />{nm}</button>
              : <span key={id} className="text-[0.78125rem]">{nm}</span>
          })}
        </div>
      )}
      {t.skipped.length > 0 && t.counted > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-2 bg-[#faf8f5] px-5 py-2.5 text-[0.8125rem] text-ink-2 max-sm:px-4">
          <span className="font-semibold text-ink">Not counted yet</span>
          <span className="min-w-0 flex-1">{t.skipped.slice(0, 4).map((k) => `${k.room} ${k.surface.toLowerCase()} — ${k.why.toLowerCase()}`).join(' · ')}{t.skipped.length > 4 ? ` and ${t.skipped.length - 4} more` : ''}</span>
          <button onClick={onScope} className="font-semibold text-ink underline-offset-2 hover:underline">Scope of work</button>
        </div>
      )}
    </Section>
  )
}


function Line({ l, jobId, open, onToggle, waste, canEdit }: { l: TakeLine; jobId: string; open: boolean; onToggle: () => void; waste: number; canEdit?: boolean }) {
  const s = useStore()
  const it = s.items.find((i) => i.id === l.itemId)
  const unit = it?.unit || ''
  const rooms = Array.from(new Set(l.uses.filter((u) => u.room !== 'Added by hand').map((u) => u.room)))
  const sf = Array.from(new Map(l.uses.filter((u) => u.sf).map((u) => [u.room + u.surface, u.sf])).values()).reduce((n, v) => n + v, 0)
  const where = l.manual ? 'Added by hand' : rooms.length > 3 ? `${rooms.length} rooms` : rooms.join(', ')
  const exact = EXACT.has(l.itemId)
  const [editing, setEditing] = React.useState(false)
  const [q, setQ] = React.useState(String(l.need))
  React.useEffect(() => setQ(String(l.need)), [l.need])
  const saveQty = () => { const n = Math.max(0, Math.round(Number(q.replace(/[^0-9.]/g, '')) || 0)); setEditing(false); if (n !== l.need) setMatQty(jobId, l.itemId, n) }
  /* grout: which colors, so the order says them */
  const colors = l.itemId === 'm-grout' ? Array.from(new Set(l.uses.map((u) => s.rooms[jobId]?.find((r) => r.name === u.room)?.surfaces.find((x) => x.name === u.surface)?.grout).filter(Boolean) as string[])).map((g) => GROUTS[g]?.name || g) : []
  return (
    <div className="border-t border-line-2">
      <div className={cn(QGRID, 'min-h-[3.25rem] w-full px-5 py-1.5 transition-colors hover:bg-[#f7f5f0] max-sm:px-4')}>
        <button onClick={onToggle} className="flex min-w-0 items-center gap-3 text-left" aria-expanded={open}>
          <ItemThumb item={it} size={38} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[0.875rem] font-medium text-ink"><span className="truncate">{it?.name || l.itemId}</span><ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-faint transition', open && 'rotate-180')} /></span>
            <span className="block truncate text-[0.78125rem] text-muted"><span className="font-semibold text-ink-2 sm:hidden">{qtyLabel(l.need, unit)} · </span>{colors.length ? `${colors.join(', ')} · ` : ''}{where}{sf && !exact && !l.manual ? ` · ${sf.toLocaleString('en-US')} SF` : ''}</span>
          </span>
        </button>
        <span className={cn('text-right', editing ? 'max-sm:col-span-2 max-sm:row-start-2 max-sm:text-left' : 'max-sm:hidden')}>
          {editing ? (
            <span className="inline-flex items-center gap-1">
              <input autoFocus aria-label={`How many ${it?.name || ''}`} inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveQty(); if (e.key === 'Escape') setEditing(false) }} onBlur={saveQty} className="h-8 w-[4.5rem] rounded-lg border border-brand-300 px-2 text-right text-[0.875rem] font-semibold tnum outline-none ring-2 ring-brand-100" />
            </span>
          ) : (
            <span className="block">
              <span className="block text-[0.875rem] font-semibold tnum text-ink">{qtyLabel(l.need, unit)}</span>
              {l.edited != null && <span className="block text-[0.71875rem] text-muted">changed · worked out {l.edited}</span>}
            </span>
          )}
        </span>
        <span className="text-right text-[0.84375rem] tnum text-ink-2 max-sm:hidden">{num(l.have)}</span>
        <span className="text-right text-[0.84375rem] tnum text-ink-2 max-lg:hidden">{num(l.onSite)}</span>
        <span className="flex items-center justify-end gap-1.5">
          {l.toOrder > 0 ? <Word className="text-ink">To order {l.toOrder.toLocaleString('en-US')}</Word> : l.onSite >= l.need ? <Word tone="ok">On site</Word> : <Word>Coming</Word>}
          {canEdit && (
            <Menu align="end" width={240} trigger={<button aria-label={`Change ${it?.name || 'this material'}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-wash hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>}>
              <MenuItem icon={<Pencil />} onSelect={() => { setQ(String(l.need)); setEditing(true) }}>Change how many</MenuItem>
              {l.edited != null && <MenuItem icon={<RotateCcw />} onSelect={() => setMatQty(jobId, l.itemId, null)}>Back to the worked-out {l.edited}</MenuItem>}
              <MenuItem icon={<Trash2 />} onSelect={() => removeMat(jobId, l.itemId)}>Take it off the list</MenuItem>
            </Menu>
          )}
        </span>
      </div>
      {open && (
        <div className="bg-wash px-5 pb-3 pl-[4.25rem] pt-1.5 max-sm:px-4">
          {l.uses.map((u, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4 py-[0.1875rem] text-[0.78125rem]">
              <span className="min-w-0 text-ink-2">{u.room === 'Added by hand' ? <b className="font-semibold text-ink">Added by hand</b> : <b className="font-semibold text-ink">{u.room} · {u.surface.toLowerCase()}</b>}{u.room === 'Added by hand' ? (u.surface ? ` — ${u.surface}` : '') : ` — ${u.note}`}</span>
              <span className="shrink-0 tnum text-muted">{u.raw < 10 ? Math.round(u.raw * 10) / 10 : Math.round(u.raw)}</span>
            </div>
          ))}
          <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-line pt-1.5 text-[0.78125rem] font-semibold text-ink">
            <span>{l.edited != null ? `Changed by hand — worked out ${l.edited}` : l.manual ? 'Added by hand' : exact ? 'Counted as is' : `${Math.round(l.raw * 10) / 10} + ${waste}% extra, rounded up`}{l.itemId === 'm-sand' ? ` · about ${((l.need * 50) / 2000).toFixed(1)} tons` : ''}</span>
            <span className="tnum">{qtyLabel(l.need, unit)}</span>
          </div>
          {l.refs.length > 0 && <div className="mt-1 text-[0.75rem] text-muted">Covered by {l.refs.join(', ')}</div>}
        </div>
      )}
    </div>
  )
}

/** add a material by hand — from the Items catalog, or a new one */
function AddMaterial({ jobId }: { jobId: string }) {
  const s = useStore()
  const [open, setOpen] = React.useState(false)
  const [itemId, setItemId] = React.useState('')
  const [qty, setQty] = React.useState('')
  const [note, setNote] = React.useState('')
  const mats = s.items.filter((i) => i.type === 'material')
  const it = mats.find((i) => i.id === itemId)
  const n = Math.round(Number(qty.replace(/[^0-9.]/g, '')) || 0)
  const add = () => { if (!itemId || !n) return; addMat(jobId, itemId, n, note.trim() || undefined); setItemId(''); setQty(''); setNote(''); setOpen(false) }
  return (
    <Pop open={open} onOpenChange={setOpen} align="end" width={400} trigger={<Button size="sm" icon={<Plus />}>Add a material</Button>}>
      <div className="text-[0.875rem] font-semibold text-ink">Add a material</div>
      <div className="mt-0.5 text-[0.78125rem] text-muted">Something the takeoff didn’t work out — it goes on the list and on the next order.</div>
      <div className="mt-3">
        <SearchSelect
          label="Material"
          value={itemId}
          onChange={setItemId}
          options={mats.map((m) => ({ key: m.id, label: m.name, hint: [m.brand, m.pack || m.unit].filter(Boolean).join(' · '), lead: <ItemThumb item={m} size={28} /> }))}
          placeholder="Pick from your items"
          searchPlaceholder="Type a material…"
          search
          width={380}
          footer={{ label: 'A new one — add it to Items', onClick: () => { setOpen(false); s.open({ t: 'newitem' }) } }}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <TextInput aria-label="How many" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="How many" className="h-10 w-[7rem] text-right tnum" />
        <span className="text-[0.84375rem] text-muted">{it ? qtyLabel(n || 2, it.unit).replace(/^\d[\d,]*\s/, '') : ''}</span>
      </div>
      <TextInput className="mt-2 h-10" aria-label="What it’s for" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it’s for (optional) — e.g. extra for the steps" />
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" variant="primary" disabled={!itemId || !n} onClick={add}>Add it</Button>
      </div>
    </Pop>
  )
}
